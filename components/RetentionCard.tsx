import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useCustomers } from "@/hooks/useCustomers";
import { computeRetentionSummary } from "@/services/retentionCalc";

// MULTICNPJ Fase 1 (C1.8): este card sumia inteiro no consolidado — não
// por nenhum motivo técnico forte, só porque `companiesApi.retention`
// pede um `company.id`, e no consolidado `company` é `null` (ver
// stores/auth.ts). Não existe endpoint de retenção agregado no backend.
//
// Em vez de esperar por um endpoint novo: no consolidado, o card calcula
// o mesmo resumo (retention_rate, churn_rate, retornaram, freq. média) em
// cima da lista que useCustomers() já busca em /me/customers — a MESMA
// lista que a aba Retenção usa (services/retentionCalc.ts). Fora do
// consolidado nada mudou: continua vindo do endpoint por empresa.
export function RetentionCard() {
  const { company, consolidatedView } = useAuthStore();

  const singleQuery = useQuery({
    queryKey: ['retention', company?.id],
    queryFn: () => companiesApi.retention(company!.id),
    enabled: !consolidatedView && !!company?.id,
    staleTime: 120_000,
    retry: 1,
  });

  // Reaproveita o cache de useCustomers() — a tela de Clientes já chamou
  // este hook com a mesma queryKey; aqui não dispara uma segunda busca.
  const { customers, isLoading: customersLoading } = useCustomers();
  const consolidatedSummary = useMemo(
    () => (consolidatedView ? computeRetentionSummary(customers) : null),
    [consolidatedView, customers]
  );

  const isLoading = consolidatedView ? customersLoading : singleQuery.isLoading;
  const data = consolidatedView ? consolidatedSummary : singleQuery.data;

  if (isLoading || !data) return null;
  const { retention_rate, churn_rate, returning_customers, total_customers, avg_purchase_frequency } = data;
  if (!total_customers) return null;

  const rateColor = retention_rate >= 70 ? Colors.green : retention_rate >= 40 ? Colors.amber : Colors.red;

  return (
    <View style={s.card} testID="retention-card">
      <Text style={s.title}>Retenção de clientes</Text>
      {consolidatedView && (
        <Text style={s.consolidatedNote} testID="retention-card-consolidado">
          Somando todas as lojas — cada cliente conta uma vez.
        </Text>
      )}
      <View style={s.row}>
        <View style={s.metric}>
          <Text style={[s.value, { color: rateColor }]}>{retention_rate?.toFixed(0) || 0}%</Text>
          <Text style={s.label}>Retenção</Text>
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
  consolidatedNote: { fontSize: 10.5, color: Colors.violet3, fontWeight: '600', marginTop: -6, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  metric: { alignItems: 'center', flex: 1 },
  value: { fontSize: 20, fontWeight: '800', color: Colors.ink, marginBottom: 2 },
  label: { fontSize: 9, color: Colors.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 6 },
});

export default RetentionCard;
