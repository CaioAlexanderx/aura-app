// ============================================================
// AURA. — ConsolidatedBreakdownCard (Multi-CNPJ Onda 2.1)
//
// Mostra breakdown de receita/despesa/net por empresa quando o user
// esta em modo consolidado. Click numa linha troca pra essa empresa
// especifica via switchCompany().
// ============================================================
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import type { DashboardBreakdown } from "@/services/meAggregates";

function fmtBRL(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return "R$ 0,00";
  const formatted = Math.abs(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (value < 0 ? "-" : "") + "R$ " + formatted;
}

function Avatar({ name }: { name: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <View style={s.avatar}>
      <Text style={s.avatarText}>{initial}</Text>
    </View>
  );
}

export function ConsolidatedBreakdownCard({
  breakdown,
}: {
  breakdown: DashboardBreakdown[];
}) {
  const { switchCompany, switching } = useAuthStore();

  if (!breakdown || breakdown.length === 0) return null;

  // Calcula totais pra mostrar % de cada empresa
  const totalRevenue = breakdown.reduce((s, b) => s + (b.revenue || 0), 0);

  function handleClick(companyId: string) {
    if (switching) return;
    switchCompany(companyId).catch(() => {});
  }

  return (
    <View style={s.panel}>
      <View style={s.head}>
        <View style={s.headLeft}>
          <View style={s.bar} />
          <Text style={s.title}>Resumo por empresa</Text>
        </View>
        <View style={s.countPill}>
          <Text style={s.countText}>{breakdown.length} empresas</Text>
        </View>
      </View>

      {breakdown.map((b) => {
        const pct =
          totalRevenue > 0
            ? Math.round(((b.revenue || 0) / totalRevenue) * 100)
            : 0;
        const netColor =
          b.net > 0
            ? Colors.green
            : b.net < 0
            ? Colors.red
            : Colors.ink3;

        return (
          <Pressable
            key={b.company_id}
            onPress={() => handleClick(b.company_id)}
            style={({ pressed }) => [
              s.row,
              pressed && s.rowPressed,
              Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null,
            ]}
          >
            <View style={s.rowLeft}>
              <Avatar name={b.company_name} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.rowNameLine}>
                  <Text style={s.rowName} numberOfLines={1}>
                    {b.company_name}
                  </Text>
                  {b.is_primary && (
                    <View style={s.primaryBadge}>
                      <Text style={s.primaryBadgeText}>PRINCIPAL</Text>
                    </View>
                  )}
                </View>
                <Text style={s.rowSub} numberOfLines={1}>
                  {fmtBRL(b.revenue)} entrada · {fmtBRL(b.expenses)} despesa
                </Text>
                {/* mini-bar de proporcao da receita */}
                {totalRevenue > 0 && (
                  <View style={s.miniBar}>
                    <View
                      style={[
                        s.miniBarFill,
                        { width: pct + "%" },
                      ]}
                    />
                  </View>
                )}
              </View>
            </View>

            <View style={s.rowRight}>
              <Text style={[s.net, { color: netColor }]}>{fmtBRL(b.net)}</Text>
              <Text style={s.netLabel}>resultado</Text>
            </View>
          </Pressable>
        );
      })}

      <View style={s.foot}>
        <Text style={s.footText}>
          Toque numa empresa para entrar nela específicamente
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Glass.lineBorderCard,
    marginBottom: 24,
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: Glass.card,
          boxShadow: Glass.cardShadow,
        } as any)
      : null),
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  bar: { width: 4, height: 18, borderRadius: 2, backgroundColor: "#7c3aed" },
  title: { fontSize: 15, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(124,58,237,0.14)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
  },
  countText: {
    fontSize: 10,
    color: "#a78bfa",
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  rowPressed: { opacity: 0.7 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.bg4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  avatarText: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  rowNameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowName: { fontSize: 13, fontWeight: "600", color: Colors.ink, flexShrink: 1 },
  primaryBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(124,58,237,0.14)",
  },
  primaryBadgeText: { fontSize: 8, color: "#a78bfa", fontWeight: "700", letterSpacing: 0.4 },
  rowSub: { fontSize: 10.5, color: Colors.ink3, marginTop: 2, fontVariant: ["tabular-nums"] as any },
  miniBar: {
    marginTop: 5,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: "hidden",
    width: "100%",
    maxWidth: 200,
  },
  miniBarFill: {
    height: "100%",
    backgroundColor: "#7c3aed",
    borderRadius: 2,
  },
  rowRight: { alignItems: "flex-end", gap: 2 },
  net: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] as any },
  netLabel: {
    fontSize: 9,
    color: Colors.ink3,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  foot: { marginTop: 10, alignItems: "center" },
  footText: { fontSize: 10, color: Colors.ink3, letterSpacing: 0.3, fontStyle: "italic" },
});

export default ConsolidatedBreakdownCard;
