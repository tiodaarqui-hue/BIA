import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPassword, formatPhone, validatePhone } from "@/lib/customer-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { phone, password, barbershopId } = await request.json();

    if (!phone || !password || !barbershopId) {
      return NextResponse.json(
        { error: "Telefone, senha e barbearia são obrigatórios" },
        { status: 400 }
      );
    }

    if (!validatePhone(phone)) {
      return NextResponse.json(
        { error: "Telefone inválido" },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhone(phone);

    // Find customer
    const { data: customer, error: findError } = await supabase
      .from("customers")
      .select("id, name, phone, password_hash")
      .eq("phone", formattedPhone)
      .eq("barbershop_id", barbershopId)
      .single();

    if (findError || !customer) {
      return NextResponse.json(
        { error: "Telefone não encontrado. Crie uma conta." },
        { status: 404 }
      );
    }

    if (!customer.password_hash) {
      return NextResponse.json(
        { error: "Conta sem senha. Crie uma conta para definir sua senha." },
        { status: 400 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, customer.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Senha incorreta" },
        { status: 401 }
      );
    }

    // Update last login
    await supabase
      .from("customers")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", customer.id);

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
