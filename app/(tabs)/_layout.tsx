import { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Image } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { Colors, useColors, useThemeStore } from "@/constants/colors";
import { Fonts, GOOGLE_FONTS_CSS } from "@/constants/fonts";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import { ToastContainer } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useModules } from "@/hooks/useModules";
import { useVerticalTheme } from "@/hooks/useVerticalTheme";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { useSidebarLayout, applyLayoutToNav } from "@/hooks/useSidebarLayout";
import { SidebarEditor } from "@/components/SidebarEditor";
import { GlobalOverlays } from "@/components/GlobalOverlays";

const LOGO_SVG="https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Icon.png";
type NavItem = { r: string; l: string; ic: string; soon?: boolean; plan?: string; mod?: string; staff?: boolean };
type NavSection = { s: string; i: NavItem[] };

// Labels e icones das verticais. Usados pra renderizar a seção "Meu Segmento"
// dinamicamente quando company.vertical_active esta setado. Sem isso, a tela
// /vertical existe mas fica orfa — sem link no menu = usuario nao vai ver.
// Icones: ver components/Icon.tsx (tooth/scissors/utensils/sparkles/paw/dumbbell).
const VERTICAL_NAV: Record<string, { label: string; icon: string }> = {
  odonto:   { label: "Odontologia",    icon: "tooth" },
  barber:   { label: "Barber / Salao", icon: "scissors" },
  food:     { label: "Food Service",   icon: "utensils" },
  estetica: { label: "Estetica",       icon: "sparkles" },
  pet:      { label: "Pet Shop",       icon: "paw" },
  academia: { label: "Academia",       icon: "dumbbell" },
};

