// ============================================================
// usePrefersReducedMotion — Aura Karatê · anim
//
// Hook Shoji para checar `prefers-reduced-motion` no web (mesmo critério
// já usado em KarateLoginTransition.tsx, promovido aqui para reuso pelos
// polishes de motion da federação — ver RedistribuirPraticantesModal e
// o detalhe do dojô). Nativo sempre retorna false (RN não expõe a media
// query; motion nativo já é mais comedido por padrão).
// ============================================================
import { useEffect, useState } from "react";
import { Platform } from "react-native";

const IS_WEB = Platform.OS === "web";

function readPrefersReducedMotion(): boolean {
  if (!IS_WEB || typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readPrefersReducedMotion);

  useEffect(() => {
    if (!IS_WEB || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return reduced;
}

export default usePrefersReducedMotion;
