// ============================================================================
// AURA. — Etiquetas: matriz das fixtures douradas (15/10/2026)
//
// Clientes imprimem etiqueta hoje. Antes da "Minha medida" (medida livre em
// mm), o HTML de TODOS os modelos fixos foi gravado a partir do
// buildLabelHtml.ts de origin/main (48f5bf59) nesta pasta, um arquivo por
// caso. O teste etiquetasDouradas.test.ts compara byte a byte.
//
// Esta matriz é a fonte única dos casos: quem gravou e quem compara usam a
// mesma lista. Não é teste (o jest só roda *.test.ts).
//
// NUNCA regravar uma fixture para o teste passar: se quebrar, o bug está no
// código novo.
// ============================================================================
import {
  buildLabelHtml, buildLabelTestHtml, buildLabelPreviewHtml, labelSupportsCalibration,
  type LabelItem, type LabelSizeKey,
} from "@/components/screens/estoque/labels/buildLabelHtml";

// Os modelos fixos de hoje, escritos à mão (não LABEL_SIZE_KEYS): se alguém
// tirar um modelo do seletor, a fixture dele continua cobrando.
export const MODELOS_FIXOS: LabelSizeKey[] = ["99x21", "105x21", "30x25", "58mm", "40x25"];

// Nome curto e longo, com e sem variação, preço com centavos e com milhar,
// EAN-13 válido e código interno (não EAN-13: cai no CODE128), cor em hex.
export const ITENS_DOURADOS: LabelItem[] = [
  { name: "Blusa", price: 59.9, barcode: "7891234567895", size: "", color: "", qty: 1 },
  { name: "Vestido Midi Tule Bordado Manga Longa Festa", price: 1234.56, barcode: "7891033948208", size: "G", color: "#ffffff", qty: 2 },
  { name: "Camiseta Algodão Básica", price: 49.99, barcode: "SKU-00123", size: "M", color: "Azul", qty: 2 },
  { name: "Calça Jeans", price: 189.9, barcode: "2001234567893", size: "42", color: "", qty: 1 },
];

export type CasoDourado = { nome: string; gerar: () => string };

const LOJA = "Toda Linda";

export function casosDourados(): CasoDourado[] {
  const lista: CasoDourado[] = [];
  MODELOS_FIXOS.forEach(function (size) {
    const bc = { mode: "barcode" as const, storeName: LOJA, showStoreName: true, labelSize: size };
    const qr = { mode: "qr" as const, storeName: LOJA, showStoreName: true, labelSize: size };
    lista.push({ nome: size + "-etiqueta-barcode-ajuste-0", gerar: () => buildLabelHtml(ITENS_DOURADOS, { ...bc, offsetMm: 0 }) });
    lista.push({ nome: size + "-etiqueta-barcode-ajuste-menos-2", gerar: () => buildLabelHtml(ITENS_DOURADOS, { ...bc, offsetMm: -2 }) });
    lista.push({ nome: size + "-etiqueta-barcode-sem-loja", gerar: () => buildLabelHtml(ITENS_DOURADOS, { ...bc, showStoreName: false }) });
    lista.push({ nome: size + "-etiqueta-qr", gerar: () => buildLabelHtml(ITENS_DOURADOS, qr) });
    lista.push({ nome: size + "-teste-1-linha-ajuste-0", gerar: () => buildLabelTestHtml({ ...bc, offsetMm: 0 }) });
    lista.push({ nome: size + "-teste-2-linhas-ajuste-1-5", gerar: () => buildLabelTestHtml({ ...bc, offsetMm: 1.5, rows: 2 }) });
    lista.push({ nome: size + "-previa", gerar: () => buildLabelPreviewHtml(ITENS_DOURADOS, bc) });
    // Contínuo, passo e deslocamento vertical só existem nos modelos que
    // aceitam a calibração por computador (105x21, 30x25 e 40x25).
    if (labelSupportsCalibration(size)) {
      const cal = { continuous: true, rowPitchMm: 24.1, offsetYMm: 0.7 };
      lista.push({ nome: size + "-etiqueta-continuo", gerar: () => buildLabelHtml(ITENS_DOURADOS, { ...bc, offsetMm: -1, ...cal }) });
      lista.push({ nome: size + "-etiqueta-desloc-vertical", gerar: () => buildLabelHtml(ITENS_DOURADOS, { ...bc, offsetYMm: -1.2 }) });
      lista.push({ nome: size + "-teste-continuo", gerar: () => buildLabelTestHtml({ ...bc, ...cal, rows: 2 }) });
    }
  });
  return lista;
}
