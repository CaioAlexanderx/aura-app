// ============================================================
// AURA. — "Chegou mercadoria": origem "Digitar os itens" (A5), sem tela
//
// Uma lista de linhas: produto da loja (quantidade, ou a grade quando tem
// cores e tamanhos) ou produto novo (só nome e preço; o resto depois), e o
// custo. Vira os mesmos ItemDaEntrada da conferência, e grava pelo A7.
// ============================================================
import type { ItemDaEntrada } from "./gravarEntrada";
import type { ProdutoDaLoja } from "./chegouRegras";

export type LinhaDigitada = {
  /** Estável na lista (chave do React). */
  id: string;
  produtoId: string | null;
  /** Produto novo: "Cadastrar "…" como produto novo". */
  novo: { nome: string; preco: number | null } | null;
  quantidade: number | null;
  /** Grade: variant_id -> quantidade. */
  grade: Record<string, number> | null;
  custo: number | null;
};

let seq = 0;
export function novaLinhaDigitada(base: Partial<LinhaDigitada>): LinhaDigitada {
  seq += 1;
  return { id: "d" + Date.now().toString(36) + seq, produtoId: null, novo: null, quantidade: null, grade: null, custo: null, ...base };
}

export type ConferenciaDigitada = {
  itens: ItemDaEntrada[];
  /** Linhas que ainda não dizem quantos (ou o nome e o preço do novo). */
  faltam: number;
  total: number;
  podeDarEntrada: boolean;
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Quantidade da linha: a soma da grade, quando o produto tem grade. */
export function quantidadeDaLinha(l: LinhaDigitada, produto: ProdutoDaLoja | undefined): number {
  if (produto && produto.has_variants) {
    return r3(Object.values(l.grade || {}).reduce((t, q) => t + (Number(q) > 0 ? Number(q) : 0), 0));
  }
  return Number(l.quantidade) > 0 ? r3(Number(l.quantidade)) : 0;
}

/**
 * As linhas digitadas, prontas para gravar. O `n` de cada item é a posição
 * na lista (1, 2, 3…), para o erro do servidor voltar à linha certa.
 */
export function conferirDigitadas(
  linhas: LinhaDigitada[],
  porId: Map<string, ProdutoDaLoja>,
  semCusto: boolean,
): ConferenciaDigitada {
  const itens: ItemDaEntrada[] = [];
  let faltam = 0;
  let total = 0;
  linhas.forEach((l, i) => {
    const n = i + 1;
    const produto = l.produtoId ? porId.get(l.produtoId) : undefined;
    const q = quantidadeDaLinha(l, produto);
    const custo = semCusto || !(Number(l.custo) > 0) ? null : Number(l.custo);
    if (l.novo) {
      if (!(q > 0) || !l.novo.nome.trim() || !(Number(l.novo.preco) > 0)) { faltam++; return; }
      itens.push({
        n, descricao: l.novo.nome.trim(), produtoId: null, novo: { name: l.novo.nome.trim(), price: Number(l.novo.preco) },
        quantidade: q, variantes: null, codigoDaVariante: null, custo, codigoFornecedor: null,
      });
    } else {
      if (!produto || !(q > 0)) { faltam++; return; }
      const variantes = produto.has_variants
        ? Object.keys(l.grade || {}).filter((k) => Number(l.grade![k]) > 0).map((k) => ({ variant_id: k, quantity: r3(Number(l.grade![k])) }))
        : null;
      itens.push({
        n, descricao: produto.name, produtoId: produto.id, novo: null,
        quantidade: q, variantes: variantes && variantes.length ? variantes : null, codigoDaVariante: null, custo, codigoFornecedor: null,
      });
    }
    if (custo) total += q * custo;
  });
  return { itens, faltam, total: Math.round(total * 100) / 100, podeDarEntrada: faltam === 0 && itens.length > 0 };
}
