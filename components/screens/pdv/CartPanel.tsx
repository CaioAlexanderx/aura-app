// ============================================================
// AURA. -- PDV/Caixa · Cart panel (header + body + foot)
// Violet glass hero with big total, items list with qty controls,
// payment chips, summary rows, and Limpar/Orçamento/Finalizar CTAs.
// 24/04 · theme-aware bg + inks (cards legíveis em modo claro e escuro).
// ============================================================
import { forwardRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, ActivityIndicator, TextInput } from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WEB, webOnly, accentForProduct, productLetter, fmtCurrency, fmtInt } from "./types";

export type CartDisplayItem = {
  productId: string;
  productBaseId: string; // without variant suffix, used to pick accent color
  name: string;
  price: number;
  qty: number;
};

export type PayChip = { key: string; label: string; icon: string };

type Props = {
  orderNumber?: string | null;
  items: CartDisplayItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  itemCount: number;
  payMethods: PayChip[];
  activePay: string;
  onPay: (k: string) => void;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onSetQty?: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onFinalize: () => void;
  onGenerateQuote?: () => void;
  showOrcamento?: boolean;
  discountLabel?: string | null;
  isProcessing?: boolean;
  requiredHints?: string[];
  emptyCta?: string;
  headerSubtitle?: string | null;
};

// Texts over the violet gradient header stay white in both themes — the
// gradient is dense enough to carry white type in light mode too.
const HEAD_INK = "#ffffff";
const HEAD_INK_SOFT = "rgba(255,255,255,0.9)";
const HEAD_INK_DIM = "rgba(255,255,255,0.65)";
const HEAD_INK_DIMMER = "rgba(255,255,255,0.55)";