const NAV: NavSection[] = [
  { s: "Principal", i: [{ r: "/", l: "Painel", ic: "dashboard", mod: "painel" },{ r: "/financeiro", l: "Financeiro", ic: "wallet", mod: "financeiro" },{ r: "/nfe", l: "NF-e", ic: "file_text", mod: "nfe" }]},
  { s: "Contabil", i: [{ r: "/contabilidade", l: "Contabilidade", ic: "calculator", mod: "contabilidade" },{ r: "/suporte", l: "Seu Analista", ic: "headset", mod: "suporte" }]},
  { s: "Vendas", i: [{ r: "/pdv", l: "Caixa", ic: "cart", mod: "pdv" },{ r: "/estoque", l: "Estoque", ic: "package", mod: "estoque" }]},
  { s: "Equipe", i: [{ r: "/folha", l: "Folha", ic: "payroll", plan: "negocio", mod: "folha" },{ r: "/agendamento", l: "Agenda", ic: "calendar", plan: "negocio", mod: "agendamento" }]},
  { s: "Clientes", i: [{ r: "/clientes", l: "Clientes", ic: "users", plan: "negocio", mod: "clientes" },{ r: "/canal", l: "Canal Digital", ic: "globe", plan: "negocio", mod: "canal" }]},
  { s: "Crescimento", i: [{ r: "/agentes", l: "Agentes", ic: "brain", plan: "expansao", mod: "agentes" }]},
  { s: "Admin", i: [{ r: "/gestao-aura", l: "Gestao Aura", ic: "shield", staff: true }]},
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
    if (!document.getElementById("aura-favicon")) { const fav = document.createElement("link"); fav.id = "aura-favicon"; fav.rel = "icon"; fav.type = "image/png"; fav.href = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Icon.png"; document.head.appendChild(fav); }
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

// ============================================================
// Helper: monta o NAV "cru" — filtrado por plano/staff/vertical,
// MAS sem aplicar customizacoes do cliente (layout salvo).
// Usado tanto na renderizacao (depois aplica layout) quanto pra
// passar como baseNav pro SidebarEditor (cliente ve TUDO no editor).
// ============================================================
function buildRawNav(visibleMods: Set<string>, isStaff: boolean, activeVertical: string | null | undefined): NavSection[] {
  const base = NAV.map(section => ({
    ...section,
    i: section.i.filter(item => {
      if (item.staff && !isStaff) return false;
      return !item.mod || visibleMods.has(item.mod);
    }),
  })).filter(section => section.i.length > 0);

  if (activeVertical) {
    const meta = VERTICAL_NAV[activeVertical] || { label: "Modulo Vertical", icon: "star" };
    const verticalSection: NavSection = {
      s: "Meu Segmento",
      i: [{ r: "/vertical", l: meta.label, ic: meta.icon }],
    };
    const adminIdx = base.findIndex(s => s.s === "Admin");
    if (adminIdx >= 0) {
      base.splice(adminIdx, 0, verticalSection);
    } else {
      base.push(verticalSection);
    }
  }
  return base;
}

function AuraLogo({ C, collapsed }: { C: ReturnType<typeof useColors>; collapsed: boolean }) {
  if (collapsed) return <Image source={{ uri: LOGO_SVG }} style={{ width: 32, height: 32 }} resizeMode="contain" />;
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
  const visibleMods = useVisibleModules();
  const { layout } = useSidebarLayout();
  const [editorOpen, setEditorOpen] = useState(false);
  const pl = co?.plan === "negocio" ? "Negocio" : co?.plan === "expansao" ? "Expansao" : "Essencial";
  const sw = collapsed ? 62 : 240;
  const isStaff = (u as any)?.is_staff === true;
  const activeVertical = (co as any)?.vertical_active as string | null | undefined;

  // rawFilteredNav: NAV cru (so plano/staff/vertical), passado pro editor pra
  // cliente ver TUDO disponivel.
  const rawFilteredNav = useMemo(
    () => buildRawNav(visibleMods, isStaff, activeVertical),
    [visibleMods, isStaff, activeVertical]
  );

  // filteredNav: rawFilteredNav + customizacoes do cliente aplicadas.
  // Se layout for null, retorna o raw inalterado.
  const filteredNav = useMemo(
    () => applyLayoutToNav(rawFilteredNav, layout),
    [rawFilteredNav, layout]
  );

  return (
    <View style={[{ width: sw, height: '100%', backgroundColor: C.bg2, borderRightWidth: 1, borderRightColor: C.border, paddingTop: 16, paddingBottom: 12, paddingHorizontal: collapsed ? 8 : 14, justifyContent: "flex-start", overflow: "hidden" as any }, { transition: "width 0.25s ease, padding 0.25s ease" } as any]}>
      <View style={{ flexDirection: "row", alignItems: collapsed ? "center" : "center", justifyContent: collapsed ? "center" : "space-between", paddingHorizontal: collapsed ? 0 : 8, paddingBottom: 14 }}>
        <Pressable onPress={() => ro.push("/")}><AuraLogo C={C} collapsed={collapsed} /></Pressable>
        {!collapsed && (
          <Pressable onPress={onToggle} style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }}>
            <Icon name="chevron_left" size={14} color={C.ink3} />
          </Pressable>
        )}
      </View>
      {collapsed && (
        <Pressable onPress={onToggle} style={{ alignSelf: "center", width: 28, height: 28, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Icon name="chevron_right" size={14} color={C.ink3} />
        </Pressable>
      )}
      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 6 }} />

      <ScrollView style={{ flex: 1, marginTop: 4 }} showsVerticalScrollIndicator={true}>
        {filteredNav.map(s => (
          <View key={s.s} style={{ marginBottom: collapsed ? 8 : 16 }}>
            {!collapsed && <Text style={{ fontSize: 10, color: C.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.2, paddingHorizontal: 12, marginBottom: 6 }}>{s.s}</Text>}
            {collapsed && <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4, marginHorizontal: 4 }} />}
            {s.i.map(i => <SI key={i.r} l={i.l} ic={i.ic} a={isA(p, i.r)} onP={() => ro.push(i.r as any)} soon={i.soon} C={C} collapsed={collapsed} pl={i.plan} />)}
          </View>
        ))}
      </ScrollView>

      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 6 }} />
      <View style={{ paddingTop: 6, gap: 4, flexShrink: 0 }}>
        {!collapsed ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, marginBottom: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.violet, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{(u?.name || "A").charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 12, color: C.ink, fontWeight: "600" }} numberOfLines={1}>{u?.name || "---"}</Text><Text style={{ fontSize: 10, color: C.violet3, marginTop: 1 }}>{pl}</Text></View>
            </View>
            <Pressable onPress={() => setEditorOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
              <Icon name="edit" size={14} color={C.ink3} />
              <Text style={{ fontSize: 11, color: C.ink3, fontWeight: "500" }}>Personalizar menu</Text>
            </Pressable>
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
            <Pressable onPress={() => ro.push("/")} style={{ alignSelf: "center", width: 34, height: 34, borderRadius: 17, backgroundColor: C.violet, alignItems: "center", justifyContent: "center", marginBottom: 4 }} {...(Platform.OS === "web" ? { title: u?.name || "Perfil" } : {})}><Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{(u?.name || "A").charAt(0).toUpperCase()}</Text></Pressable>
            <Pressable onPress={() => setEditorOpen(true)} style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }} {...(Platform.OS === "web" ? { title: "Personalizar menu" } : {})}><Icon name="edit" size={14} color={C.ink3} /></Pressable>
            <Pressable onPress={toggle} style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }} {...(Platform.OS === "web" ? { title: isDark ? "Modo claro" : "Modo escuro" } : {})}><Icon name={isDark ? "sun" : "moon"} size={14} color={C.ink3} /></Pressable>
            <Pressable onPress={() => ro.push("/configuracoes" as any)} style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }} {...(Platform.OS === "web" ? { title: "Configuracoes" } : {})}><Icon name="settings" size={14} color={C.ink3} /></Pressable>
            <Pressable onPress={logout} style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }} {...(Platform.OS === "web" ? { title: "Sair" } : {})}><Icon name="logout" size={14} color={C.ink3} /></Pressable>
          </>
        )}
      </View>

      <SidebarEditor visible={editorOpen} onClose={() => setEditorOpen(false)} baseNav={rawFilteredNav} />
    </View>
  );
}

