import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { customerId, barberId, serviceId, scheduledAt, barbershopId } =
      await request.json();

    if (!customerId || !serviceId || !scheduledAt || !barbershopId) {
      return NextResponse.json(
        { error: "Dados incompletos para agendamento" },
        { status: 400 }
      );
    }

    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes")
      .eq("id", serviceId)
      .eq("barbershop_id", barbershopId)
      .single();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: "Serviço não encontrado" },
        { status: 404 }
      );
    }

    // If no barber selected, find first available
    let finalBarberId = barberId;

    if (!finalBarberId) {
      const scheduledDate = new Date(scheduledAt);
      const dayOfWeek = scheduledDate.getDay();
      const hour = scheduledDate.getHours();

      // Get all active barbers with schedules for this day
      const { data: barbers } = await supabase
        .from("barbers")
        .select("id")
        .eq("barbershop_id", barbershopId)
        .eq("is_active", true);

      if (!barbers || barbers.length === 0) {
        return NextResponse.json(
          { error: "Nenhum barbeiro disponível" },
          { status: 404 }
        );
      }

      // Find first available barber
      for (const barber of barbers) {
        const isAvailable = await checkBarberAvailability(
          barber.id,
          scheduledAt,
          service.duration_minutes,
          barbershopId
        );
        if (isAvailable) {
          finalBarberId = barber.id;
          break;
        }
      }

      if (!finalBarberId) {
        return NextResponse.json(
          { error: "Nenhum barbeiro disponível neste horário" },
          { status: 409 }
        );
      }
    } else {
      // Check if selected barber is available
      const isAvailable = await checkBarberAvailability(
        finalBarberId,
        scheduledAt,
        service.duration_minutes,
        barbershopId
      );

      if (!isAvailable) {
        return NextResponse.json(
          { error: "Barbeiro não disponível neste horário" },
          { status: 409 }
        );
      }
    }

    // Create appointment
    const { data: appointment, error: insertError } = await supabase
      .from("appointments")
      .insert({
        customer_id: customerId,
        barber_id: finalBarberId,
        service_id: serviceId,
        scheduled_at: scheduledAt,
        duration_minutes: service.duration_minutes,
        price: service.price,
        status: "scheduled",
        barbershop_id: barbershopId,
      })
      .select("id, scheduled_at, duration_minutes, status")
      .single();

    if (insertError) {
      console.error("Insert appointment error:", insertError);
      return NextResponse.json(
        { error: "Erro ao criar agendamento" },
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
        service: service,
      },
    });
  } catch (error) {
    console.error("Book error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
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
  const dayOfWeek = scheduledDate.getDay();
  const hour = scheduledDate.getHours();

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

  // Check for conflicting appointments
  const endTime = new Date(scheduledDate.getTime() + durationMinutes * 60000);
  const startOfDay = new Date(scheduledDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(scheduledDate);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: appointments } = await supabase
    .from("appointments")
    .select("scheduled_at, duration_minutes")
    .eq("barber_id", barberId)
    .eq("barbershop_id", barbershopId)
    .gte("scheduled_at", startOfDay.toISOString())
    .lte("scheduled_at", endOfDay.toISOString())
    .neq("status", "cancelled");

  if (appointments) {
    for (const apt of appointments) {
      const aptStart = new Date(apt.scheduled_at);
      const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);

      // Check overlap
      if (scheduledDate < aptEnd && endTime > aptStart) {
        return false;
      }
    }
  }

  return true;
}
