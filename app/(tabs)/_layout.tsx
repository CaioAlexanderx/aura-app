import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Image } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { Colors, useColors, useThemeStore } from "@/constants/colors";
import { Fonts, GOOGLE_FONTS_CSS } from "@/constants/fonts";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import { ToastContainer } from "@/components/Toast";
import OnboardingScreen from "@/app/(tabs)/onboarding";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useModules } from "@/hooks/useModules";
import { useVerticalTheme } from "@/hooks/useVerticalTheme";
import { VerticalContextBar } from "@/components/VerticalContextBar";

const LOGO_SVG="https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/aura-icon.svg";
type NavItem = { r: string; l: string; ic: string; soon?: boolean; plan?: string };
type NavSection = { s: string; i: NavItem[] };

const NAV: NavSection[] = [
  { s: "Principal", i: [{ r: "/", l: "Painel", ic: "dashboard" },{ r: "/financeiro", l: "Financeiro", ic: "wallet" },{ r: "/nfe", l: "NF-e", ic: "file_text" }]},
  { s: "Contabil", i: [{ r: "/contabilidade", l: "Contabilidade", ic: "calculator" },{ r: "/suporte", l: "Seu Analista", ic: "headset" }]},
  { s: "Vendas", i: [{ r: "/pdv", l: "Caixa", ic: "cart" },{ r: "/estoque", l: "Estoque", ic: "package" }]},
  { s: "Equipe", i: [{ r: "/folha", l: "Folha", ic: "payroll", plan: "negocio" },{ r: "/agendamento", l: "Agenda", ic: "calendar", plan: "negocio" }]},
  { s: "Clientes", i: [{ r: "/clientes", l: "Clientes", ic: "users", plan: "negocio" },{ r: "/whatsapp", l: "WhatsApp", ic: "message", plan: "negocio" },{ r: "/canal", l: "Canal Digital", ic: "globe", plan: "negocio" }]},
  { s: "Crescimento", i: [{ r: "/agentes", l: "Agentes", ic: "brain", plan: "expansao" }]},
];

function useWebFonts() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (document.getElementById("aura-fonts")) return;
    const p1 = document.createElement("link"); p1.rel = "preconnect"; p1.href = "https://fonts.googleapis.com"; document.head.appendChild(p1);
    const p2 = document.createElement("link"); p2.rel = "preconnect"; p2.href = "https://fonts.gstatic.com"; p2.crossOrigin = ""; document.head.appendChild(p2);
    const lk = document.createElement("link"); lk.id = "aura-fonts"; lk.rel = "stylesheet"; lk.href = GOOGLE_FONTS_CSS; document.head.appendChild(lk);
    const st = document.createElement("style"); st.id = "aura-font-override";
    st.textContent = "*, *::before, *::after { font-family: " + Fonts.body + " !important; }\n[data-testid] { font-family: " + Fonts.body + " !important; }\ndiv[dir] { font-family: " + Fonts.body + " !important; }\n@keyframes auraShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }";
    document.head.appendChild(st);
    document.documentElement.lang = "pt-BR";
    if (!document.getElementById("aura-favicon")) { const fav = document.createElement("link"); fav.id = "aura-favicon"; fav.rel = "icon"; fav.type = "image/svg+xml"; fav.href = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/favicon.svg"; document.head.appendChild(fav); }
    if (!document.getElementById("aura-wow-css")) { const wc = document.createElement("style"); wc.id = "aura-wow-css"; wc.textContent = "* { font-variant-numeric: tabular-nums; } a, button, [role=button] { cursor: pointer !important; } ::selection { background: rgba(124,58,237,0.3); color: inherit; } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 3px; } ::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.4); } @keyframes auraStagger { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } .skip-nav { position: absolute; left: -9999px; top: 4px; z-index: 9999; background: #7c3aed; color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; } .skip-nav:focus { left: 8px; } @keyframes auraBounce { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 70% { transform: scale(0.95); } 100% { transform: scale(1); } }"; document.head.appendChild(wc); }
  }, []);
}

