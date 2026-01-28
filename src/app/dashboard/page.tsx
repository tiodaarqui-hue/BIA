import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

interface ExpiringMember {
  id: string;
  name: string;
  phone: string;
  member_expires_at: string;
  member_plan: {
    name: string;
    price_monthly: number;
  } | null;
}

interface PendingPayment {
  id: string;
  amount: number;
  created_at: string;
  customer: {
    name: string;
  };
}

interface TodayAppointment {
  id: string;
  scheduled_at: string;
  status: string;
  customer: {
    name: string;
  };
  service: {
    name: string;
  };
  barber: {
    name: string;
  };
}

async function getStats() {
  const supabase = await createClient();

  const [
    { count: customersCount },
    { count: membersCount },
    { count: barbersCount },
    { count: todayAppointments },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("is_member", true),
    supabase.from("barbers").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_at", new Date().toISOString().split("T")[0])
      .lt("scheduled_at", new Date(Date.now() + 86400000).toISOString().split("T")[0]),
  ]);

  return {
    customers: customersCount ?? 0,
    members: membersCount ?? 0,
    barbers: barbersCount ?? 0,
    todayAppointments: todayAppointments ?? 0,
  };
}

async function getExpiringMembers(): Promise<ExpiringMember[]> {
  const supabase = await createClient();

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, member_expires_at, member_plan:member_plans(name, price_monthly)")
    .eq("is_member", true)
    .not("member_expires_at", "is", null)
    .lte("member_expires_at", sevenDaysFromNow.toISOString())
    .order("member_expires_at");

  return (data as unknown as ExpiringMember[]) || [];
}

async function getPendingPayments(): Promise<PendingPayment[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select("id, amount, created_at, customer:customers(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);

  return (data as unknown as PendingPayment[]) || [];
}

async function getTodayAppointments(): Promise<TodayAppointment[]> {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const { data } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, customer:customers(name), service:services(name), barber:barbers(name)")
    .gte("scheduled_at", today)
    .lt("scheduled_at", tomorrow)
    .order("scheduled_at")
    .limit(10);

  return (data as unknown as TodayAppointment[]) || [];
}

async function checkAndGenerateExpiringPayments() {
  const supabase = await createClient();

  // Find expired memberships without a pending payment for this month
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data: expiredMembers } = await supabase
    .from("customers")
    .select("id, name, member_plan_id, member_expires_at, member_plan:member_plans(price_monthly)")
    .eq("is_member", true)
    .not("member_plan_id", "is", null)
    .lt("member_expires_at", now.toISOString());

  if (!expiredMembers || expiredMembers.length === 0) return;

  for (const member of expiredMembers) {
    // Check if there's already a pending payment for this member (subscription) in the last 30 days
    // Subscription payments have no appointment_id
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("customer_id", member.id)
      .is("appointment_id", null)
      .eq("status", "pending")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .limit(1);

    if (!existingPayment || existingPayment.length === 0) {
      // Create a pending payment for the renewal
      // member_plan comes as array from Supabase join
      const planData = member.member_plan as unknown as { price_monthly: number }[] | null;
      const plan = planData?.[0];
      if (plan) {
        await supabase.from("payments").insert({
          customer_id: member.id,
          amount: plan.price_monthly,
          method: "pix", // Default method, will be updated when paid
          status: "pending",
        });
      }
    }
  }
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-700/30 text-zinc-400",
  confirmed: "bg-blue-900/30 text-blue-400",
  scheduled: "bg-primary/30 text-primary",
  in_progress: "bg-violet-900/30 text-violet-400",
  completed: "bg-emerald-900/30 text-emerald-400",
  no_show: "bg-amber-900/30 text-amber-400",
  cancelled: "bg-red-900/30 text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  scheduled: "Agendado",
  in_progress: "Em andamento",
  completed: "Concluído",
  no_show: "Não compareceu",
  cancelled: "Cancelado",
};

