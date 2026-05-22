import { View, Text, StyleSheet } from "react-native";
import { FoodTokensV2 } from "@/constants/food-tokens";

interface Props {
  eyebrow?: string;
  headline: string;
  accent?: string; // pedaço destacado do headline
  subtitle?: string;
  withLiveDot?: boolean;
}

export function EyebrowHeadline({ eyebrow, headline, accent, subtitle, withLiveDot }: Props) {
  return (
    <View>
      {eyebrow && (
        <View style={styles.eyebrow}>
          {withLiveDot && <View style={styles.liveDot}/>}
          <Text style={styles.eyebrowText}>{eyebrow}</Text>
        </View>
      )}
      <Text style={styles.headline}>
        {headline}
        {accent && <Text style={styles.accent}> {accent}</Text>}
      </Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    alignSelf: "flex-start",
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: FoodTokensV2.primarySoft,
    borderWidth: 1, borderColor: FoodTokensV2.primaryLine,
    marginBottom: 12,
  },
  eyebrowText: {
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 10, letterSpacing: 1.4, color: FoodTokensV2.primary,
    fontWeight: "700", textTransform: "uppercase",
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: FoodTokensV2.primary,
  },
  headline: {
    fontSize: 36, fontWeight: "700", letterSpacing: -1.4,
    lineHeight: 38, color: FoodTokensV2.ink,
  },
  accent: {
    color: FoodTokensV2.primary, // fallback se gradient text não funciona
  },
  subtitle: {
    fontSize: 13, color: FoodTokensV2.ink3, marginTop: 10,
  },
});
