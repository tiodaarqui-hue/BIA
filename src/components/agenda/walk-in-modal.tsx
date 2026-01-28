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
        .select("id, name, price, duration_minutes")
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

    return () => {
      isCancelled = true;
    };
  }, [isOpen, preSelectedBarberId, barbers, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.customerName || !formData.customerPhone || !formData.barberId || !formData.serviceId) {
      setError("Preencha todos os campos");
      return;
    }

    setLoading(true);

    // Buscar ou criar cliente
    let customerId: string;

    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", formData.customerPhone)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: formData.customerName,
          phone: formData.customerPhone,
        })
        .select("id")
        .single();

      if (customerError || !newCustomer) {
        setError("Erro ao cadastrar cliente: " + (customerError?.message || "Erro desconhecido"));
        setLoading(false);
        return;
      }

      customerId = newCustomer.id;
    }

    // Criar agendamento para agora
    const selectedService = services.find((s) => s.id === formData.serviceId);
    if (!selectedService) {
      setError("Serviço não encontrado");
      setLoading(false);
      return;
    }

    const now = new Date();

    const { error: appointmentError } = await supabase.from("appointments").insert({
      customer_id: customerId,
      barber_id: formData.barberId,
      service_id: formData.serviceId,
      scheduled_at: now.toISOString(),
      duration_minutes: selectedService.duration_minutes,
      price: selectedService.price,
      status: "scheduled",
    });

    if (appointmentError) {
      setError("Erro ao criar atendimento: " + appointmentError.message);
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
      customerName: "",
      customerPhone: "",
      barberId: "",
      serviceId: "",
    });
    setError("");
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
                {service.name} - R$ {service.price.toFixed(2)}
              </option>
            ))}
          </select>
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
            className="flex-1 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Iniciando..." : "Iniciar atendimento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
