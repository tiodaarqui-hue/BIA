"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";

interface Customer {
  id: string;
  name: string;
  phone: string;
  is_member?: boolean;
  member_expires_at?: string | null;
  member_plan_id?: string | null;
}

interface MemberPlan {
  id: string;
  included_service_ids: string[] | null;
}

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

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedDate?: Date;
  preSelectedHour?: number;
  preSelectedBarberId?: string;
}

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function NewAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  preSelectedDate,
  preSelectedHour,
  preSelectedBarberId,
}: NewAppointmentModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [memberPlan, setMemberPlan] = useState<MemberPlan | null>(null);

  const [formData, setFormData] = useState({
    customerId: "",
    customerName: "",
    barberId: preSelectedBarberId || "",
    serviceId: "",
    date: preSelectedDate ? formatDateInput(preSelectedDate) : formatDateInput(new Date()),
    time: preSelectedHour ? `${preSelectedHour.toString().padStart(2, "0")}:00` : "09:00",
  });

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    async function loadData() {
      const [barbersRes, servicesRes] = await Promise.all([
        supabase.from("barbers").select("id, name").eq("is_active", true).order("name"),
        supabase.from("services").select("id, name, price, duration_minutes, is_member_only").eq("is_active", true).order("name"),
      ]);

      if (isCancelled) return;

      if (barbersRes.data) {
        setBarbers(barbersRes.data);
        // Auto-select if only 1 barber and no pre-selection
        if (barbersRes.data.length === 1 && !preSelectedBarberId) {
          setFormData((prev) => ({ ...prev, barberId: barbersRes.data[0].id }));
        }
      }
      if (servicesRes.data) setServices(servicesRes.data);
    }

    loadData();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing form with props on open
    setFormData((prev) => ({
      ...prev,
      barberId: preSelectedBarberId || prev.barberId,
      date: preSelectedDate ? formatDateInput(preSelectedDate) : prev.date,
      time: preSelectedHour ? `${preSelectedHour.toString().padStart(2, "0")}:00` : prev.time,
    }));

    return () => {
      isCancelled = true;
    };
  }, [isOpen, preSelectedDate, preSelectedHour, preSelectedBarberId, supabase]);

  useEffect(() => {
    if (customerSearch.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clearing results when query is too short
      setCustomers([]);
      return;
    }

    let isCancelled = false;

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone, is_member, member_expires_at, member_plan_id")
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

  async function selectCustomer(customer: Customer) {
    setFormData((prev) => ({
      ...prev,
      customerId: customer.id,
      customerName: `${customer.name} - ${customer.phone}`,
    }));
    setSelectedCustomer(customer);
    setCustomerSearch("");
    setShowCustomerDropdown(false);

    // If customer is an active member, fetch their plan's included services
    const isActiveMember = customer.is_member &&
      customer.member_plan_id &&
      (!customer.member_expires_at || new Date(customer.member_expires_at) > new Date());

    if (isActiveMember && customer.member_plan_id) {
      const { data: plan } = await supabase
        .from("member_plans")
        .select("id, included_service_ids")
        .eq("id", customer.member_plan_id)
        .single();

      setMemberPlan(plan || null);
    } else {
      setMemberPlan(null);
    }
  }

  function handleQuickCustomerSuccess(customer: Customer) {
    selectCustomer(customer);
    setShowQuickCustomerModal(false);
  }

  async function checkConflict(): Promise<boolean> {
    const selectedService = services.find((s) => s.id === formData.serviceId);
    if (!selectedService) return false;

    const startTime = new Date(`${formData.date}T${formData.time}:00`);
    const endTime = new Date(startTime.getTime() + selectedService.duration_minutes * 60000);

    const { data: conflicts } = await supabase
      .from("appointments")
      .select("id, scheduled_at, duration_minutes")
      .eq("barber_id", formData.barberId)
      .neq("status", "cancelled")
      .gte("scheduled_at", `${formData.date}T00:00:00`)
      .lt("scheduled_at", `${formData.date}T23:59:59`);

    if (!conflicts) return false;

    for (const apt of conflicts) {
      const aptStart = new Date(apt.scheduled_at);
      const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);

      if (
        (startTime >= aptStart && startTime < aptEnd) ||
        (endTime > aptStart && endTime <= aptEnd) ||
        (startTime <= aptStart && endTime >= aptEnd)
      ) {
        return true;
      }
    }

    return false;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.customerId || !formData.barberId || !formData.serviceId) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);

    const hasConflict = await checkConflict();
    if (hasConflict) {
      setError("Já existe um agendamento neste horário para este barbeiro");
      setLoading(false);
      return;
    }

    const selectedService = services.find((s) => s.id === formData.serviceId);
    if (!selectedService) {
      setError("Serviço não encontrado");
      setLoading(false);
      return;
    }

    // Check if service is member-only and customer has active membership
    if (selectedService.is_member_only) {
      const { data: customerData } = await supabase
        .from("customers")
        .select("is_member, member_expires_at")
        .eq("id", formData.customerId)
        .single();

      const isActiveMember = customerData?.is_member &&
        (!customerData.member_expires_at || new Date(customerData.member_expires_at) > new Date());

      if (!isActiveMember) {
        setError("Este serviço é exclusivo para membros. O cliente selecionado não possui plano ativo.");
        setLoading(false);
        return;
      }
    }

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

    const scheduledAt = new Date(`${formData.date}T${formData.time}:00`);
    const endTime = new Date(scheduledAt.getTime() + selectedService.duration_minutes * 60000);

    // Check if service is covered by member's plan
    const isCovered = isServiceCoveredByPlan(formData.serviceId);
    const priceToCharge = isCovered ? 0 : selectedService.price;

    const { data: appointment, error: insertError } = await supabase
      .from("appointments")
      .insert({
        customer_id: formData.customerId,
        barber_id: formData.barberId,
        service_id: formData.serviceId,
        scheduled_at: scheduledAt.toISOString(),
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

    if (insertError || !appointment) {
      setError("Erro ao criar agendamento: " + (insertError?.message || "Erro desconhecido"));
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
      // Rollback appointment if service insert fails
      await supabase.from("appointments").delete().eq("id", appointment.id);
      setError("Erro ao registrar serviço: " + serviceInsertError.message);
      setLoading(false);
      return;
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
      customerId: "",
      customerName: "",
      barberId: "",
      serviceId: "",
      date: formatDateInput(new Date()),
      time: "09:00",
    });
    setCustomerSearch("");
    setError("");
    setShowServiceDropdown(false);
    setSelectedCustomer(null);
    setMemberPlan(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const selectedService = services.find((s) => s.id === formData.serviceId);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Novo Agendamento" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <label className="block text-sm text-muted-foreground mb-1">Cliente *</label>
          {formData.customerId ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm flex items-center gap-2">
                {formData.customerName}
                {memberPlan && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-900/30 text-amber-400 flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    Membro
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, customerId: "", customerName: "" }));
                  setSelectedCustomer(null);
                  setMemberPlan(null);
                }}
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Buscar por nome ou telefone..."
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(true)}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  title="Cadastrar novo cliente"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Data *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Horário *</label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData((prev) => ({ ...prev, time: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
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
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Agendar"}
          </button>
        </div>
      </form>

      <QuickCustomerModal
        isOpen={showQuickCustomerModal}
        onClose={() => setShowQuickCustomerModal(false)}
        onSuccess={handleQuickCustomerSuccess}
      />
    </Modal>
  );
}

interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: Customer) => void;
}

function QuickCustomerModal({ isOpen, onClose, onSuccess }: QuickCustomerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (isOpen) {
      setFormData({ name: "", phone: "", email: "" });
      setError("");
      setSuccessMessage("");
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.name.trim() || !formData.phone.trim()) {
      setError("Nome e telefone são obrigatórios");
      return;
    }

    setLoading(true);

    // Get barbershop_id from current user
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

    // Call API to create customer with default password
    const response = await fetch("/api/customer/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        barbershopId: staffData.barbershop_id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "Erro ao cadastrar cliente");
      setLoading(false);
      return;
    }

    const data = result.customer;

    setLoading(false);
    onSuccess(data);
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-medium">Novo Cliente</h2>
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
              placeholder="Nome completo"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Telefone *</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="11999999999"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="email@exemplo.com"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          {/* Info about default password */}
          <div className="p-3 bg-blue-900/20 border border-blue-900/50 rounded-lg text-xs text-blue-300">
            <p className="font-medium">Senha padrão: 123456</p>
            <p className="text-blue-400 mt-1">O cliente poderá usar este telefone e senha para agendar online.</p>
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
              {loading ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
