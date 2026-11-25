// ============================================================
// Presenca — Aura · anim (25/11/2026, movimento do crediário)
//
// Entrada E saída de um painel que abre por cima (Receber, Pix, Mudar as
// parcelas, Mudar a data, Limite, Imprimir, Juntar):
//  · entra: fade + scale 0,96 → 1 em Motion.slow (280 ms), como o ModalPop;
//  · sai: fade + scale 1 → 0,98 em Motion.base (200 ms), CONTINUANDO
//    montado até o fim — antes o painel sumia seco;
//  · durante a saída: sem toque, fora da leitura de tela e do Tab, e com o
//    último conteúdo de quando estava aberto (o estado que o alimentava
//    pode já ter virado null);
//  · "menos movimento" no sistema: entra e sai na hora.
//
// Uso: <Presenca visivel={!!alvo} style={m.panel}> ...conteúdo... </Presenca>
// (no lugar de `{alvo && <View style={m.panel}><ModalPop visible>…`)
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleProp, ViewStyle } from "react-native";
import { Motion, duracao, useMenosMovimento } from "@/constants/motion";

interface PresencaProps {
  visivel:   boolean;
  children:  React.ReactNode;
  style?:    StyleProp<ViewStyle>;
  testID?:   string;
  entrada?:  number;
  saida?:    number;
}

const SEM_TOQUE = { pointerEvents: "none" } as const;
const INERTE: any = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
  "aria-hidden": true,
};

export function Presenca({
  visivel, children, style, testID, entrada = Motion.slow, saida = Motion.base,
}: PresencaProps) {
  const menos = useMenosMovimento();
  const opacidade = useRef(new Animated.Value(visivel && !menos ? 0 : 1)).current;
  const escala = useRef(new Animated.Value(visivel && !menos ? 0.96 : 1)).current;
  const [montado, setMontado] = useState(visivel);
  if (visivel && !montado) setMontado(true);

  // O conteúdo de quando estava aberto: na saída é ele que aparece.
  const ultimo = useRef<React.ReactNode>(children);
  if (visivel) ultimo.current = children;

  const caixaRef = useRef<any>(null);

  useEffect(() => {
    if (visivel) {
      opacidade.setValue(menos ? 1 : 0);
      escala.setValue(menos ? 1 : 0.96);
      const a = Animated.parallel([
        Animated.timing(opacidade, { toValue: 1, duration: duracao(entrada, menos), easing: Motion.easingRN, useNativeDriver: false }),
        Animated.timing(escala, { toValue: 1, duration: duracao(entrada, menos), easing: Motion.easingRN, useNativeDriver: false }),
      ]);
      a.start();
      return () => a.stop();
    }
    if (menos) {
      setMontado(false);
      return;
    }
    const a = Animated.parallel([
      Animated.timing(opacidade, { toValue: 0, duration: saida, easing: Motion.easingRN, useNativeDriver: false }),
      Animated.timing(escala, { toValue: 0.98, duration: saida, easing: Motion.easingRN, useNativeDriver: false }),
    ]);
    a.start();
    // Desmonta pelo relógio, não pelo fim do Animated: no Jest o Animated
    // termina na hora (AnimatedMock) e a saída deixaria de valer.
    const fim = setTimeout(() => setMontado(false), saida);
    return () => {
      a.stop();
      clearTimeout(fim);
    };
    // Só a mudança de `visivel` dispara a animação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel]);

  // Web: `inert` tira os botões do Tab durante a saída.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = caixaRef.current as any;
    if (!el || typeof el.setAttribute !== "function") return;
    if (visivel) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [visivel, montado]);

  if (!montado || (!visivel && menos)) return null;

  return (
    <Animated.View
      ref={caixaRef}
      style={[style, { opacity: opacidade, transform: [{ scale: escala }] }, !visivel && SEM_TOQUE]}
      testID={testID}
      {...(!visivel ? INERTE : null)}
    >
      {visivel ? children : ultimo.current}
    </Animated.View>
  );
}

export default Presenca;
