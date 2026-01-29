import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword, formatPhone } from "@/lib/customer-auth";
import { customerRegisterSchema, validateBody } from "@/lib/validations";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateBody(customerRegisterSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { name, phone, password, barbershopId } = validation.data;
    const formattedPhone = formatPhone(phone);

    // Check if customer already exists for this barbershop
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id, password_hash")
      .eq("phone", formattedPhone)
      .eq("barbershop_id", barbershopId)
      .single();

    if (existingCustomer) {
      if (existingCustomer.password_hash) {
        return NextResponse.json(
          { error: "Este telefone já está cadastrado. Faça login." },
          { status: 409 }
        );
      }

      // Customer exists but has no password (created by staff), set password
      const passwordHash = await hashPassword(password);
      const { error: updateError } = await supabase
        .from("customers")
        .update({ password_hash: passwordHash, name })
        .eq("id", existingCustomer.id);

      if (updateError) {
        return NextResponse.json(
          { error: "Erro ao atualizar cadastro" },
          { status: 500 }
        );
      }

      const { data: updatedCustomer } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("id", existingCustomer.id)
        .single();

      return NextResponse.json({ success: true, customer: updatedCustomer });
    }

    // Create new customer
    const passwordHash = await hashPassword(password);

    const { data: newCustomer, error: insertError } = await supabase
      .from("customers")
      .insert({
        name,
        phone: formattedPhone,
        password_hash: passwordHash,
        barbershop_id: barbershopId,
      })
      .select("id, name, phone")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json(
        { error: "Erro ao criar cadastro" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, customer: newCustomer });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
