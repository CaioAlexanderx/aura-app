import { create } from "zustand";
import { gravarVistos, lerVistos, type ChaveVisto, type Vistos } from "@/utils/waGuiasVistos";

// ============================================================
// Guias do WhatsApp (27/11/2026) — o que está aberto agora e o que cada
// pessoa já viu. Um store só porque quem abre (o botão Guias, o anúncio do
// Painel, o balão que encadeia o guia 2 depois do 1) e quem mostra (o host
// da tela do WhatsApp) não se enxergam na árvore.
// ============================================================

export type GuiaAberto = null | "menu" | 1 | 2 | 3;

interface WaGuiasState {
  aberto: GuiaAberto;
  userId: string | null;
  vistos: Vistos;
  /** Sobe a cada produto mandado numa conversa (o guia 3 espera por ele). */
  produtosEnviados: number;
  carregar: (userId: string | null | undefined) => void;
  marcar: (k: ChaveVisto) => void;
  abrirMenu: () => void;
  abrirGuia: (n: 1 | 2 | 3) => void;
  fechar: () => void;
  sinalizarProdutoEnviado: () => void;
}

export const useWaGuias = create<WaGuiasState>((set, get) => ({
  aberto: null,
  userId: null,
  vistos: {},
  produtosEnviados: 0,
  carregar: (userId) => {
    const id = userId || null;
    if (get().userId === id) return;
    set({ userId: id, vistos: lerVistos(id) });
  },
  marcar: (k) => {
    const { userId, vistos } = get();
    const prox = { ...vistos, [k]: Date.now() };
    gravarVistos(userId, prox);
    set({ vistos: prox });
  },
  abrirMenu: () => set({ aberto: "menu" }),
  abrirGuia: (n) => set({ aberto: n }),
  fechar: () => set({ aberto: null }),
  sinalizarProdutoEnviado: () => set((s) => ({ produtosEnviados: s.produtosEnviados + 1 })),
}));
