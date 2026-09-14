// ============================================================
// PreviaMarketingModal — "quantas mensagens PAGAS isto manda?"
//
// Irmão do PreviaCrediarioModal, para as rotinas de MARKETING (Fases 7 e
// 8). A diferença não é cosmética: a mensagem de cobrança é UTILITY e vai
// para quem já comprou; esta é MARKETING, custa mais por mensagem, tem
// limite por cliente e depende de consentimento. Então o número aparece
// com a palavra "pagas" do lado, sempre.
//
// Regra que veio do crediário e não muda: o botão de confirmar só existe
// depois que a prévia carregou. Ligar (ou disparar) às cegas é o erro que
// este módulo inteiro existe para impedir.
//
// A exceção honesta continua sendo o ambiente onde a rota ainda não subiu
// (404/405 do backend anterior à fase): aí o botão muda de texto e diz
// que vai sem prévia. Um botão mentiroso seria pior que um botão franco.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { WaPreview, WaStatus } from "@/services/waApi";
import {
  mapWaError, waMarketingCostLabel, waMarketingQuotaInfo, waPreviewSkippedSummary,
  waPreviewSkippedTotal, waSkipReasonLabel,
} from "./waGuards";

interface Props {
  visible: boolean;
  /** Título do diálogo — quem chama sabe se é aniversário ou reativação. */
  titulo: string;
  /** Uma linha explicando o que vai acontecer quando confirmar. */
  descricao: string;
  /** Rótulo do botão de confirmar ("Ativar envio automático", "Enviar agora"). */
  confirmLabel: string;
  /** Rótulo enquanto salva/envia. */
  savingLabel: string;
  /** Quem busca a prévia — cada rotina tem a sua rota. */
  carregar: () => Promise<WaPreview>;
  /** Para o aviso de teto diário. */
  status?: WaStatus | null;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: (preview: WaPreview | null) => void;
  /**
   * Prefixo dos testID de dentro do diálogo. Chama-se `idBase` e não
   * `testID` de propósito: um prop chamado testID fica pendurado no
   * ELEMENTO do componente mesmo quando ele não renderiza nada — e aí o
   * teste que pergunta "a prévia está aberta?" responde sempre que sim,
   * justamente a asserção que existe para provar que nada abriu sozinho.
   */
  idBase?: string;
}

const MAX_ITENS_VISIVEIS = 8;

