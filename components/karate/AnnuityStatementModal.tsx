// ============================================================
// AnnuityStatementModal — Fase F4/F4.5 · Shoji
//
// Extrato de uma anuidade (dojô ou praticante): consome GET .../payments
// (ledger karate_annuity_payments, F3) e lista as baixas — valor, data,
// forma, parcela. Mais recente primeiro (já vem ordenado do backend,
// `paid_at DESC, created_at DESC` — não reordenamos aqui).
//
// F4.5 (decisão do Caio, 23/07/2026 — PR #431, aura-backend, já no ar):
// cada baixa ganha "Editar" e "Remover". As duas ações mutam
// karate_annuity_payments no backend e SEMPRE respondem com o ledger/
// header já recomputados — o front NUNCA calcula saldo/status aqui, só
// refaz o refetch (do extrato via `load()` E da lista/KPIs do hub via
// `onMutated`, prop nova) depois de qualquer uma das duas ações. Zero
// patch otimista de dinheiro (mesma regra do resto do F3/F4).
//
// 🔴 Modal-dentro-de-Modal (RN Web): este componente já É um <Modal> de
// topo. "Editar" NÃO abre outro <Modal> por cima (renderizaria atrás e
// sumiria — já mordeu este produto 5×) — o form de edição aparece INLINE,
// substituindo o corpo do card da própria linha (mesmo padrão que
// AnnuitiesTable.tsx já usa pra confirmar "Remover cobrança": um box que
// nasce dentro do próprio card, não um modal novo). "Remover" segue o
// mesmo padrão inline pra confirmação — 🔴 OBRIGATÓRIA (cicatriz: um
// agente já marcou 3 anuidades pagas por engano numa ação sem confirmação;
// remover baixa é dinheiro, não pode ser 1 toque).
//
// Datas: SEMPRE por regex sobre a string ISO — NUNCA `new Date(iso)` (o
// motivo, documentado na tarefa: `new Date('YYYY-MM-DD')` interpreta meia-
// noite UTC, que em horário de Brasília (UTC-3) já é o dia anterior às
// 21h — "volta um dia"). `paid_at`/`created_at` aqui são timestamptz
// completos (com hora), então o mesmo cuidado vale: extraímos ano/mês/dia/
// hora/minuto por regex direto da string, sem nunca instanciar Date. O
// input de edição de data usa dd/mm/aaaa mascarado (components/inputs/
// DateInput — maskBrDate/parseBrDate), mesmo padrão do resto do produto.
//
// "Quem" registrou: o ledger (`created_by`) só traz o id bruto do usuário
// — este endpoint não faz o join pro nome (diferente de
// GET /financial/audit, que resolve `actor_label` server-side pra outro
// propósito). Por isso mostramos só presença/ausência de operador, não um
// nome — documentado explicitamente no PR como uma simplificação
// conhecida, não um dado inventado.
//
// Modal único (RN <Modal>), sempre aberto/fechado sozinho — AnnuitiesTable
// garante que nenhum outro modal fica montado ao mesmo tempo (armadilha
// Modal-dentro-de-Modal).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput,
  StyleSheet, ViewStyle, TextStyle, Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { maskBrDate, parseBrDate } from "@/components/inputs/DateInput";
import { karateApi, AnnuityPaymentLedgerEntry, AnnuityPaymentMethod } from "@/services/karateApi";

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  credito_cbkt: "Crédito CBKT",
  credito_exame: "Crédito exame/curso",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};
function methodLabel(m: string | null): string {
  if (!m) return "—";
  return METHOD_LABEL[m] ?? m;
}

// Chips de edição — as mesmas 5 formas que AnnuityReceiveModal oferece pra
// baixa NOVA (instrução explícita da tarefa: reusar, não recriar). Baixas
// legadas podem ter 'transferencia'/'outro' — se a baixa sendo editada tem
// um desses, ele entra como chip extra pra não forçar troca de forma só
// por estar editando outra coisa (valor/data).
const EDIT_METHODS: { key: AnnuityPaymentMethod; label: string }[] = [
  { key: "pix", label: "Pix" },
  { key: "dinheiro", label: "Dinheiro" },
  { key: "credito_cbkt", label: "Crédito CBKT" },
  { key: "credito_exame", label: "Crédito exame/curso" },
  { key: "boleto", label: "Boleto" },
];

