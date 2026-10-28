// ============================================================================
// AURA. — Etiquetas: matriz das fixtures do estilo "boutique" (28/10/2026)
//
// Estilo OPT-IN da "Minha medida" (customLabel.ts, estilo: "boutique"),
// aprovado pelo Caio para a Lulume Baby & Kids (40x25 mm, 2 colunas). Faixa
// preta no topo com o nome da loja vazado, peça, cor/tamanho, código de
// barras (o MESMO .bc-box/SVG/BARCODE_OPTS, LOCKED) e preço com filete.
//
// Cobre: loja com nome longo e curto (prova o auto-encolher da faixa), itens
// com cor/tam presentes e ausentes (a linha some), sem loja, com preço de
// cartão, medidas menor e maior (escala do texto), QR (cai no editorial, sem
// a boutique) e a proporção em pé em que a boutique VENCE a tag vertical.
//
// Gravadas uma vez a partir do código deste card; o teste
// etiquetaBoutique.test.ts compara byte a byte.
//
// NUNCA regravar uma fixture para o teste passar: se quebrar, o bug está no
// código novo.
// ============================================================================
import { buildLabelHtml, buildLabelPreviewHtml, type LabelItem } from "@/components/screens/estoque/labels/buildLabelHtml";
import type { CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";

export type CasoBoutique = { nome: string; gerar: () => string };

export const LOJA_LULUME = "Lulume Baby & Kids";
export const LOJA_CURTA = "Lili";

/** Medida da Lulume: 40x25 mm, 2 colunas, 2 mm de vão, estilo boutique. */
export const MEDIDA_LULUME: CustomLabelSpec = {
  id: "lulume", larguraMm: 40, alturaMm: 25, colunas: 2, espacoLadoMm: 2, espacoLinhaMm: 2, ajusteXMm: 0, ajusteYMm: 0, estilo: "boutique",
};

function medida(p: Partial<CustomLabelSpec>): CustomLabelSpec {
  return { ...MEDIDA_LULUME, ...p };
}

// Mistura: cor por nome, cor em hex (vira nome), só tamanho, só cor e nenhum.
export const ITENS_MISTO: LabelItem[] = [
  { name: "Vestido Floral Alcinha Infantil", price: 89.9, barcode: "7891234567895", size: "8", color: "VM Chama", qty: 1 },
  { name: "Body Manga Longa Algodão Pima", price: 1234.56, barcode: "7891033948208", size: "P", color: "#ffc0cb", qty: 1 },
  { name: "Conjunto Moletom Bebê", price: 59.9, barcode: "2001234567893", size: "", color: "Rosa", qty: 2 },
  { name: "Macacão Pijama", price: 45, barcode: "7891234567896", size: "M", color: "", qty: 1 },
];
// Itens da Lulume importados: cor/tam no nome, campos vazios -> a linha some.
export const ITENS_SEM_VARIANTE: LabelItem[] = [
  { name: "Vestido Vermelho Tam 8", price: 89.9, barcode: "7891234567895", size: "", color: "", qty: 1 },
  { name: "Body Rosa Tam P", price: 39.9, barcode: "7891033948208", size: "", color: "", qty: 1 },
  { name: "Conjunto Azul Tam M", price: 59.9, barcode: "2001234567893", size: "", color: "", qty: 1 },
];
// Todos com cor + tamanho.
export const ITENS_COM_VARIANTE: LabelItem[] = [
  { name: "Vestido Festa", price: 129.9, barcode: "7891234567895", size: "6", color: "Pink", qty: 1 },
  { name: "Macacão", price: 79.9, barcode: "7891033948208", size: "RN", color: "#1e90ff", qty: 1 },
  { name: "Short Saia", price: 49.9, barcode: "2001234567893", size: "ÚNICO", color: "Verde", qty: 1 },
];
// Nome longo com caracteres que precisam de escape, preço de milhar.
export const ITENS_NOME_LONGO: LabelItem[] = [
  { name: "Conjunto Moletom Infantil Unicórnio Arco-Íris com Capuz & Bolso", price: 219.9, barcode: "7891234567895", size: "4", color: "Lilás", qty: 1 },
  { name: 'Vestido <Festa> & "Daminha" Tule Bordado', price: 349, barcode: "7891033948208", size: "10", color: "#ffffff", qty: 2 },
];

export function casosBoutique(): CasoBoutique[] {
  const bc = { mode: "barcode" as const, storeName: LOJA_LULUME, showStoreName: true };
  const lista: CasoBoutique[] = [];
  const add = (nome: string, gerar: () => string) => lista.push({ nome: nome, gerar: gerar });

  // Caso principal da Lulume.
  add("boutique-40x25-2col", () => buildLabelHtml(ITENS_MISTO, { ...bc, customSpec: MEDIDA_LULUME }));
  // Loja de nome curto (prova o outro extremo do auto-encolher da faixa).
  add("boutique-40x25-loja-curta", () => buildLabelHtml(ITENS_MISTO, { ...bc, storeName: LOJA_CURTA, customSpec: MEDIDA_LULUME }));
  // Itens importados da Lulume: cor/tam vazios -> a linha some.
  add("boutique-40x25-sem-variante", () => buildLabelHtml(ITENS_SEM_VARIANTE, { ...bc, customSpec: MEDIDA_LULUME }));
  // Todos com cor + tamanho ("Cor • Tam X").
  add("boutique-40x25-com-variante", () => buildLabelHtml(ITENS_COM_VARIANTE, { ...bc, customSpec: MEDIDA_LULUME }));
  // Nome longo com escape e preço de milhar.
  add("boutique-40x25-nome-longo", () => buildLabelHtml(ITENS_NOME_LONGO, { ...bc, customSpec: MEDIDA_LULUME }));
  // Sem nome da loja: nenhuma faixa preta vazia.
  add("boutique-40x25-sem-loja", () => buildLabelHtml(ITENS_MISTO, { ...bc, showStoreName: false, customSpec: MEDIDA_LULUME }));
  // Preço no cartão: linha "Cartão" abaixo do preço.
  add("boutique-40x25-cartao", () => buildLabelHtml(
    [{ ...ITENS_MISTO[0], cardPrice: 94.9 }, { ...ITENS_MISTO[3], cardPrice: 47.9 }],
    { ...bc, customSpec: MEDIDA_LULUME },
  ));
  // Prévia em tamanho real (tela).
  add("boutique-40x25-previa", () => buildLabelPreviewHtml(ITENS_MISTO, { ...bc, customSpec: MEDIDA_LULUME }));
  // Medida menor (escalaTexto = 1).
  add("boutique-33x21-3col", () => buildLabelHtml(ITENS_MISTO, { ...bc, customSpec: medida({ larguraMm: 33, alturaMm: 21, colunas: 3, espacoLadoMm: 3, espacoLinhaMm: 2.5 }) }));
  // Medida maior (texto proporcionalmente maior, escalaTexto > 1).
  add("boutique-50x30-1col", () => buildLabelHtml(ITENS_MISTO, { ...bc, customSpec: medida({ larguraMm: 50, alturaMm: 30, colunas: 1, espacoLadoMm: 3 }) }));
  // Proporção em pé (35x60): o opt-in boutique VENCE a tag vertical.
  add("boutique-35x60-vence-tag", () => buildLabelHtml(ITENS_MISTO, { ...bc, customSpec: medida({ larguraMm: 35, alturaMm: 60, colunas: 3, espacoLadoMm: 0, espacoLinhaMm: 0 }) }));
  // QR: cai no editorial (sem a boutique), como a medida sem o opt-in.
  add("boutique-40x25-qr", () => buildLabelHtml(ITENS_MISTO, { mode: "qr", storeName: LOJA_LULUME, showStoreName: true, customSpec: MEDIDA_LULUME }));
  return lista;
}
