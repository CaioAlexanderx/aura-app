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
// NUNCA mudar os numeros do preset "99x21".
export type LabelSizeKey = "99x21" | "105x21" | "30x25" | "58mm";

export const LABEL_SIZE_PRESETS: Record<LabelSizeKey, {
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
  design?: "editorial";
  uiLabel: string;
}> = {
  "99x21": { pageWidthMm: 99, pageHeightMm: 21, cols: 3, cellWidthMm: 33, cellHeightMm: 21, uiLabel: "33x21mm (3 colunas)" },
  "105x21": { pageWidthMm: 105, pageHeightMm: 23.5, cols: 3, cellWidthMm: 33, cellHeightMm: 21, colGapMm: 3, rowGapMm: 2.5, design: "editorial", uiLabel: "33x21mm com vão (3 colunas · papel 105mm)" },
  "30x25": { pageWidthMm: 94, pageHeightMm: 27, cols: 3, cellWidthMm: 30, cellHeightMm: 25, colGapMm: 2, rowGapMm: 2, uiLabel: "30x25mm (3 colunas)" },
  "58mm":  { pageWidthMm: 58, pageHeightMm: 28, cols: 1, cellWidthMm: 46, cellHeightMm: 25, rowGapMm: 3, padLeftMm: 6, cutMarks: true, bcModuleMm: 0.375, bcBarHeightMm: 9, rowsPerPage: 3, uiLabel: "Bobina 58mm (1 por linha)" },
};
export const LABEL_SIZE_KEYS: LabelSizeKey[] = ["99x21", "105x21", "30x25", "58mm"];
export const DEFAULT_LABEL_SIZE: LabelSizeKey = "99x21";
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
};

export function buildLabelHtml(items: LabelItem[], options: BuildOptions): string {
  const isQR = options.mode === "qr";
  const preset = LABEL_SIZE_PRESETS[options.labelSize || DEFAULT_LABEL_SIZE];
  const COLS = preset.cols;
  // Vao horizontal entre colunas (0 = etiquetas coladas, comportamento original).
  const colGapMm = preset.colGapMm || 0;
  // Margens laterais (so presets com padLeftMm). A da direita fecha a largura
  // da pagina pra table-layout:fixed nao esticar a celula. 0 => nada emitido.
  const padLeftMm = preset.padLeftMm || 0;
  // Altura da PAGINA de impressao = passo da linha x linhas por pagina.
  const pageSheetHeightMm = preset.pageHeightMm * (preset.rowsPerPage || 1);
  const padRightMm = padLeftMm > 0 ? Math.max(0, preset.pageWidthMm - padLeftMm - preset.cols * preset.cellWidthMm - (preset.cols - 1) * colGapMm) : 0;
  const rawOffset = Number(options.offsetMm);
  const offsetMm = Number.isFinite(rawOffset) ? Math.min(Math.max(rawOffset, -8), 5) : 0;
  const storeHeader = options.showStoreName && options.storeName ? esc(options.storeName.toUpperCase()) : "";
  const totalLabels = items.reduce((s, i) => s + i.qty, 0);
  // Desenho "editorial" (preset "105x21", 25/09/2026). Tudo que ele emite
  // (CSS, fonte, script de ajuste, marcacao) fica atras desta flag: os
  // presets sem `design` saem byte-identicos.
  const isEditorial = preset.design === "editorial";

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

  while (cells.length % COLS !== 0) cells.push('<td class="cell"></td>');

  // Insere colunas espacadoras (vao) entre as celulas de cada linha. Com
  // colGapMm=0 (ex: preset 99x21) o separador e vazio -> join identico ao antigo.
  const colSep = colGapMm > 0 ? '<td class="colgap"></td>' : "";
  let rowsHtml = "";
  for (let r = 0; r < cells.length; r += COLS) {
    rowsHtml += "<tr>" + (padLeftMm > 0 ? '<td class="padl"></td>' : "") + cells.slice(r, r + COLS).join(colSep) + (padLeftMm > 0 ? '<td class="padr"></td>' : "") + "</tr>\n";
  }
  const totalRows = cells.length / COLS;

  let html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">';
  html += '<title>Etiquetas Aura - ' + totalLabels + ' etiquetas</title>';
  if (!isQR) html += '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></scr' + 'ipt>';
  // Editorial: Montserrat (Google Fonts) so nesse desenho; Arial de reserva.
  if (isEditorial && !isQR) html += '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=swap" rel="stylesheet">';
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
  html += 'table{border-collapse:collapse;width:' + preset.pageWidthMm + 'mm;table-layout:fixed' + (offsetMm !== 0 ? ';transform:translateX(' + offsetMm + 'mm)' : '') + '}tr{height:' + preset.pageHeightMm + 'mm;page-break-inside:avoid}';
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
    // Preco no cartao (so lojas Matcon): 1 linha a mais, nome cai pra 1 linha.
    html += '.bc-inner.ed .card-line{font-size:5pt;font-weight:700;line-height:1;white-space:nowrap;width:100%;text-align:right}';
    html += '.bc-inner.ed.ed-card .name{-webkit-line-clamp:1}';
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
  html += '<div class="offset-row" id="offsetRow">';
  html += '<label for="offsetRange">Etiqueta saindo cortada? Deslocar:</label>';
  html += '<input type="range" id="offsetRange" min="-6" max="2" step="0.5" value="' + offsetMm + '">';
  html += '<span class="val" id="offsetVal">' + offsetMm + 'mm</span>';
  html += '<span class="offset-hint">Arraste at&eacute; centralizar &mdash; fica salvo para a loja.</span>';
  html += '</div>';
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
  html += 'rng.addEventListener("input",function(){val.textContent=rng.value+"mm";tbl.style.transform="translateX("+rng.value+"mm)";});';
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
    html += 'var pt=6.5;n.style.fontSize=pt+"pt";';
    html += 'while(n.scrollHeight>n.clientHeight+1&&pt>5.2){pt-=0.25;n.style.fontSize=pt+"pt";}';
    html += 'var v=b.querySelector(".row .variant");if(!v||!v.textContent)return;';
    html += 'v.style.letterSpacing="";v.style.fontSize="";';
    html += 'if(over(v))v.style.letterSpacing="0";';
    html += 'var vp=4.4;';
    html += 'while(over(v)&&vp>4.0){vp-=0.2;v.style.fontSize=vp+"pt";}';
    html += 'if(over(v)){';
    html += 'b.classList.add("stack");n.style.fontSize="";v.style.letterSpacing="";v.style.fontSize="";vp=4.4;';
    html += 'while(over(v)&&vp>3.8){vp-=0.2;v.style.fontSize=vp+"pt";}';
    html += '}';
    html += '});}';
    html += 'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(fit);}else{fit();}';
    html += 'window.addEventListener("load",fit);';
    html += '})();</scr' + 'ipt>';
  }
  html += '</body></html>';
  return html;
}
