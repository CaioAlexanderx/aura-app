// ============================================================
// AURA. -- AbcCurveCard
// Curva ABC dos produtos calculada a partir de vendas reais.
// Migrou do Estoque (era decorativa, sempre 'C') pro Financeiro/Receitas.
// Consome useProductsRanking — backend ranqueia por revenue e atribui A/B/C.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useProductsRanking, type ProductRanking } from "@/hooks/useSalesAnalytics";
import { useAuthStore } from "@/stores/auth";
import { DonutChart } from "@/components/charts/DonutChart";
import { Icon } from "@/components/Icon";

const ABC_COLORS = ["#10b981", "#fbbf24", "#6b7280"];
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtK = (n: number) => {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return fmt(n);
};

const PERIODS = [
  { key: "today",   label: "Hoje" },
  { key: "week",    label: "Semana" },
  { key: "month",   label: "Mês" },
] as const;

type Grade = "A" | "B" | "C";

function AbcBadge({ abc, size = 22 }: { abc: Grade; size?: number }) {
  const colors = { A: Colors.green, B: Colors.amber, C: Colors.ink3 };
  const bgs = { A: Colors.greenD, B: Colors.amberD, C: "rgba(255,255,255,0.05)" };
  return (
    <View style={[s.badge, { backgroundColor: bgs[abc], width: size, height: size, borderRadius: size / 4 }]}>
      <Text style={[s.badgeText, { color: colors[abc], fontSize: size * 0.5 }]}>{abc}</Text>
    </View>
  );
}

export function AbcCurveCard() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("month");
  const { consolidatedView } = useAuthStore();

  // Em consolidated, useProductsRanking fica disabled (enabled: !consolidatedView).
  // Mostra empty state pedindo pra trocar de empresa.
  if (consolidatedView) {
    return (
      <View style={s.card}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Curva ABC de produtos</Text>
            <Text style={s.subtitle}>Ranking calculado a partir das vendas</Text>
          </View>
        </View>
        <View style={s.emptyBox}>
          <Icon name="bar_chart" size={28} color={Colors.ink3} />
          <Text style={s.emptyTitle}>Modo consolidado</Text>
          <Text style={s.emptyText}>
            Selecione uma loja específica no switcher pra ver a curva ABC dos produtos.
          </Text>
        </View>
      </View>
    );
  }

  return <AbcCurveCardInner period={period} onPeriodChange={setPeriod} />;
}

