// ============================================================
// scripts/studio/camisetaParametrica.js — 27/09/2026
//
// A camiseta básica do Aura Studio gerada do zero, sem asset de terceiros:
// a aritmética que desenha a malha (corpo por seções transversais
// suavizadas, mangas por anéis ao longo do próprio eixo soldadas na cava,
// ribana e bainhas como faixas com espessura), as UVs em ilhas
// retangulares (painéis da frente e das costas em projeção planar
// isotrópica) e as áreas imprimíveis que a spec camiseta-basica-3d.json
// declara. O refino (Loop, normais, dobras, oclusão) e o GLB vêm de
// refinarMalha.js — nada aqui é reescrito.
//
// POR QUE UM .js CommonJS separado da CLI (.mjs): o Jest deste repo só
// transforma .ts/.tsx/.js, e a malha precisa de teste (fechada, manifold,
// UVs em [0,1], ilhas dos painéis nas faixas de u certas, círculo de prova
// redondo, triângulos na meta). A CLI gerar-camiseta-glb.mjs importa daqui
// com createRequire e só cuida de argumentos e arquivos.
//
// Convenções: x para a direita de quem veste (a direita de quem OLHA a
// frente é +x), y para cima, z para a frente. Tudo em CENTÍMETROS até a
// escrita do GLB, que converte para metros (a unidade do glTF). O corpo é
// parametrizado por (linha, coluna): a linha percorre o contorno externo
// do molde (barra → costura lateral → cava → ombro → ponto do pescoço) e
// a coluna vai da costura direita ao centro e à costura esquerda; cada
// linha é um contorno fechado (metade da frente + metade das costas).
// ============================================================
"use strict";

const {
  escreverGlb, soldar, estatisticasDeArestas, subdividirLoop, normaisSuaves,
  aplicarDobras, oclusaoPorVertice, pesoDasDobras, minmax,
} = require("./refinarMalha.js");

