// ============================================================
// AURA. — "Chegou mercadoria": gravar a entrada (A7)
//
// POST /products/stock-receipts (Aura-backend#1056 e #1057): tudo ou nada,
// até 300 linhas por chamada, com a `idempotency_key` criada ao abrir o
// wizard. A mesma chave chegando de novo devolve o resultado guardado
// (200, repeated) e não soma nada.
//
// Daqui:
//   - itensDaConferencia: as linhas que entram, no formato da entrada;
//   - resolverVariantes: a linha que casou pelo código de barras de UMA
//     variante ganha o variant_id (GET /products/:pid/variants);
//   - montarCorpos: divide acima de 300 linhas; cada parte com a sua chave
//     (`<chave>-p1`, `-p2`…), sempre a mesma para a mesma abertura, então
//     repetir a gravação inteira não soma em dobro as partes que já entraram;
//   - enviarComAMesmaChave: resposta que não chega (rede, tempo, 5xx,
//     "ainda gravando") repete com a MESMA chave;
//   - gravarEntrada: manda as partes em ordem e para na primeira que falha.
// ============================================================
import type { ApiError } from "@/services/api";
import { normalizarBarras, type LinhaConferida } from "./chegouRegras";

export const MAX_LINHAS_POR_PARTE = 300;

export type ProdutoNovoDaEntrada = {
  name: string;
  price: number;
  category?: string;
  ncm?: string;
  barcode?: string;
  unit?: string;
};

