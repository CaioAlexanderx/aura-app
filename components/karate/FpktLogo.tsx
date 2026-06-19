// ============================================================
// FpktLogo — logo oficial da Federação Paulista de Karatê-Dô
// Tradicional (FPKT). Bitmap aprovado (pirâmide com faixas + estrelas),
// fundo transparente. Usado nos headers internos (shell da federação),
// externos (microsite público) e na carteirinha oficial.
//
// Proporção do bitmap ≈ 1 : 0.95 (largura : altura).
// ============================================================
import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FPKT_SRC = require("../../assets/karate/logo-fpkt.png");

export function FpktLogo({ size = 88, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={FPKT_SRC}
      accessibilityLabel="FPKT — Federação Paulista de Karatê-Dô Tradicional"
      style={[{ width: size, height: Math.round(size * 0.95), resizeMode: "contain" }, style]}
    />
  );
}

export default FpktLogo;
