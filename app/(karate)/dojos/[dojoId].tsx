// ============================================================
// Detalhe do Dojô — Aura Karatê
//
// Wired ao endpoint GET /federation/{id}/dojos/{dojoId}.
// MOCK ativo enquanto backend não responder.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  ScrollView, View, Text, StyleSheet,
  ActivityIndicator, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { Skeleton } from "@/components/karate/Skeleton";
import { karateApi, DojoDetail, DojoStatus } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const MOCK_DETAIL: DojoDetail = {
  id: "d1", fpkt_affiliation_id: "FPKT-001", name: "Dojô Shotokan ABC",
  cnpj: null, sensei_cpf: null, region: "São Paulo",
  affiliation_model: "annual", affiliation_since: "2020-01-15",
  dojo_founded_year: 2010, address: "Rua das Flores, 100",
  phone: "11 9999-0001", email: "abc@shotokan.com",
  status: "active", practitioner_count: 48,
  technical_team: [
    { practitioner_id: "p1", name: "Sensei Carlos Silva", belt_level: "preta", roles: ["instructor"] },
  ],
  annuity_history: [
    { reference_period: "2026", amount: 1200, paid_at: "2026-01-10", status: "active" },
    { reference_period: "2025", amount: 1100, paid_at: "2025-02-01", status: "active" },
  ],
};

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={14} color={KarateColors.ink3} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function DojoDetailScreen() {
  const { dojoId } = useLocalSearchParams<{ dojoId: string }>();
  const { federationId } = useKarateFederation();
  const [data, setData] = useState<DojoDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dojoId) return;
    karateApi.getDojo(federationId, dojoId)
      .then(setData)
      .catch(() => setData(MOCK_DETAIL))
      .finally(() => setLoading(false));
  }, [federationId, dojoId]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, padding: 16, gap: 12 }}>
        {[1,2,3,4].map((k) => <Skeleton key={k} height={24} />)}
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dojoId}>{data.fpkt_affiliation_id}</Text>
            <Text style={styles.dojoName}>{data.name}</Text>
          </View>
          <Badge dojoStatus={data.status as DojoStatus} />
        </View>
        <View style={styles.metaGrid}>
          <InfoRow icon="location-outline"  label="Região"   value={data.region} />
          <InfoRow icon="home-outline"      label="Fundação" value={data.dojo_founded_year ? String(data.dojo_founded_year) : null} />
          <InfoRow icon="call-outline"      label="Telefone" value={data.phone} />
          <InfoRow icon="mail-outline"      label="E-mail"   value={data.email} />
          <InfoRow icon="card-outline"      label="CNPJ"     value={data.cnpj} />
          <InfoRow icon="people-outline"    label="Praticantes" value={String(data.practitioner_count)} />
        </View>
      </View>

      {/* Equipe Técnica */}
      <Text style={styles.sectionTitle}>Equipe Técnica</Text>
      <View style={styles.card}>
        {data.technical_team.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum membro cadastrado.</Text>
        ) : (
          data.technical_team.map((m) => (
            <View key={m.practitioner_id} style={styles.teamRow}>
              <Ionicons name="person-outline" size={16} color={KarateColors.ink3} />
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName}>{m.name}</Text>
                <Text style={styles.teamRoles}>{m.roles.join(", ")} · {m.belt_level}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Histórico de Anuidades */}
      <Text style={styles.sectionTitle}>Anuidades</Text>
      <View style={styles.card}>
        {data.annuity_history.map((a, i) => (
          <View key={i} style={styles.annuityRow}>
            <Text style={styles.annuityPeriod}>{a.reference_period}</Text>
            <Text style={styles.annuityAmount}>R$ {a.amount.toFixed(2)}</Text>
            <Badge dojoStatus={a.status as DojoStatus} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content:      { padding: 16, gap: 12, paddingBottom: 32 } as ViewStyle,
  sectionTitle: { fontSize: 11, fontWeight: "800", color: KarateColors.ink3, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 8 } as TextStyle,
  headerCard:   { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 12 } as ViewStyle,
  headerRow:    { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  dojoId:       { fontSize: 11, fontWeight: "800", color: KarateColors.primary, letterSpacing: 0.8, fontFamily: "monospace" } as TextStyle,
  dojoName:     { fontSize: 18, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  metaGrid:     { gap: 8 } as ViewStyle,
  infoRow:      { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  infoLabel:    { fontSize: 12, color: KarateColors.ink3, width: 80 } as TextStyle,
  infoValue:    { fontSize: 13, color: KarateColors.ink, flex: 1 } as TextStyle,
  card:         { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 10 } as ViewStyle,
  emptyText:    { fontSize: 13, color: KarateColors.ink4, textAlign: "center", paddingVertical: 12 } as TextStyle,
  teamRow:      { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  teamName:     { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  teamRoles:    { fontSize: 11, color: KarateColors.ink3, marginTop: 2, textTransform: "capitalize" } as TextStyle,
  annuityRow:   { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  annuityPeriod:{ fontSize: 14, fontWeight: "700", color: KarateColors.ink, flex: 1, fontFamily: "monospace" } as TextStyle,
  annuityAmount:{ fontSize: 14, color: KarateColors.ink2 } as TextStyle,
});
