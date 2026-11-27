// ============================================================
// WhatsApp · Conversas — medidor do topo (Main.dc.html):
// "Avisos 72 de 100 · Novidades 6 de 10", ao lado das abas.
//
// Lê o saldo do servidor (waSaldo / GET /whatsapp/saldo) e segue a regra que
// já vale na tela: trava desligada (ativo:false) ou saldo ilegível = nenhum
// número, porque o limite não existe ou não se sabe. Nunca inventa.
// O cabeçalho (título, abas, Guias) é o CabecalhoWa compartilhado; o medidor
// entra nele pela prop `extra`.
// ============================================================
import { View } from "react-native";
import type { SaldoInfo } from "@/components/whatsapp/waSaldo";
import { animCai, V } from "@/components/whatsapp/waVisual";
import { K, Tx, Barra, web, superficie } from "./conversasUi";

const MAX_CAPS = 12;

/** Medidor "Avisos 72 de 100 · Novidades 6 de 10". Null = nada a mostrar. */
export function MedidorHub({ saldo }: { saldo: SaldoInfo | null | undefined }) {
  if (!saldo || !saldo.ativo) return null;
  const { avisos, novidades } = saldo;
  const caps = novidades.total <= MAX_CAPS;
  return (
    <View testID="hub-medidor" accessibilityRole="image"
      accessibilityLabel={`Avisos do mês: ${avisos.restante} livres de ${avisos.total}. Novidades: ${novidades.restante} livres de ${novidades.total}`}
      style={[superficie.seca(999), { flexDirection: "row", alignItems: "center", gap: 18, minHeight: 50, paddingVertical: 7, paddingHorizontal: 18 }]}>
      <View style={{ minWidth: 130, gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <Tx style={{ fontSize: 12, lineHeight: 16, color: K.ink2 }}>Avisos</Tx>
          <Tx testID="hub-medidor-avisos" style={{ fontSize: 12, lineHeight: 16, fontWeight: "700" }}>{`${avisos.restante} de ${avisos.total}`}</Tx>
        </View>
        <Barra pct={avisos.total > 0 ? avisos.restante / avisos.total : 0} altura={6} />
      </View>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <Tx style={{ fontSize: 12, lineHeight: 16, color: K.ink2 }}>Novidades</Tx>
          <Tx testID="hub-medidor-novidades" style={{ fontSize: 12, lineHeight: 16, fontWeight: "700" }}>{`${novidades.restante} de ${novidades.total}`}</Tx>
        </View>
        {caps
          ? (
            <View style={{ flexDirection: "row", gap: 3 }}>
              {Array.from({ length: novidades.total }).map((_, i) => {
                const livre = i >= novidades.total - novidades.restante;
                return <View key={i} {...(livre ? ({ dataSet: { waAnim: "1" } } as any) : {})}
                  style={[{ width: 9, height: 8, borderRadius: 999, backgroundColor: livre ? "#a78bfa" : V.track },
                    livre ? web({ backgroundImage: "linear-gradient(180deg,#f3efff,#a78bfa)", boxShadow: "0 0 9px rgba(167,139,250,.6)" }) : null, livre ? animCai(i) : null]} />;
              })}
            </View>
          )
          : <Barra pct={novidades.total > 0 ? novidades.restante / novidades.total : 0} altura={6} />}
      </View>
    </View>
  );
}