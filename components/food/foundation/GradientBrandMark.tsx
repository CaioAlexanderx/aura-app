import { View, StyleSheet } from "react-native";
import { AuraFoodMark } from "./AuraFoodMark";

interface Props {
  size?: number;
  conic?: boolean; // background conic ou linear simples
}

export function GradientBrandMark({ size = 44, conic = true }: Props) {
  return (
    <View style={[
      styles.container,
      { width: size, height: size, borderRadius: size * 0.27 },
      conic ? styles.conic : styles.linear
    ]}>
      <AuraFoodMark size={size * 0.55} variant="white" withCore={false} withHighlight={false}/>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 6,
  },
  conic: {
    // RN não tem conic nativo — fallback pra linear cherry→violet
    backgroundColor: "#EF4444",
    backgroundImage: "linear-gradient(135deg, #EF4444 0%, #7c3aed 110%)" as any,
  },
  linear: {
    backgroundColor: "#EF4444",
  },
});
