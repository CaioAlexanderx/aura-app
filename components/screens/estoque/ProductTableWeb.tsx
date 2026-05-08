// ============================================================
// ProductTableWeb — tabela densa de produtos (Premium v2).
// Web-only. Renderiza colunas: Produto, Código/variante, Categoria,
// Estoque com barra, Preço, Margem, Ações no hover.
// Reaproveita os mesmos handlers que ProductRow (onEdit, onDelete,
// onLink, onSelect) — paridade total de funcionalidade.
// ============================================================
import { Platform } from "react-native";
import { useColors, useThemeStore } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import type { Product } from "@/components/screens/estoque/types";

const fmtBRL = (n: number) =>
  "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");

type Props = {
  items: Product[];
  onEdit?: (p: Product) => void;
  onDelete?: (id: string) => void;
  onLink?: (p: Product) => void;
  bulkMode: boolean;
  bulkSelected: Set<string>;
  onSelect: (id: string) => void;
  canLink: boolean;
};

export function ProductTableWeb({ items, onEdit, onDelete, onLink, bulkMode, bulkSelected, onSelect, canLink }: Props) {
  const C = useColors();
  const { isDark } = useThemeStore();
  if (Platform.OS !== "web") return null;

  const accent = C.violet;
  const surface = isDark ? "rgba(20,14,38,0.55)" : "rgba(255,255,255,0.70)";
  const surfaceSolid = isDark ? "#0e0820" : "#ffffff";
  const border = isDark ? "rgba(120,100,240,0.18)" : "rgba(109,40,217,0.10)";
  const rowHover = isDark ? "rgba(120,100,240,0.06)" : "rgba(124,58,237,0.04)";

  const Th = ({ children, w, align = "left" }: { children: any; w?: number; align?: any }) => (
    <th style={{
      padding: "12px 14px", textAlign: align as any, width: w,
      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
      color: C.ink3, borderBottom: "1px solid " + border,
      background: isDark ? "rgba(10,6,24,0.85)" : "rgba(255,255,255,0.85)",
      backdropFilter: "blur(20px)",
    } as any}>{children}</th>
  );

  if (items.length === 0) {
    return (
      <div style={{
        background: surface, border: "1px solid " + border, borderRadius: 18,
        padding: 40, textAlign: "center", color: C.ink3, fontSize: 13,
        backdropFilter: "blur(20px)",
      } as any}>Nenhum produto encontrado</div>
    );
  }

  return (
    <div style={{
      background: surface, border: "1px solid " + border, borderRadius: 18,
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", overflow: "hidden",
      ["--aura-est-row-hover" as any]: rowHover,
    } as any}>
      <table style={{ width: "100%", borderCollapse: "collapse" } as any}>
        <thead>
          <tr>
            {bulkMode && <Th w={36}>{" "}</Th>}
            <Th>Produto</Th>
            <Th w={150}>Código / variante</Th>
            <Th w={160}>Categoria</Th>
            <Th w={130} align="right">Estoque</Th>
            <Th w={120} align="right">Preço</Th>
            <Th w={100} align="right">Margem</Th>
            <Th w={120} align="right">{" "}</Th>
          </tr>
        </thead>
        <tbody>
          {items.map(p => {
            const price = (p as any).price || 0;
            const cost = p.cost || 0;
            const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
            const low = p.stock <= p.minStock && p.unit !== "srv";
            const sku = (p as any).sku || p.code || (p as any).barcode || "—";
            const variant = [p.color, p.size].filter(Boolean).join(" · ") || p.unit || "—";
            const isSelected = bulkSelected.has(p.id);
            return (
              <tr key={p.id} className="aura-est-row" style={{
                borderBottom: "1px solid " + border,
                background: isSelected ? accent + "12" : "transparent",
              } as any}>
                {bulkMode && (
                  <td style={{ padding: "14px 14px" } as any}>
                    <input type="checkbox" checked={isSelected} onChange={() => onSelect(p.id)}
                      style={{ accentColor: accent, cursor: "pointer" } as any} />
                  </td>
                )}
                <td style={{ padding: "14px 14px", cursor: onEdit ? "pointer" : "default" } as any}
                  onClick={() => { if (!bulkMode && onEdit) onEdit(p); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 } as any}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                      background: p.image_url
                        ? "url(" + p.image_url + ") center/cover"
                        : "linear-gradient(135deg, " + accent + "55 0%, " + accent + "22 100%)",
                      boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.08), 0 2px 6px rgba(20,10,40,0.10)",
                      position: "relative",
                    } as any}>
                      {p.has_variants && (
                        <span style={{
                          position: "absolute", bottom: -3, right: -4, padding: "2px 5px", borderRadius: 5,
                          background: surfaceSolid, color: C.ink2,
                          fontSize: 8, fontWeight: 700, letterSpacing: "0.04em",
                          boxShadow: "0 1px 3px rgba(20,10,40,0.18)",
                          border: "1px solid " + border,
                        } as any}>VAR</span>
                      )}
                    </div>
                    <div style={{ minWidth: 0 } as any}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 7,
                        fontSize: 14, fontWeight: 600, color: C.ink, lineHeight: 1.2,
                      } as any}>
                        <span>{p.name}</span>
                        {low && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, color: isDark ? "#fbbf24" : "#b45309",
                            padding: "2px 6px", borderRadius: 5,
                            background: isDark ? "rgba(251,191,36,0.14)" : "rgba(251,191,36,0.18)",
                            letterSpacing: "0.06em", textTransform: "uppercase",
                          } as any}>baixo</span>
                        )}
                      </div>
                      {p.brand && (
                        <div style={{ fontSize: 11, color: C.ink3, marginTop: 2 } as any}>{p.brand}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{
                  padding: "14px 14px", fontFamily: Fonts.mono,
                  fontSize: 12, color: C.ink2, fontWeight: 500,
                } as any}>
                  {sku}<span style={{ color: C.ink3 } as any}> · {variant}</span>
                </td>
                <td style={{ padding: "14px 14px", fontSize: 13, color: C.ink2 } as any}>
                  {p.category && (
                    <span style={{
                      padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                      background: isDark ? "rgba(120,100,240,0.10)" : "rgba(124,58,237,0.06)",
                      color: C.ink2, border: "1px solid " + border,
                    } as any}>{p.category}</span>
                  )}
                </td>
                <td style={{ padding: "14px 14px", textAlign: "right" } as any}>
                  <span style={{
                    fontFamily: Fonts.mono, fontSize: 14, fontWeight: 600,
                    color: low ? (isDark ? "#f87171" : "#dc2626") : C.ink,
                    fontVariantNumeric: "tabular-nums",
                  } as any}>{fmtInt(p.stock)}<span style={{ fontSize: 11, opacity: 0.7, marginLeft: 2 } as any}>{p.unit || "un"}</span></span>
                  {p.unit !== "srv" && (
                    <div style={{ marginTop: 5, height: 3, borderRadius: 3, background: border, overflow: "hidden" } as any}>
                      <div style={{
                        width: Math.min(100, (p.stock / Math.max(p.minStock * 4, 50)) * 100) + "%",
                        height: "100%",
                        background: low ? (isDark ? "#f87171" : "#dc2626") : accent,
                        transition: "width 0.6s ease",
                      } as any} />
                    </div>
                  )}
                </td>
                <td style={{
                  padding: "14px 14px", textAlign: "right",
                  fontFamily: Fonts.mono, fontSize: 13, fontWeight: 500, color: C.ink,
                  fontVariantNumeric: "tabular-nums",
                } as any}>{fmtBRL(price)}</td>
                <td style={{
                  padding: "14px 14px", textAlign: "right",
                  fontFamily: Fonts.mono, fontSize: 12,
                  color: margin >= 30 ? (isDark ? "#34d399" : "#059669") : margin >= 10 ? "#fbbf24" : (isDark ? "#f87171" : "#dc2626"),
                  fontWeight: 600, fontVariantNumeric: "tabular-nums",
                } as any}>{margin > 0 ? margin.toFixed(0) + "%" : "—"}</td>
                <td style={{ padding: "14px 14px", textAlign: "right" } as any}>
                  <div className="aura-est-row-actions" style={{
                    display: "flex", justifyContent: "flex-end", gap: 4, opacity: 0,
                    transition: "opacity 0.2s",
                  } as any}>
                    {!bulkMode && onEdit && (
                      <button onClick={(e: any) => { e.stopPropagation(); onEdit(p); }} className="aura-est-pressable" style={{
                        width: 30, height: 30, borderRadius: 8, border: "1px solid " + border,
                        background: surfaceSolid, color: C.ink2, display: "grid", placeItems: "center", cursor: "pointer",
                      } as any} title="Editar"><Icon name="edit" size={13} color={C.ink2} /></button>
                    )}
                    {!bulkMode && canLink && onLink && (
                      <button onClick={(e: any) => { e.stopPropagation(); onLink(p); }} className="aura-est-pressable" style={{
                        width: 30, height: 30, borderRadius: 8, border: "1px solid " + border,
                        background: surfaceSolid, color: C.ink2, display: "grid", placeItems: "center", cursor: "pointer",
                      } as any} title="Vincular CNPJ"><Icon name="globe" size={13} color={C.ink2} /></button>
                    )}
                    {!bulkMode && onDelete && (
                      <button onClick={(e: any) => { e.stopPropagation(); onDelete(p.id); }} className="aura-est-pressable" style={{
                        width: 30, height: 30, borderRadius: 8, border: "1px solid " + border,
                        background: surfaceSolid, color: isDark ? "#f87171" : "#dc2626",
                        display: "grid", placeItems: "center", cursor: "pointer",
                      } as any} title="Excluir"><Icon name="trash" size={13} color={isDark ? "#f87171" : "#dc2626"} /></button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
