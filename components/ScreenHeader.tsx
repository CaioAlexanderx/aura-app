import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

const W = Dimensions.get("window").width;
const NARROW = W < 480;

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
};

export function ScreenHeader({ title, subtitle, actionLabel, actionIcon, onAction }: Props) {
  return (
    <View style={s.container}>
      <View style={s.left}>
        <Text style={[s.title, NARROW && { fontSize: 18 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {title}
        </Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={[s.btn, NARROW && { paddingHorizontal: 12, paddingVertical: 9 }]}>
          {actionIcon && <Icon name={actionIcon as any} size={15} color="#fff" />}
          {/* N4: Em mobile estreito, esconde o texto e mostra so o icone */}
          {(!NARROW || !actionIcon) && <Text style={[s.btnText, NARROW && { fontSize: 12 }]}>{actionLabel}</Text>}
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "nowrap",
    gap: 8,
  },
  left: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.violet,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexShrink: 0,
  },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

export default ScreenHeader;
