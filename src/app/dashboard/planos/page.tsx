"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Loading } from "@/components/ui/loading";

interface MemberPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  is_active: boolean;
  created_at: string;
  customer_count?: number;
}

export default function PlanosPage() {
  const [plans, setPlans] = useState<MemberPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<"all" | "active">("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MemberPlan | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadPlans() {
      setLoading(true);

      const { data: plansData } = await supabase
        .from("member_plans")
        .select("*")
        .order("name");

      if (plansData) {
        const { data: customerCounts } = await supabase
          .from("customers")
          .select("member_plan_id")
          .eq("is_member", true)
          .not("member_plan_id", "is", null);

        const countMap: Record<string, number> = {};
        customerCounts?.forEach((c) => {
          countMap[c.member_plan_id] = (countMap[c.member_plan_id] || 0) + 1;
        });

        const plansWithCount = plansData.map((plan) => ({
          ...plan,
          customer_count: countMap[plan.id] || 0,
        }));

        setPlans(plansWithCount);
      }
      setLoading(false);
    }

    loadPlans();
  }, [refreshKey, supabase]);

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      if (filter === "active") return plan.is_active;
      return true;
    });
  }, [plans, filter]);

  function handleEdit(plan: MemberPlan) {
    setEditingPlan(plan);
    setIsModalOpen(true);
  }

  function handleNew() {
    setEditingPlan(null);
    setIsModalOpen(true);
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setEditingPlan(null);
  }

  function handleSuccess() {
    setRefreshKey((k) => k + 1);
    handleModalClose();
  }

  const activeCount = plans.filter((p) => p.is_active).length;
  const totalMembers = plans.reduce((acc, p) => acc + (p.customer_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light">Planos de Assinatura</h1>
          <p className="text-muted-foreground mt-1">
            {plans.length} {plans.length === 1 ? "plano" : "planos"} - {activeCount} {activeCount === 1 ? "ativo" : "ativos"}
            {totalMembers > 0 && ` - ${totalMembers} ${totalMembers === 1 ? "assinante" : "assinantes"}`}
          </p>
        </div>

        <button
          onClick={handleNew}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Plano
        </button>
      </div>

      <div className="flex gap-2">
        {(["all", "active"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "Todos" : "Ativos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loading />
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">
            {filter !== "all" ? "Nenhum plano encontrado com este filtro." : "Nenhum plano cadastrado."}
          </p>
          {filter === "all" && (
            <button
              onClick={handleNew}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
            >
              Cadastrar primeiro plano
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-card border rounded-lg overflow-hidden transition-colors ${
                plan.is_active ? "border-border" : "border-border/50 opacity-60"
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-lg truncate">{plan.name}</h3>
                    </div>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  {!plan.is_active && (
                    <span className="shrink-0 px-2 py-1 text-xs rounded-full bg-red-900/30 text-red-400 border border-red-700/50">
                      Inativo
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-light text-primary">
                        R$ {plan.price_monthly.toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-xs text-muted-foreground">/mês</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-light">
                        {plan.customer_count || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {plan.customer_count === 1 ? "assinante" : "assinantes"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 bg-muted/30 border-t border-border">
                <button
                  onClick={() => handleEdit(plan)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PlanModal
        plan={editingPlan}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

interface PlanModalProps {
  plan: MemberPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function PlanModal({ plan, isOpen, onClose, onSuccess }: PlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_monthly: "",
    is_active: true,
  });

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name,
        description: plan.description || "",
        price_monthly: plan.price_monthly.toString(),
        is_active: plan.is_active,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        price_monthly: "",
        is_active: true,
      });
    }
    setError("");
  }, [plan, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    if (!formData.price_monthly || parseFloat(formData.price_monthly) < 0) {
      setError("Valor mensal é obrigatório");
      return;
    }

    setLoading(true);

    const data = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      price_monthly: parseFloat(formData.price_monthly),
      is_active: formData.is_active,
    };

    if (plan) {
      const { error: updateError } = await supabase
        .from("member_plans")
        .update(data)
        .eq("id", plan.id);

      if (updateError) {
        setError("Erro ao atualizar: " + updateError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("member_plans").insert(data);

      if (insertError) {
        setError("Erro ao cadastrar: " + insertError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    onSuccess();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={plan ? "Editar Plano" : "Novo Plano"}
      size="sm"
      closeOnOverlayClick={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Nome *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Plano Mensal"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Benefícios do plano..."
            rows={3}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Valor Mensal (R$) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.price_monthly}
            onChange={(e) => setFormData((prev) => ({ ...prev, price_monthly: e.target.value }))}
            placeholder="0,00"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>

        <div className="pt-2 border-t border-border">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="w-5 h-5 rounded border-border"
            />
            <div>
              <span className="font-medium">Ativo</span>
              <p className="text-xs text-muted-foreground">
                Planos inativos não podem ser atribuídos a novos clientes
              </p>
            </div>
          </label>
        </div>

        <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Benefícios para assinantes:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Acesso a horários exclusivos para membros</li>
            <li>Serviços exclusivos para membros</li>
            <li>Prioridade no agendamento</li>
          </ul>
        </div>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Salvando..." : plan ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
