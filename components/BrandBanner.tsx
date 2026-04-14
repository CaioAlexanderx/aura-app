import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";

const isWeb = Platform.OS === "web";

/**
 * BrandBanner — shows the client's logo prominently
 * Used in Dashboard and PDV (Caixa) to personalize the experience
 * Only renders when logo_url exists in company profile
 */
export function BrandBanner({ compact = false }: { compact?: boolean }) {
  const { company, isDemo } = useAuthStore();

  const { data: profile } = useQuery({
    queryKey: ["company-profile", company?.id],
    queryFn: () => companiesApi.getProfile(company!.id),
    enabled: !!company?.id && !isDemo,
    staleTime: 60000,
  });

  const logoUrl = profile?.logo_url || null;
  const tradeName = profile?.trade_name || profile?.legal_name || company?.name || "";

  if (!logoUrl) return null;

  if (compact) {
    return (
      <View style={s.compactWrap}>
        <View style={s.compactLogoBox}>
          <Image source={{ uri: logoUrl }} style={s.compactLogo} resizeMode="contain" />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.banner, isWeb && { transition: "opacity 0.3s ease" } as any]}>
      <View style={s.logoBox}>
        <Image source={{ uri: logoUrl }} style={s.logo} resizeMode="contain" />
      </View>
      {tradeName ? <Text style={s.name}>{tradeName}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 20,
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  logoBox: {
    width: 200,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 200,
    height: 64,
  },
  name: {
    fontSize: 11,
    color: Colors.ink3,
    fontWeight: "500",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  // Compact mode (PDV header)
  compactWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  compactLogoBox: {
    width: 120,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  compactLogo: {
    width: 120,
    height: 40,
  },
});

export default BrandBanner;
