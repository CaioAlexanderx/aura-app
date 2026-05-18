// ============================================================
// AURA. — PDV · Troca v2 · Step 4 (Confirmar)
// Reorganização em 2 colunas (desktop) / 2 seções (mobile):
//   COLUNA ESQUERDA: resumo (devolvido, novos, líquido)
//   COLUNA DIREITA:  pagar (netAmount > 0) ou estornar (< 0) com split
//
// Antes da grid, do TOPO pra baixo:
//   1. FiscalBadge — comunica estratégia ANTES da confirmação
//   2. AddressForm — embutido quando devolucao_55/per_origin
//
// 17/05/2026 (FASE A — UI Redesign)
// ============================================================
import { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Colors, IS_DARK_MODE } from "@/constants/colors";
import type {
  SelectedSaleRow, ReturnEntry, NewEntry,
  PaymentSplit, RefundSplit, CustomerAddress, FiscalStrategy,
} from "./types";
import { fmtBRL } from "./types";
import { FiscalBadge } from "./FiscalBadge";
import { AddressForm } from "./AddressForm";
import { PaymentSplitForm, RefundSplitForm } from "./SplitForm";

const IS_WEB = Platform.OS === "web";

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

// ─── Heurística de estratégia fiscal ──────────────────────────
// Baseado em SelectedSaleRow.created_at:
//   - sale.age < 24h → recente (cancel_reissue elegível)
//   - sale.age >= 24h → antigo (devolucao_55 elegível)
// Resultado:
//   - todas recentes → cancel_reissue
//   - todas antigas → devolucao_55
//   - misto → per_origin (com counts)
//   - returnEntries.length === 0 → none
export function inferFiscalStrategy(
  selectedSales: SelectedSaleRow[],
  returnEntries: ReturnEntry[]
): { strategy: FiscalStrategy; cancelReissueCount: number; devolucao55Count: number } {
  if (returnEntries.length === 0) {
    return { strategy: "none", cancelReissueCount: 0, devolucao55Count: 0 };
  }
  // Considera apenas vendas que têm pelo menos 1 item sendo devolvido
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

export function Step4Confirm({
  selectedSales, returnEntries, newEntries,
  returnedValue, newValue, netAmount,
  paymentSplits, refundSplits, customerAddress,
  onChangePaymentSplits, onChangeRefundSplits, onChangeAddress,
}: Props) {
  const fiscal = useMemo(
    () => inferFiscalStrategy(selectedSales, returnEntries),
    [selectedSales, returnEntries]
  );
  const needsAddress =
    fiscal.strategy === "devolucao_55" || fiscal.strategy === "per_origin";

  // Customer banner (do primeiro selectedSale com customer)
  const customer = selectedSales.find((s) => s.customer_name)?.customer_name || "Cliente sem cadastro";
  const customerInitial = (customer || "C")[0].toUpperCase();

  return (
    <View>
      {/* Customer banner */}
      <View style={s.customerBanner}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{customerInitial}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.customerName} numberOfLines={1}>
            {customer}
            {selectedSales.length > 1 ? ` — Troca de ${selectedSales.length} compras` : ""}
          </Text>
          <Text style={s.customerSub}>
            Devolvendo {fmtBRL(returnedValue)} · Levando {fmtBRL(newValue)}
          </Text>
        </View>
      </View>

      {/* Fiscal badge — sempre, mesmo quando none */}
      <FiscalBadge
        strategy={fiscal.strategy}
        perOriginDetail={fiscal.strategy === "per_origin"
          ? { cancelReissueCount: fiscal.cancelReissueCount, devolucao55Count: fiscal.devolucao55Count }
          : undefined}
      />

      {/* Address form — só quando precisa */}
      {needsAddress && (
        <AddressForm value={customerAddress} onChange={onChangeAddress} />
      )}

      {/* Grid: resumo | splits */}
      <View style={s.grid}>
        {/* COLUNA ESQUERDA — resumo */}
        <View style={s.col}>
          {returnEntries.length > 0 && (
            <View style={s.box}>
              <Text style={s.boxLabel}>Devolvido (−)</Text>
              {returnEntries.map((e) => (
                <View key={`${e.saleId}-${e.item.product_id}-${(e.item as any).variant_id}`} style={s.boxRow}>
                  <Text style={s.boxItem} numberOfLines={1}>
                    {e.returnQty}× {(e.item as any).product_name || e.item.product_name_snapshot}
                  </Text>
                  <Text style={[s.boxVal, { color: Colors.red }]}>
                    −{fmtBRL(e.returnQty * Number(e.item.unit_price))}
                  </Text>
                </View>
              ))}
              <View style={[s.boxTotal, { borderTopColor: "rgba(239,68,68,0.2)" }]}>
                <Text style={s.boxTotalLabel}>Total devolvido</Text>
                <Text style={[s.boxTotalVal, { color: Colors.red }]}>−{fmtBRL(returnedValue)}</Text>
              </View>
            </View>
          )}

          {newEntries.length > 0 && (
            <View style={s.box}>
              <Text style={s.boxLabel}>Novos itens (+)</Text>
              {newEntries.map((e, i) => (
                <View key={`${e.product_id}-${i}`} style={s.boxRow}>
                  <Text style={s.boxItem} numberOfLines={1}>
                    {e.quantity}× {e.product_name_snapshot}
                  </Text>
                  <Text style={[s.boxVal, { color: "#34d399" }]}>
                    +{fmtBRL(e.quantity * e.unit_price)}
                  </Text>
                </View>
              ))}
              <View style={[s.boxTotal, { borderTopColor: "rgba(52,211,153,0.2)" }]}>
                <Text style={s.boxTotalLabel}>Total novos</Text>
                <Text style={[s.boxTotalVal, { color: "#34d399" }]}>+{fmtBRL(newValue)}</Text>
              </View>
            </View>
          )}

          {/* Net amount destaque */}
          <View style={s.netBox}>
            <Text style={s.netLabel}>
              {netAmount > 0
                ? "Cliente paga diferença"
                : netAmount < 0
                ? "Loja devolve ao cliente"
                : "Valor igual"}
            </Text>
            <Text
              style={[
                s.netVal,
                {
                  color:
                    netAmount > 0
                      ? "#34d399"
                      : netAmount < 0
                      ? Colors.red
                      : Colors.ink2,
                },
              ]}
            >
              {netAmount === 0
                ? fmtBRL(0)
                : (netAmount > 0 ? "+" : "") + fmtBRL(netAmount)}
            </Text>
          </View>
        </View>

        {/* COLUNA DIREITA — splits */}
        <View style={s.col}>
          {netAmount > 0 && (
            <PaymentSplitForm
              splits={paymentSplits}
              onChange={onChangePaymentSplits}
              target={netAmount}
            />
          )}
          {netAmount < 0 && (
            <RefundSplitForm
              splits={refundSplits}
              onChange={onChangeRefundSplits}
              target={Math.abs(netAmount)}
            />
          )}
          {netAmount === 0 && (
            <View style={s.zeroBox}>
              <Text style={s.zeroEmoji}>⚖️</Text>
              <Text style={s.zeroTitle}>Sem diferença a pagar ou estornar</Text>
              <Text style={s.zeroSub}>
                Itens devolvidos e novos têm o mesmo valor. Apenas confirme a troca.
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Helper exportado pra TrocaModal saber se botão Confirmar libera
export function canConfirmStep4(args: {
  netAmount: number;
  paymentSplits: PaymentSplit[];
  refundSplits: RefundSplit[];
  fiscalStrategy: FiscalStrategy;
  customerAddress: CustomerAddress;
}): { ok: boolean; reason?: string } {
  const { netAmount, paymentSplits, refundSplits, fiscalStrategy, customerAddress } = args;

  if (netAmount > 0) {
    const total = paymentSplits.reduce((s, p) => s + (p.amount || 0), 0);
    if (Math.abs(total - netAmount) > 0.005) {
      return { ok: false, reason: "A soma do pagamento não bate com a diferença" };
    }
  }
  if (netAmount < 0) {
    const total = refundSplits.reduce((s, p) => s + (p.amount || 0), 0);
    if (Math.abs(total - Math.abs(netAmount)) > 0.005) {
      return { ok: false, reason: "A soma do estorno não bate com o valor devido ao cliente" };
    }
  }
  if (fiscalStrategy === "devolucao_55" || fiscalStrategy === "per_origin") {
    const { validateAddress } = require("./AddressForm");
    const missing = validateAddress(customerAddress);
    if (missing.length) {
      return { ok: false, reason: "Preencha o endereço do cliente: " + missing.join(", ") };
    }
  }
  return { ok: true };
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  // Customer banner
  customerBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, marginBottom: 14,
    backgroundColor: IS_DARK_MODE ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)",
    borderWidth: 1, borderColor: IS_DARK_MODE ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
    borderRadius: 10,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: Colors.violet,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  avatarTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  customerName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  customerSub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },

  // Grid 2 cols
  grid: IS_WEB
    ? ({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 } as any)
    : { flexDirection: "column" as const, gap: 18 },
  col: { gap: 0 },

  // Summary boxes
  box: {
    padding: 12, marginBottom: 10,
    backgroundColor: IS_DARK_MODE ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)",
    borderWidth: 1, borderColor: IS_DARK_MODE ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
    borderRadius: 11,
  },
  boxLabel: {
    fontSize: 11, fontWeight: "600", textTransform: "uppercase",
    letterSpacing: 0.5, color: Colors.ink3, marginBottom: 6,
  },
  boxRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 3,
  },
  boxItem: { fontSize: 12, color: Colors.ink2, flex: 1, marginRight: 8 },
  boxVal: { fontSize: 12, fontWeight: "500" },
  boxTotal: {
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 1, paddingTop: 6, marginTop: 4,
  },
  boxTotalLabel: { fontSize: 12, fontWeight: "700", color: Colors.ink2 },
  boxTotalVal: { fontSize: 13, fontWeight: "700" },

  // Net box
  netBox: {
    padding: 16, marginBottom: 4,
    backgroundColor: "rgba(124,58,237,0.1)",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
    borderRadius: 13, alignItems: "center",
  },
  netLabel: {
    fontSize: 11, fontWeight: "600", textTransform: "uppercase",
    letterSpacing: 0.5, color: Colors.ink2, marginBottom: 4,
  },
  netVal: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },

  // Zero box (netAmount === 0)
  zeroBox: {
    padding: 20, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 11, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  zeroEmoji: { fontSize: 28, marginBottom: 8 },
  zeroTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 4 },
  zeroSub: { fontSize: 11, color: Colors.ink3, textAlign: "center", lineHeight: 16 },
});

export default Step4Confirm;