function MBar() {
  const C = useColors();
  const p = usePathname(), ro = useRouter();
  const { user: u, company: co } = useAuthStore();
  const visibleMods = useVisibleModules();
  const { layout } = useSidebarLayout();
  const [showMore, setShowMore] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const isStaff = (u as any)?.is_staff === true;
  const activeVertical = (co as any)?.vertical_active as string | null | undefined;

  // 4 tabs fixas no rodape (nao editaveis pelo cliente).
  const MTABS = [
    { r: "/", l: "Painel", ic: "dashboard", mod: "painel" },
    { r: "/pdv", l: "Caixa", ic: "cart", mod: "pdv" },
    { r: "/financeiro", l: "Financeiro", ic: "wallet", mod: "financeiro" },
    { r: "/estoque", l: "Estoque", ic: "package", mod: "estoque" },
  ];
  const fixedTabKeys = new Set(MTABS.map(t => t.r));

  // rawFilteredNav: mesma logica do desktop, base unica de items disponiveis.
  const rawFilteredNav = useMemo(
    () => buildRawNav(visibleMods, isStaff, activeVertical),
    [visibleMods, isStaff, activeVertical]
  );

  // filteredNav: aplica layout custom do cliente.
  const filteredNav = useMemo(
    () => applyLayoutToNav(rawFilteredNav, layout),
    [rawFilteredNav, layout]
  );

  // Items pro menu "Mais" = todos do filteredNav que NAO estao nas tabs fixas.
  // Achata mantendo ordem global do layout.
  const filteredMore = useMemo(() => {
    const flat: NavItem[] = [];
    for (const section of filteredNav) {
      for (const item of section.i) {
        if (!fixedTabKeys.has(item.r)) flat.push(item);
      }
    }
    return flat;
  }, [filteredNav]);

  const filteredTabs = MTABS.filter(t => visibleMods.has(t.mod));

  return (
    <View style={{ position: "relative", flexShrink: 0, zIndex: 50 } as any}>
      {showMore && Platform.OS === "web" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998, background: "rgba(0,0,0,0.5)" } as any} onClick={() => setShowMore(false)}>
          <div style={{ position: "absolute", bottom: 56, left: 8, right: 8, background: C.bg2, borderRadius: 16, border: "1px solid " + C.border, padding: 12, maxHeight: "60vh", overflowY: "auto", zIndex: 999 } as any} onClick={(e: any) => e.stopPropagation()}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 } as any}>
              {filteredMore.map(item => {
                const active = isA(p, item.r);
                return (
                  <div key={item.r} onClick={() => { ro.push(item.r as any); setShowMore(false); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 12, borderRadius: 12, cursor: "pointer", background: active ? C.violetD : "transparent", border: active ? "1px solid " + C.border2 : "1px solid transparent" } as any}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: active ? C.violet + "22" : C.bg4 } as any}><Icon name={item.ic as any} size={18} color={active ? C.violet3 : C.ink3} /></div>
                    <span style={{ fontSize: 10, color: active ? C.violet3 : C.ink3, fontWeight: active ? "600" : "500", textAlign: "center" } as any}>{item.l}</span>
                  </div>
                );
              })}
              {/* Botao "Personalizar menu" no rodape do menu Mais */}
              <div onClick={() => { setShowMore(false); setEditorOpen(true); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 12, borderRadius: 12, cursor: "pointer", background: "transparent", border: "1px dashed " + C.border2 } as any}>
                <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg4 } as any}><Icon name="edit" size={18} color={C.ink3} /></div>
                <span style={{ fontSize: 10, color: C.ink3, fontWeight: "500", textAlign: "center" } as any}>Personalizar</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <View style={{ flexDirection: "row", backgroundColor: C.bg2, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS === "ios" ? 20 : 6, paddingTop: 6, flexShrink: 0 }}>
        {filteredTabs.map(t => {
          const a = isA(p, t.r);
          return (
            <Pressable key={t.r} style={{ flex: 1, alignItems: "center", gap: 3 }} onPress={() => ro.push(t.r as any)}>
              <View style={[{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, a && { backgroundColor: C.violetD }]}><Icon name={t.ic as any} size={18} color={a ? C.violet3 : C.ink3} /></View>
              <Text style={[{ fontSize: 9, color: C.ink3, fontWeight: "500" }, a && { color: C.violet3, fontWeight: "600" }]}>{t.l}</Text>
            </Pressable>
          );
        })}
        <Pressable style={{ flex: 1, alignItems: "center", gap: 3 }} onPress={() => setShowMore(!showMore)}>
          <View style={[{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, showMore && { backgroundColor: C.violetD }]}>
            <Icon name="grid" size={18} color={showMore ? C.violet3 : C.ink3} />
          </View>
          <Text style={[{ fontSize: 9, color: C.ink3, fontWeight: "500" }, showMore && { color: C.violet3, fontWeight: "600" }]}>Mais</Text>
        </Pressable>
      </View>

      <SidebarEditor visible={editorOpen} onClose={() => setEditorOpen(false)} baseNav={rawFilteredNav} />
    </View>
  );
}

