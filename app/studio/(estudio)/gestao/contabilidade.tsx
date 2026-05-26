// ============================================================
// AURA STUDIO · Gestão / Contabilidade
//
// 25/05/2026: substitui o StudioBridge stub. Estratégia "delegação 1:1":
// renderiza o ContabilidadeScreen completo do Aura Varejo (FiscalHero +
// DasPreviewCard + Timeline obrigações + Guias + Histórico) com uma
// barra contextual Studio no topo.
//
// 26/05/2026 (fix visual): ContabilidadeScreen usa Colors do varejo
// (dark navy por default), e o wrapper Studio usava t.bgSoft/
// t.paperCardElev (claros) → barra clara em cima + card dark embaixo,
// sem continuidade. Migrado wrapper+header pra Colors do varejo
// (bg/bg3/border/ink3) pra herdar o tema do conteúdo. Mantemos
// StudioColors.accent só no eyebrow magenta pra preservar identidade.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { StudioColors } from "@/constants/studio-tokens";
import ContabilidadeScreen from "@/app/(tabs)/contabilidade";

export default function StudioGestaoContabilidade() {
  return (
    <View style={s.wrapper}>
      <View style={s.header}>
        <Text style={s.eyebrow}>GESTÃO · CONTABILIDADE</Text>
        <Text style={s.title}>Contabilidade do estúdio</Text>
        <Text style={s.subtitle}>
          Obrigações fiscais, DRE e relatórios mensais. Operações Studio entram automaticamente nos números.
        </Text>
        <View style={s.contextBanner}>
          <Icon name="info" size={12} color={StudioColors.accent} />
          <Text style={s.contextBannerTxt}>
            Vendas personalizadas aparecem nos relatórios mensais como categoria "Studio".
          </Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <ContabilidadeScreen />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bg3,
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    color: StudioColors.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.ink3,
    lineHeight: 18,
    maxWidth: 720,
    marginBottom: 4,
  },
  contextBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.bg2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: StudioColors.accent + "55",
    alignSelf: "flex-start",
    maxWidth: 720,
  },
  contextBannerTxt: {
    fontSize: 12,
    color: Colors.ink2,
    flexShrink: 1,
    lineHeight: 16,
    fontWeight: "600",
  },
});
