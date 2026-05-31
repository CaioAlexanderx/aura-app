// ============================================================
// AURA STUDIO · StudioOnboarding (Fase 5A)
//
// Walkthrough de 4 passos pra apresentar o Studio na primeira
// entrada. Componente standalone — a integracao com refs reais
// dos targets (sidebar, checklist, marketplaces, settings)
// acontece na parte B.
//
// Por enquanto: overlay escuro full-screen, SEM "buraco" — o
// foco visual é só o tooltip flutuante centralizado, com eyebrow
// magenta + titulo navy + texto + 2 botões (Pular / Próximo).
// Último passo: "Próximo →" vira "Começar".
//
// Esc fecha (web). Back button fecha (native via Modal).
//
// Memory: plano_aura_studio_vertical_24mai2026 (primary navy
// #1E3A8A, accent magenta #EC4899, light theme).
//
// 31/05/2026 (Fase 3): migrado de StudioTokens estático pra
// useStudioTokens — light+dark via provider. Banner já estava
// slim com 1 acento magenta (eyebrow + active step dot); preserva.
// ============================================================
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View, Text, Pressable, StyleSheet, Modal, Platform,
  Animated, Easing, useWindowDimensions,
} from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { StudioRadiusV2 } from "@/constants/studio-tokens-v2";
import type { StudioPalette } from "@/constants/studio-tokens";

// ─── Passos hardcoded ───────────────────────────────────────
type Step = {
  target: string; // chave abstrata (parte B vai mapear pra ref real)
  eyebrow?: string;
  title: string;
  text: string;
};

const STEPS: Step[] = [
  {
    target: "sidebar",
    eyebrow: "BEM-VINDO AO STUDIO",
    title: "Tudo organizado em 3 áreas",
    text:
      "Estúdio, Vendas e Gestão. Cada bolinha agrupa 2–4 telas — toque ou passe o mouse pra explorar.",
  },
  {
    target: "checklist",
    title: "4 passos pra vender",
    text:
      "Termine essa lista pra deixar sua loja pronta. Cada item leva à tela certa.",
  },
  {
    target: "marketplaces",
    title: "Conecte ML/Shopee",
    text:
      "Se você já vende em marketplaces, conecte sua conta aqui pra unificar pedidos.",
  },
  {
    target: "settings_revisions",
    title: "Sua política de revisões",
    text:
      "Diga quantas alterações de arte são grátis pro cliente.",
  },
];

export type StudioOnboardingProps = {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
};

export function StudioOnboarding({ visible, onClose, onComplete }: StudioOnboardingProps) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const [currentStep, setCurrentStep] = useState(0);
  const { width: vw, height: vh } = useWindowDimensions();
  const fade = useState(new Animated.Value(0))[0];

  // ─── Reset step quando reabre ─────────────────────────────
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      Animated.timing(fade, {
        toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    } else {
      fade.setValue(0);
    }
  }, [visible, fade]);

  // ─── Esc fecha (web) ──────────────────────────────────────
  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  const isLast = currentStep === STEPS.length - 1;
  const step = STEPS[currentStep];

  const next = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }, [isLast, onComplete]);

  if (!visible) return null;

  // Tooltip centralizado (parte B vai posicionar relativo ao target)
  const tooltipMaxW = Math.min(320, vw - 48);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[s.overlay, { opacity: fade }]}>
        {/* Backdrop clicável fecha (escape natural) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Tooltip flutuante */}
        <View style={[s.tooltipWrap, { maxWidth: tooltipMaxW }]}>
          {step.eyebrow && (
            <Text style={s.eyebrow}>{step.eyebrow}</Text>
          )}
          <Text style={s.title}>{step.title}</Text>
          <Text style={s.text}>{step.text}</Text>

          {/* Dots de progresso */}
          <View style={s.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  i === currentStep && s.dotActive,
                ]}
              />
            ))}
          </View>

          {/* Ações */}
          <View style={s.actions}>
            <Pressable style={s.skipBtn} onPress={onClose} accessibilityLabel="Pular tour">
              <Text style={s.skipTxt}>Pular tour</Text>
            </Pressable>
            <Pressable
              style={s.primaryBtn}
              onPress={next}
              accessibilityLabel={isLast ? "Começar" : "Próximo"}
            >
              <Text style={s.primaryTxt}>
                {isLast ? "Começar" : "Próximo →"}
              </Text>
            </Pressable>
          </View>

          {/* Target hint (debug-ish — parte B remove) */}
          {__DEV__ && (
            <Text style={s.debugTxt}>target: {step.target}</Text>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

export default StudioOnboarding;

// ─── Styles ─────────────────────────────────────────────────
const buildStyles = (t: StudioPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  tooltipWrap: {
    backgroundColor: t.paperCardElev,
    borderRadius: StudioRadiusV2.xl as number,
    padding: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: t.ink5,
    // sombra forte pra destacar do overlay
    shadowColor: "#0F172A",
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  eyebrow: {
    fontSize: 11,
    color: t.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: t.primary,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  text: {
    fontSize: 13.5,
    color: t.ink2,
    lineHeight: 19,
    marginBottom: 14,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.ink5,
  },
  dotActive: {
    width: 18,
    backgroundColor: t.accent,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },
  skipBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: t.ink5,
    backgroundColor: "transparent",
  },
  skipTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: t.ink3,
  },
  primaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: t.primary,
  },
  primaryTxt: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.2,
  },
  debugTxt: {
    fontSize: 10,
    color: t.ink4,
    marginTop: 10,
    fontStyle: "italic",
  },
});
