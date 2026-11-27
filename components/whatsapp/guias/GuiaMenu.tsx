// ============================================================
// GuiaMenu — "Por onde começar" (artboard GuiaCentral)
//
// Abre a partir do botão "Guias" (alvo wa.guias) com o resto da tela
// escurecido. "Comece aqui" marca o próximo guia que falta (sem número
// conectado é o 1; conectado, o 2). Guia feito ganha o ✓ e "visto ontem".
// Esc e toque fora fecham e devolvem o foco ao botão.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findTourTarget } from "@/components/onboarding/SpotlightTour";
import { tourSelector } from "@/utils/tourTarget";
import { proximoGuia, rotuloVisto, type Vistos } from "@/utils/waGuiasVistos";
import { MENU_GUIAS } from "./guiasConteudo";
import { G, WEB, Z, useGuiaCss, type Retangulo } from "./guiaVisual";

interface Props {
  conectado: boolean;
  vistos: Vistos;
  hubVisible: boolean;
  celular: boolean;
  onEscolher: (n: 1 | 2 | 3) => void;
  onFechar: () => void;
}

/** Devolve o foco ao botão Guias (alvo wa.guias). */
export function devolveFocoAoBotao(): void {
  if (typeof document === "undefined") return;
  setTimeout(() => {
    try { (findTourTarget([tourSelector("wa.guias")]) as HTMLElement | null)?.focus?.({ preventScroll: true } as any); } catch { /* ok */ }
  }, 0);
}

export function GuiaMenu({ conectado, vistos, hubVisible, celular, onEscolher, onFechar }: Props) {
  useGuiaCss();
  const [rect, setRect] = useState<Retangulo | null>(null);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  const caixa = useRef<HTMLDivElement | null>(null);

  const disponiveis = MENU_GUIAS.filter((g) => g.n !== 3 || hubVisible);
  const comeceAqui = proximoGuia(conectado, vistos, disponiveis.map((g) => g.n));

  useEffect(() => {
    if (!WEB || typeof window === "undefined") return;
    const mede = () => {
      setVw(window.innerWidth);
      const el = findTourTarget([tourSelector("wa.guias")]);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    mede();
    const id = setInterval(mede, 300);
    window.addEventListener("resize", mede);
    window.addEventListener("scroll", mede, true);
    return () => { clearInterval(id); window.removeEventListener("resize", mede); window.removeEventListener("scroll", mede, true); };
  }, []);

  // Esc fecha; o foco entra no menu (no "comece aqui", ou no primeiro guia).
  useEffect(() => {
    if (!WEB || typeof window === "undefined") return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onFechar(); devolveFocoAoBotao(); }
      if (e.key === "Tab" && caixa.current) {
        const itens = Array.from(caixa.current.querySelectorAll<HTMLElement>("button"));
        if (!itens.length) return;
        const atual = itens.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        const prox = e.shiftKey ? (atual <= 0 ? itens.length - 1 : atual - 1) : (atual + 1) % itens.length;
        itens[prox].focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onFechar]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const alvo = caixa.current?.querySelector<HTMLElement>("[data-comece='1']") || caixa.current?.querySelector<HTMLElement>("button");
        alvo?.focus({ preventScroll: true } as any);
      } catch { /* ok */ }
    }, 60);
    return () => clearTimeout(t);
  }, []);

  if (!WEB || typeof document === "undefined") return null;

  const estreito = vw <= 600;
  const topo = rect ? Math.round(rect.y + rect.h + 14) : 96;
  const direita = rect && !estreito ? Math.max(16, Math.round(vw - (rect.x + rect.w))) : 16;

  const conteudo = (
    <div className="wag-root" data-testid="wa-guia-menu" style={{ position: "fixed", inset: 0, zIndex: Z.guia, pointerEvents: "none" } as any}>
      <div
        data-testid="wa-guia-menu-fundo"
        onClick={() => { onFechar(); devolveFocoAoBotao(); }}
        style={{ position: "fixed", inset: 0, pointerEvents: "auto", background: rect ? "transparent" : G.dimMenu }}
      />
      {rect && (
        <div
          className="wag-furo"
          style={{
            left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 999, background: "rgba(167,139,250,.2)",
            boxShadow: `0 0 0 9999px ${G.dimMenu}, 0 0 0 2px #c4b5fd, 0 0 24px 4px rgba(167,139,250,.5)`,
          }}
        />
      )}
      <div
        ref={caixa}
        id="guias-menu"
        className="wag-pop"
        role="dialog"
        aria-labelledby="wag-menu-titulo"
        style={{ top: topo, right: direita, left: estreito ? 16 : undefined, width: estreito ? undefined : 440, maxHeight: "calc(100vh - " + (topo + 16) + "px)", overflowY: "auto", pointerEvents: "auto" }}
      >
        <div style={{ padding: "4px 6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="wag-meta acc">Guias do WhatsApp</span>
          <b id="wag-menu-titulo" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em" }}>Por onde começar<span style={{ color: G.acc2 }}>.</span></b>
          <span style={{ fontSize: 14, color: G.ink2 }}>Cada guia faz a configuração junto com você, no lugar certo da tela. Dá para voltar aqui quando quiser.</span>
        </div>
        {disponiveis.map((g, k) => {
          const visto = vistos[("g" + g.n) as "g1" | "g2" | "g3"];
          const feito = typeof visto === "number";
          const primeiro = comeceAqui === g.n;
          return (
            <button
              key={g.n} type="button" className={"wag-g" + (primeiro ? " first" : "")} style={{ animationDelay: (0.35 + k * 0.06).toFixed(2) + "s" }}
              data-comece={primeiro ? "1" : undefined} data-testid={`wa-guia-item-${g.n}`}
              onClick={() => onEscolher(g.n)}
            >
              <span className={"wag-n" + (feito ? " done" : "")} aria-hidden="true">{feito ? "✓" : g.n}</span>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                <b style={{ fontSize: 16 }}>{g.titulo}</b>
                <span style={{ fontSize: 13, color: G.ink2 }}>{feito ? `${g.sub(celular)} · ${rotuloVisto(visto as number)}` : g.sub(celular)}</span>
              </span>
              {primeiro && <span style={{ fontSize: 12, fontWeight: 700, color: "#e9e3ff", padding: "4px 10px", borderRadius: 999, background: "rgba(167,139,250,.3)", whiteSpace: "nowrap" }}>comece aqui</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
  return createPortal(conteudo, document.body);
}

export default GuiaMenu;
