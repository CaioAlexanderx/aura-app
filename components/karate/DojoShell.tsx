// ============================================================
// DojoShell — Aura Karatê (F1: shell completo do dojô)
//
// Shell responsivo do produto do dojô ("Aura Karatê" — MESMA identidade
// Shoji da federação, decisão de produto; nada de design system novo):
//   • web ≥768px: SIDEBAR espelhando o DNA visual do KarateShell da
//     federação — marca Aura Karatê (selo 空 sobre oxblood + wordmark
//     com "Karatê" vermelho), bloco da entidade (FpktLogo + eyebrow
//     "Aura Karatê · Dojô" + nome + código FPKT/contagem), nav-labels
//     em maiúsculas com separadores vermelhos, chip de usuário com
//     Sair no rodapé — e topbar oxblood fina só com o breadcrumb.
//   • mobile: topbar enxuta + bottom tabs (convenção da casa: sidebar
//     é só desktop).
//
// Nome do dojô: /dojo/me REAL via contexts/KarateDojo (fallback
// company.name). O fallback estático SENSEI_DOJO morreu na F1.
//
// Navegação: os pushes usam href COM o grupo ("/karate/(dojo)/…")
// porque várias seções compartilham URL com o grupo (federation)
// (index, praticantes, eventos, configuracoes). usePathname devolve o
// caminho SEM o grupo, então o estado ativo casa pelo segmento.
//
// TODO F2 (permissions): filtrar DOJO_NAV por useVisibleModules com as
// chaves karate_dojo.* já registradas em hooks/useVisibleModules.ts —
// nesta fase o registro existe mas o shell ainda não consome.
//
// ⚠️ Ícones SÓ via wrapper @/components/Icon (nomes abaixo já são
// usados em telas karatê existentes — nada de @expo/vector-icons).
// ⚠️ Armadilha RN-web: entradas top-level de StyleSheet.create devem
// ser objetos (cor/string solta crasha weak map).
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
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts, ShojiPalette } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { useShojiFonts, FpktLogo } from "@/components/karate/shoji";
import { useAuthStore } from "@/stores/auth";

interface DojoNavItem {
  label: string;
  icon: string;   // chave válida do <Icon> (ou alias)
  route: string;  // alvo do push (COM o grupo)
  match: string;  // segmento após /karate na pathname ("" = índice)
  sidebarOnly: boolean;
}

const DOJO_NAV: DojoNavItem[] = [
  { label: "Painel",        icon: "grid",                route: "/karate/(dojo)",               match: "",              sidebarOnly: false },
  { label: "Praticantes",   icon: "users",               route: "/karate/(dojo)/praticantes",   match: "praticantes",   sidebarOnly: false },
  { label: "Solicitações", icon: "paper-plane-outline", route: "/karate/(dojo)/solicitacoes",  match: "solicitacoes",  sidebarOnly: false },
  { label: "Eventos",       icon: "calendar",            route: "/karate/(dojo)/eventos",       match: "eventos",       sidebarOnly: false },
  { label: "Anuidade",      icon: "wallet",              route: "/karate/(dojo)/anuidade",      match: "anuidade",      sidebarOnly: false },
  { label: "Certificados",  icon: "ribbon",              route: "/karate/(dojo)/certificados",  match: "certificados",  sidebarOnly: false },
  // Configurações: só na sidebar (rodapé), padrão do shell da federação.
  { label: "Configurações", icon: "settings",            route: "/karate/(dojo)/configuracoes", match: "configuracoes", sidebarOnly: true },
];

// Segmento de seção da pathname ("/karate/praticantes" → "praticantes").
function sectionSeg(path: string): string {
  const clean = (path || "").split("?")[0].split("#")[0];
  const parts = clean.split("/").filter(Boolean);
  return parts[0] === "karate" ? parts[1] ?? "" : "";
}

function isItemActive(item: DojoNavItem, path: string): boolean {
  return sectionSeg(path) === item.match;
}

