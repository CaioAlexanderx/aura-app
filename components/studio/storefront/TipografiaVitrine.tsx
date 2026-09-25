// ============================================================
// AURA STUDIO · vitrine — a fonte da loja em TODA a página
//
// A lojista escolhia o par tipográfico e ele chegava só nos títulos.
// Medido na loja de teste: de 20 textos da tela de produto, **19 saíam
// em `-apple-system`** — preço, botão, rótulo, descrição, tudo.
//
// A causa é o react-native-web: todo `<Text>` recebe uma classe base que
// declara a fonte do sistema, e só quem passa `fontFamily` explícito
// escapa dela. Não dá para consertar por CSS de fora sem atropelar os
// títulos junto (a classe base e a classe da fonte têm a MESMA
// especificidade).
//
// Então a vitrine passa a ter o seu próprio `Texto`: um `Text` que já
// nasce com a fonte de corpo da loja. Quem precisa da serifada continua
// passando `fontFamily` no style, e vence normalmente.
// ============================================================
import { createContext, useContext, type ReactNode } from "react";
import { Text, type TextProps } from "react-native";
// A chave e a MESMA que a lojista escolheu (contrato de banco), mas a
// vitrine Studio resolve ela no trio Studio Premium — Fraunces, DM Sans
// e Bricolage Grotesque nos numeros. A loja comum resolve na curadoria
// dela. Ver constants/fonts.ts.
import { tipografiaDoStudio, NUMEROS_STUDIO, type ParTipografico } from "@/constants/fonts";

const Contexto = createContext<ParTipografico>(tipografiaDoStudio(null));

export function TipografiaDaVitrine({
  chave, children,
}: {
  /** `site.font_family` — a escolha da lojista. */
  chave?: string | null;
  children: ReactNode;
}) {
  return <Contexto.Provider value={tipografiaDoStudio(chave)}>{children}</Contexto.Provider>;
}

/** O par escolhido, para quem precisa da serifada de título. */
export function useTipografia(): ParTipografico {
  return useContext(Contexto);
}

/**
 * `Text` com a fonte de corpo da loja por padrão.
 *
 * O style do chamador vem DEPOIS, então um `fontFamily` explícito (a
 * serifada dos títulos) continua vencendo.
 */
export function Texto({ style, ...resto }: TextProps) {
  const par = useTipografia();
  return <Text {...resto} style={[{ fontFamily: par.body }, style]} />;
}

/**
 * A voz dos numeros: preco, quantidade, contagem, CEP, codigo Pix e
 * rotulo em caixa alta. Bricolage Grotesque com digitos tabulares — um
 * total que muda de R$ 49,90 para R$ 99,80 nao pode mudar de largura e
 * empurrar o botao ao lado.
 *
 * Funcao, e nao so componente, porque TextInput e folhas de estilo
 * tambem precisam dela.
 */
export function estiloNumero(par: ParTipografico) {
  return {
    fontFamily: par.numeros || NUMEROS_STUDIO,
    fontVariant: ["tabular-nums" as const],
  };
}

/** `Texto` na voz dos numeros. O style do chamador continua vencendo. */
export function Numero({ style, ...resto }: TextProps) {
  const par = useTipografia();
  return <Text {...resto} style={[estiloNumero(par), style]} />;
}
