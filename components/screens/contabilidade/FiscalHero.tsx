import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  regimeLabel: string;
  actionable: number; // total excluding future
  done: number;
  pending: number;
  overdue: number;
};

export function FiscalHero({ regimeLabel, actionable, done, pending, overdue }: Props) {
  const pct = actionable > 0 ? done / actionable : 0;
  const status = overdue > 0 ? "Pendencias" : pending === 0 ? "Em dia" : pending === 1 ? "Quase la" : "Atencao";
  const statusColor = status === "Em dia" ? Colors.green : status === "Quase la" ? Colors.amber : Colors.red;
  const statusBg = status === "Em dia" ? Colors.greenD : status === "Quase la" ? Colors.amberD : Colors.redD;

  const message = overdue > 0
    ? `Voce tem ${overdue} ${overdue === 1 ? "obrigacao vencida" : "obrigacoes vencidas"}. Regularize para evitar multas.`
    : pending === 0
    ? "Todas as obrigacoes do periodo estao em dia. Continue assim!"
    : `Falta ${pending === 1 ? "1 obrigacao" : `${pending} obrigacoes`} para ficar 100% em dia.`;

  const r = 38, circ = 2 * Math.PI * r, offset = circ * (1 - pct);
  const donutSvg = `<svg width="90" height="90" viewBox="0 0 90 90" style="transform:rotate(-90deg)"><circle cx="45" cy="45" r="38" fill="none" stroke="${Colors.bg4}" stroke-width="7"/><circle cx="45" cy="45" r="38" fill="none" stroke="${statusColor}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/></svg><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center"><div style="font-size:22px;font-weight:800;color:${Colors.ink}">${done}/${actionable}</div><div style="font-size:9px;color:${Colors.ink3}">em dia</div></div>`;

  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <View style={s.regimeBadge}><Text style={s.regimeText}>{regimeLabel}</Text></View>
        <View style={[s.statusBadge, { backgroundColor: statusBg }]}><View style={[s.statusDot, { backgroundColor: statusColor }]} /><Text style={[s.statusText, { color: statusColor }]}>{status}</Text></View>
      </View>
      <View style={s.mainRow}>
        {Platform.OS === "web" ? (
          <div style={{ width: 90, height: 90, position: "relative", flexShrink: 0 } as any} dangerouslySetInnerHTML={{ __html: donutSvg }} />
        ) : (
          <View style={s.fallbackRing}><Text style={s.fallbackText}>{done}/{actionable}</Text></View>
        )}
        <View style={s.info}>
          <Text style={s.title}>{status === "Em dia" ? "Tudo em dia!" : status === "Quase la" ? "Falta pouco!" : "Vamos resolver."}</Text>
          <Text style={s.message}>{message}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border2, marginBottom: 20 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  regimeBadge: { backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  regimeText: { fontSize: 11, fontWeight: "600", color: Colors.violet3 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  mainRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  fallbackRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 7, borderColor: Colors.violet, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  fallbackText: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  info: { flex: 1, gap: 6 },
  title: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  message: { fontSize: 13, color: Colors.ink3, lineHeight: 20 },
});

export default FiscalHero;
