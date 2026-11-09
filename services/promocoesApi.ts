import { request, ApiError } from "@/services/api";

// ============================================================
// AURA. -- Promoção em lote (De/Por) na página Black Friday (p-86, 08/11/2026)
//
// Contrato com o backend (p-84): contrato De/Por, opção A.
//   POST /companies/:cid/products/promotions          prévia / aplicar
//   POST /companies/:cid/products/promotions/encerrar encerrar agora
//   GET  /companies/:cid/products/promotions?status=  lista da seção
// `dry_run` é true por padrão no servidor: sem `dry_run: false` nada é
// gravado. Até 2.000 itens por chamada: acima disso o app divide em lotes
// (`emLotes`). Uma promoção por item: a nova substitui a de antes (a prévia
// marca `ja_em_promocao`). Abaixo do custo sai sozinho, em `fora`.
// `cid` é sempre a empresa ativa (multi-CNPJ: promoção é por empresa).
// Perfil Estoque só consulta: 403 (a seção nem aparece para ele).
// ============================================================

export type ModoPromocao = "percent" | "fixed" | "preco";
export type TerminacaoPromocao = "none" | "90" | "99" | "00";
export type StatusPromocao = "ativa" | "agendada" | "encerrada";

export type AlvoPromocao = { product_id: string; variant_id?: string | null };

export type PedidoPromocao = {
  targets: AlvoPromocao[];
  modo: ModoPromocao;
  valor: number;
  terminacao?: TerminacaoPromocao;
  /** null = agora, pelo relógio do servidor (começar hoje; ver instantesDoPrazo). */
  starts_at: string | null;
  ends_at: string;
};

export type ItemDaPrevia = {
  product_id: string;
  variant_id: string | null;
  nome: string;
  variant_label?: string | null;
  preco_de: number;
  preco_por: number;
  ja_em_promocao: boolean;
  abaixo_do_custo: boolean;
  /** Custo do produto; null sem custo cadastrado ou para quem não vê custo (o backend tira). */
  cost_price?: number | null;
};

export type MotivoDeFora = "abaixo_do_custo" | "nao_encontrado" | "sem_preco" | "sem_desconto" | "preco_invalido" | "sem_promocao";
export type ItemDeFora = { product_id: string; variant_id: string | null; motivo: MotivoDeFora; nome?: string };

export type RespostaPromocao = { dry_run: boolean; items: ItemDaPrevia[]; fora: ItemDeFora[] };

/** Um item da lista de promoções (GET). Campos lidos com tolerância em `lerItemDaLista`. */
export type ItemDaLista = {
  product_id: string;
  variant_id: string | null;
  nome: string;
  variant_label?: string | null;
  preco_de: number;
  preco_por: number;
  starts_at: string | null;
  ends_at: string | null;
};

/** Máximo de itens por chamada (backend recusa acima disso). */
export var MAX_ITENS_POR_CHAMADA = 2000;

function base(companyId: string) {
  return "/companies/" + companyId + "/products/promotions";
}

/** Divide uma lista em pedaços de até `tamanho`. */
export function emLotes<T>(lista: T[], tamanho?: number): T[][] {
  var t = tamanho || MAX_ITENS_POR_CHAMADA;
  var out: T[][] = [];
  for (var i = 0; i < lista.length; i += t) out.push(lista.slice(i, i + t));
  return out;
}

