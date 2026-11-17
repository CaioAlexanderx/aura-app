// ============================================================
// Faixa da venda anterior (17/11/2026, p-147 / R3b) — regras sem tela.
//
// Quando a tela de venda concluída sai (Enter, Esc, F9, "Nova venda" ou o
// bipe do próximo produto), o que sobrou da venda (cupom e nota fiscal) vai
// para uma faixa no topo do catálogo. Mockup aprovado "Caixa e Troca",
// Parte 2, decisões 10 a 12.
//
//   - A faixa some na venda seguinte (entra a dela) ou no ×.
//   - A nota recusada não some e não tem ×: fica, vermelha, até alguém
//     tocar em "Ver o motivo". Nem a venda seguinte tira.
//   - A nota ainda sendo enviada também segura a faixa na venda seguinte:
//     ela pode ser recusada depois, e a recusa não pode ficar escondida.
//     Autorizada, essa faixa antiga some sozinha.
// ============================================================
import type { EstadoDaNota } from "@/services/emissaoDaNfce";

export type NotaNaFaixa = "nenhuma" | "enviando" | "autorizada" | "recusada" | "processando";

export type VendaNaFaixa = {
  companyId: string;
  saleId: string;
  /** "#1048" (número da venda) ou "#ABCD1234" (sem número). */
  rotulo: string;
  total: number;
  /** Quando a venda foi registrada (o vale-troca do cupom vale por ela). */
  vendaEm: number;
};

/** O que a faixa diz da nota, a partir do estado da emissão. */
export function notaNaFaixa(e: EstadoDaNota): NotaNaFaixa {
  if (e.fase === "emitting") return "enviando";
  if (e.fase === "rejected" || e.fase === "error") return "recusada";
  if (e.fase === "authorized") {
    if (e.resultado?.nfce?.status === "processando") return e.esgotou ? "processando" : "enviando";
    return "autorizada";
  }
  return "nenhuma";
}

/** A nota obriga a faixa a ficar (mesmo depois da venda seguinte)? */
export function notaPrendeAFaixa(e: EstadoDaNota): boolean {
  const n = notaNaFaixa(e);
  if (n === "enviando") return true;
  if (n === "recusada") return !e.motivoVisto;
  return false;
}

/** O × aparece? Recusa ainda não vista: não. */
export function podeDispensar(e: EstadoDaNota): boolean {
  return !(notaNaFaixa(e) === "recusada" && !e.motivoVisto);
}

/** O rótulo da venda, como o lojista dita no balcão. */
export function rotuloDaVenda(sale: { id: string; saleNumber?: number | null }): string {
  if (typeof sale.saleNumber === "number" && sale.saleNumber > 0) return "#" + sale.saleNumber;
  return "#" + String(sale.id || "").slice(0, 8).toUpperCase();
}

/**
 * A lista depois que a tela final saiu: a venda que acabou fica na frente;
 * das antigas, só as que a nota ainda prende.
 */
export function comAVendaQueSaiu(
  lista: VendaNaFaixa[], nova: VendaNaFaixa, prende: (saleId: string) => boolean,
): VendaNaFaixa[] {
  return [nova, ...lista.filter(f => f.saleId !== nova.saleId && prende(f.saleId))];
}

/** Venda seguinte registrada: as faixas que a nota não prende saem. */
export function depoisDaVendaSeguinte(lista: VendaNaFaixa[], prende: (saleId: string) => boolean): VendaNaFaixa[] {
  return lista.filter(f => prende(f.saleId));
}

/**
 * As faixas desta loja que aparecem agora: a mais recente sempre; as antigas
 * só enquanto a nota prende (autorizada, somem sozinhas).
 */
export function faixasVisiveis(
  lista: VendaNaFaixa[], companyId: string | null | undefined, prende: (saleId: string) => boolean,
): VendaNaFaixa[] {
  if (!companyId) return [];
  const daLoja = lista.filter(f => f.companyId === companyId);
  return daLoja.filter((f, i) => i === 0 || prende(f.saleId));
}
