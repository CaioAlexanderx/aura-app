// ============================================================
// KarateShell — Aura Karatê
//
// Shell responsivo (mobile: bottom-tabs + topbar; web: sidebar).
// Usa expo-router Slot para renderizar a tela ativa.
// Cores Shoji: vermelho primary, fundo paper.
//
// Track B: adicionado item Financeiro à navegação.
// Track C: adicionado item Eventos à navegação.
// Track E: adicionado item Competições à navegação.
// Fase 5: adicionado item Conexões (lado federação; só na sidebar).
// Track G (acesso real): NAV_ITEMS filtrado por papel karatê
//   (Financeiro=admin; Conexões/Importar=admin+staff; resto=todos).
//   karateRole null (mock/dev) → nada é escondido (comportamento antigo).
// Track H: adicionado item Configurações (só federation_admin, só sidebar).
// Track J: adicionado item Certificados (todos os papéis, visível no mobile).
//   (rota /karate/exames = tela de Certificados/Selo; exames de faixa
//    vivem em "Eventos"). Renomeado de "Exames" p/ desfazer a confusão.
// Track L: adicionado item Saúde da Rede (admin+staff, só sidebar).
//
// IA/Nav P1:
//   • isActive — o item índice (Dashboard, route "/karate/") casa por
//     IGUALDADE EXATA ("/karate" | "/karate/"); os demais por startsWith.
//     Antes o Dashboard ficava sempre ativo (todas as rotas começam por
//     "/karate/"), o que tirava o "onde estou".
//   • Busca global na sidebar (web): submeter navega para
//     /karate/praticantes?q=<termo>. Ocultada no mobile.
//
// Ícones: nomes Ionicons válidos (@expo/vector-icons). A fonte já é
//   carregada pelas telas Shoji; qualquer nome inválido renderiza tofu.
// ============================================================
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
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
import { KarateColors, KarateRadius, KarateFonts, ShojiPalette } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useShojiFonts, FpktLogo } from "@/components/karate/shoji";

