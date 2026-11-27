// ============================================================
// GuiaAnuncio — o anúncio do WhatsApp no Painel (artboard GuiaAnuncio)
//
// Uma vez por pessoa, no Painel, depois que ele termina de carregar: foco no
// item WhatsApp do menu (alvo nav.whatsapp) e um balão com a novidade.
// Só para quem tem o WhatsApp no plano, a permissão de Clientes e a tela
// nova liberada (equipe Aura e empresa sandbox, a mesma trava da tela).
// "Agora não" fecha e não volta; o guia fica no botão "Guias" da tela.
// No celular o foco cai primeiro em "Mais" (nav.mais) e depois no item.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "expo-router";
import { findTourTarget } from "@/components/onboarding/SpotlightTour";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { usePendingTour, normalizarPath } from "@/stores/pendingTour";
import { useWaGuias } from "@/stores/waGuias";
import { empresaSandbox, whatsappOficialLiberadoPara } from "@/utils/whatsappOficialLiberado";
import { tourSelector } from "@/utils/tourTarget";
import { useWaFontes } from "../waVisual";
import { BotaoPrincipal, tocaNaTela } from "./GuiaExec";
import { WEB, Z, posicionaBalao, useGuiaCss, type Retangulo } from "./guiaVisual";

const ATRASO_MS = 1200;
const ESPERA_ALVO_MS = 4000;
const RESPIRO = 6;
const LARGURA = 380;

type Fase = "mais" | "item";

/** Quem vê o anúncio: tela nova liberada, WhatsApp no plano, permissão de Clientes, loja única, fora do demo. */
export function podeVerAnuncio(p: { user: unknown; company: unknown; consolidado: boolean; demo: boolean; modulos: Set<string>; jaVisto: boolean }): boolean {
  if (p.demo || p.consolidado || p.jaVisto) return false;
  if (!whatsappOficialLiberadoPara(p.user, undefined, empresaSandbox(p.company, p.consolidado))) return false;
  return p.modulos.has("whatsapp") && p.modulos.has("clientes");
}

export function GuiaAnuncio() {
  const pathname = usePathname();
  const { user, company, isDemo, consolidatedView } = useAuthStore();
  const modulos = useVisibleModules();
  const pendente = usePendingTour((s) => s.pending);
  const carregar = useWaGuias((s) => s.carregar);
  const vistos = useWaGuias((s) => s.vistos);
  const marcar = useWaGuias((s) => s.marcar);
  const userId = (user as any)?.id as string | undefined;

  useEffect(() => { carregar(userId); }, [carregar, userId]);

  const noPainel = normalizarPath(pathname) === "/";
  const elegivel = WEB && noPainel && !!userId && !pendente
    && podeVerAnuncio({ user, company, consolidado: consolidatedView === true, demo: isDemo === true, modulos, jaVisto: !!vistos.anuncio });

  const [visivel, setVisivel] = useState(false);
  const foco = useRef<HTMLElement | null>(null);
  const abriu = useRef(false);

  const fecha = useCallback(() => {
    setVisivel(false);
    try { foco.current?.focus?.({ preventScroll: true } as any); } catch { /* ok */ }
  }, []);

  // Depois que o Painel carrega: espera um pouco e procura o alvo (item, ou "Mais" no celular).
  useEffect(() => {
    if (!elegivel || abriu.current) return;
    let cancelado = false;
    let t: any = null;
    const limite = Date.now() + ATRASO_MS + ESPERA_ALVO_MS;
    const tenta = () => {
      if (cancelado) return;
      const alvo = findTourTarget([tourSelector("nav.whatsapp")]) || findTourTarget([tourSelector("nav.mais")]);
      if (!alvo) {
        if (Date.now() < limite) { t = setTimeout(tenta, 200); return; }
        return; // sem alvo: não anuncia (e não gasta a vez da pessoa)
      }
      abriu.current = true;
      foco.current = (document.activeElement as HTMLElement) || null;
      setVisivel(true);
      marcar("anuncio");
    };
    t = setTimeout(tenta, ATRASO_MS);
    return () => { cancelado = true; clearTimeout(t); };
  }, [elegivel, marcar]);

  // Sai do Painel: o anúncio some.
  useEffect(() => { if (visivel && !noPainel) setVisivel(false); }, [visivel, noPainel]);

  if (!visivel) return null;
  return <AnuncioBalao onFechar={fecha} />;
}

