// ============================================================
// ProductGridWeb — visualização em grade (Premium v2). Web-only.
// Cards 200px com thumbnail, variante, preço, estoque. Click =
// editar (ou selecionar quando bulk). Reaproveita os mesmos
// handlers do ProductRow.
//
// 08/05/2026 — adicionadas ações inline (edit/link/delete) com
// hover-reveal no canto inferior direito do card. Paridade com
// ProductTableWeb. CSS .aura-est-card-actions vive em
// useEstoquePremiumStyles.
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

export function ProductGridWeb({ items, onEdit, onDelete, onLink, bulkMode, bulkSelected, onSelect, canLink }: Props) {
  const C = useColors();
  const { isDark } = useThemeStore();
  if (Platform.OS !== "web") return null;

  const accent = C.violet;
  const surface = isDark ? "rgba(20,14,38,0.55)" : "rgba(255,255,255,0.70)";
  const border = isDark ? "rgba(120,100,240,0.18)" : "rgba(109,40,217,0.10)";

  // Botão de ação inline. backdrop-filter + bg semitransparente pra ler em
  // cima de qualquer thumbnail. stopPropagation pra click não abrir editor.
  const ActionBtn = ({ icon, danger, onClick, title }: {
    icon: string; danger?: boolean; onClick: () => void; title: string;
  }) => (
    <button
      onClick={(e: any) => { e.stopPropagation(); onClick(); }}
      title={title}
      className="aura-est-pressable"
      style={{
        width: 30, height: 30, borderRadius: 8,
        border: "1px solid " + (isDark ? "rgba(255,255,255,0.18)" : "rgba(109,40,217,0.20)"),
        background: isDark ? "rgba(10,6,24,0.78)" : "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: danger ? (isDark ? "#f87171" : "#dc2626") : (isDark ? "#f0edff" : "#1a1a2e"),
        display: "grid", placeItems: "center",
        cursor: "pointer", padding: 0,
        boxShadow: "0 2px 6px rgba(20,10,40,0.18)",
      } as any}
    >
      <Icon name={icon as any} size={13} color={danger ? (isDark ? "#f87171" : "#dc2626") : (isDark ? "#f0edff" : "#1a1a2e")} />
    </button>
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
      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14,
    } as any}>
      {items.map(p => {
        const price = (p as any).price || 0;
        const low = p.stock <= p.minStock && p.unit !== "srv";
        const sku = (p as any).sku || p.code || "—";
        const isSelected = bulkSelected.has(p.id);
        const variant = [p.color, p.size].filter(Boolean).join(" · ") || p.unit;
        return (
          <div key={p.id}
            onClick={() => { if (bulkMode) onSelect(p.id); else if (onEdit) onEdit(p); }}
            className="aura-est-card aura-est-pressable aura-est-lift"
            style={{
              background: surface,
              border: "1px solid " + (isSelected ? accent : border),
              borderRadius: 16, padding: 10,
              backdropFilter: "blur(20px)",
              cursor: "pointer",
              boxShadow: isSelected ? "0 0 0 2px " + accent + "44" : "none",
            } as any}>
            <div style={{
              width: "100%", aspectRatio: "1",
              borderRadius: 12,
              background: p.image_url
                ? "url(" + p.image_url + ") center/cover"
                : "linear-gradient(135deg, " + accent + "55 0%, " + accent + "22 100%)",
              position: "relative", marginBottom: 10,
              boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.08)",
            } as any}>
              {variant ? (
                <span style={{
                  position: "absolute", top: 8, right: 8, padding: "3px 7px", borderRadius: 7,
                  background: isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(10px)",
                  color: isDark ? "#f0edff" : "#1a1a2e",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                } as any}>{variant}</span>
              ) : null}
              {low ? (
                <span style={{
                  position: "absolute", top: 8, left: 8, padding: "2px 6px", borderRadius: 5,
                  background: "#fbbf24", color: "#5b3a00",
                  fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                } as any}>baixo</span>
              ) : null}
              {bulkMode ? (
                <span style={{
                  position: "absolute", bottom: 8, left: 8,
                  width: 22, height: 22, borderRadius: 6,
                  border: "1.5px solid " + (isSelected ? accent : "rgba(255,255,255,0.6)"),
                  background: isSelected ? accent : "rgba(0,0,0,0.4)",
                  display: "grid", placeItems: "center",
                } as any}>
                  {isSelected ? <Icon name="check" size={12} color="#fff" /> : null}
                </span>
              ) : null}
              {/* Ações inline (hover-reveal) — só quando NÃO está em bulk mode */}
              {!bulkMode ? (
                <div className="aura-est-card-actions" style={{
                  position: "absolute", bottom: 8, right: 8,
                  display: "flex", gap: 4,
                } as any}>
                  {onEdit ? <ActionBtn icon="edit" onClick={() => onEdit(p)} title="Editar" /> : null}
                  {canLink && onLink ? <ActionBtn icon="globe" onClick={() => onLink(p)} title="Vincular CNPJ" /> : null}
                  {onDelete ? <ActionBtn icon="trash" danger onClick={() => onDelete(p.id)} title="Excluir" /> : null}
                </div>
              ) : null}
            </div>
            <div style={{ padding: "2px 4px 4px" } as any}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.25,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              } as any}>{p.name}</div>
              <div style={{ fontSize: 10.5, color: C.ink3, fontFamily: Fonts.mono, marginTop: 2 } as any}>{sku}</div>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8,
              } as any}>
                <span style={{ fontSize: 13, color: C.ink2, fontFamily: Fonts.mono, fontWeight: 600 } as any}>
                  {fmtBRL(price)}
                </span>
                <span style={{
                  fontSize: 12, fontFamily: Fonts.mono, fontWeight: 600,
                  color: low ? (isDark ? "#f87171" : "#dc2626") : C.ink3,
                } as any}>{fmtInt(p.stock)}{p.unit || "un"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
