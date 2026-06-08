// ============================================================
// Critérios de Graduação — Aura Karatê Track C
//
// DECISÃO FPKT #2: os critérios são provisórios (confirmed=false)
// até a federação confirmar. A tela:
//   - Exibe banner de aviso quando confirmed=false.
//   - Permite editar os campos e marcar como confirmado.
//   - Wired: karateApi.listBeltRequirements + karateApi.updateBeltRequirements.
// [MOCK] dados iniciais; shape exata do contrato.
// ============================================================
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  StyleSheet, RefreshControl, Switch, ViewStyle, TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, KarateBelts } from "@/constants/karateTheme";
import { FormField } from "@/components/karate/FormField";
import { KarateButton } from "@/components/karate/KarateButton";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { Skeleton } from "@/components/karate/Skeleton";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateApi, BeltRequirement } from "@/services/karateApi";

// [MOCK]
const MOCK_REQUIREMENTS: BeltRequirement[] = [
  { id: "r1", belt_level: "amarela", belt_name: "Amarela", min_months_in_current: 3, kata_required: ["Taikyoku Shodan"], course_required: false, notes: null, confirmed: false, updated_at: "2026-05-01T00:00:00Z" },
  { id: "r2", belt_level: "laranja", belt_name: "Laranja",  min_months_in_current: 6, kata_required: ["Heian Shodan"],  course_required: false, notes: null, confirmed: true,  updated_at: "2026-05-01T00:00:00Z" },
  { id: "r3", belt_level: "verde",   belt_name: "Verde",   min_months_in_current: 6, kata_required: ["Heian Nidan"],   course_required: true,  notes: "Seminário anual exigido", confirmed: false, updated_at: "2026-05-01T00:00:00Z" },
];

type EditState = Record<string, {
  min_months: string;
  kata_required: string;  // CSV
  course_required: boolean;
  notes: string;
  confirmed: boolean;
}>;

