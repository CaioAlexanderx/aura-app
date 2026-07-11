// ============================================================
// RosterValidationBanner — Aura Karatê (federação) · Shoji
//
// Banner de estado da validação de quadro (GET roster-validation) no
// detalhe do dojô: pendente (link + copiar/whatsapp) ou validado (nota
// discreta com check). Extraído de
// app/karate/(federation)/dojos/[dojoId].tsx no polish de motion
// (feat/karate-polish-federacao) — MESMO comportamento/contrato de API
// de antes, só apresentação/motion.
//
// Motion: entrada slide-down + fade ao montar. No estado pendente, o
// botão "Copiar link" pulsa bem discretamente (scale 1↔1.045, loop) pra
// chamar atenção sem irritar — para assim que a federação copia/sai do
// pendente (unmount) ou se prefers-reduced-motion. No validado, o ícone
// de check faz um scale-in único (spring) a cada vez que o estado passa
// a ser "validated". Hover nos botões (copiar/WhatsApp), só web.
//
// IMPORTANTE: o mesmo componente pode transicionar pending → validated
// sem desmontar (a tela host só troca o `status` depois de recarregar) —
// por isso TODOS os hooks ficam no topo, incondicionais (Rules of Hooks);
// só o JSX final é que ramifica por status.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, Animated, Platform, Easing } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { Motion, webTransition } from "@/constants/motion";
import { Card, Body } from "@/components/karate/shoji";
import { usePrefersReducedMotion } from "@/components/karate/anim/useReducedMotion";

const IS_WEB = Platform.OS === "web";
const OK = P.ok ?? "#2d8a4e";

export type RosterValidationStatus = "pending" | "validated";

interface Props {
  status: RosterValidationStatus;
  requestedAtLabel: string | null;
  validatedAtLabel: string | null;
  validatedBy: string | null;
  url: string | null;
  onCopyLink: () => void;
  onShareWhatsApp: () => void;
  style?: ViewStyle;
}

export function RosterValidationBanner({
  status, requestedAtLabel, validatedAtLabel, validatedBy, url, onCopyLink, onShareWhatsApp, style,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const enter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const checkScale = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  // Entrada do banner: slide-down + fade, uma vez por montagem.
  useEffect(() => {
    if (reducedMotion) { enter.setValue(1); return; }
    const anim = Animated.timing(enter, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check do estado validado: scale-in toda vez que `status` (re)entra em "validated".
  useEffect(() => {
    if (status !== "validated") return;
    if (reducedMotion) { checkScale.setValue(1); return; }
    checkScale.setValue(0.4);
    Animated.spring(checkScale, { toValue: 1, friction: 6, tension: 170, useNativeDriver: false }).start();
  }, [status, reducedMotion, checkScale]);

  const entryStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
  };

  if (status === "pending") {
    return (
      <Animated.View style={[{ marginTop: SP[6] }, style, entryStyle]}>
        <Card style={{ borderColor: P.line2 }}>
          <View style={styles.row}>
            <Icon name="alert-circle" size={16} color={P.warn} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                Quadro pendente de validação — solicitado em {requestedAtLabel || "—"}
              </Text>
              {url ? (
                <View style={styles.linkRow}>
                  <Text style={styles.link} numberOfLines={1}>{url}</Text>
                  <PulsingLinkButton
                    icon="copy-outline"
                    label="Copiar link"
                    onPress={onCopyLink}
                    active={!reducedMotion}
                    accessibilityLabel="Copiar link"
                  />
                  <HoverButton
                    icon="logo-whatsapp"
                    label="WhatsApp"
                    onPress={onShareWhatsApp}
                    accessibilityLabel="Abrir no WhatsApp"
                  />
                </View>
              ) : null}
            </View>
          </View>
        </Card>
      </Animated.View>
    );
  }

  // validated
  return (
    <Animated.View style={[{ marginTop: SP[4] }, style, entryStyle]}>
      <View style={styles.validatedRow}>
        <Animated.View style={{ transform: [{ scale: checkScale }] }}>
          <Icon name="checkmark-circle" size={15} color={OK} />
        </Animated.View>
        <Body muted>
          Quadro validado em {validatedAtLabel || "—"}{validatedBy ? ` por ${validatedBy}` : ""}
        </Body>
      </View>
    </Animated.View>
  );
}

export default RosterValidationBanner;

// Botão "Copiar link" — pulso bem discreto (loop) enquanto `active`
// (status pendente e sem reduced-motion). Hover separado do pulso pra não
// misturar transforms (pulso no wrapper, hover no Pressable interno).
function PulsingLinkButton({
  icon, label, onPress, active, accessibilityLabel,
}: { icon: string; label: string; onPress: () => void; active: boolean; accessibilityLabel: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!active) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.045, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <Pressable
        onPress={onPress}
        onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
        onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.btn,
          hovered && ({ transform: [{ translateY: -1 }], ...(IS_WEB ? ({ boxShadow: "0 3px 10px -4px rgba(43,38,32,0.30)" } as any) : null) } as any),
          IS_WEB ? (webTransition(["transform", "box-shadow", "background-color"], Motion.fast) as any) : null,
        ]}
      >
        <Icon name={icon} size={13} color={C.ink} />
        <Text style={styles.btnTxt}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function HoverButton({
  icon, label, onPress, accessibilityLabel,
}: { icon: string; label: string; onPress: () => void; accessibilityLabel: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={IS_WEB ? () => setHovered(true) : undefined}
      onHoverOut={IS_WEB ? () => setHovered(false) : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.btn,
        hovered && ({ transform: [{ translateY: -1 }], ...(IS_WEB ? ({ boxShadow: "0 3px 10px -4px rgba(43,38,32,0.30)" } as any) : null) } as any),
        IS_WEB ? (webTransition(["transform", "box-shadow", "background-color"], Motion.fast) as any) : null,
      ]}
    >
      <Icon name={icon} size={13} color={C.ink} />
      <Text style={styles.btnTxt}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  title: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink } as TextStyle,
  linkRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 } as ViewStyle,
  link: { fontFamily: F.mono, fontSize: 12, color: C.ink2, flexShrink: 1, minWidth: 120, maxWidth: 320 } as TextStyle,
  btn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glass2 } as ViewStyle,
  btnTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink } as TextStyle,
  validatedRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
});
