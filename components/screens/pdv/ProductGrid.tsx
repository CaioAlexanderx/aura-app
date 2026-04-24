// ============================================================
// AURA. -- PDV/Caixa · Product grid with Claude Design cards
// - Glass card w/ conic-gradient radial halo inside prod-img
// - Big monogram letter
// - Qty badge with pop animation when in cart
// - Hover lift + violet glow (web only)
// ============================================================
import { useRef } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Image } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WEB, webOnly, accentForProduct, productLetter, fmtCurrency } from "./types";

export type GridProduct = {
  id: string;
  name: string;
  price: number;
  category?: string;
  stock?: number;
  unit?: string;
  image_url?: string;
  has_variants?: boolean;
};

type Props = {
  products: GridProduct[];
  qtyById: Record<string, number>;
  onAdd: (p: GridProduct, evt?: { x: number; y: number; accent: string; letter: string }) => void;
  columns?: number;
};

export function ProductGrid({ products, qtyById, onAdd, columns = 4 }: Props) {
  return (
    <View style={[s.grid, IS_WEB && ({ display: "grid", gridTemplateColumns: "repeat(" + columns + ", 1fr)", gap: 14 } as any)]}>
      {products.map((p, i) => (
        <ProdCard
          key={p.id}
          product={p}
          qty={qtyById[p.id] || 0}
          index={i}
          onAdd={onAdd}
        />
      ))}
    </View>
  );
}

function ProdCard({ product, qty, index, onAdd }: { product: GridProduct; qty: number; index: number; onAdd: Props["onAdd"] }) {
  const accent = accentForProduct(product.id);
  const letter = productLetter(product.name);
  const inCart = qty > 0;
  const addRef = useRef<any>(null);

  function handlePress() {
    let rect: { x: number; y: number } | null = null;
    if (IS_WEB && addRef.current && addRef.current.getBoundingClientRect) {
      const b = addRef.current.getBoundingClientRect();
      rect = { x: b.left, y: b.top };
    }
    onAdd(product, rect ? { x: rect.x, y: rect.y, accent: accent, letter: letter } : undefined);
  }

  const webCard = webOnly({
    background: Glass.card,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid " + Glass.lineBorderCard,
    overflow: "hidden",
    animation: "caixaFadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both",
    animationDelay: 0.05 + index * 0.04 + "s",
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
  });

  const imgBg = webOnly({
    background:
      "radial-gradient(circle at 30% 30%, " +
      accent +
      "55, " +
      accent +
      "12 70%)",
    border: "1px solid " + accent + "3f",
    overflow: "hidden",
  });

  const addBtnBg = webOnly({
    background: inCart
      ? "linear-gradient(135deg, #34d399, #10b981)"
      : "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    boxShadow: inCart
      ? "0 4px 10px rgba(52,211,153,0.4)"
      : "0 4px 10px rgba(124,58,237,0.4)",
  });

  return (
    <Pressable
      onPress={handlePress}
      style={[
        s.card,
        Platform.OS === "web" ? (webCard as any) : { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
      ]}
    >
      {IS_WEB && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, " + accent + ", transparent)",
            opacity: 0.6,
            pointerEvents: "none",
          } as any}
        />
      )}

      {qty > 0 && (
        <View style={[s.badge, IS_WEB && ({ animation: "caixaBadgePop 0.35s cubic-bezier(0.4,0,0.2,1)" } as any)]}>
          <Text style={s.badgeTxt}>×{qty}</Text>
        </View>
      )}

      <View style={[s.imgBox, Platform.OS === "web" ? (imgBg as any) : { backgroundColor: accent + "22", borderWidth: 1, borderColor: accent + "44" }]}>
        {IS_WEB && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "conic-gradient(from 0deg, transparent 0deg, " + accent + "66 60deg, transparent 140deg)",
              opacity: 0.25,
              animation: "caixaSpin 8s linear infinite",
              pointerEvents: "none",
            } as any}
          />
        )}
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={s.thumb} resizeMode="cover" />
        ) : (
          <Text style={s.glyph}>{letter}</Text>
        )}
      </View>

      <Text numberOfLines={2} style={s.name}>{product.name}</Text>
      {(product.stock != null || product.unit) && (
        <Text style={s.stock}>
          {product.stock != null ? "Est. " + product.stock + (product.unit ? " " + product.unit : " un") : product.unit || ""}
        </Text>
      )}

      <View style={s.foot}>
        <Text style={s.price}>{fmtCurrency(product.price)}</Text>
        <View ref={addRef as any} style={[s.addBtn, Platform.OS === "web" ? (addBtnBg as any) : { backgroundColor: inCart ? "#10b981" : Colors.violet }]}>
          <Icon name={inCart ? "check" : "plus"} size={14} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  card: {
    position: "relative",
    padding: 14,
    borderRadius: 16,
    flex: 1 as any,
    minWidth: 180,
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: "#34d399",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  badgeTxt: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 12,
    fontWeight: "700",
    color: "#0b0f22",
  },
  imgBox: {
    position: "relative",
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: { position: "absolute", inset: 0 as any, width: "100%", height: "100%" },
  glyph: {
    position: "relative",
    zIndex: 2,
    fontSize: 34,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "700",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.25)" as any,
    textShadowRadius: Platform.OS === "web" ? 6 : 0 as any,
  },
  name: {
    fontSize: 13,
    color: Colors.ink,
    fontWeight: "600",
    lineHeight: 17,
    minHeight: 36,
  },
  stock: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 10,
    color: Colors.ink3,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 3,
  },
  foot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  price: {
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    fontSize: 14,
    fontWeight: "700",
    color: Colors.violet3,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ProductGrid;
