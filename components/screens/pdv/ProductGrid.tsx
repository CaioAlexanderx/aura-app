// ============================================================
// AURA. -- PDV/Caixa · Product grid with Claude Design cards
// - Glass card w/ conic-gradient radial halo inside prod-img
// - Big monogram letter
// - Qty badge with pop animation when in cart
// - Hover lift + violet glow (web only)
//
// 16/06/2026 (Davi 13-15"): grid passou a ser FLUIDO. Na web usa
// `repeat(auto-fill, minmax(min(100%, <minCard>px), 1fr))` em vez de uma
// contagem fixa de colunas — o número de colunas segue a largura
// disponível (3–6) sem nunca estourar a área do catálogo. `compact`
// reduz imagem/glyph/paddings em telas menores pra caber mais cards
// legíveis sem zoom out. `columns` continua como fallback no nativo.
// ============================================================
import { useRef } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Image } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WEB, webOnly, accentForProduct, productLetter, fmtCurrency } from "./types";

// "EST. 11 UN" era abreviação de sistema: o `Est.` vinha do código e o
// uppercase do estilo. Vira frase — "11 em estoque" — e a unidade só aparece
// quando NÃO é "un" (que já está implícita na frase): "3 kg em estoque".
// 16/09/2026 (Fase 0 · I0.3).
const UNIDADES_IMPLICITAS = ["", "un", "und", "uni", "unid", "unidade", "unidades", "pc", "pç"];

export function stockLabel(stock?: number | null, unit?: string | null): string {
  const u = String(unit || "").trim();
  if (stock == null) return u;
  const implicita = UNIDADES_IMPLICITAS.indexOf(u.toLowerCase()) >= 0;
  return implicita ? stock + " em estoque" : stock + " " + u + " em estoque";
}

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
  /** Fallback de colunas fixas (nativo / quando minCard não é passado). */
  columns?: number;
  /** Largura mínima do card p/ grid fluido auto-fill (web). Quando setado,
   *  ignora `columns` e deixa o CSS escolher quantas colunas cabem. */
  minCard?: number;
  /** Densidade reduzida — imagem/glyph/paddings menores p/ telas pequenas. */
  compact?: boolean;
  /** Mobile portrait: densidade ainda menor, pra caber DOIS pares de produtos
   *  na primeira dobra de um 390×780 (Fase 0 · I0.3). */
  dense?: boolean;
};

export function ProductGrid({ products, qtyById, onAdd, columns = 4, minCard, compact = false, dense = false }: Props) {
  const gap = dense ? 12 : compact ? 10 : 14;
  const webGrid = IS_WEB
    ? (minCard
        ? ({
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minCard}px), 1fr))`,
            gap,
          } as any)
        : ({ display: "grid", gridTemplateColumns: "repeat(" + columns + ", 1fr)", gap } as any))
    : null;
  return (
    <View style={[s.grid, { gap }, webGrid]}>
      {products.map((p, i) => (
        <ProdCard
          key={p.id}
          product={p}
          qty={qtyById[p.id] || 0}
          index={i}
          onAdd={onAdd}
          compact={compact}
          dense={dense}
        />
      ))}
    </View>
  );
}

function ProdCard({ product, qty, index, onAdd, compact = false, dense = false }: { product: GridProduct; qty: number; index: number; onAdd: Props["onAdd"]; compact?: boolean; dense?: boolean }) {
  const accent = accentForProduct(product.id);
  const letter = productLetter(product.name);
  const inCart = qty > 0;
  const addRef = useRef<any>(null);

  // ── Métricas responsivas ──────────────────────────
  const pad      = dense ? 10 : compact ? 10 : 14;
  const imgH     = dense ? 72 : compact ? 92 : 120;
  const glyphSz  = dense ? 24 : compact ? 28 : 34;
  const nameSz   = dense ? 12 : compact ? 12 : 13;
  const nameMinH = dense ? 30 : compact ? 32 : 36;
  const addSz    = dense ? 26 : compact ? 26 : 30;

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
    minWidth: 0,
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
        { padding: pad },
        IS_WEB && ({ minWidth: 0 } as any),
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

      <View style={[s.imgBox, { height: imgH }, Platform.OS === "web" ? (imgBg as any) : { backgroundColor: accent + "22", borderWidth: 1, borderColor: accent + "44" }]}>
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
          <Text style={[s.glyph, { fontSize: glyphSz }]}>{letter}</Text>
        )}
      </View>

      <Text numberOfLines={2} style={[s.name, { fontSize: nameSz, minHeight: nameMinH }]}>{product.name}</Text>
      {(product.stock != null || product.unit) && (
        <Text style={s.stock}>{stockLabel(product.stock, product.unit)}</Text>
      )}

      <View style={s.foot}>
        <Text style={s.price} numberOfLines={1}>{fmtCurrency(product.price)}</Text>
        <View ref={addRef as any} style={[s.addBtn, { width: addSz, height: addSz }, Platform.OS === "web" ? (addBtnBg as any) : { backgroundColor: inCart ? "#10b981" : Colors.violet }]}>
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
    minWidth: 150,
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
  // Frase, não etiqueta de sistema: sem monoespaçado, sem caixa alta, e no
  // ink2 pra ficar legível (o ink3 em 10px era quase invisível).
  stock: {
    fontSize: 11,
    color: Colors.ink2,
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
