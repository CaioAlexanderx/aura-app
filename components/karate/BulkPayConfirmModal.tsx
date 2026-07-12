// ============================================================
// BulkPayConfirmModal — confirmação de "Registrar pagamento" em lote
// (hotfix P0, 11/07/2026) · Shoji
//
// BUG P0 do QA: o botão "Registrar pagamento" da barra de multi-seleção
// (AnnuitiesTable.tsx) disparava a baixa IMEDIATAMENTE ao clique, sem
// nenhum passo de confirmação — TODAS as outras ações da barra (PIX,
// editar, remover, e-mail, campanha) já passavam por modal. Um clique
// exploratório no QA marcou 3 anuidades REAIS como pagas (revertidas
// manualmente). Este modal fecha esse buraco: mostra CONTAGEM + VALOR
// TOTAL que será marcado como pago + os nomes, com "Cancelar" e
// "Confirmar pagamento" claramente separados — mesmo padrão de
// VoidBatchModal/SendEmailBatchModal (mesmos arquivos, PR #359/#4xx).
//
// A baixa em si (Promise.allSettled por parcela, nunca all-or-nothing)
// mora AQUI dentro agora (antes vivia em handleBulkPay direto em
// AnnuitiesTable.tsx) — resultado final mostra pagos/com erro, igual aos
// outros modais de lote.
//
// Modal RN normal (<Modal>), aberto direto de AnnuitiesTable.tsx (não há
// Modal pai envolvendo a tabela) — mesmo padrão seguro dos outros modais
// de lote (armadilha conhecida: Modal dentro de Modal no RN Web renderiza
// atrás, fica invisível).
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, Modal, Pressable, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { karateApi } from "@/services/karateApi";

export interface BulkPayTarget {
  key: string;
  instId: string;
  name: string;
  amount: number;
  referencePeriod: string;
}

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type BulkPayResult = {
  ok: string[];
  fail: { name: string; reason: string }[];
};

type Props = {
  visible: boolean;
  federationId: string;
  targets: BulkPayTarget[];
  /** Selecionados que NÃO entraram em `targets` por não terem parcela
   *  pendente pra pagar (já totalmente pagos, ou sem cobrança) —
   *  informativo, não é erro (mesmo padrão de noPendingCount do
   *  SendEmailBatchModal). */
  noPendingCount: number;
  onClose: () => void;
  onDone: () => void;
};

export function BulkPayConfirmModal({ visible, federationId, targets, noPendingCount, onClose, onDone }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkPayResult | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSubmitting(false);
    setResult(null);
  }, [visible]);

  const totalAmount = targets.reduce((s, t) => s + t.amount, 0);

  async function handleConfirm() {
    if (targets.length === 0) return;
    setSubmitting(true);
    const settled = await Promise.allSettled(targets.map(async (t) => {
      await karateApi.payInstallment(federationId, t.instId, { payment_method: "pix" });
      return t.name;
    }));
    const ok: string[] = [];
    const fail: { name: string; reason: string }[] = [];
    settled.forEach((r, idx) => {
      if (r.status === "fulfilled") ok.push(r.value);
      else fail.push({ name: targets[idx].name, reason: (r.reason && r.reason.message) || "erro" });
    });
    setSubmitting(false);
    setResult({ ok, fail });
  }

  const title = result ? "Pagamento registrado" : "Registrar pagamento em lote";

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
                    <Text style={[st.metricValue, { color: P.ok }]}>{result.ok.length}</Text>
                    <Text style={st.metricLabel}>pagos</Text>
                  </View>
                  <View style={[st.metric, result.fail.length ? st.metricDanger : st.metricNeutral]}>
                    <Icon name={result.fail.length ? "warning" : "ellipse-outline"} size={16} color={result.fail.length ? P.danger : C.ink4} />
                    <Text style={[st.metricValue, { color: result.fail.length ? P.danger : C.ink4 }]}>{result.fail.length}</Text>
                    <Text style={st.metricLabel}>com erro</Text>
                  </View>
                </View>

                {result.fail.length > 0 && (
                  <View style={st.note}>
                    <Text style={st.noteText}>
                      Erro parcial não invalida o lote — os pagamentos registrados acima já valeram normalmente. Reveja os itens com erro e tente de novo só para eles.
                    </Text>
                  </View>
                )}

                {result.fail.length > 0 && (
                  <View style={st.group}>
                    <Text style={st.groupTitle}>Com erro</Text>
                    {result.fail.map((f, idx) => (
                      <View key={`${f.name}-${idx}`} style={st.row}>
                        <Text style={st.rowName} numberOfLines={1}>{f.name}</Text>
                        <Text style={[st.rowMeta, { color: P.danger }]} numberOfLines={2}>{f.reason}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <>
                <View style={st.warnBox}>
                  <Icon name="warning" size={15} color={P.danger} />
                  <Text style={st.warnText}>
                    Isso vai marcar {targets.length} cobrança{targets.length === 1 ? "" : "s"} como paga{targets.length === 1 ? "" : "s"} — total {fmtMoney(totalAmount)}. Esta ação não pode ser desfeita.
                  </Text>
                </View>

                {noPendingCount > 0 && (
                  <Text style={st.hint}>
                    {noPendingCount} selecionado{noPendingCount === 1 ? "" : "s"} ficará{noPendingCount === 1 ? "" : "ão"} de fora — sem parcela pendente pra pagar.
                  </Text>
                )}

                <View style={st.list}>
                  {targets.slice(0, 8).map((t) => (
                    <Text key={t.key} style={st.listItem} numberOfLines={1}>
                      · {t.name} — {fmtMoney(t.amount)} — {t.referencePeriod}
                    </Text>
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
                  style={[st.btnPrimaryAccent, (submitting || targets.length === 0) && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Confirmar pagamento de ${targets.length} cobranças`}
                >
                  {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={st.btnPrimaryAccentTxt}>Confirmar pagamento de {targets.length}</Text>
                  )}
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
  // Verde (P.ok) — deliberadamente NÃO vermelho: "Registrar pagamento" não
  // é uma ação destrutiva como "Retirar cobrança" (btnDanger em
  // VoidBatchModal), mas precisa ficar visualmente distinto do Cancelar
  // (btnGhost) — cor de confirmação positiva, alto contraste com o fundo.
  btnPrimaryAccent: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: R.md, backgroundColor: P.ok, minWidth: 190, alignItems: "center" } as ViewStyle,
  btnPrimaryAccentTxt: { fontSize: 13.5, fontWeight: "700", color: "#fff" } as TextStyle,

  warnBox: { flexDirection: "row", gap: 9, alignItems: "flex-start", backgroundColor: P.dangerWash, borderWidth: 1, borderColor: P.redLine, borderRadius: R.md, padding: 12 } as ViewStyle,
  warnText: { flex: 1, fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.ink2 } as TextStyle,

  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 } as ViewStyle,
  metric: { flexGrow: 1, flexBasis: 120, alignItems: "center", gap: 4, paddingVertical: 14, borderRadius: R.lg, borderWidth: 1 } as ViewStyle,
  metricOk: { backgroundColor: P.okWash, borderColor: P.okLine } as ViewStyle,
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

export default BulkPayConfirmModal;
