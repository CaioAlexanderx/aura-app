// ============================================================
// components/studio/mockupPorProduto/retratoDoModelo.ts
//
// Retrato de um modelo de mockup para as miniaturas (ficha de
// personalização e aba Aparência, 28/09/2026). O VisualTemplateThumb é
// um desenho 2D estilizado — caneca chapada, silhueta de camiseta — e o
// PO viu nele "a versão antiga" do 3D. Aqui a miniatura passa a ser uma
// foto do visualizador 3D de verdade (createModelViewer), tirada num
// canvas fora da tela:
//   - UM retrato por vez, numa fila, com um único contexto WebGL: as
//     peças entram por `trocarPeca` no mesmo viewer, descartado (e o
//     contexto solto) quando a fila esvazia;
//   - pausa entre um retrato e outro, para a página respirar;
//   - guardado por key@versão em memória e no localStorage (JPEG
//     pequeno), para a próxima visita não refazer o trabalho;
//   - 2D: a foto de estúdio do modelo, ou o composeView da peça vetorial.
// Sem web, sem WebGL, ou se o retrato falhar: null, e quem chama segue
// com a miniatura 2D de sempre.
// ============================================================
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import type { VisualTemplate, VisualTemplateSpec } from "@/services/studioVisualApi";
import { createModelViewer, type Mug3DHandle } from "@/components/studio/visualEngine/compose3dMug";
import { composeView } from "@/components/studio/visualEngine/compose2d";
import { readGlbModel } from "@/components/studio/visualEngine/glbModel";

/** Largura do retrato em px. */
export const LARGURA_DO_RETRATO = 176;
/** Altura ÷ largura: a da miniatura da ficha (88 × 67). A Aparência mostra inteiro (contain). */
export const PROPORCAO_DO_RETRATO = 0.76;
export const ALTURA_DO_RETRATO = Math.round(LARGURA_DO_RETRATO * PROPORCAO_DO_RETRATO);
/** Fundo do retrato: o mesmo papel neutro da miniatura 2D. */
export const FUNDO_DO_RETRATO = "#ECEAE4";
/** Pausa entre dois retratos da fila. */
const PAUSA_ENTRE_RETRATOS_MS = 250;
/** Margem da peça em cada lado do retrato (fração do lado). */
export const MARGEM_DO_RETRATO = 0.1;
/** Folga do enquadramento no viewer: sobra para a sombra, que não é da malha. */
const FOLGA_DO_VIEWER = 0.22;
/** Lado maior da textura da peça no retrato (a peça vai sem arte). */
const TEXTURA_DO_RETRATO = 512;
/** Muda quando o retrato mudar de cara: o que estava guardado deixa de valer. */
const VERSAO_DO_RETRATO = "r3"; // r3: recorte pelo alfa (peça e sombra) com margem conferida
const PREFIXO_DO_ARMAZENAMENTO = "aura:studio:retrato:";

type ModeloDoRetrato = Pick<VisualTemplate, "key" | "version" | "kind">;

/** A chave do retrato: muda quando o modelo ganha versão nova. */
export function chaveDoRetrato(t: Pick<VisualTemplate, "key" | "version">): string {
  return VERSAO_DO_RETRATO + "/" + t.key + "@" + (t.version ?? 0);
}

// key@versão → data URL (ou URL da foto) | null (falhou: fica o 2D)
const prontos = new Map<string, string | null>();
const pedidos = new Map<string, Promise<string | null>>();
let fila: Promise<unknown> = Promise.resolve();

// Retratos de versões antigas da chave ocupam o localStorage à toa: saem
// na primeira leitura da sessão.
let antigosLimpos = false;
function limparVersoesAntigas() {
  if (antigosLimpos) return;
  antigosLimpos = true;
  const atual = PREFIXO_DO_ARMAZENAMENTO + VERSAO_DO_RETRATO + "/";
  const velhos: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIXO_DO_ARMAZENAMENTO) && !k.startsWith(atual)) velhos.push(k);
  }
  velhos.forEach((k) => localStorage.removeItem(k));
}

function lerGuardado(chave: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    limparVersoesAntigas();
    return localStorage.getItem(PREFIXO_DO_ARMAZENAMENTO + chave);
  } catch (_e) {
    return null;
  }
}

