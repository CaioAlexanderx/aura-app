// ============================================================
// AURA STUDIO · StudioShell — MobileChip
//
// Decomposição Fase 2 (31/05/2026): extraído do monólito StudioShell.tsx.
// Chip horizontal usado na mobileBar (mobile + tablet).
//
// 02/06/2026 (Shell clareza): mobileChipTxt usa ink3 (≥4.5:1 AA)
// ao invés de ink4 (2.4:1, falha AA). Sem mudança de API.
// ============================================================
import { useMemo } from "react";
import { Pressable, Text } from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { makeStyles } from "./styles";

export function MobileChip({
  label, icon, active, onPress, tone,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onPress: () => void;
  tone: string;
}) {
  const tk = useStudioTokens();
  const s = useMemo(() => makeStyles(tk), [tk]);
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
      <Icon name={icon as any} size={14} color={active ? "#fff" : tk.ink2} />
      <Text style={[s.mobileChipTxt, active && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}
