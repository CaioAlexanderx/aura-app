// ============================================================
// components/studio/storefront/FaixaDaTemporada.tsx
//
// "Pedidos até 20/12" e "loja fechada", desenhados (Fase 1C, Telas 5 e 6
// do mockup studio-vitrine-01-alicerce).
//
// A regra mora em modoDaVitrine.ts (`faixaDaTemporada`); aqui só a voz:
//   - âmbar enquanto há prazo;
//   - vermelho no último dia (e na véspera), a única hora em que a
//     urgência é verdade;
//   - âmbar com o recado da lojista quando a loja fechou.
//
// Dois lugares, o mesmo componente:
//   - `topo`: faixa de ponta a ponta no alto da home;
//   - `junto`: caixa arredondada perto do botão de compra (produto,
//     sacola, checkout) — é a decisão, não a navegação.
//
// As cores são as semânticas do papel (theme.ts, SEMANTICAS.papel), que
// já passam AA sobre o fundo lavado. A cor da loja não entra: um aviso
// na cor da marca some no meio dos botões da marca.
// ============================================================
import { View } from "react-native";
import { usePaletaDaVitrine } from "./TemaDaVitrine";
import { wash } from "./theme";
import { Texto } from "./TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { faixaDaTemporada, type FaixaDaTemporada as Faixa } from "./modoDaVitrine";

export function FaixaDaTemporada({
  store,
  lugar,
  hoje,
  faixa: faixaPronta,
}: {
  store?: any;
  lugar: "topo" | "junto";
  /** Só para teste e para a prévia do painel. */
  hoje?: Date;
  /** A faixa já decidida (prévia do painel); sem ela, lê do `store`. */
  faixa?: Faixa | null;
}) {
  const T = usePaletaDaVitrine();
  const faixa = faixaPronta !== undefined ? faixaPronta : faixaDaTemporada(store, hoje);
  if (!faixa) return null;

  const urgente = faixa.tom === "ultimo_dia";
  const cor = urgente ? T.red : T.amber;
  const icone = faixa.tom === "fechada" ? "info" : "calendar";
  const topo = lugar === "topo";

  return (
    <View
      testID={"faixa-da-temporada-" + faixa.tom}
      accessibilityRole={urgente ? "alert" : undefined}
      style={{
        backgroundColor: wash(cor, urgente ? 0.1 : 0.12),
        flexDirection: "row", alignItems: topo ? "center" : "flex-start",
        justifyContent: topo ? "center" : "flex-start",
        gap: 8,
        paddingVertical: topo ? 9 : 10,
        paddingHorizontal: topo ? 16 : 12,
        borderRadius: topo ? 0 : 10,
      }}
    >
      <View style={{ marginTop: topo ? 0 : 1 }}>
        <Icon name={icone as any} size={15} color={cor} />
      </View>
      <Texto
        style={{
          color: cor, fontSize: topo ? 12.5 : 12.5, fontWeight: "600",
          lineHeight: 18, textAlign: topo ? "center" : "left",
          flexShrink: 1,
        }}
      >
        {faixa.texto}
      </Texto>
    </View>
  );
}
