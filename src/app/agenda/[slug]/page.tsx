"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";

interface Barber {
  id: string;
  name: string;
}

interface Appointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  barber_id: string;
  customer: {
    name: string;
  };
  service: {
    name: string;
  };
}

interface AgendaSettings {
  start_hour: number;
  end_hour: number;
  enabled_days: number[];
}

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const DEFAULT_SETTINGS: AgendaSettings = {
  start_hour: 8,
  end_hour: 20,
  enabled_days: [1, 2, 3, 4, 5, 6],
};

function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const diff = date.getDate() - day;
  const sunday = new Date(date);
  sunday.setDate(diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function PublicAgendaPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [barbershopName, setBarbershopName] = useState("");
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [settings, setSettings] = useState<AgendaSettings>(DEFAULT_SETTINGS);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState("");

  const agendaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  const weekDays = getWeekDays(currentTime);
  const weekStart = weekDays[0];
  const filteredWeekDays = weekDays.filter((day) =>
    settings.enabled_days.includes(day.getDay())
  );

  const HOURS = Array.from(
    { length: settings.end_hour - settings.start_hour },
    (_, i) => settings.start_hour + i
  );

  const scrollToCurrentTime = useCallback(() => {
    if (!agendaRef.current) return;
    const now = new Date();
    const currentHour = now.getHours();
    const hourIndex = currentHour - settings.start_hour;
    if (hourIndex >= 0 && hourIndex < HOURS.length) {
      const rows = agendaRef.current.querySelectorAll("[data-hour]");
      const targetRow = rows[hourIndex] as HTMLElement;
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [settings.start_hour, HOURS.length]);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      // Get barbershop by slug
      const { data: barbershop, error: bsError } = await supabase
        .from("barbershops")
        .select("id, name")
        .eq("slug", slug)
        .single();

      if (bsError || !barbershop) {
        setError("Agenda não encontrada");
        setLoading(false);
        return;
      }

      const bsId = barbershop.id;
      setBarbershopId(bsId);
      setBarbershopName(barbershop.name);

      // Get settings
      const { data: settingsData } = await supabase
        .from("agenda_settings")
        .select("*")
        .eq("barbershop_id", bsId)
        .single();

      if (settingsData) {
        setSettings({
          start_hour: settingsData.start_hour,
          end_hour: settingsData.end_hour,
          enabled_days: settingsData.enabled_days || [1, 2, 3, 4, 5, 6],
        });
      }

      // Get barbers
      const { data: barbersData } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("barbershop_id", bsId)
        .eq("is_active", true)
        .order("name");

      setBarbers(barbersData || []);

      // Get appointments for current week
      const startOfWeek = formatDate(weekDays[0]);
      const endOfWeek = formatDate(weekDays[6]);

      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select(`
          id, scheduled_at, duration_minutes, status, barber_id,
          customer:customers(name),
          service:services(name)
        `)
        .eq("barbershop_id", bsId)
        .gte("scheduled_at", `${startOfWeek}T00:00:00`)
        .lte("scheduled_at", `${endOfWeek}T23:59:59`)
        .in("status", ["scheduled", "completed"]);

      setAppointments((appointmentsData || []) as unknown as Appointment[]);
      setLoading(false);

      // Scroll to current time after data loads
      setTimeout(scrollToCurrentTime, 100);
    }

    if (slug) {
      loadData();
    }
  }, [slug, supabase, scrollToCurrentTime]);

  // Real-time subscription
  useEffect(() => {
    if (!barbershopId) return;

    const channel = supabase
      .channel("public-agenda")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `barbershop_id=eq.${barbershopId}`,
        },
        () => {
          // Reload appointments on any change
          const startOfWeek = formatDate(weekDays[0]);
          const endOfWeek = formatDate(weekDays[6]);

          supabase
            .from("appointments")
            .select(`
              id, scheduled_at, duration_minutes, status, barber_id,
              customer:customers(name),
              service:services(name)
            `)
            .eq("barbershop_id", barbershopId)
            .gte("scheduled_at", `${startOfWeek}T00:00:00`)
            .lte("scheduled_at", `${endOfWeek}T23:59:59`)
            .in("status", ["scheduled", "completed"])
            .then(({ data }) => {
              if (data) setAppointments(data as unknown as Appointment[]);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barbershopId, supabase, weekDays]);

  // Clock update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Silent auto-refresh every 15 seconds
  useEffect(() => {
    if (!barbershopId) return;

    const refreshAppointments = async () => {
      const startOfWeek = formatDate(weekDays[0]);
      const endOfWeek = formatDate(weekDays[6]);

      const { data } = await supabase
        .from("appointments")
        .select(`
          id, scheduled_at, duration_minutes, status, barber_id,
          customer:customers(name),
          service:services(name)
        `)
        .eq("barbershop_id", barbershopId)
        .gte("scheduled_at", `${startOfWeek}T00:00:00`)
        .lte("scheduled_at", `${endOfWeek}T23:59:59`)
        .in("status", ["scheduled", "completed"]);

      if (data) {
        setAppointments(data as unknown as Appointment[]);
      }
    };

    const interval = setInterval(refreshAppointments, 15000);
    return () => clearInterval(interval);
  }, [barbershopId, supabase, weekDays]);

  // Auto-scroll when hour changes
  useEffect(() => {
    const now = new Date();
    if (now.getMinutes() === 0 && now.getSeconds() === 0) {
      scrollToCurrentTime();
    }
  }, [currentTime, scrollToCurrentTime]);

  // Fullscreen toggle
  function toggleFullscreen() {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function getAppointmentsForSlot(date: Date, hour: number, barberId: string) {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.scheduled_at);
      return (
        apt.barber_id === barberId &&
        formatDate(aptDate) === formatDate(date) &&
        aptDate.getHours() === hour
      );
    });
  }

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-900/50 border-blue-700/50",
    completed: "bg-emerald-900/50 border-emerald-700/50",
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div
            className="absolute rounded-full border-2 border-transparent border-t-white/80 border-r-white/40 animate-spin-fast"
            style={{ width: '32px', height: '32px' }}
          />
          <div
            className="rounded-full bg-gray-600 flex items-center justify-center"
            style={{ width: '24px', height: '24px' }}
          >
            <svg width="14" height="14" viewBox="0 0 100 100">
              <polygon points="50,10 88,80 12,80" fill="#0a0a0a" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-background flex flex-col"
      style={{ fontSize: '16px' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-light">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {barbershopName} - {MONTHS_PT[currentTime.getMonth()]} {currentTime.getFullYear()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Compass - scroll to now */}
          <button
            onClick={scrollToCurrentTime}
            className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"
            title="Ir para hora atual"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Agenda Grid */}
      <div ref={agendaRef} className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Header row */}
          <div
            className="grid border-b border-border sticky top-0 bg-card z-10"
            style={{ gridTemplateColumns: `60px repeat(${filteredWeekDays.length}, 1fr)` }}
          >
            <div className="p-2 text-xs text-muted-foreground" />
            {filteredWeekDays.map((day, i) => {
              const isToday = formatDate(day) === formatDate(currentTime);
              return (
                <div
                  key={i}
                  className={`p-2 text-center border-l border-border ${
                    isToday ? "bg-primary/10" : ""
                  }`}
                >
                  <div className={`text-xs ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {DAYS_PT[day.getDay()]}
                  </div>
                  <div className={`text-sm font-medium ${isToday ? "text-primary" : ""}`}>
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time slots */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              data-hour={hour}
              className="grid border-b border-border"
              style={{ gridTemplateColumns: `60px repeat(${filteredWeekDays.length}, 1fr)` }}
            >
              <div className="p-2 text-xs text-muted-foreground text-right pr-3 tabular-nums">
                {hour.toString().padStart(2, "0")}:00
              </div>
              {filteredWeekDays.map((day, dayIndex) => {
                const isToday = formatDate(day) === formatDate(currentTime);
                const isCurrentHour = isToday && currentTime.getHours() === hour;

                return (
                  <div
                    key={dayIndex}
                    className={`min-h-[50px] border-l border-border p-1 ${
                      isToday ? "bg-primary/5" : ""
                    } ${isCurrentHour ? "bg-primary/10" : ""}`}
                  >
                    {barbers.map((barber) => {
                      const slotAppointments = getAppointmentsForSlot(day, hour, barber.id);
                      return slotAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          className={`text-xs p-1.5 rounded border mb-1 ${
                            statusColors[apt.status] || "bg-muted"
                          }`}
                        >
                          <div className="font-medium truncate">
                            {(apt.customer as { name: string })?.name}
                          </div>
                          <div className="text-muted-foreground truncate flex items-center gap-1">
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                            </svg>
                            {barber.name}
                          </div>
                        </div>
                      ));
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer with clock and legend */}
      <div className="p-3 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-900/50 border border-blue-700/50" />
            <span className="text-xs text-muted-foreground">Agendado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-900/50 border border-emerald-700/50" />
            <span className="text-xs text-muted-foreground">Concluído</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-lg font-light tabular-nums">
            {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}
