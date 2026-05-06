// components/screens/financeiro/v2/Onda3Cards.tsx
//
// Cards adicionais da Onda 3: CashflowChart (histórico + projeção 30/60/90 com
// banda confiança), MonthlyEvolution (12 meses), ProfessionalsRanking (per-company).
//
// Mantidos em arquivo separado pra não inflar SharedCards.tsx.
//
// 06/05/2026: tooltips title= em todos os graficos de barras (web only).

import { View, Text, StyleSheet, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { fmt, fmtK } from "../types";
import type {
  CashflowData,
  MonthlyItem,
  RankingItem,
} from "./types";

var W = Dimensions.get("window").width;
var NARROW = W < 480;
var isWeb = Platform.OS === "web";

// Tooltip nativo do browser via title= (RN-Web). No native ignora.
function tip(text: string): any {
  return Platform.OS === "web" ? { title: text } : {};
}

// ============================================================
// CashflowChart — histórico 30d + projeção 30/60/90 com banda
// ============================================================
export function CashflowChart({ data, consolidated }: { data?: CashflowData; consolidated?: boolean }) {
  if (!data || !data.history || data.history.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={[s.emptyText, { color: Colors.ink3 }]}>
          Sem historico suficiente pra projetar fluxo de caixa
        </Text>
      </View>
    );
  }

  // Histórico: bars verticais (income vs expenses) ou line do net diario
  // Pra simplificar, vou mostrar bars verticais empilhadas: income (verde) + expenses (vermelho)
  // e uma linha tracejada do net acumulado.
  var maxDay = Math.max(1, ...data.history.map(function(d) { return Math.max(d.income, d.expenses); }));

  return (
    <View>
      {/* Resumo numerico */}
      <View style={s.cfSummary}>
        <View style={s.cfStat}>
          <Text style={[s.cfStatLabel, { color: Colors.ink3 }]}>Saldo medio diario</Text>
          <Text style={[s.cfStatValue, { color: data.avg_daily_net >= 0 ? Colors.green : Colors.red }]}>
            {data.avg_daily_net >= 0 ? "+" : ""}{fmt(data.avg_daily_net)}
          </Text>
        </View>
        <View style={[s.cfStat, { borderLeftWidth: 1, borderLeftColor: Colors.border, paddingLeft: 14 }]}>
          <Text style={[s.cfStatLabel, { color: Colors.ink3 }]}>Volatilidade (std)</Text>
          <Text style={[s.cfStatValue, { color: Colors.ink }]}>{fmt(data.std_daily_net)}</Text>
        </View>
      </View>

      {/* Histórico bars */}
      <Text style={[s.cfSection, { color: Colors.ink3 }]}>HISTORICO · 30 DIAS</Text>
      <View style={s.cfBars}>
        {data.history.map(function(d, i) {
          var hInc = Math.max(2, (d.income / maxDay) * 100);
          var hExp = Math.max(d.expenses > 0 ? 2 : 0, (d.expenses / maxDay) * 100);
          var isToday = i === data.history.length - 1;
          var dayLabel = isToday ? "Hoje" : "D-" + (data.history.length - 1 - i);
          var tipText = dayLabel + " · receita " + fmt(d.income) + " · despesa " + fmt(d.expenses);
          return (
            <View key={i} {...tip(tipText)} style={s.cfBarCol}>
              <View style={s.cfBarStack}>
                <View
                  style={[
                    s.cfBarFill,
                    { height: hInc + "%", backgroundColor: isToday ? Colors.green : Colors.green + "aa" },
                  ]}
                />
                {hExp > 0 && (
                  <View
                    style={[
                      s.cfBarFill,
                      s.cfBarExp,
                      { height: hExp + "%", backgroundColor: isToday ? Colors.red : Colors.red + "88" },
                    ]}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View style={s.cfLegend}>
        <View style={s.cfLegendItem}>
          <View style={[s.cfLegendDot, { backgroundColor: Colors.green }]} />
          <Text style={[s.cfLegendText, { color: Colors.ink3 }]}>Receitas</Text>
        </View>
        <View style={s.cfLegendItem}>
          <View style={[s.cfLegendDot, { backgroundColor: Colors.red }]} />
          <Text style={[s.cfLegendText, { color: Colors.ink3 }]}>Despesas</Text>
        </View>
      </View>

      {/* Projeção 30/60/90 com banda confiança */}
      <Text style={[s.cfSection, { color: Colors.ink3, marginTop: 18 }]}>
        PROJECAO COM BANDA DE CONFIANCA · ±15%
      </Text>
      <View style={s.cfProjList}>
        {data.projection.map(function(p) {
          var color = p.value >= 0 ? Colors.green : Colors.red;
          var tipText = "+" + p.days_ahead + " dias · projecao " + (p.value >= 0 ? "+" : "") + fmt(p.value) + " · banda " + fmt(p.low) + " a " + fmt(p.high);
          return (
            <View key={p.days_ahead} {...tip(tipText)} style={[s.cfProjRow, { borderBottomColor: Colors.border }]}>
              <Text style={[s.cfProjLabel, { color: Colors.ink2 }]}>+{p.days_ahead} dias</Text>
              <View style={s.cfProjBand}>
                <Text style={[s.cfProjLow, { color: Colors.ink3 }]}>{fmtK(p.low)}</Text>
                <View style={[s.cfProjBandTrack, { backgroundColor: Colors.bg4 }]}>
                  <View style={[s.cfProjBandFill, { backgroundColor: color, opacity: 0.3 }]} />
                  <View style={[s.cfProjBandCenter, { backgroundColor: color }]} />
                </View>
                <Text style={[s.cfProjHigh, { color: Colors.ink3 }]}>{fmtK(p.high)}</Text>
              </View>
              <Text style={[s.cfProjValue, { color: color }]}>
                {p.value >= 0 ? "+" : ""}{fmtK(p.value)}
              </Text>
            </View>
          );
        })}
      </View>

      {data.history.every(function(d) { return d.income === 0 && d.expenses === 0; }) && (
        <Text style={[s.cfHint, { color: Colors.ink3 }]}>
          Sem lancamentos nos ultimos 30 dias — projecao reflete saldo zero.
        </Text>
      )}
      {consolidated && (
        <Text style={[s.cfHint, { color: Colors.ink3 }]}>
          Soma de todas as empresas. Pra projetar uma empresa especifica, abra ela no seletor.
        </Text>
      )}
    </View>
  );
}

// ============================================================
// MonthlyEvolution — 12 meses bars (income/expense/balance)
// ============================================================
export function MonthlyEvolution({ items }: { items: MonthlyItem[] }) {
  if (!items || items.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={[s.emptyText, { color: Colors.ink3 }]}>Sem historico mensal</Text>
      </View>
    );
  }

  var maxValue = Math.max(1, ...items.map(function(m) { return Math.max(m.income, m.expenses); }));
  var totalIncome = items.reduce(function(s, m) { return s + m.income; }, 0);
  var firstWithIncome = items.find(function(m) { return m.income > 0; });
  var lastWithIncome = items.slice().reverse().find(function(m) { return m.income > 0; });
  var growthPct = (firstWithIncome && lastWithIncome && firstWithIncome.income > 0 && firstWithIncome !== lastWithIncome)
    ? ((lastWithIncome.income - firstWithIncome.income) / firstWithIncome.income) * 100
    : null;

  return (
    <View>
      {growthPct != null && (
        <Text style={[s.evolHeader, { color: growthPct >= 0 ? Colors.green : Colors.red }]}>
          {growthPct >= 0 ? "+" : ""}{growthPct.toFixed(0)}% nos ultimos 12 meses
        </Text>
      )}

      <View style={s.evolBars}>
        {items.map(function(m, i) {
          var hInc = Math.max(2, (m.income / maxValue) * 100);
          var hExp = Math.max(m.expenses > 0 ? 2 : 0, (m.expenses / maxValue) * 100);
          var isLast = i === items.length - 1;
          var tipText = m.label + " · receita " + fmt(m.income) + " · despesa " + fmt(m.expenses) + " · saldo " + ((m.income - m.expenses) >= 0 ? "+" : "") + fmt(m.income - m.expenses);
          return (
            <View key={m.month} {...tip(tipText)} style={s.evolCol}>
              <View style={s.evolStack}>
                <View
                  style={[
                    s.evolBar,
                    { height: hInc + "%", backgroundColor: isLast ? Colors.green : Colors.green + "aa" },
                  ]}
                />
                {hExp > 0 && (
                  <View
                    style={[
                      s.evolBar,
                      s.evolBarExp,
                      { height: hExp + "%", backgroundColor: isLast ? Colors.red : Colors.red + "88" },
                    ]}
                  />
                )}
              </View>
              <Text style={[s.evolLabel, { color: isLast ? Colors.ink : Colors.ink3, fontWeight: isLast ? "700" : "500" }]}>{m.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={s.evolLegend}>
        <View style={s.evolLegendItem}>
          <View style={[s.evolLegendDot, { backgroundColor: Colors.green }]} />
          <Text style={[s.evolLegendText, { color: Colors.ink3 }]}>Receitas</Text>
        </View>
        <View style={s.evolLegendItem}>
          <View style={[s.evolLegendDot, { backgroundColor: Colors.red }]} />
          <Text style={[s.evolLegendText, { color: Colors.ink3 }]}>Despesas</Text>
        </View>
        {totalIncome > 0 && (
          <Text style={[s.evolLegendText, { color: Colors.ink3, marginLeft: "auto" }]}>
            Total recebido: <Text style={{ color: Colors.green, fontWeight: "700" }}>{fmtK(totalIncome)}</Text>
          </Text>
        )}
      </View>
    </View>
  );
}

// ============================================================
// ProfessionalsRanking — top 10 profissionais (per-company)
// ============================================================
export function ProfessionalsRanking({ items, consolidated }: { items: RankingItem[]; consolidated?: boolean }) {
  if (consolidated) {
    return (
      <View style={[s.rankBlocked, { backgroundColor: Colors.violetD, borderColor: Colors.border2 }]}>
        <Icon name="lock" size={18} color={Colors.violet3} />
        <View style={{ flex: 1 }}>
          <Text style={[s.rankBlockedTitle, { color: Colors.ink }]}>Disponivel por empresa</Text>
          <Text style={[s.rankBlockedSub, { color: Colors.ink3 }]}>
            Ranking de profissionais usa a tabela de funcionarios de cada empresa. Selecione uma empresa especifica pra ver.
          </Text>
        </View>
      </View>
    );
  }

  if (!items || items.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={[s.emptyText, { color: Colors.ink3 }]}>
          Sem profissionais com receita registrada no periodo
        </Text>
        <Text style={[s.emptyText, { color: Colors.ink3, fontSize: 11, marginTop: 2 }]}>
          (vincule funcionarios aos lancamentos pra ver o ranking)
        </Text>
      </View>
    );
  }

  var max = Math.max(1, ...items.map(function(i) { return i.total; }));
  var avatarColors = ["#7c3aed", "#a78bfa", "#34d399", "#fbbf24", "#5b8cff", "#f87171", "#c4b5fd", "#22d3ee"];

  return (
    <View>
      {items.map(function(p, i) {
        var color = avatarColors[i % avatarColors.length];
        var w = (p.total / max) * 100;
        var tipText = "#" + (i + 1) + " " + p.name + " · " + fmt(p.total) + " em " + p.tx_count + " " + (p.tx_count === 1 ? "venda" : "vendas") + " · ticket " + fmt(p.avg_ticket);
        return (
          <View key={p.id} {...tip(tipText)} style={[s.rankRow, i === items.length - 1 ? null : { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
            <Text style={[s.rankPosition, { color: Colors.violet3 }]}>{i + 1}</Text>
            <View style={[s.rankAvatar, { backgroundColor: color }]}>
              <Text style={s.rankAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.rankName, { color: Colors.ink }]} numberOfLines={1}>{p.name}</Text>
              <View style={[s.rankBarTrack, { backgroundColor: Colors.bg4 }]}>
                <View style={[s.rankBarFill, { width: w + "%", backgroundColor: color }]} />
              </View>
            </View>
            <View style={s.rankNumbers}>
              <Text style={[s.rankTotal, { color: Colors.ink }]}>{fmtK(p.total)}</Text>
              <Text style={[s.rankMeta, { color: Colors.ink3 }]}>
                {p.tx_count} {p.tx_count === 1 ? "venda" : "vendas"} · ticket {fmtK(p.avg_ticket)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

var s = StyleSheet.create({
  empty: { paddingVertical: 28, alignItems: "center" },
  emptyText: { fontSize: 12, fontStyle: "italic", textAlign: "center" },

  // Cashflow
  cfSummary: { flexDirection: "row", gap: 14, marginBottom: 14 },
  cfStat: { flex: 1 },
  cfStatLabel: { fontSize: 9, letterSpacing: 0.6, fontWeight: "600", textTransform: "uppercase", marginBottom: 3 },
  cfStatValue: { fontSize: 18, fontWeight: "800", letterSpacing: -0.4 },
  cfSection: { fontSize: 9, letterSpacing: 1, fontWeight: "600", marginBottom: 8 },
  cfBars: { flexDirection: "row", gap: 2, height: 80, alignItems: "flex-end" },
  cfBarCol: { flex: 1, height: "100%", justifyContent: "flex-end" },
  cfBarStack: { width: "100%", flex: 1, justifyContent: "flex-end", flexDirection: "column" },
  cfBarFill: { width: "100%", borderRadius: 2 },
  cfBarExp: { marginTop: 1 },
  cfLegend: { flexDirection: "row", gap: 16, marginTop: 8 },
  cfLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  cfLegendDot: { width: 8, height: 8, borderRadius: 4 },
  cfLegendText: { fontSize: 11 },
  cfProjList: { gap: 0 },
  cfProjRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  cfProjLabel: { fontSize: 12, fontWeight: "700", width: 64 },
  cfProjBand: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  cfProjLow: { fontSize: 10, fontVariant: ["tabular-nums"], minWidth: 50, textAlign: "right" },
  cfProjBandTrack: { flex: 1, height: 6, borderRadius: 3, position: "relative", overflow: "hidden" },
  cfProjBandFill: { ...StyleSheet.absoluteFillObject as any },
  cfProjBandCenter: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 2, marginLeft: -1 },
  cfProjHigh: { fontSize: 10, fontVariant: ["tabular-nums"], minWidth: 50, textAlign: "left" },
  cfProjValue: { fontSize: 13, fontWeight: "800", minWidth: 80, textAlign: "right" },
  cfHint: { fontSize: 11, fontStyle: "italic", marginTop: 12 },

  // MonthlyEvolution
  evolHeader: { fontSize: 12, fontWeight: "700", marginBottom: 10 },
  evolBars: { flexDirection: "row", gap: 4, height: 130, alignItems: "flex-end", marginBottom: 8 },
  evolCol: { flex: 1, alignItems: "center", gap: 3 },
  evolStack: { width: "100%", flex: 1, justifyContent: "flex-end" },
  evolBar: { width: "100%", borderRadius: 3 },
  evolBarExp: { marginTop: 1 },
  evolLabel: { fontSize: 9 },
  evolLegend: { flexDirection: "row", gap: 14, marginTop: 4, alignItems: "center" },
  evolLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  evolLegendDot: { width: 8, height: 8, borderRadius: 4 },
  evolLegendText: { fontSize: 11 },

  // ProfessionalsRanking
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  rankPosition: { fontSize: 12, fontWeight: "800", width: 18, textAlign: "center" },
  rankAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  rankAvatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  rankName: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  rankBarTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  rankBarFill: { height: 5, borderRadius: 3 },
  rankNumbers: { alignItems: "flex-end", minWidth: 110 },
  rankTotal: { fontSize: 13, fontWeight: "800" },
  rankMeta: { fontSize: 10, marginTop: 2 },
  rankBlocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  rankBlockedTitle: { fontSize: 13, fontWeight: "700" },
  rankBlockedSub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
});
