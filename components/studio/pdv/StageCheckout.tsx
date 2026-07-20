// ============================================================
// AURA STUDIO · PDV — checkout (Fase 6 + paridade Negócio 05/06/2026).
// Tela cheia: itens editáveis (qtd + lápis de preço) · cliente (opcional) ·
// pagamento (chips + split) · cupom · desconto manual · totais · concluir.
// Cliente nunca obrigatório. Sem modal de troco (decisão 05/06).
// Desconto por item exibido em porcentagem.
//
// 20/07/2026 — CPF/CNPJ na nota (opcional) p/ a NFC-e emitida no sucesso.
// ============================================================
import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Platform, TextInput } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { maskPhone } from "@/utils/masks";
import type { CartLine, PaymentEntry } from "./types";
import { PAY_METHODS } from "./types";
import { FInput, money } from "./ui";
import { Ic } from "./icons";
import { lineSalePrice, lineListPrice, lineDiscount, MAX_DISCOUNT_PCT } from "./checkoutMath";

const webPointer = () => (Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {});
const webNoOutline = () => (Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {});

// ── linha de item editável (qtd digitável + lápis de preço de venda) ──
function ItemRow({
  t, l, onSetQty, onSetPrice, onRemove,
}: {
  t: StudioPalette; l: CartLine;
  onSetQty: (lineId: string, qty: number) => void;
  onSetPrice: (lineId: string, price: number) => void;
  onRemove: (lineId: string) => void;
}) {
  const list = lineListPrice(l);
  const sale = lineSalePrice(l);
  const disc = lineDiscount(l);
  const pct = list > 0 && disc > 0 ? Math.round((1 - sale / list) * 100) : 0;
  const [editing, setEditing] = useState(false);
  const [priceText, setPriceText] = useState(sale.toFixed(2));
  const [qtyText, setQtyText] = useState(String(l.qty));

  useEffect(() => { setQtyText(String(l.qty)); }, [l.qty]);
  useEffect(() => { if (!editing) setPriceText(sale.toFixed(2)); }, [sale, editing]);

  function commitQty() {
    const n = parseInt((qtyText || "").replace(/[^0-9]/g, ""), 10);
    if (!n || n < 1) { setQtyText(String(l.qty)); return; }
    if (n !== l.qty) onSetQty(l.lineId, n);
  }
  function commitPrice() {
    const v = parseFloat((priceText || "").replace(",", "."));
    if (isNaN(v) || v < 0) { setPriceText(sale.toFixed(2)); setEditing(false); return; }
    onSetPrice(l.lineId, v);
    setEditing(false);
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.ink5 }}>
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: l.product.is_personalizable ? t.accentSoft : t.bgSoft, borderWidth: 1, borderColor: t.ink5, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: l.product.is_personalizable ? t.accentInk : t.ink3 }}>{(l.product.name || "?").charAt(0).toUpperCase()}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13, color: t.ink, fontWeight: "700" }} numberOfLines={1}>{l.product.name}</Text>
        <Text style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}>
          R$ {money(list)} un{l.product.is_personalizable ? " · personalizado" : ""}
        </Text>
        {editing && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Text style={{ fontSize: 11, color: t.ink3 }}>Preço de venda un.</Text>
            <Text style={{ fontSize: 12, color: t.ink3 }}>R$</Text>
            <TextInput
              value={priceText}
              onChangeText={setPriceText}
              onBlur={commitPrice}
              onSubmitEditing={commitPrice}
              keyboardType="decimal-pad"
              autoFocus
              style={{ width: 90, height: 32, borderWidth: 1, borderColor: t.primary, borderRadius: 8, textAlign: "right", paddingHorizontal: 8, fontSize: 13, fontWeight: "700", color: t.ink, backgroundColor: t.bgSoft, ...webNoOutline() }}
            />
            <Pressable onPress={commitPrice} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: t.primary, alignItems: "center", justifyContent: "center", ...webPointer() }}>
              <Ic name="check" size={15} color="#fff" />
            </Pressable>
          </View>
        )}
      </View>

      {/* stepper com campo digitável */}
      <View style={{ flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, borderColor: t.ink5, overflow: "hidden" }}>
        <Pressable onPress={() => onSetQty(l.lineId, Math.max(1, l.qty - 1))} style={{ paddingHorizontal: 9, paddingVertical: 7, backgroundColor: t.bgSoft, ...webPointer() }}>
          <Ic name="minus" size={13} color={t.ink2} />
        </Pressable>
        <TextInput
          value={qtyText}
          onChangeText={setQtyText}
          onBlur={commitQty}
          onSubmitEditing={commitQty}
          keyboardType="number-pad"
          style={{ width: 40, textAlign: "center", fontSize: 13, fontWeight: "800", color: t.ink, paddingVertical: 5, ...webNoOutline() }}
        />
        <Pressable onPress={() => onSetQty(l.lineId, l.qty + 1)} style={{ paddingHorizontal: 9, paddingVertical: 7, backgroundColor: t.bgSoft, ...webPointer() }}>
          <Ic name="plus" size={13} color={t.ink2} />
        </Pressable>
      </View>

      {/* preço + lápis + desconto (em %) */}
      <View style={{ minWidth: 104, alignItems: "flex-end" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          {sale < list && (
            <Text style={{ fontSize: 11, color: t.ink4, textDecorationLine: "line-through" }}>R$ {money(list * l.qty)}</Text>
          )}
          <Text style={{ fontSize: 13.5, color: t.ink, fontWeight: "800" }}>R$ {money(sale * l.qty)}</Text>
          <Pressable onPress={() => setEditing((e) => !e)} style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 1, borderColor: editing ? t.accent : t.ink5, backgroundColor: editing ? t.accentSoft : t.bgSoft, alignItems: "center", justifyContent: "center", ...webPointer() }}>
            <Ic name="edit" size={13} color={editing ? t.accentInk : t.ink3} />
          </Pressable>
        </View>
        {disc > 0 && (
          <Text style={{ fontSize: 10.5, color: t.accentInk, fontWeight: "700", marginTop: 3 }}>desconto −{pct}% · −R$ {money(disc)}</Text>
        )}
      </View>

      <Pressable onPress={() => onRemove(l.lineId)} style={{ padding: 5, ...webPointer() }}>
        <Ic name="trash" size={16} color={t.danger} />
      </Pressable>
    </View>
  );
}

