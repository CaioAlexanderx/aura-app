// ============================================================
// WhatsAppCloudSection — aba "WhatsApp" da tela Mensalidades (Onda 5b)
//
// Canal oficial de cobrança por WhatsApp: templates aprovados pela Meta
// disparados pela Cloud API. Contrato Aura-backend (services/waApi.ts):
//   GET  /companies/:companyId/whatsapp/status
//   GET  /companies/:companyId/whatsapp/templates
//   POST /companies/:companyId/whatsapp/templates/sync
//   GET  /companies/:companyId/whatsapp/outbox
//   POST /companies/:companyId/whatsapp/test-send
//
// No karatê o dojô É uma company — companyId = id da company do sensei
// logado (useAuthStore().company.id).
//
// Isto NÃO substitui a fila manual wa.me da aba Régua: aquela abre o
// WhatsApp do sensei com a mensagem pronta e continua funcionando sem
// nenhuma configuração. Esta seção é o canal automático, que exige
// número conectado + template aprovado.
//
// Dois estados vazios elegantes, nunca erro cru:
//   • schema_pending: true no /status → migration pendente no ambiente
//   • 409 NAO_CONECTADO nas demais rotas → falta WABA/token
// A lista de templates é carregada AQUI (e não dentro do card) porque o
// bloco de envio de teste precisa dos aprovados — uma busca só.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useAuthStore } from "@/stores/auth";
import { waApi, WaStatus, WaTemplate } from "@/services/waApi";
import { fmtPhoneBR, mapWaError, waQueueChips } from "./helpers";
import { WaTemplatesCard } from "./WaTemplatesCard";
import { WaTestSendCard } from "./WaTestSendCard";
import { WaOutboxCard } from "./WaOutboxCard";

export function WhatsAppCloudSection() {
  const company = useAuthStore((s) => s.company) as any;
  const companyId: string | null = company?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [tplNotConnected, setTplNotConnected] = useState(false);
  const [tplError, setTplError] = useState<string | null>(null);

  // Incrementa após um envio de teste — a fila precisa refletir o item novo.
  const [outboxKey, setOutboxKey] = useState(0);

  const loadStatus = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setStatus(await waApi.getStatus(companyId));
    } catch (e: any) {
      const mapped = mapWaError(e);
      // Sem conexão configurada o status ainda deveria responder; se não
      // responder, tratamos como "não conectado" em vez de erro cru.
      if (mapped.code === "NAO_CONECTADO") {
        setStatus({ connected: false, phone_display: null, waba_id: null, queue: {}, schema_pending: false });
      } else {
        setError(mapped.message);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadTemplates = useCallback(async () => {
    if (!companyId) return;
    setTplLoading(true);
    setTplError(null);
    setTplNotConnected(false);
    try {
      const res = await waApi.listTemplates(companyId);
      setTemplates(res.data ?? []);
    } catch (e: any) {
      const mapped = mapWaError(e);
      if (mapped.code === "NAO_CONECTADO") setTplNotConnected(true);
      else setTplError(mapped.message);
    } finally {
      setTplLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  if (!companyId) return null;

  if (loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator size="large" color={KarateColors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.stateBox}>
          <Icon name="alert" size={26} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadStatus} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (status?.schema_pending) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.stateBox}>
          <Icon name="clock" size={26} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>O WhatsApp automático ainda não está disponível neste ambiente.</Text>
          <Text style={styles.stateSub}>
            Uma atualização está pendente no servidor. Enquanto isso, a fila manual da aba Régua
            continua funcionando normalmente.
          </Text>
        </View>
      </ScrollView>
    );
  }

  const connected = !!status?.connected;
  const chips = waQueueChips(status?.queue);
  const approved = templates.filter((t) => String(t.status || "").toUpperCase() === "APPROVED");

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.headTitle}>
            <Icon name="whatsapp" size={16} color={KarateColors.whatsapp} />
            <Text style={styles.cardTitle}>WhatsApp (Cloud API)</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: connected ? KarateColors.okSoft : KarateColors.neutralSoft }]}>
            <Icon
              name={connected ? "check_circle" : "link"}
              size={12}
              color={connected ? KarateColors.ok : KarateColors.neutral}
            />
            <Text style={[styles.badgeTxt, { color: connected ? KarateColors.ok : KarateColors.neutral }]}>
              {connected ? "Conectado" : "Não conectado"}
            </Text>
          </View>
        </View>

        {connected ? (
          <>
            <Text style={styles.cardSub}>
              Número oficial do dojô: {fmtPhoneBR(status?.phone_display)}
              {status?.waba_id ? ` · conta ${status.waba_id}` : ""}
            </Text>
            {chips.length > 0 ? (
              <View style={styles.chips}>
                {chips.map((c) => (
                  <View key={c.key} style={styles.chip}>
                    <Text style={styles.chipNum}>{c.count}</Text>
                    <Text style={styles.chipTxt}>{c.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>Nenhuma mensagem na fila ainda.</Text>
            )}
          </>
        ) : (
          <Text style={styles.cardSub}>
            O envio automático por WhatsApp exige um número e um token da Cloud API cadastrados para
            o dojô, além de pelo menos um template aprovado pela Meta. Enquanto isso não existir, a
            fila manual da aba Régua continua sendo o caminho — ela abre o seu WhatsApp com a
            mensagem pronta e não depende de nenhuma configuração.
          </Text>
        )}

        <TouchableOpacity onPress={loadStatus} accessibilityRole="button" style={styles.iconBtn}>
          <Icon name="refresh" size={14} color={KarateColors.ink2} />
          <Text style={styles.iconBtnTxt}>Atualizar status</Text>
        </TouchableOpacity>
      </View>

      <WaTemplatesCard
        companyId={companyId}
        templates={templates}
        loading={tplLoading}
        notConnected={tplNotConnected}
        error={tplError}
        onReload={loadTemplates}
      />

      <WaTestSendCard
        companyId={companyId}
        approvedTemplates={approved}
        onSent={() => { setOutboxKey((k) => k + 1); loadStatus(); }}
      />

      <WaOutboxCard companyId={companyId} refreshKey={outboxKey} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40, width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 } as ViewStyle,
  headTitle: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 8, lineHeight: 18, maxWidth: 620 } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 10, lineHeight: 16 } as TextStyle,
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 } as ViewStyle,
  badgeTxt: { fontSize: 10.5, fontWeight: "700" } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 } as ViewStyle,
  chip: {
    flexDirection: "row", alignItems: "baseline", gap: 5,
    backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border,
    borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10,
  } as ViewStyle,
  chipNum: { fontSize: 13, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  chipTxt: { fontSize: 11.5, fontWeight: "600", color: KarateColors.ink2 } as TextStyle,
  iconBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingVertical: 6, paddingHorizontal: 10, marginTop: 14, alignSelf: "flex-start" } as ViewStyle,
  iconBtnTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 32 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 420, lineHeight: 17 } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
});
