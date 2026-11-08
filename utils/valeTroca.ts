// ============================================================
// AURA. — Vale-troca por QR no cupom (aposta do fim de ano, 13/10/2026)
//
// Janeiro é o mês da troca de presente e o comprador raramente está na loja
// quando quem ganhou o presente vem trocar. O cupom das vendas de
// novembro/dezembro sai com um QR; no Caixa, bipar o QR abre a Troca com a
// venda já carregada — sem o comprador, sem digitar número.
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

/** Vendas de VALE_TROCA_VENDAS_DE a VALE_TROCA_VENDAS_ATE (inclusive, dia civil
 *  de Brasília) trocam até VALE_TROCA_PRAZO_ATE (inclusive). Data única: é aqui
 *  que se muda a campanha do ano seguinte. */
export const VALE_TROCA_VENDAS_DE = "2026-11-01";
export const VALE_TROCA_VENDAS_ATE = "2026-12-31";
export const VALE_TROCA_PRAZO_ATE = "2027-01-31";

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

/** A venda entrou na campanha (1/11 a 31/12)? */
export function vendaCaiNoPeriodoDoVale(vendaEm: Date | string | number | null | undefined): boolean {
  const dia = diaEmBrasilia(vendaEm);
  return !!dia && dia >= VALE_TROCA_VENDAS_DE && dia <= VALE_TROCA_VENDAS_ATE;
}

/** Prazo ("AAAA-MM-DD") para trocar a venda pelo vale; null se a venda é de
 *  fora da campanha — aí vale o prazo normal da loja, que o app não tem. */
export function prazoDoVale(vendaEm: Date | string | number | null | undefined): string | null {
  return vendaCaiNoPeriodoDoVale(vendaEm) ? VALE_TROCA_PRAZO_ATE : null;
}

/** O prazo passou? O próprio dia do prazo ainda vale. */
export function valeVencido(prazoAte: string, hoje: Date | string | number = new Date()): boolean {
  const dia = diaEmBrasilia(hoje);
  return !!dia && dia > prazoAte;
}

/** Texto do cupom. */
export function textoDoPrazoNoCupom(prazoAte: string = VALE_TROCA_PRAZO_ATE): string {
  return "Troque até " + formatarDiaBR(prazoAte) + " apresentando este cupom";
}

/**
 * O cupom desta venda leva o bloco "Vale-troca"?
 * Só se a loja ligou, a venda é da campanha e o prazo ainda não passou
 * (2ª via de dezembro tirada em fevereiro não promete troca que já venceu).
 */
export function deveImprimirVale(p: {
  vendaEm: Date | string | number | null | undefined;
  hoje?: Date | string | number;
  ligado?: boolean;
}): boolean {
  if (p.ligado !== true) return false;
  const prazo = prazoDoVale(p.vendaEm);
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
export type ConfigDoVale = { vale_troca_enabled?: boolean | null } | null | undefined;

/** O vale sai no cupom desta loja? `config` é o pdv_settings carregado. */
export function lerValeTrocaLigado(_companyId: string | null | undefined, config?: ConfigDoVale): boolean {
  return !!config && config.vale_troca_enabled === true;
}
