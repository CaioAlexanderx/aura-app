// ─── PipelineView ────────────────────────────────────────────────────────────
// Funil de conversao + cards por status + quick stats.
// ============================================================================

import { View, Text, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { crmStyles as cs } from "../shared/styles";
import { isWeb } from "../shared/styles";
import { STATUSES } from "../shared/constants";
import { fmtMoney } from "../shared/helpers";
import type { LeadStats } from "@/services/crmApi";

type MetaStats = {
  with_phone: number;
  high_rated: number;
  followup_overdue: number;
  rotten_total: number;
  hot_total: number;
  never_contacted: number;
  total: number;
};

type Props = {
  stats?: LeadStats;
  metaStats?: MetaStats;
  pipeline?: Record<string, { count: number; potential_mrr: number }>;
  onStatusClick: (status: string) => void;
};

export function PipelineView({ stats, metaStats, pipeline, onStatusClick }: Props) {
  return (
    <View>
      {/* Funil de conversao */}
      {stats && (
        <View style={cs.section}>
          <Text style={cs.sectionTitle}>Funil de conversao</Text>
          {[
            { label: "Total de leads",     val: stats.total,           rate: null,                                             color: Colors.ink3 },
            { label: "Contatados",         val: stats.contacted_total, rate: `${stats.rate_contacted}% do total`,              color: Colors.amber },
            { label: "Responderam",        val: stats.responded_total, rate: `${stats.rate_responded}% dos contatados`,        color: "#06b6d4" },
            { label: "Interessados",       val: stats.interested_total, rate: `${stats.rate_interested}% dos que responderam`, color: Colors.violet3 },
            { label: "Demo",               val: stats.demo_total,      rate: `${stats.rate_demo}% dos interessados`,           color: Colors.green },
            { label: "Convertidos",        val: stats.converted_total, rate: `${stats.rate_converted}% do total`,              color: Colors.green },
          ].map((row) => (
            <View key={row.label} style={s_funnel.row}>
              <View style={[s_funnel.dot, { backgroundColor: row.color }]} />
              <Text style={s_funnel.label}>{row.label}</Text>
              <View style={{ flex: 1 }} />
              <Text style={[s_funnel.count, { color: row.color }]}>{row.val}</Text>
              {row.rate && <Text style={s_funnel.rate}>{row.rate}</Text>}
            </View>
          ))}
          <View style={[s_funnel.row, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border }]}>
            <Text style={s_funnel.label}>Perdidos</Text>
            <View style={{ flex: 1 }} />
            <Text style={[s_funnel.count, { color: Colors.red }]}>{stats.lost_total}</Text>
          </View>

          {/* MRR pipeline */}
          {(stats.pipeline_mrr || stats.won_mrr) ? (
            <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, flexDirection: "row", gap: 12 }}>
              <View style={s_funnel.mrrBox}>
                <Text style={[s_funnel.mrrVal, { color: Colors.violet3 }]}>{fmtMoney(stats.pipeline_mrr)}</Text>
                <Text style={s_funnel.mrrLabel}>MRR no pipeline</Text>
              </View>
              <View style={s_funnel.mrrBox}>
                <Text style={[s_funnel.mrrVal, { color: Colors.green }]}>{fmtMoney(stats.won_mrr)}</Text>
                <Text style={s_funnel.mrrLabel}>MRR fechado</Text>
              </View>
              <View style={s_funnel.mrrBox}>
                <Text style={[s_funnel.mrrVal, { color: Colors.ink }]}>{stats.avg_score}</Text>
                <Text style={s_funnel.mrrLabel}>Score medio</Text>
              </View>
            </View>
          ) : null}
        </View>
      )}

      {/* Cards de status (clicaveis -> filtra lista) */}
      <View style={s_pipe.grid}>
        {STATUSES.map((st) => {
          const entry = pipeline?.[st.key];
          const count = entry?.count || 0;
          return (
            <Pressable
              key={st.key}
              onPress={() => onStatusClick(st.key)}
              style={[s_pipe.card, { borderColor: st.color + "44" }]}
            >
              <Text style={[s_pipe.count, { color: st.color }]}>{count}</Text>
              <Text style={s_pipe.label}>{st.label}</Text>
              {entry?.potential_mrr ? (
                <Text style={[s_pipe.mrr, { color: st.color }]}>{fmtMoney(entry.potential_mrr)}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Quick stats */}
      {metaStats && (
        <View style={s_pipe.quickRow}>
          {[
            { label: "Quentes (≥50)",       val: metaStats.hot_total,         color: Colors.green },
            { label: "Com telefone",        val: metaStats.with_phone,        color: Colors.violet3 },
            { label: "Alta nota (≥4)",      val: metaStats.high_rated,        color: Colors.amber },
            { label: "Follow-up vencido",   val: metaStats.followup_overdue,  color: Colors.red },
            { label: "Rotten",              val: metaStats.rotten_total,      color: Colors.ink3 },
            { label: "Nunca contatado",     val: metaStats.never_contacted,   color: Colors.ink3 },
          ].map((stat) => (
            <View key={stat.label} style={s_pipe.quickCard}>
              <Text style={[s_pipe.quickVal, { color: stat.color }]}>{stat.val}</Text>
              <Text style={s_pipe.quickLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

import { StyleSheet } from "react-native";

const s_funnel = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  count: { fontSize: 14, fontWeight: "800", letterSpacing: -0.3 },
  rate: { fontSize: 10, color: Colors.ink3, marginLeft: 6 },
  mrrBox: { flex: 1, backgroundColor: Colors.bg4, borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  mrrVal: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  mrrLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },
});

const s_pipe = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  card: {
    width: isWeb ? "13%" : "47%",
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
    alignItems: "center",
  },
  count: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  label: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },
  mrr: { fontSize: 10, fontWeight: "700", marginTop: 4 },
  quickRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  quickCard: {
    flex: 1, minWidth: "30%",
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  quickVal: { fontSize: 22, fontWeight: "800", color: Colors.ink },
  quickLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2, textAlign: "center" },
});