// Parser tolerante de valor em pt-BR — mesmo padrão de AnnuityReceiveModal.
function parseAmountInput(raw: string): number {
  const cleaned = String(raw).trim().replace(/[^\d,.\-]/g, "");
  if (!cleaned) return 0;
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}
function fmtAmountForInput(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function kindLabel(kind: string, seq: number): string {
  if (kind === "filiacao" || seq === 0) return "Filiação";
  return `Parcela ${seq}`;
}

// Regex puro sobre a string ISO — nunca `new Date(iso)` (ver comentário do
// topo do arquivo). Aceita 'YYYY-MM-DDTHH:MM' ou 'YYYY-MM-DD HH:MM' com
// qualquer sufixo de segundos/offset depois.
function fmtPaidAt(iso: string): { date: string; time: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(iso || ""));
  if (!m) return { date: String(iso || "—"), time: "" };
  return { date: `${m[3]}/${m[2]}/${m[1]}`, time: `${m[4]}:${m[5]}` };
}
// Pra pré-preencher o input de data (dd/mm/aaaa) a partir do paid_at ISO —
// mesma extração por regex, sem Date.
function isoPaidAtToBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

interface AnnuityStatementModalProps {
  visible: boolean;
  federationId: string;
  annuityId: string;
  name: string;
  onClose: () => void;
  /** F4.5 — chamado depois de qualquer edição/remoção de baixa bem-sucedida,
   *  além do refetch interno do próprio extrato (`load()`). Quem abre este
   *  modal (AnnuitiesTable) usa isso pra recarregar a lista/KPIs (mesma
   *  fonte que a folha de baixa livre já recarrega em onSuccess) — nunca um
   *  patch otimista de dinheiro em estado paralelo. */
  onMutated: () => void;
}

type RowAction =
  | { type: "none" }
  | { type: "edit"; id: string }
  | { type: "delete"; id: string };

