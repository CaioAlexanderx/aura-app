// ============================================================
// WaPreviewModal — "quantas mensagens vão sair?" ANTES de ligar
//
// A pergunta que ninguém consegue responder de cabeça: ligar o envio
// automático da régua manda quantas mensagens hoje? Cada uma custa
// dinheiro do dojô. Este modal responde com o número real, vindo do
// GET /whatsapp/preview (Fase 2e) — que SIMULA as guardas e não
// enfileira nada.
//
// Regra dura: o botão "Ativar envio automático" só existe depois que a
// prévia carregou. Ligar às cegas é exatamente o erro que este módulo
// inteiro existe para impedir.
//
// A exceção honesta é o ambiente onde a rota /preview ainda não subiu
// (backend anterior à Fase 2 responde 404/405): aí o botão muda de
// texto para "Ativar sem ver a prévia" e vem com o aviso por cima. Um
// botão mentiroso seria pior que um botão franco.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, Modal, Pressable, ScrollView, ActivityIndicator,
  TouchableOpacity, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { waApi, WaPreview, WaStatus } from "@/services/waApi";
import {
  fmtAmountBR, fmtDueDateBR, mapWaError, waPreviewSkippedSummary,
  waPreviewSkippedTotal, waSkipReasonLabel,
} from "./helpers";

