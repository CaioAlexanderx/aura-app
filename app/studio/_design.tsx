// ============================================================
// AURA STUDIO · /studio/_design — Showcase staff-only
// Visualiza todos os tokens + primitives.
// ============================================================
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import {
  StudioTokens, StudioGradientsV2, StudioRadiusV2, space, text, weight,
  navy, magenta, warm, mint, slate,
} from "@/constants/studio-tokens-v2";
import {
  StudioBrandMark, GlassCard, BubbleIcon,
  GradientHeader, AlertBadge, KpiTile,
} from "@/components/studio/StudioPrimitives";

export default function StudioDesignShowcase() {
  const { user } = useAuthStore();
  if (!user?.is_staff) return <Redirect href="/studio" />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: StudioTokens.bg }} contentContainerStyle={{ padding: 28, maxWidth: 1000, alignSelf: "center", width: "100%" }}>
      <GradientHeader
        eyebrow="FASE 8 · DESIGN SYSTEM"
        title="Studio Tokens V2 + Primitives"
        sub="Showcase staff-only — use isso pra criar telas novas mantendo a identidade visual."
      />

      {/* Brand */}
      <Section title="Brand">
        <View style={{ flexDirection: "row", gap: 18, alignItems: "center" }}>
          <StudioBrandMark size={32} />
          <StudioBrandMark size={44} />
          <StudioBrandMark size={56} />
          <StudioBrandMark size={72} />
        </View>
      </Section>

      {/* Cores */}
      <Section title="Paleta — escalas">
        <SwatchRow label="navy" swatches={navy} />
        <SwatchRow label="magenta" swatches={magenta} />
        <SwatchRow label="warm" swatches={warm} />
        <SwatchRow label="mint" swatches={mint} />
        <SwatchRow label="slate" swatches={slate} />
      </Section>

      {/* Bolhas */}
      <Section title="BubbleIcon — gradientes">
        <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
          <BubbleIcon ico="package"     tone="navy" />
          <BubbleIcon ico="heart"       tone="accent" />
          <BubbleIcon ico="clock"       tone="warm" />
          <BubbleIcon ico="check"       tone="mint" />
          <BubbleIcon ico="credit-card" tone="violet" />
          <BubbleIcon ico="globe"       tone="sky" />
        </View>
        <Text style={{ fontSize: 11, color: StudioTokens.ink3, marginTop: 8 }}>
          ↑ Padrão circular. Abaixo: orgânicos (border-radius assimétrico).
        </Text>
        <View style={{ flexDirection: "row", gap: 14, marginTop: 12 }}>
          <BubbleIcon ico="star" tone="navy"   organic={1} />
          <BubbleIcon ico="star" tone="accent" organic={2} />
          <BubbleIcon ico="star" tone="warm"   organic={3} />
          <BubbleIcon ico="star" tone="mint"   organic={4} />
        </View>
      </Section>

      {/* GlassCard */}
      <Section title="GlassCard — tons">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {(["neutral","primary","accent","warm","mint"] as const).map((tone) => (
            <GlassCard key={tone} tone={tone} pad="md" style={{ minWidth: 180 }}>
              <Text style={{ fontWeight: "700", color: StudioTokens.ink }}>tone="{tone}"</Text>
              <Text style={{ fontSize: 12, color: StudioTokens.ink3, marginTop: 4 }}>
                Card translúcido com bordas suaves.
              </Text>
            </GlassCard>
          ))}
        </View>
      </Section>

      {/* AlertBadge */}
      <Section title="AlertBadge">
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <AlertBadge severity="info"    label="3 pendentes" />
          <AlertBadge severity="warning" label="2 alertas" />
          <AlertBadge severity="danger"  label="1 atrasado" />
        </View>
      </Section>

      {/* KpiTile */}
      <Section title="KpiTile — KPIs do hub">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <KpiTile label="Pedidos hoje"    value="12" ico="shopping-bag" tone="navy" />
          <KpiTile label="Em produção"     value="8"  ico="clock"        tone="accent" trend={{ dir: "up", pct: 25 }} />
          <KpiTile label="Aguardando arte" value="3"  ico="alert-circle" tone="warm" />
          <KpiTile label="Prontos"         value="5"  ico="package"      tone="mint" />
          <KpiTile label="Receita 7d"      value="R$ 4.280" ico="trending-up" tone="navy" trend={{ dir: "up", pct: 18 }} />
        </View>
      </Section>

      {/* Type scale */}
      <Section title="Type scale">
        {(Object.entries(text) as [keyof typeof text, any][]).map(([k, v]) => (
          <Text key={k} style={{ fontSize: v.fontSize, lineHeight: v.lineHeight, color: StudioTokens.ink, marginBottom: 4 }}>
            text.{k} — {v.fontSize}px
          </Text>
        ))}
      </Section>

      {/* Radius */}
      <Section title="Radius escala + orgânicos">
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {(["sm","md","lg","xl","2xl","3xl"] as const).map((k) => (
            <View key={k} style={{
              width: 80, height: 80,
              backgroundColor: StudioTokens.primarySoft,
              borderRadius: StudioRadiusV2[k],
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ fontSize: 11, color: StudioTokens.primary, fontWeight: "700" }}>{k}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          {([1,2,3,4] as const).map((n) => (
            <View key={n} style={{
              width: 80, height: 80,
              backgroundColor: StudioTokens.accentSoft,
              borderRadius: StudioRadiusV2[`organic${n}` as const] as any,
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ fontSize: 11, color: StudioTokens.accent, fontWeight: "700" }}>organic{n}</Text>
            </View>
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={{ fontSize: 12, color: StudioTokens.ink3, fontWeight: "800", letterSpacing: 0.6, marginBottom: 12, textTransform: "uppercase" }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function SwatchRow({ label, swatches }: { label: string; swatches: Record<string, string> }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 11, color: StudioTokens.ink3, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {Object.entries(swatches).map(([k, v]) => (
          <View key={k} style={{ alignItems: "center" }}>
            <View style={{ width: 40, height: 40, backgroundColor: v, borderRadius: 6 }} />
            <Text style={{ fontSize: 9, color: StudioTokens.ink3, marginTop: 2 }}>{k}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
