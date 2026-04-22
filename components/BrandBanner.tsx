// ============================================================
// AURA. — BrandBanner (redesign 22/04)
// Componente que exibe a logo do cliente (empresa) em 3 modes.
// Adaptativo: logo quadrada (icon-style) e horizontal (wordmark)
// sao suportadas automaticamente via CSS `width: auto + objectFit`.
// Sem medicao manual de aspect ratio.
// ============================================================
import { useState, useEffect } from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

var isWeb = Platform.OS === "web";

type Mode = "header" | "block" | "compact";

type Props = {
  mode?: Mode;
};

// Tamanhos por mode — altura fixa, largura adapta ao aspect real da imagem
// (pro web: height + width:auto). Fallback usa lado quadrado do `fallbackSize`.
var SIZES = {
  header:  { imageHeight: 52,  maxImageWidth: 200, fallbackSize: 48  },
  block:   { imageHeight: 88,  maxImageWidth: 520, fallbackSize: 100 },
  compact: { imageHeight: 42,  maxImageWidth: 160, fallbackSize: 40  },
} as const;

function getInitials(name: string) {
  if (!name) return "A";
  var parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function LogoFallback({ name, size }: { name: string; size: number }) {
  var initials = getInitials(name);
  var fontSize = Math.round(size * 0.36);
  var radius = Math.round(size * 0.2);
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: radius,
      backgroundColor: Colors.violetD,
      borderWidth: 1.5,
      borderColor: Colors.violet3 + "40",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <Text style={{
        fontSize: fontSize,
        fontWeight: "800",
        color: Colors.violet3,
        letterSpacing: 1,
      }}>
        {initials}
      </Text>
    </View>
  );
}

function LogoImage({ src, sizes, fallbackName }: {
  src: string;
  sizes: typeof SIZES[Mode];
  fallbackName: string;
}) {
  var [error, setError] = useState(false);

  // Reset error quando src muda
  useEffect(function() { setError(false); }, [src]);

  if (error) {
    return <LogoFallback name={fallbackName} size={sizes.fallbackSize} />;
  }

  // Web: usa <img> com height fixa + width auto + objectFit contain.
  // Isso deixa o CSS adaptar a largura ao aspect natural da logo,
  // suportando logos quadradas (Icon.png) e horizontais (wordmark "FINESSE")
  // sem configuracao manual.
  if (isWeb) {
    return (
      <img
        src={src}
        alt="Logo da empresa"
        style={{
          height: sizes.imageHeight,
          width: "auto",
          maxWidth: sizes.maxImageWidth,
          objectFit: "contain" as any,
          display: "block",
        } as any}
        onError={function() { setError(true); }}
      />
    );
  }

  // Native: sem auto-width nativo, assume horizontal e usa resizeMode contain.
  // Se a logo for quadrada, vai ficar centralizada dentro do container retangular.
  return (
    <Image
      source={{ uri: src }}
      style={{ width: sizes.maxImageWidth, height: sizes.imageHeight }}
      resizeMode="contain"
      onError={function() { setError(true); }}
    />
  );
}

export function BrandBanner({ mode = "block" }: Props) {
  var { logoUrl, plan, tradeName } = useCompanyProfile();
  var canShow = plan === "negocio" || plan === "expansao" || plan === "personalizado";
  if (!canShow) return null;

  var sizes = SIZES[mode];

  var inner = logoUrl
    ? <LogoImage src={logoUrl} sizes={sizes} fallbackName={tradeName} />
    : <LogoFallback name={tradeName} size={sizes.fallbackSize} />;

  // Block mode (PDV, landing pages): card destacado com a logo em tamanho generoso.
  // Card tem maxWidth controlado (600px) e centraliza no container pai —
  // evita "banner vazio" em telas wide (bug anterior: logo perdida em 1200px+ de largura).
  if (mode === "block") {
    return (
      <View style={s.blockWrap}>
        {inner}
      </View>
    );
  }

  // Header mode (dashboard): inline, sem card, centralizado.
  if (mode === "header") {
    return (
      <View style={s.headerWrap}>
        {inner}
      </View>
    );
  }

  // Compact mode: inline compacto.
  return (
    <View style={s.compactWrap}>
      {inner}
    </View>
  );
}

var s = StyleSheet.create({
  blockWrap: {
    alignSelf: "center",
    maxWidth: 600,
    width: "100%",
    minHeight: 128,
    backgroundColor: Colors.bg3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  headerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
    minHeight: 52,
  },
  compactWrap: {
    alignItems: "center",
    marginBottom: 10,
  },
});

export default BrandBanner;
