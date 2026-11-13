// ============================================================
// AURA. — Financeiro › Relatórios › Produtos: o PDF (p-116, 13/11/2026)
//
// jsPDF + jspdf-autotable chegam por parâmetro: a tela os carrega com
// import() só no clique (chunk separado no export web) e o jest passa
// falsos. Layout da pré-visualização aprovada (docHtml do mockup): A4 na
// horizontal, faixa com a marca da Aura e a do lojista, título, quem emitiu,
// filtros, tabela com linhas alternadas e cabeçalho em toda página, linha
// de total e o rodapé "Documento gerado pela Aura..." com "Página N de M".
//
// Logo do lojista: fetch → canvas → dataURL. O R2 (r2.getaura.com.br)
// responde Access-Control-Allow-Origin: *, então funciona em produção. Se a
// imagem falhar (outro host sem CORS, arquivo quebrado, demora), plano B:
// só o nome da empresa, sem quadro vazio.
// ============================================================
import { paraWinAnsi, RODAPE_LEGAL, SITE, AVISO_TRUNCADO, type DadosDoArquivo, type ValorDoArquivo } from "@/utils/relatorioArquivo";

export type Imagem = { dataUrl: string; largura: number; altura: number };

type CarregarDeps = {
  fetch: (url: string, init?: any) => Promise<{ ok: boolean; blob: () => Promise<Blob> }>;
  /** Blob → imagem desenhada num canvas → dataURL PNG (no navegador). */
  paraDataUrl: (blob: Blob) => Promise<Imagem | null>;
  limiteMs?: number;
};

/** Baixa uma imagem e devolve o dataURL; null em qualquer falha (plano B). */
export async function carregarImagem(url: string | null | undefined, deps: CarregarDeps): Promise<Imagem | null> {
  if (!url) return null;
  var limite = deps.limiteMs || 6000;
  try {
    var corrida = new Promise<null>(function(resolve) { setTimeout(function() { resolve(null); }, limite); });
    var trabalho = (async function() {
      var res = await deps.fetch(url, { mode: "cors", credentials: "omit" });
      if (!res || !res.ok) return null;
      var blob = await res.blob();
      return await deps.paraDataUrl(blob);
    })();
    var r = await Promise.race([trabalho, corrida]);
    return r && r.dataUrl && /^data:image\//.test(r.dataUrl) ? r : null;
  } catch (_) {
    return null;
  }
}

/** Navegador: blob → <img> → canvas → PNG. Canvas "sujo" (sem CORS) lança e cai no null. */
export function paraDataUrlNoNavegador(blob: Blob): Promise<Imagem | null> {
  return new Promise(function(resolve) {
    try {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function() {
        try {
          var max = 400;
          var esc = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          var w = Math.max(1, Math.round((img.naturalWidth || 1) * esc));
          var h = Math.max(1, Math.round((img.naturalHeight || 1) * esc));
          var canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: canvas.toDataURL("image/png"), largura: w, altura: h });
        } catch (_) { resolve(null); } finally { URL.revokeObjectURL(url); }
      };
      img.onerror = function() { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch (_) { resolve(null); }
  });
}

// ── cores (papel claro sempre, nos dois temas) ──────────────────────────
var VIOLETA: [number, number, number] = [124, 58, 237];
var TINTA: [number, number, number] = [26, 26, 46];
var CINZA: [number, number, number] = [91, 87, 120];
var LILAS: [number, number, number] = [239, 234, 249];
var LILAS_ESCURO: [number, number, number] = [59, 42, 120];
var ZEBRA: [number, number, number] = [250, 249, 253];
var AMBAR: [number, number, number] = [180, 83, 9];
var VERMELHO: [number, number, number] = [185, 28, 28];
var APAGADO: [number, number, number] = [138, 134, 166];

function ajustar(img: Imagem, maxW: number, maxH: number): { w: number; h: number } {
  var r = Math.min(maxW / img.largura, maxH / img.altura);
  return { w: img.largura * r, h: img.altura * r };
}

function textoDaCelula(v: ValorDoArquivo): string { return paraWinAnsi(v.texto); }

export type GerarPdfDeps = {
  jsPDF: new (opts: any) => any;
  autoTable: (doc: any, opts: any) => void;
};

/**
 * Monta o PDF. Devolve o documento do jsPDF (a tela chama .save(nome)).
 * `logoAura` e `logoLoja` já em dataURL (ou null: plano B).
 */
