import { useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { DentalColors } from "@/constants/dental-tokens";

// ============================================================
// HojeAppointmentsPanel — Lista de proximos atendimentos do dia
// PR19 (2026-04-27): bug fix — status 'confirmado' nao existe no
//   enum → substituido por aprovado + avaliacao.
// PR24 (2026-04-28): botao "Prontuario" ao lado do "Iniciar".
// FIX-11 (2026-05-09): STATUS_META — escala canonica:
//   Azul=Agendado, Laranja=Confirmado, Amarelo=Em atendimento, Verde=Concluido.
// FIX-17 (2026-05-09): botao Cancelar inline por linha com confirmacao.
// ============================================================

interface DentalAppointment {
  id: string;
  patient_id?: string;
  customer_id?: string;
  patient_name: string;
  patient_phone?: string;
  scheduled_at: string;
  duration_min: number;
  chief_complaint?: string;
  status: "agendado" | "confirmado" | "avaliacao" | "aprovado" | "em_atendimento" | "concluido" | "faltou" | "cancelado";
  chair?: string;
  professional_name?: string;
  professional_color?: string;
}

// FIX-11: escala canonica de cores
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  agendado:       { label: "Agendado",       color: "#06B6D4", bg: "rgba(6,182,212,0.14)"   },
  confirmado:     { label: "Confirmado",      color: "#F97316", bg: "rgba(249,115,22,0.14)"  },
  avaliacao:      { label: "Avaliacao",       color: "#06B6D4", bg: "rgba(6,182,212,0.14)"   },
  aprovado:       { label: "Aprovado",        color: "#A78BFA", bg: "rgba(167,139,250,0.14)" },
  em_atendimento: { label: "Em atendimento",  color: "#F59E0B", bg: "rgba(245,158,11,0.14)"  },
  concluido:      { label: "Concluido",       color: "#10B981", bg: "rgba(16,185,129,0.14)"  },
  faltou:         { label: "Faltou",          color: "#EF4444", bg: "rgba(239,68,68,0.14)"   },
  cancelado:      { label: "Cancelado",       color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
};

const VISIBLE_STATUSES = new Set(["agendado", "confirmado", "avaliacao", "aprovado", "em_atendimento"]);
const CANCELABLE_STATUSES = new Set(["agendado", "confirmado", "avaliacao", "aprovado"]);
const MAX_ROWS = 6;

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });
}

function emptyMessage(): { title: string; sub: string } {
  const h = new Date().getHours();
  if (h < 12) return { title: "Manha livre",    sub: "Nenhum atendimento agendado para hoje. Bom momento pra colocar a clinica em ordem." };
  if (h < 18) return { title: "Tarde tranquila", sub: "Sem proximos atendimentos no dia. Aproveite pra revisar pacientes em recall." };
  return              { title: "Dia encerrado",   sub: "Sem atendimentos restantes hoje. Confira a agenda de amanha pra se preparar." };
}

