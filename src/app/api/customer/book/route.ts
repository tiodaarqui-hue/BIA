import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toBrazilTime, getBrazilDayRange } from "@/lib/timezone";
import { bookingSchema, validateBody } from "@/lib/validations";
import { ErrorCodes, createError } from "@/lib/errors";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ServiceData {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface MemberPlan {
  included_service_ids: string[] | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(bookingSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { customerId, barberId, serviceIds, scheduledAt, barbershopId } = validation.data;

    // Get customer membership status
    const { data: customer } = await supabase
      .from("customers")
      .select(`
        is_member,
        member_expires_at,
        member_plan:member_plans(included_service_ids)
      `)
      .eq("id", customerId)
      .single();

    // Determine covered services (if member with active plan)
    let coveredServiceIds: string[] = [];
    const now = new Date();

    if (customer?.is_member && customer.member_expires_at) {
      const expiresAt = new Date(customer.member_expires_at);
      if (expiresAt > now) {
        // Member with active plan - get covered services
        // Supabase returns single relation as object, not array
        const memberPlan = Array.isArray(customer.member_plan)
          ? customer.member_plan[0] as MemberPlan | undefined
          : customer.member_plan as MemberPlan | null;
        coveredServiceIds = memberPlan?.included_service_ids || [];
      }
    }

    // Get all selected services
    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes")
      .in("id", serviceIds)
      .eq("barbershop_id", barbershopId);

    if (servicesError || !services || services.length === 0) {
      return NextResponse.json(
        createError(ErrorCodes.SERVICE_NOT_FOUND, "Serviço(s) não encontrado(s)"),
        { status: 404 }
      );
    }

    // Verify all requested services were found
    if (services.length !== serviceIds.length) {
      return NextResponse.json(
        createError(ErrorCodes.SERVICE_NOT_FOUND, "Um ou mais serviços não encontrados"),
        { status: 404 }
      );
    }

    // Separate covered vs chargeable services
    const coveredServices = services.filter(s => coveredServiceIds.includes(s.id));
    const chargeableServices = services.filter(s => !coveredServiceIds.includes(s.id));

    // Calculate totals
    const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);
    // Only charge for services NOT covered by plan
    const totalAmount = chargeableServices.reduce((sum, s) => sum + Number(s.price), 0);
    // Full price (for reference/display)
    const fullPrice = services.reduce((sum, s) => sum + Number(s.price), 0);

    // Calculate end time
    const scheduledDate = new Date(scheduledAt);
    const endTime = new Date(scheduledDate.getTime() + totalDuration * 60000);

    // If no barber selected, find first available
    let finalBarberId = barberId;

    if (!finalBarberId) {
      // Get all active barbers
      const { data: barbers } = await supabase
        .from("barbers")
        .select("id")
        .eq("barbershop_id", barbershopId)
        .eq("is_active", true);

      if (!barbers || barbers.length === 0) {
        return NextResponse.json(
          createError(ErrorCodes.NO_BARBERS_AVAILABLE, "Nenhum barbeiro disponível"),
          { status: 404 }
        );
      }

      // Find first available barber
      for (const barber of barbers) {
        const isAvailable = await checkBarberAvailability(
          barber.id,
          scheduledAt,
          totalDuration,
          barbershopId
        );
        if (isAvailable) {
          finalBarberId = barber.id;
          break;
        }
      }

      if (!finalBarberId) {
        return NextResponse.json(
          createError(ErrorCodes.SLOT_CONFLICT, "Nenhum barbeiro disponível neste horário"),
          { status: 409 }
        );
      }
    } else {
      // Check if selected barber is available
      const isAvailable = await checkBarberAvailability(
        finalBarberId,
        scheduledAt,
        totalDuration,
        barbershopId
      );

      if (!isAvailable) {
        return NextResponse.json(
          createError(ErrorCodes.BARBER_NOT_AVAILABLE, "Barbeiro não disponível neste horário"),
          { status: 409 }
        );
      }
    }

    // Create appointment with multi-service support
    // price = amount to charge (excludes plan-covered services)
    // total_amount = same as price (for consistency)
    const { data: appointment, error: insertError } = await supabase
      .from("appointments")
      .insert({
        customer_id: customerId,
        barber_id: finalBarberId,
        service_id: serviceIds[0], // Primary service for backwards compatibility
        scheduled_at: scheduledAt,
        end_time: endTime.toISOString(),
        duration_minutes: totalDuration,
        total_duration: totalDuration,
        price: totalAmount,
        total_amount: totalAmount,
        status: "scheduled",
        barbershop_id: barbershopId,
      })
      .select("id, scheduled_at, end_time, duration_minutes, total_duration, total_amount, status")
      .single();

    if (insertError) {
      console.error("Insert appointment error:", insertError);

      // Check if it's a constraint violation (double-booking)
      if (insertError.code === "23P01") {
        return NextResponse.json(
          createError(ErrorCodes.SLOT_CONFLICT, "Horário já ocupado por outro agendamento"),
          { status: 409 }
        );
      }

      return NextResponse.json(
        createError(ErrorCodes.INTERNAL_ERROR, "Erro ao criar agendamento"),
        { status: 500 }
      );
    }

    // Create appointment_services records with snapshots
    // Mark which services are covered by plan vs chargeable
    const appointmentServices = services.map((service: ServiceData) => ({
      appointment_id: appointment.id,
      service_id: service.id,
      barbershop_id: barbershopId,
      service_name_snapshot: service.name,
      duration_snapshot: service.duration_minutes,
      price_snapshot: service.price,
      covered_by_plan: coveredServiceIds.includes(service.id),
    }));

    const { error: servicesInsertError } = await supabase
      .from("appointment_services")
      .insert(appointmentServices);

    if (servicesInsertError) {
      console.error("Insert appointment_services error:", servicesInsertError);
      // Rollback the appointment
      await supabase.from("appointments").delete().eq("id", appointment.id);
      return NextResponse.json(
        createError(ErrorCodes.INTERNAL_ERROR, "Erro ao criar serviços do agendamento"),
        { status: 500 }
      );
    }

    // Get barber name for response
    const { data: barber } = await supabase
      .from("barbers")
      .select("name")
      .eq("id", finalBarberId)
      .single();

    return NextResponse.json({
      success: true,
      appointment: {
        ...appointment,
        barber: barber,
        services: services,
        covered_services: coveredServices.map(s => s.name),
        chargeable_services: chargeableServices.map(s => s.name),
        full_price: fullPrice,
      },
    });
  } catch (error) {
    console.error("Book error:", error);
    return NextResponse.json(
      createError(ErrorCodes.INTERNAL_ERROR, "Erro interno do servidor"),
      { status: 500 }
    );
  }
}

