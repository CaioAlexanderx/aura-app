// ============================================================
// AURA. -- PDV/Caixa · Cart panel (header + body + foot)
// Violet glass hero with big total, items list with qty controls,
// payment chips, summary rows, and Limpar/Orçamento/Finalizar CTAs.
//
// Mai/2026:
//   · Input "CPF na nota" com validação mod-11
//   · Modo "Dividir pagamento" com lista de N entradas (NFC-e payments[])
//   · CartItem ganha lixeira (confirm 2-cliques) + edição inline do preço
//   · Compactação 1440x900: sidebar 380px, item layout reduzido pra evitar
//     truncamento de preço e lixeira
//   · itemMeta mostra só o preço unitário (qty já é exibida no qtyCtrl)
// ============================================================
import { forwardRef, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, ActivityIndicator, TextInput } from "react-native";
import { Colors, Glass, IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WEB, webOnly, accentForProduct, productLetter, fmtCurrency, fmtInt } from "./types";
import { validateCpf, maskCpf, onlyDigits } from "@/lib/validators";

export type CartDisplayItem = {
  productId: string;
  productBaseId: string;
  name: string;
  price: number;
  qty: number;
};

export type PayChip = { key: string; label: string; icon: string };

// Mantido isolado de useCart pra evitar dep ciclica e permitir uso standalone.
export type SplitEntry = { method: string; value: number; change?: number };

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
  onPriceChange?: (id: string, price: number) => void;
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
  // CPF na nota (NFC-e). Opcional — se passado, mostra o input.
  cpfNaNota?: string;
  onCpfNaNotaChange?: (v: string) => void;

  // Multi-pagamento (opcional). Se onToggleSplit não passar, modo split fica oculto.
  splitMode?: boolean;
  splitPayments?: SplitEntry[];
  splitRemaining?: number;
  splitIsBalanced?: boolean;
  onToggleSplit?: () => void;
  onAddSplitPayment?: () => void;
  onUpdateSplitPayment?: (idx: number, patch: Partial<SplitEntry>) => void;
  onRemoveSplitPayment?: (idx: number) => void;
};

const HEAD_INK = "#ffffff";
const HEAD_INK_SOFT = "rgba(255,255,255,0.9)";
const HEAD_INK_DIM = "rgba(255,255,255,0.65)";
const HEAD_INK_DIMMER = "rgba(255,255,255,0.55)";

