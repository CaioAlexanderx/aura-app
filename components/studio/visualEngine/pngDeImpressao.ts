// ============================================================
// AURA STUDIO · visualEngine/pngDeImpressao — o arquivo de impressão do
// pedido (28/09/2026)
//
// Só a área de impressão, em escala real (300 dpi), fundo transparente,
// desenhada pelo MESMO pintor da prévia: o que a cliente ajustou na peça
// é o que sai no arquivo. É ele que vai para o Corel, o Photoshop ou a
// impressora. Gerado no navegador (o R2 responde CORS desde 04/09).
//
// Sem medida em cm não há escala real: devolve null e a oficina segue
// com o arquivo original.
// ============================================================
import { precarregarArte, pintarArteNaArea } from "./pintarArte";
import { carregarImagemDoMotor } from "./compose2d";
import { ajusteDoItem, type ArteDoLado, type ItemDaArte } from "./layoutDaArte";

export const DPI_DE_IMPRESSAO = 300;
/** Teto do lado maior (px): 60 cm a 300 dpi; acima disso o navegador pode recusar o canvas. */
const LADO_MAXIMO = 7100;

export function pixelsDaArea(areaCm: { w: number; h: number }, dpi = DPI_DE_IMPRESSAO): { w: number; h: number; dpi: number } {
  let d = dpi;
  const maior = (Math.max(areaCm.w, areaCm.h) / 2.54) * d;
  if (maior > LADO_MAXIMO) d = Math.floor((LADO_MAXIMO * 2.54) / Math.max(areaCm.w, areaCm.h));
  return { w: Math.round((areaCm.w / 2.54) * d), h: Math.round((areaCm.h / 2.54) * d), dpi: d };
}

/** O PNG da área (Blob) e os itens com as medidas em cm, ou null sem medida/sem arte. */
export async function gerarPngDeImpressao(arte: ArteDoLado): Promise<{ blob: Blob; w: number; h: number; dpi: number; itens: ItemDaArte[] } | null> {
  if (typeof document === "undefined" || !arte.areaCm) return null;
  if (!arte.imagens.length && !arte.textos.length) return null;
  const px = pixelsDaArea(arte.areaCm);
  const cv = document.createElement("canvas");
  cv.width = px.w;
  cv.height = px.h;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const imgs = await precarregarArte(arte, async (u) => {
    const r = await carregarImagemDoMotor(u);
    return r && r.comCors ? r.img : null;
  });
  // Sem guias, sem seleção e sem mistura: é tinta, não prévia.
  const limpa: ArteDoLado = { ...arte, guias: false, editando: false, selecionado: null };
  const itens = pintarArteNaArea(ctx, { x: 0, y: 0, w: px.w, h: px.h }, limpa, imgs, { mistura: null });
  const blob = await new Promise<Blob | null>((res) => {
    try { cv.toBlob((b) => res(b), "image/png"); } catch { res(null); }
  });
  return blob ? { blob, w: px.w, h: px.h, dpi: px.dpi, itens } : null;
}

/** As medidas de cada item (cm), para a ficha — com ou sem ajuste da cliente. */
export function medidasDosItens(itens: ItemDaArte[], areaCm: { w: number; h: number }) {
  return itens.map((it) => ({ campo: it.campo, tipo: it.tipo, ajuste: ajusteDoItem(it, areaCm.w, areaCm.h, true) }));
}