async function checkBarberAvailability(
  barberId: string,
  scheduledAt: string,
  durationMinutes: number,
  barbershopId: string
): Promise<boolean> {
  const scheduledDate = new Date(scheduledAt);
  const brazilTime = toBrazilTime(scheduledDate);
  const dayOfWeek = brazilTime.dayOfWeek;
  const hour = brazilTime.hours;

  // Get agenda settings for fallback
  const { data: settings } = await supabase
    .from("agenda_settings")
    .select("start_hour, end_hour, enabled_days")
    .eq("barbershop_id", barbershopId)
    .single();

  const defaultStartHour = settings?.start_hour || 8;
  const defaultEndHour = settings?.end_hour || 20;
  const enabledDays = settings?.enabled_days || [1, 2, 3, 4, 5, 6];

  // Check if day is enabled
  if (!enabledDays.includes(dayOfWeek)) {
    return false;
  }

  // Get ALL barber schedules to check if they have any configured
  const { data: allSchedules } = await supabase
    .from("barber_schedules")
    .select("day_of_week, start_time, end_time")
    .eq("barber_id", barberId);

  const hasAnySchedule = allSchedules && allSchedules.length > 0;
  const schedule = allSchedules?.find((s) => s.day_of_week === dayOfWeek);

  // If barber has schedules configured but none for this day → unavailable
  if (hasAnySchedule && !schedule) {
    return false;
  }

  // Use barber's schedule or fallback to agenda settings (only if no schedules at all)
  const startHour = schedule
    ? parseInt(schedule.start_time.split(":")[0])
    : defaultStartHour;
  const endHour = schedule
    ? parseInt(schedule.end_time.split(":")[0])
    : defaultEndHour;

  if (hour < startHour || hour >= endHour) {
    return false;
  }

  // Check for blocks
  const { data: blocks } = await supabase
    .from("barber_blocks")
    .select("id")
    .eq("barber_id", barberId)
    .lte("start_at", scheduledAt)
    .gte("end_at", scheduledAt);

  if (blocks && blocks.length > 0) {
    return false;
  }

  // Check for conflicting appointments (using end_time)
  const endTime = new Date(scheduledDate.getTime() + durationMinutes * 60000);
  const { startUtc, endUtc } = getBrazilDayRange(brazilTime.dateStr);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("scheduled_at, end_time")
    .eq("barber_id", barberId)
    .eq("barbershop_id", barbershopId)
    .gte("scheduled_at", startUtc.toISOString())
    .lte("scheduled_at", endUtc.toISOString())
    .neq("status", "cancelled");

  if (appointments) {
    for (const apt of appointments) {
      const aptStart = new Date(apt.scheduled_at);
      const aptEnd = new Date(apt.end_time);

      // Check overlap
      if (scheduledDate < aptEnd && endTime > aptStart) {
        return false;
      }
    }
  }

  return true;
}
