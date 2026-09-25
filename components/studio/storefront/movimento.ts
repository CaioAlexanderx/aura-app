// ============================================================
// Vitrine Studio · "reduzir movimento"
//
// Quem ligou "reduzir movimento" no aparelho pediu para a tela não pulsar
// nem deslizar à toa — o esqueleto da vitrine pulsava em loop mesmo assim
// (D10 da jornada). No web é a media query prefers-reduced-motion; no
// nativo, a preferência de acessibilidade do sistema. Os dois mudam com
// o app aberto, então o hook escuta.
// ============================================================
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

const CONSULTA = "(prefers-reduced-motion: reduce)";

function lerNoWeb(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia(CONSULTA).matches;
  } catch {
    return false;
  }
}

export function useReduzirMovimento(): boolean {
  const [reduzir, setReduzir] = useState<boolean>(() => (Platform.OS === "web" ? lerNoWeb() : false));

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      let mq: MediaQueryList;
      try { mq = window.matchMedia(CONSULTA); } catch { return; }
      const mudou = () => setReduzir(mq.matches);
      mudou();
      if (mq.addEventListener) mq.addEventListener("change", mudou);
      else if ((mq as any).addListener) (mq as any).addListener(mudou);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener("change", mudou);
        else if ((mq as any).removeListener) (mq as any).removeListener(mudou);
      };
    }
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (vivo) setReduzir(!!v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v: boolean) => setReduzir(!!v));
    return () => { vivo = false; sub?.remove?.(); };
  }, []);

  return reduzir;
}
