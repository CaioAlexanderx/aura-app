// ============================================================
// ContaAuraCard — Conta Aura do dojô (BaaS opt-in, F3b)
//
// GET /federation/:id/dojo/billing/baas. Feature atrás de flag no
// backend (enabled:false em produção até a homologação Asaas) —
// quando enabled:false OU a chamada falha (404/503/rede), o card não
// renderiza NADA (mesmo racional do PixConfigCard alwaysShow=false):
// degrade invisível, log só no console. Zero mudança visível em
// produção com a flag off.
//
// Estados (status):
//   • none         — card explicativo + CTA "Ativar Conta Aura" (abre
//                    o wizard KYC, ContaAuraWizardModal)
//   • created /
//     docs_pending  — "Ativação em andamento" + CTA "Enviar
//                    documentos" (abre onboarding_url externa)
//   • under_review  — "Em análise pela instituição"
//   • rejected      — mensagem + "Falar com suporte" (wa.me padrão do
//                    app, mesmo número de app/(tabs)/suporte.tsx)
//   • approved      — dados da conta (agência/conta-dígito, wallet
//                    mascarada) + seletor de recebimento (PUT
//                    /baas/provider, com confirmação inline ao trocar)
//
// Compliance (Res. BC 16/17): rodapé "Serviços financeiros prestados
// por Asaas I.P S.A." sempre que status !== 'none'.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, Linking, Platform, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import {
  karateDojoBillingApi, DojoBaasStatusResponse, DojoBillingProvider,
} from "@/services/karateDojoBillingApi";
import { mapBillingError, baasStatusView } from "../helpers";
import { ContaAuraWizardModal } from "./ContaAuraWizardModal";

interface Props {
  federationId: string;
}

const PROVIDER_LABELS: Record<DojoBillingProvider, string> = {
  pix_manual: "Chave PIX própria",
  baas: "Conta Aura (integrada)",
};

// Mesmo número usado em app/(tabs)/suporte.tsx (AURA_WA) — padrão do app.
const AURA_SUPPORT_WA = "5512991234567";

