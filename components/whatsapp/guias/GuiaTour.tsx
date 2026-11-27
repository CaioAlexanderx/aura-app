// ============================================================
// GuiaTour — o motor dos três guias do WhatsApp
//
// PROVISÓRIO: depois da virada, o SpotlightTour ganha as opções de executar a
// ação no balão e de deslizar o furo entre alvos, e os guias passam a rodar
// nele (este motor some). Não mexer no SpotlightTour antes disso.
//
// Usa a mecânica do SpotlightTour que já existe (findTourTarget, espera pelo
// alvo, auto-scroll, portal no body, tourTarget) com o visual dos artboards
// (GuiaPassos / GuiaExecucao): vidro, balão com seta e fio, spotlight com halo
// e onda. O SpotlightTour genérico não dá conta de duas coisas daqui, por
// isso este motor próprio em vez de uma segunda cópia da regra de tour:
//   · o balão EXECUTA a ação e o passo avança pelo estado real;
//   · passo que depende de outra aba troca a aba antes de procurar o alvo.
//
// Regras:
//   · Alvo ausente pula o passo (nunca cai no balão do meio).
//   · "Voltar", "Próximo" (o único sólido), "Pular guia"; contador "2 de 6"; Esc fecha.
//   · Toque fora do buraco não faz nada (só Esc ou "Pular guia" fecham); o
//     buraco só deixa passar o toque nos passos `interativo`.
// ============================================================
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findTourTarget } from "@/components/onboarding/SpotlightTour";
import { tourSelector } from "@/utils/tourTarget";
import type { Guia, GuiaCtx, PassoGuia } from "./guiasConteudo";
import { ExecBloco, BotaoPrincipal } from "./GuiaExec";
import { G, WEB, Z, movimentoReduzido, posicionaBalao, useGuiaCss, type Retangulo } from "./guiaVisual";

const RESPIRO = 6;
const LARGURA_BALAO = 400;
const FURO_BASE = 100;
const ESPERA_PADRAO = 1200; // alvo que não está na tela (ex.: plano sem Aurinha, gaveta fechada no celular): pula depressa
const POLL_MS = 120;
const MEDE_MS = 250;

export interface FimDoGuia {
  /** O guia chegou ao fim (último passo ou nenhum que sobrasse): conta como visto. */
  feito: boolean;
  /** Abrir este guia em seguida. */
  depois?: 1 | 2 | 3;
  /** O guia parou neste passo por falta de conversa aberta e continua quando a primeira abrir. */
  pendente?: string;
}

interface Props {
  guia: Guia;
  ctx: GuiaCtx;
  onFim: (f: FimDoGuia) => void;
  /** Começa neste passo (retomada do guia 3). */
  inicioId?: string | null;
}

function raioDe(r: Retangulo): number {
  return Math.round(Math.max(12, Math.min(22, Math.min(r.w, r.h) / 3)));
}

function igual(a: Retangulo | null, b: Retangulo | null): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1;
}

