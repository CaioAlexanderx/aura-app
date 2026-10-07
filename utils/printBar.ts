// ============================================================
// AURA. — Barra "Imprimir / Salvar PDF" dos documentos abertos em janela
// nova (orçamento, fechamento de caixa, DRE, holerite).
//
// 07/10/2026 — o botão saiu NO PAPEL do orçamento impresso pelo Caixa
// (Matcon), cinza (sem o fundo roxo, que a impressão descarta) e no canto
// da folha. Reproduzido no Chrome headless em todos os cenários: a regra
// `@media print { .no-print { display: none } }` vinha ANTES de
// `.actions { display: flex }`. As duas têm a mesma especificidade (uma
// classe), e a última declarada vence — a barra continuava `flex` na
// impressão. O fechamento de caixa tinha a mesma barra, mas com a regra
// na ordem certa (por sorte) — recebeu a mesma proteção, assim como o DRE
// e o holerite.
//
// Daqui em diante, três camadas, qualquer uma sozinha basta:
//   1. a aparência da barra (display, posição) só existe em `@media screen`;
//   2. `@media print { .no-print { display: none !important } }`;
//   3. o clique tira a barra do DOM antes de window.print() e a devolve no
//      `afterprint` (ou logo depois, se o navegador não tiver o evento).
// ============================================================

/** Regra de impressão que esconde tudo o que é `.no-print`. */
export const CSS_ESCONDE_NA_IMPRESSAO = "@media print { .no-print { display: none !important; } }";

/** onclick do botão: `<button type="button" onclick="auraImprimir(this)">`. */
export const ONCLICK_IMPRIMIR = "auraImprimir(this)";

/** Script (vai no fim do <body>) que define auraImprimir(btn). Sem dado do
 *  usuário — é texto fixo. */
export const SCRIPT_IMPRIMIR_SEM_BARRA =
  "<script>" +
  "function auraImprimir(btn){" +
    "var bar=(btn&&btn.closest&&btn.closest('.no-print'))||btn;" +
    "var pai=bar&&bar.parentNode;" +
    "if(!pai){window.print();return;}" +
    "var prox=bar.nextSibling;" +
    "var volta=function(){window.removeEventListener('afterprint',volta);if(!bar.parentNode)pai.insertBefore(bar,prox);};" +
    "pai.removeChild(bar);" +
    "if('onafterprint' in window){window.addEventListener('afterprint',volta);window.print();}" +
    "else{window.print();setTimeout(volta,1000);}" +
  "}" +
  "</script>";
