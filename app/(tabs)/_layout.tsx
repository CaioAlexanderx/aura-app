import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Image } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";

const LOGO_URL = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Aura.jpeg";

const NAV = [
  { section: "Principal", items: [
    { route: "/", label: "Painel", icon: "P" },
    { route: "/financeiro", label: "Financeiro", icon: "F" },
    { route: "/nfe", label: "NF-e", icon: "N" },
  ]},
  { section: "Contabil", items: [
    { route: "/contabilidade", label: "Contabilidade", icon: "C" },
  ]},
  { section: "Vendas", items: [
    { route: "/pdv", label: "PDV", icon: "$" },
    { route: "/estoque", label: "Estoque", icon: "E" },
  ]},
  { section: "Clientes", items: [
    { route: "/clientes", label: "Clientes", icon: "U" },
  ]},
];

const MOBILE_TABS = [
  { route: "/", label: "Painel", icon: "P" },
  { route: "/pdv", label: "PDV", icon: "$" },
  { route: "/financeiro", label: "Fin", icon: "F" },
  { route: "/clientes", label: "Clientes", icon: "U" },
  { route: "/contabilidade", label: "Contabil", icon: "C" },
];

function isActive(pathname: string, route: string): boolean {
  if (route === "/") return pathname === "/" || pathname === "" || pathname.endsWith("/index") || pathname === "/(tabs)";
  const segment = route.replace("/", "");
  return pathname.includes(segment);
}

// ── Sidebar (Web) ────────────────────────────────────────────

function SidebarItem({ label, icon, active, onPress }: {
  label: string; icon: string; active: boolean; onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        si.item,
        active && si.active,
        hovered && !active && si.hovered,
        { transition: "all 0.15s ease" } as any,
      ]}
    >
      <View style={[si.iconBox, active && si.iconBoxActive]}>
        <Text style={[si.icon, active && si.iconActive]}>{icon}</Text>
      </View>
      <Text style={[si.label, active && si.labelActive, hovered && !active && si.labelHovered]}>{label}</Text>
    </Pressable>
  );
}
const si = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2 },
  active: { backgroundColor: Colors.violetD },
  hovered: { backgroundColor: "rgba(255,255,255,0.03)" },
  iconBox: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center" },
  iconBoxActive: { backgroundColor: Colors.violet },
  icon: { fontSize: 12, fontWeight: "700", color: Colors.ink3 },
  iconActive: { color: "#fff" },
  label: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  labelActive: { color: Colors.ink, fontWeight: "600" },
  labelHovered: { color: Colors.ink2 },
});

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, company, logout } = useAuthStore();
  const planLabel = company?.plan === "negocio" ? "Negocio" : company?.plan === "expansao" ? "Expansao" : "Essencial";

  return (
    <View style={sb.container}>
      {/* Logo */}
      <Pressable onPress={() => router.push("/")} style={sb.logoWrap}>
        <Image source={{ uri: LOGO_URL }} style={sb.logo} resizeMode="contain" />
      </Pressable>

      <View style={sb.divider} />

      {/* Nav sections */}
      <ScrollView style={sb.nav} showsVerticalScrollIndicator={false}>
        {NAV.map(section => (
          <View key={section.section} style={sb.section}>
            <Text style={sb.sectionLabel}>{section.section}</Text>
            {section.items.map(item => (
              <SidebarItem
                key={item.route}
                label={item.label}
                icon={item.icon}
                active={isActive(pathname, item.route)}
                onPress={() => router.push(item.route as any)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={sb.divider} />

      {/* User footer */}
      <View style={sb.footer}>
        <View style={sb.userRow}>
          <View style={sb.avatar}>
            <Text style={sb.avatarText}>{(user?.name || "A").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={sb.userInfo}>
            <Text style={sb.userName} numberOfLines={1}>{user?.name || "---"}</Text>
            <Text style={sb.userPlan}>{planLabel}</Text>
          </View>
        </View>
        <Pressable onPress={logout} style={sb.logoutBtn}>
          <Text style={sb.logoutText}>Sair</Text>
        </Pressable>
      </View>
    </View>
  );
}
const sb = StyleSheet.create({
  container: { width: 240, backgroundColor: Colors.bg2, borderRightWidth: 1, borderRightColor: Colors.border, paddingTop: 20, paddingBottom: 16, paddingHorizontal: 14, justifyContent: "flex-start" },
  logoWrap: { paddingHorizontal: 8, paddingBottom: 16, alignItems: "flex-start" },
  logo: { width: 100, height: 36 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  nav: { flex: 1, marginTop: 4 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.2, paddingHorizontal: 12, marginBottom: 6 },
  footer: { paddingTop: 8 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, marginBottom: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.violet, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  userInfo: { flex: 1 },
  userName: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  userPlan: { fontSize: 10, color: Colors.violet3, marginTop: 1 },
  logoutBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  logoutText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
});

// ── Bottom Bar (Mobile) ──────────────────────────────────────

function MobileBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={mb.bar}>
      {MOBILE_TABS.map(tab => {
        const active = isActive(pathname, tab.route);
        return (
          <Pressable key={tab.route} style={mb.tab} onPress={() => router.push(tab.route as any)}>
            <View style={[mb.iconWrap, active && mb.iconWrapActive]}>
              <Text style={[mb.icon, active && mb.iconActive]}>{tab.icon}</Text>
            </View>
            <Text style={[mb.label, active && mb.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const mb = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: Colors.bg2, borderTopWidth: 1, borderTopColor: Colors.border, paddingBottom: Platform.OS === "ios" ? 20 : 6, paddingTop: 6 },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  iconWrapActive: { backgroundColor: Colors.violetD },
  icon: { fontSize: 14, fontWeight: "700", color: Colors.ink3 },
  iconActive: { color: Colors.violet3 },
  label: { fontSize: 9, color: Colors.ink3, fontWeight: "500" },
  labelActive: { color: Colors.violet3, fontWeight: "600" },
});

// ── Layout ───────────────────────────────────────────────────

export default function TabsLayout() {
  const isWeb = Platform.OS === "web";

  if (isWeb) {
    return (
      <View style={layout.webRoot}>
        <Sidebar />
        <View style={layout.webContent}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <View style={layout.mobileRoot}>
      <View style={layout.mobileContent}>
        <Slot />
      </View>
      <MobileBar />
    </View>
  );
}

const layout = StyleSheet.create({
  webRoot: { flexDirection: "row", flex: 1, backgroundColor: Colors.bg, height: "100%" as any },
  webContent: { flex: 1, overflow: "auto" as any },
  mobileRoot: { flex: 1, backgroundColor: Colors.bg },
  mobileContent: { flex: 1 },
});
