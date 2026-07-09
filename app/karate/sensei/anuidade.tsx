// ============================================================
// Painel do Sensei — Anuidade (DESIGN-23)
// Anuidade do dojô à federação: situação, Pix e histórico (dados reais
// via GET /federation/:id/dojo/annuity). Somente leitura; o pagamento
// é conciliado pela federação. Padrão de loading/erro/vazio: eventos.tsx.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, annuityStatusView } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateApi, SenseiAnnuity, SenseiAnnuityResponse } from "@/services/karateApi";
import { copyToClipboard } from "@/utils/clipboard";
import { SENSEI_DOJO } from "./_layout";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Formata 'YYYY-MM-DD' sem cair no bug de -1 dia (parse manual, sem Date UTC).
function fmtDataLonga(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  const [, y, mo, d] = m;
  const mi = parseInt(mo, 10) - 1;
  if (mi < 0 || mi > 11) return String(iso);
  return `${parseInt(d, 10)} de ${MESES[mi]} de ${y}`;
}

function fmtValor(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SenseiAnuidade() {
  const { federationId } = useKarateFederation();
  const [data, setData] = useState<SenseiAnnuityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await karateApi.getSenseiAnnuity(federationId);
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const pending: SenseiAnnuity | null = data?.pending ?? null;
  const history: SenseiAnnuity[] = data?.history ?? [];
  const pix = data?.pix ?? null;
  const hasAnyData = !!pending || history.length > 0;

  // Situação da anuidade: sem pendência → "Em dia"; com pendência, usa o mapa
  // de ANUIDADE (bug antigo usava o mapa de status do DOJÔ e mostrava "Vencido"
  // para qualquer estado). annuityStatusView normaliza tudo.
  const statusMeta = pending
    ? annuityStatusView(pending.status)
    : { ...annuityStatusView("paid"), label: "Em dia" };
  const statusDue = pending ? fmtDataLonga(pending.due_date) : null;

  async function handleCopy() {
    if (!pix?.key) return;
    const ok = await copyToClipboard(pix.key);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>{SENSEI_DOJO.name}</Text>
        <Text style={styles.title}>Anuidade do dojô</Text>
        <Text style={styles.lead}>A filiação anual do seu dojô à federação. O pagamento é por Pix e a federação confirma o recebimento.</Text>
      </View>

      {loading && (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={KarateColors.primary} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.stateBox}>
          <Icon name="alert-circle-outline" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Não foi possível carregar a anuidade.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && !hasAnyData && (
        <View style={styles.stateBox}>
          <Icon name="document-text-outline" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhuma anuidade registrada ainda.</Text>
          <Text style={styles.stateSub}>Quando a federação lançar a anuidade do seu dojô, ela aparece aqui.</Text>
        </View>
      )}

      {!loading && !error && hasAnyData && (
        <>
          {/* Situação */}
          <View style={[styles.statusCard, { backgroundColor: statusMeta.bg, borderColor: statusMeta.color }]}>
            <View style={[styles.statusIco, { borderColor: statusMeta.color }]}>
              <Icon name={statusMeta.icon} size={24} color={statusMeta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusT, { color: statusMeta.color }]}>
                {pending ? `Anuidade ${pending.reference_period} · ${statusMeta.label}` : `Anuidade · ${statusMeta.label}`}
              </Text>
              {!!statusDue && <Text style={styles.statusSub}>Vencimento em {statusDue}</Text>}
              {!pending && <Text style={styles.statusSub}>Nenhuma pendência no momento</Text>}
            </View>
            {pending && <Text style={styles.valor}>{fmtValor(pending.amount)}</Text>}
          </View>

          {/* Pix */}
          {pix && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pagamento</Text>
              <Text style={styles.cardSub}>Use a chave Pix da federação. Depois do pagamento, a federação concilia e atualiza aqui.</Text>
              <View style={styles.pixRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pixLabel}>Chave Pix da federação{pix.holder_name ? ` · ${pix.holder_name}` : ""}</Text>
                  <Text style={styles.pixVal}>{pix.key}</Text>
                </View>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} accessibilityLabel="Copiar chave Pix" accessibilityRole="button">
                  <Icon name={copied ? "checkmark" : "copy-outline"} size={15} color={KarateColors.primary} />
                  <Text style={styles.copyTxt}>{copied ? "Copiado" : "Copiar"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {!pix && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pagamento</Text>
              <Text style={styles.cardSub}>A federação ainda não cadastrou uma chave Pix para pagamento.</Text>
            </View>
          )}

          {/* Histórico */}
          {history.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Histórico de pagamentos</Text>
              <Text style={styles.cardSub}>Últimas renovações</Text>
              {history.map((h) => {
                const pago = !!h.paid_at;
                const quando = pago ? fmtDataLonga(h.paid_at) : fmtDataLonga(h.due_date);
                return (
                  <View key={h.annuity_history_id} style={styles.histRow}>
                    <View style={[styles.histIco, !pago && { backgroundColor: KarateColors.neutralSoft }]}>
                      <Icon name={pago ? "checkmark" : "time-outline"} size={14} color={pago ? KarateColors.ok : KarateColors.ink3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.histAno}>Anuidade {h.reference_period}</Text>
                      <Text style={styles.histQuando}>{pago ? `Pago em ${quando}` : (quando ? `Vencimento ${quando}` : (h.status || "Pendente"))}</Text>
                    </View>
                    <Text style={styles.histValor}>{fmtValor(h.amount)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 320 } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  statusCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: KarateRadius.lg, borderWidth: 1, padding: 16 } as ViewStyle,
  statusIco: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#fff", borderWidth: 1, alignItems: "center", justifyContent: "center" } as ViewStyle,
  statusT: { fontSize: 15, fontWeight: "800" } as TextStyle,
  statusSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 2 } as TextStyle,
  valor: { fontSize: 18, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 2, marginBottom: 8, lineHeight: 17 } as TextStyle,
  pixRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, padding: 12 } as ViewStyle,
  pixLabel: { fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  pixVal: { fontSize: 14, color: KarateColors.ink, fontWeight: "600", marginTop: 3 } as TextStyle,
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 12 } as ViewStyle,
  copyTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  histRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  histIco: { width: 28, height: 28, borderRadius: 14, backgroundColor: KarateColors.okSoft, alignItems: "center", justifyContent: "center" } as ViewStyle,
  histAno: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  histQuando: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  histValor: { fontSize: 13, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
});
