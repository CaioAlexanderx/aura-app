// ============================================================
// AURA. — Seletor de acessos de funcionário do checkout (p-106, 11/11/2026)
//
// − e + com o número no meio, de 0 ao máximo do backend (10). Ao lado, a
// frase do mock v6: "O plano X inclui {só o seu acesso | o seu acesso e mais
// 2 de funcionário | ...}. Precisa de mais? Cada acesso de funcionário
// adicional custa R$ 19 por mês, em qualquer plano."
//
// Travado (loja ativa e em dia no mesmo plano e ciclo, ou 409
// ASSINATURA_ATIVA do backend): o número fica no valor atual, os botões
// desligam e a nota explica por quê. Nada aqui depende de hover (regra 7).
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { Ck, marca } from "@/components/billing/estiloDoCheckout";

type Props = {
  valor: number;
  maximo: number;
  texto: string;
  travado: boolean;
  /** Por que está travado (a mensagem do backend no 409, ou a nota da conta em dia). */
  notaDoTravado?: string | null;
  /** "Falar com a equipe" sob a nota (null = sem link). */
  onFalarComAEquipe?: (() => void) | null;
  onChange: (n: number) => void;
};

export function SeletorDeAcessos(p: Props) {
  var podeMenos = !p.travado && p.valor > 0;
  var podeMais = !p.travado && p.valor < p.maximo;
  return (
    <View testID="checkout-acessos">
      <View style={s.linha}>
        <View style={s.passo} accessibilityLabel={"Acessos de funcionário adicionais: " + p.valor}>
          <Pressable
            testID="checkout-acessos-menos"
            onPress={function () { if (podeMenos) p.onChange(p.valor - 1); }}
            disabled={!podeMenos}
            accessibilityRole="button"
            accessibilityLabel="Um acesso de funcionário a menos"
            accessibilityState={{ disabled: !podeMenos }}
            style={[s.botao, !podeMenos && s.botaoOff]}
            {...marca("ck-vidro")}
          >
            <Text style={s.botaoTxt}>−</Text>
          </Pressable>
          <Text testID="checkout-acessos-valor" style={s.numero}>{String(p.valor)}</Text>
          <Pressable
            testID="checkout-acessos-mais"
            onPress={function () { if (podeMais) p.onChange(p.valor + 1); }}
            disabled={!podeMais}
            accessibilityRole="button"
            accessibilityLabel="Um acesso de funcionário a mais"
            accessibilityState={{ disabled: !podeMais }}
            style={[s.botao, !podeMais && s.botaoOff]}
            {...marca("ck-vidro")}
          >
            <Text style={s.botaoTxt}>+</Text>
          </Pressable>
        </View>
        <Text testID="checkout-acessos-texto" style={s.texto}>{p.texto}</Text>
      </View>
      {p.travado && p.notaDoTravado ? (
        <View testID="checkout-acessos-travado" style={s.nota}>
          <Text style={s.notaTxt}>{p.notaDoTravado}</Text>
          {p.onFalarComAEquipe ? (
            <Pressable testID="checkout-acessos-whatsapp" onPress={p.onFalarComAEquipe} accessibilityRole="link" style={s.link} {...marca("ck-link")}>
              <Text style={s.linkTxt}>Falar com a equipe</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 },
  passo: { flexDirection: "row", alignItems: "center", gap: 6, padding: 4, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg3 },
  botao: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: Ck.vidroBorda, backgroundColor: Ck.vidro, alignItems: "center", justifyContent: "center" },
  botaoOff: { opacity: 0.4 },
  botaoTxt: { fontSize: 22, lineHeight: 24, fontWeight: "700", color: Colors.ink },
  numero: { minWidth: 36, textAlign: "center", fontFamily: Fonts.heading, fontSize: 26, lineHeight: 30, color: Colors.ink },
  texto: { flex: 1, minWidth: 200, fontSize: 12.5, lineHeight: 18, color: Colors.ink2 },
  nota: { marginTop: 10, borderWidth: 1, borderColor: Ck.warnLine, backgroundColor: Ck.warnD, borderRadius: 12, padding: 12 },
  notaTxt: { fontSize: 12.5, lineHeight: 18, color: Colors.ink },
  link: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center", marginTop: 4 },
  linkTxt: { fontSize: 13, color: Colors.violet4, fontWeight: "600" },
});
