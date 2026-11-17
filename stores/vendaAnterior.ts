// ============================================================
// Faixa da venda anterior (17/11/2026, p-147): a lista de faixas e o estado
// do cupom de cada venda. Fora da tela do Caixa de propósito: sair para
// outra página e voltar não esconde uma nota recusada. Cada faixa guarda a
// loja; o Caixa mostra só as da loja escolhida (multi-CNPJ).
// Regras em utils/faixaDaVendaAnterior.
// ============================================================
import { create } from "zustand";
import { chaveDaNotaDaVenda, estadoDaNota } from "@/services/emissaoDaNfce";
import {
  comAVendaQueSaiu, depoisDaVendaSeguinte, notaPrendeAFaixa, type VendaNaFaixa,
} from "@/utils/faixaDaVendaAnterior";

export type CupomDaFaixa = "imprimir" | "imprimindo" | "impresso";

type Estado = {
  faixas: VendaNaFaixa[];
  /** Cupom por venda. Sem entrada = "imprimir". */
  cupom: Record<string, CupomDaFaixa>;
};

export const useVendaAnterior = create<Estado>(() => ({ faixas: [], cupom: {} }));

/** A nota desta venda segura a faixa? (lido na hora, do estado da emissão) */
export function notaPrende(saleId: string): boolean {
  return notaPrendeAFaixa(estadoDaNota(chaveDaNotaDaVenda(saleId)));
}

/** A tela final saiu: a venda vai para a faixa. */
export function guardarVendaAnterior(v: VendaNaFaixa) {
  useVendaAnterior.setState(s => ({ faixas: comAVendaQueSaiu(s.faixas, v, notaPrende) }));
}

/** Uma venda nova foi registrada: as faixas que a nota não prende saem. */
export function aoRegistrarVenda() {
  useVendaAnterior.setState(s => ({ faixas: depoisDaVendaSeguinte(s.faixas, notaPrende) }));
}

/** O × da faixa. */
export function dispensarVendaAnterior(saleId: string) {
  useVendaAnterior.setState(s => ({ faixas: s.faixas.filter(f => f.saleId !== saleId) }));
}

/** O cupom da venda: a tela final e a faixa contam o que aconteceu. */
export function marcarCupom(saleId: string, estado: CupomDaFaixa) {
  useVendaAnterior.setState(s => ({ cupom: { ...s.cupom, [saleId]: estado } }));
}

export function cupomDaVenda(saleId: string): CupomDaFaixa {
  return useVendaAnterior.getState().cupom[saleId] || "imprimir";
}

/** Só para testes. */
export function __zerarFaixasParaTestes() {
  useVendaAnterior.setState({ faixas: [], cupom: {} });
}
