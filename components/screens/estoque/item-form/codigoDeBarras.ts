// ============================================================
// AURA. — Cadastro de item · gerar código de barras (puro, sem React)
// ============================================================
import { generateEAN13 } from "@/components/screens/estoque/labels/buildLabelHtml";

// 24/09/2026 (loja Essencial): a grade de cor/tamanho só aceitava bipar ou
// digitar o código de barras — quem compra peça sem código (confecção,
// feira) ficava sem nada pra imprimir na etiqueta. "Gerar" usa o MESMO
// gerador do cadastro simples (BarcodeQRSection) e das etiquetas: EAN-13
// interno de prefixo 200, com dígito verificador válido — o código gravado
// == o impresso == o que o PDV lê. Semente aleatória por clique (como no
// cadastro simples) e sem repetir código dentro da própria grade.
export function novoCodigoDeBarras(chave: string, usados: Set<string>): string {
  for (let t = 0; t < 20; t++) {
    const c = generateEAN13(chave + "|" + Date.now() + "|" + Math.random().toString(36).slice(2) + "|" + t);
    if (!usados.has(c)) { usados.add(c); return c; }
  }
  const c = generateEAN13(chave + "|" + Math.random().toString(36).slice(2) + "|" + Math.random().toString(36).slice(2));
  usados.add(c);
  return c;
}
