// ============================================================
// AURA. — Vale-troca por QR no cupom (13/10/2026; permanente desde 12/11/2026)
//
// Quem ganhou um presente raramente vem trocar com o comprador. O cupom sai
// com um QR; no Caixa, bipar o QR abre a Troca com a venda já carregada — sem
// o comprador, sem digitar número.
//
// 12/11/2026 (pedido do Caio): deixa de ser campanha de fim de ano. Antes, só
// as vendas de 01/11 a 31/12/2026 imprimiam o vale, todas com o mesmo prazo
// (31/01/2027). Agora vale para QUALQUER venda da loja com a opção ligada, o
// ano todo, e o prazo é da loja: dia da venda + N dias
// (pdv_settings.vale_troca_prazo_dias, 1 a 365; ausente = 30 —
// Aura-backend, utils/valeTrocaPrazo.js). A janela fixa sumiu; o Natal não
// ganha regra extra: a loja que quiser um prazo maior em dezembro aumenta o
// número de dias.
//
// O QR carrega o ID da venda (UUID), não o número do cupom ("Venda: #170"):
// o número é sequencial POR EMPRESA (a mesma 170 existe em toda loja) e a
// busca da troca é feita pelo ID (order_number do /pdv/sales-for-troca casa
// por trecho do UUID). O UUID já é a chave única e já é aceito pelo backend.
//
// Formato:  AURA-TROCA:<sale_id em MAIÚSCULAS>
//   · prefixo fixo, para o Caixa distinguir de código de barras de produto;
//   · MAIÚSCULAS porque "AURA-TROCA:" e o UUID (hex + hífen) cabem todos no
//     alfabeto do QR alfanumérico — leitura mais tolerante em papel térmico.
//     O parse é case-insensitive e devolve o UUID em minúsculas.
//
// Funções puras, sem import de componente nem de store — é o que permite
// testar (ver memória "testar render no aura-app").
// ============================================================

export const VALE_TROCA_PREFIXO = "AURA-TROCA";

/** Prazo para troca, em dias (o mesmo contrato do backend). */
export const VALE_TROCA_PRAZO_PADRAO_DIAS = 30;
export const VALE_TROCA_PRAZO_MIN_DIAS = 1;
export const VALE_TROCA_PRAZO_MAX_DIAS = 365;
/** A frase do interruptor (Políticas do Caixa e página Black Friday). */
export const TEXTO_DO_VALE_TROCA =
  "O cupom sai com um QR e o prazo para troca. Quem ganhou o presente troca sem o comprador: " +
  "você bipa o QR no Caixa e a troca abre com a venda carregada. Vale para todos os computadores da loja.";
/** Atalhos do campo em Políticas do Caixa. */
export const VALE_TROCA_ATALHOS_DIAS = [7, 15, 30, 60, 90] as const;

// ─── Código do vale ──────────────────────────────────────────

/** O conteúdo do QR para uma venda. */
export function montarCodigoDoVale(saleId: string): string {
  return VALE_TROCA_PREFIXO + ":" + String(saleId || "").trim().toUpperCase();
}

// Leitores em teclado com layout trocado viram ":" em "Ç", "?" etc. e "-" em
// "/" — por isso os separadores aceitam qualquer símbolo que não seja letra ou
// dígito. Letras e dígitos do UUID nunca são alterados.
const SEP = "[^0-9a-z]";
const RE_VALE = new RegExp(
  "^\\s*AURA" + SEP + "?TROCA" + SEP + "{0,3}\\s*" +
  "([0-9a-f]{8})" + SEP + "?([0-9a-f]{4})" + SEP + "?([0-9a-f]{4})" + SEP + "?([0-9a-f]{4})" + SEP + "?([0-9a-f]{12})\\s*$",
  "i",
);

export type ValeLido = { saleId: string };

/** O texto é um vale-troca? Devolve o ID da venda (UUID em minúsculas) ou null. */
export function lerCodigoDoVale(texto: string | null | undefined): ValeLido | null {
  const m = RE_VALE.exec(String(texto || ""));
  if (!m) return null;
  return { saleId: m.slice(1, 6).join("-").toLowerCase() };
}

// ─── Datas (dia civil de Brasília) ───────────────────────────

const BRASILIA_MS = 3 * 60 * 60 * 1000; // UTC-3 fixo: o Brasil não tem horário de verão desde 2019

/** "AAAA-MM-DD" do instante em Brasília, ou null se a data não vale. */
export function diaEmBrasilia(quando: Date | string | number | null | undefined): string | null {
  if (quando === null || quando === undefined || quando === "") return null;
  const d = quando instanceof Date ? quando : new Date(quando);
  const t = d.getTime();
  if (!isFinite(t)) return null;
  return new Date(t - BRASILIA_MS).toISOString().slice(0, 10);
}

/** "2027-01-31" → "31/01/2027". */
export function formatarDiaBR(dia: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  return m ? m[3] + "/" + m[2] + "/" + m[1] : dia;
}

