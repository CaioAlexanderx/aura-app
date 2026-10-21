// ============================================================
// AuthStage — o palco compartilhado da porta de entrada (tq-67, 21/10/2026)
//
// Fundo escuro com duas massas de luz violeta, espiral branco-metálica e
// ondas num <canvas>, grão, o orbe (a logo da Aura, viva) acima do cartão e
// o cartão de vidro com aro metálico que gira. Usado pelas cinco telas de
// app/(auth): login, register, forgot-password, reset-password e
// verify-email. Fonte visual: mockup aprovado "Porta de entrada v4".
//
// Regras que este componente segura (não quebrar):
//   - LGPD: o banner do root cobre o rodapé em 375 px. A área que centraliza
//     o cartão soma `useLgpdConsentInset()` ao paddingBottom (ver
//     app/(auth)/_layout.tsx). O palco fica parado e só o conteúdo rola.
//   - z-index do RNW: as Views do RNW nascem com z-index 0. Canvas, luz e
//     grão ficam em camadas absolutas ATRÁS do conteúdo (1–2 contra 3) e
//     com pointer-events: none — nunca capturam clique.
//   - Desempenho: sem animação nenhuma com reduzir movimento, até 4 núcleos
//     ou até 2 GB (utils/palcoMovimento); tudo pausa com a aba oculta ou a
//     janela fora de foco; no nativo, fundo liso e sem canvas.
//   - Tradução do Chrome: o palco não escreve texto; o conteúdo das telas
//     fica em nós de texto simples.
//   - Fontes: injeta o MESMO link do Google Fonts do painel (id
//     "aura-fonts", GOOGLE_FONTS_CSS) — Instrument Serif, DM Sans e DM Mono
//     já são do app; nenhuma fonte nova. Sem rede, a pilha cai em Georgia.
// ============================================================
import React, { useEffect, useRef } from "react";
import { View, ScrollView, Platform, StyleSheet } from "react-native";
import { Stage, IS_LIGHT_MODE, Colors } from "@/constants/colors";
import { GOOGLE_FONTS_CSS } from "@/constants/fonts";
import { useLgpdConsentInset } from "@/components/LGPDConsent";
import { palcoEstaticoNoNavegador } from "@/utils/palcoMovimento";
import { startStageCanvas, type StageCanvas } from "@/components/auth/stageCanvas";
import { AUTH_STAGE_CSS, AUTH_STAGE_CSS_ID } from "@/components/auth/authStageCss";

const isWeb = Platform.OS === "web";

export type OrbMood = "hmm" | "happy";

type Props = {
  children: React.ReactNode;
  /**
   * "stage": cartão de vidro escuro em qualquer tema (o login novo, que usa
   * os tokens `Stage`). "theme" (padrão): telas que ainda pintam o conteúdo
   * com `Colors` — no tema claro o texto é escuro, então o cartão vira o
   * sólido `Colors.bg3` para continuar legível; no escuro é o mesmo vidro.
   */
  cardTone?: "stage" | "theme";
  /** Muda `n` para o orbe reagir de novo ("hmm" no erro, "happy" no acerto). */
  orbSignal?: { mood: OrbMood; n: number } | null;
  /**
   * Etapa do cadastro ("1", "2", "3"). Vira data-step no palco e as duas
   * massas de luz se deslocam com ela (regra [data-step] do mockup).
   */
  step?: string;
  testID?: string;
};

function injectOnce() {
  if (typeof document === "undefined") return;
  try {
    if (!document.getElementById(AUTH_STAGE_CSS_ID)) {
      const st = document.createElement("style");
      st.id = AUTH_STAGE_CSS_ID;
      st.textContent = AUTH_STAGE_CSS;
      document.head.appendChild(st);
    }
    if (!document.getElementById("aura-fonts")) {
      const lk = document.createElement("link");
      lk.id = "aura-fonts"; lk.rel = "stylesheet"; lk.href = GOOGLE_FONTS_CSS;
      document.head.appendChild(lk);
    }
  } catch {}
}

/**
 * A logo da Aura em vetor, para animar (o <symbol id="orb"> do mockup).
 * Exportada para o crachá do cadastro: fora de `.as-orb` os arcos não animam.
 */
export function OrbSvg() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="as-sph" cx="42%" cy="36%" r="70%"><stop offset="0%" stopColor="#3b2370" /><stop offset="45%" stopColor="#241244" /><stop offset="100%" stopColor="#0d0624" /></radialGradient>
        <linearGradient id="as-rimg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#9f8ad6" stopOpacity="0.9" /><stop offset="55%" stopColor="#6c4fb3" stopOpacity="0.6" /><stop offset="100%" stopColor="#4c2d8f" stopOpacity="0.9" /></linearGradient>
        <linearGradient id="as-arcg" gradientUnits="userSpaceOnUse" x1="60" y1="8" x2="20" y2="100"><stop offset="0%" stopColor="#f3efff" /><stop offset="45%" stopColor="#d9d0f5" /><stop offset="100%" stopColor="#9b86d9" /></linearGradient>
        <radialGradient id="as-coreg" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ffffff" /><stop offset="30%" stopColor="#f1e6ff" /><stop offset="62%" stopColor="#c084fc" stopOpacity="0.95" /><stop offset="100%" stopColor="#a855f7" stopOpacity="0" /></radialGradient>
        <filter id="as-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      <circle cx="60" cy="60" r="56" fill="url(#as-sph)" />
      <circle cx="60" cy="60" r="56" fill="none" stroke="url(#as-rimg)" strokeWidth="2" />
      <g className="as-arc as-a1"><circle cx="60" cy="60" r="50" fill="none" stroke="url(#as-arcg)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="235.6 78.6" transform="rotate(-90 60 60)" /></g>
      <g className="as-arc as-a2"><circle cx="60" cy="60" r="41" fill="none" stroke="url(#as-arcg)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="193.2 64.4" transform="rotate(-90 60 60)" /></g>
      <g className="as-arc as-a3"><circle cx="60" cy="60" r="32" fill="none" stroke="url(#as-arcg)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="150.8 50.3" transform="rotate(-90 60 60)" /></g>
      <g className="as-arc as-a4"><circle cx="60" cy="60" r="23" fill="none" stroke="url(#as-arcg)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="108.4 36.1" transform="rotate(-90 60 60)" /></g>
      <g className="as-core"><circle cx="60" cy="60" r="11" fill="url(#as-coreg)" filter="url(#as-soft)" /><circle cx="60" cy="60" r="4" fill="#ffffff" /></g>
    </svg>
  );
}

