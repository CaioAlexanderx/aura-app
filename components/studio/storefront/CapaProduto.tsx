// ============================================================
// AURA STUDIO · vitrine — capa do produto (guardrail, fase 02)
//
// Um lugar só decide como o produto aparece, com foto ou sem. É aqui que
// mora o piso de qualidade: a loja continua bonita mesmo quando a lojista
// não caprichou no conteúdo.
//
// DUAS COISAS QUE MUDAM EM RELAÇÃO AO QUE HAVIA:
//
// 1. Sem foto, a vitrine caía no preview de personalização — um retângulo
//    tracejado escrito "28×35cm". Isso é informação de PRODUÇÃO; o cliente
//    não sabe o que é e a grade fica furada. Agora vira uma capa composta:
//    iniciais do produto sobre um tom da cor da loja.
//
// 2. Com foto, era `resizeMode="cover"`, que CORTA a peça — um vestido
//    fotografado inteiro virava um pedaço de tecido. Agora é `contain`
//    sobre um ladrilho neutro, com respiro: a peça aparece inteira e a
//    grade fica regular mesmo com fotos de enquadramento irregular.
// ============================================================
import { View, Image } from "react-native";
import { Fonts } from "@/constants/fonts";
import { usePaletaDaVitrine } from "./TemaDaVitrine";
import { wash, corLegivelSobre, AURA } from "./theme";
import { iniciais, degrauDaCapa } from "./capaModel";

import { Texto } from "./TipografiaVitrine";
type Props = {
  /** Foto do produto, quando existir. */
  uri?: string | null;
  /** Nome do produto — vira as iniciais quando não há foto. */
  nome: string;
  /** Lado do quadrado, em px. */
  tamanho: number;
  /** Cor da loja; sem ela, o violeta da Aura assume. */
  corDaLoja?: string | null;
  /** Fonte de titulo do par escolhido — as iniciais saem nela. */
  fonteDisplay?: string;
  /** Altura, quando o cartao nao e quadrado (o minimal e 3:4). */
  altura?: number;
  /**
   * Sangra a foto no quadro inteiro, cortando o que sobra.
   *
   * So o estilo "Imagem" pede isso, e pede de proposito: quem escolhe
   * esse estilo esta trocando a peca inteira por impacto visual. Nos
   * outros dois vale o guardrail — `contain`, peca inteira.
   */
  preencher?: boolean;
};

export function CapaProduto({ uri, nome, tamanho, corDaLoja, fonteDisplay, altura, preencher }: Props) {
  const T = usePaletaDaVitrine();
  const cor = corDaLoja || AURA.violet;
  const alt = altura || tamanho;
  const raio = Math.round(Math.min(tamanho, alt) * 0.14);

  // ── Com foto ────────────────────────────────────────────
  if (uri) {
    return (
      <View
        style={{
          width: tamanho,
          height: alt,
          borderRadius: preencher ? 0 : raio,
          // Ladrilho neutro: foto recortada em fundo branco, foto de
          // celular com fundo de mesa e print de marketplace passam a
          // dividir a mesma moldura.
          backgroundColor: T.bg,
          borderWidth: preencher ? 0 : 1,
          borderColor: wash(cor, 0.1),
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          padding: preencher ? 0 : Math.round(tamanho * 0.06),
        }}
      >
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          // `contain`, nunca `cover`: melhor sobrar moldura do que cortar
          // a peça que o cliente está tentando comprar.
          resizeMode={preencher ? "cover" : "contain"}
          accessibilityLabel={nome}
        />
      </View>
    );
  }

  // ── Sem foto ────────────────────────────────────────────
  const sigla = iniciais(nome);
  const intensidade = degrauDaCapa(nome);

  return (
    <View
      accessibilityLabel={nome}
      style={{
        width: tamanho,
        height: alt,
        borderRadius: preencher ? 0 : raio,
        backgroundColor: wash(cor, intensidade),
        borderWidth: 1,
        borderColor: wash(cor, 0.18),
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Texto
        style={{
          fontFamily: fonteDisplay || Fonts.heading,
          // A serifada da marca no lugar de um ícone genérico: é o que faz
          // a capa parecer decisão de design, não ausência de conteúdo.
          fontSize: Math.round(Math.min(tamanho, alt) * 0.42),
          lineHeight: Math.round(Math.min(tamanho, alt) * 0.5),
          color: corLegivelSobre(cor, "#FFFFFF"),
          letterSpacing: 0.5,
        }}
      >
        {sigla}
      </Texto>
    </View>
  );
}
