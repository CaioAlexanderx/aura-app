import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={{ fontSize: 14, color: i <= rating ? Colors.amber : Colors.ink3 + '33' }}>★</Text>
      ))}
    </View>
  );
}

export function ReviewsList() {
  const { company } = useAuthStore();
  const [filter, setFilter] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', company?.id, filter],
    queryFn: () => companiesApi.reviews(company!.id, filter || undefined),
    enabled: !!company?.id,
    staleTime: 60_000,
  });

  const reviews = data?.reviews || [];
  const summary = data?.summary;

  return (
    <View style={s.container}>
      {/* Summary */}
      {summary && (
        <View style={s.summaryCard}>
          <View style={s.summaryLeft}>
            <Text style={s.avgRating}>{summary.avg_rating?.toFixed(1) || '0.0'}</Text>
            <StarRating rating={Math.round(summary.avg_rating || 0)} />
            <Text style={s.totalReviews}>{summary.total || 0} avaliacoes</Text>
          </View>
          <View style={s.summaryBars}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = summary[`star_${star}`] || 0;
              const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
              return (
                <View key={star} style={s.barRow}>
                  <Text style={s.barLabel}>{star}</Text>
                  <View style={s.barTrack}><View style={[s.barFill, { width: `${pct}%` }]} /></View>
                  <Text style={s.barCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Filter chips */}
      <View style={s.filterRow}>
        <Pressable onPress={() => setFilter(null)} style={[s.chip, !filter && s.chipActive]}>
          <Text style={[s.chipText, !filter && s.chipTextActive]}>Todas</Text>
        </Pressable>
        {[5, 4, 3, 2, 1].map(star => (
          <Pressable key={star} onPress={() => setFilter(star)} style={[s.chip, filter === star && s.chipActive]}>
            <Text style={[s.chipText, filter === star && s.chipTextActive]}>{star}★</Text>
          </Pressable>
        ))}
      </View>

      {/* Reviews list */}
      <View style={s.list}>
        {reviews.map((r: any) => (
          <View key={r.id} style={s.reviewCard}>
            <View style={s.reviewHeader}>
              <View style={s.reviewAvatar}><Text style={s.reviewAvatarText}>{(r.customer_name || 'A').charAt(0)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.reviewName}>{r.customer_name || 'Cliente'}</Text>
                <Text style={s.reviewDate}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</Text>
              </View>
              <StarRating rating={r.rating} />
            </View>
            {r.comment && <Text style={s.reviewComment}>{r.comment}</Text>}
          </View>
        ))}
        {reviews.length === 0 && !isLoading && (
          <View style={s.empty}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>⭐</Text>
            <Text style={s.emptyTitle}>Nenhuma avaliacao ainda</Text>
            <Text style={s.emptyDesc}>Avaliacoes aparecerao aqui quando clientes responderem.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  summaryCard: { flexDirection: 'row', backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 16 },
  summaryLeft: { alignItems: 'center', justifyContent: 'center', minWidth: 80, gap: 4 },
  avgRating: { fontSize: 32, fontWeight: '800', color: Colors.ink },
  totalReviews: { fontSize: 10, color: Colors.ink3 },
  summaryBars: { flex: 1, gap: 3 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barLabel: { fontSize: 10, color: Colors.ink3, width: 12, textAlign: 'right' },
  barTrack: { flex: 1, height: 6, backgroundColor: Colors.bg4, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.amber, borderRadius: 3 },
  barCount: { fontSize: 10, color: Colors.ink3, width: 20 },
  filterRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  chipText: { fontSize: 11, color: Colors.ink3, fontWeight: '500' },
  chipTextActive: { color: Colors.violet3, fontWeight: '600' },
  list: { gap: 8 },
  reviewCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.violet, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  reviewName: { fontSize: 13, fontWeight: '600', color: Colors.ink },
  reviewDate: { fontSize: 10, color: Colors.ink3 },
  reviewComment: { fontSize: 12, color: Colors.ink3, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 24, backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: Colors.ink },
  emptyDesc: { fontSize: 11, color: Colors.ink3, textAlign: 'center', maxWidth: 240 },
});

export default ReviewsList;
