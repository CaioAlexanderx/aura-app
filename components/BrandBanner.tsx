import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { companiesApi } from "@/services/api";

const isWeb = Platform.OS === "web";

/**
 * BrandBanner - shows the client's logo
 * Modes:
 *   "header" — inline in dashboard header (logo only, no card)
 *   "block"  — standalone card between title and content (PDV)
 *   "compact" — small logo only
 * Gate: Only renders for plan negocio or expansao
 */

type Props = {
  mode?: "header" | "block" | "compact";
  onProfileLoaded?: (profile: { trade_name?: string; legal_name?: string; logo_url?: string }) => void;
};

export function BrandBanner({ mode = "block", onProfileLoaded }: Props) {
  const { company, isDemo } = useAuthStore();
  const plan = (company?.plan || "essencial").toLowerCase();
  const canShow = plan === "negocio" || plan === "expansao" || plan === "personalizado";

  const { data: profile } = useQuery({
    queryKey: ["company-profile", company?.id],
    queryFn: () => companiesApi.getProfile(company!.id),
    enabled: !!company?.id && !isDemo,
    staleTime: 60000,
    // Always fetch profile for sync, even if logo won't show
  });

  // Notify parent of profile data for sync
  if (profile && onProfileLoaded) {
    onProfileLoaded(profile);
  }

  const logoUrl = profile?.logo_url || null;
  if (!canShow || !logoUrl) return null;

  if (mode === "header") {
    return (
      <View style={s.headerWrap}>
        <Image source={{ uri: logoUrl }} style={s.headerLogo} resizeMode="contain" />
      </View>
    );
  }

  if (mode === "compact") {
    return (
      <View style={s.compactWrap}>
        <Image source={{ uri: logoUrl }} style={s.compactLogo} resizeMode="contain" />
      </View>
    );
  }

  // block mode (PDV)
  return (
    <View style={[s.blockWrap, isWeb && { transition: "opacity 0.3s ease" } as any]}>
      <Image source={{ uri: logoUrl }} style={s.blockLogo} resizeMode="contain" />
    </View>
  );
}

const s = StyleSheet.create({
  // Header mode — inline in dashboard header row
  headerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
  },
  headerLogo: {
    width: 160,
    height: 48,
  },
  // Block mode — standalone between title and content
  blockWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: Colors.bg3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blockLogo: {
    width: 180,
    height: 52,
  },
  // Compact — small logo
  compactWrap: {
    alignItems: "center",
    marginBottom: 10,
  },
  compactLogo: {
    width: 120,
    height: 36,
  },
});

export default BrandBanner;
