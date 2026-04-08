import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Product } from "./types";
import { fmt } from "./types";

function AlertRow({ product }: { product: Product }) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === "web";
  const deficit = product.minStock - product.stock;
  return (
    <Pressable onHoverIn={isWeb ? () => setHovered(true) : undefined} onHoverOut={isWeb ? () => setHovered(false) : undefined}
      style={[s.row, hovered && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}>
      <View style={s.icon}><Text style={s.iconText}>!</Text></View>
      <View style={{ flex: 1 }}><Text style={s.name}>{product.name}</Text><Text style={s.detail}>Atual: {product.stock} {product.unit} / Minimo: {product.minStock} {product.unit}</Text></View>
      <View style={{ alignItems: "flex-end", gap: 4 }}><View style={s.badge}><Text style={s.badgeText}>Repor {deficit} {product.unit}</Text></View><Text style={s.cost}>~{fmt(deficit * product.cost)}</Text></View>
    </Pressable>
  );
}

export function AlertsList({ products }: { products: Product[] }) {
  const lowStock = products.filter(p => p.stock <= p.minStock).sort((a, b) => (a.stock / (a.minStock || 1)) - (b.stock / (b.minStock || 1)));

  if (lowStock.length === 0) return (
    <View style={s.allGood}><Text style={s.allGoodIcon}>OK</Text><Text style={s.allGoodTitle}>Estoque em dia!</Text><Text style={s.allGoodSub}>Nenhum produto abaixo do estoque minimo.</Text></View>
  );

  return (
    <View>
      <View style={s.alertHeader}><Text style={s.alertHeaderText}>{lowStock.length} produto{lowStock.length > 1 ? "s" : ""} abaixo do estoque minimo</Text></View>
      <View style={s.listCard}>{lowStock.map(p => <AlertRow key={p.id} product={p} />)}</View>
      <View style={s.reorderCard}><Text style={s.reorderTitle}>Custo estimado de reposicao</Text><Text style={s.reorderValue}>{fmt(lowStock.reduce((s, p) => s + (p.minStock - p.stock) * p.cost, 0))}</Text><Text style={s.reorderHint}>Para repor todos ao estoque minimo</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  icon: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.redD, alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 14, color: Colors.red, fontWeight: "800" },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  detail: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  badge: { backgroundColor: Colors.redD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, color: Colors.red, fontWeight: "700" },
  cost: { fontSize: 10, color: Colors.ink3 },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  alertHeader: { backgroundColor: Colors.redD, borderRadius: 12, padding: 14, marginBottom: 16 },
  alertHeaderText: { fontSize: 13, color: Colors.red, fontWeight: "600" },
  allGood: { alignItems: "center", paddingVertical: 48, gap: 8 },
  allGoodIcon: { fontSize: 32, color: Colors.green, fontWeight: "800" },
  allGoodTitle: { fontSize: 18, color: Colors.ink, fontWeight: "700" },
  allGoodSub: { fontSize: 13, color: Colors.ink3 },
  reorderCard: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", gap: 6 },
  reorderTitle: { fontSize: 12, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8 },
  reorderValue: { fontSize: 28, color: Colors.amber, fontWeight: "800", letterSpacing: -0.5 },
  reorderHint: { fontSize: 11, color: Colors.ink3 },
});

export default AlertsList;
