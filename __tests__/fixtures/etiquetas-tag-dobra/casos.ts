// ============================================================================
// AURA. — Etiquetas: matriz das fixtures da tag vertical COM linha de dobra
// (28/10/2026, opção B do mockup https://claude.ai/artifact/7brLRCqJvVV5sLLUxmicAD)
//
// Caso real: Doce Encanto, Zebra ZD220t, tag de couchê 35x60 mm, 3 colunas,
// com a linha pontilhada de dobra a ~40 mm do topo (medida pela foto da tag
// impressa; a loja ainda vai conferir com régua — 43 era a primeira
// estimativa e fica como segundo caso). A medida gravada na conta é
// {35, 60, 3 colunas, 0, 0}; a dobra entra pelo campo novo dobraMm.
//
// "tag-35x60-sem-dobra-3-produtos" foi gravada a partir da MAIN, ANTES do
// código da dobra (prova de que, sem dobraMm, os 3 produtos de exemplo —
// inclusive o com preço no cartão — saem byte a byte como antes). As
// "dobra40"/"dobra43" foram gravadas a partir do código deste card.
//
// NUNCA regravar uma fixture para o teste passar.
// ============================================================================
import { buildLabelHtml, buildLabelPreviewHtml, type LabelItem } from "@/components/screens/estoque/labels/buildLabelHtml";
import type { CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";

export type CasoDobra = { nome: string; gerar: () => string };

export const LOJA_DOBRA = "Doce Encanto";
export const MEDIDA_SEM_DOBRA: CustomLabelSpec = {
  id: "mtag35x60v1", nome: "Tag 35x60 (3 col)", colunas: 3, alturaMm: 60, larguraMm: 35,
  ajusteXMm: 0, ajusteYMm: 0, espacoLadoMm: 0, espacoLinhaMm: 0,
};

// Os 3 produtos de exemplo: nome curto, nome longo (2 linhas) e preço no cartão.
export const ITENS_DOBRA: LabelItem[] = [
  { name: "REGATA CETIM", price: 49.9, barcode: "7891234567895", size: "M", color: "Branco", qty: 1, sku: "221" },
  { name: "Conjunto Moletom Infantil Unicórnio Arco-Íris com Capuz", price: 219.9, barcode: "7891033948208", size: "4", color: "Lilás", qty: 1, sku: "1042" },
  { name: "Vestido Floral Alcinha", price: 159.99, barcode: "2001234567893", size: "G", color: "Rosa", qty: 1, sku: "451", cardPrice: 169.9 },
];

export function casosSemDobra(): CasoDobra[] {
  const bc = { mode: "barcode" as const, storeName: LOJA_DOBRA, showStoreName: true, customSpec: MEDIDA_SEM_DOBRA };
  return [
    { nome: "tag-35x60-sem-dobra-3-produtos", gerar: () => buildLabelHtml(ITENS_DOBRA, bc) },
  ];
}

export const MEDIDA_DOBRA_40: CustomLabelSpec = { ...MEDIDA_SEM_DOBRA, dobraMm: 40 };
export const MEDIDA_DOBRA_43: CustomLabelSpec = { ...MEDIDA_SEM_DOBRA, dobraMm: 43 };

export function casosComDobra(): CasoDobra[] {
  const bc = { mode: "barcode" as const, storeName: LOJA_DOBRA, showStoreName: true, customSpec: MEDIDA_DOBRA_40 };
  return [
    { nome: "tag-35x60-dobra40-3-produtos", gerar: () => buildLabelHtml(ITENS_DOBRA, bc) },
    { nome: "tag-35x60-dobra40-sem-cartao", gerar: () => buildLabelHtml(ITENS_DOBRA.slice(0, 2), bc) },
    { nome: "tag-35x60-dobra40-sem-loja", gerar: () => buildLabelHtml(ITENS_DOBRA, { ...bc, showStoreName: false }) },
    { nome: "tag-35x60-dobra40-previa", gerar: () => buildLabelPreviewHtml(ITENS_DOBRA, bc) },
    { nome: "tag-35x60-dobra43-3-produtos", gerar: () => buildLabelHtml(ITENS_DOBRA, { ...bc, customSpec: MEDIDA_DOBRA_43 }) },
    { nome: "tag-35x60-dobra43-sem-cartao", gerar: () => buildLabelHtml(ITENS_DOBRA.slice(0, 2), { ...bc, customSpec: MEDIDA_DOBRA_43 }) },
  ];
}
