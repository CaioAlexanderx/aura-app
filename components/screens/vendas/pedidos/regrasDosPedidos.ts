// ============================================================
// AURA. — Aba Pedidos: textos e contas da tela (A5a/A5b, 17/11/2026)
//
// Funções puras, sem React: a lista, a gaveta e os testes leem a mesma
// conta. Os textos saem do mockup aprovado pelo Caio em 17/11 ("Pedido
// separado de venda", partes 3 e 7). O que não estava no mockup está
// marcado com "fora do mockup" e foi para a lista de aprovação do Caio.
// ============================================================
import { pluralize } from "@/utils/plural";
import { linkDoWhatsapp } from "@/utils/vendasPorNumeracao";
import { primeiroNome } from "@/utils/chamarSumidos";
import type { ChipDosPedidos, ContagemDosChips, SituacaoDoPedido } from "@/hooks/usePedidos";

export const TEXTOS_DOS_PEDIDOS = {
  aba: "Pedidos",
  // Mockup: "Pedidos guardados no Caixa e os que vieram dos orçamentos de
  // Personalizados." A segunda metade fica de fora enquanto a lista (B3)
  // só traz o pedido do balcão (fora do mockup: só o corte).
  subtitulo: "Pedidos guardados no Caixa.",
  kpiAbertos: "Abertos",
  kpiAtrasados: "Atrasados",
  kpiAtrasadosSub: "passaram da data prometida",
  kpiSinais: "Sinais recebidos",
  kpiSinaisSub: "dos pedidos abertos",
  kpiFalta: "Falta receber",
  kpiFaltaSub: "na retirada",
  kpiSomaDasLojas: "soma das lojas",
  busca: "Cliente, telefone ou número",
  colPedido: "Pedido",
  colCliente: "Cliente e peças",
  colData: "Data prometida",
  colSituacao: "Situação",
  colSinal: "Sinal",
  colFalta: "Falta",
  colAcoes: "Ações",
  semSinal: "sem sinal",
  semTelefone: "sem telefone",
  avisar: "Avisar",
  separar: "Separar",
  pronto: "Pronto",
  lembrar: "Lembrar a cliente",
  vazioTitulo: "Nenhum pedido aberto",
  vazioTexto: "Quando uma cliente quiser deixar uma peça separada, monte a venda no Caixa e toque em Guardar, depois em Pedido. Ela aparece aqui.",
  vazioAcao: "Abrir o Caixa",
  semAtrasadoTitulo: "Nenhum pedido atrasado",
  semAtrasadoTexto: "Tudo em dia por aqui.",
  tentarDeNovo: "Tentar de novo",
  // Gaveta (A5b)
  pecasReservadas: "Peças reservadas",
  pagamento: "Pagamento",
  totalDoPedido: "Total do pedido",
  sinal: "Sinal",
  faltaNaRetirada: "Falta na retirada",
  oQueAconteceu: "O que aconteceu",
  guardadoNoCaixa: "Pedido guardado",
  noCaixa: "no Caixa",
  separarAsPecas: "Separar as peças",
  concluirFuturo: "Concluir: vira venda e baixa o estoque",
  vemBuscar: "Vem buscar",
  fechar: "Fechar o pedido",
} as const;

// ── Fora do mockup (para o Caio aprovar) ─────────────────────────────
export const TEXTOS_FORA_DO_MOCKUP = {
  /** Data prometida de hoje (o mockup só tem "amanhã", "em N dias" e "atrasado N dias"). */
  hoje: "hoje",
  /** Pedido sem data prometida (a data é opcional no B1). */
  semData: "sem data",
  /** Chip sem resultado que não é o de atrasados. */
  semResultadoNoChip: "Nenhum pedido nesta situação.",
  /** Busca sem resultado. */
  semResultadoNaBusca: "Nenhum pedido com essa busca.",
  /** Carregando a gaveta. */
  carregando: "Carregando o pedido…",
} as const;