function guardar(chave: string, url: string) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(PREFIXO_DO_ARMAZENAMENTO + chave, url);
  } catch (_e) { /* cheio ou bloqueado: fica só em memória */ }
}

function esperar(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── Enquadramento pelo resultado ──────────────────────────
// O viewer enquadra a peça pela malha, mas a sombra fica fora da malha
// (sai para o lado da luz): pela conta, a caneca ficava centrada e a
// sombra encostava na borda esquerda, com a sobra toda à direita. Por
// isso o retrato é tirado com folga (fora da tela, em 2x), o que ficou
// no canvas — peça E sombra, pelo alfa — é recortado e posto no centro
// com a margem, e o resultado é conferido nos pixels.

/** Alfa mínimo do que conta como desenhado (a ponta mais fraca da sombra fica de fora). */
const ALFA_DESENHADO = 12;

export type CaixaNaImagem = { x0: number; y0: number; x1: number; y1: number };

/** A caixa dos pixels com alfa acima do limiar (RGBA, linha a linha); null se vazia. */
export function caixaPorAlfa(dados: ArrayLike<number>, w: number, h: number, limiar = ALFA_DESENHADO): CaixaNaImagem | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dados[(y * w + x) * 4 + 3] > limiar) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

export type Conferencia = {
  ok: boolean;
  margens: { esquerda: number; direita: number; topo: number; base: number };
  desvio: { x: number; y: number };
};

/**
 * Sobra de pelo menos `margemMin` (fração do lado) nos quatro lados e o
 * centro do desenho a menos de `desvioMax` do meio.
 */
export function conferirEnquadramento(
  c: CaixaNaImagem, w: number, h: number, margemMin = 0.08, desvioMax = 0.05,
): Conferencia {
  const margens = {
    esquerda: c.x0 / w, direita: (w - 1 - c.x1) / w,
    topo: c.y0 / h, base: (h - 1 - c.y1) / h,
  };
  const desvio = { x: ((c.x0 + c.x1) / 2 - (w - 1) / 2) / w, y: ((c.y0 + c.y1) / 2 - (h - 1) / 2) / h };
  const ok = Math.min(margens.esquerda, margens.direita, margens.topo, margens.base) >= margemMin - 1e-9
    && Math.abs(desvio.x) < desvioMax && Math.abs(desvio.y) < desvioMax;
  return { ok, margens, desvio };
}

/** Os pixels de um canvas (WebGL ou 2D), por uma cópia 2D. */
function pixelsDe(origem: HTMLCanvasElement): Uint8ClampedArray | null {
  const t = document.createElement("canvas");
  t.width = origem.width; t.height = origem.height;
  const ctx = t.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(origem, 0, 0);
  return ctx.getImageData(0, 0, t.width, t.height).data;
}

/**
 * O desenho do canvas (peça e sombra, pelo alfa) recortado e posto no
 * centro do retrato com a margem, sobre o papel neutro, em JPEG. Em
 * desenvolvimento, o resultado é conferido e registrado em
 * `window.__conferenciasDoRetrato` (aviso no console se reprovar).
 */
