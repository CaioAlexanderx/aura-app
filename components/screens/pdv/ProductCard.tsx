import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";

var fmt = function(n: number) { return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); };
var isWeb = Platform.OS === "web";

export function ProductCard({ product, onAdd, isWide }: { product: { id: string; name: string; price: number; category: string; stock: number; barcode: string; color?: string; size?: string }; onAdd: () => void; isWide: boolean }) {
  var [h, sH] = useState(false);
  var catIcon = product.category === "Servicos" ? "S" : product.category === "Combos" ? "C" : product.category === "Extras" ? "E" : "P";
  var hasColor = product.color && /^#[0-9a-fA-F]{3,8}$/.test(product.color);

  return (
    <Pressable onPress={onAdd} onHoverIn={isWeb ? function() { sH(true); } : undefined} onHoverOut={isWeb ? function() { sH(false); } : undefined}
      style={[s.card, { width: isWide ? "30%" : "47%", margin: "1.5%" }, h && s.cardHovered, isWeb && { transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" } as any]}>
      {/* Icon with color indicator */}
      <View style={{ position: "relative" }}>
        <View style={[s.iconWrap, h && s.iconWrapHovered, hasColor && { borderColor: product.color + "66" }]}>
          <Text style={[s.icon, h && { color: "#fff" }]}>{catIcon}</Text>
        </View>
        {hasColor && (
          <View style={[s.colorDot, { backgroundColor: product.color }]} />
        )}
      </View>
      <Text style={s.name} numberOfLines={1}>{product.name}</Text>
      {/* Size + Color info row */}
      {(product.size || hasColor) && (
        <View style={s.infoRow}>
          {product.size ? <Text style={s.sizeBadge}>{product.size}</Text> : null}
          {hasColor && <View style={[s.colorChip, { backgroundColor: product.color }]} />}
        </View>
      )}
      <Text style={s.price}>{fmt(product.price)}</Text>
      <View style={s.bottomRow}>
        {product.stock != null && <Text style={[s.stock, product.stock < 5 && { color: Colors.red }]}>{product.stock} un</Text>}
        {product.barcode ? <Text style={s.barcodeBadge}>EAN</Text> : null}
      </View>
    </Pressable>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", gap: 6 },
  cardHovered: { borderColor: Colors.violet2, transform: [{ translateY: -4 }, { scale: 1.04 }], shadowColor: Colors.violet, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8, backgroundColor: Colors.bg4 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", marginBottom: 6, borderWidth: 1, borderColor: Colors.border2 },
  iconWrapHovered: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  icon: { fontSize: 16, fontWeight: "700", color: Colors.violet3 },
  colorDot: { position: "absolute", bottom: 3, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.bg3 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600", textAlign: "center" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sizeBadge: { fontSize: 9, color: Colors.ink3, backgroundColor: Colors.bg4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, fontWeight: "600" },
  colorChip: { width: 10, height: 10, borderRadius: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  price: { fontSize: 15, color: Colors.green, fontWeight: "800" },
  bottomRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  stock: { fontSize: 10, color: Colors.ink3 },
  barcodeBadge: { fontSize: 8, color: Colors.violet3, backgroundColor: Colors.violetD, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, fontWeight: "600" },
});

export default ProductCard;
