// ============================================================
// ConsultaIntro — Brief pre-consulta.
//
// Renderizado antes de "Iniciar consulta". Mostra paciente,
// procedimento agendado, alertas (alergias, condicoes) e
// pre-check de materiais.
//
// PR19: dispara brief automatico na IA quando access.canUseAi.
// Renderiza card adicional "BRIEF GERADO PELA IA" com a resposta.
// onBriefReady propaga o texto pra ConsultaShell -> ConsultaAiPanel
// usar como mensagem inicial do chat.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import { useAiAccess } from "@/hooks/useAiAccess";
import { useDentalAiConsulta } from "@/hooks/useDentalAiConsulta";
import type { ConsultaAppointment, ConsultaPatient } from "@/lib/dentalConsultaTypes";

interface Props {
  patient: ConsultaPatient | null;
  appointment: ConsultaAppointment | null;
  appointmentId: string;
  patientId: string;
  onStart: () => void;
  onCancel: () => void;
  loading?: boolean;
  onBriefReady?: (briefText: string) => void;
}

interface BriefItem {
  level: "danger" | "warn" | "info";
  title: string;
  desc: string;
}

function buildBriefItems(p: ConsultaPatient | null): BriefItem[] {
  if (!p) return [];
  const items: BriefItem[] = [];
  if (p.allergies && p.allergies.trim()) {
    items.push({
      level: "danger",
      title: "Alergia: " + p.allergies,
      desc: "Verifique materiais e medicacoes antes de iniciar.",
    });
  }
  if (p.conditions && p.conditions.trim()) {
    items.push({
      level: "warn",
      title: "Condicao: " + p.conditions,
      desc: "Pode impactar protocolo de anestesia/medicacao.",
    });
  }
  if (p.medications && p.medications.trim()) {
    items.push({
      level: "info",
      title: "Em uso: " + p.medications,
      desc: "Verifique interacoes com prescricao.",
    });
  }
  if (items.length === 0) {
    items.push({
      level: "info",
      title: "Sem alertas no prontuario",
      desc: "Anamnese vazia ou nao documentada — confirme com o paciente.",
    });
  }
  return items;
}

const LEVEL_COLOR: Record<BriefItem["level"], string> = {
  danger: DentalColors.red,
  warn:   DentalColors.amber,
  info:   DentalColors.cyan,
};

