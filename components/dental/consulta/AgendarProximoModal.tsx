// ============================================================
// AgendarProximoModal — Calendario de slots para proximo agend.
//
// PR34 (2026-04-28): backdrop centrado + sheet com maxWidth.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { DentalColors } from "@/constants/dental-tokens";
import { localDayKey, toDateOnlyString, todayLocalString } from "@/utils/dateOnly";
import {
  type ClinicHours,
  findDayHours,
  jsDayToWeekday,
  timeToMinutes,
} from "@/utils/clinicHours";
import { useClinicHours } from "@/hooks/useClinicHours";

interface BusyAppt {
  id: string;
  scheduled_at: string;
  duration_min: number;
  status: string;
  practitioner_id?: string | null;
}

interface Props {
  open: boolean;
  patientId: string | null;
  patientName?: string;
  practitionerId?: string | null;
  defaultDurationMin?: number;
  defaultComplaint?: string;
  onClose: () => void;
  onScheduled?: (appointmentId: string) => void;
}

const DAYS_AHEAD = 14;

interface DaySlots {
  iso: string;
  label: string;
  weekday: number;
  free: string[];
  used: number;
}

interface BookingConfigLite {
  start_hour: number;
  end_hour: number;
  slot_duration_min: number;
  available_days: number[];
}

export type ClinicHoursLite = { configured: boolean; hours: ClinicHours; defaultIntervalMin?: number | null };

// Exportado para teste. `durationMin` e a duracao escolhida no modal: um
// horario so e livre se a consulta INTEIRA cabe sem sobrepor outra (antes
// usava o tamanho do slot e oferecia 09:00 para 60min com algo as 09:30).
//
// `clinic`: horário da clínica (GET /hours, item 4). Quando configurado,
// os turnos por dia + intervalo padrão substituem `cfg` (config do
// agendamento online) inteiramente. Sem horário salvo (`clinic` ausente ou
// `configured: false`), cai no comportamento atual (baseado em `cfg`).
export function buildDays(
  now: Date,
  busy: BusyAppt[],
  practitionerId?: string | null,
  cfg?: BookingConfigLite,
  durationMin?: number,
  clinic?: ClinicHoursLite | null,
): DaySlots[] {
  const useClinic = !!clinic?.configured;
  const startH = cfg?.start_hour ?? 8;
  const endH = cfg?.end_hour ?? 18;
  const fallbackSlotMin = cfg?.slot_duration_min || 30;
  const slotMin = useClinic ? (clinic?.defaultIntervalMin || 30) : fallbackSlotMin;
  const apptMs = (durationMin && durationMin > 0 ? durationMin : slotMin) * 60 * 1000;
  const apptMin = apptMs / 60000;
  const allowedDays = new Set(cfg?.available_days || [1, 2, 3, 4, 5, 6]);

  const out: DaySlots[] = [];
  const busyByDay: Record<string, Array<{ start: number; end: number }>> = {};
  for (const a of busy) {
    if (a.status === "cancelado") continue;
    if (practitionerId && a.practitioner_id && a.practitioner_id !== practitionerId) continue;
    const d = new Date(a.scheduled_at);
    // dia LOCAL: consulta as 21h+ em SP e dia seguinte em UTC
    const key = localDayKey(d);
    const start = d.getTime();
    const end = start + (a.duration_min || slotMin) * 60 * 1000;
    (busyByDay[key] = busyByDay[key] || []).push({ start, end });
  }

  for (let i = 1; i <= DAYS_AHEAD; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dayHours = useClinic ? findDayHours(clinic!.hours, jsDayToWeekday(d.getDay())) : null;
    if (useClinic) {
      if (!dayHours || !dayHours.open) continue;
    } else if (!allowedDays.has(d.getDay())) {
      continue;
    }
    const key = toDateOnlyString(d);
    const free: string[] = [];
    const dayBusy = busyByDay[key] || [];

    const candidateMins: number[] = [];
    if (useClinic && dayHours) {
      for (const shift of dayHours.shifts) {
        const a = timeToMinutes(shift.start);
        const b = timeToMinutes(shift.end);
        for (let t = a; t + apptMin <= b; t += slotMin) candidateMins.push(t);
      }
    } else {
      for (let h = startH; h < endH; h++) {
        for (let m = 0; m < 60; m += slotMin) candidateMins.push(h * 60 + m);
      }
    }

    for (const totalMin of candidateMins) {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      const slot = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
      const ts = slot.getTime();
      const conflict = dayBusy.some((b) => ts < b.end && ts + apptMs > b.start);
      if (!conflict) free.push(slot.toISOString());
    }
    const wkLabel = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
    out.push({
      iso: key,
      label: `${wkLabel}, ${String(d.getDate()).padStart(2, "0")}/${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}`,
      weekday: d.getDay(),
      free,
      used: dayBusy.length,
    });
  }
  return out;
}

