// ============================================================
// AURA. — Rolar até a seção pedida no link (p-105, 11/11/2026)
//
// /black-friday#assento (ou ?secao=assento, que sobrevive ao login) cai
// direto no cartão do assento. Depois que a página monta, lê a seção da
// barra de endereço e rola até o elemento com esse id (o `nativeID` do
// SecaoCard vira id na web). As seções aparecem depois que os dados chegam,
// então tenta por alguns instantes; achou, rola uma vez e para.
// Só web: no nativo não há "#" nem barra de endereço.
// ============================================================
import { useEffect } from "react";
import { Platform } from "react-native";
import { secaoDaBarraDeEndereco } from "@/utils/linkDoAssento";

export const TENTATIVAS_DE_ROLAR = 30;
export const INTERVALO_DE_ROLAR_MS = 100;

function reduzirMovimento(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function useRolarAteASecao(ativo: boolean): void {
  useEffect(() => {
    if (!ativo || Platform.OS !== "web" || typeof document === "undefined") return;
    let encerrado = false;
    let tentativas = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function tentar() {
      if (encerrado) return;
      const secao = secaoDaBarraDeEndereco();
      const el = secao ? document.getElementById(secao) : null;
      if (el && typeof el.scrollIntoView === "function") {
        encerrado = true;
        el.scrollIntoView({ behavior: reduzirMovimento() ? "auto" : "smooth", block: "start" });
        return;
      }
      tentativas += 1;
      if (tentativas < TENTATIVAS_DE_ROLAR) timer = setTimeout(tentar, INTERVALO_DE_ROLAR_MS);
    }

    tentar();
    return () => {
      encerrado = true;
      if (timer) clearTimeout(timer);
    };
  }, [ativo]);
}