export const CartPanel = forwardRef<any, Props>(function CartPanel(props, headRef) {
  const {
    orderNumber, items, subtotal, discountAmount, total, itemCount,
    payMethods, activePay, onPay,
    onInc, onDec, onSetQty, onPriceChange, onRemove, onClear, onFinalize, onGenerateQuote,
    showOrcamento, discountLabel, isProcessing, requiredHints, emptyCta, headerSubtitle,
    cpfNaNota, onCpfNaNotaChange,
    splitMode, splitPayments, splitRemaining, splitIsBalanced,
    onToggleSplit, onAddSplitPayment, onUpdateSplitPayment, onRemoveSplitPayment,
  } = props;

  const showCpfInput = onCpfNaNotaChange !== undefined;
  const splitAvailable = onToggleSplit !== undefined; // fica off quando o pai não wireou
  const splitOn = !!splitMode && splitAvailable;

  // Estado de validação CPF: só avalia quando temos 11 dígitos.
  // Antes disso fica neutro (sem indicador, sem border colorido).
  const cpfState = useMemo<"empty" | "incomplete" | "valid" | "invalid">(() => {
    const d = onlyDigits(cpfNaNota || "");
    if (d.length === 0) return "empty";
    if (d.length < 11) return "incomplete";
    return validateCpf(d) ? "valid" : "invalid";
  }, [cpfNaNota]);

  const cpfBorderColor =
    cpfState === "valid" ? "rgba(34,197,94,0.55)" :
    cpfState === "invalid" ? "rgba(239,68,68,0.55)" :
    Glass.lineBorderCard;

  // Se split está ativo e desbalanceado, bloqueia finalizar.
  const finalizeDisabled = !!isProcessing || items.length === 0 || (splitOn && !splitIsBalanced);

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
            <Text style={[s.metaV, { color: "#e9d5ff", textTransform: "uppercase" }]}>
              {splitOn ? `${splitPayments?.length || 0}× SPLIT` : activePay}
            </Text>
          </View>
        </View>
        {headerSubtitle ? <Text style={s.subtitle}>{headerSubtitle}</Text> : null}
      </View>

      {/* BODY */}
      <ScrollView style={s.body} contentContainerStyle={{ padding: 14, paddingHorizontal: 16 }}>
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
              onPriceChange={onPriceChange ? (price => onPriceChange(it.productId, price)) : undefined}
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
        {/* Payment chips — só quando NÃO está em modo split */}
        {!splitOn && (
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
                  <Icon name={m.icon as any} size={15} color={isActive ? (IS_DARK_MODE ? "#fff" : Colors.violet) : Colors.ink2} />
                  <Text style={[s.payLabel, isActive && { color: IS_DARK_MODE ? "#fff" : Colors.ink }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Toggle "Dividir pagamento" — só aparece quando o pai wireou. */}
        {splitAvailable && (
          <Pressable onPress={onToggleSplit} style={s.splitToggle}>
            <Icon name={splitOn ? "x" : "wallet"} size={13} color={Colors.violet3} />
            <Text style={s.splitToggleTxt}>
              {splitOn ? "Cancelar divisão" : "Dividir pagamento"}
            </Text>
          </Pressable>
        )}

        {/* Lista de splits */}
        {splitOn && (
          <View style={s.splitPanel}>
            {(splitPayments || []).map((entry, idx) => (
              <SplitRow
                key={idx}
                entry={entry}
                methods={payMethods}
                onChangeMethod={(method) => onUpdateSplitPayment?.(idx, { method })}
                onChangeValue={(value) => onUpdateSplitPayment?.(idx, { value })}
                onRemove={() => onRemoveSplitPayment?.(idx)}
                canRemove={(splitPayments?.length || 0) > 1}
              />
            ))}
            <Pressable onPress={onAddSplitPayment} style={s.splitAdd}>
              <Icon name="plus" size={14} color={Colors.violet3} />
              <Text style={s.splitAddTxt}>Adicionar pagamento</Text>
            </Pressable>

            {/* Status balance */}
            <View style={[
              s.splitStatus,
              splitIsBalanced
                ? { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.35)" }
                : { backgroundColor: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.35)" },
            ]}>
              <Icon
                name={splitIsBalanced ? "check" : "alert"}
                size={12}
                color={splitIsBalanced ? "#22c55e" : Colors.amber}
              />
              <Text style={[s.splitStatusTxt, { color: splitIsBalanced ? "#22c55e" : Colors.amber }]}>
                {splitIsBalanced
                  ? "Pronto · soma fecha com o total"
                  : (splitRemaining || 0) > 0
                    ? `Faltam ${fmtCurrency(splitRemaining || 0)}`
                    : `Sobrando ${fmtCurrency(Math.abs(splitRemaining || 0))}`}
              </Text>
            </View>
          </View>
        )}

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

        {/* CPF na nota (NFC-e) — input opcional, aparece só quando wirado.
            Indicador visual de validação mod-11 ao lado direito quando 11 dígitos. */}
        {showCpfInput && (
          <>
            <View style={[s.cpfRow, { borderColor: cpfBorderColor }]}>
              <Icon name="file_text" size={14} color={Colors.ink3} />
              <Text style={s.cpfLabel}>CPF na nota</Text>
              <TextInput
                style={s.cpfInput}
                value={cpfNaNota || ""}
                onChangeText={(v) => onCpfNaNotaChange?.(maskCpf(v))}
                placeholder="(opcional)"
                placeholderTextColor={Colors.ink3}
                keyboardType="number-pad"
                maxLength={14}
              />
              {cpfState === "valid" && (
                <View style={[s.cpfBadge, { backgroundColor: "rgba(34,197,94,0.18)" }]}>
                  <Icon name="check" size={12} color="#22c55e" />
                </View>
              )}
              {cpfState === "invalid" && (
                <View style={[s.cpfBadge, { backgroundColor: "rgba(239,68,68,0.18)" }]}>
                  <Icon name="x" size={12} color="#ef4444" />
                </View>
              )}
            </View>
            {cpfState === "invalid" && (
              <Text style={s.cpfErr}>CPF inválido — confira os dígitos</Text>
            )}
          </>
        )}

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
            disabled={finalizeDisabled}
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
              finalizeDisabled && { opacity: 0.5 },
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

// ── Linha do split: chips de método + input valor + remover ─────
function SplitRow({
  entry, methods, onChangeMethod, onChangeValue, onRemove, canRemove,
}: {
  entry: SplitEntry;
  methods: PayChip[];
  onChangeMethod: (m: string) => void;
  onChangeValue: (v: number) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  // Edição de valor com buffer local (evita rerender em cada tecla quando user digita "12,50")
  const [buf, setBuf] = useState<string | null>(null);
  const isEditing = buf !== null;
  const display = isEditing ? buf! : entry.value.toFixed(2).replace(".", ",");

  function handleCommit() {
    if (buf !== null) {
      const cleaned = buf.replace(",", ".").replace(/[^\d.]/g, "");
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n >= 0) onChangeValue(n);
    }
    setBuf(null);
  }

  return (
    <View style={s.splitRow}>
      {/* Mini chips de método */}
      <View style={s.splitChips}>
        {methods.map(m => {
          const active = entry.method === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => onChangeMethod(m.key)}
              style={[s.splitChip, active && s.splitChipActive]}
            >
              <Icon name={m.icon as any} size={11} color={active ? Colors.violet : Colors.ink3} />
              <Text style={[s.splitChipTxt, active && { color: Colors.violet, fontWeight: "700" }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Valor */}
      <View style={s.splitValBox}>
        <Text style={s.splitValPrefix}>R$</Text>
        <TextInput
          style={s.splitValInput}
          value={display}
          onFocus={() => setBuf(entry.value.toFixed(2).replace(".", ","))}
          onChangeText={(v) => setBuf(v.replace(/[^\d,.]/g, ""))}
          onBlur={handleCommit}
          onSubmitEditing={handleCommit}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
      </View>

      {/* Remover */}
      {canRemove ? (
        <Pressable onPress={onRemove} style={s.splitRemove}>
          <Icon name="x" size={12} color={Colors.ink3} />
        </Pressable>
      ) : (
        <View style={s.splitRemove} />
      )}
    </View>
  );
}

function CartItem({
  item, onInc, onDec, onRemove, onQtySet, onPriceChange,
}: {
  item: CartDisplayItem;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  onQtySet: (qty: number) => void;
  onPriceChange?: (price: number) => void;
}) {
  // Buffer pra edição de qty
  const [inputVal, setInputVal] = useState<string | null>(null);
  const isEditing = inputVal !== null;

  // Buffer pra edição de preço
  const [priceBuf, setPriceBuf] = useState<string | null>(null);
  const isEditingPrice = priceBuf !== null;

  // Lixeira: 2 cliques (1o vira vermelho/alerta, 2o deleta dentro de 2s)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<any>(null);

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

  function handlePriceFocus() {
    if (!onPriceChange) return;
    setPriceBuf(item.price.toFixed(2).replace(".", ","));
  }

  function handlePriceCommit() {
    if (priceBuf !== null && onPriceChange) {
      const cleaned = priceBuf.replace(",", ".").replace(/[^\d.]/g, "");
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n >= 0 && n !== item.price) {
        onPriceChange(n);
      }
    }
    setPriceBuf(null);
  }

  function handleDeletePress() {
    if (confirmDelete) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmDelete(false);
      onRemove();
      return;
    }
    setConfirmDelete(true);
    confirmTimer.current = setTimeout(() => setConfirmDelete(false), 2000);
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
        {/* Preço unitário (sem `× qty` — qty já é exibida no qtyCtrl ao lado).
            Clica nele pra editar o preço inline. */}
        {isEditingPrice ? (
          <View style={s.priceEditRow}>
            <Text style={s.priceEditPrefix}>R$</Text>
            <TextInput
              style={s.priceEditInput}
              value={priceBuf!}
              onChangeText={(v) => setPriceBuf(v.replace(/[^\d,.]/g, ""))}
              onBlur={handlePriceCommit}
              onSubmitEditing={handlePriceCommit}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
            />
          </View>
        ) : onPriceChange ? (
          <Pressable onPress={handlePriceFocus} style={s.priceEditableTouch}>
            <Text style={s.itemMeta} numberOfLines={1}>
              {fmtCurrency(item.price)}
            </Text>
            <Icon name="edit" size={9} color={Colors.violet3} />
          </Pressable>
        ) : (
          <Text style={s.itemMeta} numberOfLines={1}>
            {fmtCurrency(item.price)}
          </Text>
        )}
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
      <Text style={s.itemPrice} numberOfLines={1}>{fmtCurrency(item.price * item.qty)}</Text>
      {/* Lixeira com confirm 2-cliques. 1o clique vira alerta vermelho, 2o (em 2s) deleta. */}
      <Pressable
        onPress={handleDeletePress}
        style={[s.itemTrash, confirmDelete && s.itemTrashConfirm]}
      >
        <Icon
          name={confirmDelete ? "alert" : "trash"}
          size={13}
          color={confirmDelete ? "#ef4444" : Colors.ink3}
        />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  cart: { flex: 1, flexDirection: "column", overflow: "hidden" },
  head: { padding: 18, paddingHorizontal: 20, position: "relative", overflow: "hidden" },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headLabel: { fontSize: 9, fontWeight: "700", color: HEAD_INK_DIM, letterSpacing: 1.5, textTransform: "uppercase" },
  headOrd: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", color: "#e9d5ff", fontSize: 10, letterSpacing: 0.6 },
  totalRow: { flexDirection: "row", alignItems: "baseline", marginTop: 10, marginBottom: 6 },
  cur: { fontSize: 20, color: HEAD_INK, opacity: 0.75, marginRight: 6, lineHeight: 40, fontWeight: "400" },
  totalInt: { fontSize: 40, color: HEAD_INK, fontWeight: "700", letterSpacing: -1, lineHeight: 42 },
  cents: { fontSize: 20, color: HEAD_INK, opacity: 0.8, lineHeight: 40, fontWeight: "500" },
  meta: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.22)" },
  metaK: { fontSize: 9, fontWeight: "700", color: HEAD_INK_DIMMER, letterSpacing: 1, textTransform: "uppercase" },
  metaV: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 12, color: HEAD_INK, fontWeight: "700", marginTop: 3 },
  subtitle: { fontSize: 10, color: HEAD_INK_DIMMER, marginTop: 10 },
  body: { flex: 1 },
  empty: { alignItems: "center", padding: 60, paddingHorizontal: 20 },
  emptyIco: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(124,58,237,0.1)", borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(124,58,237,0.25)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTxt: { color: Colors.ink2, fontSize: 12, fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", letterSpacing: 0.6, textTransform: "uppercase", fontWeight: "700", textAlign: "center" },
  // CartItem compactado pra caber em sidebar 380px sem cortar preço/lixeira.
  // itemMeta agora mostra só o preço unitário (qty já está no qtyCtrl ao lado).
  item: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Glass.lineFaint },
  itemImg: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  itemLetter: { fontSize: 12, color: "#ffffff", fontWeight: "700", textShadowColor: "rgba(0,0,0,0.25)" as any, textShadowRadius: Platform.OS === "web" ? 4 : 0 as any },
  itemName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  itemMeta: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 10, color: Colors.ink3, marginTop: 2, letterSpacing: 0.2 },
  // Edição inline do preço — flex row com flexShrink: 1 pra texto truncar
  // antes do ícone de edit desaparecer.
  priceEditableTouch: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2,
    flexShrink: 1,
  },
  priceEditRow: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2,
    alignSelf: "flex-start",
    backgroundColor: Colors.bg, borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.4)",
  },
  priceEditPrefix: { fontSize: 9.5, color: Colors.ink3, fontWeight: "600" },
  priceEditInput: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 11, color: Colors.ink, fontWeight: "700",
    minWidth: 50, paddingVertical: 0,
    textAlign: "right",
  },
  qtyCtrl: { flexDirection: "row", alignItems: "center", gap: 2, padding: 2, backgroundColor: Glass.lineSoft, borderRadius: 7, flexShrink: 0 },
  qtyBtn: { width: 22, height: 22, borderRadius: 5, backgroundColor: Glass.lineFaint, alignItems: "center", justifyContent: "center" },
  qtyBtnTxt: { color: Colors.ink, fontWeight: "700", fontSize: 13 },
  qtyVal: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 12, color: Colors.ink, fontWeight: "700", minWidth: 14, textAlign: "center", paddingHorizontal: 2 },
  itemPrice: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", fontSize: 12, color: Colors.violet3, fontWeight: "700", minWidth: 54, textAlign: "right", flexShrink: 0 },
  // Lixeira: estado normal e estado de confirm (2o clique deleta)
  itemTrash: {
    width: 22, height: 22, borderRadius: 5,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
    flexShrink: 0,
  },
  itemTrashConfirm: {
    backgroundColor: "rgba(239,68,68,0.14)",
    borderWidth: 1, borderColor: "rgba(239,68,68,0.45)",
  },
  foot: { padding: 12, paddingHorizontal: 16, paddingBottom: 16 },
  // 5 chips em uma linha (gap menor + paddingHorizontal menor pra crediário caber).
  payGrid: { flexDirection: "row", gap: 4, marginBottom: 10, flexWrap: "wrap" },
  payChip: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 9, minWidth: 56 },
  payChipActive: { backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  payLabel: { fontSize: 9.5, color: Colors.ink2, fontWeight: "600" },
  // Toggle "Dividir pagamento" — link sutil (não compete com chips)
  splitToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 6, marginBottom: 8,
    alignSelf: "center",
  },
  splitToggleTxt: { fontSize: 11, color: Colors.violet3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  // Painel de splits
  splitPanel: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: Glass.lineFaint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Glass.lineBorderCard,
    gap: 8,
  },
  splitRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  splitChips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  splitChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingVertical: 4, paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: Glass.lineSoft,
    borderWidth: 1, borderColor: "transparent",
  },
  splitChipActive: { backgroundColor: Colors.violetD, borderColor: "rgba(124,58,237,0.4)" },
  splitChipTxt: { fontSize: 9, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  splitValBox: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.bg, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 4,
    borderWidth: 1, borderColor: Glass.lineBorderCard,
    minWidth: 88,
  },
  splitValPrefix: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
  splitValInput: {
    flex: 1, textAlign: "right",
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 12, color: Colors.ink, fontWeight: "700",
    paddingVertical: 0,
  },
  splitRemove: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
  },
  splitAdd: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(124,58,237,0.4)",
  },
  splitAddTxt: { fontSize: 11, color: Colors.violet3, fontWeight: "700" },
  splitStatus: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 8, borderWidth: 1,
  },
  splitStatusTxt: { fontSize: 10, fontWeight: "700", flex: 1 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  sumRowTotal: { paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: Glass.lineSoft },
  sumK: { fontSize: 12, color: Colors.ink2, fontWeight: "500" },
  sumV: { fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace", color: Colors.ink, fontWeight: "700", fontSize: 12 },
  cpfRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: Glass.lineFaint, borderRadius: 8,
    marginTop: 10, borderWidth: 1,
  },
  cpfLabel: {
    fontSize: 11, color: Colors.ink3, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  cpfInput: {
    flex: 1, textAlign: "right",
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 12, color: Colors.ink, fontWeight: "600",
    paddingVertical: 0,
  },
  cpfBadge: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  cpfErr: {
    fontSize: 10, color: "#ef4444", fontWeight: "600",
    marginTop: 4, marginLeft: 4,
  },
  hintsBox: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: Colors.amberD, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: "rgba(251,191,36,0.25)" },
  hintsTxt: { fontSize: 10, color: Colors.amber, fontWeight: "600", flex: 1 },
  ctaRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  ctaSec: { flex: 1, height: 46, borderRadius: 12, backgroundColor: Glass.lineFaint, borderWidth: 1, borderColor: Glass.lineBorderCard, alignItems: "center", justifyContent: "center" },
  ctaSecTxt: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  ctaAlt: { flex: 1.3, height: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Glass.lineFaint, borderWidth: 1, borderColor: "rgba(124,58,237,0.3)" },
  ctaAltTxt: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  ctaPri: { flex: 1.7, height: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaPriTxt: { fontSize: 13, color: "#fff", fontWeight: "700", letterSpacing: 0.3 },
});

export default CartPanel;
