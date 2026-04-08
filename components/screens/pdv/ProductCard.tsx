import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function ProductCard({ product, onAdd, isWide }: { product: { id: string; name: string; price: number; category: string; stock: number; barcode: string }; onAdd: () => void; isWide: boolean }) {
  const [h, sH] = useState(false);
  const w = Platform.OS === "web";
  const catIcon = product.category === "Servicos" ? "S" : product.category === "Combos" ? "C" : product.category === "Extras" ? "E" : "P";
  return (
    <Pressable onPress={onAdd} onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
      style={[s.card, { width: isWide ? "30%" : "47%", margin: "1.5%" }, h && s.cardHovered, w && { transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" } as any]}>
      <View style={[s.iconWrap, h && s.iconWrapHovered]}><Text style={s.icon}>{catIcon}</Text></View>
      <Text style={s.name} numberOfLines={1}>{product.name}</Text>
      <Text style={s.price}>{fmt(product.price)}</Text>
      <View style={s.bottomRow}>
        {product.stock != null && <Text style={[s.stock, product.stock < 5 && { color: Colors.red }]}>{product.stock} un</Text>}
        {product.barcode ? <Text style={s.barcodeBadge}>EAN</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", gap: 6 },
  cardHovered: { borderColor: Colors.violet2, transform: [{ translateY: -4 }, { scale: 1.04 }], shadowColor: Colors.violet, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8, backgroundColor: Colors.bg4 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginBottom: 6, borderWidth: 1, borderColor: Colors.border2 },
  iconWrapHovered: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  icon: { fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600", textAlign: "center" },
  price: { fontSize: 15, color: Colors.green, fontWeight: "800" },
  bottomRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  stock: { fontSize: 10, color: Colors.ink3 },
  barcodeBadge: { fontSize: 8, color: Colors.violet3, backgroundColor: Colors.violetD, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, fontWeight: "600" },
});

export default ProductCard;
