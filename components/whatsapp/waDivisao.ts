// ============================================================
// waDivisao — a divisão das novidades entre as três automáticas
//
// As novidades do mês (10 no plano) vêm divididas 4/4/2 entre Aniversário,
// Venda+ e a oferta do Crediário. A lojista mexe com + e −. As regras são
// as mesmas que o servidor aplica ao salvar (DIVISAO_ACIMA_DO_SALDO e
// DIVISAO_ABAIXO_DO_USADO), e moram aqui como função pura para a tela
// nunca oferecer um toque que o servidor vai recusar:
//
//   - a soma das partes nunca passa do saldo de novidades;
//   - nenhuma parte fica abaixo do que já foi usado no mês;
//   - nenhuma parte fica negativa.
//
// Entrada torta (parte ausente, negativa, fracionada) = divisão inválida
// (null / false): dúvida bloqueia.
// ============================================================
import type { WaAutoKey, WaParte } from "@/services/waConfigApi";

/** As três partes da divisão (e as chaves do Crediário: a parte é `crediario`). */
export type AutoKey = WaParte;

export const AUTO_KEYS: AutoKey[] = ["aniversario", "venda_mais", "crediario"];

export type Partes = Record<AutoKey, number>;

/** Divisão que já vem pronta: Aniversário 4, Venda+ 4, Crediário 2. */
export const DIVISAO_PADRAO: Partes = { aniversario: 4, venda_mais: 4, crediario: 2 };

/** Automática que gasta cada parte (o Crediário "vender"; o "cobrar" usa avisos). */
export const AUTOMATICA_DA_PARTE: Record<AutoKey, WaAutoKey> = {
  aniversario: "aniversario",
  venda_mais: "venda_mais",
  crediario: "crediario_vender",
};

function inteiroNaoNegativo(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/** Lê um objeto de partes do servidor. Qualquer parte torta = null. */
export function lerPartes(raw: any): Partes | null {
  if (!raw || typeof raw !== "object") return null;
  const out = {} as Partes;
  for (const k of AUTO_KEYS) {
    if (!inteiroNaoNegativo(raw[k])) return null;
    out[k] = raw[k];
  }
  return out;
}

export function somaPartes(p: Partes): number {
  return AUTO_KEYS.reduce((acc, k) => acc + p[k], 0);
}

/** Novidades que ainda não têm dono. */
export function semDono(div: Partes, total: number): number {
  return total - somaPartes(div);
}

/** A divisão cabe no saldo e respeita o que já foi usado? Mesma regra do servidor. */
export function divisaoValida(div: Partes, usadas: Partes, total: number): boolean {
  if (!inteiroNaoNegativo(total)) return false;
  if (somaPartes(div) > total) return false;
  return AUTO_KEYS.every((k) => inteiroNaoNegativo(div[k]) && div[k] >= usadas[k]);
}

/** O + está liberado? Só se sobrar novidade sem dono. */
export function podeDarMais(div: Partes, key: AutoKey, total: number): boolean {
  return semDono(div, total) > 0;
}

/** O − está liberado? Só até o que já foi usado (e nunca abaixo de zero). */
export function podeTirar(div: Partes, usadas: Partes, key: AutoKey): boolean {
  return div[key] > usadas[key] && div[key] > 0;
}

/**
 * Aplica +1 / −1 numa parte. Se o toque não é permitido, devolve a MESMA
 * divisão (o chamador compara por referência e não manda nada ao servidor).
 */
export function ajustarParte(div: Partes, usadas: Partes, key: AutoKey, delta: 1 | -1, total: number): Partes {
  if (delta > 0 && !podeDarMais(div, key, total)) return div;
  if (delta < 0 && !podeTirar(div, usadas, key)) return div;
  return { ...div, [key]: div[key] + delta };
}

export const ROTULO_AUTO: Record<AutoKey, string> = {
  aniversario: "Aniversário",
  venda_mais: "Venda+",
  crediario: "Crediário: vender",
};

export const COR_AUTO: Record<AutoKey, string> = {
  aniversario: "#c4b5fd",
  venda_mais: "#f9a8d4",
  crediario: "#6ee7b7",
};

export interface AutoLida {
  ligada: boolean;
  /** Parte da divisão menos o usado (null quando a automática usa avisos). */
  livres: number | null;
  config: Record<string, any>;
  resumo: string | null;
}

export interface AutomaticasInfo {
  /** Mês das novidades ("2026-12"), o mesmo do saldo. */
  mes: string | null;
  total: number;
  divisao: Partes;
  usadas: Partes;
  /** ISO do aceite das novidades; null = ainda não respondeu. */
  aceiteEm: string | null;
  autos: Partial<Record<WaAutoKey, AutoLida>>;
}

/**
 * Lê a resposta de GET /automaticas. Total, divisão ou usadas tortos =
 * null (a tela trava). `ligada` ausente = desligada: nunca liga por
 * omissão.
 */
export function lerAutomaticas(raw: any): AutomaticasInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const nov = raw.novidades;
  if (!nov || typeof nov !== "object") return null;
  const total = nov.total;
  const divisao = lerPartes(nov.divisao);
  const usadas = lerPartes(nov.usadas);
  if (!inteiroNaoNegativo(total) || !divisao || !usadas) return null;
  const autos: AutomaticasInfo["autos"] = {};
  if (Array.isArray(raw.automaticas)) {
    for (const a of raw.automaticas) {
      if (!a || typeof a.key !== "string") continue;
      autos[a.key as WaAutoKey] = {
        ligada: a.ligada === true,
        livres: inteiroNaoNegativo(a.livres) ? a.livres : null,
        config: a.config && typeof a.config === "object" ? a.config : {},
        resumo: typeof a.resumo === "string" ? a.resumo : null,
      };
    }
  }
  const aceiteEm = typeof raw.aceite_novidades_em === "string" && raw.aceite_novidades_em ? raw.aceite_novidades_em : null;
  const mes = typeof raw.mes === "string" && /^\d{4}-\d{2}$/.test(raw.mes) ? raw.mes : null;
  return { mes, total, divisao, usadas, aceiteEm, autos };
}
