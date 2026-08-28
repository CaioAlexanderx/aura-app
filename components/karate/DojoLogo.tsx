// ============================================================
// AURA KARATÊ — Logo do DOJÔ (com monograma de fallback)
//
// QA 27/08/2026: a sidebar do dojô mostrava a logo da FPKT acima do nome do
// dojô — a federação ocupando a identidade de quem entrou. A FPKT segue sendo
// a marca DELA (KarateShell, carteirinha, certificados); na visão do dojô a
// marca é a do dojô.
//
// Nem todo dojô tem logo, e o vazio não pode virar buraco: sem logo o slot
// vira MONOGRAMA — iniciais do nome no traço Shoji (Mincho sobre vermelho
// suave). Sem emoji, sem ícone genérico de "imagem faltando".
//
// O quadrado (não círculo) é deliberado: é o mesmo slot que a FpktLogo
// ocupava, e logo de dojô costuma ser brasão/emblema — recortar em círculo
// come as pontas do desenho. resizeMode "contain" pela mesma razão.
//
// A URL vem do R2 e pode 404 (objeto removido, deploy fora de ordem): o
// onError cai no monograma em vez de deixar o quadro vazio.
// ============================================================
import React, { useState, useEffect } from "react";
import {
  View, Text, Image, StyleSheet, StyleProp, ViewStyle, TextStyle,
} from "react-native";
import { KarateColors, KarateFonts, ShojiPalette } from "@/constants/karateTheme";

/**
 * Iniciais do nome do dojô. Mesma sanitização de DojoShell/KarateShell:
 * pontuação nunca vira inicial ("Dojô Shotokan — Belém" → "DB", não "D—").
 */
export function dojoInitials(name: string): string {
  const clean = String(name || "").replace(/[^\p{L}\s]/gu, " ");
  const parts = clean.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface DojoLogoProps {
  /** Nome do dojô — origem das iniciais quando não há logo. */
  name: string;
  /** URL absoluta do R2 (dojo.logo_url). null/vazio → monograma. */
  logoUrl?: string | null;
  size?: number;
  /** Cantos: fração do lado. 0.25 casa com o slot da sidebar (36px → 9). */
  radiusRatio?: number;
  style?: StyleProp<ViewStyle>;
}

export function DojoLogo({
  name,
  logoUrl,
  size = 36,
  radiusRatio = 0.25,
  style,
}: DojoLogoProps) {
  const [failed, setFailed] = useState(false);

  // Trocar a logo muda a URL (o backend carimba ?v=timestamp). Sem este
  // reset, um erro antigo deixaria o monograma preso para sempre e o upload
  // novo pareceria não ter funcionado.
  useEffect(() => { setFailed(false); }, [logoUrl]);

  const radius = Math.round(size * radiusRatio);
  const showImage = Boolean(logoUrl) && !failed;

  const frame: ViewStyle = {
    width: size,
    height: size,
    borderRadius: radius,
  };

  if (showImage) {
    return (
      <View style={[styles.frame, styles.frameImage, frame, style]}>
        <Image
          source={{ uri: logoUrl as string }}
          onError={() => setFailed(true)}
          accessibilityLabel={`Logo do ${name}`}
          testID="dojo-logo-image"
          // resizeMode é PROP, não style: em style o react-native-web avisa
          // de deprecação e a regra pode sair sem aviso numa atualização.
          resizeMode="contain"
          style={{ width: "100%", height: "100%" }}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.frame, styles.frameMono, frame, style]}
      accessibilityLabel={name}
      testID="dojo-logo-monogram"
    >
      <Text
        style={[
          styles.initials,
          // Duas letras num quadrado pequeno: 0.36 mantém respiro nas bordas
          // sem virar texto miúdo no tamanho grande do Painel.
          { fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.46) },
        ]}
        numberOfLines={1}
      >
        {dojoInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
  } as ViewStyle,
  // Com logo o fundo é neutro: quem dá a cor é o desenho do dojô.
  frameImage: {
    backgroundColor: KarateColors.glass2,
    borderColor: KarateColors.border2,
  } as ViewStyle,
  // Sem logo o slot é da casa — vermelho suave, a mesma família do Seal 空.
  frameMono: {
    backgroundColor: ShojiPalette.redSoft,
    borderColor: ShojiPalette.redLine,
  } as ViewStyle,
  initials: {
    fontFamily: KarateFonts.heading,
    fontWeight: "500",
    color: ShojiPalette.red,
    letterSpacing: 0.5,
    textAlign: "center",
  } as TextStyle,
});

export default DojoLogo;
