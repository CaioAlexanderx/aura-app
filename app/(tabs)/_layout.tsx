import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Image } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { useColors, useThemeStore } from "@/constants/colors";
import { Fonts, GOOGLE_FONTS_CSS } from "@/constants/fonts";
import { useAuthStore } from "@/stores/auth";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import { ToastContainer } from "@/components/Toast";
import OnboardingScreen from "@/app/(tabs)/onboarding";

const LOGO="https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Aura.jpeg";
type NavItem = { r: string; l: string; ic: string; soon?: boolean };
type NavSection = { s: string; i: NavItem[] };

const NAV: NavSection[] = [
  { s: "Principal", i: [{ r: "/", l: "Painel", ic: "dashboard" },{ r: "/financeiro", l: "Financeiro", ic: "wallet" },{ r: "/nfe", l: "NF-e", ic: "file_text" }]},
  { s: "Contabil", i: [{ r: "/contabilidade", l: "Contabilidade", ic: "calculator" }]},
  { s: "Vendas", i: [{ r: "/pdv", l: "PDV", ic: "cart" },{ r: "/estoque", l: "Estoque", ic: "package" }]},
  { s: "Equipe", i: [{ r: "/folha", l: "Folha de Pagamento", ic: "payroll" }]},
  { s: "Clientes", i: [{ r: "/clientes", l: "Clientes", ic: "users" },{ r: "/whatsapp", l: "WhatsApp", ic: "star" },{ r: "/canal", l: "Canal Digital", ic: "bar_chart" }]},
  { s: "Crescimento", i: [{ r: "/agentes", l: "Agentes", ic: "star" }]},
];
const MTABS = [
  { r: "/", l: "Painel", ic: "dashboard" },
  { r: "/pdv", l: "PDV", ic: "cart" },
  { r: "/financeiro", l: "Fin", ic: "wallet" },
  { r: "/clientes", l: "Clientes", ic: "users" },
];
const MORE_ITEMS = [
  { r: "/contabilidade", l: "Contabilidade", ic: "calculator" },
  { r: "/estoque", l: "Estoque", ic: "package" },
  { r: "/nfe", l: "NF-e", ic: "file_text" },
  { r: "/folha", l: "Folha de Pagamento", ic: "payroll" },
  { r: "/configuracoes", l: "Configurações", ic: "settings" },
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
    if (!document.getElementById("aura-favicon")) { const fav = document.createElement("link"); fav.id = "aura-favicon"; fav.rel = "icon"; fav.type = "image/svg+xml"; fav.href = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/favicon.svg"; document.head.appendChild(fav); const fav2 = document.createElement("link"); fav2.rel = "icon"; fav2.type = "image/jpeg"; fav2.href = "https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Aura.jpeg"; document.head.appendChild(fav2); }
    if (!document.getElementById("aura-wow-css")) { const wc = document.createElement("style"); wc.id = "aura-wow-css"; wc.textContent = "* { font-variant-numeric: tabular-nums; } a, button, [role=button] { cursor: pointer !important; } ::selection { background: rgba(124,58,237,0.3); color: inherit; } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.25); border-radius: 3px; } ::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.4); } @keyframes auraStagger { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes auraBounce { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 70% { transform: scale(0.95); } 100% { transform: scale(1); } }"; document.head.appendChild(wc); }
  }, []);
}

function isA(p: string, r: string) {
  if (r === "/") return p === "/" || p === "" || p.endsWith("/index") || p === "/(tabs)";
  return p.includes(r.replace("/", ""));
}

function SI({ l, ic, a, onP, soon, C }: { l: string; ic: string; a: boolean; onP: () => void; soon?: boolean; C: ReturnType<typeof useColors> }) {
  const [h, sH] = useState(false);
  return (
    <Pressable onPress={soon ? undefined : onP} onHoverIn={() => sH(true)} onHoverOut={() => sH(false)}
      {...(Platform.OS === "web" ? { title: l } : {})}
      style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2 }, a && { backgroundColor: C.violetD, borderLeftWidth: 3, borderLeftColor: C.violet }, h && !a && !soon && { backgroundColor: "rgba(128,128,128,0.05)" }, soon && { opacity: 0.5 }, { transition: "all 0.15s ease" } as any]}>
      <View style={[{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }, a && { backgroundColor: C.violet }]}>
        <Icon name={ic as any} size={16} color={a ? "#fff" : soon ? C.ink3 + "66" : C.ink3} />
      </View>
      <Text style={[{ fontSize: 13, color: C.ink3, fontWeight: "500", flex: 1 }, a && { color: C.ink, fontWeight: "600" }]}>{l}</Text>
      {soon && <View style={{ backgroundColor: C.bg4, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 8, color: C.ink3, fontWeight: "600", letterSpacing: 0.3 }}>Em breve</Text></View>}
    </Pressable>
  );
}

