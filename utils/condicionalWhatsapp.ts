// ============================================================
// Mensagem de WhatsApp da condicional (C8, 25/11/2026)
//
// Função pura: monta o texto do mockup aprovado a partir do detalhe
// (GET /companies/:id/condicionais/:cid). SEM os termos da loja (decisão do
// Caio): o combinado vai no papel, não na conversa.
//
// R12: nada é enviado pela Aura. `abrirWhatsappDaCondicional` abre o wa.me com
// o texto pronto e a lojista confere e envia; chamar SEMPRE dentro do clique
// (window.open síncrono, como `openWhatsApp`).
// ============================================================
import { openWhatsApp } from "@/utils/whatsapp";

/** Só o que a mensagem lê do detalhe da condicional. */
export type CondicionalParaMensagem = {
  numero_exibicao?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  seller_name?: string | null;
  created_at?: string | null;
  due_date?: string | null;
  items?: Array<{
    product_name: string;
    color_name?: string | null;
    size_label?: string | null;
    variant_label?: string | null;
    unit_price: number | string;
  }>;
};

const TZ = "America/Sao_Paulo";
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function primeiroNome(nome?: string | null): string {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}

function brl(n: number | string): string {
  const v = Number(n) || 0;
  return "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function ymdSP(iso?: string | null): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function ddmm(ymd: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? `${m[2]}/${m[1]}` : "";
}

/** 'sábado, 28/11' */
function diaComSemana(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return "";
  const dia = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return `${DIAS[dia]}, ${m[3]}/${m[2]}`;
}

function linhaDaPeca(i: NonNullable<CondicionalParaMensagem["items"]>[number]): string {
  const cor = i.color_name ? String(i.color_name).toLowerCase() : "";
  const detalhe = [cor, i.size_label || ""].filter(Boolean);
  if (!detalhe.length && i.variant_label) detalhe.push(String(i.variant_label));
  return `• ${[i.product_name, ...detalhe].join(", ")}: ${brl(i.unit_price)}`;
}

/**
 * @param c         detalhe da condicional
 * @param lojaNome  nome da loja (o detalhe não traz)
 * @param hoje      'YYYY-MM-DD' de hoje em São Paulo (só para os testes)
 */
export function textoDaCondicional(c: CondicionalParaMensagem, lojaNome: string, hoje?: string): string {
  const cliente = primeiroNome(c.customer_name);
  const vendedora = primeiroNome(c.seller_name);
  const itens = c.items || [];
  const total = itens.reduce((s, i) => s + Math.round((Number(i.unit_price) || 0) * 100), 0) / 100;

  const dia = ymdSP(c.created_at);
  const agora = hoje ?? new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const quando = dia && dia === agora ? `hoje (${ddmm(dia)})` : `em ${ddmm(dia)}`;

  const saudacao = `Oi${cliente ? ", " + cliente : ""}! Aqui é ${vendedora ? `a ${vendedora}, da ${lojaNome}` : `da ${lojaNome}`}.`;
  const linhas = [
    saudacao,
    `Estas são as peças que você levou em condicional ${quando}:`,
    "",
    ...itens.map(linhaDaPeca),
    "",
    `Total das peças: ${brl(total)}`,
  ];
  const devolucao = diaComSemana(ymdSP(c.due_date));
  if (devolucao) linhas.push(`Combinamos a devolução até ${devolucao}.`);
  linhas.push("", "É só me contar com quais você vai ficar. Qualquer dúvida, estou por aqui!");
  return linhas.join("\n");
}

/**
 * Abre o WhatsApp com o texto pronto. Chamar dentro do clique. Retorna false
 * (sem abrir nada) se a cliente não tem telefone válido.
 */
export function abrirWhatsappDaCondicional(c: CondicionalParaMensagem, lojaNome: string): boolean {
  return openWhatsApp(c.customer_phone, textoDaCondicional(c, lojaNome));
}
