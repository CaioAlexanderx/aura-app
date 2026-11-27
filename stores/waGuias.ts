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
  /** Passo em que retomar ao abrir o próximo guia (guia 3 pendente: nenhuma conversa aberta). */
  retomarEm: string | null;
  /** O guia 3 parou por falta de conversa aberta e continua quando a primeira abrir. */
  g3Pendente: boolean;
  carregar: (userId: string | null | undefined) => void;
  marcar: (k: ChaveVisto) => void;
  abrirMenu: () => void;
  abrirGuia: (n: 1 | 2 | 3, retomarEm?: string | null) => void;
  marcarG3Pendente: (v: boolean) => void;
  fechar: () => void;
  sinalizarProdutoEnviado: () => void;
}

export const useWaGuias = create<WaGuiasState>((set, get) => ({
  aberto: null,
  userId: null,
  vistos: {},
  produtosEnviados: 0,
  retomarEm: null,
  g3Pendente: false,
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
  abrirGuia: (n, retomarEm = null) => set({ aberto: n, retomarEm }),
  marcarG3Pendente: (v) => set({ g3Pendente: v }),
  fechar: () => set({ aberto: null }),
  sinalizarProdutoEnviado: () => set((s) => ({ produtosEnviados: s.produtosEnviados + 1 })),
}));
