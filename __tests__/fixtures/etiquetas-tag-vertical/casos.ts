// ============================================================================
// AURA. — Etiquetas: matriz das fixtures do desenho "tag vertical" (22/10/2026)
//
// Medida própria em pé (altura >= 1,5 x largura, customLabel.ts). Caso real:
// Doce Encanto, Zebra ZD220, tag de couchê 35x60 mm, 3 colunas, rolo de
// 105 mm, sem vão — a medida gravada na conta é {35, 60, 3 colunas, 0, 0}.
// Gravadas uma vez a partir do código deste card; o teste
// etiquetaTagVertical.test.ts compara byte a byte.
//
// NUNCA regravar uma fixture para o teste passar.
// ============================================================================
import { buildLabelHtml, buildLabelPreviewHtml, type LabelItem } from "@/components/screens/estoque/labels/buildLabelHtml";
import type { CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";

export type CasoTag = { nome: string; gerar: () => string };

export const LOJA_TAG = "Doce Encanto";
export const MEDIDA_DOCE_ENCANTO: CustomLabelSpec = {
  id: "m1", larguraMm: 35, alturaMm: 60, colunas: 3, espacoLadoMm: 0, espacoLinhaMm: 0, ajusteXMm: 0, ajusteYMm: 0,
};

// Com variante: cor por nome, cor em hex (vira nome), só tamanho, só cor.
export const ITENS_COM_VARIANTE: LabelItem[] = [
  { name: "Vestido Floral Alcinha", price: 159.99, barcode: "7891234567895", size: "M", color: "Azul", qty: 1, sku: "221" },
  { name: "Blusa Canelada", price: 189.99, barcode: "7891033948208", size: "P", color: "#ffc0cb", qty: 1, sku: "371" },
  { name: "Saia Midi", price: 130.99, barcode: "2001234567893", size: "G", color: "Rosa", qty: 2, sku: "451" },
  { name: "Body", price: 49.9, barcode: "7891234567896", size: "", color: "Verde militar", qty: 1, sku: "12" },
  { name: "Short", price: 79.9, barcode: "7891234567899", size: "ÚNICO", color: "", qty: 1, sku: "13" },
];
// Sem variante: sem SKU, SKU placeholder do cadastro ("---") e código que
// não é EAN-13 (cai no CODE128).
export const ITENS_SEM_VARIANTE: LabelItem[] = [
  { name: "Laço de Cabelo", price: 19.9, barcode: "7891234567895", size: "", color: "", qty: 1, sku: "88" },
  { name: "Meia Soquete", price: 9.9, barcode: "SKU-00123", size: "", color: "", qty: 1, sku: "---" },
  { name: "Tiara", price: 15, barcode: "2001234567893", size: "", color: "", qty: 1 },
];
export const ITENS_NOME_LONGO: LabelItem[] = [
  { name: "Conjunto Moletom Infantil Unicórnio Arco-Íris com Capuz e Bolso Canguru", price: 219.9, barcode: "7891234567895", size: "4", color: "Lilás", qty: 1, sku: "1042" },
  { name: "Vestido <Festa> & \"Daminha\" Tule Bordado Manga Longa", price: 349, barcode: "7891033948208", size: "8", color: "#ffffff", qty: 2, sku: "VES-001" },
];
export const ITENS_PRECO_MILHAR: LabelItem[] = [
  { name: "Vestido de Noiva Infantil", price: 1234.56, barcode: "7891234567895", size: "6", color: "Branco", qty: 1, sku: "900" },
  { name: "Kit Batizado Completo", price: 12345.6, barcode: "7891033948208", size: "", color: "", qty: 1, sku: "901" },
  { name: "Mochila", price: 1000, barcode: "2001234567893", size: "", color: "Rosa", qty: 1, sku: "902" },
];

export function casosTag(): CasoTag[] {
  const bc = { mode: "barcode" as const, storeName: LOJA_TAG, showStoreName: true, customSpec: MEDIDA_DOCE_ENCANTO };
  return [
    { nome: "tag-35x60-3col-com-variante", gerar: () => buildLabelHtml(ITENS_COM_VARIANTE, bc) },
    { nome: "tag-35x60-sem-variante", gerar: () => buildLabelHtml(ITENS_SEM_VARIANTE, bc) },
    { nome: "tag-35x60-nome-longo", gerar: () => buildLabelHtml(ITENS_NOME_LONGO, bc) },
    { nome: "tag-35x60-preco-milhar", gerar: () => buildLabelHtml(ITENS_PRECO_MILHAR, bc) },
    { nome: "tag-35x60-sem-loja", gerar: () => buildLabelHtml(ITENS_COM_VARIANTE, { ...bc, showStoreName: false }) },
    { nome: "tag-35x60-previa", gerar: () => buildLabelPreviewHtml(ITENS_COM_VARIANTE, bc) },
    { nome: "tag-35x52.5-1col", gerar: () => buildLabelHtml(ITENS_COM_VARIANTE, { ...bc, customSpec: { ...MEDIDA_DOCE_ENCANTO, alturaMm: 52.5, colunas: 1 } }) },
  ];
}
