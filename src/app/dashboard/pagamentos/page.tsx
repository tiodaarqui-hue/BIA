"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { CustomerName } from "@/components/ui/customer-name";
import { Loading } from "@/components/ui/loading";

interface Payment {
  id: string;
  customer_id: string;
  appointment_id: string | null;
  amount: number;
  method: "pix" | "card" | "cash" | "member_plan";
  status: "pending" | "paid" | "refunded" | "failed";
  paid_at: string | null;
  created_at: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    no_show_count: number;
    is_member: boolean;
  };
  appointment: {
    id: string;
    scheduled_at: string;
    service: {
      name: string;
    };
  } | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
  member_plan: "Plano Membro",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  refunded: "Reembolsado",
  failed: "Falhou",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/30 text-yellow-400 border-yellow-700/50",
  paid: "bg-emerald-900/30 text-emerald-400 border-emerald-700/50",
  refunded: "bg-blue-900/30 text-blue-400 border-blue-700/50",
  failed: "bg-red-900/30 text-red-400 border-red-700/50",
};

export default function PagamentosPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid">("all");
  const [filterMethod, setFilterMethod] = useState<"all" | "pix" | "card" | "cash">("all");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("month");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadPayments() {
      setLoading(true);

      let query = supabase
        .from("payments")
        .select(`
          *,
          customer:customers(id, name, phone, no_show_count, is_member),
          appointment:appointments(id, scheduled_at, service:services(name))
        `)
        .order("created_at", { ascending: false });

      // Date filter
      const now = new Date();
      if (dateRange === "today") {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte("created_at", todayStart);
      } else if (dateRange === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", weekAgo);
      } else if (dateRange === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", monthAgo);
      }

      const { data } = await query;

      if (data) {
        setPayments(data as unknown as Payment[]);
      }
      setLoading(false);
    }

    loadPayments();
  }, [refreshKey, dateRange, supabase]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (filterStatus !== "all" && payment.status !== filterStatus) return false;
      if (filterMethod !== "all" && payment.method !== filterMethod) return false;
      return true;
    });
  }, [payments, filterStatus, filterMethod]);

  const stats = useMemo(() => {
    const paidPayments = payments.filter((p) => p.status === "paid");
    const pendingPayments = payments.filter((p) => p.status === "pending");

    return {
      totalPaid: paidPayments.reduce((acc, p) => acc + p.amount, 0),
      totalPending: pendingPayments.reduce((acc, p) => acc + p.amount, 0),
      countPaid: paidPayments.length,
      countPending: pendingPayments.length,
    };
  }, [payments]);

  function handleEdit(payment: Payment) {
    setEditingPayment(payment);
    setIsModalOpen(true);
  }

  function handleNew() {
    setEditingPayment(null);
    setIsModalOpen(true);
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setEditingPayment(null);
  }

  function handleSuccess() {
    setRefreshKey((k) => k + 1);
    handleModalClose();
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light">Pagamentos</h1>
          <p className="text-muted-foreground mt-1">
            {filteredPayments.length} {filteredPayments.length === 1 ? "pagamento" : "pagamentos"}
          </p>
        </div>

        <button
          onClick={handleNew}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Pagamento
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Recebido</p>
          <p className="text-2xl font-light text-emerald-400 mt-1">
            R$ {stats.totalPaid.toFixed(2).replace(".", ",")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{stats.countPaid} pagamentos</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Pendente</p>
          <p className="text-2xl font-light text-yellow-400 mt-1">
            R$ {stats.totalPending.toFixed(2).replace(".", ",")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{stats.countPending} pagamentos</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Período</p>
          <p className="text-2xl font-light mt-1">
            R$ {(stats.totalPaid + stats.totalPending).toFixed(2).replace(".", ",")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{payments.length} pagamentos</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Ticket Médio</p>
          <p className="text-2xl font-light mt-1">
            R$ {stats.countPaid > 0 ? (stats.totalPaid / stats.countPaid).toFixed(2).replace(".", ",") : "0,00"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">por pagamento</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center">Período:</span>
          {(["today", "week", "month", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                dateRange === range
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {range === "today" ? "Hoje" : range === "week" ? "7 dias" : range === "month" ? "30 dias" : "Todos"}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center">Status:</span>
          {(["all", "pending", "paid"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filterStatus === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {status === "all" ? "Todos" : STATUS_LABELS[status]}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center">Método:</span>
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value as typeof filterMethod)}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:border-primary"
          >
            <option value="all">Todos</option>
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
            <option value="cash">Dinheiro</option>
          </select>
        </div>
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loading />
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">Nenhum pagamento encontrado.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Serviço</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Valor</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Método</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      {payment.customer ? (
                        <CustomerName
                          name={payment.customer.name}
                          noShowCount={payment.customer.no_show_count}
                          isMember={payment.customer.is_member}
                          className="font-medium"
                        />
                      ) : (
                        <p className="font-medium">—</p>
                      )}
                      <p className="text-xs text-muted-foreground">{payment.customer?.phone || ""}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {payment.appointment?.service?.name || (
                      <span className="text-muted-foreground">Avulso</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">
                      R$ {payment.amount.toFixed(2).replace(".", ",")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{METHOD_LABELS[payment.method]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${STATUS_COLORS[payment.status]}`}
                    >
                      {STATUS_LABELS[payment.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(payment.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(payment)}
                      className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {payment.status === "pending" ? "Confirmar" : "Ver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaymentModal
        payment={editingPayment}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

interface PaymentModalProps {
  payment: Payment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function PaymentModal({ payment, isOpen, onClose, onSuccess }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    amount: "",
    method: "pix" as "pix" | "card" | "cash" | "member_plan",
    status: "paid" as "pending" | "paid" | "refunded" | "failed",
  });

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (payment) {
      setFormData({
        customer_id: payment.customer_id,
        customer_name: payment.customer?.name || "",
        amount: payment.amount.toString(),
        method: payment.method,
        status: payment.status,
      });
    } else {
      setFormData({
        customer_id: "",
        customer_name: "",
        amount: "",
        method: "pix",
        status: "paid",
      });
    }
    setError("");
    setCustomerSearch("");
  }, [payment, isOpen]);

  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomers([]);
      return;
    }

    let isCancelled = false;

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone")
        .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`)
        .limit(10);

      if (!isCancelled && data) {
        setCustomers(data);
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [customerSearch, supabase]);

  function selectCustomer(customer: Customer) {
    setFormData((prev) => ({
      ...prev,
      customer_id: customer.id,
      customer_name: `${customer.name} - ${customer.phone}`,
    }));
    setCustomerSearch("");
    setShowCustomerDropdown(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!payment && !formData.customer_id) {
      setError("Selecione um cliente");
      return;
    }

    if (!payment && (!formData.amount || parseFloat(formData.amount) <= 0)) {
      setError("Valor é obrigatório");
      return;
    }

    setLoading(true);

    if (payment) {
      // Update existing payment (mainly status)
      const updateData: Record<string, unknown> = {
        status: formData.status,
      };

      if (formData.status === "paid" && !payment.paid_at) {
        updateData.paid_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("payments")
        .update(updateData)
        .eq("id", payment.id);

      if (updateError) {
        setError("Erro ao atualizar: " + updateError.message);
        setLoading(false);
        return;
      }

      // If subscription payment was just paid (no appointment = subscription), extend membership and create cycle
      const isSubscriptionPayment = !payment.appointment_id;
      if (isSubscriptionPayment && formData.status === "paid" && payment.status !== "paid") {
        const now = new Date();
        const newExpiration = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Extend membership
        await supabase
          .from("customers")
          .update({ member_expires_at: newExpiration.toISOString() })
          .eq("id", payment.customer_id);

        // Check if cycle already exists for this payment (avoid duplicates)
        const { data: existingCycle } = await supabase
          .from("member_plan_cycles")
          .select("id")
          .eq("payment_id", payment.id)
          .single();

        // Create revenue cycle if it doesn't exist
        if (!existingCycle) {
          // Get barbershop_id from current context
          const { data: paymentData } = await supabase
            .from("payments")
            .select("barbershop_id")
            .eq("id", payment.id)
            .single();

          if (paymentData) {
            await supabase.from("member_plan_cycles").insert({
              barbershop_id: paymentData.barbershop_id,
              customer_id: payment.customer_id,
              payment_id: payment.id,
              cycle_start: now.toISOString().split("T")[0],
              cycle_end: newExpiration.toISOString().split("T")[0],
              total_amount: payment.amount,
              status: "open",
            });
          }
        }
      }

      // If service payment was just paid (has appointment_id), create commission
      const isServicePayment = !!payment.appointment_id;
      if (isServicePayment && formData.status === "paid" && payment.status !== "paid") {
        // Check if commission already exists for this appointment (avoid duplicates)
        const { data: existingCommission } = await supabase
          .from("member_commissions")
          .select("id")
          .eq("appointment_id", payment.appointment_id)
          .single();

        if (!existingCommission) {
          // Get appointment with barber info and barbershop_id
          const { data: appointmentData } = await supabase
            .from("appointments")
            .select("barber_id, barbershop_id, barber:barbers(commission_percent)")
            .eq("id", payment.appointment_id)
            .single();

          if (appointmentData?.barber_id) {
            const barberData = appointmentData.barber as unknown as { commission_percent: number } | null;
            const commissionPercent = barberData?.commission_percent ?? 50;
            const commissionAmount = payment.amount * (commissionPercent / 100);

            await supabase.from("member_commissions").insert({
              barbershop_id: appointmentData.barbershop_id,
              barber_id: appointmentData.barber_id,
              appointment_id: payment.appointment_id,
              cycle_id: null, // No cycle for service commissions
              unit_value: payment.amount,
              commission_percent: commissionPercent,
              commission_amount: commissionAmount,
            });
          }
        }
      }
    } else {
      // Create new payment
      const insertData = {
        customer_id: formData.customer_id,
        amount: parseFloat(formData.amount),
        method: formData.method,
        status: formData.status,
        paid_at: formData.status === "paid" ? new Date().toISOString() : null,
      };

      const { error: insertError } = await supabase.from("payments").insert(insertData);

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
      title={payment ? "Detalhes do Pagamento" : "Novo Pagamento"}
      size="sm"
      closeOnOverlayClick={false}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Selection */}
        <div className="relative">
          <label className="block text-sm text-muted-foreground mb-1">Cliente *</label>
          {payment ? (
            <div className="px-3 py-2 bg-muted rounded-lg text-sm">
              {payment.customer?.name} - {payment.customer?.phone}
            </div>
          ) : formData.customer_id ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm">
                {formData.customer_name}
              </span>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, customer_id: "", customer_name: "" }))}
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                placeholder="Buscar cliente..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              />
              {showCustomerDropdown && customers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                    >
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Service Info (if from appointment) */}
        {payment?.appointment && (
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="text-muted-foreground">Serviço</p>
            <p className="font-medium">{payment.appointment.service?.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(payment.appointment.scheduled_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Valor (R$) *</label>
          {payment ? (
            <div className="px-3 py-2 bg-muted rounded-lg text-sm font-medium">
              R$ {payment.amount.toFixed(2).replace(".", ",")}
            </div>
          ) : (
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="0,00"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          )}
        </div>

        {/* Method */}
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Método de Pagamento *</label>
          {payment ? (
            <div className="px-3 py-2 bg-muted rounded-lg text-sm">
              {METHOD_LABELS[payment.method]}
            </div>
          ) : (
            <select
              value={formData.method}
              onChange={(e) => setFormData((prev) => ({ ...prev, method: e.target.value as typeof formData.method }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
            >
              <option value="pix">PIX</option>
              <option value="card">Cartão</option>
              <option value="cash">Dinheiro</option>
            </select>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as typeof formData.status }))}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          >
            <option value="pending">Pendente</option>
            <option value="paid">Pago</option>
            <option value="refunded">Reembolsado</option>
            <option value="failed">Falhou</option>
          </select>
        </div>

        {/* Paid At Info */}
        {payment?.paid_at && (
          <div className="p-3 bg-emerald-900/20 border border-emerald-700/50 rounded-lg text-sm text-emerald-400">
            Pago em {new Date(payment.paid_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}

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
            {payment ? "Fechar" : "Cancelar"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Salvando..." : payment ? "Atualizar" : "Registrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
