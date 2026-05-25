// ============================================================
// AURA STUDIO · Shell (sidebar agrupada + slot)
//
// Sidebar circular com bolinhas-pai agrupando filhas em hover.
// 4 grupos: Início (sozinho) · Estúdio · Vendas · Gestão.
// Flutuação suave nas bolinhas (timing variado por posição).
//
// Mockup: Projects/Aura/mockup_studio_dashboard.html
// Memory: plano_aura_studio_vertical_24mai2026
// ============================================================
import { useRef, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet,
  Animated, Easing, useWindowDimensions,
} from "react-native";
import { Slot, useRouter, usePathname } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors, StudioRadius, StudioFloat } from "@/constants/studio-tokens";

// ─── Float hook ─────────────────────────────────────────────
// Cria animação loop com timing/delay específicos por slot.
function useFloat(idx: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const dur   = StudioFloat.durationsMs[idx % StudioFloat.durationsMs.length];
    const delay = Math.abs(StudioFloat.delaysMs[idx % StudioFloat.delaysMs.length]);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: dur / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: dur / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [idx, v]);
  return v;
}

function FloatingBubble({ idx, children, style }: any) {
  const v = useFloat(idx);
  const transY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -StudioFloat.amplitudePx] });
  const rot   = v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `-${StudioFloat.rotationDeg}deg`] });
  return (
    <Animated.View style={[style, { transform: [{ translateY: transY }, { rotate: rot }] }]}>
      {children}
    </Animated.View>
  );
}

// ─── Definição de grupos ────────────────────────────────────
type NavChild = {
  label: string;
  icon: string;
  href: string;
  toneKey: keyof typeof TONES;
  badge?: { value: string; tone?: "accent" | "warm" };
};
type NavGroup = {
  label: string;
  icon: string;
  children: NavChild[];
};

const TONES = {
  navy:   { bg: [StudioColors.primary, StudioColors.primary2] },
  pink:   { bg: [StudioColors.accent, StudioColors.accent2] },
  warm:   { bg: ["#F59E0B", "#FBBF24"] },
  mint:   { bg: ["#10B981", "#34D399"] },
  sky:    { bg: ["#06B6D4", "#38BDF8"] },
  violet: { bg: ["#7C3AED", "#A78BFA"] },
};

const GROUPS: NavGroup[] = [
  {
    label: "Estúdio",
    icon: "star",
    children: [
      { label: "Produtos",  icon: "shopping-bag", href: "/studio/produtos",  toneKey: "navy" },
      { label: "Galeria",   icon: "image",         href: "/studio/galeria",   toneKey: "pink" },
      { label: "Produção",  icon: "clock",         href: "/studio/producao",  toneKey: "warm", badge: { value: "12", tone: "accent" } },
      { label: "Insumos",   icon: "package",       href: "/studio/insumos",   toneKey: "mint", badge: { value: "!", tone: "warm" } },
    ],
  },
  {
    label: "Vendas",
    icon: "shopping-cart",
    children: [
      { label: "Caixa / PDV",  icon: "credit-card", href: "/studio/vendas/caixa",         toneKey: "violet" },
      { label: "Loja digital", icon: "globe",       href: "/studio/vendas/loja-digital",  toneKey: "sky" },
    ],
  },
  {
    label: "Gestão",
    icon: "briefcase",
    children: [
      { label: "Financeiro",    icon: "dollar-sign", href: "/studio/gestao/financeiro",   toneKey: "mint" },
      { label: "NF-e / NFC-e",  icon: "file-text",   href: "/studio/gestao/nfe",          toneKey: "navy" },
      { label: "Contabilidade", icon: "check",       href: "/studio/gestao/contabilidade", toneKey: "warm" },
    ],
  },
];

// ─── Nav circle (bolinha pai) ───────────────────────────────
function NavCircle({
  icon, active, isGroup, idx, onPress, children,
}: {
  icon: string; active?: boolean; isGroup?: boolean; idx: number;
  onPress?: () => void; children?: React.ReactNode;
}) {
  return (
    <FloatingBubble idx={idx} style={{ position: "relative" }}>
      <Pressable
        onPress={onPress}
        style={[
          s.navCircle,
          active && s.navCircleActive,
        ]}
      >
        <Icon name={icon as any} size={20} color={active ? "#fff" : StudioColors.ink2} />
        {isGroup && <View style={s.groupDot} />}
      </Pressable>
      {children}
    </FloatingBubble>
  );
}