// ── Parâmetros (centímetros e graus) ─────────────────────────
//
// Uma camiseta básica adulta (tamanho M), como o manequim fantasma de uma
// foto de e-commerce. Cada número é uma medida de molde ou de cena; quem
// quiser um tamanho ou um caimento diferente muda aqui e roda a CLI.
const PARAMETROS = {
  // Do ponto alto do ombro (junto ao pescoço) até a barra.
  alturaDoCorpo: 70,
  // Metade da largura plana: 52 cm de peito e 51 cm de barra (o tronco
  // afina pouco até a barra, como numa básica de corte reto).
  meiaLarguraDoPeito: 26,
  meiaLarguraDaBarra: 25.5,
  // Altura (y) da axila: onde a manga encontra o tronco por baixo. Com o
  // ombro a 66 cm, a cava tem 22 cm de profundidade.
  alturaDaCava: 44,
  // Metade da distância entre as pontas dos ombros (46 cm) e quanto o
  // ombro cai da gola até a ponta (queda suave, sem quina).
  meiaLarguraDoOmbro: 23,
  quedaDoOmbro: 4,
  // Pontos da curva da cava no plano do molde (x, y): da axila até a ponta
  // do ombro, entrando no tronco no meio da altura — a cava curva que
  // faltava no modelo antigo.
  curvaDaCava: [[26, 44], [23.4, 47.5], [21.7, 54], [21.9, 60], [23, 66]],
  // Quanto a borda da cava avança em z (a frente escava mais que as costas):
  // é o que abre a cava para a manga entrar, em vez de uma linha.
  bojoDaCavaFrente: 5.5,
  bojoDaCavaCostas: 4.5,
  // Gola careca: 17 cm de abertura, 7 cm de profundidade na frente e 1,5 nas
  // costas, medidos do ponto alto do ombro. `inicioDaGola` é a altura a
  // partir da qual as linhas do corpo começam a se curvar rumo à gola.
  meiaLarguraDoPescoco: 8.5,
  profundidadeDaGolaFrente: 7,
  profundidadeDaGolaCostas: 1.5,
  inicioDaGola: 52,
  // Ribana de 2 cm em pé na gola, com espessura (a faixa tem face externa,
  // borda e face interna); a ribana inclina-se um pouco para dentro.
  ribana: 2,
  espessuraDaRibana: 0.35,
  inclinacaoDaRibana: 0.3,
  // Bainhas: 2,5 cm na barra e 2 cm na boca da manga, dobradas para dentro
  // com uma espessura pequena (a dobra é o que se vê como bainha).
  bainha: 2.5,
  bainhaDaManga: 2,
  espessuraDaBainha: 0.3,
  // Meia profundidade (z) do tronco por altura (y), frente e costas em
  // separado: 18 cm no peito, afinando pouco até a barra e recuando no
  // peito alto até o pescoço. Interpolado por spline (Catmull-Rom).
  profundidadeFrente: [[0, 7.5], [20, 8], [44, 9], [55, 8.7], [63, 7.2], [72, 6]],
  profundidadeCostas: [[0, 7.5], [20, 8], [44, 8.8], [55, 8.3], [66, 6.5], [72, 5.5]],
  // Expoente da superelipse de cada seção transversal: 2 é uma elipse,
  // maior é mais "retangular arredondado" (o tecido pendurado num
  // manequim fantasma fica mais achatado que uma elipse).
  expoenteDaSecao: 2.4,
  // Manga curta: 20 cm medidos da ponta do ombro pela borda de cima, eixo
  // caído 20° abaixo da horizontal, boca aberta com 20 cm de largura plana
  // e 7 cm de profundidade — achatada, como uma manga pendurada, e não um
  // tubo redondo (afina de leve da cava até a boca).
  comprimentoDaManga: 20,
  inclinacaoDaManga: 20,
  meiaAlturaDaBocaDaManga: 10,
  meiaProfundidadeDaManga: [4.6, 3.6],
  // Até que fração do comprimento a manga ainda "lembra" o contorno da
  // cava antes de virar o tubo achatado da boca.
  transicaoDaManga: 0.55,
  // Resolução da malha-base (antes do Loop): colunas por metade de contorno,
  // passo das linhas em cm, anéis da manga. Meta: ~13 mil triângulos, que
  // uma passada de Loop leva a ~52 mil (dentro dos 40–80 mil da spec).
  colunasPorPainel: 44,
  passoDasLinhas: 1.4,
  aneisDaManga: 13,
  passadasDeLoop: 1,
  // UV: quantos centímetros de tecido cabem numa unidade de UV. Com a
  // textura quadrada (2048×2048) e a mesma escala em u e em v, a projeção
  // dos painéis é isotrópica: um círculo impresso sai redondo. Os painéis
  // ocupam a metade de cima (v ≥ vBaseDosPaineis); as outras ilhas ficam
  // embaixo. 0,5 de u = 60 cm cobre os 52 cm do peito com folga.
  cmPorUv: 120,
  vBaseDosPaineis: 0.39,
  // Área imprimível de cada painel: 28×35 cm a partir de 8 cm abaixo da
  // gola (a linha da gola de cada painel: 63 na frente, 68,5 nas costas).
  larguraImprimivel: 28,
  alturaImprimivel: 35,
  folgaDaGola: 8,
  // Dobras e oclusão (em cm, convertidos para metros na hora): dobras de
  // ~4 mm com onda de ~10 cm, sumindo a 4 cm das bordas escondidas e a
  // 7 cm da barra e das bocas (a barra continua reta); axilas com sombra
  // de 10 cm de alcance e a gola com 6 cm.
  dobras: { amplitude: 0.42, comprimento: 10, semente: 7, margemDaBorda: 4, faixaLisaDaBarra: 7 },
  oclusao: { raioAxila: 10, forcaAxila: 0.4, raioGola: 6, forcaGola: 0.2 },
};

// ── Álgebra pequena ──────────────────────────────────────────

const soma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const escala = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norma = (a) => Math.hypot(a[0], a[1], a[2]);
const unitario = (a) => { const l = norma(a); return l > 0 ? escala(a, 1 / l) : [0, 0, 0]; };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const suave = (t) => { const s = Math.max(0, Math.min(1, t)); return s * s * (3 - 2 * s); };
const potenciaComSinal = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);

/**
 * Spline por pontos [[x, y], ...] ordenados em x, tangentes por diferença
 * centrada (Catmull-Rom em grade irregular), constante fora dos extremos.
 * É o que dá a profundidade do tronco por altura sem degrau entre as
 * medidas de molde.
 */
function spline(pontos, x) {
  const n = pontos.length;
  if (x <= pontos[0][0]) return pontos[0][1];
  if (x >= pontos[n - 1][0]) return pontos[n - 1][1];
  let i = 0;
  while (i < n - 2 && x > pontos[i + 1][0]) i++;
  const [x0, y0] = pontos[i], [x1, y1] = pontos[i + 1];
  const tang = (k) => {
    const a = pontos[Math.max(0, k - 1)], b = pontos[Math.min(n - 1, k + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  };
  const h = x1 - x0, t = (x - x0) / h, m0 = tang(i) * h, m1 = tang(i + 1) * h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
}

/** Curva Catmull-Rom 2D densa por uma lista de pontos [[x, y], ...]. */
function catmullRom2D(pontos, amostrasPorSegmento = 24) {
  const saida = [];
  const P = (k) => pontos[Math.max(0, Math.min(pontos.length - 1, k))];
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < amostrasPorSegmento; s++) {
      const t = s / amostrasPorSegmento, t2 = t * t, t3 = t2 * t;
      saida.push([0, 1].map((c) => 0.5 * (
        2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3
      )));
    }
  }
  saida.push(pontos[pontos.length - 1].slice());
  return saida;
}

