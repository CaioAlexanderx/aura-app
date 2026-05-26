// ============================================================
// AURA STUDIO · Shell (sidebar agrupada + slot)
//
// Sidebar circular com bolinhas-pai agrupando filhas em hover/click.
// 4 grupos: Início (sozinho) · Estúdio · Vendas · Gestão.
//
// 26/05 — Floating-only sidebar (desktop):
//   · Barra branca lateral REMOVIDA — só as bolinhas flutuam sobre o bg
//   · Bolinhas-pai aumentadas pra 60×60 (era 54×54)
//   · Glow base (navy soft) ao redor de cada bolinha, intensifica no hover
//   · Hover-children mostram label do nome ao lado (não só ícone)
//
// 26/05 (URGENTE): adicionado item "Estoque" no grupo Estúdio
// apontando pra /studio/estoque — necessário porque cliente Studio
// não tem acesso ao /(tabs)/estoque (redirect do _layout).
// Ícone "archive" pra diferenciar de Insumos ("package").
// ============================================================
import { useRef, useEffect, useState, useMemo, ReactNode } from "react";
import {
  View, Text, Pressable, StyleSheet,
  Animated, Easing, useWindowDimensions, ScrollView,
  Platform, AccessibilityInfo, RefreshControl,
} from "react-native";
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withDelay,
} from "react-native-reanimated";
import { Slot, useRouter, usePathname } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors, StudioRadius, StudioFloat } from "@/constants/studio-tokens";
import { FloatingApprovalButton } from "@/components/studio/FloatingApprovalButton";
import { AuraStudioMark, AuraStudioLockup } from "@/components/studio/AuraStudioMark";
import { StudioAccentTheme, studioDefaultAccent, deriveAccentFromColors } from "@/contexts/StudioAccentTheme";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { StudioOnboarding } from "@/components/studio/StudioOnboarding";
import { useStudioOnboarding } from "@/hooks/useStudioOnboarding";
import { StudioBottomSheet } from "@/components/studio/StudioBottomSheet";
import { StudioFab } from "@/components/studio/StudioFab";
import { useAuthStore } from "@/stores/auth";

// Iniciais a partir do nome — 2 caracteres uppercase.
function initials(name?: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Float hook (pausa após N segundos pra não distrair) ────
function useFloat(idx: number, pause: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (pause) {
      v.stopAnimation();
      return;
    }
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
  }, [idx, v, pause]);
  return v;
}

const FLOAT_AMP_AMBIENT = 2;

function FloatingBubble({ idx, children, style, pause }: any) {
  const v = useFloat(idx, !!pause);
  const transY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -FLOAT_AMP_AMBIENT] });
  return (
    <Animated.View style={[style, { transform: [{ translateY: transY }] }]}>
      {children}
    </Animated.View>
  );
}

// ─── Definição de grupos ────────────────────────────────────
type NavChild = {
  label: string;
  icon: string;
  href: string;
  badge?: { value: string; tone?: "accent" | "warm" };
};
type NavGroup = {
  id: string;
  label: string;
  icon: string;
  toneKey: keyof typeof TONES;
  children: NavChild[];
};

const TONES = {
  navy:   { bg: StudioColors.primary,  bg2: StudioColors.primary2 ?? "#3B82F6" },
  pink:   { bg: StudioColors.accent,   bg2: StudioColors.accent2  ?? "#F472B6" },
  warm:   { bg: "#F59E0B",             bg2: "#FBBF24" },
  mint:   { bg: "#10B981",             bg2: "#34D399" },
  sky:    { bg: "#06B6D4",             bg2: "#38BDF8" },
  violet: { bg: "#7C3AED",             bg2: "#A78BFA" },
};

