// ============================================================================
// AURA. — Etiquetas: matriz do desenho escolhido pela loja (18/10/2026, f1-16)
//
// pdv_settings.label_design ("classico" | "editorial"; ausente = padrão do
// modelo). A matriz é a MESMA de ../etiquetas/casos.ts (mesmos itens, mesma
// loja, mesmos nomes de caso), com o desenho passado no buildLabelHtml.
//
// Fixtures desta pasta: os desenhos que NÃO existiam antes da opção —
// 99x21 e 30x25 editoriais e 105x21 clássico — gravados uma vez a partir do
// código deste card. As 44 de ../etiquetas continuam intocadas e também são
// conferidas com o desenho explícito igual ao padrão do modelo.
//
// NUNCA regravar uma fixture para o teste passar.
// ============================================================================
import {
  buildLabelHtml, buildLabelTestHtml, buildLabelPreviewHtml, labelSupportsCalibration,
  type LabelDesign, type LabelSizeKey,
} from "@/components/screens/estoque/labels/buildLabelHtml";
import { ITENS_DOURADOS } from "../etiquetas/casos";

export type CasoDesenho = { nome: string; gerar: () => string };

const LOJA = "Toda Linda";

/** Os casos de ../etiquetas/casos.ts para um modelo, com `design` no
 *  buildLabelHtml (undefined = sem a opção, igual ao original). */
export function casosDoModelo(size: LabelSizeKey, design: LabelDesign | null | undefined | string): CasoDesenho[] {
  const d = design as LabelDesign | null | undefined;
  const bc = { mode: "barcode" as const, storeName: LOJA, showStoreName: true, labelSize: size, design: d };
  const qr = { mode: "qr" as const, storeName: LOJA, showStoreName: true, labelSize: size, design: d };
  const lista: CasoDesenho[] = [];
  lista.push({ nome: size + "-etiqueta-barcode-ajuste-0", gerar: () => buildLabelHtml(ITENS_DOURADOS, { ...bc, offsetMm: 0 }) });
  lista.push({ nome: size + "-etiqueta-barcode-ajuste-menos-2", gerar: () => buildLabelHtml(ITENS_DOURADOS, { ...bc, offsetMm: -2 }) });
  lista.push({ nome: size + "-etiqueta-barcode-sem-loja", gerar: () => buildLabelHtml(ITENS_DOURADOS, { ...bc, showStoreName: false }) });
  lista.push({ nome: size + "-etiqueta-qr", gerar: () => buildLabelHtml(ITENS_DOURADOS, qr) });
  lista.push({ nome: size + "-teste-1-linha-ajuste-0", gerar: () => buildLabelTestHtml({ ...bc, offsetMm: 0 }) });
  lista.push({ nome: size + "-teste-2-linhas-ajuste-1-5", gerar: () => buildLabelTestHtml({ ...bc, offsetMm: 1.5, rows: 2 }) });
  lista.push({ nome: size + "-previa", gerar: () => buildLabelPreviewHtml(ITENS_DOURADOS, bc) });
  if (labelSupportsCalibration(size)) {
    const cal = { continuous: true, rowPitchMm: 24.1, offsetYMm: 0.7 };
    lista.push({ nome: size + "-etiqueta-continuo", gerar: () => buildLabelHtml(ITENS_DOURADOS, { ...bc, offsetMm: -1, ...cal }) });
    lista.push({ nome: size + "-etiqueta-desloc-vertical", gerar: () => buildLabelHtml(ITENS_DOURADOS, { ...bc, offsetYMm: -1.2 }) });
    lista.push({ nome: size + "-teste-continuo", gerar: () => buildLabelTestHtml({ ...bc, ...cal, rows: 2 }) });
  }
  return lista;
}

/** Desenhos novos (só existem com a opção): nome do arquivo = desenho + caso. */
export const DESENHOS_NOVOS: Array<{ size: LabelSizeKey; design: LabelDesign }> = [
  { size: "99x21", design: "editorial" },
  { size: "30x25", design: "editorial" },
  { size: "105x21", design: "classico" },
];

export function casosNovos(): CasoDesenho[] {
  const lista: CasoDesenho[] = [];
  DESENHOS_NOVOS.forEach(function (n) {
    casosDoModelo(n.size, n.design).forEach(function (c) {
      lista.push({ nome: n.design + "-" + c.nome, gerar: c.gerar });
    });
  });
  return lista;
}
