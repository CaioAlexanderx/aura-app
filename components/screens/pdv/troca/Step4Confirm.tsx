// ============================================================
// AURA. — PDV · Troca v3 · Step 4 — FINALIZAR
//
// 24/05/2026 — Reescrito do zero pra v3.
// Mockup: Aura/mockup_troca_v3.html (tela 4)
//
// FRICÇÃO ATACADA: Davi travou aqui — pedia preenchimento da NF-e.
//
// Princípios v3:
//   • NF-e 100% automática — card verde "✓ pronta", detalhes em toggle opcional
//   • Pay chips grandes pra escolher como o cliente paga (1 click)
//   • Banner cross-filial em linguagem de balconista
//   • Resumo financeiro no lado direito sempre visível
//   • Address form (devolução 55) só aparece se backend pedir explicitamente
// ============================================================
import { useState, useMemo } from "react";
import {
  View, Text, Pressable, StyleSheet, useWindowDimensions,
} from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type {
  SelectedSaleRow, ReturnEntry, NewEntry,
  PaymentSplit, RefundSplit, CustomerAddress, FiscalStrategy,
  PaymentMethod, RefundMethod,
} from "./types";
import { fmtBRL } from "./types";

type Props = {
  selectedSales: SelectedSaleRow[];
  returnEntries: ReturnEntry[];
  newEntries: NewEntry[];
  returnedValue: number;
  newValue: number;
  netAmount: number;
  paymentSplits: PaymentSplit[];
  refundSplits: RefundSplit[];
  customerAddress: CustomerAddress;
  onChangePaymentSplits: (next: PaymentSplit[]) => void;
  onChangeRefundSplits: (next: RefundSplit[]) => void;
  onChangeAddress: (next: CustomerAddress) => void;
};

// ─── Fiscal strategy inference (mantém contrato com shell) ─────
export function inferFiscalStrategy(
  selectedSales: SelectedSaleRow[],
  returnEntries: ReturnEntry[]
): { strategy: FiscalStrategy; cancelReissueCount: number; devolucao55Count: number } {
  if (returnEntries.length === 0) {
    return { strategy: "none", cancelReissueCount: 0, devolucao55Count: 0 };
  }
  const salesWithReturn = new Set(returnEntries.map((e) => e.saleId));
  const involved = selectedSales.filter((s) => salesWithReturn.has(s.id));
  if (involved.length === 0) {
    return { strategy: "none", cancelReissueCount: 0, devolucao55Count: 0 };
  }
  const now = Date.now();
  let recent = 0;
  let old = 0;
  for (const s of involved) {
    const ageHours = (now - new Date(s.created_at).getTime()) / 3600000;
    if (ageHours < 24) recent += 1; else old += 1;
  }
  if (recent > 0 && old === 0) {
    return { strategy: "cancel_reissue", cancelReissueCount: recent, devolucao55Count: 0 };
  }
  if (old > 0 && recent === 0) {
    return { strategy: "devolucao_55", cancelReissueCount: 0, devolucao55Count: old };
  }
  return { strategy: "per_origin", cancelReissueCount: recent, devolucao55Count: old };
}

// ─── Validação pra liberar Confirmar ────────────────────────────
export function canConfirmStep4(args: {
  netAmount: number;
  paymentSplits: PaymentSplit[];
  refundSplits: RefundSplit[];
  fiscalStrategy: FiscalStrategy;
  customerAddress: CustomerAddress;
}): { ok: boolean; reason?: string } {
  const { netAmount, paymentSplits, refundSplits } = args;
  if (netAmount > 0) {
    if (paymentSplits.length === 0) {
      return { ok: false, reason: "Escolha como o cliente vai pagar a diferença" };
    }
    const sum = paymentSplits.reduce((s, p) => s + (p.amount || 0), 0);
    if (Math.abs(sum - netAmount) > 0.01) {
      return { ok: false, reason: `Soma dos pagamentos (${fmtBRL(sum)}) não bate com a diferença (${fmtBRL(netAmount)})` };
    }
  }
  if (netAmount < 0) {
    if (refundSplits.length === 0) {
      return { ok: false, reason: "Escolha como devolver o valor ao cliente" };
    }
    const sum = refundSplits.reduce((s, r) => s + (r.amount || 0), 0);
    if (Math.abs(sum - Math.abs(netAmount)) > 0.01) {
      return { ok: false, reason: "Soma dos estornos não bate com o valor a devolver" };
    }
  }
  return { ok: true };
}