const GROUPS: NavGroup[] = [
  {
    id: "estudio",
    label: "Estúdio",
    icon: "star",
    toneKey: "navy",
    children: [
      // "Estoque" PRIMEIRO no grupo — fluxo natural: cadastra produto
      // (foto, qty, preço, categoria) → marca personalizável em "Produtos".
      // Ícone "archive" pra não conflitar com Insumos ("package").
      { label: "Estoque",   icon: "archive",       href: "/studio/estoque" },
      { label: "Produtos",  icon: "shopping-bag", href: "/studio/produtos" },
      { label: "Galeria",   icon: "image",         href: "/studio/galeria" },
      { label: "Produção",  icon: "clock",         href: "/studio/producao", badge: { value: "•", tone: "accent" } },
      { label: "Insumos",   icon: "package",       href: "/studio/insumos",  badge: { value: "!", tone: "warm" } },
    ],
  },
  {
    id: "vendas",
    label: "Vendas",
    icon: "shopping-cart",
    toneKey: "pink",
    children: [
      { label: "Caixa / PDV",  icon: "credit-card", href: "/studio/vendas/caixa" },
      { label: "Loja digital", icon: "globe",       href: "/studio/vendas/loja-digital" },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    icon: "briefcase",
    toneKey: "mint",
    children: [
      { label: "Financeiro",    icon: "dollar-sign", href: "/studio/gestao/financeiro" },
      { label: "NF-e / NFC-e",  icon: "file-text",   href: "/studio/gestao/nfe" },
      { label: "Contabilidade", icon: "check",       href: "/studio/gestao/contabilidade" },
    ],
  },
];

// ─── Nav circle (bolinha pai) ───────────────────────────────
// 60×60, glow base navy soft, glow forte quando hovered/active.
function NavCircle({
  icon, active, isGroup, idx, onPress, children, pause,
  onHoverIn, onHoverOut, accessibilityLabel, glowing,
}: {
  icon: string; active?: boolean; isGroup?: boolean; idx: number;
  onPress?: () => void; children?: React.ReactNode; pause: boolean;
  onHoverIn?: () => void; onHoverOut?: () => void;
  accessibilityLabel?: string;
  glowing?: boolean;  // ← Hover/expand state
}) {
  const webHoverProps =
    Platform.OS === "web" && (onHoverIn || onHoverOut)
      ? { onHoverIn, onHoverOut }
      : {};

  // Glow forte: anel pink quando hovered/active. Glow base: navy soft.
  const glowStyle = Platform.OS === "web"
    ? (glowing || active
        ? { boxShadow: "0 0 32px rgba(236,72,153,0.55), 0 0 18px rgba(30,58,138,0.4), 0 6px 14px rgba(15,23,42,0.18)" }
        : { boxShadow: "0 0 18px rgba(30,58,138,0.28), 0 4px 10px rgba(15,23,42,0.12)" })
    : (glowing || active
        ? { shadowColor: StudioColors.accent, shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 10 }
        : { shadowColor: StudioColors.primary, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 5 });

  return (
    <FloatingBubble idx={idx} pause={pause} style={{ position: "relative" }}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        {...webHoverProps}
        style={[
          s.navCircle,
          glowStyle as any,
          active && s.navCircleActive,
          Platform.OS === "web" ? { transition: "box-shadow 200ms ease, transform 200ms ease" } as any : null,
          glowing && Platform.OS === "web" ? { transform: [{ scale: 1.04 }] as any } : null,
        ]}
      >
        <Icon name={icon as any} size={22} color={active ? "#fff" : StudioColors.ink2} />
        {isGroup && <View style={s.groupDot} />}
      </Pressable>
      {children}
    </FloatingBubble>
  );
}

// ─── Bolinhas-filhas (popup expandido por click — legado) ─
function ChildBubble({
  child, onPress, idx, tone, pause,
}: { child: NavChild; onPress: () => void; idx: number; tone: keyof typeof TONES; pause: boolean }) {
  const t = TONES[tone];
  return (
    <FloatingBubble idx={idx + 1} pause={pause} style={{}}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={child.label}
        accessibilityRole="button"
        style={[s.navChild, { backgroundColor: t.bg }]}
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

// ─── Mini-bolinha hover iOS-style — agora COM LABEL ─────────
// Pill horizontal: bolinha 32×32 + texto do label ao lado.
// Anima scale+opacity com stagger via Reanimated.
function ChildHoverBubble({
  child, tone, delay, onPress,
}: {
  child: NavChild;
  tone: keyof typeof TONES;
  delay: number;
  onPress: () => void;
}) {
  const t = TONES[tone];
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-8);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 14, stiffness: 180 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 180 }));
    translateX.value = withDelay(delay, withTiming(0, { duration: 220 }));
    return () => {
      opacity.value = withTiming(0, { duration: 120 });
    };
  }, [delay, scale, opacity, translateX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: translateX.value }],
    opacity: opacity.value,
    transformOrigin: "left center" as any,
  }));

  const webTitleProp: any = Platform.OS === "web" ? { title: child.label } : {};

  return (
    <Reanimated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={child.label}
        accessibilityRole="button"
        {...webTitleProp}
        style={s.hoverChildRow}
      >
        <View style={[s.hoverChildBubble, { backgroundColor: t.bg }]}>
          <Icon name={child.icon as any} size={14} color="#fff" />
          {child.badge && (
            <View
              style={[
                s.hoverChildBadge,
                { backgroundColor: child.badge.tone === "warm" ? "#F59E0B" : StudioColors.accent },
              ]}
            />
          )}
        </View>
        <Text style={s.hoverChildLabel} numberOfLines={1}>{child.label}</Text>
      </Pressable>
    </Reanimated.View>
  );
}

