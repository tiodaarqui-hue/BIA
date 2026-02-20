import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { toBrazilTime, brazilTimeToUtc, getBrazilDayRange } from "@/lib/timezone";

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

    // Get day of week from the date string (Brazil date)
    const dayOfWeek = new Date(date + "T12:00:00").getDay();

    // Get current time in Brazil for "today" comparison and past slot filtering
    const now = new Date();
    const nowBrazil = toBrazilTime(now);
    const isToday = date === nowBrazil.dateStr;

    // Get agenda settings
    const { data: settings } = await supabase
      .from("agenda_settings")
      .select("start_hour, end_hour, enabled_days, slot_interval")
      .eq("barbershop_id", barbershopId)
      .single();

    const startHour = settings?.start_hour || 8;
    const endHour = settings?.end_hour || 20;
    const enabledDays = settings?.enabled_days || [1, 2, 3, 4, 5, 6];
    const slotInterval = settings?.slot_interval || 30;

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

    // Get blocks for this day (using Brazil timezone range in UTC)
    const { startUtc: startOfDayUtc, endUtc: endOfDayUtc } = getBrazilDayRange(date);

    const { data: blocks } = await supabase
      .from("barber_blocks")
      .select("barber_id, start_at, end_at")
      .in("barber_id", barbersToCheck)
      .lte("start_at", endOfDayUtc.toISOString())
      .gte("end_at", startOfDayUtc.toISOString());

    // Get existing appointments for this day (include end_time for multi-service appointments)
    const { data: appointments } = await supabase
      .from("appointments")
      .select("barber_id, scheduled_at, duration_minutes, end_time")
      .eq("barbershop_id", barbershopId)
      .in("barber_id", barbersToCheck)
      .gte("scheduled_at", startOfDayUtc.toISOString())
      .lte("scheduled_at", endOfDayUtc.toISOString())
      .neq("status", "cancelled");

    // Generate available slots using linear minute loop (supports intervals like 45, 90)
    const availableSlots: string[] = [];
    const startMinutes = startHour * 60;
    const endMinutes = endHour * 60;

    for (let m = startMinutes; m < endMinutes; m += slotInterval) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;

      // Skip past slots if today (compare using Brazil time)
      if (isToday) {
        const nowMinutes = nowBrazil.hours * 60 + nowBrazil.minutes;
        if (m <= nowMinutes) {
          continue;
        }
      }

      // Create slot time in UTC (Brazil time → UTC)
      const slotTimeUtc = brazilTimeToUtc(date, hour, minute);

      // Check if any barber is available at this slot
      let isAvailable = false;

      for (const bId of barbersToCheck) {
        const schedule = schedules?.find((s) => s.barber_id === bId);
        const hasAnySchedule = barbersWithSchedules.has(bId);

        // If barber has schedules configured but none for this day → unavailable
        if (hasAnySchedule && !schedule) continue;

        // Use barber's specific schedule or fallback to agenda_settings (only if no schedules at all)
        const schedStartMin = schedule
          ? parseInt(schedule.start_time.split(":")[0]) * 60
          : startMinutes;
        const schedEndMin = schedule
          ? parseInt(schedule.end_time.split(":")[0]) * 60
          : endMinutes;

        if (m < schedStartMin || m >= schedEndMin) continue;

        // Check blocks (stored in UTC)
        const isBlocked = blocks?.some((block) => {
          if (block.barber_id !== bId) return false;
          const blockStart = new Date(block.start_at);
          const blockEnd = new Date(block.end_at);
          return slotTimeUtc >= blockStart && slotTimeUtc < blockEnd;
        });

        if (isBlocked) continue;

        // Check existing appointments (stored in UTC, use end_time if available for multi-service)
        const slotEndUtc = new Date(slotTimeUtc.getTime() + serviceDuration * 60000);
        const hasConflict = appointments?.some((apt) => {
          if (apt.barber_id !== bId) return false;
          const aptStart = new Date(apt.scheduled_at);
          const aptEnd = apt.end_time
            ? new Date(apt.end_time)
            : new Date(aptStart.getTime() + apt.duration_minutes * 60000);
          return slotTimeUtc < aptEnd && slotEndUtc > aptStart;
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

    return NextResponse.json({ slots: availableSlots });
  } catch (error) {
    console.error("Slots error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
