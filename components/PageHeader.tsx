import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function PageHeader({ title, actionLabel, onAction }: Props) {
  return (
    <View style={s.row}>
      <Text accessibilityRole={"header" as any} style={s.title}>{title}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={s.btn}>
          <Text style={s.btnText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 },
  title: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  btn: { backgroundColor: Colors.violet, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
