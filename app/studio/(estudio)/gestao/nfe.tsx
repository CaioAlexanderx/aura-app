// ============================================================
// AURA STUDIO · Gestão / NF-e / NFC-e
//
// 25/05/2026: substitui o StudioBridge stub. Estratégia "delegação 1:1":
// renderiza o NfeScreen completo do Aura Varejo (lista + emissão NFC-e +
// emissão NFS-e + cancelamento + integração Nuvem Fiscal) com header
// Studio canônico no topo.
//
// 26/05/2026: reforço de tematização Studio (residual) — passa a usar
// StudioPageHeader + contextBanner padrão + useStudioTokens (dark mode
// aware) + bg em t.bgSoft. Mesma estratégia aplicada em
// gestao/financeiro.tsx. O body (NfeScreen) segue intocado: refatorar
// o screen completo pra tokens Studio é trabalho de outra sessão.
// Vendas Studio emitem NFC-e automaticamente no PDV Studio nativo
// (vendas/caixa) — aqui é só o histórico + emissão sob demanda de NF-e
// modelo 55.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { StudioPalette } from "@/constants/studio-tokens";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import NfeScreen from "@/app/(tabs)/nfe";

export default function StudioGestaoNfe() {
  const t = useStudioTokens();
  const s = buildStyles(t);
  return (
    <View style={[s.root, { backgroundColor: t.bgSoft }]}>
      <View style={s.headerWrap}>
        <StudioPageHeader
          eyebrow="GESTÃO · NF-e / NFC-e"
          title="Notas fiscais do estúdio"
          subtitle="NFC-e nas vendas Studio é emitida automaticamente. Acima também você emite NF-e modelo 55 sob demanda."
        />
        <View style={s.contextBanner}>
          <Icon name="info" size={12} color={t.primary} />
          <Text style={s.contextBannerTxt}>
            NFC-e Studio sai automaticamente em cada venda — você só vê o histórico aqui.
          </Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <NfeScreen />
      </View>
    </View>
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    headerWrap: {
      paddingHorizontal: 28,
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.ink5,
      backgroundColor: t.paperCardElev,
      gap: 12,
    },
    contextBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: t.infoSoft,
      borderWidth: 1,
      borderColor: t.primaryBorder,
      alignSelf: "flex-start",
      maxWidth: 720,
    },
    contextBannerTxt: {
      fontSize: 12,
      color: t.infoInk,
      fontWeight: "600",
      flexShrink: 1,
    },
  });
}
