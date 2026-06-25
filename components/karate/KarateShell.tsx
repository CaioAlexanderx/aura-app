// ============================================================
// KarateShell — Aura Karatê
//
// Shell responsivo (mobile: bottom-tabs + topbar; web: sidebar).
// Usa expo-router Slot para renderizar a tela ativa.
// Cores Shoji: vermelhão primary, fundo paper, faixa oxblood (head-red).
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
//   • Busca global: submeter navega para /karate/praticantes?q=<termo>.
//
// Nav P2 (3.5): breadcrumb leve em rotas aninhadas.
//
// ── Shell premium (v5 Shoji / 障子) ──────────────────────────
//   Resgate da "chrome" premium do mock v5:
//   • Topbar OXBLOOD (head-red #a44c3e) no topo da área de conteúdo (web):
//       – LOGOS no início (2 quadrantes): (1) marca Aura Karatê (selo 空 +
//         wordmark, ê vermelho) e (2) logo oficial FPKT (FpktLogo) + nome da
//         federação, separados por um filete claro;
//       – breadcrumb claro (FPKT / <página atual>), integrando a lógica de
//         breadcrumb (1º nível = seção; 2º nível acrescenta "› Detalhe");
//       – busca global à direita (MOVIDA da sidebar; mesmo comportamento:
//         submeter → /karate/praticantes?q=<termo>), estilizada sobre o
//         vermelho;
//       – sino de notificações com dot.
//   • Chip de usuário no rodapé da sidebar (sb-foot): avatar com iniciais +
//     nome + papel (mapeado do karateRole) + botão Sair (logout do store).
//   • Logo "mark" (quadrado vermelho com selo) + wordmark "Aura Karatê" com
//     o "ê" em vermelho + org-slug (nome da federação) com separadores
//     vermelhos (sidebar).
//   • Sidebar refinada: nav-labels em maiúsculas + separadores vermelhos.
//
//   Usuário/papel: useAuthStore (user.name || user.email;
//   company.karate_role). Logout: store.logout() (já limpa storage +
//   redireciona). Cores via tokens Shoji (KarateColors.headRed etc.).
//   Mobile preservado: topbar enxuta + bottom tabs (sem oxblood/chip —
//   essa chrome é do layout web/sidebar).
//
// ⚠️ ÍCONES (fix 25/06): a shell renderizava ícones via @expo/vector-icons
//   Ionicons, que NÃO é dependência deste app — a fonte de glifos nunca é
//   carregada na web e cada ícone virava um retângulo vazio (tofu). Agora
//   usamos <Icon> (components/Icon.tsx), o motor SVG-inline já padrão no
//   app: sem fonte, sem gate de carregamento, glyphs sempre presentes.
//   Os nomes em NAV_ITEMS são chaves válidas do Icon (ou aliases mapeados).
// ⚠️ Armadilha RN-web: entradas top-level de StyleSheet.create devem ser
//   objetos (cor/string solta crasha "Invalid value used as weak map key").
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
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts, ShojiPalette } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useShojiFonts, FpktLogo } from "@/components/karate/shoji";
import { useAuthStore } from "@/stores/auth";

