import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { IS_WIDE } from "@/constants/helpers";

type EmptyStateProps = {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function EmptyState({ icon, title, description, actionLabel, onAction, secondaryLabel, onSecondary }: EmptyStateProps) {
  const [h, sH] = Platform.OS === "web" ? [false, () => {}] : [false, () => {}];

  return (
    <View style={s.container}>
      <View style={s.card}>
        {/* Decorative circles */}
        <View style={s.circles}>
          <View style={s.circleOuter}>
            <View style={s.circleInner}>
              <Icon name={icon as any} size={32} color={Colors.violet3} />
            </View>
          </View>
        </View>

        <Text style={s.title}>{title}</Text>
        <Text style={s.desc}>{description}</Text>

        {actionLabel && onAction && (
          <Pressable onPress={onAction} style={s.actionBtn}>
            <Text style={s.actionText}>{actionLabel}</Text>
          </Pressable>
        )}

        {secondaryLabel && onSecondary && (
          <Pressable onPress={onSecondary} style={s.secondaryBtn}>
            <Text style={s.secondaryText}>{secondaryLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  card: {
    alignItems: "center",
    maxWidth: 380,
    width: "100%",
    backgroundColor: Colors.bg3,
    borderRadius: 24,
    padding: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  circles: {
    marginBottom: 24,
  },
  circleOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.violetD,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  circleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.bg4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.ink,
    textAlign: "center",
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    color: Colors.ink3,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  actionBtn: {
    backgroundColor: Colors.violet,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginBottom: 10,
  },
  actionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: Colors.violet3,
    fontSize: 12,
    fontWeight: "500",
  },
});

export default EmptyState;