/**
 * Reamostra uma polilinha 2D em pontos igualmente espaçados pelo arco
 * (passo aproximado, ajustado para cair exatamente nas duas pontas).
 * Devolve também a fração do arco `q` de cada ponto (0 na primeira, 1 na
 * última) — é por ela que o bojo da cava sobe e desce.
 */
function reamostrar(polilinha, passo) {
  const acumulado = [0];
  for (let i = 1; i < polilinha.length; i++) {
    acumulado.push(acumulado[i - 1] + Math.hypot(polilinha[i][0] - polilinha[i - 1][0], polilinha[i][1] - polilinha[i - 1][1]));
  }
  const total = acumulado[acumulado.length - 1];
  const n = Math.max(1, Math.round(total / passo));
  const saida = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const alvo = (total * k) / n;
    while (j < polilinha.length - 2 && acumulado[j + 1] < alvo) j++;
    const seg = acumulado[j + 1] - acumulado[j];
    const t = seg > 0 ? (alvo - acumulado[j]) / seg : 0;
    saida.push({ x: lerp(polilinha[j][0], polilinha[j + 1][0], t), y: lerp(polilinha[j][1], polilinha[j + 1][1], t), q: k / n });
  }
  return saida;
}

/** Comprimento acumulado (cm) ao longo de uma lista de posições 3D. */
function arcoAcumulado(pontos) {
  const acc = [0];
  for (let i = 1; i < pontos.length; i++) acc.push(acc[i - 1] + norma(sub(pontos[i], pontos[i - 1])));
  return acc;
}

// ── O contorno do molde: as linhas do corpo ──────────────────

/**
 * As linhas do corpo, na ordem barra → ombro, cada uma com o ponto do
 * contorno externo do molde (X, Y), a seção a que pertence ("lateral",
 * "cava" ou "ombro") e a fração `q` dentro da seção. A costura lateral
 * ganha linhas extras em y = bainha (o vinco da bainha) e a cava e o
 * ombro são reamostrados pelo arco para as células ficarem parelhas.
 */
function linhasDoCorpo(P) {
  const linhas = [];
  // lateral: reta da barra à axila, com o vinco da bainha marcado
  const alturas = [0, P.bainha, P.bainha + 0.6];
  for (let y = P.bainha + 0.6 + P.passoDasLinhas; y < P.alturaDaCava - P.passoDasLinhas * 0.5; y += P.passoDasLinhas) alturas.push(y);
  alturas.push(P.alturaDaCava);
  for (const y of alturas) {
    const t = y / P.alturaDaCava;
    linhas.push({ X: lerp(P.meiaLarguraDaBarra, P.meiaLarguraDoPeito, t), Y: y, secao: "lateral", q: t });
  }
  // cava: curva Catmull-Rom da axila à ponta do ombro
  const cava = reamostrar(catmullRom2D(P.curvaDaCava), P.passoDasLinhas);
  for (let i = 1; i < cava.length; i++) linhas.push({ X: cava[i].x, Y: cava[i].y, secao: "cava", q: cava[i].q });
  // ombro: reta da ponta do ombro ao ponto do pescoço
  const ponta = P.curvaDaCava[P.curvaDaCava.length - 1];
  const ombro = reamostrar([ponta, [P.meiaLarguraDoPescoco, P.alturaDoCorpo]], P.passoDasLinhas);
  for (let i = 1; i < ombro.length; i++) linhas.push({ X: ombro[i].x, Y: ombro[i].y, secao: "ombro", q: ombro[i].q });
  return linhas;
}

// ── A malha-base ─────────────────────────────────────────────

/**
 * Constrói a camiseta em centímetros, com as UVs prontas. Devolve
 * `{ pos, uv, tris, grupos, interno }`: `grupos` diz de que parte cada
 * vértice é (frente, costas, mangaDireita, ...), `interno` marca os
 * vértices das bordas escondidas (o lado de dentro das bainhas e da
 * ribana) — as únicas arestas de borda que a malha pode ter.
 */
