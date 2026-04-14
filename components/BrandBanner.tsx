import { useState, useEffect } from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

const isWeb = Platform.OS === "web";

/**
 * BrandBanner — shows the client's logo
 * Gate: Negocio+ plans only
 * Uses native <img> on web for reliability (RN Image fails silently)
 */

type Props = {
  mode?: "header" | "block" | "compact";
};

function WebImage({ src, width, height }: { src: string; width: number; height: number }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error || !src) return null;

  if (isWeb && typeof document !== "undefined") {
    return (
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        {!loaded && <Text style={{ fontSize: 10, color: Colors.ink3 }}>...</Text>}
        <img
          src={src}
          alt="Logo"
          style={{
            maxWidth: width,
            maxHeight: height,
            objectFit: "contain" as any,
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
          onLoad={() => setLoaded(true)}
          onError={() => { console.warn("[BrandBanner] Image failed:", src); setError(true); }}
        />
      </View>
    );
  }

  // Native fallback
  return (
    <Image
      source={{ uri: src }}
      style={{ width, height }}
      resizeMode="contain"
      onError={() => { console.warn("[BrandBanner] Image failed:", src); setError(true); }}
    />
  );
}

export function BrandBanner({ mode = "block" }: Props) {
  const { logoUrl, plan } = useCompanyProfile();
  const canShow = plan === "negocio" || plan === "expansao" || plan === "personalizado";

  // Debug logging (remove after confirmed working)
  useEffect(() => {
    if (isWeb) {
      console.log("[BrandBanner]", { mode, plan, canShow, logoUrl: logoUrl?.substring(0, 60) });
    }
  }, [logoUrl, plan]);

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

const s = StyleSheet.create({
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