// ── linha do split (forma + valor) ──
function SplitRow({
  t, entry, idx, onMethod, onValue, onRemove, canRemove,
}: {
  t: StudioPalette; entry: PaymentEntry; idx: number;
  onMethod: (idx: number, method: string) => void;
  onValue: (idx: number, value: number) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
}) {
  const [txt, setTxt] = useState((Number(entry.value) || 0).toFixed(2));
  useEffect(() => { setTxt((Number(entry.value) || 0).toFixed(2)); }, [entry.value]);
  function commit() {
    const v = parseFloat((txt || "").replace(",", "."));
    onValue(idx, isNaN(v) ? 0 : v);
  }
  return (
    <View style={{ marginBottom: 10, gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {PAY_METHODS.map((m) => {
          const active = entry.method === m.id;
          return (
            <Pressable key={m.id} onPress={() => onMethod(idx, m.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9, backgroundColor: active ? t.primarySoft : t.bgSoft, borderWidth: 1, borderColor: active ? t.primary : t.ink5, ...webPointer() }}>
              <Ic name={m.icon} size={14} color={active ? t.primary : t.ink3} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: active ? t.primary : t.ink2 }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, height: 40, borderRadius: 9, borderWidth: 1, borderColor: t.ink5, backgroundColor: t.bgSoft, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 12, color: t.ink3 }}>R$</Text>
          <TextInput value={txt} onChangeText={setTxt} onBlur={commit} onSubmitEditing={commit} keyboardType="decimal-pad"
            style={{ flex: 1, textAlign: "right", fontSize: 13.5, fontWeight: "700", color: t.ink, ...webNoOutline() }} />
        </View>
        <Pressable onPress={() => canRemove && onRemove(idx)} disabled={!canRemove}
          style={{ width: 40, height: 40, borderRadius: 9, borderWidth: 1, borderColor: t.ink5, alignItems: "center", justifyContent: "center", opacity: canRemove ? 1 : 0.3, ...webPointer() }}>
          <Ic name="trash" size={15} color={t.danger} />
        </Pressable>
      </View>
    </View>
  );
}

export function StageCheckout({
  t, cart, subtotal, count, customCount,
  customer, setCustomer, phone, setPhone, cpf, setCpf, pay, setPay, notes, setNotes,
  sending, error, onBack, onFinalize,
  onSetQty, onSetPrice, onRemoveLine,
  discountType, setDiscountType, discountValue, setDiscountValue, manualDiscount,
  couponInput, setCouponInput, couponApplied, couponValidating, onApplyCoupon, onClearCoupon,
  splitMode, splitPayments, onToggleSplit, onAddSplit, onUpdateSplit, onRemoveSplit, splitRemaining, splitBalanced,
  couponDiscount, total,
}: {
  t: StudioPalette; cart: CartLine[]; subtotal: number; count: number; customCount: number;
  customer: string; setCustomer: (s: string) => void; phone: string; setPhone: (s: string) => void;
  cpf: string; setCpf: (s: string) => void;
  pay: string; setPay: (s: string) => void; notes: string; setNotes: (s: string) => void;
  sending: boolean; error: string | null; onBack: () => void; onFinalize: () => void;
  onSetQty: (lineId: string, qty: number) => void; onSetPrice: (lineId: string, price: number) => void; onRemoveLine: (lineId: string) => void;
  discountType: "%" | "R$"; setDiscountType: (x: "%" | "R$") => void; discountValue: string; setDiscountValue: (s: string) => void; manualDiscount: number;
  couponInput: string; setCouponInput: (s: string) => void; couponApplied: { code: string; discount: number } | null; couponValidating: boolean; onApplyCoupon: () => void; onClearCoupon: () => void;
  splitMode: boolean; splitPayments: PaymentEntry[]; onToggleSplit: () => void; onAddSplit: () => void; onUpdateSplit: (idx: number, patch: Partial<PaymentEntry>) => void; onRemoveSplit: (idx: number) => void; splitRemaining: number; splitBalanced: boolean;
  couponDiscount: number; total: number;
}) {
  const hasCustom = customCount > 0;
  const discountTotal = Math.round((manualDiscount + couponDiscount) * 100) / 100;
  const discRaw = parseFloat((discountValue || "").replace(",", ".")) || 0;
  const overMax = discountType === "%" && discRaw > MAX_DISCOUNT_PCT;
  const blockFinalize = sending || cart.length === 0 || (splitMode && !splitBalanced);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, maxWidth: 920, alignSelf: "center", width: "100%" }}>
        <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14, ...webPointer() }}>
          <Ic name="arrow_left" size={17} color={t.ink2} />
          <Text style={{ fontSize: 13, color: t.ink2, fontWeight: "700" }}>Voltar ao caixa</Text>
        </Pressable>
        <Text style={{ fontSize: 26, color: t.ink, fontWeight: "800" }}>Fechar venda</Text>
        <Text style={{ fontSize: 13, color: t.ink3, marginTop: 2, marginBottom: 16 }}>
          {count} {count === 1 ? "item" : "itens"} · {hasCustom ? `${customCount} personalizado${customCount > 1 ? "s" : ""}` : "sem personalização"}
        </Text>

        {/* Itens */}
        <View style={panel(t)}>
          <Text style={panelTitle(t)}>Itens da venda</Text>
          {cart.map((l) => (
            <ItemRow key={l.lineId} t={t} l={l} onSetQty={onSetQty} onSetPrice={onSetPrice} onRemove={onRemoveLine} />
          ))}
        </View>

        {/* Cliente (opcional) */}
        <View style={panel(t)}>
          <Text style={panelTitle(t)}>Cliente</Text>
          <Text style={{ fontSize: 12, color: t.ink3, marginBottom: 10 }}>{hasCustom ? "Vincule para acompanhar a arte por WhatsApp (opcional)" : "Opcional para esta venda"}</Text>
          <View style={{ gap: 10 }}>
            <FInput t={t} value={customer} onChangeText={setCustomer} placeholder="Nome do cliente" />
            <FInput t={t} value={phone} onChangeText={(v) => setPhone(maskPhone(v))} placeholder="WhatsApp (00) 00000-0000" keyboardType="phone-pad" />
            <FInput t={t} value={cpf} onChangeText={setCpf} placeholder="CPF/CNPJ na nota (opcional)" keyboardType="number-pad" />
          </View>
        </View>

        {/* Pagamento */}
        <View style={panel(t)}>
          <Text style={panelTitle(t)}>Pagamento</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {PAY_METHODS.map((m) => {
              const active = !splitMode && pay === m.id;
              return (
                <Pressable key={m.id} onPress={() => { if (!splitMode) setPay(m.id); }} disabled={splitMode}
                  style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: active ? t.primarySoft : t.bgSoft, borderWidth: 1, borderColor: active ? t.primary : t.ink5, opacity: splitMode ? 0.5 : 1, ...webPointer() }}>
                  <Ic name={m.icon} size={18} color={active ? t.primary : t.ink3} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: active ? t.primary : t.ink2 }}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* toggle dividir pagamento */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: t.ink5 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.ink2 }}>Dividir pagamento</Text>
            <Pressable onPress={onToggleSplit} style={{ width: 46, height: 26, borderRadius: 999, backgroundColor: splitMode ? t.primary : t.ink5, padding: 3, ...webPointer() }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", marginLeft: splitMode ? 20 : 0 }} />
            </Pressable>
          </View>

          {splitMode && (
            <View style={{ marginTop: 14 }}>
              {splitPayments.map((p, i) => (
                <SplitRow key={i} t={t} entry={p} idx={i}
                  onMethod={(idx, method) => onUpdateSplit(idx, { method })}
                  onValue={(idx, value) => onUpdateSplit(idx, { value })}
                  onRemove={onRemoveSplit} canRemove={splitPayments.length > 1} />
              ))}
              <Pressable onPress={onAddSplit} style={{ borderWidth: 1, borderStyle: "dashed", borderColor: t.primary, borderRadius: 9, paddingVertical: 10, alignItems: "center", marginTop: 2, ...webPointer() }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: t.primary }}>+ Adicionar forma de pagamento</Text>
              </Pressable>
              <View style={{ marginTop: 10, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: splitBalanced ? t.successSoft : t.warningSoft }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700", textAlign: "center", color: splitBalanced ? t.successInk : t.warning }}>
                  {splitBalanced ? "✓ Pagamentos batem com o total" : (splitRemaining > 0 ? `Faltam R$ ${money(splitRemaining)} pra fechar` : `Sobrando R$ ${money(Math.abs(splitRemaining))} nos pagamentos`)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Cupom */}
        <View style={panel(t)}>
          <Text style={panelTitle(t)}>Cupom</Text>
          <Text style={{ fontSize: 12, color: t.ink3, marginBottom: 10 }}>Use um cupom criado no Financeiro.</Text>
          {couponApplied ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: t.successSoft, borderWidth: 1, borderColor: t.successInk, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ fontSize: 12.5, fontWeight: "800", color: t.successInk }}>{couponApplied.code} · −R$ {money(couponApplied.discount)}</Text>
              <Pressable onPress={onClearCoupon} style={webPointer()}><Ic name="x" size={15} color={t.successInk} /></Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <TextInput value={couponInput} onChangeText={setCouponInput} placeholder="Código do cupom" placeholderTextColor={t.ink3} autoCapitalize="characters"
                  style={{ height: 44, borderRadius: 10, borderWidth: 1, borderColor: t.ink5, backgroundColor: t.paperCardElev, color: t.ink, paddingHorizontal: 12, fontSize: 14, ...webNoOutline() }} />
              </View>
              <Pressable onPress={onApplyCoupon} disabled={couponValidating || !couponInput.trim()}
                style={{ height: 44, paddingHorizontal: 18, borderRadius: 10, backgroundColor: t.primarySoft, borderWidth: 1, borderColor: t.primary, alignItems: "center", justifyContent: "center", opacity: couponValidating || !couponInput.trim() ? 0.5 : 1, ...webPointer() }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: t.primary }}>{couponValidating ? "..." : "Aplicar"}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Desconto manual */}
        <View style={panel(t)}>
          <Text style={panelTitle(t)}>Desconto manual</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flexDirection: "row", backgroundColor: t.bgSoft, borderRadius: 9, padding: 3, borderWidth: 1, borderColor: t.ink5 }}>
              {(["%", "R$"] as const).map((opt) => {
                const on = discountType === opt;
                return (
                  <Pressable key={opt} onPress={() => setDiscountType(opt)}
                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 7, backgroundColor: on ? t.primary : "transparent", ...webPointer() }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: on ? "#fff" : t.ink3 }}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput value={discountValue} onChangeText={setDiscountValue} keyboardType="decimal-pad" placeholder={discountType === "%" ? "0" : "0,00"} placeholderTextColor={t.ink3}
              style={{ width: 110, height: 42, borderRadius: 9, borderWidth: 1, borderColor: overMax ? t.danger : t.ink5, backgroundColor: t.bgSoft, color: t.ink, textAlign: "center", fontSize: 14, fontWeight: "700", ...webNoOutline() }} />
            {manualDiscount > 0 && (
              <View style={{ marginLeft: "auto", alignItems: "flex-end" }}>
                <Text style={{ fontSize: 14, color: t.danger, fontWeight: "800" }}>−R$ {money(manualDiscount)}</Text>
              </View>
            )}
          </View>
          {overMax && <Text style={{ fontSize: 11, color: t.warning, marginTop: 6 }}>Desconto limitado a {MAX_DISCOUNT_PCT}%</Text>}
        </View>

        {/* Totais */}
        <View style={panel(t)}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
            <Text style={{ fontSize: 13.5, color: t.ink3 }}>Subtotal</Text>
            <Text style={{ fontSize: 13.5, color: t.ink, fontWeight: "700" }}>R$ {money(subtotal)}</Text>
          </View>
          {discountTotal > 0 && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <Text style={{ fontSize: 13.5, color: t.ink3 }}>{couponApplied ? `Desconto · ${couponApplied.code}` : "Desconto"}</Text>
              <Text style={{ fontSize: 13.5, color: t.danger, fontWeight: "700" }}>−R$ {money(discountTotal)}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: t.ink5, marginTop: 6, paddingTop: 12 }}>
            <Text style={{ fontSize: 15, color: t.ink, fontWeight: "800" }}>Total a pagar</Text>
            <Text style={{ fontSize: 22, color: t.ink, fontWeight: "800" }}>R$ {money(total)}</Text>
          </View>
        </View>

        {/* Observação */}
        <View style={panel(t)}>
          <Text style={panelTitle(t)}>Observação</Text>
          <FInput t={t} value={notes} onChangeText={setNotes} placeholder="Algo importante sobre o pedido?" multiline />
        </View>

        {error ? <Text style={{ fontSize: 12.5, color: t.danger, textAlign: "center", marginTop: 6 }}>{error}</Text> : null}
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: t.paperCardElev, borderTopWidth: 1, borderTopColor: t.ink5 }}>
        <Pressable
          onPress={onFinalize} disabled={blockFinalize}
          style={{ maxWidth: 920, alignSelf: "center", width: "100%", paddingVertical: 15, borderRadius: 12, backgroundColor: t.primary, alignItems: "center", opacity: blockFinalize ? 0.5 : 1, ...webPointer() }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>{sending ? "Registrando…" : `Concluir venda · R$ ${money(total)}`}</Text>
        </Pressable>
      </View>
    </View>
  );
}
const panel = (t: StudioPalette) => ({ backgroundColor: t.paperCard, borderRadius: 14, borderWidth: 1, borderColor: t.ink5, padding: 16, marginBottom: 12 } as const);
const panelTitle = (t: StudioPalette) => ({ fontSize: 14, color: t.ink, fontWeight: "800", marginBottom: 8 } as const);
