// ============================================================
// AURA STUDIO · StudioShell — orquestrador (Fase 2 decomposição)
//
// 31/05/2026: monólito 37KB decomposto em sub-arquivos sob
// `components/studio/StudioShell/`. Este index só orquestra:
//   - Provider StudioAccentTheme (via useDigitalChannel)
//   - Branch responsivo (mobile / tablet / desktop)
//   - FAB por rota (resolveFab)
//   - reduceMotion + fade de troca de rota
//   - pause da animação flutuante após 10s
//
// 31/05/2026 (Fase 3): desktop branch ganha <Topbar /> horizontal
// acima do conteúdo (breadcrumb + busca + ThemeToggle).
// Mobile/tablet sem topbar adicional — MobileBar permanece.
//
// Cada peça mora em arquivo separado:
//   types.ts, styles.ts, useFloat.ts, FloatingBubble.tsx,
//   NavCircle.tsx, ChildBubble.tsx (+ ChildHoverBubble),
//   MobileChip.tsx, MobileMenuSheet.tsx, MobileBar.tsx,
//   Sidebar.tsx, Topbar.tsx, fab.ts
//
// IMPORTANTE: o path `@/components/studio/StudioShell` continua
// resolvendo aqui (index.tsx). API externa (`<StudioShell />`)
// preserva 100% do comportamento.
//
// StudioPullToRefresh foi removido daqui — canônico em StudioScreen.tsx.
//
// 05/06/2026: StudioOnboarding overlay removido do Shell — o
// checklist-herói canônico (Onda 2) vive inline na home
// (app/studio/(estudio)/index.tsx). Overlay aqui causava fetch duplo
// + AbortError no desmonte.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
  View,
  AccessibilityInfo,
  Platform,
  useWindowDimensions,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Slot, useRouter, usePathname } from "expo-router";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { FloatingApprovalButton } from "@/components/studio/FloatingApprovalButton";
import {
  StudioAccentTheme,
  studioDefaultAccent,
  deriveAccentFromColors,
} from "@/contexts/StudioAccentTheme";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { StudioFab } from "@/components/studio/StudioFab";
import { useAuthStore } from "@/stores/auth";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileBar } from "./MobileBar";
import { MobileMenuSheet } from "./MobileMenuSheet";
import { resolveFab } from "./fab";

export function StudioShell() {
  const router = useRouter();
  const tk = useStudioTokens();
  const pathname = usePathname() || "";
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 900;

  const { user } = useAuthStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { config } = useDigitalChannel();
  const resolvedAccent = useMemo(() => {
    if (
      config?.primary_color &&
      config?.accent_color &&
      config.primary_color !== "#1E3A8A" &&
      config.accent_color !== "#EC4899"
    ) {
      return deriveAccentFromColors(config.primary_color, config.accent_color);
    }
    return studioDefaultAccent;
  }, [config?.primary_color, config?.accent_color]);

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
      (enabled) => setReduceMotion(enabled),
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
        outline: 2px solid ${tk.primary} !important;
        outline-offset: 2px !important;
        border-radius: 4px;
      }
    `;
    document.head.appendChild(style);
    return () => {
      try {
        document.head.removeChild(style);
      } catch {}
    };
  }, []);

  function go(href: string) {
    router.push(href as any);
  }

  const isHome = pathname === "/studio" || pathname === "/studio/";

  const fabConfig = useMemo(() => resolveFab(pathname), [pathname]);

  // ─── Mobile ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <StudioAccentTheme tokens={resolvedAccent}>
        <View style={{ flex: 1, backgroundColor: tk.bg }}>
          <MobileBar
            variant="mobile"
            pathname={pathname}
            isHome={isHome}
            onOpenMenu={() => setMobileMenuOpen(true)}
            go={go}
          />
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
        </View>
      </StudioAccentTheme>
    );
  }

  // ─── Tablet ────────────────────────────────────────────────
  if (!isWide) {
    return (
      <StudioAccentTheme tokens={resolvedAccent}>
        <View style={{ flex: 1, backgroundColor: tk.bg }}>
          <MobileBar
            variant="tablet"
            pathname={pathname}
            isHome={isHome}
            onOpenMenu={() => setMobileMenuOpen(true)}
            go={go}
          />
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
        </View>
      </StudioAccentTheme>
    );
  }

  // ─── Desktop (sidebar circular FLUTUANTE + Topbar horizontal) ─
  return (
    <StudioAccentTheme tokens={resolvedAccent}>
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: tk.bg }}>
        <Sidebar
          pathname={pathname}
          isHome={isHome}
          floatPause={floatPause}
          userName={user?.name}
          go={go}
        />

        {/* Coluna direita: topbar + conteúdo */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Topbar pathname={pathname} />
          <Reanimated.View style={[animStyle, { flex: 1, minWidth: 0 }]}>
            <Slot />
          </Reanimated.View>
        </View>

        <FloatingApprovalButton />
      </View>
    </StudioAccentTheme>
  );
}

export default StudioShell;