export function PreviaMarketingModal({
  visible, titulo, descricao, confirmLabel, savingLabel, carregar, status, saving,
  onCancel, onConfirm, idBase,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<WaPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);

  // `carregar` costuma chegar como arrow inline: guardar em ref é o que
  // impede o efeito de rebuscar a prévia a cada render do pai (uma ida à
  // rede por frame, com o número piscando na tela).
  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIndisponivel(false);
    try {
      setPreview(await carregarRef.current());
    } catch (e: any) {
      // Rota ainda não existe no ambiente ≠ erro da loja.
      if (e?.status === 404 || e?.status === 405) setIndisponivel(true);
      else setError(mapWaError(e).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setPreview(null);
    load();
  }, [visible, load]);

  const base = idBase || "wa-marketing-previa";
  const wouldSend = preview ? Number(preview.would_send) || 0 : 0;
  const skippedTotal = waPreviewSkippedTotal(preview?.skipped);
  const skippedTxt = waPreviewSkippedSummary(preview?.skipped);
  const cap = typeof status?.usage?.daily_cap === "number" && status.usage.daily_cap > 0
    ? status.usage.daily_cap
    : null;
  const acimaDoTeto = cap != null && wouldSend > cap;
  // Fase 8b — quanto da cota do mês isto consome. Cota ausente = backend
  // anterior à fase, e aí a linha simplesmente não aparece.
  const cota = waMarketingQuotaInfo(status);
  const sobra = cota?.remaining ?? null;
  const acimaDaCota = sobra != null && wouldSend > sobra;
  const itens = (preview?.items || []).filter((i) => !i.reason).slice(0, MAX_ITENS_VISIVEIS);
  const pulados = (preview?.items || []).filter((i) => !!i.reason).slice(0, MAX_ITENS_VISIVEIS);
  // A rotina inteira barrada (sem consentimento, sem addon, desligada) é
  // diferente de cliente pulado: o motivo é um só e vale para todo mundo.
  const motivoGeral = waSkipReasonLabel(preview?.skipped_reason);

  const podeConfirmar = (!!preview && !loading) || indisponivel;

  return (
    <ResponsiveSheet
      visible={visible}
      onClose={() => (saving ? null : onCancel())}
      maxWidth={520}
      sheetStyle={{ backgroundColor: Colors.bg3, padding: 20 }}
    >
      <View style={{ gap: 10 }} testID={base}>
        <View style={s.head}>
          <Icon name="whatsapp" size={16} color={Colors.violet3} />
          <Text style={s.title}>{titulo}</Text>
        </View>
        <Text style={s.line}>{descricao}</Text>

        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 10 }}>
          {loading && (
            <View style={s.stateBox} testID={`${base}-carregando`}>
              <ActivityIndicator size="small" color={Colors.violet3} />
              <Text style={s.stateTxt}>Calculando quantas mensagens sairiam…</Text>
            </View>
          )}

          {!loading && !!error && (
            <View style={s.stateBox} testID={`${base}-erro`}>
              <Icon name="alert" size={20} color={Colors.ink3} />
              <Text style={s.stateTxt}>{error}</Text>
              <Pressable onPress={load} accessibilityRole="button">
                <Text style={s.retryTxt}>Tentar de novo</Text>
              </Pressable>
            </View>
          )}

          {!loading && indisponivel && (
            <View style={s.warnBox} testID={`${base}-indisponivel`}>
              <Icon name="alert" size={13} color={Colors.amber} />
              <Text style={s.warnTxt}>
                A prévia ainda não está disponível nesta conta — não dá para dizer agora quantas
                mensagens sairiam. Se seguir mesmo assim, acompanhe a fila na aba WhatsApp: ela
                mostra cada mensagem que sair e o motivo das que não saírem.
              </Text>
            </View>
          )}

          {!loading && !error && !!preview && (
            <>
              <View style={s.resumo} testID={`${base}-resumo`}>
                <Text style={s.resumoNum}>{wouldSend}</Text>
                <Text style={s.resumoTxt}>
                  {wouldSend === 1
                    ? "cliente receberia — 1 mensagem de marketing paga."
                    : `clientes receberiam — ${waMarketingCostLabel(wouldSend)}.`}
                </Text>
              </View>

              {sobra != null && (
                <Text style={s.line} testID={`${base}-cota`}>
                  {wouldSend > 0
                    ? `${Math.min(wouldSend, sobra)} de ${sobra} da cota promocional do mês serão usadas.`
                    : `Restam ${sobra} mensagens promocionais na cota do mês.`}
                </Text>
              )}

              {acimaDaCota && (
                <View style={s.warnBox} testID={`${base}-acima-da-cota`}>
                  <Icon name="alert" size={13} color={Colors.amber} />
                  <Text style={s.warnTxt}>
                    {sobra === 0
                      ? "A cota de mensagens promocionais do mês já acabou: nada sai até você comprar um pacote ou o mês virar."
                      : `Só ${sobra} cabem na cota do mês. O restante fica na fila até você comprar um pacote ou o mês virar.`}
                  </Text>
                </View>
              )}

              {!!motivoGeral && (
                <View style={s.warnBox} testID={`${base}-motivo-geral`}>
                  <Icon name="alert" size={13} color={Colors.amber} />
                  <Text style={s.warnTxt}>{motivoGeral}</Text>
                </View>
              )}

              <Text style={s.line}>
                {skippedTotal > 0
                  ? `${skippedTotal} ${skippedTotal === 1 ? "pulado" : "pulados"}${skippedTxt ? ` (${skippedTxt})` : ""}.`
                  : "Ninguém foi pulado nesta simulação."}
              </Text>

              {wouldSend === 0 && !motivoGeral && (
                <Text style={s.hint} testID={`${base}-zero`}>
                  Nenhuma mensagem sairia agora — ou não há ninguém elegível hoje, ou todos já
                  receberam. Seguir em frente não gera custo imediato.
                </Text>
              )}

              {acimaDoTeto && (
                <View style={s.warnBox} testID={`${base}-acima-do-teto`}>
                  <Icon name="alert" size={13} color={Colors.amber} />
                  <Text style={s.warnTxt}>
                    São mais mensagens do que o teto diário da loja ({cap}). O excedente não se
                    perde: fica na fila e sai no dia seguinte.
                  </Text>
                </View>
              )}

              {itens.length > 0 && (
                <View style={s.lista} testID={`${base}-itens`}>
                  <Text style={s.listaTitulo}>Quem receberia</Text>
                  {itens.map((it, i) => (
                    <Text key={`s${i}`} style={s.item} numberOfLines={1}>
                      {it.customer_name || it.student_name || "Cliente"}
                      {it.phone_masked ? ` · ${it.phone_masked}` : ""}
                      {typeof it.days_since === "number" ? ` · há ${it.days_since} dias sem comprar` : ""}
                    </Text>
                  ))}
                  {wouldSend > itens.length && (
                    <Text style={s.hint}>e mais {wouldSend - itens.length}.</Text>
                  )}
                </View>
              )}

              {pulados.length > 0 && (
                <View style={s.lista} testID={`${base}-pulados`}>
                  <Text style={s.listaTitulo}>Quem não receberia</Text>
                  {pulados.map((it, i) => (
                    <Text key={`p${i}`} style={s.itemPulado} numberOfLines={2}>
                      {it.customer_name || it.student_name || "Cliente"} — {waSkipReasonLabel(it.reason)}
                    </Text>
                  ))}
                </View>
              )}

              <Text style={s.hint}>
                Cada cliente recebe no máximo uma mensagem de marketing a cada 7 dias, e quem pediu
                para não receber nunca recebe — mesmo com isto ligado.
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
              onPress={() => onConfirm(preview)}
              disabled={!!saving}
              style={[s.primaryBtn, !!saving && s.btnDisabled]}
              accessibilityRole="button"
              testID={`${base}-confirmar`}
            >
              {saving && <ActivityIndicator size="small" color="#fff" />}
              <Text style={s.primaryTxt}>
                {saving ? savingLabel : indisponivel ? `${confirmLabel} sem ver a prévia` : confirmLabel}
              </Text>
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
