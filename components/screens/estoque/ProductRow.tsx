import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Image } from "react-native";
import { Colors } from "@/constants/colors";
import { ProductImageUpload } from "@/components/ProductImageUpload";
import type { Product } from "./types";
import { fmt } from "./types";

var COLOR_NAMES: Record<string, string> = {
  '#000000':'Preto','#ffffff':'Branco','#ff0000':'Vermelho','#c0c0c0':'Prata',
  '#808080':'Cinza','#0000ff':'Azul','#000080':'Marinho','#00ff00':'Verde',
  '#008000':'Verde Esc.','#ffff00':'Amarelo','#ffa500':'Laranja','#ff00ff':'Pink',
  '#ffc0cb':'Rosa','#800080':'Roxo','#a52a2a':'Marrom','#800000':'Vinho',
  '#ffd700':'Dourado','#f5f5dc':'Bege','#ff6347':'Coral','#40e0d0':'Turquesa',
  '#4b0082':'Indigo','#dc143c':'Carmesim','#2f4f4f':'Chumbo','#d2691e':'Caramelo',
};
function hexToName(hex: string) {
  if (!hex) return '';
  return COLOR_NAMES[hex.toLowerCase()] || hex;
}

function AbcBadge({ abc }: { abc: "A" | "B" | "C" }) {
  const colors = { A: Colors.green, B: Colors.amber, C: Colors.ink3 };
  const bgs = { A: Colors.greenD, B: Colors.amberD, C: "rgba(255,255,255,0.05)" };
  return <View style={[s.badge, { backgroundColor: bgs[abc] }]}><Text style={[s.badgeText, { color: colors[abc] }]}>{abc}</Text></View>;
}

