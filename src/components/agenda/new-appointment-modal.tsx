"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";

interface Customer {
  id: string;
  name: string;
  phone: string;
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
        supabase.from("services").select("id, name, price, duration_minutes").eq("is_active", true).order("name"),
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
      customerId: customer.id,
      customerName: `${customer.name} - ${customer.phone}`,
    }));
    setCustomerSearch("");
    setShowCustomerDropdown(false);
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

    const scheduledAt = new Date(`${formData.date}T${formData.time}:00`);

    const { error: insertError } = await supabase.from("appointments").insert({
      customer_id: formData.customerId,
      barber_id: formData.barberId,
      service_id: formData.serviceId,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: selectedService.duration_minutes,
      price: selectedService.price,
      status: "scheduled",
    });

    if (insertError) {
      setError("Erro ao criar agendamento: " + insertError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    resetForm();
    onSuccess();
    onClose();
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
              <span className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm">
                {formData.customerName}
              </span>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, customerId: "", customerName: "" }))}
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

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Serviço *</label>
          <select
            value={formData.serviceId}
            onChange={(e) => setFormData((prev) => ({ ...prev, serviceId: e.target.value }))}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          >
            <option value="">Selecione...</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} - R$ {service.price.toFixed(2)} ({service.duration_minutes}min)
              </option>
            ))}
          </select>
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
          <div className="p-3 bg-muted rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duração:</span>
              <span>{selectedService.duration_minutes} minutos</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-medium">R$ {selectedService.price.toFixed(2)}</span>
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

    const { data, error: insertError } = await supabase
      .from("customers")
      .insert({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
      })
      .select("id, name, phone")
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
