import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

type Props = {
  icon: string;
  iconColor?: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function EmptyState({ icon, iconColor, title, subtitle, actionLabel, onAction, secondaryLabel, onSecondary }: Props) {
  const color = iconColor || Colors.violet3;
  return (
    <View style={s.container}>
      <View style={[s.iconWrap, { borderColor: color + "33" }]}>
        <Icon name={icon as any} size={32} color={color} />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={s.btn}>
          <Text style={s.btnText}>{actionLabel}</Text>
        </Pressable>
      )}
      {secondaryLabel && onSecondary && (
        <Pressable onPress={onSecondary} style={s.secondaryBtn}>
          <Text style={s.secondaryText}>{secondaryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.violetD, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  subtitle: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, maxWidth: 320 },
  btn: { marginTop: 12, backgroundColor: Colors.violet, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13 },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  secondaryBtn: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2 },
  secondaryText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});

export default EmptyState;
