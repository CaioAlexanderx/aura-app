import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Obligation } from "./types";

type Props = {
  regime: string;
  regimeLabel: string;
  total: number;
  done: number;
  pending: number;
  overdue: number;
  auraResolveCount: number;
  voceFazCount: number;
};

export function FiscalHero({ regime, regimeLabel, total, done, pending, overdue, auraResolveCount, voceFazCount }: Props) {
  const pct = total > 0 ? done / total : 0;
  const status = overdue > 0 ? "Pendencias" : pending === 0 ? "Em dia" : pending <= 2 ? "Quase la" : "Atencao";
  const statusColor = status === "Em dia" ? Colors.green : status === "Quase la" ? Colors.amber : Colors.red;
  const statusBg = status === "Em dia" ? Colors.greenD : status === "Quase la" ? Colors.amberD : Colors.redD;

  const message = overdue > 0
    ? `Voce tem ${overdue} ${overdue === 1 ? "obrigacao vencida" : "obrigacoes vencidas"}. Regularize para evitar multas.`
    : pending === 0
    ? "Todas as obrigacoes estao em dia. Continue assim!"
    : `${pending} ${pending === 1 ? "item pendente" : "itens pendentes"} para resolver.`;

  // SVG donut
  const r = 38, circ = 2 * Math.PI * r, offset = circ * (1 - pct);
  const donutSvg = `<svg width="90" height="90" viewBox="0 0 90 90" style="transform:rotate(-90deg)"><circle cx="45" cy="45" r="38" fill="none" stroke="${Colors.bg4}" stroke-width="7"/><circle cx="45" cy="45" r="38" fill="none" stroke="${statusColor}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/></svg><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center"><div style="font-size:20px;font-weight:800;color:${Colors.ink}">${done}/${total}</div><div style="font-size:9px;color:${Colors.ink3}">concluidas</div></div>`;

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
          <View style={s.fallbackRing}><Text style={s.fallbackText}>{done}/{total}</Text></View>
        )}
        <View style={s.info}>
          <Text style={s.title}>{status === "Em dia" ? "Tudo em dia!" : status === "Quase la" ? "Voce esta quase la." : "Vamos resolver suas pendencias."}</Text>
          <Text style={s.message}>{message}</Text>
        </View>
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}><Text style={[s.statVal, { color: Colors.green }]}>{auraResolveCount}</Text><Text style={s.statLabel}>Aura resolve</Text></View>
        <View style={[s.stat, s.statBorder]}><Text style={[s.statVal, { color: Colors.amber }]}>{voceFazCount}</Text><Text style={s.statLabel}>Voce confirma</Text></View>
        <View style={[s.stat, s.statBorder]}><Text style={[s.statVal, { color: Colors.green }]}>{done}</Text><Text style={s.statLabel}>Concluidas</Text></View>
        <View style={s.stat}><Text style={[s.statVal, { color: pending > 0 ? Colors.amber : Colors.green }]}>{pending}</Text><Text style={s.statLabel}>Pendentes</Text></View>
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
  mainRow: { flexDirection: "row", alignItems: "center", gap: 20, marginBottom: 20 },
  fallbackRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 7, borderColor: Colors.violet, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  fallbackText: { fontSize: 20, fontWeight: "800", color: Colors.ink },
  info: { flex: 1, gap: 6 },
  title: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  message: { fontSize: 13, color: Colors.ink3, lineHeight: 20 },
  statsRow: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center", paddingVertical: 10 },
  statBorder: { borderLeftWidth: 1, borderColor: Colors.border },
  statVal: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
});

export default FiscalHero;
