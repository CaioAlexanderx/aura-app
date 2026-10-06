import { useEffect, useState, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { WebPortal } from "@/components/WebPortal";
import { Colors } from "@/constants/colors";

// ============================================================
// SpotlightTour — primitiva de tour guiado com auto-scroll +
// spotlight overlay + tooltip ancorado. ÚNICO mecanismo de tour do app
// (CLAUDE.md item 6: nada de banner livre flutuante).
//
// Nasceu no Odonto (components/dental/onboarding/SpotlightTour.tsx, que
// agora só aplica a paleta dental sobre este). Generalizado em 05/10/2026
// para os primeiros passos por frente, sem mudar o comportamento padrão:
//   · palette / labels       — cores e textos por shell (Aura, Studio, Odonto)
//   · targetSelectors        — lista em ordem de preferência; vale o primeiro
//                              que existir E estiver visível (ex.: o botão do
//                              cabeçalho no desktop, o flutuante no celular,
//                              e o título da tela como último recurso)
//   · waitForTargetMs        — a tela alvo pode estar montando/carregando:
//                              procura de novo por até N ms antes de cair no
//                              tooltip central (padrão 0 = comportamento antigo)
//   · clickThrough           — tocar no buraco do spotlight fecha o tour e
//                              aciona o próprio alvo (padrão: fecha, como antes)
//   · portal                 — renderiza no document.body (escapa de shell com
//                              z-index/transform; ver WebPortal)
//
// FLUXO POR STEP:
//   1. Encontrar elemento via querySelector (com espera opcional)
//   2. element.scrollIntoView({behavior:'smooth', block:'center'})
//   3. Esperar 400ms pra animação terminar
//   4. Medir bounding rect via getBoundingClientRect()
//   5. Renderizar overlay SVG com mask que cria "buraco" no rect
//   6. Renderizar tooltip ancorado (auto-position por viewport)
//
// Steps sem alvo (ou alvo não encontrado) renderizam modal centralizado.
// Web only — em native retorna null.
// ============================================================

export interface TourStep {
  id: string;
  targetSelector?: string;      // se omitir (e sem targetSelectors), modal central
  targetSelectors?: string[];   // ordem de preferência; ganha de targetSelector
  title: string;
  body: string;
  cta?: string;                 // texto do botão avançar (default labels.next / labels.done)
  position?: "top" | "bottom" | "left" | "right" | "auto";
}

export type SpotlightPalette = {
  surface: string;   // fundo do tooltip
  border: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;    // contador, borda do spotlight e botão principal
  accentInk?: string; // texto do botão principal (default #fff)
};

export type SpotlightLabels = {
  skip: string;
  prev: string;
  next: string;
  done: string;
};

// Paleta padrão: Aura (violeta). O Odonto passa a dele.
export const AURA_SPOTLIGHT_PALETTE: SpotlightPalette = {
  surface: Colors.bg2,
  border: Colors.border2,
  ink: Colors.ink,
  ink2: Colors.ink2,
  ink3: Colors.ink3,
  accent: Colors.violet,
  accentInk: "#fff",
};

const DEFAULT_LABELS: SpotlightLabels = { skip: "Pular tour", prev: "Anterior", next: "Próximo", done: "Concluir" };

interface SpotlightTourProps {
  steps: TourStep[];
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
  palette?: SpotlightPalette;
  labels?: Partial<SpotlightLabels>;
  showCounter?: boolean;
  waitForTargetMs?: number;
  clickThrough?: boolean;
  portal?: boolean;
}

interface Rect { x: number; y: number; w: number; h: number; }

const PADDING = 8;       // padding ao redor do alvo no spotlight
const TOOLTIP_W = 320;
const TOOLTIP_GAP = 14;  // espaço entre alvo e tooltip
const SCROLL_WAIT_MS = 400;
const POLL_MS = 150;

function useEscape(open: boolean, onEsc: () => void) {
  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof window === "undefined") return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onEsc(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onEsc]);
}

// Decide melhor posição pro tooltip baseado em viewport disponível.
export function pickPosition(
  preferred: TourStep["position"],
  rect: Rect,
  vw: number,
  vh: number,
  tooltipH: number,
): "top" | "bottom" | "left" | "right" {
  const fits = {
    bottom: rect.y + rect.h + TOOLTIP_GAP + tooltipH < vh,
    top:    rect.y - TOOLTIP_GAP - tooltipH > 0,
    right:  rect.x + rect.w + TOOLTIP_GAP + TOOLTIP_W < vw,
    left:   rect.x - TOOLTIP_GAP - TOOLTIP_W > 0,
  };
  if (preferred && preferred !== "auto" && fits[preferred]) return preferred;
  if (fits.right)  return "right";
  if (fits.bottom) return "bottom";
  if (fits.top)    return "top";
  if (fits.left)   return "left";
  return "bottom"; // fallback teimoso
}

