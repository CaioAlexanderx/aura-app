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
// ============================================================
import { useMemo } from "react";
import { View, Pressable, Text, ScrollView } from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { AuraStudioLockup } from "@/components/studio/AuraStudioMark";
import { StudioThemeToggle } from "@/components/studio/StudioThemeToggle";
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

  const chips = (
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
        const items = variant === "mobile" ? g.children.slice(0, 2) : g.children;
        return items.map((c) => (
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
      {variant === "tablet" && (
        <MobileChip
          label="Config"
          icon="settings"
          active={pathname.startsWith("/studio/configuracoes")}
          onPress={() => go("/studio/configuracoes")}
          tone={tk.ink3}
        />
      )}
    </ScrollView>
  );

  return (
    <View style={s.mobileBar}>
      <Pressable
        onPress={() => go("/studio")}
        accessibilityLabel="Ir para início do Aura Studio"
        accessibilityRole="button"
        style={{ alignSelf: "flex-start", paddingHorizontal: 4, paddingVertical: 4 }}
      >
        <AuraStudioLockup size={26} variant="dark" />
      </Pressable>
      {variant === "mobile" ? (
        <View style={s.mobileBarRow}>
          <StudioThemeToggle compact />
          <Pressable
            onPress={onOpenMenu}
            accessibilityLabel="Abrir menu de navegação"
            accessibilityRole="button"
            style={s.mobileMenuBtn}
          >
            <Icon name="menu" size={16} color="#fff" />
            <Text style={s.mobileMenuBtnTxt}>Menu</Text>
          </Pressable>
          {chips}
        </View>
      ) : (
        chips
      )}
    </View>
  );
}
