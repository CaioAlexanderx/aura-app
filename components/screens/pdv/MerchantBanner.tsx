// ============================================================
// AURA. -- PDV/Caixa · Merchant glass banner
// Wraps the existing BrandBanner inside a glass+orb hero container
// so logo configuration stays centralized (no duplicate upload).
// ============================================================
import { View, StyleSheet, Platform } from "react-native";
import { Colors, Glass } from "@/constants/colors";
import { BrandBanner } from "@/components/BrandBanner";
import { IS_WEB, webOnly } from "./types";

type Props = { height?: number };

export function MerchantBanner({ height = 180 }: Props) {
  const webBox = webOnly({
    background: Glass.merchantGrad,
    border: "1px solid " + Glass.lineBorderCard,
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    overflow: "hidden",
    animation: "caixaFadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both",
  });

  return (
    <View style={[s.banner, { height: height }, Platform.OS === "web" ? (webBox as any) : { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2 }]}>
      {IS_WEB && (
        <>
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(124,58,237,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.08) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage: "radial-gradient(ellipse at center, #000 20%, transparent 80%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, #000 20%, transparent 80%)",
              opacity: 0.6,
              pointerEvents: "none",
            } as any}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: "-40%",
              left: "50%",
              width: "80%",
              height: "200%",
              transform: "translateX(-50%)",
              background: "radial-gradient(ellipse, rgba(167,139,250,0.25), transparent 60%)",
              pointerEvents: "none",
              animation: "caixaHeroShift 14s ease-in-out infinite",
            } as any}
          />
        </>
      )}
      <View style={s.inner}>
        <BrandBanner mode="block" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    marginBottom: 18,
    borderRadius: 18,
    overflow: "hidden",
  },
  inner: {
    position: "relative",
    zIndex: 1,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
});

export default MerchantBanner;