function selectorsOf(step: TourStep | undefined): string[] {
  if (!step) return [];
  if (step.targetSelectors && step.targetSelectors.length) return step.targetSelectors;
  return step.targetSelector ? [step.targetSelector] : [];
}

// Primeiro seletor com elemento VISÍVEL (largura/altura > 0). Um botão que
// existe no DOM mas está escondido no celular não serve de alvo.
export function findTourTarget(selectors: string[]): HTMLElement | null {
  if (typeof document === "undefined") return null;
  for (const sel of selectors) {
    let nodes: NodeListOf<Element>;
    try { nodes = document.querySelectorAll(sel); } catch { continue; }
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as HTMLElement;
      const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (r && r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

export function SpotlightTour({
  steps, open, onComplete, onSkip,
  palette = AURA_SPOTLIGHT_PALETTE,
  labels: labelsIn,
  showCounter = true,
  waitForTargetMs = 0,
  clickThrough = false,
  portal = false,
}: SpotlightTourProps) {
  const labels = { ...DEFAULT_LABELS, ...(labelsIn || {}) };
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // Enquanto procura o alvo, não mostra nada (evita o tooltip central piscar
  // antes de pular pro alvo).
  const [searching, setSearching] = useState(false);
  const targetRef = useRef<HTMLElement | null>(null);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 768);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipH, setTooltipH] = useState(180);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Reset index quando o tour reabre.
  useEffect(() => { if (open) setIndex(0); }, [open]);

  // Atualiza viewport em resize.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const h = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // Mede tooltip após render pra posicionamento mais preciso.
  useEffect(() => {
    if (tooltipRef.current) {
      const h = tooltipRef.current.getBoundingClientRect().height;
      if (h && Math.abs(h - tooltipH) > 4) setTooltipH(h);
    }
  }, [step?.id, tooltipH, rect]);

  // Procura o alvo (com espera), auto-scroll e mede.
  useEffect(() => {
    targetRef.current = null;
    if (!open || !step || Platform.OS !== "web" || typeof document === "undefined") {
      setRect(null); setSearching(false);
      return;
    }
    const selectors = selectorsOf(step);
    if (!selectors.length) { setRect(null); setSearching(false); return; }

    let cancelled = false;
    let measureT: any = null;
    let pollT: any = null;
    const started = Date.now();
    setRect(null);
    setSearching(waitForTargetMs > 0);

    const attempt = () => {
      if (cancelled) return;
      const target = findTourTarget(selectors);
      if (!target) {
        if (Date.now() - started < waitForTargetMs) { pollT = setTimeout(attempt, POLL_MS); return; }
        // Alvo não encontrado: degrada pra modal central.
        setRect(null); setSearching(false);
        return;
      }
      targetRef.current = target;
      try { target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }); } catch {}
      measureT = setTimeout(() => {
        if (cancelled) return;
        const r = target.getBoundingClientRect();
        setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
        setSearching(false);
      }, SCROLL_WAIT_MS);
    };
    attempt();

    return () => { cancelled = true; clearTimeout(measureT); clearTimeout(pollT); };
  }, [open, step, waitForTargetMs]);

  const next = useCallback(() => {
    if (isLast) onComplete();
    else setIndex((i) => i + 1);
  }, [isLast, onComplete]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  useEscape(open, onSkip);

  if (!open || !step || Platform.OS !== "web" || searching) return null;

  const position = rect ? pickPosition(step.position, rect, vw, vh, tooltipH) : "center";
  const isCentered = !rect;

  // Toque no overlay: dentro do buraco (e clickThrough) aciona o alvo;
  // fora, pula o tour.
  const onOverlayClick = (e: any) => {
    if (clickThrough && rect && targetRef.current) {
      const x = e?.clientX, y = e?.clientY;
      const inside = typeof x === "number" && typeof y === "number"
        && x >= rect.x - PADDING && x <= rect.x + rect.w + PADDING
        && y >= rect.y - PADDING && y <= rect.y + rect.h + PADDING;
      if (inside) {
        const el = targetRef.current;
        onComplete();
        try { el.click(); } catch {}
        return;
      }
    }
    onSkip();
  };

  // Coordenadas do tooltip
  let tooltipStyle: any = {
    position: "fixed",
    width: TOOLTIP_W,
    maxWidth: "calc(100vw - 32px)",
    background: palette.surface,
    border: "1px solid " + palette.border,
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
    color: palette.ink,
    zIndex: 10001,
    boxSizing: "border-box",
  };

  if (isCentered) {
    tooltipStyle = { ...tooltipStyle, left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  } else if (rect) {
    const w = Math.min(TOOLTIP_W, vw - 32);
    if (position === "right") {
      tooltipStyle = { ...tooltipStyle, left: rect.x + rect.w + TOOLTIP_GAP, top: Math.max(16, Math.min(vh - tooltipH - 16, rect.y + rect.h / 2 - tooltipH / 2)) };
    } else if (position === "left") {
      tooltipStyle = { ...tooltipStyle, left: Math.max(16, rect.x - TOOLTIP_GAP - TOOLTIP_W), top: Math.max(16, Math.min(vh - tooltipH - 16, rect.y + rect.h / 2 - tooltipH / 2)) };
    } else if (position === "bottom") {
      tooltipStyle = { ...tooltipStyle, top: rect.y + rect.h + TOOLTIP_GAP, left: Math.max(16, Math.min(vw - w - 16, rect.x + rect.w / 2 - w / 2)) };
    } else { // top
      tooltipStyle = { ...tooltipStyle, top: Math.max(16, rect.y - TOOLTIP_GAP - tooltipH), left: Math.max(16, Math.min(vw - w - 16, rect.x + rect.w / 2 - w / 2)) };
    }
  }

  const accentInk = palette.accentInk || "#fff";

  const content = (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, pointerEvents: "none" } as any} data-testid="spotlight-tour">
      {rect ? (
        <svg
          style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "auto" } as any}
          onClick={onOverlayClick}
        >
          <defs>
            <mask id={`spot-mask-${step.id}`}>
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.x - PADDING}
                y={rect.y - PADDING}
                width={rect.w + PADDING * 2}
                height={rect.h + PADDING * 2}
                rx={10}
                ry={10}
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask={`url(#spot-mask-${step.id})`} />
          {/* Borda ao redor do alvo */}
          <rect
            x={rect.x - PADDING}
            y={rect.y - PADDING}
            width={rect.w + PADDING * 2}
            height={rect.h + PADDING * 2}
            rx={10}
            ry={10}
            fill="none"
            stroke={palette.accent}
            strokeWidth={2}
            opacity={0.85}
            style={{ pointerEvents: "none" } as any}
          />
        </svg>
      ) : (
        // Modal central: overlay sólido simples, clicável pra skip.
        <div
          onClick={onSkip}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", pointerEvents: "auto" } as any}
        />
      )}

      {/* Tooltip / modal */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-label={step.title}
        onClick={(e: any) => e.stopPropagation()}
        style={{ ...tooltipStyle, pointerEvents: "auto" }}
      >
        {(showCounter || steps.length > 1) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 } as any}>
            <div style={{
              fontSize: 9, color: palette.accent, fontWeight: 700,
              letterSpacing: 1.4, textTransform: "uppercase",
              fontFamily: "JetBrains Mono, monospace",
            } as any}>
              Passo {index + 1} de {steps.length}
            </div>
            <button
              onClick={onSkip}
              style={{
                background: "transparent", border: "none",
                color: palette.ink3, cursor: "pointer",
                fontSize: 11, padding: 0,
              } as any}
            >{labels.skip}</button>
          </div>
        )}

        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: -0.3 } as any}>
          {step.title}
        </div>
        <div style={{ fontSize: 13, color: palette.ink2, lineHeight: 1.5, marginBottom: 16 } as any}>
          {step.body}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 } as any}>
          {index > 0 && (
            <button
              onClick={prev}
              style={{
                background: "transparent", border: "1px solid " + palette.border,
                color: palette.ink2, padding: "8px 14px", borderRadius: 8,
                fontSize: 12, cursor: "pointer", fontWeight: 500,
              } as any}
            >{labels.prev}</button>
          )}
          <button
            onClick={next}
            data-testid="spotlight-tour-next"
            style={{
              background: palette.accent, border: "none",
              color: accentInk, padding: "8px 16px", borderRadius: 8,
              fontSize: 12, cursor: "pointer", fontWeight: 700,
            } as any}
          >{step.cta || (isLast ? labels.done : labels.next)}</button>
        </div>
      </div>
    </div>
  );

  return portal ? <WebPortal active>{content}</WebPortal> : content;
}

export default SpotlightTour;
