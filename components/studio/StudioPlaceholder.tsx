// ============================================================
// AURA STUDIO · Placeholder reutilizável pras telas de fases
// futuras (galeria, produção, insumos, etc).
//
// 30/05/2026 (Fase 1b · batch 4): migrado de StudioColors estático
// pra useStudioTokens factory — light+dark via provider.
// ============================================================
import { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";

type Props = {
  icon: string;
  title: string;
  subtitle: string;
  phase: string;
  bullets?: string[];
};

export function StudioPlaceholder({ icon, title, subtitle, phase, bullets }: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      <View style={s.iconBubble}>
        <Icon name={icon as any} size={32} color={t.primary} />
      </View>
      <Text style={s.phase}>{phase}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.sub}>{subtitle}</Text>

      {bullets && bullets.length > 0 && (
        <View style={s.bulletsCard}>
          <Text style={s.bulletsHead}>O QUE VEM AQUI</Text>
          {bullets.map((b, i) => (
            <View key={i} style={s.bulletRow}>
              <Icon name="circle" size={6} color={t.accent} />
              <Text style={s.bulletTxt}>{b}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.bg },
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 32, maxWidth: 540, alignSelf: "center",
  },
  iconBubble: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: t.primarySoft,
    alignItems: "center", justifyContent: "center",
    marginBottom: 18,
  },
  phase: {
    fontSize: 11, color: t.accent, fontWeight: "800",
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6,
  },
  title: {
    fontSize: 26, color: t.ink, fontWeight: "800",
    letterSpacing: -0.5, textAlign: "center", marginBottom: 8,
  },
  sub: {
    fontSize: 14, color: t.ink3, textAlign: "center",
    lineHeight: 21, marginBottom: 24,
  },
  bulletsCard: {
    backgroundColor: t.paperCard,
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: t.ink5,
    width: "100%",
  },
  bulletsHead: {
    fontSize: 10.5, color: t.ink3, fontWeight: "800",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10,
  },
  bulletRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 5,
  },
  bulletTxt: { fontSize: 13, color: t.ink2, flex: 1 },
});

export default StudioPlaceholder;
