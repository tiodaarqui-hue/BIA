import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPassword, formatPhone } from "@/lib/customer-auth";
import { customerLoginSchema, validateBody } from "@/lib/validations";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(customerLoginSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { phone, password, barbershopId } = validation.data;
    const digits = phone.replace(/\D/g, "");

    // Try multiple phone formats to find customer
    const phoneFormats = [
      digits,
      `+55${digits}`,
      `+${digits}`,
    ];

    // Find customer with any of the phone formats
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, phone, password_hash")
      .in("phone", phoneFormats)
      .eq("barbershop_id", barbershopId);

    const customer = customers?.[0];

    if (!customer) {
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
