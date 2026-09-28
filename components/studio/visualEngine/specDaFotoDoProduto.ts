// ============================================================
// AURA STUDIO · visualEngine/specDaFotoDoProduto — mockup na foto real
//
// A lojista marca, na foto da própria peça, onde a arte cai
// (`customization_config.mockup_foto`). Este módulo transforma essa
// marcação numa VisualTemplateSpec `photo2d` comum — a mesma forma dos
// templates do banco —, para que o motor (compose2d), a vitrine, o
// painel e o render HD da aprovação desenhem pelo mesmo caminho, sem um
// motor paralelo para "foto da lojista".
//
// Precedência (fonteDoMockup): template do banco vinculado ao produto >
// mockup na foto > o preview de sempre. O template do banco é trabalho
// da Aura com foto de estúdio; quando existe, ele manda.
//
// 27/09/2026
// ============================================================
import { useEffect, useMemo, useState } from "react";
import type { CustomizationConfig } from "@/services/studioApi";
import type {
  MockupFoto,
  MockupFotoLado,
  VisualQuad,
  VisualTemplate,
  VisualTemplateSpec,
  VisualView,
} from "@/services/studioVisualApi";
import { caixaDoQuad, carregarImagemDoMotor, quadValido } from "./compose2d";

export type LadoDaPeca = "front" | "back" | "middle";
export type MedidasDaFoto = { w: number; h: number };

/** A base da vista é o tamanho natural da foto, com este teto de largura. */
export const LARGURA_MAXIMA_DA_BASE = 1600;
/** Força do "Assentar na foto" quando a lojista não mexeu no controle. */
export const FORCA_PADRAO_DO_SOMBREADO = 0.6;

const ROTULO: Record<LadoDaPeca, string> = { front: "Frente", back: "Verso", middle: "Meio" };

function medidaValida(w: unknown, h: unknown): MedidasDaFoto | null {
  const nw = Number(w), nh = Number(h);
  return Number.isFinite(nw) && Number.isFinite(nh) && nw > 0 && nh > 0 ? { w: nw, h: nh } : null;
}

/** Tamanho natural limitado a 1600 px de largura, mantendo a proporção. */
export function baseDaFoto(m: MedidasDaFoto): MedidasDaFoto {
  const w = Math.min(Math.round(m.w), LARGURA_MAXIMA_DA_BASE);
  return { w, h: Math.round(m.h * (w / m.w)) };
}

/** Os lados que a peça tem: frente sempre; verso e meio só ligados. */
export function ladosDaPeca(cfg: CustomizationConfig | null | undefined): LadoDaPeca[] {
  const out: LadoDaPeca[] = ["front"];
  if (cfg?.has_back === true) out.push("back");
  if (cfg?.has_middle === true) out.push("middle");
  return out;
}

function quadNormalizadoValido(q: unknown): q is VisualQuad {
  // A validade de verdade (convexo, com área) é medida já na base, pelo
  // motor; aqui só a forma: 4 pontos finitos dentro de uma folga da foto.
  if (!Array.isArray(q) || q.length !== 4) return false;
  return q.every(
    (p: any) => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= -0.5 && p.x <= 1.5 && p.y >= -0.5 && p.y <= 1.5
  );
}

/** A marcação de um lado, se estiver inteira (foto + quad). */
export function ladoDoMockupFoto(
  cfg: CustomizationConfig | null | undefined,
  lado: LadoDaPeca
): MockupFotoLado | null {
  const mf: MockupFoto | null | undefined = (cfg as any)?.mockup_foto;
  const e: any = mf && typeof mf === "object" ? (mf as any)[lado] : null;
  if (!e || typeof e !== "object") return null;
  if (typeof e.photo_url !== "string" || !e.photo_url.trim()) return null;
  if (!quadNormalizadoValido(e.quad)) return null;
  return e as MockupFotoLado;
}

/** O produto tem mockup na foto (pelo menos a frente marcada)? */
export function temMockupNaFoto(cfg: CustomizationConfig | null | undefined): boolean {
  return !!ladoDoMockupFoto(cfg, "front");
}

