import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cancelSchema, validateBody } from "@/lib/validations";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(cancelSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { appointmentId, customerId } = validation.data;

    // Get the appointment
    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("id, scheduled_at, customer_id, status")
      .eq("id", appointmentId)
      .eq("customer_id", customerId)
      .single();

    if (fetchError || !appointment) {
      return NextResponse.json(
        { error: "Agendamento não encontrado" },
        { status: 404 }
      );
    }

    if (appointment.status === "cancelled") {
      return NextResponse.json(
        { error: "Agendamento já foi cancelado" },
        { status: 400 }
      );
    }

    // Check if appointment is at least 2 hours away
    const scheduledAt = new Date(appointment.scheduled_at);
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    if (scheduledAt <= twoHoursFromNow) {
      return NextResponse.json(
        { error: "Só é possível cancelar com pelo menos 2 horas de antecedência" },
        { status: 400 }
      );
    }

    // Cancel the appointment
    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId);

    if (updateError) {
      console.error("Cancel appointment error:", updateError);
      return NextResponse.json(
        { error: "Erro ao cancelar agendamento" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