export function AnnuityStatementModal({ visible, federationId, annuityId, name, onClose, onMutated }: AnnuityStatementModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [entries, setEntries] = useState<AnnuityPaymentLedgerEntry[]>([]);
  const [total, setTotal] = useState(0);

  const [action, setAction] = useState<RowAction>({ type: "none" });
  const [editAmount, setEditAmount] = useState("");
  const [editDateBr, setEditDateBr] = useState("");
  const [editMethod, setEditMethod] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await karateApi.getAnnuityPayments(federationId, annuityId);
      setEntries(res.data);
      setTotal(res.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId, annuityId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  // Fecha qualquer ação em aberto sempre que o extrato fecha/reabre —
  // nunca deixa um form de edição "vazando" pra próxima abertura.
  useEffect(() => {
    if (!visible) {
      setAction({ type: "none" });
      setEditErr(null);
      setEditSaving(false);
      setDeleteBusy(false);
    }
  }, [visible]);

  function startEdit(e: AnnuityPaymentLedgerEntry) {
    setAction({ type: "edit", id: e.id });
    setEditAmount(fmtAmountForInput(e.amount));
    setEditDateBr(isoPaidAtToBr(e.paid_at));
    setEditMethod(e.payment_method || null);
    setEditErr(null);
  }
  function startDelete(e: AnnuityPaymentLedgerEntry) {
    setAction({ type: "delete", id: e.id });
  }
  function cancelAction() {
    if (editSaving || deleteBusy) return;
    setAction({ type: "none" });
    setEditErr(null);
  }

  async function confirmEdit(e: AnnuityPaymentLedgerEntry) {
    const amt = parseAmountInput(editAmount);
    if (!amt || amt <= 0) { setEditErr("Informe um valor válido."); return; }
    if (editDateBr.length !== 10) { setEditErr("Informe a data (dd/mm/aaaa)."); return; }
    const iso = parseBrDate(editDateBr);
    if (!iso) { setEditErr("Data inválida (dd/mm/aaaa)."); return; }

    setEditSaving(true);
    setEditErr(null);
    try {
      await karateApi.updateAnnuityPayment(federationId, annuityId, e.id, {
        amount: amt,
        paid_at: iso,
        ...(editMethod ? { payment_method: editMethod as AnnuityPaymentMethod } : {}),
      });
      toast.success("Baixa atualizada");
      setEditSaving(false);
      setAction({ type: "none" });
      load();       // refetch do extrato — fonte única, sem patch otimista
      onMutated();  // refetch da lista/KPIs do hub
    } catch (err: any) {
      setEditSaving(false);
      const code = err?.data?.code ?? null;
      const msg = code === "AMOUNT_EXCEEDS_BALANCE"
        ? "Valor maior que o saldo em aberto deste recebível. Ajuste o valor — não é possível gerar crédito."
        : err?.message || "Não foi possível salvar a baixa agora.";
      // Nunca limpa o que o operador digitou.
      setEditErr(msg);
      toast.error(msg);
    }
  }

  async function confirmDelete(e: AnnuityPaymentLedgerEntry) {
    setDeleteBusy(true);
    try {
      await karateApi.deleteAnnuityPayment(federationId, annuityId, e.id);
      toast.success(`Baixa de ${fmtMoney(e.amount)} removida`);
      setDeleteBusy(false);
      setAction({ type: "none" });
      load();       // refetch do extrato
      onMutated();  // refetch da lista/KPIs do hub — saldo/status recomputados no backend
    } catch (err: any) {
      setDeleteBusy(false);
      toast.error(err?.message || "Não foi possível remover a baixa agora.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={styles.sheet}>
          <View style={styles.shead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>EXTRATO</Text>
              <Text style={styles.stitle} numberOfLines={1}>{name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar extrato" hitSlop={8}>
              <Icon name="x" size={20} color={C.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.sbody}>
            {loading ? (
              <View style={{ paddingVertical: 30, alignItems: "center" }}>
                <ActivityIndicator size="small" color={P.red} />
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Não foi possível carregar o extrato agora.</Text>
                <TouchableOpacity onPress={load} accessibilityRole="button" accessibilityLabel="Tentar novamente">
                  <Text style={styles.retryLabel}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : entries.length === 0 ? (
              <View style={{ paddingVertical: 24 }}>
                <Text style={styles.emptyText}>Nenhuma baixa registrada ainda para este recebível.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.totalLine}>
                  {entries.length} {entries.length === 1 ? "baixa" : "baixas"} · total {fmtMoney(total)}
                </Text>
                <View style={{ gap: 8 }}>
                  {entries.map((e) => {
                    const when = fmtPaidAt(e.paid_at);
                    const isEditing = action.type === "edit" && action.id === e.id;
                    const isDeleting = action.type === "delete" && action.id === e.id;
                    return (
                      <View key={e.id} style={styles.entryRow}>
                        <View style={styles.entryDot} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                            <Text style={styles.entryKind}>{kindLabel(e.kind, e.seq)}</Text>
                            <Text style={styles.entryAmount}>{fmtMoney(e.amount)}</Text>
                          </View>
                          <Text style={styles.entryMeta}>
                            {when.date}{when.time ? ` às ${when.time}` : ""} · {methodLabel(e.payment_method)}
                            {e.created_by ? " · registrado manualmente" : ""}
                          </Text>

                          {!isEditing && !isDeleting && (
                            <View style={styles.entryActions}>
                              <TouchableOpacity
                                onPress={() => startEdit(e)}
                                style={styles.entryActionBtn}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={`Editar baixa de ${fmtMoney(e.amount)}`}
                              >
                                <Icon name="edit" size={12} color={C.ink3} />
                                <Text style={styles.entryActionLabel}>Editar</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => startDelete(e)}
                                style={styles.entryActionBtn}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={`Remover baixa de ${fmtMoney(e.amount)}`}
                              >
                                <Icon name="trash-outline" size={12} color={P.danger} />
                                <Text style={[styles.entryActionLabel, { color: P.danger }]}>Remover</Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {/* ── Editar (inline — NUNCA outro <Modal>) ── */}
                          {isEditing && (
                            <View style={styles.editBox}>
                              <Text style={styles.editLabel}>VALOR</Text>
                              <View style={styles.editAmtWrap}>
                                <Text style={styles.editAmtCur}>R$</Text>
                                <TextInput
                                  style={styles.editAmtInput}
                                  value={editAmount}
                                  onChangeText={setEditAmount}
                                  keyboardType="decimal-pad"
                                  accessibilityLabel="Valor da baixa"
                                />
                              </View>

                              <Text style={styles.editLabel}>DATA</Text>
                              <TextInput
                                style={styles.editDateInput}
                                value={editDateBr}
                                onChangeText={(t) => setEditDateBr(maskBrDate(t))}
                                placeholder="dd/mm/aaaa"
                                keyboardType="number-pad"
                                maxLength={10}
                                accessibilityLabel="Data da baixa"
                              />

                              <Text style={styles.editLabel}>FORMA</Text>
                              <View style={styles.editMethodsRow}>
                                {(EDIT_METHODS.some((m) => m.key === editMethod)
                                  ? EDIT_METHODS
                                  : editMethod
                                    ? [...EDIT_METHODS, { key: editMethod as AnnuityPaymentMethod, label: methodLabel(editMethod) }]
                                    : EDIT_METHODS
                                ).map((m) => (
                                  <TouchableOpacity
                                    key={m.key}
                                    style={[styles.editMchip, editMethod === m.key && styles.editMchipOn]}
                                    onPress={() => setEditMethod(m.key)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: editMethod === m.key }}
                                    accessibilityLabel={`Forma de pagamento ${m.label}`}
                                  >
                                    <Text style={[styles.editMchipLabel, editMethod === m.key && styles.editMchipLabelOn]}>{m.label}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>

                              {editErr && (
                                <View style={styles.editWarnBox}>
                                  <Icon name="warning" size={12} color={P.danger} />
                                  <Text style={styles.editWarnText}>{editErr}</Text>
                                </View>
                              )}

                              <View style={styles.editFoot}>
                                <TouchableOpacity onPress={cancelAction} disabled={editSaving} style={styles.editBtnGhost} accessibilityRole="button" accessibilityLabel="Cancelar edição">
                                  <Text style={styles.editBtnGhostLabel}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => confirmEdit(e)}
                                  disabled={editSaving}
                                  style={[styles.editBtnPrimary, editSaving && { opacity: 0.6 }]}
                                  accessibilityRole="button"
                                  accessibilityLabel="Salvar edição da baixa"
                                >
                                  {editSaving ? <ActivityIndicator size="small" color="#fdf8f2" /> : <Text style={styles.editBtnPrimaryLabel}>Salvar</Text>}
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}

                          {/* ── Remover (inline, com confirmação — dinheiro
                              nunca some com 1 toque) ── */}
                          {isDeleting && (
                            <View style={styles.deleteBox}>
                              <Text style={styles.deleteText}>
                                Remover a baixa de {fmtMoney(e.amount)} de {when.date}
                                {when.time ? ` às ${when.time}` : ""}? O saldo desta anuidade volta a
                                ficar em aberto e a parcela pode reabrir. Esta ação não pode ser desfeita.
                              </Text>
                              <View style={styles.deleteFoot}>
                                <TouchableOpacity onPress={cancelAction} disabled={deleteBusy} style={styles.editBtnGhost} accessibilityRole="button" accessibilityLabel="Cancelar remoção">
                                  <Text style={styles.editBtnGhostLabel}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => confirmDelete(e)}
                                  disabled={deleteBusy}
                                  style={[styles.deleteBtnDanger, deleteBusy && { opacity: 0.6 }]}
                                  accessibilityRole="button"
                                  accessibilityLabel="Confirmar remoção da baixa"
                                >
                                  {deleteBusy ? <ActivityIndicator size="small" color="#fdf8f2" /> : <Text style={styles.deleteBtnDangerLabel}>Remover</Text>}
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.5)", justifyContent: "flex-end" } as ViewStyle,
  sheet: {
    backgroundColor: P.paperWarm, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    maxHeight: "85%" as any, borderWidth: 1, borderColor: C.line2, borderBottomWidth: 0,
    ...Platform.select({ web: { maxWidth: 480, alignSelf: "center", width: "100%" } as any, default: {} }),
  } as ViewStyle,
  shead: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.line,
  } as ViewStyle,
  eyebrow: { fontFamily: F.mono, fontSize: 10.5, letterSpacing: 1.4, color: P.red, fontWeight: "600" } as TextStyle,
  stitle: { fontFamily: F.heading, fontSize: 18, color: C.ink, marginTop: 4 } as TextStyle,

  sbody: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 26 } as ViewStyle,
  totalLine: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, marginBottom: 12 } as TextStyle,

  entryRow: { flexDirection: "row", gap: 10, backgroundColor: P.glass, borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 12 } as ViewStyle,
  entryDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: P.ok, marginTop: 5 } as ViewStyle,
  entryKind: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: C.ink } as TextStyle,
  entryAmount: { fontFamily: F.mono, fontSize: 13, fontWeight: "700", color: P.ok } as TextStyle,
  entryMeta: { fontFamily: F.mono, fontSize: 11, color: C.ink3, marginTop: 3 } as TextStyle,

  entryActions: { flexDirection: "row", gap: 14, marginTop: 8 } as ViewStyle,
  entryActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 } as ViewStyle,
  entryActionLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: C.ink3 } as TextStyle,

  // ── Editar inline ──
  editBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line2, gap: 4 } as ViewStyle,
  editLabel: { fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.8, color: C.ink3, marginTop: 6 } as TextStyle,
  editAmtWrap: { position: "relative", justifyContent: "center", marginTop: 2 } as ViewStyle,
  editAmtCur: { position: "absolute", left: 11, fontFamily: F.heading, fontSize: 14, color: C.ink3, zIndex: 1 } as TextStyle,
  editAmtInput: {
    fontFamily: F.mono, fontSize: 15, fontWeight: "500", paddingVertical: 8, paddingLeft: 32, paddingRight: 10,
    borderWidth: 1, borderColor: C.line2, borderRadius: R.sm, backgroundColor: P.paper2, color: C.ink,
  } as TextStyle,
  editDateInput: {
    fontFamily: F.mono, fontSize: 13, paddingVertical: 8, paddingHorizontal: 10, marginTop: 2,
    borderWidth: 1, borderColor: C.line2, borderRadius: R.sm, backgroundColor: P.paper2, color: C.ink,
  } as TextStyle,
  editMethodsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 } as ViewStyle,
  editMchip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.sm, borderWidth: 1, borderColor: C.line2, backgroundColor: P.paper2 } as ViewStyle,
  editMchipOn: { backgroundColor: C.ink, borderColor: C.ink } as ViewStyle,
  editMchipLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: C.ink2 } as TextStyle,
  editMchipLabelOn: { color: P.paperWarm } as TextStyle,
  editWarnBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: P.dangerWash, borderWidth: 1, borderColor: "rgba(161,61,51,0.32)", borderRadius: R.sm, padding: 8, marginTop: 8 } as ViewStyle,
  editWarnText: { flex: 1, fontFamily: F.body, fontSize: 11, color: P.danger, lineHeight: 15 } as TextStyle,
  editFoot: { flexDirection: "row", gap: 8, marginTop: 10 } as ViewStyle,
  editBtnGhost: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.sm, borderWidth: 1, borderColor: C.line2 } as ViewStyle,
  editBtnGhostLabel: { fontFamily: F.body, fontSize: 11.5, fontWeight: "700", color: C.ink2 } as TextStyle,
  editBtnPrimary: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: R.sm, backgroundColor: P.red, alignItems: "center", justifyContent: "center", minWidth: 76 } as ViewStyle,
  editBtnPrimaryLabel: { fontFamily: F.body, fontSize: 11.5, fontWeight: "700", color: "#fdf8f2" } as TextStyle,

  // ── Remover inline (confirmação obrigatória) ──
  deleteBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line2, gap: 8 } as ViewStyle,
  deleteText: { fontFamily: F.body, fontSize: 12, color: C.ink2, lineHeight: 17 } as TextStyle,
  deleteFoot: { flexDirection: "row", gap: 8, justifyContent: "flex-end" } as ViewStyle,
  deleteBtnDanger: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: R.sm, backgroundColor: P.danger, alignItems: "center", justifyContent: "center", minWidth: 84 } as ViewStyle,
  deleteBtnDangerLabel: { fontFamily: F.body, fontSize: 11.5, fontWeight: "700", color: "#fdf8f2" } as TextStyle,

  errorBox: { paddingVertical: 24, alignItems: "center", gap: 10 } as ViewStyle,
  errorText: { fontFamily: F.body, fontSize: 12.5, color: C.ink2, textAlign: "center" } as TextStyle,
  retryLabel: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700", color: P.red } as TextStyle,
  emptyText: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, textAlign: "center" } as TextStyle,
});
