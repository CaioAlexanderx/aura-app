// ============================================================
// components/studio/orcamentoVideo/artesPorLado.ts
//
// As artes da peça do orçamento POR LUGAR (29/09/2026). O PO: "O destaque
// do orçamento é o vídeo [...] com a opção de enviar a arte. Não precisa
// de campo de texto: o lojista vai trazer o texto em imagem, com a fonte
// do cliente." Uma imagem por lugar: camiseta frente e verso; caneca
// frente e verso, ou a estendida (volta inteira), que SUBSTITUI as duas.
//
// Mockup: docs/mockups/studio-orcamento-video-primeiro-plano.html
//
// Onde mora: no `customization` do item (jsonb que já existe), no MESMO
// formato do pedido da vitrine, para o pedido aprovado nascer pronto:
//   - a imagem do lado na chave do campo de imagem daquele lado
//     (`image`, `image_back`, `image_middle`, ou o id que a lojista tem);
//     sem campo, o id canônico do lado (canonicalFieldId);
//   - `has_back_selected` / `has_middle_selected`, o opt-in de verso e de
//     volta inteira que a vitrine grava;
//   - o tamanho e a posição que a lojista escolheu em `orcamento_ajustes`
//     ({ front: { escala, dx, dy }, ... }), só o que saiu do automático.
// Textos que já estavam no item (vitrine, orçamento antigo) continuam lá
// e aparecem na peça: aqui só não se digita texto novo.
//
// Módulo puro (sem React, sem DOM), testado em
// __tests__/studio/orcamentoArtesPorLado.test.ts.
// ============================================================
import type { CustomizationConfig } from "@/services/studioApi";
import { canonicalFieldId, sideOf } from "@/components/studio/customizationConfig";
import { arteDoLado, valoresDoMotor } from "@/components/studio/storefront/valoresDoMotor";
import { corDaPeca } from "@/components/studio/visualEngine/corDaPeca";
import { areaDoLadoNoModelo } from "@/components/studio/visualEngine/areasDaPeca";
import type { ArteDoLado } from "@/components/studio/visualEngine/layoutDaArte";
import type { Mug3DOptions } from "@/components/studio/visualEngine/compose3dMug";
import { ajustarTamanhoDaArte } from "./pecaDoOrcamento";
import { arteNoTamanhoDoOrcamento, ajusteValido, ajusteEhPadrao, type AjusteDaArte } from "./tamanhoDaArte";

export type LadoDaArte = "front" | "back" | "middle";

export const LADOS: LadoDaArte[] = ["front", "back", "middle"];

export const ROTULO_DO_LADO: Record<LadoDaArte, string> = { front: "Frente", back: "Verso", middle: "Estendida" };

/** "da frente", "do verso", "da estendida": para os textos dos botões. */
export const DO_LADO: Record<LadoDaArte, string> = { front: "da frente", back: "do verso", middle: "da estendida" };

/** Onde o tamanho e a posição por lado ficam no `customization` do item. */
export const CHAVE_DOS_AJUSTES = "orcamento_ajustes";

export type ArtesDaPeca = {
  /** A URL da imagem de cada lado (já enviada). */
  imagens: Partial<Record<LadoDaArte, string>>;
  /** Tamanho e posição por lado; ausente = automático. */
  ajustes: Partial<Record<LadoDaArte, AjusteDaArte>>;
  /** Caneca: a volta inteira no lugar de frente e verso. */
  estendida: boolean;
  /** Cor da peça (hex) ou null. */
  cor: string | null;
};

export const ARTES_VAZIAS: ArtesDaPeca = { imagens: {}, ajustes: {}, estendida: false, cor: null };

type SpecMinima = { areas?: Array<{ id: string; uv?: any; width_cm?: number; height_cm?: number }>; model?: { kind?: string } | null } | null | undefined;

export type LadosDaPeca = {
  /** Frente, e o verso quando o produto e o modelo têm. */
  faces: LadoDaArte[];
  /** O produto e o modelo têm volta inteira (caneca). */
  estendida: boolean;
};

/**
 * Os lugares que a peça oferece: o que o PRODUTO tem (frente sempre;
 * verso com `has_back`; volta inteira com `has_middle`) e o MODELO sabe
 * pintar. Sem modelo 3D (foto), vale só o produto.
 */
