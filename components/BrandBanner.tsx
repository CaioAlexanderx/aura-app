import { useState, useEffect } from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

var isWeb = Platform.OS === "web";

type Props = {
  mode?: "header" | "block" | "compact";
};

function getInitials(name: string) {
  if (!name) return "A";
  var parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function LogoFallback({ name, width, height }: { name: string; width: number; height: number }) {
  var initials = getInitials(name);
  var size = Math.min(width, height);
  var fontSize = Math.round(size * 0.35);
  return (
    <View style={{ width: width, height: height, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size * 0.8, height: size * 0.8, borderRadius: size * 0.15, backgroundColor: Colors.violetD, borderWidth: 1.5, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: fontSize, fontWeight: "800", color: Colors.violet3, letterSpacing: 1 }}>{initials}</Text>
      </View>
    </View>
  );
}

function WebImage({ src, width, height, fallbackName }: { src: string; width: number; height: number; fallbackName: string }) {
  var [loaded, setLoaded] = useState(false);
  var [error, setError] = useState(false);
  var [retried, setRetried] = useState(false);

  useEffect(function() {
    setLoaded(false);
    setError(false);
    setRetried(false);
  }, [src]);

  if (!src || error) return <LogoFallback name={fallbackName} width={width} height={height} />;

  var imgSrc = retried ? src + (src.includes("?") ? "&" : "?") + "t=" + Date.now() : src;

  if (isWeb && typeof document !== "undefined") {
    return (
      <View style={{ width: width, height: height, alignItems: "center", justifyContent: "center" }}>
        {!loaded && <LogoFallback name={fallbackName} width={width} height={height} />}
        <img
          src={imgSrc}
          alt="Logo da empresa"
          style={{
            maxWidth: width,
            maxHeight: height,
            objectFit: "contain" as any,
            display: loaded ? "block" : "none",
            position: loaded ? "relative" : "absolute" as any,
          }}
          onLoad={function() { setLoaded(true); }}
          onError={function() {
            if (!retried) {
              setRetried(true);
            } else {
              setError(true);
            }
          }}
        />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: src }}
      style={{ width: width, height: height }}
      resizeMode="contain"
      onError={function() { setError(true); }}
    />
  );
}

export function BrandBanner({ mode = "block" }: Props) {
  var { logoUrl, plan, tradeName } = useCompanyProfile();
  var canShow = plan === "negocio" || plan === "expansao" || plan === "personalizado";

  if (!canShow) return null;

  // Show logo if available, otherwise show fallback with initials
  var showFallback = !logoUrl;

  if (mode === "header") {
    return (
      <View style={s.headerWrap}>
        {showFallback
          ? <LogoFallback name={tradeName} width={160} height={48} />
          : <WebImage src={logoUrl!} width={160} height={48} fallbackName={tradeName} />}
      </View>
    );
  }

  if (mode === "compact") {
    return (
      <View style={s.compactWrap}>
        {showFallback
          ? <LogoFallback name={tradeName} width={120} height={36} />
          : <WebImage src={logoUrl!} width={120} height={36} fallbackName={tradeName} />}
      </View>
    );
  }

  // block mode
  return (
    <View style={s.blockWrap}>
      {showFallback
        ? <LogoFallback name={tradeName} width={180} height={52} />
        : <WebImage src={logoUrl!} width={180} height={52} fallbackName={tradeName} />}
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
