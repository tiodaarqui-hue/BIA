"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { PaymentConfirmModal } from "@/components/ui/payment-confirm-modal";
import { CustomerName } from "@/components/ui/customer-name";
import { createClient } from "@/lib/supabase/client";

interface Appointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  price: number;
  notes: string | null;
  barber_id: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    no_show_count: number;
  };
  barber: {
    id: string;
    name: string;
  };
  service: {
    id: string;
    name: string;
    price: number;
  };
}

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  appointment: Appointment | null;
}

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Agendado", color: "bg-blue-900/30 border-blue-700/50 text-blue-400" },
  { value: "completed", label: "Concluído", color: "bg-emerald-900/30 border-emerald-700/50 text-emerald-400" },
  { value: "no_show", label: "Não compareceu", color: "bg-amber-900/30 border-amber-700/50 text-amber-400" },
  { value: "cancelled", label: "Cancelado", color: "bg-red-900/30 border-red-700/50 text-red-400" },
];

export function AppointmentDetailsModal({
  isOpen,
  onClose,
  onUpdate,
  appointment,
}: AppointmentDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const supabase = createClient();

  if (!appointment) return null;

  const scheduledDate = new Date(appointment.scheduled_at);
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === appointment.status);

  async function updateStatus(newStatus: string) {
    if (!appointment) return;

    // If completing, show payment modal first
    if (newStatus === "completed") {
      setShowPaymentModal(true);
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", appointment.id);

    if (!error) {
      // If marking as no_show, increment customer's no_show_count
      if (newStatus === "no_show") {
        await supabase.rpc("increment_no_show_count", {
          customer_id_param: appointment.customer.id,
        });
      }

      onUpdate();
      if (newStatus === "cancelled" || newStatus === "no_show") {
        onClose();
      }
    }
    setLoading(false);
    setShowCancelConfirm(false);
  }

  async function handlePaymentSuccess() {
    if (!appointment) return;

    // Update appointment status to completed
    const { error } = await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", appointment.id);

    if (!error) {
      setShowPaymentModal(false);
      onUpdate();
      onClose();
    }
  }

  function formatDateTime(date: Date): string {
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getEndTime(date: Date, durationMinutes: number): string {
    const endDate = new Date(date.getTime() + durationMinutes * 60000);
    return endDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const canChangeStatus = !["completed", "cancelled", "no_show"].includes(appointment.status);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Agendamento" size="md">
      <div className="space-y-4">
        <div className={`inline-flex px-3 py-1 rounded-full text-sm border ${currentStatus?.color}`}>
          {currentStatus?.label}
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              appointment.customer.no_show_count > 3
                ? "bg-red-900/20"
                : "bg-primary/20"
            }`}>
              <svg className={`w-4 h-4 ${
                appointment.customer.no_show_count > 3 ? "text-red-400" : "text-primary"
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <CustomerName
                name={appointment.customer.name}
                noShowCount={appointment.customer.no_show_count}
                className="font-medium"
              />
              <p className="text-sm text-muted-foreground">{appointment.customer.phone}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Barbeiro</p>
              <p className="font-medium">{appointment.barber.name}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-secondary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data e horário</p>
              <p className="font-medium capitalize">{formatDateTime(scheduledDate)}</p>
              <p className="text-sm text-muted-foreground">
                Término previsto: {getEndTime(scheduledDate, appointment.duration_minutes)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-900/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Serviço</p>
              <p className="font-medium">{appointment.service.name}</p>
              <p className="text-sm text-muted-foreground">
                {appointment.duration_minutes} min • R$ {appointment.price.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {canChangeStatus && (
          <>
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground mb-2">Alterar status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.filter(
                  (s) => s.value !== "cancelled" && s.value !== appointment.status
                ).map((status) => (
                  <button
                    key={status.value}
                    onClick={() => updateStatus(status.value)}
                    disabled={loading}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors hover:opacity-80 disabled:opacity-50 ${status.color}`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              {!showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full px-4 py-2 text-sm text-red-400 border border-red-900/50 rounded-lg hover:bg-red-900/20 transition-colors"
                >
                  Cancelar agendamento
                </button>
              ) : (
                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg">
                  <p className="text-sm text-red-400 mb-3">
                    Tem certeza que deseja cancelar este agendamento?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Não
                    </button>
                    <button
                      onClick={() => updateStatus("cancelled")}
                      disabled={loading}
                      className="flex-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? "..." : "Sim, cancelar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="border-t border-border pt-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {appointment && (
        <PaymentConfirmModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
          customerId={appointment.customer.id}
          customerName={appointment.customer.name}
          amount={appointment.price}
          description={appointment.service.name}
          appointmentId={appointment.id}
        />
      )}
    </Modal>
  );
}