interface Props {
  visible: boolean;
  companyId: string;
  status: WaStatus | null;
  /** true enquanto a régua está sendo salva com o automático ligado. */
  saving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const MAX_ITENS_VISIVEIS = 8;

export function WaPreviewModal({ visible, companyId, status, saving, onCancel, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<WaPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setIndisponivel(false);
    try {
      setPreview(await waApi.getPreview(companyId));
    } catch (e: any) {
      // Rota ainda não existe no ambiente ≠ erro do dojô.
      if (e?.status === 404 || e?.status === 405) setIndisponivel(true);
      else setError(mapWaError(e).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!visible) return;
    setPreview(null);
    load();
  }, [visible, load]);

  const wouldSend = preview ? Number(preview.would_send) || 0 : 0;
  const skippedTotal = waPreviewSkippedTotal(preview?.skipped);
  const skippedTxt = waPreviewSkippedSummary(preview?.skipped);
  const cap = typeof status?.usage?.daily_cap === "number" && status.usage.daily_cap > 0
    ? status.usage.daily_cap
    : null;
  const acimaDoTeto = cap != null && wouldSend > cap;
  const itens = (preview?.items || []).filter((i) => !i.reason).slice(0, MAX_ITENS_VISIVEIS);
  const pulados = (preview?.items || []).filter((i) => !!i.reason).slice(0, MAX_ITENS_VISIVEIS);

  const podeConfirmar = (!!preview && !loading) || indisponivel;
  const confirmLabel = saving
    ? "Ativando…"
    : indisponivel
      ? "Ativar sem ver a prévia"
      : "Ativar envio automático";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={() => (saving ? null : onCancel())}>
        <Pressable style={styles.dialog} onPress={() => {}} testID="wa-preview-modal">
          <View style={styles.head}>
            <Icon name="whatsapp" size={16} color={KarateColors.whatsapp} />
            <Text style={styles.title}>Ligar o envio automático por WhatsApp</Text>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 10 }}>
            {loading && (
              <View style={styles.stateBox} testID="wa-preview-carregando">
                <ActivityIndicator size="small" color={KarateColors.primary} />
                <Text style={styles.stateTxt}>Calculando quantas mensagens sairiam hoje…</Text>
              </View>
            )}

            {!loading && !!error && (
              <View style={styles.stateBox} testID="wa-preview-erro">
                <Icon name="alert" size={20} color={KarateColors.ink3} />
                <Text style={styles.stateTxt}>{error}</Text>
                <TouchableOpacity onPress={load} accessibilityRole="button">
                  <Text style={styles.retryTxt}>Tentar de novo</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && indisponivel && (
              <View style={styles.warnBox} testID="wa-preview-indisponivel">
                <Icon name="alert" size={14} color={KarateColors.warn} />
                <Text style={styles.warnTxt}>
                  A prévia ainda não está disponível neste ambiente — não dá para dizer agora quantas
                  mensagens sairiam hoje. Se ligar mesmo assim, acompanhe a aba WhatsApp: a fila
                  mostra cada mensagem que sair e o motivo das que não saírem.
                </Text>
              </View>
            )}

            {!loading && !error && !!preview && (
              <>
                <View style={styles.resumo} testID="wa-preview-resumo">
                  <Text style={styles.resumoNum}>{wouldSend}</Text>
                  <Text style={styles.resumoTxt}>
                    {wouldSend === 1
                      ? "aluno receberia a cobrança hoje por WhatsApp."
                      : "alunos receberiam a cobrança hoje por WhatsApp."}
                  </Text>
                </View>

                <Text style={styles.line}>
                  {skippedTotal > 0
                    ? `${skippedTotal} ${skippedTotal === 1 ? "pulado" : "pulados"}${skippedTxt ? ` (${skippedTxt})` : ""}.`
                    : "Ninguém foi pulado nesta simulação."}
                </Text>

                {wouldSend === 0 && (
                  <Text style={styles.hint} testID="wa-preview-zero">
                    Nenhuma mensagem sairia hoje — ou não há vencimento nos dias da régua, ou todos
                    já foram avisados. Ligar agora não gera custo imediato; o envio começa quando
                    houver alguém elegível.
                  </Text>
                )}

                {acimaDoTeto && (
                  <View style={styles.warnBox} testID="wa-preview-acima-do-teto">
                    <Icon name="alert" size={14} color={KarateColors.warn} />
                    <Text style={styles.warnTxt}>
                      São mais mensagens do que o teto diário do dojô ({cap}). O excedente não se
                      perde: fica na fila e sai no dia seguinte.
                    </Text>
                  </View>
                )}

                {itens.length > 0 && (
                  <View style={styles.lista} testID="wa-preview-itens">
                    <Text style={styles.listaTitulo}>Quem receberia</Text>
                    {itens.map((it, i) => (
                      <Text key={`s${i}`} style={styles.item} numberOfLines={1}>
                        {it.student_name || "Aluno"}
                        {it.phone_masked ? ` · ${it.phone_masked}` : ""}
                        {fmtAmountBR(it.amount) ? ` · ${fmtAmountBR(it.amount)}` : ""}
                        {fmtDueDateBR(it.due_date) ? ` · vence ${fmtDueDateBR(it.due_date)}` : ""}
                      </Text>
                    ))}
                    {wouldSend > itens.length && (
                      <Text style={styles.hint}>e mais {wouldSend - itens.length}.</Text>
                    )}
                  </View>
                )}

                {pulados.length > 0 && (
                  <View style={styles.lista} testID="wa-preview-pulados">
                    <Text style={styles.listaTitulo}>Quem não receberia</Text>
                    {pulados.map((it, i) => (
                      <Text key={`p${i}`} style={styles.itemPulado} numberOfLines={2}>
                        {it.student_name || "Aluno"} — {waSkipReasonLabel(it.reason)}
                      </Text>
                    ))}
                  </View>
                )}

                {!!preview.template_name && (
                  <Text style={styles.hint}>
                    Template usado: {preview.template_name}. A Meta cobra por conversa iniciada.
                  </Text>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <KarateButton label="Cancelar" variant="secondary" size="sm" disabled={!!saving} onPress={onCancel} />
            {podeConfirmar && (
              <KarateButton
                label={confirmLabel}
                variant="sumi"
                size="sm"
                loading={!!saving}
                disabled={!!saving}
                onPress={onConfirm}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20,16,12,0.45)", alignItems: "center", justifyContent: "center", padding: 20 } as ViewStyle,
  dialog: {
    backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1,
    borderColor: KarateColors.border, padding: 18, width: "100%", maxWidth: 520, maxHeight: "88%", gap: 10,
  } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  title: { fontSize: 15, fontWeight: "800", color: KarateColors.ink, flexShrink: 1 } as TextStyle,
  body: { flexGrow: 0 } as ViewStyle,
  resumo: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" } as ViewStyle,
  resumoNum: { fontSize: 30, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  resumoTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink2, flexShrink: 1, maxWidth: 380 } as TextStyle,
  line: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3, lineHeight: 16.5 } as TextStyle,
  lista: { gap: 3, marginTop: 4 } as ViewStyle,
  listaTitulo: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2, color: KarateColors.ink2, textTransform: "uppercase" } as TextStyle,
  item: { fontSize: 12, color: KarateColors.ink2 } as TextStyle,
  itemPulado: { fontSize: 12, color: KarateColors.ink3, lineHeight: 17 } as TextStyle,
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    backgroundColor: KarateColors.warnSoft, borderRadius: KarateRadius.sm,
    paddingVertical: 9, paddingHorizontal: 10,
  } as ViewStyle,
  warnTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: KarateColors.warn, lineHeight: 17 } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 22 } as ViewStyle,
  stateTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  retryTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 } as ViewStyle,
});
