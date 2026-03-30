import { Pressable, Text, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

type Props = {
  label?: string;
  onPress?: () => void;
};

export function BackButton({ label = "Voltar", onPress }: Props) {
  const router = useRouter();

  function handlePress() {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  }

  return (
    <Pressable onPress={handlePress} style={s.btn}>
      <View style={s.arrow}>
        <Icon name="chevron_left" size={14} color={Colors.violet3} />
      </View>
      <Text style={s.label}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  arrow: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.violetD,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 13,
    color: Colors.violet3,
    fontWeight: "600",
  },
});

export default BackButton;
