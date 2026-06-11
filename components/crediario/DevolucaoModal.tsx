// ============================================================
// AURA. — DevolucaoModal (DESIGN-38 B4)
// Wizard 3 passos: selecionar itens → revisar → confirmado.
// Props: { visible, onClose, companyId, sale, onDone? }
// Chama creditApi.refundSale e exibe breakdown do resultado.
// Segue o DNA visual de CriarLancamentoModal:
//   Modal/KeyboardAvoidingView/backdrop + sheet, header com ícone,
//   stepper, ScrollView, StyleSheet.create com objetos.
// ============================================================
import { useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { creditApi, type RefundResult } from "@/services/creditApi";
import { toast } from "@/components/Toast";

// ─── Tipos ────────────────────────────────────────────────────
export interface DevolucaoSaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface DevolucaoSale {
  id: string;
  items: DevolucaoSaleItem[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  companyId: string;
  sale: DevolucaoSale;
  onDone?: (result: RefundResult) => void;
}

type Step = "select" | "review" | "done";

// ─── Helpers ──────────────────────────────────────────────────
function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

// ─── Componente ───────────────────────────────────────────────
export function DevolucaoModal({ visible, onClose, companyId, sale, onDone }: Props) {
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("select");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [result, setResult] = useState<RefundResult | null>(null);

  // Mapa item.id → quantidade a devolver (string para TextInput)
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    (sale?.items || []).forEach((it) => { init[it.id] = "0"; });
    return init;
  });

  // Motivo (opcional)
  const [reason, setReason] = useState("");

  // ─── Reset ──────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStep("select");
    setLoading(false);
    setApiError(null);
    setResult(null);
    setReason("");
    const init: Record<string, string> = {};
    (sale?.items || []).forEach((it) => { init[it.id] = "0"; });
    setQuantities(init);
  }, [sale]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // ─── Derivados ──────────────────────────────────────────────
  const selectedItems = (sale?.items || []).filter((it) => {
    const q = parseInt(quantities[it.id] || "0", 10);
    return q > 0;
  });

  const estimatedTotal = selectedItems.reduce((acc, it) => {
    const q = parseInt(quantities[it.id] || "0", 10);
    return acc + it.unit_price * q;
  }, 0);

  // ─── Step 1 → Step 2: validação ────────────────────────────
  function handleGoReview() {
    if (selectedItems.length === 0) {
      toast.error("Selecione ao menos 1 item para devolver");
      return;
    }
    // Valida que nenhuma qtd excede o original
    for (const it of selectedItems) {
      const q = parseInt(quantities[it.id] || "0", 10);
      if (q > it.quantity) {
        toast.error(`"${it.product_name}": qtd máxima é ${it.quantity}`);
        return;
      }
    }
    setApiError(null);
    setStep("review");
  }

  // ─── Step 2 → Confirmar ─────────────────────────────────────
  async function handleConfirm() {
    setLoading(true);
    setApiError(null);
    try {
      const items = selectedItems.map((it) => ({
        sale_item_id: it.id,
        quantity: parseInt(quantities[it.id] || "0", 10),
      }));
      const res = await creditApi.refundSale(companyId, sale.id, {
        items,
        reason: reason.trim() || undefined,
      });
      setResult(res);
      setStep("done");
      // Invalida queries do crediário
      qc.invalidateQueries({ queryKey: ["credit-balances", companyId] });
      qc.invalidateQueries({ queryKey: ["credit-dashboard", companyId] });
      qc.invalidateQueries({ queryKey: ["credit-aging", companyId] });
      if (onDone) onDone(res);
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Erro ao processar devolução";
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ─── Quantidade helpers ──────────────────────────────────────
  function setQty(itemId: string, raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    setQuantities((prev) => ({ ...prev, [itemId]: digits }));
  }

  function incrementQty(item: DevolucaoSaleItem, delta: 1 | -1) {
    const cur = parseInt(quantities[item.id] || "0", 10);
    const next = Math.max(0, Math.min(item.quantity, cur + delta));
    setQuantities((prev) => ({ ...prev, [item.id]: String(next) }));
  }

  // ─── Stepper dots ────────────────────────────────────────────
  const stepIndex = step === "select" ? 0 : step === "review" ? 1 : 2;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={s.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.kvWrapper}
        >
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>

            {/* ── Header ── */}
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.headerIcon}>
                  <Icon name="repeat" size={16} color={Colors.violet3} />
                </View>
                <View>
                  <Text style={s.headerTitle}>Devolução de venda</Text>
                  <Text style={s.headerSub}>
                    {step === "select"
                      ? "Selecione os itens e quantidades"
                      : step === "review"
                      ? "Confira o resumo antes de confirmar"
                      : "Devolução registrada"}
                  </Text>
                </View>
              </View>
              <Pressable onPress={handleClose} style={s.closeBtn} hitSlop={8}>
                <Icon name="x" size={18} color={Colors.ink3} />
              </Pressable>
            </View>

            {/* ── Stepper ── */}
            <View style={s.stepsRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={s.stepSegment}>
                  {i > 0 && <View style={[s.stepLine, stepIndex >= i && s.stepLineActive]} />}
                  <View style={[s.stepDot, stepIndex >= i && s.stepDotActive]} />
                </View>
              ))}
            </View>

            {/* ── STEP 1: Selecionar itens ── */}
            {step === "select" && (
              <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
                <Text style={s.sectionLabel}>Itens da venda</Text>
                {(sale?.items || []).length === 0 && (
                  <Text style={s.emptyHint}>Esta venda não possui itens.</Text>
                )}
                {(sale?.items || []).map((item) => {
                  const q = parseInt(quantities[item.id] || "0", 10);
                  const isSelected = q > 0;
                  return (
                    <View
                      key={item.id}
                      style={[s.itemCard, isSelected && s.itemCardSelected]}
                    >
                      <View style={s.itemCardBody}>
                        <View style={s.itemCardLeft}>
                          <Text style={s.itemCardName} numberOfLines={2}>
                            {item.product_name}
                          </Text>
                          <Text style={s.itemCardMeta}>
                            {item.quantity}x disponível · {fmtBRL(item.unit_price)} / un
                          </Text>
                        </View>
                        {/* Spinner de quantidade */}
                        <View style={s.qtyRow}>
                          <Pressable
                            style={[s.qtyBtn, q === 0 && s.qtyBtnDisabled]}
                            onPress={() => incrementQty(item, -1)}
                            disabled={q === 0}
                            hitSlop={6}
                          >
                            <Icon name="minus" size={12} color={q === 0 ? Colors.ink3 : Colors.violet3} />
                          </Pressable>
                          <TextInput
                            style={s.qtyInput}
                            value={quantities[item.id] || "0"}
                            onChangeText={(v) => setQty(item.id, v)}
                            keyboardType="numeric"
                            selectTextOnFocus
                          />
                          <Pressable
                            style={[s.qtyBtn, q >= item.quantity && s.qtyBtnDisabled]}
                            onPress={() => incrementQty(item, 1)}
                            disabled={q >= item.quantity}
                            hitSlop={6}
                          >
                            <Icon name="plus" size={12} color={q >= item.quantity ? Colors.ink3 : Colors.violet3} />
                          </Pressable>
                        </View>
                      </View>
                      {isSelected && (
                        <View style={s.itemCardFooter}>
                          <Text style={s.itemCardFooterText}>
                            Subtotal: {fmtBRL(item.unit_price * q)}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Motivo opcional */}
                <Text style={[s.sectionLabel, { marginTop: 18 }]}>
                  Motivo{" "}
                  <Text style={s.labelOptional}>(opcional)</Text>
                </Text>
                <TextInput
                  style={[s.input, { minHeight: 56, textAlignVertical: "top" }]}
                  placeholder="Ex.: produto com defeito, cliente arrependido..."
                  placeholderTextColor={Colors.ink3}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  maxLength={300}
                />

                {/* Estimativa */}
                {selectedItems.length > 0 && (
                  <View style={s.estimateBox}>
                    <View style={s.estimateRow}>
                      <Text style={s.estimateLabel}>Itens selecionados</Text>
                      <Text style={s.estimateValue}>{selectedItems.length}</Text>
                    </View>
                    <View style={s.estimateRow}>
                      <Text style={s.estimateLabel}>Estimativa de devolução</Text>
                      <Text style={[s.estimateValue, { color: Colors.violet3 }]}>
                        {fmtBRL(estimatedTotal)}
                      </Text>
                    </View>
                    <Text style={s.estimateHint}>
                      Valor final pode variar com base no abatimento de parcelas calculado pelo servidor.
                    </Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    s.primaryBtn,
                    pressed && { opacity: 0.85 },
                    selectedItems.length === 0 && s.primaryBtnDisabled,
                  ]}
                  onPress={handleGoReview}
                  disabled={selectedItems.length === 0}
                >
                  <Text style={s.primaryBtnText}>Revisar devolução</Text>
                  <Icon name="arrow-right" size={15} color="#fff" />
                </Pressable>
              </ScrollView>
            )}

            {/* ── STEP 2: Revisar ── */}
            {step === "review" && (
              <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
                <Pressable style={s.backLink} onPress={() => setStep("select")}>
                  <Icon name="arrow-left" size={14} color={Colors.violet3} />
                  <Text style={s.backLinkText}>Voltar e editar</Text>
                </Pressable>

                <Text style={s.sectionLabel}>Itens a devolver</Text>
                {selectedItems.map((item) => {
                  const q = parseInt(quantities[item.id] || "0", 10);
                  return (
                    <View key={item.id} style={s.reviewItemRow}>
                      <View style={s.reviewItemIcon}>
                        <Icon name="package" size={12} color={Colors.ink3} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.reviewItemName} numberOfLines={1}>
                          {item.product_name}
                        </Text>
                        <Text style={s.reviewItemMeta}>
                          {q}x · {fmtBRL(item.unit_price)} / un
                        </Text>
                      </View>
                      <Text style={s.reviewItemTotal}>{fmtBRL(item.unit_price * q)}</Text>
                    </View>
                  );
                })}

                <View style={s.totalBox}>
                  <Text style={s.totalBoxLabel}>Total da devolução</Text>
                  <Text style={s.totalBoxValue}>{fmtBRL(estimatedTotal)}</Text>
                  <Text style={s.totalBoxHint}>
                    O servidor calculará o abatimento exato de parcelas ao confirmar.
                  </Text>
                </View>

                {reason.trim() ? (
                  <View style={s.reasonBox}>
                    <Text style={s.reasonLabel}>Motivo</Text>
                    <Text style={s.reasonText}>{reason.trim()}</Text>
                  </View>
                ) : null}

                {apiError && (
                  <View style={s.errorBox}>
                    <Icon name="alert" size={14} color={Colors.red} />
                    <Text style={s.errorText}>{apiError}</Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    s.primaryBtn,
                    { backgroundColor: Colors.red },
                    pressed && { opacity: 0.85 },
                    loading && { opacity: 0.6 },
                  ]}
                  onPress={handleConfirm}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="check" size={15} color="#fff" />
                      <Text style={s.primaryBtnText}>Confirmar devolução</Text>
                    </>
                  )}
                </Pressable>

                <Text style={s.warningNote}>
                  Esta ação é irreversível. As parcelas serão abatidas/canceladas e o estoque será restaurado.
                </Text>
              </ScrollView>
            )}

            {/* ── STEP 3: Resultado ── */}
            {step === "done" && result && (
              <ScrollView style={s.body} keyboardShouldPersistTaps="handled">
                {/* Badge de sucesso */}
                <View style={s.successBadge}>
                  <Icon name="check" size={22} color={Colors.green} />
                  <Text style={s.successTitle}>Devolução registrada</Text>
                </View>

                {/* Card principal: valor devolvido + saldo */}
                <View style={s.resultCard}>
                  <View style={s.resultRow}>
                    <Text style={s.resultLabel}>Valor devolvido</Text>
                    <Text style={[s.resultValue, { color: Colors.green }]}>
                      {fmtBRL(result.refund_value)}
                    </Text>
                  </View>
                  {result.credit_generated > 0 && (
                    <View style={s.resultRow}>
                      <Text style={s.resultLabel}>Crédito gerado</Text>
                      <Text style={[s.resultValue, { color: Colors.violet3 }]}>
                        {fmtBRL(result.credit_generated)}
                      </Text>
                    </View>
                  )}
                  <View style={[s.resultRow, s.resultRowBorder]}>
                    <Text style={[s.resultLabel, { fontWeight: "700" }]}>Novo saldo devedor</Text>
                    <Text style={[s.resultValue, { fontWeight: "800", color: Colors.ink }]}>
                      {fmtBRL(result.new_balance)}
                    </Text>
                  </View>
                </View>

                {/* Parcelas abatidas */}
                {result.abated_installments.length > 0 && (
                  <>
                    <Text style={s.sectionLabel}>Parcelas afetadas</Text>
                    {result.abated_installments.map((inst) => (
                      <View key={inst.installment_id} style={s.instRow}>
                        <View style={[
                          s.instActionPill,
                          inst.action === "cancelled" ? s.instPillCancelled : s.instPillReduced,
                        ]}>
                          <Text style={[
                            s.instActionText,
                            inst.action === "cancelled" ? s.instPillCancelledText : s.instPillReducedText,
                          ]}>
                            {inst.action === "cancelled" ? "Cancelada" : "Reduzida"}
                          </Text>
                        </View>
                        <Text style={s.instLabel}>Parcela {inst.number}</Text>
                        <View style={{ flex: 1 }} />
                        {inst.action === "cancelled" ? (
                          <Text style={s.instAmount}>
                            abate {fmtBRL(inst.amount)}
                          </Text>
                        ) : (
                          <Text style={s.instAmount}>
                            {inst.new_amount_due != null
                              ? `saldo: ${fmtBRL(inst.new_amount_due)}`
                              : `abate ${fmtBRL(inst.amount)}`}
                          </Text>
                        )}
                      </View>
                    ))}
                  </>
                )}

                {/* Estoque restaurado */}
                {result.stock_restored.length > 0 && (
                  <View style={s.stockBox}>
                    <Icon name="package" size={13} color={Colors.green} />
                    <Text style={s.stockText}>
                      {result.stock_restored.length} produto(s) de volta ao estoque.
                    </Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85 }]}
                  onPress={handleClose}
                >
                  <Icon name="check" size={15} color="#fff" />
                  <Text style={s.primaryBtnText}>Fechar</Text>
                </Pressable>
              </ScrollView>
            )}

          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Estilos ──────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  kvWrapper: {
    width: "100%",
    maxWidth: 480,
  },
  sheet: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    overflow: "hidden",
    maxHeight: "90%" as any,
    borderWidth: 1,
    borderColor: Colors.border2,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
  },
  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border2,
    backgroundColor: Colors.bg3,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.violetD,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.bg2,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Stepper ──
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  stepSegment: { flexDirection: "row", alignItems: "center" },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border2,
  },
  stepDotActive: { backgroundColor: Colors.violet3 },
  stepLine: { width: 40, height: 2, backgroundColor: Colors.border2, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.violet3 },
  // ── Body ──
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.ink3,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 8,
  },
  labelOptional: { fontWeight: "400", textTransform: "none", fontSize: 11, color: Colors.ink3 },
  emptyHint: { fontSize: 13, color: Colors.ink3, textAlign: "center", paddingVertical: 16 },
  // ── Item card ──
  itemCard: {
    backgroundColor: Colors.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
    marginBottom: 8,
    overflow: "hidden",
  },
  itemCardSelected: {
    borderColor: Colors.violet2,
    backgroundColor: Colors.violetD,
  },
  itemCardBody: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  itemCardLeft: { flex: 1 },
  itemCardName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  itemCardMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  itemCardFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(124,58,237,0.06)",
  },
  itemCardFooterText: { fontSize: 11.5, color: Colors.violet3, fontWeight: "700" },
  // ── Qty spinner ──
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyInput: {
    width: 40,
    height: 32,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: Colors.ink,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 8,
  },
  // ── Input genérico ──
  input: {
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.ink,
    backgroundColor: Colors.bg2,
  },
  // ── Estimativa ──
  estimateBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: Colors.bg3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border2,
    gap: 8,
  },
  estimateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  estimateLabel: { fontSize: 13, color: Colors.ink2 },
  estimateValue: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  estimateHint: { fontSize: 10.5, color: Colors.ink3, lineHeight: 14 },
  // ── Review ──
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    marginBottom: 4,
  },
  backLinkText: { fontSize: 13, color: Colors.violet3 },
  reviewItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border2,
  },
  reviewItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: Colors.bg2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  reviewItemName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  reviewItemMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  reviewItemTotal: { fontSize: 13, fontWeight: "700", color: Colors.green },
  totalBox: {
    marginTop: 14,
    padding: 16,
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: "center",
    gap: 4,
  },
  totalBoxLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.ink3,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  totalBoxValue: { fontSize: 28, fontWeight: "800", color: Colors.green, marginTop: 4 },
  totalBoxHint: { fontSize: 10.5, color: Colors.ink3, textAlign: "center", lineHeight: 14 },
  reasonBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.bg2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  reasonLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.ink3,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  reasonText: { fontSize: 12, color: Colors.ink, lineHeight: 17 },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    backgroundColor: Colors.redD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.red + "33",
    marginTop: 12,
  },
  errorText: { flex: 1, fontSize: 12, color: Colors.red, lineHeight: 16 },
  warningNote: {
    fontSize: 10.5,
    color: Colors.ink3,
    textAlign: "center",
    lineHeight: 14,
    marginTop: 12,
  },
  // ── Resultado ──
  successBadge: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
  },
  successTitle: { fontSize: 17, fontWeight: "700", color: Colors.green },
  resultCard: {
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border2,
    paddingTop: 10,
    marginTop: 2,
  },
  resultLabel: { fontSize: 13, color: Colors.ink2 },
  resultValue: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  instRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border2,
  },
  instActionPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  instPillCancelled: {
    backgroundColor: Colors.redD,
    borderColor: Colors.red + "55",
  },
  instPillCancelledText: { fontSize: 9, fontWeight: "700", color: Colors.red, textTransform: "uppercase" },
  instPillReduced: {
    backgroundColor: Colors.violetD,
    borderColor: Colors.border2,
  },
  instPillReducedText: { fontSize: 9, fontWeight: "700", color: Colors.violet3, textTransform: "uppercase" },
  instActionText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  instLabel: { fontSize: 12, color: Colors.ink2, fontWeight: "600" },
  instAmount: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  stockBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    padding: 10,
    backgroundColor: Colors.greenD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.green + "33",
    marginBottom: 4,
  },
  stockText: { fontSize: 12, color: Colors.green, fontWeight: "600" },
  // ── Botões ──
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 8,
    backgroundColor: Colors.violet3,
    borderRadius: 12,
    paddingVertical: 15,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
