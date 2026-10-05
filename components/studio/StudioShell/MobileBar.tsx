// ============================================================
// AURA STUDIO · StudioShell — MobileBar (mobile + tablet top bar)
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Top bar usado em mobile e tablet. Variante "compact" (mobile)
// mostra botão Menu + chips reduzidos (primeiros 2 por grupo).
// Variante "wide" (tablet) mostra todos os chips inline.
//
// 02/06/2026 (Shell clareza): labels derivados de STUDIO_NAV via GROUPS
// (sem strings locais). MobileChip recebe label e subtítulo do nav.ts.
//
// 05/10/2026 (QA mobile): no celular eram DUAS linhas fixas (logo e sino;
// depois tema, Menu e atalhos), ~13% da altura. Virou UMA linha: logo,
// sino e Menu. Os atalhos e o tema moram dentro do Menu (MobileMenuSheet).
// O tablet continua com a linha da marca + todos os atalhos.
// ============================================================
import { useMemo } from "react";
import { View, Pressable, Text, ScrollView } from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { studioNotificationColors } from "@/constants/studio-tokens";
import { AuraStudioLockup } from "@/components/studio/AuraStudioMark";
import { NotificationBell } from "@/components/NotificationBell";
import { MobileChip } from "./MobileChip";
import { GROUPS, makeTones } from "./types";
import { makeStyles } from "./styles";

export function MobileBar({
  variant,
  pathname,
  isHome,
  onOpenMenu,
  go,
}: {
  variant: "mobile" | "tablet";
  pathname: string;
  isHome: boolean;
  onOpenMenu: () => void;
  go: (href: string) => void;
}) {
  const tk = useStudioTokens();
  const s = useMemo(() => makeStyles(tk), [tk]);
  // QA LJ-29 (28/09/2026): mesmo motivo do Topbar — sino seguindo o tema do Studio.
  const notifColors = useMemo(() => studioNotificationColors(tk), [tk]);

  // Só o tablet usa os atalhos em linha.
  const chips = variant === "mobile" ? null : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.mobileChipsRow}
    >
      <MobileChip
        label="Início"
        icon="grid"
        active={isHome}
        onPress={() => go("/studio")}
        tone={makeTones(tk).navy.bg}
      />
      {GROUPS.flatMap((g) => {
        return g.children.map((c) => (
          <MobileChip
            key={c.href}
            label={c.label}
            icon={c.icon}
            active={pathname.startsWith(c.href)}
            onPress={() => go(c.href)}
            tone={makeTones(tk)[g.toneKey].bg}
          />
        ));
      })}
      <MobileChip
        label="Config"
        icon="settings"
        active={pathname.startsWith("/studio/configuracoes")}
        onPress={() => go("/studio/configuracoes")}
        tone={tk.ink3}
      />
    </ScrollView>
  );

  if (variant === "mobile") {
    return (
      <View style={[s.mobileBar, s.mobileBarCompact]} testID="studio-mobile-bar">
        <Pressable
          onPress={() => go("/studio")}
          accessibilityLabel="Ir para início do Aura Studio"
          accessibilityRole="button"
          style={{ paddingHorizontal: 4, paddingVertical: 4, flexShrink: 1, minWidth: 0 }}
        >
          <AuraStudioLockup size={24} variant="dark" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <NotificationBell colors={notifColors} />
        <Pressable
          onPress={onOpenMenu}
          accessibilityLabel="Abrir menu de navegação"
          accessibilityRole="button"
          style={s.mobileMenuBtn}
          testID="studio-mobile-menu"
        >
          <Icon name="menu" size={16} color="#fff" />
          <Text style={s.mobileMenuBtnTxt}>Menu</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.mobileBar}>
      {/* Linha da marca: logo à esquerda, sino no canto superior direito.
          A Topbar do Studio, que tem o sino no desktop, é exclusiva do
          branch isWide (>=900px). */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={() => go("/studio")}
          accessibilityLabel="Ir para início do Aura Studio"
          accessibilityRole="button"
          style={{ paddingHorizontal: 4, paddingVertical: 4 }}
        >
          <AuraStudioLockup size={26} variant="dark" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <NotificationBell colors={notifColors} />
      </View>
      {chips}
    </View>
  );
}
