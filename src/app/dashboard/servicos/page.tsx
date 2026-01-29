"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Loading } from "@/components/ui/loading";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_member_only: boolean;
  is_active: boolean;
  created_at: string;
}

export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<"all" | "active" | "member">("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadServices() {
      setLoading(true);
      const { data } = await supabase
        .from("services")
        .select("*")
        .order("name");

      if (data) {
        setServices(data);
      }
      setLoading(false);
    }

    loadServices();
  }, [refreshKey, supabase]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (filter === "active") return service.is_active;
      if (filter === "member") return service.is_member_only;
      return true;
    });
  }, [services, filter]);

  function handleEdit(service: Service) {
    setEditingService(service);
    setIsModalOpen(true);
  }

  function handleNew() {
    setEditingService(null);
    setIsModalOpen(true);
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setEditingService(null);
  }

  function handleSuccess() {
    setRefreshKey((k) => k + 1);
    handleModalClose();
  }

  const activeCount = services.filter((s) => s.is_active).length;
  const memberOnlyCount = services.filter((s) => s.is_member_only).length;

  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light">Serviços</h1>
          <p className="text-muted-foreground mt-1">
            {services.length} {services.length === 1 ? "serviço" : "serviços"} - {activeCount} {activeCount === 1 ? "ativo" : "ativos"}
            {memberOnlyCount > 0 && ` - ${memberOnlyCount} exclusivo${memberOnlyCount > 1 ? "s" : ""} para membros`}
          </p>
        </div>

        <button
          onClick={handleNew}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Serviço
        </button>
      </div>

      <div className="flex gap-2">
        {(["all", "active", "member"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "Todos" : f === "active" ? "Ativos" : "Exclusivos Membro"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loading />
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">
            {filter !== "all" ? "Nenhum serviço encontrado com este filtro." : "Nenhum serviço cadastrado."}
          </p>
          {filter === "all" && (
            <button
              onClick={handleNew}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
            >
              Cadastrar primeiro serviço
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className={`bg-card border rounded-lg overflow-hidden transition-colors ${
                service.is_active ? "border-border" : "border-border/50 opacity-60"
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-lg truncate">{service.name}</h3>
                      {service.is_member_only && (
                        <span className="shrink-0 px-2 py-0.5 text-xs rounded-full bg-accent/20 text-accent border border-accent/30">
                          Membro
                        </span>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {service.description}
                      </p>
                    )}
                  </div>
                  {!service.is_active && (
                    <span className="shrink-0 px-2 py-1 text-xs rounded-full bg-red-900/30 text-red-400 border border-red-700/50">
                      Inativo
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-light text-primary">
                      R$ {service.price.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-xs text-muted-foreground">Valor</p>
                  </div>
                  <div>
                    <p className="text-2xl font-light">
                      {formatDuration(service.duration_minutes)}
                    </p>
                    <p className="text-xs text-muted-foreground">Duração</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 bg-muted/30 border-t border-border">
                <button
                  onClick={() => handleEdit(service)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceModal
        service={editingService}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

interface ServiceModalProps {
  service: Service | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function ServiceModal({ service, isOpen, onClose, onSuccess }: ServiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration_minutes: "30",
    is_member_only: false,
    is_active: true,
  });

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name,
        description: service.description || "",
        price: service.price.toString(),
        duration_minutes: service.duration_minutes.toString(),
        is_member_only: service.is_member_only,
        is_active: service.is_active,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        price: "",
        duration_minutes: "30",
        is_member_only: false,
        is_active: true,
      });
    }
    setError("");
  }, [service, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    if (!formData.price || parseFloat(formData.price) < 0) {
      setError("Valor é obrigatório");
      return;
    }

    if (!formData.duration_minutes || parseInt(formData.duration_minutes) <= 0) {
      setError("Duração é obrigatória");
      return;
    }

    setLoading(true);

    const data = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      price: parseFloat(formData.price),
      duration_minutes: parseInt(formData.duration_minutes),
      is_member_only: formData.is_member_only,
      is_active: formData.is_active,
    };

    if (service) {
      const { error: updateError } = await supabase
        .from("services")
        .update(data)
        .eq("id", service.id);

      if (updateError) {
        setError("Erro ao atualizar: " + updateError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("services").insert(data);

      if (insertError) {
        setError("Erro ao cadastrar: " + insertError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    onSuccess();
  }

  const DURATION_OPTIONS = [
    { value: "15", label: "15 minutos" },
    { value: "30", label: "30 minutos" },
    { value: "45", label: "45 minutos" },
    { value: "60", label: "1 hora" },
    { value: "90", label: "1h 30min" },
    { value: "120", label: "2 horas" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={service ? "Editar Serviço" : "Novo Serviço"}
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
            placeholder="Ex: Corte tradicional"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Descrição</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Descrição breve do serviço..."
            rows={2}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Valor (R$) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
              placeholder="0,00"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Duração *</label>
            <select
              value={formData.duration_minutes}
              onChange={(e) => setFormData((prev) => ({ ...prev, duration_minutes: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_member_only}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_member_only: e.target.checked }))}
              className="w-5 h-5 rounded border-border"
            />
            <div>
              <span className="font-medium">Exclusivo para Membros</span>
              <p className="text-xs text-muted-foreground">
                Apenas clientes com plano podem agendar
              </p>
            </div>
          </label>

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
                Serviços inativos não aparecem para agendamento
              </p>
            </div>
          </label>
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
            {loading ? "Salvando..." : service ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
