// ============================================================
// waAutomaticaConfig — as escolhas de cada automática, como o servidor guarda
//
// Contrato do agente B (`config` de cada automática):
//   aniversario       { tom: carinhoso|direto|animado, presente, passos: {antes, dia, depois} }
//   venda_mais        { segmento: sumindo|sumiu, presente, automatico }
//   crediario_cobrar  { pontos: {antes3, dia, depois1, depois7, depois15} }
//   crediario_vender  { dia_do_mes, presente }
// `presente` = { tipo: "percent"|"fixed", valor } ou null (sem presente).
//
// Tudo aqui é leitura pura: valor torto devolve null/padrão seguro e a tela
// nunca "marca" uma escolha que o servidor não confirmou.
// ============================================================

export type PresenteChave = "percent-10" | "percent-15" | "fixed-20" | "nenhum";

export interface PresenteRaw { tipo?: string; valor?: number }

export const OPCOES_PRESENTE: { valor: PresenteChave; rotulo: string }[] = [
  { valor: "percent-10", rotulo: "10% de desconto" },
  { valor: "percent-15", rotulo: "15% de desconto" },
  { valor: "fixed-20", rotulo: "R$ 20 de desconto" },
  { valor: "nenhum", rotulo: "Sem presente" },
];

/** Presente do servidor -> chave da pílula. Ausente/null = sem presente; desconhecido = null (nada marcado). */
export function chaveDoPresente(p: PresenteRaw | null | undefined): PresenteChave | null {
  if (p === null || p === undefined) return "nenhum";
  if (typeof p !== "object") return null;
  const k = `${p.tipo}-${p.valor}`;
  return OPCOES_PRESENTE.some((o) => o.valor === k) ? (k as PresenteChave) : null;
}

export function presenteDaChave(k: PresenteChave): PresenteRaw | null {
  if (k === "nenhum") return null;
  const [tipo, valor] = k.split("-");
  return { tipo, valor: Number(valor) };
}

export function rotuloDoPresente(p: PresenteRaw | null | undefined): string | null {
  const k = chaveDoPresente(p);
  if (!k || k === "nenhum") return null;
  return OPCOES_PRESENTE.find((o) => o.valor === k)!.rotulo;
}

// ── Aniversário ──
export type TomAniversario = "carinhoso" | "direto" | "animado";
export const OPCOES_TOM: { valor: TomAniversario; rotulo: string }[] = [
  { valor: "carinhoso", rotulo: "Carinhoso" },
  { valor: "direto", rotulo: "Direto" },
  { valor: "animado", rotulo: "Animado" },
];

export interface PassosAniversario { antes: boolean; dia: boolean; depois: boolean }

export function lerTom(v: unknown): TomAniversario | null {
  return v === "carinhoso" || v === "direto" || v === "animado" ? v : null;
}

/** Passos do servidor. Torto = null (nada marcado, nada enviado). */
export function lerPassos(v: any): PassosAniversario | null {
  if (!v || typeof v !== "object") return null;
  if (typeof v.antes !== "boolean" || typeof v.dia !== "boolean" || typeof v.depois !== "boolean") return null;
  return { antes: v.antes, dia: v.dia, depois: v.depois };
}

export function quantosPassos(p: PassosAniversario): number {
  return (p.antes ? 1 : 0) + (p.dia ? 1 : 0) + (p.depois ? 1 : 0);
}

/** Alterna um passo. Nunca desliga o último: aniversário sem passo não manda nada. */
export function alternarPasso(p: PassosAniversario, k: keyof PassosAniversario): PassosAniversario {
  const prox = { ...p, [k]: !p[k] };
  return quantosPassos(prox) === 0 ? p : prox;
}

/** Chave do modelo do corpo do aniversário para o tom e com/sem presente. */
export function modeloDoAniversario(tom: TomAniversario, comPresente: boolean): string {
  return `aniv_${tom}_${comPresente ? "com" : "sem"}`;
}

// ── Venda+ ──
export type SegmentoVenda = "sumindo" | "sumiu";
export const OPCOES_SEGMENTO: { valor: SegmentoVenda; rotulo: string; meta: string }[] = [
  { valor: "sumindo", rotulo: "Sumindo", meta: "31 a 60 dias sem comprar" },
  { valor: "sumiu", rotulo: "Sumiu", meta: "Mais de 60 dias" },
];

export function lerSegmento(v: unknown): SegmentoVenda | null {
  return v === "sumindo" || v === "sumiu" ? v : null;
}

export function modeloDaVenda(seg: SegmentoVenda, comPresente: boolean): string {
  return `venda_${seg}_${comPresente ? "com" : "sem"}`;
}

// ── Crediário: cobrar ──
export interface PontosCobranca { antes3: boolean; dia: boolean; depois1: boolean; depois7: boolean; depois15: boolean }

export const PONTOS_ROTULO: { k: keyof PontosCobranca; rotulo: string }[] = [
  { k: "antes3", rotulo: "3 dias antes" },
  { k: "dia", rotulo: "No dia" },
  { k: "depois1", rotulo: "1 dia depois" },
  { k: "depois7", rotulo: "7 dias depois" },
  { k: "depois15", rotulo: "15 dias depois" },
];

export function lerPontos(v: any): PontosCobranca | null {
  if (!v || typeof v !== "object") return null;
  const out: any = {};
  for (const { k } of PONTOS_ROTULO) {
    if (typeof v[k] !== "boolean") return null;
    out[k] = v[k];
  }
  return out as PontosCobranca;
}

export function alternarPonto(p: PontosCobranca, k: keyof PontosCobranca): PontosCobranca {
  return { ...p, [k]: !p[k] };
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
/** "2026-12" -> "Dezembro". Torto = mês de hoje. */
export function nomeDoMes(mes: string | null | undefined, hoje: Date = new Date()): string {
  const m = /^\d{4}-(\d{2})$/.exec(String(mes || ""));
  const i = m ? Number(m[1]) - 1 : hoje.getMonth();
  return MESES[i >= 0 && i <= 11 ? i : hoje.getMonth()];
}