const PAY_METHODS: Array<{ id: PaymentMethod; label: string; icon: string }> = [
  { id: "dinheiro",        label: "Dinheiro",       icon: "dollar-sign" },
  { id: "pix",             label: "Pix",            icon: "zap" },
  { id: "cartao_debito",   label: "Cartão débito",  icon: "credit-card" },
  { id: "cartao_credito",  label: "Cartão crédito", icon: "credit-card" },
];

const REFUND_METHODS: Array<{ id: RefundMethod; label: string; icon: string }> = [
  { id: "dinheiro",           label: "Dinheiro",      icon: "dollar-sign" },
  { id: "pix",                label: "Pix",           icon: "zap" },
  { id: "cartao_estorno",     label: "Estorno cartão", icon: "credit-card" },
  { id: "crediario_credito",  label: "Crédito conta",  icon: "user" },
];

export function Step4Confirm({
  selectedSales, returnEntries, newEntries,
  returnedValue, newValue, netAmount,
  paymentSplits, refundSplits,
  onChangePaymentSplits, onChangeRefundSplits,
}: Props) {
  const { width } = useWindowDimensions();
  const isWide = width > 880;

  const fiscal = useMemo(
    () => inferFiscalStrategy(selectedSales, returnEntries),
    [selectedSales, returnEntries]
  );

  const isCrossFilial = useMemo(() => {
    return selectedSales.some((s) => s.is_cross_filial);
  }, [selectedSales]);

  const originFilialName = useMemo(() => {
    const f = selectedSales.find((s) => s.is_cross_filial);
    return f?.company_name || selectedSales[0]?.company_name || "—";
  }, [selectedSales]);

  const selectedPayMethod = paymentSplits[0]?.method || null;
  const selectedRefundMethod = refundSplits[0]?.method || null;

  function pickPay(method: PaymentMethod) {
    onChangePaymentSplits([{ method, amount: parseFloat(netAmount.toFixed(2)) }]);
  }
  function pickRefund(method: RefundMethod) {
    onChangeRefundSplits([{ method, amount: parseFloat(Math.abs(netAmount).toFixed(2)) }]);
  }

  const [showNfeDetails, setShowNfeDetails] = useState(false);

  return (
    <View style={isWide ? s.grid : undefined}>
      <View style={isWide ? { flex: 1, minWidth: 0 } : undefined}>
        {netAmount > 0 && (
          <View style={s.bigAmountCard}>
            <Text style={s.bigAmountLabel}>Cliente paga</Text>
            <Text style={[s.bigAmountValue, { color: "#10b981" }]}>{fmtBRL(netAmount)}</Text>
            <Text style={s.bigAmountSub}>
              Diferença entre carrinho ({fmtBRL(newValue)}) e crédito ({fmtBRL(returnedValue)})
            </Text>
          </View>
        )}
        {netAmount < 0 && (
          <View style={s.bigAmountCard}>
            <Text style={s.bigAmountLabel}>Loja devolve</Text>
            <Text style={[s.bigAmountValue, { color: "#60a5fa" }]}>{fmtBRL(-netAmount)}</Text>
            <Text style={s.bigAmountSub}>
              Crédito ({fmtBRL(returnedValue)}) maior que carrinho ({fmtBRL(newValue)})
            </Text>
          </View>
        )}
        {netAmount === 0 && (
          <View style={s.bigAmountCard}>
            <Text style={s.bigAmountLabel}>Troca par-a-par</Text>
            <Text style={[s.bigAmountValue, { color: Colors.ink }]}>{fmtBRL(0)}</Text>
            <Text style={s.bigAmountSub}>Sem diferença a receber ou devolver</Text>
          </View>
        )}

        {netAmount > 0 && (
          <View style={s.payBlock}>
            <Text style={s.payLabel}>Como o cliente vai pagar?</Text>
            <View style={s.chips}>
              {PAY_METHODS.map((m) => {
                const sel = selectedPayMethod === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => pickPay(m.id)}
                    style={[s.chip, sel && s.chipSel]}
                  >
                    <Icon name={m.icon as any} size={14} color={sel ? "#fff" : "#a78bfa"} />
                    <Text style={[s.chipTxt, sel && { color: "#fff" }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        {netAmount < 0 && (
          <View style={s.payBlock}>
            <Text style={s.payLabel}>Como devolver o valor ao cliente?</Text>
            <View style={s.chips}>
              {REFUND_METHODS.map((m) => {
                const sel = selectedRefundMethod === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => pickRefund(m.id)}
                    style={[s.chip, sel && s.chipSel]}
                  >
                    <Icon name={m.icon as any} size={14} color={sel ? "#fff" : "#a78bfa"} />
                    <Text style={[s.chipTxt, sel && { color: "#fff" }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {(fiscal.strategy === "cancel_reissue" || fiscal.strategy === "devolucao_55") && (
          <View style={s.nfeWrap}>
            <View style={s.nfeCard}>
              <View style={s.nfeCheck}>
                <Icon name="check" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.nfeTitle}>
                  {fiscal.strategy === "cancel_reissue"
                    ? "NFC-e original será cancelada"
                    : "NF-e de devolução pronta"}
                </Text>
                <Text style={s.nfeSub}>
                  {fiscal.strategy === "cancel_reissue"
                    ? "Venda foi feita há menos de 24h — cancelamos sem precisar emitir devolução"
                    : "CFOP 1.202 · Natureza: Devolução de venda · Série 1"}
                </Text>
              </View>
              <Pressable style={s.nfeToggle} onPress={() => setShowNfeDetails((v) => !v)}>
                <Text style={s.nfeToggleTxt}>{showNfeDetails ? "Ocultar" : "Detalhes"}</Text>
              </Pressable>
            </View>

            {showNfeDetails && (
              <View style={s.nfeDetails}>
                <DetailRow label="Estratégia" value={fiscal.strategy === "cancel_reissue" ? "Cancelamento da NFC-e" : "Emissão de NF-e 55 (devolução)"} />
                <DetailRow label="CFOP" value="1.202 — Devolução de venda" />
                <DetailRow label="Natureza" value="Devolução de venda" />
                <DetailRow label="CSOSN" value="102 (Simples Nacional)" />
                <DetailRow label="NF-e referenciada" value={selectedSales[0]?.id ? `…${String(selectedSales[0].id).slice(-12)}` : "—"} />
                <DetailRow label="Valor" value={fmtBRL(returnedValue)} />
                <Text style={s.nfeFootnote}>
                  💡 Estes valores vêm do padrão fiscal do seu regime tributário. Só mexa se o seu contador pediu.
                </Text>
              </View>
            )}
          </View>
        )}

        {isCrossFilial && (
          <View style={s.xfilial}>
            <Icon name="repeat" size={16} color="#60a5fa" />
            <View style={{ flex: 1 }}>
              <Text style={s.xfilialTitle}>Troca entre filiais</Text>
              <Text style={s.xfilialBody}>
                ↩ <Text style={s.xfilialBold}>{originFilialName}</Text> recebe os itens devolvidos no estoque{"\n"}
                ↪ Esta loja tira os {newEntries.length} {newEntries.length === 1 ? "item" : "itens"} do carrinho{"\n"}
                💸 A diferença entra/sai do caixa desta loja
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={isWide ? s.sideRail : { marginTop: 18 }}>
        <View style={s.summaryCard}>
          <Text style={s.summaryTitle}>Resumo da troca</Text>

          {returnEntries.length > 0 && (
            <>
              <Text style={s.summarySection}>DEVOLVIDO (vai pra {originFilialName})</Text>
              {returnEntries.map((e, i) => (
                <View key={i} style={s.summaryRow}>
                  <Text style={s.summaryRowLabel} numberOfLines={1}>
                    {e.returnQty}× {e.item.product_name_snapshot || (e.item as any).product_name}
                  </Text>
                  <Text style={s.summaryRowValue}>{fmtBRL(e.returnQty * Number(e.item.unit_price))}</Text>
                </View>
              ))}
            </>
          )}

          {newEntries.length > 0 && (
            <>
              <Text style={[s.summarySection, { marginTop: 12 }]}>LEVADO</Text>
              {newEntries.map((n, i) => (
                <View key={i} style={s.summaryRow}>
                  <Text style={s.summaryRowLabel} numberOfLines={1}>
                    {n.quantity}× {n.product_name_snapshot}
                  </Text>
                  <Text style={s.summaryRowValue}>{fmtBRL(n.quantity * n.unit_price)}</Text>
                </View>
              ))}
            </>
          )}

          <View style={s.summaryDivider} />

          <View style={s.summaryRow}>
            <Text style={s.summaryRowLabel}>Subtotal carrinho</Text>
            <Text style={s.summaryRowValue}>{fmtBRL(newValue)}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryRowLabel}>− Crédito devolução</Text>
            <Text style={[s.summaryRowValue, { color: "#60a5fa" }]}>− {fmtBRL(returnedValue)}</Text>
          </View>

          <View style={s.summaryDivider} />

          <View style={s.summaryTotal}>
            {netAmount > 0 && (
              <>
                <Text style={s.summaryTotalLabel}>Cliente paga</Text>
                <Text style={[s.summaryTotalValue, { color: "#10b981" }]}>{fmtBRL(netAmount)}</Text>
              </>
            )}
            {netAmount < 0 && (
              <>
                <Text style={s.summaryTotalLabel}>Loja devolve</Text>
                <Text style={[s.summaryTotalValue, { color: "#60a5fa" }]}>{fmtBRL(-netAmount)}</Text>
              </>
            )}
            {netAmount === 0 && (
              <>
                <Text style={s.summaryTotalLabel}>Sem diferença</Text>
                <Text style={[s.summaryTotalValue, { color: Colors.ink }]}>{fmtBRL(0)}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", gap: 18, alignItems: "flex-start" },
  sideRail: { width: 300, flexShrink: 0 },
  bigAmountCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.2)",
    borderRadius: 14, padding: 18,
  },
  bigAmountLabel: { color: Colors.ink3, fontSize: 11.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  bigAmountValue: { fontSize: 34, fontWeight: "800", letterSpacing: -0.6, marginTop: 4 },
  bigAmountSub: { color: Colors.ink3, fontSize: 12, marginTop: 4 },
  payBlock: { marginTop: 16 },
  payLabel: { color: Colors.ink, fontSize: 13.5, fontWeight: "700", marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
  },
  chipSel: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  chipTxt: { color: Colors.ink2, fontSize: 13, fontWeight: "600" },
  nfeWrap: { marginTop: 16 },
  nfeCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(16,185,129,0.10)",
    borderWidth: 1, borderColor: "rgba(16,185,129,0.3)",
    borderRadius: 12, padding: 14,
  },
  nfeCheck: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: "#10b981",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  nfeTitle: { color: "#6ee7b7", fontSize: 14, fontWeight: "700" },
  nfeSub: { color: "#86efac", fontSize: 12, marginTop: 2 },
  nfeToggle: {
    backgroundColor: "rgba(16,185,129,0.18)",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7,
  },
  nfeToggleTxt: { color: "#6ee7b7", fontSize: 11.5, fontWeight: "700" },
  nfeDetails: {
    marginTop: 8, padding: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    gap: 8,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailLabel: { color: Colors.ink3, fontSize: 11.5, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  detailValue: { color: Colors.ink, fontSize: 12.5, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  nfeFootnote: { color: Colors.ink3, fontSize: 11.5, fontStyle: "italic", marginTop: 6 },
  xfilial: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "rgba(37,99,235,0.10)",
    borderWidth: 1, borderColor: "rgba(96,165,250,0.3)",
    borderRadius: 12, padding: 14,
    marginTop: 16,
  },
  xfilialTitle: { color: "#bfdbfe", fontSize: 13.5, fontWeight: "700" },
  xfilialBody: { color: "#93c5fd", fontSize: 12.5, marginTop: 4, lineHeight: 19 },
  xfilialBold: { color: "#dbeafe", fontWeight: "700" },
  summaryCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14, padding: 16,
  },
  summaryTitle: { color: Colors.ink, fontSize: 13, fontWeight: "700", marginBottom: 12 },
  summarySection: {
    color: Colors.ink3, fontSize: 10.5, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 10 },
  summaryRowLabel: { color: Colors.ink2, fontSize: 12, flex: 1, minWidth: 0 },
  summaryRowValue: { color: Colors.ink, fontSize: 12, fontWeight: "600" },
  summaryDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 10 },
  summaryTotal: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 4,
  },
  summaryTotalLabel: { color: Colors.ink, fontSize: 13.5, fontWeight: "700" },
  summaryTotalValue: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
});

export default Step4Confirm;
