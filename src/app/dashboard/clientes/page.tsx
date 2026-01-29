"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { PaymentConfirmModal } from "@/components/ui/payment-confirm-modal";
import { CustomerName } from "@/components/ui/customer-name";
import { Loading } from "@/components/ui/loading";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  is_member: boolean;
  member_since: string | null;
  member_expires_at: string | null;
  created_at: string;
  notes: string | null;
  no_show_count: number;
  member_plan: {
    id: string;
    name: string;
  } | null;
}

interface MemberPlan {
  id: string;
  name: string;
  price_monthly: number;
}

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<MemberPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMember, setFilterMember] = useState<"all" | "members" | "regular">("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [barbershopSlug, setBarbershopSlug] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setLoading(true);

      const [customersRes, plansRes] = await Promise.all([
        supabase
          .from("customers")
          .select(`
            id,
            name,
            phone,
            email,
            is_member,
            member_since,
            member_expires_at,
            created_at,
            notes,
            no_show_count,
            member_plan:member_plans(id, name)
          `)
          .order("name"),
        supabase
          .from("member_plans")
          .select("id, name, price_monthly")
          .eq("is_active", true)
          .order("name"),
      ]);

      if (isCancelled) return;

      if (customersRes.data) {
        setCustomers(customersRes.data as unknown as Customer[]);
      }

      if (plansRes.data) {
        setPlans(plansRes.data);
      }

      setLoading(false);
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [refreshKey, supabase]);

  // Get barbershop slug for booking link
  useEffect(() => {
    async function getBarbershopSlug() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: staff } = await supabase
        .from("staff")
        .select("barbershop_id")
        .eq("auth_user_id", user.id)
        .single();

      if (staff?.barbershop_id) {
        const { data: barbershop } = await supabase
          .from("barbershops")
          .select("slug")
          .eq("id", staff.barbershop_id)
          .single();

        if (barbershop?.slug) {
          setBarbershopSlug(barbershop.slug);
        }
      }
    }
    getBarbershopSlug();
  }, [supabase]);

  async function copyBookingLink() {
    if (!barbershopSlug) return;
    const url = `${window.location.origin}/agendamentos/${barbershopSlug}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch =
        customer.name.toLowerCase().includes(search.toLowerCase()) ||
        customer.phone.includes(search) ||
        (customer.email?.toLowerCase().includes(search.toLowerCase()) ?? false);

      const matchesFilter =
        filterMember === "all" ||
        (filterMember === "members" && customer.is_member) ||
        (filterMember === "regular" && !customer.is_member);

      return matchesSearch && matchesFilter;
    });
  }, [customers, search, filterMember]);

  function handleEdit(customer: Customer) {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  }

  function handleNew() {
    setEditingCustomer(null);
    setIsModalOpen(true);
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setEditingCustomer(null);
  }

  function handleSuccess() {
    setRefreshKey((k) => k + 1);
    handleModalClose();
  }

  const membersCount = customers.filter((c) => c.is_member).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light">Clientes</h1>
          <p className="text-muted-foreground mt-1">
            {customers.length} clientes • {membersCount} membros
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={copyBookingLink}
            className={`p-2 border rounded-lg transition-colors ${
              linkCopied
                ? "border-emerald-500 text-emerald-400"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
            }`}
            title={linkCopied ? "Link copiado!" : "Copiar link de auto-agendamento"}
          >
            {linkCopied ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          <button
            onClick={handleNew}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo cliente
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-2">
          {(["all", "members", "regular"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterMember(filter)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                filterMember === filter
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter === "all" ? "Todos" : filter === "members" ? "Membros" : "Regulares"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loading />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">
            {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Contato</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Desde</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                        customer.no_show_count > 3
                          ? "bg-red-900/20 text-red-400"
                          : "bg-primary/20 text-primary"
                      }`}>
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CustomerName
                          name={customer.name}
                          noShowCount={customer.no_show_count}
                          isMember={customer.is_member}
                          className="font-medium"
                        />
                        {customer.notes && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {customer.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{customer.phone}</p>
                    {customer.email && (
                      <p className="text-xs text-muted-foreground">{customer.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {customer.is_member ? (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary/20 text-primary">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          Membro
                        </span>
                        {customer.member_plan && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {customer.member_plan.name}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Regular</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(customer.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(customer)}
                      className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <CustomerModal
          customer={editingCustomer}
          plans={plans}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

interface CustomerModalProps {
  customer: Customer | null;
  plans: MemberPlan[];
  onClose: () => void;
  onSuccess: () => void;
}

function CustomerModal({ customer, plans, onClose, onSuccess }: CustomerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savedCustomerId, setSavedCustomerId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: customer?.name || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    notes: customer?.notes || "",
    is_member: customer?.is_member || false,
    member_plan_id: customer?.member_plan?.id || "",
  });

  const supabase = useMemo(() => createClient(), []);

  const selectedPlan = plans.find((p) => p.id === formData.member_plan_id);
  const isBecomingMember = formData.is_member && !customer?.is_member;
  const isChangingPlan = formData.is_member && customer?.is_member &&
    formData.member_plan_id !== customer?.member_plan?.id && formData.member_plan_id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.name || !formData.phone) {
      setError("Nome e telefone são obrigatórios");
      return;
    }

    if (formData.is_member && !formData.member_plan_id) {
      setError("Selecione um plano para o membro");
      return;
    }

    setLoading(true);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const data = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email || null,
      notes: formData.notes || null,
      is_member: formData.is_member,
      member_plan_id: formData.is_member && formData.member_plan_id ? formData.member_plan_id : null,
      member_since: formData.is_member && !customer?.is_member ? now.toISOString() : customer?.member_since,
      member_expires_at: formData.is_member ? expiresAt.toISOString() : null,
    };

    let customerId = customer?.id;

    if (customer) {
      const { error: updateError } = await supabase
        .from("customers")
        .update(data)
        .eq("id", customer.id);

      if (updateError) {
        setError("Erro ao atualizar: " + updateError.message);
        setLoading(false);
        return;
      }
    } else {
      const { data: newCustomer, error: insertError } = await supabase
        .from("customers")
        .insert(data)
        .select("id")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          setError("Já existe um cliente com este telefone");
        } else {
          setError("Erro ao cadastrar: " + insertError.message);
        }
        setLoading(false);
        return;
      }
      customerId = newCustomer.id;
    }

    setLoading(false);

    // Show payment modal if becoming member or changing plan
    if ((isBecomingMember || isChangingPlan) && customerId && selectedPlan) {
      setSavedCustomerId(customerId);
      setShowPaymentModal(true);
    } else {
      onSuccess();
    }
  }

  function handlePaymentSuccess() {
    setShowPaymentModal(false);
    onSuccess();
  }

  function handlePaymentClose() {
    // Customer already saved, just close and refresh
    setShowPaymentModal(false);
    onSuccess();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-medium">
            {customer ? "Editar Cliente" : "Novo Cliente"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Nome *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              placeholder="Nome completo"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Telefone *</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              placeholder="11999999999"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Observações</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary resize-none"
              placeholder="Preferências, alergias, etc..."
            />
          </div>

          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_member}
                onChange={(e) => setFormData((prev) => ({ ...prev, is_member: e.target.checked }))}
                className="w-5 h-5 rounded border-border"
              />
              <div>
                <span className="font-medium">Cliente Membro</span>
                <p className="text-xs text-muted-foreground">
                  Acesso a horários exclusivos e benefícios
                </p>
              </div>
            </label>

            {formData.is_member && plans.length > 0 && (
              <div className="mt-3">
                <label className="block text-sm text-muted-foreground mb-1">Plano</label>
                <select
                  value={formData.member_plan_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, member_plan_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="">Selecione um plano...</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - R$ {plan.price_monthly.toFixed(2)}/mês
                    </option>
                  ))}
                </select>
              </div>
            )}
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
              {loading ? "Salvando..." : customer ? "Salvar" : "Cadastrar"}
            </button>
          </div>
        </form>

        {savedCustomerId && selectedPlan && (
          <PaymentConfirmModal
            isOpen={showPaymentModal}
            onClose={handlePaymentClose}
            onSuccess={handlePaymentSuccess}
            customerId={savedCustomerId}
            customerName={formData.name}
            amount={selectedPlan.price_monthly}
            description={`Assinatura: ${selectedPlan.name}`}
            defaultMethod="pix"
          />
        )}
      </div>
    </div>
  );
}
