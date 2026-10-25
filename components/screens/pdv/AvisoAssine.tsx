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
//
// 25/10/2026 (tom das mensagens, item 11, aprovado pelo Caio): em atraso, um
// segundo botão discreto, "Preciso de ajuda", abre o WhatsApp da Aura com o
// pedido de ajuda já escrito. É um botão comum (funciona no toque), sem
// hover. O texto da faixa não muda. "O Caixa segue liberado" no aviso de fim
// do teste só com caixaVivo (shell Negócio/varejo).
// ============================================================
import { View, Text, Pressable, StyleSheet, Platform, Linking } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ROTA_CHECKOUT, textoDoAviso, type AvisoDeAtraso } from "@/utils/muroDeAssinatura";
import { linkPedidoDeAjuda } from "@/utils/mensagensDoApp";

type Props = {
  trialEndsAt?: string | null;
  /** company.trial do /auth/me: decide entre "terminou" e "Seus 7 dias terminaram". */
  trial?: unknown;
  /** Mobile: título e botão numa coluna. */
  compact?: boolean;
  /** tq-86: avisoDeAtraso() da loja; troca o texto e o botão. */
  atraso?: AvisoDeAtraso | null;
  /** temCaixaVivo(company): shell Negócio/varejo, onde o Caixa segue depois do teste. */
  caixaVivo?: boolean;
  testID?: string;
};

export function AvisoAssine({ trialEndsAt, trial, compact = false, atraso = null, caixaVivo = false, testID = "caixa-aviso-assine" }: Props) {
  const { titulo, corpo } = textoDoAviso(trialEndsAt, trial, atraso, { caixaVivo });
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
      <View style={[s.botoes, compact && s.botoesCompact]}>
        <Pressable
          testID="caixa-aviso-assinar"
          onPress={() => router.push(ROTA_CHECKOUT as any)}
          style={[s.botao, compact && s.botaoCompact, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
          accessibilityLabel={atraso ? "Pagar a mensalidade em aberto" : "Assinar agora e liberar o resto do sistema"}
        >
          <Text style={s.botaoTxt}>{botao}</Text>
        </Pressable>
        {atraso && (
          <Pressable
            testID="caixa-aviso-ajuda"
            onPress={() => { Linking.openURL(linkPedidoDeAjuda()).catch(() => {}); }}
            style={[s.ajuda, compact && s.botaoCompact, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
            accessibilityRole="link"
            accessibilityLabel="Preciso de ajuda: abre uma conversa com a Aura no WhatsApp"
          >
            <Text style={s.ajudaTxt}>Preciso de ajuda</Text>
          </Pressable>
        )}
      </View>
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
  botaoCompact: { width: "100%" },
  botoes: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" },
  botoesCompact: { width: "100%", flexDirection: "column", alignItems: "stretch", gap: 6, marginTop: 4 },
  ajuda: {
    paddingHorizontal: 12, height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.35)",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  ajudaTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  botaoTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
});

export default AvisoAssine;
