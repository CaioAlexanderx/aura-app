// ============================================================
// CobrancaPreviewModal — preview editável de mensagem WA
// Entrega 3 (08/06/2026): permite revisar e editar a mensagem
// antes de abrir o WhatsApp. Reutilizável em crediario.tsx e
// cliente/[id].tsx.
// F4 (08/07/2026 — spec §2.4): ModalPop na entrada, backdrop token
// único (0.72), hover/pressed nos botões (antes zero feedback) e
// reset da mensagem ao reabrir (antes dependia do pai).
// F4.3 (10/07): maxHeight 88vh no web (ModalPop quebrava o "90%") +
// ScrollView com flexShrink e indicador — conteúdo sempre alcançável.
// Fase 6k (14/09/2026): quando a loja tem WhatsApp oficial conectado e
// passa por todas as guardas, aparece um SEGUNDO caminho — "Enviar pelo
// WhatsApp oficial", que enfileira uma mensagem de verdade na Cloud API.
// Essa é PAGA, então: confirmação explícita antes de gastar, e
// `queued: false` (uma guarda tendo funcionado) vira motivo em pt-BR,
// nunca um código. O caminho wa.me continua exatamente como era —
// grátis, manual e ainda o botão principal.
// Modelos de mensagem (21/11/2026): com `modelos`, aparece a fileira
// "Modelo" acima do texto. Abre no padrão da situação da parcela (a vencer,
// vence hoje, em atraso). Digitar no texto vale SÓ para esta mensagem: o
// aviso oferece "Salvar como modelo" (passo dentro do mesmo sheet) e "Voltar
// ao texto do modelo". Variável sem valor tira o parágrafo e avisa. Sem
// `modelos`, o modal é o de sempre (texto de `initialMessage`).
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  View, Text, Pressable, TextInput, StyleSheet,
  Platform, Linking, ScrollView, ActivityIndicator,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { Motion, webTransition } from "@/constants/motion";
import { waSkipReasonLabel } from "@/components/whatsapp/waGuards";
import { SalvarComoModelo, type SalvarModeloComo } from "@/components/crediario/mensagens/SalvarComoModelo";
import {
  avisosDoQueFaltou, modeloInicial, preencher,
  type DadosDaMensagem, type ModeloDeMensagem, type Situacao,
} from "@/utils/crediarioMensagem";

const IS_WEB = Platform.OS === "web";
const SEM_DADOS: DadosDaMensagem = {};

/** O que o backend devolve no trigger com channel 'whatsapp_auto'. */
export type EnvioOficialResultado = {
  queued?: boolean;
  reason?: string | null;
  /** Erro já traduzido pelo pai (rede, 403, 409…). */
  erro?: string | null;
};

export type CobrancaPreviewProps = {
  visible: boolean;
  recipientName: string;
  phone: string;
  /** Rótulo do valor exibido no card (ex.: "R$ 150,00"). Omitir = sem card de valor. */
  valorLabel?: string;
  /** Descrição abaixo do valor (ex.: "Parcela 2/3 · vence 10/06"). */
  valorDesc?: string;
  /** Mensagem inicial preenchida na área de edição. */
  initialMessage: string;
  /**
   * Só quando TODAS as guardas passam (plano/addon, conexão, templates
   * aprovados, fila não pausada) e existe parcela em aberto para cobrar.
   * Ausente ou false = só o wa.me, que é o comportamento de sempre.
   */
  podeEnviarOficial?: boolean;
  /** Dispara o trigger com channel 'whatsapp_auto'. Resolve com o resultado. */
  onEnviarOficial?: () => Promise<EnvioOficialResultado>;
  onClose: () => void;
  // ── Modelos de mensagem (opcionais; sem eles, o modal de sempre) ──
  /** Modelos da loja (ou os prontos da Aura). Presente = fileira "Modelo". */
  modelos?: ModeloDeMensagem[];
  /** A loja ainda não salvou nenhum: rótulo "prontos da Aura" e "Criar o meu". */
  modelosDaAura?: boolean;
  limiteDeModelos?: number;
  /** Os dados desta cobrança, para preencher as variáveis. */
  dados?: DadosDaMensagem;
  /** Situação da parcela cobrada: escolhe o modelo padrão. */
  situacao?: Situacao | null;
  /** "Gerenciar modelos" / "Criar o meu" / "Cadastrar chave". */
  onGerenciarModelos?: () => void;
  /** Grava o modelo; resolve com o modelo salvo (para a fileira marcá-lo). */
  onSalvarModelo?: (
    como: SalvarModeloComo,
    base: ModeloDeMensagem,
    m: { name: string; body: string; situation: Situacao | null },
  ) => Promise<ModeloDeMensagem | null | undefined>;
};

