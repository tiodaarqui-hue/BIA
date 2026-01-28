import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword, formatPhone, validatePhone } from "@/lib/customer-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { name, phone, password, barbershopId } = await request.json();

    if (!name || !phone || !password || !barbershopId) {
      return NextResponse.json(
        { error: "Nome, telefone, senha e barbearia são obrigatórios" },
        { status: 400 }
      );
    }

    if (!validatePhone(phone)) {
      return NextResponse.json(
        { error: "Telefone inválido. Use formato: (11) 99999-9999" },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Senha deve ter pelo menos 4 caracteres" },
        { status: 400 }
      );
    }

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
