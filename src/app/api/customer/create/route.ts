import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword, formatPhone, validatePhone } from "@/lib/customer-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_PASSWORD = "123456";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, barbershopId } = body;

    if (!name || !phone || !barbershopId) {
      return NextResponse.json(
        { error: "Nome, telefone e barbearia são obrigatórios" },
        { status: 400 }
      );
    }

    // Validate Brazilian phone format
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      return NextResponse.json(
        { error: phoneValidation.error || "Telefone inválido" },
        { status: 400 }
      );
    }

    const formattedPhone = formatPhone(phone);

    // Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id, name, phone")
      .eq("phone", formattedPhone)
      .eq("barbershop_id", barbershopId)
      .single();

    if (existingCustomer) {
      // Return existing customer
      return NextResponse.json({
        success: true,
        customer: existingCustomer,
        isExisting: true
      });
    }

    // Hash the default password
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // Create new customer with default password
    const { data: newCustomer, error: insertError } = await supabase
      .from("customers")
      .insert({
        name: name.trim(),
        phone: formattedPhone,
        email: email?.trim() || null,
        password_hash: passwordHash,
        barbershop_id: barbershopId,
      })
      .select("id, name, phone")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Já existe um cliente com este telefone" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Erro ao criar cliente" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: newCustomer,
      isExisting: false,
      defaultPassword: DEFAULT_PASSWORD
    });
  } catch (error) {
    console.error("Create customer error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
