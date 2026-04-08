import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { CartItem } from "@/hooks/useCart";
import { PAYMENTS } from "@/hooks/useCart";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function CartRow({ item, onPlus, onMinus, onRemove, onSetQty }: { item: CartItem; onPlus: () => void; onMinus: () => void; onRemove: () => void; onSetQty: (qty: number) => void }) {
  const [h, sH] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const w = Platform.OS === "web";

  function startEdit() { setEditVal(String(item.qty)); setEditing(true); }
  function confirmEdit() {
    const v = parseInt(editVal);
    if (v > 0) onSetQty(v);
    setEditing(false);
  }

  return (
    <Pressable onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
      style={[s.row, h && { backgroundColor: Colors.bg4 }, w && { transition: "background-color 0.15s ease" } as any]}>
      <View style={s.info}><Text style={s.name} numberOfLines={1}>{item.name}</Text><Text style={s.unit}>{fmt(item.price)} / un</Text></View>
      <View style={s.controls}>
        <Pressable onPress={onMinus} style={s.btn}><Text style={s.btnText}>-</Text></Pressable>
        {editing ? (
          <TextInput style={s.qtyInput} value={editVal} onChangeText={setEditVal} onBlur={confirmEdit} onSubmitEditing={confirmEdit} keyboardType="number-pad" autoFocus selectTextOnFocus />
        ) : (
          <Pressable onPress={startEdit}><Text style={s.qty}>{item.qty}</Text></Pressable>
        )}
        <Pressable onPress={onPlus} style={s.btn}><Text style={s.btnText}>+</Text></Pressable>
      </View>
      <Text style={s.total}>{fmt(item.price * item.qty)}</Text>
      <Pressable onPress={onRemove} style={s.removeBtn}><Text style={s.removeText}>x</Text></Pressable>
    </Pressable>
  );
}

export function CartPanel({ cart, payment, setPayment, total, itemCount, isWide, setQty, updateQty, removeItem, finalizeSale }: {
  cart: CartItem[]; payment: string; setPayment: (k: string) => void; total: number; itemCount: number;
  isWide: boolean; setQty: (id: string, qty: number) => void; updateQty: (id: string, d: number) => void; removeItem: (id: string) => void; finalizeSale: () => void;
}) {
  return (
    <View style={{ padding: isWide ? 20 : 0, marginTop: isWide ? 0 : 24, flex: isWide ? 1 : undefined }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Text style={{ fontSize: 16, color: Colors.ink, fontWeight: "700" }}>Caixa</Text>
        {itemCount > 0 && <View style={s.badge}><Text style={s.badgeText}>{itemCount}</Text></View>}
      </View>
      {cart.length === 0 && <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}><Text style={{ fontSize: 32, color: Colors.ink3 }}>$</Text><Text style={{ fontSize: 12, color: Colors.ink3, textAlign: "center" }}>Toque em um produto ou escaneie um codigo</Text></View>}
      <ScrollView style={{ maxHeight: isWide ? 280 : undefined }} showsVerticalScrollIndicator={false}>
        {cart.map(item => <CartRow key={item.productId} item={item} onPlus={() => updateQty(item.productId, 1)} onMinus={() => updateQty(item.productId, -1)} onRemove={() => removeItem(item.productId)} onSetQty={(qty) => setQty(item.productId, qty)} />)}
      </ScrollView>
      {cart.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <View style={s.divider} />
          <Text style={s.payLabel}>Pagamento</Text>
          <View style={s.payRow}>{PAYMENTS.map(p => <Pressable key={p.key} onPress={() => setPayment(p.key)} style={[s.payChip, payment === p.key && s.payChipActive]}><Text style={[s.payText, payment === p.key && s.payTextActive]}>{p.label}</Text></Pressable>)}</View>
          <View style={s.divider} />
          <View style={s.totalRow}>
            <Text style={{ fontSize: 16, color: Colors.ink, fontWeight: "600" }}>Total</Text>
            <Text style={{ fontSize: 24, color: Colors.green, fontWeight: "800", letterSpacing: -0.5 }}>{fmt(total)}</Text>
          </View>
          <Pressable onPress={finalizeSale} style={s.finalizeBtn}><Text style={s.finalizeText}>Finalizar venda</Text></Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  info: { flex: 1 }, name: { fontSize: 13, color: Colors.ink, fontWeight: "500" }, unit: { fontSize: 10, color: Colors.ink3, marginTop: 1 },
  controls: { flexDirection: "row", alignItems: "center", gap: 6 },
  btn: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 14, color: Colors.ink, fontWeight: "600" },
  qty: { fontSize: 14, color: Colors.ink, fontWeight: "700", minWidth: 28, textAlign: "center", paddingVertical: 2, paddingHorizontal: 4, borderRadius: 4, backgroundColor: Colors.bg4 },
  qtyInput: { width: 44, height: 28, borderRadius: 6, backgroundColor: Colors.bg4, borderWidth: 1.5, borderColor: Colors.violet, textAlign: "center", fontSize: 14, color: Colors.ink, fontWeight: "700", paddingVertical: 0 },
  total: { fontSize: 13, color: Colors.green, fontWeight: "600", minWidth: 70, textAlign: "right" },
  removeBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" },
  removeText: { fontSize: 11, color: Colors.red, fontWeight: "700" },
  badge: { backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  payLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  payRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  payChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  payChipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  payText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  payTextActive: { color: "#fff", fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  finalizeBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  finalizeText: { fontSize: 14, color: "#fff", fontWeight: "700" },
});

export default CartPanel;
