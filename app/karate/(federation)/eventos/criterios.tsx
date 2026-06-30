// ============================================================
// Critérios de Graduação — Aura Karatê (federação)
//
// DECISÃO FPKT #2: critérios podem ser provisórios (confirmed=false)
// até a federação confirmar. Banner de aviso + edição + confirmar.
// Dados reais via karateApi.listBeltRequirements + updateBeltRequirements.
// Sem mock: loading → skeleton, falha → ErrorState, save honesto.
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Alert,
  StyleSheet, RefreshControl, Switch, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { FormField } from "@/components/karate/FormField";
import { KarateButton } from "@/components/karate/KarateButton";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateApi, BeltRequirement } from "@/services/karateApi";

type EditEntry = {
  min_months: string;
  kata_required: string; // CSV
  course_required: boolean;
  notes: string;
  confirmed: boolean;
};
type EditState = Record<string, EditEntry>;

function buildEditState(reqs: BeltRequirement[]): EditState {
  return Object.fromEntries(reqs.map((r) => [r.id, {
    min_months: String(r.min_months_in_current),
    kata_required: r.kata_required.join(", "),
    course_required: r.course_required,
    notes: r.notes ?? "",
    confirmed: r.confirmed,
  }]));
}

export default function CriteriosScreen() {
  const { federationId } = useKarateFederation();
  const [requirements, setRequirements] = useState<BeltRequirement[]>([]);
  const [editState, setEditState] = useState<EditState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      const reqs = await karateApi.listBeltRequirements(federationId);
      setRequirements(reqs);
      setEditState(buildEditState(reqs));
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const anyUnconfirmed = requirements.some((r) => !editState[r.id]?.confirmed);
  const setField = (id: string, field: keyof EditEntry, value: any) =>
    setEditState((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        requirements: requirements.map((r) => ({
          belt_level: r.belt_level,
          min_months_in_current: parseInt(editState[r.id].min_months) || 0,
          kata_required: editState[r.id].kata_required.split(",").map((s) => s.trim()).filter(Boolean),
          course_required: editState[r.id].course_required,
          notes: editState[r.id].notes || null,
          confirmed: editState[r.id].confirmed,
        })),
      };
      const updated = await karateApi.updateBeltRequirements(federationId, body);
      setRequirements(updated);
      setEditState(buildEditState(updated));
      Alert.alert("Salvo!", "Critérios atualizados com sucesso.");
    } catch (e: any) {
      Alert.alert("Não foi possível salvar", e?.message ?? "Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, padding: 24, gap: 12 }}>
        {[1, 2, 3].map((k) => <Skeleton key={k} height={120} />)}
      </View>
    );
  }
  if (error) return <KarateErrorState onRetry={() => load()} />;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={KarateColors.primary} />}
    >
      {anyUnconfirmed && (
        <View style={styles.provisoryBanner}>
          <Icon name="information-circle" size={16} color={KarateColors.warn} />
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>Valores provisórios</Text>
            <Text style={styles.bannerDesc}>
              Um ou mais critérios ainda não foram confirmados pela FPKT. Verifique e marque cada critério como "Confirmado" após validação.
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.pageTitle}>Critérios de Graduação</Text>
      <Text style={styles.pageHint}>Defina os requisitos mínimos por faixa. Mudanças salvas com o botão Salvar.</Text>

      {requirements.length === 0 ? (
        <KarateEmptyState icon="list-outline" title="Nenhum critério definido" subtitle="Os requisitos por faixa aparecem aqui quando configurados." style={{ paddingVertical: 32 }} />
      ) : (
        requirements.map((r) => {
          const state = editState[r.id];
          const isUnconfirmed = !state?.confirmed;
          return (
            <View key={r.id} style={[styles.reqCard, isUnconfirmed && styles.reqCardUnconfirmed]}>
              <View style={styles.reqHeader}>
                <BeltBadge beltLevel={r.belt_level} beltName={r.belt_name} />
                {isUnconfirmed ? (
                  <View style={styles.unconfirmedTag}>
                    <Icon name="alert-circle" size={13} color={KarateColors.warn} />
                    <Text style={styles.unconfirmedText}>Provisório</Text>
                  </View>
                ) : (
                  <View style={styles.confirmedTag}>
                    <Icon name="checkmark-circle" size={13} color={KarateColors.ok} />
                    <Text style={styles.confirmedText}>Confirmado</Text>
                  </View>
                )}
              </View>

              <FormField label="Meses mínimos na faixa atual" value={state?.min_months ?? ""} onChangeText={(v) => setField(r.id, "min_months", v)} keyboardType="numeric" placeholder="Ex: 6" />
              <FormField label="Kaatas obrigatórios (separados por vírgula)" value={state?.kata_required ?? ""} onChangeText={(v) => setField(r.id, "kata_required", v)} placeholder="Ex: Heian Shodan, Heian Nidan" />
              <FormField label="Observações" value={state?.notes ?? ""} onChangeText={(v) => setField(r.id, "notes", v)} placeholder="Opcional" />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Curso obrigatório</Text>
                <Switch value={state?.course_required ?? false} onValueChange={(v) => setField(r.id, "course_required", v)} trackColor={{ true: KarateColors.primary, false: KarateColors.border }} accessibilityLabel="Curso obrigatório" />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Marcar como Confirmado pela FPKT</Text>
                <Switch value={state?.confirmed ?? false} onValueChange={(v) => setField(r.id, "confirmed", v)} trackColor={{ true: KarateColors.ok, false: KarateColors.warn }} accessibilityLabel="Critério confirmado pela FPKT" />
              </View>
            </View>
          );
        })
      )}

      {requirements.length > 0 && (
        <KarateButton label={saving ? "Salvando..." : "Salvar critérios"} variant="primary" size="lg" loading={saving} onPress={handleSave} style={styles.saveBtn} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 24, gap: 12, paddingBottom: 40, maxWidth: 860, width: "100%", alignSelf: "center" } as ViewStyle,
  provisoryBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: KarateColors.warnSoft, padding: 12, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.warn } as ViewStyle,
  bannerTextCol: { flex: 1, gap: 2 } as ViewStyle,
  bannerTitle: { fontSize: 13, fontWeight: "800", color: KarateColors.warn } as TextStyle,
  bannerDesc: { fontSize: 12, color: KarateColors.warn } as TextStyle,
  pageTitle: { fontFamily: KarateFonts.heading, fontSize: 24, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  pageHint: { fontSize: 12, color: KarateColors.ink3, marginTop: -4 } as TextStyle,
  reqCard: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 10 } as ViewStyle,
  reqCardUnconfirmed: { borderColor: KarateColors.warn } as ViewStyle,
  reqHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  unconfirmedTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.warnSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: KarateRadius.sm } as ViewStyle,
  unconfirmedText: { fontSize: 11, fontWeight: "700", color: KarateColors.warn } as TextStyle,
  confirmedTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.okSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: KarateRadius.sm } as ViewStyle,
  confirmedText: { fontSize: 11, fontWeight: "700", color: KarateColors.ok } as TextStyle,
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  switchLabel: { fontSize: 13, fontWeight: "600", color: KarateColors.ink2, flex: 1 } as TextStyle,
  saveBtn: { marginTop: 8 } as ViewStyle,
});