export function areaImpressaDoLado(cfg: CustomizationConfig | null | undefined, lado: LadoDaPeca) {
  const pa: any =
    lado === "back" ? (cfg as any)?.back_print_area :
    lado === "middle" ? (cfg as any)?.middle_print_area :
    (cfg as any)?.print_area;
  const w = Number(pa?.width_cm), h = Number(pa?.height_cm);
  return {
    width_cm: Number.isFinite(w) && w > 0 ? w : 10,
    height_cm: Number.isFinite(h) && h > 0 ? h : 10,
  };
}

function forcaDoSombreado(v: unknown): number {
  if (v === undefined || v === null || v === "") return FORCA_PADRAO_DO_SOMBREADO;
  const n = Number(v);
  if (!Number.isFinite(n)) return FORCA_PADRAO_DO_SOMBREADO;
  return Math.min(1, Math.max(0, n));
}

/**
 * Uma vista a partir da marcação de um lado. É a peça que a spec monta
 * e que a prévia do painel reaproveita (lá o lado ainda não foi salvo,
 * então não dá para passar pela config). Null com quad inválido na base.
 */
export function vistaDaMarcacao(
  lado: LadoDaPeca,
  e: Pick<MockupFotoLado, "photo_url" | "quad" | "shading">,
  natural: MedidasDaFoto,
  cm: { width_cm: number; height_cm: number }
): VisualView | null {
  const base = baseDaFoto(natural);
  const quad = e.quad.map((p) => ({ x: p.x * base.w, y: p.y * base.h })) as VisualQuad;
  if (!quadValido(quad)) return null;
  const forca = forcaDoSombreado(e.shading);
  return {
    id: lado,
    label: ROTULO[lado],
    base,
    photo_url: e.photo_url,
    shading_url: null,
    // Força zero é a lojista dizendo "não assente": sem sombreado.
    shading_from_photo: forca > 0 ? { strength: forca } : null,
    garment: null,
    areas: [{ id: lado, width_cm: cm.width_cm, height_cm: cm.height_cm, quad, rect: caixaDoQuad(quad) }],
  };
}

/**
 * Monta a spec `photo2d` a partir de `mockup_foto`: uma vista por lado
 * ativo e marcado, base no tamanho natural da foto (teto 1600 px), área
 * com o quad em coordenadas da base e as medidas em cm da área de
 * impressão cadastrada. Null quando a frente não está marcada — sem
 * frente não há mockup na foto, e os lados soltos confundiriam a ordem
 * frente/verso que os previews esperam.
 *
 * `medidas` supre o tamanho natural de fotos marcadas sem `w`/`h`
 * (quem mede é `medirFoto`, no web). Lado sem medida fica de fora até
 * ela chegar.
 */
export function specDaFotoDoProduto(
  cfg: CustomizationConfig | null | undefined,
  medidas?: Partial<Record<LadoDaPeca, MedidasDaFoto | null>>
): VisualTemplateSpec | null {
  const views: VisualView[] = [];
  for (const lado of ladosDaPeca(cfg)) {
    const e = ladoDoMockupFoto(cfg, lado);
    if (!e) continue;
    const natural = medidaValida(e.w, e.h) || (medidas && medidas[lado]) || null;
    if (!natural) continue;
    const v = vistaDaMarcacao(lado, e, natural, areaImpressaDoLado(cfg, lado));
    if (v) views.push(v);
  }
  if (!views.length || views[0].id !== "front") return null;
  return { schema: 1, views };
}

export type FonteDoMockup = "banco" | "foto" | "nenhuma";

/** Template do banco vinculado > mockup na foto > preview de sempre. */
export function fonteDoMockup(
  template: VisualTemplate | null | undefined,
  specDaFoto: VisualTemplateSpec | null | undefined
): FonteDoMockup {
  if (template && template.spec) {
    if (template.kind === "photo2d" && Array.isArray(template.spec.views) && template.spec.views.length) return "banco";
    if (template.kind === "model3d") return "banco";
  }
  if (specDaFoto && Array.isArray(specDaFoto.views) && specDaFoto.views.length) return "foto";
  return "nenhuma";
}

/** A vista de um lado; sem vista própria, a frente (a peça não some). */
export function vistaDoLado(spec: VisualTemplateSpec | null | undefined, lado: LadoDaPeca): VisualView | null {
  const views = spec?.views || [];
  return views.find((v) => v.id === lado) || views[0] || null;
}

