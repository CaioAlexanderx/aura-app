// ============================================================
// AURA STUDIO · Gestão / NF-e / NFC-e
//
// 25/05/2026: substitui o StudioBridge stub. Estratégia "delegação 1:1":
// renderiza o NfeScreen completo do Aura Varejo (lista + emissão NFC-e +
// emissão NFS-e + cancelamento + integração Nuvem Fiscal) com header
// Studio canônico no topo.
//
// 26/05/2026 (fix visual): NfeScreen usa Colors do varejo (dark navy
// por default), e o wrapper Studio usava t.bgSoft/t.paperCardElev
// (claros) → barra clara em cima + card dark embaixo, sem
// continuidade. Migrado wrapper+header pra Colors do varejo
// (bg/bg3/border/ink3) pra herdar o tema do conteúdo. Mantemos
// StudioColors.accent só no eyebrow magenta pra preservar identidade.
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { StudioColors } from "@/constants/studio-tokens";
import NfeScreen from "@/app/(tabs)/nfe";

export default function StudioGestaoNfe() {
  return (
    <View style={[s.root, { backgroundColor: Colors.bg }]}>
      <View style={s.headerWrap}>
        <Text style={s.eyebrow}>GESTÃO · NF-E / NFC-E</Text>
        <Text style={s.title}>Notas fiscais do estúdio</Text>
        <Text style={s.subtitle}>
          NFC-e nas vendas Studio é emitida automaticamente. Acima também você emite NF-e modelo 55 sob demanda.
        </Text>
        <View style={s.contextBanner}>
          <Icon name="info" size={12} color={StudioColors.accent} />
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

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 14,
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
    borderRadius: 10,
    backgroundColor: Colors.bg2,
    borderWidth: 1,
    borderColor: StudioColors.accent + "55",
    alignSelf: "flex-start",
    maxWidth: 720,
  },
  contextBannerTxt: {
    fontSize: 12,
    color: Colors.ink2,
    fontWeight: "600",
    flexShrink: 1,
  },
});
