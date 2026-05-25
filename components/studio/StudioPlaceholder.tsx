// ============================================================
// AURA STUDIO · Placeholder reutilizável pras telas de fases
// futuras (galeria, produção, insumos, etc).
// ============================================================
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";

type Props = {
  icon: string;
  title: string;
  subtitle: string;
  phase: string;
  bullets?: string[];
};

export function StudioPlaceholder({ icon, title, subtitle, phase, bullets }: Props) {
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      <View style={s.iconBubble}>
        <Icon name={icon as any} size={32} color={StudioColors.primary} />
      </View>
      <Text style={s.phase}>{phase}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.sub}>{subtitle}</Text>

      {bullets && bullets.length > 0 && (
        <View style={s.bulletsCard}>
          <Text style={s.bulletsHead}>O QUE VEM AQUI</Text>
          {bullets.map((b, i) => (
            <View key={i} style={s.bulletRow}>
              <Icon name="circle" size={6} color={StudioColors.accent} />
              <Text style={s.bulletTxt}>{b}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: StudioColors.bg },
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 32, maxWidth: 540, alignSelf: "center",
  },
  iconBubble: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: StudioColors.primarySoft,
    alignItems: "center", justifyContent: "center",
    marginBottom: 18,
  },
  phase: {
    fontSize: 11, color: StudioColors.accent, fontWeight: "800",
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6,
  },
  title: {
    fontSize: 26, color: StudioColors.ink, fontWeight: "800",
    letterSpacing: -0.5, textAlign: "center", marginBottom: 8,
  },
  sub: {
    fontSize: 14, color: StudioColors.ink3, textAlign: "center",
    lineHeight: 21, marginBottom: 24,
  },
  bulletsCard: {
    backgroundColor: StudioColors.paperCard,
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: StudioColors.ink5,
    width: "100%",
  },
  bulletsHead: {
    fontSize: 10.5, color: StudioColors.ink3, fontWeight: "800",
    letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10,
  },
  bulletRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 5,
  },
  bulletTxt: { fontSize: 13, color: StudioColors.ink2, flex: 1 },
});

export default StudioPlaceholder;
