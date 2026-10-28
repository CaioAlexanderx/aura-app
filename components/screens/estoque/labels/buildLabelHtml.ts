// ============================================================================
// AURA. — Gerador HTML de etiquetas (multi-tamanho via LABEL_SIZE_PRESETS)
//
// ╔════════════════════════════════════════════════════════════════════════╗
// ║                    *** DESIGN LOCKED — DO NOT MODIFY ***               ║
// ║                                                                        ║
// ║  Aprovado pela Finesse (cliente piloto varejo moda) em 23/04/2026.     ║
// ║  Esta funcao e CRITICA: etiqueta quebrada = POS nao le = venda perdida ║
// ║                                                                        ║
// ║  07/2026: parametrizado por preset (LABEL_SIZE_PRESETS) pra suportar   ║
// ║  novos tamanhos de etiqueta (ex: 30x25mm) sem tocar no preset "99x21"  ║
// ║  usado pela Finesse. O preset "99x21" DEVE gerar exatamente o mesmo    ║
// ║  HTML de antes — qualquer numero novo do preset "99x21" e regressao.   ║
// ║                                                                        ║
// ║  Zonas LOCKED (nao alterar sem teste real de scanner):                 ║
// ║    1. BARCODE_OPTS            — parametros do JsBarcode                ║
// ║    2. SVG inline              — o <svg id="bc-N" data-code="...">      ║
// ║    3. .bc-inner .bc-box       — container do codigo                    ║
// ║    4. Numeros do preset "99x21" em LABEL_SIZE_PRESETS                  ║
// ║                                                                        ║
// ║  Zonas LIVRES (pode mudar):                                            ║
// ║    - Textos (nome, preco, storeHeader)                                 ║
// ║    - Fonte, cor, peso do texto (nao do barcode)                        ║
// ║    - Margem interna, gap                                               ║
// ║    - Ordem dos elementos de texto (nome/preco/store)                   ║
// ║    - QR code (modo alternativo, nao critico pra POS fisico)            ║
// ║    - Preview bar / guia visual pre-impressao (livre, so tela)          ║
// ║                                                                        ║
// ║  Se ALTERAR BARCODE_OPTS: imprimir UMA etiqueta, escanear com pistola, ║
// ║  confirmar leitura em EAN13 ANTES de fazer deploy.                     ║
// ╚════════════════════════════════════════════════════════════════════════╝
// ============================================================================

import { hexToName } from "@/utils/colorNames";
// 15/10/2026: "Minha medida" (medida livre em mm). O spec vira um preset e
// passa por este mesmo renderizador; sem `customSpec` nada muda (fixtures em
// __tests__/etiquetasDouradas.test.ts).
import { customLabelPreset, mmTxt, type CustomLabelSpec } from "@/components/screens/estoque/labels/customLabel";

// ----- LOCKED: parametros do barcode (validados por Finesse) -----
// Alterar isso quebra a leitura do scanner. Testar SEMPRE com POS fisico.
const BARCODE_OPTS = {
  width:        1.0,      // largura de cada barra em px (NAO mudar)
  height:       24,       // altura do barcode em px (NAO mudar)
  margin:       1,        // margem interna do canvas
  displayValue: true,     // mostrar digitos embaixo
  fontSize:     7,        // fonte dos digitos (NAO aumentar)
  textMargin:   0,        // espaco entre barras e digitos
  font:         "Arial",
  fontOptions:  "bold",
  background:   "#ffffff",
  lineColor:    "#000000",
};
// -----------------------------------------------------------------

// ----- Validacao de codigo de barras -----
// Placeholders conhecidos que nao devem virar etiqueta real.
const BARCODE_PLACEHOLDERS = new Set([
  "", "...", "....", ".....", "-", "--", "---",
  "0", "00", "000", "N/A", "n/a", "NA", "na",
  "sem código", "SEM CÓDIGO", "null", "undefined", "?", "??", "???",
]);
const BARCODE_MIN_LENGTH = 4;

export function isValidBarcode(code: string | null | undefined): boolean {
  if (!code) return false;
  const trimmed = String(code).trim();
  if (trimmed.length < BARCODE_MIN_LENGTH) return false;
  if (BARCODE_PLACEHOLDERS.has(trimmed)) return false;
  if (BARCODE_PLACEHOLDERS.has(trimmed.toLowerCase())) return false;
  if (/^[.\-\s_]+$/.test(trimmed)) return false;
  if (/^(.)\1+$/.test(trimmed)) return false;
  return true;
}

export type InvalidCodeItem = { name: string; code: string; reason: string };

export function validateLabelItems(items: Array<{ name: string; barcode: string }>): InvalidCodeItem[] {
  const invalid: InvalidCodeItem[] = [];
  items.forEach(function(item) {
    const code = String(item.barcode || "").trim();
    if (!code) { invalid.push({ name: item.name, code: "(vazio)", reason: "Sem código cadastrado" }); return; }
    if (code.length < BARCODE_MIN_LENGTH) { invalid.push({ name: item.name, code: code, reason: "Código muito curto (mínimo " + BARCODE_MIN_LENGTH + " caracteres)" }); return; }
    if (BARCODE_PLACEHOLDERS.has(code) || BARCODE_PLACEHOLDERS.has(code.toLowerCase())) { invalid.push({ name: item.name, code: code, reason: "Código placeholder — substitua por SKU real" }); return; }
    if (/^[.\-\s_]+$/.test(code)) { invalid.push({ name: item.name, code: code, reason: "Código inválido (so pontos/tracos)" }); return; }
    if (/^(.)\1+$/.test(code)) { invalid.push({ name: item.name, code: code, reason: "Código repetido (ex: 0000)" }); return; }
  });
  return invalid;
}
// -----------------------------------------------------------------

// ----- EAN-13 utilities -----
// Calcula o digito verificador EAN-13 a partir dos 12 primeiros digitos.
function ean13CheckDigit(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

// Valida se um codigo e um EAN-13 legitimo (13 digitos numericos + check digit correto).
export function isValidEAN13(code: string | null | undefined): boolean {
  if (!code) return false;
  const trimmed = String(code).trim();
  if (!/^\d{13}$/.test(trimmed)) return false;
  return ean13CheckDigit(trimmed.slice(0, 12)) === parseInt(trimmed[12]);
}

// Gera um EAN-13 deterministico para uso interno a partir de qualquer seed.
// Prefixo "200" = reservado GS1 para uso interno (sem registro necessario).
// Mesmo seed sempre gera mesmo codigo — consistencia entre sessoes de impressao.
export function generateEAN13(seed: string): string {
  const s = String(seed || "").trim() || "aura_internal";
  // djb2 hash (32-bit unsigned)
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  const PREFIX = "200"; // 3 digitos
  const digits9 = String(h).padStart(10, "0").slice(-9); // 9 digitos do hash
  const base12 = PREFIX + digits9; // 12 digitos
  const check = ean13CheckDigit(base12);
  return base12 + String(check); // 13 digitos
}
// ----------------------------

// Monta o texto da etiqueta no formato "nome - tamanho - cor".
// ZONA LIVRE (so texto): separador e composicao podem mudar sem teste de pistola.
// O nome e truncado em 16 chars para abrir espaco a tamanho/cor; o CSS .name
// (nowrap + ellipsis + max-height:4mm) garante que excesso seja cortado SEM
// redimensionar a etiqueta. A cor aceita hex (#RRGGBB -> nome PT via hexToName)
// ou um valor ja nomeado (ex.: "Azul", "Vinho").
export function buildLabelName(name: string, size: string, color: string): string {
  if (!size && !color) return name;
  const parts = [name.length > 16 ? name.substring(0, 16).trim() + "..." : name];
  if (size) parts.push(size);
  if (color) {
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) parts.push(hexToName(color));
    else parts.push(String(color).trim());
  }
  return parts.join(" - ");
}

// Tamanho e cor da etiqueta "editorial" (25/09/2026). Mesma leitura de cor
// do buildLabelName (hex -> nome PT), sem o nome do produto e sem corte.
// Vazio quando nao ha nem tamanho nem cor.
function labelVariantParts(size: string, color: string): string[] {
  const parts: string[] = [];
  if (size) parts.push(String(size).trim());
  if (color) {
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) parts.push(hexToName(color));
    else parts.push(String(color).trim());
  }
  return parts.filter(Boolean);
}

