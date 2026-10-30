// ============================================================
// AURA. — Frete no Caixa (30/10/2026)
//
// A loja cobra a entrega na própria venda. Chave pdv_settings.frete_enabled
// (Configurações › Caixa); ligada, o carrinho ganha o atalho "Frete", que
// abre a seção "Frete / entrega" no resumo: valor digitado e, se a loja
// quiser, a venda vinculada a um cliente — o MESMO cliente da venda, sem
// segundo seletor (mockup docs/mockups/frete-no-caixa.html).
//
// Como o frete chega ao servidor: o POST /pdv/sale fecha a conta pelas
// linhas, então o frete viaja como uma linha sem produto de cadastro
// (mesmo caminho da taxa de serviço da comanda, utils/comanda). Cupom,
// histórico e relatórios o veem como um item "Frete". O desconto manual
// vale só sobre os produtos: o Caixa calcula o valor e manda em R$, para o
// servidor não aplicar o % em cima da linha do frete.
//
// Aqui fica o que não precisa de tela nem de rede (__tests__/frete.test.ts).
// ============================================================

type ComAChave = { frete_enabled?: unknown } | null | undefined;

/** A loja cobra frete no Caixa? Só `true` liga (undefined = backend antigo). */
export function lerFreteEnabled(settings: ComAChave): boolean {
  return !!settings && (settings as any).frete_enabled === true;
}

/** Nome da linha na venda, no cupom e na nota. */
export const NOME_DO_FRETE = "Frete";

/** Teto do valor digitado: acima disso é dedo errado, não frete. */
export const FRETE_MAXIMO = 99999;

/** "25", "25,5", "1.250,00", "R$ 30" → número em centavos certos. Vazio,
 *  zero, letra ou acima do teto → 0 (sem frete). */
export function valorDoFrete(texto: string | number | null | undefined): number {
  let s = String(texto == null ? "" : texto).replace(/[R$\s]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return 0;
  const n = Math.round(parseFloat(s) * 100) / 100;
  if (!(n > 0) || n > FRETE_MAXIMO) return 0;
  return n;
}

/** O que digitar aceita: dígitos, vírgula e ponto (até 2 casas). */
export function textoDoFrete(texto: string): string {
  const limpo = String(texto || "").replace(/[^\d.,]/g, "");
  const m = limpo.match(/^(\d{0,5})([.,]\d{0,2})?/);
  return m ? (m[1] || "") + (m[2] || "") : "";
}

export type LinhaDoFrete = {
  product_id: undefined;
  variant_id: undefined;
  quantity: 1;
  unit_price: number;
  product_name_snapshot: string;
};

/** A linha do POST /pdv/sale. Sem product_id o item entra só com o nome e
 *  não mexe em estoque. */
export function linhaDoFrete(valor: number): LinhaDoFrete {
  return {
    product_id: undefined,
    variant_id: undefined,
    quantity: 1,
    unit_price: Math.round((Number(valor) || 0) * 100) / 100,
    product_name_snapshot: NOME_DO_FRETE,
  };
}