export default function TabsLayout() {
  const { activeModules, hasModule, primaryModule } = useModules();
  const verticalTheme = useVerticalTheme();
  useWebFonts();
  const C = useColors();
  const { isDark } = useThemeStore();
  const { token } = useAuthStore();
  const themeKey = isDark ? "dark" : "light";
  const screenW = useScreenWidth();
  const w = Platform.OS === "web";
  const isNarrow = screenW <= 768;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isNarrow);

  useEffect(() => { setSidebarCollapsed(isNarrow); }, [isNarrow]);

  const grad = isDark
    ? `radial-gradient(ellipse at 20% 0%,rgba(109,40,217,0.12) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(139,92,246,0.08) 0%,transparent 45%),radial-gradient(ellipse at 50% 50%,rgba(91,140,255,0.05) 0%,transparent 60%),${C.bg}`
    : `radial-gradient(ellipse at 20% 0%,rgba(109,40,217,0.06) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(139,92,246,0.04) 0%,transparent 45%),${C.bg}`;

  // MOBILE WEB: flex column com height:100vh.
  // `minHeight: 0` no wrapper do Slot e `flexShrink: 0` na MBar sao essenciais:
  // sem isso, quando o conteudo da tela e alto (ex: Caixa, Estoque), o flex:1
  // nao comprime (default min-height:auto em flex items) e empurra a MBar para
  // fora da viewport, deixando o usuario sem navegacao.
  if (w && isNarrow) return (
    <div key={themeKey} style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", background: grad, position: "relative", overflow: "hidden" } as any}>
      <ToastContainer />
      <div style={{ flex: 1, overflow: "auto", position: "relative", minHeight: 0, minWidth: 0 } as any}>
        <PageTransition><Slot /></PageTransition>
      </div>
      <MBar />
      <GlobalOverlays />
    </div>
  );

  if (w) return (
    <div style={{ display: "flex", flexDirection: "row", height: "100vh", width: "100%", background: C.bg, position: "relative" } as any}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div key={themeKey} style={{ flex: 1, minHeight: "100%", background: grad, overflow: "auto", position: "relative", minWidth: 0 } as any}>
        <ToastContainer />
        <PageTransition><Slot /></PageTransition>
      </div>
      <GlobalOverlays />
    </div>
  );

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View key={themeKey} style={{ flex: 1 }}>
          <ToastContainer />
          <PageTransition><Slot /></PageTransition>
        </View>
        <MBar />
        <GlobalOverlays />
      </View>
    </ErrorBoundary>
  );
}
