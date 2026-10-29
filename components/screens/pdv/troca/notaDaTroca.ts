// ============================================================
// AURA. — PDV · Troca · NFC-e dos itens novos (tq-39, 29/10/2026)
//
// Antes: na troca com valor a pagar, os itens da NFC-e somavam o valor CHEIO
// dos itens novos e os pagamentos só o LÍQUIDO (novo − devolvido). O
// validatePayments do backend (routes/nfce.js) exige soma igual -> 400, e a
// nota nunca saía (0 NFC-e em 9 trocas com pagamento, medido em 29/10).
//
// Agora, do jeito que a SEFAZ aceita:
//   - itens pelo valor de venda, com o desconto real da troca no vDesc de cada
//     item (desconto do lápis + desconto R$/% da troca rateado pelo valor das
//     linhas; o último item fica com o resto dos centavos);
//   - pagamentos = o que o cliente pagou (formas de sempre) + o crédito da
//     devolução como forma de pagamento "credito_troca" (tPag 05 — Crédito
//     Loja, à vista). O valor devolvido NÃO vira desconto: desconto reduz a
//     base dos tributos, e o crédito é só a forma com que a diferença foi
//     coberta. Soma dos pagamentos = soma dos itens, por construção.
// ============================================================
import type { NfceActionsItem } from "../NfceActions";
import type { NfcePaymentEntry } from "@/services/nfceApi";

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Forma de pagamento do crédito da devolução (backend: tPag 05, indPag 0). */
export const METODO_CREDITO_TROCA = "credito_troca";

/**
 * Itens da NFC-e da troca a partir das linhas gravadas (sale_items da venda de
 * troca, como o backend devolve em result.new_items) e do desconto manual da
 * troca (result.discount_amount ou sale.discount_amount).
 */
export function itensDaNotaDaTroca(newItems: any[], descontoManual: number): NfceActionsItem[] {
  const linhas = (Array.isArray(newItems) ? newItems : [])
    .filter((it) => it && it.product_id)
    .map((it) => {
      const quantity = num(it.quantity) || 1;
      const unit_price = num(it.unit_price);
      const bruto = r2(quantity * unit_price);
      const descItem = Math.min(Math.max(r2(num(it.discount)), 0), bruto);
      return {
        product_id: String(it.product_id),
        product_name: it.product_name || it.product_name_snapshot || "Item",
        quantity,
        unit_price,
        bruto,
        descItem,
        liquido: r2(bruto - descItem),
      };
    });

  const totalLiquido = r2(linhas.reduce((s, l) => s + l.liquido, 0));
  const manual = Math.min(Math.max(r2(num(descontoManual)), 0), totalLiquido);
  // Rateio proporcional ao valor da linha; a sobra dos centavos vai para as
  // linhas com folga, da última para a primeira (nenhuma fica negativa).
  const rateio = linhas.map((l) => (totalLiquido > 0 ? Math.min(r2(manual * (l.liquido / totalLiquido)), l.liquido) : 0));
  let sobra = r2(manual - rateio.reduce((s, v) => s + v, 0));
  for (let i = linhas.length - 1; i >= 0 && Math.abs(sobra) > 0.004; i--) {
    const ajuste = sobra > 0 ? Math.min(sobra, r2(linhas[i].liquido - rateio[i])) : Math.max(sobra, -rateio[i]);
    rateio[i] = r2(rateio[i] + ajuste);
    sobra = r2(sobra - ajuste);
  }

  return linhas.map((l, i) => {
    const discount = r2(l.descItem + rateio[i]);
    const item: NfceActionsItem = {
      product_id: l.product_id,
      product_name: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
    };
    if (discount > 0) item.discount = discount;
    return item;
  });
}

/** Valor da nota = soma dos itens menos os descontos (o que o backend confere). */
export function totalDaNota(itens: NfceActionsItem[]): number {
  return r2(itens.reduce((s, i) => s + r2(i.quantity * i.unit_price) - (i.discount || 0), 0));
}

/** Nomes do wizard -> nomes que o /nfce/emit conhece (cartão não vira Dinheiro). */
export function metodoDaNota(method: string): string {
  const m = String(method || "dinheiro").toLowerCase();
  if (m === "cartao_credito") return "cartao";
  if (m === "cartao_debito") return "debito";
  return m;
}

/**
 * Pagamentos da NFC-e: o que o cliente pagou + o crédito da devolução fechando
 * o valor da nota (absorve os centavos de arredondamento).
 */
export function pagamentosDaNotaDaTroca(
  itens: NfceActionsItem[],
  pagos: Array<{ method: string; value: number }>,
): NfcePaymentEntry[] {
  const total = totalDaNota(itens);
  const lista: NfcePaymentEntry[] = pagos
    .filter((p) => num(p.value) > 0)
    .map((p) => ({ method: metodoDaNota(p.method), value: r2(num(p.value)) }));
  const somaPagos = r2(lista.reduce((s, p) => s + p.value, 0));
  const credito = r2(total - somaPagos);
  if (credito > 0.004) lista.push({ method: METODO_CREDITO_TROCA, value: credito });
  return lista;
}