function construirCamiseta(P = PARAMETROS) {
  const pos = [], uv = [], tris = [], grupos = [], interno = [];
  const M = P.colunasPorPainel;
  const n = P.expoenteDaSecao;
  const cm = P.cmPorUv;
  const ilhas = P._ilhas || ilhasDeUv(P);
  const linhas = linhasDoCorpo(P);
  const R = linhas.length;
  const kAxila = linhas.findIndex((l) => l.secao === "cava") - 1;
  const kPonta = linhas.findIndex((l) => l.secao === "ombro") - 1;

  // As UVs são calculadas com v crescendo PARA CIMA (a convenção da spec e
  // das áreas); o glTF guarda v crescendo para baixo e o viewer lê a
  // textura com flipY=false — por isso o arquivo recebe 1 - v.
  const vertice = (p, q, grupo, ehInterno = false) => {
    pos.push(p); uv.push([q[0], 1 - q[1]]); grupos.push(grupo); interno.push(!!ehInterno);
    return pos.length - 1;
  };
  const quad = (a, b, c, d) => { tris.push([a, b, c], [a, c, d]); };

  // Perfil de cada coluna: r = posição em x (de +1 na costura direita a -1
  // na esquerda) e f = quanto a coluna avança em z (0 nas costuras, 1 no
  // centro), pela superelipse de expoente n.
  const colunas = [];
  for (let j = 0; j <= M; j++) {
    const ang = (Math.PI * j) / M;
    colunas.push({ r: potenciaComSinal(Math.cos(ang), 2 / n), f: Math.pow(Math.abs(Math.sin(ang)), 2 / n) });
  }
  // A forma da gola: quanto cada coluna desce rumo ao centro (1 no centro,
  // 0 no ponto do pescoço), um U um pouco mais chato que a elipse.
  const formaDaGola = (r) => Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(r), 2.5)));

  const painel = (frente) => {
    const sinal = frente ? 1 : -1;
    const profundidade = frente ? P.profundidadeFrente : P.profundidadeCostas;
    const bojo = frente ? P.bojoDaCavaFrente : P.bojoDaCavaCostas;
    const golaMax = frente ? P.profundidadeDaGolaFrente : P.profundidadeDaGolaCostas;
    const base = pos.length;
    for (let k = 0; k < R; k++) {
      const L = linhas[k];
      const a = L.secao === "cava" ? bojo * Math.sin(Math.PI * L.q) : 0;
      const gola = golaMax * suave((L.Y - P.inicioDaGola) / (P.alturaDoCorpo - P.inicioDaGola));
      // vinco da bainha: a dobra dupla é um pouco mais grossa que o tecido
      const vinco = L.Y <= P.bainha ? P.espessuraDaBainha * 0.4 : 0;
      for (let j = 0; j <= M; j++) {
        const { r, f } = colunas[j];
        const x = L.X * r;
        const y = L.Y - gola * formaDaGola(r);
        const d = spline(profundidade, y);
        const z = sinal * (a + (d - a) * f);
        const p = vinco ? soma([x, y, z], escala(unitario([x, 0, z]), vinco)) : [x, y, z];
        // UV planar isotrópica: u pela posição x (espelhada nas costas para
        // a arte não sair invertida vista de trás), v pela altura.
        const u = frente ? 0.25 + x / cm : 0.75 - x / cm;
        vertice(p, [u, P.vBaseDosPaineis + y / cm], frente ? "frente" : "costas");
      }
    }
    for (let k = 0; k < R - 1; k++) {
      for (let j = 0; j < M; j++) {
        const a = base + k * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
        if (frente) quad(a, c, d, b); else quad(a, b, d, c);
      }
    }
    return base;
  };
  const baseFrente = painel(true);
  const baseCostas = painel(false);
  const iFrente = (k, j) => baseFrente + k * (M + 1) + j;
  const iCostas = (k, j) => baseCostas + k * (M + 1) + j;

  // ── Mangas: anéis ao longo do eixo, o primeiro é a própria cava ──
  const manga = (direita) => {
    const sx = direita ? 1 : -1;
    // vértices da cava, no sentido axila → frente → ponta do ombro → costas → axila
    const idsDaCava = [];
    const angulo = []; // posição no anel: -π/2 embaixo, 0 na frente, π/2 em cima, π atrás
    const K = kPonta - kAxila + 1;
    const col = direita ? 0 : M;
    for (let k = kAxila; k <= kPonta; k++) { idsDaCava.push(iFrente(k, col)); angulo.push(-Math.PI / 2 + (Math.PI * (k - kAxila)) / (K - 1)); }
    for (let k = kPonta - 1; k > kAxila; k--) { idsDaCava.push(iCostas(k, col)); angulo.push(Math.PI / 2 + (Math.PI * (kPonta - k)) / (K - 1)); }
    const cava = idsDaCava.map((i) => pos[i]);
    const N = cava.length;
    const ponta = pos[iFrente(kPonta, col)], axila = pos[iFrente(kAxila, col)];
    const centro0 = escala(soma(ponta, axila), 0.5);
    const meiaAltura0 = (ponta[1] - axila[1]) / 2;
    const inc = (P.inclinacaoDaManga * Math.PI) / 180;
    const eixo = [Math.cos(inc) * sx, -Math.sin(inc), 0];
    const cima = [Math.sin(inc) * sx, Math.cos(inc), 0];
    // O comprimento do eixo (L) é o que faz a borda de cima da manga medir
    // `comprimentoDaManga` da ponta do ombro até a boca: bissecção.
    const topoDaBoca = (L) => soma(soma(centro0, escala(eixo, L)), escala(cima, P.meiaAlturaDaBocaDaManga));
    let lo = 1, hi = 60;
    for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (norma(sub(topoDaBoca(mid), ponta)) < P.comprimentoDaManga) lo = mid; else hi = mid; }
    const L = (lo + hi) / 2;

    const anel = (s) => {
      const centro = soma(centro0, escala(eixo, L * s));
      const h = lerp(meiaAltura0, P.meiaAlturaDaBocaDaManga, s);
      const e = lerp(P.meiaProfundidadeDaManga[0], P.meiaProfundidadeDaManga[1], s);
      const beta = suave(s / P.transicaoDaManga);
      // vinco da bainha da manga, como na barra
      const vinco = L * (1 - s) <= P.bainhaDaManga ? P.espessuraDaBainha * 0.4 : 0;
      return cava.map((p, i) => {
        const varrido = soma(p, escala(eixo, L * s));
        const elipse = soma(soma(centro, escala(cima, h * Math.sin(angulo[i]))), [0, 0, e * Math.cos(angulo[i])]);
        const q = lerp3(varrido, elipse, beta);
        return vinco ? soma(q, escala(unitario(sub(q, centro)), vinco)) : q;
      });
    };
    // UV: u pelo arco da cava (fechado pela costura embaixo), v pela distância ao longo do eixo
    const arco = arcoAcumulado(cava.concat([cava[0]]));
    const perimetro = arco[N];
    const ilha = direita ? ilhas.mangaDireita : ilhas.mangaEsquerda;
    const grupo = direita ? "mangaDireita" : "mangaEsquerda";
    const aneis = [];
    const A = P.aneisDaManga;
    for (let m = 0; m <= A; m++) {
      const s = m / A;
      const pts = m === 0 ? cava : anel(s);
      const ids = [];
      for (let i = 0; i <= N; i++) ids.push(vertice(pts[i % N], [ilha.u0 + arco[i] / cm, ilha.v0 + (L * s) / cm], grupo));
      aneis.push(ids);
    }
    // bainha da manga: borda com espessura, dobrada para dentro do tubo
    const centroFim = soma(centro0, escala(eixo, L));
    const boca = aneis[A].map((i) => pos[i]);
    const lip1 = boca.map((p) => sub(p, escala(unitario(sub(p, centroFim)), P.espessuraDaBainha)));
    const lip2 = lip1.map((p) => sub(p, escala(eixo, P.bainhaDaManga)));
    const idsLip1 = [], idsLip2 = [];
    for (let i = 0; i <= N; i++) {
      idsLip1.push(vertice(lip1[i], [ilha.u0 + arco[i] / cm, ilha.v0 + (L + P.espessuraDaBainha) / cm], grupo));
      idsLip2.push(vertice(lip2[i], [ilha.u0 + arco[i] / cm, ilha.v0 + (L + P.espessuraDaBainha + P.bainhaDaManga) / cm], grupo, true));
    }
    aneis.push(idsLip1, idsLip2);
    for (let m = 0; m < aneis.length - 1; m++) {
      for (let i = 0; i < N; i++) {
        const a = aneis[m][i], b = aneis[m][i + 1], c = aneis[m + 1][i], d = aneis[m + 1][i + 1];
        if (direita) quad(a, b, d, c); else quad(a, c, d, b);
      }
    }
    return { perimetro, comprimento: L + P.espessuraDaBainha + P.bainhaDaManga };
  };

  // ── Faixas: ribana na gola, bainha na barra ──
  // Uma faixa é um conjunto de "trilhos" (linhas de vértices) unidos por
  // quads; o primeiro trilho copia a posição da borda do corpo (soldado).
  const faixa = (trilhos, ilha, grupo, ultimoInterno) => {
    const arco = arcoAcumulado(trilhos[0]);
    const ids = trilhos.map((tr, t) => tr.map((p, i) => vertice(p, [ilha.u0 + arco[i] / cm, ilha.v0 + ilha.alturas[t] / cm], grupo, ultimoInterno && t === trilhos.length - 1)));
    for (let t = 0; t < ids.length - 1; t++) {
      for (let i = 0; i < ids[t].length - 1; i++) {
        quad(ids[t][i], ids[t][i + 1], ids[t + 1][i + 1], ids[t + 1][i]);
      }
    }
    return arco[arco.length - 1];
  };
  const horizontalParaFora = (p) => unitario([p[0], 0, p[2]]);

  // gola: laço fechado pela linha de cima da frente (direita → esquerda) e das costas (esquerda → direita)
  const gola = [];
  for (let j = 0; j <= M; j++) gola.push(pos[iFrente(R - 1, j)]);
  for (let j = M - 1; j >= 1; j--) gola.push(pos[iCostas(R - 1, j)]);
  gola.push(gola[0]);
  const direcaoDaRibana = (p) => unitario(sub([0, 1, 0], escala(horizontalParaFora(p), P.inclinacaoDaRibana)));
  const ribanaTopo = gola.map((p) => soma(p, escala(direcaoDaRibana(p), P.ribana)));
  const ribanaTopoDentro = ribanaTopo.map((p) => sub(p, escala(horizontalParaFora(p), P.espessuraDaRibana)));
  const ribanaBaseDentro = gola.map((p) => sub(p, escala(horizontalParaFora(p), P.espessuraDaRibana)));
  const perimetroDaGola = faixa(
    [gola, ribanaTopo, ribanaTopoDentro, ribanaBaseDentro],
    { ...ilhas.ribana, alturas: [0, P.ribana, P.ribana + P.espessuraDaRibana, 2 * P.ribana + P.espessuraDaRibana] },
    "ribana", true,
  );

  // barra: a frente e as costas em ilhas separadas (a volta inteira não cabe
  // em 1,0 de u na mesma escala); as pontas coincidem e soldam.
  const bainhaDe = (frente) => {
    const borda = [];
    for (let j = 0; j <= M; j++) borda.push(pos[frente ? iFrente(0, j) : iCostas(0, j)]);
    const dentro = borda.map((p) => sub(p, escala(horizontalParaFora(p), P.espessuraDaBainha)));
    const dentroCima = dentro.map((p) => soma(p, [0, P.bainha, 0]));
    const ilha = frente ? ilhas.bainhaFrente : ilhas.bainhaCostas;
    return faixa([borda, dentro, dentroCima], { ...ilha, alturas: [0, P.espessuraDaBainha, P.espessuraDaBainha + P.bainha] }, frente ? "bainhaFrente" : "bainhaCostas", true);
  };
  const perimetroDaBarra = bainhaDe(true) + bainhaDe(false);

  const mangaD = manga(true);
  const mangaE = manga(false);

  const malha = { pos, uv, tris, grupos, interno };
  orientarFaces(malha);
  return {
    ...malha,
    medidas: {
      linhas: R, colunas: M, perimetroDaGola, perimetroDaBarra,
      perimetroDaManga: mangaD.perimetro, comprimentoDaIlhaDaManga: mangaD.comprimento,
      perimetroDaMangaEsquerda: mangaE.perimetro,
      axilas: [pos[iFrente(kAxila, 0)], pos[iFrente(kAxila, M)]],
    },
  };
}