export type Chip = { key: ChipDosPedidos; label: string; contagem?: number; vermelho?: boolean };

/** Os chips do mockup, na ordem; Concluídos e Cancelados sem número (como no mockup). */
export function chipsDosPedidos(c: ContagemDosChips | null | undefined): Chip[] {
  const n = c || ({} as Partial<ContagemDosChips>);
  return [
    { key: "abertos", label: "Abertos", contagem: n.abertos || 0 },
    { key: "atrasados", label: "Atrasados", contagem: n.atrasados || 0, vermelho: true },
    { key: "aguardando", label: "Aguardando", contagem: n.aguardando || 0 },
    { key: "separando", label: "Separando ou em produção", contagem: n.separando || 0 },
    { key: "prontos", label: "Prontos", contagem: n.prontos || 0 },
    { key: "concluidos", label: "Concluídos" },
    { key: "cancelados", label: "Cancelados" },
  ];
}

const ROTULO_DA_SITUACAO: Record<string, string> = {
  confirmed: "Aguardando",
  preparing: "Separando",
  ready: "Pronto",
  delivered: "Concluído",
  cancelled: "Cancelado",
};

export function rotuloDaSituacao(status: string | null | undefined): string {
  return ROTULO_DA_SITUACAO[String(status || "")] || String(status || "");
}

export function situacaoAberta(status: string | null | undefined): boolean {
  return status === "confirmed" || status === "preparing" || status === "ready";
}

/** A próxima situação pela aba: Aguardando → Separar; Separando → Pronto. Pronto em diante: nada. */
export function proximaAcao(status: string | null | undefined): { status: "preparing" | "ready"; label: string } | null {
  if (status === "confirmed") return { status: "preparing", label: TEXTOS_DOS_PEDIDOS.separar };
  if (status === "preparing") return { status: "ready", label: TEXTOS_DOS_PEDIDOS.pronto };
  return null;
}

// ── Datas (YYYY-MM-DD, fuso de São Paulo) ─────────────────────────────
const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIA_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Hoje em São Paulo, 'YYYY-MM-DD' (a mesma conta do backend, hojeSP). */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

function partes(dia: string | null | undefined): { d: Date; dd: string; mm: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dia || ""));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return isNaN(d.getTime()) ? null : { d, dd: m[3], mm: m[2] };
}

/** "sáb, 14/11" */
export function dataCurta(dia: string | null | undefined): string {
  const p = partes(dia);
  if (!p) return TEXTOS_FORA_DO_MOCKUP.semData;
  return DIA_CURTO[p.d.getUTCDay()] + ", " + p.dd + "/" + p.mm;
}

/** "sexta, 20/11" */
export function dataLonga(dia: string | null | undefined): string {
  const p = partes(dia);
  if (!p) return TEXTOS_FORA_DO_MOCKUP.semData;
  return DIA_LONGO[p.d.getUTCDay()] + ", " + p.dd + "/" + p.mm;
}

/** Dias de `de` até `ate` (positivo = no futuro). */
export function diasEntre(de: string, ate: string): number | null {
  const a = partes(de);
  const b = partes(ate);
  if (!a || !b) return null;
  return Math.round((b.d.getTime() - a.d.getTime()) / 86400000);
}

/** Pedido aberto com a data prometida antes de hoje (mesma regra do backend). */
export function estaAtrasado(status: string | null | undefined, promised: string | null | undefined, hoje: string): boolean {
  if (!situacaoAberta(status) || !promised) return false;
  const n = diasEntre(hoje, promised);
  return n !== null && n < 0;
}

