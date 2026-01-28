import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  // Check if owner already exists
  const { count } = await supabase
    .from("staff")
    .select("*", { count: "exact", head: true })
    .eq("role", "owner");

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Owner already exists" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { auth_user_id, name, email, phone, is_also_barber } = body;

  if (!auth_user_id || !name || !email) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Create staff record
  const { error: staffError } = await supabase.from("staff").insert({
    auth_user_id,
    name,
    email,
    role: "admin",
    is_active: true,
  });

  if (staffError) {
    return NextResponse.json({ error: staffError.message }, { status: 500 });
  }

  // Create barber record if owner is also a barber
  if (is_also_barber) {
    const { error: barberError } = await supabase.from("barbers").insert({
      name,
      phone: phone || null,
      commission_percent: 0,
      is_active: true,
    });

    if (barberError) {
      return NextResponse.json({ error: barberError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
