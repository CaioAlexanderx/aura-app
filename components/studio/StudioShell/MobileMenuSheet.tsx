// ============================================================
// AURA STUDIO · StudioShell — MobileMenuSheet + MobileMenuItem
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Bottom sheet aberto pelo botão Menu da mobileBar. Lista grupos +
// "Configurações" em "OUTROS".
// ============================================================
import { useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { StudioBottomSheet } from "@/components/studio/StudioBottomSheet";
import { GROUPS, makeTones } from "./types";
import { makeMm } from "./styles";

export function MobileMenuSheet({
  visible, onClose, pathname, onNavigate, isHome,
}: {
  visible: boolean;
  onClose: () => void;
  pathname: string;
  onNavigate: (href: string) => void;
  isHome: boolean;
}) {
  const tk = useStudioTokens();
  const mm = useMemo(() => makeMm(tk), [tk]);
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
          tone={makeTones(tk).navy.bg}
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
                  tone={makeTones(tk)[g.toneKey].bg}
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
            tone={tk.ink3}
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
}: {
  label: string;
  icon: string;
  tone: string;
  active?: boolean;
  onPress: () => void;
}) {
  const tk = useStudioTokens();
  const mm = useMemo(() => makeMm(tk), [tk]);
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
