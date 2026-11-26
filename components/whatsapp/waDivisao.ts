// ============================================================
// waDivisao — a divisão das novidades entre as três automáticas
//
// As novidades do mês (10 no plano) vêm divididas 4/4/2 entre Aniversário,
// Venda+ e a oferta do Crediário. A lojista mexe com + e −. As regras são
// as mesmas que o servidor aplica ao salvar (ele recusa o que passar), e
// moram aqui como função pura para a tela nunca oferecer um toque que o
// servidor vai recusar:
//
//   - a soma das partes nunca passa do saldo de novidades;
//   - nenhuma parte fica abaixo do que já foi usado no mês;
//   - nenhuma parte fica negativa.
//
// Entrada torta (parte ausente, negativa, fracionada) = divisão inválida
// (null / false): dúvida bloqueia.
// ============================================================

export type AutoKey = "aniversario" | "vendamais" | "crediario";

export const AUTO_KEYS: AutoKey[] = ["aniversario", "vendamais", "crediario"];

export type Partes = Record<AutoKey, number>;

/** Divisão que já vem pronta: Aniversário 4, Venda+ 4, Crediário 2. */
export const DIVISAO_PADRAO: Partes = { aniversario: 4, vendamais: 4, crediario: 2 };

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
  vendamais: "Venda+",
  crediario: "Crediário: vender",
};

export const COR_AUTO: Record<AutoKey, string> = {
  aniversario: "#c4b5fd",
  vendamais: "#f9a8d4",
  crediario: "#6ee7b7",
};

export interface AutomaticasInfo {
  divisao: Partes;
  usadas: Partes;
  ligadas: Record<AutoKey, boolean>;
  linhas: Record<AutoKey, string[]>;
}

/**
 * Lê a resposta de /automaticas. Divisão ou usadas tortas = null (a tela
 * trava). `ligada` ausente = desligada: nunca liga por omissão.
 */
export function lerAutomaticas(raw: any): AutomaticasInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const divisao = lerPartes(raw.divisao);
  const usadas = lerPartes(raw.usadas);
  if (!divisao || !usadas) return null;
  const ligadas = {} as Record<AutoKey, boolean>;
  const linhas = {} as Record<AutoKey, string[]>;
  for (const k of AUTO_KEYS) {
    const a = raw.automaticas && raw.automaticas[k];
    ligadas[k] = !!a && a.ligada === true;
    linhas[k] = a && Array.isArray(a.linhas) ? a.linhas.filter((l: unknown) => typeof l === "string") : [];
  }
  return { divisao, usadas, ligadas, linhas };
}
