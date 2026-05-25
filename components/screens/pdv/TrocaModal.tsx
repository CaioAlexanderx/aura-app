// ============================================================
// AURA. — PDV · TrocaModal v3 (shell)
//
// 24/05/2026 — REDESIGN v3 (após Davi não conseguir trocar).
// Mockup: Aura/mockup_troca_v3.html
// Memory: projeto_troca_v3_redesign_24mai2026
//
// Mudanças v2 → v3:
//   • Stepper visível e linear (1→2→3→4 + tela 5 sucesso)
//   • Step5Success — feedback claro pós-confirmação (era só toast + close)
//   • Linguagem de balconista nos títulos e copies
//   • NF-e auto colapsada (operador não precisa preencher)
//   • Cross-filial é default explícito, com banner "o que vai mexer no estoque"
//   • Mantém contrato com backend v1 + v2 (sem migração necessária)
//
// 25/05/2026 (fix sem-NFC-e):
//   - V2 path: nfce_strategy='per_origin' só quando alguma venda tem
//     has_nfce=true. Senão 'none' — evita backend infer fiscal em
//     vendas que nunca emitiram NFC-e.
// ============================================================
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, Pressable, StyleSheet,
  ActivityIndicator, ScrollView,
} from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { trocaApi } from "@/services/trocaApi";
import { toast } from "@/components/Toast";
import { IS_WEB, webOnly } from "./types";

// Sub-componentes
import { Step1Search } from "./troca/Step1Search";
import { Step2Returns } from "./troca/Step2Returns";
import { Step3NewItems } from "./troca/Step3NewItems";
import { Step4Confirm, inferFiscalStrategy, canConfirmStep4 } from "./troca/Step4Confirm";
import { Step5Success } from "./troca/Step5Success";

// Types
import type {
  Step, SelectedSaleRow, ReturnEntry, NewEntry,
  PaymentSplit, RefundSplit, CustomerAddress,
} from "./troca/types";
import { fmtBRL } from "./troca/types";
import { EMPTY_ADDRESS } from "./troca/AddressForm";

type StepV3 = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS_V3: Record<Exclude<StepV3, 5>, string> = {
  1: "Venda",
  2: "Devolver",
  3: "Levar",
  4: "Finalizar",
};

type Props = {
  visible: boolean;
  companyId: string;
  products: any[];
  onClose: () => void;
  onSuccess?: (result: any) => void;
};

