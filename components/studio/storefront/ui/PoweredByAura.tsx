// ============================================================
// components/studio/storefront/ui/PoweredByAura.tsx
// Assinatura discreta nos stages que NAO terminam em rodape (configurador,
// carrinho, checkout). Na vitrine quem assina e o RodapeDaVitrine.
//
// 04/09/2026: o endereco aqui apontava para a loja da PROPRIA Aura.
// Quem lesse a assinatura na loja da Sheid ia parar na vitrine de outra
// empresa. Agora leva ao site do produto, que e o que ela quer dizer.
// ============================================================
import { View, Text } from "react-native";
import { usePaletaDaVitrine } from "../TemaDaVitrine";

export function PoweredByAura() {
  const T = usePaletaDaVitrine();
  return (
    <View
      style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        paddingVertical: 6, paddingHorizontal: 12,
        alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(250,250,252,0.92)",
        borderTopWidth: 1, borderTopColor: T.border,
      }}
      pointerEvents="none"
    >
      <Text style={{ fontSize: 9.5, color: T.ink4, letterSpacing: 0.4 }}>
        Powered by <Text style={{ fontWeight: "800", color: T.ink3 }}>Aura</Text> · getaura.com.br
      </Text>
    </View>
  );
}
