// ============================================================
// AURA. — PDV · TrocaModal v2 (shell)
// Orquestra os 4 steps desacoplados em sub-arquivos:
//   Step1Search       — multi-seleção de vendas + 4 modos de busca
//   Step2Returns      — itens agrupados por venda + accordion
//   Step3NewItems     — catálogo + scanner barcode + QR
//   Step4Confirm      — fiscal badge + address + pay/refund split
//
// 17/05/2026 — handleSubmit ATIVA caminho v2 automaticamente quando:
//   - selectedSales.length > 1 (multi-venda), OU
//   - paymentSplits.length > 1 (multi-método pagamento), OU
//   - refundSplits.length > 1 OU contém crediario_credito/vale
// Caso contrário cai no caminho v1 (legado, 100% compat).
// Doc: Aura/AUDITORIA_TROCA_PDV_2026-05-17.docx
// ============================================================
import { useState, useEffect, useMemo } from "react";
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

// Types
import type {
  Step, SelectedSaleRow, ReturnEntry, NewEntry,
  PaymentSplit, RefundSplit, CustomerAddress,
} from "./troca/types";
import { STEP_LABELS, fmtBRL } from "./troca/types";
import { EMPTY_ADDRESS } from "./troca/AddressForm";

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
  const [step, setStep] = useState<Step>(1);

  const [selectedSales, setSelectedSales] = useState<SelectedSaleRow[]>([]);
  const [returnEntries, setReturnEntries] = useState<ReturnEntry[]>([]);
  const [newEntries, setNewEntries] = useState<NewEntry[]>([]);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [refundSplits, setRefundSplits] = useState<RefundSplit[]>([]);
  const [customerAddress, setCustomerAddress] = useState<CustomerAddress>(EMPTY_ADDRESS);
  const [submitting, setSubmitting] = useState(false);

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
    }
  }, [visible]);

  useEffect(() => {
    const ids = new Set(selectedSales.map((s) => s.id));
    setReturnEntries((prev) => prev.filter((e) => ids.has(e.saleId)));
  }, [selectedSales]);

  function canAdvance(): boolean {
    if (step === 1) return selectedSales.length > 0;
    if (step === 2) return returnEntries.length > 0 || newEntries.length > 0;
    if (step === 3) return returnEntries.length > 0 || newEntries.length > 0;
    return false;
  }
  function next() { setStep((s) => (Math.min(4, s + 1) as Step)); }
  function prev() { setStep((s) => (Math.max(1, s - 1) as Step)); }

  // ─── Detecção v1 vs v2 ──────────────────────────────────────
  // v2 requer: backend com migrations 115-117 + handler trocaV2 +
  // /sales-for-troca devolvendo original_sale_item_id real em items.
  function shouldUseV2(): { v2: boolean; reason: string } {
    if (selectedSales.length > 1) return { v2: true, reason: "multi-venda" };
    if (paymentSplits.length > 1) return { v2: true, reason: "payment_splits>1" };
    if (refundSplits.length > 1) return { v2: true, reason: "refund_splits>1" };
    if (refundSplits.some((r) => r.method === "crediario_credito" || r.method === "vale")) {
      return { v2: true, reason: "refund method v2-only" };
    }
    return { v2: false, reason: "" };
  }

  function hasRealSaleItemIds(): boolean {
    // ReturnEntry.item.id pode ser "synth-..." (fallback v1) ou UUID real (v2).
    // O Step1Search popula items vindos do backend /sales-for-troca; se backend
    // já estiver na versão v2, virão com original_sale_item_id real.
    return returnEntries.every((e) =>
      e.item.id && !String(e.item.id).startsWith("synth-")
    );
  }

  // ─── Submit ──────────────────────────────────────────────────
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
      toast.error(validation.reason || "Verifique os campos obrigatórios");
      return;
    }

    const { v2 } = shouldUseV2();

    // ─── Caminho v2 ────────────────────────────────────────────
    if (v2) {
      if (!hasRealSaleItemIds()) {
        toast.error(
          "Servidor precisa estar atualizado (migrations 115+) para trocas multi-venda. " +
          "Atualize o backend ou faça uma troca por venda original."
        );
        return;
      }
      setSubmitting(true);
      try {
        const bodyV2: any = {
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
          customer_address:
            fiscal.strategy === "devolucao_55" || fiscal.strategy === "per_origin"
              ? customerAddress
              : undefined,
          nfce_strategy: "per_origin",
        };
        const result = await trocaApi.createV2(companyId, bodyV2);
        toast.success(
          selectedSales.length > 1
            ? `Troca de ${selectedSales.length} vendas registrada!`
            : "Troca registrada com sucesso!"
        );
        onSuccess?.(result);
        onClose();
      } catch (e: any) {
        toast.error(e?.message || "Erro ao registrar troca v2");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ─── Caminho v1 (legado, single-venda + single-método) ─────
    const sale = selectedSales[0];
    const paymentMethod =
      netAmount > 0
        ? (paymentSplits[0]?.method || "dinheiro")
            .replace("cartao_credito", "cartao")
            .replace("cartao_debito", "debito")
        : (refundSplits[0]?.method || "dinheiro").replace("cartao_estorno", "cartao");

    setSubmitting(true);
    try {
      const body: any = {
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
        nfce_strategy:
          fiscal.strategy === "cancel_reissue" || fiscal.strategy === "devolucao_55"
            ? fiscal.strategy
            : "none",
        customer_address:
          fiscal.strategy === "devolucao_55" ? customerAddress : undefined,
      };
      const result = await trocaApi.create(companyId, body);
      toast.success("Troca registrada com sucesso!");
      onSuccess?.(result);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao registrar troca");
    } finally {
      setSubmitting(false);
    }
  }

  if (!visible) return null;

  const panelWeb = webOnly({
    background: IS_DARK_MODE ? "rgba(18,10,35,0.97)" : "rgba(255,255,255,0.97)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(124,58,237,0.3)",
    boxShadow: IS_DARK_MODE
      ? "0 24px 60px -10px rgba(0,0,0,0.7)"
      : "0 24px 60px -10px rgba(124,58,237,0.22)",
  });

  let footerInfo: string;
  if (step === 1) {
    footerInfo = selectedSales.length === 0
      ? "Nenhuma venda selecionada"
      : `${selectedSales.length} ${selectedSales.length === 1 ? "venda" : "vendas"} · ${fmtBRL(selectedSales.reduce((s, r) => s + r.total_amount, 0))}`;
  } else if (step === 2) {
    footerInfo = `Devolvendo ${fmtBRL(returnedValue)}`;
  } else if (step === 3) {
    footerInfo = `Líquido: ${netAmount >= 0 ? "+" : ""}${fmtBRL(netAmount)}`;
  } else {
    const fiscal = inferFiscalStrategy(selectedSales, returnEntries);
    footerInfo = fiscal.strategy === "devolucao_55"
      ? "Pronto · NF-e 55 de devolução"
      : fiscal.strategy === "per_origin"
      ? "Pronto · fiscal misto por venda"
      : "Pronto para confirmar";
  }

  return (
    <View style={s.overlay}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.panel, IS_WEB ? (panelWeb as any) : { backgroundColor: Colors.bg3 }]}>

        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={s.headerIco}>
              <Icon name="repeat" size={16} color="#a78bfa" />
            </View>
            <View>
              <Text style={s.headerTitle}>Troca ou Devolução</Text>
              <Text style={s.headerSub}>
                Combine vendas, devolva e venda no mesmo cupom
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Icon name="x" size={16} color={Colors.ink3} />
          </Pressable>
        </View>

        <View style={s.stepBar}>
          {([1, 2, 3, 4] as Step[]).map((n) => {
            const done = step > n;
            const active = step === n;
            return (
              <View key={n} style={s.stepItem}>
                <View style={[s.stepDot, done && s.stepDotDone, active && s.stepDotActive]}>
                  {done
                    ? <Icon name="check" size={9} color="#fff" />
                    : <Text style={[s.stepDotTxt, active && { color: "#fff" }]}>{n}</Text>}
                </View>
                <Text
                  style={[s.stepLabel, (active || done) && { color: active ? "#a78bfa" : Colors.ink3 }]}
                  numberOfLines={1}
                >
                  {STEP_LABELS[n]}
                </Text>
              </View>
            );
          })}
        </View>

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
        </ScrollView>

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
                <Text style={s.btnPriTxt}>Avançar →</Text>
              </Pressable>
            )}
            {step === 4 && (
              <Pressable
                style={[s.btnPri, submitting && { opacity: 0.6 }, { minWidth: 180 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.btnPriTxt}>✓ Confirmar troca</Text>}
              </Pressable>
            )}
          </View>
        </View>

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
    width: "100%", maxWidth: 920, maxHeight: "92%",
    borderRadius: 16, overflow: "hidden", flexDirection: "column",
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  headerIco: {
    width: 32, height: 32, borderRadius: 8,
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
    flexDirection: "row",
    paddingHorizontal: 22, paddingVertical: 14,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.1)",
    gap: 14,
  },
  stepItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  stepDot: {
    width: 22, height: 22, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepDotActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  stepDotDone: { backgroundColor: "rgba(52,211,153,0.2)", borderColor: "#34d399" },
  stepDotTxt: { color: Colors.ink3, fontSize: 11, fontWeight: "700" },
  stepLabel: { color: Colors.ink3, fontSize: 12, fontWeight: "500", flex: 1, minWidth: 0 },
  body: { flex: 1 },
  bodyContent: { padding: 22, paddingBottom: 8 },
  footer: {
    paddingHorizontal: 22, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.15)",
    backgroundColor: "rgba(0,0,0,0.18)",
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
  },
  footerInfo: { flex: 1, fontSize: 12, color: Colors.ink2 },
  footerActions: { flexDirection: "row", gap: 8, flexShrink: 0 },
  btnPri: {
    backgroundColor: Colors.violet,
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  btnPriTxt: { color: "#fff", fontSize: 13, fontWeight: "600" },
  btnSec: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
  },
  btnSecTxt: { color: Colors.ink, fontSize: 13, fontWeight: "500" },
});

export default TrocaModal;
