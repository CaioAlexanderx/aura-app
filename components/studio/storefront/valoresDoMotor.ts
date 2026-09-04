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
// ============================================================
import { sideOf } from "@/components/studio/customizationConfig";
import { artFontStack } from "@/constants/fonts";
import type { CustomizationConfig, CustomizationField } from "./types";

export type ValoresDoMotor = {
  /** O que os motores pintam na área de impressão. */
  values: { text?: string; image?: string; template?: string };
  /** Cor do texto/emblema. `undefined` deixa o motor no padrão dele. */
  artColor?: string;
  /** Família da fonte de arte, já com a pilha de fallback. */
  font: string;
};

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

  return { values: out, artColor, font };
}