export function ProductRow({
  product, showAbc, onDelete, onEdit,
  isSelected, onSelect,
}: {
  product: Product;
  showAbc?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (product: Product) => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isWeb = Platform.OS === "web";
  const isLow = product.stock <= product.minStock;
  const margin = product.price > 0 ? ((product.price - product.cost) / product.price * 100).toFixed(0) : "0";
  const colorName = product.color ? hexToName(product.color) : "";
  const hasVariant = !!(product.color || product.size);
  const hasImage = !!product.image_url;

  return (
    <View>
      <Pressable
        onPress={() => onSelect ? onSelect(product.id) : setExpanded(!expanded)}
        onHoverIn={isWeb ? () => setHovered(true) : undefined}
        onHoverOut={isWeb ? () => setHovered(false) : undefined}
        style={[s.row, hovered && { backgroundColor: Colors.bg4 }, isSelected && { backgroundColor: Colors.violetD }, isWeb && { transition: "background-color 0.15s ease" } as any]}
      >
        {onSelect && (
          <View style={[s.checkbox, isSelected && s.checkboxSelected]}>
            {isSelected && <Text style={s.checkmark}>{"\u2713"}</Text>}
          </View>
        )}
        <View style={s.left}>
          {showAbc && !onSelect && <AbcBadge abc={product.abc} />}
          {/* Product thumbnail */}
          {hasImage ? (
            <Image source={{ uri: product.image_url }} style={s.thumb} resizeMode="cover" />
          ) : product.color ? (
            <View style={s.colorGroup}>
              <View style={[s.colorSwatch, { backgroundColor: product.color }]} />
              <Text style={s.colorName}>{colorName}</Text>
            </View>
          ) : null}
          <View style={s.info}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={1}>{product.name}</Text>
              {product.size ? <View style={s.sizeBadge}><Text style={s.sizeBadgeText}>{product.size}</Text></View> : null}
            </View>
            <Text style={s.meta}>{product.code} / {product.category}</Text>
          </View>
        </View>
        <View style={s.right}>
          <View style={s.stockRow}>
            <Text style={[s.stock, isLow && { color: Colors.red }]}>{product.stock} {product.unit}</Text>
            {isLow && <View style={s.alertDot} />}
          </View>
          <Text style={s.price}>{fmt(product.price)}</Text>
        </View>
      </Pressable>
      {expanded && !onSelect && (
        <View style={s.detail}>
          {/* Photo upload in detail */}
          <View style={s.detailPhotoRow}>
            <ProductImageUpload productId={product.id} imageUrl={product.image_url} compact />
            <View style={s.detailGrid}>
              {[["Custo", fmt(product.cost)], ["Margem", margin + "%"], ["Vendidos (30d)", String(product.sold30d)], ["Valor estoque", fmt(product.stock * product.cost)], ["Estoque minimo", product.minStock + " " + product.unit]].map(([l, v]) =>
                <View key={l} style={s.detailItem}><Text style={s.detailLabel}>{l}</Text><Text style={[s.detailValue, l === "Margem" && { color: Colors.green }]}>{v}</Text></View>
              )}
              <View style={s.detailItem}><Text style={s.detailLabel}>Curva ABC</Text><AbcBadge abc={product.abc} /></View>
            </View>
          </View>
          {hasVariant && (
            <View style={s.variantRow}>
              {product.color ? (
                <View style={s.variantItem}>
                  <Text style={s.detailLabel}>Cor</Text>
                  <View style={s.variantColorDisplay}>
                    <View style={[s.variantDot, { backgroundColor: product.color }]} />
                    <Text style={s.variantText}>{colorName}</Text>
                  </View>
                </View>
              ) : null}
              {product.size ? (
                <View style={s.variantItem}>
                  <Text style={s.detailLabel}>Tamanho</Text>
                  <Text style={s.variantText}>{product.size}</Text>
                </View>
              ) : null}
            </View>
          )}
          {product.barcode ? <View style={s.barcodeRow}><Text style={s.barcodeLabel}>Codigo de barras:</Text><Text style={s.barcodeValue}>{product.barcode}</Text></View> : null}
          {product.notes ? <Text style={s.notesText}>{product.notes}</Text> : null}
          <View style={s.actionsRow}>
            {onEdit && <Pressable onPress={() => onEdit(product)} style={s.editBtn}><Text style={s.editBtnText}>Editar produto</Text></Pressable>}
            {onDelete && <Pressable onPress={() => onDelete(product.id)} style={s.deleteBtn}><Text style={s.deleteBtnText}>Excluir</Text></Pressable>}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 12, fontWeight: "800" },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, marginRight: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg4 },
  checkboxSelected: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  checkmark: { fontSize: 13, color: "#fff", fontWeight: "700", lineHeight: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600", flexShrink: 1 },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  thumb: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  colorGroup: { alignItems: "center", gap: 2 },
  colorSwatch: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: Colors.border },
  colorName: { fontSize: 8, color: Colors.ink3, maxWidth: 44, textAlign: "center" },
  sizeBadge: { backgroundColor: Colors.bg4, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: Colors.border },
  sizeBadgeText: { fontSize: 9, fontWeight: "700", color: Colors.ink3, letterSpacing: 0.3 },
  right: { alignItems: "flex-end", gap: 2 },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stock: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  alertDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.red },
  price: { fontSize: 11, color: Colors.ink3 },
  detail: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginHorizontal: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  detailPhotoRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, flex: 1 },
  detailItem: { width: "30%", minWidth: 100, paddingVertical: 8, gap: 4 },
  detailLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  variantRow: { flexDirection: "row", gap: 20, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  variantItem: { gap: 4 },
  variantColorDisplay: { flexDirection: "row", alignItems: "center", gap: 6 },
  variantDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: Colors.border },
  variantText: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  barcodeRow: { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  barcodeLabel: { fontSize: 11, color: Colors.ink3 },
  barcodeValue: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  notesText: { fontSize: 11, color: Colors.ink3, marginTop: 6, fontStyle: "italic" },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  editBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center" },
  editBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  deleteBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red + "33", alignItems: "center" },
  deleteBtnText: { fontSize: 12, color: Colors.red, fontWeight: "600" },
});

export default ProductRow;
