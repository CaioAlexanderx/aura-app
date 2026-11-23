// ============================================================
// Anel de foco da ficha do crediário (QA 23/11/2026, P2)
//
// O QA achou o anel padrão do navegador (azul/preto) nos campos e botões da
// ficha. O app usa o violeta (mesmo do Painel: app/(tabs)/index.tsx). Um
// <style> só, injetado uma vez, vale para tudo o que estiver dentro de um
// contêiner marcado com dataSet={{ fichaCrediario: "1" }} — a tela cheia, a
// página do celular e a janela.
// ============================================================
import { useEffect } from "react";
import { Platform } from "react-native";
import { IS_DARK_MODE } from "@/constants/colors";

export const MARCA_DA_FICHA = { fichaCrediario: "1" } as const;
export const ID_DO_ESTILO = "aura-ficha-crediario-foco";

export function cssDoAnelDeFoco(dark: boolean): string {
  const cor = dark ? "#a78bfa" : "#7c3aed";
  return [
    `[data-ficha-crediario] :focus { outline: none; }`,
    `[data-ficha-crediario] :focus-visible { outline: 2px solid ${cor}; outline-offset: 2px; }`,
    `[data-ficha-crediario] input:focus-visible, [data-ficha-crediario] textarea:focus-visible { outline: 2px solid ${cor}; outline-offset: 1px; }`,
  ].join("\n");
}

export function useAnelDeFocoDaFicha(ativo: boolean) {
  useEffect(() => {
    if (!ativo || Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById(ID_DO_ESTILO)) return;
    const el = document.createElement("style");
    el.id = ID_DO_ESTILO;
    el.textContent = cssDoAnelDeFoco(IS_DARK_MODE);
    document.head.appendChild(el);
  }, [ativo]);
}
