// ============================================================
// VoidBatchModal — retirada de cobrança em lote (Fase F4) · Shoji
//
// Alimenta a multi-seleção JÁ existente na tabela do hub de Anuidades
// (AnnuitiesTable.tsx) com POST .../void-batch — nunca all-or-nothing
// (removed/skipped/errors). É RETIRADA da cobrança (apaga o lançamento),
// NÃO estorno financeiro — a transaction cancelada já preserva a trilha
// (ver karateAnnuityBilling.js, aura-backend PR #359). O backend pula
// (não erra) anuidade com parcela já paga ou com NFS-e emitida/em
// processamento — mostramos o motivo de cada pulo, claro, sem jargão.
//
// Modal RN normal (<Modal>), aberto direto de AnnuitiesTable.tsx (não há
// Modal pai envolvendo a tabela) — mesmo padrão seguro de
// SendEmailBatchModal/BatchLaunchModal (armadilha conhecida: Modal dentro
// de Modal no RN Web renderiza atrás, fica invisível).
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, Modal, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { toast } from "@/components/Toast";
import { karateApi, AnnuityVoidBatchResult } from "@/services/karateApi";

export interface VoidBatchTarget {
  annuityId: string;
  name: string;
  referencePeriod: string;
}

const SKIP_LABEL: Record<string, string> = {
  has_paid_installment: "já tem parcela paga",
  has_nfse: "tem NFS-e emitida",
  not_found: "cobrança não encontrada (pode já ter sido removida)",
};

type Props = {
  visible: boolean;
  federationId: string;
  targets: VoidBatchTarget[];
  onClose: () => void;
  onDone: () => void;
};

export function VoidBatchModal({ visible, federationId, targets, onClose, onDone }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AnnuityVoidBatchResult | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSubmitting(false);
    setResult(null);
  }, [visible]);

  async function handleConfirm() {
    if (targets.length === 0) return;
    setSubmitting(true);
    try {
      const res = await karateApi.voidAnnuitiesBatch(federationId, {
        annuity_ids: targets.map((t) => t.annuityId),
      });
      setResult(res);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível retirar as cobranças.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = result ? "Retirada concluída" : "Retirar cobrança em lote";

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
                    <Text style={[st.metricValue, { color: P.ok }]}>{result.removed.length}</Text>
                    <Text style={st.metricLabel}>retiradas</Text>
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
                      Erro parcial não invalida o lote — as retiradas concluídas acima já valeram normalmente. Reveja os itens com erro e tente de novo só para eles.
                    </Text>
                  </View>
                )}

                {result.skipped.length > 0 && (
                  <View style={st.group}>
                    <Text style={st.groupTitle}>Pulados</Text>
                    {result.skipped.map((s) => {
                      const t = targets.find((x) => x.annuityId === s.annuity_id);
                      return (
                        <View key={s.annuity_id} style={st.row}>
                          <View style={{ flex: 1 }}>
                            <Text style={st.rowName} numberOfLines={1}>{t?.name || "—"}</Text>
                            <Text style={st.rowMeta}>{SKIP_LABEL[s.reason] || s.reason}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {result.errors.length > 0 && (
                  <View style={st.group}>
                    <Text style={st.groupTitle}>Com erro</Text>
                    {result.errors.map((e, idx) => {
                      const t = targets.find((x) => x.annuityId === e.annuity_id);
                      return (
                        <View key={`${e.annuity_id}-${idx}`} style={st.row}>
                          <Text style={st.rowName} numberOfLines={1}>{t?.name || "—"}</Text>
                          <Text style={[st.rowMeta, { color: P.danger }]} numberOfLines={2}>{e.reason}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <>
                <View style={st.warnBox}>
                  <Icon name="warning" size={15} color={P.danger} />
                  <Text style={st.warnText}>
                    Isso é retirada da cobrança (apaga o lançamento), não um estorno financeiro. Esta ação não pode ser desfeita. Cobrança com parcela já paga ou NFS-e emitida é pulada automaticamente — não é removida.
                  </Text>
                </View>

                <Text style={st.hint}>
                  {targets.length} cobrança{targets.length === 1 ? "" : "s"} selecionada{targets.length === 1 ? "" : "s"} será{targets.length === 1 ? "" : "ão"} retirada{targets.length === 1 ? "" : "s"}, se elegível{targets.length === 1 ? "" : "eis"}.
                </Text>

                <View style={st.list}>
                  {targets.slice(0, 8).map((t) => (
                    <Text key={t.annuityId} style={st.listItem} numberOfLines={1}>· {t.name} — {t.referencePeriod}</Text>
                  ))}
                  {targets.length > 8 && <Text style={st.listMore}>+ {targets.length - 8} outra{targets.length - 8 === 1 ? "" : "s"}</Text>}
                  {targets.length === 0 && <Text style={st.listMore}>Nenhuma cobrança elegível na seleção.</Text>}
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
                  style={[st.btnDanger, (submitting || targets.length === 0) && { opacity: 0.6 }]}
                >
                  {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.btnDangerTxt}>Retirar {targets.length} cobrança{targets.length === 1 ? "" : "s"}</Text>}
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
  btnDanger: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: R.md, backgroundColor: P.red, minWidth: 170, alignItems: "center" } as ViewStyle,
  btnDangerTxt: { fontSize: 13.5, fontWeight: "600", color: "#fff" } as TextStyle,

  warnBox: { flexDirection: "row", gap: 9, alignItems: "flex-start", backgroundColor: P.dangerWash, borderWidth: 1, borderColor: P.redLine, borderRadius: R.md, padding: 12 } as ViewStyle,
  warnText: { flex: 1, fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.ink2 } as TextStyle,

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
});

export default VoidBatchModal;