/**
 * Onde cada ilha de UV começa (canto inferior esquerdo), abaixo dos
 * painéis. As larguras vêm dos perímetros reais (≈54 cm cada manga, ≈65 cm
 * cada metade da barra, ≈47 cm a gola), todos na mesma escala dos painéis.
 */
function ilhasDeUv(P) {
  return {
    mangaDireita: { u0: 0.01, v0: 0.20 },
    mangaEsquerda: { u0: 0.52, v0: 0.20 },
    bainhaFrente: { u0: 0.01, v0: 0.12 },
    ribana: { u0: 0.53, v0: 0.12 },
    bainhaCostas: { u0: 0.01, v0: 0.06 },
  };
}

/**
 * Orientação consistente das faces: partindo da primeira face da frente
 * (normal para +z), propaga pelas arestas soldadas virando quem aponta ao
 * contrário. Sem isso, cada retalho (painel, manga, faixa) seria construído
 * com o giro que calhou, e uma face invertida vira um buraco escuro no
 * sombreamento. Modifica `malha.tris` no lugar.
 */
function orientarFaces(malha) {
  const { pos, tris } = malha;
  const ids = soldar(pos);
  const chave = (a, b) => (a < b ? a + "_" + b : b + "_" + a);
  const facesDaAresta = new Map();
  tris.forEach((t, f) => {
    for (let e = 0; e < 3; e++) {
      const k = chave(ids[t[e]], ids[t[(e + 1) % 3]]);
      if (!facesDaAresta.has(k)) facesDaAresta.set(k, []);
      facesDaAresta.get(k).push(f);
    }
  });
  const direcoes = (t) => {
    const w = t.map((i) => ids[i]);
    return [[w[0], w[1]], [w[1], w[2]], [w[2], w[0]]];
  };
  const visto = new Uint8Array(tris.length);
  for (let semente = 0; semente < tris.length; semente++) {
    if (visto[semente]) continue;
    visto[semente] = 1;
    const fila = [semente];
    while (fila.length) {
      const f = fila.pop();
      const minhas = direcoes(tris[f]);
      for (const [a, b] of minhas) {
        for (const g of facesDaAresta.get(chave(a, b))) {
          if (g === f || visto[g]) continue;
          // consistente = a face vizinha percorre a aresta ao contrário (b → a)
          const suas = direcoes(tris[g]);
          const igual = suas.some(([c, d]) => c === a && d === b);
          if (igual) tris[g] = [tris[g][0], tris[g][2], tris[g][1]];
          visto[g] = 1;
          fila.push(g);
        }
      }
    }
  }
  // sinal global: a frente aponta para +z
  let z = 0;
  for (const t of tris) {
    if (malha.grupos[t[0]] !== "frente") continue;
    const A = pos[t[0]], B = pos[t[1]], C = pos[t[2]];
    const u = sub(B, A), v = sub(C, A);
    z += u[0] * v[1] - u[1] * v[0];
  }
  if (z < 0) for (let f = 0; f < tris.length; f++) tris[f] = [tris[f][0], tris[f][2], tris[f][1]];
}

