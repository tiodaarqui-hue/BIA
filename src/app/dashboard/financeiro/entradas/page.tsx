"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";

interface Payment {
  id: string;
  customer_id: string;
  appointment_id: string | null;
  amount: number;
  method: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  customer: {
    name: string;
  };
}

type FilterPeriod = "today" | "week" | "month" | "custom";
type FilterType = "all" | "plan" | "service";
type FilterStatus = "all" | "paid" | "pending";
type FilterMethod = "all" | "pix" | "credit" | "debit" | "cash";

export default function EntradasPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<FilterPeriod>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterMethod, setFilterMethod] = useState<FilterMethod>("all");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadPayments() {
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

      let query = supabase
        .from("payments")
        .select(`
          id,
          customer_id,
          appointment_id,
          amount,
          method,
          status,
          paid_at,
          created_at,
          customer:customers!customer_id(name)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (filterMethod !== "all") {
        query = query.eq("method", filterMethod);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading payments:", error);
        setPayments([]);
      } else {
        let filtered = (data || []).map((p) => ({
          ...p,
          customer: Array.isArray(p.customer) ? p.customer[0] : p.customer,
        })) as Payment[];

        if (filterType === "plan") {
          filtered = filtered.filter((p) => p.appointment_id === null);
        } else if (filterType === "service") {
          filtered = filtered.filter((p) => p.appointment_id !== null);
        }

        setPayments(filtered);
      }

      setLoading(false);
    }

    loadPayments();
  }, [supabase, period, customStart, customEnd, filterType, filterStatus, filterMethod]);

  function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  }

  function getPaymentType(payment: Payment): string {
    return payment.appointment_id === null ? "Plano" : "Serviço";
  }

  function getMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      pix: "PIX",
      credit: "Crédito",
      debit: "Débito",
      cash: "Dinheiro",
    };
    return labels[method] || method;
  }

  function getStatusBadge(status: string) {
    if (status === "paid") {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-emerald-900/30 text-emerald-400">
          Pago
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-yellow-900/30 text-yellow-400">
        Pendente
      </span>
    );
  }

  const totalAmount = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light">Entradas</h1>
        <p className="text-muted-foreground mt-1">Pagamentos recebidos</p>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

          {/* Type Filter */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="plan">Plano</option>
              <option value="service">Serviço</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
            </select>
          </div>

          {/* Method Filter */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Método</label>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value as FilterMethod)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="pix">PIX</option>
              <option value="credit">Crédito</option>
              <option value="debit">Débito</option>
              <option value="cash">Dinheiro</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Recebido (período)</p>
            <p className="text-2xl font-light text-emerald-400">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Registros</p>
            <p className="text-2xl font-light">{payments.length}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loading />
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">Nenhum pagamento encontrado no período</p>
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
                    Cliente
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Tipo
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Método
                  </th>
                  <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                    Valor
                  </th>
                  <th className="text-center text-sm font-medium text-muted-foreground px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm">
                      {formatDate(payment.paid_at || payment.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">{payment.customer?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          payment.appointment_id === null
                            ? "bg-blue-900/30 text-blue-400"
                            : "bg-purple-900/30 text-purple-400"
                        }`}
                      >
                        {getPaymentType(payment)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{getMethodLabel(payment.method)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {getStatusBadge(payment.status)}
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
