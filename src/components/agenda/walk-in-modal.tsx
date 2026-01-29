"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";

interface Barber {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  is_member_only: boolean;
}

interface MemberPlan {
  id: string;
  included_service_ids: string[] | null;
}

interface WalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  barbers: Barber[];
  preSelectedBarberId?: string;
}

export function WalkInModal({
  isOpen,
  onClose,
  onSuccess,
  barbers,
  preSelectedBarberId,
}: WalkInModalProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [memberPlan, setMemberPlan] = useState<MemberPlan | null>(null);

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    barberId: preSelectedBarberId || "",
    serviceId: "",
  });

  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    async function loadServices() {
      const { data } = await supabase
        .from("services")
        .select("id, name, price, duration_minutes, is_member_only")
        .eq("is_active", true)
        .order("name");

      if (!isCancelled && data) {
        setServices(data);
      }
    }

    loadServices();

    setFormData((prev) => ({
      ...prev,
      barberId: preSelectedBarberId || prev.barberId || (barbers[0]?.id || ""),
    }));
    setError("");
    setMemberPlan(null);

    return () => {
      isCancelled = true;
    };
  }, [isOpen, preSelectedBarberId, barbers, supabase]);

  // Check if customer is a member when phone changes
  useEffect(() => {
    if (!isOpen || formData.customerPhone.length < 10) {
      setMemberPlan(null);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      // Get barbershop_id first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || isCancelled) return;

      const { data: staffData } = await supabase
        .from("staff")
        .select("barbershop_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!staffData?.barbershop_id || isCancelled) return;

      const { data: customer } = await supabase
        .from("customers")
        .select("is_member, member_expires_at, member_plan_id")
        .eq("phone", formData.customerPhone)
        .eq("barbershop_id", staffData.barbershop_id)
        .single();

      if (isCancelled) return;

      if (customer?.is_member && customer.member_plan_id) {
        const isActive = !customer.member_expires_at || new Date(customer.member_expires_at) > new Date();
        if (isActive) {
          const { data: plan } = await supabase
            .from("member_plans")
            .select("id, included_service_ids")
            .eq("id", customer.member_plan_id)
            .single();
          if (!isCancelled) setMemberPlan(plan || null);
        } else {
          setMemberPlan(null);
        }
      } else {
        setMemberPlan(null);
      }
    }, 500);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, formData.customerPhone, supabase]);

  // Close service dropdown when clicking outside
  useEffect(() => {
    if (!showServiceDropdown) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-service-dropdown]')) {
        setShowServiceDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showServiceDropdown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.customerName || !formData.customerPhone || !formData.barberId || !formData.serviceId) {
      setError("Preencha todos os campos");
      return;
    }

    setLoading(true);

    // Get barbershop_id from current user's staff record
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Usuário não autenticado");
      setLoading(false);
      return;
    }

    const { data: staffData } = await supabase
      .from("staff")
      .select("barbershop_id")
      .eq("auth_user_id", user.id)
      .single();

    if (!staffData?.barbershop_id) {
      setError("Barbearia não encontrada");
      setLoading(false);
      return;
    }

    // Get selected service first to check member-only
    const selectedService = services.find((s) => s.id === formData.serviceId);
    if (!selectedService) {
      setError("Serviço não encontrado");
      setLoading(false);
      return;
    }

    // Buscar ou criar cliente via API (com senha padrão)
    let customerId: string;
    let isCustomerMember = false;

    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id, is_member, member_expires_at, member_plan_id")
      .eq("phone", formData.customerPhone)
      .eq("barbershop_id", staffData.barbershop_id)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      isCustomerMember = existingCustomer.is_member &&
        (!existingCustomer.member_expires_at || new Date(existingCustomer.member_expires_at) > new Date());

      // Load member plan if active member
      if (isCustomerMember && existingCustomer.member_plan_id && !memberPlan) {
        const { data: plan } = await supabase
          .from("member_plans")
          .select("id, included_service_ids")
          .eq("id", existingCustomer.member_plan_id)
          .single();
        if (plan) setMemberPlan(plan);
      }
    } else {
      // Create customer via API with default password
      const response = await fetch("/api/customer/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.customerName,
          phone: formData.customerPhone,
          barbershopId: staffData.barbershop_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError("Erro ao cadastrar cliente: " + (result.error || "Erro desconhecido"));
        setLoading(false);
        return;
      }

      customerId = result.customer.id;
      isCustomerMember = false;
    }

    // Check if service is member-only and customer has active membership
    if (selectedService.is_member_only && !isCustomerMember) {
      setError("Este serviço é exclusivo para membros. O cliente não possui plano ativo.");
      setLoading(false);
      return;
    }

    const now = new Date();
    const endTime = new Date(now.getTime() + selectedService.duration_minutes * 60000);

    // Check if service is covered by member's plan
    const isCovered = isServiceCoveredByPlan(formData.serviceId);
    const priceToCharge = isCovered ? 0 : selectedService.price;

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        customer_id: customerId,
        barber_id: formData.barberId,
        service_id: formData.serviceId,
        scheduled_at: now.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: selectedService.duration_minutes,
        price: priceToCharge,
        total_amount: priceToCharge,
        is_member_slot: isCovered,
        status: "scheduled",
        barbershop_id: staffData.barbershop_id,
      })
      .select("id")
      .single();

    if (appointmentError || !appointment) {
      setError("Erro ao criar atendimento: " + (appointmentError?.message || "Erro desconhecido"));
      setLoading(false);
      return;
    }

    // Create appointment_services record with coverage info
    const { error: serviceInsertError } = await supabase
      .from("appointment_services")
      .insert({
        appointment_id: appointment.id,
        service_id: formData.serviceId,
        barbershop_id: staffData.barbershop_id,
        service_name_snapshot: selectedService.name,
        duration_snapshot: selectedService.duration_minutes,
        price_snapshot: selectedService.price,
        covered_by_plan: isCovered,
      });

    if (serviceInsertError) {
      console.error("Error inserting appointment_services:", serviceInsertError);
      // Continue anyway - the main appointment was created
    }

    setLoading(false);
    resetForm();
    onSuccess();
    onClose();
  }

  function isServiceCoveredByPlan(serviceId: string): boolean {
    if (!memberPlan?.included_service_ids) return false;
    return memberPlan.included_service_ids.includes(serviceId);
  }

  function resetForm() {
    setFormData({
      customerName: "",
      customerPhone: "",
      barberId: "",
      serviceId: "",
    });
    setError("");
    setShowServiceDropdown(false);
    setMemberPlan(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const selectedService = services.find((s) => s.id === formData.serviceId);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Encaixe Rápido" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-accent/20 border border-accent/30 rounded-lg text-sm text-accent">
          Cliente sem agendamento prévio. O atendimento será iniciado imediatamente.
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Nome do cliente *</label>
          <input
            type="text"
            value={formData.customerName}
            onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
            placeholder="Nome completo"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Telefone *</label>
          <input
            type="tel"
            value={formData.customerPhone}
            onChange={(e) => setFormData((prev) => ({ ...prev, customerPhone: e.target.value }))}
            placeholder="11999999999"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          />
          {memberPlan && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-400">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span>Cliente membro identificado</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Barbeiro *</label>
          <select
            value={formData.barberId}
            onChange={(e) => setFormData((prev) => ({ ...prev, barberId: e.target.value }))}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          >
            <option value="">Selecione...</option>
            {barbers.map((barber) => (
              <option key={barber.id} value={barber.id}>
                {barber.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative" data-service-dropdown>
          <label className="block text-sm text-muted-foreground mb-1">Serviço *</label>
          <button
            type="button"
            onClick={() => setShowServiceDropdown(!showServiceDropdown)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-left flex items-center justify-between"
          >
            {formData.serviceId ? (
              <span className="flex items-center gap-2">
                {isServiceCoveredByPlan(formData.serviceId) ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : services.find(s => s.id === formData.serviceId)?.is_member_only ? (
                  <svg className="w-4 h-4 text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.6)]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ) : null}
                <span>{services.find(s => s.id === formData.serviceId)?.name}</span>
                {isServiceCoveredByPlan(formData.serviceId) && (
                  <span className="text-xs text-green-400">Coberto</span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">Selecione...</span>
            )}
            <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showServiceDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showServiceDropdown && (
            <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {services.map((service) => {
                const isCovered = isServiceCoveredByPlan(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, serviceId: service.id }));
                      setShowServiceDropdown(false);
                    }}
                    className={`w-full px-3 py-2.5 text-left hover:bg-muted transition-colors flex items-center gap-3 ${
                      formData.serviceId === service.id ? 'bg-muted/50' : ''
                    } ${isCovered ? 'bg-green-900/10' : ''}`}
                  >
                    {isCovered ? (
                      <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : service.is_member_only ? (
                      <svg className="w-4 h-4 text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.6)] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ) : null}
                    <div className={`flex-1 ${!isCovered && !service.is_member_only ? 'pl-7' : ''}`}>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {service.name}
                        {isCovered && (
                          <span className="text-xs text-green-400 font-normal">Coberto</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isCovered ? (
                          <span><span className="line-through">R$ {service.price.toFixed(2).replace('.', ',')}</span> R$ 0,00</span>
                        ) : (
                          <>R$ {service.price.toFixed(2).replace('.', ',')}</>
                        )} · {service.duration_minutes}min
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedService && (
          <div className={`p-3 rounded-lg text-sm ${isServiceCoveredByPlan(selectedService.id) ? 'bg-green-900/20 border border-green-900/50' : 'bg-muted'}`}>
            {isServiceCoveredByPlan(selectedService.id) && (
              <div className="flex items-center gap-2 mb-2 text-green-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Coberto pelo plano</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duração:</span>
              <span>{selectedService.duration_minutes} minutos</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Valor:</span>
              {isServiceCoveredByPlan(selectedService.id) ? (
                <span className="font-medium text-green-400">
                  <span className="line-through text-muted-foreground mr-2">R$ {selectedService.price.toFixed(2)}</span>
                  R$ 0,00
                </span>
              ) : (
                <span className="font-medium">R$ {selectedService.price.toFixed(2)}</span>
              )}
            </div>
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
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Iniciando..." : "Iniciar atendimento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