// ─── Mobile menu sheet ──────────────────────────────────────
function MobileMenuSheet({
  visible, onClose, pathname, onNavigate, isHome,
}: {
  visible: boolean;
  onClose: () => void;
  pathname: string;
  onNavigate: (href: string) => void;
  isHome: boolean;
}) {
  return (
    <StudioBottomSheet
      visible={visible}
      onClose={onClose}
      eyebrow="AURA STUDIO"
      title="Navegação"
      showGradientHeader
    >
      <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 14 }}>
        <MobileMenuItem
          label="Início"
          icon="grid"
          tone={TONES.navy.bg}
          active={isHome}
          onPress={() => { onNavigate("/studio"); onClose(); }}
        />
        {GROUPS.map((g) => (
          <View key={g.id} style={{ gap: 6 }}>
            <Text style={mm.groupLabel}>{g.label.toUpperCase()}</Text>
            <View style={{ gap: 4 }}>
              {g.children.map((c) => (
                <MobileMenuItem
                  key={c.href}
                  label={c.label}
                  icon={c.icon}
                  tone={TONES[g.toneKey].bg}
                  active={pathname.startsWith(c.href)}
                  onPress={() => { onNavigate(c.href); onClose(); }}
                />
              ))}
            </View>
          </View>
        ))}
        <View style={{ gap: 6 }}>
          <Text style={mm.groupLabel}>OUTROS</Text>
          <MobileMenuItem
            label="Configurações"
            icon="settings"
            tone={StudioColors.ink3}
            active={pathname.startsWith("/studio/configuracoes")}
            onPress={() => { onNavigate("/studio/configuracoes"); onClose(); }}
          />
        </View>
      </ScrollView>
    </StudioBottomSheet>
  );
}

