import { useEffect, useRef, ReactNode } from "react";
import { View, Text, Modal, Pressable, StyleSheet, Animated, Easing, Platform, PanResponder } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StudioColors, StudioGradients } from "@/constants/studio-tokens";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  height?: number | "auto";
  showHandle?: boolean;
  showGradientHeader?: boolean;
};

export function StudioBottomSheet({
  visible, onClose, title, eyebrow, children,
  height = "auto", showHandle = true, showGradientHeader = false,
}: Props) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });
  const backdropOpacity = backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });

  // Pan responder pra fechar arrastando handle
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => showHandle,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          slideAnim.setValue(Math.max(0, 1 - gs.dy / 400));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.5) {
          onClose();
        } else {
          Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.root}>
        <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            s.sheet,
            height !== "auto" && { height },
            { transform: [{ translateY }] },
          ]}
        >
          {showGradientHeader && (
            Platform.OS === "web" ? (
              <View
                // @ts-ignore web style
                style={[
                  s.gradientHeader,
                  { background: `linear-gradient(135deg, ${StudioGradients.brand[0]}, ${StudioGradients.brand[1]})` } as any,
                ]}
              >
                {showHandle && <View style={s.handleLight} {...pan.panHandlers} />}
                {eyebrow && <Text style={s.eyebrowLight}>{eyebrow}</Text>}
                {title && <Text style={s.titleLight}>{title}</Text>}
              </View>
            ) : (
              <LinearGradient
                colors={StudioGradients.brand as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.gradientHeader}
              >
                {showHandle && <View style={s.handleLight} {...pan.panHandlers} />}
                {eyebrow && <Text style={s.eyebrowLight}>{eyebrow}</Text>}
                {title && <Text style={s.titleLight}>{title}</Text>}
              </LinearGradient>
            )
          )}
          {!showGradientHeader && (
            <View style={s.normalHeader}>
              {showHandle && <View style={s.handle} {...pan.panHandlers} />}
              {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
              {title && <Text style={s.title}>{title}</Text>}
            </View>
          )}
          <View style={s.body}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0F172A" },
  sheet: {
    backgroundColor: StudioColors.paperCardElev,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 32,
    maxHeight: "90%" as any,
    overflow: "hidden",
  },
  gradientHeader: {
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 4,
  },
  normalHeader: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: StudioColors.ink5,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: StudioColors.ink5, marginBottom: 8 },
  handleLight: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.4)", marginBottom: 8 },
  eyebrow: { fontSize: 10, color: StudioColors.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  eyebrowLight: { fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 17, color: StudioColors.ink, fontWeight: "800" },
  titleLight: { fontSize: 17, color: "#fff", fontWeight: "800" },
  body: { padding: 20, paddingBottom: 32 },
});

export default StudioBottomSheet;