export function HojeAppointmentsPanel() {
  const cid = useAuthStore().company?.id;
  const router = useRouter();
  const qc = useQueryClient();
  const today = todayISO();
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dental-hoje-appointments", cid, today],
    queryFn: () =>
      request<{ appointments: DentalAppointment[] }>(
        `/companies/${cid}/dental/appointments?from=${today}&to=${today}`
      ),
    enabled: !!cid,
    staleTime: 30000,
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) =>
      request(`/companies/${cid}/dental/appointments/${id}`, {
        method: "PATCH",
        body: { status: "cancelado" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-hoje-appointments"] });
      qc.invalidateQueries({ queryKey: ["dental-agenda"] });
      setCancelConfirm(null);
    },
  });

  const upcoming = useMemo(() => {
    const list = (data?.appointments || []).filter((a) => VISIBLE_STATUSES.has(a.status));
    list.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return list;
  }, [data]);

  const visible = upcoming.slice(0, MAX_ROWS);
  const overflow = Math.max(0, upcoming.length - MAX_ROWS);

  return (
    <View style={{
      backgroundColor: DentalColors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: DentalColors.border,
      padding: 18, marginBottom: 18,
      ...(typeof window !== "undefined" ? { backdropFilter: "blur(20px)" } as any : {}),
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
        <View>
          <Text style={{ fontSize: 9, color: DentalColors.ink3, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 }}>
            HOJE
          </Text>
          <Text style={{ fontSize: 16, color: DentalColors.ink, fontWeight: "700", letterSpacing: -0.3 }}>
            Proximos atendimentos
          </Text>
        </View>
        {!isLoading && upcoming.length > 0 && (
          <Text style={{ fontSize: 11, color: DentalColors.cyan, fontWeight: "600", fontFamily: "JetBrains Mono, monospace" as any }}>
            {upcoming.length} pendente{upcoming.length !== 1 ? "s" : ""}
          </Text>
        )}
      </View>

      {isLoading && (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <ActivityIndicator color={DentalColors.cyan} />
        </View>
      )}

      {!isLoading && error && (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center", padding: 12, backgroundColor: "rgba(239,68,68,0.06)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", borderRadius: 10 }}>
          <Icon name="alert" size={14} color={DentalColors.red} />
          <Text style={{ fontSize: 12, color: DentalColors.ink2, flex: 1 }}>Nao foi possivel carregar a agenda do dia.</Text>
        </View>
      )}

      {!isLoading && !error && upcoming.length === 0 && (
        <View style={{ paddingVertical: 18, alignItems: "center", gap: 6 }}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: DentalColors.cyanDim, alignItems: "center", justifyContent: "center" }}>
            <Icon name="calendar" size={18} color={DentalColors.cyan} />
          </View>
          <Text style={{ fontSize: 13, color: DentalColors.ink, fontWeight: "600", marginTop: 6 }}>{emptyMessage().title}</Text>
          <Text style={{ fontSize: 11, color: DentalColors.ink3, textAlign: "center", maxWidth: 320, lineHeight: 16 }}>
            {emptyMessage().sub}
          </Text>
        </View>
      )}

      {!isLoading && !error && visible.length > 0 && (
        <View>
          {visible.map((a) => {
            const meta = STATUS_META[a.status] || STATUS_META.agendado;
            const isCancelConfirming = cancelConfirm === a.id;
            const canceling = cancelMut.isPending && cancelConfirm === a.id;
            return (
              <View key={a.id}>
                {/* Main row */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: isCancelConfirming ? 0 : 1, borderBottomColor: DentalColors.border }}>
                  <Text style={{ width: 46, fontSize: 13, fontWeight: "700", color: DentalColors.cyan, fontFamily: "JetBrains Mono, monospace" as any }}>
                    {formatTime(a.scheduled_at)}
                  </Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: DentalColors.ink, marginBottom: 2 }}>
                      {a.patient_name || "Paciente sem nome"}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: DentalColors.ink2 }}>
                      {a.chief_complaint || "Consulta"}
                      {a.professional_name ? `  ·  ${a.professional_name}` : ""}
                      {a.duration_min ? `  ·  ${a.duration_min}min` : ""}
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: meta.bg }}>
                    <Text style={{ fontSize: 9, fontWeight: "700", color: meta.color, letterSpacing: 0.4, textTransform: "uppercase" }}>
                      {meta.label}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 5 }}>
                    {/* Prontuário */}
                    {(a.customer_id || a.patient_id) ? (
                      <Pressable
                        onPress={() => router.push(`/dental/(clinic)/pacientes?open_patient=${a.customer_id || a.patient_id}&tab=prontuario` as any)}
                        style={{ backgroundColor: "rgba(124,58,237,0.12)", borderWidth: 1, borderColor: "rgba(124,58,237,0.30)", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 }}
                        accessibilityLabel={`Prontuario de ${a.patient_name || "paciente"}`}
                      >
                        <Text style={{ color: DentalColors.violet, fontSize: 10, fontWeight: "700" }}>📋</Text>
                      </Pressable>
                    ) : null}
                    {/* Iniciar / Retornar */}
                    {a.status === "em_atendimento" ? (
                      <Pressable
                        onPress={() => router.push(`/dental/consulta/${a.id}` as any)}
                        style={{ backgroundColor: "#F59E0B", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                        accessibilityLabel={`Retornar atendimento de ${a.patient_name || "paciente"}`}
                      >
                        <Text style={{ fontSize: 10, color: "#fff", fontWeight: "700" }}>↩ Retornar</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => router.push(`/dental/consulta/${a.id}` as any)}
                        style={{ backgroundColor: DentalColors.cyan, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                        accessibilityLabel={`Iniciar consulta de ${a.patient_name || "paciente"}`}
                      >
                        <Text style={{ fontSize: 10, color: "#fff", fontWeight: "700" }}>▶ Iniciar</Text>
                      </Pressable>
                    )}
                    {/* Cancelar — mostra botão ✕ para statuses canceláveis */}
                    {CANCELABLE_STATUSES.has(a.status) && !isCancelConfirming && (
                      <Pressable
                        onPress={() => setCancelConfirm(a.id)}
                        style={{ backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 }}
                        accessibilityLabel={`Cancelar consulta de ${a.patient_name || "paciente"}`}
                      >
                        <Text style={{ fontSize: 10, color: "#EF4444", fontWeight: "700" }}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
                {/* Confirmação de cancelamento inline */}
                {isCancelConfirming && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: DentalColors.border, backgroundColor: "rgba(239,68,68,0.04)", borderRadius: 8, marginBottom: 2 }}>
                    <Text style={{ flex: 1, fontSize: 12, color: "#EF4444" }}>
                      Cancelar{" "}<Text style={{ fontWeight: "700" }}>{a.patient_name}</Text>?
                    </Text>
                    <Pressable
                      onPress={() => cancelMut.mutate(a.id)}
                      disabled={canceling}
                      style={{ backgroundColor: "#EF4444", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 }}
                    >
                      {canceling
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>Confirmar</Text>
                      }
                    </Pressable>
                    <Pressable
                      onPress={() => setCancelConfirm(null)}
                      style={{ backgroundColor: DentalColors.surface, borderWidth: 1, borderColor: DentalColors.border, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 }}
                    >
                      <Text style={{ fontSize: 12, color: DentalColors.ink2, fontWeight: "600" }}>Nao</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
          <Pressable onPress={() => router.push("/dental/(clinic)/agenda" as any)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 14, marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: DentalColors.cyan, fontWeight: "600" }}>
              {overflow > 0 ? `Ver agenda completa (+${overflow})` : "Ver agenda completa"}
            </Text>
            <Icon name="chevron_right" size={12} color={DentalColors.cyan} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default HojeAppointmentsPanel;