export function CobrancaPreviewModal({
  visible,
  recipientName,
  phone,
  valorLabel,
  valorDesc,
  initialMessage,
  podeEnviarOficial,
  onEnviarOficial,
  onClose,
  modelos,
  modelosDaAura,
  limiteDeModelos = 10,
  dados,
  situacao,
  onGerenciarModelos,
  onSalvarModelo,
}: CobrancaPreviewProps) {
  const comModelos = Array.isArray(modelos) && modelos.length > 0;
  const dadosOk: DadosDaMensagem = dados || SEM_DADOS;
  const [modeloId, setModeloId] = useState<string | null>(() =>
    comModelos ? modeloInicial(modelos as ModeloDeMensagem[], situacao, dadosOk)?.id ?? null : null);
  const modelo = comModelos ? (modelos as ModeloDeMensagem[]).find((m) => m.id === modeloId) || null : null;
  const preenchido = useMemo(
    () => (modelo ? preencher(modelo.body, dadosOk) : null),
    [modelo, dadosOk],
  );
  const [message, setMessage] = useState(preenchido ? preenchido.texto : initialMessage);
  const [passo, setPasso] = useState<"previa" | "salvar">("previa");
  // Confirmação do envio pago: o primeiro clique escolhe, o segundo gasta.
  const [confirmandoOficial, setConfirmandoOficial] = useState(false);
  const [enviandoOficial, setEnviandoOficial] = useState(false);
  const [resultadoOficial, setResultadoOficial] = useState<EnvioOficialResultado | null>(null);

  // F4: reseta a mensagem sempre que o modal reabre com nova proposta
  // (antes dependia do pai remontar o componente — risco de mensagem obsoleta).
  useEffect(() => {
    if (visible) {
      const padrao = comModelos ? modeloInicial(modelos as ModeloDeMensagem[], situacao, dadosOk) : null;
      setModeloId(padrao ? padrao.id : null);
      setMessage(padrao ? preencher(padrao.body, dadosOk).texto : initialMessage);
      setPasso("previa");
      setConfirmandoOficial(false);
      setEnviandoOficial(false);
      setResultadoOficial(null);
    }
    // Só ao abrir (ou trocar de cobrança). Modelos que chegam depois caem
    // no efeito de baixo, sem apagar o que ela já digitou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialMessage]);

  // A lista mudou (carregou, salvou, os prontos viraram da loja) e o modelo
  // escolhido não está mais nela: volta ao modelo inicial da situação. Sem
  // nenhum que dê texto, fica o texto de reserva do pai (initialMessage).
  useEffect(() => {
    if (!comModelos || !modeloId || modelo) return;
    const padrao = modeloInicial(modelos as ModeloDeMensagem[], situacao, dadosOk);
    setModeloId(padrao ? padrao.id : null);
    setMessage(padrao ? preencher(padrao.body, dadosOk).texto : initialMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comModelos, modelos, modelo]);

  const editado = !!preenchido && message !== preenchido.texto;
  const avisos = preenchido ? avisosDoQueFaltou(preenchido.faltando) : [];

  function escolherModelo(m: ModeloDeMensagem) {
    setModeloId(m.id);
    setMessage(preencher(m.body, dadosOk).texto);
  }

  async function salvarModelo(como: SalvarModeloComo, m: { name: string; body: string; situation: Situacao | null }) {
    if (!onSalvarModelo || !modelo) return;
    const salvo = await onSalvarModelo(como, modelo, m);
    if (salvo) {
      setModeloId(salvo.id);
      setMessage(preencher(salvo.body, dadosOk).texto);
    }
    setPasso("previa");
  }

  const initial = (recipientName.trim()[0] || "?").toUpperCase();
  const oficialDisponivel = podeEnviarOficial === true && typeof onEnviarOficial === "function";

  const semTexto = !message.trim();

  function handleSend() {
    // Nunca abre o WhatsApp com mensagem vazia.
    if (semTexto) return;
    const clean = phone.replace(/\D/g, "");
    const num = clean.startsWith("55") ? clean : `55${clean}`;
    Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(message)}`);
    onClose();
  }

  async function enviarOficial() {
    if (!onEnviarOficial) return;
    setEnviandoOficial(true);
    setResultadoOficial(null);
    try {
      setResultadoOficial(await onEnviarOficial());
    } catch (e: any) {
      setResultadoOficial({ queued: false, erro: e?.message || "Não foi possível enviar agora." });
    } finally {
      setEnviandoOficial(false);
      setConfirmandoOficial(false);
    }
  }

  return (
    <ResponsiveSheet visible={visible} onClose={onClose} maxWidth={480} sheetStyle={{ backgroundColor: Colors.bg3, padding: 20 }}>
      {passo === "salvar" && modelo ? (
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator={true}>
          <SalvarComoModelo
            modeloAtual={modelo}
            modelos={modelos as ModeloDeMensagem[]}
            daAura={modelosDaAura === true}
            limite={limiteDeModelos}
            textoEditado={message}
            dados={dadosOk}
            onVoltar={() => setPasso("previa")}
            onSalvar={salvarModelo}
          />
        </ScrollView>
      ) : (
      <>
          {/* Header: X */}
          <View style={cs.headerRow}>
            <Text style={cs.headerTitle}>Prévia da cobrança</Text>
            <Pressable
              onPress={onClose}
              style={({ hovered, pressed }: any) => [cs.xBtn, (hovered || pressed) && { backgroundColor: Colors.bg2 }, IS_WEB ? (webTransition("background-color", Motion.fast) as any) : null]}
            >
              <Icon name="x" size={15} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator={true}>
            {/* Destinatário */}
            <View style={cs.recipientRow}>
              <View style={cs.avatar}>
                <Text style={cs.avatarTxt}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={cs.recipientName} numberOfLines={1}>{recipientName}</Text>
                <Text style={cs.recipientSub}>
                  <Text style={cs.waLabel}>WhatsApp</Text>
                  {" · "}{phone}
                </Text>
              </View>
            </View>

            {/* Card de valor (opcional) */}
            {!!valorLabel && (
              <View style={cs.valorCard}>
                <Text style={cs.valorLabel}>{valorLabel}</Text>
                {!!valorDesc && <Text style={cs.valorDesc}>{valorDesc}</Text>}
              </View>
            )}

            {/* Modelos (21/11/2026) */}
            {comModelos && (
              <View testID="cobranca-modelos">
                <View style={cs.lblRow}>
                  <View style={cs.lblLeft}>
                    <Text style={cs.msgLabelInline}>MODELO</Text>
                    {modelosDaAura && (
                      <View style={cs.auraTag}><Text style={cs.auraTagTxt}>prontos da Aura</Text></View>
                    )}
                  </View>
                  {!!onGerenciarModelos && (
                    <Pressable onPress={onGerenciarModelos} accessibilityRole="link" style={cs.lblLink} testID="cobranca-gerenciar-modelos">
                      <Text style={cs.lblLinkTxt}>{modelosDaAura ? "Criar o meu" : "Gerenciar modelos"}</Text>
                    </Pressable>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cs.chips}
                  accessibilityLabel="Modelos de mensagem">
                  {(modelos as ModeloDeMensagem[]).map((m) => {
                    const on = m.id === modeloId;
                    return (
                      <Pressable key={m.id} onPress={() => escolherModelo(m)} accessibilityRole="button"
                        accessibilityState={{ selected: on }} style={[cs.chip, on && cs.chipOn]} testID={`cobranca-modelo-${m.id}`}>
                        <Text style={[cs.chipTxt, on && cs.chipTxtOn]}>
                          {m.name}{on && editado ? <Text style={cs.chipSmall}> · editado</Text> : null}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Área de mensagem editável */}
            <Text style={cs.msgLabel}>MENSAGEM</Text>
            <TextInput
              style={cs.msgInput}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
              placeholder="Digite a mensagem..."
              placeholderTextColor={Colors.ink3}
              testID="cobranca-mensagem"
            />

            {editado && (
              <View style={cs.edited} testID="cobranca-editado">
                <Text style={cs.editedTxt}>
                  <Text style={{ fontWeight: "800" }}>Você mudou o texto.</Text> Vale só para esta mensagem; o modelo continua como estava.
                </Text>
                <View style={cs.editedActs}>
                  {!!onSalvarModelo && (
                    <Pressable onPress={() => setPasso("salvar")} accessibilityRole="button" style={cs.editedSave} testID="cobranca-salvar-modelo">
                      <Text style={cs.editedSaveTxt}>Salvar como modelo</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => { if (modelo) escolherModelo(modelo); }} accessibilityRole="button" style={cs.editedBack} testID="cobranca-voltar-modelo">
                    <Text style={cs.editedBackTxt}>Voltar ao texto do modelo</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {!editado && avisos.map((a) => (
              <Text key={a} style={cs.warn} testID="cobranca-aviso">
                {a}
                {a.startsWith("Sem chave Pix") && !!onGerenciarModelos && (
                  <Text style={cs.warnLink} onPress={onGerenciarModelos}> Cadastrar chave</Text>
                )}
              </Text>
            ))}

            {comModelos && modelosDaAura && !editado && !!onSalvarModelo && (
              <Text style={cs.note}>Quer deixar do seu jeito? Mude o texto aqui e toque em "Salvar como modelo".</Text>
            )}

            {/* Nota de envio manual */}
            <Text style={cs.note}>
              Envio segue manual pelo WhatsApp. Nada é enviado sem você tocar em Enviar.
            </Text>

            {/* ── Fase 6k: envio pelo número oficial da loja (pago) ── */}
            {oficialDisponivel && (
              <View style={cs.oficialBox} testID="cobranca-oficial">
                {!confirmandoOficial && !resultadoOficial && (
                  <Pressable
                    onPress={() => setConfirmandoOficial(true)}
                    accessibilityRole="button"
                    style={cs.oficialBtn}
                    testID="cobranca-oficial-abrir"
                  >
                    <Icon name="whatsapp" size={14} color={Colors.violet3} />
                    <Text style={cs.oficialBtnTxt}>Enviar pelo WhatsApp oficial</Text>
                  </Pressable>
                )}

                {confirmandoOficial && !resultadoOficial && (
                  <View style={{ gap: 9 }} testID="cobranca-oficial-confirmar">
                    <Text style={cs.oficialTxt}>
                      Isto envia 1 mensagem real e paga pelo número oficial da loja, com o template
                      aprovado pela Meta (o texto acima não é usado neste caminho). Continuar?
                    </Text>
                    <View style={cs.oficialAcoes}>
                      <Pressable
                        onPress={() => setConfirmandoOficial(false)}
                        disabled={enviandoOficial}
                        accessibilityRole="button"
                        style={cs.oficialGhost}
                      >
                        <Text style={cs.oficialGhostTxt}>Cancelar</Text>
                      </Pressable>
                      <Pressable
                        onPress={enviarOficial}
                        disabled={enviandoOficial}
                        accessibilityRole="button"
                        style={[cs.oficialConfirma, enviandoOficial && { opacity: 0.6 }]}
                        testID="cobranca-oficial-enviar"
                      >
                        {enviandoOficial && <ActivityIndicator size="small" color="#fff" />}
                        <Text style={cs.oficialConfirmaTxt}>
                          {enviandoOficial ? "Enviando…" : "Enviar mensagem paga"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {!!resultadoOficial && resultadoOficial.queued === true && (
                  <View style={cs.oficialOk} testID="cobranca-oficial-ok">
                    <Icon name="check_circle" size={14} color={Colors.green} />
                    <Text style={cs.oficialOkTxt}>
                      Cobrança enfileirada no WhatsApp oficial. Acompanhe o status na aba WhatsApp.
                    </Text>
                  </View>
                )}

                {!!resultadoOficial && resultadoOficial.queued !== true && (
                  <View style={cs.oficialWarn} testID="cobranca-oficial-nao-enviou">
                    <Icon name="alert-triangle" size={14} color={Colors.amber} />
                    <Text style={cs.oficialWarnTxt}>
                      {resultadoOficial.erro
                        || waSkipReasonLabel(resultadoOficial.reason)
                        || "A mensagem não foi enfileirada. Tente pelo WhatsApp manual abaixo."}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Botões — F4: hover lift + pressed (antes sem feedback algum) */}
            <View style={cs.btnRow}>
              <Pressable
                style={({ hovered, pressed }: any) => [
                  cs.cancelBtn,
                  (hovered || pressed) && { borderColor: Colors.border2, backgroundColor: Colors.bg4 },
                  pressed && ({ transform: [{ scale: 0.98 }] } as any),
                  IS_WEB ? (webTransition(["background-color", "border-color", "transform"], Motion.fast) as any) : null,
                ]}
                onPress={onClose}
              >
                <Text style={cs.cancelTxt}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ hovered, pressed }: any) => [
                  cs.sendBtn,
                  semTexto && { opacity: 0.5 },
                  hovered && !pressed && ({
                    transform: [{ translateY: -2 }],
                    ...(IS_WEB ? ({ boxShadow: "0 4px 16px rgba(37,211,102,0.35)" } as any) : null),
                  } as any),
                  pressed && ({ transform: [{ scale: 0.98 }] } as any),
                  IS_WEB ? (webTransition(["transform", "box-shadow"], Motion.fast) as any) : null,
                ]}
                onPress={handleSend}
                disabled={semTexto}
                testID="cobranca-enviar-whatsapp"
              >
                <Icon name="whatsapp" size={15} color="#fff" />
                <Text style={cs.sendTxt}>Enviar pelo WhatsApp</Text>
              </Pressable>
            </View>
          </ScrollView>
      </>
      )}
    </ResponsiveSheet>
  );
}

const cs = StyleSheet.create({
  backdrop: {
    flex: 1,
    // F4: backdrop token único (0.72) — antes 0.55, mais claro que os irmãos
    backgroundColor: "rgba(3,5,14,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    width: "100%",
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...(Platform.OS === "web" ? { boxShadow: "0 8px 32px rgba(0,0,0,0.28)" } as any : {}),
    maxHeight: "90%" as any,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.ink,
  },
  xBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.bg4,
    alignItems: "center",
    justifyContent: "center",
  },

  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.violet3,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.ink,
  },
  recipientSub: {
    fontSize: 11,
    color: Colors.ink3,
    marginTop: 2,
  },
  waLabel: {
    color: "#25d366",
    fontWeight: "700",
  },

  valorCard: {
    backgroundColor: Colors.violetD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
    marginBottom: 14,
    alignItems: "center",
  },
  valorLabel: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.violet3,
    letterSpacing: -0.5,
  },
  valorDesc: {
    fontSize: 12,
    color: Colors.ink3,
    marginTop: 4,
  },

  msgLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.ink3,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  // ── Modelos (21/11/2026) ─────────────────────────────────
  lblRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 },
  lblLeft: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  msgLabelInline: { fontSize: 11, fontWeight: "700", color: Colors.ink3, letterSpacing: 0.8 },
  auraTag: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  auraTagTxt: { fontSize: 10.5, fontWeight: "800", color: Colors.violet3 },
  lblLink: { minHeight: 32, justifyContent: "center", paddingHorizontal: 4 },
  lblLinkTxt: { fontSize: 12, fontWeight: "600", color: Colors.violet3 },
  chips: { gap: 7, paddingBottom: 4, marginBottom: 12 },
  chip: {
    minHeight: 36, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
    borderColor: Colors.border2, backgroundColor: Colors.bg2, justifyContent: "center",
  },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2 },
  chipTxtOn: { color: "#fff" },
  chipSmall: { fontWeight: "500", opacity: 0.8 },
  edited: { marginTop: 10, backgroundColor: Colors.amberD, borderWidth: 1, borderColor: Colors.amber + "55", borderRadius: 12, padding: 11 },
  editedTxt: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18, marginBottom: 8 },
  editedActs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  editedSave: {
    minHeight: 40, borderRadius: 10, paddingHorizontal: 13, justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.violetD,
  },
  editedSaveTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  editedBack: { minHeight: 40, paddingHorizontal: 6, justifyContent: "center" },
  editedBackTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  warn: { fontSize: 11.5, color: Colors.amber, marginTop: 8, lineHeight: 16 },
  warnLink: { color: Colors.violet3, fontWeight: "700" },

  msgInput: {
    backgroundColor: Colors.bg4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 13,
    color: Colors.ink,
    minHeight: 120,
    lineHeight: 20,
  },

  note: {
    fontSize: 11,
    color: Colors.ink3,
    marginTop: 10,
    lineHeight: 16,
  },

  // ── Fase 6k: caminho do WhatsApp oficial (pago) ──────────
  oficialBox: {
    marginTop: 12,
    backgroundColor: Colors.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 12,
  },
  oficialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 40,
  },
  oficialBtnTxt: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
  oficialTxt: { fontSize: 11.5, color: Colors.ink2, lineHeight: 16.5 },
  oficialAcoes: { flexDirection: "row", gap: 9 },
  oficialGhost: {
    flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1,
    borderColor: Colors.border, borderRadius: 9, paddingVertical: 10, minHeight: 40,
  },
  oficialGhostTxt: { fontSize: 12, fontWeight: "700", color: Colors.ink3 },
  oficialConfirma: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: Colors.violet, borderRadius: 9, paddingVertical: 10, minHeight: 40,
  },
  oficialConfirmaTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  oficialOk: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  oficialOkTxt: { flex: 1, fontSize: 11.5, fontWeight: "600", color: Colors.green, lineHeight: 16.5 },
  oficialWarn: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  oficialWarnTxt: { flex: 1, fontSize: 11.5, fontWeight: "600", color: Colors.amber, lineHeight: 16.5 },

  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  cancelTxt: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.ink3,
  },
  sendBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#25d366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 44,
  },
  sendTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