// roles=null → visível para todos os papéis da federação.
// roles=[...] → visível só para os papéis listados.
// sidebarOnly=true → não aparece na bottom tab bar mobile.
// icon → chave válida do componente <Icon> (components/Icon.tsx) ou alias.
const NAV_ITEMS = [
  { label: "Dashboard",       icon: "grid",      route: "/karate/",              roles: null,          sidebarOnly: false },
  { label: "Saúde da Rede",   icon: "activity",  route: "/karate/saude-rede",    roles: ["federation_admin", "federation_staff"], sidebarOnly: true },
  { label: "Dojôs",           icon: "building",  route: "/karate/dojos",         roles: null,          sidebarOnly: false },
  { label: "Praticantes",     icon: "users",     route: "/karate/praticantes",   roles: null,          sidebarOnly: false },
  { label: "Conexões",        icon: "network",   route: "/karate/conexoes",      roles: ["federation_admin", "federation_staff"], sidebarOnly: true },
  { label: "Financeiro",      icon: "wallet",    route: "/karate/financeiro",    roles: ["federation_admin"], sidebarOnly: false },
  // Track J: Certificados (rota /karate/exames = tela de Selo/Certificados).
  { label: "Certificados",    icon: "ribbon",    route: "/karate/exames",        roles: null,          sidebarOnly: false },
  { label: "Eventos",         icon: "calendar",  route: "/karate/eventos",       roles: null,          sidebarOnly: false },
  { label: "Competições",    icon: "trophy",    route: "/karate/competicoes",   roles: null,          sidebarOnly: false },
  { label: "Importar",        icon: "upload",    route: "/karate/importacao",    roles: ["federation_admin", "federation_staff"], sidebarOnly: true },
  // Track H: Configurações — só federation_admin, posicionado no rodapé da sidebar
  { label: "Configurações",   icon: "settings",  route: "/karate/configuracoes", roles: ["federation_admin"], sidebarOnly: true },
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

// Filtra a navegação pelo papel karatê. role null/desconhecido (mock/dev)
// = mostra tudo, preservando o comportamento anterior ao Track G.
function visibleNav(role: string | null): readonly NavItem[] {
  return NAV_ITEMS.filter(
    (i) => !i.roles || role == null || (i.roles as readonly string[]).includes(role)
  );
}

// IA/Nav P1 — estado ativo correto (índice por igualdade, resto por prefixo).
function isItemActive(item: NavItem, path: string): boolean {
  const isIndex = item.route === "/karate/" || item.route === "/karate";
  if (isIndex) return path === "/karate" || path === "/karate/";
  return path.startsWith(item.route);
}

// ── Papel karatê → rótulo humano (chip de usuário) ───────────
// federation_admin → "Administração"; federation_staff → "Equipe";
// sensei/dojo → "Sensei"; null/desconhecido → "Federação".
const ROLE_LABEL: Record<string, string> = {
  federation_admin: "Administração",
  federation_staff: "Equipe",
  dojo_owner: "Sensei",
  dojo_sensei: "Sensei",
  sensei: "Sensei",
};
function roleLabel(role: string | null): string {
  if (!role) return "Federação";
  return ROLE_LABEL[role] ?? "Federação";
}

// Iniciais a partir de um nome (1 ou 2 letras). Espelha o Avatar do kit.
function initialsOf(name: string): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Breadcrumb / seção atual ─────────────────────────────────
// Mapa segmento-da-seção → rótulo, derivado de NAV_ITEMS.
const SECTION_LABEL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const it of NAV_ITEMS) {
    const seg = it.route.replace(/^\/karate\/?/, "").replace(/\/$/, "");
    if (seg) map[seg] = it.label;
  }
  return map;
})();

// Deriva, a partir da pathname, a seção atual e se estamos num detalhe.
//   /karate                  → { section: "Dashboard", route: "/karate/", detail: false }
//   /karate/dojos            → { section: "Dojôs", route: "/karate/dojos", detail: false }
//   /karate/dojos/<id>       → { section: "Dojôs", route: "/karate/dojos", detail: true }
function deriveLocation(path: string): { section: string; route: string; detail: boolean } {
  const clean = (path || "").split("?")[0].split("#")[0];
  const parts = clean.split("/").filter(Boolean); // ["karate", "dojos", "<id>", ...]
  if (parts[0] !== "karate" || parts.length <= 1) {
    return { section: "Dashboard", route: "/karate/", detail: false };
  }
  const sectionSeg = parts[1];
  const label = SECTION_LABEL[sectionSeg];
  if (!label) {
    // seção desconhecida → não arrisca rótulo errado; cai no Dashboard.
    return { section: "Dashboard", route: "/karate/", detail: false };
  }
  return { section: label, route: `/karate/${sectionSeg}`, detail: parts.length > 2 };
}

