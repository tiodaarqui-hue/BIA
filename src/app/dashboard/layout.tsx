import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("*, barbershop:barbershops(name)")
    .eq("auth_user_id", user.id)
    .single();

  if (!staff) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar staff={staff} />
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