// ── Áreas imprimíveis (spec) ─────────────────────────────────

/**
 * As áreas `front` e `back` da spec camiseta-basica-3d.json: um retângulo
 * de larguraImprimivel × alturaImprimivel centrado em x, começando
 * folgaDaGola abaixo da linha da gola de cada painel, em UV pela mesma
 * projeção planar dos painéis. `cm` por unidade de UV é o mesmo em u e em
 * v — daí width_cm/height_cm baterem com o retângulo em pixels.
 */
function areasDaSpec(P = PARAMETROS) {
  const cm = P.cmPorUv;
  const arred = (x) => Math.round(x * 10000) / 10000;
  const area = (id, centroU, golaY) => {
    const topo = golaY - P.folgaDaGola, base = topo - P.alturaImprimivel;
    return {
      id, width_cm: P.larguraImprimivel, height_cm: P.alturaImprimivel,
      uv: {
        u0: arred(centroU - P.larguraImprimivel / 2 / cm), v0: arred(P.vBaseDosPaineis + base / cm),
        u1: arred(centroU + P.larguraImprimivel / 2 / cm), v1: arred(P.vBaseDosPaineis + topo / cm),
      },
    };
  };
  return [
    area("front", 0.25, P.alturaDoCorpo - P.profundidadeDaGolaFrente),
    area("back", 0.75, P.alturaDoCorpo - P.profundidadeDaGolaCostas),
  ];
}

