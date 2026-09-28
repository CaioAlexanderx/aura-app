// ============================================================
// components/studio/storefront/valoresDoMotor.ts
//
// O que o cliente preencheu, na língua que os motores 2D/3D entendem.
//
// A vitrine guarda a personalização por ID de campo (`f_1779813913829`)
// e os motores de mockup (compose2d, compose3dMug) leem chaves fixas:
// `text`, `image`, `template`. Ninguém traduzia entre os dois. O
// resultado, visto na loja da Sheid em 04/09/2026: o cliente digitava o
// nome, subia a foto, e a caneca 3D girava vazia — o mockup que existe
// para provar "vai ficar assim" mostrava uma caneca branca lisa.
//
// A cor da arte e a fonte seguem a mesma regra do preview SVG
// (PersonalizationPreview): primeiro a escolha do cliente na chave
// lateral `<campo>_cor`, depois a primeira da paleta da lojista.
//
// Fica em módulo porque é regra, e regra precisa de teste.
//
// 28/09/2026 — formatação da arte. Além das três chaves de sempre, sai
// `arte`: a arte INTEIRA do lado (todos os textos e imagens, cada um com
// cor, fonte, tamanho e o ajuste que a cliente fez), no formato que o
// pintor único (visualEngine/pintarArte) desenha nos três motores. Quem
// passa para o motor junta com `valoresComArte`. As chaves antigas
// continuam: há quem ainda leia só `text`/`image`.
// ============================================================
import { sideOf } from "@/components/studio/customizationConfig";
import { artFontStack } from "@/constants/fonts";
import type { CustomizationConfig, CustomizationField } from "./types";
import {
  lerAjuste, tamanhoValido, tecnicaDoProduto,
  type ArteDoLado, type Tecnica,
} from "@/components/studio/visualEngine/layoutDaArte";

export type ValoresDoMotor = {
  /** O que os motores pintam na área de impressão. */
  values: { text?: string; image?: string; template?: string };
  /** Cor do texto/emblema. `undefined` deixa o motor no padrão dele. */
  artColor?: string;
  /** Família da fonte de arte, já com a pilha de fallback. */
  font: string;
  /** A arte inteira do lado, para o pintor único. */
  arte: ArteDoLado;
};

export type ExtrasDaArte = {
  /** Peça, para a técnica padrão (caneca → sublimação, camiseta → DTF). */
  peca?: string | null;
  /** Pixels do arquivo enviado (medidos no navegador), por URL. */
  arquivo?: (url: string) => { w: number; h: number } | null;
  guias?: boolean;
  editando?: boolean;
  selecionado?: string | null;
};

/** Cor padrão do texto quando a lojista não deu paleta (a do 2D de sempre). */
export const COR_PADRAO_DO_TEXTO = "#2C2C2A";

const HEX = /^#[0-9A-Fa-f]{3,8}$/;

function primeiroDoLado(
  campos: CustomizationField[],
  tipo: string,
  lado: "front" | "back" | "middle",
): CustomizationField | undefined {
  return campos.find((f) => f && f.type === tipo && sideOf(f) === lado);
}

function texto(v: unknown): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s ? s : undefined;
}

/**
 * Traduz `values` (por id de campo) para o contrato dos motores.
 *
 * `lado` escolhe QUAIS campos entram: o texto do verso não pode aparecer
 * na frente da peça. Sem campo do lado pedido, o motor recebe vazio e
 * pinta só a peça — que é o certo, não um erro.
 */
export function valoresDoMotor(
  cfg: CustomizationConfig | null | undefined,
  values: Record<string, any> | null | undefined,
  lado: "front" | "back" | "middle" = "front",
  extras: ExtrasDaArte = {},
): ValoresDoMotor {
  const campos = (cfg?.fields || []) as CustomizationField[];
  const v = values || {};

  const campoTexto = primeiroDoLado(campos, "text", lado);
  const campoImagem = primeiroDoLado(campos, "image", lado);
  const campoArte = primeiroDoLado(campos, "template", lado);

  const out: ValoresDoMotor["values"] = {};
  const t = campoTexto ? texto(v[campoTexto.id]) : undefined;
  if (t) out.text = t;
  const img = campoImagem ? texto(v[campoImagem.id]) : undefined;
  if (img) out.image = img;
  const arte = campoArte ? texto(v[campoArte.id]) : undefined;
  if (arte) out.template = arte;

  // A cor: escolha do cliente primeiro, paleta da lojista depois. Sem
  // nenhuma das duas o motor fica com o padrão dele.
  let artColor: string | undefined;
  if (campoTexto) {
    const escolhida = v[`${campoTexto.id}_cor`];
    const daPaleta = (campoTexto.config as any)?.colors?.[0];
    const candidata = [escolhida, daPaleta].find(
      (c) => typeof c === "string" && HEX.test(c.trim()),
    );
    if (candidata) artColor = String(candidata).trim();
  }

  const font = artFontStack((campoTexto?.config as any)?.fonts?.[0]);

  return { values: out, artColor, font, arte: arteDoLado(cfg, v, lado, extras) };
}