// roles=null → visível para todos os papéis da federação.
// roles=[...] → visível só para os papéis listados.
// sidebarOnly=true → não aparece na bottom tab bar mobile.
// icon → nome Ionicons válido (renderizado via <Ionicons name=… />).
const NAV_ITEMS = [
  { label: "Dashboard",       icon: "grid-outline",          route: "/karate/",              roles: null,          sidebarOnly: false },
  { label: "Saúde da Rede",   icon: "pulse-outline",         route: "/karate/saude-rede",    roles: ["federation_admin", "federation_staff"], sidebarOnly: true },
  { label: "Dojôs",           icon: "business-outline",      route: "/karate/dojos",         roles: null,          sidebarOnly: false },
  { label: "Praticantes",     icon: "people-outline",        route: "/karate/praticantes",   roles: null,          sidebarOnly: false },
  { label: "Conexões",        icon: "git-network-outline",   route: "/karate/conexoes",      roles: ["federation_admin", "federation_staff"], sidebarOnly: true },
  { label: "Financeiro",      icon: "cash-outline",          route: "/karate/financeiro",    roles: ["federation_admin"], sidebarOnly: false },
  // Track J: Certificados (rota /karate/exames = tela de Selo/Certificados).
  //   Visível para todos, aparece no mobile e na sidebar.
  { label: "Certificados",    icon: "ribbon-outline",        route: "/karate/exames",        roles: null,          sidebarOnly: false },
  { label: "Eventos",         icon: "calendar-outline",      route: "/karate/eventos",       roles: null,          sidebarOnly: false },
  { label: "Competições",    icon: "trophy-outline",        route: "/karate/competicoes",   roles: null,          sidebarOnly: false },
  { label: "Importar",        icon: "cloud-upload-outline",  route: "/karate/importacao",    roles: ["federation_admin", "federation_staff"], sidebarOnly: true },
  // Track H: Configurações — só federation_admin, posicionado no rodapé da sidebar
  { label: "Configurações",   icon: "settings-outline",      route: "/karate/configuracoes", roles: ["federation_admin"], sidebarOnly: true },
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

// Filtra a navegação pelo papel karatê. role null/desconhecido (mock/dev)
// = mostra tudo, preservando o comportamento anterior ao Track G.
function visibleNav(role: string | null): readonly NavItem[] {
  return NAV_ITEMS.filter(
    (i) => !i.roles || role == null || (i.roles as readonly string[]).includes(role)
  );
}

// IA/Nav P1 — estado ativo correto:
//   • O item índice (Dashboard, route terminando em "/karate/") casa SÓ
//     na rota índice, por igualdade exata ("/karate" ou "/karate/").
//   • Os demais itens casam por prefixo (startsWith), preservando o
//     destaque ao navegar para sub-rotas (ex.: /karate/dojos/123).
function isItemActive(item: NavItem, path: string): boolean {
  const isIndex = item.route === "/karate/" || item.route === "/karate";
  if (isIndex) return path === "/karate" || path === "/karate/";
  return path.startsWith(item.route);
}

const BREAKPOINT_SIDEBAR = 768;

function SidebarNav() {
  const router = useRouter();
  const path   = usePathname();
  const { federationName, karateRole } = useKarateFederation();
  const items = visibleNav(karateRole);

  // Busca global (web): submeter leva à lista de Praticantes já filtrada.
  const [term, setTerm] = useState("");
  const submitSearch = () => {
    const q = term.trim();
    if (!q) return;
    router.push(("/karate/praticantes?q=" + encodeURIComponent(q)) as any);
  };

  // Separa os itens "normais" dos items de rodapé (Configurações)
  const mainItems   = items.filter((i) => i.label !== "Configurações");
  const footerItems = items.filter((i) => i.label === "Configurações");

  const renderItem = (item: NavItem) => {
    const active = isItemActive(item, path);
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
  };

  return (
    <View style={styles.sidebar}>
      {/* Logo / Brand */}
      <View style={styles.sidebarHeader}>
        <FpktLogo size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.brandTitle}>Aura Karatê</Text>
          <Text style={styles.brandSub} numberOfLines={1}>{federationName}</Text>
        </View>
      </View>

      {/* Busca global → lista de Praticantes filtrada (?q=) */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={15} color={KarateColors.ink3} />
        <TextInput
          style={styles.searchInput as any}
          value={term}
          onChangeText={setTerm}
          placeholder="Buscar praticante…"
          placeholderTextColor={KarateColors.ink4}
          returnKeyType="search"
          onSubmitEditing={submitSearch}
          accessibilityLabel="Buscar praticante"
        />
      </View>

      {/* Navigation principal */}
      <View style={{ flex: 1 }}>
        {mainItems.map(renderItem)}
      </View>

      {/* Rodapé: Configurações */}
      {footerItems.length > 0 && (
        <View style={styles.sidebarFooter}>
          {footerItems.map(renderItem)}
        </View>
      )}
    </View>
  );
}

function BottomTabNav() {
  const router = useRouter();
  const path   = usePathname();
  const { karateRole } = useKarateFederation();

  // No mobile, excluímos Importar, Conexões, Saúde da Rede e Configurações
  // (tarefas web da federação) para manter a barra inferior enxuta.
  const MOBILE_TABS = visibleNav(karateRole).filter((i) => !i.sidebarOnly);

  return (
    <View style={styles.bottomBar}>
      {MOBILE_TABS.map((item) => {
        const active = isItemActive(item, path);
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
  useShojiFonts();   // carrega as fontes Shoji (web) em todo o shell
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
        <FpktLogo size={26} style={{ marginRight: 9 }} />
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
    flexDirection: "column",
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
  sidebarFooter: {
    borderTopWidth: 1,
    borderTopColor: KarateColors.border,
    paddingTop: 8,
    marginTop: 8,
  } as ViewStyle,
  // Busca global na sidebar
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: KarateColors.bg,
    borderWidth: 1,
    borderColor: KarateColors.border,
    borderRadius: KarateRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  } as ViewStyle,
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: KarateColors.ink,
    minHeight: 20,
    outlineStyle: "none",
  } as any,
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
    height: 54,
    backgroundColor: KarateColors.glass,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: KarateColors.border,
  } as ViewStyle,
  topbarTitle: {
    fontFamily: KarateFonts.heading,
    fontSize: 18,
    color: KarateColors.ink,
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