// ── Refino e GLB ─────────────────────────────────────────────

const CM_PARA_METRO = 0.01;

/**
 * Da malha-base em cm ao GLB: converte para metros, centra na origem,
 * solda, aplica o Loop, normais suaves, dobras (com o peso de
 * refinarMalha.js, mais uma faixa lisa junto da barra e das bocas para a
 * barra continuar reta) e a oclusão nas axilas e sob a gola.
 */
function refinarCamiseta(base, P = PARAMETROS, opcoes = {}) {
  const passadas = opcoes.passadas != null ? opcoes.passadas : P.passadasDeLoop;
  const caixaCm = minmax(base.pos);
  const centro = caixaCm.min.map((m, c) => (m + caixaCm.max[c]) / 2);
  const pos = base.pos.map((p) => escala(sub(p, centro), CM_PARA_METRO));
  let malha = { pos, uv: base.uv.map((q) => q.slice()), tris: base.tris.map((t) => t.slice()), ids: soldar(pos) };
  for (let i = 0; i < passadas; i++) malha = subdividirLoop(malha);
  let nrm = normaisSuaves(malha.pos, malha.tris, malha.ids);
  const D = P.dobras;
  if (!opcoes.semDobras && D.amplitude > 0) {
    const larguraDoCorpo = P.meiaLarguraDoPeito * CM_PARA_METRO;
    const yBarra = (0 - centro[1]) * CM_PARA_METRO;
    const liso = D.faixaLisaDaBarra * CM_PARA_METRO;
    const axilaY = (P.alturaDaCava - centro[1]) * CM_PARA_METRO;
    const peso = (p, caixa) => {
      let w = pesoDasDobras(p, caixa, larguraDoCorpo);
      // barra reta: nada de dobra nos primeiros centímetros
      w *= suave((p[1] - yBarra) / liso);
      // boca da manga: a manga cai da axila para fora; a faixa lisa é
      // medida pela distância ao centro ao longo do eixo (aproximada por |x|)
      if (Math.abs(p[0]) > larguraDoCorpo) {
        const alcance = (P.comprimentoDaManga + P.meiaLarguraDoOmbro - P.meiaLarguraDoPeito) * CM_PARA_METRO;
        w *= suave((larguraDoCorpo + alcance - Math.abs(p[0])) / liso);
      }
      // manga: o peso padrão (0,9) enruga demais um tubo curto; dois terços
      if (Math.abs(p[0]) > larguraDoCorpo) w *= 0.65;
      // gola e ombros: a região acima da axila já é quase parada no peso
      // padrão; aqui só garante zero na ribana
      if (p[1] > axilaY + (P.alturaDoCorpo - P.alturaDaCava - 5) * CM_PARA_METRO) w = 0;
      return w;
    };
    malha = aplicarDobras(malha, nrm, {
      amplitude: D.amplitude * CM_PARA_METRO, comprimento: D.comprimento * CM_PARA_METRO,
      semente: D.semente, margemDaBorda: D.margemDaBorda * CM_PARA_METRO, larguraDoCorpo, peso,
    });
    nrm = normaisSuaves(malha.pos, malha.tris, malha.ids);
  }
  const O = P.oclusao;
  const cor = opcoes.semOclusao ? null : oclusaoPorVertice(malha, {
    axilas: base.medidas.axilas.map((a) => escala(sub(a, centro), CM_PARA_METRO)),
    raioAxila: O.raioAxila * CM_PARA_METRO, forcaAxila: O.forcaAxila,
    raioGola: O.raioGola * CM_PARA_METRO, forcaGola: O.forcaGola,
  });
  return { ...malha, nrm, cor };
}

