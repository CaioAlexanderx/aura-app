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
// e DM Mono. A loja comum resolve na curadoria dela. Ver constants/fonts.ts.
import { tipografiaDoStudio, type ParTipografico } from "@/constants/fonts";

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
