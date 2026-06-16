// ============================================================
// useViewport — viewport width + breakpoints (PDV + outros)
//
// Extraído de app/(tabs)/pdv.tsx em 14/05/2026 para ser
// reutilizável por qualquer tela que precise de layout responsivo.
//
// 16/06/2026 (Davi 13-15"): layout do PDV ficava cramped/estourando em
// monitores menores — especialmente com escala 125% do Windows
// (1366×768 → ~1093px efetivos). Agora o grid de produtos é fluido
// (auto-fill, ver ProductGrid) e a sidebar do carrinho encolhe mais cedo,
// liberando largura pro catálogo. `compact` dirige a densidade dos cards
// e dos CTAs do carrinho. Meta: experiência consistente em 90%+ das
// resoluções web (1024–1440px) sem precisar dar zoom out.
// ============================================================
import { useEffect, useState } from "react";
import { Dimensions, Platform } from "react-native";

/** Expõe largura da viewport e breakpoints úteis. Web escuta resize;
 *  mobile usa Dimensions inicial. Substitui o antigo useIsWide. */
export function useViewport() {
  const initial =
    (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) || 1024;
  const [w, setW] = useState(initial);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return {
    width: w,
    wide:    w > 860,    // sidebar lateral ativa
    sm:      w < 1200,   // monitor 13-14" — layout compacto
    compact: w < 1280,   // densidade reduzida (cards + CTAs do carrinho)
    xl:      w >= 1500,  // ganha 1 coluna de produtos
    xxl:     w >= 1900,  // ganha mais 1 coluna (6 total)
  };
}

/** Número de colunas do grid de produtos baseado na viewport.
 *  Usado como fallback no nativo; na web o ProductGrid usa auto-fill
 *  (productMinCardFor) e não depende mais de uma contagem fixa. */
export function productColumnsFor(vp: { xl: boolean; xxl: boolean }) {
  if (vp.xxl) return 6;
  if (vp.xl)  return 5;
  return 4;
}

/** Largura mínima do card de produto p/ o grid fluido (auto-fill).
 *  Em telas compactas usamos um card menor pra manter 4 colunas sem
 *  estourar; em telas largas o card respira mais. */
export function productMinCardFor(vp: { compact?: boolean; xl?: boolean; xxl?: boolean }) {
  if (vp.xxl)     return 186;
  if (vp.xl)      return 176;
  if (vp.compact) return 150;
  return 168;
}

/** Largura da sidebar CartPanel baseado na viewport. Encolhe mais cedo
 *  em telas pequenas pra devolver largura ao catálogo de produtos. */
export function cartWidthFor(vp: { sm?: boolean; compact?: boolean; xl: boolean; xxl: boolean }) {
  if (vp.xxl)     return 460;
  if (vp.xl)      return 420;
  if (vp.sm)      return 320;
  if (vp.compact) return 352;
  return 384;
}
