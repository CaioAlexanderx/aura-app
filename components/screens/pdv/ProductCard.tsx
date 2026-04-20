import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Image } from "react-native";
import { Colors } from "@/constants/colors";

var fmt = function(n: number) { return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 }); };
var isWeb = Platform.OS === "web";

function hexToName(hex: string | undefined): string {
  if (!hex || !/^#[0-9a-fA-F]{3,8}$/.test(hex)) return "";
  var h = hex.replace("#", "").slice(0, 6);
  if (h.length === 3) h = h.split("").map(function(c) { return c + c; }).join("");
  var r = parseInt(h.substring(0, 2), 16);
  var g = parseInt(h.substring(2, 4), 16);
  var b = parseInt(h.substring(4, 6), 16);
  var palette: { name: string; r: number; g: number; b: number }[] = [
    { name: "Preto", r: 0, g: 0, b: 0 }, { name: "Branco", r: 255, g: 255, b: 255 },
    { name: "Cinza", r: 128, g: 128, b: 128 }, { name: "Bege", r: 240, g: 235, b: 223 },
    { name: "Nude", r: 226, g: 197, b: 170 }, { name: "Marrom", r: 139, g: 69, b: 19 },
    { name: "Marrom", r: 189, g: 113, b: 0 }, { name: "Caramelo", r: 196, g: 138, b: 92 },
    { name: "Vermelho", r: 220, g: 20, b: 20 }, { name: "Vinho", r: 114, g: 28, b: 36 },
    { name: "Rosa", r: 255, g: 105, b: 180 }, { name: "Rosa claro", r: 255, g: 182, b: 193 },
    { name: "Laranja", r: 255, g: 140, b: 0 }, { name: "Amarelo", r: 255, g: 215, b: 0 },
    { name: "Verde", r: 34, g: 139, b: 34 }, { name: "Verde claro", r: 139, g: 232, b: 179 },
    { name: "Verde agua", r: 64, g: 224, b: 208 }, { name: "Azul", r: 30, g: 100, b: 200 },
    { name: "Azul marinho", r: 25, g: 25, b: 112 }, { name: "Azul claro", r: 135, g: 206, b: 235 },
    { name: "Roxo", r: 128, g: 0, b: 128 }, { name: "Lilas", r: 200, g: 162, b: 200 },
    { name: "Dourado", r: 212, g: 175, b: 55 }, { name: "Prateado", r: 192, g: 192, b: 192 },
  ];
  var best = palette[0]; var bestDist = Infinity;
  for (var i = 0; i < palette.length; i++) {
    var p = palette[i];
    var d = (p.r - r) * (p.r - r) + (p.g - g) * (p.g - g) + (p.b - b) * (p.b - b);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best.name;
}

export function ProductCard({ product, onAdd, isWide, variantBadge }: {
  product: { id: string; name: string; price: number; category: string; stock: number; barcode: string; color?: string; size?: string; has_variants?: boolean; image_url?: string };
  onAdd: () => void; isWide: boolean; variantBadge?: string;
}) {
  var [h, sH] = useState(false);
  var catIcon = product.category === "Servicos" ? "S" : product.category === "Combos" ? "C" : product.category === "Extras" ? "E" : "P";
  var hasColor = product.color && /^#[0-9a-fA-F]{3,8}$/.test(product.color);
  var colorName = hasColor ? hexToName(product.color) : "";
  var barcodeTail = product.barcode ? product.barcode.slice(-4) : "";
  var hasImage = !!product.image_url;

  return (
    <Pressable onPress={onAdd} onHoverIn={isWeb ? function() { sH(true); } : undefined} onHoverOut={isWeb ? function() { sH(false); } : undefined}
      style={[s.card, { width: isWide ? "30%" : "47%", margin: "1.5%" }, h && s.cardHovered, isWeb && { transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)" } as any]}>
      <View style={s.headerRow}>
        {hasImage ? (
          <Image source={{ uri: product.image_url }} style={s.productImage} resizeMode="cover" />
        ) : (
          <View style={[s.iconWrap, h && s.iconWrapHovered, hasColor && { borderColor: product.color + "66" }]}>
            <Text style={[s.icon, h && { color: "#fff" }]}>{catIcon}</Text>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {variantBadge && (
            <View style={s.variantBadge}>
              <Text style={s.variantBadgeText}>{variantBadge}</Text>
            </View>
          )}
          {barcodeTail ? (
            <View style={s.barcodeTailWrap}>
              <Text style={s.barcodeTailPrefix}>{"\u2026"}</Text>
              <Text style={s.barcodeTail}>{barcodeTail}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={s.name} numberOfLines={2}>{product.name}</Text>

      {(product.size || hasColor) ? (
        <View style={s.variantRow}>
          {hasColor ? (
            <View style={s.colorBlock}>
              <View style={[s.colorChip, { backgroundColor: product.color }]} />
              {colorName ? <Text style={s.colorName}>{colorName}</Text> : null}
            </View>
          ) : null}
          {product.size ? (
            <View style={s.sizeBadge}>
              <Text style={s.sizeBadgeText}>{product.size}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={s.price}>{fmt(product.price)}</Text>

      <View style={s.bottomRow}>
        {product.stock != null && (
          <Text style={[s.stock, product.stock < 5 && { color: Colors.red }]}>
            {product.stock} un
          </Text>
        )}
      </View>
    </Pressable>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: Colors.border, gap: 8, minHeight: 170 },
  cardHovered: { borderColor: Colors.violet2, transform: [{ translateY: -4 }, { scale: 1.04 }], shadowColor: Colors.violet, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8, backgroundColor: Colors.bg4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.border2 },
  iconWrapHovered: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  icon: { fontSize: 14, fontWeight: "700", color: Colors.violet3 },
  productImage: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  barcodeTailWrap: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  barcodeTailPrefix: { fontSize: 10, color: Colors.ink3, fontFamily: "monospace" as any, marginRight: 1 },
  barcodeTail: { fontSize: 11, color: Colors.ink2, fontFamily: "monospace" as any, fontWeight: "700", letterSpacing: 0.5 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600", lineHeight: 16 },
  variantRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  colorBlock: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.bg, borderRadius: 14, paddingLeft: 3, paddingRight: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border },
  colorChip: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)" },
  colorName: { fontSize: 10.5, color: Colors.ink2, fontWeight: "600" },
  sizeBadge: { backgroundColor: Colors.violetD, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border2 },
  sizeBadgeText: { fontSize: 10, color: Colors.violet3, fontWeight: "700", letterSpacing: 0.3 },
  price: { fontSize: 16, color: Colors.green, fontWeight: "800", marginTop: "auto" as any },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stock: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
  variantBadge: { backgroundColor: Colors.amberD, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(245,158,11,0.25)" },
  variantBadgeText: { fontSize: 9, color: Colors.amber, fontWeight: "700" },
});

export default ProductCard;
