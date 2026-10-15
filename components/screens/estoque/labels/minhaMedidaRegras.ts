// ============================================================================
// AURA. — Etiquetas: regras do wizard "Minha medida" (15/10/2026)
//
// Mockup aprovado: docs/mockups/etiqueta-self-service.html. Puro, sem React:
// leitura dos campos em mm (vírgula ou ponto), direção → ajuste, limites,
// textos dos passos e o desenho do rolo (SVG) que muda ao vivo.
//
// Convenção do ajuste (mockup): horizontal + move para a direita, − para a
// esquerda; vertical + desce, − sobe. "Saiu para a esquerda" corrige no
// sentido contrário: soma +0,5 no horizontal. "Saiu para cima" soma +0,5 no
// vertical.
// ============================================================================
import {
  MEDIDA_LIMITES, MEDIDA_PADRAO, mmTxt, type CustomLabelSpec,
} from "@/components/screens/estoque/labels/customLabel";

export const PASSO_TOQUE_MM = 0.5;
export const PASSO_FINO_MM = 0.1;

/** Atalhos do passo 1 (o 105 x 21 é uma etiqueta única de 105 mm; o modelo
 *  fixo de 3 colunas continua no seletor). */
export const ATALHOS_MEDIDA: Array<[number, number]> = [[40, 25], [30, 25], [50, 30], [60, 40], [105, 21]];

export type Direcao = "cima" | "baixo" | "esquerda" | "direita";
export const ROTULO_DIRECAO: Record<Direcao, string> = {
  cima: "Saiu para cima", baixo: "Saiu para baixo", esquerda: "Saiu para a esquerda", direita: "Saiu para a direita",
};

export type Ajuste = { x: number; y: number };

function round1(n: number): number {
  var r = Math.round(n * 10) / 10;
  return r === 0 ? 0 : r;
}

function limitar(v: number): { v: number; noLimite: boolean } {
  var lim = MEDIDA_LIMITES.ajusteMm;
  var r = round1(v);
  if (r > lim) return { v: lim, noLimite: true };
  if (r < -lim) return { v: -lim, noLimite: true };
  return { v: r, noLimite: false };
}

/** Toque num botão de direção: corrige 0,5 mm no sentido contrário ao erro
 *  relatado. No limite de ±8 mm para e avisa. */
export function corrigirDirecao(a: Ajuste, dir: Direcao, passo?: number): { ajuste: Ajuste; noLimite: boolean } {
  var p = passo == null ? PASSO_TOQUE_MM : passo;
  if (dir === "esquerda" || dir === "direita") {
    var x = limitar(a.x + (dir === "esquerda" ? p : -p));
    return { ajuste: { x: x.v, y: a.y }, noLimite: x.noLimite };
  }
  var y = limitar(a.y + (dir === "cima" ? p : -p));
  return { ajuste: { x: a.x, y: y.v }, noLimite: y.noLimite };
}

/** Ajuste fino: ±0,1 mm num eixo, com o mesmo limite. */
export function ajusteFino(a: Ajuste, eixo: "x" | "y", delta: number): { ajuste: Ajuste; noLimite: boolean } {
  var r = limitar((eixo === "x" ? a.x : a.y) + delta);
  return { ajuste: eixo === "x" ? { x: r.v, y: a.y } : { x: a.x, y: r.v }, noLimite: r.noLimite };
}

/** Para onde a correção levou a moldura (texto do passo 3). */
export function mensagemMovimento(dir: Direcao, passo?: number): string {
  var p = passo == null ? PASSO_TOQUE_MM : passo;
  var para = dir === "esquerda" ? "a direita" : dir === "direita" ? "a esquerda" : dir === "cima" ? "baixo" : "cima";
  return "Movi a moldura " + p.toFixed(1).replace(".", ",") + " mm para " + para + ". Ainda não está no meio? Toque de novo.";
}

/** "+0,5" · "−1,0" · "0,0" (sinal tipográfico de menos, como no mockup). */
export function sinalMm(n: number): string {
  var r = round1(n);
  var abs = Math.abs(r).toFixed(1).replace(".", ",");
  return (r > 0 ? "+" : r < 0 ? "−" : "") + abs;
}

