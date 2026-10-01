// ============================================================
// AURA. — Rascunho da garantia no PDV
//
// A garantia é escolhida ANTES de fechar a venda (caixa acima das
// modalidades de pagamento) e emitida logo DEPOIS do POST /pdv/sale, quando
// já existe sale_id. Este store faz a ponte entre as duas pontas sem mexer
// no useCart: o PDV escreve aqui, a tela de sucesso (WarrantySaleActions)
// lê, emite e limpa.
//
// days é indexado pela CHAVE DO CARRINHO (productId ou productId__variantId).
// ============================================================
import { create } from "zustand";

type State = {
  on: boolean;
  modalOpen: boolean;
  days: Record<string, number>;
  setOn: (v: boolean) => void;
  openModal: () => void;
  closeModal: () => void;
  setDays: (key: string, days: number | null) => void;
  replaceAll: (days: Record<string, number>) => void;
  reset: () => void;
};

export const useWarrantyDraft = create<State>((set) => ({
  on: false,
  modalOpen: false,
  days: {},
  setOn: (v) => set({ on: v }),
  openModal: () => set({ modalOpen: true }),
  closeModal: () => set({ modalOpen: false }),
  setDays: (key, days) =>
    set((s) => {
      const next = { ...s.days };
      if (days == null || days <= 0) delete next[key];
      else next[key] = Math.round(days);
      return { days: next };
    }),
  replaceAll: (days) => set({ days }),
  reset: () => set({ on: false, modalOpen: false, days: {} }),
}));

/** Só o que ainda está no carrinho conta (item removido não deixa garantia fantasma). */
export function diasValidos(days: Record<string, number>, cartKeys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of cartKeys) if (days[k] > 0) out[k] = days[k];
  return out;
}