const ROLE_LABEL: Record<string, string> = {
  dojo_owner: "Dono do dojô",
  dojo_sensei: "Sensei",
  sensei: "Sensei",
};
function roleLabel(role: string | null): string {
  if (!role) return "Dojô";
  return ROLE_LABEL[role] ?? "Dojô";
}

// Iniciais (mesma sanitização do KarateShell — pontuação não vira inicial).
function initialsOf(name: string): string {
  const clean = String(name || "").replace(/[^\p{L}\s]/gu, " ");
  const parts = clean.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const BREAKPOINT_SIDEBAR = 768;

// ── Topbar oxblood (web) — só o breadcrumb: <dojô> / <seção> ──
function Topbar() {
  const path = usePathname();
  const { dojoName } = useKarateDojo();
  const seg = sectionSeg(path);
  const item = DOJO_NAV.find((i) => i.match === seg);
  const section = item ? item.label : "Painel";

  return (
    <View style={styles.topbar}>
      <View style={styles.topbarInner}>
        <View style={styles.crumbs} accessibilityRole="header">
          <Text style={styles.crumbRoot} numberOfLines={1}>{dojoName}</Text>
          <Text style={styles.crumbSep}>/</Text>
          <Text style={styles.crumbCurrent} numberOfLines={1}>{section}</Text>
        </View>
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function SidebarNav() {
  const router = useRouter();
  const path = usePathname();
  const { karateRole } = useKarateFederation();
  const { dojoName, dojoCode, dojoMe } = useKarateDojo();

  const user = useAuthStore((s) => s.user) as any;
  const logout = useAuthStore((s) => s.logout);
  const userName = (user?.name || user?.email || "Usuário") as string;

  const mainItems = DOJO_NAV.filter((i) => !i.sidebarOnly);
  const footerItems = DOJO_NAV.filter((i) => i.sidebarOnly);

  const renderItem = (item: DojoNavItem) => {
    const active = isItemActive(item, path);
    return (
      <TouchableOpacity
        key={item.route}
        onPress={() => router.push(item.route as any)}
        accessibilityRole="link"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        activeOpacity={0.75}
        style={[styles.sidebarItem, active && styles.sidebarItemActive]}
      >
        <Icon name={item.icon as any} size={18} color={active ? KarateColors.primary : KarateColors.ink3} />
        <Text style={[styles.sidebarItemLabel, active && styles.sidebarItemLabelActive]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  // Linha código FPKT + contagem (só quando o /dojo/me real respondeu).
  const countLine = [
    dojoCode ? `FPKT ${dojoCode}` : null,
    dojoMe?.practitioner_count != null
      ? `${dojoMe.practitioner_count} praticante${dojoMe.practitioner_count === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.sidebar}>
      {/* Marca Aura Karatê — mesma da federação (G2: "Karatê" vermelho) */}
      <View style={styles.brand}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkSeal}>空</Text>
        </View>
        <View style={styles.brandWm}>
          <Text style={styles.brandWord}>
            Aura <Text style={styles.brandWordRed}>Karatê</Text>
          </Text>
        </View>
      </View>

      {/* Bloco do dojô: FpktLogo + eyebrow + nome real (/dojo/me) */}
      <View style={styles.orgSlug}>
        <View style={styles.orgSlugFpktMark}>
          <FpktLogo size={26} />
        </View>
        <View style={styles.orgSlugMeta}>
          <Text style={styles.orgSlugLabel}>Aura Karatê · Dojô</Text>
          <Text
            style={styles.orgSlugName}
            {...(Platform.OS === "web" ? ({ accessibilityLabel: dojoName, title: dojoName } as any) : {})}
          >
            {dojoName}
          </Text>
          {!!countLine && (
            <Text style={styles.orgSlugCode} numberOfLines={1}>{countLine}</Text>
          )}
        </View>
      </View>

      {/* Navegação principal */}
      <View style={styles.navSection}>
        <Text style={styles.navLabel}>Navegação</Text>
        {mainItems.map(renderItem)}
      </View>

      <View style={{ flex: 1 }} />

      {/* Rodapé: Configurações */}
      {footerItems.length > 0 && (
        <View style={styles.navSectionFooter}>{footerItems.map(renderItem)}</View>
      )}

      {/* Chip de usuário: avatar + nome + papel + Sair */}
      <View style={styles.sbFoot}>
        <View style={styles.sbAv}>
          <Text style={styles.sbAvTxt}>{initialsOf(userName)}</Text>
        </View>
        <View style={styles.sbMeta}>
          <Text style={styles.sbName} numberOfLines={1}>{userName}</Text>
          <Text style={styles.sbRole} numberOfLines={1}>{roleLabel(karateRole)}</Text>
        </View>
        <TouchableOpacity
          style={styles.sbIcoBtn}
          onPress={() => logout()}
          accessibilityRole="button"
          accessibilityLabel="Sair"
          activeOpacity={0.8}
        >
          <Icon name="logout" size={17} color={KarateColors.ink3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BottomTabNav() {
  const router = useRouter();
  const path = usePathname();
  // Configurações fica fora da barra mobile (tarefa de mesa, padrão da casa).
  const tabs = DOJO_NAV.filter((i) => !i.sidebarOnly);

  return (
    <View style={styles.bottomBar}>
      {tabs.map((item) => {
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
            <Icon name={item.icon as any} size={22} color={active ? KarateColors.primary : KarateColors.ink4} />
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function DojoShell() {
  useShojiFonts(); // mount point próprio de karatê — carrega as fontes Shoji
  const { width } = useWindowDimensions();
  const { dojoName } = useKarateDojo();
  const isWide = Platform.OS === "web" && width >= BREAKPOINT_SIDEBAR;

  if (isWide) {
    return (
      <View style={styles.wideContainer}>
        <SidebarNav />
        <View style={styles.content}>
          <Topbar />
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.mobileContainer}>
      {/* Topbar mobile: logo + eyebrow Aura Karatê + nome do dojô */}
      <View style={styles.mobileTopbar}>
        <FpktLogo size={26} style={{ marginRight: 9 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.mobileTopbarEyebrow}>Aura Karatê</Text>
          <Text style={styles.mobileTopbarTitle} numberOfLines={1}>{dojoName}</Text>
        </View>
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

  // ── Topbar oxblood (web) — só breadcrumb ───────────────────
  topbar: {
    backgroundColor: KarateColors.headRed,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(43,38,32,0.20)",
  } as ViewStyle,
  topbarInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  } as ViewStyle,
  crumbs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  } as ViewStyle,
  crumbRoot: {
    fontFamily: KarateFonts.body,
    fontSize: 12,
    color: "rgba(253,248,242,0.74)",
    letterSpacing: 0.2,
    flexShrink: 1,
  } as TextStyle,
  crumbCurrent: {
    fontFamily: KarateFonts.body,
    fontSize: 12,
    fontWeight: "600",
    color: "#fdf8f2",
    letterSpacing: 0.2,
    flexShrink: 1,
  } as TextStyle,
  crumbSep: {
    fontFamily: KarateFonts.body,
    fontSize: 12,
    color: "rgba(253,248,242,0.4)",
  } as TextStyle,

  // ── Sidebar (DNA do KarateShell) ───────────────────────────
  sidebar: {
    width: 236,
    backgroundColor: KarateColors.bg2,
    borderRightWidth: 1,
    borderRightColor: KarateColors.border2,
    paddingTop: 26,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "column",
  } as ViewStyle,

  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 18,
  } as ViewStyle,
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#a44230",
    borderWidth: 1,
    borderColor: "rgba(43,38,32,0.14)",
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({ backgroundImage: "linear-gradient(150deg,#c0503f,#983429)" } as any)
      : {}),
  } as ViewStyle,
  brandMarkSeal: {
    fontFamily: KarateFonts.heading,
    fontSize: 23,
    color: "#fbeee4",
    lineHeight: 28,
  } as TextStyle,
  brandWm: {
    flex: 1,
    minWidth: 0,
  } as ViewStyle,
  brandWord: {
    fontFamily: KarateFonts.heading,
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: 0.3,
    color: KarateColors.ink,
    lineHeight: 24,
  } as TextStyle,
  brandWordRed: {
    color: ShojiPalette.red,
  } as TextStyle,

  orgSlug: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: ShojiPalette.redLine,
    borderBottomWidth: 1,
    borderBottomColor: ShojiPalette.redLine,
    marginBottom: 16,
  } as ViewStyle,
  orgSlugFpktMark: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: KarateColors.glass2,
    borderWidth: 1,
    borderColor: KarateColors.border2,
    overflow: "hidden",
  } as ViewStyle,
  orgSlugMeta: {
    flex: 1,
    minWidth: 0,
  } as ViewStyle,
  orgSlugLabel: {
    fontFamily: KarateFonts.body,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: KarateColors.ink4,
    marginBottom: 5,
  } as TextStyle,
  orgSlugName: {
    fontFamily: KarateFonts.heading,
    fontSize: 12,
    fontWeight: "500",
    color: KarateColors.ink,
    lineHeight: 16,
  } as TextStyle,
  orgSlugCode: {
    fontFamily: KarateFonts.body,
    fontSize: 10,
    color: KarateColors.ink3,
    marginTop: 3,
  } as TextStyle,

  navSection: {
    flexDirection: "column",
    gap: 3,
  } as ViewStyle,
  navSectionFooter: {
    flexDirection: "column",
    gap: 3,
    borderTopWidth: 1,
    borderTopColor: ShojiPalette.redLine,
    paddingTop: 14,
    marginTop: 14,
  } as ViewStyle,
  navLabel: {
    fontFamily: KarateFonts.body,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: KarateColors.ink4,
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 8,
  } as TextStyle,

  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: KarateRadius.md,
  } as ViewStyle,
  sidebarItemActive: { backgroundColor: KarateColors.primarySoft } as ViewStyle,
  sidebarItemLabel: { fontFamily: KarateFonts.body, fontSize: 13, fontWeight: "500", color: KarateColors.ink2 } as TextStyle,
  sidebarItemLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,

  sbFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingTop: 16,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: ShojiPalette.redLine,
    marginTop: 8,
  } as ViewStyle,
  sbAv: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: KarateColors.glass2,
    borderWidth: 1,
    borderColor: KarateColors.border2,
  } as ViewStyle,
  sbAvTxt: {
    fontFamily: KarateFonts.heading,
    fontSize: 13,
    fontWeight: "500",
    color: KarateColors.ink,
  } as TextStyle,
  sbMeta: {
    flex: 1,
    minWidth: 0,
  } as ViewStyle,
  sbName: {
    fontFamily: KarateFonts.body,
    fontSize: 12,
    fontWeight: "600",
    color: KarateColors.ink,
  } as TextStyle,
  sbRole: {
    fontFamily: KarateFonts.body,
    fontSize: 10.5,
    color: KarateColors.ink3,
    marginTop: 1,
  } as TextStyle,
  sbIcoBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,

  // ── Topbar mobile ──────────────────────────────────────────
  mobileTopbar: {
    height: 54,
    backgroundColor: KarateColors.glass,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: KarateColors.border,
  } as ViewStyle,
  mobileTopbarEyebrow: {
    fontFamily: KarateFonts.body,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: KarateColors.ink4,
  } as TextStyle,
  mobileTopbarTitle: {
    fontFamily: KarateFonts.heading,
    fontSize: 16,
    color: KarateColors.ink,
    letterSpacing: 0.3,
  } as TextStyle,

  // ── Bottom tabs ────────────────────────────────────────────
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
  tabLabel: { fontSize: 10, color: KarateColors.ink4, fontWeight: "600" } as TextStyle,
  tabLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
});