/** A área do lado em cm, do cadastro do produto. */
export function areaCmDoLado(
  cfg: CustomizationConfig | null | undefined,
  lado: "front" | "back" | "middle",
): { w: number; h: number } | null {
  const c: any = cfg || {};
  const pa = lado === "back" ? c.back_print_area || c.print_area : lado === "middle" ? c.middle_print_area || c.print_area : c.print_area;
  const w = Number(pa?.width_cm), h = Number(pa?.height_cm);
  return w > 0 && h > 0 ? { w, h } : null;
}

/** A fonte do texto: a escolha da cliente, se a lojista liberou; senão a primeira da lista. */
export function nomeDaFonteDoCampo(campo: CustomizationField, v: Record<string, any>): string | null {
  const fontes: string[] = ((campo.config as any)?.fonts || []).filter((f: any) => typeof f === "string" && f.trim());
  const escolhida = v[`${campo.id}_fonte`];
  if (typeof escolhida === "string" && fontes.includes(escolhida)) return escolhida;
  return fontes[0] || null;
}

/**
 * A arte do lado: TODOS os campos de imagem com arquivo (a arte pronta
 * entra no lugar deles quando não há arquivo — é o mesmo slot, S0) e
 * TODOS os textos preenchidos, na ordem da lojista.
 */
export function arteDoLado(
  cfg: CustomizationConfig | null | undefined,
  values: Record<string, any> | null | undefined,
  lado: "front" | "back" | "middle" = "front",
  extras: ExtrasDaArte = {},
): ArteDoLado {
  const campos = ((cfg?.fields || []) as CustomizationField[]).filter((f) => f && f.id && sideOf(f) === lado);
  const v = values || {};
  const tecnica: Tecnica = tecnicaDoProduto(cfg as any, extras.peca);
  const imagens: ArteDoLado["imagens"] = [];
  const img = (f: CustomizationField) => {
    const url = texto(v[f.id]);
    if (!url) return;
    const aj = lerAjuste(v[`${f.id}_ajuste`]);
    const arquivo = (extras.arquivo && extras.arquivo(url)) || (aj && aj.arquivo) || null;
    imagens.push({ campo: f.id, url, ajuste: aj, arquivo });
  };
  campos.filter((f) => f.type === "image").forEach(img);
  if (!imagens.length) {
    const pronta = campos.find((f) => f.type === "template" && texto(v[f.id]));
    if (pronta) img(pronta);
  }
  const textos: ArteDoLado["textos"] = [];
  for (const f of campos) {
    // O briefing do "criem pra mim" é texto para a loja, não para a peça.
    if (f.type !== "text" || f.id === "art_service_brief") continue;
    const t = texto(v[f.id]);
    if (!t) continue;
    const paleta = ((f.config as any)?.colors || []) as unknown[];
    const cor = [v[`${f.id}_cor`], ...paleta].find((c) => typeof c === "string" && HEX.test(c.trim())) as string | undefined;
    const nomeDaFonte = nomeDaFonteDoCampo(f, v);
    textos.push({
      campo: f.id,
      texto: t,
      cor: cor ? cor.trim() : COR_PADRAO_DO_TEXTO,
      fonte: artFontStack(nomeDaFonte),
      nomeDaFonte,
      tam: tamanhoValido(v[`${f.id}_tam`]),
      contorno: v[`${f.id}_contorno`] === true,
      ajuste: lerAjuste(v[`${f.id}_ajuste`]),
    });
  }
  const arte: ArteDoLado = { v: 1, lado, areaCm: areaCmDoLado(cfg, lado), tecnica, imagens, textos };
  if (extras.guias) arte.guias = true;
  if (extras.editando) arte.editando = true;
  if (extras.selecionado !== undefined) arte.selecionado = extras.selecionado;
  return arte;
}

/** Os valores para o motor: as chaves de sempre + a arte inteira. */
export function valoresComArte(m: Pick<ValoresDoMotor, "values" | "arte">): Record<string, any> {
  return { ...m.values, __arte: m.arte };
}
