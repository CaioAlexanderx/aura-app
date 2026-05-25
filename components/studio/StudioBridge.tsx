// ============================================================
// AURA STUDIO · StudioBridge
//
// Componente "smart stub" pra telas que ainda não têm implementação
// Studio nativa mas que têm versão funcional no shell varejo.
//
// Mostra:
//   1. Header explicativo
//   2. Card "Por enquanto vem do Aura Varejo" com CTA
//   3. Lista "O que vem aqui (versão Studio nativa)"
//
// Usado em: vendas/caixa, vendas/loja-digital, gestao/{financeiro,nfe,
// contabilidade}.
// ============================================================
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  bridgeHref: string;        // rota varejo equivalente (ex: "/(tabs)/pdv")
  bridgeLabel: string;       // CTA do bridge (ex: "Abrir PDV do varejo")
  bridgeIcon: string;        // icone do bridge
  bridgeNote?: string;       // explicação sobre por que está usando varejo
  futureFeatures: string[];  // o que virá quando tiver versão Studio nativa
};

export function StudioBridge({
  eyebrow, title, subtitle,
  bridgeHref, bridgeLabel, bridgeIcon, bridgeNote,
  futureFeatures,
}: Props) {
  const router = useRouter();

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.eyebrow}>{eyebrow}</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub}>{subtitle}</Text>
      </View>

      {/* Bridge card — CTA principal */}
      <View style={s.bridgeCard}>
        <View style={s.bridgeHead}>
          <View style={s.bridgeIcon}>
            <Icon name={bridgeIcon as any} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.bridgeTitle}>Por enquanto, isso vem do Aura Varejo</Text>
            <Text style={s.bridgeSub}>
              {bridgeNote || "Funcional e completo; quando a versão Studio nativa chegar, fica integrada aqui."}
            </Text>
          </View>
        </View>
        <Pressable style={s.bridgeCta} onPress={() => router.push(bridgeHref as any)}>
          <Text style={s.bridgeCtaTxt}>{bridgeLabel}</Text>
          <Icon name="chevron-right" size={16} color="#fff" />
        </Pressable>
      </View>

      {/* Futuro — o que vem na versão Studio nativa */}
      <View style={s.futureCard}>
        <View style={s.futureHead}>
          <View style={s.futureDot}>
            <Icon name="star" size={14} color={StudioColors.accent} />
          </View>
          <Text style={s.futureTitle}>O que vai chegar aqui</Text>
        </View>
        <Text style={s.futureSub}>Versão Studio nativa em desenvolvimento — features que vão diferenciar do varejo padrão:</Text>
        <View style={s.bulletList}>
          {futureFeatures.map((f, i) => (
            <View key={i} style={s.bulletRow}>
              <View style={s.bulletDot} />
              <Text style={s.bulletTxt}>{f}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Hint */}
      <View style={s.hintCard}>
        <Icon name="info" size={13} color={StudioColors.primary} />
        <Text style={s.hintTxt}>
          Não tem perda de dados — pedidos, NF-e e transações criados no shell varejo ficam disponíveis aqui quando a versão Studio nativa subir.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: StudioColors.bg },
  container: { padding: 28, paddingBottom: 60, maxWidth: 720, alignSelf: "center", width: "100%" },

  header: { marginBottom: 22 },
  eyebrow: { fontSize: 11, color: StudioColors.accent, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "800", color: StudioColors.ink, marginTop: 4, letterSpacing: -0.4 },
  sub: { fontSize: 13.5, color: StudioColors.ink3, marginTop: 4, lineHeight: 19 },

  bridgeCard: { backgroundColor: StudioColors.paperCardElev, borderRadius: 18, padding: 22, marginBottom: 16, borderWidth: 1, borderColor: StudioColors.primarySoft },
  bridgeHead: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 16 },
  bridgeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: StudioColors.primary, alignItems: "center", justifyContent: "center" },
  bridgeTitle: { fontSize: 15.5, fontWeight: "800", color: StudioColors.ink, marginBottom: 4 },
  bridgeSub: { fontSize: 13, color: StudioColors.ink3, lineHeight: 18 },
  bridgeCta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: StudioColors.primary, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  bridgeCtaTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },

  futureCard: { backgroundColor: StudioColors.paperCard, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: StudioColors.ink5 },
  futureHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  futureDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(236,72,153,0.12)", alignItems: "center", justifyContent: "center" },
  futureTitle: { fontSize: 14.5, fontWeight: "800", color: StudioColors.ink },
  futureSub: { fontSize: 12.5, color: StudioColors.ink3, marginBottom: 12, marginTop: 4, lineHeight: 17 },
  bulletList: { gap: 8 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: StudioColors.accent, marginTop: 8 },
  bulletTxt: { fontSize: 13, color: StudioColors.ink2, flex: 1, lineHeight: 19 },

  hintCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: StudioColors.primaryGhost, borderRadius: 10, padding: 11, borderWidth: 1, borderColor: StudioColors.primarySoft },
  hintTxt: { fontSize: 11.5, color: StudioColors.ink2, flex: 1, lineHeight: 16 },
});

export default StudioBridge;
