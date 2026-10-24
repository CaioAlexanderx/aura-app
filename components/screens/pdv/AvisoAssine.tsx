// ============================================================
// AURA. -- PDV/Caixa · Aviso no topo quando a loja está sem assinatura
//
// 11/10/2026: o Caixa fica vivo depois do trial (ver utils/muroDeAssinatura).
// Este é o único lugar da tela que fala de assinatura: uma faixa no topo com
// o motivo e um botão que leva ao checkout. Nada de botão desabilitado nem
// isca espalhada pela tela (premissa de 16/09).
//
// 24/10/2026 (tq-86): a mesma faixa avisa o atraso. Antes da pausa das
// telas, no Caixa e no Painel, com a data da pausa; com as telas pausadas,
// no Caixa, com a data em que o Caixa pausa. O botão leva ao checkout, onde
// a mensalidade em aberto é paga.
// ============================================================
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ROTA_CHECKOUT, textoDoAviso, type AvisoDeAtraso } from "@/utils/muroDeAssinatura";

type Props = {
  trialEndsAt?: string | null;
  /** company.trial do /auth/me: decide entre "terminou" e "Seus 7 dias terminaram". */
  trial?: unknown;
  /** Mobile: título e botão numa coluna. */
  compact?: boolean;
  /** tq-86: avisoDeAtraso() da loja; troca o texto e o botão. */
  atraso?: AvisoDeAtraso | null;
  testID?: string;
};

export function AvisoAssine({ trialEndsAt, trial, compact = false, atraso = null, testID = "caixa-aviso-assine" }: Props) {
  const { titulo, corpo } = textoDoAviso(trialEndsAt, trial, atraso);
  const botao = atraso ? "Pagar a mensalidade" : "Assinar agora";
  return (
    <View testID={testID} style={[s.faixa, compact && s.faixaCompact]} accessibilityRole="alert">
      <View style={s.icone}>
        <Icon name={atraso?.fase === "liberado" ? "alert" : "lock"} size={16} color={Colors.amber} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.titulo}>{titulo}</Text>
        <Text style={s.corpo}>{corpo}</Text>
      </View>
      <Pressable
        testID="caixa-aviso-assinar"
        onPress={() => router.push(ROTA_CHECKOUT as any)}
        style={[s.botao, compact && s.botaoCompact, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
        accessibilityLabel={atraso ? "Pagar a mensalidade em aberto" : "Assinar agora e liberar o resto do sistema"}
      >
        <Text style={s.botaoTxt}>{botao}</Text>
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
