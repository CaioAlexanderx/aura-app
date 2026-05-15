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
import { CompanySwitcher } from "@/components/CompanySwitcher"; // M1-06: Multi-CNPJ switcher

const LOGO_SVG="https://cdn.jsdelivr.net/gh/CaioAlexanderx/aura-app@main/assets/Icon.png";
type NavItem = { r: string; l: string; ic: string; soon?: boolean; plan?: string; mod?: string; staff?: boolean };
type NavSection = { s: string; i: NavItem[] };

// Labels e icones das verticais. Usados pra renderizar a seção "Meu Segmento"
// dinamicamente quando company.vertical_active esta setado. Sem isso, a tela
// /vertical existe mas fica orfa — sem link no menu = usuario nao vai ver.
// Icones: ver components/Icon.tsx (tooth/scissors/utensils/sparkles/paw/dumbbell).
//
// EXCECAO odonto: ver buildRawNav abaixo. Odonto tem porta dedicada e NAO
// aparece nessa secao.
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
  // /vendas (15/05/2026) — modulo proprio "vendas"; nao herda mais do pdv.
  // Permite controlar visibilidade separadamente do Caixa (ex: Kaila/Vitoria).
  // /crediario (14/05/2026) — dashboard inadimplencia + regua de cobranca.
  // Modulo proprio "crediario" (negocio+); nao herda mais do pdv.
  { s: "Vendas", i: [{ r: "/pdv", l: "Caixa", ic: "cart", mod: "pdv" },{ r: "/vendas", l: "Vendas", ic: "receipt", mod: "vendas" },{ r: "/crediario", l: "Crediário", ic: "percent", mod: "crediario", plan: "negocio" },{ r: "/estoque", l: "Estoque", ic: "package", mod: "estoque" }]},
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
    // ============================================================
    // Sidebar Premium v2 — animations & hover styles (08/05/2026)
    // Aurora drift, brand spin/halo, plan pulse, ws shimmer + nav
    // hover transforms. Lives outside React render to play well with
    // CSS keyframes and to avoid re-injecting on each Sidebar mount.
    // ============================================================
    if (!document.getElementById("aura-sb-premium-css")) {
      const sb = document.createElement("style"); sb.id = "aura-sb-premium-css";
      sb.textContent = `
@keyframes auraDrift { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-4%, 2%) scale(1.05); } 100% { transform: translate(3%, -2%) scale(1.02); } }
@keyframes brandSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes brandHalo { 0%, 100% { opacity: 0.55; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.1); } }
@keyframes auraPlanPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes auraWsShimmer { 0% { background-position: 200% 0; } 50% { background-position: -100% 0; } 100% { background-position: -100% 0; } }
.aura-sb-aurora { position: absolute; inset: -10% -20% -10% -20%; z-index: 0; pointer-events: none; animation: auraDrift 18s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate; filter: blur(2px); }
.aura-sb-aurora-dark { background: radial-gradient(ellipse 380px 220px at 30% 8%, rgba(167,139,250,0.32) 0%, transparent 65%), radial-gradient(ellipse 260px 180px at 80% 26%, rgba(91,140,255,0.22) 0%, transparent 65%), radial-gradient(ellipse 320px 200px at 20% 78%, rgba(124,58,237,0.20) 0%, transparent 65%), radial-gradient(ellipse 200px 150px at 90% 92%, rgba(167,139,250,0.18) 0%, transparent 65%); }
.aura-sb-aurora-light { background: radial-gradient(ellipse 380px 220px at 30% 8%, rgba(124,58,237,0.32) 0%, transparent 65%), radial-gradient(ellipse 260px 180px at 80% 26%, rgba(167,139,250,0.40) 0%, transparent 65%), radial-gradient(ellipse 320px 200px at 20% 78%, rgba(139,92,246,0.32) 0%, transparent 65%), radial-gradient(ellipse 200px 150px at 90% 92%, rgba(196,181,253,0.45) 0%, transparent 65%); opacity: 0.85; }
.aura-sb-seam { position: absolute; top: 0; bottom: 0; right: 0; width: 1px; background: linear-gradient(180deg, transparent 0%, rgba(167,139,250,0.4) 30%, rgba(124,58,237,0.5) 50%, rgba(91,140,255,0.3) 70%, transparent 100%); z-index: 1; opacity: 0.7; pointer-events: none; }
.aura-brand-glyph { position: relative; width: 40px; height: 40px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.aura-brand-glyph::before { content: ""; position: absolute; inset: -6px; border-radius: 50%; background: radial-gradient(circle, rgba(167,139,250,0.45) 0%, transparent 65%); animation: brandHalo 3.4s ease-in-out infinite; z-index: 1; }
.aura-brand-glyph img { width: 40px; height: 40px; position: relative; z-index: 2; border-radius: 50%; animation: brandSpin 80s linear infinite; filter: drop-shadow(0 0 16px rgba(124,58,237,0.55)); }
.aura-ws-shimmer::before { content: ""; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.12) 48%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.12) 52%, transparent 70%); background-size: 250% 100%; background-position: 200% 0; animation: auraWsShimmer 5.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; pointer-events: none; border-radius: inherit; }
.aura-ws-shimmer.aura-ws-shimmer-light::before { background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.5) 48%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.5) 52%, transparent 70%); background-size: 250% 100%; }
.aura-plan-dot { width: 5px; height: 5px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px rgba(52,211,153,0.8); animation: auraPlanPulse 2.4s ease-in-out infinite; }
.aura-nav-item { transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; }
.aura-nav-item:hover { transform: translateX(2px); }
.aura-nav-item .aura-nav-tile { transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1); }
.aura-nav-item:not(.is-active):hover .aura-nav-tile { background: rgba(124,58,237,0.10) !important; color: var(--aura-sb-violet3, #a78bfa) !important; border-color: rgba(120,100,240,0.30) !important; }
.aura-nav-item:not(.is-active):hover { background: rgba(124,58,237,0.06); color: var(--aura-sb-ink, #f0edff) !important; }
.aura-fa-row { transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1); }
.aura-fa-row:hover { background: rgba(124,58,237,0.10); }
.aura-fa-row .aura-fa-chev { opacity: 0; transition: opacity 0.18s cubic-bezier(0.4, 0, 0.2, 1); }
.aura-fa-row:hover .aura-fa-chev { opacity: 0.6; }
.aura-fa-row.aura-fa-row-danger:hover { background: rgba(248,113,113,0.10); }
.aura-icon-btn { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.aura-icon-btn:hover { background: rgba(124,58,237,0.10); transform: translateY(-1px); }
.aura-ws-card { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.aura-ws-card:hover { transform: translateY(-1px); border-color: rgba(124,58,237,0.5) !important; }
`;
      document.head.appendChild(sb);
    }
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

  // Odonto NAO aparece em "Meu Segmento": tem porta dedicada
  // /dental/(clinic)/hoje (decisao 2026-04-25, ver memory:
  // plano_aura_odonto_portal). Outras verticais continuam aqui.
  if (activeVertical && activeVertical !== "odonto") {
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

// ============================================================
// Brand Glyph — logo girando devagar com halo pulsante. Esconde
// o wordmark no modo collapsed.
// ============================================================
function BrandGlyph({ collapsed }: { collapsed: boolean }) {
  const C = useColors();
  if (Platform.OS !== "web") {
    // Native fallback (não usado de fato porque Sidebar só renderiza no web)
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Image source={{ uri: LOGO_SVG }} style={{ width: 36, height: 36 }} resizeMode="contain" />
        {!collapsed && <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink, letterSpacing: -0.5 }}>Aura<Text style={{ color: "#7c3aed" }}>.</Text></Text>}
      </View>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 } as any}>
      <div className="aura-brand-glyph">
        <img src={LOGO_SVG} alt="Aura" />
      </div>
      {!collapsed && (
        <span style={{ fontFamily: Fonts.heading, fontSize: 26, fontWeight: 400, letterSpacing: "-0.6px", color: C.ink, lineHeight: 1 } as any}>
          Aura<span style={{ color: "#7c3aed" } as any}>.</span>
        </span>
      )}
    </div>
  );
}

