// ============================================================
// Canvas do palco da porta de entrada (tq-67) — só web.
//
// Porte do mockup "Porta de entrada v4": espiral de Arquimedes
// branco-metálica a partir do centro, com um reflexo que gira devagar,
// e ondas (anéis) que saem do orbe e se dispersam.
//
// Orçamento de desempenho:
//   - `animated: false` desenha a espiral UMA vez (sem giro, sem anéis,
//     sem onda) e só redesenha quando a tela muda de tamanho;
//   - `pause()`/`resume()` param e retomam o requestAnimationFrame (aba
//     oculta, janela fora de foco) — parado não gasta quadro nenhum.
// Sem contexto 2D (jsdom, navegador sem canvas) tudo vira no-op.
// ============================================================

type Ponto = { x: number; y: number };
type Anel = { x: number; y: number; r: number; a: number; v: number; w: number; k: number; ph: number; lw: number };

export type StageCanvas = {
  emit: (strength: number, opts?: Partial<Anel>) => void;
  pause: () => void;
  resume: () => void;
  fit: () => void;
  stop: () => void;
};

const NOOP: StageCanvas = { emit() {}, pause() {}, resume() {}, fit() {}, stop() {} };
const TAU = 6.283;
const nowMs = () => (typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now());

export function startStageCanvas(
  cv: HTMLCanvasElement,
  host: HTMLElement,
  opts: { animated: boolean; orbCenter: () => Ponto | null },
): StageCanvas {
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = cv.getContext("2d"); } catch { ctx = null; }
  if (!ctx) return NOOP;
  const c = ctx;
  const animated = opts.animated;

  let rings: Anel[] = [];
  let energy = 0;
  let last = 0;
  let idleT = 0;
  let raf = 0;
  let running = false;
  let stopped = false;
  const dpr = Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, 2);

  function fit() {
    const r = host.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    cv.style.width = r.width + "px";
    cv.style.height = r.height + "px";
    // Um quadro na hora: no estático é o único; no animado cobre a tela
    // enquanto o loop está pausado (aba aberta em segundo plano).
    drawFrame(animated ? nowMs() : 0, 0);
  }

  // Brilho que corre pela espiral: alfa extra por ângulo, em dois lóbulos
  // (um forte, um fraco no lado oposto), com borda suave.
  function brilho(ang: number, a: number): number {
    const d = Math.abs((((ang - a) % TAU) + TAU + Math.PI) % TAU - Math.PI); // distância angular 0..π
    const d2 = Math.abs((((ang - a - Math.PI) % TAU) + TAU + Math.PI) % TAU - Math.PI);
    const l1 = Math.max(0, 1 - d / 0.38), l2 = Math.max(0, 1 - d2 / 0.38);
    return l1 * l1 * 0.16 + l2 * l2 * 0.08;
  }

  // Traça uma volta da espiral por segmentos angulares. Cada segmento tem a
  // sua cor sólida (prata com o alfa da distância ao centro mais o brilho):
  // sem gradiente, sem composite. O reflexo com `globalCompositeOperation:
  // "lighter"` sobre um conic-gradient (versão anterior) saía como um setor
  // branco opaco em parte dos Chromes no Windows (print do Caio, 22/10).
  function traco(cx: number, cy: number, b: number, off: number, rot: number, maxR: number, lw: number, base: number, ganho: number, a: number) {
    const passo = 0.08, porSeg = 10; // 10 passos (~0,8 rad) por segmento
    let t = 0, x0 = cx + Math.cos(rot) * off, y0 = cy + Math.sin(rot) * off;
    for (;;) {
      const rIni = b * t + off; if (rIni > maxR) break;
      c.beginPath(); c.moveTo(x0, y0);
      let i = 0;
      for (; i < porSeg; i++) {
        t += passo; const rr = b * t + off; if (rr > maxR) break;
        x0 = cx + Math.cos(t + rot) * rr; y0 = cy + Math.sin(t + rot) * rr;
        c.lineTo(x0, y0);
      }
      const rMed = Math.min(maxR, rIni + b * passo * porSeg * 0.5);
      // alfa radial: nasce atrás do cartão (0), sobe perto, cai nas bordas
      const u = rMed / maxR;
      const radial = u < 0.18 ? (u / 0.18) * 0.9 : u < 0.55 ? 1 - ((u - 0.18) / 0.37) * 0.3 : Math.max(0, 1 - (u - 0.55) / 0.45) * 0.7;
      const alfa = Math.min(0.34, radial * (base + brilho(t + rot, a) * ganho));
      c.strokeStyle = "rgba(230,224,248," + alfa.toFixed(3) + ")"; c.lineWidth = lw; c.stroke();
      if (i < porSeg) break;
    }
  }

  function spiral(now: number, W: number, H: number) {
    // espiral de Arquimedes a partir do centro do palco; prata, opaca o
    // bastante para não brigar com o cartão (0,16 no desktop, 0,10 no celular)
    const cx = W / 2, cy = H * 0.48, mobile = W < 520;
    const maxR = Math.hypot(W, H) * 0.62;
    const b = mobile ? 9 : 13;
    const rot = animated ? now / 60000 : 0;
    const a = animated ? (now / 9000) % TAU : -0.9;
    const base = mobile ? 0.10 : 0.16;
    traco(cx, cy, b, 0, rot, maxR, 1, base, 1, a);
    // segunda volta, deslocada meia-volta e mais fina: leitura de metal escovado
    traco(cx, cy, b, b / 2, rot + 0.6, maxR, 0.6, base * 0.45, 0.45, a);
  }

  function drawFrame(now: number, dt: number) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const W = cv.width / dpr, H = cv.height / dpr;
    spiral(now, W, H);
    if (!animated) return;
    idleT += dt;
    if (idleT > 5.2) { idleT = 0; emit(0.22); }
    energy = Math.max(0, energy - dt * 1.1);
    for (const g of rings) {
      g.r += g.v * dt; g.a -= dt * (0.06 + g.v / 3200); if (g.a <= 0) continue;
      c.beginPath();
      for (let i = 0; i <= 96; i++) {
        const t = i / 96 * Math.PI * 2;
        const rr = g.r + Math.sin(t * g.k + g.ph + now / 900) * g.w * (g.r / 300);
        const x = g.x + Math.cos(t) * rr, y = g.y + Math.sin(t) * rr;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.closePath(); c.strokeStyle = "rgba(214,201,255," + g.a.toFixed(3) + ")"; c.lineWidth = g.lw; c.stroke();
    }
    rings = rings.filter((g) => g.a > 0 && g.r < Math.max(W, H) * 1.2);
    if (W > 900 && energy > 0.02) {
      const o = opts.orbCenter(); const y0 = o ? o.y : H / 2; const ox = o ? o.x : W / 2;
      c.beginPath();
      for (let x = 0; x <= W; x += 4) {
        const d = Math.abs(x - ox); const env = Math.exp(-d / (W * 0.38)); const amp = energy * 34 * env;
        const y = y0 + Math.sin(x / 36 + now / 520) * amp + Math.sin(x / 150 - now / 1400) * amp * 0.4;
        if (x) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.strokeStyle = "rgba(196,181,253," + (energy * 0.14).toFixed(3) + ")"; c.lineWidth = 1; c.stroke();
    }
  }

  function loop(now: number) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    drawFrame(now, dt);
    raf = requestAnimationFrame(loop);
  }

  function emit(strength: number, extra?: Partial<Anel>) {
    if (!animated || stopped) return;
    const o = opts.orbCenter(); if (!o) return;
    rings.push(Object.assign({
      x: o.x, y: o.y, r: 48, a: 0.08 + strength * 0.22, v: 70 + strength * 150, w: 2 + strength * 5,
      k: 5 + Math.round(Math.random() * 2), ph: Math.random() * TAU, lw: 0.8 + strength * 0.7,
    }, extra || {}));
    if (rings.length > 10) rings.shift();
    energy = Math.min(1, energy + strength * 0.6);
  }

  function resume() {
    if (!animated || running || stopped) return;
    running = true; last = 0;
    raf = requestAnimationFrame(loop);
  }

  function pause() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function stop() { pause(); stopped = true; rings = []; }

  fit();
  resume();
  return { emit, pause, resume, fit, stop };
}
