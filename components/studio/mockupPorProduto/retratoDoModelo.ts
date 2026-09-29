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

/** Largura do retrato em px (a altura é a do viewer: 0,78 da largura). */
export const LARGURA_DO_RETRATO = 176;
/** Fundo do retrato: o mesmo papel neutro da miniatura 2D. */
export const FUNDO_DO_RETRATO = "#ECEAE4";
/** Pausa entre dois retratos da fila. */
const PAUSA_ENTRE_RETRATOS_MS = 250;
/** Lado maior da textura da peça no retrato (a peça vai sem arte). */
const TEXTURA_DO_RETRATO = 512;
/** Muda quando o retrato mudar de cara: o que estava guardado deixa de valer. */
const VERSAO_DO_RETRATO = "r1";
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

function lerGuardado(chave: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
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

/** O canvas (WebGL ou 2D) sobre o fundo neutro, em JPEG. */
function paraJpeg(origem: HTMLCanvasElement): string | null {
  const w = origem.width, h = origem.height;
  if (!(w > 0) || !(h > 0)) return null;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = FUNDO_DO_RETRATO;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(origem, 0, 0, w, h);
  const url = cv.toDataURL("image/jpeg", 0.85);
  return url && url.startsWith("data:image/jpeg") ? url : null;
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
const OPCOES_DO_RETRATO = { cenario: "nenhum" as const, pixelRatio: 1 };

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
      cv.width = LARGURA_DO_RETRATO;
      cv.height = Math.round(LARGURA_DO_RETRATO * 0.78);
      // Sem cenário: só a peça e a sombra de contato, sobre o papel neutro.
      // O estúdio encolhe a peça numa miniatura deste tamanho.
      let viewer: Mug3DHandle;
      try {
        viewer = await createModelViewer(cv, spec, {}, OPCOES_DO_RETRATO);
      } catch (e) {
        soltarContexto(cv);
        throw e;
      }
      estudio = { cv, viewer };
    } else {
      await estudio.viewer.trocarPeca(spec, {}, OPCOES_DO_RETRATO);
    }
    const { cv, viewer } = estudio;
    viewer.giroAutomatico(false);
    if (!viewer.snapshot(LARGURA_DO_RETRATO)) return null;
    return paraJpeg(cv);
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
  const r = await composeView(cv, vista, {}, { showAreas: false, pixelWidth: LARGURA_DO_RETRATO, backdrop: FUNDO_DO_RETRATO });
  return r ? paraJpeg(cv) : null;
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
