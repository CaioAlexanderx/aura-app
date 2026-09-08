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
import type { ProductImage } from "@/services/productImagesApi";

export type ItemType = "product" | "service";
export type StockMode = "single" | "variants";
export type SaveState = null | "busy" | "done";
export type WizardStep = 1 | 2 | 3;
export type CardKey = "photo" | "var" | "desc" | "codes";
export type WizardColor = { hex: string; name: string };

// Os chips do passo 2, em MINUTOS. O rótulo é derivado (minutosParaRotulo)
// pra que a tela e a coluna nunca discordem: "1h30" e 90 são a mesma coisa
// escrita de dois jeitos, e só um dos dois vai para o banco.
export const DURATION_PRESET_MIN = [30, 45, 60, 90, 120];
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
// 09/09/2026 — migration 323: `products.duration_minutes` existe. A
// duração deixou de ser texto colado no fim da descrição e virou número.
//
// O QUE MUDA PRA QUEM JÁ CADASTROU: nada na hora. A descrição antiga
// continua com "… | Duração: 45 min"; a edição LÊ esse sufixo, mostra o
// chip certo e, na próxima gravação, escreve a coluna e tira o sufixo do
// texto (lerDuracaoDoServico decide isso). Nada é escrito no formato
// antigo a partir de agora.
const DUR_MARKER = "Duração:";

/** Separa "Corte | Duração: 45 min" em descrição e duração (leitura do legado). */
export function parseDuracao(notes: string | null | undefined): { descricao: string; duracao: string } {
  const txt = notes || "";
  const idx = txt.lastIndexOf(DUR_MARKER);
  if (idx < 0) return { descricao: txt.trim(), duracao: "" };
  const duracao = txt.slice(idx + DUR_MARKER.length).trim();
  let head = txt.slice(0, idx).trim();
  if (head.endsWith("|")) head = head.slice(0, -1).trim();
  return { descricao: head, duracao };
}

// Um dia. Acima disso é dedo escorregado ("100" horas, "3000") — e um
// número absurdo na coluna some da tela sem ninguém perceber.
const MAX_DURACAO_MIN = 24 * 60;

/**
 * O que a lojista escreveu, em minutos — ou null quando não dá pra
 * entender ("meio período", "sob consulta"). Entende "45", "45 min",
 * "1h", "1h30", "2 horas", "1,5h".
 *
 * null NÃO é erro de digitação necessariamente: é o sinal de "isto não
 * vira número", e quem chama decide (o passo 2 mostra uma dica e deixa o
 * chip apagado; a leitura do legado deixa o texto na descrição).
 */
export function duracaoParaMinutos(texto: string | null | undefined): number | null {
  const t = String(texto == null ? "" : texto).trim().toLowerCase().replace(",", ".");
  if (!t) return null;

  const limite = (n: number) => (n > 0 && n <= MAX_DURACAO_MIN ? n : null);

  // "1h", "1h30", "1 h 30 min", "2 horas"
  const hm = t.match(/^(\d+)\s*(?:h|hs|hora|horas)\s*(\d+)?\s*(?:m|min|mins|minuto|minutos)?$/);
  if (hm) {
    const m = hm[2] ? parseInt(hm[2], 10) : 0;
    if (m >= 60) return null;
    return limite(parseInt(hm[1], 10) * 60 + m);
  }

  // "1.5h" / "0,5 hora"
  const dec = t.match(/^(\d+\.\d+)\s*(?:h|hs|hora|horas)$/);
  if (dec) return limite(Math.round(parseFloat(dec[1]) * 60));

  // "45", "45 min", "90 minutos"
  const mm = t.match(/^(\d+)\s*(?:m|min|mins|minuto|minutos)?$/);
  if (mm) return limite(parseInt(mm[1], 10));

  return null;
}

/** 90 → "1h30". O rótulo do chip e o que aparece no rodapé. */
export function minutosParaRotulo(minutos: number | null | undefined): string {
  const n = Number(minutos);
  if (!Number.isFinite(n) || n <= 0) return "";
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  if (h === 0) return m + " min";
  if (m === 0) return h + "h";
  return h + "h" + String(m).padStart(2, "0");
}

export type LeituraDeDuracao = {
  /** Descrição já sem o sufixo legado — quando o sufixo pôde ser convertido. */
  descricao: string;
  /** O que vai no campo/chip de duração. "" quando não há duração. */
  duracaoTxt: string;
  minutos: number | null;
  /** true = veio do sufixo antigo e a próxima gravação migra pra coluna. */
  migrandoDoLegado: boolean;
};

/**
 * De onde sai a duração ao abrir um serviço para edição.
 *
 * Ordem: a coluna manda. Sem coluna, tenta o sufixo antigo — e SÓ tira o
 * sufixo da descrição se ele virar número. Um "Duração: meio período"
 * não vira coluna nenhuma, então continua sendo parte da descrição:
 * migrar apagando o que a lojista escreveu seria pior que não migrar.
 */