// ============================================================
// NavItem (web) — item da sidebar no novo design. Tile + texto +
// badge de plano. Active state com gradient + tile colorido.
// Hover/transitions tratados via CSS classes (aura-nav-item).
// ============================================================
function NavItemRow({ l, ic, a, onP, soon, C, collapsed, pl, isDark }: { l: string; ic: string; a: boolean; onP: () => void; soon?: boolean; C: ReturnType<typeof useColors>; collapsed: boolean; pl?: string; isDark: boolean }) {
  if (Platform.OS !== "web") {
    // Native fallback
    return (
      <Pressable onPress={soon ? undefined : onP}
        style={[{ flexDirection: "row", alignItems: "center", gap: collapsed ? 0 : 11, paddingVertical: 9, paddingHorizontal: collapsed ? 0 : 10, borderRadius: 11, marginBottom: 2, justifyContent: collapsed ? "center" : "flex-start" }, a && { backgroundColor: C.violetD }, soon && { opacity: 0.5 }]}>
        <View style={[{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.bg3, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border }, a && { backgroundColor: C.violet, borderColor: C.violet2 }]}>
          <Icon name={ic as any} size={16} color={a ? "#fff" : soon ? C.ink3 + "66" : C.ink3} />
        </View>
        {!collapsed && <Text style={[{ fontSize: 13.5, color: C.ink3, fontWeight: "500", flex: 1 }, a && { color: C.ink, fontWeight: "600" }]}>{l}</Text>}
      </Pressable>
    );
  }

  const activeBg = a
    ? (isDark ? "linear-gradient(90deg, rgba(124,58,237,0.20) 0%, rgba(124,58,237,0.04) 90%)" : "linear-gradient(90deg, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.02) 90%)")
    : "transparent";
  const tileBg = a ? "linear-gradient(135deg, " + C.violet2 + " 0%, " + C.violet + " 100%)" : C.bg3;
  const tileColor = a ? "#fff" : (soon ? C.ink3 + "66" : C.ink3);
  const tileBorder = a ? "rgba(167,139,250,0.4)" : C.border;
  const planBg = pl === "expansao" ? "rgba(52,211,153,0.12)" : "rgba(167,139,250,0.14)";
  const planFg = pl === "expansao" ? C.green : C.violet3;
  const planBorder = pl === "expansao" ? "rgba(52,211,153,0.24)" : "rgba(167,139,250,0.22)";

  return (
    <a
      onClick={(e: any) => { e.preventDefault(); if (!soon) onP(); }}
      title={l}
      className={"aura-nav-item" + (a ? " is-active" : "")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: collapsed ? 0 : 11,
        padding: collapsed ? "8px 0" : "8px 10px",
        borderRadius: 11,
        marginBottom: 1,
        cursor: soon ? "not-allowed" : "pointer",
        textDecoration: "none",
        color: a ? C.ink : C.ink3,
        background: activeBg,
        opacity: soon ? 0.5 : 1,
        justifyContent: collapsed ? "center" : "flex-start",
      } as any}
    >
      <div className="aura-nav-tile" style={{
        width: 32,
        height: 32,
        borderRadius: 9,
        background: tileBg,
        border: "1px solid " + tileBorder,
        color: tileColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: a ? "0 4px 12px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.2)" : "none",
      } as any}>
        <Icon name={ic as any} size={16} color={tileColor} />
      </div>
      {!collapsed && (
        <span style={{
          flex: 1,
          fontSize: 13.5,
          fontWeight: a ? 600 : 500,
          letterSpacing: "-0.1px",
          color: a ? C.ink : "inherit",
        } as any}>{l}</span>
      )}
      {!collapsed && soon && (
        <span style={{ background: C.bg4, borderRadius: 4, padding: "1px 5px", fontSize: 8, color: C.ink3, fontWeight: 600, letterSpacing: "0.3px" } as any}>Em breve</span>
      )}
      {!collapsed && pl && (
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.5px",
          padding: "2px 6px",
          borderRadius: 4,
          background: planBg,
          color: planFg,
          border: "1px solid " + planBorder,
        } as any}>{pl === "negocio" ? "NEG" : "EXP"}</span>
      )}
    </a>
  );
}

