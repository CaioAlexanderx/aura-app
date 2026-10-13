// ============================================================
// AURA. -- PDV/Caixa · Aviso no topo quando a loja está sem assinatura
//
// 11/10/2026: o Caixa fica vivo depois do trial (ver utils/muroDeAssinatura).
// Este é o único lugar da tela que fala de assinatura: uma faixa no topo com
// o motivo e um botão que leva ao checkout. Nada de botão desabilitado nem
// isca espalhada pela tela (premissa de 16/09).
//
// 13/10/2026: com a promoção do primeiro mês ativa (GET /billing/promocao-ativa,
// elegivel:true) a faixa ganha uma linha "Assine até 31/10 sem pagar novembro".
// A consulta é a mesma do checkout, com cache em módulo (hooks/usePromocaoAtiva).
// ============================================================
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ROTA_CHECKOUT, textoDoAviso } from "@/utils/muroDeAssinatura";
import { usePromocaoAtiva } from "@/hooks/usePromocaoAtiva";
import { fraseDaFaixa } from "@/utils/promocaoPrimeiroMes";

type Props = {
  trialEndsAt?: string | null;
  /** Empresa atual: com ela a faixa consulta a promoção do primeiro mês. */
  companyId?: string | null;
  /** Mobile: título e botão numa coluna. */
  compact?: boolean;
};

export function AvisoAssine({ trialEndsAt, companyId, compact = false }: Props) {
  const { titulo, corpo } = textoDoAviso(trialEndsAt);
  const promocao = usePromocaoAtiva(companyId);
  return (
    <View testID="caixa-aviso-assine" style={[s.faixa, compact && s.faixaCompact]} accessibilityRole="alert">
      <View style={s.icone}>
        <Icon name="lock" size={16} color={Colors.amber} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.titulo}>{titulo}</Text>
        <Text style={s.corpo}>{corpo}</Text>
        {promocao && <Text testID="caixa-aviso-promocao" style={s.promo}>{fraseDaFaixa(promocao)}</Text>}
      </View>
      <Pressable
        testID="caixa-aviso-assinar"
        onPress={() => router.push(ROTA_CHECKOUT as any)}
        style={[s.botao, compact && s.botaoCompact, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
        accessibilityLabel="Assinar agora e liberar o resto do sistema"
      >
        <Text style={s.botaoTxt}>Assinar agora</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  faixa: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingLeft: 14,
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: Colors.amberD,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
  },
  faixaCompact: { flexWrap: "wrap" },
  icone: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(251,191,36,0.14)",
    flexShrink: 0,
  },
  titulo: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  corpo: { fontSize: 12, color: Colors.ink2, marginTop: 2, lineHeight: 16 },
  promo: { fontSize: 12, fontWeight: "700", color: Colors.violet3, marginTop: 4, lineHeight: 16 },
  botao: {
    paddingHorizontal: 14, height: 36,
    borderRadius: 10,
    backgroundColor: Colors.violet,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  botaoCompact: { width: "100%", marginTop: 4 },
  botaoTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
});

export default AvisoAssine;