export function lerDuracaoDoServico(
  notes: string | null | undefined,
  durationMinutes: number | null | undefined
): LeituraDeDuracao {
  const bruto = notes || "";
  const { descricao, duracao } = parseDuracao(bruto);

  const daColuna = durationMinutes === null || durationMinutes === undefined
    ? null
    : duracaoParaMinutos(String(durationMinutes));
  if (daColuna != null) {
    return { descricao, duracaoTxt: minutosParaRotulo(daColuna), minutos: daColuna, migrandoDoLegado: false };
  }

  const doLegado = duracaoParaMinutos(duracao);
  if (doLegado != null) {
    return { descricao, duracaoTxt: minutosParaRotulo(doLegado), minutos: doLegado, migrandoDoLegado: true };
  }

  return { descricao: bruto.trim(), duracaoTxt: "", minutos: null, migrandoDoLegado: false };
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

// ── galeria de fotos por cor (migration 323) ────────────────
//
// QUATRO É O TETO, DUAS É A SUGESTÃO. O servidor recusa a quinta foto de
// uma cor; a tela nunca recusa nada — ela só rotula os dois primeiros
// espaços vazios ("frente" e "no corpo"; na principal, "capa" e "no
// corpo") pra dizer o que costuma vender. Quem fotografou quatro ângulos
// do mesmo tênis não pode levar bronca por isso.
export const MAX_FOTOS_POR_COR = 4;
export const SUGESTAO_DE_FOTOS = 2;

/** As chaves de `by_color` vêm em minúsculo; o wizard guarda hex em CAIXA ALTA. */
export function chaveDaCor(hex: string | null | undefined): string {
  return String(hex == null ? "" : hex).trim().toLowerCase();
}

export function fotosDaCor(
  porCor: Record<string, ProductImage[]> | null | undefined,
  hex: string
): ProductImage[] {
  return (porCor || {})[chaveDaCor(hex)] || [];
}

/** A capa (posição 0) — é ela que espelha image_url no resto do sistema. */
export function capaDa(fotos: ProductImage[] | null | undefined): ProductImage | null {
  const f = fotos || [];
  return f.length ? f[0] : null;
}

/**
 * Quantos quadradinhos a linha desenha: as fotos que existem mais um
 * espaço vazio — nunca menos que a sugestão de duas, pra que "no corpo"
 * apareça já na primeira vez, e nunca mais que o teto de quatro.
 */
export function contarSlots(quantasFotos: number): number {
  const n = Math.max(0, Math.min(MAX_FOTOS_POR_COR, Number(quantasFotos) || 0));
  if (n >= MAX_FOTOS_POR_COR) return MAX_FOTOS_POR_COR;
  return Math.min(MAX_FOTOS_POR_COR, Math.max(n + 1, SUGESTAO_DE_FOTOS));
}

/** O rótulo do espaço vazio. "" = só o "+", sem sugestão nenhuma. */
export function rotuloDoSlot(indice: number, principal: boolean): string {
  if (indice === 0) return principal ? "capa" : "frente";
  if (indice === 1) return "no corpo";
  return "";
}

/**
 * O selo do cartão Foto.
 *
 * A ordem importa: sem capa nada mais é urgente; depois, cor NENHUMA
 * foto (a loja mostra a foto principal no lugar da cor errada); só então
 * a sugestão de segunda foto, que é conselho, não cobrança.
 */
export function statusGaleria(
  principal: ProductImage[] | null | undefined,
  cores: WizardColor[] | null | undefined,
  porCor: Record<string, ProductImage[]> | null | undefined
): ChipStatus {
  if ((principal || []).length === 0) return { tom: "rec", texto: "recomendado" };

  const cs = cores || [];
  const semFoto = cs.filter((c) => fotosDaCor(porCor, c.hex).length === 0).length;
  if (semFoto > 0) {
    return { tom: "rec", texto: semFoto + (semFoto === 1 ? " cor sem foto" : " cores sem foto") };
  }

  const soUma = cs.find((c) => fotosDaCor(porCor, c.hex).length === 1);
  if (soUma) return { tom: "rec", texto: (soUma.name || soUma.hex) + ": só 1 foto" };

  return { tom: "ok", texto: "preenchido" };
}

/**
 * A lista COMPLETA de ids na ordem nova, com uma foto movida para
 * `destino` — é o corpo do PATCH /images/reorder, que recusa lista
 * parcial (sem todas, duas fotos disputariam a posição 0).
 *
 * `destino` 0 é "Tornar capa"; as setas mandam índice ± 1.
 */
export function idsComFotoEm(
  fotos: ProductImage[] | null | undefined,
  id: string,
  destino: number
): string[] {
  const ids = (fotos || []).map((f) => f.id);
  const de = ids.indexOf(id);
  if (de < 0) return ids;
  const alvo = Math.max(0, Math.min(ids.length - 1, Math.trunc(Number(destino) || 0)));
  if (alvo === de) return ids;
  const out = ids.slice();
  out.splice(de, 1);
  out.splice(alvo, 0, id);
  return out;
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
