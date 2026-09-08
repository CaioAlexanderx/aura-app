// ============================================================
// AURA. — Cadastro de item (wizard) · tipos + helpers puros
//
// 08/09/2026 — o AddProductForm (751 linhas) e o AddServiceForm (201)
// viraram UM fluxo guiado de 3 passos (ItemWizardModal), com a DNA do
// TrocaModal. Mockup aprovado: Aura/mockup_cadastro_item_v1.html (v3).
//
// Tudo que é decisão pura mora aqui — margem, duração, gating de passo,
// matriz de variações, última categoria usada, status dos cartões do
// passo 3 — pra ser testável sem montar React. Ver __tests__/cadastroItem.
// ============================================================
import { maskCurrency, unmaskNumber } from "@/utils/masks";

export type ItemType = "product" | "service";
export type StockMode = "single" | "variants";
export type SaveState = null | "busy" | "done";
export type WizardStep = 1 | 2 | 3;
export type CardKey = "photo" | "var" | "desc" | "codes";
export type WizardColor = { hex: string; name: string };

export const DURATION_PRESETS = ["30 min", "45 min", "1h", "1h30", "2h"];
export const DURATION_OTHER = "Outra";

// ── moeda ───────────────────────────────────────────────────
// Serviço passa a usar EXATAMENTE a mesma máscara do produto. O
// AddServiceForm fazia parseFloat(price.replace(",", ".")), então
// "1.234,50" virava 1.234 — um serviço de mil e duzentos reais era
// gravado como um real e vinte e três.
export function mascaraDeValor(n: number): string {
  return maskCurrency(String(Math.round((Number(n) || 0) * 100)));
}

export function valorDaMascara(mascarado: string): number {
  return parseInt(unmaskNumber(mascarado) || "0", 10) / 100;
}

// ── duração de serviço ──────────────────────────────────────
// NÃO existe coluna duration_minutes no backend ainda. A convenção de
// hoje (AddServiceForm) concatena "Duração: X" no fim da descrição;
// mantemos ela pra não perder o dado, e sabemos ler de volta na edição.
const DUR_MARKER = "Duração:";

export function parseDuracao(notes: string | null | undefined): { descricao: string; duracao: string } {
  const txt = notes || "";
  const idx = txt.lastIndexOf(DUR_MARKER);
  if (idx < 0) return { descricao: txt.trim(), duracao: "" };
  const duracao = txt.slice(idx + DUR_MARKER.length).trim();
  let head = txt.slice(0, idx).trim();
  if (head.endsWith("|")) head = head.slice(0, -1).trim();
  return { descricao: head, duracao };
}

export function composeDuracao(descricao: string, duracao: string): string {
  const d = (descricao || "").trim();
  const t = (duracao || "").trim();
  if (!t) return d;
  return (d ? d + " | " : "") + DUR_MARKER + " " + t;
}

// ── margem ao vivo (passo 2) ────────────────────────────────
export type MargemMotivo = "sem-preco" | "sem-custo" | null;
export type Margem = {
  estado: "off" | "ok" | "neg";
  motivo: MargemMotivo;
  pct: number;
  lucro: number;
};

export function calcMargem(preco: number, custo: number): Margem {
  const p = Number(preco) || 0;
  const c = Number(custo) || 0;
  if (p <= 0) return { estado: "off", motivo: "sem-preco", pct: 0, lucro: 0 };
  if (c <= 0) return { estado: "off", motivo: "sem-custo", pct: 0, lucro: 0 };
  const lucro = p - c;
  if (lucro < 0) return { estado: "neg", motivo: null, pct: 0, lucro };
  return { estado: "ok", motivo: null, pct: Math.round((lucro / p) * 100), lucro };
}

// ── navegação entre passos ──────────────────────────────────
export function podeAvancar(step: WizardStep, o: { nome: string; preco: number }): boolean {
  if (step === 1) return !!(o.nome || "").trim();
  if (step === 2) return (Number(o.preco) || 0) > 0;
  return false;
}

// Na edição (ou depois de criado) a barra inteira é clicável; na criação
// só os passos já concluídos.
export function passoClicavel(alvo: WizardStep, atual: WizardStep, liberado: boolean): boolean {
  if (alvo === atual) return false;
  return liberado || alvo < atual;
}

// ── matriz de variações ─────────────────────────────────────
// Mesmo formato de services/productsVariationsApi.matrixKey; a função
// real é injetável (keyFn) pra que o modal use a do serviço e este
// módulo continue sem dependência de rede.
export function chaveDaMatriz(hex: string | null, size: string | null): string {
  return (hex || "") + "|" + (size || "");
}

export function matrizZerada(
  cores: Array<{ hex: string }>,
  tamanhos: string[],
  keyFn: (hex: string | null, size: string | null) => string = chaveDaMatriz
): Record<string, number> {
  const out: Record<string, number> = {};
  const cs = cores || [];
  const zs = tamanhos || [];
  if (cs.length && zs.length) {
    cs.forEach((c) => zs.forEach((z) => { out[keyFn(c.hex, z)] = 0; }));
  } else if (cs.length) {
    cs.forEach((c) => { out[keyFn(c.hex, null)] = 0; });
  } else if (zs.length) {
    zs.forEach((z) => { out[keyFn(null, z)] = 0; });
  }
  return out;
}

