import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Verify the requester is super_admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: staff } = await adminClient
    .from("staff")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (staff?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { business_name, owner_name, email, password } = body;

  if (!business_name || !owner_name || !email || !password) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Create barbershop first
  const { data: barbershop, error: barbershopError } = await adminClient
    .from("barbershops")
    .insert({ name: business_name })
    .select("id")
    .single();

  if (barbershopError || !barbershop) {
    return NextResponse.json(
      { error: barbershopError?.message || "Failed to create barbershop" },
      { status: 500 }
    );
  }

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    // Rollback: delete barbershop
    await adminClient.from("barbershops").delete().eq("id", barbershop.id);
    return NextResponse.json(
      { error: authError?.message || "Failed to create user" },
      { status: 500 }
    );
  }

  // Create staff record linked to barbershop
  const { error: staffError } = await adminClient.from("staff").insert({
    auth_user_id: authData.user.id,
    name: owner_name,
    email,
    role: "admin",
    barbershop_id: barbershop.id,
    is_active: true,
  });

  if (staffError) {
    // Rollback: delete auth user and barbershop
    await adminClient.auth.admin.deleteUser(authData.user.id);
    await adminClient.from("barbershops").delete().eq("id", barbershop.id);
    return NextResponse.json({ error: staffError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: authData.user.id,
      email,
      business_name,
      owner_name,
      barbershop_id: barbershop.id,
    }
  });
}
