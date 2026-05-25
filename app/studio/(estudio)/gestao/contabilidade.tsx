// ============================================================
// AURA STUDIO · Gestão / Contabilidade
//
// 25/05/2026: substitui o StudioBridge stub. Estratégia "delegação 1:1":
// renderiza o ContabilidadeScreen completo do Aura Varejo (FiscalHero +
// DasPreviewCard + Timeline obrigações + Guias + Histórico) com uma
// barra contextual Studio no topo.
//
// Por que não retematizar o body: o ContabilidadeScreen é 6KB + 8 sub-
// componentes em components/screens/contabilidade/. Refatorar pra tokens
// Studio é trabalho de outra sessão. Suas operações Studio entram
// automaticamente nos relatórios mensais consolidados.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { StudioColors } from "@/constants/studio-tokens";
import ContabilidadeScreen from "@/app/(tabs)/contabilidade";

export default function StudioGestaoContabilidade() {
  return (
    <View style={{ flex: 1, backgroundColor: StudioColors.bg }}>
      <View style={s.eyebrowBar}>
        <Text style={s.eyebrow}>GESTÃO · CONTABILIDADE</Text>
        <Text style={s.contextHint}>
          Obrigações fiscais, DRE e relatórios mensais. Suas operações Studio entram automaticamente nos números abaixo.
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <ContabilidadeScreen />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  eyebrowBar: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: StudioColors.ink5,
    backgroundColor: StudioColors.paperCardElev,
  },
  eyebrow: {
    fontSize: 11,
    color: StudioColors.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  contextHint: {
    fontSize: 12,
    color: StudioColors.ink3,
    marginTop: 4,
    lineHeight: 16,
    maxWidth: 720,
  },
});