function MobileMenuItem({
  label, icon, tone, active, onPress,
}: { label: string; icon: string; tone: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={[
        mm.item,
        active && { backgroundColor: tone + "12", borderColor: tone },
      ]}
    >
      <View style={[mm.itemIcon, { backgroundColor: tone }]}>
        <Icon name={icon as any} size={14} color="#fff" />
      </View>
      <Text style={[mm.itemTxt, active && { color: tone, fontWeight: "800" }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {active && <Icon name="check" size={14} color={tone} />}
    </Pressable>
  );
}

const mm = StyleSheet.create({
  groupLabel: {
    fontSize: 10,
    color: StudioColors.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 6,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: StudioColors.ink5,
    borderRadius: 14,
  },
  itemIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  itemTxt: { fontSize: 14, color: StudioColors.ink2, fontWeight: "600" },
});

// ─── Pull-to-refresh helper exportado ──────────────────────
export function StudioPullToRefresh({
  refreshing, onRefresh, children, contentContainerStyle,
}: {
  refreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
  contentContainerStyle?: any;
}) {
  return (
    <ScrollView
      contentContainerStyle={contentContainerStyle}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={StudioColors.primary}
          colors={[StudioColors.primary, StudioColors.accent]}
          progressBackgroundColor="#fff"
        />
      }
    >
      {children}
    </ScrollView>
  );
}

// ─── FAB por rota ───────────────────────────────────────────
type FabConfig = {
  label: string;
  icon: string;
  accessibilityLabel: string;
  action: "push" | "queryNew";
  href: string;
};

function resolveFab(pathname: string): FabConfig | null {
  if (pathname === "/studio/produtos" || pathname.startsWith("/studio/produtos/")) {
    return { label: "Cadastrar produto", icon: "plus", accessibilityLabel: "Cadastrar novo produto", action: "queryNew", href: "/studio/produtos?action=new" };
  }
  if (pathname === "/studio/galeria" || pathname.startsWith("/studio/galeria/")) {
    return { label: "Adicionar template", icon: "plus", accessibilityLabel: "Adicionar novo template", action: "queryNew", href: "/studio/galeria?action=new" };
  }
  if (pathname === "/studio/pedidos" || pathname.startsWith("/studio/pedidos/")) {
    return { label: "Novo pedido", icon: "plus", accessibilityLabel: "Criar novo pedido", action: "push", href: "/studio/pedidos/novo" };
  }
  if (pathname === "/studio" || pathname === "/studio/") {
    return { label: "Novo produto", icon: "plus", accessibilityLabel: "Ir para cadastro de produto", action: "push", href: "/studio/produtos" };
  }
  return null;
}

// ─── Shell ──────────────────────────────────────────────────
export function StudioShell() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 900;

  const { user } = useAuthStore();

  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelCloseHover = () => {
    if (closeHoverTimerRef.current) {
      clearTimeout(closeHoverTimerRef.current);
      closeHoverTimerRef.current = null;
    }
  };
  const scheduleCloseHover = (groupId: string) => {
    cancelCloseHover();
    closeHoverTimerRef.current = setTimeout(() => {
      setHoveredGroupId((prev) => (prev === groupId ? null : prev));
    }, 200);
  };
  useEffect(() => () => cancelCloseHover(), []);

  const { config } = useDigitalChannel();
  const resolvedAccent = useMemo(() => {
    if (config?.primary_color && config?.accent_color
        && config.primary_color !== "#1E3A8A"
        && config.accent_color !== "#EC4899") {
      return deriveAccentFromColors(config.primary_color, config.accent_color);
    }
    return studioDefaultAccent;
  }, [config?.primary_color, config?.accent_color]);

  const { shouldShow, markSeen } = useStudioOnboarding();
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  useEffect(() => {
    if (shouldShow) {
      const t = setTimeout(() => setOnboardingVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [shouldShow]);

  const [floatPause, setFloatPause] = useState(false);
  useEffect(() => {
    if (!isWide) return;
    const t = setTimeout(() => setFloatPause(true), 10000);
    return () => clearTimeout(t);
  }, [isWide]);

  const opacity = useSharedValue(1);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => setReduceMotion(enabled)
    );
    return () => {
      mounted = false;
      // @ts-ignore
      sub?.remove?.();
    };
  }, []);
  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = 0;
    const t = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 200 });
    }, 50);
    return () => clearTimeout(t);
  }, [pathname, reduceMotion, opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof document === "undefined") return;
    const style = document.createElement("style");
    style.setAttribute("data-aura-studio-focus", "1");
    style.textContent = `
      :focus-visible {
        outline: 2px solid ${StudioColors.primary} !important;
        outline-offset: 2px !important;
        border-radius: 4px;
      }
    `;
    document.head.appendChild(style);
    return () => {
      try { document.head.removeChild(style); } catch {}
    };
  }, []);

  function go(href: string) {
    router.push(href as any);
    setOpenGroup(null);
    setHoveredGroupId(null);
    cancelCloseHover();
  }

  const isHome = pathname === "/studio" || pathname === "/studio/";

  const fabConfig = useMemo(() => resolveFab(pathname), [pathname]);

  // ─── Mobile ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <StudioAccentTheme tokens={resolvedAccent}>
        <View style={{ flex: 1, backgroundColor: StudioColors.bg }}>
          <View style={s.mobileBar}>
            <Pressable
              onPress={() => go("/studio")}
              accessibilityLabel="Ir para início do Aura Studio"
              accessibilityRole="button"
              style={{ alignSelf: "flex-start", paddingHorizontal: 4, paddingVertical: 4 }}
            >
              <AuraStudioLockup size={26} variant="dark" />
            </Pressable>
            <View style={s.mobileBarRow}>
              <Pressable
                onPress={() => setMobileMenuOpen(true)}
                accessibilityLabel="Abrir menu de navegação"
                accessibilityRole="button"
                style={s.mobileMenuBtn}
              >
                <Icon name="menu" size={16} color="#fff" />
                <Text style={s.mobileMenuBtnTxt}>Menu</Text>
              </Pressable>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.mobileChipsRow}
              >
                <MobileChip label="Início" icon="grid" active={isHome} onPress={() => go("/studio")} tone={TONES.navy.bg} />
                {GROUPS.flatMap((g) =>
                  g.children.slice(0, 2).map((c) => (
                    <MobileChip
                      key={c.href}
                      label={c.label}
                      icon={c.icon}
                      active={pathname.startsWith(c.href)}
                      onPress={() => go(c.href)}
                      tone={TONES[g.toneKey].bg}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          </View>
          <Reanimated.View style={[animStyle, { flex: 1, minWidth: 0 }]}>
            <Slot />
          </Reanimated.View>
          {fabConfig && (
            <StudioFab
              icon={fabConfig.icon}
              label={fabConfig.label}
              accessibilityLabel={fabConfig.accessibilityLabel}
              onPress={() => router.push(fabConfig.href as any)}
              position={{ bottom: 24, right: 20 }}
            />
          )}
          <MobileMenuSheet
            visible={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            pathname={pathname}
            onNavigate={go}
            isHome={isHome}
          />
          <FloatingApprovalButton />
          <StudioOnboarding
            visible={onboardingVisible}
            onClose={() => { setOnboardingVisible(false); markSeen(); }}
            onComplete={() => { setOnboardingVisible(false); markSeen(); }}
          />
        </View>
      </StudioAccentTheme>
    );
  }

  // ─── Tablet ────────────────────────────────────────────────
  if (!isWide) {
    return (
      <StudioAccentTheme tokens={resolvedAccent}>
        <View style={{ flex: 1, backgroundColor: StudioColors.bg }}>
          <View style={s.mobileBar}>
            <Pressable
              onPress={() => go("/studio")}
              accessibilityLabel="Ir para início do Aura Studio"
              accessibilityRole="button"
              style={{ alignSelf: "flex-start", paddingHorizontal: 4, paddingVertical: 4 }}
            >
              <AuraStudioLockup size={26} variant="dark" />
            </Pressable>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.mobileChipsRow}
            >
              <MobileChip label="Início" icon="grid" active={isHome} onPress={() => go("/studio")} tone={TONES.navy.bg} />
              {GROUPS.flatMap((g) =>
                g.children.map((c) => (
                  <MobileChip
                    key={c.href}
                    label={c.label}
                    icon={c.icon}
                    active={pathname.startsWith(c.href)}
                    onPress={() => go(c.href)}
                    tone={TONES[g.toneKey].bg}
                  />
                ))
              )}
              <MobileChip
                label="Config"
                icon="settings"
                active={pathname.startsWith("/studio/configuracoes")}
                onPress={() => go("/studio/configuracoes")}
                tone={StudioColors.ink3}
              />
            </ScrollView>
          </View>
          <Reanimated.View style={[animStyle, { flex: 1, minWidth: 0 }]}>
            <Slot />
          </Reanimated.View>
          {isTablet && fabConfig && (
            <StudioFab
              icon={fabConfig.icon}
              label={fabConfig.label}
              accessibilityLabel={fabConfig.accessibilityLabel}
              onPress={() => router.push(fabConfig.href as any)}
              position={{ bottom: 24, right: 24 }}
            />
          )}
          <FloatingApprovalButton />
          <StudioOnboarding
            visible={onboardingVisible}
            onClose={() => { setOnboardingVisible(false); markSeen(); }}
            onComplete={() => { setOnboardingVisible(false); markSeen(); }}
          />
        </View>
      </StudioAccentTheme>
    );
  }

  // ─── Desktop (sidebar circular FLUTUANTE — sem barra branca) ─
  return (
    <StudioAccentTheme tokens={resolvedAccent}>
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: StudioColors.bg }}>
        <View style={s.sidebar}>
          <FloatingBubble idx={0} pause={floatPause} style={{ marginBottom: 18 }}>
            <Pressable
              onPress={() => go("/studio")}
              accessibilityLabel="Ir para início do Aura Studio"
              accessibilityRole="button"
              style={s.brandWrap}
            >
              <AuraStudioMark size={60} />
            </Pressable>
          </FloatingBubble>

          <NavCircle
            icon="grid"
            active={isHome}
            idx={1}
            pause={floatPause}
            accessibilityLabel="Início do Aura Studio"
            onPress={() => go("/studio")}
          />

          {GROUPS.map((g, i) => {
            const open = openGroup === i;
            const childActive = g.children.some((c) => pathname.startsWith(c.href));
            const isHovered = hoveredGroupId === g.id;
            const showHoverChildren =
              Platform.OS === "web" && isHovered && !open;
            const groupLabel = `Área ${g.label} — ${g.children.map((c) => c.label).join(", ")}`;
            const childContainerHoverProps: any =
              Platform.OS === "web"
                ? {
                    onMouseEnter: cancelCloseHover,
                    onMouseLeave: () => scheduleCloseHover(g.id),
                  }
                : {};
            return (
              <View key={g.label} style={{ position: "relative" }}>
                <NavCircle
                  icon={g.icon}
                  idx={i + 2}
                  active={open || childActive}
                  glowing={isHovered}
                  isGroup
                  pause={floatPause}
                  accessibilityLabel={groupLabel}
                  onHoverIn={() => {
                    cancelCloseHover();
                    setHoveredGroupId(g.id);
                  }}
                  onHoverOut={() => scheduleCloseHover(g.id)}
                  onPress={() => setOpenGroup(open ? null : i)}
                >
                  {open && (
                    <View style={s.childrenPop}>
                      <View style={s.childrenInner}>
                        {g.children.map((c, ci) => (
                          <ChildBubble
                            key={c.href}
                            child={c}
                            idx={ci}
                            tone={g.toneKey}
                            pause={floatPause}
                            onPress={() => go(c.href)}
                          />
                        ))}
                      </View>
                    </View>
                  )}
                </NavCircle>

                {/* Mini-bolinhas com LABEL no hover (iOS-style) */}
                {showHoverChildren && (
                  <View
                    style={s.childBubblesContainer}
                    {...childContainerHoverProps}
                  >
                    {g.children.map((c, ci) => (
                      <ChildHoverBubble
                        key={c.href}
                        child={c}
                        tone={g.toneKey}
                        delay={ci * 60}
                        onPress={() => go(c.href)}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ flex: 1 }} />

          <NavCircle
            icon="settings"
            idx={6}
            pause={floatPause}
            active={pathname.startsWith("/studio/configuracoes")}
            accessibilityLabel="Configurações do Studio"
            onPress={() => go("/studio/configuracoes")}
          />

          <View style={s.avatar} accessibilityLabel="Avatar do usuário">
            <Text style={s.avatarTxt}>{initials(user?.name)}</Text>
          </View>
        </View>

        <Reanimated.View style={[animStyle, { flex: 1, minWidth: 0 }]}>
          <Slot />
        </Reanimated.View>
        <FloatingApprovalButton />
        <StudioOnboarding
          visible={onboardingVisible}
          onClose={() => { setOnboardingVisible(false); markSeen(); }}
          onComplete={() => { setOnboardingVisible(false); markSeen(); }}
        />
      </View>
    </StudioAccentTheme>
  );
}

function MobileChip({
  label, icon, active, onPress, tone,
}: { label: string; icon: string; active?: boolean; onPress: () => void; tone: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={[
        s.mobileChip,
        active && { backgroundColor: tone, borderColor: tone },
      ]}
    >
      <Icon name={icon as any} size={14} color={active ? "#fff" : StudioColors.ink2} />
      <Text style={[s.mobileChipTxt, active && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Estilos ────────────────────────────────────────────────
const s = StyleSheet.create({
  // Sidebar SEM background — só bolinhas flutuando sobre o bg do shell.
  sidebar: {
    width: 104,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 20,
    zIndex: 1000,
  },

  brandWrap: {
    // Glow brand mais forte que as nav bubbles — destaca a marca.
    ...(Platform.OS === "web"
      ? { boxShadow: "0 0 32px rgba(236,72,153,0.45), 0 0 18px rgba(30,58,138,0.45)" }
      : { shadowColor: StudioColors.accent, shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: 8 }),
    borderRadius: 30,
  } as any,

  brand: {
    width: 54, height: 54,
    backgroundColor: StudioColors.primary,
    borderRadius: 27,
    alignItems: "center", justifyContent: "center",
  },
  brandTxt: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },

  navCircle: {
    width: 60, height: 60,
    backgroundColor: "#fff",
    borderWidth: 2, borderColor: StudioColors.ink5,
    borderRadius: 30,
    alignItems: "center", justifyContent: "center",
    // Glow base/hover é aplicado inline em NavCircle (depende do state).
  },
  navCircleActive: {
    backgroundColor: StudioColors.primary,
    borderColor: StudioColors.primary,
  },
  groupDot: {
    position: "absolute",
    bottom: 4, right: 4,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: StudioColors.accent,
    borderWidth: 2, borderColor: "#fff",
  },

  childrenPop: {
    position: "absolute",
    left: 72, top: -8,
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

  // ── Floating iOS-style hover (com label) ──
  childBubblesContainer: {
    position: "absolute",
    left: 72,
    top: 0,
    flexDirection: "column",
    gap: 10,
    paddingLeft: 4,
    paddingRight: 4,
    paddingVertical: 4,
    zIndex: 3000,
  },
  hoverChildRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 999,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 4,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 6px 16px rgba(15,23,42,0.18), 0 2px 4px rgba(15,23,42,0.08)" } as any
      : { shadowColor: "#0F172A", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }),
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  hoverChildBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  hoverChildLabel: {
    fontSize: 13,
    color: StudioColors.ink,
    fontWeight: "700",
    letterSpacing: -0.2,
    ...(Platform.OS === "web" ? { whiteSpace: "nowrap" } as any : {}),
  },
  hoverChildBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
  },

  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: StudioColors.accent,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#fff",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 0 20px rgba(236,72,153,0.4), 0 4px 10px rgba(15,23,42,0.12)" } as any
      : { shadowColor: StudioColors.accent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 }),
  },
  avatarTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },

  // ── Mobile ──
  mobileBar: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.08)",
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  mobileBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mobileMenuBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: StudioColors.primary, borderRadius: 999,
  },
  mobileMenuBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  mobileBrand: {
    alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: StudioColors.primary, borderRadius: 12,
  },
  mobileBrandTxt: { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
  mobileChipsRow: {
    flexDirection: "row", gap: 6, paddingHorizontal: 4, paddingVertical: 4,
  },
  mobileChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: "#fff",
    borderWidth: 1, borderColor: StudioColors.ink4,
    borderRadius: 999,
  },
  mobileChipTxt: { color: StudioColors.ink2, fontWeight: "600", fontSize: 12 },
});

export default StudioShell;