export function textoAjuste(a: Ajuste): string {
  return "Horizontal " + sinalMm(a.x) + " mm · Vertical " + sinalMm(a.y) + " mm";
}

export function textoColunas(n: number): string {
  return n === 1 ? "Uma etiqueta por linha" : n + " etiquetas lado a lado";
}

export function espacosNoPadrao(s: Pick<CustomLabelSpec, "colunas" | "espacoLadoMm" | "espacoLinhaMm">): boolean {
  return s.espacoLinhaMm === MEDIDA_PADRAO.espacoLinhaMm && (s.colunas === 1 || s.espacoLadoMm === MEDIDA_PADRAO.espacoLadoMm);
}

export function textoEspacos(s: Pick<CustomLabelSpec, "colunas" | "espacoLadoMm" | "espacoLinhaMm">): string {
  return (s.colunas > 1 ? mmTxt(s.espacoLadoMm) + " mm lado a lado · " : "") + mmTxt(s.espacoLinhaMm) + " mm de cima para baixo" + (espacosNoPadrao(s) ? " (padrão)" : "");
}

// ----- Campos do passo 1 -----
export type CampoMedida = "largura" | "altura" | "espacoLado" | "espacoLinha";

export function faixaDoCampo(c: CampoMedida): readonly [number, number] {
  if (c === "largura") return MEDIDA_LIMITES.larguraMm;
  if (c === "altura") return MEDIDA_LIMITES.alturaMm;
  return MEDIDA_LIMITES.espacoMm;
}

/** Lê o texto digitado (aceita vírgula e ponto), sem travar a digitação:
 *  devolve o valor em décimos ou a mensagem de erro para baixo do campo. */
export function lerCampoMm(txt: string, c: CampoMedida): { ok: true; v: number } | { ok: false; msg: string } {
  var t = String(txt == null ? "" : txt).trim();
  if (t === "") return { ok: false, msg: "Digite um número" };
  if (!/^\d+([.,]\d*)?$/.test(t)) return { ok: false, msg: "Use só números. Exemplo: 50 ou 2,5" };
  var v = parseFloat(t.replace(",", "."));
  var f = faixaDoCampo(c);
  if (v < f[0] || v > f[1]) return { ok: false, msg: "Use um valor entre " + f[0] + " e " + f[1] + " mm" };
  return { ok: true, v: round1(v) };
}

export type TextosMedida = { largura: string; altura: string; espacoLado: string; espacoLinha: string };

/** Junta os campos num spec. Com 1 coluna o espaço lado a lado não conta
 *  (o campo fica desligado), então erro nele não trava. */
export function medidaDosCampos(base: CustomLabelSpec, txt: TextosMedida, colunas: number): { spec: CustomLabelSpec | null; erros: Partial<Record<CampoMedida, string>> } {
  var erros: Partial<Record<CampoMedida, string>> = {};
  var vals: Partial<Record<CampoMedida, number>> = {};
  (["largura", "altura", "espacoLado", "espacoLinha"] as CampoMedida[]).forEach(function (c) {
    if (c === "espacoLado" && colunas === 1) return;
    var r = lerCampoMm(txt[c], c);
    if (r.ok) vals[c] = r.v; else erros[c] = r.msg;
  });
  if (Object.keys(erros).length) return { spec: null, erros: erros };
  return {
    spec: {
      ...base,
      larguraMm: vals.largura as number,
      alturaMm: vals.altura as number,
      colunas: colunas,
      espacoLadoMm: colunas === 1 ? base.espacoLadoMm : (vals.espacoLado as number),
      espacoLinhaMm: vals.espacoLinha as number,
    },
    erros: erros,
  };
}

export function textosDaMedida(s: CustomLabelSpec): TextosMedida {
  return { largura: mmTxt(s.larguraMm), altura: mmTxt(s.alturaMm), espacoLado: mmTxt(s.espacoLadoMm), espacoLinha: mmTxt(s.espacoLinhaMm) };
}

// ============================================================================
// Desenho do rolo (SVG), portado do mockup. Ilustração em escala: 1 unidade
// do viewBox = 1 mm. Modo "conteudo" (etiqueta com nome, variação, preço e
// código de barras ilustrativo) ou "teste" (moldura, cruz e setas).
// ============================================================================
export type ExemploDeEtiqueta = { nome: string; variacao: string; preco: string; codigo: string };
export const EXEMPLO_PADRAO: ExemploDeEtiqueta = { nome: "Camiseta Algodão Básica", variacao: "M · Azul", preco: "R$ 59,90", codigo: "7891234567895" };

