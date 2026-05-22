import { View, Text, ScrollView, StyleSheet, Platform } from "react-native";
import { Stack } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import {
  AuraFoodMark, GradientBrandMark, GlassCard, OrbBackground,
  ConicHeader, EyebrowHeadline, NavItemV2
} from "@/components/food/foundation";
import { FoodTokensV2 } from "@/constants/food-tokens";

// /food/_design — showcase interno (staff-only) dos tokens + componentes
// da Foundation Design System (Fase 9). Não exposto pro cliente final.
export default function FoodDesignShowcase() {
  const { user } = useAuthStore();
  if (!user?.is_staff) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
        <Text>Página interna. Acesso restrito.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: FoodTokensV2.bg }}>
      <Stack.Screen options={{ title: "Design · Aura Food" }} />
      <OrbBackground/>
      <ScrollView contentContainerStyle={styles.container}>

        <EyebrowHeadline
          eyebrow="DESIGN SYSTEM · v1"
          headline="Foundation"
          accent="Aura Food"
          subtitle="Tokens canônicos + componentes atômicos · Fase 9"
          withLiveDot
        />

        {/* Mark variantes */}
        <Text style={styles.section}>MARK · variantes</Text>
        <View style={styles.row}>
          {(["gradient","cherry","violet","white","black","outline"] as const).map(v => (
            <GlassCard key={v} style={{ padding: 16, alignItems: "center", minWidth: 100 }}>
              <View style={{ backgroundColor: v === "white" ? "#7c3aed" : "transparent", padding: 8, borderRadius: 8 }}>
                <AuraFoodMark size={48} variant={v}/>
              </View>
              <Text style={styles.caption}>{v}</Text>
            </GlassCard>
          ))}
        </View>

        {/* Brand mark conic */}
        <Text style={styles.section}>BRAND MARK · gradient container</Text>
        <View style={styles.row}>
          <GradientBrandMark size={32}/>
          <GradientBrandMark size={44}/>
          <GradientBrandMark size={64}/>
          <GradientBrandMark size={96}/>
        </View>

        {/* Glass cards */}
        <Text style={styles.section}>GLASS CARDS</Text>
        <View style={styles.row}>
          <GlassCard style={{ padding: 20, minWidth: 200 }} topAccent={FoodTokensV2.primary}>
            <Text style={{ fontWeight: "700" }}>Card primary</Text>
            <Text style={styles.caption}>topAccent cherry</Text>
          </GlassCard>
          <GlassCard style={{ padding: 20, minWidth: 200 }} topAccent={FoodTokensV2.violet}>
            <Text style={{ fontWeight: "700" }}>Card accent</Text>
            <Text style={styles.caption}>topAccent violet</Text>
          </GlassCard>
        </View>

        {/* Conic header (KPI style) */}
        <Text style={styles.section}>CONIC HEADER (KPI signature)</Text>
        <View style={styles.row}>
          <GlassCard style={{ padding: 18, minWidth: 200 }}>
            <ConicHeader color={FoodTokensV2.primary}>
              <Text style={{ fontSize: 11, color: FoodTokensV2.ink3, letterSpacing: 1.2, textTransform: "uppercase" }}>Pedidos</Text>
              <Text style={{ fontSize: 28, fontWeight: "700" }}>87</Text>
            </ConicHeader>
          </GlassCard>
          <GlassCard style={{ padding: 18, minWidth: 200 }}>
            <ConicHeader color={FoodTokensV2.violet}>
              <Text style={{ fontSize: 11, color: FoodTokensV2.ink3, letterSpacing: 1.2, textTransform: "uppercase" }}>Em rota</Text>
              <Text style={{ fontSize: 28, fontWeight: "700" }}>4</Text>
            </ConicHeader>
          </GlassCard>
        </View>

        {/* NavItem */}
        <Text style={styles.section}>NAV ITEM (sidebar)</Text>
        <GlassCard style={{ padding: 12, maxWidth: 260 }}>
          <NavItemV2 icon={<Text>⊙</Text>} label="Hub de Pedidos" active badge={7}/>
          <NavItemV2 icon={<Text>▦</Text>} label="Mesas"/>
          <NavItemV2 icon={<Text>≫</Text>} label="KDS Cozinha"/>
        </GlassCard>

        {/* Palette */}
        <Text style={styles.section}>PALETA</Text>
        <View style={styles.row}>
          {[
            { name: "primary", value: FoodTokensV2.primary },
            { name: "violet", value: FoodTokensV2.violet },
            { name: "heat", value: FoodTokensV2.heat },
            { name: "ink", value: FoodTokensV2.ink },
            { name: "bg", value: FoodTokensV2.bg },
          ].map(c => (
            <View key={c.name} style={{ alignItems: "center" }}>
              <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: c.value, borderWidth: 1, borderColor: FoodTokensV2.line }}/>
              <Text style={[styles.caption, { marginTop: 6 }]}>{c.name}</Text>
              <Text style={[styles.caption, { fontFamily: Platform.OS === "web" ? "monospace" : undefined, fontSize: 10 }]}>{c.value}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 32, gap: 24, maxWidth: 1200, alignSelf: "center" as any, width: "100%" },
  section: { fontSize: 10, fontWeight: "700", letterSpacing: 1.8, textTransform: "uppercase", color: FoodTokensV2.ink4, marginTop: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  caption: { fontSize: 11, color: FoodTokensV2.ink3, marginTop: 8 },
});
