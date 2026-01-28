"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { NewAppointmentModal } from "@/components/agenda/new-appointment-modal";
import { AppointmentDetailsModal } from "@/components/agenda/appointment-details-modal";
import { BlockTimeModal } from "@/components/agenda/block-time-modal";
import { WalkInModal } from "@/components/agenda/walk-in-modal";
import { AgendaSettingsModal } from "@/components/agenda/agenda-settings-modal";
import { Loading } from "@/components/ui/loading";

interface AgendaSettings {
  start_hour: number;
  end_hour: number;
  enabled_days: number[];
}

interface Barber {
  id: string;
  name: string;
}

interface BarberSchedule {
  barber_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface BarberBlock {
  id: string;
  barber_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
}

interface Appointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  price: number;
  notes: string | null;
  barber_id: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    no_show_count: number;
  };
  barber: {
    id: string;
    name: string;
  };
  service: {
    id: string;
    name: string;
    price: number;
  };
}

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DEFAULT_SETTINGS: AgendaSettings = {
  start_hour: 8,
  end_hour: 20,
  enabled_days: [1, 2, 3, 4, 5, 6], // Mon-Sat by default
};
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

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

export default function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [preSelectedSlot, setPreSelectedSlot] = useState<{
    date: Date;
    hour: number;
    barberId: string;
  } | null>(null);
  const [schedules, setSchedules] = useState<BarberSchedule[]>([]);
  const [blocks, setBlocks] = useState<BarberBlock[]>([]);
  const [agendaSettings, setAgendaSettings] = useState<AgendaSettings>(DEFAULT_SETTINGS);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [barbershopSlug, setBarbershopSlug] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const agendaContainerRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => createClient(), []);

  // Generate hours array based on settings
  const HOURS = useMemo(() => {
    const { start_hour, end_hour } = agendaSettings;
    return Array.from({ length: end_hour - start_hour }, (_, i) => i + start_hour);
  }, [agendaSettings]);

  // Current time state for clock and auto-scroll
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastScrolledHour, setLastScrolledHour] = useState<number | null>(null);

  // Update clock every second (so minutes change at the right moment)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Every second

    return () => clearInterval(interval);
  }, []);

  // Scroll to current hour on load and when hour changes
  useEffect(() => {
    if (loading) return;

    const currentHour = currentTime.getHours();
    const { start_hour, end_hour } = agendaSettings;
    const targetHour = Math.max(start_hour, Math.min(currentHour, end_hour - 1));

    // Only scroll if hour changed or first load
    if (lastScrolledHour !== targetHour) {
      const timer = setTimeout(() => {
        const hourElement = document.getElementById(`hour-row-${targetHour}`);
        if (hourElement && agendaContainerRef.current) {
          hourElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        setLastScrolledHour(targetHour);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [loading, currentTime, agendaSettings, lastScrolledHour]);

  const { weekDays, weekStartStr, weekEndStr } = useMemo(() => {
    const days = getWeekDays(currentDate);
    const start = days[0];
    const end = days[6];
    return {
      weekDays: days,
      weekStartStr: formatDate(start),
      weekEndStr: formatDate(new Date(end.getTime() + 86400000)),
    };
  }, [currentDate]);

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  // Filter days based on enabled_days setting
  const filteredWeekDays = useMemo(() => {
    return weekDays.filter((day) => agendaSettings.enabled_days.includes(day.getDay()));
  }, [weekDays, agendaSettings.enabled_days]);

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setLoading(true);

      const [barbersRes, appointmentsRes, schedulesRes, blocksRes, settingsRes] = await Promise.all([
        supabase
          .from("barbers")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("appointments")
          .select(`
            id,
            scheduled_at,
            duration_minutes,
            status,
            price,
            notes,
            barber_id,
            customer:customers(id, name, phone, no_show_count),
            barber:barbers(id, name),
            service:services(id, name, price)
          `)
          .gte("scheduled_at", weekStartStr)
          .lt("scheduled_at", weekEndStr)
          .neq("status", "cancelled")
          .order("scheduled_at"),
        supabase
          .from("barber_schedules")
          .select("barber_id, day_of_week, start_time, end_time"),
        supabase
          .from("barber_blocks")
          .select("id, barber_id, start_at, end_at, reason")
          .gte("end_at", weekStartStr)
          .lte("start_at", weekEndStr),
        supabase
          .from("agenda_settings")
          .select("start_hour, end_hour, enabled_days")
          .single(),
      ]);

      if (isCancelled) return;

      if (barbersRes.data) {
        setBarbers(barbersRes.data);
      }

      if (schedulesRes.data) {
        setSchedules(schedulesRes.data);
      }

      if (blocksRes.data) {
        setBlocks(blocksRes.data as BarberBlock[]);
      }

      if (settingsRes.data) {
        setAgendaSettings(settingsRes.data as AgendaSettings);
      }

      if (appointmentsRes.data) {
        setAppointments(appointmentsRes.data as unknown as Appointment[]);
      }

      setLoading(false);
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [weekStartStr, weekEndStr, refreshKey, supabase]);

  // Real-time subscription for appointments
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-appointments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        () => {
          // Reload appointments on any change (insert, update, delete)
          supabase
            .from("appointments")
            .select(`
              id,
              scheduled_at,
              duration_minutes,
              status,
              price,
              notes,
              barber_id,
              customer:customers(id, name, phone, no_show_count),
              barber:barbers(id, name),
              service:services(id, name, price)
            `)
            .gte("scheduled_at", weekStartStr)
            .lt("scheduled_at", weekEndStr)
            .neq("status", "cancelled")
            .order("scheduled_at")
            .then(({ data }) => {
              if (data) {
                setAppointments(data as unknown as Appointment[]);
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekStartStr, weekEndStr, supabase]);

  // Get barbershop slug for public link
  useEffect(() => {
    async function getBarbershopSlug() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: staff } = await supabase
        .from("staff")
        .select("barbershop_id")
        .eq("auth_user_id", user.id)
        .single();

      if (staff?.barbershop_id) {
        const { data: barbershop } = await supabase
          .from("barbershops")
          .select("slug")
          .eq("id", staff.barbershop_id)
          .single();

        if (barbershop?.slug) {
          setBarbershopSlug(barbershop.slug);
        }
      }
    }
    getBarbershopSlug();
  }, [supabase]);

  async function copyPublicLink() {
    if (!barbershopSlug) return;
    const url = `${window.location.origin}/agenda/${barbershopSlug}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function previousWeek() {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  }

  function nextWeek() {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function getAppointmentsForSlot(date: Date, hour: number): Appointment[] {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.scheduled_at);
      return (
        aptDate.getDate() === date.getDate() &&
        aptDate.getMonth() === date.getMonth() &&
        aptDate.getFullYear() === date.getFullYear() &&
        aptDate.getHours() === hour &&
        (selectedBarber ? apt.barber_id === selectedBarber : true)
      );
    });
  }

  function isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  function isPastSlot(date: Date, hour: number): boolean {
    const now = new Date();
    const slotDate = new Date(date);
    slotDate.setHours(hour, 0, 0, 0);
    return slotDate < now;
  }

  function isOutsideWorkingHours(date: Date, hour: number, barberId: string): boolean {
    const dayOfWeek = date.getDay();
    const schedule = schedules.find(
      (s) => s.barber_id === barberId && s.day_of_week === dayOfWeek
    );

    if (!schedule) return true;

    const startHour = parseInt(schedule.start_time.split(":")[0], 10);
    const endHour = parseInt(schedule.end_time.split(":")[0], 10);

    return hour < startHour || hour >= endHour;
  }

  function isBlockedSlot(date: Date, hour: number, barberId: string): BarberBlock | null {
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(date);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    return blocks.find((block) => {
      if (block.barber_id !== barberId) return false;
      const blockStart = new Date(block.start_at);
      const blockEnd = new Date(block.end_at);
      return slotStart < blockEnd && slotEnd > blockStart;
    }) || null;
  }

  function getSlotStatus(date: Date, hour: number, barberId: string): "available" | "past" | "blocked" | "outside" {
    if (isPastSlot(date, hour)) return "past";
    if (isBlockedSlot(date, hour, barberId)) return "blocked";
    if (isOutsideWorkingHours(date, hour, barberId)) return "outside";
    return "available";
  }

  function handleSlotClick(date: Date, hour: number) {
    if (!selectedBarber) return;
    const status = getSlotStatus(date, hour, selectedBarber);
    if (status !== "available") return;

    setPreSelectedSlot({ date, hour, barberId: selectedBarber });
    setIsNewModalOpen(true);
  }

  function handleAppointmentClick(appointment: Appointment, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedAppointment(appointment);
    setIsDetailsModalOpen(true);
  }

  function handleNewAppointment() {
    setPreSelectedSlot(null);
    setIsNewModalOpen(true);
  }

  function handleModalSuccess() {
    setRefreshKey((k) => k + 1);
  }

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-900/30 border-blue-700/50 hover:bg-blue-900/40",
    completed: "bg-emerald-900/30 border-emerald-700/50 hover:bg-emerald-900/40",
    no_show: "bg-amber-900/30 border-amber-700/50 hover:bg-amber-900/40",
    cancelled: "bg-red-900/30 border-red-700/50 hover:bg-red-900/40",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light">Agenda</h1>
          <p className="text-muted-foreground mt-1">
            {MONTHS_PT[weekStart.getMonth()]} {weekStart.getFullYear()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsWalkInModalOpen(true)}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Encaixe
          </button>

          <button
            onClick={handleNewAppointment}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agendar
          </button>

          <button
            onClick={() => setIsBlockModalOpen(true)}
            className="px-4 py-2 border border-red-900/50 text-red-400 rounded-lg text-sm font-medium hover:bg-red-900/20 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Bloquear
          </button>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2 border border-border text-muted-foreground rounded-lg hover:text-foreground hover:border-primary/50 transition-colors"
            title="Configurações da agenda"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <button
            onClick={copyPublicLink}
            className={`p-2 border rounded-lg transition-colors ${
              linkCopied
                ? "border-emerald-500 text-emerald-400"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
            }`}
            title={linkCopied ? "Link copiado!" : "Copiar link público da agenda"}
          >
            {linkCopied ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Hoje
            </button>
            <div className="flex items-center bg-card border border-border rounded-lg">
              <button
                onClick={previousWeek}
                className="p-2 hover:bg-muted transition-colors rounded-l-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="px-4 py-2 text-sm font-medium border-x border-border">
                {weekStart.getDate()} - {weekEnd.getDate()}
              </span>
              <button
                onClick={nextWeek}
                className="p-2 hover:bg-muted transition-colors rounded-r-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {barbers.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-sm text-muted-foreground shrink-0">Barbeiro:</span>
          <button
            onClick={() => setSelectedBarber(null)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors shrink-0 ${
              selectedBarber === null
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Geral
          </button>
          {barbers.map((barber) => (
            <button
              key={barber.id}
              onClick={() => setSelectedBarber(barber.id)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors shrink-0 ${
                selectedBarber === barber.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {barber.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loading />
        </div>
      ) : barbers.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">
            Nenhum barbeiro cadastrado.
          </p>
          <a
            href="/dashboard/barbeiros"
            className="inline-block mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            Cadastrar barbeiro
          </a>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div ref={agendaContainerRef} className="max-h-[680px] overflow-y-auto">
            <div className="grid border-b border-border sticky top-0 bg-card z-10" style={{ gridTemplateColumns: `70px repeat(${filteredWeekDays.length}, 1fr)` }}>
              <div className="p-3 text-sm text-muted-foreground" />
              {filteredWeekDays.map((day, i) => (
                <div
                  key={i}
                  className={`p-3 text-center border-l border-border ${
                    isToday(day) ? "bg-primary/10" : ""
                  }`}
                >
                  <p className="text-xs text-muted-foreground">{DAYS_PT[day.getDay()]}</p>
                  <p className={`text-lg font-light mt-1 ${
                    isToday(day) ? "text-primary" : ""
                  }`}>
                    {day.getDate()}
                  </p>
                </div>
              ))}
            </div>
            {HOURS.map((hour) => (
              <div key={hour} id={`hour-row-${hour}`} className="grid border-b border-border last:border-b-0" style={{ gridTemplateColumns: `70px repeat(${filteredWeekDays.length}, 1fr)` }}>
                <div className="p-3 text-sm text-muted-foreground text-right">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                {filteredWeekDays.map((day, i) => {
                  const slotAppointments = getAppointmentsForSlot(day, hour);
                  const slotStatus = selectedBarber ? getSlotStatus(day, hour, selectedBarber) : "available";
                  const block = selectedBarber ? isBlockedSlot(day, hour, selectedBarber) : null;
                  const canClick = slotStatus === "available" && selectedBarber;

                  const slotClasses = {
                    available: isToday(day) ? "bg-primary/5" : "",
                    past: "bg-muted/30 opacity-50",
                    blocked: "bg-red-900/20",
                    outside: "bg-zinc-900/50",
                  };

                  return (
                    <div
                      key={i}
                      onClick={() => canClick && slotAppointments.length === 0 && handleSlotClick(day, hour)}
                      className={`min-h-[80px] p-2 border-l border-border transition-colors overflow-hidden ${slotClasses[slotStatus]} ${
                        canClick && slotAppointments.length === 0
                          ? "cursor-pointer hover:bg-muted/50"
                          : ""
                      }`}
                    >
                      {block && slotAppointments.length === 0 && (
                        <div className="p-2 rounded border border-red-900/30 bg-red-900/10 text-xs text-red-400">
                          <p className="font-medium">Bloqueado</p>
                          {block.reason && <p className="truncate opacity-75">{block.reason}</p>}
                        </div>
                      )}
                      {slotAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          onClick={(e) => handleAppointmentClick(apt, e)}
                          className={`p-2 rounded border text-xs mb-1 cursor-pointer transition-colors overflow-hidden ${
                            statusColors[apt.status] || "bg-muted border-border hover:bg-muted/80"
                          }`}
                        >
                          <p className="font-medium truncate">
                            {apt.customer?.name || "Cliente"}
                          </p>
                          <p className="text-blue-400 truncate text-[10px] flex items-center gap-1">
                            <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                            </svg>
                            {apt.barber?.name?.split(" ")[0] || "Barbeiro"}
                          </p>
                          <p className="text-muted-foreground truncate">
                            {apt.service?.name || "Serviço"}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-900/30 border border-blue-700/50" />
            <span>Agendado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-900/30 border border-emerald-700/50" />
            <span>Concluído</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-900/30 border border-amber-700/50" />
            <span>Não compareceu</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-900/20 border border-red-900/30" />
            <span>Bloqueado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-zinc-900/50 border border-zinc-700/30" />
            <span>Fora do expediente</span>
          </div>
        </div>

        {/* Clock */}
        <div className="flex items-center gap-2 text-2xl font-light tracking-wider text-foreground tabular-nums">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      <NewAppointmentModal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          setPreSelectedSlot(null);
        }}
        onSuccess={handleModalSuccess}
        preSelectedDate={preSelectedSlot?.date}
        preSelectedHour={preSelectedSlot?.hour}
        preSelectedBarberId={preSelectedSlot?.barberId}
      />

      <AppointmentDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedAppointment(null);
        }}
        onUpdate={handleModalSuccess}
        appointment={selectedAppointment}
      />

      <BlockTimeModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        onSuccess={handleModalSuccess}
        barbers={barbers}
        preSelectedBarberId={selectedBarber || undefined}
      />

      <WalkInModal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        onSuccess={handleModalSuccess}
        barbers={barbers}
        preSelectedBarberId={selectedBarber || undefined}
      />

      <AgendaSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleModalSuccess}
      />
    </div>
  );
}