function WebStage({ children, cardTone = "theme", orbSignal, step, testID }: Props) {
  const consentInset = useLgpdConsentInset();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const engine = useRef<StageCanvas | null>(null);
  const animatedRef = useRef(false);
  const lastKey = useRef(0);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  injectOnce();

  useEffect(() => {
    const root = rootRef.current, cv = canvasRef.current;
    if (!root || !cv || typeof window === "undefined") return;
    const animated = !palcoEstaticoNoNavegador();
    animatedRef.current = animated;
    root.classList.toggle("as-static", !animated);

    const orbCenter = () => {
      const o = orbRef.current; if (!o) return null;
      const s = root.getBoundingClientRect(), r = o.getBoundingClientRect();
      return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
    };
    const eng = startStageCanvas(cv, root, { animated, orbCenter });
    engine.current = eng;

    // Pausa com a aba oculta ou a janela fora de foco; retoma ao voltar.
    const sync = () => {
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const blurred = typeof document !== "undefined" && typeof document.hasFocus === "function" && !document.hasFocus();
      const paused = hidden || blurred;
      root.classList.toggle("as-paused", paused);
      if (paused) eng.pause(); else eng.resume();
    };
    const onResize = () => eng.fit();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("blur", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("resize", onResize);
    sync();
    const intro = setTimeout(() => eng.emit(0.6), 400);

    return () => {
      clearTimeout(intro);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("blur", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("resize", onResize);
      eng.stop();
      engine.current = null;
    };
  }, []);

  function setMood(cls: string, ms: number) {
    const o = orbRef.current; if (!o || !animatedRef.current) return;
    o.classList.remove("as-listen", "as-happy", "as-hmm");
    void o.offsetWidth; // reinicia a animação
    o.classList.add(cls);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => o.classList.remove(cls), ms);
  }

  useEffect(() => {
    if (!orbSignal) return;
    if (orbSignal.mood === "happy") { setMood("as-happy", 950); engine.current?.emit(1); }
    else setMood("as-hmm", 550);
  }, [orbSignal?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (moodTimer.current) clearTimeout(moodTimer.current); }, []);

  // O orbe "escuta" quem digita: um pulso por rajada, não por tecla.
  function onInput(e: React.FormEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement | null;
    if (!t || t.tagName !== "INPUT" || !animatedRef.current) return;
    const now = Date.now();
    if (now - lastKey.current < 420) return;
    lastKey.current = now;
    setMood("as-listen", 750);
    engine.current?.emit(0.16, { v: 140, lw: 0.7 });
  }

  const solid = cardTone === "theme" && IS_LIGHT_MODE;
  return (
    <div ref={rootRef} className="aura-stage" data-testid={testID || "auth-stage"} data-step={step} onInput={onInput}>
      <div className="as-aura" aria-hidden="true"><div className="as-blob as-b1" /><div className="as-blob as-b2" /></div>
      <canvas ref={canvasRef} className="as-waves" aria-hidden="true" />
      <div className="as-grain" aria-hidden="true" />
      <div className="as-scroll">
        <div className="as-center" style={{ paddingBottom: (consentInset > 0 ? 16 : 24) + consentInset }}>
          <div className="as-scene">
            <div className={solid ? "as-card as-solid" : "as-card"} style={solid ? { background: Colors.bg3 } : undefined}>
              <div ref={orbRef} className="as-orb" role="img" aria-label="Aura"><OrbSvg /></div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NativeStage({ children, cardTone = "theme", testID }: Props) {
  // Nativo: fundo liso, sem canvas, sem animação.
  const solid = cardTone === "theme" && IS_LIGHT_MODE;
  return (
    <ScrollView style={ns.root} contentContainerStyle={ns.content} keyboardShouldPersistTaps="handled" testID={testID || "auth-stage"}>
      <View style={[ns.card, solid && { backgroundColor: Colors.bg3 }]}>{children}</View>
    </ScrollView>
  );
}

export function AuthStage(props: Props) {
  return isWeb ? <WebStage {...props} /> : <NativeStage {...props} />;
}

const ns = StyleSheet.create({
  root: { flex: 1, backgroundColor: Stage.bg },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 16, paddingVertical: 32 },
  card: {
    width: "100%", maxWidth: 448, borderRadius: 24, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 22,
    backgroundColor: "rgba(16,10,40,0.92)", borderWidth: 1, borderColor: "rgba(230,226,244,0.18)",
  },
});
