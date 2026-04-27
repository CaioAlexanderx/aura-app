// ============================================================
// ConsultaProntuarioPanel — anamnese + plano + historico.
//
// Renderizado a direita do odontograma em desktop/tablet
// landscape. Em mobile vira drawer (controlado pelo Shell).
//
// Le dados ja pre-buscados (passados via props pelo Shell).
// Nao faz fetch proprio.
// ============================================================

import { View, Text, ScrollView } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";
import type { ConsultaPatient } from "@/lib/dentalConsultaTypes";

interface PlanItem {
  id: string;
  label: string;
  status: "done" | "now" | "todo";
}

interface TimelineItem {
  id: string;
  date: string;     // YYYY-MM-DD
  title: string;
  desc?: string;
  highlight?: boolean;
}

interface Props {
  patient: ConsultaPatient | null;
  planItems?: PlanItem[];
  timeline?: TimelineItem[];
}

function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

export function ConsultaProntuarioPanel({ patient, planItems, timeline }: Props) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: DentalColors.bg }} contentContainerStyle={{ padding: 14 }}>
      <Text style={sectionLabel}>PRONTUARIO</Text>

      <View style={card}>
        <Text style={cardEyebrow("cyan")}>ANAMNESE</Text>
        <Row label="Alergias" value={patient?.allergies || "—"} valueColor={patient?.allergies ? DentalColors.red : undefined} bold={!!patient?.allergies} />
        <Row label="Condicoes" value={patient?.conditions || "—"} valueColor={patient?.conditions ? DentalColors.amber : undefined} bold={!!patient?.conditions} />
        <Row label="Medicamentos" value={patient?.medications || "—"} />
      </View>

      {planItems && planItems.length > 0 ? (
        <View style={[card, { backgroundColor: "rgba(124,58,237,0.06)", borderColor: "rgba(124,58,237,0.25)" }]}>
          <Text style={cardEyebrow("violet")}>PLANO ATIVO</Text>
          {planItems.map((p) => {
            const dotColor = p.status === "done" ? DentalColors.green
                           : p.status === "now"  ? DentalColors.cyan
                           : "transparent";
            const txtColor = p.status === "done" ? DentalColors.ink3
                           : p.status === "now"  ? DentalColors.cyan
                           : DentalColors.ink2;
            return (
              <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: DentalColors.border }}>
                <View style={{
                  width: 14, height: 14, borderRadius: 7,
                  backgroundColor: dotColor,
                  borderWidth: 2, borderColor: dotColor === "transparent" ? DentalColors.ink3 : dotColor,
                  alignItems: "center", justifyContent: "center",
                }}>
                  {p.status === "done" ? <Text style={{ color: "#fff", fontSize: 9 }}>✓</Text> : null}
                </View>
                <Text style={{
                  flex: 1, fontSize: 11, color: txtColor,
                  fontWeight: p.status === "now" ? "600" : "400",
                  textDecorationLine: p.status === "done" ? "line-through" : "none",
                }}>
                  {p.label}{p.status === "now" ? " · agora" : ""}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {timeline && timeline.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          <Text style={[sectionLabel, { marginBottom: 8 }]}>HISTORICO</Text>
          {timeline.slice(0, 8).map((t) => (
            <View key={t.id} style={{ flexDirection: "row", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: DentalColors.border }}>
              <Text style={{ fontSize: 9, color: DentalColors.ink3, width: 42, fontWeight: "600" }}>{shortDate(t.date)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: DentalColors.ink, fontWeight: "600" }}>{t.title}</Text>
                {t.desc ? <Text style={{ fontSize: 10, color: t.highlight ? DentalColors.amber : DentalColors.ink2, lineHeight: 14 }}>{t.desc}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 10, color: DentalColors.ink3, marginTop: 12, textAlign: "center" }}>
          Sem historico anterior registrado.
        </Text>
      )}
    </ScrollView>
  );
}

function Row({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", paddingVertical: 4 }}>
      <Text style={{ fontSize: 10, color: DentalColors.ink3, width: 90 }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 11, color: valueColor || DentalColors.ink, fontWeight: bold ? "600" : "400" }}>{value}</Text>
    </View>
  );
}

const sectionLabel = {
  fontSize: 9, color: DentalColors.ink3, fontWeight: "700" as const,
  letterSpacing: 1.4, textTransform: "uppercase" as const, marginBottom: 10,
};
const card = {
  backgroundColor: DentalColors.bg2, borderWidth: 1, borderColor: DentalColors.border,
  borderRadius: 10, padding: 12, marginBottom: 10,
};
const cardEyebrow = (color: "cyan" | "violet") => ({
  fontSize: 9,
  color: color === "cyan" ? DentalColors.cyan : DentalColors.violet,
  fontWeight: "700" as const,
  letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 5,
});