// ============================================================
// FooterRow — botões do rodapé (Personalizar / Tema /
// Configurações / Sair). No collapsed vira só ícone centralizado.
// ============================================================
function FooterRow({ icon, label, onPress, danger, collapsed, C }: { icon: string; label: string; onPress: () => void; danger?: boolean; collapsed: boolean; C: ReturnType<typeof useColors> }) {
  if (Platform.OS !== "web") {
    return (
      <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8 }}>
        <Icon name={icon as any} size={16} color={danger ? C.red : C.ink3} />
        {!collapsed && <Text style={{ fontSize: 12.5, color: danger ? C.red : C.ink3, fontWeight: "500" }}>{label}</Text>}
      </Pressable>
    );
  }
  if (collapsed) {
    return (
      <button
        onClick={onPress}
        title={label}
        className="aura-icon-btn"
        style={{
          alignSelf: "center",
          width: 32,
          height: 32,
          borderRadius: 10,
          border: "1px solid " + C.border,
          background: C.bg3,
          color: danger ? C.red : C.ink3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          marginBottom: 4,
        } as any}
      >
        <Icon name={icon as any} size={14} color={danger ? C.red : C.ink3} />
      </button>
    );
  }
  return (
    <button
      onClick={onPress}
      className={"aura-fa-row" + (danger ? " aura-fa-row-danger" : "")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: "8px 6px",
        border: "none",
        background: "transparent",
        color: danger ? C.red : C.ink3,
        fontSize: 12.5,
        fontWeight: 500,
        cursor: "pointer",
        borderRadius: 8,
        textAlign: "left",
        width: "100%",
      } as any}
    >
      <Icon name={icon as any} size={16} color={danger ? C.red : C.ink3} />
      <span style={{ flex: 1 } as any}>{label}</span>
      <svg className="aura-fa-chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
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
  const sw = collapsed ? 64 : 280;
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

  // ============================================================
  // Native fallback — preserva o sidebar antigo pra mobile native
  // (que de qualquer forma não chama Sidebar; usa MBar). Mantido só
  // por segurança caso TabsLayout mude no futuro.
  // ============================================================
  if (Platform.OS !== "web") {
    return (
      <View style={{ width: sw, height: '100%', backgroundColor: C.bg2, borderRightWidth: 1, borderRightColor: C.border, paddingTop: 16, paddingBottom: 12, paddingHorizontal: 14 }}>
        <Text style={{ color: C.ink }}>Sidebar (native)</Text>
      </View>
    );
  }

  // ============================================================
  // Web — novo design Premium v2 (08/05/2026)
  // ============================================================
  const sbBg = isDark
    ? "linear-gradient(180deg, #0a0c1f 0%, #06081a 100%)"
    : "linear-gradient(180deg, #f5eefe 0%, #ebe0fb 100%)";
  const sbBorder = isDark ? "rgba(124,58,237,0.12)" : "rgba(109,40,217,0.18)";
  const sectionBg = isDark ? "rgba(124,58,237,0.04)" : "rgba(124,58,237,0.06)";
  const sectionBorder = isDark ? "rgba(124,58,237,0.08)" : "rgba(124,58,237,0.14)";
  const labelColor = isDark ? C.violet3 : "#6d28d9";
  const labelBorder = isDark ? "rgba(124,58,237,0.18)" : "rgba(109,40,217,0.22)";

  return (
    <div style={{
      width: sw,
      flexShrink: 0,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden",
      isolation: "isolate",
      background: sbBg,
      borderRight: "1px solid " + sbBorder,
      transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      ["--aura-sb-ink" as any]: C.ink,
      ["--aura-sb-violet3" as any]: C.violet3,
    } as any}>
      {/* Aurora drift */}
      <div className={"aura-sb-aurora " + (isDark ? "aura-sb-aurora-dark" : "aura-sb-aurora-light")} />
      {/* Right edge seam glow */}
      <div className="aura-sb-seam" />

      {/* Inner content */}
      <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 } as any}>

        {/* Brand + collapse toggle */}
        <header style={{
          padding: collapsed ? "20px 8px 14px" : "20px 18px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          flexShrink: 0,
        } as any}>
          <a onClick={(e: any) => { e.preventDefault(); ro.push("/"); }} style={{ cursor: "pointer", textDecoration: "none" } as any}>
            <BrandGlyph collapsed={collapsed} />
          </a>
          {!collapsed && (
            <button
              onClick={onToggle}
              title="Recolher"
              className="aura-icon-btn"
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                border: "1px solid " + C.border,
                background: C.bg3,
                color: C.ink3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              } as any}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
        </header>

        {/* When collapsed, show expand button right below brand */}
        {collapsed && (
          <button
            onClick={onToggle}
            title="Expandir"
            className="aura-icon-btn"
            style={{
              alignSelf: "center",
              width: 32,
              height: 32,
              borderRadius: 10,
              border: "1px solid " + C.border,
              background: C.bg3,
              color: C.ink3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              marginBottom: 10,
            } as any}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}

        {/* Workspace card (CompanySwitcher) */}
        <div style={{ padding: collapsed ? "0 8px 12px" : "0 18px 14px", flexShrink: 0 } as any}>
          <CompanySwitcher collapsed={collapsed} variant={collapsed ? "sidebar" : "card"} />
        </div>

        {/* Nav (scrollable) */}
        <nav style={{ flex: 1, overflowY: "auto", padding: collapsed ? "0 8px 8px" : "0 14px 8px", minHeight: 0 } as any}>
          {filteredNav.map(s => (
            <div key={s.s} style={{
              marginBottom: collapsed ? 8 : 14,
              padding: collapsed ? 0 : "4px 6px 6px",
              borderRadius: collapsed ? 0 : 14,
              background: collapsed ? "transparent" : sectionBg,
              border: collapsed ? "none" : "1px solid " + sectionBorder,
            } as any}>
              {!collapsed && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px 8px",
                  marginBottom: 4,
                  fontFamily: Fonts.body,
                  fontSize: 10,
                  fontWeight: 800,
                  color: labelColor,
                  letterSpacing: "1.4px",
                  textTransform: "uppercase",
                  borderBottom: "1px solid " + labelBorder,
                } as any}>
                  <span>{s.s}</span>
                  <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, " + labelBorder + " 0%, transparent 100%)" } as any} />
                </div>
              )}
              {collapsed && <div style={{ height: 1, background: C.border, margin: "8px 4px" } as any} />}
              {s.i.map(i => (
                <NavItemRow key={i.r} l={i.l} ic={i.ic} a={isA(p, i.r)} onP={() => ro.push(i.r as any)} soon={i.soon} C={C} collapsed={collapsed} pl={i.plan} isDark={isDark} />
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <footer style={{
          padding: collapsed ? "10px 8px 14px" : "10px 18px 14px",
          borderTop: "1px solid " + C.border,
          background: "linear-gradient(180deg, transparent 0%, rgba(124,58,237,0.04) 100%)",
          flexShrink: 0,
        } as any}>
          {!collapsed ? (
            <>
              {/* User card */}
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 4px 12px" } as any}>
                <div style={{ position: "relative", width: 38, height: 38, flexShrink: 0, borderRadius: "50%" } as any}>
                  <div style={{ position: "absolute", inset: -3, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.45) 0%, transparent 70%)", zIndex: 0 } as any} />
                  <div style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #c4b5fd 0%, #7c3aed 60%, #5b21b6 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: "-0.5px",
                    boxShadow: "0 4px 12px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
                    zIndex: 1,
                  } as any}>{(u?.name || "A").charAt(0).toUpperCase()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 } as any}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: "-0.1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as any}>{u?.name || "---"}</div>
                  <div style={{ marginTop: 3, fontSize: 11, fontWeight: 600, color: C.violet3, letterSpacing: "0.3px", textTransform: "uppercase" } as any}>{"Membro " + pl}</div>
                </div>
              </div>
              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingTop: 8, borderTop: "1px solid " + C.border } as any}>
                <FooterRow icon="edit" label="Personalizar menu" onPress={() => setEditorOpen(true)} collapsed={false} C={C} />
                <FooterRow icon={isDark ? "sun" : "moon"} label={isDark ? "Modo claro" : "Modo escuro"} onPress={toggle} collapsed={false} C={C} />
                <FooterRow icon="settings" label="Configuracoes" onPress={() => ro.push("/configuracoes" as any)} collapsed={false} C={C} />
                <FooterRow icon="logout" label="Sair" onPress={logout} danger collapsed={false} C={C} />
              </div>
            </>
          ) : (
            <>
              {/* Collapsed footer: avatar + icon-only buttons */}
              <a onClick={(e: any) => { e.preventDefault(); ro.push("/configuracoes" as any); }} title={u?.name || "Perfil"} style={{ display: "flex", justifyContent: "center", marginBottom: 6, cursor: "pointer", textDecoration: "none" } as any}>
                <div style={{ position: "relative", width: 34, height: 34, borderRadius: "50%" } as any}>
                  <div style={{ position: "absolute", inset: -3, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.45) 0%, transparent 70%)", zIndex: 0 } as any} />
                  <div style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #c4b5fd 0%, #7c3aed 60%, #5b21b6 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    boxShadow: "0 4px 12px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
                    zIndex: 1,
                  } as any}>{(u?.name || "A").charAt(0).toUpperCase()}</div>
                </div>
              </a>
              <FooterRow icon="edit" label="Personalizar menu" onPress={() => setEditorOpen(true)} collapsed={true} C={C} />
              <FooterRow icon={isDark ? "sun" : "moon"} label={isDark ? "Modo claro" : "Modo escuro"} onPress={toggle} collapsed={true} C={C} />
              <FooterRow icon="settings" label="Configuracoes" onPress={() => ro.push("/configuracoes" as any)} collapsed={true} C={C} />
              <FooterRow icon="logout" label="Sair" onPress={logout} danger collapsed={true} C={C} />
            </>
          )}
        </footer>
      </div>

      <SidebarEditor visible={editorOpen} onClose={() => setEditorOpen(false)} baseNav={rawFilteredNav} />
    </div>
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
  const filteredMore = useMemo(() => {
    const flat: NavItem[] = [];
    for (const section of filteredNav) {
      for (const item of section.i) {
        if (!fixedTabKeys.has(item.r)) flat.push(item);
      }
    }
    flat.push({ r: "/configuracoes", l: "Configuracoes", ic: "settings" });
    return flat;
  }, [filteredNav]);

  const filteredTabs = MTABS.filter(t => visibleMods.has(t.mod));

  return (
    <View style={{ position: "relative", flexShrink: 0, zIndex: 50 } as any}>
      {showMore && Platform.OS === "web" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998, background: "rgba(0,0,0,0.5)" } as any} onClick={() => setShowMore(false)}>
          <div style={{ position: "absolute", bottom: 56, left: 8, right: 8, background: C.bg2, borderRadius: 16, border: "1px solid " + C.border, padding: 12, maxHeight: "60vh", overflowY: "auto", zIndex: 999 } as any} onClick={(e: any) => e.stopPropagation()}>
            {/* M1-06: Switcher de empresa no topo do menu Mais (mobile) */}
            <View style={{ marginBottom: 12 }}>
              <CompanySwitcher variant="mobile" />
            </View>
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
