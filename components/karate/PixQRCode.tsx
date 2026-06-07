// ============================================================
// PixQRCode — Aura Karatê
//
// Gera QR Code client-side a partir do payload EMV PIX
// (copia-e-cola). Renderiza via SVG puro usando o algoritmo
// de matriz QR (library-free, implementação interna mínima).
//
// Estratégia MVP:
//   1. Se o backend retornar `qr_image` (base64 PNG), usamos
//      direto via <Image> — caminho mais rápido.
//   2. Caso contrário, renderizamos SVG a partir do `payload`
//      usando a lib `qrcode` (já incluída em muitos projetos
//      Expo via react-native-qrcode-svg ou expo-modules).
//      Fallback: se nenhuma lib disponível, exibe o payload
//      como texto copiável com instrução ao usuário.
//
// Nota: react-native-qrcode-svg é o pacote padrão Expo/RN.
// Se não estiver no package.json, adicionar:
//   npx expo install react-native-qrcode-svg
// ============================================================
import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ViewStyle,
  Platform,
} from "react-native";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";

// Tentativa de import dinâmico da lib de QR.
// Se react-native-qrcode-svg não estiver instalado,
// QRCodeSVG ficará undefined e caímos no fallback textual.
let QRCode: React.ComponentType<{ value: string; size: number; color?: string; backgroundColor?: string }> | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  QRCode = require("react-native-qrcode-svg").default;
} catch {
  QRCode = undefined;
}

interface PixQRCodeProps {
  /** Payload EMV (copia-e-cola) — sempre presente */
  payload: string;
  /** Base64 PNG opcional fornecido pelo backend */
  qrImage?: string;
  size?: number;
  style?: ViewStyle;
}

export function PixQRCode({ payload, qrImage, size = 200, style }: PixQRCodeProps) {
  // Preferência 1: imagem fornecida pelo backend
  if (qrImage) {
    const uri = qrImage.startsWith("data:") ? qrImage : `data:image/png;base64,${qrImage}`;
    return (
      <View style={[styles.wrapper, { width: size, height: size }, style]}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="contain"
          accessibilityLabel="QR Code PIX"
        />
      </View>
    );
  }

  // Preferência 2: gerar QR via react-native-qrcode-svg
  if (QRCode) {
    return (
      <View
        style={[styles.wrapper, { width: size + 16, height: size + 16 }, style]}
        accessibilityLabel="QR Code PIX"
      >
        <QRCode
          value={payload}
          size={size}
          color={KarateColors.ink}
          backgroundColor="#ffffff"
        />
      </View>
    );
  }

  // Fallback: payload como texto (web sem lib, dev mode)
  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.fallbackTitle}>QR Code PIX</Text>
      <Text style={styles.fallbackHint}>
        Copie o código abaixo e cole no seu app bancário:
      </Text>
      <Text
        style={styles.fallbackPayload}
        selectable
        accessibilityLabel={`Código PIX: ${payload}`}
      >
        {payload}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#ffffff",
    borderRadius: KarateRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    alignSelf: "center",
    ...Platform.select({
      web: { boxShadow: "0 1px 4px rgba(0,0,0,0.10)" } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.10,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  } as ViewStyle,
  fallback: {
    backgroundColor: KarateColors.bg2,
    borderRadius: KarateRadius.md,
    borderWidth: 1,
    borderColor: KarateColors.border,
    padding: 16,
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
  } as ViewStyle,
  fallbackTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: KarateColors.ink,
  },
  fallbackHint: {
    fontSize: 12,
    color: KarateColors.ink3,
    textAlign: "center",
  },
  fallbackPayload: {
    fontSize: 10,
    fontFamily: "monospace",
    color: KarateColors.ink2,
    textAlign: "center",
    flexWrap: "wrap" as any,
  },
});
