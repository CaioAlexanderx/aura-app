// ─── GoalsCard ───────────────────────────────────────────────────────────────
// Card de meta do mes atual + ritmo projetado. Indicador "on track" / "atras".
// ============================================================================

import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { fmtMoney } from "../shared/helpers";
import { crmStyles as cs } from "../shared/styles";
import type { GoalCurrentProgress } from "@/services/crmApi";

type Props = {
  data?: GoalCurrentProgress;
  isLoading?: boolean;
  onEdit?: () => void;
};

export function GoalsCard({ data, isLoading, onEdit }: Props) {
  if (isLoading || !data) {
    return (
      <View style={cs.section}>
        <Text style={cs.sectionTitle}>Meta do mes</Text>
        <Text style={cs.hintText}>{isLoading ? "Carregando..." : "Sem meta definida."}</Text>
      </View>
    );
  }

  const { goal, actual_contacts, actual_converted, actual_mrr, pace_contacts, pace_converted, month_progress } = data;
  const target_contacts  = Number(goal.target_contacts || 0);
  const target_converted = Number(goal.target_converted || 0);
  const target_mrr       = Number(goal.target_mrr || 0);

  const hasGoal = target_contacts > 0 || target_converted > 0 || target_mrr > 0;

  if (!hasGoal) {
    return (
      <View style={cs.section}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={cs.sectionTitle}>Meta do mes</Text>
          {onEdit && (
            <Pressable onPress={onEdit} style={[cs.actionBtn, { paddingVertical: 6, paddingHorizontal: 10 }]}>
              <Icon name="plus" size={12} color={Colors.violet3} />
              <Text style={[cs.actionBtnText, { color: Colors.violet3, fontSize: 11 }]}>Definir meta</Text>
            </Pressable>
          )}
        </View>
        <Text style={cs.hintText}>
          Sem meta para este mes. Defina contatos/conversoes/MRR pra acompanhar ritmo.
        </Text>
        <View style={s.row}>
          <Stat label="Contatos no mes"  value={String(actual_contacts)}  color={Colors.violet3} />
          <Stat label="Convertidos"      value={String(actual_converted)} color={Colors.green} />
          <Stat label="MRR fechado"      value={fmtMoney(actual_mrr)}     color={Colors.green} />
        </View>
      </View>
    );
  }

  return (
    <View style={cs.section}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <Text style={cs.sectionTitle}>Meta do mes</Text>
        <Text style={{ fontSize: 10, color: Colors.ink3 }}>{month_progress}% do mes decorrido</Text>
      </View>

      <View style={{ gap: 10 }}>
        {target_contacts > 0 && (
          <ProgressRow
            label="Contatos"
            actual={actual_contacts}
            target={target_contacts}
            pace={pace_contacts}
            monthProgress={month_progress}
          />
        )}
        {target_converted > 0 && (
          <ProgressRow
            label="Convertidos"
            actual={actual_converted}
            target={target_converted}
            pace={pace_converted}
            monthProgress={month_progress}
          />
        )}
        {target_mrr > 0 && (
          <ProgressRow
            label="MRR fechado"
            actual={actual_mrr}
            target={target_mrr}
            isMoney
            monthProgress={month_progress}
          />
        )}
      </View>

      {onEdit && (
        <Pressable onPress={onEdit} style={[cs.actionBtn, { marginTop: 10, alignSelf: "flex-start" }]}>
          <Icon name="edit" size={12} color={Colors.ink3} />
          <Text style={[cs.actionBtnText, { fontSize: 11 }]}>Editar meta</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.statBox}>
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function ProgressRow({
  label, actual, target, pace, monthProgress, isMoney,
}: {
  label: string;
  actual: number;
  target: number;
  pace?: number;
  monthProgress: number;
  isMoney?: boolean;
}) {
  const pct = Math.min(100, Math.round((actual / target) * 100));
  const expectedNow = (target * monthProgress) / 100;
  const onTrack = actual >= expectedNow;
  const color = onTrack ? Colors.green : pct > 60 ? Colors.amber : Colors.red;
  const format = (n: number) => (isMoney ? fmtMoney(n) : String(n));

  return (
    <View>
      <View style={s.headerRow}>
        <Text style={s.label}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text style={[s.actualVal, { color }]}>{format(actual)}</Text>
          <Text style={s.targetVal}>/ {format(target)}</Text>
          <Text style={[s.pctVal, { color }]}>{pct}%</Text>
        </View>
      </View>
      <View style={s.bar}>
        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
        {/* Marker do "esperado para agora" */}
        <View style={[s.barMarker, { left: `${Math.min(99, monthProgress)}%` }]} />
      </View>
      {pace !== undefined && (
        <Text style={[s.pace, { color }]}>
          Ritmo: ~{isMoney ? fmtMoney(pace) : pace} ate o fim do mes {onTrack ? "✓" : "⚠"}
        </Text>
      )}
    </View>
  );
}

import { Pressable } from "react-native";

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  statBox: {
    flex: 1,
    backgroundColor: Colors.bg4,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statVal: { fontSize: 18, fontWeight: "800", color: Colors.ink },
  statLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2, textAlign: "center" },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 },
  label: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  actualVal: { fontSize: 16, fontWeight: "800" },
  targetVal: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  pctVal: { fontSize: 11, fontWeight: "700" },

  bar: {
    height: 6,
    backgroundColor: Colors.bg4,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
    position: "relative",
  },
  barFill: { height: "100%", borderRadius: 3 },
  barMarker: {
    position: "absolute",
    top: -2, bottom: -2,
    width: 2,
    backgroundColor: Colors.ink + "AA",
  },

  pace: { fontSize: 10, fontWeight: "600", marginTop: 4 },
});
