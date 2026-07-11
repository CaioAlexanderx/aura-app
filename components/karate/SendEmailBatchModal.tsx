// ============================================================
// SendEmailBatchModal — envio de e-mail de cobrança em lote (Fase F4) · Shoji
//
// Alimenta a multi-seleção JÁ existente na tabela do hub de Anuidades
// (AnnuitiesTable.tsx) com POST .../send-email-batch — nunca all-or-nothing
// (sent/skipped/errors). Alvo sem e-mail cadastrado é o estado NORMAL da
// maioria dos dojôs/praticantes hoje (ver CLAUDE.md do app) — aparece em
// "pulados", nunca em "erros", com um botão para cobrar por WhatsApp em
// vez disso.
//
// Modal RN normal (<Modal>), aberto direto de AnnuitiesTable.tsx (não há
// Modal pai envolvendo a tabela) — mesmo padrão seguro de
// BatchLaunchModal/PixPaymentModal. Quando o operador pede "Cobrar via
// WhatsApp" num item pulado, este modal se FECHA primeiro (onOpenWhatsApp
// já dispara isso no caller) antes do WhatsAppChargeModal abrir — nunca os
// dois <Modal> ficam montados ao mesmo tempo (armadilha conhecida: Modal
// dentro de Modal no RN Web renderiza atrás, fica invisível).
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, Modal, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { toast } from "@/components/Toast";
import { karateApi, AnnuityEmailBatchResult, AnnuityStatus } from "@/services/karateApi";
import type { WhatsAppChargeTarget } from "@/components/karate/WhatsAppChargeModal";

export interface EmailBatchTarget {
  key: string;
  instId: string;
  name: string;
  whatsapp: string | null;
  amount: number;
  referencePeriod: string;
  dueDate: string | null;
  status: AnnuityStatus;
}

const SKIP_LABEL: Record<string, string> = {
  sem_email: "sem e-mail cadastrado",
  parcela_ja_paga: "parcela já paga",
};

type Props = {
  visible: boolean;
  federationId: string;
  targets: EmailBatchTarget[];
  /** Selecionados que NÃO entraram em `targets` por não terem parcela
   *  pendente (já totalmente pagos) — informativo, não é erro. */
  noPendingCount: number;
  onClose: () => void;
  onDone: () => void;
  /** Fecha este modal e devolve o alvo pro caller abrir o WhatsAppChargeModal
   *  (nunca os dois <Modal> montados ao mesmo tempo). */
  onOpenWhatsApp: (target: WhatsAppChargeTarget) => void;
};

