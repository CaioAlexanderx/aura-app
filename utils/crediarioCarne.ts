// ============================================================
// AURA. — Crediário · carnês por compra (10/10/2026)
//
// Regras puras da nova ficha de carnês: formato de impressão (A4 ou bobina),
// derivação do cartão de cada carnê e plano de seleção do "Juntar carnês".
//
// Mora fora dos componentes pelo mesmo motivo de utils/crediarioRecebimento:
// a ficha arrasta react-native-svg pelo Icon/Toast e o jest do repo não
// carrega isso — a regra precisa ser testável sozinha.
//
// Contrato do backend: Aura-backend#802 (impressão) e #803 (carnês por
// compra + juntar). TODO campo novo é opcional: o app tem que funcionar
// igual contra o backend anterior a esses PRs.
// ============================================================

// ─── Impressão: formato e escopo ─────────────────────────────────────────

export type FormatoCarne = "a4" | "bobina";

/** Bobina é o padrão de propósito: quem já imprime hoje imprime em bobina, e
 *  a escolha nova não pode mudar o papel de ninguém sem a pessoa pedir. */
export const FORMATO_PADRAO: FormatoCarne = "bobina";

const CHAVE_FORMATO = "aura.crediario.carne.formato";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storagePadrao(): StorageLike | null {
  // try/catch: em aba anônima do Safari e com cookies bloqueados o simples
  // acesso a window.localStorage lança.
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Último formato escolhido NESTE aparelho; bobina se nunca escolheu. */
export function lerFormatoCarne(storage: StorageLike | null = storagePadrao()): FormatoCarne {
  try {
    const v = storage?.getItem(CHAVE_FORMATO);
    return v === "a4" || v === "bobina" ? v : FORMATO_PADRAO;
  } catch {
    return FORMATO_PADRAO;
  }
}

export function salvarFormatoCarne(formato: FormatoCarne, storage: StorageLike | null = storagePadrao()): void {
  try { storage?.setItem(CHAVE_FORMATO, formato); } catch { /* sem storage: só não lembra */ }
}

/**
 * Qual carnê imprimir:
 *   string    → aquele carnê (`account=<uuid>`)
 *   null      → o grupo sem carnê, "Compras anteriores" (`account=none`)
 *   undefined → todos os carnês do cliente (sem `account`) — o de sempre
 */
export type EscopoCarne = string | null | undefined;

export type OpcoesDeImpressao = { format?: FormatoCarne; accountId?: EscopoCarne };

/**
 * Caminho (sem o BASE_URL) do carnê para impressão.
 * Bobina não manda `format`: é o padrão do backend novo e a única coisa que
 * o backend antigo sabe fazer — a URL fica idêntica à de antes.
 */
export function carnePrintPath(companyId: string, customerId: string, opts: OpcoesDeImpressao = {}): string {
  const qs: string[] = [];
  if (opts.format === "a4") qs.push("format=a4");
  if (opts.accountId === null) qs.push("account=none");
  else if (typeof opts.accountId === "string" && opts.accountId) qs.push("account=" + encodeURIComponent(opts.accountId));
  const path = "/companies/" + companyId + "/print/credit/" + customerId + "/carne";
  return qs.length ? path + "?" + qs.join("&") : path;
}
