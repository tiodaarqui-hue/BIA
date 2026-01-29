"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Message {
  id: string;
  type: "bot" | "user";
  text: string;
  options?: { label: string; value: string }[];
  multiSelect?: boolean;
  selectedValues?: string[];
  isVipGreeting?: boolean;
  memberName?: string;
  planName?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  is_member_only: boolean;
}

interface Barber {
  id: string;
  name: string;
}

interface ExistingAppointment {
  id: string;
  scheduled_at: string;
  service: { name: string } | null;
  barber: { name: string } | null;
}

type Step = "service" | "barber" | "date" | "time" | "confirm" | "done";

const DAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Unique message ID generator
let messageIdCounter = 0;
function generateMessageId(): string {
  messageIdCounter += 1;
  return `msg-${Date.now()}-${messageIdCounter}`;
}

// Normalize text: remove accents, lowercase, trim
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Common synonyms and variations in Portuguese
const SYNONYMS: Record<string, string[]> = {
  hoje: ["hj", "agora"],
  amanha: ["amnh", "manha"],
  sim: ["yes", "confirmar", "confirmo", "pode", "bora", "vamos", "quero", "isso", "ok", "certo"],
  nao: ["no", "cancelar", "cancela", "nope", "n"],
  sem: ["nenhum", "nenhuma", "qualquer", "tanto faz", "nao tenho"],
  preferencia: ["preferir", "prefiro"],
  corte: ["cabelo", "cortar", "cortando"],
  barba: ["barbear", "aparar", "fazer barba"],
  outro: ["outra", "outros", "mais", "diferente"],
  segunda: ["seg"],
  terca: ["ter"],
  quarta: ["qua"],
  quinta: ["qui"],
  sexta: ["sex"],
  sabado: ["sab"],
  domingo: ["dom"],
};

// Find best matching option based on user input
function findBestMatch(
  input: string,
  options: { label: string; value: string }[]
): { label: string; value: string } | null {
  const normalizedInput = normalizeText(input);
  const inputWords = normalizedInput.split(/\s+/).filter((w) => w.length > 1);

  let bestMatch: { label: string; value: string } | null = null;
  let bestScore = 0;

  for (const option of options) {
    const normalizedLabel = normalizeText(option.label);
    const labelWords = normalizedLabel.split(/\s+/).filter((w) => w.length > 1);

    let score = 0;

    // Exact match (highest priority)
    if (normalizedInput === normalizedLabel) {
      return option;
    }

    // Input contains full label or vice versa
    if (normalizedInput.includes(normalizedLabel) || normalizedLabel.includes(normalizedInput)) {
      score += 10;
    }

    // Check each input word against label words
    for (const inputWord of inputWords) {
      for (const labelWord of labelWords) {
        // Direct word match
        if (inputWord === labelWord) {
          score += 5;
          continue;
        }

        // Word starts with input (user typed partial)
        if (labelWord.startsWith(inputWord) && inputWord.length >= 3) {
          score += 4;
          continue;
        }

        // Input starts with word (user typed more)
        if (inputWord.startsWith(labelWord) && labelWord.length >= 3) {
          score += 3;
          continue;
        }

        // Shared root match (e.g., "cortar" and "corte" share "cort")
        const minLen = Math.min(inputWord.length, labelWord.length);
        if (minLen >= 4) {
          const root = inputWord.slice(0, 4);
          if (labelWord.startsWith(root)) {
            score += 4;
            continue;
          }
        }

        // Check synonyms
        for (const [key, synonyms] of Object.entries(SYNONYMS)) {
          const allVariants = [key, ...synonyms];
          const inputMatches = allVariants.some((v) => {
            if (inputWord === v) return true;
            if (inputWord.length >= 3 && v.startsWith(inputWord)) return true;
            if (v.length >= 3 && inputWord.startsWith(v)) return true;
            return false;
          });
          const labelMatches = allVariants.some((v) => {
            if (labelWord === v) return true;
            if (labelWord.length >= 3 && v.startsWith(labelWord)) return true;
            if (v.length >= 3 && labelWord.startsWith(v)) return true;
            return false;
          });
          if (inputMatches && labelMatches) {
            score += 4;
            break;
          }
        }
      }
    }

    // Special handling for confirmation options
    if (option.value === "yes" || option.value === "no") {
      const confirmWords = ["sim", "yes", "confirmar", "confirmo", "pode", "ok", "bora", "vamos"];
      const cancelWords = ["nao", "no", "cancelar", "cancela", "n"];

      if (option.value === "yes" && confirmWords.some((w) => normalizedInput.includes(w))) {
        score += 10;
      }
      if (option.value === "no" && cancelWords.some((w) => normalizedInput.includes(w))) {
        score += 10;
      }
    }

    // Special handling for "sem preferencia"
    if (option.value === "none") {
      const noPreferenceWords = ["sem", "nenhum", "qualquer", "tanto", "faz", "primeiro"];
      if (noPreferenceWords.some((w) => normalizedInput.includes(w))) {
        score += 8;
      }
    }

    // Special handling for date options
    if (option.value === "today" && normalizedInput.includes("hoj")) {
      score += 10;
    }
    if (option.value === "tomorrow" && (normalizedInput.includes("amanh") || normalizedInput.includes("manha"))) {
      score += 10;
    }
    if (option.value === "other" && (normalizedInput.includes("outr") || normalizedInput.includes("mais"))) {
      score += 8;
    }

    // Special handling for time options (format: "HH:MM")
    const timeMatch = option.value.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const optionHour = parseInt(timeMatch[1]);
      // Extract numbers from input like "as 8", "17 horas", "8h", "oito"
      const inputNumbers = normalizedInput.match(/\d+/g);
      if (inputNumbers) {
        for (const num of inputNumbers) {
          const inputHour = parseInt(num);
          if (inputHour === optionHour) {
            score += 10;
            break;
          }
        }
      }
      // Also check for written numbers
      const writtenHours: Record<string, number> = {
        oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
        treze: 13, catorze: 14, quatorze: 14, quinze: 15,
        dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20,
      };
      for (const [word, hour] of Object.entries(writtenHours)) {
        if (normalizedInput.includes(word) && hour === optionHour) {
          score += 10;
          break;
        }
      }
    }

    // Update best match if this score is higher
    if (score > bestScore) {
      bestScore = score;
      bestMatch = option;
    }
  }

  // Only return match if score is significant enough
  return bestScore >= 3 ? bestMatch : null;
}

