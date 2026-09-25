// ============================================================
// components/studio/storefront/ui/PoweredByAura.tsx
// Assinatura discreta nos stages que NAO terminam em rodape (configurador,
// carrinho, checkout). Na vitrine quem assina e o RodapeDaVitrine.
//
// 04/09/2026: o endereco aqui apontava para a loja da PROPRIA Aura.
// Quem lesse a assinatura na loja da Sheid ia parar na vitrine de outra
// empresa. Agora leva ao site do produto, que e o que ela quer dizer.
//
// 25/09/2026 (Fase 1A): saiu da vitrine Studio. Era uma barra FIXA por
// cima do rodape do configurador e do checkout, cobrindo o botao de
// comprar; a assinatura da Aura fica so no rodape institucional ("Loja
// desenvolvida com Aura."). Continua aqui porque o cardapio e o
// orcamento publico ainda a usam.
// ============================================================
import { View } from "react-native";
import { usePaletaDaVitrine } from "../TemaDaVitrine";
import { Texto } from "../TipografiaVitrine";

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
      <Texto style={{ fontSize: 9.5, color: T.ink4, letterSpacing: 0.4 }}>
        Powered by <Texto style={{ fontWeight: "800", color: T.ink3 }}>Aura</Texto> · getaura.com.br
      </Texto>
    </View>
  );
}
