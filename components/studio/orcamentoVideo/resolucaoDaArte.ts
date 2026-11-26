// ============================================================
// components/studio/orcamentoVideo/resolucaoDaArte.ts
//
// Aviso de resolução da arte no orçamento (B3 do QA de Personalizados,
// 26/11/2026). A vitrine já avisa cm/DPI quando a imagem é pequena para o
// tamanho que ocupa na peça; o orçamento não avisava, e a arte vai para a
// produção. Mesma conta e mesmos limiares (layoutDaArte): DPI = pixels ÷
// polegadas que a imagem ocupa; "pode sair borrada" abaixo de DPI_ACEITAVEL.
//
// Só aviso: não bloqueia nada. Módulo PURO.
// ============================================================
import { dpiEfetivo, faixaDeNitidez, larguraNitidaCm, type Nitidez } from "@/components/studio/visualEngine/layoutDaArte";

export type AreaCm = { w: number; h: number };

/** A área de impressão do lado, em cm, do cadastro do produto. Null sem medida. */
export function areaDoLadoEmCm(cfg: any, lado: "front" | "back" | "middle"): AreaCm | null {
  const pa = lado === "back" ? cfg?.back_print_area || cfg?.print_area : lado === "middle" ? cfg?.middle_print_area : cfg?.print_area;
  const w = Number(pa?.width_cm), h = Number(pa?.height_cm);
  return w > 0 && h > 0 ? { w, h } : null;
}

export type ResolucaoDaArte = { dpi: number; faixa: Nitidez; larguraCm: number; nitidaAteCm: number };

/**
 * A nitidez da imagem na área: a imagem inteira dentro da área (encaixe do
 * orçamento), vezes a escala que a lojista deu. Null sem medida de um dos lados.
 */
export function resolucaoDaArte(
  arquivo: { w: number; h: number } | null | undefined,
  area: AreaCm | null | undefined,
  escala = 1,
): ResolucaoDaArte | null {
  if (!arquivo || !(arquivo.w > 0) || !(arquivo.h > 0) || !area || !(area.w > 0) || !(area.h > 0)) return null;
  const esc = Number.isFinite(escala) && escala > 0 ? escala : 1;
  const larguraCm = Math.min(area.w, area.h * (arquivo.w / arquivo.h)) * esc;
  const dpi = dpiEfetivo(arquivo.w, larguraCm);
  const faixa = faixaDeNitidez(dpi);
  return dpi != null && faixa ? { dpi: Math.round(dpi), faixa, larguraCm, nitidaAteCm: larguraNitidaCm(arquivo.w) } : null;
}

const cm = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");

/** O texto do aviso, ou null quando a imagem está boa (só "ruim" avisa, como na vitrine). */
export function avisoDeResolucao(r: ResolucaoDaArte | null, area: AreaCm | null): string | null {
  if (!r || r.faixa !== "ruim" || !area) return null;
  return `Nesse tamanho a imagem fica com ${r.dpi} dpi (área de ${cm(area.w)} × ${cm(area.h)} cm) e pode sair borrada. Nítida até ${cm(r.nitidaAteCm)} cm de largura. Mande uma imagem maior.`;
}