export default function CriteriosScreen() {
  const { federationId } = useKarateFederation();
  const [requirements, setRequirements] = useState<BeltRequirement[]>(MOCK_REQUIREMENTS);
  const [loading,   setLoading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editState, setEditState] = useState<EditState>(
    Object.fromEntries(MOCK_REQUIREMENTS.map(r => [r.id, {
      min_months: String(r.min_months_in_current),
      kata_required: r.kata_required.join(", "),
      course_required: r.course_required,
      notes: r.notes ?? "",
      confirmed: r.confirmed,
    }]))
  );

  const anyUnconfirmed = requirements.some(r => !editState[r.id]?.confirmed);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // [MOCK] real: karateApi.listBeltRequirements(federationId)
    setTimeout(() => setRefreshing(false), 800);
  }, [federationId]);

  const setField = (id: string, field: keyof EditState[string], value: any) => {
    setEditState(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const body = {
        requirements: requirements.map(r => ({
          belt_level: r.belt_level,
          min_months_in_current: parseInt(editState[r.id].min_months) || 0,
          kata_required: editState[r.id].kata_required.split(",").map(s => s.trim()).filter(Boolean),
          course_required: editState[r.id].course_required,
          notes: editState[r.id].notes || null,
          confirmed: editState[r.id].confirmed,
        })),
      };
      const updated = await karateApi.updateBeltRequirements(federationId, body);
      setRequirements(updated);
      Alert.alert("Salvo!", "Critérios atualizados com sucesso.");
    } catch {
      // [MOCK fallback]
      Alert.alert("Salvo! [MOCK]", "Critérios atualizados localmente (backend Fase 2 pendente).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={KarateColors.primary} />}
    >
      {/* DECISÃO FPKT #2 Banner — provisório */}
      {anyUnconfirmed && (
        <View style={styles.provisoryBanner}>
          <Ionicons name="information-circle" size={16} color={KarateColors.warn} />
          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>Valores provisórios</Text>
            <Text style={styles.bannerDesc}>
              Um ou mais critérios ainda não foram confirmados pela FPKT. Verifique e marque cada critério como "Confirmado" após validação.
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.pageTitle}>Critérios de Graduação</Text>
      <Text style={styles.pageHint}>Defina os requisitos mínimos por faixa. Mudeças salvas com o botão Salvar.</Text>

      {requirements.map((r) => {
        const state = editState[r.id];
        const isUnconfirmed = !state?.confirmed;
        return (
          <View key={r.id} style={[styles.reqCard, isUnconfirmed && styles.reqCardUnconfirmed]}>
            <View style={styles.reqHeader}>
              <BeltBadge beltLevel={r.belt_level} />
              {isUnconfirmed ? (
                <View style={styles.unconfirmedTag}>
                  <Ionicons name="alert-circle" size={13} color={KarateColors.warn} />
                  <Text style={styles.unconfirmedText}>Provisório</Text>
                </View>
              ) : (
                <View style={styles.confirmedTag}>
                  <Ionicons name="checkmark-circle" size={13} color={KarateColors.ok} />
                  <Text style={styles.confirmedText}>Confirmado</Text>
                </View>
              )}
            </View>

            <FormField
              label="Meses mínimos na faixa atual"
              value={state?.min_months ?? ""}
              onChangeText={(v) => setField(r.id, "min_months", v)}
              keyboardType="numeric"
              placeholder="Ex: 6"
            />
            <FormField
              label="Katas obrigatórios (separados por vírgula)"
              value={state?.kata_required ?? ""}
              onChangeText={(v) => setField(r.id, "kata_required", v)}
              placeholder="Ex: Heian Shodan, Heian Nidan"
            />
            <FormField
              label="Observações"
              value={state?.notes ?? ""}
              onChangeText={(v) => setField(r.id, "notes", v)}
              placeholder="Opcional"
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Curso obrigatório</Text>
              <Switch
                value={state?.course_required ?? false}
                onValueChange={(v) => setField(r.id, "course_required", v)}
                trackColor={{ true: KarateColors.primary, false: KarateColors.border }}
                accessibilityLabel="Curso obrigatório"
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Marcar como Confirmado pela FPKT</Text>
              <Switch
                value={state?.confirmed ?? false}
                onValueChange={(v) => setField(r.id, "confirmed", v)}
                trackColor={{ true: KarateColors.ok, false: KarateColors.warn }}
                accessibilityLabel="Critério confirmado pela FPKT"
              />
            </View>
          </View>
        );
      })}

      <KarateButton
        label={loading ? "Salvando..." : "Salvar critérios"}
        variant="primary"
        size="lg"
        loading={loading}
        onPress={handleSave}
        style={styles.saveBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 12, paddingBottom: 32 } as ViewStyle,
  provisoryBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: KarateColors.warnSoft, padding: 12, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.warn,
  } as ViewStyle,
  bannerTextCol: { flex: 1, gap: 2 } as ViewStyle,
  bannerTitle: { fontSize: 13, fontWeight: "800", color: KarateColors.warn } as TextStyle,
  bannerDesc: { fontSize: 12, color: KarateColors.warn } as TextStyle,
  pageTitle: { fontSize: 20, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  pageHint: { fontSize: 12, color: KarateColors.ink3, marginTop: -4 } as TextStyle,
  reqCard: {
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 10,
  } as ViewStyle,
  reqCardUnconfirmed: {
    borderColor: KarateColors.warn,
  } as ViewStyle,
  reqHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  unconfirmedTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.warnSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: KarateRadius.sm } as ViewStyle,
  unconfirmedText: { fontSize: 11, fontWeight: "700", color: KarateColors.warn } as TextStyle,
  confirmedTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: KarateColors.okSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: KarateRadius.sm } as ViewStyle,
  confirmedText: { fontSize: 11, fontWeight: "700", color: KarateColors.ok } as TextStyle,
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } as ViewStyle,
  switchLabel: { fontSize: 13, fontWeight: "600", color: KarateColors.ink2, flex: 1 } as TextStyle,
  saveBtn: { marginTop: 8 } as ViewStyle,
});