function paraJpeg(origem: HTMLCanvasElement, rotulo: string): string | null {
  const w = origem.width, h = origem.height;
  if (!(w > 0) || !(h > 0)) return null;
  const dados = pixelsDe(origem);
  const c = (dados && caixaPorAlfa(dados, w, h)) || { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  const cw = c.x1 - c.x0 + 1, ch = c.y1 - c.y0 + 1;
  const cv = document.createElement("canvas");
  cv.width = LARGURA_DO_RETRATO; cv.height = ALTURA_DO_RETRATO;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const k = Math.min(cv.width / cw, cv.height / ch) * (1 - 2 * MARGEM_DO_RETRATO);
  const dw = cw * k, dh = ch * k;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(origem, c.x0, c.y0, cw, ch, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
  conferirNoDesenvolvimento(ctx, cv, rotulo);
  // O papel por baixo do que já está desenhado.
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = FUNDO_DO_RETRATO;
  ctx.fillRect(0, 0, cv.width, cv.height);
  const url = cv.toDataURL("image/jpeg", 0.85);
  return url && url.startsWith("data:image/jpeg") ? url : null;
}

function conferirNoDesenvolvimento(ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement, rotulo: string) {
  if (typeof __DEV__ !== "undefined" && !__DEV__) return;
  try {
    const caixa = caixaPorAlfa(ctx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
    const r = caixa ? conferirEnquadramento(caixa, cv.width, cv.height) : null;
    const w: any = typeof window !== "undefined" ? window : {};
    (w.__conferenciasDoRetrato = w.__conferenciasDoRetrato || []).push({ modelo: rotulo, caixa, ...r });
    if (!r?.ok) console.warn("[retratoDoModelo] enquadramento fora da margem:", rotulo, caixa, r);
  } catch (_e) { /* conferência é só diagnóstico */ }
}

/** Solta o contexto WebGL já — sem esperar o coletor de lixo. */
function soltarContexto(cv: HTMLCanvasElement) {
  try {
    const gl: any = cv.getContext("webgl2") || cv.getContext("webgl");
    gl?.getExtension?.("WEBGL_lose_context")?.loseContext?.();
  } catch (_e) { /* nada a fazer */ }
}

/**
 * A spec com a textura pequena: o retrato não leva arte, e pintar e subir
 * uma textura de 2048 px para uma foto de 176 px só travava a página.
 * Cópia rasa — a spec do cache não muda.
 */
export function specDoRetrato(spec: VisualTemplateSpec): VisualTemplateSpec {
  const m: any = spec.model;
  if (!m) return spec;
  // Os padrões do motor (compose3dMug e glbModel): 2048 × 1024.
  const w = Number(m.texture?.w) || 2048;
  const h = Number(m.texture?.h) || 1024;
  const f = Math.min(1, TEXTURA_DO_RETRATO / Math.max(w, h));
  return { ...spec, model: { ...m, texture: { ...(m.texture || {}), w: Math.round(w * f), h: Math.round(h * f) } } };
}

// O viewer da fila: criado no primeiro retrato 3D, as peças seguintes
// entram por `trocarPeca` na mesma cena (sem recompilar shaders nem
// refazer o ambiente — cada abertura custava ~300 ms de página parada),
// e descartado quando a fila esvazia.
let estudio: { cv: HTMLCanvasElement; viewer: Mug3DHandle } | null = null;
// Foto de produto, a peça inteira centrada com 10% de margem nos quatro
// lados e um pouco de cima. A caneca repousa com a alça à esquerda: gira
// para o 3/4 com a alça à direita. A camiseta repousa de frente: só um
// quarto de volta pequeno, para a frente continuar sendo a frente.
// O viewer deixa folga larga (a sombra cabe); o recorte pelo alfa é que
// põe a margem final.
export function enquadramentoDoRetrato(spec: VisualTemplateSpec) {
  const veste = spec.model?.kind === "glb";
  return { margem: FOLGA_DO_VIEWER, giroGraus: veste ? -18 : 145, elevacaoGraus: veste ? 8 : 16 };
}
function opcoesDoRetrato(spec: VisualTemplateSpec) {
  return { cenario: "nenhum" as const, pixelRatio: 1, retrato: enquadramentoDoRetrato(spec) };
}

function descartarEstudio() {
  if (!estudio) return;
  const { cv, viewer } = estudio;
  estudio = null;
  try { viewer.dispose(); } catch (_e) { /* já foi */ }
  soltarContexto(cv);
}

async function retratar3D(specOriginal: VisualTemplateSpec): Promise<string | null> {
  const spec = specDoRetrato(specOriginal);
  // GLB sem URL utilizável: o motor cai na caneca padrão, e a miniatura de
  // uma camiseta sairia caneca. Melhor ficar o desenho 2D.
  if (spec.model?.kind === "glb" && !readGlbModel(spec)) return null;
  try {
    if (!estudio) {
      const cv = document.createElement("canvas");
      // 2x: o recorte reduz, e a borda sai limpa.
      cv.width = LARGURA_DO_RETRATO * 2;
      cv.height = ALTURA_DO_RETRATO * 2;
      // Sem cenário: só a peça e a sombra de contato, sobre o papel neutro.
      // O estúdio encolhe a peça numa miniatura deste tamanho.
      let viewer: Mug3DHandle;
      try {
        viewer = await createModelViewer(cv, spec, {}, opcoesDoRetrato(spec));
      } catch (e) {
        soltarContexto(cv);
        throw e;
      }
      estudio = { cv, viewer };
    } else {
      await estudio.viewer.trocarPeca(spec, {}, opcoesDoRetrato(spec));
    }
    const { cv, viewer } = estudio;
    viewer.giroAutomatico(false);
    viewer.resize(); // reenquadra depois da pintura (a peça nova já em cena)
    if (!viewer.snapshot(cv.width)) return null;
    return paraJpeg(cv, String(spec.model?.kind || "3d"));
  } catch (e) {
    descartarEstudio(); // a próxima peça começa de uma cena limpa
    throw e;
  }
}

async function retratar2D(spec: VisualTemplateSpec): Promise<string | null> {
  const vista = spec.views?.[0];
  if (!vista) return null;
  // A foto de estúdio do modelo é o melhor retrato que há (como na Aparência).
  if (vista.photo_url) return String(vista.photo_url);
  const cv = document.createElement("canvas");
  // Sem backdrop: a peça vetorial sobre o papel do retrato, que o paraJpeg pinta.
  const r = await composeView(cv, vista, {}, { showAreas: false, pixelWidth: LARGURA_DO_RETRATO * 2, backdrop: null });
  return r ? paraJpeg(cv, "photo2d") : null;
}

/** O retrato já feito (memória ou localStorage), sem pôr nada na fila. */
export function retratoPronto(t: Pick<VisualTemplate, "key" | "version">): string | null | undefined {
  const chave = chaveDoRetrato(t);
  if (prontos.has(chave)) return prontos.get(chave);
  const guardado = lerGuardado(chave);
  if (guardado) { prontos.set(chave, guardado); return guardado; }
  return undefined;
}

/**
 * Pede o retrato do modelo. Um por vez: cada pedido entra no fim da fila
 * e só começa quando o anterior terminou (e a pausa passou).
 */
export function pedirRetrato(t: ModeloDoRetrato, spec: VisualTemplateSpec): Promise<string | null> {
  const chave = chaveDoRetrato(t);
  const ja = retratoPronto(t);
  if (ja !== undefined) return Promise.resolve(ja);
  let p = pedidos.get(chave);
  if (p) return p;
  p = fila.then(async () => {
    let url: string | null = null;
    try {
      url = t.kind === "model3d" ? await retratar3D(spec) : await retratar2D(spec);
    } catch (_e) {
      url = null; // sem WebGL, GLB fora do ar…: fica a miniatura 2D
    }
    prontos.set(chave, url);
    pedidos.delete(chave);
    // Data URL vai para o localStorage; a URL da foto não precisa.
    if (url && url.startsWith("data:")) guardar(chave, url);
    await esperar(PAUSA_ENTRE_RETRATOS_MS);
    if (!pedidos.size) descartarEstudio(); // fila vazia: solta o WebGL
    return url;
  });
  pedidos.set(chave, p);
  fila = p.catch(() => null);
  return p;
}

/** Só para os testes: esquece os retratos em memória e a fila. */
export function limparRetratos() {
  descartarEstudio();
  antigosLimpos = false;
  prontos.clear();
  pedidos.clear();
  fila = Promise.resolve();
}

/**
 * O retrato do modelo para a miniatura: a URL quando pronto, null
 * enquanto não fica (ou se falhou, ou fora da web) — aí quem chama
 * mostra a miniatura 2D. `spec` undefined = ainda chegando.
 */
export function useRetratoDoModelo(
  t: ModeloDoRetrato | null | undefined,
  spec: VisualTemplateSpec | null | undefined,
): string | null {
  const web = Platform.OS === "web";
  const [url, setUrl] = useState<string | null>(() => (web && t ? retratoPronto(t) ?? null : null));
  const chave = t ? chaveDoRetrato(t) : null;
  useEffect(() => {
    if (!web || !t || !spec) { setUrl(null); return; }
    const ja = retratoPronto(t);
    if (ja !== undefined) { setUrl(ja); return; }
    setUrl(null);
    let vivo = true;
    pedirRetrato(t, spec).then((u) => { if (vivo) setUrl(u); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web, chave, spec, t?.kind]);
  return url;
}