export const CartPanel = forwardRef<any, Props>(function CartPanel(props, headRef) {
  const {
    orderNumber,
    items,
    subtotal,
    discountAmount,
    total,
    itemCount,
    payMethods,
    activePay,
    onPay,
    onInc,
    onDec,
    onSetQty,
    onRemove,
    onClear,
    onFinalize,
    onGenerateQuote,
    showOrcamento,
    discountLabel,
    isProcessing,
    requiredHints,
    emptyCta,
    headerSubtitle,
  } = props;

  return (
    <View
      style={[
        s.cart,
        Platform.OS === "web"
          ? ({
              background: Glass.cardMid,
              backdropFilter: "blur(20px) saturate(150%)",
              WebkitBackdropFilter: "blur(20px) saturate(150%)",
              borderLeft: "1px solid " + Glass.lineBorderCard,
            } as any)
          : { backgroundColor: Colors.bg2, borderLeftWidth: 1, borderLeftColor: Colors.border },
      ]}
    >
      {/* HEAD */}
      <View
        ref={headRef as any}
        style={[
          s.head,
          Platform.OS === "web"
            ? ({
                background: Glass.cartHeadGrad,
                borderBottom: "1px solid " + Glass.lineBorderCard,
              } as any)
            : { backgroundColor: Colors.violet, borderBottomWidth: 1, borderBottomColor: Colors.border },
        ]}
      >
        {IS_WEB && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: "-40%",
              right: "-30%",
              width: "80%",
              height: "200%",
              background:
                "radial-gradient(ellipse, rgba(167,139,250,0.45), transparent 60%)",
              animation: "caixaHeroShift 12s ease-in-out infinite",
              pointerEvents: "none",
            } as any}
          />
        )}
        <View style={s.headRow}>
          <Text style={s.headLabel}>Total da venda</Text>
          {orderNumber ? <Text style={s.headOrd}>{orderNumber}</Text> : null}
        </View>
        <View style={s.totalRow}>
          <Text style={s.cur}>R$ </Text>
          <Text style={s.totalInt}>{fmtInt(Math.floor(total))}</Text>
          <Text style={s.cents}>
            ,{String(Math.round((total - Math.floor(total)) * 100)).padStart(2, "0")}
          </Text>
        </View>
        <View style={s.meta}>
          <View>
            <Text style={s.metaK}>Itens</Text>
            <Text style={s.metaV}>{itemCount}</Text>
          </View>
          <View>
            <Text style={s.metaK}>Desconto</Text>
            <Text style={[s.metaV, { color: discountAmount > 0 ? "#b9f6ca" : HEAD_INK }]}>
              {discountAmount > 0 ? "− " + fmtCurrency(discountAmount) : "R$ 0,00"}
            </Text>
          </View>
          <View>
            <Text style={s.metaK}>Pagamento</Text>
            <Text style={[s.metaV, { color: "#e9d5ff", textTransform: "uppercase" }]}>{activePay}</Text>
          </View>
        </View>
        {headerSubtitle ? <Text style={s.subtitle}>{headerSubtitle}</Text> : null}
      </View>

      {/* BODY */}
      <ScrollView style={s.body} contentContainerStyle={{ padding: 14, paddingHorizontal: 20 }}>
        {items.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIco}>
              <Icon name="cart" size={30} color={Colors.violet3} />
            </View>
            <Text style={s.emptyTxt}>Carrinho vazio</Text>
            <Text style={[s.emptyTxt, { marginTop: 4, fontWeight: "400", color: Colors.ink3 }]}>
              {emptyCta || "Clique em um produto para adicionar"}
            </Text>
          </View>
        ) : (
          items.map(it => (
            <CartItem
              key={it.productId}
              item={it}
              onInc={() => onInc(it.productId)}
              onDec={() => onDec(it.productId)}
              onRemove={() => onRemove(it.productId)}
              onQtySet={qty => onSetQty?.(it.productId, qty)}
            />
          ))
        )}
      </ScrollView>

      {/* FOOT */}
      <View
        style={[
          s.foot,
          Platform.OS === "web"
            ? ({ background: Glass.cardDeep, borderTop: "1px solid " + Glass.lineBorderCard } as any)
            : { backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border },
        ]}
      >
        {/* Payment chips */}
        <View style={s.payGrid}>
          {payMethods.map(m => {
            const isActive = activePay === m.key;
            const webChip = webOnly({
              background: isActive ? "rgba(124,58,237,0.22)" : Glass.lineFaint,
              border: isActive ? "1px solid rgba(124,58,237,0.5)" : "1px solid " + Glass.lineBorderCard,
              color: isActive ? (IS_DARK_MODE ? "#fff" : Colors.ink) : Colors.ink2,
              transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
              cursor: "pointer",
              boxShadow: isActive ? "0 4px 12px rgba(124,58,237,0.3)" : "none",
            });
            return (
              <Pressable
                key={m.key}
                onPress={() => onPay(m.key)}
                style={[
                  s.payChip,
                  isActive && s.payChipActive,
                  Platform.OS === "web" ? (webChip as any) : null,
                ] as any}
              >
                <Icon name={m.icon as any} size={16} color={isActive ? (IS_DARK_MODE ? "#fff" : Colors.violet) : Colors.ink2} />
                <Text style={[s.payLabel, isActive && { color: IS_DARK_MODE ? "#fff" : Colors.ink }]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Summary */}
        <View style={s.sumRow}>
          <Text style={s.sumK}>Subtotal</Text>
          <Text style={s.sumV}>{fmtCurrency(subtotal)}</Text>
        </View>
        <View style={s.sumRow}>
          <Text style={[s.sumK, discountAmount > 0 && { color: Colors.green }]}>
            Desconto{discountLabel ? " · " + discountLabel : ""}
          </Text>
          <Text style={[s.sumV, discountAmount > 0 && { color: Colors.green }]}>
            {discountAmount > 0 ? "− " + fmtCurrency(discountAmount) : "R$ 0,00"}
          </Text>
        </View>
        <View style={[s.sumRow, s.sumRowTotal]}>
          <Text style={{ fontSize: 13, color: Colors.ink2, fontWeight: "700" }}>Total</Text>
          <Text style={[s.sumV, { color: Colors.violet3, fontSize: 15 }]}>{fmtCurrency(total)}</Text>
        </View>

        {/* Required hints */}
        {requiredHints && requiredHints.length > 0 && (
          <View style={s.hintsBox}>
            <Icon name="alert" size={11} color={Colors.amber} />
            <Text style={s.hintsTxt}>{requiredHints.join(" · ")}</Text>
          </View>
        )}

        {/* CTA row */}
        <View style={s.ctaRow}>
          <Pressable onPress={onClear} style={[s.ctaSec]}>
            <Text style={s.ctaSecTxt}>Limpar</Text>
          </Pressable>
          {showOrcamento && onGenerateQuote && (
            <Pressable onPress={onGenerateQuote} disabled={!!isProcessing} style={[s.ctaAlt, isProcessing && { opacity: 0.5 }]}>
              <Icon name="file_text" size={15} color={Colors.violet3} />
              <Text style={s.ctaAltTxt}>Orçamento</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onFinalize}
            disabled={!!isProcessing || items.length === 0}
            style={[
              s.ctaPri,
              Platform.OS === "web"
                ? ({
                    background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                    boxShadow:
                      "0 8px 20px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
                    position: "relative",
                    overflow: "hidden",
                  } as any)
                : { backgroundColor: Colors.violet },
              (isProcessing || items.length === 0) && { opacity: 0.5 },
            ]}
          >
            {IS_WEB && (
              <span
                aria-hidden
                style={{
                  content: '"',
                  position: "absolute",
                  top: 0,
                  left: "-100%",
                  width: "100%",
                  height: "100%",
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                  animation: "caixaShine 3s ease-in-out infinite",
                  pointerEvents: "none",
                } as any}
              />
            )}
            {isProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Icon name="check" size={16} color="#fff" />
                <Text style={s.ctaPriTxt}>Finalizar venda</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
});

function CartItem({
  item,
  onInc,
  onDec,
  onRemove,
  onQtySet,
}: {
  item: CartDisplayItem;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  onQtySet: (qty: number) => void;
}) {
  const [inputVal, setInputVal] = useState<string | null>(null);
  const isEditing = inputVal !== null;

  function handleFocus() {
    setInputVal(String(item.qty));
  }

  function handleCommit() {
    if (inputVal !== null) {
      const n = parseInt(inputVal, 10);
      if (!isNaN(n) && n > 0 && n !== item.qty) {
        onQtySet(n);
      }
    }
    setInputVal(null);
  }

  const accent = accentForProduct(item.productBaseId);
  const letter = productLetter(item.name);
  const imgBg = webOnly({
    background:
      "radial-gradient(circle at 30% 30%, " +
      accent +
      "55, " +
      accent +
      "18)",
    border: "1px solid " + accent + "40",
  });

  return (
    <View style={s.item}>
      <View style={[s.itemImg, Platform.OS === "web" ? (imgBg as any) : { backgroundColor: accent + "22", borderWidth: 1, borderColor: accent + "44" }]}>
        <Text style={s.itemLetter}>{letter}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={s.itemName}>
          {item.name}
        </Text>
        <Text style={s.itemMeta}>
          {fmtCurrency(item.price)} × {item.qty}
        </Text>
      </View>
      <View style={s.qtyCtrl}>
        <Pressable onPress={onDec} style={s.qtyBtn}>
          <Text style={s.qtyBtnTxt}>−</Text>
        </Pressable>
        <TextInput
          style={[
            s.qtyVal,
            IS_WEB && (webOnly({ outline: "none", cursor: "text" }) as any),
          ]}
          value={isEditing ? inputVal! : String(item.qty)}
          onFocus={handleFocus}
          onChangeText={v => setInputVal(v.replace(/\D/g, ""))}
          onBlur={handleCommit}
          onSubmitEditing={handleCommit}
          keyboardType="number-pad"
          selectTextOnFocus
          maxLength={3}
        />
        <Pressable onPress={onInc} style={s.qtyBtn}>
          <Text style={s.qtyBtnTxt}>+</Text>
        </Pressable>
      </View>
      <Text style={s.itemPrice}>{fmtCurrency(item.price * item.qty)}</Text>
      <Pressable onPress={onRemove} style={s.itemX}>
        <Icon name="x" size={14} color={Colors.ink3} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  cart: {
    flex: 1,
    flexDirection: "column",
    overflow: "hidden",
  },
  head: {
    padding: 22,
    paddingHorizontal: 24,
    position: "relative",
    overflow: "hidden",
  },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: HEAD_INK_DIM,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  headOrd: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    color: "#e9d5ff",
    fontSize: 10,
    letterSpacing: 0.6,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 12,
    marginBottom: 8,
  },
  cur: {
    fontSize: 22,
    color: HEAD_INK,
    opacity: 0.75,
    marginRight: 6,
    lineHeight: 44,
    fontWeight: "400",
  },
  totalInt: {
    fontSize: 46,
    color: HEAD_INK,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 48,
  },
  cents: {
    fontSize: 22,
    color: HEAD_INK,
    opacity: 0.8,
    lineHeight: 44,
    fontWeight: "500",
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.22)",
  },
  metaK: {
    fontSize: 9,
    fontWeight: "700",
    color: HEAD_INK_DIMMER,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  metaV: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 12,
    color: HEAD_INK,
    fontWeight: "700",
    marginTop: 3,
  },
  subtitle: { fontSize: 10, color: HEAD_INK_DIMMER, marginTop: 10 },
  body: { flex: 1 },
  empty: { alignItems: "center", padding: 60, paddingHorizontal: 20 },
  emptyIco: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(124,58,237,0.1)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(124,58,237,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTxt: {
    color: Colors.ink2,
    fontSize: 12,
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontWeight: "700",
    textAlign: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Glass.lineFaint,
  },
  itemImg: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemLetter: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.25)" as any,
    textShadowRadius: Platform.OS === "web" ? 4 : 0 as any,
  },
  itemName: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  itemMeta: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 10,
    color: Colors.ink3,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  qtyCtrl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 2,
    backgroundColor: Glass.lineSoft,
    borderRadius: 8,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: Glass.lineFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnTxt: { color: Colors.ink, fontWeight: "700", fontSize: 14 },
  qtyVal: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 13,
    color: Colors.ink,
    fontWeight: "700",
    minWidth: 18,
    textAlign: "center",
  },
  itemPrice: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 13,
    color: Colors.violet3,
    fontWeight: "700",
    minWidth: 72,
    textAlign: "right",
  },
  itemX: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    color: Colors.ink3 as any,
  },
  foot: {
    padding: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  payGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  payChip: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  payChipActive: {
    backgroundColor: Colors.violetD,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  payLabel: {
    fontSize: 10,
    color: Colors.ink2,
    fontWeight: "600",
  },
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  sumRowTotal: {
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: Glass.lineSoft,
  },
  sumK: { fontSize: 12, color: Colors.ink2, fontWeight: "500" },
  sumV: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    color: Colors.ink,
    fontWeight: "700",
    fontSize: 12,
  },
  hintsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.amberD,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
  },
  hintsTxt: { fontSize: 10, color: Colors.amber, fontWeight: "600", flex: 1 },
  ctaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  ctaSec: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Glass.lineFaint,
    borderWidth: 1,
    borderColor: Glass.lineBorderCard,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaSecTxt: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  ctaAlt: {
    flex: 1.3,
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Glass.lineFaint,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
  },
  ctaAltTxt: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  ctaPri: {
    flex: 1.7,
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaPriTxt: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

export default CartPanel;
