import { create } from "zustand";
import { ocultarMoeda, lerPreferencia, gravarPreferencia } from "@/utils/valoresOcultos";

// ============================================================
// Valores ocultos — o "olho" do Painel, Crediário e Estoque.
//
// Um estado só para as três telas: quem esconde os valores no Painel
// (ex.: com cliente olhando a tela) espera que continuem escondidos ao
// abrir o Crediário. Lembrado por aparelho (localStorage no web).
//
// Componente que exibe dinheiro usa useValoresOcultos() e passa o texto
// por `m()`: assinar o estado é o que faz a tela redesenhar no clique.
// ============================================================

type ValoresOcultosState = {
  ocultos: boolean;
  alternar: () => void;
};

export const useValoresOcultosStore = create<ValoresOcultosState>((set, get) => ({
  ocultos: lerPreferencia(),
  alternar: () => {
    const proximo = !get().ocultos;
    gravarPreferencia(proximo);
    set({ ocultos: proximo });
  },
}));

export function useValoresOcultos() {
  const ocultos = useValoresOcultosStore((s) => s.ocultos);
  const alternar = useValoresOcultosStore((s) => s.alternar);
  return {
    ocultos,
    alternar,
    m: (texto: string) => ocultarMoeda(texto, ocultos),
  };
}
