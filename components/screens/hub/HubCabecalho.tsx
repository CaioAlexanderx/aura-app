// ============================================================
// WhatsApp · Conversas — cabeçalho do mockup (Main.dc.html):
//   "WhatsApp da <loja>" (meta) + "Conversas." | abas em pílula + medidor.
//
// O medidor lê o saldo do servidor (waSaldo / GET /whatsapp/saldo) e segue a
// regra que já vale na tela: trava desligada (ativo:false) ou saldo ilegível =
// nenhum número, porque o limite não existe ou não se sabe. Nunca inventa.
// Celular: o cabeçalho é só título e abas; o "72 avisos" vai para a conversa.
// ============================================================
import { View } from "react-native";
import { IS_WIDE } from "@/constants/helpers";
import type { SaldoInfo } from "@/components/whatsapp/waSaldo";
import { K, Meta, Titulo, Tx, Pilula, Barra, web, superficie } from "./waVisual";

export interface AbaWa { key: string; label: string; testID?: string }

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
                return <View key={i} style={[{ width: 9, height: 8, borderRadius: 999, backgroundColor: livre ? "#a78bfa" : K.trilho },
                  livre ? web({ backgroundImage: "linear-gradient(180deg,#f3efff,#a78bfa)", boxShadow: "0 0 9px rgba(167,139,250,.6)" }) : null]} />;
              })}
            </View>
          )
          : <Barra pct={novidades.total > 0 ? novidades.restante / novidades.total : 0} altura={6} />}
      </View>
    </View>
  );
}

export function HubCabecalho({ lojaNome, abas, ativa, onSelect, saldo }: {
  lojaNome: string; abas: AbaWa[]; ativa: string; onSelect: (k: string) => void; saldo?: SaldoInfo | null;
}) {
  const largo = IS_WIDE;
  return (
    <View testID="hub-cabecalho" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
      <View style={{ gap: 10 }}>
        <Meta>{lojaNome ? `WhatsApp da ${lojaNome}` : "WhatsApp da loja"}</Meta>
        <Titulo size={largo ? 46 : 34}>Conversas</Titulo>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {abas.map((a) => (
            <Pilula key={a.key} testID={a.testID} on={a.key === ativa} onPress={() => onSelect(a.key)}>{a.label}</Pilula>
          ))}
        </View>
        {largo && <MedidorHub saldo={saldo} />}
      </View>
    </View>
  );
}
