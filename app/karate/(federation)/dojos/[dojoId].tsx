// ============================================================
// Detalhe do Dojô — Aura Karatê (federação)
//
// Cadastro, equipe técnica e histórico de anuidades.
// Dados reais via GET /federation/{id}/dojos/{dojoId}. Sem mock:
// loading → skeleton, falha → ErrorState.
// ============================================================
import React, { useEffect, useState, useCallback } from "react";
import {
  ScrollView, View, Text, StyleSheet,
  ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { Badge } from "@/components/karate/Badge";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { karateApi, DojoDetail, AffiliationModel } from "@/services/karateApi";
import { useKarateFederation } from "@/contexts/KarateFederation";

const MODEL_LABEL: Record<AffiliationModel, string> = {
  annual: "Anual", biannual: "Semestral", quarterly: "Trimestral",
};
const ROLE_LABEL: Record<string, string> = {
  instructor: "Instrutor", arbiter: "Árbitro", examiner: "Examinador",
  sensei: "Sensei", senpai: "Senpai", assistant: "Auxiliar",
};
const roleLabel = (r: string) => ROLE_LABEL[r] ?? r;

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
const fmtMoney = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function KV({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{label}</Text>
      <Text style={styles.kvVal}>{value}</Text>
    </View>
  );
}

export default function DojoDetailScreen() {
  const { dojoId } = useLocalSearchParams<{ dojoId: string }>();
  const { federationId } = useKarateFederation();
  const [data, setData] = useState<DojoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!dojoId) return;
    setLoading(true);
    setError(false);
    karateApi.getDojo(federationId, dojoId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [federationId, dojoId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, padding: 24, gap: 12 }}>
        {[1, 2, 3, 4].map((k) => <Skeleton key={k} height={24} />)}
      </View>
    );
  }
  if (error || !data) {
    return <KarateErrorState onRetry={load} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Page head */}
      <View style={styles.pageHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Detalhe · {data.fpkt_affiliation_id}</Text>
          <Text style={styles.h1}>{data.name}</Text>
          <Text style={styles.sub}>
            {data.region || "—"} · {MODEL_LABEL[data.affiliation_model] ?? "—"}
          </Text>
        </View>
        <Badge dojoStatus={data.status} />
      </View>

      {/* Cadastro */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cadastro</Text>
        <KV label="Nome do dojô" value={data.name} />
        <KV label="Código FPKT" value={data.fpkt_affiliation_id} />
        <KV label="CNPJ" value={data.cnpj} />
        <KV label="Endereço" value={data.address} />
        <KV label="Telefone" value={data.phone} />
        <KV label="E-mail" value={data.email} />
        <KV label="Região" value={data.region} />
        <KV label="Fundação" value={data.dojo_founded_year ? String(data.dojo_founded_year) : null} />
        <KV label="Filiação desde" value={fmtDate(data.affiliation_since)} />
        <KV label="Modelo" value={MODEL_LABEL[data.affiliation_model] ?? null} />
        <KV label="Praticantes" value={String(data.practitioner_count)} />
      </View>

      {/* Equipe técnica */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Equipe técnica</Text>
        {data.technical_team.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum membro técnico cadastrado.</Text>
        ) : (
          data.technical_team.map((m, i) => (
            <View key={m.practitioner_id} style={[styles.teamRow, i === data.technical_team.length - 1 && styles.noBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName}>{m.name}</Text>
                <Text style={styles.teamRoles}>{m.roles.map(roleLabel).join(" · ") || "Membro"}</Text>
              </View>
              <BeltBadge beltLevel={m.belt_level} beltName={m.belt_level} />
            </View>
          ))
        )}
      </View>

      {/* Anuidades */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Anuidades</Text>
        {data.annuity_history.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma anuidade registrada.</Text>
        ) : (
          data.annuity_history.map((a, i) => (
            <View key={i} style={[styles.annuityRow, i === data.annuity_history.length - 1 && styles.noBorder]}>
              <Text style={styles.annuityPeriod}>{a.reference_period}</Text>
              <View style={{ flex: 1 }}>
                {a.paid_at ? <Text style={styles.annuityPaid}>Pago em {fmtDate(a.paid_at)}</Text> : <Text style={styles.annuityDue}>Em aberto</Text>}
              </View>
              <Text style={styles.annuityAmount}>{fmtMoney(a.amount)}</Text>
              <Badge dojoStatus={a.status} />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, paddingBottom: 56, maxWidth: 860, width: "100%", alignSelf: "center" } as ViewStyle,

  pageHead: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 } as ViewStyle,
  eyebrow:  { fontSize: 11, fontWeight: "700", color: KarateColors.primary, letterSpacing: 0.8, fontFamily: "monospace" } as TextStyle,
  h1:       { fontSize: 26, fontWeight: "800", color: KarateColors.ink, marginTop: 6 } as TextStyle,
  sub:      { fontSize: 13, color: KarateColors.ink2, marginTop: 6 } as TextStyle,

  card:      { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, padding: 18, marginBottom: 16 } as ViewStyle,
  cardTitle: { fontSize: 15, fontWeight: "800", color: KarateColors.ink, marginBottom: 12 } as TextStyle,
  emptyText: { fontSize: 13, color: KarateColors.ink3, paddingVertical: 8 } as TextStyle,

  kvRow: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: KarateColors.border, gap: 16 } as ViewStyle,
  kvKey: { width: 130, fontSize: 11, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.4 } as TextStyle,
  kvVal: { flex: 1, fontSize: 13, color: KarateColors.ink } as TextStyle,

  noBorder: { borderBottomWidth: 0 } as ViewStyle,
  teamRow:  { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  teamName: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  teamRoles:{ fontSize: 11.5, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  annuityRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  annuityPeriod: { fontSize: 14, fontWeight: "800", color: KarateColors.ink, width: 56, fontVariant: ["tabular-nums"] } as TextStyle,
  annuityPaid:   { fontSize: 11.5, color: KarateColors.ok } as TextStyle,
  annuityDue:    { fontSize: 11.5, color: KarateColors.alert } as TextStyle,
  annuityAmount: { fontSize: 13.5, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
});
