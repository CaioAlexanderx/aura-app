// ============================================================
// useTemTeclado (17/11/2026, p-155 / A3): o aparelho tem mouse e teclado?
//
// As etiquetas de tecla, o botão "Atalhos", a dica da busca e o "Enter
// adiciona" só aparecem com `(hover: hover) and (pointer: fine)`. No toque
// (celular, tablet) some tudo. "Apertou uma tecla" não serve de sinal: o
// leitor Bluetooth num tablet é um teclado (mapa de 17/11, 1.5).
// Sem matchMedia (app nativo, navegador muito antigo): não mostra nada.
// ============================================================
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { sistemaDoTeclado, type SistemaDoTeclado } from "@/utils/atalhosDoCaixa";

export const CONSULTA_DO_TECLADO = "(hover: hover) and (pointer: fine)";

function consulta(): MediaQueryList | null {
  try {
    if (Platform.OS !== "web" || typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
    return window.matchMedia(CONSULTA_DO_TECLADO);
  } catch { return null; }
}

/** Lido na hora (sem React). */
export function temTecladoNoAparelho(): boolean {
  const mq = consulta();
  return !!mq && !!mq.matches;
}

export function useTemTeclado(): boolean {
  const [tem, setTem] = useState(temTecladoNoAparelho);
  useEffect(() => {
    const mq = consulta();
    if (!mq) return;
    const aoMudar = () => setTem(!!mq.matches);
    aoMudar();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", aoMudar);
      return () => mq.removeEventListener("change", aoMudar);
    }
    if (typeof (mq as any).addListener === "function") {
      (mq as any).addListener(aoMudar);
      return () => (mq as any).removeListener(aoMudar);
    }
  }, []);
  return tem;
}

/** Windows (Ctrl/Alt e a tecla F) ou Mac (⌘/⌥), uma vez por aparelho. */
let sistemaGuardado: SistemaDoTeclado | null = null;
export function useSistemaDoTeclado(): SistemaDoTeclado {
  if (!sistemaGuardado) sistemaGuardado = sistemaDoTeclado();
  return sistemaGuardado;
}

/** Só para testes. */
export function __esquecerSistemaDoTeclado() { sistemaGuardado = null; }

export default useTemTeclado;
