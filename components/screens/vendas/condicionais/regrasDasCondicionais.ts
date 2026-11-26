// ============================================================
// AURA. — Aba Condicionais: textos e contas da lista (C5, 26/11/2026)
//
// Funções puras, sem React: a lista, o lembrete e os testes leem a mesma
// conta. Os textos saem do mockup aprovado em 25/11 (condicional/mockup.html,
// tela 1: lista, filtros, totalizador, Falta cobrar, lembrete, vazio, erro,
// consolidado). O que o mockup não traz está em TEXTOS_FORA_DO_MOCKUP e foi
// para a lista de divergências (a Nina decide).
// ============================================================
import { pluralize } from "@/utils/plural";
import { primeiroNome } from "@/utils/chamarSumidos";
import { brl } from "@/components/screens/vendas/editarVendaUtils";
import { dataLonga, diaEMes, diasEntre, hojeEmSaoPaulo } from "@/components/screens/vendas/pedidos/regrasDosPedidos";
import type {
  ContagemDasCondicionais, FiltroDasCondicionais, LinhaDaCondicional, NumerosDaLojaCondicional,
  TotalizadorDasCondicionais,
} from "@/hooks/useCondicionais";

export const TEXTOS_DA_LISTA = {
  // Cartões do topo (mockup: .sum)
  kpiComClientes: "Com clientes agora",
  kpiAindaDaLoja: "Ainda são da loja.",
  kpiVencemHoje: "Vencem hoje",
  kpiAtrasadas: "Atrasadas",
  // Filtros e busca
  todasAsLojas: "Todas as lojas",
  busca: "Cliente, telefone ou número",
  buscaRotulo: "Buscar condicional",
  // Tabela
  colNumero: "Nº",
  colCliente: "Cliente e peças",
  colValor: "Valor",
  colVolta: "Volta até",
  colSituacao: "Situação",
  // Situações
  atrasada: "Atrasada",
  faltaCobrar: "Falta cobrar",
  venceHoje: "Vence hoje",
  comACliente: "Com a cliente",
  concluida: "Concluída",
  parcial: "Parcial",
  semVenda: "Sem venda",
  nadaMaisComEla: "nada mais com ela",
  paraCobrar: "para cobrar",
  // Lembrar
  lembrar: "Lembrar",
  lembrarSub: "Abre o WhatsApp com o texto pronto. Você confere e envia.",
  agoraNao: "Agora não",
  abrirWhatsapp: "Abrir o WhatsApp",
  // Estados
  carregando: "Buscando as condicionais…",
  erroTitulo: "Não deu para buscar as condicionais agora.",
  erroTexto: "A internet pode ter caído. Nada foi perdido: as peças continuam marcadas com as clientes.",
  tentarDeNovo: "Tentar de novo",
  nova: "Nova condicional",
} as const;

// ── Fora do mockup (para a Nina decidir) ─────────────────────────────
export const TEXTOS_FORA_DO_MOCKUP = {
  /** Busca sem resultado (o mockup não desenhou; mesma forma do Pedido). */
  semResultadoNaBusca: "Nenhuma condicional com essa busca.",
  /** Chip sem resultado (o mockup não desenhou; mesma forma do Pedido). */
  semResultadoNoChip: "Nenhuma condicional nesta situação.",
  /** Situação da cancelada (as notas dizem "Cancelada"; o mockup não tem a linha). */
  cancelada: "Cancelada",
} as const;

const T = TEXTOS_DA_LISTA;

/** Os chips do mockup, na ordem: Em aberto · Vence hoje · Atrasadas · Concluídas. */
export type ChipDaCondicional = { key: FiltroDasCondicionais; label: string; contagem: number };
export function chipsDasCondicionais(c: Partial<ContagemDasCondicionais> | null | undefined): ChipDaCondicional[] {
  const n = c || {};
  return [
    { key: "em_aberto", label: "Em aberto", contagem: n.em_aberto || 0 },
    { key: "vence_hoje", label: "Vence hoje", contagem: n.vence_hoje || 0 },
    { key: "atrasadas", label: "Atrasadas", contagem: n.atrasadas || 0 },
    { key: "concluidas", label: "Concluídas", contagem: n.concluidas || 0 },
  ];
}

