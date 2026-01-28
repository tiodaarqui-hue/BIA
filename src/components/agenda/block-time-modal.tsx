"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";

interface Barber {
  id: string;
  name: string;
}

interface BlockTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  barbers: Barber[];
  preSelectedBarberId?: string;
  preSelectedDate?: Date;
}

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function BlockTimeModal({
  isOpen,
  onClose,
  onSuccess,
  barbers,
  preSelectedBarberId,
  preSelectedDate,
}: BlockTimeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    barberId: preSelectedBarberId || "",
    date: preSelectedDate ? formatDateInput(preSelectedDate) : formatDateInput(new Date()),
    startTime: "08:00",
    endTime: "19:00",
    reason: "",
    fullDay: true,
  });

  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        barberId: preSelectedBarberId || prev.barberId || (barbers[0]?.id || ""),
        date: preSelectedDate ? formatDateInput(preSelectedDate) : prev.date,
      }));
      setError("");
    }
  }, [isOpen, preSelectedBarberId, preSelectedDate, barbers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!formData.barberId) {
      setError("Selecione um barbeiro");
      return;
    }

    setLoading(true);

    const startAt = new Date(`${formData.date}T${formData.fullDay ? "00:00" : formData.startTime}:00`);
    const endAt = new Date(`${formData.date}T${formData.fullDay ? "23:59" : formData.endTime}:00`);

    if (endAt <= startAt) {
      setError("O horário final deve ser maior que o inicial");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("barber_blocks").insert({
      barber_id: formData.barberId,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      reason: formData.reason || null,
    });

    if (insertError) {
      setError("Erro ao bloquear horário: " + insertError.message);
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
      barberId: "",
      date: formatDateInput(new Date()),
      startTime: "08:00",
      endTime: "19:00",
      reason: "",
      fullDay: true,
    });
    setError("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const selectedBarber = barbers.find((b) => b.id === formData.barberId);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bloquear Horário" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className="block text-sm text-muted-foreground mb-1">Data *</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.fullDay}
              onChange={(e) => setFormData((prev) => ({ ...prev, fullDay: e.target.checked }))}
              className="w-4 h-4 rounded border-border"
            />
            <span className="text-sm">Dia inteiro</span>
          </label>
        </div>

        {!formData.fullDay && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Início</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Fim</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm text-muted-foreground mb-1">Motivo (opcional)</label>
          <input
            type="text"
            value={formData.reason}
            onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
            placeholder="Ex: Folga, consulta médica..."
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>

        {selectedBarber && (
          <div className="p-3 bg-red-900/20 border border-red-900/30 rounded-lg text-sm">
            <p className="text-red-400">
              {selectedBarber.name} ficará indisponível em {new Date(formData.date).toLocaleDateString("pt-BR")}
              {!formData.fullDay && ` das ${formData.startTime} às ${formData.endTime}`}
            </p>
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
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Bloqueando..." : "Bloquear"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
