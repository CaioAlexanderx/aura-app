// ============================================================
// AURA STUDIO · Gestão / NF-e / NFC-e
//
// 25/05/2026: substitui o StudioBridge stub. Estratégia "delegação 1:1":
// renderiza o NfeScreen completo do Aura Varejo (lista + emissão NFC-e +
// emissão NFS-e + cancelamento + integração Nuvem Fiscal) com uma barra
// contextual Studio no topo.
//
// Por que não retematizar o body: o NfeScreen é 15KB + EmitNfceForm +
// EmitNfseForm + shared (TABS/STATUS_MAP/EmissionRow). Refatorar pra
// tokens Studio é trabalho de outra sessão. Vendas Studio emitem NFC-e
// automaticamente no PDV Studio nativo (vendas/caixa).
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { StudioColors } from "@/constants/studio-tokens";
import NfeScreen from "@/app/(tabs)/nfe";

export default function StudioGestaoNfe() {
  return (
    <View style={{ flex: 1, backgroundColor: StudioColors.bg }}>
      <View style={s.eyebrowBar}>
        <Text style={s.eyebrow}>GESTÃO · NF-e / NFC-e</Text>
        <Text style={s.contextHint}>
          NFC-e nas vendas Studio é emitida automaticamente. Acima também você emite NF-e modelo 55 sob demanda.
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <NfeScreen />
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
