// ============================================================
// ConsultaTopbar — header da consulta ativa.
//
// Brand mark Aura Odonto + badge "Consulta ativa" pulsando +
// botao "Encerrar". Inspirado no mockup-modo-consulta-v3.html.
//
// Brand mark renderizado via dangerouslySetInnerHTML (mesmo
// padrao do DentalSidebar/PortalTransition) — Expo web only,
// nao precisa de react-native-svg.
// ============================================================

import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Easing, Platform } from "react-native";
import { DentalColors, SMILE_ARC_PATH } from "@/constants/dental-tokens";

interface Props {
  onEnd: () => void;
  onMinimize?: () => void; // back to (clinic) without ending
}

export function ConsultaTopbar({ onEnd, onMinimize }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const useNative = Platform.OS !== "web";

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: useNative, easing: Easing.linear }),
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: useNative, easing: Easing.linear }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, useNative]);

  return (
    <View style={{
      height: 50, paddingHorizontal: 14,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: DentalColors.surface,
      borderBottomWidth: 1, borderBottomColor: DentalColors.border,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{
          width: 26, height: 26, borderRadius: 7,
          backgroundColor: DentalColors.cyan,
          alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          <View
            // @ts-expect-error dangerouslySetInnerHTML so funciona no web
            dangerouslySetInnerHTML={{
              __html: `<svg width="16" height="16" viewBox="0 0 32 32" fill="none"><path d="${SMILE_ARC_PATH}" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`,
            }}
          />
        </View>
        <Text style={{ color: DentalColors.ink, fontSize: 12, fontWeight: "700" }}>
          Aura<Text style={{ color: DentalColors.cyan }}> Odonto</Text>
        </Text>
        <View style={{
          marginLeft: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
          backgroundColor: DentalColors.cyanDim,
          borderWidth: 1, borderColor: DentalColors.cyanBorder,
          flexDirection: "row", alignItems: "center", gap: 5,
        }}>
          <Animated.View style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: DentalColors.red,
            opacity: pulse,
          }} />
          <Text style={{ fontSize: 8, fontWeight: "700", color: DentalColors.cyan, letterSpacing: 1 }}>
            CONSULTA ATIVA
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 5 }}>
        {onMinimize && (
          <Pressable onPress={onMinimize} style={btnGhostStyle}>
            <Text style={{ color: DentalColors.ink2, fontSize: 10, fontWeight: "600" }}>— Minimizar</Text>
          </Pressable>
        )}
        <Pressable onPress={onEnd} style={btnDangerStyle}>
          <Text style={{ color: DentalColors.red, fontSize: 10, fontWeight: "700" }}>⏹ Encerrar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const btnGhostStyle = {
  backgroundColor: DentalColors.surface,
  borderWidth: 1,
  borderColor: DentalColors.border,
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 7,
};
const btnDangerStyle = {
  backgroundColor: "rgba(239,68,68,0.10)",
  borderWidth: 1,
  borderColor: "rgba(239,68,68,0.35)",
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 7,
};
