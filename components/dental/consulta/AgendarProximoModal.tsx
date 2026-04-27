// ============================================================
// AgendarProximoModal — Calendario de slots para proximo agend.
//
// Le agenda dos proximos 14 dias via:
//   GET /companies/:cid/dental/agenda?start=ISO&end=ISO
//
// Computa slots livres CLIENT-SIDE baseado em janela default
// (08:00-18:00, slots de 30min) excluindo agendamentos confirmados.
// Quando dentista escolhe slot e confirma, cria appointment via:
//   POST /companies/:cid/dental/appointments
// ============================================================

import { useMemo, useState } from "react";
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { DentalColors } from "@/constants/dental-tokens";

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

const SLOT_MIN = 30;
const DAY_START_H = 8;
const DAY_END_H = 18;
const DAYS_AHEAD = 14;

interface DaySlots {
  iso: string;       // YYYY-MM-DD
  label: string;     // "qua, 30/abr"
  weekday: number;   // 0-6
  free: string[];    // ISO strings
  used: number;
}

function buildDays(now: Date, busy: BusyAppt[], practitionerId?: string | null): DaySlots[] {
  const out: DaySlots[] = [];
  const busyByDay: Record<string, Array<{ start: number; end: number }>> = {};
  for (const a of busy) {
    if (a.status === "cancelado") continue;
    if (practitionerId && a.practitioner_id && a.practitioner_id !== practitionerId) continue;
    const d = new Date(a.scheduled_at);
    const key = d.toISOString().slice(0, 10);
    const start = d.getTime();
    const end = start + (a.duration_min || 30) * 60 * 1000;
    (busyByDay[key] = busyByDay[key] || []).push({ start, end });
  }

  for (let i = 1; i <= DAYS_AHEAD; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (d.getDay() === 0) continue; // pula domingo
    const key = d.toISOString().slice(0, 10);
    const free: string[] = [];
    const dayBusy = busyByDay[key] || [];
    for (let h = DAY_START_H; h < DAY_END_H; h++) {
      for (let m = 0; m < 60; m += SLOT_MIN) {
        const slot = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
        const ts = slot.getTime();
        const conflict = dayBusy.some((b) => ts < b.end && ts + SLOT_MIN * 60 * 1000 > b.start);
        if (!conflict) free.push(slot.toISOString());
      }
    }
    const wkLabel = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][d.getDay()];
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
    queryKey: ["dental-agenda-window", cid, startISO.slice(0, 10), DAYS_AHEAD],
    queryFn: () =>
      request<{ appointments: BusyAppt[] }>(
        `/companies/${cid}/dental/agenda?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`,
      ),
    enabled: !!cid && open,
    staleTime: 30000,
  });

  const days = useMemo(() => buildDays(new Date(), data?.appointments || [], practitionerId), [data, practitionerId]);

  const confirmMut = useMutation({
    mutationFn: () => {
      if (!selectedSlot) throw new Error("Escolha um horario");
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
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 }}>
        <View style={{
          backgroundColor: DentalColors.bg2,
          borderRadius: 16, borderWidth: 1, borderColor: DentalColors.border,
          maxHeight: "90%", padding: 18,
        }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: DentalColors.ink, marginBottom: 4 }}>
            📅 Agendar proxima consulta
          </Text>
          <Text style={{ fontSize: 11, color: DentalColors.ink3, marginBottom: 14 }}>
            Selecione dia e horario livre. Janela 08h-18h, slots de 30min.
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, color: DentalColors.ink3, marginBottom: 4, fontWeight: "700", letterSpacing: 1 }}>DURACAO (MIN)</Text>
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
                placeholder="Ex: Restauracao 13 mesial"
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
                    <Text style={{ fontSize: 10, color: DentalColors.ink3, fontStyle: "italic" }}>Sem horarios livres</Text>
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