export function TrocaModal({
  visible, companyId, products, onClose, onSuccess,
}: Props) {
  const [step, setStep] = useState<StepV3>(1);
  const [submitting, setSubmitting] = useState(false);

  const [selectedSales, setSelectedSales] = useState<SelectedSaleRow[]>([]);
  const [returnEntries, setReturnEntries] = useState<ReturnEntry[]>([]);
  const [newEntries, setNewEntries] = useState<NewEntry[]>([]);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [refundSplits, setRefundSplits] = useState<RefundSplit[]>([]);
  const [customerAddress, setCustomerAddress] = useState<CustomerAddress>(EMPTY_ADDRESS);

  const [successResult, setSuccessResult] = useState<any | null>(null);

  const returnedValue = useMemo(
    () => returnEntries.reduce((s, e) => s + e.returnQty * Number(e.item.unit_price), 0),
    [returnEntries]
  );
  const newValue = useMemo(
    () => newEntries.reduce((s, e) => s + e.quantity * e.unit_price, 0),
    [newEntries]
  );
  const netAmount = useMemo(
    () => parseFloat((newValue - returnedValue).toFixed(2)),
    [newValue, returnedValue]
  );

  useEffect(() => {
    if (!visible) {
      setStep(1);
      setSelectedSales([]);
      setReturnEntries([]);
      setNewEntries([]);
      setPaymentSplits([]);
      setRefundSplits([]);
      setCustomerAddress(EMPTY_ADDRESS);
      setSuccessResult(null);
      setSubmitting(false);
    }
  }, [visible]);

  useEffect(() => {
    const ids = new Set(selectedSales.map((s) => s.id));
    setReturnEntries((prev) => prev.filter((e) => ids.has(e.saleId)));
  }, [selectedSales]);

  const canAdvance = useCallback((): boolean => {
    if (step === 1) return selectedSales.length > 0;
    if (step === 2) return returnEntries.length > 0;
    if (step === 3) return returnEntries.length > 0 || newEntries.length > 0;
    return false;
  }, [step, selectedSales.length, returnEntries.length, newEntries.length]);

  const next = useCallback(() => {
    setStep((s) => (Math.min(4, s + 1) as StepV3));
  }, []);
  const prev = useCallback(() => {
    setStep((s) => (Math.max(1, s - 1) as StepV3));
  }, []);

  function shouldUseV2(): boolean {
    if (selectedSales.length > 1) return true;
    if (paymentSplits.length > 1) return true;
    if (refundSplits.length > 1) return true;
    if (refundSplits.some((r) => r.method === "crediario_credito" || r.method === "vale")) return true;
    return false;
  }
  function hasRealSaleItemIds(): boolean {
    return returnEntries.every((e) =>
      e.item.id && !String(e.item.id).startsWith("synth-")
    );
  }

  async function handleSubmit() {
    if (returnEntries.length === 0 && newEntries.length === 0) {
      toast.error("Adicione ao menos um item devolvido ou novo");
      return;
    }

    const fiscal = inferFiscalStrategy(selectedSales, returnEntries);

    const validation = canConfirmStep4({
      netAmount, paymentSplits, refundSplits,
      fiscalStrategy: fiscal.strategy, customerAddress,
    });
    if (!validation.ok) {
      const blocking = validation.reason || "";
      const isAddressOnly = /endere|cep|rua|bairro|cidade/i.test(blocking);
      if (!isAddressOnly) {
        toast.error(blocking);
        return;
      }
    }

    // 25/05/2026 (fix sem-NFC-e): se nenhuma venda tem NFC-e, troca
    // segue sem fiscal. Evita backend rejeitar com 409.
    const anyHasNfce = selectedSales.some((s) => s.has_nfce === true);

    const v2 = shouldUseV2();
    setSubmitting(true);
    try {
      let result: any;
      if (v2) {
        if (!hasRealSaleItemIds()) {
          toast.error("Servidor desatualizado — faça uma troca por venda original.");
          setSubmitting(false);
          return;
        }
        result = await trocaApi.createV2(companyId, {
          original_sale_ids: selectedSales.map((s) => s.id),
          returned_items: returnEntries.map((e) => ({
            original_sale_id: e.saleId,
            original_sale_item_id: e.item.id,
            product_id: e.item.product_id,
            variant_id: (e.item as any).variant_id || null,
            quantity: e.returnQty,
            unit_price: Number(e.item.unit_price),
            product_name_snapshot: (e.item as any).product_name || e.item.product_name_snapshot,
          })),
          new_items: newEntries.map((n) => ({
            product_id: n.product_id,
            variant_id: n.variant_id || null,
            quantity: n.quantity,
            unit_price: n.unit_price,
            product_name_snapshot: n.product_name_snapshot,
          })),
          payment_splits: netAmount > 0 ? paymentSplits : undefined,
          refund_splits: netAmount < 0 ? refundSplits : undefined,
          customer_id: selectedSales[0]?.customer_id || undefined,
          customer_address: undefined,
          nfce_strategy: anyHasNfce ? "per_origin" : "none",
        } as any);
      } else {
        const sale = selectedSales[0];
        const paymentMethod = netAmount > 0
          ? (paymentSplits[0]?.method || "dinheiro")
              .replace("cartao_credito", "cartao")
              .replace("cartao_debito", "debito")
          : (refundSplits[0]?.method || "dinheiro").replace("cartao_estorno", "cartao");

        result = await trocaApi.create(companyId, {
          original_sale_id: sale.id,
          returned_items: returnEntries.map((e) => ({
            product_id: e.item.product_id,
            variant_id: (e.item as any).variant_id,
            quantity: e.returnQty,
            unit_price: Number(e.item.unit_price),
            product_name_snapshot: (e.item as any).product_name || e.item.product_name_snapshot,
          })),
          new_items: newEntries.map((n) => ({
            product_id: n.product_id,
            variant_id: n.variant_id,
            quantity: n.quantity,
            unit_price: n.unit_price,
            product_name_snapshot: n.product_name_snapshot,
          })),
          payment_method: netAmount !== 0 ? paymentMethod : undefined,
          customer_id: sale.customer_id || undefined,
          nfce_strategy: (fiscal.strategy === "cancel_reissue" || fiscal.strategy === "devolucao_55")
            ? fiscal.strategy
            : "none",
          customer_address: undefined,
        } as any);
      }

      setSuccessResult(result);
      setStep(5);
      onSuccess?.(result);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao registrar troca");
    } finally {
      setSubmitting(false);
    }
  }

  if (!visible) return null;

  const panelWeb = webOnly({
    background: IS_DARK_MODE ? "rgba(18,10,35,0.98)" : "rgba(255,255,255,0.98)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE
      ? "0 24px 60px -10px rgba(0,0,0,0.7)"
      : "0 24px 60px -10px rgba(124,58,237,0.22)",
  });

  let footerInfo = "";
  if (step === 1) {
    footerInfo = selectedSales.length === 0
      ? "Busque ou escolha uma venda recente"
      : `${selectedSales.length} ${selectedSales.length === 1 ? "venda" : "vendas"} · ${fmtBRL(selectedSales.reduce((s, r) => s + r.total_amount, 0))}`;
  } else if (step === 2) {
    footerInfo = returnEntries.length === 0
      ? "Marque os itens que o cliente devolveu"
      : `Devolvendo ${returnEntries.length} ${returnEntries.length === 1 ? "item" : "itens"} · ${fmtBRL(returnedValue)}`;
  } else if (step === 3) {
    if (netAmount > 0) footerInfo = `Cliente paga ${fmtBRL(netAmount)}`;
    else if (netAmount < 0) footerInfo = `Loja devolve ${fmtBRL(-netAmount)}`;
    else footerInfo = "Troca par-a-par (sem diferença)";
  } else if (step === 4) {
    footerInfo = "Confira e confirme";
  }

  return (
    <View style={s.overlay}>
      <Pressable style={s.backdrop} onPress={step === 5 ? undefined : onClose} />
      <View style={[s.panel, IS_WEB ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]}>

        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={s.headerIco}>
              <Icon name="repeat" size={16} color="#a78bfa" />
            </View>
            <View>
              <Text style={s.headerTitle}>
                {step === 5 ? "Troca concluída" : "Troca ou Devolução"}
              </Text>
              <Text style={s.headerSub}>
                {step === 1 && "Encontre a venda original — em qualquer filial do grupo"}
                {step === 2 && "Marque o que o cliente está devolvendo"}
                {step === 3 && "Defina o destino do crédito"}
                {step === 4 && "NF-e e estoque cuidados automaticamente"}
                {step === 5 && "NF-e emitida · Estoque atualizado · Caixa registrado"}
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        {step !== 5 && (
          <View style={s.stepBar}>
            {([1, 2, 3, 4] as const).map((n, idx) => {
              const done = step > n;
              const active = step === n;
              return (
                <View key={n} style={s.stepItem}>
                  <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                    {done
                      ? <Icon name="check" size={10} color="#fff" />
                      : <Text style={[s.stepDotTxt, active && { color: "#fff" }]}>{n}</Text>}
                  </View>
                  <Text
                    style={[
                      s.stepLabel,
                      (active || done) && { color: active ? "#a78bfa" : Colors.ink2, fontWeight: active ? "700" : "500" },
                    ]}
                    numberOfLines={1}
                  >
                    {STEP_LABELS_V3[n]}
                  </Text>
                  {idx < 3 && <View style={[s.stepSep, done && { backgroundColor: "rgba(124,58,237,0.4)" }]} />}
                </View>
              );
            })}
          </View>
        )}

        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && (
            <Step1Search
              companyId={companyId}
              selectedSales={selectedSales}
              onChangeSelected={setSelectedSales}
            />
          )}
          {step === 2 && (
            <Step2Returns
              selectedSales={selectedSales}
              returnEntries={returnEntries}
              onChangeEntries={setReturnEntries}
            />
          )}
          {step === 3 && (
            <Step3NewItems
              products={products}
              newEntries={newEntries}
              onChangeEntries={setNewEntries}
              returnedValue={returnedValue}
              newValue={newValue}
              netAmount={netAmount}
            />
          )}
          {step === 4 && (
            <Step4Confirm
              selectedSales={selectedSales}
              returnEntries={returnEntries}
              newEntries={newEntries}
              returnedValue={returnedValue}
              newValue={newValue}
              netAmount={netAmount}
              paymentSplits={paymentSplits}
              refundSplits={refundSplits}
              customerAddress={customerAddress}
              onChangePaymentSplits={setPaymentSplits}
              onChangeRefundSplits={setRefundSplits}
              onChangeAddress={setCustomerAddress}
            />
          )}
          {step === 5 && successResult && (
            <Step5Success
              companyId={companyId}
              result={successResult}
              selectedSales={selectedSales}
              returnedValue={returnedValue}
              newValue={newValue}
              netAmount={netAmount}
              onClose={onClose}
              onNew={() => {
                setStep(1);
                setSelectedSales([]);
                setReturnEntries([]);
                setNewEntries([]);
                setPaymentSplits([]);
                setRefundSplits([]);
                setCustomerAddress(EMPTY_ADDRESS);
                setSuccessResult(null);
              }}
            />
          )}
        </ScrollView>

        {step !== 5 && (
          <View style={s.footer}>
            <Text style={s.footerInfo} numberOfLines={1}>{footerInfo}</Text>
            <View style={s.footerActions}>
              {step > 1 && (
                <Pressable style={s.btnSec} onPress={prev}>
                  <Text style={s.btnSecTxt}>← Voltar</Text>
                </Pressable>
              )}
              {step < 4 && (
                <Pressable
                  style={[s.btnPri, !canAdvance() && { opacity: 0.45 }]}
                  onPress={next}
                  disabled={!canAdvance()}
                >
                  <Text style={s.btnPriTxt}>Continuar →</Text>
                </Pressable>
              )}
              {step === 4 && (
                <Pressable
                  style={[s.btnConfirm, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : (
                      <>
                        <Icon name="check" size={14} color="#fff" />
                        <Text style={s.btnPriTxt}>Confirmar troca</Text>
                      </>
                    )}
                </Pressable>
              )}
            </View>
          </View>
        )}

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 20,
  },
  backdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
  },
  panel: {
    width: "100%", maxWidth: 960, maxHeight: "94%",
    borderRadius: 18, overflow: "hidden", flexDirection: "column",
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerIco: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: "rgba(124,58,237,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.ink, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, color: Colors.ink3, marginTop: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  stepBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 22, paddingVertical: 14,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)",
    gap: 6,
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 24, height: 24, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet, shadowColor: Colors.violet, shadowOpacity: 0.4, shadowRadius: 8 },
  stepDotDone: { backgroundColor: "rgba(52,211,153,0.85)", borderColor: "#34d399" },
  stepDotTxt: { color: Colors.ink3, fontSize: 12, fontWeight: "700" },
  stepLabel: { color: Colors.ink3, fontSize: 12.5, fontWeight: "500" },
  stepSep: {
    width: 28, height: 1.5,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 4,
  },
  body: { flex: 1 },
  bodyContent: { padding: 22, paddingBottom: 8 },
  footer: {
    paddingHorizontal: 22, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
    backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
  },
  footerInfo: { flex: 1, fontSize: 12.5, color: Colors.ink2, fontWeight: "500" },
  footerActions: { flexDirection: "row", gap: 8, flexShrink: 0 },
  btnPri: {
    backgroundColor: Colors.violet,
    paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  btnConfirm: {
    backgroundColor: "#10b981",
    paddingVertical: 11, paddingHorizontal: 20, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    minWidth: 200,
  },
  btnPriTxt: { color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "500" },
});

export default TrocaModal;
