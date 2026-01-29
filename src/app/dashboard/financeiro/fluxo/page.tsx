"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";

interface CashFlowEntry {
  id: string;
  date: string;
  description: string;
  type: "entrada" | "saida";
  amount: number;
  source: "payment" | "commission";
}

type FilterPeriod = "today" | "week" | "month" | "custom";

export default function FluxoCaixaPage() {
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<FilterPeriod>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadCashFlow() {
      setLoading(true);

      const now = new Date();
      let startDate: string;
      let endDate: string = now.toISOString();

      switch (period) {
        case "today":
          startDate = now.toISOString().split("T")[0] + "T00:00:00";
          break;
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          startDate = weekAgo.toISOString();
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          break;
        case "custom":
          if (customStart && customEnd) {
            startDate = customStart + "T00:00:00";
            endDate = customEnd + "T23:59:59";
          } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          }
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      }

      const flowEntries: CashFlowEntry[] = [];

      // Load paid payments (entradas)
      const { data: payments } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          paid_at,
          appointment_id,
          customer:customers!customer_id(name)
        `)
        .eq("status", "paid")
        .gte("paid_at", startDate)
        .lte("paid_at", endDate);

      if (payments) {
        for (const p of payments) {
          const customer = Array.isArray(p.customer) ? p.customer[0] : p.customer;
          const customerName = customer?.name || "Cliente";
          const paymentType = p.appointment_id === null ? "Plano" : "Serviço";

          flowEntries.push({
            id: `payment-${p.id}`,
            date: p.paid_at,
            description: `${paymentType} - ${customerName}`,
            type: "entrada",
            amount: p.amount,
            source: "payment",
          });
        }
      }

      // Load commissions (saídas)
      const { data: commissions } = await supabase
        .from("member_commissions")
        .select(`
          id,
          commission_amount,
          created_at,
          barber:barbers!barber_id(name)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (commissions) {
        for (const c of commissions) {
          const barber = Array.isArray(c.barber) ? c.barber[0] : c.barber;
          const barberName = barber?.name || "Barbeiro";

          flowEntries.push({
            id: `commission-${c.id}`,
            date: c.created_at,
            description: `Comissão - ${barberName}`,
            type: "saida",
            amount: c.commission_amount,
            source: "commission",
          });
        }
      }

      // Sort by date descending
      flowEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setEntries(flowEntries);
      setLoading(false);
    }

    loadCashFlow();
  }, [supabase, period, customStart, customEnd]);

  function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const totalEntradas = entries
    .filter((e) => e.type === "entrada")
    .reduce((sum, e) => sum + e.amount, 0);

  const totalSaidas = entries
    .filter((e) => e.type === "saida")
    .reduce((sum, e) => sum + e.amount, 0);

  const saldo = totalEntradas - totalSaidas;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light">Fluxo de Caixa</h1>
        <p className="text-muted-foreground mt-1">Linha do tempo do dinheiro</p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Period Filter */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Período</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as FilterPeriod)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="today">Hoje</option>
              <option value="week">Última Semana</option>
              <option value="month">Este Mês</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {period === "custom" && (
            <>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">De</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Até</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Entradas</p>
          <p className="text-xl font-light text-emerald-400">{formatCurrency(totalEntradas)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Saídas</p>
          <p className="text-xl font-light text-orange-400">{formatCurrency(totalSaidas)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Saldo</p>
          <p className={`text-xl font-light ${saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(saldo)}
          </p>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loading />
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">Nenhuma movimentação encontrada no período</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Data
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Hora
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Descrição
                  </th>
                  <th className="text-center text-sm font-medium text-muted-foreground px-4 py-3">
                    Tipo
                  </th>
                  <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatTime(entry.date)}
                    </td>
                    <td className="px-4 py-3 text-sm">{entry.description}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      {entry.type === "entrada" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-emerald-900/30 text-emerald-400">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                          Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-orange-900/30 text-orange-400">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                          Saída
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm text-right font-medium ${
                        entry.type === "entrada" ? "text-emerald-400" : "text-orange-400"
                      }`}
                    >
                      {entry.type === "saida" ? "- " : "+ "}
                      {formatCurrency(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