function Sidebar() {
  const C = useColors();
  const { isDark, toggle } = useThemeStore();
  const p = usePathname(), ro = useRouter(), { user: u, company: co, logout } = useAuthStore();
  const pl = co?.plan === "negocio" ? "Negocio" : co?.plan === "expansao" ? "Expansao" : "Essencial";
  return (
    <View style={{ width: 240, backgroundColor: C.bg2, borderRightWidth: 1, borderRightColor: C.border, paddingTop: 20, paddingBottom: 16, paddingHorizontal: 14, justifyContent: "flex-start" }}>
      <Pressable onPress={() => ro.push("/")} style={{ paddingHorizontal: 8, paddingBottom: 16, alignItems: "flex-start" }}><Image source={{ uri: LOGO }} style={{ width: 130, height: 48 }} resizeMode="contain" /></Pressable>
      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
      <ScrollView style={{ flex: 1, marginTop: 4 }} showsVerticalScrollIndicator={false}>
        {NAV.map(s => <View key={s.s} style={{ marginBottom: 16 }}><Text style={{ fontSize: 10, color: C.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.2, paddingHorizontal: 12, marginBottom: 6 }}>{s.s}</Text>{s.i.map(i => <SI key={i.r} l={i.l} ic={i.ic} a={isA(p, i.r)} onP={() => ro.push(i.r as any)} soon={i.soon} C={C} />)}</View>)}
      </ScrollView>
      <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
      <View style={{ paddingTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, marginBottom: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: C.violet, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{(u?.name || "A").charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 12, color: C.ink, fontWeight: "600" }} numberOfLines={1}>{u?.name || "---"}</Text><Text style={{ fontSize: 10, color: C.violet3, marginTop: 1 }}>{pl}</Text></View>
        </View>
        <View style={{ gap: 6 }}>
          <Pressable onPress={toggle} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
            <Icon name={isDark ? "star" : "dashboard"} size={14} color={C.ink3} />
            <Text style={{ fontSize: 11, color: C.ink3, fontWeight: "500" }}>{isDark ? "Modo claro" : "Modo escuro"}</Text>
          </Pressable>
          <Pressable onPress={() => ro.push("/configuracoes" as any)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
            <Icon name="settings" size={14} color={C.ink3} /><Text style={{ fontSize: 11, color: C.ink3, fontWeight: "500" }}>Configuracoes</Text>
          </Pressable>
          <Pressable onPress={logout} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
            <Icon name="logout" size={14} color={C.ink3} /><Text style={{ fontSize: 11, color: C.ink3, fontWeight: "500" }}>Sair</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MBar() {
  const C = useColors();
  const p = usePathname(), ro = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_ITEMS.some(i => isA(p, i.r));
  return (
    <View>
      {moreOpen && (
        <View style={{ position: "absolute" as any, bottom: 0, left: 0, right: 0, top: 0, zIndex: 50 }}>
          <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }} onPress={() => setMoreOpen(false)} />
          <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: C.border }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.bg4, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontSize: 14, color: C.ink, fontWeight: "700", marginBottom: 14 }}>Mais opções</Text>
            {MORE_ITEMS.map(item => {
              const a = isA(p, item.r);
              return (
                <Pressable key={item.r} style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4 }, a && { backgroundColor: C.violetD }]} onPress={() => { setMoreOpen(false); ro.push(item.r as any); }}>
                  <View style={[{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.bg4, alignItems: "center", justifyContent: "center" }, a && { backgroundColor: C.violet }]}><Icon name={item.ic as any} size={18} color={a ? "#fff" : C.ink3} /></View>
                  <Text style={[{ fontSize: 14, color: C.ink3, fontWeight: "500" }, a && { color: C.ink, fontWeight: "600" }]}>{item.l}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      <View style={{ flexDirection: "row", backgroundColor: C.bg2, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS === "ios" ? 20 : 6, paddingTop: 6 }}>
        {MTABS.map(t => {
          const a = isA(p, t.r);
          return (
            <Pressable key={t.r} style={{ flex: 1, alignItems: "center", gap: 3 }} onPress={() => { setMoreOpen(false); ro.push(t.r as any); }}>
              <View style={[{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, a && { backgroundColor: C.violetD }]}><Icon name={t.ic as any} size={18} color={a ? C.violet3 : C.ink3} /></View>
              <Text style={[{ fontSize: 9, color: C.ink3, fontWeight: "500" }, a && { color: C.violet3, fontWeight: "600" }]}>{t.l}</Text>
            </Pressable>
          );
        })}
        <Pressable style={{ flex: 1, alignItems: "center", gap: 3 }} onPress={() => setMoreOpen(!moreOpen)}>
          <View style={[{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, (moreOpen || moreActive) && { backgroundColor: C.violetD }]}>
            <Icon name="settings" size={18} color={(moreOpen || moreActive) ? C.violet3 : C.ink3} />
          </View>
          <Text style={[{ fontSize: 9, color: C.ink3, fontWeight: "500" }, (moreOpen || moreActive) && { color: C.violet3, fontWeight: "600" }]}>Mais</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  useWebFonts();
  const C = useColors();
  const { isDark } = useThemeStore();
  const { onboardingComplete, token } = useAuthStore();
  const themeKey = isDark ? "dark" : "light";
  const w = Platform.OS === "web";
  const grad = isDark
    ? `radial-gradient(ellipse at 20% 0%,rgba(109,40,217,0.12) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(139,92,246,0.08) 0%,transparent 45%),radial-gradient(ellipse at 50% 50%,rgba(91,140,255,0.05) 0%,transparent 60%),${C.bg}`
    : `radial-gradient(ellipse at 20% 0%,rgba(109,40,217,0.06) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(139,92,246,0.04) 0%,transparent 45%),${C.bg}`;

  if (w && token && !onboardingComplete) return (
    <div style={{ display: "flex", flexDirection: "row", height: "100vh", width: "100%", background: C.bg, position: "relative" } as any}>
      <div key={themeKey} style={{ flex: 1, minHeight: "100%", background: grad, overflow: "auto", position: "relative" } as any}>
        <ToastContainer />
        <OnboardingScreen />
      </div>
    </div>
  );

  if (w) return (
    <div style={{ display: "flex", flexDirection: "row", height: "100vh", width: "100%", background: C.bg, position: "relative" } as any}>
      <Sidebar />
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
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View key={themeKey} style={{ flex: 1 }}>
        <ToastContainer />
        <PageTransition><Slot /></PageTransition>
      </View>
      <MBar />
    </View>
  );
}
