import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

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
        <Text style={s.title}>{title}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={s.btn}>
          {actionIcon && <Icon name={actionIcon as any} size={16} color="#fff" />}
          <Text style={s.btnText}>{actionLabel}</Text>
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
    flexWrap: "wrap",
    gap: 10,
  },
  left: { flex: 1 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.violet,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

export default ScreenHeader;
