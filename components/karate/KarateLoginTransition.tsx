// ============================================================
// KarateLoginTransition — Aura Karatê · entrada Shoji (DESIGN-29 · v2)
//
// Animação de entrada exibida APENAS na AÇÃO de login e SOMENTE no
// PRIMEIRO login de uma conta karatê (o gate one-shot fica no
// login.tsx via utils/karateIntroSeen). Porta portuária da landing
// getaura.com.br/dojo: véu violeta de continuidade → portas de papel
// de arroz (障子 shoji) FECHADAS com selo + costura vermelha → as
// portas DESLIZAM PARA OS LADOS (abrindo) e revelam o palco "Aura.
// Karatê" → onDone (a tela de login navega para /karate).
//
// NÃO é montada no shell — só pelo login.tsx após credenciais OK.
// Web: CSS keyframes (portas = translateX). Native: RN Animated.
// prefers-reduced-motion: versão estática curta. "Pular" encerra já.
// ============================================================
import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, Platform, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";

const isWeb = Platform.OS === "web";
// Paleta Shoji (alinhada a constants/karateTheme.ts)
const RED = "#b8463a";
const RED_DEEP = "#7f1414";
const PAPER = "#f0ebe0";
const INK = "#2b2620";
const VIOLET = "#7c3aed"; // roxo do shell padrão getaura — ponto de partida
// fibra washi (mesma do site) para dar textura às portas
const NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function prefersReducedMotion(): boolean {
  if (!isWeb || typeof window === "undefined" || !window.matchMedia) return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

// CSS one-shot (id v2 para não colidir com build antigo em cache)
if (isWeb && typeof document !== "undefined" && !document.getElementById("karate-login-intro-css-v2")) {
  const st = document.createElement("style");
  st.id = "karate-login-intro-css-v2";
  st.textContent = `
    @keyframes kkVeilOut { 0%,34% { opacity:1; } 100% { opacity:0; visibility:hidden; } }
    @keyframes kkVeilMark { from { opacity:0; transform:translateY(10px) scale(.96);} to { opacity:1; transform:none; } }
    @keyframes kkDot { 0%,100%{ opacity:.3; transform:translateY(0);} 50%{ opacity:1; transform:translateY(-3px);} }
    @keyframes kkSealIn { from { opacity:0; transform:scale(.82);} to { opacity:1; transform:none; } }
    @keyframes kkSealOut { 0%,55%{ opacity:1;} 100%{ opacity:0; transform:scale(.9);} }
    @keyframes kkSeam { from { opacity:0; transform:translateX(-50%) scaleY(.2);} to { opacity:.85; transform:translateX(-50%) scaleY(1);} }
    @keyframes kkSeamOut { to { opacity:0; } }
    /* portas ABRINDO: começam fechadas (0) e deslizam para fora (±101%) */
    @keyframes kkDoorL { from { transform:translateX(0);} to { transform:translateX(-101%);} }
    @keyframes kkDoorR { from { transform:translateX(0);} to { transform:translateX(101%);} }
    @keyframes kkStageIn { from { opacity:0; transform:translateY(12px);} to { opacity:1; transform:none; } }

    .kk-veil  { animation: kkVeilOut .8s cubic-bezier(.4,0,.2,1) .25s both; }
    .kk-vmark { animation: kkVeilMark .5s cubic-bezier(.4,0,.2,1) both; }
    .kk-dot   { display:inline-block; width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,.9); margin:0 3px; animation: kkDot 1s ease-in-out infinite; }
    .kk-door  { position:absolute; top:0; bottom:0; width:50.6%; background:${PAPER};
                background-image:linear-gradient(0deg, rgba(43,38,32,0.05), rgba(43,38,32,0.05)), ${NOISE};
                background-size:cover, 220px 220px; background-blend-mode:normal, multiply; z-index:3; }
    .kk-door.l { left:0;  box-shadow:14px 0 50px rgba(43,38,32,.18); animation: kkDoorL 1s cubic-bezier(.76,0,.24,1) 1.05s both; }
    .kk-door.r { right:0; box-shadow:-14px 0 50px rgba(43,38,32,.18); animation: kkDoorR 1s cubic-bezier(.76,0,.24,1) 1.05s both; }
    /* kumiko (treliça) tênue sobre cada porta */
    .kk-lattice { position:absolute; inset:7%;
      background-image:linear-gradient(rgba(43,38,32,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(43,38,32,.07) 1px, transparent 1px);
      background-size:64px 64px; opacity:.7; }
    .kk-seam  { position:absolute; top:0; bottom:0; left:50%; width:2px; transform:translateX(-50%); background:${RED}; opacity:0; z-index:4; animation: kkSeam .5s cubic-bezier(.4,0,.2,1) .6s both, kkSeamOut .45s cubic-bezier(.4,0,.2,1) 1.05s both; }
    .kk-seal  { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:5; animation: kkSealIn .45s cubic-bezier(.4,0,.2,1) .55s both, kkSealOut 1s cubic-bezier(.4,0,.2,1) .55s both; }
    .kk-stage { animation: kkStageIn .7s cubic-bezier(.4,0,.2,1) 1.35s both; }

    @media (prefers-reduced-motion: reduce) {
      .kk-veil,.kk-vmark,.kk-door.l,.kk-door.r,.kk-seam,.kk-seal,.kk-stage { animation: none !important; }
    }
  `;
  document.head.appendChild(st);
}

interface Props { onDone: () => void; }

// Selo vermelho com kanji 空 (kara) — evita depender de asset externo
function Seal({ size = 84 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 18,
      background: `linear-gradient(150deg, ${RED}, ${RED_DEEP})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fdf4ec", fontFamily: "serif", fontSize: size * 0.52, fontWeight: 700,
      boxShadow: "0 14px 36px rgba(184,70,58,0.42), inset 0 0 0 1.5px rgba(253,244,236,0.28)",
    } as any}>空</div>
  );
}

export function KarateLoginTransition({ onDone }: Props) {
  const reduced = prefersReducedMotion();

  // ── WEB ─────────────────────────────────────────────
  if (isWeb) {
    useEffect(() => {
      // portas terminam de abrir ~2.05s; dá um respiro e encerra
      const t = setTimeout(onDone, reduced ? 650 : 2400);
      return () => clearTimeout(t);
    }, []);
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden",
        background: PAPER, display: "flex", alignItems: "center", justifyContent: "center",
      } as any}>
        {/* Palco revelado atrás das portas: wordmark Aura. Karatê */}
        <div className={reduced ? undefined : "kk-stage"} style={{
          position: "relative", zIndex: 1,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
        } as any}>
          <Seal size={92} />
          <div style={{ textAlign: "center" } as any}>
            <div style={{ fontSize: 30, fontWeight: 800, color: INK, letterSpacing: -0.5 } as any}>
              Aura<span style={{ color: RED } as any}>.</span> Karatê
            </div>
            <div style={{ fontSize: 13, color: "#8B6F5E", marginTop: 6, letterSpacing: 4 } as any}>空手の道</div>
          </div>
        </div>

        {/* Portas de papel de arroz (fechadas → abrem) */}
        {!reduced && (
          <>
            <div className="kk-door l"><div className="kk-lattice" /></div>
            <div className="kk-door r"><div className="kk-lattice" /></div>
            <div className="kk-seam" />
            {/* selo sobre as portas fechadas */}
            <div className="kk-seal"><Seal size={84} /></div>
          </>
        )}

        {/* Véu violeta inicial (getaura) que se dissolve — "do roxo às portas" */}
        {!reduced && (
          <div className="kk-veil" style={{
            position: "absolute", inset: 0, zIndex: 6,
            background: `radial-gradient(120% 90% at 50% 18%, rgba(124,58,237,0.5), transparent 60%), radial-gradient(110% 80% at 50% 100%, rgba(76,29,149,0.55), transparent 62%), #0a0714`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
          } as any}>
            <div className="kk-vmark" style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: -0.5 } as any}>
              Aura<span style={{ color: "#a78bfa" } as any}>.</span>
            </div>
            <div className="kk-vmark" style={{ display: "flex", alignItems: "center", color: "rgba(255,255,255,.85)", fontSize: 12, letterSpacing: 2, animationDelay: ".1s" } as any}>
              <span className="kk-dot" /><span className="kk-dot" style={{ animationDelay: ".15s" } as any} /><span className="kk-dot" style={{ animationDelay: ".3s" } as any} />
              <span style={{ marginLeft: 8 } as any}>ENTRANDO</span>
            </div>
          </div>
        )}

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
  // Portas abrindo com Animated: dois painéis deslizam para fora + palco entra.
  const doorL = useRef(new Animated.Value(0)).current;   // 0 fechado → -1 aberto
  const doorR = useRef(new Animated.Value(0)).current;
  const stage = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(550),
      Animated.parallel([
        Animated.timing(stage, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(doorL, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(doorR, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
    const t = setTimeout(onDone, 1900);
    return () => clearTimeout(t);
  }, []);
  const trL = doorL.interpolate({ inputRange: [0, 1], outputRange: ["0%", "-101%"] });
  const trR = doorR.interpolate({ inputRange: [0, 1], outputRange: ["0%", "101%"] });
  return (
    <View style={styles.nativeRoot}>
      <Animated.View style={{ opacity: stage, alignItems: "center" }}>
        <Text style={styles.kanji}>空</Text>
        <Text style={styles.word}>Aura<Text style={{ color: RED }}>.</Text> Karatê</Text>
        <Text style={styles.sub}>空手の道</Text>
      </Animated.View>
      <Animated.View style={[styles.doorNative, { left: 0, transform: [{ translateX: trL }] }]} />
      <Animated.View style={[styles.doorNative, { right: 0, transform: [{ translateX: trR }] }]} />
      <TouchableOpacity onPress={onDone} style={styles.skip} accessibilityRole="button" accessibilityLabel="Pular animação">
        <Text style={styles.skipText}>PULAR →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeRoot: { ...StyleSheet.absoluteFillObject, backgroundColor: PAPER, alignItems: "center", justifyContent: "center", zIndex: 9999, overflow: "hidden" } as ViewStyle,
  doorNative: { position: "absolute", top: 0, bottom: 0, width: "50.6%", backgroundColor: PAPER, zIndex: 3, shadowColor: "#2b2620", shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } } as ViewStyle,
  kanji: { fontSize: 120, color: RED, fontWeight: "700" } as TextStyle,
  word: { fontSize: 24, fontWeight: "800", color: INK, marginTop: 8 } as TextStyle,
  sub: { fontSize: 13, color: "#8B6F5E", marginTop: 4, letterSpacing: 4 } as TextStyle,
  skip: { position: "absolute", bottom: 36, alignSelf: "center", padding: 10, zIndex: 10000 } as ViewStyle,
  skipText: { fontSize: 11, color: "#8B6F5E", letterSpacing: 2 } as TextStyle,
});