// ─── Bolinhas-filhas ────────────────────────────────────────
function ChildBubble({ child, onPress, idx }: { child: NavChild; onPress: () => void; idx: number }) {
  const colors = TONES[child.toneKey].bg;
  return (
    <FloatingBubble idx={idx + 1} style={{}}>
      <Pressable
        onPress={onPress}
        style={[
          s.navChild,
          { backgroundColor: colors[0] }, // gradient simulado pelo bg sólido (RN sem gradient nativo)
        ]}
      >
        <Icon name={child.icon as any} size={16} color="#fff" />
        {child.badge && (
          <View
            style={[
              s.childBadge,
              { backgroundColor: child.badge.tone === "warm" ? "#F59E0B" : StudioColors.accent },
            ]}
          >
            <Text style={s.childBadgeTxt}>{child.badge.value}</Text>
          </View>
        )}
      </Pressable>
      <Text style={s.childLabel} numberOfLines={1}>{child.label}</Text>
    </FloatingBubble>
  );
}

// ─── Shell ──────────────────────────────────────────────────
export function StudioShell() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  // Estado simples: qual grupo está expandido (hover/click)
  const [openGroup, setOpenGroup] = (require("react") as any).useState<number | null>(null);

  function go(href: string) {
    router.push(href as any);
    setOpenGroup(null);
  }

  const isHome = pathname === "/studio" || pathname === "/studio/";

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: StudioColors.bg }}>
      {/* ───────── Sidebar ───────── */}
      <View style={s.sidebar}>
        {/* Brand */}
        <FloatingBubble idx={0} style={{ marginBottom: 16 }}>
          <Pressable onPress={() => go("/studio")} style={s.brand}>
            <Text style={s.brandTxt}>S</Text>
          </Pressable>
        </FloatingBubble>

        {/* Início (sozinho) */}
        <NavCircle
          icon="grid"
          active={isHome}
          idx={1}
          onPress={() => go("/studio")}
        />

        {/* Grupos */}
        {GROUPS.map((g, i) => {
          const open = openGroup === i;
          const childActive = g.children.some((c) => pathname.startsWith(c.href));
          return (
            <View key={g.label} style={{ position: "relative" }}>
              <NavCircle
                icon={g.icon}
                idx={i + 2}
                active={open || childActive}
                isGroup
                onPress={() => setOpenGroup(open ? null : i)}
              >
                {open && isWide && (
                  <View style={s.childrenPop}>
                    <View style={s.childrenInner}>
                      {g.children.map((c, ci) => (
                        <ChildBubble
                          key={c.href}
                          child={c}
                          idx={ci}
                          onPress={() => go(c.href)}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </NavCircle>
            </View>
          );
        })}

        <View style={{ flex: 1 }} />

        {/* Configurações */}
        <NavCircle
          icon="settings"
          idx={6}
          active={pathname.startsWith("/studio/configuracoes")}
          onPress={() => go("/studio/configuracoes")}
        />

        {/* Avatar (placeholder — futuro: troca empresa) */}
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>SM</Text>
        </View>
      </View>

      {/* ───────── Slot do conteúdo ───────── */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Slot />
      </View>
    </View>
  );
}

// ─── Estilos ────────────────────────────────────────────────
const s = StyleSheet.create({
  sidebar: {
    width: 96,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRightWidth: 1,
    borderRightColor: "rgba(15,23,42,0.08)",
    zIndex: 1000,
  },
  brand: {
    width: 54, height: 54,
    backgroundColor: StudioColors.primary,
    borderRadius: 27,
    alignItems: "center", justifyContent: "center",
    shadowColor: StudioColors.primary,
    shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  brandTxt: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },

  navCircle: {
    width: 54, height: 54,
    backgroundColor: "#fff",
    borderWidth: 2, borderColor: StudioColors.ink4,
    borderRadius: 27,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0F172A", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  navCircleActive: {
    backgroundColor: StudioColors.primary,
    borderColor: StudioColors.primary,
  },
  groupDot: {
    position: "absolute",
    bottom: 4, right: 4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: StudioColors.accent,
    borderWidth: 2, borderColor: "#fff",
  },

  childrenPop: {
    position: "absolute",
    left: 64, top: -8,
    zIndex: 2000,
  },
  childrenInner: {
    flexDirection: "row",
    gap: 10,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 40,
    borderWidth: 1, borderColor: "#E2E8F0",
    shadowColor: "#0F172A", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  navChild: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0F172A", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  childBadge: {
    position: "absolute",
    top: -3, right: -3,
    minWidth: 16, height: 16,
    borderRadius: 8, paddingHorizontal: 4,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  childBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
  childLabel: {
    fontSize: 10, color: StudioColors.ink3,
    textAlign: "center", marginTop: 4,
    fontWeight: "600",
  },

  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: StudioColors.accent,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#fff",
  },
  avatarTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
});

export default StudioShell;
