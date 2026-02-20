"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { Loading } from "@/components/ui/loading";
import { createClient } from "@/lib/supabase/client";

interface AgendaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function AgendaSettingsModal({ isOpen, onClose, onSave }: AgendaSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(20);
  const [slotInterval, setSlotInterval] = useState(30);
  const [sundayEnabled, setSundayEnabled] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!isOpen) return;

    async function loadSettings() {
      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("agenda_settings")
        .select("*")
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        setError("Erro ao carregar configurações");
      }

      if (data) {
        setSettingsId(data.id);
        setStartHour(data.start_hour);
        setEndHour(data.end_hour);
        setSlotInterval(data.slot_interval ?? 30);
        setSundayEnabled((data.enabled_days || []).includes(0));
      }

      setLoading(false);
    }

    loadSettings();
  }, [isOpen, supabase]);

  async function handleSave() {
    if (startHour >= endHour) {
      setError("Hora inicial deve ser menor que hora final");
      return;
    }

    setSaving(true);
    setError("");

    // Monday to Saturday are always enabled, Sunday is optional
    const enabledDays = sundayEnabled ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];

    const settingsData = {
      start_hour: startHour,
      end_hour: endHour,
      slot_interval: slotInterval,
      enabled_days: enabledDays,
    };

    let result;

    if (settingsId) {
      result = await supabase
        .from("agenda_settings")
        .update(settingsData)
        .eq("id", settingsId);
    } else {
      result = await supabase.from("agenda_settings").insert(settingsData);
    }

    if (result.error) {
      setError("Erro ao salvar: " + result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSave();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações da Agenda" size="sm">
      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm text-muted-foreground mb-3">Horário de funcionamento</label>
            <div className="flex items-center gap-3">
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">até</span>
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-3">Intervalo entre horários</label>
            <select
              value={slotInterval}
              onChange={(e) => setSlotInterval(Number(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
            >
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={60}>60 minutos</option>
              <option value={90}>90 minutos</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Define os horários disponíveis para o cliente agendar
            </p>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sundayEnabled}
                onChange={(e) => setSundayEnabled(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <div>
                <span className="font-medium">Abrir aos domingos</span>
                <p className="text-xs text-muted-foreground">
                  Segunda a sábado estão sempre habilitados
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
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