/** A linha de baixo da data: "atrasado 3 dias", "amanhã", "em 3 dias", "hoje". */
export function quandoVemBuscar(status: string | null | undefined, promised: string | null | undefined, hoje: string): string {
  if (!promised || !situacaoAberta(status)) return "";
  const n = diasEntre(hoje, promised);
  if (n === null) return "";
  if (n < 0) return "atrasado " + pluralize(-n, "dia", "dias");
  if (n === 0) return TEXTOS_FORA_DO_MOCKUP.hoje;
  if (n === 1) return "amanhã";
  return "em " + pluralize(n, "dia", "dias");
}

/** Selo do cartão no celular: "Atrasado 3 dias". */
export function seloDeAtraso(dias: number): string {
  return "Atrasado " + pluralize(Math.max(1, dias), "dia", "dias");
}

/** "Jaqueta Sarja Preta · G · 1 peça" (o primeiro item e o total de peças). */
export function pecasDaLinha(primeiro: string | null | undefined, pecas: number): string {
  const n = pluralize(Math.max(0, Number(pecas) || 0), "peça", "peças");
  return primeiro ? primeiro + " · " + n : n;
}

/** "N peças reservadas" do cartão Abertos. */
export function pecasReservadas(n: number): string {
  return pluralize(Math.max(0, Number(n) || 0), "peça reservada", "peças reservadas");
}

/** "Centro 7 · Shopping 4" do consolidado. */
export function porLoja(lojas: { company_name?: string | null; valor: number }[]): string {
  return lojas
    .filter((l) => l.company_name)
    .map((l) => l.company_name + " " + l.valor)
    .join(" · ");
}

// ── Hora em que foi guardado ─────────────────────────────────────────
/** "guardado hoje, 10:42" ou "guardado 15/11, 10:42" (o mockup só mostra o de hoje). */
export function guardadoEm(iso: string | null | undefined, hoje: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dia = hojeEmSaoPaulo(d);
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  if (dia === hoje) return "guardado hoje, " + hora;
  const p = partes(dia)!;
  return "guardado " + p.dd + "/" + p.mm + ", " + hora;
}

/** "17/11, 10:42" da linha "Pedido guardado no Caixa". */
export function diaEHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = partes(hojeEmSaoPaulo(d))!;
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return p.dd + "/" + p.mm + ", " + hora;
}

// ── WhatsApp ─────────────────────────────────────────────────────────
/**
 * O texto do mockup (parte 7): "Oi, [nome]! Sua [peça] está separada aqui na
 * loja esperando por você. Quando fica bom passar?". O mockup dá esse texto
 * para "Lembrar a cliente"; "Avisar" usa o mesmo (o mockup não traz outro).
 */
export function textoDoLembrete(nome: string | null | undefined, peca: string | null | undefined): string {
  const pn = primeiroNome(nome);
  const oi = pn ? "Oi, " + pn + "!" : "Oi!";
  // Só o nome do produto: a variação ("· G") fica fora da mensagem.
  const nomeDaPeca = String(peca || "").split(" · ")[0].trim();
  const sua = nomeDaPeca ? "Sua " + minusculaInicial(nomeDaPeca) : "Sua peça";
  return oi + " " + sua + " está separada aqui na loja esperando por você. Quando fica bom passar?";
}

function minusculaInicial(s: string): string {
  const t = String(s || "").trim();
  return t ? t.charAt(0).toLocaleLowerCase("pt-BR") + t.slice(1) : t;
}

/** Link wa.me pronto, ou null sem telefone que dê para usar. */
export function linkDoAviso(telefone: string | null | undefined, nome: string | null | undefined, peca: string | null | undefined): string | null {
  return linkDoWhatsapp(telefone, textoDoLembrete(nome, peca));
}

/** Situação para o selo (cor). */
export type CorDaSituacao = "violeta" | "azul" | "verde" | "neutro" | "vermelho";
export function corDaSituacao(status: SituacaoDoPedido | string | null | undefined): CorDaSituacao {
  if (status === "confirmed") return "violeta";
  if (status === "preparing") return "azul";
  if (status === "ready") return "verde";
  if (status === "cancelled") return "vermelho";
  return "neutro";
}
