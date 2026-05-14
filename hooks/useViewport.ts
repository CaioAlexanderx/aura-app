// ============================================================
// useViewport — viewport width + breakpoints (PDV + outros)
//
// Extraído de app/(tabs)/pdv.tsx em 14/05/2026 para ser
// reutilizável por qualquer tela que precise de layout responsivo.
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
    wide: w > 860,    // sidebar lateral ativa
    sm:   w < 1200,   // monitor 14" — layout compacto
    xl:   w >= 1500,  // ganha 1 coluna de produtos
    xxl:  w >= 1900,  // ganha mais 1 coluna (6 total)
  };
}

/** Número de colunas do grid de produtos baseado na viewport. */
export function productColumnsFor(vp: { xl: boolean; xxl: boolean }) {
  if (vp.xxl) return 6;
  if (vp.xl)  return 5;
  return 4;
}

/** Largura da sidebar CartPanel baseado na viewport. */
export function cartWidthFor(vp: { sm?: boolean; xl: boolean; xxl: boolean }) {
  if (vp.xxl) return 480;
  if (vp.xl)  return 440;
  if (vp.sm)  return 340;
  return 400;
}