function AnuncioBalao({ onFechar }: { onFechar: () => void }) {
  const router = useRouter();
  const abrirMenu = useWaGuias((s) => s.abrirMenu);
  useGuiaCss();
  useWaFontes();
  const [fase, setFase] = useState<Fase>("item");
  const [rect, setRect] = useState<Retangulo | null>(null);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  const [alturaBalao, setAlturaBalao] = useState(220);
  const balaoRef = useRef<HTMLDivElement | null>(null);

  // Acompanha o alvo e, no celular, passa de "Mais" para o item quando o menu abre.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mede = () => {
      setVw(window.innerWidth); setVh(window.innerHeight);
      const item = findTourTarget([tourSelector("nav.whatsapp")]);
      const el = item || findTourTarget([tourSelector("nav.mais")]);
      setFase(item ? "item" : "mais");
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      const novo = { x: r.left, y: r.top, w: r.width, h: r.height };
      setRect((antes) => (antes && Math.abs(antes.x - novo.x) < 1 && Math.abs(antes.y - novo.y) < 1 && Math.abs(antes.w - novo.w) < 1 && Math.abs(antes.h - novo.h) < 1 ? antes : novo));
    };
    mede();
    const id = setInterval(mede, 200);
    window.addEventListener("resize", mede);
    return () => { clearInterval(id); window.removeEventListener("resize", mede); };
  }, []);

  // O item pode estar atrás do rodapé do menu: leva-o para a vista (como os outros guias).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = findTourTarget([tourSelector(fase === "item" ? "nav.whatsapp" : "nav.mais")]);
    try { el?.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" }); } catch { /* ok */ }
  }, [fase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onFechar(); return; }
      if (e.key === "Tab" && balaoRef.current) {
        const itens = Array.from(balaoRef.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (!itens.length) return;
        const atual = itens.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        itens[e.shiftKey ? (atual <= 0 ? itens.length - 1 : atual - 1) : (atual === -1 || atual === itens.length - 1 ? 0 : atual + 1)].focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onFechar]);

  useEffect(() => {
    const h = balaoRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - alturaBalao) > 1) setAlturaBalao(h);
  });

  useEffect(() => {
    const t = setTimeout(() => { try { (balaoRef.current?.querySelector<HTMLElement>("[data-testid='anuncio-mostrar']") || balaoRef.current)?.focus({ preventScroll: true }); } catch { /* ok */ } }, 80);
    return () => clearTimeout(t);
  }, [fase]);

  if (!rect || typeof document === "undefined") return null;

  const furo: Retangulo = { x: rect.x - RESPIRO, y: rect.y - RESPIRO, w: rect.w + RESPIRO * 2, h: rect.h + RESPIRO * 2 };
  const pos = posicionaBalao(furo, vw, vh, alturaBalao, LARGURA);
  const raio = Math.round(Math.max(12, Math.min(16, Math.min(furo.w, furo.h) / 3)));

  const mostrar = () => {
    if (fase === "mais") { tocaNaTela("nav.mais"); return; } // abre o "Mais"; o item vira o foco
    onFechar();
    abrirMenu();
    // toca o item real do menu (no celular isso também fecha o "Mais"); sem ele, vai pela rota
    if (!tocaNaTela("nav.whatsapp")) router.push("/whatsapp" as any);
  };

  const conteudo = (
    <div className="wag-root" data-testid="wa-guia-anuncio" style={{ position: "fixed", inset: 0, zIndex: Z.guia, pointerEvents: "none" } as any}>
      {/* quatro bandas seguram o toque fora do buraco; o buraco deixa passar (o toque no item abre o WhatsApp) */}
      <div style={{ position: "fixed", left: 0, top: 0, width: "100%", height: Math.max(0, furo.y), pointerEvents: "auto" }} />
      <div style={{ position: "fixed", left: 0, top: furo.y + furo.h, width: "100%", bottom: 0, pointerEvents: "auto" }} />
      <div style={{ position: "fixed", left: 0, top: furo.y, width: Math.max(0, furo.x), height: furo.h, pointerEvents: "auto" }} />
      <div style={{ position: "fixed", left: furo.x + furo.w, top: furo.y, right: 0, height: furo.h, pointerEvents: "auto" }} />
      <div key={"f" + fase} className="wag-furo" style={{ left: furo.x, top: furo.y, width: furo.w, height: furo.h, borderRadius: raio }} />
      <div key={"o" + fase} className="wag-onda" style={{ left: furo.x - 4, top: furo.y - 4, width: furo.w + 8, height: furo.h + 8, borderRadius: raio + 4 }} />
      <div
        key={"b" + fase} ref={balaoRef} className="wag-tip" role="dialog" aria-labelledby="wag-anuncio-titulo" tabIndex={-1}
        data-pos={pos.lado} style={{ left: pos.left, top: pos.top, width: pos.largura, padding: "22px 22px 18px", gap: 0, pointerEvents: "auto", maxHeight: vh - 32, overflowY: "auto" }}
      >
        {(pos.lado === "right" || pos.lado === "left") && <span className="wag-seta" style={{ top: Math.min(pos.seta, 34) }} />}
        {(pos.lado === "bottom" || pos.lado === "top") && <span className="wag-seta" style={{ left: pos.seta }} />}
        <span className="wag-meta acc">Novidade</span>
        <h2 id="wag-anuncio-titulo" className="wag-h" style={{ fontSize: 24, margin: "8px 0 6px" }} data-testid="anuncio-titulo">O WhatsApp da loja chegou<em>.</em></h2>
        <p className="wag-p" style={{ fontSize: 15 }}>
          Converse com as clientes, mande produto e Pix, e deixe o aniversário e a cobrança do crediário saírem sozinhos. Tudo daqui da Aura.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
          <button type="button" className="wag-lnk" style={{ paddingLeft: 0 }} onClick={onFechar} data-testid="anuncio-agora-nao">Agora não</button>
          <BotaoPrincipal seta onClick={mostrar} testID="anuncio-mostrar">{fase === "mais" ? "Abrir o Mais" : "Mostrar o WhatsApp"}</BotaoPrincipal>
        </div>
      </div>
    </div>
  );
  return createPortal(conteudo, document.body);
}

export default GuiaAnuncio;
