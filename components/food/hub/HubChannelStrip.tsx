import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { FoodTokensV2 } from "@/constants/food-tokens";
import { GlassCard } from "@/components/food/foundation/GlassCard";
import type { HubChannel } from "@/hooks/useFoodHub";

// Mapa de cores oficiais e "logos" textuais (no MVP usamos
// glifo + label; quando tivermos SVG oficial trocamos aqui).
const CHANNEL_META: Record<string, { color: string; textColor?: string; glyph: string; label: string }> = {
  ifood:      { color: FoodTokensV2.cIfood,     glyph: "iF",  label: "iFood" },
  "99food":   { color: FoodTokensV2.c99food,    textColor: FoodTokensV2.c99foodText, glyph: "99", label: "99Food" },
  digital:    { color: FoodTokensV2.cDigital,   glyph: "AC",  label: "Canal Digital" },
  whatsapp:   { color: FoodTokensV2.cWhatsapp,  glyph: "WA",  label: "WhatsApp" },
  presencial: { color: FoodTokensV2.cPresencial, glyph: "PR", label: "Presencial" },
};

interface Props {
  channels: HubChannel[];
  active: string[];
  onToggle: (key: string) => void;
}

export function HubChannelStrip({ channels, active, onToggle }: Props) {
  return (
    <View style={styles.row}>
      {channels.map((ch) => {
        const meta = CHANNEL_META[ch.key] || { color: FoodTokensV2.ink3, glyph: ch.key.slice(0, 2).toUpperCase(), label: ch.label };
        const isActive = active.includes(ch.key);
        const textColor = meta.textColor || "#fff";
        return (
          <Pressable key={ch.key} onPress={() => onToggle(ch.key)} style={{ flexGrow: 1, flexBasis: 180 }}>
            <GlassCard
              hover
              topAccent={meta.color}
              style={[
                styles.card,
                isActive && { borderColor: meta.color, borderWidth: 2 },
              ]}
            >
              <View style={styles.cardInner}>
                <View style={[styles.logo, { backgroundColor: meta.color }]}>
                  <Text style={[styles.logoText, { color: textColor }]}>{meta.glyph}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.headerRow}>
                    <Text style={styles.label}>{meta.label}</Text>
                    <View style={[styles.dot, { backgroundColor: ch.connected ? FoodTokensV2.stPronto : FoodTokensV2.ink4 }]} />
                  </View>
                  <Text style={styles.count}>{ch.count_open}<Text style={styles.countUnit}> abertos</Text></Text>
                  <Text style={styles.sub}>{ch.count_today} hoje · {ch.connected ? "conectado" : "offline"}</Text>
                </View>
              </View>
            </GlassCard>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    ...(Platform.OS === "web" ? ({ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" } as any) : {}),
  },
  card: { minHeight: 88 },
  cardInner: { padding: 12, flexDirection: "row", gap: 12, alignItems: "center" },
  logo: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 13, fontWeight: "800", letterSpacing: -0.4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 12, fontWeight: "700", color: FoodTokensV2.ink2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  count: { fontSize: 20, fontWeight: "800", color: FoodTokensV2.ink, letterSpacing: -0.4, marginTop: 1 },
  countUnit: { fontSize: 11, fontWeight: "600", color: FoodTokensV2.ink3 },
  sub: { fontSize: 10, color: FoodTokensV2.ink4, marginTop: 1 },
});
