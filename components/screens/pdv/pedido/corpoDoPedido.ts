// ============================================================
// AURA. — Novo pedido · contas puras (A2, p-63b)
//
// Sem React e sem store: o PedidoModal e os testes usam daqui.
//
// corpoDoPedido: o carrinho do Caixa vira o corpo do POST /pedidos
// (Aura-backend#1069). Mesma leitura do POST /pdv/sale (hooks/useCart):
//   - chave do carrinho "produto__variante" -> product_id + variant_id;
//     chave sintética (item avulso, taxa da comanda) vai sem product_id;
//   - unit_price = preço de tabela da linha; o lápis do Caixa vira
//     item_discount (preço de tabela − preço da linha) × quantidade;
//   - preço no cartão ligado: vale o do dinheiro (como o orçamento do
//     Matcon), porque o cartão é escolhido só na conclusão.
// O preço fica congelado no pedido: é o que a cliente viu no balcão.
//
// Datas: "hoje" é o de São Paulo (o backend recusa data que já passou).
// ============================================================
import { ehIdDeCatalogo } from "@/utils/comanda";
import type { CorpoDoPedido, ItemDoPedido } from "@/services/pedidosApi";

export type LinhaDoCarrinho = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  listPrice?: number;
  cashPrice?: number;
  cashListPrice?: number;
};

export type ClienteDoPedido =
  | { tipo: "cadastro"; id: string; name: string; phone: string | null }
  | { tipo: "sem-cadastro"; name: string };

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function separarChave(chave: string): { pid: string; vid: string | null } {
  const i = chave.indexOf("__");
  if (i < 0) return { pid: chave, vid: null };
  return { pid: chave.slice(0, i), vid: chave.slice(i + 2) };
}

export function itemDoPedido(l: LinhaDoCarrinho): ItemDoPedido {
  const { pid, vid } = separarChave(l.productId);
  const preco = l.cashPrice ?? l.price;
  const tabelaBruta = l.cashListPrice ?? l.listPrice;
  const tabela = tabelaBruta != null && tabelaBruta > 0 ? tabelaBruta : preco;
  const unit = Math.max(tabela, preco);
  const desconto = round2(Math.max(0, unit - preco) * l.qty);
  const doCadastro = ehIdDeCatalogo(pid);
  return {
    product_id: doCadastro ? pid : null,
    variant_id: doCadastro && vid ? vid : null,
    product_name: l.name,
    quantity: l.qty,
    unit_price: round2(unit),
    ...(desconto > 0 ? { item_discount: desconto } : {}),
  };
}

export function corpoDoPedido(args: {
  itens: LinhaDoCarrinho[];
  desconto: number;
  data: string | null;
  cliente: ClienteDoPedido | null;
}): CorpoDoPedido {
  const corpo: CorpoDoPedido = {
    items: args.itens.map(itemDoPedido),
    promised_date: args.data,
  };
  const desc = round2(args.desconto);
  if (desc > 0) corpo.discount = desc;
  if (args.cliente?.tipo === "cadastro") corpo.customer_id = args.cliente.id;
  else if (args.cliente?.tipo === "sem-cadastro" && args.cliente.name.trim()) corpo.customer_name = args.cliente.name.trim();
  return corpo;
}

/** Total do pedido como o backend calcula: soma das linhas − desconto do pedido. */
export function totalDoPedido(itens: LinhaDoCarrinho[], desconto: number): number {
  const soma = itens.reduce((t, l) => {
    const it = itemDoPedido(l);
    return t + round2(it.quantity * it.unit_price - (it.item_discount || 0));
  }, 0);
  return round2(Math.max(0, soma - Math.min(round2(desconto), soma)));
}

export function pecasDoPedido(itens: LinhaDoCarrinho[]): number {
  return itens.reduce((t, l) => t + (Number(l.qty) || 0), 0);
}

/** Assinatura dos itens: mudou, a chave de idempotência é outra. */
export function assinaturaDosItens(itens: LinhaDoCarrinho[], desconto: number): string {
  return JSON.stringify([itens.map((l) => [l.productId, l.qty, l.cashPrice ?? l.price, l.cashListPrice ?? l.listPrice ?? null]), round2(desconto)]);
}

// ── Datas ─────────────────────────────────────────────────────────────
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diaDaSemana(iso: string): number {
  return new Date(iso + "T12:00:00Z").getUTCDay();
}

const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function ddmm(iso: string): string {
  return iso.slice(8, 10) + "/" + iso.slice(5, 7);
}

/** "qua, 18/11" */
export function dataCurta(iso: string): string {
  return SEMANA_CURTA[diaDaSemana(iso)] + ", " + ddmm(iso);
}

/** "sexta, 20/11" */
export function dataLonga(iso: string): string {
  return SEMANA_LONGA[diaDaSemana(iso)] + ", " + ddmm(iso);
}

export type AtalhoDeData = { chave: "amanha" | "sexta" | "7dias"; data: string };

/**
 * Atalhos do passo 2: Amanhã, a próxima Sexta e Em 7 dias. A Sexta só entra
 * quando é outro dia (amanhã já é sexta, ou hoje é sexta: some).
 */
export function atalhosDeData(hoje: string): AtalhoDeData[] {
  const amanha = somarDias(hoje, 1);
  const em7 = somarDias(hoje, 7);
  const ateSexta = (5 - diaDaSemana(hoje) + 7) % 7 || 7;
  const sexta = somarDias(hoje, ateSexta);
  const out: AtalhoDeData[] = [{ chave: "amanha", data: amanha }];
  if (sexta !== amanha && sexta !== em7) out.push({ chave: "sexta", data: sexta });
  out.push({ chave: "7dias", data: em7 });
  return out;
}

/** "P-0012": o número do pedido como o mockup mostra. */
export function numeroDoPedido(n: string | number | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  const s = String(n).trim().replace(/^#/, "");
  return /^\d+$/.test(s) ? "P-" + s.padStart(4, "0") : s;
}

/** Primeiro nome, para "reservadas para a Marina". */
export function primeiroNome(nome: string | null | undefined): string | null {
  const n = String(nome || "").trim().split(/\s+/)[0];
  return n || null;
}
