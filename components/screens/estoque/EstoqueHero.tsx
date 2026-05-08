// ============================================================
// EstoqueHero — bloco de cabeçalho web do Estoque (Premium v2)
// 64px serif "Estoque." + breadcrumb com glyph + métricas inline.
// Web-only (Platform.OS === "web"). Native: nada renderiza (caller
// usa o pageTitle antigo).
// ============================================================
import { Platform } from "react-native";
import { useColors, useThemeStore } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";

const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");

type Props = {
  totalProducts: number;
  totalUnits: number;
  lowCount: number;
};

export function EstoqueHero({ totalProducts, totalUnits, lowCount }: Props) {
  const C = useColors();
  const { isDark } = useThemeStore();
  if (Platform.OS !== "web") return null;

  const accent = C.violet;
  return (
    <div className="aura-est-rise" style={{ padding: "16px 4px 18px" } as any}>
      {/* Breadcrumb com Aura glyph */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
        fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
        color: C.ink3,
      } as any}>
        <svg width={14} height={14} viewBox="0 0 24 24" style={{ display: "inline-block" } as any}>
          <defs>
            <radialGradient id="auraEstHeroGlyph" cx="50%" cy="50%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.85" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="12" cy="12" r="10" fill="none" stroke={accent} strokeOpacity="0.3"
            style={{ transformOrigin: "12px 12px", animation: "auraEstRingExpand 2.4s ease-out infinite" } as any} />
          <circle cx="12" cy="12" r="10" fill="url(#auraEstHeroGlyph)" />
          <circle cx="12" cy="12" r="3.2" fill={accent} />
        </svg>
        <span>Aura<span style={{ color: accent } as any}>.</span> · Painel da loja</span>
        <span style={{
          padding: "3px 8px", borderRadius: 999,
          background: accent + "14", color: accent,
          fontSize: 10, letterSpacing: "0.08em",
        } as any}>ao vivo</span>
      </div>
      {/* Big serif title */}
      <div style={{
        fontFamily: Fonts.heading, fontSize: 64, lineHeight: 0.95,
        color: C.ink, letterSpacing: "-0.025em", fontWeight: 400,
      } as any}>
        Estoque<span style={{ color: accent } as any}>.</span>
      </div>
      {/* Subtitle com métricas */}
      <div style={{ fontSize: 14, color: C.ink3, marginTop: 10, maxWidth: 640 } as any}>
        {fmtInt(totalProducts)} produtos cadastrados · {fmtInt(totalUnits)} unidades em prateleira ·
        <span style={{
          color: lowCount > 0 ? (isDark ? "#fbbf24" : "#b45309") : (isDark ? "#34d399" : "#059669"),
          fontWeight: 600,
        } as any}>
          {" " + (lowCount > 0 ? lowCount + " alerta" + (lowCount > 1 ? "s" : "") + " de estoque baixo" : "tudo em ordem")}
        </span>
      </div>
    </div>
  );
}
