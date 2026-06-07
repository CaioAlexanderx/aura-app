// ============================================================
// KarateShell — Aura Karatê
//
// Shell responsivo (mobile: bottom-tabs + topbar; web: sidebar).
// Usa expo-router Slot para renderizar a tela ativa.
// Cores Shoji: vermelho primary, fundo paper.
//
// Track B: adicionado item Financeiro à navegação.
// Track C: adicionado item Eventos à navegação.
// ============================================================
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ViewStyle,
  TextStyle,
  SafeAreaView,
} from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, ShojiPalette } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";

const NAV_ITEMS = [
  { label: "Dashboard",  icon: "grid-outline",        route: "/(karate)/" },
  { label: "Dojôs",      icon: "home-outline",         route: "/(karate)/dojos" },
  { label: "Praticantes",icon: "people-outline",       route: "/(karate)/praticantes" },
  { label: "Financeiro", icon: "card-outline",         route: "/(karate)/financeiro" },
  { label: "Eventos",    icon: "calendar-outline",     route: "/(karate)/eventos" },
  { label: "Importar",   icon: "cloud-upload-outline", route: "/(karate)/importacao" },
] as const;

const BREAKPOINT_SIDEBAR = 768;

function SidebarNav() {
  const router = useRouter();
  const path   = usePathname();
  const { federationName } = useKarateFederation();

  return (
    <View style={styles.sidebar}>
      {/* Logo / Brand */}
      <View style={styles.sidebarHeader}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>FK</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandTitle}>Aura Karatê</Text>
          <Text style={styles.brandSub} numberOfLines={1}>{federationName}</Text>
        </View>
      </View>

      {/* Navigation */}
      {NAV_ITEMS.map((item) => {
        const active = path.startsWith(item.route.replace("/(karate)", "/karate"));
        return (
          <TouchableOpacity
            key={item.route}
            style={[styles.sidebarItem, active && styles.sidebarItemActive]}
            onPress={() => router.push(item.route as any)}
            accessibilityRole="link"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={item.icon as any}
              size={18}
              color={active ? KarateColors.primary : KarateColors.ink3}
            />
            <Text style={[styles.sidebarItemLabel, active && styles.sidebarItemLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function BottomTabNav() {
  const router = useRouter();
  const path   = usePathname();

  // On mobile, show 5 tabs max; hide Importar to keep it tidy
  const MOBILE_TABS = NAV_ITEMS.filter((i) => i.label !== "Importar");

  return (
    <View style={styles.bottomBar}>
      {MOBILE_TABS.map((item) => {
        const active = path.startsWith(item.route.replace("/(karate)", "/karate"));
        return (
          <TouchableOpacity
            key={item.route}
            style={styles.tabItem}
            onPress={() => router.push(item.route as any)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={item.icon as any}
              size={22}
              color={active ? KarateColors.primary : KarateColors.ink4}
            />
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function KarateShell() {
  const { width } = useWindowDimensions();
  const isWide    = Platform.OS === "web" && width >= BREAKPOINT_SIDEBAR;

  if (isWide) {
    return (
      <View style={styles.wideContainer}>
        <SidebarNav />
        <View style={styles.content}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.mobileContainer}>
      {/* Topbar */}
      <View style={styles.topbar}>
        <Text style={styles.topbarTitle}>Aura Karatê</Text>
      </View>
      <View style={styles.content}>
        <Slot />
      </View>
      <BottomTabNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wideContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: KarateColors.bg,
  } as ViewStyle,
  mobileContainer: {
    flex: 1,
    backgroundColor: KarateColors.bg,
  } as ViewStyle,
  content: {
    flex: 1,
    overflow: "hidden" as any,
  } as ViewStyle,

  // Sidebar
  sidebar: {
    width: 220,
    backgroundColor: KarateColors.bg2,
    borderRightWidth: 1,
    borderRightColor: KarateColors.border,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 4,
  } as ViewStyle,
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: KarateColors.border,
    marginBottom: 8,
  } as ViewStyle,
  logoMark: {
    width: 36, height: 36,
    borderRadius: KarateRadius.sm,
    backgroundColor: KarateColors.primary,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  logoText:         { fontSize: 13, fontWeight: "900", color: "#fff", letterSpacing: 0.5 } as TextStyle,
  brandTitle:       { fontSize: 13, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  brandSub:         { fontSize: 10, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: KarateRadius.sm,
  } as ViewStyle,
  sidebarItemActive:      { backgroundColor: KarateColors.primarySoft } as ViewStyle,
  sidebarItemLabel:       { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  sidebarItemLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,

  // Topbar mobile
  topbar: {
    height: 52,
    backgroundColor: KarateColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  } as ViewStyle,
  topbarTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  } as TextStyle,

  // Bottom tabs
  bottomBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: KarateColors.border,
    backgroundColor: KarateColors.bg,
    paddingBottom: Platform.OS === "ios" ? 16 : 6,
  } as ViewStyle,
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingTop: 8,
    gap: 2,
  } as ViewStyle,
  tabLabel:       { fontSize: 10, color: KarateColors.ink4, fontWeight: "600" } as TextStyle,
  tabLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
});
