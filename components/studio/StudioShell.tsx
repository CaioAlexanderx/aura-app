// ============================================================
// AURA STUDIO · Shell (sidebar agrupada + slot)
//
// Sidebar circular com bolinhas-pai agrupando filhas em hover/click.
// 4 grupos: Início (sozinho) · Estúdio · Vendas · Gestão.
//
// 25/05 — overhaul UX/UI:
//   #1 mobile: sidebar vira inline expandida (sem hover) c/ chips
//   #6 cor das filhas padronizada por grupo (tom único)
//   #7 float ambient reduzido (2px) + pausa após 10s
//   #2 monta FloatingApprovalButton global
//
// 25/05 (segunda iteração) — substitui "S" placeholder por
//   AuraStudioMark/Lockup (logo real navy + asterisco magenta).
//
// 26/05 — Fase 2 affordance: tooltip on hover nas bolinhas-pai
//   (desktop/web only) mostra o label do grupo + filhos antes do
//   clique. Não muda click behavior (continua abrindo popup).
//
// 26/05 — Fase 6A acessibilidade/motion:
//   · cross-fade 200ms entre rotas /studio/* (Reanimated)
//   · respeita prefers-reduced-motion (AccessibilityInfo)
//   · :focus-visible outline navy global (web only)
//   · accessibilityLabel em todas as Pressables ícone-only
//
// 26/05 — Fases 5B + 8B integração:
//   · StudioAccentTheme wrappa todo o shell (tokens derivados
//     do Canal Digital via useDigitalChannel quando custom)
//   · StudioOnboarding renderiza modal first-run controlado por
//     useStudioOnboarding (delay 800ms pra shell aparecer antes)
//
// 26/05 — Fase 7 residual mobile:
//   · botão Menu no topo abre StudioBottomSheet com TODAS as rotas
//     agrupadas (Início + Estúdio + Vendas + Gestão + Configurações)
//   · StudioFab condicional por rota (Novo produto, Cadastrar
//     produto, Adicionar template, Novo pedido)
//   · StudioPullToRefresh helper wrapando RefreshControl tematizado
//
// 26/05 — residual:
//   · FAB também no breakpoint tablet (768–899) — antes era órfão,
//     só sidebar inline chip sem ação rápida contextual
//   · Avatar (desktop) com iniciais dinâmicas do user.name via
//     useAuthStore (não mais "SM" hardcoded)
// ============================================================
import { useRef, useEffect, useState, useMemo, ReactNode } from "react";
import {
  View, Text, Pressable, StyleSheet,
  Animated, Easing, useWindowDimensions, ScrollView,
  Platform, AccessibilityInfo, RefreshControl,
} from "react-native";
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming,
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
// "Caio" -> "CA", "Caio Alexander" -> "CA", "" -> "??"
function initials(name?: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Float hook (#7: pausa após N segundos pra não distrair) ────
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

// Amplitude reduzida (#7): 2px de translateY, sem rotação ambiente
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

// #6: tom único por grupo — filhas herdam o tom do pai.
const GROUPS: NavGroup[] = [
  {
    id: "estudio",
    label: "Estúdio",
    icon: "star",
    toneKey: "navy",
    children: [
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
function NavCircle({
  icon, active, isGroup, idx, onPress, children, pause,
  onHoverIn, onHoverOut, accessibilityLabel,
}: {
  icon: string; active?: boolean; isGroup?: boolean; idx: number;
  onPress?: () => void; children?: React.ReactNode; pause: boolean;
  onHoverIn?: () => void; onHoverOut?: () => void;
  accessibilityLabel?: string;
}) {
  // Web-only mouse handlers — Pressable no RN-web aceita onHoverIn/Out
  const webHoverProps =
    Platform.OS === "web" && (onHoverIn || onHoverOut)
      ? { onHoverIn, onHoverOut }
      : {};
  return (
    <FloatingBubble idx={idx} pause={pause} style={{ position: "relative" }}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        {...webHoverProps}
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

// ─── Tooltip hover (Fase 2) ────────────────────────────────
function GroupHoverTooltip({ group }: { group: NavGroup }) {
  return (
    <View style={s.tooltip} pointerEvents="none">
      <Text style={s.tooltipEyebrow}>{group.label.toUpperCase()}</Text>
      {group.children.map((child, i) => (
        <View
          key={child.href}
          style={[
            s.tooltipItem,
            i === group.children.length - 1 && { borderBottomWidth: 0 },
          ]}
        >
          <Icon name={child.icon as any} size={12} color={StudioColors.ink3} />
          <Text style={s.tooltipItemTxt}>{child.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Mobile menu sheet (Fase 7 residual) ────────────────────
// Lista TODAS as rotas Studio agrupadas. Renderizada via StudioBottomSheet.
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
        {/* Início */}
        <MobileMenuItem
          label="Início"
          icon="grid"
          tone={TONES.navy.bg}
          active={isHome}
          onPress={() => { onNavigate("/studio"); onClose(); }}
        />

        {/* Grupos */}
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

        {/* Configurações */}
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

// ─── Pull-to-refresh helper exportado (Fase 7 residual) ─────
// Wrappa ScrollView com RefreshControl tematizado. Páginas Studio
// podem importar e envolver suas listas.
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

// ─── FAB por rota (Fase 7 residual) ─────────────────────────
type FabConfig = {
  label: string;
  icon: string;
  accessibilityLabel: string;
  action: "push" | "queryNew";
  href: string;
};

function resolveFab(pathname: string): FabConfig | null {
  // Ordem importa: rotas mais específicas primeiro.
  if (pathname === "/studio/produtos" || pathname.startsWith("/studio/produtos/")) {
    return {
      label: "Cadastrar produto",
      icon: "plus",
      accessibilityLabel: "Cadastrar novo produto",
      action: "queryNew",
      href: "/studio/produtos?action=new",
    };
  }
  if (pathname === "/studio/galeria" || pathname.startsWith("/studio/galeria/")) {
    return {
      label: "Adicionar template",
      icon: "plus",
      accessibilityLabel: "Adicionar novo template",
      action: "queryNew",
      href: "/studio/galeria?action=new",
    };
  }
  if (pathname === "/studio/pedidos" || pathname.startsWith("/studio/pedidos/")) {
    return {
      label: "Novo pedido",
      icon: "plus",
      accessibilityLabel: "Criar novo pedido",
      action: "push",
      href: "/studio/pedidos/novo",
    };
  }
  if (pathname === "/studio" || pathname === "/studio/") {
    return {
      label: "Novo produto",
      icon: "plus",
      accessibilityLabel: "Ir para cadastro de produto",
      action: "push",
      href: "/studio/produtos",
    };
  }
  return null;
}

// ─── Shell ──────────────────────────────────────────────────
export function StudioShell() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  // Fase 7 residual: breakpoint mobile dedicado (sheet menu + FAB)
  const isMobile = width < 768;
  // Residual 26/05: breakpoint tablet órfão (768–899) ganha FAB também.
  // Mantém sidebar inline chips, só adiciona ação rápida contextual no
  // canto inferior direito.
  const isTablet = width >= 768 && width < 900;

  // Auth: avatar com iniciais dinâmicas (residual 26/05)
  const { user } = useAuthStore();

  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ─── Fase 8B: derivar accent tokens do Canal Digital ──────
  const { config } = useDigitalChannel();
  const resolvedAccent = useMemo(() => {
    if (config?.primary_color && config?.accent_color
        && config.primary_color !== "#1E3A8A"
        && config.accent_color !== "#EC4899") {
      return deriveAccentFromColors(config.primary_color, config.accent_color);
    }
    return studioDefaultAccent;
  }, [config?.primary_color, config?.accent_color]);

  // ─── Fase 5B: onboarding first-run ────────────────────────
  const { shouldShow, markSeen } = useStudioOnboarding();
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  useEffect(() => {
    if (shouldShow) {
      const t = setTimeout(() => setOnboardingVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [shouldShow]);

  // #7: pausa float ambient após 10s (somente desktop expandido)
  const [floatPause, setFloatPause] = useState(false);
  useEffect(() => {
    if (!isWide) return;
    const t = setTimeout(() => setFloatPause(true), 10000);
    return () => clearTimeout(t);
  }, [isWide]);

  // ─── Fase 6A: cross-fade entre rotas + reduce motion ──────
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
      // @ts-ignore — remove() é o padrão atual
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

  // ─── Fase 6A: focus visible global (web only) ─────────────
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
  }

  const isHome = pathname === "/studio" || pathname === "/studio/";

  // FAB por rota (mobile + tablet)
  const fabConfig = useMemo(() => resolveFab(pathname), [pathname]);

  // ─── Layout mobile (Fase 7 residual: menu sheet + FAB) ─────
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

  // ─── Layout tablet (#1: sidebar inline expandida no topo) ──
  // (largura 768–899: ainda usa o modelo de chips legado.
  //  Residual 26/05: FAB também aparece aqui — antes era órfão.)
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

  // ─── Layout desktop (sidebar circular agrupada) ────────────
  return (
    <StudioAccentTheme tokens={resolvedAccent}>
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: StudioColors.bg }}>
        <View style={s.sidebar}>
          <FloatingBubble idx={0} pause={floatPause} style={{ marginBottom: 16 }}>
            <Pressable
              onPress={() => go("/studio")}
              accessibilityLabel="Ir para início do Aura Studio"
              accessibilityRole="button"
            >
              <AuraStudioMark size={54} />
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
            const showTooltip =
              Platform.OS === "web" && hoveredGroupId === g.id && !open;
            const groupLabel = `Área ${g.label} — ${g.children.map((c) => c.label).join(", ")}`;
            return (
              <View key={g.label} style={{ position: "relative" }}>
                <NavCircle
                  icon={g.icon}
                  idx={i + 2}
                  active={open || childActive}
                  isGroup
                  pause={floatPause}
                  accessibilityLabel={groupLabel}
                  onHoverIn={() => setHoveredGroupId(g.id)}
                  onHoverOut={() =>
                    setHoveredGroupId((prev) => (prev === g.id ? null : prev))
                  }
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
                  {showTooltip && <GroupHoverTooltip group={g} />}
                </NavCircle>
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

// ─── Mobile chip helper ─────────────────────────────────────
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
  // Legado — não usado pós-AuraStudioMark mas mantido pra não quebrar refs
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

  // ── Tooltip hover (Fase 2) ──
  tooltip: {
    position: "absolute",
    left: 62, // bubbleSize 54 + 8
    top: 0,
    zIndex: 100,
    backgroundColor: StudioColors.paperCardElev,
    borderWidth: 1,
    borderColor: StudioColors.ink5,
    borderRadius: 12,
    padding: 10,
    minWidth: 160,
    // box-shadow web — RN ignora mas web-platform aplica via shim do RN-web
    shadowColor: "#1E3A8A",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tooltipEyebrow: {
    fontSize: 10,
    color: StudioColors.accent,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  tooltipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: StudioColors.ink5,
  },
  tooltipItemTxt: {
    fontSize: 12,
    color: StudioColors.ink2,
    fontWeight: "600",
  },

  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: StudioColors.accent,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#fff",
  },
  avatarTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },

  // ── Mobile (#1) ──
  mobileBar: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.08)",
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  mobileBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mobileMenuBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: StudioColors.primary,
    borderRadius: 999,
  },
  mobileMenuBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  // Legado (substituido por AuraStudioLockup inline na render)
  mobileBrand: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: StudioColors.primary,
    borderRadius: 12,
  },
  mobileBrandTxt: { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
  mobileChipsRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  mobileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderWidth: 1, borderColor: StudioColors.ink4,
    borderRadius: 999,
  },
  mobileChipTxt: { color: StudioColors.ink2, fontWeight: "600", fontSize: 12 },
});

export default StudioShell;
