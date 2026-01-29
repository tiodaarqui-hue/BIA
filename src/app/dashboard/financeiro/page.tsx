"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loading } from "@/components/ui/loading";
import Link from "next/link";

interface Stats {
  entradaHoje: number;
  entradaMes: number;
  comissoesDevidas: number;
  lucroEstimado: number;
}

export default function FinanceiroPage() {
  const [stats, setStats] = useState<Stats>({
    entradaHoje: 0,
    entradaMes: 0,
    comissoesDevidas: 0,
    lucroEstimado: 0,
  });
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Entrou Hoje - payments pagos hoje
      const { data: todayPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "paid")
        .gte("paid_at", `${today}T00:00:00`)
        .lte("paid_at", `${today}T23:59:59`);

      const entradaHoje = todayPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // Entrou no Mês - payments pagos este mês
      const { data: monthPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "paid")
        .gte("paid_at", firstDayOfMonth);

      const entradaMes = monthPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // Comissões Devidas - de ciclos fechados (todas são devidas no MVP)
      const { data: commissions } = await supabase
        .from("member_commissions")
        .select("commission_amount");

      const comissoesDevidas =
        commissions?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;

      // Lucro Estimado = Entrada do mês - Comissões devidas
      const lucroEstimado = entradaMes - comissoesDevidas;

      setStats({
        entradaHoje,
        entradaMes,
        comissoesDevidas,
        lucroEstimado,
      });

      setLoading(false);
    }

    loadStats();
  }, [supabase]);

  function formatCurrency(value: number): string {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }

  const quickLinks = [
    {
      href: "/dashboard/financeiro/entradas",
      label: "Ver Entradas",
      description: "Todos os pagamentos recebidos",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      ),
    },
    {
      href: "/dashboard/financeiro/saidas",
      label: "Ver Saídas",
      description: "Comissões e despesas",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      ),
    },
    {
      href: "/dashboard/financeiro/fluxo",
      label: "Fluxo de Caixa",
      description: "Linha do tempo do dinheiro",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      ),
    },
    {
      href: "/dashboard/financeiro/comissoes",
      label: "Comissões",
      description: "Ciclos e distribuição",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 7a2 2 0 100 4 2 2 0 000-4zm6 6a2 2 0 100 4 2 2 0 000-4zM6 18L18 6"
          />
        </svg>
      ),
    },
    {
      href: "/dashboard/financeiro/comissoes?tab=hoje",
      label: "Comissões Hoje",
      description: "Para pagar aos barbeiros",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light">Financeiro</h1>
        <p className="text-muted-foreground mt-1">Visão geral da saúde financeira</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-emerald-900/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">Entrou Hoje</p>
          </div>
          <p className="text-3xl font-light text-emerald-400">{formatCurrency(stats.entradaHoje)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-900/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">Entrou no Mês</p>
          </div>
          <p className="text-3xl font-light text-blue-400">{formatCurrency(stats.entradaMes)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
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
            <p className="text-sm text-muted-foreground">P/ Barbeiros</p>
          </div>
          <p className="text-3xl font-light text-orange-400">
            {formatCurrency(stats.comissoesDevidas)}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-primary"
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
            </div>
            <p className="text-sm text-muted-foreground">Ficou p/ Barbearia</p>
          </div>
          <p className="text-3xl font-light text-primary">{formatCurrency(stats.lucroEstimado)}</p>
          <p className="text-xs text-muted-foreground mt-1">mês atual</p>
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
            <p className="text-sm font-medium">Sobre os valores</p>
            <p className="text-sm text-muted-foreground mt-1">
              O valor "Ficou p/ Barbearia" considera apenas comissões de planos (ciclos apurados).
              Comissões de serviços avulsos são calculadas sob demanda.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-medium mb-4">Acesso Rápido</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-card border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {link.icon}
                </span>
                <span className="font-medium group-hover:text-primary transition-colors">
                  {link.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
