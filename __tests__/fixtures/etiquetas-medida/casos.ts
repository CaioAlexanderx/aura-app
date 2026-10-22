// ============================================================================
// AURA. — Etiquetas: matriz das fixtures douradas da "Minha medida" (22/10/2026)
//
// Antes do desenho "tag vertical" (customLabel.ts, medida própria em pé com
// altura >= 1,5 x largura), o HTML da medida livre de hoje — desenho
// editorial, em várias proporções — foi gravado nesta pasta a partir do
// buildLabelHtml.ts de origin/main (7d7d05a0), um arquivo por caso. O teste
// etiquetaMedidaLivreDourada.test.ts compara byte a byte.
//
// Cobre medidas deitadas, quadradas e em pé logo ABAIXO da linha de 1,5x
// (35x52 e 40x59,9), que têm de continuar no editorial, e o que a medida em
// pé 35x60 NÃO muda: QR e o teste de posição (moldura).
//
// NUNCA regravar uma fixture para o teste passar: se quebrar, o bug está no
// código novo.
// ============================================================================
import {
  buildLabelHtml, buildCustomLabelTestHtml, buildLabelPreviewHtml, type LabelItem,
} from "@/components/screens/estoque/labels/buildLabelHtml";
import type { CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";
import { ITENS_DOURADOS } from "../etiquetas/casos";

export type CasoMedida = { nome: string; gerar: () => string };

const LOJA = "Toda Linda";

function medida(p: Partial<CustomLabelSpec>): CustomLabelSpec {
  return { id: "m1", larguraMm: 50, alturaMm: 30, colunas: 1, espacoLadoMm: 3, espacoLinhaMm: 2, ajusteXMm: 0, ajusteYMm: 0, ...p };
}

const COM_CARTAO: LabelItem[] = [
  { name: "Cimento CP II 50 kg", price: 38, barcode: "7891234567895", size: "", color: "", qty: 2, cardPrice: 39.9 },
  { name: "Camiseta Basica Algodao", price: 1234.56, barcode: "7891234567896", size: "M", color: "Azul", qty: 1 },
];

export function casosMedida(): CasoMedida[] {
  const bc = { mode: "barcode" as const, storeName: LOJA, showStoreName: true };
  const qr = { mode: "qr" as const, storeName: LOJA, showStoreName: true };
  const lista: CasoMedida[] = [];
  const add = (nome: string, gerar: () => string) => lista.push({ nome: nome, gerar: gerar });

  add("medida-50x30-1col", () => buildLabelHtml(ITENS_DOURADOS, { ...bc, customSpec: medida({}) }));
  add("medida-50x30-qr", () => buildLabelHtml(ITENS_DOURADOS, { ...qr, customSpec: medida({}) }));
  add("medida-50x30-sem-loja", () => buildLabelHtml(ITENS_DOURADOS, { ...bc, showStoreName: false, customSpec: medida({}) }));
  add("medida-50x30-ajuste-xy", () => buildLabelHtml(ITENS_DOURADOS, { ...bc, customSpec: medida({ ajusteXMm: 1.5, ajusteYMm: -0.5 }) }));
  add("medida-50x30-cartao", () => buildLabelHtml(COM_CARTAO, { ...bc, customSpec: medida({}) }));
  add("medida-50x30-previa", () => buildLabelPreviewHtml(ITENS_DOURADOS, { ...bc, customSpec: medida({}) }));
  add("medida-40x25-2col", () => buildLabelHtml(ITENS_DOURADOS, { ...bc, customSpec: medida({ larguraMm: 40, alturaMm: 25, colunas: 2 }) }));
  add("medida-33x21-3col-vao", () => buildLabelHtml(ITENS_DOURADOS, { ...bc, customSpec: medida({ larguraMm: 33, alturaMm: 21, colunas: 3, espacoLadoMm: 3, espacoLinhaMm: 2.5 }) }));
  add("medida-60x40", () => buildLabelHtml(ITENS_DOURADOS, { ...bc, customSpec: medida({ larguraMm: 60, alturaMm: 40 }) }));
  add("medida-80x30", () => buildLabelHtml(ITENS_DOURADOS, { ...bc, customSpec: medida({ larguraMm: 80, alturaMm: 30 }) }));
  add("medida-40x40", () => buildLabelHtml(ITENS_DOURADOS, { ...bc, customSpec: medida({ larguraMm: 40, alturaMm: 40 }) }));
  // Em pé, mas abaixo de 1,5x: continuam no editorial.
  add("medida-35x52-3col", () => buildLabelHtml(ITENS_DOURADOS, { ...bc, customSpec: medida({ larguraMm: 35, alturaMm: 52, colunas: 3, espacoLadoMm: 0, espacoLinhaMm: 0 }) }));
  add("medida-40x59.9", () => buildLabelHtml(ITENS_DOURADOS, { ...bc, customSpec: medida({ larguraMm: 40, alturaMm: 59.9 }) }));
  add("medida-35x52-previa", () => buildLabelPreviewHtml(ITENS_DOURADOS, { ...bc, customSpec: medida({ larguraMm: 35, alturaMm: 52, colunas: 3, espacoLadoMm: 0, espacoLinhaMm: 0 }) }));
  // Medida em pé da Doce Encanto: QR e teste de posição não mudam.
  add("medida-35x60-qr", () => buildLabelHtml(ITENS_DOURADOS, { ...qr, customSpec: medida({ larguraMm: 35, alturaMm: 60, colunas: 3, espacoLadoMm: 0, espacoLinhaMm: 0 }) }));
  add("medida-35x60-teste-posicao", () => buildCustomLabelTestHtml(medida({ larguraMm: 35, alturaMm: 60, colunas: 3, espacoLadoMm: 0, espacoLinhaMm: 0 })));
  return lista;
}
