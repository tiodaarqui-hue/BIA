"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

interface PaymentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId: string;
  customerName: string;
  amount: number;
  description: string;
  appointmentId?: string;
  defaultMethod?: "pix" | "card" | "cash";
}

const METHOD_OPTIONS = [
  { value: "pix", label: "PIX" },
  { value: "card", label: "Cartão" },
  { value: "cash", label: "Dinheiro" },
];

const METHOD_ICONS: Record<string, React.ReactNode> = {
  pix: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  card: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  cash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
};

export function PaymentConfirmModal({
  isOpen,
  onClose,
  onSuccess,
  customerId,
  customerName,
  amount,
  description,
  appointmentId,
  defaultMethod = "pix",
}: PaymentConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"pix" | "card" | "cash">(defaultMethod);
  const [status, setStatus] = useState<"pending" | "paid">("paid");

  const supabase = useMemo(() => createClient(), []);

  async function handleConfirm() {
    setError("");
    setLoading(true);

    const now = new Date();
    const paymentData = {
      customer_id: customerId,
      appointment_id: appointmentId || null,
      amount,
      method,
      status,
      paid_at: status === "paid" ? now.toISOString() : null,
    };

    const { data: payment, error: insertError } = await supabase
      .from("payments")
      .insert(paymentData)
      .select("id, barbershop_id")
      .single();

    if (insertError || !payment) {
      setError("Erro ao registrar pagamento: " + (insertError?.message || "Erro desconhecido"));
      setLoading(false);
      return;
    }

    // If this is a subscription payment (no appointment) and it's paid, create the revenue cycle
    const isSubscriptionPayment = !appointmentId;
    if (isSubscriptionPayment && status === "paid") {
      const cycleEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await supabase.from("member_plan_cycles").insert({
        barbershop_id: payment.barbershop_id,
        customer_id: customerId,
        payment_id: payment.id,
        cycle_start: now.toISOString().split("T")[0],
        cycle_end: cycleEnd.toISOString().split("T")[0],
        total_amount: amount,
        status: "open",
      });
    }

    // If this is a service payment (has appointment) and it's paid, create commission immediately
    const isServicePayment = !!appointmentId;
    if (isServicePayment && status === "paid") {
      // Get appointment with barber info
      const { data: appointment } = await supabase
        .from("appointments")
        .select("barber_id, barber:barbers(commission_percent)")
        .eq("id", appointmentId)
        .single();

      if (appointment?.barber_id) {
        const barberData = appointment.barber as unknown as { commission_percent: number } | null;
        const commissionPercent = barberData?.commission_percent ?? 50;
        const commissionAmount = amount * (commissionPercent / 100);

        await supabase.from("member_commissions").insert({
          barbershop_id: payment.barbershop_id,
          barber_id: appointment.barber_id,
          appointment_id: appointmentId,
          cycle_id: null, // No cycle for service commissions
          unit_value: amount,
          commission_percent: commissionPercent,
          commission_amount: commissionAmount,
        });
      }
    }

    setLoading(false);
    onSuccess();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-medium">Confirmar Pagamento</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Payment Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Cliente</span>
              <span className="font-medium">{customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Descrição</span>
              <span className="text-sm">{description}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Valor</span>
              <span className="text-xl font-medium text-primary">
                R$ {amount.toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Método de Pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              {METHOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMethod(opt.value as typeof method)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                    method === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                  }`}
                >
                  {METHOD_ICONS[opt.value]}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Status do Pagamento</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus("paid")}
                className={`px-4 py-3 rounded-lg border transition-colors ${
                  status === "paid"
                    ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-400"
                    : "bg-background border-border text-muted-foreground hover:border-emerald-700/50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Pago</span>
                </div>
                <p className="text-xs mt-1 opacity-70">Pagamento recebido</p>
              </button>
              <button
                type="button"
                onClick={() => setStatus("pending")}
                className={`px-4 py-3 rounded-lg border transition-colors ${
                  status === "pending"
                    ? "bg-yellow-900/30 border-yellow-700/50 text-yellow-400"
                    : "bg-background border-border text-muted-foreground hover:border-yellow-700/50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Pendente</span>
                </div>
                <p className="text-xs mt-1 opacity-70">Cobrar depois</p>
              </button>
            </div>
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
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