var BARRAS = [2,1,1,2,3,1,1,2,1,3,2,1,1,1,2,2,1,3,1,2,1,1,3,2,2,1,1,1,2,3,1,2,1,2,2,1,3,1,1,2,1,1,2,3,1,2,2,1];
var TINTA = "#1f1b2e";
var COR = "#7c3aed";

function f2(n: number): string { return (Math.round(n * 100) / 100).toString(); }
function escSvg(s: string): string { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

function barras(x: number, y: number, w: number, h: number): string {
  var tot = BARRAS.reduce(function (a, b) { return a + b; }, 0), mw = w / tot, cx = x, o = "";
  BARRAS.forEach(function (m, i) {
    if (i % 2 === 0) o += '<rect x="' + f2(cx) + '" y="' + f2(y) + '" width="' + f2(m * mw) + '" height="' + f2(h) + '" fill="' + TINTA + '"/>';
    cx += m * mw;
  });
  return o;
}
function caber(t: string, maxW: number, maxFs: number): number { return Math.min(maxFs, maxW / (Math.max(1, t.length) * 0.56)); }
function texto(t: string, x: number, y: number, fs: number, peso: number, cor?: string, ancora?: string): string {
  return '<text x="' + f2(x) + '" y="' + f2(y) + '" font-size="' + f2(fs) + '" font-weight="' + peso + '" fill="' + (cor || TINTA) + '" text-anchor="' + (ancora || "start") + '">' + escSvg(t) + "</text>";
}

function conteudo(x: number, y: number, w: number, h: number, ex: ExemploDeEtiqueta): string {
  var p = Math.max(1.2, Math.min(w, h) * 0.07), iw = w - 2 * p, ih = h - 2 * p, X = x + p, Y = y + p;
  var nome = iw < 32 && ex.nome.length > 16 ? ex.nome.slice(0, 15).trim() + "…" : ex.nome;
  var o = "";
  if (w / h > 2.6) {
    var tw = iw * 0.46, bw = iw * 0.5;
    var fN = caber(nome, tw, h * 0.2), fV = caber(ex.variacao, tw, h * 0.16), fP = caber(ex.preco, tw, h * 0.3);
    var ty = Y + fN * 0.85;
    o += texto(nome, X, ty, fN, 700);
    ty += fV * 1.3; o += texto(ex.variacao, X, ty, fV, 500, "#6b6585");
    ty += fP * 1.15; o += texto(ex.preco, X, ty, fP, 800);
    o += barras(X + iw - bw, Y + ih * 0.04, bw, ih * 0.68);
    o += texto(ex.codigo, X + iw - bw / 2, Y + ih * 0.98, Math.min(ih * 0.2, bw / (13 * 0.62)), 500, TINTA, "middle");
  } else {
    var fN2 = caber(nome, iw, h * 0.12), fP2 = caber(ex.preco, iw * 0.5, h * 0.17), fV2 = caber(ex.variacao, iw * 0.45, h * 0.1);
    var y1 = Y + fN2 * 0.85, y2 = y1 + fP2 * 1.18;
    o += texto(nome, X, y1, fN2, 700);
    if (ex.variacao) o += texto(ex.variacao, X, y2, fV2, 500, "#6b6585");
    o += texto(ex.preco, X + iw, y2, fP2, 800, TINTA, "end");
    var comNumero = h >= 24, numH = comNumero ? Math.min(3, h * 0.1) : 0;
    var by = y2 + fP2 * 0.28, bh = Math.max(h * 0.14, Y + ih - numH - by);
    o += barras(X, by, iw, bh);
    if (comNumero) o += texto(ex.codigo, X + iw / 2, by + bh + numH * 0.85, Math.min(numH * 0.9, iw / (13 * 0.62)), 500, TINTA, "middle");
  }
  return o;
}

function seta(x1: number, y1: number, x2: number, y2: number, hs: number): string {
  var a = Math.atan2(y2 - y1, x2 - x1), c = Math.cos(a), s = Math.sin(a);
  var p1 = f2(x2 - hs * c + hs * 0.55 * s) + "," + f2(y2 - hs * s - hs * 0.55 * c);
  var p2 = f2(x2 - hs * c - hs * 0.55 * s) + "," + f2(y2 - hs * s + hs * 0.55 * c);
  return '<line x1="' + f2(x1) + '" y1="' + f2(y1) + '" x2="' + f2(x2 - hs * 0.6 * c) + '" y2="' + f2(y2 - hs * 0.6 * s) + '" stroke-width=".35" stroke-linecap="round"/>' +
    '<polygon points="' + f2(x2) + "," + f2(y2) + " " + p1 + " " + p2 + '" stroke="none"/>';
}

function moldura(x: number, y: number, w: number, h: number): string {
  var f = 1.2, fx = x + f, fy = y + f, fw = w - 2 * f, fh = h - 2 * f, cx = x + w / 2, cy = y + h / 2;
  var L = Math.min(w, h) * 0.17, al = Math.min(3.4, Math.min(w, h) * 0.14), g = 1, hs = Math.min(1.1, al * 0.4);
  return '<rect x="' + f2(fx) + '" y="' + f2(fy) + '" width="' + f2(fw) + '" height="' + f2(fh) + '" stroke-width=".55" rx=".6" fill="none"/>' +
    '<line x1="' + f2(cx - L) + '" y1="' + f2(cy) + '" x2="' + f2(cx + L) + '" y2="' + f2(cy) + '" stroke-width=".35"/>' +
    '<line x1="' + f2(cx) + '" y1="' + f2(cy - L) + '" x2="' + f2(cx) + '" y2="' + f2(cy + L) + '" stroke-width=".35"/>' +
    seta(cx, fy + g + al, cx, fy + g, hs) + seta(cx, fy + fh - g - al, cx, fy + fh - g, hs) +
    seta(fx + g + al, cy, fx + g, cy, hs) + seta(fx + fw - g - al, cy, fx + fw - g, cy, hs);
}

export type OpcoesDoRolo = {
  larguraMm: number; alturaMm: number; colunas: number; espacoLadoMm: number; espacoLinhaMm: number;
  modo?: "conteudo" | "teste";
  /** Cotas (largura, altura e espaços) em volta do rolo. */
  cotas?: boolean;
  linhas?: number;
  /** Deslocamento ilustrativo da moldura do teste (mm). */
  dx?: number; dy?: number;
  /** Moldura tracejada verde "onde deveria ficar". */
  fantasma?: boolean;
  /** Moldura verde: no lugar certo. */
  certo?: boolean;
  larguraMinima?: number;
  alturaMaxPx?: number;
  exemplo?: ExemploDeEtiqueta;
};

/** SVG do rolo em escala (1 unidade = 1 mm), para a ilustração do wizard. */
export function desenhoDoRolo(o: OpcoesDoRolo): string {
  var w = o.larguraMm, h = o.alturaMm, cols = Math.max(1, Math.min(3, o.colunas || 1));
  var gx = cols > 1 ? o.espacoLadoMm : 0, gy = o.espacoLinhaMm;
  var modo = o.modo || "conteudo", cotas = !!o.cotas;
  var ex = o.exemplo || EXEMPLO_PADRAO;
  var linhas = o.linhas || Math.max(2, Math.min(3, Math.round(105 / (h + gy))));
  var m = 3, larguraRolo = cols * w + (cols - 1) * gx + 2 * m;
  var exD = cotas ? 20 : 0, exT = cotas ? 10 : 0, exB = cotas && cols > 1 ? 8 : 0;
  var cW = larguraRolo + exD, vbW = Math.max(cW, o.larguraMinima || 70), ox = (vbW - cW) / 2;
  var padT = Math.max(gy, 2.5);
  var alturaRolo = padT * 2 + linhas * h + (linhas - 1) * gy;
  var vbH = exT + alturaRolo + exB + 1.5;
  var fs = Math.max(2.6, Math.min(4.6, vbW / 22));
  function lx(c: number) { return ox + m + c * (w + gx); }
  function ly(r: number) { return exT + padT + r * (h + gy); }
  var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + f2(vbW) + " " + f2(vbH) + '" style="display:block;width:100%;height:auto;max-height:' + (o.alturaMaxPx || 360) + 'px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif" role="img" aria-label="Ilustração do rolo com etiquetas de ' + mmTxt(w) + " por " + mmTxt(h) + ' milímetros">';
  s += '<rect x="' + f2(ox) + '" y="' + exT + '" width="' + f2(larguraRolo) + '" height="' + f2(alturaRolo) + '" fill="#e4e1f0"/>';
  var rx = Math.min(1.6, w / 8);
  for (var r = 0; r < linhas; r++) for (var c = 0; c < cols; c++) {
    s += '<rect x="' + f2(lx(c)) + '" y="' + f2(ly(r)) + '" width="' + f2(w) + '" height="' + f2(h) + '" rx="' + f2(rx) + '" fill="#fff" stroke="#cfc9e4" stroke-width=".3"/>';
    if (modo === "conteudo") s += conteudo(lx(c), ly(r), w, h, ex);
  }
  if (cotas) {
    var yc = exT - 4.4, x1 = lx(0), x2 = lx(0) + w;
    s += '<g stroke="' + COR + '" stroke-width=".28" fill="none" stroke-linecap="round"><path d="M' + f2(x1) + " " + f2(yc) + "H" + f2(x2) + "M" + f2(x1) + " " + f2(yc - 1) + "V" + f2(yc + 1) + "M" + f2(x2) + " " + f2(yc - 1) + "V" + f2(yc + 1) + '"/></g>';
    s += texto(mmTxt(w) + " mm", (x1 + x2) / 2, yc - 1.8, fs, 800, COR, "middle");
    var xr = ox + larguraRolo + 4.5, t0 = ly(0), t1 = ly(0) + h;
    s += '<g stroke="' + COR + '" stroke-width=".28" fill="none" stroke-linecap="round"><path d="M' + f2(xr) + " " + f2(t0) + "V" + f2(t1) + "M" + f2(xr - 1) + " " + f2(t0) + "H" + f2(xr + 1) + "M" + f2(xr - 1) + " " + f2(t1) + "H" + f2(xr + 1) + '"/></g>';
    s += texto(mmTxt(h) + " mm", xr + 2, (t0 + t1) / 2 + fs * 0.35, fs, 800, COR);
    if (linhas > 1 && gy > 0) {
      var bw = (mmTxt(gy).length + 3) * fs * 0.5, bh = fs * 1.15, cxg = lx(0) + w / 2, cyg = ly(0) + h + gy / 2;
      s += '<rect x="' + f2(cxg - bw / 2) + '" y="' + f2(cyg - bh / 2) + '" width="' + f2(bw) + '" height="' + f2(bh) + '" rx="' + f2(bh / 2) + '" fill="' + COR + '"/>' + texto(mmTxt(gy) + " mm", cxg, cyg + fs * 0.3, fs * 0.8, 700, "#fff", "middle");
    }
    if (cols > 1 && gx > 0) {
      var xa = lx(0) + w, xb = lx(1), yb = ly(linhas - 1) + h + Math.max(1.2, padT * 0.5);
      s += '<g stroke="' + COR + '" stroke-width=".28" fill="none"><path d="M' + f2(xa) + " " + f2(yb) + "H" + f2(xb) + '"/></g>';
      s += texto(mmTxt(gx) + " mm", (xa + xb) / 2, yb + fs * 1.15, fs * 0.85, 800, COR, "middle");
    }
  }
  if (modo === "teste") {
    var corM = o.certo ? "#16a34a" : COR;
    for (var k = 0; k < cols; k++) {
      if (o.fantasma) s += '<rect x="' + f2(lx(k) + 1.2) + '" y="' + f2(ly(0) + 1.2) + '" width="' + f2(w - 2.4) + '" height="' + f2(h - 2.4) + '" fill="none" stroke="#16a34a" stroke-width=".4" stroke-dasharray="1.2 .9" rx=".6" opacity=".75"/>';
      s += '<g fill="' + corM + '" stroke="' + corM + '" transform="translate(' + f2(o.dx || 0) + " " + f2(o.dy || 0) + ')">' + moldura(lx(k), ly(0), w, h) + "</g>";
    }
  }
  return s + "</svg>";
}