// Tag vertical (22/10/2026): cor por nome (hex -> nome PT, como no
// editorial) e preco com separador de milhar ("1.234,56").
function labelColorName(color: string): string {
  if (!color) return "";
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return hexToName(color);
  return String(color).trim();
}
function priceBr(n: number): string {
  const p = n.toFixed(2).split(".");
  return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + p[1];
}
// SKU impresso na tag vertical. Vazio e placeholder ("---", que o cadastro
// grava quando nao ha SKU) somem: a linha "Cod:" nao sai.
function labelSkuText(sku: string | null | undefined): string {
  const t = String(sku == null ? "" : sku).trim();
  if (!t || BARCODE_PLACEHOLDERS.has(t) || BARCODE_PLACEHOLDERS.has(t.toLowerCase()) || /^[.\-\s_]+$/.test(t)) return "";
  return t;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type LabelItem = {
  name: string;
  price: number;
  barcode: string;
  size: string;
  color: string;
  qty: number;
  // 08/06/2026: ids para persistir o EAN-13 gerado no cadastro (produto/variante).
  productId?: string;
  variantId?: string;
  // 22/09/2026 (preco no cartao, docs/mockups/preco-no-cartao.html tela 6):
  // com a opcao da loja ligada a etiqueta SEMPRE sai com os dois precos
  // (e o que torna a cobranca diferente legal) — o de sempre grande e
  // "cartao R$ X" numa linha menor embaixo. Ausente/null = etiqueta de
  // sempre, byte a byte.
  cardPrice?: number | null;
  // 22/10/2026 (tag vertical, customLabel.ts): codigo interno (SKU) do
  // produto, impresso como "Cod: 221" so no desenho "tag vertical". Os
  // outros desenhos nao leem este campo (HTML byte a byte igual).
  sku?: string;
};

// ----- Presets de tamanho de etiqueta -----
// "99x21" e o formato original (Finesse, LOCKED, validado com scanner fisico) —
// rolo 3-across com etiquetas COLADAS (sem vao): pageWidth 99 = 3x33.
//
// "30x25" (rolo da Eryca): 3-across COM vao de 2mm entre colunas E entre linhas
// (medido no rolo fisico). Por isso a geometria e diferente:
//   - pageWidthMm 94  = 3x30 + 2 vaos de 2mm  -> alinha as 3 colunas
//   - pageHeightMm 27 = 25 (label) + 2mm de vao vertical = PASSO de uma linha
//   - colGapMm/rowGapMm 2 -> insere colunas espacadoras e sobra 2mm embaixo
// A pagina de impressao passa a ser o PASSO de uma linha; o conteudo da
// etiqueta ocupa o topo 25mm de cada linha (o resto e o vao). O layout INTERNO
// da celula (fonte, barcode, preco) NAO muda — so a geometria de encaixe.
//
// Um preset SEM colGapMm/rowGapMm (como "99x21") se comporta como antes
// (vao 0), entao presets colados continuam byte-identicos.
// "58mm" (24/09/2026, loja Essencial / Maria Eduarda): impressora termica
// GENERICA de bobina 58mm via Bluetooth (papel continuo, sem vao/sensor).
// Com os presets de 3 colunas (94-99mm de largura) a pagina nao cabia na
// bobina e o driver girava tudo 90 graus: as etiquetas saiam "deitadas" ao
// longo do rolo e a 1a coluna cortada. Aqui e UMA etiqueta por linha, com a
// mesma ordem de layout da Finesse (loja/barras/nome/preco), centralizada
// na largura de 58mm e impressa em retrato (texto atravessando a bobina):
//   - padLeftMm 6    -> (58 - 46) / 2, centraliza na bobina
//   - rowGapMm 3     -> sobra entre etiquetas pra cortar (papel continuo)
//   - cutMarks       -> linha pontilhada de corte no vao
// 1o teste na loja: com as barras no tamanho da Finesse (0,265mm por barra)
// a termica de 203dpi (8 pontos/mm) arredonda cada barra pra 2 ou 3 pontos
// de forma irregular -> barras "apertadas" e a pistola NAO leu. Por isso este
// preset tem barcode PROPRIO (bcModuleMm): cada barra fina = 0,375mm = 3
// pontos exatos da cabeca termica, com zona de silencio de verdade. Celula
// maior (46x25mm) pra caber o EAN-13 nesse tamanho. Os presets da Finesse/
// Eryca continuam com BARCODE_OPTS (LOCKED) — nada muda pra eles.
// "105x21" (25/09/2026, Divina D'Lux / Fabiany): rolo termico 33x21mm,
// 3 colunas, COM vao — vao vertical 2,5mm (espec. do fornecedor) e papel de
// 105mm (105 - 3x33 = 6mm -> 2 vaos de 3mm entre colunas). O "99x21" e
// colado e saia desalinhado nesse rolo (2a/3a coluna 3 e 6mm fora do lugar).
// Mesma mecanica de colGapMm/rowGapMm do "30x25"; o barcode e o da Finesse
// (BARCODE_OPTS, mesma largura de 33mm). O desenho do texto e o "editorial"
// (ver `design` abaixo).
// "40x25" (14/10/2026, resma BC-2249 40x25mm, 2000 etiquetas, impressora
// termica de CUPOM 80mm modelo VT-8360): 2 colunas COM vao. Mesma mecanica
// de colGapMm/rowGapMm do "30x25" e do "105x21"; o desenho e o da Finesse e
// o barcode e o BARCODE_OPTS (LOCKED). Desenho "editorial" (o mesmo aprovado
// para o "105x21", pedido do Caio em 14/10 para a Toda Linda / Kauinny).
// Geometria MEDIDA na loja (teste de 14/10): o papel tem ~82mm (2 x 40 + vao),
// mas a cabeca da impressora so alcanca ~72mm — uma pagina de 80mm era
// reduzida pelo driver a ~90%. Por isso a pagina e de 72mm (impressa a 100%,
// centralizada no rolo) e cada celula tem 35mm: 5mm de cada borda externa do
// papel ficam fora da cabeca, e o conteudo cabe nos 35mm de etiqueta que
// sobram (o barcode da Finesse tem 33mm). Pagina em pe (rowsPerPage 3 =
// 72x82,5mm): pagina mais larga que alta o driver imprime em paisagem e gira
// tudo (mesmo caso do "58mm"). Passo da linha 27,5mm (25 de etiqueta + 2,5 de vao): 27 derivava para cima e 28 derivava para baixo (~0,6mm por linha) nos testes de 12 etiquetas na loja em 14/10; 27,5 e o ponto entre os dois e o vao comum de rolo 40x25.
// NUNCA mudar os numeros do preset "99x21".
export type LabelSizeKey = "99x21" | "105x21" | "30x25" | "58mm" | "40x25";

export type LabelPreset = {
  pageWidthMm: number;
  pageHeightMm: number;
  cols: number;
  cellWidthMm: number;
  cellHeightMm: number;
  colGapMm?: number;
  rowGapMm?: number;
  // Margem esquerda (mm) antes da 1a coluna — so presets de bobina larga
  // demais pra etiqueta (ex: 58mm com 1 coluna). Ausente => 0 (byte-identico).
  padLeftMm?: number;
  // Linha pontilhada de corte no vao entre linhas (papel continuo).
  cutMarks?: boolean;
  // Barcode dimensionado em mm fisicos (impressora termica). Com isso o
  // preset NAO usa BARCODE_OPTS: cada modulo (barra fina) = bcModuleMm,
  // alinhado aos pontos da cabeca termica. Ausente => BARCODE_OPTS (LOCKED).
  bcModuleMm?: number;
  bcBarHeightMm?: number;
  // Linhas por pagina de impressao. Pagina "deitada" (largura > altura, ex.
  // 58x28) faz o Chrome/driver imprimir em PAISAGEM e girar tudo 90 graus
  // na bobina — foi o 2o teste da Essencial (24/09): o scanner leu, mas as
  // etiquetas sairam lado a lado ao longo do rolo. Com 3 linhas a pagina
  // vira 58x84mm (em pe) e sai em retrato, uma embaixo da outra.
  // Ausente => 1 (byte-identico).
  rowsPerPage?: number;
  // Desenho do texto da etiqueta (25/09/2026, Divina D'Lux / Fabiany —
  // mockup docs/mockups/etiqueta-33x21-vao.html, desenho "C · Editorial",
  // aprovado pelo Caio). Na termica de 203dpi o nome em 5,5pt peso 500 saia
  // fino e falhado, e cortado em 16 letras. "editorial": alinhada a
  // esquerda, Montserrat em negrito, nome inteiro em ate 2 linhas, selo de
  // tamanho/cor ao lado do preco e o codigo de barras no rodape (MESMO
  // .bc-box/SVG/BARCODE_OPTS). Ausente => layout Finesse (byte-identico).
  // 22/10/2026: "tagVertical" so existe na "Minha medida" em pe (altura >=
  // 1,5 x largura, customLabel.ts). Nenhum modelo fixo usa.
  // 28/10/2026: "boutique" so existe na "Minha medida" com o opt-in da loja
  // (estilo: "boutique", customLabel.ts). Nenhum modelo fixo usa.
  design?: "editorial" | "tagVertical" | "boutique";
  // Editorial "compacto" (14/10/2026, Toda Linda / 40x25): mais respiro em
  // volta do texto e fontes ~8% menores. NAO toca no .bc-box nem no SVG (o
  // barcode segue o BARCODE_OPTS, LOCKED). So emite CSS neste preset; o
  // "105x21" continua byte-identico.
  edCompact?: boolean;
  // Deslocamento vertical FIXO do conteudo (mm, positivo desce), embutido no
  // modelo. Preset de pagina com varias linhas (rowsPerPage) nao aceita a
  // calibracao por computador; esta e a compensacao do ponto de partida do
  // rolo medida na loja. Ausente => 0 (byte-identico).
  baseOffsetYMm?: number;
  // Aceita a calibracao por computador (passo, deslocamento vertical, modo
  // continuo) mesmo com rowsPerPage. Sem rolo com sensor de vao o ponto de
  // partida varia por impressora; a loja acerta sozinha. Ausente => so os
  // modelos de 1 linha por pagina com vao aceitam (byte-identico).
  calibratable?: boolean;
  uiLabel: string;
};

export const LABEL_SIZE_PRESETS: Record<LabelSizeKey, LabelPreset> = {
  "99x21": { pageWidthMm: 99, pageHeightMm: 21, cols: 3, cellWidthMm: 33, cellHeightMm: 21, uiLabel: "33x21mm (3 colunas)" },
  "105x21": { pageWidthMm: 105, pageHeightMm: 23.5, cols: 3, cellWidthMm: 33, cellHeightMm: 21, colGapMm: 3, rowGapMm: 2.5, design: "editorial", uiLabel: "33x21mm com vão (3 colunas · papel 105mm)" },
  "30x25": { pageWidthMm: 94, pageHeightMm: 27, cols: 3, cellWidthMm: 30, cellHeightMm: 25, colGapMm: 2, rowGapMm: 2, uiLabel: "30x25mm (3 colunas)" },
  "58mm":  { pageWidthMm: 58, pageHeightMm: 28, cols: 1, cellWidthMm: 46, cellHeightMm: 25, rowGapMm: 3, padLeftMm: 6, cutMarks: true, bcModuleMm: 0.375, bcBarHeightMm: 9, rowsPerPage: 3, uiLabel: "Bobina 58mm (1 por linha)" },
  "40x25": { pageWidthMm: 72, pageHeightMm: 27.5, cols: 2, cellWidthMm: 35, cellHeightMm: 25, colGapMm: 2, rowGapMm: 2.5, rowsPerPage: 3, design: "editorial", edCompact: true, calibratable: true, uiLabel: "40x25mm (2 colunas · impressora 80mm)" },
};
export const LABEL_SIZE_KEYS: LabelSizeKey[] = ["99x21", "105x21", "30x25", "58mm", "40x25"];
export const DEFAULT_LABEL_SIZE: LabelSizeKey = "99x21";
// -------------------------------------------

// ----- Desenho da etiqueta, opcao da loja (18/10/2026, card f1-16) -----
// pdv_settings.label_design: "classico" (layout Finesse) | "editorial"
// (desenho C: Montserrat, loja no topo, ajuste automatico) | null/ausente.
// Ausente = o desenho PADRAO do modelo (`design` do preset), byte a byte o
// HTML de antes da opcao (fixtures em __tests__/etiquetasDouradas.test.ts).
// So troca o desenho do TEXTO: geometria (pagina, celula, vao), .bc-box, SVG
// e BARCODE_OPTS sao os mesmos nos dois desenhos.
// A opcao vale nos modelos de celula 33x21 e 30x25 (99x21, 105x21, 30x25).
// 40x25 (editorial compacto), bobina 58mm (barcode proprio, bcModuleMm) e a
// "Minha medida" ficam com o desenho de hoje nesta entrega.
export type LabelDesign = "classico" | "editorial";
export const LABEL_DESIGN_SIZES: LabelSizeKey[] = ["99x21", "105x21", "30x25"];

/** Desenho padrao do modelo (o de sempre, sem escolha da loja). */
export function labelDesignPadrao(size: LabelSizeKey | undefined): LabelDesign {
  const preset = LABEL_SIZE_PRESETS[size || DEFAULT_LABEL_SIZE];
  return preset && preset.design === "editorial" ? "editorial" : "classico";
}

/** Desenho que sai na impressao: a escolha da loja, quando valida e o modelo
 *  aceita a opcao; senao o padrao do modelo. */
export function labelDesignEfetivo(size: LabelSizeKey | undefined, design?: string | null): LabelDesign {
  const key = size || DEFAULT_LABEL_SIZE;
  if ((design === "classico" || design === "editorial") && LABEL_DESIGN_SIZES.indexOf(key) >= 0) return design;
  return labelDesignPadrao(key);
}
// -------------------------------------------

type BuildOptions = {
  mode: "barcode" | "qr";
  storeName: string;
  showStoreName: boolean;
  labelSize?: LabelSizeKey;
  // 26/08/2026: offset horizontal de calibracao (mm) — compensa a margem
  // fisica do driver da impressora, causa raiz do corte recorrente da
  // Finesse. 0 = neutro: NENHUMA regra extra e emitida e o HTML sai
  // byte-identico ao historico (zona LOCKED preservada). O valor vem de
  // pdv_settings.label_offset_mm e o slider da pagina de impressao envia
  // ajustes ao app via postMessage pra persistir.
  offsetMm?: number;
  // 13/10/2026 (Divina D'Lux / Elgin L42 Pro): calibracao da IMPRESSORA,
  // guardada por computador (labelPrinterPrefs), so para os modelos com vao
  // entre linhas (labelSupportsCalibration). Tudo ausente/no padrao =>
  // nenhum byte muda (fixtures em __tests__/etiquetaByteAByte.test.ts).
  //   continuous  — "minha impressora esta em modo continuo": o trabalho
  //                 inteiro sai numa UNICA pagina de altura passo x linhas
  //                 (como o 58mm faz com rowsPerPage). A posicao de cada
  //                 linha vira geometria pura da pagina; nao depende do
  //                 driver avancar o passo certo a cada pagina.
  //   rowPitchMm  — passo entre linhas (etiqueta + vao). Padrao = o
  //                 pageHeightMm do modelo.
  //   offsetYMm   — deslocamento vertical (positivo desce).
  continuous?: boolean;
  rowPitchMm?: number;
  offsetYMm?: number;
  // Marcas de calibracao (so a impressao de teste, buildLabelTestHtml):
  // cantos de cada etiqueta e uma regua de 0 a 20mm na borda esquerda da
  // 1a coluna. Desenhadas como fundo da celula — nao entram no fluxo, nao
  // mexem no .bc-box nem no SVG (zona LOCKED).
  calibrationMarks?: boolean;
  // 15/10/2026 — "Minha medida" (customLabel.ts). Com o spec, a geometria
  // vem dele (labelSize é ignorado) e o ajuste X/Y também: offsetMm da loja,
  // modo contínuo, passo e deslocamento vertical por computador não valem
  // para a medida livre (o ajuste dela já é por computador). Ausente => nada
  // muda nos modelos fixos.
  customSpec?: CustomLabelSpec | null;
  // Só com customSpec (buildCustomLabelTestHtml): cada etiqueta vira a
  // moldura de teste (moldura 1 mm para dentro da borda, cruz no centro e
  // setas nas 4 bordas), com a mesma geometria e o mesmo ajuste.
  testFrame?: boolean;
  // 18/10/2026 (card f1-16) — pdv_settings.label_design. Ausente/null =
  // desenho padrao do modelo (nada muda). Ignorado com customSpec e nos
  // modelos fora de LABEL_DESIGN_SIZES (ver labelDesignEfetivo).
  design?: LabelDesign | null;
};

// ----- Calibracao da impressora (13/10/2026) -----
// Faixa do ajuste de passo em torno do padrao do modelo e do deslocamento
// vertical. O passo nunca fica menor que a altura da etiqueta.
export const LABEL_PITCH_RANGE_MM = 3;
export const LABEL_OFFSET_Y_RANGE_MM = 10;

function round1(n: number): number { return Math.round(n * 10) / 10; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

/** Modelos em que modo continuo, passo e deslocamento vertical valem: rolo
 *  com vao entre linhas e 1 linha por pagina ("105x21" e "30x25"). O 99x21
 *  (Finesse, LOCKED) e o 58mm (ja continuo, com rowsPerPage) ficam de fora. */
export function labelSupportsCalibration(size: LabelSizeKey | undefined): boolean {
  const preset = LABEL_SIZE_PRESETS[size || DEFAULT_LABEL_SIZE];
  return !!preset && (preset.calibratable === true || ((preset.rowGapMm || 0) > 0 && !preset.rowsPerPage));
}

/** Passo entre linhas efetivo (mm, com decimos). Padrao do modelo quando o
 *  ajuste esta ausente, invalido ou o modelo nao aceita calibracao. */
export function labelRowPitchMm(size: LabelSizeKey | undefined, rowPitchMm?: number | null): number {
  const preset = LABEL_SIZE_PRESETS[size || DEFAULT_LABEL_SIZE];
  if (!labelSupportsCalibration(size) || rowPitchMm == null) return preset.pageHeightMm;
  const raw = Number(rowPitchMm);
  if (!Number.isFinite(raw)) return preset.pageHeightMm;
  const min = Math.max(preset.cellHeightMm, preset.pageHeightMm - LABEL_PITCH_RANGE_MM);
  return round1(Math.min(Math.max(raw, min), preset.pageHeightMm + LABEL_PITCH_RANGE_MM));
}

/** Deslocamento vertical efetivo (mm, com decimos); 0 fora dos modelos com vao. */
export function labelOffsetYMm(size: LabelSizeKey | undefined, offsetYMm?: number | null): number {
  if (!labelSupportsCalibration(size) || offsetYMm == null) return 0;
  const raw = Number(offsetYMm);
  if (!Number.isFinite(raw)) return 0;
  return round1(Math.min(Math.max(raw, -LABEL_OFFSET_Y_RANGE_MM), LABEL_OFFSET_Y_RANGE_MM));
}

/** Altura (mm) da pagina de impressao de um trabalho com `totalRows` linhas.
 *  Fora do modo continuo e a altura de sempre (passo x linhas por pagina). */
export function labelSheetHeightMm(
  size: LabelSizeKey | undefined,
  totalRows: number,
  cal?: { continuous?: boolean; rowPitchMm?: number | null; offsetYMm?: number | null },
): number {
  const preset = LABEL_SIZE_PRESETS[size || DEFAULT_LABEL_SIZE];
  const pitch = labelRowPitchMm(size, cal && cal.rowPitchMm);
  if (cal && cal.continuous === true && labelSupportsCalibration(size)) {
    // Deslocamento para baixo estica a pagina, senao a ultima linha cortaria.
    // Modelo de pagina em pe (rowsPerPage): nunca menos que as linhas de uma
    // pagina, senao a folha fica mais larga que alta e o driver gira tudo.
    return round2(pitch * Math.max(1, totalRows, preset.rowsPerPage || 0) + Math.max(0, labelOffsetYMm(size, cal.offsetYMm)));
  }
  return pitch * (preset.rowsPerPage || 1);
}
// -------------------------------------------------

export function buildLabelHtml(items: LabelItem[], options: BuildOptions): string {
  const isQR = options.mode === "qr";
  // "Minha medida" (15/10/2026): null em todo modelo fixo — cada uso abaixo
  // e um `custom ? ... : <expressao de antes>`.
  const custom = options.customSpec ? customLabelPreset(options.customSpec) : null;
  const testFrame = !!custom && options.testFrame === true;
  const preset: LabelPreset = custom || LABEL_SIZE_PRESETS[options.labelSize || DEFAULT_LABEL_SIZE];
  const COLS = preset.cols;
  // Vao horizontal entre colunas (0 = etiquetas coladas, comportamento original).
  const colGapMm = preset.colGapMm || 0;
  // Margens laterais (so presets com padLeftMm). A da direita fecha a largura
  // da pagina pra table-layout:fixed nao esticar a celula. 0 => nada emitido.
  const padLeftMm = preset.padLeftMm || 0;
  // Calibracao da impressora (13/10/2026). No padrao: pitchMm ===
  // preset.pageHeightMm, offsetYMm === 0 e continuous === false.
  // Medida livre: passo = altura + espaco entre linhas, 1 linha por pagina,
  // e o ajuste X/Y e o do proprio spec.
  const pitchMm = custom ? custom.pageHeightMm : labelRowPitchMm(options.labelSize, options.rowPitchMm);
  const baseYMm = preset.baseOffsetYMm || 0;
  const offsetYMm = custom ? custom.ajusteYMm : baseYMm === 0
    ? labelOffsetYMm(options.labelSize, options.offsetYMm)
    : round1(labelOffsetYMm(options.labelSize, options.offsetYMm) + baseYMm);
  const continuous = !custom && options.continuous === true && labelSupportsCalibration(options.labelSize);
  const padRightMm = padLeftMm > 0 ? Math.max(0, preset.pageWidthMm - padLeftMm - preset.cols * preset.cellWidthMm - (preset.cols - 1) * colGapMm) : 0;
  const rawOffset = Number(options.offsetMm);
  const offsetMm = custom ? custom.ajusteXMm : Number.isFinite(rawOffset) ? Math.min(Math.max(rawOffset, -8), 5) : 0;
  const storeHeader = options.showStoreName && options.storeName ? esc(options.storeName.toUpperCase()) : "";
  const totalLabels = testFrame ? COLS : items.reduce((s, i) => s + i.qty, 0);
  // Desenho "editorial" (preset "105x21", 25/09/2026). Tudo que ele emite
  // (CSS, fonte, script de ajuste, marcacao) fica atras desta flag: os
  // presets sem `design` saem byte-identicos.
  // 18/10/2026 (f1-16): nos modelos fixos o desenho pode vir da loja
  // (options.design); ausente, labelDesignEfetivo devolve o `design` do
  // preset — a mesma flag de antes. Medida livre: sempre o do spec.
  // 22/10/2026: "Minha medida" em pe (customLabel.ts, ehTagVertical) usa o
  // desenho "tag vertical" so na etiqueta com codigo de barras. QR e o teste
  // de posicao da medida em pe seguem no editorial, byte a byte como antes.
  const isTagVertical = !!custom && preset.design === "tagVertical" && !isQR && !testFrame;
  // 28/10/2026: estilo "boutique" (opt-in da loja, customLabel.ts). So na
  // etiqueta com codigo de barras; QR e o teste de posicao caem no editorial
  // (como a tag vertical faz), byte a byte como a medida sem o opt-in.
  const isBoutique = !!custom && preset.design === "boutique" && !isQR && !testFrame;
  const isEditorial = custom
    ? preset.design === "editorial" || (preset.design === "tagVertical" && !isTagVertical) || (preset.design === "boutique" && !isBoutique)
    : labelDesignEfetivo(options.labelSize, options.design) === "editorial";
  // 28/10/2026: tag vertical com linha de dobra (customLabel.ts, tagDobraMm;
  // opcao B do mockup). Sem dobra (0 => sem a chave no preset) a tag sai
  // byte a byte como antes.
  const tagDobraMm = isTagVertical && custom && custom.tagDobraMm ? custom.tagDobraMm : 0;

  const cells: string[] = [];
  let labelIdx = 0;

  items.forEach(function (item) {
    const code = esc(item.barcode);
    // Editorial: nome inteiro (sem o corte em 16 letras do buildLabelName) —
    // o CSS quebra em ate 2 linhas e o script de ajuste encolhe a fonte.
    const variantParts = isEditorial ? labelVariantParts(item.size, item.color) : [];
    const labelName = isEditorial
      ? esc([item.name].concat(isQR ? variantParts : []).join(" - "))
      : esc(buildLabelName(item.name, item.size, item.color));
    const price = "R$ " + item.price.toFixed(2).replace(".", ",");
    // ZONA LIVRE (texto do preco). So existe com a opcao ligada. QA
    // 23/09/2026: preco sem rotulo + "cartao R$ X" em 5,5pt era ilegivel na
    // prateleira. Decisao do Caio: os dois precos com rotulo ("Dinheiro ou
    // PIX" / "Cartao"), o do cartao em pelo menos 7pt. Sem cardPrice sai o
    // <div class="price"> de sempre, byte a byte (opcao desligada).
    const hasCard = item.cardPrice != null && item.cardPrice > 0;
    const cardPriceTxt = hasCard ? "R$ " + (item.cardPrice as number).toFixed(2).replace(".", ",") : "";
    const priceBlock = hasCard
      ? '<div class="price-wrap">' +
        '<div class="price-row"><span class="price-lbl">Dinheiro ou PIX</span><span class="price-val">' + price + '</span></div>' +
        '<div class="price-row price-row-card"><span class="price-lbl">Cartão</span><span class="price-val price-val-card">' + cardPriceTxt + '</span></div>' +
        '</div>'
      : '<div class="price">' + price + '</div>';
    const bcInnerClass = hasCard ? "bc-inner bc-inner-card" : "bc-inner";

    for (let q = 0; q < item.qty; q++) {
      if (isQR) {
        const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
          encodeURIComponent(item.barcode) + "&bgcolor=ffffff&color=000000&margin=1";
        cells.push(
          '<td class="cell"><div class="qr-inner"><img src="' + qrUrl + '" class="qr"><div class="info">' +
          (storeHeader ? '<div class="store">' + storeHeader + '</div>' : '') +
          '<div class="name">' + labelName + '</div>' + priceBlock + '</div></div></td>'
        );
      } else if (isTagVertical) {
        // ===== Desenho "tag vertical" (22/10/2026, customLabel.ts) =====
        // Ordem: store -> name -> cod -> var -> bc-box -> price. O .bc-box e
        // o <svg id="bc-N" data-code="..."> sao a MESMA string do layout
        // Finesse (LOCKED) — so a posicao na coluna muda.
        const sku = labelSkuText(item.sku);
        const cor = labelColorName(item.color);
        const tam = item.size ? String(item.size).trim() : "";
        if (tagDobraMm > 0) {
          // Com linha de dobra (28/10/2026): duas zonas. Em cima, o bloco de
          // texto + codigo de barras encostado na linha; embaixo, o preco e
          // a linha "Cartao". Mesmo .bc-box/SVG (LOCKED), so a posicao muda.
          cells.push(
            '<td class="cell"><div class="bc-inner tv dobra"><div class="tv-top"><div class="tv-blk">' +
            (storeHeader ? '<div class="store">' + storeHeader + '</div>' : '') +
            '<div class="name">' + esc(item.name) + '</div>' +
            (sku ? '<div class="cod">Cód: ' + esc(sku) + '</div>' : '') +
            (cor || tam ? '<div class="var">' + (cor ? '<span>C: ' + esc(cor) + '</span>' : '') + (tam ? '<span>T: ' + esc(tam) + '</span>' : '') + '</div>' : '') +
            '<div class="bc-box"><svg id="bc-' + labelIdx + '" data-code="' + code + '"></svg></div>' +
            '</div></div><div class="tv-bot">' +
            '<div class="price"><span class="cur">R$</span>' + priceBr(item.price) + '</div>' +
            (hasCard ? '<div class="card-line">Cartão <b>R$ ' + priceBr(item.cardPrice as number) + '</b></div>' : '') +
            '</div></div></td>'
          );
          labelIdx++;
          continue;
        }
        cells.push(
          '<td class="cell"><div class="bc-inner tv">' +
          (storeHeader ? '<div class="store">' + storeHeader + '</div>' : '') +
          '<div class="name">' + esc(item.name) + '</div>' +
          (sku ? '<div class="cod">Cód: ' + esc(sku) + '</div>' : '') +
          (cor || tam ? '<div class="var">' + (cor ? '<span>C: ' + esc(cor) + '</span>' : '') + (tam ? '<span>T: ' + esc(tam) + '</span>' : '') + '</div>' : '') +
          '<div class="bc-box"><svg id="bc-' + labelIdx + '" data-code="' + code + '"></svg></div>' +
          '<div class="price"><span class="cur">R$</span>' + priceBr(item.price) + '</div>' +
          (hasCard ? '<div class="card-line">Cartão <b>R$ ' + priceBr(item.cardPrice as number) + '</b></div>' : '') +
          '</div></td>'
        );
        // =============================================================
      } else if (isBoutique) {
        // ===== Desenho "boutique" (28/10/2026, opt-in, customLabel.ts) =====
        // Ordem: faixa preta (loja vazada) -> nome -> cor/tam -> bc-box ->
        // preco (com filete). O .bc-box e o <svg id="bc-N" data-code="..."> sao
        // a MESMA string do layout Finesse (LOCKED) — so a posicao na celula
        // muda. A faixa so sai com nome da loja (sem loja, nenhuma faixa preta
        // vazia). Cor/tam na linha "Cor • Tam X"; os dois vazios -> a linha
        // some (produtos da Lulume tem cor/tam no nome e os campos vazios).
        const corBq = labelColorName(item.color);
        const tamBq = item.size ? String(item.size).trim() : "";
        const varBq = [corBq ? corBq : "", tamBq ? "Tam " + tamBq : ""].filter(Boolean).join(" • ");
        cells.push(
          '<td class="cell"><div class="bc-inner bq">' +
          (storeHeader ? '<div class="bq-band"><span class="bq-store">' + storeHeader + '</span></div>' : '') +
          '<div class="bq-body">' +
          '<div class="name">' + esc(item.name) + '</div>' +
          (varBq ? '<div class="var">' + esc(varBq) + '</div>' : '') +
          '<div class="bc-box"><svg id="bc-' + labelIdx + '" data-code="' + code + '"></svg></div>' +
          '<div class="price"><span class="cur">R$</span>' + priceBr(item.price) + '</div>' +
          (hasCard ? '<div class="card-line">Cartão <b>R$ ' + priceBr(item.cardPrice as number) + '</b></div>' : '') +
          '</div></div></td>'
        );
        // =============================================================
      } else if (isEditorial) {
        // ===== Desenho "editorial" (25/09/2026, preset "105x21") =====
        // Ordem: store -> name -> row (selo tamanho/cor + preco) -> bc-box.
        // O .bc-box e o <svg id="bc-N" data-code="..."> sao a MESMA string
        // do layout Finesse (LOCKED) — so a posicao na coluna muda.
        // Preco no cartao (so lojas Matcon): linha "Cartao R$ X" logo abaixo
        // da .row; nada de .price-wrap neste desenho.
        cells.push(
          '<td class="cell"><div class="bc-inner ed' + (hasCard ? ' ed-card' : '') + '">' +
          (storeHeader ? '<div class="store">' + storeHeader + '</div>' : '') +
          '<div class="name">' + labelName + '</div>' +
          '<div class="row">' +
          (variantParts.length ? '<span class="variant">' + esc(variantParts.join(" · ")) + '</span>' : '') +
          '<div class="price"><span class="cur">R$</span>' + item.price.toFixed(2).replace(".", ",") + '</div>' +
          '</div>' +
          (hasCard ? '<div class="card-line">Cartão <b>' + cardPriceTxt + '</b></div>' : '') +
          '<div class="bc-box"><svg id="bc-' + labelIdx + '" data-code="' + code + '"></svg></div>' +
          '</div></td>'
        );
        // =============================================================
      } else {
        // ===== LOCKED STRUCTURE =====
        // Ordem: store -> bc-box -> name -> price
        // NAO mudar as classes nem os parametros do SVG/JsBarcode. A classe
        // extra "bc-inner-card" (so quando ha 2o preco) e ZONA LIVRE — nao
        // toca no .bc-box nem no SVG, so aperta padding/gap ao redor.
        cells.push(
          '<td class="cell"><div class="' + bcInnerClass + '">' +
          (storeHeader ? '<div class="store">' + storeHeader + '</div>' : '') +
          '<div class="bc-box"><svg id="bc-' + labelIdx + '" data-code="' + code + '"></svg></div>' +
          '<div class="name">' + labelName + '</div>' +
          priceBlock + '</div></td>'
        );
        // ============================
      }
      labelIdx++;
    }
  });

  // Teste de posicao da medida livre: uma linha, uma moldura por coluna.
  if (testFrame) {
    for (let c = 0; c < COLS; c++) cells.push('<td class="cell">' + molduraDeTesteSvg(preset.cellWidthMm, preset.cellHeightMm) + '</td>');
  }

  while (cells.length % COLS !== 0) cells.push('<td class="cell"></td>');

  // Insere colunas espacadoras (vao) entre as celulas de cada linha. Com
  // colGapMm=0 (ex: preset 99x21) o separador e vazio -> join identico ao antigo.
  const colSep = colGapMm > 0 ? '<td class="colgap"></td>' : "";
  let rowsHtml = "";
  for (let r = 0; r < cells.length; r += COLS) {
    rowsHtml += "<tr>" + (padLeftMm > 0 ? '<td class="padl"></td>' : "") + cells.slice(r, r + COLS).join(colSep) + (padLeftMm > 0 ? '<td class="padr"></td>' : "") + "</tr>\n";
  }
  const totalRows = cells.length / COLS;
  // Altura da PAGINA de impressao = passo da linha x linhas por pagina; no
  // modo continuo, passo x TODAS as linhas do trabalho (pagina unica).
  const pageSheetHeightMm = custom ? pitchMm : labelSheetHeightMm(options.labelSize, totalRows, { continuous: continuous, rowPitchMm: pitchMm, offsetYMm: offsetYMm });

  let html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += testFrame ? '<title>Teste de posição da etiqueta</title>' : '<title>Etiquetas Aura - ' + totalLabels + ' etiquetas</title>';
  if (!isQR) html += '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></scr' + 'ipt>';
  // Editorial: Montserrat (Google Fonts) so nesse desenho; Arial de reserva.
  if ((isEditorial || isTagVertical) && !isQR) html += '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=swap" rel="stylesheet">';
  // Valores derivados do preset. Pro preset default "99x21" estes calculos
  // reproduzem exatamente os numeros LOCKED originais (33-3=30, min(33,21)-4=17).
  const bcBoxMaxWidthMm = preset.cellWidthMm - 3;
  const qrSizeMm = Math.min(preset.cellWidthMm, preset.cellHeightMm) - 4;

  html += '<style>';
  // ===== LOCKED CSS — dimensoes da etiqueta (nao mudar pro preset 99x21) =====
  // @page e tr usam pageHeightMm = PASSO da linha (label + vao vertical). Pro
  // 99x21 (sem vao) pageHeightMm == cellHeightMm, entao sai identico ao antigo.
  html += '@page{margin:0;size:' + preset.pageWidthMm + 'mm ' + pageSheetHeightMm + 'mm}*{margin:0;padding:0;box-sizing:border-box}';
  html += 'body{font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;color:#000}';
  // Offset de calibracao: translateX na tabela inteira — nao mexe em barra,
  // fonte nem geometria da celula. Com offsetMm=0 nada e emitido (byte-identico).
  html += 'table{border-collapse:collapse;width:' + preset.pageWidthMm + 'mm;table-layout:fixed' + (offsetYMm !== 0 ? ';transform:translate(' + offsetMm + 'mm,' + offsetYMm + 'mm)' : offsetMm !== 0 ? ';transform:translateX(' + offsetMm + 'mm)' : '') + '}tr{height:' + pitchMm + 'mm;page-break-inside:avoid}';
  // Modo continuo: a pagina mede exatamente passo x linhas. A ultima linha
  // cede 0,3mm do VAO (nunca da etiqueta) pra soma das linhas nao passar da
  // pagina por arredondamento do navegador e jogar a ultima numa 2a pagina.
  if (continuous) html += 'tr:last-child{height:' + round2(Math.max(preset.cellHeightMm, pitchMm - 0.3)) + 'mm}';
  html += '.cell{width:' + preset.cellWidthMm + 'mm;height:' + preset.cellHeightMm + 'mm;overflow:hidden;vertical-align:top;padding:0}';
  // Coluna espacadora = vao horizontal entre etiquetas (so quando colGapMm>0).
  if (padLeftMm > 0) html += '.padl{width:' + padLeftMm + 'mm;padding:0;border:none}.padr{width:' + padRightMm + 'mm;padding:0;border:none}';
  // Linha de corte: pontilhado no meio do vao entre linhas (so na impressao
  // continua, preset com cutMarks). Nao toca na celula nem no barcode.
  if (preset.cutMarks) html += 'tr{background-image:linear-gradient(to right,#000 50%,transparent 50%);background-size:2mm 0.2mm;background-repeat:repeat-x;background-position:0 ' + (preset.cellHeightMm + (preset.pageHeightMm - preset.cellHeightMm) / 2) + 'mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}';
  if (colGapMm > 0) html += '.colgap{width:' + colGapMm + 'mm;height:' + preset.cellHeightMm + 'mm;padding:0;border:none;background:transparent}';
  // ============================================================

  // LOCKED: layout interno da celula barcode (padrao Finesse)
  // Ordem visual: store (topo) → barcode → nome → preco (fundo)
  html += '.bc-inner{padding:0.8mm 1mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;height:' + preset.cellHeightMm + 'mm;width:' + preset.cellWidthMm + 'mm;gap:0.3mm}';
  html += '.bc-inner .store{font-size:5pt;font-weight:700;line-height:1;color:#000;letter-spacing:0.2pt;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  html += '.bc-inner .bc-box{flex:1 1 auto;width:100%;max-width:' + bcBoxMaxWidthMm + 'mm;display:flex;align-items:center;justify-content:center;min-height:0;overflow:hidden;padding:0.2mm 0}';
  html += '.bc-inner .bc-box svg{max-width:100%;max-height:100%;width:auto;height:auto;display:block}';
  html += '.bc-inner .name{font-size:5.5pt;font-weight:500;line-height:1.05;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#000;max-height:4mm}';
  html += '.bc-inner .price{font-size:9pt;font-weight:900;line-height:1;color:#000}';
  // Preco no cartao (22/09/2026, ajustado no QA 23/09/2026): so e emitido
  // quando alguma etiqueta tem o segundo preco — sem ele o CSS continua
  // byte-identico (opcao desligada). Dois precos com rotulo; o do cartao
  // em pelo menos 7pt (era 5,5pt sem rotulo — ilegivel na prateleira). A
  // classe .bc-inner-card aperta padding/gap/nome SO nas etiquetas com
  // cartao, pra abrir espaco sem encolher o .bc-box (LOCKED) nem mexer na
  // etiqueta sem cartao.
  if (items.some(function (i) { return i.cardPrice != null && i.cardPrice > 0; })) {
    html += '.bc-inner.bc-inner-card{padding:0.5mm 1mm;gap:0.15mm}';
    html += '.bc-inner.bc-inner-card .store{font-size:4.5pt}';
    html += '.bc-inner.bc-inner-card .name{font-size:5pt;max-height:3mm}';
    html += '.price-wrap{display:flex;flex-direction:column;align-items:center;width:100%;gap:0.2mm}';
    html += '.price-row{display:flex;align-items:baseline;gap:0.6mm;white-space:nowrap;line-height:1}';
    html += '.price-lbl{font-size:4.5pt;font-weight:700;color:#000}';
    html += '.price-val{font-size:8pt;font-weight:900;color:#000}';
    html += '.price-row-card .price-val{font-size:7pt}'; // minimo legivel (QA 23/09/2026)
    html += '.qr-inner .price-wrap{margin-top:0.4mm;gap:0.3mm}';
    html += '.qr-inner .price-row{gap:0.8mm}';
    html += '.qr-inner .price-lbl{font-size:5pt}';
    html += '.qr-inner .price-val{font-size:8pt}';
    html += '.qr-inner .price-row-card .price-val{font-size:7pt}';
  }

  // Preset termico (bcModuleMm): o SVG sai com largura/altura em mm reais
  // (definidas no script abaixo), entao o .bc-box nao pode encolher o SVG.
  // Textos um pouco maiores — a celula e maior. So emitido nesse preset.
  if (preset.bcModuleMm) {
    html += '.bc-inner .bc-box{flex:0 0 auto;max-width:none;overflow:visible}';
    html += '.bc-inner .bc-box svg{max-width:none;max-height:none}';
    html += '.bc-inner .store{font-size:6pt}.bc-inner .name{font-size:7pt;max-height:3.2mm}.bc-inner .price{font-size:12pt}';
  }

  // Desenho "editorial" (25/09/2026, preset "105x21"): regras .dC do mockup
  // docs/mockups/etiqueta-33x21-vao.html com .bc-inner.ed no lugar de
  // ".dC .bc-inner". Vem DEPOIS do CSS base e ganha por especificidade — as
  // regras base nao mudam. Sem `order`: a marcacao ja sai na ordem certa.
  // Tudo em negrito e nada abaixo de 0,25mm (a termica de 203dpi apaga
  // hastes finas). O .bc-box so ganha alinhamento/padding — flex, max-width
  // e overflow continuam os da zona LOCKED.
  if (isEditorial && !isQR) {
    html += '.bc-inner.ed{justify-content:flex-start;align-items:flex-start;text-align:left;gap:0.25mm;padding:0.7mm 1.2mm 0.4mm;font-family:Montserrat,Arial,Helvetica,sans-serif}';
    html += '.bc-inner.ed .store{font-size:4.6pt;letter-spacing:1.4pt;text-transform:uppercase}';
    html += '.bc-inner.ed .name{font-size:6.5pt;font-weight:700;line-height:1.08;width:100%;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;max-height:none}';
    html += '.bc-inner.ed .row{display:flex;width:100%;align-items:flex-end;justify-content:space-between;gap:0.8mm;margin-top:0.15mm;flex-wrap:nowrap}';
    html += '.bc-inner.ed .row .variant{display:inline-block;flex:0 1 auto;min-width:0;font-size:4.4pt;font-weight:700;letter-spacing:0.3pt;text-transform:uppercase;line-height:1;border:0.25mm solid #000;border-radius:0.6mm;padding:0.4mm 0.6mm 0.3mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
    html += '.bc-inner.ed .row .variant:empty{display:none}';
    html += '.bc-inner.ed .price{font-size:9.5pt;font-weight:900;line-height:1;margin-left:auto;letter-spacing:-0.3pt;white-space:nowrap;flex-shrink:0}';
    html += '.bc-inner.ed .price .cur{font-size:5.5pt;font-weight:700;vertical-align:top;margin-right:0.4mm;letter-spacing:0;position:relative;top:0.2mm}';
    html += '.bc-inner.ed .bc-box{align-self:center;align-items:flex-end;padding:0.25mm 0 0}';
    // Selo comprido demais pra dividir a linha com o preco (ex.: "UNICO ·
    // VERDE MILITAR"): o script de ajuste poe .stack — nome em 1 linha, selo
    // na linha inteira e o preco embaixo, a direita.
    html += '.bc-inner.ed.stack .name{-webkit-line-clamp:1;font-size:6pt}';
    html += '.bc-inner.ed.stack .row{flex-wrap:wrap;gap:0.2mm}';
    html += '.bc-inner.ed.stack .row .variant{max-width:100%}';
    html += '.bc-inner.ed.stack .price{width:100%;text-align:right;font-size:9pt}'; // 9pt: com 9,5pt a celula empilhada encolhia o barcode 1,6%; com 9pt, 0,2%
    // 18/10/2026 (f1-16): editorial por opcao da loja numa celula alta
    // (30x25). Na celula de 30mm o selo quase sempre empilha, e o nome em
    // 1 linha cortava ("Vestido Midi Tule..."); com 25mm de altura sobra
    // espaco para as 2 linhas. So emitido nesse caso: 105x21, 40x25 e Minha
    // medida (editoriais de fabrica) nao mudam um byte.
    if (!custom && preset.design !== "editorial" && preset.cellHeightMm >= 25) {
      html += '.bc-inner.ed.stack .name{-webkit-line-clamp:2}';
    }
    // Preco no cartao (so lojas Matcon): 1 linha a mais, nome cai pra 1 linha.
    html += '.bc-inner.ed .card-line{font-size:5pt;font-weight:700;line-height:1;white-space:nowrap;width:100%;text-align:right}';
    html += '.bc-inner.ed.ed-card .name{-webkit-line-clamp:1}';
    // Compacto: depois de tudo, ganha por ordem. Padding lateral de 1,9mm
    // (celula 35 - 3,8 = 31,2mm) ainda comporta o barcode de ~30mm sem
    // escalar o SVG; vertical 1,5mm em cima e 1,3mm embaixo.
    if (preset.edCompact) {
      html += '.bc-inner.ed{padding:1.5mm 1.9mm 1.3mm}';
      html += '.bc-inner.ed .store{font-size:4.2pt;letter-spacing:1.2pt}';
      html += '.bc-inner.ed .name{font-size:6pt}';
      html += '.bc-inner.ed .row .variant{font-size:4.1pt}';
      html += '.bc-inner.ed .price{font-size:9pt}';
      html += '.bc-inner.ed .price .cur{font-size:5pt}';
      html += '.bc-inner.ed.stack .name{font-size:5.6pt}';
      html += '.bc-inner.ed.stack .price{font-size:8.5pt}';
    }
    // Medida livre maior que 33x21: texto proporcional (customLabel.ts,
    // escalaTexto). So emitido com customSpec; .bc-box/SVG nao mudam.
    if (custom && custom.escalaTexto !== 1) {
      const k = custom.escalaTexto, cp = !!preset.edCompact;
      const pt = function (n: number) { return round1(n * k) + 'pt'; };
      html += '.bc-inner.ed .store{font-size:' + pt(cp ? 4.2 : 4.6) + '}';
      html += '.bc-inner.ed .name{font-size:' + pt(cp ? 6 : 6.5) + '}';
      html += '.bc-inner.ed .row .variant{font-size:' + pt(cp ? 4.1 : 4.4) + '}';
      html += '.bc-inner.ed .price{font-size:' + pt(cp ? 9 : 9.5) + '}';
      html += '.bc-inner.ed .price .cur{font-size:' + pt(cp ? 5 : 5.5) + '}';
      html += '.bc-inner.ed.stack .name{font-size:' + pt(cp ? 5.6 : 6) + '}';
      html += '.bc-inner.ed.stack .price{font-size:' + pt(cp ? 8.5 : 9) + '}';
      html += '.bc-inner.ed .card-line{font-size:' + pt(5) + '}';
    }
  }

  // Desenho "tag vertical" (22/10/2026, customLabel.ts). So emitido nele:
  // nenhum outro desenho ganha um byte. Vem DEPOIS do CSS base e ganha por
  // especificidade. O .bc-box segue o da zona LOCKED (flex-grow, max-width
  // largura - 3mm, SVG centralizado) e ocupa o espaco livre entre o texto e
  // o preco; a unica regra a mais e o flex-shrink:0 de todos os blocos, que
  // impede o navegador de espremer o .bc-box (e o SVG) se o texto crescer.
  if (isTagVertical && custom) {
    const k = custom.tagEscala || 1;
    const pt = function (n: number) { return round2(n * k) + 'pt'; };
    html += '.bc-inner.tv{justify-content:flex-start;gap:0.6mm;padding:' + (custom.tagTopoMm || 0) + 'mm 1.5mm 2.5mm;font-family:Montserrat,Arial,Helvetica,sans-serif}';
    html += '.bc-inner.tv>div{flex-shrink:0}';
    // 24/10/2026: a loja sai maior que o nome do produto (que vai de 8,5pt a
    // 6,5pt): 10pt em negrito, e o ajuste so a desce ate 9pt (> 8,5pt).
    html += '.bc-inner.tv .store{font-size:' + pt(10) + ';font-weight:700;line-height:1.1;letter-spacing:0.3pt;margin-bottom:0.4mm}';
    html += '.bc-inner.tv .name{font-size:' + pt(8.5) + ';font-weight:700;line-height:1.1;width:100%;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;max-height:none}';
    html += '.bc-inner.tv .cod,.bc-inner.tv .var{font-size:' + pt(7) + ';font-weight:700;line-height:1.1;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
    html += '.bc-inner.tv .var span+span{margin-left:2.5mm}';
    html += '.bc-inner.tv .price{font-size:' + pt(16) + ';font-weight:900;line-height:1;letter-spacing:-0.3pt;white-space:nowrap;max-width:100%;overflow:hidden}';
    html += '.bc-inner.tv .price .cur{font-size:0.62em;font-weight:700;letter-spacing:0;margin-right:0.6mm}';
    html += '.bc-inner.tv .card-line{font-size:' + pt(6.5) + ';font-weight:700;line-height:1;white-space:nowrap;max-width:100%;overflow:hidden}';
    // Linha de dobra (28/10/2026, opcao B): so emitido com dobra. Duas zonas
    // com altura em mm (imprime igual no Chrome): em cima, dobra - topo, com
    // o bloco encostado embaixo e o codigo de barras terminando 1,5 mm acima
    // da linha (1,3 mm de folga + os 0,2 mm de padding do .bc-box, LOCKED);
    // embaixo, altura - dobra, preco e "Cartao" centralizados. O bloco de
    // cima e "display:block": o .bc-box deixa de ser item flex e fica na
    // altura do SVG, sem regra nova para ele (tamanho, margem e area iguais).
    if (tagDobraMm > 0) {
      const topo = custom.tagTopoMm || 0;
      html += '.bc-inner.tv.dobra{padding:' + topo + 'mm 1.5mm 0;gap:0}';
      html += '.bc-inner.tv.dobra .tv-top{height:' + round2(tagDobraMm - topo) + 'mm;width:100%;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:1.3mm;overflow:hidden}';
      html += '.bc-inner.tv.dobra .tv-blk{display:block;width:100%}';
      html += '.bc-inner.tv.dobra .tv-blk>.name,.bc-inner.tv.dobra .tv-blk>.cod,.bc-inner.tv.dobra .tv-blk>.var{margin-bottom:0.6mm}';
      // Loja: a cabeca da ZD220 tem 104 mm e o rolo de 3 colunas 105 mm, entao
      // a borda de fora das colunas 1 e 3 perde ~0,5 mm (o "D" de DOCE
      // ENCANTO saiu cortado na loja, 28/10). Com dobra a loja cabe em
      // largura - 3 mm com mais 1 mm de folga (0,5 mm de cada lado) e o
      // ajuste desce ate 8pt (sem dobra: 9pt, como antes).
      html += '.bc-inner.tv.dobra .tv-blk>.store{margin:0 0.5mm 1mm;width:auto}';
      html += '.bc-inner.tv.dobra .tv-bot{height:' + round2(preset.cellHeightMm - tagDobraMm) + 'mm;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1mm;overflow:hidden}';
      // Preco na largura toda da faixa (texto centralizado): o ajuste so
      // encolhe quando o preco passa da largura da tag, nao por fracao de px.
      html += '.bc-inner.tv.dobra .price{font-size:' + pt(20) + ';width:100%}';
    }
  }

  // Desenho "boutique" (28/10/2026, opt-in, customLabel.ts). So emitido nele:
  // nenhum outro desenho ganha um byte. Vem DEPOIS do CSS base e ganha por
  // especificidade (.bc-inner.bq). Tudo preto solido sobre branco, sem cinza
  // (a termica nao imprime meio-tom). Fonte condensada de sistema ("Arial
  // Narrow", Arial) — sem fonte de rede, imprime offline. A faixa preta e o
  // seu fundo pedem print-color-adjust:exact (o navegador nao imprime fundo
  // por padrao). O .bc-box segue a zona LOCKED (flex-grow, max-width largura
  // - 3mm, overflow, SVG centralizado): a boutique so acrescenta alinhamento
  // e um respiro em cima — nao toca no tamanho do SVG nem no BARCODE_OPTS.
  if (isBoutique && custom) {
    const k = custom.escalaTexto || 1;
    const pt = function (n: number) { return round2(n * k) + 'pt'; };
    // Moldura fina (~1,5px = 0,4mm) ocupando a etiqueta; sem padding (a faixa
    // preta encosta nas bordas), o respiro fica no .bq-body.
    html += '.bc-inner.bq{padding:0;gap:0;border:0.4mm solid #000;justify-content:flex-start;font-family:"Arial Narrow",Arial,Helvetica,sans-serif;overflow:hidden}';
    // Faixa preta no topo, largura toda, nome da loja vazado (branco).
    html += '.bc-inner.bq .bq-band{width:100%;background:#000;text-align:center;padding:0.5mm 1mm;line-height:1;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}';
    html += '.bc-inner.bq .bq-store{display:inline-block;max-width:100%;color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:0.4pt;white-space:nowrap;line-height:1;font-size:' + pt(9) + '}';
    // Corpo: nome, cor/tam, codigo de barras e preco, centralizados, com respiro.
    html += '.bc-inner.bq .bq-body{flex:1 1 auto;width:100%;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;padding:0.9mm 1.2mm 1mm;gap:0.4mm}';
    html += '.bc-inner.bq .name{font-size:' + pt(7) + ';font-weight:700;line-height:1.05;width:100%;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;max-height:none;color:#000}';
    html += '.bc-inner.bq .var{font-size:' + pt(5.5) + ';font-weight:700;line-height:1;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;letter-spacing:0.3pt;color:#000}';
    // So alinhamento/respiro: flex, max-width e overflow continuam os da zona LOCKED.
    html += '.bc-inner.bq .bc-box{align-self:center;padding:0.3mm 0 0}';
    // Preco grande com filete fino acima.
    html += '.bc-inner.bq .price{font-size:' + pt(11) + ';font-weight:900;line-height:1;color:#000;width:100%;border-top:0.3mm solid #000;padding-top:0.6mm;margin-top:0.3mm;letter-spacing:-0.3pt}';
    html += '.bc-inner.bq .price .cur{font-size:0.62em;font-weight:700;letter-spacing:0;margin-right:0.6mm}';
    html += '.bc-inner.bq .card-line{font-size:' + pt(5.5) + ';font-weight:700;line-height:1;width:100%;text-align:center;white-space:nowrap;overflow:hidden}';
  }

  // QR layout
  html += '.qr-inner{display:flex;flex-direction:row;align-items:center;padding:1mm 1.5mm;gap:1.5mm;height:' + preset.cellHeightMm + 'mm;width:' + preset.cellWidthMm + 'mm}';
  html += '.qr-inner .qr{width:' + qrSizeMm + 'mm;height:' + qrSizeMm + 'mm;flex-shrink:0;image-rendering:pixelated}';
  html += '.qr-inner .info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:0.4mm;overflow:hidden}';
  html += '.qr-inner .store{font-size:5pt;font-weight:700;line-height:1;color:#000;letter-spacing:0.2pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  html += '.qr-inner .name{font-size:5.5pt;font-weight:600;line-height:1.15;max-height:9mm;overflow:hidden;word-break:break-word;color:#000}';
  html += '.qr-inner .price{font-size:8pt;font-weight:900;white-space:nowrap;color:#000;margin-top:0.4mm}';
  // Editorial em QR (25/09/2026): nome inteiro e em negrito (termica 203dpi).
  if (isEditorial) html += '.qr-inner .name{font-weight:700;font-size:6pt}';

  // Marcas de calibracao (so a impressao de teste). Fundo da celula: canto
  // de 1,2mm nos 4 cantos de cada etiqueta e, na 1a coluna, regua de 0 a
  // 20mm na borda esquerda (traco a cada 1mm, maior a cada 5mm). Tracos de
  // 0,25mm = 2 pontos da termica de 203dpi. Tudo dentro de 1,2mm da borda:
  // o .bc-box comeca a 1,5mm (max-width = largura - 3mm, centralizado).
  if (options.calibrationMarks) {
    const h = '0.25mm', l = '1.2mm', k = 'linear-gradient(#000,#000)';
    const corners = [k, k, k, k, k, k, k, k].join(',');
    const cornerSize = [l + ' ' + h, h + ' ' + l, l + ' ' + h, h + ' ' + l, l + ' ' + h, h + ' ' + l, l + ' ' + h, h + ' ' + l].join(',');
    // Cantos de baixo medidos a partir do TOPO (altura da etiqueta): o <td>
    // estica ate o passo da linha, e "bottom" cairia no vao, fora da etiqueta.
    const yH = round2(preset.cellHeightMm - 0.25) + 'mm', yV = round2(preset.cellHeightMm - 1.2) + 'mm';
    const cornerPos = '0 0,0 0,100% 0,100% 0,0 ' + yH + ',0 ' + yV + ',100% ' + yH + ',100% ' + yV;
    html += '.cell{background-image:' + corners + ';background-size:' + cornerSize + ';background-position:' + cornerPos + ';background-repeat:no-repeat;-webkit-print-color-adjust:exact;print-color-adjust:exact}';
    const rulerMm = Math.min(20, Math.floor(preset.cellHeightMm));
    html += 'tr td.cell:first-of-type{background-image:' + corners +
      ',repeating-linear-gradient(to bottom,#000 0,#000 ' + h + ',transparent ' + h + ',transparent 5mm)' +
      ',repeating-linear-gradient(to bottom,#000 0,#000 ' + h + ',transparent ' + h + ',transparent 1mm)' +
      ';background-size:' + cornerSize + ',' + l + ' ' + (rulerMm + 0.25) + 'mm,0.7mm ' + (rulerMm + 0.25) + 'mm' +
      ';background-position:' + cornerPos + ',0 0,0 0}';
  }

  // ===== GUIA VISUAL PRE-IMPRESSAO (livre, so tela) =====
  // 26/08/2026: compactado pra uma faixa de linha unica — a loja imprime
  // varias vezes ao dia e o paredao vermelho de 4 passos + slider aberto
  // virava ruido. Specs numa linha muted, checkbox de confirmacao, e o
  // slider de calibracao (tarefa de uma vez) escondido atras do link
  // "Etiqueta saindo cortada?".
  html += '.setup-guide{position:fixed;top:0;left:0;right:0;background:#fff;border-bottom:1px solid #e2e8f0;padding:10px 16px;z-index:1000;font-family:-apple-system,"Segoe UI",sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.06)}';
  html += '.setup-guide .setup-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}';
  html += '.setup-guide .confirm{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#334155;font-weight:700;white-space:nowrap}';
  html += '.setup-guide .confirm input[type=checkbox]{width:17px;height:17px;accent-color:#7c3aed;cursor:pointer}';
  html += '.setup-guide .specs{font-size:12px;color:#64748b;flex:1;min-width:240px}';
  html += '.setup-guide .specs b{color:#334155;font-weight:700}';
  html += '.setup-guide.ready{background:#fbfefb;border-bottom-color:#86efac}';
  // 26/08/2026: slider SEMPRE visivel — colapsado atras de um link, na
  // pratica, sumia (o link caia pra fora de vista em janelas estreitas e
  // ninguem descobria a calibracao). Linha fina, nao volta a ser paredao.
  html += '.offset-row{display:flex;align-items:center;gap:10px;padding-top:8px;margin-top:8px;border-top:1px dashed #e2e8f0;flex-wrap:wrap}';
  html += '.offset-row label{font-size:12px;font-weight:600;color:#334155}';
  html += '.offset-row input[type=range]{width:180px;accent-color:#7c3aed;cursor:pointer}';
  html += '.offset-row .val{font-size:12px;font-weight:800;color:#7c3aed;min-width:46px;text-align:center}';
  html += '.offset-row .offset-hint{font-size:11px;color:#94a3b8}';
  html += '.preview-bar{position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;z-index:999;font-family:-apple-system,sans-serif}';
  html += '.preview-bar span{color:#a78bfa;font-size:12px}.preview-bar b{color:#e2e8f0;font-size:13px}';
  html += '.preview-bar button{background:#7c3aed;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}';
  html += '.preview-bar button:disabled{background:#4b5563;color:#9ca3af;cursor:not-allowed;opacity:0.7}';
  html += '.preview-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;padding-top:84px;padding-bottom:80px}';
  html += '.preview-wrap table{border:1px dashed #ccc}.preview-wrap .cell{border:1px dashed #eee}.preview-wrap .colgap{border:none}';
  if (padLeftMm > 0) html += '.preview-wrap .padl,.preview-wrap .padr{border:none}';
  html += '@media print{.setup-guide{display:none!important}.preview-bar{display:none!important}.preview-wrap{padding:0;gap:0}.preview-wrap table{border:none}.preview-wrap .cell{border:none}body{background:#fff}}';
  html += '</style></head><body>';

  html += '<div class="setup-guide" id="setupGuide">';
  html += '<div class="setup-row">';
  html += '<label class="confirm"><input type="checkbox" id="confirmSetup"> Setup conferido</label>';
  html += '<span class="specs">Papel <b>' + preset.pageWidthMm + '&times;' + pageSheetHeightMm + 'mm</b> &middot; Margens <b>Nenhuma</b> &middot; Escala <b>100%</b> &middot; Cabe&ccedil;alho/rodap&eacute; <b>desligados</b></span>';
  html += '</div>';
  if (custom) {
    // Medida livre: o ajuste e o do spec (por computador). Sem o slider, que
    // gravaria o deslocamento da LOJA (pdv_settings) usado pelos fixos.
    html += '<div class="offset-row" id="offsetRow">';
    html += '<span class="offset-hint">Ajuste desta medida: horizontal ' + mmTxt(custom.ajusteXMm) + ' mm, vertical ' + mmTxt(custom.ajusteYMm) + ' mm. Para mudar, abra &ldquo;' + esc(custom.uiLabel) + '&rdquo; na Aura e refa&ccedil;a o teste.</span>';
    html += '</div>';
  } else {
  html += '<div class="offset-row" id="offsetRow">';
  html += '<label for="offsetRange">Etiqueta saindo cortada? Deslocar:</label>';
  html += '<input type="range" id="offsetRange" min="-6" max="2" step="0.5" value="' + offsetMm + '">';
  html += '<span class="val" id="offsetVal">' + offsetMm + 'mm</span>';
  html += '<span class="offset-hint">Arraste at&eacute; centralizar &mdash; fica salvo para a loja.</span>';
  html += '</div>';
  }
  html += '</div>';

  html += '<div class="preview-wrap"><table id="labelsTable">' + rowsHtml + '</table></div>';
  html += '<div class="preview-bar"><div><span>Etiqueta ' + preset.cellWidthMm + 'x' + preset.cellHeightMm + 'mm x ' + preset.cols + ' coluna' + (preset.cols > 1 ? 's' : '') + ' (' + (isQR ? "QR Code" : "EAN-13") + ')</span><br>';
  html += '<b>' + totalLabels + ' etiqueta' + (totalLabels > 1 ? 's' : '') + ' (' + items.length + ' produto' + (items.length > 1 ? 's' : '') + ') em ' + totalRows + ' linha' + (totalRows > 1 ? 's' : '') + '</b></div>';
  html += '<button id="printBtn" disabled onclick="window.print()">Confirme o setup para imprimir</button></div>';

  html += '<script>(function(){';
  html += 'var cb=document.getElementById("confirmSetup");';
  html += 'var btn=document.getElementById("printBtn");';
  html += 'var guide=document.getElementById("setupGuide");';
  html += 'cb.addEventListener("change",function(){';
  html += 'if(cb.checked){btn.disabled=false;btn.textContent="Imprimir";guide.classList.add("ready");}';
  html += 'else{btn.disabled=true;btn.textContent="Confirme o setup para imprimir";guide.classList.remove("ready");}';
  html += '});';
  // Slider de calibracao: aplica ao vivo (tela + impressao) e, ao soltar,
  // avisa o app (opener) pra persistir em pdv_settings.label_offset_mm.
  html += 'var tbl=document.getElementById("labelsTable");';
  html += 'var rng=document.getElementById("offsetRange");';
  html += 'var val=document.getElementById("offsetVal");';
  html += 'if(rng&&tbl){';
  html += 'rng.addEventListener("input",function(){val.textContent=rng.value+"mm";tbl.style.transform="' + (offsetYMm !== 0 ? 'translate("+rng.value+"mm,' + offsetYMm + 'mm)' : 'translateX("+rng.value+"mm)') + '";});';
  html += 'rng.addEventListener("change",function(){if(window.opener){try{window.opener.postMessage({type:"aura:label-offset",value:parseFloat(rng.value)},"*");}catch(e){}}});';
  html += '}';
  html += '})();</scr' + 'ipt>';

  if (!isQR) {
    // ===== LOCKED — parametros do JsBarcode =====
    // Padrao: EAN13. Se falhar (ex: codigo invalido), fallback para CODE128.
    html += '<script>';
    html += 'document.querySelectorAll("[data-code]").forEach(function(el){';
    html += 'var code=el.getAttribute("data-code");';
    html += 'var opts={width:' + BARCODE_OPTS.width +
            ',height:' + BARCODE_OPTS.height +
            ',margin:' + BARCODE_OPTS.margin +
            ',displayValue:' + BARCODE_OPTS.displayValue +
            ',fontSize:' + BARCODE_OPTS.fontSize +
            ',textMargin:' + BARCODE_OPTS.textMargin +
            ',font:"' + BARCODE_OPTS.font + '"' +
            ',fontOptions:"' + BARCODE_OPTS.fontOptions + '"' +
            ',background:"' + BARCODE_OPTS.background + '"' +
            ',lineColor:"' + BARCODE_OPTS.lineColor + '"};';
    if (preset.bcModuleMm) {
      // Preset termico: 1 unidade do SVG = 1 modulo; depois o SVG ganha
      // largura/altura em mm -> modulo = bcModuleMm exato. Zona de silencio:
      // no EAN-13 o digito inicial ja reserva ~12 modulos em branco a esquerda
      // (+2) e a direita leva 8 (norma pede 7). Se um CODE128 longo nao couber na celula,
      // cai pra 0,25mm (2 pontos) e, em ultimo caso, encaixa na largura.
      html += 'opts={width:1,height:' + Math.round((preset.bcBarHeightMm || 10) / preset.bcModuleMm) + ',margin:0,marginLeft:2,marginRight:8,marginTop:1,marginBottom:0,displayValue:true,fontSize:8,textMargin:1,font:"Arial",fontOptions:"bold",background:"#ffffff",lineColor:"#000000"};';
    }
    html += 'try{JsBarcode(el,code,Object.assign({},opts,{format:"EAN13"}));}';
    html += 'catch(e){try{JsBarcode(el,code,Object.assign({},opts,{format:"CODE128"}));}catch(e2){console.error(e2);}}';
    if (preset.bcModuleMm) {
      const maxBcMm = preset.cellWidthMm - 2;
      html += 'var w=parseFloat(el.getAttribute("width")),h=parseFloat(el.getAttribute("height"));';
      html += 'if(w>0&&h>0){var m=' + preset.bcModuleMm + ';if(w*m>' + maxBcMm + ')m=0.25;if(w*m>' + maxBcMm + ')m=' + maxBcMm + '/w;';
      html += 'el.setAttribute("width",(w*m).toFixed(3)+"mm");el.setAttribute("height",(h*m).toFixed(3)+"mm");}';
    }
    html += '});';
    html += '</scr' + 'ipt>';
    // =============================================
  }
  if (isEditorial && !isQR) {
    // Ajuste automatico do desenho "editorial" (fitAll do mockup), depois
    // das fontes: nome em 2 linhas — se a 3a aparecer, desce 0,25pt ate
    // 5,2pt; selo — se cortar, tira o tracking e desce 0,2pt de 4,4 ate
    // 4,0; se ainda cortar, empilha (.stack) e desce ate 3,8pt. So encolhe
    // quando precisa. Nao toca no .bc-box nem no SVG.
    // "Cortou" e medido pela largura real do texto (Range) contra a caixa de
    // conteudo do selo: scrollWidth arredonda pra inteiro e deixava passar
    // um corte de fracao de pixel ("AZUL ESCUR...").
    html += '<script>(function(){';
    html += 'function over(el){var r=document.createRange();r.selectNodeContents(el);var w=r.getBoundingClientRect().width;var cs=getComputedStyle(el);return w>el.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)+0.05;}';
    html += 'function fit(){document.querySelectorAll(".bc-inner.ed").forEach(function(b){';
    html += 'b.classList.remove("stack");';
    html += 'var n=b.querySelector(".name");if(!n)return;';
    // Medida livre maior: os mesmos pontos de partida/minimos, na escala do
    // texto (customLabel.ts). Fixos: as strings de sempre.
    const kTxt = custom && custom.escalaTexto !== 1 ? custom.escalaTexto : 0;
    const ptTxt = function (n: number, fixo: string) { return kTxt ? String(round1(n * kTxt)) : fixo; };
    html += 'var pt=' + ptTxt(preset.edCompact ? 6 : 6.5, preset.edCompact ? '6' : '6.5') + ';n.style.fontSize=pt+"pt";';
    html += 'while(n.scrollHeight>n.clientHeight+1&&pt>5.2){pt-=0.25;n.style.fontSize=pt+"pt";}';
    html += 'var v=b.querySelector(".row .variant");if(!v||!v.textContent)return;';
    html += 'v.style.letterSpacing="";v.style.fontSize="";';
    html += 'if(over(v))v.style.letterSpacing="0";';
    html += 'var vp=' + ptTxt(4.4, '4.4') + ';';
    html += 'while(over(v)&&vp>' + ptTxt(4, '4.0') + '){vp-=0.2;v.style.fontSize=vp+"pt";}';
    html += 'if(over(v)){';
    html += 'b.classList.add("stack");n.style.fontSize="";v.style.letterSpacing="";v.style.fontSize="";vp=' + ptTxt(4.4, '4.4') + ';';
    html += 'while(over(v)&&vp>' + ptTxt(3.8, '3.8') + '){vp-=0.2;v.style.fontSize=vp+"pt";}';
    html += '}';
    html += '});}';
    html += 'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(fit);}else{fit();}';
    html += 'window.addEventListener("load",fit);';
    html += '})();</scr' + 'ipt>';
  }
  if (isTagVertical && custom) {
    // Ajuste automatico da tag vertical, depois das fontes. So encolhe
    // quando precisa: loja e linhas de codigo/variante numa linha so, nome
    // em ate 2 linhas, preco na largura da tag. Nao toca no .bc-box nem no SVG.
    const k = custom.tagEscala || 1;
    const n2 = function (n: number) { return String(round2(n * k)); };
    html += '<script>(function(){';
    html += 'function over(el){var r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect().width>el.clientWidth+0.05;}';
    html += 'function tall(el){return el.scrollHeight>el.clientHeight+1;}';
    html += 'function shrink(el,pt,min,test){el.style.fontSize="";while(test(el)&&pt>min){pt=Math.max(min,pt-0.25);el.style.fontSize=pt+"pt";}}';
    html += 'function fit(){document.querySelectorAll(".bc-inner.tv").forEach(function(b){';
    html += 'var q=function(s){return b.querySelector(s);};';
    // Loja: 10pt ate 9pt (sempre acima dos 8,5pt maximos do nome); se ainda
    // nao couber, tira o espacamento entre letras. Numa linha so.
    html += 'if(q(".store")){q(".store").style.letterSpacing="";shrink(q(".store"),' + n2(10) + ',' + n2(tagDobraMm > 0 ? 8 : 9) + ',over);if(over(q(".store")))q(".store").style.letterSpacing="0";}';
    html += 'if(q(".name"))shrink(q(".name"),' + n2(8.5) + ',' + n2(6.5) + ',tall);';
    html += 'if(q(".cod"))shrink(q(".cod"),' + n2(7) + ',' + n2(5.5) + ',over);';
    html += 'if(q(".var"))shrink(q(".var"),' + n2(7) + ',' + n2(5.5) + ',over);';
    // Com dobra o preco parte de 20pt (opcao B); sem dobra, os 16pt de sempre.
    html += 'if(q(".price"))shrink(q(".price"),' + n2(tagDobraMm > 0 ? 20 : 16) + ',' + n2(10) + ',over);';
    html += '});}';
    html += 'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(fit);}else{fit();}';
    html += 'window.addEventListener("load",fit);';
    html += '})();</scr' + 'ipt>';
  }
  if (isBoutique && custom) {
    // Ajuste automatico da boutique. So encolhe quando precisa: a faixa da
    // loja numa linha so (nunca corta nem quebra), o nome em ate 2 linhas, a
    // linha cor/tam numa linha so e o preco na largura da etiqueta. Fonte de
    // sistema (sem fonte de rede): ajusta no load e ja na montagem. Nao toca
    // no .bc-box nem no SVG (LOCKED).
    const k = custom.escalaTexto || 1;
    const n2 = function (n: number) { return String(round2(n * k)); };
    html += '<script>(function(){';
    html += 'function over(el){var r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect().width>el.clientWidth+0.05;}';
    html += 'function tall(el){return el.scrollHeight>el.clientHeight+1;}';
    html += 'function shrink(el,pt,min,test){el.style.fontSize="";while(test(el)&&pt>min){pt=Math.max(min,pt-0.25);el.style.fontSize=pt+"pt";}}';
    html += 'function fit(){document.querySelectorAll(".bc-inner.bq").forEach(function(b){';
    html += 'var q=function(s){return b.querySelector(s);};';
    html += 'if(q(".bq-store")){q(".bq-store").style.letterSpacing="";shrink(q(".bq-store"),' + n2(9) + ',' + n2(5) + ',over);if(over(q(".bq-store")))q(".bq-store").style.letterSpacing="0";}';
    html += 'if(q(".name"))shrink(q(".name"),' + n2(7) + ',' + n2(5) + ',tall);';
    html += 'if(q(".var"))shrink(q(".var"),' + n2(5.5) + ',' + n2(4) + ',over);';
    html += 'if(q(".price"))shrink(q(".price"),' + n2(11) + ',' + n2(7) + ',over);';
    html += '});}';
    html += 'window.addEventListener("load",fit);fit();';
    html += '})();</scr' + 'ipt>';
  }
  html += '</body></html>';
  return html;
}

// ============================================================================
// Impressao de teste e pre-visualizacao (13/10/2026, Divina D'Lux)
//
// Calibrar a impressora gastava um rolo: cada tentativa era um trabalho
// inteiro. As duas funcoes abaixo so CHAMAM o buildLabelHtml — o HTML das
// etiquetas de verdade nao passa por aqui.
// ============================================================================

/** Produto de exemplo da linha de teste. Codigo interno (prefixo 200), nao
 *  bate com nenhum produto de verdade se alguem bipar a etiqueta de teste. */
export const LABEL_TEST_ITEM = { name: "Produto de exemplo", price: 99.9, size: "M", color: "Preto" };

/** Linha de teste: `rows` linhas (1 por padrao = 3 etiquetas no rolo de 3
 *  colunas; 2 para conferir o passo entre linhas) de um produto de exemplo,
 *  com marcas nos cantos e regua de 0 a 20mm. Respeita modelo, modo
 *  continuo, passo e deslocamentos — e exatamente o que o trabalho real faria. */
export function buildLabelTestHtml(options: BuildOptions & { rows?: number }): string {
  const preset = LABEL_SIZE_PRESETS[options.labelSize || DEFAULT_LABEL_SIZE];
  const rows = Math.min(3, Math.max(1, Math.round(Number(options.rows) || 1)));
  const item: LabelItem = {
    name: LABEL_TEST_ITEM.name, price: LABEL_TEST_ITEM.price, size: LABEL_TEST_ITEM.size, color: LABEL_TEST_ITEM.color,
    barcode: generateEAN13("aura-etiqueta-de-teste"), qty: preset.cols * rows,
  };
  return buildLabelHtml([item], {
    mode: options.mode, storeName: options.storeName, showStoreName: options.showStoreName, labelSize: options.labelSize,
    offsetMm: options.offsetMm, continuous: options.continuous, rowPitchMm: options.rowPitchMm, offsetYMm: options.offsetYMm,
    calibrationMarks: true, design: options.design,
  });
}

// ----- Teste de posicao da "Minha medida" (15/10/2026) -----
// Mockup docs/mockups/etiqueta-self-service.html, passo 2: em vez do
// produto, cada etiqueta sai com uma moldura 1 mm para dentro da borda, uma
// cruz no centro e setas apontando para as 4 bordas. Tracos de 0,3 mm (a
// termica de 203dpi apaga abaixo de 0,25 mm). O lojista olha para onde a
// moldura foi e corrige no passo 3.

/** SVG da moldura de teste, em mm reais (viewBox em mm). */
export function molduraDeTesteSvg(wMm: number, hMm: number): string {
  const f = 1, fw = round2(wMm - 2 * f), fh = round2(hMm - 2 * f);
  const cx = round2(wMm / 2), cy = round2(hMm / 2);
  const menor = Math.min(wMm, hMm);
  const L = round2(menor * 0.17);
  const al = round2(Math.min(3.4, menor * 0.14)), g = 1, hs = round2(Math.min(1.1, al * 0.4));
  function seta(x1: number, y1: number, x2: number, y2: number): string {
    const a = Math.atan2(y2 - y1, x2 - x1), c = Math.cos(a), s = Math.sin(a);
    const p1 = round2(x2 - hs * c + hs * 0.55 * s) + ',' + round2(y2 - hs * s - hs * 0.55 * c);
    const p2 = round2(x2 - hs * c - hs * 0.55 * s) + ',' + round2(y2 - hs * s + hs * 0.55 * c);
    return '<line x1="' + round2(x1) + '" y1="' + round2(y1) + '" x2="' + round2(x2 - hs * 0.6 * c) + '" y2="' + round2(y2 - hs * 0.6 * s) + '"/>' +
      '<polygon points="' + round2(x2) + ',' + round2(y2) + ' ' + p1 + ' ' + p2 + '" fill="#000" stroke="none"/>';
  }
  const top = f + g, bot = hMm - f - g, esq = f + g, dir = wMm - f - g;
  return '<svg class="tf" xmlns="http://www.w3.org/2000/svg" width="' + wMm + 'mm" height="' + hMm + 'mm" viewBox="0 0 ' + wMm + ' ' + hMm + '" fill="none" stroke="#000" stroke-width="0.3" stroke-linecap="round" style="display:block">' +
    '<rect x="' + f + '" y="' + f + '" width="' + fw + '" height="' + fh + '" rx="0.6"/>' +
    '<line x1="' + round2(cx - L) + '" y1="' + cy + '" x2="' + round2(cx + L) + '" y2="' + cy + '"/>' +
    '<line x1="' + cx + '" y1="' + round2(cy - L) + '" x2="' + cx + '" y2="' + round2(cy + L) + '"/>' +
    seta(cx, top + al, cx, top) + seta(cx, bot - al, cx, bot) + seta(esq + al, cy, esq, cy) + seta(dir - al, cy, dir, cy) +
    '</svg>';
}

/** Teste de posicao da medida livre: uma linha (uma moldura por coluna) com
 *  a MESMA geometria e o MESMO ajuste X/Y da etiqueta real — passa pelo
 *  buildLabelHtml como qualquer etiqueta. */
export function buildCustomLabelTestHtml(spec: CustomLabelSpec): string {
  return buildLabelHtml([{ name: "Teste de posição", price: 0, barcode: "", size: "", color: "", qty: 0 }], {
    mode: "barcode", storeName: "", showStoreName: false, customSpec: spec, testFrame: true,
  });
}
// -----------------------------------------------------------

/** 1mm em px do CSS (96 px por polegada) — a escala da pre-visualizacao. */
export const CSS_PX_PER_MM = 96 / 25.4;
/** Margem (mm) que as reguas ocupam em volta da pagina na pre-visualizacao. */
export const LABEL_PREVIEW_RULER_MM = 10;
/** No modo continuo a "pagina" e o trabalho inteiro; a tela mostra ate aqui. */
export const LABEL_PREVIEW_MAX_ROWS = 12;

/** Geometria da 1a pagina que a pre-visualizacao mostra. */
export function labelPreviewGeometry(items: LabelItem[], options: BuildOptions): { rows: number; labels: number; widthMm: number; heightMm: number } {
  const custom = options.customSpec ? customLabelPreset(options.customSpec) : null;
  const preset: LabelPreset = custom || LABEL_SIZE_PRESETS[options.labelSize || DEFAULT_LABEL_SIZE];
  const continuous = !custom && options.continuous === true && labelSupportsCalibration(options.labelSize);
  const total = items.reduce(function (s, i) { return s + Math.max(0, i.qty); }, 0);
  const totalRows = Math.max(1, Math.ceil(total / preset.cols));
  const rows = Math.min(totalRows, continuous ? LABEL_PREVIEW_MAX_ROWS : (preset.rowsPerPage || 1));
  return {
    rows: rows,
    labels: Math.min(total, rows * preset.cols),
    widthMm: preset.pageWidthMm,
    // Medida livre: 1 linha por pagina, altura = passo (etiqueta + espaco).
    heightMm: custom ? custom.pageHeightMm : labelSheetHeightMm(options.labelSize, rows, { continuous: continuous, rowPitchMm: options.rowPitchMm, offsetYMm: options.offsetYMm }),
  };
}

/** Pre-visualizacao em escala real da 1a pagina (pra iframe srcdoc): o MESMO
 *  HTML da impressao, so com as primeiras etiquetas, sem as barras de setup,
 *  com o contorno da pagina e reguas em mm em cima e a esquerda. So tela. */
export function buildLabelPreviewHtml(items: LabelItem[], options: BuildOptions): string {
  const geo = labelPreviewGeometry(items, options);
  const first: LabelItem[] = [];
  let left = geo.labels;
  items.forEach(function (item) {
    const q = Math.min(Math.max(0, item.qty), left);
    if (q > 0) { first.push(Object.assign({}, item, { qty: q })); left -= q; }
  });
  const html = buildLabelHtml(first, options);
  const marker = '</style></head><body>';
  const at = html.indexOf(marker);
  if (at < 0) return html;

  const m = LABEL_PREVIEW_RULER_MM;
  const ink = '#475569';
  function ticks(dir: string, anchor: string, size: (len: string) => string): string {
    return [['10mm', '4mm'], ['5mm', '2.8mm'], ['1mm', '1.6mm']].map(function (t) {
      return 'repeating-linear-gradient(' + dir + ',' + ink + ' 0,' + ink + ' 0.2mm,transparent 0.2mm,transparent ' + t[0] + ') ' + anchor + '/' + size(t[1]) + ' no-repeat';
    }).join(',');
  }
  let css = '.setup-guide,.preview-bar{display:none!important}body{background:#eef2f7}';
  css += '.preview-wrap{position:absolute;left:' + m + 'mm;top:' + m + 'mm;padding:0;gap:0;align-items:flex-start}';
  css += '.preview-wrap table{border:none}.preview-wrap .cell{border:none}.preview-wrap .cell>div{outline:1px dashed #cbd5e1;outline-offset:-1px}';
  css += '.pv-page{position:absolute;left:' + m + 'mm;top:' + m + 'mm;width:' + geo.widthMm + 'mm;height:' + geo.heightMm + 'mm;background:#fff;outline:1px solid #a78bfa}';
  css += '.pv-rule{position:absolute;font:6.5pt -apple-system,"Segoe UI",Arial,sans-serif;color:' + ink + '}.pv-rule span{position:absolute;line-height:1}';
  css += '.pv-x{left:' + m + 'mm;top:0;width:' + (geo.widthMm + 0.2) + 'mm;height:' + m + 'mm;background:' + ticks('to right', 'left bottom', function (len) { return '100% ' + len; }) + '}';
  css += '.pv-x span{top:2mm;transform:translateX(-50%)}';
  css += '.pv-y{left:0;top:' + m + 'mm;width:' + m + 'mm;height:' + (geo.heightMm + 0.2) + 'mm;background:' + ticks('to bottom', 'right top', function (len) { return len + ' 100%'; }) + '}';
  css += '.pv-y span{right:4.6mm;transform:translateY(-50%)}';
  css += '.pv-end{position:absolute;left:0;top:' + (m + geo.heightMm) + 'mm;width:' + (m + geo.widthMm + 4) + 'mm;height:4mm}';

  let body = '<div class="pv-page"></div><div class="pv-rule pv-x">';
  for (let x = 0; x <= geo.widthMm; x += 10) body += '<span style="left:' + x + 'mm">' + x + '</span>';
  body += '</div><div class="pv-rule pv-y">';
  for (let y = 0; y <= geo.heightMm; y += 10) body += '<span style="top:' + y + 'mm">' + y + '</span>';
  body += '</div><div class="pv-end"></div>';

  return html.slice(0, at) + css + marker + body + html.slice(at + marker.length);
}
