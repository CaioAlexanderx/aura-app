// ============================================================
// AURA. — Cartão de plano do checkout (p-104, 11/11/2026)
//
// Nome em serif 22, valor em 22/700 com "/mês" ao lado (o valor nunca
// quebra; "/mês" desce inteiro se faltar espaço), descrição, selo "Mais
// escolhido" só no Negócio e, no anual, "cobrado por mês, plano anual".
// Selecionado: borda violeta e glow.
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { fmtBRL } from "@/components/billing/couponText";
import { Ck, marca, soWeb } from "@/components/billing/estiloDoCheckout";
import { NOTA_ANUAL_NO_PLANO, SELO_MAIS_ESCOLHIDO } from "@/components/billing/textosDoCheckout";

type Props = {
  chave: string;
  nome: string;
  preco: number;
  descricao: string;
  popular?: boolean;
  selecionado: boolean;
  anual: boolean;
  onPress: () => void;
};

export function CartaoDePlano(p: Props) {
  return (
    <Pressable
      testID={"checkout-plano-" + p.chave}
      onPress={p.onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: p.selecionado, checked: p.selecionado }}
      accessibilityLabel={"Plano " + p.nome + ", " + fmtBRL(p.preco) + " por mês"}
      {...marca("ck-plano")}
      style={[s.card, p.selecionado && s.cardSel, p.selecionado && soWeb({ boxShadow: "0 0 0 1px " + Colors.violet2 + ", 0 10px 28px " + Ck.glow })]}
    >
      {p.popular ? (
        <View testID={"checkout-plano-selo-" + p.chave} style={s.selo}>
          <Text style={s.seloTxt}>{SELO_MAIS_ESCOLHIDO}</Text>
        </View>
      ) : null}
      <Text style={s.nome}>{p.nome}</Text>
      <View style={s.precoLinha}>
        <Text style={s.preco} numberOfLines={1}>{fmtBRL(p.preco)}</Text>
        <Text style={s.mes}>/mês</Text>
      </View>
      <Text style={s.desc}>{p.descricao}</Text>
      {p.anual ? <Text style={s.anual}>{NOTA_ANUAL_NO_PLANO}</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, minWidth: 0, backgroundColor: Colors.bg3, borderRadius: 18, padding: 14, paddingTop: 16, borderWidth: 1, borderColor: Colors.border, gap: 4, position: "relative" as any },
  cardSel: { borderColor: Colors.violet2, backgroundColor: Colors.bg4 },
  selo: { position: "absolute" as any, top: -9, right: 12, backgroundColor: Colors.violet, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  seloTxt: { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 0.8, textTransform: "uppercase" as any, color: "#fff" },
  nome: { fontFamily: Fonts.heading, fontSize: 22, lineHeight: 24, color: Colors.ink },
  precoLinha: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 4 },
  preco: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, color: Colors.ink },
  mes: { fontSize: 12, color: Colors.ink3 },
  desc: { fontSize: 12, color: Colors.ink3 },
  anual: { fontSize: 11.5, color: Ck.warn },
});