export function ConsultaIntro({ patient, appointment, appointmentId, patientId, onStart, onCancel, loading, onBriefReady }: Props) {
  const briefItems = buildBriefItems(patient);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const access = useAiAccess();
  const briefMut = useDentalAiConsulta();
  const firedRef = useRef(false);
  const [aiBriefText, setAiBriefText] = useState<string | null>(null);
  const [aiBriefError, setAiBriefError] = useState<string | null>(null);

  useEffect(() => {
    if (firedRef.current) return;
    if (!access.canUseAi) return;
    if (!appointmentId || !patientId) return;
    firedRef.current = true;
    briefMut.mutate(
      { intent: "brief", appointmentId, patientId },
      {
        onSuccess: (res) => {
          setAiBriefText(res.text);
          onBriefReady?.(res.text);
        },
        onError: (err: any) => {
          const msg = err?.data?.error || err?.message || "Falha ao gerar brief";
          setAiBriefError(msg);
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.canUseAi, appointmentId, patientId]);

  const initials = (patient?.name || "?")
    .split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const time = appointment?.scheduled_at
    ? new Date(appointment.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: DentalColors.bg }}
      contentContainerStyle={{ padding: 24, alignItems: "center" }}
    >
      <View style={{ width: "100%", maxWidth: 720, gap: 14 }}>
        <Text style={{
          textAlign: "center", fontSize: 10, color: DentalColors.cyan,
          letterSpacing: 2, textTransform: "uppercase", fontWeight: "700",
        }}>
          PROXIMO ATENDIMENTO · {time}
        </Text>
        <Text style={{
          textAlign: "center", fontSize: 28, fontWeight: "800",
          color: DentalColors.ink, letterSpacing: -0.5,
        }}>
          Pronto pra começar?
        </Text>

        <View style={cardStyle}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: DentalColors.border }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22, backgroundColor: DentalColors.cyan,
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: DentalColors.ink }}>
                {patient?.name || "Paciente nao carregado"}
              </Text>
              <Text style={{ fontSize: 11, color: DentalColors.ink3, marginTop: 2 }}>
                {patient?.age != null ? patient.age + " anos" : "—"}
                {patient?.insurance_name ? " · " + patient.insurance_name : ""}
              </Text>
            </View>
          </View>
          <InfoRow label="Procedimento" value={appointment?.chief_complaint || "Nao especificado"} />
          <InfoRow label="Profissional" value={appointment?.professional_name || "—"} />
          <InfoRow label="Duracao estimada" value={(appointment?.duration_min || 60) + " min"} />
        </View>

        <View style={cardStyle}>
          <Text style={cardTitleStyle}>⚡ BRIEF CONTEXTUAL</Text>
          <View style={{ gap: 6 }}>
            {briefItems.map((item, i) => (
              <View key={i} style={{
                flexDirection: "row", gap: 10, padding: 10,
                backgroundColor: DentalColors.bg2, borderRadius: 8,
                borderLeftWidth: 3, borderLeftColor: LEVEL_COLOR[item.level],
              }}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: DentalColors.ink, marginBottom: 2 }}>{item.title}</Text>
                  <Text style={{ fontSize: 11, color: DentalColors.ink2, lineHeight: 16 }}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {access.canUseAi ? (
          <View style={[cardStyle, { borderColor: "rgba(124,58,237,0.30)", backgroundColor: "rgba(124,58,237,0.04)" }]}>
            <Text style={[cardTitleStyle, { color: DentalColors.violet }]}>✨ BRIEF GERADO PELA IA</Text>
            {briefMut.isPending ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8 }}>
                <ActivityIndicator color={DentalColors.violet} size="small" />
                <Text style={{ fontSize: 11, color: DentalColors.ink2 }}>
                  Aura analisando o paciente...
                </Text>
              </View>
            ) : aiBriefError ? (
              <Text style={{ fontSize: 11, color: DentalColors.amber, lineHeight: 16 }}>
                ⚠️ {aiBriefError}
              </Text>
            ) : aiBriefText ? (
              <Text style={{ fontSize: 12, color: DentalColors.ink, lineHeight: 18, padding: 4 }}>
                {aiBriefText}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={cardStyle}>
          <Text style={cardTitleStyle}>📦 PRE-CHECK MATERIAIS</Text>
          {[
            "Resina + sistema adesivo",
            "Brocas e instrumental",
            "Anestesico apropriado ao paciente",
            "EPIs (luvas, mascara, oculos)",
          ].map((t, i) => {
            const isOn = !!checked[String(i)];
            return (
              <Pressable key={i}
                onPress={() => setChecked((c) => ({ ...c, [String(i)]: !c[String(i)] }))}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 10,
                  padding: 9, marginTop: 5, borderRadius: 8,
                  backgroundColor: DentalColors.bg2, borderWidth: 1, borderColor: DentalColors.border,
                }}>
                <View style={{
                  width: 16, height: 16, borderRadius: 4,
                  backgroundColor: isOn ? DentalColors.cyan : "transparent",
                  borderWidth: 1.5, borderColor: isOn ? DentalColors.cyan : DentalColors.ink3,
                  alignItems: "center", justifyContent: "center",
                }}>
                  {isOn && <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>✓</Text>}
                </View>
                <Text style={{
                  flex: 1, fontSize: 12, color: isOn ? DentalColors.ink3 : DentalColors.ink,
                  textDecorationLine: isOn ? "line-through" : "none",
                }}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={onStart} disabled={loading} style={{
          backgroundColor: DentalColors.cyan, padding: 14, borderRadius: 12,
          alignItems: "center", opacity: loading ? 0.7 : 1,
        }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
            ▶ {loading ? "Carregando..." : "Iniciar consulta agora"}
          </Text>
        </Pressable>
        <Pressable onPress={onCancel} style={{ alignItems: "center", padding: 8 }}>
          <Text style={{ color: DentalColors.ink3, fontSize: 12 }}>Voltar</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
      <Text style={{ fontSize: 12, color: DentalColors.ink3 }}>{label}</Text>
      <Text style={{ fontSize: 12, color: DentalColors.ink, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

const cardStyle = {
  backgroundColor: DentalColors.surface,
  borderWidth: 1,
  borderColor: DentalColors.border,
  borderRadius: 14,
  padding: 16,
};

const cardTitleStyle = {
  fontSize: 10,
  color: DentalColors.cyan,
  letterSpacing: 1.5,
  textTransform: "uppercase" as const,
  fontWeight: "700" as const,
  marginBottom: 10,
};
