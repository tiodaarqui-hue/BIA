"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Loading } from "@/components/ui/loading";

interface Barber {
  id: string;
  name: string;
  phone: string | null;
  commission_percent: number;
  is_active: boolean;
  created_at: string;
}

interface BarberSchedule {
  id: string;
  barber_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

export default function BarbeirosPage() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const [selectedBarberForSchedule, setSelectedBarberForSchedule] = useState<Barber | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadBarbers() {
      setLoading(true);
      const { data } = await supabase
        .from("barbers")
        .select("*")
        .order("name");

      if (data) {
        setBarbers(data);
      }
      setLoading(false);
    }

    loadBarbers();
  }, [refreshKey, supabase]);

  function handleEdit(barber: Barber) {
    setEditingBarber(barber);
    setIsModalOpen(true);
  }

  function handleNew() {
    setEditingBarber(null);
    setIsModalOpen(true);
  }

  function handleSchedule(barber: Barber) {
    setSelectedBarberForSchedule(barber);
    setIsScheduleModalOpen(true);
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setEditingBarber(null);
  }

  function handleScheduleModalClose() {
    setIsScheduleModalOpen(false);
    setSelectedBarberForSchedule(null);
  }

  function handleSuccess() {
    setRefreshKey((k) => k + 1);
    handleModalClose();
  }

  const activeCount = barbers.filter((b) => b.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light">Barbeiros</h1>
          <p className="text-muted-foreground mt-1">
            {barbers.length} {barbers.length === 1 ? "barbeiro" : "barbeiros"} - {activeCount} {activeCount === 1 ? "ativo" : "ativos"}
          </p>
        </div>

        <button
          onClick={handleNew}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Barbeiro
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loading />
        </div>
      ) : barbers.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">Nenhum barbeiro cadastrado.</p>
          <button
            onClick={handleNew}
            className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            Cadastrar primeiro barbeiro
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {barbers.map((barber) => (
            <div
              key={barber.id}
              className={`bg-card border rounded-lg p-6 transition-colors ${
                barber.is_active ? "border-border" : "border-border/50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-xl font-medium text-primary">
                    {barber.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-lg">{barber.name}</h3>
                    {barber.phone && (
                      <p className="text-sm text-muted-foreground">{barber.phone}</p>
                    )}
                  </div>
                </div>
                {!barber.is_active && (
                  <span className="px-2 py-1 text-xs rounded-full bg-red-900/30 text-red-400 border border-red-700/50">
                    Inativo
                  </span>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Comissão</span>
                  <span className="font-medium">{barber.commission_percent}%</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleSchedule(barber)}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Horários
                </button>
                <button
                  onClick={() => handleEdit(barber)}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BarberModal
        barber={editingBarber}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
      />

      {selectedBarberForSchedule && (
        <ScheduleModal
          barber={selectedBarberForSchedule}
          isOpen={isScheduleModalOpen}
          onClose={handleScheduleModalClose}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

interface BarberModalProps {
  barber: Barber | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function BarberModal({ barber, isOpen, onClose, onSuccess }: BarberModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    commission_percent: "0",
    is_active: true,
  });

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (barber) {
      setFormData({
        name: barber.name,
        phone: barber.phone || "",
        commission_percent: barber.commission_percent.toString(),
        is_active: barber.is_active,
      });
    } else {
      setFormData({
        name: "",
        phone: "",
        commission_percent: "0",
        is_active: true,
      });
    }
    setError("");
  }, [barber, isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    setLoading(true);

    const data = {
      name: formData.name.trim(),
      phone: formData.phone.trim() || null,
      commission_percent: parseFloat(formData.commission_percent) || 0,
      is_active: formData.is_active,
    };

    if (barber) {
      const { error: updateError } = await supabase
        .from("barbers")
        .update(data)
        .eq("id", barber.id);

      if (updateError) {
        setError("Erro ao atualizar: " + updateError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("barbers").insert(data);

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
      title={barber ? "Editar Barbeiro" : "Novo Barbeiro"}
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
            placeholder="Nome do barbeiro"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Telefone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="11999999999"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Comissão (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={formData.commission_percent}
            onChange={(e) => setFormData((prev) => ({ ...prev, commission_percent: e.target.value }))}
            placeholder="0"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>

        <div>
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
                Barbeiros inativos não aparecem na agenda
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
            {loading ? "Salvando..." : barber ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface ScheduleModalProps {
  barber: Barber;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function ScheduleModal({ barber, isOpen, onClose, onSuccess }: ScheduleModalProps) {
  const [schedules, setSchedules] = useState<BarberSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!isOpen) return;

    async function loadSchedules() {
      setLoading(true);
      const { data } = await supabase
        .from("barber_schedules")
        .select("*")
        .eq("barber_id", barber.id)
        .order("day_of_week");

      if (data) {
        setSchedules(data);
      }
      setLoading(false);
    }

    loadSchedules();
  }, [barber.id, isOpen, supabase]);

  function getScheduleForDay(day: number) {
    return schedules.find((s) => s.day_of_week === day);
  }

  async function toggleDay(day: number) {
    const existing = getScheduleForDay(day);
    setSaving(true);
    setError("");

    if (existing) {
      const { error: deleteError } = await supabase
        .from("barber_schedules")
        .delete()
        .eq("id", existing.id);

      if (deleteError) {
        setError("Erro ao remover dia: " + deleteError.message);
        setSaving(false);
        return;
      }

      setSchedules((prev) => prev.filter((s) => s.id !== existing.id));
    } else {
      const { data, error: insertError } = await supabase
        .from("barber_schedules")
        .insert({
          barber_id: barber.id,
          day_of_week: day,
          start_time: "09:00",
          end_time: "19:00",
        })
        .select()
        .single();

      if (insertError) {
        setError("Erro ao adicionar dia: " + insertError.message);
        setSaving(false);
        return;
      }

      if (data) {
        setSchedules((prev) => [...prev, data]);
      }
    }

    setSaving(false);
    onSuccess();
  }

  async function updateTime(scheduleId: string, field: "start_time" | "end_time", value: string) {
    setSaving(true);
    setError("");

    const { error: updateError } = await supabase
      .from("barber_schedules")
      .update({ [field]: value })
      .eq("id", scheduleId);

    if (updateError) {
      setError("Erro ao atualizar horário: " + updateError.message);
      setSaving(false);
      return;
    }

    setSchedules((prev) =>
      prev.map((s) => (s.id === scheduleId ? { ...s, [field]: value } : s))
    );

    setSaving(false);
    onSuccess();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Horários - ${barber.name}`}
      size="md"
      closeOnOverlayClick={false}
    >
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loading />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione os dias de trabalho e defina os horários.
          </p>

          <div className="space-y-2">
            {DAYS_OF_WEEK.map((day) => {
              const schedule = getScheduleForDay(day.value);
              const isActive = !!schedule;

              return (
                <div
                  key={day.value}
                  className={`p-3 rounded-lg border transition-colors ${
                    isActive ? "border-primary/50 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleDay(day.value)}
                        disabled={saving}
                        className="w-5 h-5 rounded border-border"
                      />
                      <span className={isActive ? "font-medium" : "text-muted-foreground"}>
                        {day.label}
                      </span>
                    </label>

                    {isActive && schedule && (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={schedule.start_time}
                          onChange={(e) => updateTime(schedule.id, "start_time", e.target.value)}
                          disabled={saving}
                          className="px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:border-primary"
                        />
                        <span className="text-muted-foreground">às</span>
                        <input
                          type="time"
                          value={schedule.end_time}
                          onChange={(e) => updateTime(schedule.id, "end_time", e.target.value)}
                          disabled={saving}
                          className="px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:border-primary"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
