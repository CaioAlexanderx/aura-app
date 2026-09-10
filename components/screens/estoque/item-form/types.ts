// ============================================================
// AURA. — Cadastro de item (formulário aberto) · tipos + helpers puros
//
// 09/09/2026 — O WIZARD DE TRÊS PASSOS DUROU UM DIA. Cadastrar ficou mais
// lento (três telas, um clique entre cada, o item nascendo no meio do
// caminho e os complementos só depois) e editar não tinha fluxo nenhum.
// O conteúdo ficou; o layout virou UMA tela com tudo à vista e um botão
// só: Salvar. Mockup aprovado: Aura/mockup_cadastro_item_v4_aberto.html.
//
// Tudo que é decisão pura mora aqui — margem, duração, matriz de
// variações, última categoria usada, os selos de cada seção, o que
// impede o Salvar, a ordem em que as fotos escolhidas sobem e o
// breakpoint das duas colunas — pra ser testável sem montar React.
// Ver __tests__/cadastroItemAberto.test.ts.
// ============================================================
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import type { ProductImage } from "@/services/productImagesApi";

export type ItemType = "product" | "service";
export type StockMode = "single" | "variants";
export type CorDoItem = { hex: string; name: string };

// Os chips de duração, em MINUTOS. O rótulo é derivado (minutosParaRotulo)
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

// ── selos das seções ────────────────────────────────────────
// "err" é o que impede o Salvar (e aparece também no rodapé); "rec" é
// conselho; "ok" é confirmação. `null` = seção sem selo nenhum, que é o
// estado normal de quem preencheu o obrigatório e não quis o resto.
export type ChipTom = "" | "ok" | "rec" | "err";
export type ChipStatus = { tom: ChipTom; texto: string };
export type Selo = ChipStatus | null;

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
 * O selo da seção Fotos.
 *
 * A ordem importa: sem capa nada mais é urgente; depois, cor NENHUMA
 * foto (a loja mostra a foto principal no lugar da cor errada); só então
 * a sugestão de segunda foto, que é conselho, não cobrança.
 */
export function statusFotos(
  principal: ProductImage[] | null | undefined,
  cores: CorDoItem[] | null | undefined,
  porCor: Record<string, ProductImage[]> | null | undefined
): Selo {
  return seloDeFotos(
    (principal || []).length,
    (cores || []).map((c) => fotosDaCor(porCor, c.hex).length)
  );
}

/**
 * O mesmo selo a partir das contagens — é o que o cadastro usa, onde as
 * fotos ainda estão na fila em memória e não existe ProductImage nenhum.
 */