function useScreenWidth() {
  const [width, setWidth] = useState(Platform.OS === "web" ? (typeof window !== "undefined" ? window.innerWidth : 1024) : 375);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

function isA(p: string, r: string) {
  if (r === "/") return p === "/" || p === "" || p.endsWith("/index") || p === "/(tabs)";
  return p.includes(r.replace("/", ""));
}

function AuraLogo({ C, collapsed }: { C: ReturnType<typeof useColors>; collapsed: boolean }) {
  if (collapsed) {
    return <Image source={{ uri: LOGO_SVG }} style={{ width: 32, height: 32 }} resizeMode="contain" />;
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Image source={{ uri: LOGO_SVG }} style={{ width: 36, height: 36 }} resizeMode="contain" />
      <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink, letterSpacing: -0.5 }}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text>
    </View>
  );
}

function SI({ l, ic, a, onP, soon, C, collapsed, pl }: { l: string; ic: string; a: boolean; onP: () => void; soon?: boolean; C: ReturnType<typeof useColors>; collapsed: boolean; pl?: string }) {
  const [h, sH] = useState(false);
  return (
    <Pressable onPress={soon ? undefined : onP} onHoverIn={() => sH(true)} onHoverOut={() => sH(false)}
      {...(Platform.OS === "web" ? { title: l } : {})}
      style={[{ flexDirection: "row", alignItems: "center", gap: collapsed ? 0 : 10, paddingVertical: 9, paddingHorizontal: collapsed ? 0 : 12, borderRadius: 10, marginBottom: 2, justifyContent: collapsed ? "center" : "flex-start" }, a && { backgroundColor: C.violetD, borderLeftWidth: 3, borderLeftColor: C.violet }, h && !a && !soon && { backgroundColor: "rgba(128,128,128,0.05)" }, soon && { opacity: 0.5 }, { transition: "all 0.2s ease" } as any]}>
      <View style={[{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }, a && { backgroundColor: C.violet }]}>
        <Icon name={ic as any} size={16} color={a ? "#fff" : soon ? C.ink3 + "66" : C.ink3} />
      </View>
      {!collapsed && <Text style={[{ fontSize: 13, color: C.ink3, fontWeight: "500", flex: 1 }, a && { color: C.ink, fontWeight: "600" }]}>{l}</Text>}
      {!collapsed && soon && <View style={{ backgroundColor: C.bg4, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 8, color: C.ink3, fontWeight: "600", letterSpacing: 0.3 }}>Em breve</Text></View>}
      {!collapsed && pl && <View style={{ backgroundColor: pl === "expansao" ? Colors.green + "18" : Colors.violet3 + "18", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 8, color: pl === "expansao" ? Colors.green : Colors.violet3, fontWeight: "600" }}>{pl === "negocio" ? "NEG" : "EXP"}</Text></View>}
    </Pressable>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const C = useColors();
  const { isDark, toggle } = useThemeStore();
  const p = usePathname(), ro = useRouter(), { user: u, company: co, logout } = useAuthStore();
  const pl = co?.plan === "negocio" ? "Negocio" : co?.plan === "expansao" ? "Expansao" : "Essencial";
  const sw = collapsed ? 62 : 240;
  return (
    <View style={[{ width: sw, backgroundColor: C.bg2, borderRightWidth: 1, borderRightColor: C.border, paddingTop: 16, paddingBottom: 12, paddingHorizontal: collapsed ? 8 : 14, justifyContent: "flex-start" }, { transition: "width 0.25s ease, padding 0.25s ease" } as any]}>
      {/* Logo + Toggle */}
      <View style={{ flexDirection: "row", alignItems: collapsed ? "center" : "center", justifyContent: collapsed ? "center" : "space-between", paddingHorizontal: collapsed ? 0 : 8, paddingBottom: 14 }}>
        <Pressable onPress={() => ro.push("/")}><AuraLogo C={C} collapsed={collapsed} /></Pressable>
        {!collapsed && (
          <Pressable onPress={onToggle} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }}>
            <Icon name="chevron_left" size={14} color={C.ink3} />
          </Pressable>
        )}
      </View>

      {/* Collapse toggle when collapsed - at top */}
      {collapsed && (
        <Pressable onPress={onToggle} style={{ alignSelf: "center", width: 28, height: 28, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Icon name="chevron_right" size={14} color={C.ink3} />
        </Pressable>
      )}

      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 6 }} />

      <ScrollView style={{ flex: 1, marginTop: 4 }} showsVerticalScrollIndicator={false}>
        {NAV.map(s => (
          <View key={s.s} style={{ marginBottom: collapsed ? 8 : 16 }}>
            {!collapsed && <Text style={{ fontSize: 10, color: C.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.2, paddingHorizontal: 12, marginBottom: 6 }}>{s.s}</Text>}
            {collapsed && <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4, marginHorizontal: 4 }} />}
            {s.i.map(i => <SI key={i.r} l={i.l} ic={i.ic} a={isA(p, i.r)} onP={() => ro.push(i.r as any)} soon={i.soon} C={C} collapsed={collapsed} pl={i.plan} />)}
          </View>
        ))}
      </ScrollView>

      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 6 }} />

      <View style={{ paddingTop: 6, gap: 4 }}>
        {!collapsed ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, marginBottom: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.violet, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{(u?.name || "A").charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 12, color: C.ink, fontWeight: "600" }} numberOfLines={1}>{u?.name || "---"}</Text><Text style={{ fontSize: 10, color: C.violet3, marginTop: 1 }}>{pl}</Text></View>
            </View>
            <Pressable onPress={toggle} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
              <Icon name={isDark ? "sun" : "moon"} size={14} color={C.ink3} />
              <Text style={{ fontSize: 11, color: C.ink3, fontWeight: "500" }}>{isDark ? "Modo claro" : "Modo escuro"}</Text>
            </Pressable>
            <Pressable onPress={() => ro.push("/configuracoes" as any)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
              <Icon name="settings" size={14} color={C.ink3} /><Text style={{ fontSize: 11, color: C.ink3, fontWeight: "500" }}>Configuracoes</Text>
            </Pressable>
            
            <Pressable onPress={logout} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
              <Icon name="logout" size={14} color={C.ink3} /><Text style={{ fontSize: 11, color: C.ink3, fontWeight: "500" }}>Sair</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => ro.push("/")} style={{ alignSelf: "center", width: 34, height: 34, borderRadius: 17, backgroundColor: C.violet, alignItems: "center", justifyContent: "center", marginBottom: 4 }} {...(Platform.OS === "web" ? { title: u?.name || "Perfil" } : {})}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{(u?.name || "A").charAt(0).toUpperCase()}</Text>
            </Pressable>
            <Pressable onPress={toggle} style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }} {...(Platform.OS === "web" ? { title: isDark ? "Modo claro" : "Modo escuro" } : {})}>
              <Icon name={isDark ? "sun" : "moon"} size={14} color={C.ink3} />
            </Pressable>
            <Pressable onPress={() => ro.push("/configuracoes" as any)} style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }} {...(Platform.OS === "web" ? { title: "Configuracoes" } : {})}>
              <Icon name="settings" size={14} color={C.ink3} />
            </Pressable>
            <Pressable onPress={logout} style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }} {...(Platform.OS === "web" ? { title: "Sair" } : {})}>
              <Icon name="logout" size={14} color={C.ink3} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function MBar() {
  const C = useColors();
  const p = usePathname(), ro = useRouter();
  const [showMore, setShowMore] = useState(false);
  const MTABS = [
    { r: "/", l: "Painel", ic: "dashboard" },
    { r: "/pdv", l: "Caixa", ic: "cart" },
    { r: "/financeiro", l: "Financeiro", ic: "wallet" },
    { r: "/clientes", l: "Clientes", ic: "users" },
  ];
  const MORE_ITEMS = [
    { r: "/estoque", l: "Estoque", ic: "package" },
    { r: "/nfe", l: "NF-e", ic: "file_text" },
    { r: "/contabilidade", l: "Contabilidade", ic: "calculator" },
    { r: "/folha", l: "Folha", ic: "payroll" },
    { r: "/whatsapp", l: "WhatsApp", ic: "message" },
    { r: "/canal", l: "Canal Digital", ic: "globe" },
    { r: "/agendamento", l: "Agenda", ic: "calendar" },
    { r: "/agentes", l: "Agentes", ic: "brain" },
    { r: "/suporte", l: "Seu Analista", ic: "headset" },
    { r: "/configuracoes", l: "Configurações", ic: "settings" },
  ];
  return (
    <View style={{ position: "relative" }}>
      {showMore && Platform.OS === "web" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998, background: "rgba(0,0,0,0.5)" } as any} onClick={() => setShowMore(false)}>
          <div style={{ position: "absolute", bottom: 56, left: 8, right: 8, background: C.bg2, borderRadius: 16, border: "1px solid " + C.border, padding: 12, maxHeight: "60vh", overflowY: "auto", zIndex: 999 } as any} onClick={(e: any) => e.stopPropagation()}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 } as any}>
              {MORE_ITEMS.map(item => {
                const active = isA(p, item.r);
                return (
                  <div key={item.r} onClick={() => { ro.push(item.r as any); setShowMore(false); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 12, borderRadius: 12, cursor: "pointer", background: active ? C.violetD : "transparent", border: active ? "1px solid " + C.border2 : "1px solid transparent" } as any}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: active ? C.violet + "22" : C.bg4 } as any}><Icon name={item.ic as any} size={18} color={active ? C.violet3 : C.ink3} /></div>
                    <span style={{ fontSize: 10, color: active ? C.violet3 : C.ink3, fontWeight: active ? "600" : "500", textAlign: "center" } as any}>{item.l}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <View style={{ flexDirection: "row", backgroundColor: C.bg2, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS === "ios" ? 20 : 6, paddingTop: 6 }}>
        {MTABS.map(t => {
          const a = isA(p, t.r);
          return (
            <Pressable key={t.r} style={{ flex: 1, alignItems: "center", gap: 3 }} onPress={() => ro.push(t.r as any)}>
              <View style={[{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, a && { backgroundColor: C.violetD }]}><Icon name={t.ic as any} size={18} color={a ? C.violet3 : C.ink3} /></View>
              <Text style={[{ fontSize: 9, color: C.ink3, fontWeight: "500" }, a && { color: C.violet3, fontWeight: "600" }]}>{t.l}</Text>
            </Pressable>
          );
        })}
        <Pressable style={{ flex: 1, alignItems: "center", gap: 3 }} onPress={() => setShowMore(!showMore)}>
          <View style={[{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, showMore && { backgroundColor: C.violetD }]}><Icon name="settings" size={18} color={showMore ? C.violet3 : C.ink3} /></View>
          <Text style={[{ fontSize: 9, color: C.ink3, fontWeight: "500" }, showMore && { color: C.violet3, fontWeight: "600" }]}>Mais</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  // VER-02: Vertical modules
  const { activeModules, hasModule, primaryModule } = useModules();
  const verticalTheme = useVerticalTheme();
  useWebFonts();
  const C = useColors();
  const { isDark } = useThemeStore();
  const { onboardingComplete, token } = useAuthStore();
  const themeKey = isDark ? "dark" : "light";
  const screenW = useScreenWidth();
  const w = Platform.OS === "web";
  const isNarrow = screenW <= 768;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isNarrow);

  // Auto-collapse/expand when crossing breakpoint
  useEffect(() => {
    setSidebarCollapsed(isNarrow);
  }, [isNarrow]);

  const grad = isDark
    ? `radial-gradient(ellipse at 20% 0%,rgba(109,40,217,0.12) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(139,92,246,0.08) 0%,transparent 45%),radial-gradient(ellipse at 50% 50%,rgba(91,140,255,0.05) 0%,transparent 60%),${C.bg}`
    : `radial-gradient(ellipse at 20% 0%,rgba(109,40,217,0.06) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(139,92,246,0.04) 0%,transparent 45%),${C.bg}`;

  if (w && token && !onboardingComplete) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", background: grad, position: "relative", overflow: "auto" } as any}>
      <ToastContainer />
      <OnboardingScreen />
    </div>
  );

  if (w) return (
    <div style={{ display: "flex", flexDirection: "row", height: "100vh", width: "100%", background: C.bg, position: "relative" } as any}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div key={themeKey} style={{ flex: 1, minHeight: "100%", background: grad, overflow: "auto", position: "relative" } as any}>
        <ToastContainer />
        <PageTransition><Slot /></PageTransition>
      </div>
    </div>
  );

  if (token && !onboardingComplete) return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View key={themeKey} style={{ flex: 1 }}>
        <ToastContainer />
        <OnboardingScreen />
      </View>
    </View>
  );

  return (
    <ErrorBoundary>
    
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View key={themeKey} style={{ flex: 1 }}>
        <ToastContainer />
        <PageTransition><Slot /></PageTransition>
      </View>
      <MBar />
    </View>
      </ErrorBoundary>
  );
}
