// ============================================================
// KarateLoginTransition — Aura Karatê (DESIGN-29)
//
// Animação de entrada exibida APENAS na AÇÃO DE LOGIN (one-shot),
// quando o vertical é karatê. Quebra o roxo do app.getaura.com.br e
// entrega a atmosfera Shoji: véu violeta ("Entrando") → pincelada
// sumi-e do kanji 空 em vermelho → wordmark "Aura. Karatê" → wipe
// shoji → onDone (a tela de login navega para /karate).
//
// NÃO é montada no shell — só pelo login.tsx após credenciais OK.
// Web: CSS keyframes + SVG stroke-draw. Native: RN Animated (fade/scale).
// prefers-reduced-motion: versão estática curta. Botão "Pular" encerra já.
// ============================================================
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, Platform, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { KarateColors } from "@/constants/karateTheme";

const isWeb = Platform.OS === "web";
const RED = "#B91C1C";
const PAPER = "#FDFAF5";
const VIOLET = "#7c3aed"; // o roxo do shell padrão — ponto de partida

function prefersReducedMotion(): boolean {
  if (!isWeb || typeof window === "undefined" || !window.matchMedia) return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

if (isWeb && typeof document !== "undefined" && !document.getElementById("karate-login-intro-css")) {
  const st = document.createElement("style");
  st.id = "karate-login-intro-css";
  st.textContent = `
    @keyframes kkVioletOut { 0%,40% { opacity:1; } 100% { opacity:0; } }
    @keyframes kkPaint { from { stroke-dashoffset:1; } to { stroke-dashoffset:0; } }
    @keyframes kkRise { from { opacity:0; transform:translateY(14px);} to { opacity:1; transform:none; } }
    @keyframes kkDot { 0%,100%{ opacity:.3; transform:translateY(0);} 50%{ opacity:1; transform:translateY(-3px);} }
    @keyframes kkPanelL { from { transform:translateX(-101%);} to { transform:translateX(0);} }
    @keyframes kkPanelR { from { transform:translateX(101%);} to { transform:translateX(0);} }
    .kk-violet { animation: kkVioletOut 1.05s cubic-bezier(.25,.1,.25,1) both; }
    .kk-brush { animation: kkPaint 1.4s cubic-bezier(.25,.1,.25,1) .55s both; }
    .kk-word { animation: kkRise .7s cubic-bezier(.25,.1,.25,1) 1.45s both; }
    .kk-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,.9); margin:0 3px; animation: kkDot 1s ease-in-out infinite; }
    .kk-panel { position:absolute; top:0; bottom:0; width:51%; background:linear-gradient(${RED}, #7f1414); }
    .kk-panel.l { left:0; animation: kkPanelL .7s cubic-bezier(.7,0,.84,0) 2.0s both; }
    .kk-panel.r { right:0; animation: kkPanelR .7s cubic-bezier(.7,0,.84,0) 2.0s both; }
    @media (prefers-reduced-motion: reduce) {
      .kk-violet,.kk-brush,.kk-word,.kk-panel.l,.kk-panel.r { animation: none !important; }
    }
  `;
  document.head.appendChild(st);
}

interface Props { onDone: () => void; }

export function KarateLoginTransition({ onDone }: Props) {
  const reduced = prefersReducedMotion();

  // ── WEB ─────────────────────────────────────────────
  if (isWeb) {
    useEffect(() => {
      const t = setTimeout(onDone, reduced ? 600 : 2750);
      return () => clearTimeout(t);
    }, []);
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden",
        background: PAPER, display: "flex", alignItems: "center", justifyContent: "center",
      } as any}>
        {/* Reveal: kanji 空 pintado + wordmark */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 } as any}>
          <svg width="200" height="200" viewBox="0 0 400 400" aria-label="空 kara">
            <mask id="kkRevealMask">
              <path className={reduced ? undefined : "kk-brush"} pathLength={1}
                stroke="#fff" strokeWidth={86} fill="none" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={1} strokeDashoffset={reduced ? 0 : 1}
                d="M44,118 H356 L44,200 H356 L44,282 H356" />
            </mask>
            <text x="200" y="252" textAnchor="middle" fontSize="300" fontWeight={700}
              fill={RED} mask="url(#kkRevealMask)" style={{ fontFamily: "serif" } as any}>空</text>
          </svg>
          <div className={reduced ? undefined : "kk-word"} style={{ textAlign: "center" } as any}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1C1714", letterSpacing: -0.5 } as any}>
              Aura<span style={{ color: RED } as any}>.</span> Karatê
            </div>
            <div style={{ fontSize: 13, color: "#8B6F5E", marginTop: 4, letterSpacing: 4 } as any}>空手の道</div>
          </div>
        </div>

        {/* Véu violeta inicial (getaura) que se dissolve — "do roxo ao vermelho" */}
        {!reduced && (
          <div className="kk-violet" style={{
            position: "absolute", inset: 0, background: VIOLET,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
          } as any}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -0.5 } as any}>
              Aura<span style={{ opacity: 0.7 } as any}>.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,.85)", fontSize: 12, letterSpacing: 2 } as any}>
              <span className="kk-dot" /><span className="kk-dot" style={{ animationDelay: ".15s" } as any} /><span className="kk-dot" style={{ animationDelay: ".3s" } as any} />
              <span style={{ marginLeft: 8 } as any}>ENTRANDO</span>
            </div>
          </div>
        )}

        {/* Wipe shoji final */}
        {!reduced && (<><div className="kk-panel l" /><div className="kk-panel r" /></>)}

        {/* Pular */}
        <button onClick={onDone} style={{
          position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "transparent", border: 0, cursor: "pointer", zIndex: 10000,
          color: "#8B6F5E", fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
        } as any}>Pular →</button>
      </div>
    );
  }

  // ── NATIVE ────────────────────────────────────────
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={styles.nativeRoot}>
      <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems: "center" }}>
        <Text style={styles.kanji}>空</Text>
        <Text style={styles.word}>Aura<Text style={{ color: RED }}>.</Text> Karatê</Text>
        <Text style={styles.sub}>空手の道</Text>
      </Animated.View>
      <TouchableOpacity onPress={onDone} style={styles.skip} accessibilityRole="button" accessibilityLabel="Pular animação">
        <Text style={styles.skipText}>PULAR →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeRoot: { ...StyleSheet.absoluteFillObject, backgroundColor: PAPER, alignItems: "center", justifyContent: "center", zIndex: 9999 } as ViewStyle,
  kanji: { fontSize: 120, color: RED, fontWeight: "700" } as TextStyle,
  word: { fontSize: 24, fontWeight: "800", color: "#1C1714", marginTop: 8 } as TextStyle,
  sub: { fontSize: 13, color: "#8B6F5E", marginTop: 4, letterSpacing: 4 } as TextStyle,
  skip: { position: "absolute", bottom: 36, alignSelf: "center", padding: 10 } as ViewStyle,
  skipText: { fontSize: 11, color: "#8B6F5E", letterSpacing: 2 } as TextStyle,
});
