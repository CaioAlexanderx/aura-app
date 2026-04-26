import { useEffect, useState, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { DentalColors } from "@/constants/dental-tokens";

// ============================================================
// SpotlightTour — Primitiva de tour guiado com auto-scroll +
// spotlight overlay + tooltip ancorado.
//
// Resolve o problema relatado pelo cliente em 2026-04-26: tours
// com banner livre frequentemente ficavam fora do viewport. Esta
// primitiva garante que o elemento alvo SEMPRE esta visivel antes
// de mostrar o spotlight.
//
// FLUXO POR STEP:
//   1. Encontrar elemento via querySelector(targetSelector)
//   2. element.scrollIntoView({behavior:'smooth', block:'center'})
//   3. Esperar 400ms pra animacao terminar
//   4. Medir bounding rect via getBoundingClientRect()
//   5. Renderizar overlay SVG com mask que cria "buraco" no rect
//   6. Renderizar tooltip ancorado (auto-position por viewport)
//
// STEPS SEM targetSelector renderizam modal centralizado (welcome,
// conclusao, mensagens sem alvo).
//
// Web only — depende de DOM API. Em native, este componente
// retorna null. UX mobile do tour fica pra iteracao futura.
// ============================================================

export interface TourStep {
  id: string;
  targetSelector?: string;  // se omitir, modal central
  title: string;
  body: string;
  cta?: string;             // texto do botao avancar (default 'Próximo' / 'Último')
  position?: "top" | "bottom" | "left" | "right" | "auto";
}

interface SpotlightTourProps {
  steps: TourStep[];
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface Rect { x: number; y: number; w: number; h: number; }

const PADDING = 8;       // padding ao redor do alvo no spotlight
const TOOLTIP_W = 320;
const TOOLTIP_GAP = 14;  // espaco entre alvo e tooltip
const SCROLL_WAIT_MS = 400;

function useEscape(open: boolean, onEsc: () => void) {
  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof window === "undefined") return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onEsc(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onEsc]);
}

// Decide melhor posicao pro tooltip baseado em viewport disponivel.
function pickPosition(
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

export function SpotlightTour({ steps, open, onComplete, onSkip }: SpotlightTourProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
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

  // Mede tooltip apos render pra posicionamento mais preciso.
  useEffect(() => {
    if (tooltipRef.current) {
      const h = tooltipRef.current.getBoundingClientRect().height;
      if (h && Math.abs(h - tooltipH) > 4) setTooltipH(h);
    }
  }, [step?.id, tooltipH]);

  // Auto-scroll + medir rect quando step muda.
  useEffect(() => {
    if (!open || !step || Platform.OS !== "web" || typeof document === "undefined") {
      setRect(null);
      return;
    }
    if (!step.targetSelector) {
      // Modal central: sem rect.
      setRect(null);
      return;
    }

    const target = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!target) {
      // Alvo nao encontrado: degrada pra modal central.
      setRect(null);
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    // Esperar scroll terminar antes de medir.
    const t = setTimeout(() => {
      const r = target.getBoundingClientRect();
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    }, SCROLL_WAIT_MS);

    return () => clearTimeout(t);
  }, [open, step]);

  const next = useCallback(() => {
    if (isLast) onComplete();
    else setIndex((i) => i + 1);
  }, [isLast, onComplete]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  useEscape(open, onSkip);

  if (!open || !step || Platform.OS !== "web") return null;

  const position = rect ? pickPosition(step.position, rect, vw, vh, tooltipH) : "center";
  const isCentered = !rect;

  // Coordenadas do tooltip
  let tooltipStyle: any = {
    position: "fixed",
    width: TOOLTIP_W,
    maxWidth: "calc(100vw - 32px)",
    background: DentalColors.bg2,
    border: "1px solid " + DentalColors.border,
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
    color: DentalColors.ink,
    zIndex: 10001,
  };

  if (isCentered) {
    tooltipStyle = { ...tooltipStyle, left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  } else if (rect) {
    if (position === "right") {
      tooltipStyle = { ...tooltipStyle, left: rect.x + rect.w + TOOLTIP_GAP, top: Math.max(16, Math.min(vh - tooltipH - 16, rect.y + rect.h / 2 - tooltipH / 2)) };
    } else if (position === "left") {
      tooltipStyle = { ...tooltipStyle, left: Math.max(16, rect.x - TOOLTIP_GAP - TOOLTIP_W), top: Math.max(16, Math.min(vh - tooltipH - 16, rect.y + rect.h / 2 - tooltipH / 2)) };
    } else if (position === "bottom") {
      tooltipStyle = { ...tooltipStyle, top: rect.y + rect.h + TOOLTIP_GAP, left: Math.max(16, Math.min(vw - TOOLTIP_W - 16, rect.x + rect.w / 2 - TOOLTIP_W / 2)) };
    } else { // top
      tooltipStyle = { ...tooltipStyle, top: Math.max(16, rect.y - TOOLTIP_GAP - tooltipH), left: Math.max(16, Math.min(vw - TOOLTIP_W - 16, rect.x + rect.w / 2 - TOOLTIP_W / 2)) };
    }
  }

  // SVG spotlight overlay com mask
  // Renderizado quando ha rect. Modal central (sem rect) usa overlay simples.
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, pointerEvents: "none" } as any}>
      {rect ? (
        <svg
          style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "auto" } as any}
          onClick={onSkip}
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
          {/* Borda cyan ao redor do alvo */}
          <rect
            x={rect.x - PADDING}
            y={rect.y - PADDING}
            width={rect.w + PADDING * 2}
            height={rect.h + PADDING * 2}
            rx={10}
            ry={10}
            fill="none"
            stroke={DentalColors.cyan}
            strokeWidth={2}
            opacity={0.8}
            style={{ pointerEvents: "none" } as any}
          />
        </svg>
      ) : (
        // Modal central: overlay solido simples, clicavel pra skip.
        <div
          onClick={onSkip}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", pointerEvents: "auto" } as any}
        />
      )}

      {/* Tooltip / modal */}
      <div
        ref={tooltipRef}
        onClick={(e: any) => e.stopPropagation()}
        style={{ ...tooltipStyle, pointerEvents: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 } as any}>
          <div style={{
            fontSize: 9, color: DentalColors.cyan, fontWeight: 700,
            letterSpacing: 1.4, textTransform: "uppercase",
            fontFamily: "JetBrains Mono, monospace",
          } as any}>
            Passo {index + 1} de {steps.length}
          </div>
          <button
            onClick={onSkip}
            style={{
              background: "transparent", border: "none",
              color: DentalColors.ink3, cursor: "pointer",
              fontSize: 11, padding: 0,
            } as any}
          >Pular tour</button>
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: -0.3 } as any}>
          {step.title}
        </div>
        <div style={{ fontSize: 13, color: DentalColors.ink2, lineHeight: 1.5, marginBottom: 16 } as any}>
          {step.body}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 } as any}>
          {index > 0 && (
            <button
              onClick={prev}
              style={{
                background: "transparent", border: "1px solid " + DentalColors.border,
                color: DentalColors.ink2, padding: "8px 14px", borderRadius: 8,
                fontSize: 12, cursor: "pointer", fontWeight: 500,
              } as any}
            >Anterior</button>
          )}
          <button
            onClick={next}
            style={{
              background: DentalColors.cyan, border: "none",
              color: "#fff", padding: "8px 16px", borderRadius: 8,
              fontSize: 12, cursor: "pointer", fontWeight: 700,
            } as any}
          >{step.cta || (isLast ? "Concluir" : "Próximo")}</button>
        </div>
      </div>
    </div>
  );
}

export default SpotlightTour;