export function gerarPdf(dados: DadosDoArquivo, deps: GerarPdfDeps, logos: { aura: Imagem | null; loja: Imagem | null }): any {
  var doc = new deps.jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  var W = doc.internal.pageSize.getWidth();
  var H = doc.internal.pageSize.getHeight();
  var M = 12;
  var T = paraWinAnsi;

  function faixa(): number {
    var y = M;
    // Aura à esquerda
    var x = M;
    if (logos.aura) {
      var a = ajustar(logos.aura, 10, 10);
      doc.addImage(logos.aura.dataUrl, "PNG", x, y, a.w, a.h);
      x += a.w + 2.5;
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
    doc.text("Aura", x, y + 7.4);
    var wAura = doc.getTextWidth("Aura");
    doc.setTextColor(VIOLETA[0], VIOLETA[1], VIOLETA[2]);
    doc.text(".", x + wAura, y + 7.4);
    // Lojista à direita: logo (se carregou) + razão social, CNPJ e loja
    var xd = W - M;
    if (logos.loja) {
      var l = ajustar(logos.loja, 16, 12);
      doc.addImage(logos.loja.dataUrl, "PNG", xd - l.w, y - 0.5, l.w, l.h);
      xd -= l.w + 3;
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
    doc.text(T(dados.empresa.razaoSocial || ""), xd, y + 4, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
    var linha2 = [dados.empresa.cnpj ? "CNPJ " + dados.empresa.cnpj : "", dados.empresa.loja].filter(Boolean).join(" · ");
    if (linha2) doc.text(T(linha2), xd, y + 8.6, { align: "right" });
    var base = y + 13;
    doc.setDrawColor(VIOLETA[0], VIOLETA[1], VIOLETA[2]); doc.setLineWidth(0.6);
    doc.line(M, base, W - M, base);
    return base;
  }

  var y = faixa() + 8;
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
  doc.text(T(dados.titulo), M, y);
  y += 6;

  doc.setFontSize(8.8);
  var meta: [string, string][] = [
    ["Emitido em: ", dados.emitidoEm],
    ["Emitido por: ", dados.emitidoPor],
    ["Linhas: ", dados.totalDeLinhas.toLocaleString("pt-BR") + (dados.totalDeLinhas === 1 ? " produto" : " produtos")],
  ];
  var xm = M;
  meta.forEach(function(par) {
    doc.setFont("helvetica", "bold"); doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
    doc.text(T(par[0]), xm, y);
    var w = doc.getTextWidth(T(par[0]));
    doc.setFont("helvetica", "normal"); doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
    doc.text(T(par[1]), xm + w, y);
    xm += w + doc.getTextWidth(T(par[1])) + 10;
  });
  y += 5;
  doc.setFont("helvetica", "bold"); doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
  doc.text("Filtros: ", M, y);
  var wf = doc.getTextWidth("Filtros: ");
  doc.setFont("helvetica", "normal"); doc.setTextColor(CINZA[0], CINZA[1], CINZA[2]);
  var linhasFiltro: string[] = doc.splitTextToSize(T(dados.filtros.join("; ")), W - 2 * M - wf);
  doc.text(linhasFiltro, M + wf, y);
  y += 4 * linhasFiltro.length + 1;
  if (dados.truncado) {
    doc.setFont("helvetica", "bold"); doc.setTextColor(AMBAR[0], AMBAR[1], AMBAR[2]);
    doc.text(T(AVISO_TRUNCADO + " de " + dados.totalDeLinhas.toLocaleString("pt-BR") + "."), M, y);
    y += 5;
  }

  var direita: Record<number, any> = {};
  dados.colunas.forEach(function(_c, i) {
    var f = dados.linhas.length ? dados.linhas[0].valores[i].formato : "texto";
    var numerica = ["moeda", "pct", "qtd", "inteiro"].indexOf(f) >= 0 || ["estoque", "vendidos", "faturamento", "custo", "lucro", "margem", "preco", "comprar", "valor_parado", "valor_estoque_venda", "dias_sem_vender", "dias_ate_acabar", "media_diaria"].indexOf(dados.colunas[i]) >= 0;
    if (numerica) direita[i + 1] = { halign: "right" };
  });

  deps.autoTable(doc, {
    startY: y + 1,
    margin: { top: M + 19, left: M, right: M, bottom: 16 },
    head: [dados.cabecalho.map(T)],
    body: dados.linhas.map(function(l) { return [T(l.produto)].concat(l.valores.map(textoDaCelula)); }),
    foot: [[T(dados.total.rotulo)].concat(dados.total.valores.map(textoDaCelula))],
    showHead: "everyPage",
    showFoot: "lastPage",
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8.4, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, textColor: TINTA, lineColor: [236, 233, 245], lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: LILAS, textColor: LILAS_ESCURO, fontStyle: "bold", fontSize: 7.6 },
    footStyles: { fillColor: LILAS, textColor: TINTA, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: Object.assign({ 0: { cellWidth: "auto", minCellWidth: 55 } }, direita),
    didParseCell: function(data: any) {
      // cabeçalho e total das colunas numéricas também à direita
      if ((data.section === "head" || data.section === "foot") && direita[data.column.index]) data.cell.styles.halign = "right";
      // as cores da tela: acabando em até 7 dias e estoque zerado em vermelho,
      // até 15 dias e margem baixa em âmbar, "sem custo" apagado
      if (data.section === "body" && data.column.index > 0) {
        var v = dados.linhas[data.row.index] && dados.linhas[data.row.index].valores[data.column.index - 1];
        var tom = v && v.tom;
        if (tom === "vermelho") { data.cell.styles.textColor = VERMELHO; data.cell.styles.fontStyle = "bold"; }
        else if (tom === "ambar") { data.cell.styles.textColor = AMBAR; data.cell.styles.fontStyle = "bold"; }
        else if (tom === "apagado") data.cell.styles.textColor = APAGADO;
      }
    },
    didDrawPage: function(data: any) {
      if (data.pageNumber > 1) faixa();
    },
  });

  // Rodapé em todas as páginas (o total de páginas só existe no fim).
  var total = doc.getNumberOfPages();
  for (var i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(217, 214, 230); doc.setLineWidth(0.2);
    doc.line(M, H - 10, W - M, H - 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(106, 102, 138);
    var esq = RODAPE_LEGAL + (dados.truncado ? " " + AVISO_TRUNCADO + "." : "");
    doc.text(T(esq), M, H - 6);
    doc.text(T(SITE + " · Página " + i + " de " + total), W - M, H - 6, { align: "right" });
  }
  return doc;
}