// ── Datas ('YYYY-MM-DD', fuso de São Paulo) ──────────────────────────
const DIA_CURTO = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

function diaDaSemana(dia: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dia || ""));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return isNaN(d.getTime()) ? null : d.getUTCDay();
}

/** "sáb., 21/11" (o formato do mockup). */
export function dataCurtaComPonto(dia: string | null | undefined): string {
  if (!dia) return "";
  const w = diaDaSemana(dia);
  const dm = diaEMes(dia);
  return w === null || !dm ? "" : DIA_CURTO[w] + ", " + dm;
}

/** 'YYYY-MM-DD' de um instante, no fuso de São Paulo. */
export function diaEmSaoPaulo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : hojeEmSaoPaulo(d);
}

// ── Linha ────────────────────────────────────────────────────────────
export type TomDaSituacao = "bad" | "fc" | "warn" | "cd" | "ok" | "mut";

/** Selo da situação: rótulo e tom (cores do mockup). */
export function seloDaSituacao(situacao: string): { label: string; tom: TomDaSituacao } {
  switch (situacao) {
    case "atrasada": return { label: T.atrasada, tom: "bad" };
    case "a_cobrar": return { label: T.faltaCobrar, tom: "fc" };
    case "vence_hoje": return { label: T.venceHoje, tom: "warn" };
    case "com_cliente": return { label: T.comACliente, tom: "cd" };
    case "concluida": return { label: T.concluida, tom: "ok" };
    default: return { label: TEXTOS_FORA_DO_MOCKUP.cancelada, tom: "mut" };
  }
}

/** Com peça ainda com a cliente (com a cliente, vence hoje, atrasada). */
export function comPecaComEla(situacao: string): boolean {
  return situacao === "com_cliente" || situacao === "vence_hoje" || situacao === "atrasada";
}

/** O selo "Parcial" ao lado (mockup: só na que ainda tem peça com ela). */
export function mostraParcial(c: Pick<LinhaDaCondicional, "situacao" | "parcial">): boolean {
  return !!c.parcial && comPecaComEla(String(c.situacao));
}

function voltaram(n: number): string {
  return n === 1 ? "1 voltou" : n + " voltaram";
}

/**
 * A linha de baixo do nome (sem a vendedora). Mockup:
 *   "4 peças: Calça Wide Lara, Saia Plissada Íris e mais 2"
 *   "1 peça com ela: Saia Plissada Íris · 2 já voltaram"
 *   "1 peça ficou · 2 voltaram"
 *   "Ficou 1 de 2 peças · venda #4812"
 *   "Tudo devolvido · 3 peças · sem venda"
 * A lista do backend traz só o nome da primeira peça (primeira_peca), e não
 * traz qual peça está com ela nem o número da venda: vai o que dá para dizer
 * com certeza.
 */
export function pecasDaCondicional(c: LinhaDaCondicional): string {
  const sit = String(c.situacao);
  const total = Number(c.pecas) || 0;
  if (comPecaComEla(sit)) {
    if (c.parcial) {
      const com = Number(c.pecas_com_cliente) || 0;
      const voltou = Number(c.pecas_voltou) || 0;
      const ficou = Number(c.pecas_ficou) || 0;
      const partes = [pluralize(com, "peça", "peças") + " com ela"];
      if (voltou) partes.push(voltou === 1 ? "1 já voltou" : voltou + " já voltaram");
      if (ficou) partes.push(ficou === 1 ? "1 ficou" : ficou + " ficaram");
      return partes.join(" · ");
    }
    const base = pluralize(total, "peça", "peças");
    if (!c.primeira_peca) return base;
    return base + ": " + c.primeira_peca + (total > 1 ? " e mais " + (total - 1) : "");
  }
  if (sit === "a_cobrar") {
    const ficou = Number(c.pecas_a_cobrar) || Number(c.pecas_ficou) || 0;
    const partes = [pluralize(ficou, "peça", "peças") + " " + (ficou === 1 ? "ficou" : "ficaram")];
    const voltou = Number(c.pecas_voltou) || 0;
    if (voltou) partes.push(voltaram(voltou));
    return partes.join(" · ");
  }
  if (sit === "concluida") {
    const ficou = Number(c.pecas_ficou) || 0;
    if (ficou > 0) return "Ficou " + ficou + " de " + pluralize(total, "peça", "peças");
    return "Tudo devolvido · " + pluralize(total, "peça", "peças") + " · sem venda";
  }
  return pluralize(total, "peça", "peças");
}