// Preserva o que já existia (estoque, código de barras) para as chaves
// que sobreviveram à mudança de cores/tamanhos. Chave que sumiu, some.
export function preservarValores<T>(chaves: string[], anterior: Record<string, T> | undefined | null): Record<string, T> {
  const out: Record<string, T> = {};
  const src = anterior || {};
  chaves.forEach((k) => { if (src[k] !== undefined) out[k] = src[k]; });
  return out;
}

// ── última categoria usada ──────────────────────────────────
// Por empresa + tipo. Web usa localStorage; nativo (e web sem storage)
// cai numa memória de módulo — some ao recarregar, o que é aceitável.
export type UltimaCategoria = {
  primaryCategoryId: string | null;
  alsoInIds: string[];
  legado: string;
};

const memoriaCategoria: Record<string, UltimaCategoria> = {};

export function chaveUltimaCategoria(companyId: string, type: ItemType): string {
  return "aura.cadastroItem.ultimaCategoria." + companyId + "." + type;
}

export function lerUltimaCategoria(companyId: string | undefined | null, type: ItemType): UltimaCategoria | null {
  if (!companyId) return null;
  const k = chaveUltimaCategoria(companyId, type);
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && typeof v === "object") {
          return {
            primaryCategoryId: v.primaryCategoryId ?? null,
            alsoInIds: Array.isArray(v.alsoInIds) ? v.alsoInIds : [],
            legado: String(v.legado || ""),
          };
        }
      }
    }
  } catch (_) { /* storage bloqueado: cai na memória de módulo */ }
  return memoriaCategoria[k] || null;
}

export function gravarUltimaCategoria(companyId: string | undefined | null, type: ItemType, v: UltimaCategoria): void {
  if (!companyId) return;
  const k = chaveUltimaCategoria(companyId, type);
  memoriaCategoria[k] = v;
  try {
    if (typeof localStorage !== "undefined" && localStorage) localStorage.setItem(k, JSON.stringify(v));
  } catch (_) { /* idem */ }
}

// ── códigos ─────────────────────────────────────────────────
export function gerarSku(nome: string): string {
  const prefix = (nome || "").slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X") || "PRD";
  return prefix + "-" + String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
}

export function gerarCodigoServico(): string {
  return "SRV-" + String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
}

// ── status dos cartões do passo 3 ───────────────────────────
export type ChipTom = "" | "ok" | "rec";
export type ChipStatus = { tom: ChipTom; texto: string };

// A API de variações devolve as fotos numa chave "hex|tamanho" — a foto
// é POR COR (aplica em todas as variantes da cor), então qualquer chave
// com aquele hex serve.
export function fotoDaCor(fotosPorCor: Record<string, string> | null | undefined, hex: string): string | null {
  const alvo = (hex || "").toUpperCase();
  const mapa = fotosPorCor || {};
  for (const k of Object.keys(mapa)) {
    if ((k.split("|")[0] || "").toUpperCase() === alvo) return mapa[k];
  }
  return null;
}

export function statusFoto(temFoto: boolean, cores: WizardColor[], fotosPorCor: Record<string, string>): ChipStatus {
  if (!temFoto) return { tom: "rec", texto: "recomendado" };
  const semFoto = (cores || []).filter((c) => !fotoDaCor(fotosPorCor, c.hex)).length;
  if (semFoto > 0) {
    return { tom: "rec", texto: semFoto + (semFoto === 1 ? " cor sem foto" : " cores sem foto") };
  }
  return { tom: "ok", texto: "preenchido" };
}

export function statusVariacoes(cores: WizardColor[], tamanhos: string[], stockMode: StockMode): ChipStatus {
  const n = (cores || []).length + (tamanhos || []).length;
  if (n > 0) {
    const nc = (cores || []).length;
    return { tom: "ok", texto: nc + " " + (nc === 1 ? "cor" : "cores") + " · " + (tamanhos || []).length + " tam." };
  }
  if (stockMode === "variants") return { tom: "rec", texto: "monte a grade" };
  return { tom: "", texto: "vazio" };
}

export function statusDescricao(descricao: string): ChipStatus {
  return (descricao || "").trim()
    ? { tom: "ok", texto: "preenchido" }
    : { tom: "rec", texto: "recomendado" };
}

export function faltaNcm(ncm: string, emiteNota: boolean): boolean {
  return !!emiteNota && (ncm || "").length !== 8;
}

export function statusCodigos(sku: string, ncm: string, emiteNota: boolean): ChipStatus {
  if (faltaNcm(ncm, emiteNota)) return { tom: "rec", texto: "falta NCM" };
  return (sku || "").trim() || (ncm || "").trim()
    ? { tom: "ok", texto: "preenchido" }
    : { tom: "", texto: "vazio" };
}

// ── textos ──────────────────────────────────────────────────
export function nomeDoTipo(type: ItemType): string {
  return type === "product" ? "produto" : "serviço";
}

export function tituloDoModal(type: ItemType, modoEdicao: boolean, criado: boolean): string {
  if (modoEdicao) return type === "product" ? "Editar produto" : "Editar serviço";
  if (criado) return type === "product" ? "Novo produto" : "Novo serviço";
  return "Novo item";
}

export function subtituloDoPasso(step: WizardStep, type: ItemType): string {
  if (step === 1) return "Diga o que é e como se chama";
  if (step === 2) return type === "product" ? "Quanto custa e quanto você tem" : "Quanto custa e quanto tempo leva";
  return "Tudo aqui é opcional e salva sozinho";
}

export function rotulosDosPassos(type: ItemType): string[] {
  return ["O básico", type === "product" ? "Preço e estoque" : "Preço e duração", "Complementos"];
}

export const fmtBRL = (n: number) =>
  "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