export function BookingChat({
  customer,
  barbershopId,
  barbershopName,
  onShowAppointments,
}: {
  customer: Customer;
  barbershopId: string;
  barbershopName: string;
  onShowAppointments: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<Step>("service");
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);

  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [slots, setSlots] = useState<string[]>([]);

  // Multi-service selection
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [pendingServiceIds, setPendingServiceIds] = useState<Set<string>>(new Set());

  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [consecutiveMessages, setConsecutiveMessages] = useState(0);
  const [sessionTimeout, setSessionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isCustomerMember, setIsCustomerMember] = useState(false);
  const [coveredServiceIds, setCoveredServiceIds] = useState<string[]>([]);
  const [memberPlanName, setMemberPlanName] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Scroll to bottom on new messages (no auto-focus to avoid keyboard popup on mobile)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Helper to check if service is covered by plan
  function isServiceCovered(serviceId: string): boolean {
    return coveredServiceIds.includes(serviceId);
  }

  // Calculate totals from selected services
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  // Price to charge (excluding covered services)
  const chargeablePrice = selectedServices
    .filter((s) => !isServiceCovered(s.id))
    .reduce((sum, s) => sum + Number(s.price), 0);
  const coveredAmount = totalPrice - chargeablePrice;

  // Load initial data and check for existing appointments
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      // Load services, barbers, customer membership, and check for existing appointments in parallel
      const [servicesRes, barbersRes, appointmentsRes, customerRes] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, price, duration_minutes, is_member_only")
          .eq("barbershop_id", barbershopId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("barbers")
          .select("id, name")
          .eq("barbershop_id", barbershopId)
          .eq("is_active", true)
          .order("name"),
        // Check for future appointments
        supabase
          .from("appointments")
          .select("id, scheduled_at, service:services(name), barber:barbers(name)")
          .eq("customer_id", customer.id)
          .eq("barbershop_id", barbershopId)
          .eq("status", "scheduled")
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(1),
        // Check customer membership status and plan
        supabase
          .from("customers")
          .select("is_member, member_expires_at, member_plan_id")
          .eq("id", customer.id)
          .single(),
      ]);

      if (!mounted) return;

      // Check if customer has active membership
      const customerData = customerRes.data;
      const isMember = customerData?.is_member &&
        (!customerData.member_expires_at || new Date(customerData.member_expires_at) > new Date());
      setIsCustomerMember(isMember);

      // If member, fetch included services and plan name
      if (isMember && customerData?.member_plan_id) {
        const { data: planData } = await supabase
          .from("member_plans")
          .select("name, included_service_ids")
          .eq("id", customerData.member_plan_id)
          .single();
        setCoveredServiceIds(planData?.included_service_ids || []);
        setMemberPlanName(planData?.name || null);
      } else {
        setCoveredServiceIds([]);
        setMemberPlanName(null);
      }

      // Filter services: hide member-only services from non-members
      const allServices = servicesRes.data || [];
      const availableServices = isMember
        ? allServices
        : allServices.filter((s) => !s.is_member_only);

      setServices(availableServices);
      setBarbers(barbersRes.data || []);

      // Check if customer has existing appointment
      const existingAppointment = appointmentsRes.data?.[0] as ExistingAppointment | undefined;

      if (existingAppointment) {
        // Show existing appointment and ask if they want to schedule another
        const aptDate = new Date(existingAppointment.scheduled_at);
        setStep("done");

        // VIP greeting for members
        const greeting = isMember
          ? `👑 Olá ${customer.name.split(" ")[0]}! Você já tem um agendamento:\n\n`
          : `Olá ${customer.name.split(" ")[0]}! Você já tem um agendamento:\n\n`;

        setMessages([{
          id: generateMessageId(),
          type: "bot",
          text: greeting +
            `📋 ${existingAppointment.service?.name}\n` +
            `✂️ ${existingAppointment.barber?.name}\n` +
            `📅 ${aptDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${aptDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}\n\n` +
            `Deseja agendar outro horário?`,
          options: [
            { label: "📅 Novo agendamento", value: "new_booking" },
            { label: "📋 Ver meus agendamentos", value: "view_appointments" },
          ],
        }]);
      } else {
        // Get covered service IDs and plan name for label generation
        let covered: string[] = [];
        let planName: string | null = null;
        if (isMember && customerData?.member_plan_id) {
          const planRes = await supabase
            .from("member_plans")
            .select("name, included_service_ids")
            .eq("id", customerData.member_plan_id)
            .single();
          covered = planRes.data?.included_service_ids || [];
          planName = planRes.data?.name || null;
        }

        // Build greeting text (VIP styling will be applied in render)
        let greetingText: string;
        const coveredServiceNames = availableServices
          .filter((s) => covered.includes(s.id))
          .map((s) => s.name);

        if (isMember && planName && coveredServiceNames.length > 0) {
          greetingText = `Seus serviços inclusos:\n${coveredServiceNames.map((n) => `✅ ${n}`).join("\n")}\n\nEscolha os serviços que deseja:`;
        } else if (isMember && planName) {
          greetingText = `Escolha os serviços que deseja:`;
        } else {
          greetingText = `Olá ${customer.name.split(" ")[0]}! Quais serviços você quer? (pode escolher mais de um)`;
        }

        // No existing appointment, start normal flow with multi-select
        setMessages((prev) => {
          if (prev.length > 0) return prev;
          return [{
            id: generateMessageId(),
            type: "bot",
            text: greetingText,
            options: availableServices.map((s) => {
              const isCovered = covered.includes(s.id);
              if (isCovered) {
                return { label: `✅ ${s.name} - Coberto`, value: s.id };
              } else if (s.is_member_only) {
                return { label: `⭐ ${s.name} - R$${s.price}`, value: s.id };
              }
              return { label: `${s.name} - R$${s.price}`, value: s.id };
            }),
            multiSelect: true,
            selectedValues: [],
            isVipGreeting: isMember && !!planName,
            memberName: customer.name.split(" ")[0],
            planName: planName || undefined,
          }];
        });
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [barbershopId, customer.id, customer.name, supabase]);

  function addBotMessage(text: string, options?: { label: string; value: string }[], multiSelect?: boolean) {
    setMessages((prev) => [
      ...prev,
      { id: generateMessageId(), type: "bot", text, options, multiSelect, selectedValues: multiSelect ? [] : undefined },
    ]);
  }

  function addUserMessage(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: generateMessageId(), type: "user", text },
    ]);
  }

  // Toggle service selection in multi-select mode
  function handleServiceToggle(serviceId: string) {
    setPendingServiceIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });

    // Update message's selectedValues for visual feedback
    setMessages((prev) => prev.map((msg, idx) => {
      if (idx === prev.length - 1 && msg.multiSelect) {
        const newSelectedValues = msg.selectedValues || [];
        const hasValue = newSelectedValues.includes(serviceId);
        return {
          ...msg,
          selectedValues: hasValue
            ? newSelectedValues.filter((v) => v !== serviceId)
            : [...newSelectedValues, serviceId],
        };
      }
      return msg;
    }));
  }

  // Confirm multi-service selection
  function handleConfirmServices() {
    if (pendingServiceIds.size === 0) return;

    const selected = services.filter((s) => pendingServiceIds.has(s.id));
    setSelectedServices(selected);
    setPendingServiceIds(new Set());

    const serviceNames = selected.map((s) => s.name).join(", ");
    const chargeable = selected
      .filter((s) => !isServiceCovered(s.id))
      .reduce((sum, s) => sum + Number(s.price), 0);
    const covered = selected
      .filter((s) => isServiceCovered(s.id))
      .reduce((sum, s) => sum + Number(s.price), 0);

    let priceInfo: string;
    if (covered > 0 && chargeable > 0) {
      priceInfo = `R$${chargeable.toFixed(2).replace(".", ",")} (+R$${covered.toFixed(2).replace(".", ",")} coberto)`;
    } else if (chargeable === 0) {
      priceInfo = "Coberto pelo plano";
    } else {
      priceInfo = `R$${chargeable.toFixed(2).replace(".", ",")}`;
    }

    addUserMessage(`${serviceNames} (${priceInfo})`);

    setStep("barber");
    setLoading(true);

    setTimeout(() => {
      addBotMessage(
        "Legal! Tem preferência pelo Barbeiro?",
        [
          { label: "Sem preferência", value: "none" },
          ...barbers.map((b) => ({ label: b.name, value: b.id })),
        ]
      );
      setLoading(false);
    }, 500);
  }

  async function handleOptionClick(value: string, label: string) {
    // Clear any existing timeout
    if (sessionTimeout) clearTimeout(sessionTimeout);

    addUserMessage(label);
    setConsecutiveMessages(0);
    setLoading(true);

    switch (step) {
      case "service":
        // Single service selection (fallback for old flow)
        const service = services.find((s) => s.id === value);
        if (service) {
          setSelectedServices([service]);
          setStep("barber");
          setTimeout(() => {
            addBotMessage(
              "Legal! Tem preferência pelo Barbeiro?",
              [
                { label: "Sem preferência", value: "none" },
                ...barbers.map((b) => ({ label: b.name, value: b.id })),
              ]
            );
            setLoading(false);
          }, 500);
        }
        break;

      case "barber":
        if (value === "none") {
          setSelectedBarber(null);
        } else {
          const barber = barbers.find((b) => b.id === value);
          setSelectedBarber(barber || null);
        }
        setStep("date");
        setTimeout(() => {
          const dateOptions = getDateOptions();
          addBotMessage("Que dia você quer agendar?", dateOptions);
          setLoading(false);
        }, 500);
        break;

      case "date":
        let targetDate: Date;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (value === "today") {
          targetDate = today;
        } else if (value === "tomorrow") {
          targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() + 1);
        } else if (value === "day_after") {
          targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() + 2);
        } else if (value === "other") {
          // Show next 7 days
          const otherOptions = [];
          for (let i = 3; i <= 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            otherOptions.push({
              label: `${DAYS_PT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`,
              value: d.toISOString().split("T")[0],
            });
          }
          addBotMessage("Escolha o dia:", otherOptions);
          setLoading(false);
          return;
        } else {
          // Specific date selected
          targetDate = new Date(value + "T00:00:00");
        }

        setSelectedDate(targetDate);
        setStep("time");

        // Fetch available slots with total duration
        const dateStr = targetDate.toISOString().split("T")[0];
        const params = new URLSearchParams({
          barbershopId,
          date: dateStr,
          duration: totalDuration.toString(),
        });
        if (selectedBarber) {
          params.set("barberId", selectedBarber.id);
        }

        const slotsRes = await fetch(`/api/customer/slots?${params}`);
        const slotsData = await slotsRes.json();

        if (slotsData.slots && slotsData.slots.length > 0) {
          setSlots(slotsData.slots);
          // Show first 8 slots
          const timeOptions = slotsData.slots.slice(0, 8).map((s: string) => ({
            label: s,
            value: s,
          }));
          if (slotsData.slots.length > 8) {
            timeOptions.push({ label: "Ver mais horários...", value: "more" });
          }
          addBotMessage("Qual horário?", timeOptions);
        } else {
          addBotMessage("Não há horários disponíveis neste dia. Escolha outro dia:", getDateOptions());
          setStep("date");
        }
        setLoading(false);
        break;

      case "time":
        if (value === "more") {
          // Show all remaining slots
          const moreOptions = slots.slice(8).map((s) => ({ label: s, value: s }));
          addBotMessage("Mais horários:", moreOptions);
          setLoading(false);
          return;
        }

        setSelectedTime(value);
        setStep("confirm");

        const dateFormatted = selectedDate?.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
        });

        // Build services list for confirmation (showing covered status)
        const servicesText = selectedServices.map((s) => {
          const covered = isServiceCovered(s.id);
          return covered ? `📋 ${s.name} ✅ Coberto` : `📋 ${s.name}`;
        }).join("\n");

        // Build price text
        let priceText: string;
        if (coveredAmount > 0 && chargeablePrice > 0) {
          priceText = `💰 A pagar: R$ ${chargeablePrice.toFixed(2).replace(".", ",")}\n✅ Coberto pelo plano: R$ ${coveredAmount.toFixed(2).replace(".", ",")}`;
        } else if (chargeablePrice === 0) {
          priceText = `✅ Totalmente coberto pelo plano!`;
        } else {
          priceText = `💰 Total: R$ ${chargeablePrice.toFixed(2).replace(".", ",")}`;
        }

        setTimeout(() => {
          addBotMessage(
            `Confirma agendamento?\n\n` +
            `${servicesText}\n` +
            `✂️ ${selectedBarber?.name || "Primeiro disponível"}\n` +
            `📅 ${dateFormatted}\n` +
            `🕐 ${value}\n` +
            `${priceText}`,
            [
              { label: "✅ Confirmar", value: "yes" },
              { label: "❌ Cancelar", value: "no" },
            ]
          );
          setLoading(false);
        }, 500);
        break;

      case "confirm":
        if (value === "yes") {
          // Create appointment
          const scheduledAt = new Date(selectedDate!);
          const [hours, minutes] = selectedTime!.split(":");
          scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

          const bookRes = await fetch("/api/customer/book", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerId: customer.id,
              barberId: selectedBarber?.id || null,
              serviceIds: selectedServices.map((s) => s.id),
              scheduledAt: scheduledAt.toISOString(),
              barbershopId,
            }),
          });

          const bookData = await bookRes.json();

          if (bookData.success) {
            const aptDate = new Date(bookData.appointment.scheduled_at);
            setStep("done");
            // Clear chat and show only confirmation
            setMessages([{
              id: generateMessageId(),
              type: "bot",
              text: `🎉 Agendamento Confirmado!\n\n` +
                `📅 ${aptDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${aptDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}\n\n` +
                `Aguardamos você!`,
            }]);
            setConsecutiveMessages(0);

            // Auto-close after 5 minutes
            const timeout = setTimeout(() => {
              resetConversation();
            }, 5 * 60 * 1000);
            setSessionTimeout(timeout);
          } else {
            addBotMessage(`❌ ${bookData.error || "Erro ao agendar. Tente novamente."}`);
            setStep("date");
            setTimeout(() => {
              addBotMessage("Que dia você quer agendar?", getDateOptions());
            }, 1000);
          }
        } else {
          // User cancelled
          resetConversation();
        }
        setLoading(false);
        break;

      case "done":
        if (value === "new_booking") {
          resetConversation();
        } else if (value === "view_appointments") {
          onShowAppointments();
        }
        setLoading(false);
        break;
    }
  }

  function handleInputSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const text = inputValue.trim().toLowerCase();
    setInputValue("");

    // Handle messages after booking is done
    if (step === "done") {
      addUserMessage(inputValue.trim());
      const newCount = consecutiveMessages + 1;
      setConsecutiveMessages(newCount);

      // First message: don't respond (especially for thanks)
      if (newCount === 1) {
        return;
      }

      // After 2+ messages: show options
      setTimeout(() => {
        addBotMessage(
          "Deseja agendar outro horário?",
          [
            { label: "📅 Novo agendamento", value: "new_booking" },
            { label: "📋 Ver meus agendamentos", value: "view_appointments" },
          ]
        );
      }, 500);
      return;
    }

    // Count consecutive user messages
    const newCount = consecutiveMessages + 1;
    setConsecutiveMessages(newCount);

    // After 3 consecutive messages, restart conversation
    if (newCount >= 3) {
      addUserMessage(inputValue.trim());
      resetConversation();
      return;
    }

    // Try to match input to current options using smart matching
    const currentMessage = messages.filter((m) => m.type === "bot").pop();
    if (currentMessage?.options && !currentMessage.multiSelect) {
      const match = findBestMatch(text, currentMessage.options);
      if (match) {
        handleOptionClick(match.value, match.label);
        return;
      }
    }

    // No match - show current options again
    addUserMessage(inputValue.trim());
    if (currentMessage?.options) {
      setTimeout(() => {
        addBotMessage("Não entendi. Escolha uma opção:", currentMessage.options);
      }, 500);
    }
  }

  function getDateOptions() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    return [
      { label: `Hoje (${DAYS_PT[today.getDay()]})`, value: "today" },
      { label: `Amanhã (${DAYS_PT[tomorrow.getDay()]})`, value: "tomorrow" },
      { label: `${DAYS_PT[dayAfter.getDay()]} ${dayAfter.getDate()}/${dayAfter.getMonth() + 1}`, value: "day_after" },
      { label: "Outro dia", value: "other" },
    ];
  }

  function resetConversation() {
    if (sessionTimeout) clearTimeout(sessionTimeout);
    setMessages([]);
    setStep("service");
    setSelectedServices([]);
    setPendingServiceIds(new Set());
    setSelectedBarber(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setConsecutiveMessages(0);

    // Build greeting text (VIP styling will be applied in render)
    let greetingText: string;
    const coveredServiceNames = services
      .filter((s) => coveredServiceIds.includes(s.id))
      .map((s) => s.name);

    if (isCustomerMember && memberPlanName && coveredServiceNames.length > 0) {
      greetingText = `Seus serviços inclusos:\n${coveredServiceNames.map((n) => `✅ ${n}`).join("\n")}\n\nEscolha os serviços que deseja:`;
    } else if (isCustomerMember && memberPlanName) {
      greetingText = `Escolha os serviços que deseja:`;
    } else {
      greetingText = `Olá ${customer.name.split(" ")[0]}! Quais serviços você quer? (pode escolher mais de um)`;
    }

    setTimeout(() => {
      setMessages([{
        id: generateMessageId(),
        type: "bot",
        text: greetingText,
        options: services.map((s) => {
          const isCovered = coveredServiceIds.includes(s.id);
          if (isCovered) {
            return { label: `✅ ${s.name} - Coberto`, value: s.id };
          } else if (s.is_member_only) {
            return { label: `⭐ ${s.name} - R$${s.price}`, value: s.id };
          }
          return { label: `${s.name} - R$${s.price}`, value: s.id };
        }),
        multiSelect: true,
        selectedValues: [],
        isVipGreeting: isCustomerMember && !!memberPlanName,
        memberName: customer.name.split(" ")[0],
        planName: memberPlanName || undefined,
      }]);
    }, 500);
  }

  // Calculate pending selection totals for display
  const pendingServices = services.filter((s) => pendingServiceIds.has(s.id));
  const pendingTotal = pendingServices.reduce((sum, s) => sum + Number(s.price), 0);
  const pendingChargeable = pendingServices
    .filter((s) => !isServiceCovered(s.id))
    .reduce((sum, s) => sum + Number(s.price), 0);
  const pendingCovered = pendingTotal - pendingChargeable;
  const pendingDuration = pendingServices.reduce((sum, s) => sum + s.duration_minutes, 0);

  return (
    <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto">
      {/* Messages - optimized for mobile */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 sm:px-4 sm:space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 ${
                msg.type === "user"
                  ? isCustomerMember
                    ? "bg-gradient-to-r from-amber-900/40 to-yellow-900/40 border border-amber-600/30 rounded-br-md"
                    : "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border border-border rounded-bl-md"
              }`}
            >
              {/* VIP greeting header for members */}
              {msg.type === "bot" && msg.isVipGreeting && msg.memberName && msg.planName && (
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-600/30">
                  <svg className="w-5 h-5 member-shimmer drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 3h14v2H5v-2z"/>
                  </svg>
                  <span className="text-[15px] sm:text-base">
                    Olá <span className="member-shimmer font-semibold">{msg.memberName}</span>! Você é membro <span className="member-shimmer font-semibold">{msg.planName}</span>.
                  </span>
                </div>
              )}
              {/* Member VIP name with crown for user messages */}
              {msg.type === "user" && isCustomerMember && (
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className="w-4 h-4 member-shimmer drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 3h14v2H5v-2z"/>
                  </svg>
                  <span className="member-shimmer text-sm font-medium">
                    {customer.name.split(" ")[0]}
                  </span>
                </div>
              )}
              <p className={`whitespace-pre-line text-[15px] sm:text-base leading-relaxed ${
                msg.type === "user" && isCustomerMember ? "text-amber-100" : ""
              }`}>{msg.text}</p>

              {msg.options && msg.multiSelect ? (
                // Multi-select mode for services
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {msg.options.map((opt, index) => {
                      const isSelected = pendingServiceIds.has(opt.value);
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleServiceToggle(opt.value)}
                          disabled={loading}
                          className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all touch-manipulation shadow-sm animate-fade-in ${
                            isSelected
                              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-card"
                              : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                          }`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          {isSelected && "✓ "}{opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selection summary and confirm button */}
                  {pendingServiceIds.size > 0 && (
                    <div className="pt-3 border-t border-border mt-3 space-y-2">
                      <div className="text-sm text-muted-foreground">
                        {pendingServiceIds.size} serviço{pendingServiceIds.size > 1 ? "s" : ""} •
                        {pendingCovered > 0 ? (
                          <>
                            R$ {pendingChargeable.toFixed(2).replace(".", ",")}
                            <span className="text-green-400 ml-1">(+R$ {pendingCovered.toFixed(2).replace(".", ",")} coberto)</span>
                          </>
                        ) : (
                          <>R$ {pendingTotal.toFixed(2).replace(".", ",")}</>
                        )} •
                        {pendingDuration} min
                      </div>
                      <button
                        onClick={handleConfirmServices}
                        disabled={loading}
                        className="w-full px-4 py-3 bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded-full text-sm font-medium transition-all disabled:opacity-50 touch-manipulation shadow-md"
                      >
                        Continuar com {pendingServiceIds.size === 1 ? "este serviço" : "estes serviços"}
                      </button>
                    </div>
                  )}
                </div>
              ) : msg.options ? (
                // Single-select mode (barber, date, time, etc.)
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.options.map((opt, index) => (
                    <button
                      key={opt.value}
                      onClick={() => handleOptionClick(opt.value, opt.label)}
                      disabled={loading}
                      className="px-4 py-2.5 bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded-full text-sm font-medium transition-all disabled:opacity-50 touch-manipulation shadow-sm hover:shadow-md animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input - optimized for mobile */}
      <form onSubmit={handleInputSubmit} className="p-3 sm:p-4 border-t border-border bg-background/80 backdrop-blur-sm sticky bottom-0">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 px-4 py-3 bg-card border border-border rounded-full text-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 touch-manipulation"
            disabled={loading}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
          />
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="p-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 touch-manipulation flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