export function GuiaTour({ guia, ctx, onFim, inicioId }: Props) {
  useGuiaCss();
  const passos = guia.passos;
  const [i, setI] = useState(() => Math.max(0, guia.passos.findIndex((p) => p.id === inicioId)));
  const [semConversa, setSemConversa] = useState(false);
  const [rect, setRect] = useState<Retangulo | null>(null);
  const [pronto, setPronto] = useState(false);
  const [solto, setSolto] = useState(false);
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  const [alturaBalao, setAlturaBalao] = useState(260);

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const sentido = useRef<1 | -1>(1);
  const alvoRef = useRef<HTMLElement | null>(null);
  const balaoRef = useRef<HTMLDivElement | null>(null);
  const focoOrigem = useRef<HTMLElement | null>(null);
  const completoNaEntrada = useRef(false);
  const produtosNaEntrada = useRef(ctx.produtosEnviados);
  const encerrado = useRef(false);

  const passo: PassoGuia | undefined = passos[i];

  const terminar = useCallback((f: FimDoGuia) => {
    if (encerrado.current) return;
    encerrado.current = true;
    try { focoOrigem.current?.focus?.({ preventScroll: true } as any); } catch { /* ok */ }
    onFim(f);
  }, [onFim]);

  const vaiPara = useCallback((prox: number, dir: 1 | -1) => {
    sentido.current = dir;
    if (prox >= passos.length) { terminar({ feito: true }); return; }
    if (prox < 0) { sentido.current = 1; setI(0); return; }
    setI(prox);
  }, [passos.length, terminar]);

  const proximo = useCallback(() => vaiPara(i + 1, 1), [i, vaiPara]);
  const voltar = useCallback(() => vaiPara(i - 1, -1), [i, vaiPara]);
  const pular = useCallback(() => terminar({ feito: false }), [terminar]);
  const encadear = useCallback((n: 1 | 2 | 3) => terminar({ feito: true, depois: n }), [terminar]);

  // Guarda de onde veio o foco, para devolver ao terminar.
  useEffect(() => {
    if (!WEB || typeof document === "undefined") return;
    focoOrigem.current = (document.activeElement as HTMLElement) || null;
  }, []);

  // Esc fecha.
  useEffect(() => {
    if (!WEB || typeof window === "undefined") return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); pular(); return; }
      const bal = balaoRef.current;
      if (!bal) return;
      if (e.key === "Tab") {
        // o Tab fica preso dentro do balão
        const itens = Array.from(bal.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (!itens.length) { e.preventDefault(); bal.focus(); return; }
        const atual = itens.indexOf(document.activeElement as HTMLElement);
        const prox = e.shiftKey ? (atual <= 0 ? itens.length - 1 : atual - 1) : (atual === -1 || atual === itens.length - 1 ? 0 : atual + 1);
        e.preventDefault();
        itens[prox].focus();
        return;
      }
      if (e.key === "ArrowLeft") { const v = bal.querySelector<HTMLElement>("[data-testid='guia-voltar']"); if (v) { e.preventDefault(); v.click(); } }
      if (e.key === "ArrowRight") {
        const n = bal.querySelector<HTMLButtonElement>("[data-testid='guia-proximo'], [data-testid='guia-proximo-exec']");
        if (n && !n.disabled) { e.preventDefault(); n.click(); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [pular]);

  useEffect(() => {
    if (!WEB || typeof window === "undefined") return;
    const h = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // Entra num passo: pula se não cabe, troca a aba, procura o alvo (com espera), rola e mede.
  useEffect(() => {
    if (!passo || !WEB || typeof document === "undefined") return;
    let cancelado = false;
    let t1: any = null, t2: any = null;
    const dir = sentido.current;
    alvoRef.current = null;
    setPronto(false);
    setSolto(false);
    setSemConversa(false);

    const pula = () => { if (!cancelado) vaiPara(i + dir, dir); };

    if (passo.pula?.(ctxRef.current)) { pula(); return () => { cancelado = true; }; }
    completoNaEntrada.current = !!passo.completo?.(ctxRef.current);
    produtosNaEntrada.current = ctxRef.current.produtosEnviados;
    if (passo.aba) ctxRef.current.irPara(passo.aba);

    if (!passo.alvo) {
      setRect(null);
      setPronto(true);
      return () => { cancelado = true; };
    }
    const sel = tourSelector(passo.alvo);
    const inicio = Date.now();
    const espera = passo.espera ?? ESPERA_PADRAO;
    const tenta = () => {
      if (cancelado) return;
      const el = findTourTarget([sel]);
      if (!el) {
        if (Date.now() - inicio < espera) { t1 = setTimeout(tenta, POLL_MS); return; }
        if (passo.exigeConversa) { setSemConversa(true); setRect(null); setPronto(true); return; } // fica pendente, não pula
        pula(); // alvo ausente: pula o passo
        return;
      }
      alvoRef.current = el;
      try { el.scrollIntoView({ behavior: movimentoReduzido() ? "auto" : "smooth", block: "center", inline: "nearest" }); } catch { /* ok */ }
      // espera a rolagem assentar (rolagem suave de longa distância passa de 400 ms): mede de novo até o alvo parar de mexer
      let ultimo: DOMRect | null = null;
      let parado = 0;
      let amostras = 0;
      const assenta = () => {
        if (cancelado) return;
        const r = el.getBoundingClientRect();
        const igual = !!ultimo && Math.abs(r.top - ultimo.top) < 2 && Math.abs(r.left - ultimo.left) < 2;
        parado = igual ? parado + 1 : 0;
        ultimo = r;
        amostras++;
        if (parado >= 2 || amostras >= 12) {
          setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
          setPronto(true);
        } else t2 = setTimeout(assenta, 100);
      };
      t2 = setTimeout(assenta, movimentoReduzido() ? 0 : 150);
    };
    tenta();
    return () => { cancelado = true; clearTimeout(t1); clearTimeout(t2); };
    // ctx entra por ref: o passo não recomeça a cada mudança de estado da tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, passo?.id]);

  // Acompanha o alvo (rolagem, layout que mexe, nó recriado pela tela).
  useEffect(() => {
    if (!pronto || !passo?.alvo || !WEB || typeof document === "undefined") return;
    const sel = tourSelector(passo.alvo);
    const mede = () => {
      let el = alvoRef.current;
      if (!el || !document.contains(el)) {
        el = findTourTarget([sel]);
        alvoRef.current = el;
      }
      if (!el) return;
      const r = el.getBoundingClientRect();
      const novo = { x: r.left, y: r.top, w: r.width, h: r.height };
      setRect((antes) => (igual(antes, novo) ? antes : novo));
    };
    const id = setInterval(mede, MEDE_MS);
    window.addEventListener("scroll", mede, true);
    window.addEventListener("resize", mede);
    return () => { clearInterval(id); window.removeEventListener("scroll", mede, true); window.removeEventListener("resize", mede); };
  }, [pronto, passo?.id, passo?.alvo]);

  // O passo avança pelo ESTADO real: quando "completo" vira verdadeiro depois da entrada.
  const completoAgora = !!passo?.completo?.(ctx);
  useEffect(() => {
    if (!pronto || !passo?.completo) return;
    if (!completoAgora) { completoNaEntrada.current = false; return; }
    if (completoNaEntrada.current) return;
    const t = setTimeout(() => { vaiPara(i + 1, 1); }, passo.exec === "aguardar" ? 400 : 1000);
    return () => clearTimeout(t);
  }, [completoAgora, pronto, i, passo, vaiPara]);

  // Passo que deixa o toque passar: ao tocar no alvo, o escurecimento sai e o balão fica (o painel que o toque abre não pode ficar atrás).
  useEffect(() => {
    if (!pronto || !passo?.interativo || passo.exec !== "produto" || !WEB || typeof window === "undefined") return;
    const h = (e: MouseEvent) => {
      const el = alvoRef.current;
      if (!(e.target instanceof Element)) return;
      // o toque no alvo OU em qualquer atalho de envio da conversa (Produto, Orçamento, Pix...) abre o painel: o escurecimento sai
      if ((el && el.contains(e.target)) || e.target.closest('[data-testid^="hub-envio-"]')) setSolto(true);
    };
    window.addEventListener("click", h, true);
    return () => window.removeEventListener("click", h, true);
  }, [pronto, passo?.id, passo?.interativo, passo?.exec]);

  // Mede o balão depois de pintar.
  useLayoutEffect(() => {
    const h = balaoRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - alturaBalao) > 1) setAlturaBalao(h);
  });

  // Foco no balão a cada passo (leitor de tela lê o título).
  useEffect(() => {
    if (!pronto) return;
    try {
      // o foco inicial cai no botão principal do balão
      const b = balaoRef.current;
      const principal = b?.querySelector<HTMLElement>("[data-testid='guia-acao']:not([disabled]), [data-testid='guia-proximo'], [data-testid='guia-proximo-exec']");
      (principal || b)?.focus({ preventScroll: true });
    } catch { /* ok */ }
  }, [pronto, passo?.id]);

  if (!WEB || !passo) return null;
  // entre passos: só o buraco do passo anterior segura a tela (e depois desliza para o novo alvo); o balão espera
  if (!pronto && !rect) return null;

  const ultimo = i === passos.length - 1;
  const furo: Retangulo | null = rect && !solto
    ? { x: rect.x - RESPIRO, y: rect.y - RESPIRO, w: rect.w + RESPIRO * 2, h: rect.h + RESPIRO * 2 }
    : null;
  // Passo que não pode cobrir o menu lateral: o balão fica ao lado do alvo, à direita da borda do menu.
  let minLeft: number | undefined;
  if (passo.evitaMenu && vw > 600) {
    const nav = findTourTarget([tourSelector("nav.whatsapp")]);
    if (nav) minLeft = Math.ceil(nav.getBoundingClientRect().right) + 16;
  }
  // Depois do toque no alvo (solto) o balão continua ancorado a ele, sem cobrir o painel que abriu; só no celular, onde a
  // gaveta ocupa a parte de baixo, ele sobe para o topo.
  const pos = solto && vw <= 600
    ? { lado: "dentro" as const, left: 16, top: 16, largura: Math.min(LARGURA_BALAO, vw - 32), seta: 0 }
    : posicionaBalao(rect ? { x: rect.x - RESPIRO, y: rect.y - RESPIRO, w: rect.w + RESPIRO * 2, h: rect.h + RESPIRO * 2 } : null, vw, vh, alturaBalao, LARGURA_BALAO, { minLeft });
  const produtoFeito = ctx.produtosEnviados > produtosNaEntrada.current;
  const execComBotao = !!passo.exec;
  const total = passos.length;
  const rotuloProximo = passo.cta || (ultimo ? "Entendi" : "Próximo");
  const tituloId = "wag-titulo-" + passo.id;

  const furoTela = rect && !solto ? { x: rect.x - RESPIRO, y: rect.y - RESPIRO, w: rect.w + RESPIRO * 2, h: rect.h + RESPIRO * 2 } : null;
  const bandas = furo && !solto ? (
    <>
      {/* quatro bandas transparentes seguram o toque fora do buraco */}
      <div style={{ position: "fixed", left: 0, top: 0, width: "100%", height: Math.max(0, furo.y), pointerEvents: "auto" }} />
      <div style={{ position: "fixed", left: 0, top: furo.y + furo.h, width: "100%", bottom: 0, pointerEvents: "auto" }} />
      <div style={{ position: "fixed", left: 0, top: furo.y, width: Math.max(0, furo.x), height: furo.h, pointerEvents: "auto" }} />
      <div style={{ position: "fixed", left: furo.x + furo.w, top: furo.y, right: 0, height: furo.h, pointerEvents: "auto" }} />
      {!passo.interativo && <div style={{ position: "fixed", left: furo.x, top: furo.y, width: furo.w, height: furo.h, pointerEvents: "auto" }} />}
    </>
  ) : null;

  const conteudo = (
    <div className="wag-root" data-testid="wa-guia" data-guia={guia.n} data-passo={passo.id} style={{ position: "fixed", inset: 0, zIndex: Z.guia, pointerEvents: "none" } as any}>
      {!solto && !furo && <div className="wag-dim" style={{ pointerEvents: "auto" }} />}
      {bandas}
      {/* o buraco é UM elemento de tamanho fixo: translate e scale o levam de um alvo ao outro (só transform e opacity) */}
      {furoTela && (
        <div
          className="wag-furo-d"
          style={{
            width: FURO_BASE, height: FURO_BASE,
            transform: `translate(${furoTela.x}px, ${furoTela.y}px) scale(${furoTela.w / FURO_BASE}, ${furoTela.h / FURO_BASE})`,
            borderWidth: `${2 / (furoTela.h / FURO_BASE)}px ${2 / (furoTela.w / FURO_BASE)}px`,
            // durante a rolagem/busca o anel some (o escurecimento fica); só aparece quando o alvo assenta
            ...(pronto ? null : { borderColor: "transparent" }),
            borderRadius: `${raioDe(furoTela) / (furoTela.w / FURO_BASE)}px / ${raioDe(furoTela) / (furoTela.h / FURO_BASE)}px`,
          }}
        />
      )}
      {furo && pronto && (
        <>
          <div key={"h" + passo.id} className="wag-halo" style={{ left: furo.x, top: furo.y, width: furo.w, height: furo.h, borderRadius: raioDe(furo) }} />
          <div key={"o" + passo.id} className="wag-onda" style={{ left: furo.x - 4, top: furo.y - 4, width: furo.w + 8, height: furo.h + 8, borderRadius: raioDe(furo) + 4 }} />
        </>
      )}
      {pronto && <div
        key={"b" + passo.id}
        ref={balaoRef}
        className="wag-tip"
        role="dialog"
        aria-labelledby={tituloId}
        tabIndex={-1}
        data-pos={pos.lado}
        style={{
          left: pos.left, top: pos.top, width: pos.largura, maxHeight: vh - 32, overflowY: "auto", pointerEvents: "auto",
        }}
      >
        {(pos.lado === "right" || pos.lado === "left") && <span className="wag-seta" style={{ top: pos.seta }} />}
        {(pos.lado === "bottom" || pos.lado === "top") && <span className="wag-seta" style={{ left: pos.seta }} />}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span className="wag-meta acc" data-testid="guia-contador">{total > 1 ? `${i + 1} de ${total}` : guia.meta}</span>
          {total > 1 && (
            <div className="wag-dots" aria-hidden="true">
              {passos.map((p, k) => <i key={p.id} className={k <= i ? "on" : ""} />)}
            </div>
          )}
        </div>

        <h2 id={tituloId} className="wag-h" style={{ fontSize: 21 }} data-testid="guia-titulo">{semConversa ? "Falta uma conversa aberta" : passo.titulo}<em>.</em></h2>
        {(semConversa || !!passo.corpo) && (
          <p className="wag-p" style={{ fontSize: 14 }} data-testid="guia-corpo">
            {semConversa ? "Este guia roda com uma conversa aberta. Quando a primeira abrir, ele continua daqui." : passo.corpo}
          </p>
        )}

        {execComBotao && !semConversa && (
          <ExecBloco passo={passo} ctx={ctx} proximo={proximo} pular={pular} encadear={encadear} produtoFeito={produtoFeito} />
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {i > 0 && <button type="button" className="wag-lnk" style={{ paddingLeft: 0 }} onClick={voltar} data-testid="guia-voltar">Voltar</button>}
            <button type="button" className="wag-lnk sutil" style={i > 0 ? undefined : { paddingLeft: 0 }} onClick={pular} data-testid="guia-pular">Pular guia</button>
          </div>
          {semConversa ? (
            <BotaoPrincipal seta onClick={() => terminar({ feito: false, pendente: passo.id })} testID="guia-pendente">Entendi</BotaoPrincipal>
          ) : !execComBotao && (
            <BotaoPrincipal seta onClick={proximo} testID="guia-proximo">{rotuloProximo}</BotaoPrincipal>
          )}
        </div>
      </div>}
    </div>
  );

  // portal direto no body: o WebPortal do app prende o toque na tela toda, e aqui o buraco precisa deixar o toque passar
  return typeof document !== "undefined" ? createPortal(conteudo, document.body) : null;
}

export default GuiaTour;
