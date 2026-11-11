// ============================================================
// AURA. — Conferência de estoque: a lógica de contar (p-108, entrega B)
//
// Sem React aqui: achar o produto pelo código, somar/definir na linha, a
// fila de envio do rascunho e o que fica guardado no aparelho. A tela
// (app/(tabs)/conferencia-estoque/[id]/index.tsx) e o hook
// (hooks/useConferenciaEstoque.ts) só ligam isto à tela.
//
// A fila manda sempre "definir" com o total da linha, nunca "somar". Um
// reenvio depois de uma queda de rede (o servidor pode ter gravado e a
// resposta se perdeu) então nunca conta a mesma peça duas vezes. Vários
// bipes do mesmo item enquanto a rede está fora viram um envio só, com o
// último total.
// ============================================================
import { productMatchesSearch, normalizeText } from "@/utils/productSearch";
import {
  lerErroDaConferencia,
  lerItemRegistrado,
  type ItemConferencia,
  type ErroDaConferencia,
} from "@/services/conferenciaEstoqueApi";

// ── Itens e linhas ────────────────────────────────────────

/** Produto + variante: uma linha por par. */
export function chaveDoItem(productId: string, variantId?: string | null): string {
  return productId + "|" + (variantId || "");
}

export type EstadoDaLinha = "salvo" | "pendente" | "erro";

export type LinhaContada = {
  chave: string;
  product_id: string;
  variant_id: string | null;
  item_id: string | null;
  nome: string;
  variante: string | null;
  codigo: string | null;
  contado: number;
  /** Só fora do modo às cegas: quanto o sistema tinha quando o item foi bipado. */
  sistema?: number | null;
  estado: EstadoDaLinha;
  mensagem?: string | null;
};

export type AlvoDaContagem = {
  product_id: string;
  variant_id?: string | null;
  nome: string;
  variante?: string | null;
  codigo?: string | null;
  sistema?: number | null;
};

