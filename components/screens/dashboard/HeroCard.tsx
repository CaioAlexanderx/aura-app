import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Sparkline } from "./Sparkline";
import { IS_WIDE, fmt, currentMonth } from "./types";

type Props = {
  net: number;
  sparkNet?: number[];
};

// P0 #9 fix: conditional colors based on positive/negative net
export function HeroCard({ net, sparkNet }: Props) {
  const month = currentMonth();
  const year = new Date().getFullYear();
  const isPositive = net >= 0;
  const statusColor = isPositive ? Colors.green : Colors.red;
  const statusBg = isPositive ? Colors.greenD : Colors.redD;
  const statusLabel = isPositive ? "Saudavel" : "Atencao";

  return (
    <View style={s.hero}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View>
          <Text style={s.he}>{month} {year}</Text>
          <View style={[s.hb, { backgroundColor: statusBg }]}>
            <View style={[s.hd, { backgroundColor: statusColor }]} />
            <Text style={[s.hx, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        {sparkNet && sparkNet.length >= 2 && (
          <Sparkline data={sparkNet} color={Colors.violet3} height={48} />
        )}
      </View>
      {/* P0 #9 fix: value color green/red based on positive/negative */}
      <Text style={[s.hv, { color: statusColor }]}>{fmt(net)}</Text>
      <Text style={s.hl2}>Saldo do mes</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: Colors.bg3, borderRadius: 20, padding: IS_WIDE ? 24 : 18, borderWidth: 1, borderColor: Colors.border2, marginBottom: 28 },
  he: { fontSize: 11, color: Colors.violet3, textTransform: "uppercase", letterSpacing: 1, fontWeight: "600", marginBottom: 6 },
  hb: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginTop: 4 },
  hd: { width: 6, height: 6, borderRadius: 3 },
  hx: { fontSize: 11, fontWeight: "600" },
  hv: { fontSize: IS_WIDE ? 36 : 28, fontWeight: "800", letterSpacing: -1, marginTop: 16, marginBottom: 4 },
  hl2: { fontSize: 13, color: Colors.ink3, marginBottom: 4 },
});
