"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";

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
    name: string;
  };
}

interface Barber {
  id: string;
  name: string;
}

type FilterPeriod = "today" | "week" | "month" | "custom";

export default function SaidasPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<FilterPeriod>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [filterBarber, setFilterBarber] = useState<string>("all");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadBarbers() {
      const { data } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setBarbers(data || []);
    }
    loadBarbers();
  }, [supabase]);

  useEffect(() => {
    async function loadCommissions() {
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
          barber:barbers!barber_id(name)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (filterBarber !== "all") {
        query = query.eq("barber_id", filterBarber);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading commissions:", error);
        setCommissions([]);
      } else {
        const mapped = (data || []).map((c) => ({
          ...c,
          barber: Array.isArray(c.barber) ? c.barber[0] : c.barber,
        })) as Commission[];
        setCommissions(mapped);
      }

      setLoading(false);
    }

    loadCommissions();
  }, [supabase, period, customStart, customEnd, filterBarber]);

  function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  }

  const totalAmount = commissions.reduce((sum, c) => sum + c.commission_amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light">Saídas</h1>
        <p className="text-muted-foreground mt-1">Comissões devidas aos barbeiros</p>
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

          {/* Barber Filter */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Barbeiro</label>
            <select
              value={filterBarber}
              onChange={(e) => setFilterBarber(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total de Comissões (período)</p>
            <p className="text-2xl font-light text-orange-400">{formatCurrency(totalAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Registros</p>
            <p className="text-2xl font-light">{commissions.length}</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-muted-foreground mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium">Sobre as Saídas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Comissões de <strong>Plano</strong> nascem ao apurar ciclos. Comissões de <strong>Serviço</strong> nascem
              automaticamente ao confirmar pagamentos avulsos.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loading />
        </div>
      ) : commissions.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">Nenhuma comissão encontrada no período</p>
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
                    Barbeiro
                  </th>
                  <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">
                    Tipo
                  </th>
                  <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3">
                    Valor Unit.
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
                {commissions.map((commission) => (
                  <tr key={commission.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm">{formatDate(commission.created_at)}</td>
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
                    <td className="px-4 py-3 text-sm text-right">{commission.commission_percent}%</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-orange-400">
                      {formatCurrency(commission.commission_amount)}
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
