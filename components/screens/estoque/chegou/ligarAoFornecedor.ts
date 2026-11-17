// ============================================================
// AURA. — "Chegou mercadoria": a lista do fornecedor sem quantidade (F2)
//
// Pendência 7 (decisão do Caio, 17/11): a planilha sem quantidade liga os
// produtos ao fornecedor e grava o custo dele, SEM mexer no estoque. O botão
// diz isso: "Ligar n produtos à [fornecedor]".
//
// Dois passos, nesta ordem:
//   1. cadastrar os produtos novos (POST /products/batch-create, até 200 por
//      chamada, estoque 0, com o custo da lista e o preço que a pessoa deu).
//      Não usa o stock-receipts (B2b): ele recusa quantidade zero, e aqui
//      não há entrada nenhuma;
//   2. ligar todos ao fornecedor com o custo e o código de cada um
//      (POST /suppliers/:sid/products com items[], Aura-backend B4), até
//      1.000 por chamada, com is_main false: o fornecedor entra a mais e só
//      vira principal no produto que não tinha nenhum (pendência 3).
//
// Os produtos já cadastrados ficam guardados (`criados`): se o passo 2 cair,
// tentar de novo não cadastra em dobro. Ligar de novo não duplica nada (o
// vínculo é um por produto e fornecedor; o custo e o código são trocados).
// ============================================================
import type { ItemParaLigar, NovoParaLigar } from "./chegouRegras";

export const MAX_NOVOS_POR_CHAMADA = 200;
export const MAX_LIGAR_POR_CHAMADA = 1000;

export type CriarProdutos = (produtos: Array<Record<string, unknown>>) => Promise<{ created: Array<{ id: string; name: string }>; total_created?: number }>;
export type LigarItens = (items: Array<{ product_id: string; cost?: number; supplier_code?: string }>) => Promise<{ linked: number | null; not_found?: string[] }>;

export type ResultadoDaLista =
  | { ok: true; criados: Record<number, string>; jaTinha: number; cadastrados: number; ligados: number; naoAchados: string[] }
  | { ok: false; criados: Record<number, string>; etapa: "cadastrar" | "ligar"; erro: unknown };

function partes<T>(lista: T[], tamanho: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho));
  return out;
}

export async function ligarListaAoFornecedor(
  entrada: { existentes: ItemParaLigar[]; novos: NovoParaLigar[]; criadosAntes?: Record<number, string> },
  api: { criar: CriarProdutos; ligar: LigarItens },
): Promise<ResultadoDaLista> {
  const criados: Record<number, string> = { ...(entrada.criadosAntes || {}) };

  // 1. cadastrar os novos que ainda não foram cadastrados
  const faltamCriar = entrada.novos.filter((n) => !criados[n.n]);
  for (const parte of partes(faltamCriar, MAX_NOVOS_POR_CHAMADA)) {
    try {
      const r = await api.criar(parte.map((n) => {
        const p: Record<string, unknown> = { name: n.name, price: n.price, stock_qty: 0 };
        if (n.cost_price !== undefined) p.cost_price = n.cost_price;
        if (n.category) p.category = n.category;
        if (n.barcode) p.barcode = n.barcode;
        return p;
      }));
      const lista = (r && r.created) || [];
      // O backend devolve na ordem do pedido (INSERT … VALUES … RETURNING).
      // Se faltou algum (nome vazio), casa pelo nome para não ligar errado.
      if (lista.length === parte.length) {
        parte.forEach((n, i) => { criados[n.n] = String(lista[i].id); });
      } else {
        const livres = [...lista];
        for (const n of parte) {
          const i = livres.findIndex((c) => String(c.name || "").trim() === n.name);
          if (i >= 0) { criados[n.n] = String(livres[i].id); livres.splice(i, 1); }
        }
      }
    } catch (erro) {
      return { ok: false, criados, etapa: "cadastrar", erro };
    }
  }

  // 2. ligar todos, cada um com o seu custo e o seu código
  const itens: Array<{ product_id: string; cost?: number; supplier_code?: string }> = [];
  for (const e of entrada.existentes) {
    const it: { product_id: string; cost?: number; supplier_code?: string } = { product_id: e.product_id };
    if (e.cost !== undefined) it.cost = e.cost;
    if (e.supplier_code) it.supplier_code = e.supplier_code;
    itens.push(it);
  }
  let cadastrados = 0;
  for (const n of entrada.novos) {
    const id = criados[n.n];
    if (!id) continue;
    cadastrados++;
    const it: { product_id: string; cost?: number; supplier_code?: string } = { product_id: id };
    if (n.cost_price !== undefined) it.cost = n.cost_price;
    if (n.supplier_code) it.supplier_code = n.supplier_code;
    itens.push(it);
  }
  let ligados = 0;
  const naoAchados: string[] = [];
  for (const parte of partes(itens, MAX_LIGAR_POR_CHAMADA)) {
    try {
      const r = await api.ligar(parte);
      const nf = (r && r.not_found) || [];
      naoAchados.push(...nf);
      ligados += r && typeof r.linked === "number" ? r.linked : parte.length - nf.length;
    } catch (erro) {
      return { ok: false, criados, etapa: "ligar", erro };
    }
  }
  return { ok: true, criados, jaTinha: entrada.existentes.length, cadastrados, ligados, naoAchados };
}
