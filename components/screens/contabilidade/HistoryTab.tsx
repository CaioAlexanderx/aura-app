import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { ListSkeleton } from "@/components/ListSkeleton";
import { EmptyState } from "@/components/EmptyState";

type FiscalObligation = {
  id: string; code: string; description: string; due_date: string;
  reference_period: string; estimated_amount: number | null;
  status: string; completed_at: string | null;
};

var fmt = function(n: number) { return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }); } catch { return iso; }
}

function formatPeriod(p: string): string {
  if (!p) return "";
  var months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  if (p.length === 7) { var parts = p.split("-"); return months[parseInt(parts[1]) - 1] + "/" + parts[0]; }
  return p;
}

export function HistoryTab() {
  var { company } = useAuthStore();
  var companyId = company?.id;

  var { data, isLoading } = useQuery<{ total: number; obligations: FiscalObligation[] }>({
    queryKey: ["fiscal-history", companyId],
    queryFn: function() { return request("/companies/" + companyId + "/obligations?status=completed"); },
    enabled: !!companyId,
    staleTime: 120_000,
  });

  // Tambem busca obrigacoes done (do banco)
  var { data: doneData } = useQuery<{ total: number; obligations: FiscalObligation[] }>({
    queryKey: ["fiscal-done", companyId],
    queryFn: function() { return request("/companies/" + companyId + "/obligations?status=done"); },
    enabled: !!companyId,
    staleTime: 120_000,
  });

  if (isLoading) return <ListSkeleton rows={4} />;

  var completed = [...(data?.obligations || []), ...(doneData?.obligations || [])];
  // Deduplica por id
  var seen = new Set<string>();
  completed = completed.filter(function(o) { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
  // Ordena por data de conclusao (mais recente primeiro)
  completed.sort(function(a, b) { return new Date(b.completed_at || b.due_date).getTime() - new Date(a.completed_at || a.due_date).getTime(); });

  // Stats
  var totalPago = completed.reduce(function(s, o) { return s + (o.estimated_amount || 0); }, 0);
  var thisYear = new Date().getFullYear();
  var thisYearCount = completed.filter(function(o) { return (o.reference_period || "").startsWith(String(thisYear)); }).length;

  // Streak (meses consecutivos com pelo menos 1 obrigacao concluida)
  var monthSet = new Set<string>();
  completed.forEach(function(o) { if (o.reference_period && o.reference_period.length >= 7) monthSet.add(o.reference_period.slice(0, 7)); });
  var sortedMonths = Array.from(monthSet).sort().reverse();
  var streak = 0;
  var now = new Date();
  for (var i = 0; i < 12; i++) {
    var checkMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var key = checkMonth.getFullYear() + "-" + String(checkMonth.getMonth() + 1).padStart(2, "0");
    if (monthSet.has(key)) streak++;
    else break;
  }

  if (completed.length === 0) {
    return <EmptyState icon="check" iconColor={Colors.green} title="Historico fiscal" subtitle="Suas obrigacoes concluidas aparecerao aqui. Complete sua primeira obrigacao na aba Guias." />;
  }

  return (
    <View>
      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color: Colors.green }]}>{completed.length}</Text>
          <Text style={s.statLabel}>Concluidas</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color: Colors.violet3 }]}>{streak}</Text>
          <Text style={s.statLabel}>Meses seguidos</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color: Colors.ink }]}>{thisYearCount}</Text>
          <Text style={s.statLabel}>Em {thisYear}</Text>
        </View>
      </View>

      {totalPago > 0 && (
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>Total estimado pago em obrigacoes</Text>
          <Text style={s.totalVal}>{fmt(totalPago)}</Text>
        </View>
      )}

      {/* Lista */}
      <Text style={s.listTitle}>Obrigacoes concluidas</Text>
      <View style={s.listCard}>
        {completed.slice(0, 20).map(function(o) {
          return (
            <View key={o.id} style={s.histRow}>
              <View style={s.histDot}><Icon name="check" size={10} color={Colors.green} /></View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={s.histName} numberOfLines={1}>{o.description || o.code}</Text>
                <Text style={s.histMeta}>{formatPeriod(o.reference_period)}{o.completed_at ? " \u00b7 Pago em " + formatDate(o.completed_at) : ""}</Text>
              </View>
              {o.estimated_amount != null && o.estimated_amount > 0 && (
                <Text style={s.histAmount}>{fmt(o.estimated_amount)}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, alignItems: "center", backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  statVal: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 4 },
  totalCard: { backgroundColor: Colors.violetD, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border2, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 11, color: Colors.ink3, flex: 1 },
  totalVal: { fontSize: 18, fontWeight: "800", color: Colors.violet3 },
  listTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700", marginBottom: 10 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  histRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  histDot: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  histName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  histMeta: { fontSize: 10, color: Colors.ink3 },
  histAmount: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
});

export default HistoryTab;