/** "2026-11-12" + 30 → "2026-12-12" (dia civil, sem fuso). */
export function somarDias(dia: string, dias: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return dia;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + dias * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** "2026-12-12" → "12/12" quando é do ano de `hoje`; senão "12/12/2027".
 *  Para textos da tela (o cupom sempre leva o ano: formatarDiaBR). */
export function formatarDiaCurto(dia: string, hoje: Date | string | number = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return dia;
  const anoDeHoje = (diaEmBrasilia(hoje) || "").slice(0, 4);
  return anoDeHoje === m[1] ? m[3] + "/" + m[2] : m[3] + "/" + m[2] + "/" + m[1];
}

/** Prazo em dias a partir de um valor cru. Fora de 1–365, fração, ausente
 *  ou lixo → 30 (o padrão). Nunca lança. */
export function normalizarPrazoEmDias(raw: unknown): number {
  if (raw === null || raw === undefined || typeof raw === "boolean") return VALE_TROCA_PRAZO_PADRAO_DIAS;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isInteger(n) || n < VALE_TROCA_PRAZO_MIN_DIAS || n > VALE_TROCA_PRAZO_MAX_DIAS) {
    return VALE_TROCA_PRAZO_PADRAO_DIAS;
  }
  return n;
}

/** O que o lojista digitou no campo livre vale como prazo? Devolve os dias ou
 *  null (vazio, zero, acima de 365, fração, texto). */
export function prazoDigitado(texto: string): number | null {
  const t = String(texto || "").trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= VALE_TROCA_PRAZO_MIN_DIAS && n <= VALE_TROCA_PRAZO_MAX_DIAS ? n : null;
}

/**
 * Prazo ("AAAA-MM-DD", inclusive) para trocar a venda pelo vale: dia da venda
 * em Brasília + `prazoDias`. null só se a data da venda não vale. O prazo é
 * SEMPRE contado da venda — a 2ª via e o Caixa calculam o mesmo dia que o
 * cupom original, nunca "hoje + N".
 */
export function prazoDoVale(
  vendaEm: Date | string | number | null | undefined,
  prazoDias: number = VALE_TROCA_PRAZO_PADRAO_DIAS,
): string | null {
  const dia = diaEmBrasilia(vendaEm);
  if (!dia) return null;
  return somarDias(dia, normalizarPrazoEmDias(prazoDias));
}

/** O prazo passou? O próprio dia do prazo ainda vale. */
export function valeVencido(prazoAte: string, hoje: Date | string | number = new Date()): boolean {
  const dia = diaEmBrasilia(hoje);
  return !!dia && dia > prazoAte;
}

/** Texto do cupom (12/11, Caio: o prazo é em dias depois da compra, não uma
 *  data): "Troca em até 30 dias após a compra, apresentando este cupom". */
export function textoDoPrazoNoCupom(prazoDias: number): string {
  const n = Math.round(Number(prazoDias));
  return "Troca em até " + n + (n === 1 ? " dia" : " dias") + " após a compra, apresentando este cupom";
}

/** Linha de efeito do campo de prazo: o que o cupom imprime. */
export function textoDoEfeitoDoPrazo(prazoDias: number, hoje: Date | string | number = new Date()): string {
  const prazo = prazoDoVale(hoje, prazoDias);
  if (!prazo) return "";
  const n = Math.round(Number(prazoDias));
  return "No cupom: troca em até " + n + (n === 1 ? " dia" : " dias") + " após a compra";
}

/** Aviso do Caixa ao bipar um vale vencido. A decisão é do lojista. */
export function textoDoValeVencido(prazoAte: string, hoje: Date | string | number = new Date()): string {
  return "O prazo de troca desta compra terminou em " + formatarDiaCurto(prazoAte, hoje) + ". Quer trocar mesmo assim?";
}

/**
 * O cupom desta venda leva o bloco "Vale-troca"?
 * Só se a loja ligou e o prazo da venda ainda não passou (2ª via tirada
 * depois do prazo não promete troca que já venceu). Qualquer época do ano.
 */
export function deveImprimirVale(p: {
  vendaEm: Date | string | number | null | undefined;
  hoje?: Date | string | number;
  ligado?: boolean;
  prazoDias?: number;
}): boolean {
  if (p.ligado !== true) return false;
  const prazo = prazoDoVale(p.vendaEm, p.prazoDias);
  if (!prazo) return false;
  return !valeVencido(prazo, p.hoje ?? new Date());
}

// ─── Preferência da loja ─────────────────────────────────────
//
// Padrão: DESLIGADO (decisão de 08/11/2026: o vale-troca deixou de sair
// sozinho no cupom). Só imprime quando a lojista liga em Configurações, o que
// grava vale_troca_enabled:true em companies.pdv_settings (Aura-backend#813).
// Ausente, null, configurações ainda carregando ou backend antigo = desligado.
// O valor antigo guardado no navegador (app#1056) não é mais lido.

/** O que a preferência lê de pdv_settings (ausente = backend sem o campo). */
export type ConfigDoVale = {
  vale_troca_enabled?: boolean | null;
  /** 12/11/2026: prazo para troca em dias (1–365); ausente = 30. */
  vale_troca_prazo_dias?: number | null;
} | null | undefined;

/** O vale sai no cupom desta loja? `config` é o pdv_settings carregado. */
export function lerValeTrocaLigado(_companyId: string | null | undefined, config?: ConfigDoVale): boolean {
  return !!config && config.vale_troca_enabled === true;
}

/** Prazo da loja em dias (pdv_settings.vale_troca_prazo_dias; ausente = 30). */
export function lerPrazoDoValeEmDias(config?: ConfigDoVale): number {
  return normalizarPrazoEmDias(config ? config.vale_troca_prazo_dias : undefined);
}