/** "<peças> · <vendedora>" */
export function subDaLinha(c: LinhaDaCondicional): string {
  return [pecasDaCondicional(c), c.seller_name].filter(Boolean).join(" · ");
}

/**
 * O valor da linha. Mockup: com peça com ela, o que está com ela; falta
 * cobrar, o que falta cobrar; concluída sem venda, "—". A concluída com venda
 * mostra no mockup o valor do que ficou, que a lista do backend não traz:
 * "—" até ele vir.
 */
export function valorDaLinha(c: LinhaDaCondicional): number {
  const sit = String(c.situacao);
  if (comPecaComEla(sit)) return Number(c.valor_com_cliente) || 0;
  if (sit === "a_cobrar") return Number(c.valor_a_cobrar) || 0;
  return 0;
}

export type Prazo = {
  /** Texto principal; `tom` pinta só ele. */
  texto: string;
  tom: "bad" | "warn" | "fc" | null;
  /** Linha de baixo (tabela) ou continuação após " · " (cartão). */
  sub?: string;
};

/** Coluna "Volta até" da tabela. */
export function prazoNaTabela(c: LinhaDaCondicional, hoje: string): Prazo {
  const sit = String(c.situacao);
  if (sit === "atrasada") {
    return { texto: "era " + dataCurtaComPonto(c.due_date), tom: "bad", sub: "atrasada " + pluralize(Math.max(1, Number(c.dias_de_atraso) || 0), "dia", "dias") };
  }
  if (sit === "a_cobrar") return { texto: brl(c.valor_a_cobrar) + " " + T.paraCobrar, tom: "fc", sub: T.nadaMaisComEla };
  if (sit === "vence_hoje") return { texto: "hoje, " + diaEMes(c.due_date), tom: "warn" };
  if (sit === "com_cliente") {
    const n = c.due_date ? diasEntre(hoje, c.due_date) : null;
    if (n === 1) return { texto: "amanhã, " + diaEMes(c.due_date), tom: null };
    return { texto: dataCurtaComPonto(c.due_date), tom: null };
  }
  if (sit === "concluida") {
    const dia = diaEmSaoPaulo(c.closed_at);
    return { texto: dia ? "concluída em " + diaEMes(dia) : "", tom: null };
  }
  return { texto: "", tom: null };
}

/** O prazo no cartão do celular. */
export function prazoNoCartao(c: LinhaDaCondicional, hoje: string): Prazo {
  const sit = String(c.situacao);
  if (sit === "atrasada") {
    return { texto: "atrasada " + pluralize(Math.max(1, Number(c.dias_de_atraso) || 0), "dia", "dias"), tom: "bad", sub: "era " + diaEMes(c.due_date) };
  }
  if (sit === "a_cobrar") {
    const ficou = Number(c.pecas_a_cobrar) || Number(c.pecas_ficou) || 0;
    return { texto: T.paraCobrar, tom: "fc", sub: pluralize(ficou, "peça", "peças") + " " + (ficou === 1 ? "ficou" : "ficaram") };
  }
  if (sit === "vence_hoje") return { texto: "vence hoje", tom: "warn" };
  if (sit === "com_cliente") {
    const n = c.due_date ? diasEntre(hoje, c.due_date) : null;
    if (n === 1) return { texto: "volta amanhã, " + diaEMes(c.due_date), tom: null };
    return { texto: "volta até " + dataCurtaComPonto(c.due_date), tom: null };
  }
  return prazoNaTabela(c, hoje);
}

