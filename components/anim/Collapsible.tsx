// ============================================================
// Collapsible — Aura · anim (F1 do redesign Crediário)
//
// Accordion com altura animada cross-platform (web + nativo):
// mede o conteúdo via onLayout e anima height 0 ↔ contentH + opacity,
// com Animated.Value/useNativeDriver:false (web-safe).
//
// Uso: <Collapsible open={expanded}> ...conteúdo... </Collapsible>
//
// 25/11/2026 (movimento do crediário): anima ABRIR e FECHAR. Fechado, o
// conteúdo NÃO fica na tela — antes ele ficava com altura 0 e os botões
// escondidos recebiam Tab e Enter (QA 23/11; por isso o ParcelaRow e o
// ConfirmGate deixaram de montá-lo fechado). Agora:
//  · abrindo: monta e cresce até a altura medida;
//  · fechando: o conteúdo fica inerte (sem toque, fora da leitura de tela,
//    fora do Tab) enquanto encolhe e é desmontado no fim;
//  · "menos movimento" no sistema: abre e fecha na hora.
// Se o conteúdo mudar de altura enquanto aberto, o onLayout atualiza a
// medida e o container acompanha.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, View, StyleProp, ViewStyle, LayoutChangeEvent } from "react-native";
import { Motion, duracao, useMenosMovimento } from "@/constants/motion";

interface CollapsibleProps {
  open:      boolean;
  children:  React.ReactNode;
  style?:    StyleProp<ViewStyle>;
  duration?: number;
  testID?:   string;
}

/** Tira o conteúdo da leitura de tela (web e nativo); o toque sai pelo
 *  style.pointerEvents (a prop está obsoleta no RNW). */
const SEM_TOQUE = { pointerEvents: "none" } as const;
const INERTE: any = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
  "aria-hidden": true,
};

export function Collapsible({ open, children, style, duration = Motion.slow, testID }: CollapsibleProps) {
  const menos = useMenosMovimento();
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [contentH, setContentH] = useState(0);
  // Montado enquanto aberto e durante a animação de fechar.
  const [montado, setMontado] = useState(open);
  if (open && !montado) setMontado(true);

  const caixaRef = useRef<any>(null);

  useEffect(() => {
    const a = Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: duracao(duration, menos),
      easing: Motion.easingRN,
      useNativeDriver: false,
    });
    a.start();
    // Desmonta pelo relógio, não pelo fim do Animated: no Jest o Animated
    // termina na hora (AnimatedMock) e o tempo da saída deixaria de valer.
    const fim = !open ? setTimeout(() => setMontado(false), duracao(duration, menos)) : null;
    return () => {
      a.stop();
      if (fim) clearTimeout(fim);
    };
  }, [open, anim, duration, menos]);

  // Web: `inert` tira os botões do Tab enquanto encolhe (o RNW não repassa
  // a prop, então vai direto no elemento).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = caixaRef.current as any;
    if (!el || typeof el.setAttribute !== "function") return;
    if (open) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [open]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - contentH) > 0.5) setContentH(h);
  };

  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(contentH, 0)] });
  // Com "menos movimento" fechar é na hora: nem um quadro do conteúdo.
  const mostra = montado && (open || !menos);

  return (
    <Animated.View
      ref={caixaRef}
      style={[{ overflow: "hidden" }, style, { height, opacity: anim }, !open && SEM_TOQUE]}
      testID={testID}
      {...(!open ? INERTE : null)}
    >
      {mostra && <View onLayout={onLayout}>{children}</View>}
    </Animated.View>
  );
}

export default Collapsible;
