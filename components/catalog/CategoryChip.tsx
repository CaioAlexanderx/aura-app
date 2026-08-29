import { View, Text, Pressable, StyleSheet } from "react-native";
import { useColors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

// Puro, sem chamada de rede -- recebe dados por prop (briefing 5.4).
// "também aparece em", com remocao. `onRemove` ausente = chip nao
// removivel (uso em contextos so-leitura).
type Props = {
  label: string;
  color?: string | null;
  onRemove?: () => void;
  variant?: "primary" | "secondary";
};

export function CategoryChip({ label, color, onRemove, variant = "secondary" }: Props) {
  const C = useColors();
  const accent = color || C.violet;
  const isPrimary = variant === "primary";

  return (
    <View
      style={[
        s.chip,
        { borderColor: accent, backgroundColor: isPrimary ? accent + "22" : accent + "14" },
      ]}
    >
      {isPrimary && <Icon name="star" size={11} color={accent} />}
      <Text style={[s.label, { color: C.ink }]} numberOfLines={1}>
        {label}
      </Text>
      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={s.remove}
          accessibilityLabel={"Remover " + label}
        >
          <Icon name="x" size={11} color={C.ink3} />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 1,
  },
  label: { fontSize: 12.5, fontWeight: "600", maxWidth: 160 },
  remove: { marginLeft: 2 },
});

export default CategoryChip;
