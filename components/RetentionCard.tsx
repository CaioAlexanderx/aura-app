import { useQuery } from "@tanstack/react-query";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

export function RetentionCard() {
  const { company } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['retention', company?.id],
    queryFn: () => companiesApi.retention(company!.id),
    enabled: !!company?.id,
    staleTime: 120_000,
    retry: 1,
  });

  if (isLoading || !data) return null;
  const { retention_rate, churn_rate, returning_customers, total_customers, avg_purchase_frequency } = data;
  if (!total_customers) return null;

  const rateColor = retention_rate >= 70 ? Colors.green : retention_rate >= 40 ? Colors.amber : Colors.red;

  return (
    <View style={s.card}>
      <Text style={s.title}>Retencao de clientes</Text>
      <View style={s.row}>
        <View style={s.metric}>
          <Text style={[s.value, { color: rateColor }]}>{retention_rate?.toFixed(0) || 0}%</Text>
          <Text style={s.label}>Retencao</Text>
        </View>
        <View style={s.divider} />
        <View style={s.metric}>
          <Text style={[s.value, { color: Colors.red }]}>{churn_rate?.toFixed(0) || 0}%</Text>
          <Text style={s.label}>Churn</Text>
        </View>
        <View style={s.divider} />
        <View style={s.metric}>
          <Text style={s.value}>{returning_customers || 0}/{total_customers || 0}</Text>
          <Text style={s.label}>Retornaram</Text>
        </View>
        <View style={s.divider} />
        <View style={s.metric}>
          <Text style={s.value}>{avg_purchase_frequency?.toFixed(1) || '0'}x</Text>
          <Text style={s.label}>Freq. media</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  title: { fontSize: 13, fontWeight: '600', color: Colors.ink, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  metric: { alignItems: 'center', flex: 1 },
  value: { fontSize: 20, fontWeight: '800', color: Colors.ink, marginBottom: 2 },
  label: { fontSize: 9, color: Colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 6 },
});

export default RetentionCard;
