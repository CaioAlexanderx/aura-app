// ============================================================
// components/studio/visualEngine/painelDaPeca.ts
//
// O PAINEL INTEIRO da peça em UV (29/09/2026), para a arte livre do
// orçamento. O PO: "Temos que dar liberdade total para encaixar a arte na
// camisa, sem delimitar cm ou posição da arte." Na posição livre a arte
// pode ir a qualquer lugar do lado da peça, não só à área de impressão:
//
//   - camiseta: a frente inteira e as costas inteiras, do ombro à barra e
//     de lateral a lateral (a caixa UV do painel do tronco);
//   - caneca: a superfície toda, uma volta inteira centrada no lado.
//
// De onde vêm os limites, SEM mudar a spec publicada no banco:
//   - camiseta básica: constante do modelo, tirada do gerador da malha
//     (scripts/studio/camisetaParametrica.js). Os painéis são projeção
//     planar u = 0,25 ± x/cmPorUv (frente) e 0,75 ∓ x/cmPorUv (costas),
//     v = vBaseDosPaineis + y/cmPorUv. A caixa sai da malha-base e o teste
//     __tests__/studio/orcamentoArteLivre.test.ts recalcula pelo gerador:
//     se a malha mudar, o teste acusa. Ler as UVs do GLB carregado seria
//     separar a ilha do tronco das mangas numa malha só ("T-Shirt"), a
//     cada abertura e só no navegador; a constante vale igual no vídeo, no
//     pedido e no jest.
//   - caneca: a geometria já diz tudo. A textura dá a volta no corpo (u) e
//     sobe a altura dele (v), então o painel é u ± 0,5 em volta do centro
//     do lado e v de 0 a 1.
//   - outro GLB: sem constante, fica a área da spec (a arte ainda é livre
//     dentro dela, sem margem e sem o encaixe automático).
//
// Módulo puro (sem three, sem DOM).
// ============================================================
import { readGlbModel } from "./glbModel";
import { readMugGeometry } from "./mugGeometry";
import { areaParaPintar } from "./areasDaPeca";

export type UvDoPainel = { u0: number; v0: number; u1: number; v1: number };

/**
 * A caixa UV do painel do tronco da camiseta básica (v crescendo para
 * cima, como a spec). Tirada de construirCamiseta(): frente de u 0,0333 a
 * 0,4667 (52 cm de lateral a lateral no ombro) e v de 0,39 (barra) a
 * 0,9733 (ombro, 70 cm acima); costas espelhadas em u ≥ 0,5.
 */
export const PAINEIS_DA_CAMISETA_BASICA: Record<"front" | "back", UvDoPainel> = {
  front: { u0: 0.0333, v0: 0.39, u1: 0.4667, v1: 0.9733 },
  back: { u0: 0.5333, v0: 0.39, u1: 0.9667, v1: 0.9733 },
};

/** O GLB da camiseta básica (com ou sem query de cache). */
const MODELO_DA_CAMISETA_BASICA = /\/camiseta-basica\.glb(?:[?#]|$)/i;

export type PainelLivre = {
  /** A caixa do painel em UV; na caneca, u1 pode passar de 1 (atravessa a emenda). */
  uv: UvDoPainel;
  /** Altura ÷ largura do painel NA PEÇA (não na textura). */
  aspecto: number;
  /** Pixel não quadrado da textura (caneca); null = quadrado (GLB). */
  pixel: number | null;
};

type SpecMinima = {
  areas?: Array<{ id: string; uv?: UvDoPainel; width_cm?: number; height_cm?: number }>;
  model?: any;
} | null | undefined;

function limpo(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Tamanho da textura do modelo (o mesmo de canvasDaTextura, no compose3dMug). */
function texturaDoModelo(spec: SpecMinima): { W: number; H: number } {
  const glb = readGlbModel(spec);
  if (glb) return { W: glb.texture.w, H: glb.texture.h };
  const t = spec?.model?.texture;
  return { W: Number(t?.w) || 2048, H: Number(t?.h) || 1024 };
}

/**
 * O painel inteiro da peça em volta da área `areaId` (front, back, panel,
 * wrap). Null quando a spec não tem a área (quem chama fica no modo de
 * sempre).
 */
export function painelLivre(spec: SpecMinima, areaId: string): PainelLivre | null {
  const glb = readGlbModel(spec);
  const area = areaParaPintar(spec?.areas as any, areaId, !!glb) as { id: string; uv?: UvDoPainel } | null;
  if (!area || !area.uv) return null;
  const { W, H } = texturaDoModelo(spec);

  if (glb) {
    const conhecido = MODELO_DA_CAMISETA_BASICA.test(glb.url) && (areaId === "front" || areaId === "back")
      ? PAINEIS_DA_CAMISETA_BASICA[areaId]
      : null;
    const uv = conhecido || area.uv;
    const aspecto = ((uv.v1 - uv.v0) * H) / Math.max(1e-6, (uv.u1 - uv.u0) * W);
    return { uv: { ...uv }, aspecto, pixel: null };
  }

  // Caneca: uma volta inteira centrada no lado, de baixo a cima.
  const G = readMugGeometry(spec);
  const raio = (G.body.topRadius + G.body.bottomRadius) / 2;
  const centro = (area.uv.u0 + area.uv.u1) / 2;
  let u0 = centro - 0.5;
  if (u0 < 0) u0 += 1;
  if (u0 >= 1) u0 -= 1;
  const uv = { u0: limpo(u0), v0: 0, u1: limpo(u0 + 1), v1: 1 };
  const volta = 2 * Math.PI * raio;
  const pixel = raio > 0 && G.body.height > 0 ? (W / volta) / (H / G.body.height) : null;
  const aspecto = volta > 0 ? G.body.height / volta : H / W;
  return { uv, aspecto, pixel };
}