function numero(v: any): number {
  var n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Arredonda em 3 casas (estoque pode ser 12,5 m²) sem lixo de ponto flutuante. */
export function arredondar(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Itens do GET /:countId em linhas, o último contado primeiro. */
export function linhasDoServidor(itens: ItemConferencia[] | null | undefined): LinhaContada[] {
  var lista = Array.isArray(itens) ? itens.slice() : [];
  lista.sort(function (a, b) {
    var ta = a.contado_em ? Date.parse(a.contado_em) : 0;
    var tb = b.contado_em ? Date.parse(b.contado_em) : 0;
    return (tb || 0) - (ta || 0);
  });
  return lista.map(function (it) {
    return {
      chave: chaveDoItem(it.product_id, it.variant_id),
      product_id: it.product_id,
      variant_id: it.variant_id || null,
      item_id: it.id,
      nome: it.nome || "Produto",
      variante: it.variante || null,
      codigo: it.codigo || null,
      contado: numero(it.contado),
      estado: "salvo" as EstadoDaLinha,
    };
  });
}

/**
 * Soma (bipe) ou define (quantidade digitada) a linha do item e a leva para
 * o topo. Nunca abaixo de zero. Devolve as linhas novas e a linha mexida.
 */
export function contarNaLinha(
  linhas: LinhaContada[],
  alvo: AlvoDaContagem,
  modo: "somar" | "definir",
  quantidade: number,
): { linhas: LinhaContada[]; linha: LinhaContada } {
  var chave = chaveDoItem(alvo.product_id, alvo.variant_id);
  var atual = linhas.find(function (l) { return l.chave === chave; });
  var base = atual ? atual.contado : 0;
  var total = arredondar(Math.max(0, modo === "somar" ? base + quantidade : quantidade));
  var linha: LinhaContada = {
    chave: chave,
    product_id: alvo.product_id,
    variant_id: alvo.variant_id || null,
    item_id: atual ? atual.item_id : null,
    nome: (atual && atual.nome) || alvo.nome,
    variante: (atual && atual.variante) || alvo.variante || null,
    codigo: (atual && atual.codigo) || alvo.codigo || null,
    contado: total,
    sistema: alvo.sistema !== undefined ? alvo.sistema : atual ? atual.sistema : undefined,
    estado: "pendente",
    mensagem: null,
  };
  var resto = linhas.filter(function (l) { return l.chave !== chave; });
  return { linhas: [linha].concat(resto), linha: linha };
}

/** "12", "12,5", "12.5" → número; vazio, negativo ou texto → null. */
export function lerQuantidadeDigitada(texto: string): number | null {
  var t = String(texto || "").trim().replace(",", ".");
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null;
  var n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? arredondar(n) : null;
}

/** Mostra 12 como "12" e 12,5 como "12,5". */
export function mostrarQuantidade(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(arredondar(n)).replace(".", ",");
}

// ── Achar o produto ───────────────────────────────────────

/** O mínimo que a conferência lê de cada produto (Product de useProducts). */
export type ProdutoContavel = {
  id: string;
  name: string;
  code?: string | null;      // SKU ("---" quando não tem)
  barcode?: string | null;
  category?: string | null;
  unit?: string | null;
  stock?: number | null;
  has_variants?: boolean;
  variant_barcodes?: string[];
  isGroupShared?: boolean;
};

export type CodigoResolvido =
  | { tipo: "produto"; produto: ProdutoContavel }
  /** Código do pai (ou SKU) de quem tem variantes: falta escolher qual. */
  | { tipo: "escolher_variante"; produto: ProdutoContavel }
  /** Código de uma variante: a tela busca as variantes e acha a do código. */
  | { tipo: "variante"; produto: ProdutoContavel; codigo: string }
  | { tipo: "nenhum" };

function temSku(p: ProdutoContavel): boolean {
  return !!p.code && p.code !== "---";
}

/** Serviço não tem estoque para contar. */
export function eContavel(p: ProdutoContavel): boolean {
  return p.unit !== "srv";
}

/**
 * Mesma ordem do Caixa (hooks/usePdvState.ts e o scanner.js do backend):
 * código de barras do produto, código de uma variante, SKU.
 */
export function resolverCodigo(codigo: string, produtos: ProdutoContavel[]): CodigoResolvido {
  var c = String(codigo || "").trim();
  if (!c) return { tipo: "nenhum" };
  var lista = produtos.filter(eContavel);
  var porBarras = lista.find(function (p) { return !!p.barcode && p.barcode === c; });
  if (porBarras) return porBarras.has_variants ? { tipo: "escolher_variante", produto: porBarras } : { tipo: "produto", produto: porBarras };
  var porVariante = lista.find(function (p) { return Array.isArray(p.variant_barcodes) && p.variant_barcodes.indexOf(c) >= 0; });
  if (porVariante) return { tipo: "variante", produto: porVariante, codigo: c };
  var cl = c.toLowerCase();
  var porSku = lista.find(function (p) { return temSku(p) && String(p.code).toLowerCase() === cl; });
  if (porSku) return porSku.has_variants ? { tipo: "escolher_variante", produto: porSku } : { tipo: "produto", produto: porSku };
  return { tipo: "nenhum" };
}

/** Texto que parece código (só dígitos, 6 ou mais): não vira busca por nome. */
export function pareceCodigo(texto: string): boolean {
  return /^\d{6,}$/.test(String(texto || "").trim());
}

export function buscarPorNome(texto: string, produtos: ProdutoContavel[], limite = 8): ProdutoContavel[] {
  var q = String(texto || "").trim();
  if (normalizeText(q).length < 2) return [];
  var achados: ProdutoContavel[] = [];
  for (var i = 0; i < produtos.length && achados.length < limite; i++) {
    var p = produtos[i];
    if (!eContavel(p)) continue;
    if (productMatchesSearch({ name: p.name, sku: temSku(p) ? p.code : null, barcode: p.barcode, category: p.category, variant_barcodes: p.variant_barcodes }, q)) {
      achados.push(p);
    }
  }
  return achados;
}

// ── Fila de envio ─────────────────────────────────────────

export type OperacaoDaFila =
  | { tipo: "definir"; chave: string; product_id: string; variant_id: string | null; quantidade: number }
  | { tipo: "remover"; chave: string; product_id: string; variant_id: string | null };

export type ResultadoDaFila =
  | { tipo: "salvo"; chave: string; item: ItemConferencia | null; quantidade: number; aindaPendente: boolean }
  | { tipo: "removido"; chave: string }
  | { tipo: "recusado"; chave: string; mensagem: string }
  | { tipo: "erro"; chave: string; mensagem: string; erro: ErroDaConferencia };

export type EstadoDaFila = {
  /** Operações ainda não confirmadas pelo servidor (inclui a que está indo). */
  pendentes: number;
  enviando: boolean;
  /** A última tentativa caiu na rede; a fila tenta de novo sozinha. */
  semConexao: boolean;
  /** O servidor ainda não tem a conferência (503 MIGRATION_PENDING / 404). */
  emPreparo: boolean;
};

export type OpcoesDaFila = {
  definir: (op: Extract<OperacaoDaFila, { tipo: "definir" }>) => Promise<any>;
  remover: (itemId: string) => Promise<any>;
  aoResolver: (r: ResultadoDaFila) => void;
  aoMudarEstado?: (e: EstadoDaFila) => void;
  itemIds?: Record<string, string>;
  agendar?: (fn: () => void, ms: number) => any;
  cancelar?: (h: any) => void;
  /** Espera entre tentativas depois de cair na rede (a última se repete). */
  esperas?: number[];
};

export type FilaDeContagem = {
  colocar: (op: OperacaoDaFila) => void;
  reenviarAgora: () => void;
  /** O que ainda não chegou ao servidor, na ordem, para guardar no aparelho. */
  pendentes: () => OperacaoDaFila[];
  estado: () => EstadoDaFila;
  conhecerItem: (chave: string, itemId: string) => void;
  parar: () => void;
};

export const ESPERAS_PADRAO = [2000, 5000, 10000, 20000, 30000];

export function criarFilaDeContagem(opts: OpcoesDaFila): FilaDeContagem {
  var agendar = opts.agendar || function (fn: () => void, ms: number) { return setTimeout(fn, ms); };
  var cancelar = opts.cancelar || function (h: any) { clearTimeout(h); };
  var esperas = opts.esperas && opts.esperas.length ? opts.esperas : ESPERAS_PADRAO;
  var fila = new Map<string, OperacaoDaFila>();
  var itemIds: Record<string, string> = Object.assign({}, opts.itemIds || {});
  var emVoo: OperacaoDaFila | null = null;
  var timer: any = null;
  var falhas = 0;
  var semConexao = false;
  var emPreparo = false;
  var parada = false;

  function estado(): EstadoDaFila {
    return { pendentes: fila.size + (emVoo ? 1 : 0), enviando: !!emVoo, semConexao: semConexao, emPreparo: emPreparo };
  }
  function avisar() { if (opts.aoMudarEstado) opts.aoMudarEstado(estado()); }

  function devolverNaFrente(op: OperacaoDaFila) {
    // Se outro bipe do mesmo item chegou enquanto esta ia, o mais novo vale.
    if (fila.has(op.chave)) return;
    var nova = new Map<string, OperacaoDaFila>();
    nova.set(op.chave, op);
    fila.forEach(function (v, k) { nova.set(k, v); });
    fila = nova;
  }

  function esperarETentar() {
    var ms = esperas[Math.min(falhas, esperas.length - 1)];
    falhas++;
    if (timer) cancelar(timer);
    timer = agendar(function () { timer = null; bombear(); }, ms);
  }

  function bombear() {
    if (parada || emVoo || timer) return;
    var primeira = fila.keys().next();
    if (primeira.done) { avisar(); return; }
    var chave = primeira.value as string;
    var op = fila.get(chave)!;
    fila.delete(chave);

    if (op.tipo === "remover" && !itemIds[op.chave]) {
      // Nunca chegou ao servidor: some só daqui.
      opts.aoResolver({ tipo: "removido", chave: op.chave });
      bombear();
      return;
    }

    emVoo = op;
    avisar();
    var promessa = op.tipo === "definir" ? opts.definir(op) : opts.remover(itemIds[op.chave]);
    Promise.resolve(promessa).then(function (resp) {
      emVoo = null;
      falhas = 0;
      semConexao = false;
      emPreparo = false;
      if (op.tipo === "definir") {
        var item = lerItemRegistrado(resp);
        if (item) itemIds[op.chave] = item.id;
        opts.aoResolver({ tipo: "salvo", chave: op.chave, item: item, quantidade: op.quantidade, aindaPendente: fila.has(op.chave) });
      } else {
        delete itemIds[op.chave];
        opts.aoResolver({ tipo: "removido", chave: op.chave });
      }
      bombear();
    }, function (e) {
      emVoo = null;
      var erro = lerErroDaConferencia(e);
      if (erro.tipo === "rede" || erro.tipo === "em_preparo") {
        semConexao = erro.tipo === "rede";
        emPreparo = erro.tipo === "em_preparo";
        devolverNaFrente(op);
        avisar();
        esperarETentar();
        return;
      }
      if (op.tipo === "remover" && erro.tipo === "nao_encontrada") {
        delete itemIds[op.chave];
        opts.aoResolver({ tipo: "removido", chave: op.chave });
      } else if (erro.tipo === "recusado") {
        fila.delete(op.chave);
        opts.aoResolver({ tipo: "recusado", chave: op.chave, mensagem: erro.mensagem });
      } else {
        opts.aoResolver({ tipo: "erro", chave: op.chave, mensagem: erro.mensagem, erro: erro });
      }
      bombear();
    });
  }

  return {
    colocar: function (op) {
      // Map.set mantém a posição de quem já esperava: o item não perde a vez.
      fila.set(op.chave, op);
      avisar();
      bombear();
    },
    reenviarAgora: function () {
      if (timer) { cancelar(timer); timer = null; }
      falhas = 0;
      bombear();
    },
    pendentes: function () {
      var out: OperacaoDaFila[] = [];
      if (emVoo && !fila.has(emVoo.chave)) out.push(emVoo);
      fila.forEach(function (v) { out.push(v); });
      return out;
    },
    estado: estado,
    conhecerItem: function (chave, itemId) { itemIds[chave] = itemId; },
    parar: function () {
      parada = true;
      if (timer) { cancelar(timer); timer = null; }
    },
  };
}

/**
 * Junta o que ficou guardado no aparelho às linhas do servidor: o valor
 * pendente vale (é mais novo que o servidor); remoção pendente tira a linha.
 */
export function aplicarPendentes(linhas: LinhaContada[], pendentes: OperacaoDaFila[], nomes?: Record<string, Partial<LinhaContada>>): LinhaContada[] {
  var out = linhas.slice();
  pendentes.forEach(function (op) {
    var i = out.findIndex(function (l) { return l.chave === op.chave; });
    if (op.tipo === "remover") {
      if (i >= 0) out.splice(i, 1);
      return;
    }
    if (i >= 0) {
      out[i] = Object.assign({}, out[i], { contado: op.quantidade, estado: "pendente" as EstadoDaLinha });
    } else {
      var extra = (nomes && nomes[op.chave]) || {};
      out.unshift({
        chave: op.chave,
        product_id: op.product_id,
        variant_id: op.variant_id,
        item_id: null,
        nome: extra.nome || "Produto",
        variante: extra.variante || null,
        codigo: extra.codigo || null,
        contado: op.quantidade,
        estado: "pendente",
      });
    }
  });
  return out;
}

// ── Guardado no aparelho ──────────────────────────────────
//
// localStorage com try/catch: pode faltar (app nativo, aba anônima, dado
// apagado) e a tela funciona sem ele. É só a rede de segurança da fila e a
// lista do "sem cadastro"; a verdade do rascunho é o servidor.

export type CodigoSemCadastro = { codigo: string; vezes: number; em: string };

type Guardado = {
  pendentes: OperacaoDaFila[];
  nomes: Record<string, { nome: string; variante: string | null; codigo: string | null }>;
  semCadastro: CodigoSemCadastro[];
};

function chaveLocal(countId: string): string {
  return "aura_conferencia_" + countId;
}

function lerGuardado(countId: string): Guardado {
  var vazio: Guardado = { pendentes: [], nomes: {}, semCadastro: [] };
  try {
    if (typeof localStorage === "undefined") return vazio;
    var raw = localStorage.getItem(chaveLocal(countId));
    if (!raw) return vazio;
    var g = JSON.parse(raw);
    return {
      pendentes: Array.isArray(g.pendentes) ? g.pendentes.filter(function (o: any) { return o && typeof o.chave === "string" && (o.tipo === "definir" || o.tipo === "remover"); }) : [],
      nomes: g.nomes && typeof g.nomes === "object" ? g.nomes : {},
      semCadastro: Array.isArray(g.semCadastro) ? g.semCadastro.filter(function (c: any) { return c && typeof c.codigo === "string"; }) : [],
    };
  } catch {
    return vazio;
  }
}

function gravarGuardado(countId: string, g: Guardado): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (!g.pendentes.length && !g.semCadastro.length) { localStorage.removeItem(chaveLocal(countId)); return; }
    localStorage.setItem(chaveLocal(countId), JSON.stringify(g));
  } catch { /* sem storage: a fila segue na memória */ }
}