export function ladosDaPeca(cfg: CustomizationConfig | null | undefined, spec: SpecMinima): LadosDaPeca {
  const c: any = cfg || {};
  const temNoModelo = (lado: LadoDaArte) => !spec || !spec.areas?.length || !!areaDoLadoNoModelo(spec, lado);
  const faces: LadoDaArte[] = ["front"];
  if (c.has_back === true && temNoModelo("back")) faces.push("back");
  const estendida = c.has_middle === true && temNoModelo("middle");
  return { faces, estendida };
}

/** Os lados em que a peça está impressa agora (estendida ou frente e verso). */
export function ladosEmUso(artes: ArtesDaPeca, lados: LadosDaPeca): LadoDaArte[] {
  return artes.estendida && lados.estendida ? ["middle"] : lados.faces;
}

/** A chave da imagem do lado: o campo de imagem daquele lado, ou o id canônico. */
export function chaveDaImagem(cfg: CustomizationConfig | null | undefined, lado: LadoDaArte): string {
  const campo = (cfg?.fields || []).find((f) => f && f.type === "image" && sideOf(f) === lado);
  return campo ? campo.id : canonicalFieldId("image", lado, 0);
}

function url(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** As artes como estão no item do orçamento. */
export function artesDoItem(cfg: CustomizationConfig | null | undefined, customization: Record<string, any> | null | undefined): ArtesDaPeca {
  const v = customization || {};
  const imagens: ArtesDaPeca["imagens"] = {};
  for (const lado of LADOS) {
    // `imagem`: a chave legível do orçamento antigo (#1013), só a frente.
    const u = url(v[chaveDaImagem(cfg, lado)]) || (lado === "front" ? url(v.imagem) : null);
    if (u) imagens[lado] = u;
  }
  const ajustes: ArtesDaPeca["ajustes"] = {};
  const guardados = v[CHAVE_DOS_AJUSTES];
  if (guardados && typeof guardados === "object") {
    for (const lado of LADOS) {
      const a = guardados[lado];
      if (a && typeof a === "object" && !ajusteEhPadrao(a)) ajustes[lado] = ajusteValido(a);
    }
  }
  const cor = corDaPeca(cfg as any, v) || (typeof v.cor_da_peca === "string" ? v.cor_da_peca : null);
  return { imagens, ajustes, estendida: v.has_middle_selected === true, cor };
}

/** O lado tem algo para imprimir (imagem ou texto) no customization? */
function temConteudo(cfg: CustomizationConfig | null | undefined, v: Record<string, any>, lado: LadoDaArte): boolean {
  if (url(v[chaveDaImagem(cfg, lado)])) return true;
  const a = arteDoLado(cfg as any, v, lado);
  return a.imagens.length > 0 || a.textos.length > 0;
}

/**
 * Escreve as artes no `customization` do item, no formato do pedido.
 * Estendida: só a volta inteira vai (frente e verso saem do item; na tela
 * elas ficam guardadas enquanto a peça estiver aberta). Frente e verso:
 * a volta inteira sai.
 */
export function customizacaoComArtes(
  cfg: CustomizationConfig | null | undefined,
  customization: Record<string, any> | null | undefined,
  artes: ArtesDaPeca,
): Record<string, any> {
  const out: Record<string, any> = { ...(customization || {}) };
  delete out.imagem; // a chave legível antiga vira a chave do lado
  const vaiNoPedido = (lado: LadoDaArte) => (artes.estendida ? lado === "middle" : lado !== "middle");
  const ajustes: Record<string, AjusteDaArte> = {};
  for (const lado of LADOS) {
    const chave = chaveDaImagem(cfg, lado);
    const u = vaiNoPedido(lado) ? url(artes.imagens[lado]) : null;
    if (u) {
      out[chave] = u;
      const a = artes.ajustes[lado];
      if (a && !ajusteEhPadrao(a)) ajustes[lado] = ajusteValido(a);
    } else {
      delete out[chave];
    }
  }
  if (Object.keys(ajustes).length) out[CHAVE_DOS_AJUSTES] = ajustes;
  else delete out[CHAVE_DOS_AJUSTES];

  // O opt-in da vitrine: verso com arte, volta inteira escolhida. Verso
  // que ficou sem nada (nem texto da cliente) perde o opt-in.
  if (!artes.estendida && out[chaveDaImagem(cfg, "back")]) out.has_back_selected = true;
  else if (!temConteudo(cfg, out, "back")) delete out.has_back_selected;
  if (artes.estendida) out.has_middle_selected = true;
  else delete out.has_middle_selected;

  // A cor da peça: o campo de cor do produto, ou a chave legível.
  const campoCor = (cfg?.fields || []).find((f) => f && f.type === "color" && sideOf(f) === "front")
    || (cfg?.fields || []).find((f) => f && f.type === "color");
  const chaveCor = campoCor ? campoCor.id : "cor_da_peca";
  if (artes.cor) out[chaveCor] = artes.cor;
  else delete out[chaveCor];
  return out;
}

/** Muda o tamanho e/ou a posição da arte de UM lado (null = volta ao automático). */
export function ajustarLado(artes: ArtesDaPeca, lado: LadoDaArte, mudanca: Partial<AjusteDaArte> | null): ArtesDaPeca {
  const novo = ajustarTamanhoDaArte({ texto: "", imagem: null, cor: null, ajuste: artes.ajustes[lado] || null }, mudanca).ajuste;
  const ajustes = { ...artes.ajustes };
  if (novo) ajustes[lado] = novo;
  else delete ajustes[lado];
  return { ...artes, ajustes };
}

/** O ajuste em vigor no lado (o padrão, se a lojista não mexeu). */
export function ajusteDoLado(artes: ArtesDaPeca, lado: LadoDaArte): AjusteDaArte {
  return ajusteValido(artes.ajustes[lado]);
}

/** Põe ou troca a imagem de um lado; a troca volta o tamanho ao automático. */
export function comImagem(artes: ArtesDaPeca, lado: LadoDaArte, u: string | null): ArtesDaPeca {
  const imagens = { ...artes.imagens };
  const ajustes = { ...artes.ajustes };
  if (u) imagens[lado] = u;
  else delete imagens[lado];
  delete ajustes[lado];
  return { ...artes, imagens, ajustes };
}

/** Quantas artes a peça leva agora (nos lados em uso). */
export function quantasArtes(artes: ArtesDaPeca, lados: LadosDaPeca): number {
  return ladosEmUso(artes, lados).filter((l) => !!artes.imagens[l]).length;
}

/** "sem arte", "1 arte", "2 artes", "estendida": o selo da peça. */
export function textoDasArtes(artes: ArtesDaPeca, lados: LadosDaPeca): string {
  const n = quantasArtes(artes, lados);
  if (!n) return "sem arte";
  if (artes.estendida && lados.estendida) return "estendida";
  return n === 1 ? "1 arte" : `${n} artes`;
}

/**
 * Valores e opções do viewer com TODAS as artes da peça: cada lado em
 * uso vira uma ArteDoLado (imagem inteira na área, com o ajuste da
 * lojista) na área do modelo (`__artePorArea`), e a textura recebe todas
 * de uma vez — o vídeo gira e mostra frente e verso, ou a volta inteira.
 * `__arte` leva a frente (ou a estendida) para o plano B em foto (2D).
 */
export function motorDasArtes(
  cfg: CustomizationConfig | null | undefined,
  customization: Record<string, any> | null | undefined,
  artes: ArtesDaPeca,
  spec: SpecMinima,
  peca?: string | null,
): { values: Record<string, any>; opts: Mug3DOptions } {
  const cust = customizacaoComArtes(cfg, customization, artes);
  const lados = ladosEmUso(artes, ladosDaPeca(cfg, spec));
  const porArea: Record<string, ArteDoLado> = {};
  let primeira: ArteDoLado | null = null;
  for (const lado of lados) {
    let arte = arteDoLado(cfg as any, cust, lado, peca ? { peca } : {});
    const chave = chaveDaImagem(cfg, lado);
    const u = url(cust[chave]);
    // Produto sem campo de imagem naquele lado: a imagem do orçamento
    // entra do mesmo jeito (o campo é só o endereço no pedido).
    if (u && !arte.imagens.some((im) => im.url === u)) {
      arte = { ...arte, imagens: [...arte.imagens, { campo: chave, url: u, ajuste: null, arquivo: null }] };
    }
    if (!arte.imagens.length && !arte.textos.length) continue;
    arte = arteNoTamanhoDoOrcamento(arte, artes.ajustes[lado]);
    const area = spec ? areaDoLadoNoModelo(spec, lado) : null;
    if (area) porArea[area] = arte;
    if (!primeira) primeira = arte;
  }
  const m = valoresDoMotor(cfg as any, cust, "front", peca ? { peca } : {});
  const values: Record<string, any> = { ...m.values, __artePorArea: porArea };
  if (primeira) values.__arte = primeira;
  const opts: Mug3DOptions = { artColor: m.artColor, font: m.font };
  if (artes.cor) opts.garmentColor = artes.cor;
  return { values, opts };
}
