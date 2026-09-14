// ============================================================
// PreviaCrediarioModal — "quantas cobranças vão sair?" ANTES de ligar
//
// A pergunta que ninguém responde de cabeça: ligar o envio automático da
// régua do crediário manda quantas mensagens hoje? Cada uma custa
// dinheiro da loja. Este modal responde com o número real, vindo do
// GET /whatsapp/preview?source=crediario — que SIMULA as guardas e não
// enfileira nada.
//
// Regra dura: o botão "Ativar" só existe depois que a prévia carregou.
// Ligar às cegas é exatamente o erro que este módulo inteiro existe para
// impedir. A Valen tem 1938 parcelas em aberto — é a diferença entre um
// disparo e uma fatura.
//
// A exceção honesta é o ambiente onde a rota ainda não subiu (backend
// anterior à Fase 6 responde 404/405): aí o botão muda de texto para
// "Ativar sem ver a prévia" e vem com o aviso por cima. Um botão
// mentiroso seria pior que um botão franco.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { waApi, WaPreview, WaStatus } from "@/services/waApi";
import {
  fmtAmountBR, fmtDueDateBR, mapWaError, waPreviewSkippedSummary,
  waPreviewSkippedTotal, waSkipReasonLabel,
} from "./waGuards";

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

export function PreviaCrediarioModal({ visible, companyId, status, saving, onCancel, onConfirm }: Props) {
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
      setPreview(await waApi.getPreview(companyId, { source: "crediario" }));
    } catch (e: any) {
      // Rota ainda não existe no ambiente ≠ erro da loja.
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
    <ResponsiveSheet
      visible={visible}
      onClose={() => (saving ? null : onCancel())}
      maxWidth={520}
      sheetStyle={{ backgroundColor: Colors.bg3, padding: 20 }}
    >
      <View style={{ gap: 10 }} testID="crediario-wa-previa">
        <View style={s.head}>
          <Icon name="whatsapp" size={16} color={Colors.violet3} />
          <Text style={s.title}>Ligar a cobrança automática por WhatsApp</Text>
        </View>

        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 10 }}>
          {loading && (
            <View style={s.stateBox} testID="crediario-wa-previa-carregando">
              <ActivityIndicator size="small" color={Colors.violet3} />
              <Text style={s.stateTxt}>Calculando quantas cobranças sairiam hoje…</Text>
            </View>
          )}

          {!loading && !!error && (
            <View style={s.stateBox} testID="crediario-wa-previa-erro">
              <Icon name="alert" size={20} color={Colors.ink3} />
              <Text style={s.stateTxt}>{error}</Text>
              <Pressable onPress={load} accessibilityRole="button">
                <Text style={s.retryTxt}>Tentar de novo</Text>
              </Pressable>
            </View>
          )}

          {!loading && indisponivel && (
            <View style={s.warnBox} testID="crediario-wa-previa-indisponivel">
              <Icon name="alert" size={13} color={Colors.amber} />
              <Text style={s.warnTxt}>
                A prévia ainda não está disponível nesta conta — não dá para dizer agora quantas
                cobranças sairiam hoje. Se ligar mesmo assim, acompanhe a aba WhatsApp: a fila
                mostra cada mensagem que sair e o motivo das que não saírem.
              </Text>
            </View>
          )}

          {!loading && !error && !!preview && (
            <>
              <View style={s.resumo} testID="crediario-wa-previa-resumo">
                <Text style={s.resumoNum}>{wouldSend}</Text>
                <Text style={s.resumoTxt}>
                  {wouldSend === 1
                    ? "cliente receberia a cobrança hoje por WhatsApp."
                    : "clientes receberiam a cobrança hoje por WhatsApp."}
                </Text>
              </View>

              <Text style={s.line}>
                {skippedTotal > 0
                  ? `${skippedTotal} ${skippedTotal === 1 ? "pulado" : "pulados"}${skippedTxt ? ` (${skippedTxt})` : ""}.`
                  : "Ninguém foi pulado nesta simulação."}
              </Text>

              {wouldSend === 0 && (
                <Text style={s.hint} testID="crediario-wa-previa-zero">
                  Nenhuma cobrança sairia hoje — ou não há parcela vencendo nos dias da régua, ou
                  todos já foram avisados. Ligar agora não gera custo imediato; o envio começa
                  quando houver alguém elegível.
                </Text>
              )}

              {acimaDoTeto && (
                <View style={s.warnBox} testID="crediario-wa-previa-acima-do-teto">
                  <Icon name="alert" size={13} color={Colors.amber} />
                  <Text style={s.warnTxt}>
                    São mais mensagens do que o teto diário da loja ({cap}). O excedente não se
                    perde: fica na fila e sai no dia seguinte.
                  </Text>
                </View>
              )}

              {itens.length > 0 && (
                <View style={s.lista} testID="crediario-wa-previa-itens">
                  <Text style={s.listaTitulo}>Quem receberia</Text>
                  {itens.map((it, i) => (
                    <Text key={`s${i}`} style={s.item} numberOfLines={1}>
                      {it.customer_name || it.student_name || "Cliente"}
                      {it.phone_masked ? ` · ${it.phone_masked}` : ""}
                      {fmtAmountBR(it.amount) ? ` · ${fmtAmountBR(it.amount)}` : ""}
                      {fmtDueDateBR(it.due_date) ? ` · vence ${fmtDueDateBR(it.due_date)}` : ""}
                    </Text>
                  ))}
                  {wouldSend > itens.length && (
                    <Text style={s.hint}>e mais {wouldSend - itens.length}.</Text>
                  )}
                </View>
              )}

              {pulados.length > 0 && (
                <View style={s.lista} testID="crediario-wa-previa-pulados">
                  <Text style={s.listaTitulo}>Quem não receberia</Text>
                  {pulados.map((it, i) => (
                    <Text key={`p${i}`} style={s.itemPulado} numberOfLines={2}>
                      {it.customer_name || it.student_name || "Cliente"} — {waSkipReasonLabel(it.reason)}
                    </Text>
                  ))}
                </View>
              )}

              <Text style={s.hint}>
                A Meta cobra por conversa iniciada. Quem pediu para não receber nunca recebe, mesmo
                com isto ligado.
              </Text>
            </>
          )}
        </ScrollView>

        <View style={s.actions}>
          <Pressable onPress={onCancel} disabled={!!saving} style={s.ghostBtn} accessibilityRole="button">
            <Text style={s.ghostTxt}>Cancelar</Text>
          </Pressable>
          {podeConfirmar && (
            <Pressable
              onPress={onConfirm}
              disabled={!!saving}
              style={[s.primaryBtn, !!saving && s.btnDisabled]}
              accessibilityRole="button"
              testID="crediario-wa-previa-ativar"
            >
              {saving && <ActivityIndicator size="small" color="#fff" />}
              <Text style={s.primaryTxt}>{confirmLabel}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "800", color: Colors.ink, flexShrink: 1 },
  resumo: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  resumoNum: { fontSize: 30, fontWeight: "900", color: Colors.violet3, letterSpacing: -0.8 },
  resumoTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink2, flexShrink: 1, maxWidth: 380 },
  line: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18 },
  hint: { fontSize: 11.5, color: Colors.ink3, lineHeight: 16.5 },
  lista: { gap: 3, marginTop: 4 },
  listaTitulo: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase" },
  item: { fontSize: 12, color: Colors.ink2 },
  itemPulado: { fontSize: 12, color: Colors.ink3, lineHeight: 17 },
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    backgroundColor: Colors.amberD, borderRadius: 10, borderWidth: 1, borderColor: Colors.amber + "33",
    paddingVertical: 9, paddingHorizontal: 10,
  },
  warnTxt: { flex: 1, fontSize: 11.5, fontWeight: "600", color: Colors.amber, lineHeight: 16.5 },
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 22 },
  stateTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2, textAlign: "center" },
  retryTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  ghostBtn: {
    flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingVertical: 12, minHeight: 44,
  },
  ghostTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.ink3 },
  primaryBtn: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.violet, borderRadius: 10, paddingVertical: 12, minHeight: 44,
  },
  primaryTxt: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.6 },
} as any);