// ── Cartões do topo ──────────────────────────────────────────────────
/**
 * "em 10 peças com 4 clientes" (+ " · Centro 9 · Shopping 1" no consolidado).
 * O valor vai à parte, grande. Mesma conta do totalizador.texto do backend.
 */
export function subDoTotalizador(t: TotalizadorDasCondicionais | null | undefined, lojas?: NumerosDaLojaCondicional[]): string {
  const pecas = Number(t?.pecas) || 0;
  const clientes = Number(t?.clientes) || 0;
  let s = "em " + pluralize(pecas, "peça", "peças") + " com " + pluralize(clientes, "cliente", "clientes");
  const porLoja = (lojas || []).filter((l) => l.company_name).map((l) => l.company_name + " " + (Number(l.totalizador?.pecas) || 0));
  if (porLoja.length > 1) s += " · " + porLoja.join(" · ");
  return s + ". " + T.kpiAindaDaLoja;
}

/**
 * "R$ 259,80 em 2 peças" dos cartões Vencem hoje e Atrasadas: soma das peças
 * ainda com a cliente nas linhas daquela situação (lidas da lista "Em
 * aberto", que traz as atrasadas primeiro e as de hoje logo depois).
 */
export function somaDaSituacao(linhas: LinhaDaCondicional[], situacao: "vence_hoje" | "atrasada"): { valor: number; pecas: number; texto: string } {
  let valor = 0;
  let pecas = 0;
  for (const l of linhas) {
    if (l.situacao !== situacao) continue;
    valor += Number(l.valor_com_cliente) || 0;
    pecas += Number(l.pecas_com_cliente) || 0;
  }
  return { valor, pecas, texto: pecas ? brl(valor) + " em " + pluralize(pecas, "peça", "peças") : "" };
}

// ── Lembrar (WhatsApp manual) ────────────────────────────────────────
/**
 * O texto do mockup (WA_LEMBRETE):
 *   "Oi, Bianca! Tudo bem? Aqui é a Paula, da Loja Centro.
 *    Passando para lembrar das 4 peças em condicional que estão com você
 *    desde 18/11. O combinado era até sábado, 21/11.
 *
 *    Consegue passar na loja ou me contar com quais vai ficar? Obrigada!"
 * Sem vendedora gravada: "Aqui é da Loja Centro." Com 1 peça: "da 1 peça em
 * condicional que está com você" (concordância; fora do mockup).
 */
export function textoDoLembrete(c: LinhaDaCondicional): string {
  const pn = primeiroNome(c.customer_name);
  const oi = (pn ? "Oi, " + pn + "!" : "Oi!") + " Tudo bem?";
  const vend = String(c.seller_name || "").trim();
  const loja = String(c.company_name || "").trim();
  const quem = vend
    ? " Aqui é a " + vend + (loja ? ", da " + loja : "") + "."
    : loja ? " Aqui é da " + loja + "." : "";
  const n = Number(c.pecas_com_cliente) || 0;
  const pecas = n === 1
    ? "da 1 peça em condicional que está com você"
    : "das " + n + " peças em condicional que estão com você";
  const desde = diaEmSaoPaulo(c.created_at);
  const linha2 = "Passando para lembrar " + pecas + (desde ? " desde " + diaEMes(desde) : "") + "." +
    (c.due_date ? " O combinado era até " + dataLonga(c.due_date) + "." : "");
  return oi + quem + "\n" + linha2 + "\n\nConsegue passar na loja ou me contar com quais vai ficar? Obrigada!";
}

/** "Lembrar a Bianca" (título da janela). */
export function tituloDoLembrete(nome: string | null | undefined): string {
  const pn = primeiroNome(nome);
  return pn ? "Lembrar a " + pn : T.lembrar;
}
