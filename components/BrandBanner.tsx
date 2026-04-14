import { useState, useEffect } from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

var isWeb = Platform.OS === "web";

/**
 * BrandBanner — shows the client's logo
 * Gate: Negocio+ plans only
 * Uses native <img> on web with retry logic
 */

type Props = {
  mode?: "header" | "block" | "compact";
};

function WebImage({ src, width, height }: { src: string; width: number; height: number }) {
  var [loaded, setLoaded] = useState(false);
  var [error, setError] = useState(false);
  var [retried, setRetried] = useState(false);

  // Reset state when src changes
  useEffect(function() {
    setLoaded(false);
    setError(false);
    setRetried(false);
  }, [src]);

  if (error || !src) return null;

  // Add cache-busting on retry
  var imgSrc = retried ? src + (src.includes("?") ? "&" : "?") + "t=" + Date.now() : src;

  if (isWeb && typeof document !== "undefined") {
    return (
      <View style={{ width: width, height: height, alignItems: "center", justifyContent: "center" }}>
        {!loaded && <Text style={{ fontSize: 9, color: Colors.ink3 }}>Carregando...</Text>}
        <img
          src={imgSrc}
          alt="Logo da empresa"
          style={{
            maxWidth: width,
            maxHeight: height,
            objectFit: "contain" as any,
            display: loaded ? "block" : "none",
          }}
          onLoad={function() { setLoaded(true); }}
          onError={function() {
            if (!retried) {
              console.warn("[BrandBanner] Retrying image:", src);
              setRetried(true);
            } else {
              console.warn("[BrandBanner] Image failed after retry:", src);
              setError(true);
            }
          }}
        />
      </View>
    );
  }

  // Native fallback
  return (
    <Image
      source={{ uri: src }}
      style={{ width: width, height: height }}
      resizeMode="contain"
      onError={function() { console.warn("[BrandBanner] Native image failed:", src); setError(true); }}
    />
  );
}

export function BrandBanner({ mode = "block" }: Props) {
  var { logoUrl, plan } = useCompanyProfile();
  var canShow = plan === "negocio" || plan === "expansao" || plan === "personalizado";

  if (!canShow || !logoUrl) return null;

  if (mode === "header") {
    return (
      <View style={s.headerWrap}>
        <WebImage src={logoUrl} width={160} height={48} />
      </View>
    );
  }

  if (mode === "compact") {
    return (
      <View style={s.compactWrap}>
        <WebImage src={logoUrl} width={120} height={36} />
      </View>
    );
  }

  // block mode
  return (
    <View style={s.blockWrap}>
      <WebImage src={logoUrl} width={180} height={52} />
    </View>
  );
}

var s = StyleSheet.create({
  headerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
    minHeight: 48,
  },
  blockWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 76,
  },
  compactWrap: {
    alignItems: "center",
    marginBottom: 10,
  },
});

export default BrandBanner;
