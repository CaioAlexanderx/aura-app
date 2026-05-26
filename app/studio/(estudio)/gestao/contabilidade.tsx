// ============================================================
// AURA STUDIO · Gestão / Contabilidade
//
// 25/05/2026: substitui o StudioBridge stub. Estratégia "delegação 1:1":
// renderiza o ContabilidadeScreen completo do Aura Varejo (FiscalHero +
// DasPreviewCard + Timeline obrigações + Guias + Histórico) com uma
// barra contextual Studio no topo.
//
// 26/05/2026 (residual tema Studio): troca eyebrowBar por
// <StudioPageHeader> + banner contextual e migra wrapper pra
// useStudioTokens()/buildStyles(t) — alinha com a estratégia já aplicada
// em gestao/financeiro.tsx. Body do ContabilidadeScreen segue intocado.
//
// Por que não retematizar o body: o ContabilidadeScreen é 6KB + 8 sub-
// componentes em components/screens/contabilidade/. Refatorar pra tokens
// Studio é trabalho de outra sessão. Suas operações Studio entram
// automaticamente nos relatórios mensais consolidados.
// ============================================================
import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import ContabilidadeScreen from "@/app/(tabs)/contabilidade";

type Tokens = ReturnType<typeof useStudioTokens>;

export default function StudioGestaoContabilidade() {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);

  return (
    <View style={s.wrapper}>
      <View style={s.header}>
        <StudioPageHeader
          eyebrow="GESTÃO · CONTABILIDADE"
          title="Contabilidade do estúdio"
          subtitle="Obrigações fiscais, DRE e relatórios mensais. Operações Studio entram automaticamente nos números."
          marginBottom={12}
        />
        <View style={s.contextBanner}>
          <Icon name="info" size={12} color={t.primary} />
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

function buildStyles(t: Tokens) {
  return StyleSheet.create({
    wrapper: {
      flex: 1,
      backgroundColor: t.bgSoft,
    },
    header: {
      paddingHorizontal: 28,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.ink5,
      backgroundColor: t.paperCardElev,
      gap: 10,
    },
    contextBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: t.primaryGhost,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.primarySoft,
      alignSelf: "flex-start",
      maxWidth: 720,
    },
    contextBannerTxt: {
      fontSize: 12,
      color: t.ink2,
      flexShrink: 1,
      lineHeight: 16,
    },
  });
}
