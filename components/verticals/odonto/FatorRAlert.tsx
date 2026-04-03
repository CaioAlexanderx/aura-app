import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

// ============================================================
// D-13: FatorRAlert — Pro-labore ratio alert (Anexo III vs V)
// Shows current Fator R and whether company qualifies for Anexo III
// ============================================================

interface Props {
  faturamentoMensal: number;
  folhaMensal: number;
  regime?: "simples" | "mei";
  targetPct?: number; // default 28%
}

export function FatorRAlert({ faturamentoMensal, folhaMensal, regime = "simples", targetPct = 28 }: Props) {
  if (regime === "mei") return null; // MEI nao tem Fator R

  const fatorR = faturamentoMensal > 0 ? Math.round(folhaMensal / faturamentoMensal * 100) : 0;
  const isOk = fatorR >= targetPct;
  const gap = targetPct - fatorR;
  const needsMore = !isOk ? Math.ceil(faturamentoMensal * targetPct / 100 - folhaMensal) : 0;

  const color = isOk ? "#10B981" : fatorR >= targetPct - 5 ? "#F59E0B" : "#EF4444";
  const bgColor = isOk ? "rgba(16,185,129,0.08)" : fatorR >= targetPct - 5 ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)";
  const borderColor = isOk ? "rgba(16,185,129,0.2)" : fatorR >= targetPct - 5 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)";

  return (
    <View style={[s.card, { backgroundColor: bgColor, borderColor }]}>
      <View style={s.header}>
        <View style={[s.indicator, { backgroundColor: color }]} />
        <Text style={[s.title, { color }]}>Fator R: {fatorR}%</Text>
        <Text style={[s.anexo, { color }]}>
          {isOk ? "Anexo III (6%)" : "Anexo V (15,5%)"}
        </Text>
      </View>

      <View style={s.barContainer}>
        <View style={s.barBg}>
          <View style={[s.barFill, { width: Math.min(fatorR, 100) + "%", backgroundColor: color }]} />
          <View style={[s.barTarget, { left: targetPct + "%" }]} />
        </View>
        <View style={s.barLabels}>
          <Text style={s.barLabel}>0%</Text>
          <Text style={[s.barLabel, { position: "absolute", left: targetPct + "%" }]}>{targetPct}%</Text>
          <Text style={[s.barLabel, { marginLeft: "auto" }]}>100%</Text>
        </View>
      </View>

      <View style={s.details}>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Faturamento mensal</Text>
          <Text style={s.detailVal}>R$ {faturamentoMensal.toLocaleString("pt-BR")}</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Folha (pro-labore + salarios)</Text>
          <Text style={s.detailVal}>R$ {folhaMensal.toLocaleString("pt-BR")}</Text>
        </View>
        {!isOk && (
          <View style={[s.alertBox, { borderColor: color + "33" }]}>
            <Text style={[s.alertText, { color }]}>
              Para atingir {targetPct}%, aumente a folha em R$ {needsMore.toLocaleString("pt-BR")}. 
              Diferenca tributaria: Anexo III (6%) vs Anexo V (15,5%) = {Math.round(faturamentoMensal * 0.095)} a mais por mes.
            </Text>
          </View>
        )}
        {isOk && (
          <Text style={[s.okText, { color }]}>
            Fator R acima de {targetPct}% \u2014 empresa enquadrada no Anexo III com aliquota efetiva menor.
          </Text>
        )}
      </View>

      <Text style={s.disclaimer}>Estimativa informativa. Consulte seu contador para confirmacao oficial.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 12, padding: 16, borderWidth: 0.5, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  indicator: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 15, fontWeight: "700", flex: 1 },
  anexo: { fontSize: 12, fontWeight: "600" },
  barContainer: { gap: 4 },
  barBg: { height: 8, borderRadius: 4, backgroundColor: Colors.bg4 || "#222", position: "relative", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  barTarget: { position: "absolute", top: -2, width: 2, height: 12, backgroundColor: Colors.ink || "#fff" },
  barLabels: { flexDirection: "row", position: "relative" },
  barLabel: { fontSize: 9, color: Colors.ink3 || "#888" },
  details: { gap: 6 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { fontSize: 12, color: Colors.ink2 || "#aaa" },
  detailVal: { fontSize: 12, fontWeight: "600", color: Colors.ink || "#fff" },
  alertBox: { padding: 10, borderRadius: 8, borderWidth: 0.5 },
  alertText: { fontSize: 11, lineHeight: 16 },
  okText: { fontSize: 12, fontWeight: "500" },
  disclaimer: { fontSize: 10, color: Colors.ink3 || "#888", fontStyle: "italic" },
});

export default FatorRAlert;
