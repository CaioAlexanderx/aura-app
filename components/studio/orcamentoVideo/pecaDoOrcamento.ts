// ============================================================
// components/studio/orcamentoVideo/pecaDoOrcamento.ts
//
// A peça que vai no vídeo do orçamento (28/09/2026): qual modelo 3D,
// com que arte e que cor. Mesma precedência da aprovação de arte
// (gerarRenderAprovacao): modelo vinculado ao produto > Mockup na foto.
// Sem 3D, o plano B é a FOTO (Mockup na foto ou modelo 2D).
//
// A arte do orçamento mora no `customization` do item, por ID de campo da
// personalização do produto (a mesma chave da vitrine e do pedido). O que a
// lojista ajusta no passo 1 volta para lá, para o pedido aprovado nascer
// com a arte que o cliente viu no vídeo.
// ============================================================
import { studioApi, type CustomizationConfig } from "@/services/studioApi";
import { studioVisualApi, type VisualTemplate } from "@/services/studioVisualApi";
import { valoresDoMotor } from "@/components/studio/storefront/valoresDoMotor";
import { corDaPeca } from "@/components/studio/visualEngine/corDaPeca";
import { sideOf } from "@/components/studio/customizationConfig";
import { nomeDaCor } from "@/components/studio/nomeDaCor";
import type { Mug3DOptions } from "@/components/studio/visualEngine/compose3dMug";
import { exportPng } from "@/components/studio/visualEngine/compose2d";
import { specDaFotoDoProdutoMedida } from "@/components/studio/visualEngine/specDaFotoDoProduto";
import { blobDoDataUrl } from "./gravarGiro";

export type FontesDaPeca = {
  cfg: CustomizationConfig | null;
  template: VisualTemplate | null;
};

export type ArteDaPeca = {
  texto: string;
  imagem: string | null;
  cor: string | null;
};

export type CorDaPeca = { hex: string; nome: string };

type Campo = CustomizationConfig["fields"][number];

function campoDaFrente(cfg: CustomizationConfig | null | undefined, tipo: string): Campo | undefined {
  return (cfg?.fields || []).find((f) => f && f.type === tipo && sideOf(f) === "front");
}

export async function carregarFontes(companyId: string, productId: string): Promise<FontesDaPeca> {
  const [tpl, conf] = await Promise.all([
    studioVisualApi.getProductVisualTemplate(companyId, productId).catch(() => null),
    studioApi.getCustomizationConfig(companyId, productId).catch(() => null),
  ]);
  return { cfg: conf?.config || null, template: tpl?.template || null };
}

/** O produto tem modelo 3D vinculado? */
export function tem3d(f: FontesDaPeca | null): boolean {
  return !!(f && f.template && f.template.kind === "model3d" && f.template.spec);
}

/** Tem de onde tirar uma foto com a arte (modelo 2D ou Mockup na foto)? */
export function temFoto(f: FontesDaPeca | null): boolean {
  if (!f) return false;
  if (f.template && f.template.kind === "photo2d" && f.template.spec?.views?.length) return true;
  return !!(f.cfg as any)?.mockup_foto;
}

/** As cores que a lojista cadastrou na personalização do produto. */
export function coresDaPeca(cfg: CustomizationConfig | null | undefined): CorDaPeca[] {
  const campo = (cfg?.fields || []).find((f) => f && f.type === "color");
  if (!campo) return [];
  const escolhas = campo.config?.choices || [];
  const cores = (campo.config?.colors || []).filter((c) => typeof c === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c.trim()));
  return cores.map((hex) => {
    const rotulo = escolhas.find((ch) => ch.value === hex || ch.label === hex)?.label;
    const nome = nomeDaCor(hex, rotulo && rotulo !== hex ? rotulo : null);
    return { hex, nome: nome.charAt(0).toUpperCase() + nome.slice(1) };
  });
}

/** A arte como está no item do orçamento. */
export function arteDoItem(cfg: CustomizationConfig | null | undefined, customization: Record<string, any> | null | undefined): ArteDaPeca {
  const motor = valoresDoMotor(cfg as any, customization || {}, "front");
  const v = customization || {};
  return {
    texto: motor.values.text || (typeof v.texto === "string" ? v.texto : ""),
    imagem: motor.values.image || (typeof v.imagem === "string" ? v.imagem : null),
    cor: corDaPeca(cfg as any, v) || (typeof v.cor_da_peca === "string" ? v.cor_da_peca : null),
  };
}

/**
 * Escreve a arte de volta no `customization` do item, na chave do campo da
 * personalização (a mesma que a vitrine e o pedido leem). Produto sem o
 * campo: chaves legíveis (`texto`, `imagem`, `cor_da_peca`), para a
 * produção ler no pedido.
 */
export function customizacaoComArte(
  cfg: CustomizationConfig | null | undefined,
  customization: Record<string, any> | null | undefined,
  arte: ArteDaPeca,
): Record<string, any> {
  const out: Record<string, any> = { ...(customization || {}) };
  const pares: Array<[string, "texto" | "imagem" | "cor", any]> = [
    ["text", "texto", arte.texto.trim() || null],
    ["image", "imagem", arte.imagem || null],
    ["color", "cor", arte.cor || null],
  ];
  for (const [tipo, nome, valor] of pares) {
    const campo = campoDaFrente(cfg, tipo) || (tipo === "color" ? (cfg?.fields || []).find((f) => f.type === "color") : undefined);
    const chave = campo ? campo.id : nome === "cor" ? "cor_da_peca" : nome;
    if (valor) out[chave] = valor;
    else delete out[chave];
  }
  return out;
}

/** Valores e opções do viewer para a arte escolhida. */
export function motorDaArte(
  cfg: CustomizationConfig | null | undefined,
  customization: Record<string, any> | null | undefined,
  arte: ArteDaPeca,
): { values: Record<string, any>; opts: Mug3DOptions } {
  const motor = valoresDoMotor(cfg as any, customizacaoComArte(cfg, customization, arte), "front");
  const values: Record<string, any> = { ...motor.values };
  if (arte.texto.trim()) values.text = arte.texto.trim();
  if (arte.imagem) values.image = arte.imagem;
  const opts: Mug3DOptions = { artColor: motor.artColor, font: motor.font };
  if (arte.cor) opts.garmentColor = arte.cor;
  return { values, opts };
}

/** O item que vai no vídeo: o primeiro com produto (a peça principal). */
export function indiceDaPecaPrincipal(itens: Array<{ product_id: string | null }>): number {
  const i = itens.findIndex((it) => !!it.product_id);
  return i;
}

/**
 * Plano B sem 3D: a foto da peça com a arte (modelo 2D vinculado ou
 * Mockup na foto), pelo mesmo exportPng da aprovação. Null se não há de
 * onde tirar a foto ou se a imagem veio sem CORS.
 */
export async function fotoSem3d(
  f: FontesDaPeca,
  motor: { values: Record<string, any>; opts: Mug3DOptions },
): Promise<Blob | null> {
  let vista: any = null;
  if (f.template && f.template.kind === "photo2d" && f.template.spec?.views?.length) {
    vista = f.template.spec.views[0];
  } else if ((f.cfg as any)?.mockup_foto) {
    const spec = await specDaFotoDoProdutoMedida(f.cfg).catch(() => null);
    vista = spec?.views?.[0] || null;
  }
  if (!vista) return null;
  const png = await exportPng(vista, motor.values, {
    artColor: motor.opts.artColor, font: motor.opts.font, garmentColor: motor.opts.garmentColor,
  }, 1440).catch(() => null);
  return png ? blobDoDataUrl(png) : null;
}