export default async function DashboardPage() {
  // Check and generate payments for expired memberships
  await checkAndGenerateExpiringPayments();

  const [stats, expiringMembers, pendingPayments, todayAppointments] = await Promise.all([
    getStats(),
    getExpiringMembers(),
    getPendingPayments(),
    getTodayAppointments(),
  ]);

  const totalPending = pendingPayments.reduce((acc, p) => acc + p.amount, 0);
  const expiredMembers = expiringMembers.filter((m) => getDaysUntil(m.member_expires_at) < 0);
  const soonExpiringMembers = expiringMembers.filter((m) => getDaysUntil(m.member_expires_at) >= 0);

  const cards = [
    { label: "Clientes", value: stats.customers, color: "text-primary" },
    { label: "Membros", value: stats.members, color: "text-accent" },
    { label: "Barbeiros", value: stats.barbers, color: "text-foreground" },
    { label: "Agendamentos hoje", value: stats.todayAppointments, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral do seu negócio</p>
      </div>

      {/* Alerts */}
      {(expiredMembers.length > 0 || pendingPayments.length > 0) && (
        <div className="space-y-3">
          {expiredMembers.length > 0 && (
            <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-red-400">
                    {expiredMembers.length} {expiredMembers.length === 1 ? "assinatura vencida" : "assinaturas vencidas"}
                  </p>
                  <p className="text-sm text-red-400/70">Pagamentos pendentes gerados automaticamente</p>
                </div>
              </div>
              <Link
                href="/dashboard/pagamentos?status=pending"
                className="px-4 py-2 bg-red-900/30 text-red-400 rounded-lg text-sm hover:bg-red-900/50 transition-colors"
              >
                Ver pagamentos
              </Link>
            </div>
          )}

          {pendingPayments.length > 0 && (
            <div className="p-4 bg-yellow-900/20 border border-yellow-900/50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-yellow-400">
                    R$ {totalPending.toFixed(2).replace(".", ",")} em pagamentos pendentes
                  </p>
                  <p className="text-sm text-yellow-400/70">{pendingPayments.length} {pendingPayments.length === 1 ? "pagamento" : "pagamentos"}</p>
                </div>
              </div>
              <Link
                href="/dashboard/pagamentos?status=pending"
                className="px-4 py-2 bg-yellow-900/30 text-yellow-400 rounded-lg text-sm hover:bg-yellow-900/50 transition-colors"
              >
                Gerenciar
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-card border border-border rounded-lg p-6"
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className={`text-3xl font-light mt-2 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Agendamentos de Hoje</h2>
            <Link href="/dashboard/agenda" className="text-sm text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          {todayAppointments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum agendamento para hoje.</p>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-lg font-medium">{formatTime(apt.scheduled_at)}</p>
                    </div>
                    <div>
                      <p className="font-medium">{apt.customer?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {apt.service?.name} - {apt.barber?.name}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[apt.status]}`}>
                    {STATUS_LABELS[apt.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiring Memberships */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Assinaturas Vencendo</h2>
            <Link href="/dashboard/clientes?filter=members" className="text-sm text-primary hover:underline">
              Ver membros
            </Link>
          </div>
          {soonExpiringMembers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma assinatura vencendo nos próximos 7 dias.</p>
          ) : (
            <div className="space-y-3">
              {soonExpiringMembers.map((member) => {
                const daysUntil = getDaysUntil(member.member_expires_at);
                return (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.member_plan?.name} - R$ {member.member_plan?.price_monthly.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      daysUntil <= 1 ? "bg-red-900/30 text-red-400" :
                      daysUntil <= 3 ? "bg-yellow-900/30 text-yellow-400" :
                      "bg-blue-900/30 text-blue-400"
                    }`}>
                      {daysUntil === 0 ? "Hoje" : daysUntil === 1 ? "Amanhã" : `${daysUntil} dias`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Ações rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/dashboard/agenda"
            className="flex items-center gap-3 px-4 py-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">Novo agendamento</span>
          </Link>
          <Link
            href="/dashboard/clientes"
            className="flex items-center gap-3 px-4 py-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="text-sm">Novo cliente</span>
          </Link>
          <Link
            href="/dashboard/pagamentos"
            className="flex items-center gap-3 px-4 py-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">Registrar pagamento</span>
          </Link>
          <Link
            href="/dashboard/servicos"
            className="flex items-center gap-3 px-4 py-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span className="text-sm">Gerenciar serviços</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