export function seloDeFotos(principais: number, contagensPorCor: number[]): Selo {
  if ((Number(principais) || 0) === 0) return { tom: "rec", texto: "recomendado" };

  const cs = contagensPorCor || [];
  const semFoto = cs.filter((n) => (Number(n) || 0) === 0).length;
  if (semFoto > 0) {
    return { tom: "rec", texto: semFoto + (semFoto === 1 ? " cor sem foto" : " cores sem foto") };
  }

  const soUma = cs.filter((n) => Number(n) === 1).length;
  if (soUma > 0) {
    return { tom: "rec", texto: soUma + (soUma === 1 ? " cor com só 1" : " cores com só 1") };
  }

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

// ── selos, um por seção ──────────────────────────
export function statusItem(nome: string): Selo {
  return (nome || "").trim() ? null : { tom: "err", texto: "falta o nome" };
}

export function statusPreco(preco: number): Selo {
  return (Number(preco) || 0) > 0 ? null : { tom: "err", texto: "falta o preço" };
}

/**
 * O selo de Estoque conta o que a lojista montou, não o que falta:
 * "2 cores · 3 tam." é a confirmação de que a grade existe. Em
 * quantidade única, estoque zerado não é erro nenhum (peça encomendada
 * ainda não chegou), então o selo simplesmente some.
 */
export function statusEstoque(
  stockMode: StockMode,
  cores: CorDoItem[] | null | undefined,
  tamanhos: string[] | null | undefined,
  quantidade: string
): Selo {
  if (stockMode === "variants") {
    const nc = (cores || []).length;
    const nz = (tamanhos || []).length;
    if (nc + nz === 0) return { tom: "rec", texto: "adicione cores ou tamanhos" };
    return { tom: "ok", texto: nc + (nc === 1 ? " cor · " : " cores · ") + nz + " tam." };
  }
  return (quantidade || "").trim() ? { tom: "ok", texto: "preenchido" } : null;
}

export function statusDescricao(descricao: string): Selo {
  return (descricao || "").trim()
    ? { tom: "ok", texto: "preenchido" }
    : { tom: "rec", texto: "recomendado" };
}

export function faltaNcm(ncm: string, emiteNota: boolean): boolean {
  return !!emiteNota && (ncm || "").length !== 8;
}

export function statusCodigos(sku: string, ncm: string, emiteNota: boolean): Selo {
  if (faltaNcm(ncm, emiteNota)) return { tom: "rec", texto: "falta NCM" };
  return (sku || "").trim() || (ncm || "").trim()
    ? { tom: "ok", texto: "preenchido" }
    : null;
}

// ── o que impede o Salvar ───────────────────────
//
// Nome e preço. Só. O NCM entra na lista apenas quando a lojista COMEÇOU
// a escrever um e parou no meio — oito dígitos ou nenhum; um NCM pela
// metade seria recusado na emissão da nota, longe daqui.
export type Bloqueios = {
  nome: string;
  preco: number;
  ncm?: string;
  isProduto: boolean;
};

export function motivosQueBloqueiam(o: Bloqueios): string[] {
  const f: string[] = [];
  if (!(o.nome || "").trim()) f.push("o nome");
  if (!((Number(o.preco) || 0) > 0)) f.push("o preço");
  const ncm = o.ncm || "";
  if (o.isProduto && ncm.length > 0 && ncm.length !== 8) f.push("o NCM com 8 dígitos");
  return f;
}

/** "Falta o nome e o preço para salvar". "" quando nada bloqueia. */
export function textoDoBloqueio(motivos: string[]): string {
  const f = motivos || [];
  if (!f.length) return "";
  const lista = f.length === 1 ? f[0] : f.slice(0, -1).join(", ") + " e " + f[f.length - 1];
  return "Falta " + lista + " para salvar";
}

/**
 * A linha do rodapé quando nada bloqueia, no cadastro: o que vai ser
 * criado, numa linha só. Na edição o rodapé fala de alterações
 * (textoDeEdicao), porque lá o resumo já é a tela inteira.
 */
export function resumoDoItem(o: {
  nome: string;
  preco: number;
  isProduto: boolean;
  stockMode: StockMode;
  cores: CorDoItem[];
  tamanhos: string[];
  minutos: number | null;
}): string {
  const partes = [(o.nome || "").trim(), fmtBRL(o.preco)];
  if (o.isProduto) {
    const nc = (o.cores || []).length;
    const nz = (o.tamanhos || []).length;
    if (o.stockMode === "variants" && nc + nz > 0) {
      partes.push(nc + (nc === 1 ? " cor" : " cores") + " · " + nz + " tam.");
    }
  } else {
    const dur = minutosParaRotulo(o.minutos);
    if (dur) partes.push(dur);
  }
  return partes.join(" · ");
}

export function textoDeEdicao(sujo: boolean): string {
  return sujo ? "Alterações não salvas" : "Tudo salvo";
}

// ── duas colunas ───────────────────────────────
//
// 900px é onde a coluna da direita (fotos e códigos) ainda cabe sem
// espremer a da esquerda. Abaixo disso — e em qualquer tela nativa — é
// uma coluna só, na ordem de quem cadastra rápido, e o painel vira
// folha de baixo.
export const LARGURA_DUAS_COLUNAS = 900;

export function usaDuasColunas(largura: number, ehWeb: boolean): boolean {
  return !!ehWeb && (Number(largura) || 0) >= LARGURA_DUAS_COLUNAS;
}

// ── fila de fotos escolhidas antes de existir o produto ───
//
// No cadastro não há id ainda, então a foto escolhida fica na memória e
// sobe DEPOIS do POST, uma de cada vez. A ordem importa: a galeria
// principal primeiro (a posição 0 dela é a capa que a vitrine, o PDV e o
// catálogo do WhatsApp leem), e as cores na ordem em que foram criadas.
export type FotoPendente = {
  id: string;
  /** null = galeria principal. */
  corHex: string | null;
  base64: string;
  contentType: string;
};

export function ordenarFilaDeFotos(fila: FotoPendente[], ordemDasCores: string[]): FotoPendente[] {
  const rank: Record<string, number> = {};
  (ordemDasCores || []).forEach((h, i) => { rank[chaveDaCor(h)] = i; });
  const grande = (ordemDasCores || []).length + 1;
  return (fila || [])
    .map((f, i) => ({
      f,
      i,
      r: f.corHex == null ? -1 : (rank[chaveDaCor(f.corHex)] === undefined ? grande : rank[chaveDaCor(f.corHex)]),
    }))
    .sort((a, b) => (a.r - b.r) || (a.i - b.i))
    .map((x) => x.f);
}

/** "Subindo fotos 2 de 5" — a 2 é a que está subindo, não a que acabou. */
export function rotuloDoProgresso(feitas: number, total: number): string {
  const t = Math.max(0, Number(total) || 0);
  if (!t) return "";
  const atual = Math.min(t, Math.max(1, (Number(feitas) || 0) + 1));
  return "Subindo fotos " + atual + " de " + t;
}

// ── grade de estoque local ───────────────────────
//
// A grade é estado LOCAL nos dois modos (cadastro e edição) e vai
// inteira no PUT /variations do Salvar. Foi assim que o "salva sozinho a
// cada campo" saiu do caminho: digitar 12 numa célula não dispara
// requisição nenhuma até o Salvar.

/** Célula vazia é zero; o que não é número é zero também. */
export function numeroDaCelula(txt: string | number | null | undefined): number {
  const n = parseInt(String(txt == null ? "" : txt).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A matriz que vai no PUT: uma entrada por combinação viva, com o que
 * está digitado na tela; célula em branco herda o que veio do servidor
 * (ou zero), combinação que sumiu não vai.
 */
export function matrizDaGrade(
  cores: Array<{ hex: string }>,
  tamanhos: string[],
  celulas: Record<string, string>,
  anterior: Record<string, number> | null | undefined,
  keyFn: (hex: string | null, size: string | null) => string = chaveDaMatriz
): Record<string, number> {
  const zerada = matrizZerada(cores, tamanhos, keyFn);
  const out: Record<string, number> = {};
  Object.keys(zerada).forEach((k) => {
    const digitado = (celulas || {})[k];
    if (digitado === undefined || digitado === "") {
      const antes = (anterior || {})[k];
      out[k] = antes === undefined ? 0 : antes;
    } else {
      out[k] = numeroDaCelula(digitado);
    }
  });
  return out;
}

// ── textos ──────────────────────────────────
export function nomeDoTipo(type: ItemType): string {
  return type === "product" ? "produto" : "serviço";
}

export function tituloDoModal(type: ItemType, modoEdicao: boolean): string {
  if (!modoEdicao) return "Novo item";
  return type === "product" ? "Editar produto" : "Editar serviço";
}

export function subtituloDoModal(modoEdicao: boolean): string {
  return modoEdicao
    ? "Fotos salvam na hora. O resto, no Salvar."
    : "Nome e preço bastam. O resto você completa quando quiser.";
}

export function rotuloDoBotaoSalvar(type: ItemType, modoEdicao: boolean): string {
  return modoEdicao ? "Salvar alterações" : "Salvar " + nomeDoTipo(type);
}

export const fmtBRL = (n: number) =>
  "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── produto antigo: cor e tamanho gravados NO PRÓPRIO produto ──
//
// 10/09/2026 — suporte: a cliente abria a edição e não via as cores e o
// tamanho que o item já tinha. Medido no banco nesse dia: 4.858 produtos
// em 7 empresas guardam cor e/ou tamanho nas colunas do próprio produto
// (o AddProductForm antigo tinha "Cor principal" e "Tamanho"), sem
// nenhuma variação. A grade antiga (ProductVariationsSection, 08/05/2026)
// mesclava isso na tela, e o PUT /variations formaliza a combinação como
// variação e limpa color/size do pai. O formulário aberto não lia essas
// colunas: a edição abria com "Quantidade única" e nada de cor.

/** Chave da grade com o hex em caixa alta: "#abcdef|M" -> "#ABCDEF|M". */
export function normalizarChaveDaGrade(k: string): string {
  const i = String(k).indexOf("|");
  if (i < 0) return String(k);
  return k.slice(0, i).toUpperCase() + k.slice(i);
}

/** Mesma normalização para um mapa inteiro (matriz ou códigos de barras). */
export function normalizarMapaDaGrade<T>(mapa: Record<string, T> | null | undefined): Record<string, T> {
  const out: Record<string, T> = {};
  const src = mapa || {};
  Object.keys(src).forEach((k) => { out[normalizarChaveDaGrade(k)] = src[k]; });
  return out;
}

export function totalDaMatriz(m: Record<string, number> | null | undefined): number {
  return Object.keys(m || {}).reduce((acc, k) => acc + (Number((m as Record<string, number>)[k]) || 0), 0);
}

export type MesclaDoPai = {
  cores: CorDoItem[];
  tamanhos: string[];
  celulas: Record<string, string>;
  /** true quando algo do pai entrou na grade: o Salvar precisa gravá-la. */
  mesclou: boolean;
  aviso: string | null;
};

/**
 * Leva a cor e o tamanho gravados no produto para a grade local.
 *
 * - Cor em nome ("Preto") passa por nomeParaHex; cor irreconhecível fica
 *   de fora (o tamanho ainda entra).
 * - O estoque do pai só entra quando o produto NÃO tem variações: com
 *   variações, `stock` já é a soma delas e jogá-la numa célula duplicaria
 *   o estoque.
 * - A célula só é preenchida se a combinação existe na grade final e
 *   ainda está vazia ou zerada.
 */
export function mesclarPaiNaGrade(o: {
  cores: CorDoItem[];
  tamanhos: string[];
  celulas: Record<string, string>;
  paiCor: string | null | undefined;
  paiTamanho: string | null | undefined;
  paiEstoque: number | null | undefined;
  nomeParaHex: (nome: string) => string | null;
  hexParaNome: (hex: string) => string;
  keyFn?: (hex: string | null, size: string | null) => string;
}): MesclaDoPai {
  const keyFn = o.keyFn || chaveDaMatriz;
  const semMudanca: MesclaDoPai = { cores: o.cores, tamanhos: o.tamanhos, celulas: o.celulas, mesclou: false, aviso: null };

  const corBruta = String(o.paiCor || "").trim();
  const hexLido = corBruta ? o.nomeParaHex(corBruta) : null;
  const hex = hexLido && /^#[0-9A-Fa-f]{6}$/.test(hexLido) ? hexLido.toUpperCase() : null;
  const tam = String(o.paiTamanho || "").trim() || null;
  if (!hex && !tam) return semMudanca;

  const cores = [...(o.cores || [])];
  const tamanhos = [...(o.tamanhos || [])];
  const celulas = { ...(o.celulas || {}) };
  const nomeCor = hex ? (o.hexParaNome(hex) || hex) : null;
  let mesclou = false;

  if (hex && !cores.some((c) => String(c.hex).toUpperCase() === hex)) {
    cores.push({ hex, name: nomeCor as string });
    mesclou = true;
  }
  if (tam && tamanhos.indexOf(tam) < 0) {
    tamanhos.push(tam);
    mesclou = true;
  }

  const estoque = Math.max(0, Math.floor(Number(o.paiEstoque) || 0));
  let colocouEstoque = false;
  if (estoque > 0) {
    const matriz = cores.length > 0 && tamanhos.length > 0;
    // Em grade cor × tamanho, só existe célula se o pai tem os dois.
    const k = matriz
      ? (hex && tam ? keyFn(hex, tam) : null)
      : (cores.length ? (hex ? keyFn(hex, null) : null) : (tam ? keyFn(null, tam) : null));
    if (k && numeroDaCelula(celulas[k]) === 0) {
      celulas[k] = String(estoque);
      colocouEstoque = true;
      mesclou = true;
    }
  }

  if (!mesclou) return semMudanca;

  // Sem particípio: "cor" e "tamanho" têm gêneros diferentes. O estoque
  // só aparece no aviso quando ele de fato entrou numa célula.
  const partes = [nomeCor ? "cor " + nomeCor : null, tam ? "tamanho " + tam : null].filter(Boolean) as string[];
  const rotulo = partes.join(" · ");
  const aviso = rotulo.charAt(0).toUpperCase() + rotulo.slice(1)
    + (colocouEstoque ? " (" + estoque + " un)" : "")
    + (partes.length > 1 ? " estavam" : " estava")
    + " no cadastro do produto, fora da grade. Ao salvar, vira uma variação"
    + (colocouEstoque ? " com o mesmo estoque." : ".");
  return { cores, tamanhos, celulas, mesclou: true, aviso };
}
