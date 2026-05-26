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
// ============================================================
import { useRef, useEffect, useState } from "react";
import {
  View, Text, Pressable, StyleSheet,
  Animated, Easing, useWindowDimensions, ScrollView,
  Platform, AccessibilityInfo,
} from "react-native";
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming,
} from "react-native-reanimated";
import { Slot, useRouter, usePathname } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors, StudioRadius, StudioFloat } from "@/constants/studio-tokens";
import { FloatingApprovalButton } from "@/components/studio/FloatingApprovalButton";
import { AuraStudioMark, AuraStudioLockup } from "@/components/studio/AuraStudioMark";

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

// ─── Shell ──────────────────────────────────────────────────
export function StudioShell() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

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

  // ─── Layout mobile (#1: sidebar inline expandida no topo) ──
  if (!isWide) {
    return (
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
        <FloatingApprovalButton />
      </View>
    );
  }

  // ─── Layout desktop (sidebar circular agrupada) ────────────
  return (
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
          <Text style={s.avatarTxt}>SM</Text>
        </View>
      </View>

      <Reanimated.View style={[animStyle, { flex: 1, minWidth: 0 }]}>
        <Slot />
      </Reanimated.View>
      <FloatingApprovalButton />
    </View>
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
