import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import type { Product } from "./types";
import { fmt } from "./types";

function AbcBadge({ abc }: { abc: "A" | "B" | "C" }) {
  const colors = { A: Colors.green, B: Colors.amber, C: Colors.ink3 };
  const bgs = { A: Colors.greenD, B: Colors.amberD, C: "rgba(255,255,255,0.05)" };
  return <View style={[s.badge, { backgroundColor: bgs[abc] }]}><Text style={[s.badgeText, { color: colors[abc] }]}>{abc}</Text></View>;
}

export function ProductRow({ product, showAbc, onDelete }: { product: Product; showAbc?: boolean; onDelete?: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isWeb = Platform.OS === "web";
  const isLow = product.stock <= product.minStock;
  const margin = product.price > 0 ? ((product.price - product.cost) / product.price * 100).toFixed(0) : "0";

  return (
    <View>
      <Pressable onPress={() => setExpanded(!expanded)} onHoverIn={isWeb ? () => setHovered(true) : undefined} onHoverOut={isWeb ? () => setHovered(false) : undefined}
        style={[s.row, hovered && { backgroundColor: Colors.bg4 }, isWeb && { transition: "background-color 0.15s ease" } as any]}>
        <View style={s.left}>
          {showAbc && <AbcBadge abc={product.abc} />}
          <View style={s.info}>
            <Text style={s.name}>{product.name}</Text>
            <Text style={s.meta}>{product.code} / {product.category}{product.barcode ? " / EAN" : ""}</Text>
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
      {expanded && (
        <View style={s.detail}>
          <View style={s.detailGrid}>
            {[["Custo", fmt(product.cost)], ["Margem", margin + "%"], ["Vendidos (30d)", String(product.sold30d)], ["Valor estoque", fmt(product.stock * product.cost)], ["Estoque minimo", product.minStock + " " + product.unit]].map(([l, v]) =>
              <View key={l} style={s.detailItem}><Text style={s.detailLabel}>{l}</Text><Text style={[s.detailValue, l === "Margem" && { color: Colors.green }]}>{v}</Text></View>
            )}
            <View style={s.detailItem}><Text style={s.detailLabel}>Curva ABC</Text><AbcBadge abc={product.abc} /></View>
          </View>
          {product.brand ? <Text style={s.brandText}>Marca: {product.brand}</Text> : null}
          {product.barcode ? <View style={s.barcodeRow}><Text style={s.barcodeLabel}>Codigo de barras:</Text><Text style={s.barcodeValue}>{product.barcode}</Text></View> : null}
          {product.notes ? <Text style={s.notesText}>{product.notes}</Text> : null}
          {onDelete && <Pressable onPress={() => onDelete(product.id)} style={s.deleteBtn}><Text style={s.deleteBtnText}>Excluir produto</Text></Pressable>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 12, fontWeight: "800" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  info: { flex: 1 },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  right: { alignItems: "flex-end", gap: 2 },
  stockRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stock: { fontSize: 13, color: Colors.ink, fontWeight: "600" },
  alertDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.red },
  price: { fontSize: 11, color: Colors.ink3 },
  detail: { backgroundColor: Colors.bg4, borderRadius: 12, padding: 14, marginHorizontal: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  detailItem: { width: "30%", minWidth: 100, paddingVertical: 8, gap: 4 },
  detailLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  brandText: { fontSize: 11, color: Colors.ink3, marginTop: 8 },
  barcodeRow: { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  barcodeLabel: { fontSize: 11, color: Colors.ink3 },
  barcodeValue: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  notesText: { fontSize: 11, color: Colors.ink3, marginTop: 6, fontStyle: "italic" },
  deleteBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.redD, borderWidth: 1, borderColor: Colors.red + "33", alignItems: "center" },
  deleteBtnText: { fontSize: 12, color: Colors.red, fontWeight: "600" },
});

export default ProductRow;
