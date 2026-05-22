import { View, StyleSheet, ViewStyle } from "react-native";

interface Props {
  color?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ConicHeader({ color = "#EF4444", children, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.conic, { backgroundColor: color }]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", overflow: "hidden" },
  conic: {
    position: "absolute",
    top: -60, right: -60,
    width: 160, height: 160,
    borderRadius: 80,
    opacity: 0.35,
    filter: "blur(36px)" as any,
  },
  content: { position: "relative", zIndex: 1 },
});