/** Uma linha que entra, já decidida (conferência, digitar ou planilha). */
export type ItemDaEntrada = {
  /** n da linha na tela (para devolver o erro do servidor à linha certa). */
  n: number;
  descricao: string;
  produtoId: string | null;
  novo: ProdutoNovoDaEntrada | null;
  quantidade: number;
  /** Grade: variant_id -> quantidade. */
  variantes: Array<{ variant_id: string; quantity: number }> | null;
  /** Casou pelo código de barras de uma variante: o A7 acha o variant_id. */
  codigoDaVariante: string | null;
  custo: number | null;
  codigoFornecedor: string | null;
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function itensDaConferencia(linhas: LinhaConferida[], semCusto: boolean): ItemDaEntrada[] {
  const itens: ItemDaEntrada[] = [];
  for (const l of linhas) {
    if (!l.entra) continue;
    const base = {
      n: l.item.n,
      descricao: l.item.descricao,
      quantidade: r3(l.quantidade),
      custo: semCusto || !(l.custo > 0) ? null : l.custo,
      codigoFornecedor: l.item.codigoFornecedor || null,
    };
    if (l.decisao && l.decisao.tipo === "novo") {
      const novo: ProdutoNovoDaEntrada = { name: l.decisao.nome.trim(), price: Number(l.decisao.preco) };
      if (l.decisao.categoria && l.decisao.categoria.trim()) novo.category = l.decisao.categoria.trim();
      if (l.item.ncm) novo.ncm = l.item.ncm;
      if (l.item.codigoBarras) novo.barcode = l.item.codigoBarras;
      itens.push({ ...base, produtoId: null, novo, variantes: null, codigoDaVariante: null });
      continue;
    }
    if (!l.produto) continue;
    const variantes = l.variantes
      ? Object.keys(l.variantes).filter((k) => l.variantes![k] > 0).map((k) => ({ variant_id: k, quantity: r3(l.variantes![k]) }))
      : null;
    itens.push({
      ...base,
      produtoId: l.produto.id,
      novo: null,
      variantes: variantes && variantes.length ? variantes : null,
      codigoDaVariante: !variantes && l.par && l.par.daVariante ? l.item.codigoBarras : null,
    });
  }
  return itens;
}

/**
 * Acha o variant_id das linhas que casaram pelo código de barras de uma
 * variante. Devolve os itens prontos e os `n` que não acharam (a linha
 * volta a pedir a grade).
 */
export async function resolverVariantes(
  itens: ItemDaEntrada[],
  buscar: (produtoId: string) => Promise<any>,
): Promise<{ itens: ItemDaEntrada[]; semVariante: number[] }> {
  const precisam = Array.from(new Set(itens.filter((i) => i.codigoDaVariante && i.produtoId).map((i) => i.produtoId!)));
  const porProduto = new Map<string, any[]>();
  for (const pid of precisam) {
    try {
      const r = await buscar(pid);
      porProduto.set(pid, Array.isArray(r?.variants) ? r.variants : Array.isArray(r) ? r : []);
    } catch {
      porProduto.set(pid, []);
    }
  }
  const semVariante: number[] = [];
  const prontos = itens.map((i) => {
    if (!i.codigoDaVariante || !i.produtoId) return i;
    const alvo = normalizarBarras(i.codigoDaVariante);
    const v = (porProduto.get(i.produtoId) || []).find((x) => normalizarBarras(x && x.barcode) === alvo);
    if (!v) { semVariante.push(i.n); return i; }
    return { ...i, variantes: [{ variant_id: String(v.id), quantity: i.quantidade }], codigoDaVariante: null };
  });
  return { itens: prontos, semVariante };
}

export type CabecalhoDaEntrada = {
  chave: string;
  origem: "nota" | "planilha" | "digitar" | "lista";
  fornecedorId: string | null;
  numeroDaNota: string | null;
  chaveDaNota: string | null;
  usarMedio: boolean;
};

export type ParteDaEntrada = { corpo: Record<string, unknown>; itens: ItemDaEntrada[] };

export function chaveDaParte(chave: string, i: number, total: number): string {
  return total <= 1 ? chave : (chave + "-p" + (i + 1)).slice(0, 100);
}

function itemDoCorpo(i: ItemDaEntrada, comFornecedor: boolean): Record<string, unknown> {
  const it: Record<string, unknown> = {};
  if (i.novo) it.new_product = i.novo;
  else it.product_id = i.produtoId;
  if (i.variantes && i.variantes.length) it.variants = i.variantes;
  else it.quantity = i.quantidade;
  if (i.custo !== null && i.custo > 0) it.unit_cost = i.custo;
  if (comFornecedor && i.codigoFornecedor) it.supplier_code = i.codigoFornecedor;
  return it;
}

export function montarCorpos(itens: ItemDaEntrada[], cab: CabecalhoDaEntrada, max = MAX_LINHAS_POR_PARTE): ParteDaEntrada[] {
  const partes: ItemDaEntrada[][] = [];
  for (let k = 0; k < itens.length; k += max) partes.push(itens.slice(k, k + max));
  return partes.map((p, i) => {
    const corpo: Record<string, unknown> = {
      idempotency_key: chaveDaParte(cab.chave, i, partes.length),
      origin: cab.origem,
      update_cost: cab.usarMedio,
      items: p.map((x) => itemDoCorpo(x, !!cab.fornecedorId)),
    };
    if (cab.fornecedorId) corpo.supplier_id = cab.fornecedorId;
    if (cab.numeroDaNota) corpo.invoice_number = cab.numeroDaNota;
    if (cab.chaveDaNota && cab.chaveDaNota.length === 44) corpo.nfe_key = cab.chaveDaNota;
    return { corpo, itens: p };
  });
}

// ── Envio ────────────────────────────────────────────────────
export type RespostaDaEntrada = {
  receipt?: { id: string; created_at?: string };
  supplier: { id: string; name: string; created: boolean } | null;
  lines: Array<{ index: number; product_id: string; name: string; quantity: number; created?: boolean }>;
  totals: { lines: number; products: number; created_products?: number; quantity: number; total_cost?: number | null };
  repeated?: boolean;
};

/** A resposta não chegou (ou o servidor pediu para tentar de novo)? */
export function deveRepetir(e: Partial<ApiError> | any): boolean {
  if (!e) return false;
  if (e.isNetworkError || e.status === 0) return true;
  if (typeof e.status === "number" && e.status >= 500 && e.status !== 503) return true;
  return e.status === 409 && e.data && e.data.code === "EM_ANDAMENTO";
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function enviarComAMesmaChave(
  enviar: (corpo: Record<string, unknown>) => Promise<RespostaDaEntrada>,
  corpo: Record<string, unknown>,
  opts: { tentativas?: number; pausaMs?: number } = {},
): Promise<RespostaDaEntrada> {
  const tentativas = opts.tentativas ?? 4;
  const pausa = opts.pausaMs ?? 1500;
  let ultimo: any = null;
  for (let t = 0; t < tentativas; t++) {
    try {
      return await enviar(corpo);
    } catch (e: any) {
      ultimo = e;
      if (!deveRepetir(e) || t === tentativas - 1) throw e;
      await esperar(pausa * (t + 1));
    }
  }
  throw ultimo;
}

export type ResultadoDaGravacao =
  | { ok: true; respostas: RespostaDaEntrada[] }
  | { ok: false; respostas: RespostaDaEntrada[]; partesFeitas: number; itensFeitos: number; erro: any; parteComErro: ParteDaEntrada };

export async function gravarEntrada(
  partes: ParteDaEntrada[],
  enviar: (corpo: Record<string, unknown>) => Promise<RespostaDaEntrada>,
  aoProgredir?: (itensFeitos: number) => void,
  opts?: { tentativas?: number; pausaMs?: number },
): Promise<ResultadoDaGravacao> {
  const respostas: RespostaDaEntrada[] = [];
  let feitos = 0;
  for (let i = 0; i < partes.length; i++) {
    try {
      respostas.push(await enviarComAMesmaChave(enviar, partes[i].corpo, opts));
      feitos += partes[i].itens.length;
      aoProgredir?.(feitos);
    } catch (erro) {
      return { ok: false, respostas, partesFeitas: i, itensFeitos: feitos, erro, parteComErro: partes[i] };
    }
  }
  return { ok: true, respostas };
}

/** Erros por linha do 400 LINHAS_COM_ERRO, de volta ao `n` da tela. */
export function errosPorLinha(erro: any, parte: ParteDaEntrada): Record<number, string> {
  const out: Record<number, string> = {};
  const lines = erro && erro.data && Array.isArray(erro.data.lines) ? erro.data.lines : [];
  for (const l of lines) {
    const it = parte.itens[Number(l.index)];
    if (it && l.error) out[it.n] = String(l.error);
  }
  return out;
}

// ── Pronto ───────────────────────────────────────────────────
export type ResumoDoPronto = {
  comEntrada: number;
  jaTinha: number;
  cadastrados: number;
  fornecedor: string | null;
  totalDaCompra: number | null;
};

export function resumoDoPronto(respostas: RespostaDaEntrada[]): ResumoDoPronto {
  let comEntrada = 0, cadastrados = 0, total = 0, temTotal = false;
  let fornecedor: string | null = null;
  for (const r of respostas) {
    const linhas = Array.isArray(r.lines) ? r.lines : [];
    comEntrada += linhas.length;
    cadastrados += linhas.filter((l) => l.created).length;
    if (r.totals && typeof r.totals.total_cost === "number") { total += r.totals.total_cost; temTotal = true; }
    if (r.supplier && r.supplier.name) fornecedor = r.supplier.name;
  }
  return {
    comEntrada,
    jaTinha: comEntrada - cadastrados,
    cadastrados,
    fornecedor,
    totalDaCompra: temTotal ? Math.round(total * 100) / 100 : null,
  };
}

/** "Baixar a lista dos que faltam": CSV simples (nome; quantidade; custo). */
export function csvDosQueFaltam(itens: ItemDaEntrada[]): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  const num = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
  return ["nome;codigo;quantidade;custo"]
    .concat(itens.map((i) => [esc(i.novo ? i.novo.name : i.descricao), esc(i.codigoFornecedor || ""), num(i.quantidade), num(i.custo)].join(";")))
    .join("\n");
}
