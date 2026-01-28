import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const barbershopId = searchParams.get("barbershopId");

    if (!customerId || !barbershopId) {
      return NextResponse.json(
        { error: "customerId e barbershopId são obrigatórios" },
        { status: 400 }
      );
    }

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(`
        id,
        scheduled_at,
        duration_minutes,
        status,
        price,
        barber:barbers(name),
        service:services(name)
      `)
      .eq("customer_id", customerId)
      .eq("barbershop_id", barbershopId)
      .gte("scheduled_at", new Date().toISOString())
      .neq("status", "cancelled")
      .order("scheduled_at", { ascending: true });

    if (error) {
      console.error("Fetch appointments error:", error);
      return NextResponse.json(
        { error: "Erro ao buscar agendamentos" },
        { status: 500 }
      );
    }

    return NextResponse.json({ appointments: appointments || [] });
  } catch (error) {
    console.error("Appointments error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
