// ============================================================
// CobrancasTab — aba "Cobranças" da tela Mensalidades (F3a)
//
// Dono do estado da competência selecionada, da lista de cobranças (com
// summary) e dos modais de ação (Pix, confirmar, cancelar) — todos
// irmãos, nunca aninhados. Também decide o estado vazio:
//   • nenhuma assinatura no dojô (GET /subscriptions vazio)  → CTA pra
//     aba Planos ("Definir planos e mensalidades")
//   • há assinatura(s) mas o mês não foi gerado ainda        → CTA
//     "Gerar cobranças do mês" (mesmo botão do cabeçalho)
//
// F3b: ContaAuraCard logo abaixo do PixConfigCard — degrade invisível
// quando a flag BaaS está desligada (ver componentes/contaAura).
// F3c: federationId/dojoName repassados pro ChargesList (botão de
// WhatsApp rápido nas vencidas).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useKarateDojo } from "@/contexts/KarateDojo";
import {
  karateDojoBillingApi, DojoCharge, DojoChargesSummary,
} from "@/services/karateDojoBillingApi";
import { currentCompetence, mapBillingError } from "./helpers";
import { PixConfigCard } from "./PixConfigCard";
import { ContaAuraCard } from "./contaAura/ContaAuraCard";
import { CompetenceSelector } from "./CompetenceSelector";
import { SummaryCards } from "./SummaryCards";
import { GenerateChargesCard } from "./GenerateChargesCard";
import { ChargesList } from "./ChargesList";
import { ChargePixModal } from "./ChargePixModal";
import { ChargeActionModal } from "./ChargeActionModal";

interface Props {
  onGoToPlanos: () => void;
}

export function CobrancasTab({ onGoToPlanos }: Props) {
  const { federationId } = useKarateFederation();
  const { dojoName } = useKarateDojo();

  const [competence, setCompetence] = useState(currentCompetence());
  const [charges, setCharges] = useState<DojoCharge[]>([]);
  const [summary, setSummary] = useState<DojoChargesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subsCount, setSubsCount] = useState<number | null>(null);

  const [pixCharge, setPixCharge] = useState<DojoCharge | null>(null);
  const [actionCharge, setActionCharge] = useState<DojoCharge | null>(null);
  const [actionMode, setActionMode] = useState<"confirm" | "cancel">("confirm");

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await karateDojoBillingApi.listCharges(federationId, { competence });
      setCharges(res.data ?? []);
      setSummary(res.summary ?? null);
    } catch (e: any) {
      setError(mapBillingError(e).message);
    } finally {
      setLoading(false);
    }
    // Contagem de assinaturas só importa pro estado vazio — busca solta,
    // falha silenciosa (mantém subsCount null e cai no CTA genérico).
    try {
      const subs = await karateDojoBillingApi.listSubscriptions(federationId);
      setSubsCount((subs.data ?? []).filter((s) => !s.canceled_at).length);
    } catch {
      setSubsCount(null);
    }
  }, [federationId, competence]);

  useEffect(() => { load(); }, [load]);

  if (!federationId) return null;

  const noSubscriptions = subsCount === 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <PixConfigCard federationId={federationId} />
      <ContaAuraCard federationId={federationId} />

      <View style={styles.headerRow}>
        <CompetenceSelector competence={competence} onChange={setCompetence} />
      </View>

      <GenerateChargesCard federationId={federationId} competence={competence} onGenerated={load} />

      <SummaryCards summary={summary} loading={loading} />

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

      {!loading && !error && noSubscriptions && (
        <View style={styles.stateBox}>
          <Icon name="wallet" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhum aluno tem mensalidade configurada ainda.</Text>
          <Text style={styles.stateSub}>
            Crie um plano e assine os alunos (na ficha de cada aluno, ou aqui na aba Planos) antes de gerar cobranças.
          </Text>
          <KarateButton label="Definir planos e mensalidades" variant="sumi" size="md" onPress={onGoToPlanos} style={{ marginTop: 4 }} />
        </View>
      )}

      {!loading && !error && !noSubscriptions && charges.length === 0 && (
        <View style={styles.stateBox}>
          <Icon name="receipt" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhuma cobrança gerada para este mês ainda.</Text>
          <Text style={styles.stateSub}>Toque em "Gerar cobranças" acima para criar as cobranças das assinaturas ativas.</Text>
        </View>
      )}

      {!loading && !error && !noSubscriptions && charges.length > 0 && (
        <ChargesList
          charges={charges}
          federationId={federationId}
          dojoName={dojoName}
          onOpenPix={setPixCharge}
          onOpenConfirm={(c) => { setActionMode("confirm"); setActionCharge(c); }}
          onOpenCancel={(c) => { setActionMode("cancel"); setActionCharge(c); }}
        />
      )}

      <ChargePixModal
        visible={!!pixCharge}
        federationId={federationId}
        dojoName={dojoName}
        charge={pixCharge}
        onClose={() => setPixCharge(null)}
      />
      <ChargeActionModal
        visible={!!actionCharge}
        mode={actionMode}
        federationId={federationId}
        charge={actionCharge}
        onClose={() => setActionCharge(null)}
        onDone={load}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 } as ViewStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 32 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 380, lineHeight: 17 } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
});