// ── Registro do render de aprovação ──────────────────────────
// O render HD fica registrado em studio_visual_renders com
// template_key + template_version + customization (o content_hash é do
// backend). Sem template do banco, a "chave" é do produto e a "versão"
// é um resumo estável da marcação: mexeu no quad, muda a versão, muda o
// hash — a prova de aprovação continua amarrada ao desenho aprovado.

export function chaveDoMockupFoto(productId: string): string {
  return "mockup_foto:" + productId;
}

function estavel(v: any): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(estavel).join(",") + "]";
  return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined)
    .map((k) => JSON.stringify(k) + ":" + estavel(v[k])).join(",") + "}";
}

/** Inteiro positivo de 31 bits (cabe no INTEGER do Postgres), FNV-1a. */
export function versaoDoMockupFoto(mf: MockupFoto | null | undefined): number {
  const s = estavel(mf || {});
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h & 0x7fffffff) || 1;
}

// ── Medição da foto (web) ────────────────────────────────────
const cacheDeMedidas = new Map<string, Promise<MedidasDaFoto | null>>();

export function medirFoto(url: string): Promise<MedidasDaFoto | null> {
  const emCache = cacheDeMedidas.get(url);
  if (emCache) return emCache;
  // O mesmo carregador do motor (28/09/2026): a URL própria dele contorna
  // a entrada de cache sem CORS que a galeria deixa, e sem CORS a medida
  // sai do <img> comum — medir não precisa ler pixel. Antes, com o pedido
  // CORS falhando, a foto sem `w`/`h` nunca era medida e a vista sumia.
  const p = carregarImagemDoMotor(url).then((r) =>
    r ? medidaValida(r.img.naturalWidth || r.img.width, r.img.naturalHeight || r.img.height) : null
  );
  cacheDeMedidas.set(url, p);
  p.then((m) => { if (!m) cacheDeMedidas.delete(url); });
  return p;
}

function ladosParaMedir(cfg: CustomizationConfig | null | undefined): Array<{ lado: LadoDaPeca; url: string }> {
  const out: Array<{ lado: LadoDaPeca; url: string }> = [];
  for (const lado of ladosDaPeca(cfg)) {
    const e = ladoDoMockupFoto(cfg, lado);
    if (e && !medidaValida(e.w, e.h)) out.push({ lado, url: e.photo_url });
  }
  return out;
}

/** A spec com as fotos sem `w`/`h` já medidas (render HD da aprovação). */
export async function specDaFotoDoProdutoMedida(
  cfg: CustomizationConfig | null | undefined
): Promise<VisualTemplateSpec | null> {
  const medidas: Partial<Record<LadoDaPeca, MedidasDaFoto | null>> = {};
  for (const { lado, url } of ladosParaMedir(cfg)) medidas[lado] = await medirFoto(url);
  return specDaFotoDoProduto(cfg, medidas);
}

/**
 * A spec da foto para um preview. Identidade estável enquanto a
 * marcação não muda — os previews redesenham o canvas quando a vista
 * muda de identidade, e a config chega como objeto novo a cada render.
 */
export function useSpecDaFotoDoProduto(
  cfg: CustomizationConfig | null | undefined
): VisualTemplateSpec | null {
  const c: any = cfg || {};
  const chave = JSON.stringify([
    c.mockup_foto || null, c.has_back === true, c.has_middle === true,
    c.print_area || null, c.back_print_area || null, c.middle_print_area || null,
  ]);
  // Medidas por URL, não por lado: trocar a foto de um lado não pode
  // reaproveitar a medida da foto anterior.
  const [porUrl, setPorUrl] = useState<Record<string, MedidasDaFoto>>({});

  useEffect(() => {
    let vivo = true;
    for (const { url } of ladosParaMedir(cfg)) {
      medirFoto(url).then((m) => {
        if (vivo && m) setPorUrl((atual) => (atual[url] ? atual : { ...atual, [url]: m }));
      });
    }
    return () => { vivo = false; };
    // A chave resume o que importa da config.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return useMemo(() => {
    const medidas: Partial<Record<LadoDaPeca, MedidasDaFoto | null>> = {};
    for (const { lado, url } of ladosParaMedir(cfg)) medidas[lado] = porUrl[url] || null;
    return specDaFotoDoProduto(cfg, medidas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, porUrl]);
}