export function SendEmailBatchModal({ visible, federationId, targets, noPendingCount, onClose, onDone, onOpenWhatsApp }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnnuityEmailBatchResult | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSubmitting(false);
    setResult(null);
  }, [visible]);

  async function handleConfirm() {
    if (targets.length === 0) return;
    setSubmitting(true);
    try {
      const res = await karateApi.sendAnnuityEmailBatch(federationId, {
        installment_ids: targets.map((t) => t.instId),
      });
      setResult(res);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível enviar os e-mails.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleWhatsApp(instId: string) {
    const t = targets.find((x) => x.instId === instId);
    if (!t) return;
    onOpenWhatsApp({
      name: t.name,
      phone: t.whatsapp,
      amount: t.amount,
      reference_period: t.referencePeriod,
      due_date: t.dueDate,
      status: t.status,
    });
  }

  const title = result ? "Envio concluído" : "Enviar cobrança por e-mail";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={result ? onDone : onClose}>
      <View style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !submitting && (result ? onDone() : onClose())} />
        <View style={st.card}>
          <View style={st.head}>
            <Text style={st.title}>{title}</Text>
            <TouchableOpacity onPress={result ? onDone : onClose} disabled={submitting} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={20} color={C.ink3} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, gap: 14, maxHeight: 460 }}>
            {result ? (
              <View style={{ gap: 14 }}>
                <View style={st.metricsRow}>
                  <View style={[st.metric, st.metricOk]}>
                    <Icon name="checkmark-circle" size={16} color={P.ok} />
                    <Text style={[st.metricValue, { color: P.ok }]}>{result.sent.length}</Text>
                    <Text style={st.metricLabel}>enviados</Text>
                  </View>
                  <View style={[st.metric, st.metricWarn]}>
                    <Icon name="time" size={16} color={P.warn} />
                    <Text style={[st.metricValue, { color: P.warn }]}>{result.skipped.length}</Text>
                    <Text style={st.metricLabel}>pulados</Text>
                  </View>
                  <View style={[st.metric, result.errors.length ? st.metricDanger : st.metricNeutral]}>
                    <Icon name={result.errors.length ? "warning" : "ellipse-outline"} size={16} color={result.errors.length ? P.danger : C.ink4} />
                    <Text style={[st.metricValue, { color: result.errors.length ? P.danger : C.ink4 }]}>{result.errors.length}</Text>
                    <Text style={st.metricLabel}>com erro</Text>
                  </View>
                </View>

                {result.errors.length > 0 && (
                  <View style={st.note}>
                    <Text style={st.noteText}>
                      Erro parcial não invalida o lote — os e-mails enviados acima já saíram normalmente. Reveja os itens com erro e tente de novo só para eles.
                    </Text>
                  </View>
                )}

                {result.skipped.length > 0 && (
                  <View style={st.group}>
                    <Text style={st.groupTitle}>Pulados</Text>
                    {result.skipped.map((s) => (
                      <View key={s.installment_id} style={st.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={st.rowName} numberOfLines={1}>{s.name}</Text>
                          <Text style={st.rowMeta}>{SKIP_LABEL[s.reason] || s.reason}</Text>
                        </View>
                        {s.reason === "sem_email" && (
                          <TouchableOpacity style={st.waBtn} onPress={() => handleWhatsApp(s.installment_id)} accessibilityRole="button" accessibilityLabel={`Cobrar ${s.name} via WhatsApp`}>
                            <Icon name="logo-whatsapp" size={13} color="#25D366" />
                            <Text style={st.waBtnText}>WhatsApp</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {result.errors.length > 0 && (
                  <View style={st.group}>
                    <Text style={st.groupTitle}>Com erro</Text>
                    {result.errors.map((e, idx) => (
                      <View key={`${e.installment_id}-${idx}`} style={st.row}>
                        <Text style={st.rowName} numberOfLines={1}>{e.name || "—"}</Text>
                        <Text style={[st.rowMeta, { color: P.danger }]} numberOfLines={2}>{e.reason}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <>
                <Text style={st.hint}>
                  {targets.length} cobrança{targets.length === 1 ? "" : "s"} pendente{targets.length === 1 ? "" : "s"} receberá{targets.length === 1 ? "" : "ão"} o e-mail configurado na Régua.
                  {noPendingCount > 0 ? ` ${noPendingCount} selecionado${noPendingCount === 1 ? "" : "s"} não ${noPendingCount === 1 ? "tem" : "têm"} parcela pendente e não ${noPendingCount === 1 ? "será enviado" : "serão enviados"}.` : ""}
                  {" "}Quem não tiver e-mail cadastrado aparece como pulado — sugerimos o WhatsApp pra esses.
                </Text>

                <View style={st.list}>
                  {targets.slice(0, 8).map((t) => (
                    <Text key={t.key} style={st.listItem} numberOfLines={1}>· {t.name}</Text>
                  ))}
                  {targets.length > 8 && <Text style={st.listMore}>+ {targets.length - 8} outro{targets.length - 8 === 1 ? "" : "s"}</Text>}
                  {targets.length === 0 && <Text style={st.listMore}>Nenhum selecionado tem parcela pendente pra cobrar por e-mail.</Text>}
                </View>
              </>
            )}
          </View>

          <View style={st.footer}>
            {result ? (
              <TouchableOpacity onPress={onDone} style={st.btnPrimary}>
                <Text style={st.btnPrimaryTxt}>Concluir</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={onClose} disabled={submitting} style={st.btnGhost}>
                  <Text style={st.btnGhostTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirm}
                  disabled={submitting || targets.length === 0}
                  style={[st.btnPrimary, (submitting || targets.length === 0) && { opacity: 0.6 }]}
                >
                  {submitting ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={st.btnPrimaryTxt}>Enviar {targets.length} e-mail{targets.length === 1 ? "" : "s"}</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card:      { width: "100%", maxWidth: 480, backgroundColor: P.paperWarm, borderRadius: R.xl, overflow: "hidden", borderWidth: 1, borderColor: C.line2, maxHeight: "92%" } as ViewStyle,
  head:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: P.glassHi } as ViewStyle,
  title:     { fontFamily: F.heading, fontSize: 18, color: C.ink } as TextStyle,
  hint:      { fontFamily: F.body, fontSize: 12.5, color: C.ink2, lineHeight: 18 } as TextStyle,
  list:      { gap: 3, backgroundColor: P.glass2, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 10 } as ViewStyle,
  listItem:  { fontFamily: F.body, fontSize: 12, color: C.ink } as TextStyle,
  listMore:  { fontFamily: F.body, fontSize: 11, color: C.ink3, fontStyle: "italic", marginTop: 2 } as TextStyle,
  footer:    { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: P.glassHi } as ViewStyle,
  btnGhost:  { paddingVertical: 11, paddingHorizontal: 18, borderRadius: R.md, borderWidth: 1, borderColor: C.line2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  btnPrimary: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: R.md, backgroundColor: P.ink, minWidth: 150, alignItems: "center" } as ViewStyle,
  btnPrimaryTxt: { fontSize: 13.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,

  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 } as ViewStyle,
  metric: { flexGrow: 1, flexBasis: 120, alignItems: "center", gap: 4, paddingVertical: 14, borderRadius: R.lg, borderWidth: 1 } as ViewStyle,
  metricOk: { backgroundColor: P.okWash, borderColor: P.okLine } as ViewStyle,
  metricWarn: { backgroundColor: P.warnWash, borderColor: "rgba(156,111,46,0.3)" } as ViewStyle,
  metricDanger: { backgroundColor: P.dangerWash, borderColor: P.redLine } as ViewStyle,
  metricNeutral: { backgroundColor: P.glass2, borderColor: C.line2 } as ViewStyle,
  metricValue: { fontFamily: F.heading, fontSize: 26, fontWeight: "400" } as TextStyle,
  metricLabel: { fontFamily: F.body, fontSize: 11, color: C.ink3, textAlign: "center", paddingHorizontal: 8 } as TextStyle,

  note: { backgroundColor: P.warnWash, borderWidth: 1, borderColor: "rgba(156,111,46,0.3)", borderRadius: R.md, padding: 12 } as ViewStyle,
  noteText: { fontFamily: F.body, fontSize: 12.5, lineHeight: 18, color: C.ink2 } as TextStyle,

  group: { gap: 6 } as ViewStyle,
  groupTitle: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: C.ink3, textTransform: "uppercase", letterSpacing: 1 } as TextStyle,
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  rowName: { fontFamily: F.body, fontSize: 12.5, color: C.ink } as TextStyle,
  rowMeta: { fontFamily: F.mono, fontSize: 11, color: C.ink3, marginTop: 2 } as TextStyle,
  waBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(37,211,102,0.4)", backgroundColor: "rgba(37,211,102,0.10)", borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 10 } as ViewStyle,
  waBtnText: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: "#1f9e56" } as TextStyle,
});

export default SendEmailBatchModal;
