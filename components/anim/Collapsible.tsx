// ============================================================
// Collapsible — Aura · anim (F1 do redesign Crediário)
//
// Accordion com altura animada cross-platform (web + nativo):
// mede o conteúdo via onLayout e anima height 0 ↔ contentH + opacity,
// com Animated.Value/useNativeDriver:false (web-safe).
//
// Uso: <Collapsible open={expanded}> ...conteúdo... </Collapsible>
//
// 25/11/2026 (movimento do crediário): anima ABRIR e FECHAR, na curva do
// app; "menos movimento" no sistema abre e fecha na hora. Fechado, o
// conteúdo fica INERTE: sem toque, fora da leitura de tela e fora do Tab
// (`inert` no web) — antes ele ficava com altura 0 e os botões escondidos
// recebiam Tab e Enter (QA 23/11).
//  · padrão: o conteúdo continua montado fechado (estado interno e dados
//    das telas que usam a sanfona — financeiro, karatê, lançamento — ficam);
//  · `desmontarFechado`: desmonta no fim da animação de fechar. Só para
//    conteúdo sem estado próprio (menus, listas do crediário).
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
  /** Desmonta o conteúdo no fim da animação de fechar (padrão: fica montado
   *  e inerte). */
  desmontarFechado?: boolean;
}

/** Tira o conteúdo da leitura de tela (web e nativo); o toque sai pelo
 *  style.pointerEvents (a prop está obsoleta no RNW). */
const SEM_TOQUE = { pointerEvents: "none" } as const;
const INERTE: any = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
  "aria-hidden": true,
};

export function Collapsible({
  open, children, style, duration = Motion.slow, testID, desmontarFechado = false,
}: CollapsibleProps) {
  const menos = useMenosMovimento();
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [contentH, setContentH] = useState(0);
  // Com `desmontarFechado`: montado enquanto aberto e durante a animação de
  // fechar. Sem ela, sempre montado.
  const [montado, setMontado] = useState(open || !desmontarFechado);
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
    const fim = !open && desmontarFechado
      ? setTimeout(() => setMontado(false), duracao(duration, menos))
      : null;
    return () => {
      a.stop();
      if (fim) clearTimeout(fim);
    };
  }, [open, anim, duration, menos, desmontarFechado]);

  // Web: `inert` tira os botões do Tab enquanto encolhe e fechado (o RNW não
  // repassa a prop, então vai direto no elemento).
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
  // Com "menos movimento" e `desmontarFechado`, fechar é na hora: nem um
  // quadro do conteúdo.
  const mostra = !desmontarFechado || (montado && (open || !menos));

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