const BREAKPOINT_SIDEBAR = 768;

// ── Lockup de logos do header (web) ──────────────────────────
//   Quadrante 1: marca Aura Karatê (selo 空 vermelho + wordmark, ê vermelho).
//   Quadrante 2: logo oficial FPKT (FpktLogo) + nome da federação.
//   NB: não existe asset de imagem dedicado da "Aura Karatê"; a marca é a
//   composição selo+wordmark já estabelecida no app (sidebar). O FPKT tem
//   bitmap oficial (assets/karate/logo-fpkt.png via FpktLogo).
function HeaderLogos({ federationName }: { federationName: string }) {
  return (
    <View style={styles.headLogos}>
      {/* Quadrante 1 — Aura Karatê */}
      <View style={styles.headBrand} accessibilityRole="header" accessibilityLabel="Aura Karatê">
        <View style={styles.headMark}>
          <Text style={styles.headMarkSeal}>空</Text>
        </View>
        <View style={styles.headBrandWm}>
          <Text style={styles.headBrandWord} numberOfLines={1}>
            Aura Karat<Text style={styles.headBrandWordRed}>ê</Text>
          </Text>
          <Text style={styles.headBrandSub}>FEDERAÇÃO</Text>
        </View>
      </View>

      {/* filete separador claro */}
      <View style={styles.headDivider} />

      {/* Quadrante 2 — FPKT */}
      <View style={styles.headFpkt}>
        <View style={styles.headFpktMark}>
          <FpktLogo size={30} />
        </View>
        <View style={styles.headFpktWm}>
          <Text style={styles.headFpktName} numberOfLines={1}>FPKT</Text>
          <Text style={styles.headFpktSub} numberOfLines={1}>{federationName}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Topbar oxblood (web) — logos + breadcrumb + busca global + sino ───
function Topbar() {
  const router = useRouter();
  const path = usePathname();
  const loc = deriveLocation(path);
  const { federationName } = useKarateFederation();

  // Busca global (movida da sidebar): submeter → lista de Praticantes (?q=).
  const [term, setTerm] = useState("");
  const submitSearch = () => {
    const q = term.trim();
    if (!q) return;
    router.push(("/karate/praticantes?q=" + encodeURIComponent(q)) as any);
  };

  return (
    <View style={styles.topbar}>
      <View style={styles.topbarInner}>
        {/* Logos: Aura Karatê (1º) + FPKT (2º) */}
        <HeaderLogos federationName={federationName} />

        {/* filete separador antes do breadcrumb */}
        <View style={styles.headDivider} />

        {/* Breadcrumb: FPKT / <seção> [ › Detalhe ] em texto claro */}
        <View style={styles.crumbs} accessibilityRole="header">
          <Text style={styles.crumbRoot}>FPKT</Text>
          <Text style={styles.crumbSep}>/</Text>
          {loc.detail ? (
            <>
              <TouchableOpacity
                onPress={() => router.push(loc.route as any)}
                accessibilityRole="link"
                accessibilityLabel={`Voltar para ${loc.section}`}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={styles.crumbLink}>{loc.section}</Text>
              </TouchableOpacity>
              <Text style={styles.crumbSep}>/</Text>
              <Text style={styles.crumbCurrent} numberOfLines={1}>Detalhe</Text>
            </>
          ) : (
            <Text style={styles.crumbCurrent} numberOfLines={1}>{loc.section}</Text>
          )}
        </View>

        <View style={{ flex: 1 }} />

        {/* Busca global → /karate/praticantes?q= */}
        <View style={styles.topSearch}>
          <Icon name="search" size={15} color="rgba(253,248,242,0.72)" />
          <TextInput
            style={styles.topSearchInput as any}
            value={term}
            onChangeText={setTerm}
            placeholder="Buscar praticante…"
            placeholderTextColor="rgba(253,248,242,0.6)"
            returnKeyType="search"
            onSubmitEditing={submitSearch}
            accessibilityLabel="Buscar praticante"
          />
        </View>

        {/* Sino de notificações com dot */}
        <TouchableOpacity
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Notificações"
          activeOpacity={0.8}
        >
          <Icon name="bell" size={18} color="#fdf8f2" />
          <View style={styles.iconBtnDot} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SidebarNav() {
  const router = useRouter();
  const path   = usePathname();
  const { federationName, karateRole } = useKarateFederation();
  const items = visibleNav(karateRole);

  // Usuário logado (chip de rodapé). Nome cai no email se vier vazio.
  const user   = useAuthStore((s) => s.user) as any;
  const logout = useAuthStore((s) => s.logout);
  const userName = (user?.name || user?.email || "Usuário") as string;
  const userRole = roleLabel(karateRole);

  // Separa os itens "normais" dos itens de rodapé (Configurações).
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
        <Icon
          name={item.icon}
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
      {/* Logo mark + wordmark "Aura Karatê" (ê vermelho) */}
      <View style={styles.brand}>
        <View style={styles.brandMark}>
          <FpktLogo size={26} />
        </View>
        <View style={styles.brandWm}>
          <Text style={styles.brandWord}>
            Aura Karat<Text style={styles.brandWordRed}>ê</Text>
          </Text>
          <Text style={styles.brandSubMark}>FEDERAÇÃO</Text>
        </View>
      </View>

      {/* org-slug: nome da federação com separadores vermelhos */}
      <View style={styles.orgSlug}>
        <Text style={styles.orgSlugLabel}>Federação</Text>
        <Text
          style={styles.orgSlugName}
          numberOfLines={2}
          {...(Platform.OS === "web"
            ? ({ accessibilityLabel: federationName, title: federationName } as any)
            : {})}
        >
          {federationName}
        </Text>
      </View>

      {/* Navigation principal */}
      <View style={styles.navSection}>
        <Text style={styles.navLabel}>Navegação</Text>
        {mainItems.map(renderItem)}
      </View>

      <View style={{ flex: 1 }} />

      {/* Rodapé: Configurações (se houver) */}
      {footerItems.length > 0 && (
        <View style={styles.navSectionFooter}>
          {footerItems.map(renderItem)}
        </View>
      )}

      {/* Chip de usuário: avatar + nome + papel + Sair */}
      <View style={styles.sbFoot}>
        <View style={styles.sbAv}>
          <Text style={styles.sbAvTxt}>{initialsOf(userName)}</Text>
        </View>
        <View style={styles.sbMeta}>
          <Text style={styles.sbName} numberOfLines={1}>{userName}</Text>
          <Text style={styles.sbRole} numberOfLines={1}>{userRole}</Text>
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
            <Icon
              name={item.icon}
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
          {/* Topbar oxblood: logos + breadcrumb + busca global + sino */}
          <Topbar />
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.mobileContainer}>
      {/* Topbar mobile (enxuta) */}
      <View style={styles.mobileTopbar}>
        <FpktLogo size={26} style={{ marginRight: 9 }} />
        <Text style={styles.mobileTopbarTitle}>Aura Karatê</Text>
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

  // ── Topbar oxblood (web) ───────────────────────────────────
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

  // ── Lockup de logos do header ──────────────────────────────
  headLogos: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexShrink: 0,
  } as ViewStyle,
  // Quadrante 1 — Aura Karatê
  headBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  } as ViewStyle,
  headMark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ShojiPalette.red,
    borderWidth: 1,
    borderColor: "rgba(253,248,242,0.32)",
  } as ViewStyle,
  headMarkSeal: {
    fontFamily: KarateFonts.heading,
    fontSize: 19,
    color: "#fbeee4",
    lineHeight: 24,
  } as TextStyle,
  headBrandWm: {
    minWidth: 0,
  } as ViewStyle,
  headBrandWord: {
    fontFamily: KarateFonts.heading,
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: 0.3,
    color: "#fdf8f2",
    lineHeight: 19,
  } as TextStyle,
  headBrandWordRed: {
    color: "#f4c9bf",
  } as TextStyle,
  headBrandSub: {
    fontFamily: KarateFonts.body,
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 2,
    color: "rgba(253,248,242,0.66)",
    marginTop: 2,
  } as TextStyle,
  // filete separador claro entre quadrantes / antes do breadcrumb
  headDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(253,248,242,0.26)",
  } as ViewStyle,
  // Quadrante 2 — FPKT
  headFpkt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  } as ViewStyle,
  headFpktMark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(253,248,242,0.92)",
    borderWidth: 1,
    borderColor: "rgba(253,248,242,0.5)",
    overflow: "hidden",
  } as ViewStyle,
  headFpktWm: {
    minWidth: 0,
    maxWidth: 150,
  } as ViewStyle,
  headFpktName: {
    fontFamily: KarateFonts.heading,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "#fdf8f2",
    lineHeight: 16,
  } as TextStyle,
  headFpktSub: {
    fontFamily: KarateFonts.body,
    fontSize: 9,
    color: "rgba(253,248,242,0.66)",
    marginTop: 2,
  } as TextStyle,

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
  } as TextStyle,
  crumbLink: {
    fontFamily: KarateFonts.body,
    fontSize: 12,
    color: "rgba(253,248,242,0.74)",
    letterSpacing: 0.2,
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

  // Busca global na topbar (sobre o vermelho)
  topSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: 240,
    maxWidth: "30%",
    backgroundColor: "rgba(253,248,242,0.14)",
    borderWidth: 1,
    borderColor: "rgba(253,248,242,0.28)",
    borderRadius: KarateRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  } as ViewStyle,
  topSearchInput: {
    flex: 1,
    fontFamily: KarateFonts.body,
    fontSize: 12.5,
    color: "#fdf8f2",
    minHeight: 20,
    outlineStyle: "none",
  } as any,

  // Botão de ícone (sino) sobre o vermelho
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: KarateRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(253,248,242,0.12)",
    borderWidth: 1,
    borderColor: "rgba(253,248,242,0.26)",
    position: "relative",
  } as ViewStyle,
  iconBtnDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fdf8f2",
  } as ViewStyle,

  // ── Sidebar ────────────────────────────────────────────────
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

  // Logo mark + wordmark
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
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ShojiPalette.red,
    borderWidth: 1,
    borderColor: "rgba(43,38,32,0.14)",
    overflow: "hidden",
  } as ViewStyle,
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
  brandSubMark: {
    fontFamily: KarateFonts.body,
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 2.4,
    color: KarateColors.ink3,
    marginTop: 5,
  } as TextStyle,

  // org-slug (nome da federação) com separadores vermelhos
  orgSlug: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: ShojiPalette.redLine,
    borderBottomWidth: 1,
    borderBottomColor: ShojiPalette.redLine,
    marginBottom: 16,
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
    fontSize: 14,
    fontWeight: "500",
    color: KarateColors.ink,
    lineHeight: 18,
  } as TextStyle,

  // nav sections
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
  sidebarItemLabel:  { fontFamily: KarateFonts.body, fontSize: 13, fontWeight: "500", color: KarateColors.ink2 } as TextStyle,
  sidebarItemLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,

  // ── Chip de usuário (sb-foot) ──────────────────────────────
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

  // ── Topbar mobile (enxuta) ─────────────────────────────────
  mobileTopbar: {
    height: 54,
    backgroundColor: KarateColors.glass,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: KarateColors.border,
  } as ViewStyle,
  mobileTopbarTitle: {
    fontFamily: KarateFonts.heading,
    fontSize: 18,
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
  tabLabel:       { fontSize: 10, color: KarateColors.ink4, fontWeight: "600" } as TextStyle,
  tabLabelActive: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
});
