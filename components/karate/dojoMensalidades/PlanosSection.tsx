// ============================================================
// PlanosSection — aba "Planos" da tela Mensalidades (F3a)
//
// CRUD de planos (nome, valor, dia de vencimento, ativo) + contagem de
// alunos assinantes por plano (students_count, do backend). Dono do
// estado da lista + do PlanoFormModal (irmão, não aninhado).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateDojoBillingApi, DojoBillingPlan } from "@/services/karateDojoBillingApi";
import { fmtBRL, mapBillingError } from "./helpers";
import { PlanoFormModal } from "./PlanoFormModal";

export function PlanosSection() {
  const { federationId } = useKarateFederation();
  const [plans, setPlans] = useState<DojoBillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formPlan, setFormPlan] = useState<DojoBillingPlan | null>(null);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await karateDojoBillingApi.listPlans(federationId);
      setPlans(res.data ?? []);
    } catch (e: any) {
      setError(mapBillingError(e).message);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  if (!federationId) return null;

  const toggleActive = async (plan: DojoBillingPlan) => {
    setTogglingId(plan.id);
    try {
      await karateDojoBillingApi.updatePlan(federationId, plan.id, { active: !plan.active });
      await load();
    } catch {
      // silencioso — a linha simplesmente não muda; usuário pode tentar de novo
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {plans.length > 0 && !loading && (
        <View style={styles.actionsRow}>
          <KarateButton label="Novo plano" variant="sumi" size="sm" onPress={() => { setFormPlan(null); setFormOpen(true); }} />
        </View>
      )}

      {loading && (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={KarateColors.primary} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.stateBox}>
          <Icon name="alert" size={26} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && plans.length === 0 && (
        <View style={styles.stateBox}>
          <Icon name="wallet" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhum plano cadastrado ainda.</Text>
          <Text style={styles.stateSub}>Crie um plano (ex.: "Mensalidade padrão", R$ 140, dia 10) para começar a assinar alunos.</Text>
          <KarateButton label="Criar primeiro plano" variant="sumi" size="md" onPress={() => { setFormPlan(null); setFormOpen(true); }} style={{ marginTop: 4 }} />
        </View>
      )}

      {!loading && !error && plans.map((p) => (
        <View key={p.id} style={styles.row}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={styles.nome} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.meta}>
              {fmtBRL(p.amount)} · dia {p.due_day} · {p.students_count} aluno{p.students_count === 1 ? "" : "s"}
            </Text>
          </View>

          <View style={[styles.status, p.active ? styles.statusOk : styles.statusOff]}>
            <Icon name={p.active ? "check_circle" : "x"} size={12} color={p.active ? KarateColors.ok : KarateColors.ink3} />
            <Text style={[styles.statusTxt, { color: p.active ? KarateColors.ok : KarateColors.ink3 }]}>{p.active ? "Ativo" : "Inativo"}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actBtn} onPress={() => { setFormPlan(p); setFormOpen(true); }} accessibilityRole="button" accessibilityLabel={`Editar ${p.name}`}>
              <Icon name="edit" size={14} color={KarateColors.ink2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actBtn}
              onPress={() => toggleActive(p)}
              disabled={togglingId === p.id}
              accessibilityRole="button"
              accessibilityLabel={p.active ? `Inativar ${p.name}` : `Ativar ${p.name}`}
            >
              {togglingId === p.id ? (
                <ActivityIndicator size="small" color={KarateColors.primary} />
              ) : (
                <Icon name="power" size={14} color={p.active ? KarateColors.danger : KarateColors.ok} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <PlanoFormModal
        visible={formOpen}
        federationId={federationId}
        plan={formPlan}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); setFormPlan(null); load(); }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  actionsRow: { flexDirection: "row", justifyContent: "flex-end" } as ViewStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 32 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 360, lineHeight: 17 } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  row: {
    flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap",
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 12,
  } as ViewStyle,
  nome: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  meta: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  status: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: KarateColors.bg2 } as ViewStyle,
  statusOk: { backgroundColor: KarateColors.okSoft } as ViewStyle,
  statusOff: { backgroundColor: KarateColors.bg2 } as ViewStyle,
  statusTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,
  actions: { flexDirection: "row", gap: 6 } as ViewStyle,
  actBtn: {
    width: 30, height: 30, borderRadius: KarateRadius.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border,
  } as ViewStyle,
});