/** O JSON do glTF que embrulha a malha: uma cena, um nó, um material de algodão. */
function esqueletoDoGlb() {
  return {
    asset: { version: "2.0", generator: "Aura Studio · scripts/studio/gerar-camiseta-glb.mjs", extras: { origem: "modelo original da Aura, gerado por scripts/studio/gerar-camiseta-glb.mjs; nenhum asset de terceiros" } },
    scene: 0,
    scenes: [{ name: "Camiseta", nodes: [0] }],
    nodes: [{ name: "T-Shirt", mesh: 0 }],
    materials: [{ name: "Algodao", doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.93, 0.92, 0.89, 1], metallicFactor: 0, roughnessFactor: 0.9 } }],
    meshes: [{ name: "T-Shirt", primitives: [{ attributes: {}, indices: 0, material: 0 }] }],
  };
}

/** A camiseta inteira, pronta: malha-base, malha refinada e o GLB em bytes. */
function gerarCamisetaGlb(P = PARAMETROS, opcoes = {}) {
  const params = { ...P, _ilhas: ilhasDeUv(P) };
  const base = construirCamiseta(params);
  const refinada = refinarCamiseta(base, params, opcoes);
  const nota = "gerado por scripts/studio/gerar-camiseta-glb.mjs (Loop x" + (opcoes.passadas != null ? opcoes.passadas : P.passadasDeLoop) +
    ", normais suaves" + (opcoes.semDobras ? "" : ", dobras semente " + P.dobras.semente) + (opcoes.semOclusao ? "" : ", oclusão por vértice") + ")";
  const glb = escreverGlb(esqueletoDoGlb(), refinada, nota);
  return { base, refinada, glb, nota };
}

module.exports = {
  PARAMETROS, spline, catmullRom2D, reamostrar, linhasDoCorpo, ilhasDeUv, construirCamiseta,
  orientarFaces, areasDaSpec, refinarCamiseta, esqueletoDoGlb, gerarCamisetaGlb, estatisticasDeArestas,
};