function AbcCurveCardInner({
  period, onPeriodChange,
}: {
  period: "today" | "week" | "month";
  onPeriodChange: (p: "today" | "week" | "month") => void;
}) {
  const { data, isLoading } = useProductsRanking(period);
  const products = (data as ProductRanking | undefined)?.products || [];
  const totalRevenue = (data as ProductRanking | undefined)?.summary?.total_revenue || 0;
  const totalSold    = (data as ProductRanking | undefined)?.summary?.total_sold || 0;

  // Agrupa por classe ABC vinda do backend
  const groups: Record<Grade, typeof products> = {
    A: products.filter(p => (p.abc || "C") === "A"),
    B: products.filter(p => (p.abc || "C") === "B"),
    C: products.filter(p => (p.abc || "C") === "C"),
  };

  const groupRevenue = (g: Grade) => groups[g].reduce((s, p) => s + (p.revenue || 0), 0);
  const groupQty = (g: Grade) => groups[g].reduce((s, p) => s + (p.qty_sold || 0), 0);

  const donutItems = (["A", "B", "C"] as const)
    .map(g => ({ category: `Curva ${g}`, amount: groupRevenue(g) }))
    .filter(d => d.amount > 0);

  const labels: Record<Grade, string> = {
    A: "Alta rotatividade",
    B: "Rotatividade média",
    C: "Baixa rotatividade",
  };
  const colors: Record<Grade, string> = {
    A: Colors.green, B: Colors.amber, C: Colors.ink3,
  };

  // Top 10 produtos pra preview no card
  const topN = products.slice(0, 10);

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Curva ABC de produtos</Text>
          <Text style={s.subtitle}>Calculada a partir das vendas reais · {data?.period || period}</Text>
        </View>
        <View style={s.periodChips}>
          {PERIODS.map(p => {
            const active = p.key === period;
            return (
              <Pressable
                key={p.key}
                onPress={() => onPeriodChange(p.key)}
                style={[s.periodChip, active && s.periodChipActive]}
              >
                <Text style={[s.periodChipText, active && s.periodChipTextActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.violet} />
          <Text style={s.loadingText}>Calculando curva ABC…</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={s.emptyBox}>
          <Icon name="bar_chart" size={28} color={Colors.ink3} />
          <Text style={s.emptyTitle}>Sem vendas no período</Text>
          <Text style={s.emptyText}>
            Faça vendas pelo PDV ou registre lançamentos pra ver a curva ABC.
          </Text>
        </View>
      ) : (
        <>
          {/* Resumo top */}
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Produtos vendidos</Text>
              <Text style={s.summaryValue}>{products.length}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Unidades</Text>
              <Text style={s.summaryValue}>{totalSold}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Receita total</Text>
              <Text style={[s.summaryValue, { color: Colors.green }]}>{fmt(totalRevenue)}</Text>
            </View>
          </View>

          {/* Donut */}
          {donutItems.length > 0 && totalRevenue > 0 && (
            <View style={s.donutRow}>
              <DonutChart items={donutItems} total={totalRevenue} colorFn={(i) => ABC_COLORS[i % ABC_COLORS.length]} />
              <View style={s.donutLegend}>
                {donutItems.map((d, i) => {
                  const pct = totalRevenue > 0 ? Math.round((d.amount / totalRevenue) * 100) : 0;
                  return (
                    <View key={d.category} style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: ABC_COLORS[i] }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.legendLabel}>{d.category}</Text>
                        <Text style={s.legendValue}>{fmt(d.amount)} · {pct}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Cards A/B/C */}
          <View style={s.gradesRow}>
            {(["A", "B", "C"] as const).map(grade => {
              const items = groups[grade];
              const rev = groupRevenue(grade);
              const qty = groupQty(grade);
              const pctRev = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0;
              const pctQty = totalSold > 0 ? Math.round((qty / totalSold) * 100) : 0;
              return (
                <View key={grade} style={s.gradeCard}>
                  <View style={s.gradeHeader}>
                    <AbcBadge abc={grade} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.gradeTitle}>Curva {grade}</Text>
                      <Text style={s.gradeHint}>{labels[grade]}</Text>
                    </View>
                  </View>
                  <Text style={s.gradeCount}>{items.length} produto{items.length !== 1 ? "s" : ""}</Text>
                  <View style={{ gap: 6, marginTop: 8 }}>
                    <View style={s.barRow}>
                      <Text style={s.barLabel}>Receita</Text>
                      <View style={s.track}>
                        <View style={[s.fill, { width: `${pctRev}%`, backgroundColor: colors[grade] }]} />
                      </View>
                      <Text style={[s.pct, { color: colors[grade] }]}>{pctRev}%</Text>
                    </View>
                    <View style={s.barRow}>
                      <Text style={s.barLabel}>Qtd vendida</Text>
                      <View style={s.track}>
                        <View style={[s.fill, { width: `${pctQty}%`, backgroundColor: colors[grade] }]} />
                      </View>
                      <Text style={[s.pct, { color: colors[grade] }]}>{pctQty}%</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Top 10 produtos rankeados */}
          {topN.length > 0 && (
            <View style={s.rankSection}>
              <Text style={s.rankTitle}>Top {topN.length} mais vendidos</Text>
              {topN.map((p, idx) => {
                const grade = (p.abc || "C") as Grade;
                return (
                  <View key={p.id || idx} style={s.rankRow}>
                    <Text style={s.rankNum}>{idx + 1}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.rankName} numberOfLines={1}>{p.name}</Text>
                      {p.category ? <Text style={s.rankCat} numberOfLines={1}>{p.category}</Text> : null}
                    </View>
                    <View style={s.rankRight}>
                      <Text style={s.rankQty}>{p.qty_sold || 0} un</Text>
                      <Text style={s.rankRev}>{fmtK(p.revenue || 0)}</Text>
                    </View>
                    <AbcBadge abc={grade} size={20} />
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  title: { fontSize: 15, color: Colors.ink, fontWeight: "700" },
  subtitle: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  periodChips: { flexDirection: "row", gap: 4, backgroundColor: Colors.bg4, borderRadius: 8, padding: 3 },
  periodChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  periodChipActive: { backgroundColor: Colors.violet },
  periodChipText: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  periodChipTextActive: { color: "#fff", fontWeight: "700" },
  badge: { alignItems: "center", justifyContent: "center" },
  badgeText: { fontWeight: "800" },
  loadingBox: { alignItems: "center", paddingVertical: 32, gap: 8 },
  loadingText: { fontSize: 11, color: Colors.ink3 },
  emptyBox: { alignItems: "center", paddingVertical: 28, gap: 6, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700", marginTop: 4 },
  emptyText: { fontSize: 11, color: Colors.ink3, textAlign: "center", lineHeight: 16 },

  summaryRow: { flexDirection: "row", gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14 },
  summaryItem: { flex: 1 },
  summaryLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  summaryValue: { fontSize: 16, color: Colors.ink, fontWeight: "800", marginTop: 4 },

  donutRow: { flexDirection: "row", alignItems: "center", gap: 20, flexWrap: "wrap" },
  donutLegend: { flex: 1, gap: 8, minWidth: 160 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  legendValue: { fontSize: 10, color: Colors.ink3, marginTop: 1 },

  gradesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  gradeCard: {
    flex: 1, minWidth: 160,
    backgroundColor: Colors.bg4,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gradeHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  gradeTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  gradeHint: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  gradeCount: { fontSize: 11, color: Colors.ink3 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel: { fontSize: 9, color: Colors.ink3, width: 70, textTransform: "uppercase", letterSpacing: 0.4 },
  track: { flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  pct: { fontSize: 10, fontWeight: "700", width: 30, textAlign: "right" },

  rankSection: {
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 4,
  },
  rankTitle: {
    fontSize: 10, color: Colors.ink3, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 6,
  },
  rankRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 7, paddingHorizontal: 8,
    borderRadius: 8,
  },
  rankNum: {
    width: 18, textAlign: "center",
    fontSize: 11, color: Colors.ink3, fontWeight: "700",
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
  },
  rankName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  rankCat: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  rankRight: { alignItems: "flex-end", minWidth: 70 },
  rankQty: { fontSize: 10, color: Colors.ink3 },
  rankRev: { fontSize: 12, color: Colors.green, fontWeight: "700" },
});

export default AbcCurveCard;
