import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barbershopId = searchParams.get("barbershopId");
    const date = searchParams.get("date"); // YYYY-MM-DD
    const barberId = searchParams.get("barberId"); // optional
    const serviceDuration = parseInt(searchParams.get("duration") || "30");

    if (!barbershopId || !date) {
      return NextResponse.json(
        { error: "barbershopId e date são obrigatórios" },
        { status: 400 }
      );
    }

    const targetDate = new Date(date + "T00:00:00");
    const dayOfWeek = targetDate.getDay();
    const now = new Date();
    const isToday = targetDate.toDateString() === now.toDateString();

    // Get agenda settings
    const { data: settings } = await supabase
      .from("agenda_settings")
      .select("start_hour, end_hour, enabled_days")
      .eq("barbershop_id", barbershopId)
      .single();

    const startHour = settings?.start_hour || 8;
    const endHour = settings?.end_hour || 20;
    const enabledDays = settings?.enabled_days || [1, 2, 3, 4, 5, 6];

    // Check if day is enabled
    if (!enabledDays.includes(dayOfWeek)) {
      return NextResponse.json({ slots: [], message: "Dia não disponível" });
    }

    // Get barbers to check
    let barbersToCheck: string[] = [];

    if (barberId) {
      barbersToCheck = [barberId];
    } else {
      const { data: barbers } = await supabase
        .from("barbers")
        .select("id")
        .eq("barbershop_id", barbershopId)
        .eq("is_active", true);

      barbersToCheck = barbers?.map((b) => b.id) || [];
    }

    if (barbersToCheck.length === 0) {
      return NextResponse.json({ slots: [], message: "Nenhum barbeiro disponível" });
    }

    // Get ALL schedules for barbers (to know who has any configured)
    const { data: allSchedules } = await supabase
      .from("barber_schedules")
      .select("barber_id, day_of_week, start_time, end_time")
      .in("barber_id", barbersToCheck);

    // Filter schedules for this specific day
    const schedules = allSchedules?.filter((s) => s.day_of_week === dayOfWeek);

    // Group barbers by whether they have ANY schedule configured
    const barbersWithSchedules = new Set(allSchedules?.map((s) => s.barber_id) || []);

    // Get blocks for this day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: blocks } = await supabase
      .from("barber_blocks")
      .select("barber_id, start_at, end_at")
      .in("barber_id", barbersToCheck)
      .lte("start_at", endOfDay.toISOString())
      .gte("end_at", startOfDay.toISOString());

    // Get existing appointments for this day
    const { data: appointments } = await supabase
      .from("appointments")
      .select("barber_id, scheduled_at, duration_minutes")
      .eq("barbershop_id", barbershopId)
      .in("barber_id", barbersToCheck)
      .gte("scheduled_at", startOfDay.toISOString())
      .lte("scheduled_at", endOfDay.toISOString())
      .neq("status", "cancelled");

    // Generate available slots
    const availableSlots: string[] = [];
    const slotInterval = 30; // 30 minute intervals

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        const slotTime = new Date(targetDate);
        slotTime.setHours(hour, minute, 0, 0);

        // Skip past slots if today
        if (isToday && slotTime <= now) {
          continue;
        }

        // Check if any barber is available at this slot
        let isAvailable = false;

        for (const bId of barbersToCheck) {
          const schedule = schedules?.find((s) => s.barber_id === bId);
          const hasAnySchedule = barbersWithSchedules.has(bId);

          // If barber has schedules configured but none for this day → unavailable
          if (hasAnySchedule && !schedule) continue;

          // Use barber's specific schedule or fallback to agenda_settings (only if no schedules at all)
          const schedStart = schedule
            ? parseInt(schedule.start_time.split(":")[0])
            : startHour;
          const schedEnd = schedule
            ? parseInt(schedule.end_time.split(":")[0])
            : endHour;

          if (hour < schedStart || hour >= schedEnd) continue;

          // Check blocks
          const isBlocked = blocks?.some((block) => {
            if (block.barber_id !== bId) return false;
            const blockStart = new Date(block.start_at);
            const blockEnd = new Date(block.end_at);
            return slotTime >= blockStart && slotTime < blockEnd;
          });

          if (isBlocked) continue;

          // Check existing appointments
          const slotEnd = new Date(slotTime.getTime() + serviceDuration * 60000);
          const hasConflict = appointments?.some((apt) => {
            if (apt.barber_id !== bId) return false;
            const aptStart = new Date(apt.scheduled_at);
            const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
            return slotTime < aptEnd && slotEnd > aptStart;
          });

          if (!hasConflict) {
            isAvailable = true;
            break;
          }
        }

        if (isAvailable) {
          availableSlots.push(
            `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
          );
        }
      }
    }

    return NextResponse.json({ slots: availableSlots });
  } catch (error) {
    console.error("Slots error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