export function lerPendentesGuardados(countId: string): { pendentes: OperacaoDaFila[]; nomes: Guardado["nomes"] } {
  var g = lerGuardado(countId);
  return { pendentes: g.pendentes, nomes: g.nomes };
}

export function guardarPendentes(countId: string, pendentes: OperacaoDaFila[], linhas: LinhaContada[]): void {
  var g = lerGuardado(countId);
  var nomes: Guardado["nomes"] = {};
  pendentes.forEach(function (op) {
    var l = linhas.find(function (x) { return x.chave === op.chave; });
    if (l) nomes[op.chave] = { nome: l.nome, variante: l.variante, codigo: l.codigo };
  });
  g.pendentes = pendentes;
  g.nomes = nomes;
  gravarGuardado(countId, g);
}

/**
 * Códigos que a Aura não conhece, bipados nesta conferência. Ficam só neste
 * aparelho (não criam produto). A tela de diferenças pode ler daqui.
 */
export function lerSemCadastro(countId: string): CodigoSemCadastro[] {
  return lerGuardado(countId).semCadastro;
}

export function anotarSemCadastro(lista: CodigoSemCadastro[], codigo: string, agora: Date = new Date()): CodigoSemCadastro[] {
  var c = String(codigo || "").trim();
  if (!c) return lista;
  var achado = lista.find(function (x) { return x.codigo === c; });
  if (achado) {
    return [{ codigo: c, vezes: achado.vezes + 1, em: agora.toISOString() }].concat(lista.filter(function (x) { return x.codigo !== c; }));
  }
  return [{ codigo: c, vezes: 1, em: agora.toISOString() }].concat(lista);
}

export function guardarSemCadastro(countId: string, lista: CodigoSemCadastro[]): void {
  var g = lerGuardado(countId);
  g.semCadastro = lista;
  gravarGuardado(countId, g);
}

// ── Textos ────────────────────────────────────────────────

export function textoDoEscopo(
  escopo: { tipo: string; category_ids?: string[] } | null | undefined,
  categorias: Array<{ id: string; name: string }> = [],
): string {
  if (!escopo) return "Conferência";
  if (escopo.tipo === "loja_toda") return "A loja toda";
  if (escopo.tipo === "com_estoque") return "O que tem estoque";
  var ids = escopo.category_ids || [];
  var nomes = ids.map(function (id) {
    var c = categorias.find(function (x) { return x.id === id; });
    return c ? c.name : null;
  }).filter(Boolean) as string[];
  if (!nomes.length) return ids.length > 1 ? ids.length + " categorias" : "Uma categoria";
  if (nomes.length <= 2) return nomes.join(" e ");
  return nomes[0] + " e mais " + (nomes.length - 1);
}

export function plural(n: number, um: string, varios: string): string {
  return n + " " + (n === 1 ? um : varios);
}