function num(v: any): number {
  var n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function lerItemDaPrevia(i: any): ItemDaPrevia {
  return {
    product_id: String(i.product_id),
    variant_id: i.variant_id == null ? null : String(i.variant_id),
    nome: String(i.nome || i.name || "Produto"),
    variant_label: i.variant_label || null,
    preco_de: num(i.preco_de),
    preco_por: num(i.preco_por),
    ja_em_promocao: !!i.ja_em_promocao,
    abaixo_do_custo: !!i.abaixo_do_custo,
    cost_price: i.cost_price == null ? null : num(i.cost_price) || null,
  };
}

function lerRespostaPromocao(r: any): RespostaPromocao {
  return {
    dry_run: !!(r && r.dry_run),
    items: (r && Array.isArray(r.items) ? r.items : []).map(lerItemDaPrevia),
    fora: (r && Array.isArray(r.fora) ? r.fora : []).map(function (f: any) {
      return {
        product_id: String(f.product_id),
        variant_id: f.variant_id == null ? null : String(f.variant_id),
        motivo: f.motivo,
        nome: f.nome || f.name || undefined,
      } as ItemDeFora;
    }),
  };
}

/** Item da lista (GET): aceita os nomes do contrato e os do produto. */
export function lerItemDaLista(i: any): ItemDaLista {
  return {
    product_id: String(i.product_id || i.id),
    variant_id: i.variant_id == null ? null : String(i.variant_id),
    nome: String(i.nome || i.name || "Produto"),
    variant_label: i.variant_label || null,
    preco_de: num(i.preco_de != null ? i.preco_de : i.price),
    preco_por: num(i.preco_por != null ? i.preco_por : i.promo_price),
    starts_at: i.starts_at || i.promo_starts_at || null,
    ends_at: i.ends_at || i.promo_ends_at || null,
  };
}

/** Lista do GET: `{ items }`, `{ promotions }` ou o array direto. */
export function lerLista(r: any): ItemDaLista[] {
  var arr = Array.isArray(r) ? r : r && Array.isArray(r.items) ? r.items : r && Array.isArray(r.promotions) ? r.promotions : [];
  return arr.map(lerItemDaLista);
}

function juntar(respostas: RespostaPromocao[]): RespostaPromocao {
  var out: RespostaPromocao = { dry_run: true, items: [], fora: [] };
  respostas.forEach(function (r) {
    out.dry_run = r.dry_run;
    out.items = out.items.concat(r.items);
    out.fora = out.fora.concat(r.fora);
  });
  return out;
}

/** Uma chamada por lote, em sequência (o servidor trava as linhas de cada lote). */
function porLotes(caminho: string, pedido: any, dryRun: boolean): Promise<RespostaPromocao> {
  var lotes = emLotes(pedido.targets as AlvoPromocao[]);
  var respostas: RespostaPromocao[] = [];
  var cadeia: Promise<void> = Promise.resolve();
  lotes.forEach(function (targets) {
    cadeia = cadeia.then(function () {
      return request<any>(caminho, {
        method: "POST",
        body: { ...pedido, targets: targets, dry_run: dryRun },
        // retry 0: falha de rede não pode reenviar e gravar duas vezes.
        retry: 0,
        timeout: dryRun ? 30000 : 60000,
      }).then(function (r) { respostas.push(lerRespostaPromocao(r)); });
    });
  });
  return cadeia.then(function () { return juntar(respostas); });
}

export var promocoesApi = {
  /** Prévia: nada é gravado. */
  previa: function (companyId: string, pedido: PedidoPromocao) {
    return porLotes(base(companyId), pedido, true);
  },

  /** Aplicar de verdade (dry_run false), em lotes de até 2.000. */
  aplicar: function (companyId: string, pedido: PedidoPromocao) {
    return porLotes(base(companyId), pedido, false);
  },

  /** Encerrar agora: o preço volta ao normal na hora. */
  encerrar: function (companyId: string, targets: AlvoPromocao[]) {
    return porLotes(base(companyId) + "/encerrar", { targets: targets }, false);
  },

  /** Lista da seção. 404 = backend sem a rota: quem chama esconde a seção. */
  lista: function (companyId: string, status: StatusPromocao) {
    return request<any>(base(companyId) + "?status=" + status, { retry: 1 }).then(lerLista);
  },
};

/** O erro é "a rota não existe" (backend antigo)? */
export function ehRotaAusente(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

export default promocoesApi;