export function AgendarProximoModal({
  open, patientId, patientName, practitionerId,
  defaultDurationMin = 60, defaultComplaint, onClose, onScheduled,
}: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const [duration, setDuration] = useState(String(defaultDurationMin));
  const [complaint, setComplaint] = useState(defaultComplaint || "");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const startISO = new Date().toISOString();
  const endISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + DAYS_AHEAD + 1);
    return d.toISOString();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["dental-agenda-window", cid, todayLocalString(), DAYS_AHEAD],
    queryFn: () =>
      request<{ appointments: BusyAppt[] }>(
        `/companies/${cid}/dental/agenda?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`,
      ),
    enabled: !!cid && open,
    staleTime: 30000,
  });

  // Item 4: horário da clínica (GET /hours) manda quando estiver salvo.
  // Sem horário salvo, cai no comportamento atual (config do agendamento
  // online, buscada abaixo só como fallback).
  const clinicHours = useClinicHours();

  const { data: cfgData } = useQuery({
    queryKey: ["dental-booking-config", cid],
    queryFn: () => request<{ config: BookingConfigLite }>(`/companies/${cid}/dental/booking/config`),
    enabled: !!cid && open && !clinicHours.configured,
    staleTime: 60000,
  });
  const bookingCfg: BookingConfigLite | undefined = (cfgData as any)?.config;

  const durationMin = Number(duration) || 0;
  const clinicLite: ClinicHoursLite = useMemo(
    () => ({ configured: clinicHours.configured, hours: clinicHours.hours, defaultIntervalMin: clinicHours.defaultIntervalMin }),
    [clinicHours.configured, clinicHours.hours, clinicHours.defaultIntervalMin]
  );
  const days = useMemo(
    () => buildDays(new Date(), data?.appointments || [], practitionerId, bookingCfg, durationMin, clinicLite),
    [data, practitionerId, bookingCfg, durationMin, clinicLite]
  );

  // Aumentou a duracao e o horario escolhido deixou de caber: desmarca.
  useEffect(() => {
    if (selectedSlot && !days.some((d) => d.free.includes(selectedSlot))) setSelectedSlot(null);
  }, [days, selectedSlot]);

  const confirmMut = useMutation({
    mutationFn: () => {
      if (!selectedSlot) throw new Error("Escolha um horário");
      return request<{ appointment: { id: string } }>(`/companies/${cid}/dental/appointments`, {
        method: "POST",
        body: {
          customer_id: patientId,
          scheduled_at: selectedSlot,
          duration_min: Number(duration) || 60,
          chief_complaint: complaint || null,
          practitioner_id: practitionerId || null,
        },
      });
    },
    onSuccess: (res: any) => {
      toast.success("Agendamento confirmado");
      qc.invalidateQueries({ queryKey: ["dental-agenda-window"] });
      qc.invalidateQueries({ queryKey: ["dental-hoje-appointments"] });
      onScheduled?.(res?.appointment?.id);
      reset();
      onClose();
    },
    onError: (e: any) => toast.error(e?.data?.error || "Erro ao agendar"),
  });

  function reset() {
    setSelectedSlot(null);
    setComplaint(defaultComplaint || "");
    setDuration(String(defaultDurationMin));
  }
  function close() { reset(); onClose(); }

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <View style={{
          backgroundColor: DentalColors.bg2,
          borderRadius: 16, borderWidth: 1, borderColor: DentalColors.border,
          maxHeight: "90%", padding: 18,
          width: "100%", maxWidth: 600,
        }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: DentalColors.ink, marginBottom: 4 }}>
            📅 Agendar próxima consulta
          </Text>
          <Text style={{ fontSize: 11, color: DentalColors.ink3, marginBottom: 14 }}>
            {clinicHours.configured
              ? `Selecione dia e horário livre, dentro do horário de funcionamento da clínica. Slots de ${clinicHours.defaultIntervalMin || 30}min.`
              : `Selecione dia e horário livre. Janela ${bookingCfg?.start_hour ?? 8}h-${bookingCfg?.end_hour ?? 18}h, slots de ${bookingCfg?.slot_duration_min || 30}min.`}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, color: DentalColors.ink3, marginBottom: 4, fontWeight: "700", letterSpacing: 1 }}>DURAÇÃO (MIN)</Text>
              <TextInput
                value={duration} onChangeText={setDuration}
                keyboardType="numeric" placeholder="60"
                placeholderTextColor={DentalColors.ink3}
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={{ fontSize: 9, color: DentalColors.ink3, marginBottom: 4, fontWeight: "700", letterSpacing: 1 }}>QUEIXA / PROCEDIMENTO</Text>
              <TextInput
                value={complaint} onChangeText={setComplaint}
                placeholder="Ex: Restauração 13 mesial"
                placeholderTextColor={DentalColors.ink3}
                style={inputStyle}
              />
            </View>
          </View>

          {isLoading ? (
            <ActivityIndicator color={DentalColors.cyan} style={{ padding: 20 }} />
          ) : (
            <ScrollView style={{ maxHeight: 340 }}>
              {days.map((d) => (
                <View key={d.iso} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <Text style={{ fontSize: 11, color: DentalColors.ink, fontWeight: "700" }}>{d.label}</Text>
                    <Text style={{ fontSize: 9, color: DentalColors.ink3 }}>· {d.free.length} slots livres · {d.used} ocupado(s)</Text>
                  </View>
                  {d.free.length === 0 ? (
                    <Text style={{ fontSize: 10, color: DentalColors.ink3, fontStyle: "italic" }}>Sem horários livres</Text>
                  ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                      {d.free.map((iso) => {
                        const t = new Date(iso);
                        const label = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
                        const active = selectedSlot === iso;
                        return (
                          <Pressable
                            key={iso}
                            onPress={() => setSelectedSlot(iso)}
                            style={{
                              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
                              backgroundColor: active ? DentalColors.cyan : DentalColors.surface,
                              borderWidth: 1, borderColor: active ? DentalColors.cyan : DentalColors.border,
                            }}>
                            <Text style={{ fontSize: 10, color: active ? "#fff" : DentalColors.ink2, fontWeight: "700" }}>
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <Text style={{ fontSize: 11, color: DentalColors.ink3 }} numberOfLines={1}>
              {selectedSlot
                ? new Date(selectedSlot).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                : "Nenhum slot selecionado"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={close} style={btnGhostStyle}>
                <Text style={{ color: DentalColors.ink2, fontSize: 11, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmMut.mutate()}
                disabled={!selectedSlot || !patientId || confirmMut.isPending}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
                  backgroundColor: DentalColors.cyan,
                  opacity: !selectedSlot || !patientId ? 0.5 : 1,
                }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                  {confirmMut.isPending ? "Agendando..." : "Confirmar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const inputStyle = {
  backgroundColor: DentalColors.surface, borderRadius: 6,
  borderWidth: 1, borderColor: DentalColors.border,
  padding: 8, fontSize: 11, color: DentalColors.ink,
};
const btnGhostStyle = {
  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  backgroundColor: "transparent",
  borderWidth: 1, borderColor: DentalColors.border,
};
