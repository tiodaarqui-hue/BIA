"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CustomerLogin } from "@/components/booking/customer-login";
import { BookingChat } from "@/components/booking/booking-chat";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Barbershop {
  id: string;
  name: string;
}

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [barbershop, setBarbershop] = useState<Barbershop | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAppointments, setShowAppointments] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadBarbershop() {
      const { data, error: bsError } = await supabase
        .from("barbershops")
        .select("id, name")
        .eq("slug", slug)
        .single();

      if (bsError || !data) {
        setError("Barbearia não encontrada");
        setLoading(false);
        return;
      }

      setBarbershop(data);
      setLoading(false);

      // Check for saved session
      const saved = localStorage.getItem(`customer_${data.id}`);
      if (saved) {
        try {
          setCustomer(JSON.parse(saved));
        } catch {
          localStorage.removeItem(`customer_${data.id}`);
        }
      }
    }

    loadBarbershop();
  }, [slug, supabase]);

  function handleLoginSuccess(customerData: Customer) {
    setCustomer(customerData);
    if (barbershop) {
      localStorage.setItem(`customer_${barbershop.id}`, JSON.stringify(customerData));
    }
  }

  function handleLogout() {
    setCustomer(null);
    if (barbershop) {
      localStorage.removeItem(`customer_${barbershop.id}`);
    }
    setShowAppointments(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute rounded-full border-2 border-transparent border-t-white/80 border-r-white/40 animate-spin-fast"
            style={{ width: "32px", height: "32px" }}
          />
          <div
            className="rounded-full bg-gray-600 flex items-center justify-center"
            style={{ width: "24px", height: "24px" }}
          >
            <svg width="14" height="14" viewBox="0 0 100 100">
              <polygon points="50,10 88,80 12,80" fill="#0a0a0a" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Header - mobile optimized */}
      <header className="px-3 py-3 sm:px-4 sm:py-4 border-b border-border flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <div
            className="rounded-full animate-shine-logo flex items-center justify-center flex-shrink-0"
            style={{ width: "13px", height: "13px" }}
          >
            <svg width="11" height="11" viewBox="0 0 100 100">
              <polygon points="50,10 88,80 12,80" fill="#0a0a0a" />
            </svg>
          </div>
          <span className="text-sm font-light truncate max-w-[150px] sm:max-w-none">{barbershop?.name}</span>
        </div>

        {customer && (
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowAppointments(!showAppointments)}
              className={`text-xs sm:text-sm px-2.5 py-1.5 sm:px-3 rounded-lg transition-colors touch-manipulation ${
                showAppointments
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="hidden sm:inline">Meus Agendamentos</span>
              <span className="sm:hidden">Agendamentos</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm text-muted-foreground hover:text-foreground touch-manipulation px-2 py-1.5"
            >
              Sair
            </button>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col">
        {!customer ? (
          <CustomerLogin
            barbershopId={barbershop?.id || ""}
            barbershopName={barbershop?.name || ""}
            onSuccess={handleLoginSuccess}
          />
        ) : showAppointments ? (
          <CustomerAppointments
            customerId={customer.id}
            barbershopId={barbershop?.id || ""}
            onBack={() => setShowAppointments(false)}
          />
        ) : (
          <BookingChat
            customer={customer}
            barbershopId={barbershop?.id || ""}
            barbershopName={barbershop?.name || ""}
            onShowAppointments={() => setShowAppointments(true)}
          />
        )}
      </main>
    </div>
  );
}

function CustomerAppointments({
  customerId,
  barbershopId,
  onBack,
}: {
  customerId: string;
  barbershopId: string;
  onBack: () => void;
}) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    async function loadAppointments() {
      const res = await fetch(
        `/api/customer/appointments?customerId=${customerId}&barbershopId=${barbershopId}`
      );
      const data = await res.json();
      setAppointments(data.appointments || []);
      setLoading(false);
    }
    loadAppointments();
  }, [customerId, barbershopId]);

  async function handleCancel(appointmentId: string) {
    if (!confirm("Tem certeza que deseja cancelar este agendamento?")) {
      return;
    }

    setCancelling(appointmentId);

    const res = await fetch("/api/customer/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, customerId }),
    });

    const data = await res.json();

    if (data.success) {
      // Remove from list
      setAppointments((prev) => prev.filter((apt) => apt.id !== appointmentId));
    } else {
      alert(data.error || "Erro ao cancelar");
    }

    setCancelling(null);
  }

  // Check if appointment can be cancelled (at least 2 hours before)
  function canCancel(scheduledAt: string): boolean {
    const date = new Date(scheduledAt);
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return date > twoHoursFromNow;
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 px-3 py-4 sm:p-4 max-w-2xl mx-auto w-full">
      <button
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 touch-manipulation py-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>

      <h2 className="text-lg font-medium mb-4">Meus Agendamentos</h2>

      {appointments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Nenhum agendamento futuro.</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm touch-manipulation"
          >
            Fazer agendamento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => {
            const date = new Date(apt.scheduled_at);
            const canCancelApt = canCancel(apt.scheduled_at);

            return (
              <div
                key={apt.id}
                className="p-3 sm:p-4 bg-card border border-border rounded-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[15px] sm:text-base">{apt.service?.name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                      </svg>
                      {apt.barber?.name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-medium text-[15px] sm:text-base">
                      {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                {/* Cancel button */}
                <div className="mt-3 pt-3 border-t border-border">
                  {canCancelApt ? (
                    <button
                      onClick={() => handleCancel(apt.id)}
                      disabled={cancelling === apt.id}
                      className="text-sm text-red-400 hover:text-red-300 active:text-red-200 transition-colors disabled:opacity-50 touch-manipulation py-1"
                    >
                      {cancelling === apt.id ? "Cancelando..." : "Cancelar agendamento"}
                    </button>
                  ) : (
                    <p className="text-xs text-muted-foreground/70">
                      Não é possível cancelar com menos de 2h de antecedência
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
