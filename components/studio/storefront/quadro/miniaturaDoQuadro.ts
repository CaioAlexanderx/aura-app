// ============================================================
// components/studio/storefront/quadro/miniaturaDoQuadro.ts
//
// p-181: a miniatura que o quadro manda para a sacola da loja comum.
//
// A sacola do app desenha a miniatura AO VIVO (MiniaturaDaLinha, o
// LivePreview com os valores da linha). A loja comum é HTML e não tem o
// motor, então recebe uma imagem: o que está no palco agora (o canvas do
// 3D ou do 2D, já com a arte da cliente), reduzido a 240 px em JPEG.
//
// O 3D desenha com `preserveDrawingBuffer` (compose3dMug.ts), então o
// canvas pode ser lido a qualquer momento. Canvas "sujo" (foto de outro
// domínio sem CORS) recusa a leitura: aí vai a foto da peça, por URL.
// ============================================================

export const LADO_DA_MINIATURA = 240;

/** O maior canvas visível dentro de `raiz`, ou null. */
export function maiorCanvas(raiz: { querySelectorAll?: (s: string) => ArrayLike<any> } | null | undefined): any | null {
  if (!raiz || typeof raiz.querySelectorAll !== "function") return null;
  let melhor: any = null;
  let area = 0;
  const lista = raiz.querySelectorAll("canvas");
  for (let i = 0; i < lista.length; i++) {
    const c = lista[i];
    const r = typeof c.getBoundingClientRect === "function" ? c.getBoundingClientRect() : null;
    const a = (r ? r.width * r.height : 0) || (Number(c.width) || 0) * (Number(c.height) || 0);
    if (a > area && Number(c.width) > 0 && Number(c.height) > 0) { melhor = c; area = a; }
  }
  return melhor;
}

/**
 * O canvas do palco numa imagem quadrada de `lado` px (data URL), com o
 * fundo do palco atrás. null quando não há canvas ou a leitura é recusada.
 */
export function imagemDoCanvas(
  fonte: any,
  { lado = LADO_DA_MINIATURA, fundo = "#FFFFFF", criar }: { lado?: number; fundo?: string; criar?: () => any } = {},
): string | null {
  try {
    if (!fonte || !(Number(fonte.width) > 0) || !(Number(fonte.height) > 0)) return null;
    const alvo = criar ? criar() : (typeof document !== "undefined" ? document.createElement("canvas") : null);
    if (!alvo) return null;
    alvo.width = lado;
    alvo.height = lado;
    const ctx = alvo.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, lado, lado);
    const escala = Math.min(lado / fonte.width, lado / fonte.height);
    const w = fonte.width * escala;
    const h = fonte.height * escala;
    ctx.drawImage(fonte, (lado - w) / 2, (lado - h) / 2, w, h);
    const url = alvo.toDataURL("image/jpeg", 0.85);
    return typeof url === "string" && url.startsWith("data:image/") ? url : null;
  } catch {
    // SecurityError (canvas com imagem de outro domínio) ou sem canvas.
    return null;
  }
}

/** A miniatura: o palco; sem ele, a foto da peça (https); senão null. */
export function miniaturaDaPeca({
  raiz, fotoDaPeca, fundo,
}: {
  raiz: any;
  fotoDaPeca?: string | null;
  fundo?: string;
}): string | null {
  const doPalco = imagemDoCanvas(maiorCanvas(raiz), { fundo });
  if (doPalco) return doPalco;
  const foto = typeof fotoDaPeca === "string" ? fotoDaPeca.trim() : "";
  return /^https:\/\//i.test(foto) ? foto : null;
}