export function ContaAuraCard({ federationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<DojoBaasStatusResponse | null>(null);
  const [wizardVisible, setWizardVisible] = useState(false);

  const [pendingProvider, setPendingProvider] = useState<DojoBillingProvider | null>(null);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerErr, setProviderErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await karateDojoBillingApi.getBaas(federationId);
      setData(res);
    } catch (e: any) {
      // Degrade silencioso — a tela segue funcionando sem o card.
      if (__DEV__) console.warn("[ContaAuraCard] GET /baas indisponível — card oculto.", e);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  // Degrade invisível: sem federationId, carregando, com erro, sem dado
  // ou com a flag desligada, o card não existe pro usuário.
  if (!federationId || loading || failed || !data || !data.enabled) return null;

  const { status, onboarding_url, account, provider } = data;

  const confirmSwitchProvider = async () => {
    if (!pendingProvider) return;
    setProviderSaving(true);
    setProviderErr(null);
    try {
      const res = await karateDojoBillingApi.setBaasProvider(federationId, pendingProvider);
      setData((prev) => (prev ? { ...prev, provider: res.provider } : prev));
      setPendingProvider(null);
    } catch (e: any) {
      setProviderErr(mapBillingError(e).message);
    } finally {
      setProviderSaving(false);
    }
  };

  const openOnboarding = () => {
    if (!onboarding_url) return;
    if (Platform.OS === "web") window.open(onboarding_url, "_blank");
    else Linking.openURL(onboarding_url);
  };

  const openSupport = () => {
    const url = `https://wa.me/${AURA_SUPPORT_WA}?text=${encodeURIComponent(
      "Olá! Minha ativação da Conta Aura foi recusada e preciso de ajuda."
    )}`;
    if (Platform.OS === "web") window.open(url, "_blank");
    else Linking.openURL(url);
  };

  const view = status === "none" ? null : baasStatusView(status);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.titleGroup}>
          <Icon name="wallet" size={16} color={view ? view.color : KarateColors.primary} />
          <Text style={styles.cardTitle}>Conta Aura</Text>
        </View>
        {!!view && (
          <View style={[styles.badge, { backgroundColor: view.bg }]}>
            <Icon name={view.icon} size={12} color={view.color} />
            <Text style={[styles.badgeTxt, { color: view.color }]}>{view.label}</Text>
          </View>
        )}
      </View>

      {status === "none" && (
        <>
          <Text style={styles.cardSub}>
            Receba as mensalidades com conciliação automática — o pagamento baixa sozinho. Taxas: R$1,99 + 0,5% por PIX recebido, sem mensalidade extra.
          </Text>
          <KarateButton
            label="Ativar Conta Aura"
            variant="secondary"
            size="sm"
            onPress={() => setWizardVisible(true)}
            style={{ alignSelf: "flex-start", marginTop: 8 }}
          />
        </>
      )}

      {(status === "created" || status === "docs_pending") && (
        <>
          <Text style={styles.cardSub}>
            {status === "docs_pending"
              ? "Faltam documentos para concluir o cadastro da Conta Aura."
              : "Seu cadastro foi enviado e está sendo processado."}
          </Text>
          {!!onboarding_url && (
            <KarateButton
              label="Enviar documentos"
              variant="secondary"
              size="sm"
              onPress={openOnboarding}
              style={{ alignSelf: "flex-start", marginTop: 8 }}
            />
          )}
        </>
      )}

      {status === "under_review" && (
        <Text style={styles.cardSub}>
          Seus documentos foram enviados. A instituição financeira está analisando o cadastro — isso pode levar alguns dias úteis.
        </Text>
      )}

      {status === "rejected" && (
        <>
          <Text style={styles.cardSub}>
            O cadastro da Conta Aura não foi aprovado pela instituição financeira. Fale com o nosso suporte para entender o motivo e tentar novamente.
          </Text>
          <TouchableOpacity onPress={openSupport} accessibilityRole="button" style={styles.waBtn}>
            <Icon name="whatsapp" size={14} color="#fff" />
            <Text style={styles.waBtnTxt}>Falar com suporte</Text>
          </TouchableOpacity>
        </>
      )}

      {status === "approved" && (
        <View style={{ gap: 10 }}>
          {!!account && (
            <View style={styles.accountBox}>
              <Text style={styles.accountRow}>Agência: <Text style={styles.accountVal}>{account.agency}</Text></Text>
              <Text style={styles.accountRow}>Conta: <Text style={styles.accountVal}>{account.account}-{account.account_digit}</Text></Text>
              <Text style={styles.accountRow}>Carteira: <Text style={styles.accountVal}>{account.wallet_id_masked}</Text></Text>
            </View>
          )}

          <View>
            <Text style={styles.label}>Recebimento das mensalidades</Text>
            <View style={styles.chips}>
              {(Object.keys(PROVIDER_LABELS) as DojoBillingProvider[]).map((key) => {
                const checked = provider === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.chip, checked && styles.chipOn]}
                    onPress={() => { if (!checked) { setPendingProvider(key); setProviderErr(null); } }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked }}
                  >
                    <Text style={[styles.chipTxt, checked && styles.chipTxtOn]}>{PROVIDER_LABELS[key]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {!!pendingProvider && (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTxt}>
                As próximas cobranças Pix serão recebidas em: <Text style={{ fontWeight: "800" }}>{PROVIDER_LABELS[pendingProvider]}</Text>.
              </Text>
              {!!providerErr && <Text style={styles.errTxt}>{providerErr}</Text>}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => { setPendingProvider(null); setProviderErr(null); }} style={{ flex: 1 }} />
                <KarateButton label="Confirmar" variant="sumi" size="sm" onPress={confirmSwitchProvider} loading={providerSaving} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </View>
      )}

      {status !== "none" && (
        <Text style={styles.compliance}>Serviços financeiros prestados por Asaas I.P S.A.</Text>
      )}

      <ContaAuraWizardModal
        visible={wizardVisible}
        federationId={federationId}
        onClose={() => setWizardVisible(false)}
        onActivated={() => { setWizardVisible(false); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md,
    borderWidth: 1, borderColor: KarateColors.border, padding: 14,
  } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" } as ViewStyle,
  titleGroup: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 } as ViewStyle,
  badgeTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,
  cardSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 6, lineHeight: 18 } as TextStyle,
  waBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#25D366", borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 14, alignSelf: "flex-start", marginTop: 10 } as ViewStyle,
  waBtnTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" } as TextStyle,
  accountBox: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, padding: 10, gap: 4 } as ViewStyle,
  accountRow: { fontSize: 12.5, color: KarateColors.ink2 } as TextStyle,
  accountVal: { fontWeight: "700", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  label: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, letterSpacing: 0.2, marginBottom: 6 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  chipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  confirmBox: { backgroundColor: KarateColors.warnSoft, borderRadius: KarateRadius.sm, padding: 10 } as ViewStyle,
  confirmTxt: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  errTxt: { fontSize: 12, color: KarateColors.danger, marginTop: 6, fontWeight: "600" } as TextStyle,
  compliance: { fontSize: 10.5, color: KarateColors.ink4, marginTop: 10, lineHeight: 14 } as TextStyle,
});
