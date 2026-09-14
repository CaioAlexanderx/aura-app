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
// ============================================================
import { useEffect, useState } from "react";
import {
  View, Text, Pressable, TextInput, StyleSheet,
  Platform, Linking, ScrollView, ActivityIndicator,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { Motion, webTransition } from "@/constants/motion";
import { waSkipReasonLabel } from "@/components/whatsapp/waGuards";

const IS_WEB = Platform.OS === "web";

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
}: CobrancaPreviewProps) {
  const [message, setMessage] = useState(initialMessage);
  // Confirmação do envio pago: o primeiro clique escolhe, o segundo gasta.
  const [confirmandoOficial, setConfirmandoOficial] = useState(false);
  const [enviandoOficial, setEnviandoOficial] = useState(false);
  const [resultadoOficial, setResultadoOficial] = useState<EnvioOficialResultado | null>(null);

  // F4: reseta a mensagem sempre que o modal reabre com nova proposta
  // (antes dependia do pai remontar o componente — risco de mensagem obsoleta).
  useEffect(() => {
    if (visible) {
      setMessage(initialMessage);
      setConfirmandoOficial(false);
      setEnviandoOficial(false);
      setResultadoOficial(null);
    }
  }, [visible, initialMessage]);

  const initial = (recipientName.trim()[0] || "?").toUpperCase();
  const oficialDisponivel = podeEnviarOficial === true && typeof onEnviarOficial === "function";

  function handleSend() {
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
            />

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
                  hovered && !pressed && ({
                    transform: [{ translateY: -2 }],
                    ...(IS_WEB ? ({ boxShadow: "0 4px 16px rgba(37,211,102,0.35)" } as any) : null),
                  } as any),
                  pressed && ({ transform: [{ scale: 0.98 }] } as any),
                  IS_WEB ? (webTransition(["transform", "box-shadow"], Motion.fast) as any) : null,
                ]}
                onPress={handleSend}
              >
                <Icon name="message_circle" size={15} color="#fff" />
                <Text style={cs.sendTxt}>Enviar pelo WhatsApp</Text>
              </Pressable>
            </View>
          </ScrollView>
      </>
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
