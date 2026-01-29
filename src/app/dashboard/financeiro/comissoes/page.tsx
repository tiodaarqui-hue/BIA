"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Loading } from "@/components/ui/loading";

interface Cycle {
  id: string;
  barbershop_id: string;
  customer_id: string;
  payment_id: string;
  cycle_start: string;
  cycle_end: string;
  total_amount: number;
  status: "open" | "closed";
  closed_at: string | null;
  created_at: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  appointments_count?: number;
}

interface Commission {
  id: string;
  barber_id: string;
  appointment_id: string;
  cycle_id: string | null;
  unit_value: number;
  commission_percent: number;
  commission_amount: number;
  created_at: string;
  barber: {
    id: string;
    name: string;
  };
}

interface Appointment {
  id: string;
  barber_id: string;
  scheduled_at: string;
  barber: {
    id: string;
    name: string;
    commission_percent: number;
  };
}

interface BarberSummary {
  barberId: string;
  barberName: string;
  planCommissions: number;
  serviceCommissions: number;
  totalCommissions: number;
  count: number;
}

export default function ComissoesPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "hoje" ? "hoje" : "ciclos";
  const [mainTab, setMainTab] = useState<"ciclos" | "hoje">(initialTab);

  // Cycles tab state
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");

  const [closingCycle, setClosingCycle] = useState<Cycle | null>(null);
  const [cycleAppointments, setCycleAppointments] = useState<Appointment[]>([]);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);

  const [viewingCycle, setViewingCycle] = useState<Cycle | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Today tab state
  const [todayCommissions, setTodayCommissions] = useState<Commission[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  // Get today's date range
  const today = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return {
      date: now.toISOString().split("T")[0],
      start: start.toISOString(),
      end: end.toISOString(),
      formatted: start.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    };
  }, []);

  const loadCyclesData = useCallback(async () => {
    setLoading(true);

    // Load cycles with customer info
    const { data: cyclesData } = await supabase
      .from("member_plan_cycles")
      .select(`
        *,
        customer:customers(id, name, phone)
      `)
      .order("created_at", { ascending: false });

    if (cyclesData) {
      // Calculate appointments count for each cycle on-demand
      const cyclesWithCount = await Promise.all(
        cyclesData.map(async (cycle) => {
          const { count } = await supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("customer_id", cycle.customer_id)
            .eq("status", "completed")
            .gte("scheduled_at", `${cycle.cycle_start}T00:00:00`)
            .lte("scheduled_at", `${cycle.cycle_end}T23:59:59`);

          return {
            ...cycle,
            appointments_count: count || 0,
          } as Cycle;
        })
      );

      setCycles(cyclesWithCount);
    }

    // Load commissions for closed cycles
    const { data: commissionsData } = await supabase
      .from("member_commissions")
      .select(`
        *,
        barber:barbers(id, name)
      `)
      .order("created_at", { ascending: false });

    if (commissionsData) {
      setCommissions(commissionsData as Commission[]);
    }

    setLoading(false);
  }, [supabase]);

  const loadTodayData = useCallback(async () => {
    setTodayLoading(true);

    const { data, error } = await supabase
      .from("member_commissions")
      .select(`
        id,
        barber_id,
        appointment_id,
        cycle_id,
        unit_value,
        commission_percent,
        commission_amount,
        created_at,
        barber:barbers!barber_id(id, name)
      `)
      .gte("created_at", today.start)
      .lte("created_at", today.end)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading commissions:", error);
      setTodayCommissions([]);
    } else {
      const mapped = (data || []).map((c) => ({
        ...c,
        barber: Array.isArray(c.barber) ? c.barber[0] : c.barber,
      })) as Commission[];
      setTodayCommissions(mapped);
    }

    setTodayLoading(false);
  }, [supabase, today.start, today.end]);

  useEffect(() => {
    if (mainTab === "ciclos") {
      loadCyclesData();
    } else {
      loadTodayData();
    }
  }, [mainTab, refreshKey, loadCyclesData, loadTodayData]);

  const filteredCycles = useMemo(() => {
    return cycles.filter((cycle) => {
      if (filter === "open") return cycle.status === "open";
      if (filter === "closed") return cycle.status === "closed";
      return true;
    });
  }, [cycles, filter]);

  const stats = useMemo(() => {
    const closedCycles = cycles.filter((c) => c.status === "closed");
    const openCycles = cycles.filter((c) => c.status === "open");

    const totalRevenue = closedCycles.reduce((acc, c) => acc + c.total_amount, 0);
    const totalCommissions = commissions.reduce((acc, c) => acc + c.commission_amount, 0);
    const pendingRevenue = openCycles.reduce((acc, c) => acc + c.total_amount, 0);

    return {
      totalRevenue,
      totalCommissions,
      barbershopProfit: totalRevenue - totalCommissions,
      pendingRevenue,
      openCount: openCycles.length,
      closedCount: closedCycles.length,
    };
  }, [cycles, commissions]);

  // Today tab: Group commissions by barber
  const barberSummaries: BarberSummary[] = useMemo(() => {
    const summaryMap = new Map<string, BarberSummary>();

    for (const commission of todayCommissions) {
      const barberId = commission.barber_id;
      const existing = summaryMap.get(barberId);

      const isPlan = commission.cycle_id !== null;
      const commissionAmount = commission.commission_amount;

      if (existing) {
        if (isPlan) {
          existing.planCommissions += commissionAmount;
        } else {
          existing.serviceCommissions += commissionAmount;
        }
        existing.totalCommissions += commissionAmount;
        existing.count += 1;
      } else {
        summaryMap.set(barberId, {
          barberId,
          barberName: commission.barber?.name || "—",
          planCommissions: isPlan ? commissionAmount : 0,
          serviceCommissions: isPlan ? 0 : commissionAmount,
          totalCommissions: commissionAmount,
          count: 1,
        });
      }
    }

    return Array.from(summaryMap.values()).sort((a, b) =>
      b.totalCommissions - a.totalCommissions
    );
  }, [todayCommissions]);

  // Today tab: Grand totals
  const todayTotals = useMemo(() => {
    return barberSummaries.reduce(
      (acc, summary) => ({
        plan: acc.plan + summary.planCommissions,
        service: acc.service + summary.serviceCommissions,
        total: acc.total + summary.totalCommissions,
        count: acc.count + summary.count,
      }),
      { plan: 0, service: 0, total: 0, count: 0 }
    );
  }, [barberSummaries]);

  async function handleCloseCycle(cycle: Cycle) {
    setClosingCycle(cycle);
    setCloseLoading(true);

    // Fetch appointments for this cycle
    const { data: appointments } = await supabase
      .from("appointments")
      .select(`
        id,
        barber_id,
        scheduled_at,
        barber:barbers(id, name, commission_percent)
      `)
      .eq("customer_id", cycle.customer_id)
      .eq("status", "completed")
      .gte("scheduled_at", `${cycle.cycle_start}T00:00:00`)
      .lte("scheduled_at", `${cycle.cycle_end}T23:59:59`);

    setCycleAppointments((appointments || []) as unknown as Appointment[]);
    setCloseLoading(false);
    setIsCloseModalOpen(true);
  }

  async function confirmCloseCycle() {
    if (!closingCycle) return;

    setCloseLoading(true);

    const appointmentsCount = cycleAppointments.length;

    if (appointmentsCount > 0) {
      // Calculate unit value
      const unitValue = closingCycle.total_amount / appointmentsCount;

      // Create commissions for each appointment
      const commissionsToInsert = cycleAppointments.map((apt) => {
        const barber = apt.barber as unknown as { id: string; name: string; commission_percent: number };
        const commissionPercent = barber.commission_percent || 50;
        const commissionAmount = unitValue * (commissionPercent / 100);

        return {
          barbershop_id: closingCycle.barbershop_id,
          barber_id: apt.barber_id,
          appointment_id: apt.id,
          cycle_id: closingCycle.id,
          unit_value: unitValue,
          commission_percent: commissionPercent,
          commission_amount: commissionAmount,
        };
      });

      const { error: commissionError } = await supabase
        .from("member_commissions")
        .insert(commissionsToInsert);

      if (commissionError) {
        console.error("Error inserting commissions:", commissionError);
        setCloseLoading(false);
        return;
      }
    }

    // Close the cycle
    const { error: updateError } = await supabase
      .from("member_plan_cycles")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", closingCycle.id);

    if (updateError) {
      console.error("Error closing cycle:", updateError);
      setCloseLoading(false);
      return;
    }

    setCloseLoading(false);
    setIsCloseModalOpen(false);
    setClosingCycle(null);
    setCycleAppointments([]);
    setRefreshKey((k) => k + 1);
  }

  function handleViewCycle(cycle: Cycle) {
    setViewingCycle(cycle);
    setIsViewModalOpen(true);
  }

  const cycleCommissions = useMemo(() => {
    if (!viewingCycle) return [];
    return commissions.filter((c) => c.cycle_id === viewingCycle.id);
  }, [viewingCycle, commissions]);

  function formatDate(dateStr: string): string {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light">Comissões</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie ciclos de planos e comissões dos barbeiros
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setMainTab("ciclos")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            mainTab === "ciclos"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Ciclos de Planos
        </button>
        <button
          onClick={() => setMainTab("hoje")}
          className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
            mainTab === "hoje"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Hoje
        </button>
      </div>

      {/* Ciclos Tab Content */}
      {mainTab === "ciclos" && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Receita Fechada</p>
              <p className="text-2xl font-light text-emerald-400 mt-1">
                {formatCurrency(stats.totalRevenue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stats.closedCount} ciclos</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Comissões Pagas</p>
              <p className="text-2xl font-light text-orange-400 mt-1">
                {formatCurrency(stats.totalCommissions)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">para barbeiros</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Ficou p/ Barbearia</p>
              <p className="text-2xl font-light text-primary mt-1">
                {formatCurrency(stats.barbershopProfit)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">após comissões</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Em Aberto</p>
              <p className="text-2xl font-light text-yellow-400 mt-1">
                {formatCurrency(stats.pendingRevenue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stats.openCount} ciclos</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            {(["all", "open", "closed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Todos" : f === "open" ? "Pendentes" : "Apurados"}
              </button>
            ))}
          </div>

          {/* Cycles List */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loading />
            </div>
          ) : filteredCycles.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <p className="text-muted-foreground">
                {filter !== "all"
                  ? "Nenhum ciclo encontrado com este filtro."
                  : "Nenhum ciclo de plano registrado ainda."}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Ciclos são criados automaticamente quando pagamentos de assinatura são confirmados.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Atendimentos
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Período
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCycles.map((cycle) => {
                    const isExpired = cycle.cycle_end < today.date && cycle.status === "open";
                    const canClose = cycle.status === "open";

                    return (
                      <tr
                        key={cycle.id}
                        className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{cycle.customer?.name || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {cycle.customer?.phone || ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{formatCurrency(cycle.total_amount)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-lg font-light">{cycle.appointments_count || 0}</span>
                          {cycle.appointments_count && cycle.appointments_count > 0 && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({formatCurrency(cycle.total_amount / cycle.appointments_count)}/cada)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <p>{formatDate(cycle.cycle_start)}</p>
                          <p className="text-muted-foreground">até {formatDate(cycle.cycle_end)}</p>
                        </td>
                        <td className="px-4 py-3">
                          {cycle.status === "closed" ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs border bg-emerald-900/30 text-emerald-400 border-emerald-700/50">
                              Apurado
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs border bg-red-900/30 text-red-400 border-red-700/50">
                              Vencido
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs border bg-yellow-900/30 text-yellow-400 border-yellow-700/50">
                              Em Aberto
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canClose ? (
                            <button
                              onClick={() => handleCloseCycle(cycle)}
                              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                            >
                              Apurar
                            </button>
                          ) : (
                            <button
                              onClick={() => handleViewCycle(cycle)}
                              className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Ver
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Hoje Tab Content */}
      {mainTab === "hoje" && (
        <>
          <p className="text-sm text-muted-foreground capitalize">{today.formatted}</p>

          {todayLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loading />
            </div>
          ) : todayCommissions.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <svg
                className="w-12 h-12 text-muted-foreground mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-muted-foreground text-lg">Nenhuma comissão registrada hoje</p>
              <p className="text-sm text-muted-foreground mt-1">
                Comissões aparecem aqui quando pagamentos são confirmados
              </p>
            </div>
          ) : (
            <>
              {/* Grand Total Card */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-orange-900/30 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-orange-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total a pagar aos barbeiros</p>
                    <p className="text-3xl font-light text-orange-400">{formatCurrency(todayTotals.total)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Planos</p>
                    <p className="text-lg font-light text-blue-400">{formatCurrency(todayTotals.plan)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Serviços</p>
                    <p className="text-lg font-light text-purple-400">{formatCurrency(todayTotals.service)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Registros</p>
                    <p className="text-lg font-light">{todayTotals.count}</p>
                  </div>
                </div>
              </div>

              {/* Per-Barber Breakdown */}
              <div>
                <h2 className="text-lg font-medium mb-4">Por Barbeiro</h2>
                <div className="grid gap-4">
                  {barberSummaries.map((summary) => (
                    <div
                      key={summary.barberId}
                      className="bg-card border border-border rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary font-medium">
                              {summary.barberName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{summary.barberName}</p>
                            <p className="text-xs text-muted-foreground">
                              {summary.count} {summary.count === 1 ? "atendimento" : "atendimentos"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-light text-orange-400">
                            {formatCurrency(summary.totalCommissions)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4 pt-3 border-t border-border">
                        {summary.planCommissions > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-900/30 text-blue-400">
                              Plano
                            </span>
                            <span className="text-sm text-blue-400">
                              {formatCurrency(summary.planCommissions)}
                            </span>
                          </div>
                        )}
                        {summary.serviceCommissions > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-900/30 text-purple-400">
                              Serviço
                            </span>
                            <span className="text-sm text-purple-400">
                              {formatCurrency(summary.serviceCommissions)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed List */}
              <div>
                <h2 className="text-lg font-medium mb-4">Detalhamento</h2>
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                            Horário
                          </th>
                          <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                            Barbeiro
                          </th>
                          <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                            Tipo
                          </th>
                          <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                            Valor Serviço
                          </th>
                          <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                            %
                          </th>
                          <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                            Comissão
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayCommissions.map((commission) => (
                          <tr key={commission.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 text-sm">
                              {new Date(commission.created_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="px-4 py-3 text-sm">{commission.barber?.name || "—"}</td>
                            <td className="px-4 py-3 text-sm">
                              {commission.cycle_id ? (
                                <span className="px-2 py-1 text-xs rounded-full bg-blue-900/30 text-blue-400">
                                  Plano
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs rounded-full bg-purple-900/30 text-purple-400">
                                  Serviço
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {formatCurrency(commission.unit_value)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {commission.commission_percent}%
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-orange-400">
                              {formatCurrency(commission.commission_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Close Cycle Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => {
          setIsCloseModalOpen(false);
          setClosingCycle(null);
          setCycleAppointments([]);
        }}
        title="Fechar comissões do plano"
        size="md"
        closeOnOverlayClick={false}
      >
        {closingCycle && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="text-center pb-3 border-b border-border">
                <p className="text-lg font-medium">{closingCycle.customer?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(closingCycle.cycle_start)} - {formatDate(closingCycle.cycle_end)}
                </p>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrou no caixa</span>
                <span className="text-lg font-medium text-emerald-400">
                  {formatCurrency(closingCycle.total_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Atendimentos realizados</span>
                <span className="text-lg font-medium">{cycleAppointments.length}</span>
              </div>
            </div>

            {closeLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loading />
              </div>
            ) : cycleAppointments.length === 0 ? (
              <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                <p className="text-yellow-400 font-medium">Nenhum atendimento neste ciclo</p>
                <p className="text-sm text-yellow-400/80 mt-1">
                  100% da receita ({formatCurrency(closingCycle.total_amount)}) ficará com a
                  barbearia.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Valor por atendimento: <span className="font-medium text-foreground">{formatCurrency(closingCycle.total_amount / cycleAppointments.length)}</span>
                  </p>
                  <p className="text-sm font-medium mb-2">Pagamentos aos barbeiros:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {cycleAppointments.map((apt) => {
                      const barber = apt.barber as unknown as {
                        name: string;
                        commission_percent: number;
                      };
                      const unitValue = closingCycle.total_amount / cycleAppointments.length;
                      const commission = unitValue * ((barber.commission_percent || 50) / 100);
                      return (
                        <div key={apt.id} className="flex justify-between items-center p-2 bg-background rounded">
                          <span>
                            {barber.name} <span className="text-muted-foreground">({barber.commission_percent || 50}%)</span>
                          </span>
                          <span className="font-medium text-orange-400">
                            {formatCurrency(commission)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  const unitValue = closingCycle.total_amount / cycleAppointments.length;
                  const totalCommissions = cycleAppointments.reduce((acc, apt) => {
                    const barber = apt.barber as unknown as { commission_percent: number };
                    return acc + unitValue * ((barber.commission_percent || 50) / 100);
                  }, 0);
                  const barbershopProfit = closingCycle.total_amount - totalCommissions;

                  return (
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vai para os barbeiros</span>
                        <span className="text-orange-400 font-medium">
                          - {formatCurrency(totalCommissions)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="font-medium">Fica para a barbearia</span>
                        <span className="text-primary text-lg font-medium">
                          {formatCurrency(barbershopProfit)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCloseModalOpen(false);
                  setClosingCycle(null);
                  setCycleAppointments([]);
                }}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmCloseCycle}
                disabled={closeLoading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {closeLoading ? "Apurando..." : "Confirmar e Apurar"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Closed Cycle Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingCycle(null);
        }}
        title="Comissões apuradas"
        size="md"
      >
        {viewingCycle && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="text-center pb-3 border-b border-border">
                <p className="text-lg font-medium">{viewingCycle.customer?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(viewingCycle.cycle_start)} - {formatDate(viewingCycle.cycle_end)}
                </p>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrou no caixa</span>
                <span className="text-lg font-medium text-emerald-400">
                  {formatCurrency(viewingCycle.total_amount)}
                </span>
              </div>
              {viewingCycle.closed_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Apurado em</span>
                  <span className="text-muted-foreground">
                    {new Date(viewingCycle.closed_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>

            {cycleCommissions.length === 0 ? (
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-muted-foreground">Nenhum atendimento neste ciclo</p>
                <p className="text-sm text-muted-foreground mt-1">
                  100% da receita ficou com a barbearia
                </p>
              </div>
            ) : (
              <>
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    Pagamentos aos barbeiros
                  </h4>
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-3 py-2 text-left text-muted-foreground">Barbeiro</th>
                          <th className="px-3 py-2 text-right text-muted-foreground">Base</th>
                          <th className="px-3 py-2 text-right text-muted-foreground">%</th>
                          <th className="px-3 py-2 text-right text-muted-foreground">Comissão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cycleCommissions.map((comm) => (
                          <tr key={comm.id} className="border-b border-border/50 last:border-b-0">
                            <td className="px-3 py-2">{comm.barber?.name || "—"}</td>
                            <td className="px-3 py-2 text-right">
                              {formatCurrency(comm.unit_value)}
                            </td>
                            <td className="px-3 py-2 text-right">{comm.commission_percent}%</td>
                            <td className="px-3 py-2 text-right font-medium text-orange-400">
                              {formatCurrency(comm.commission_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {(() => {
                  const totalCommissions = cycleCommissions.reduce(
                    (acc, c) => acc + c.commission_amount,
                    0
                  );
                  const barbershopProfit = viewingCycle.total_amount - totalCommissions;

                  return (
                    <div className="p-4 bg-muted rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Foi para os barbeiros</span>
                        <span className="text-orange-400 font-medium">
                          - {formatCurrency(totalCommissions)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="font-medium">Ficou para a barbearia</span>
                        <span className="text-primary text-lg font-medium">
                          {formatCurrency(barbershopProfit)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setIsViewModalOpen(false);
                setViewingCycle(null);
              }}
              className="w-full px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
