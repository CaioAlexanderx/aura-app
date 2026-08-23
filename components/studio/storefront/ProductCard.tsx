// ============================================================
// AURA STUDIO · vitrine — cartão de produto (fase 03)
//
// Antes a vitrine era uma LISTA DE LINHAS com miniatura de 72px: a foto
// da peça — a única coisa que faz alguém querer comprar — ocupava menos
// espaço que o botão. Agora é uma grade de cartões com a foto em
// destaque, ocupando a largura inteira do cartão.
//
// O cartão carrega tudo que o cliente precisa para decidir sem abrir:
// foto (com carrossel quando há mais de uma), o que é, quanto custa e se
// há modelos para escolher.
// ============================================================
import { View, Pressable, Platform } from "react-native";
import { Fonts } from "@/constants/fonts";
import { T } from "./types";
import { wash, AURA } from "./theme";
import { CarrosselFoto } from "./CarrosselFoto";
import { resumo } from "./capaModel";

import { Texto } from "./TipografiaVitrine";
type Props = {
  nome: string;
  preco: number;
  fotos: string[];
  descricao?: string | null;
  /** "3 modelos para escolher" quando o cartão representa uma categoria. */
  selo?: string | null;
  /** Largura do cartão — a grade calcula e passa. */
  largura: number;
  corDaLoja?: string | null;
  /** Fonte de titulo do par escolhido pela lojista. */
  fonteDisplay?: string;
  /**
   * Estilo do cartao, escolhido pela lojista no painel.
   *
   * A coluna e o seletor ja existiam e so a loja comum obedecia; a
   * vitrine Studio desenhava sempre do mesmo jeito.
   */
  estilo?: "editorial" | "minimal" | "image-heavy";
  onPress: () => void;
};

export function ProductCard({
  nome, preco, fotos, descricao, selo, largura, corDaLoja, fonteDisplay,
  estilo = "editorial", onPress,
}: Props) {
  const cor = corDaLoja || AURA.violet;
  // No minimal a descricao nao entra: o estilo existe pra caber mais
  // produto na tela, e uma linha extra por cartao briga com isso.
  const desc = estilo === "minimal" ? null : resumo(descricao, 64);
  const compacto = estilo === "minimal";
  const sobreposto = estilo === "image-heavy";

  // As tres formas que separam os estilos de verdade. Antes os tres
  // usavam foto QUADRADA em `contain` dentro de uma moldura, e a unica
  // diferenca visivel era o tamanho da fonte — dai "o estilo dos cards
  // pouco ou nada muda".
  const larguraFoto = largura - (sobreposto ? 0 : 20);
  // Minimal em retrato 3:4: e a proporcao de catalogo de moda, e cabe
  // mais produto na mesma altura de tela.
  const alturaFoto = compacto ? Math.round(larguraFoto * 4 / 3) : larguraFoto;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nome}, a partir de R$ ${preco.toFixed(2)}`}
      style={({ pressed, hovered }: any) => [
        {
          width: largura,
          backgroundColor: T.card,
          borderRadius: 14,
          borderWidth: compacto ? 0 : 1,
          borderColor: hovered ? wash(cor, 0.3) : T.border,
          padding: sobreposto ? 0 : compacto ? 0 : 10,
          gap: sobreposto ? 0 : compacto ? 7 : 10,
          overflow: sobreposto ? "hidden" : "visible",
          // Movimento do design system: sobe e cresce de leve, numa curva
          // só. Nada de spring.
          transform: [{ translateY: hovered ? -2 : 0 }, { scale: pressed ? 0.985 : 1 }],
        },
        Platform.OS === "web"
          ? ({
              transition: `transform ${AURA.motion.base}ms ${AURA.motion.ease}, border-color ${AURA.motion.base}ms ${AURA.motion.ease}, box-shadow ${AURA.motion.base}ms ${AURA.motion.ease}`,
              boxShadow: compacto
                ? "none"
                : hovered
                  ? `0 10px 24px -12px ${wash(cor, 0.45)}`
                  : `0 2px 8px -6px ${wash(cor, 0.35)}`,
              cursor: "pointer",
            } as any)
          : ({ elevation: compacto ? 0 : hovered ? 4 : 2 } as any),
      ]}
    >
      <CarrosselFoto
        fotos={fotos}
        nome={nome}
        tamanho={larguraFoto}
        altura={alturaFoto}
        // So o "Imagem" sangra: quem escolhe esse estilo troca a peca
        // inteira por impacto. Nos outros dois vale o guardrail.
        preencher={sobreposto}
        corDaLoja={cor}
        fonteDisplay={fonteDisplay}
      />

      {/* No image-heavy a informacao deita SOBRE a foto, com um veu
          escuro por baixo: sem ele, nome branco em foto de fundo claro
          some — e foto de lojista e clara na maioria das vezes. */}
      <View
        style={[
          { gap: 3, paddingHorizontal: 2, paddingBottom: 2 },
          sobreposto && ({
            position: "absolute", left: 0, right: 0, bottom: 0,
            paddingHorizontal: 12, paddingVertical: 10, gap: 2,
            ...(Platform.OS === "web"
              ? ({ backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.35) 60%, transparent)" } as any)
              : { backgroundColor: "rgba(0,0,0,0.55)" }),
          } as any),
        ]}
      >
        {selo ? (
          <Texto
            style={{
              fontSize: 10, fontWeight: "800", letterSpacing: 0.8,
              textTransform: "uppercase", color: sobreposto ? "rgba(255,255,255,0.85)" : cor,
            }}
          >
            {selo}
          </Texto>
        ) : null}

        <Texto
          numberOfLines={2}
          style={{
            fontFamily: compacto ? undefined : (fonteDisplay || Fonts.heading),
            fontSize: compacto ? 13 : 16,
            lineHeight: compacto ? 16 : 20,
            fontWeight: compacto ? "500" : "400",
            color: sobreposto ? "#fff" : T.ink,
          }}
        >
          {nome}
        </Texto>

        {desc ? (
          <Texto numberOfLines={1} style={{ fontSize: 11.5, color: T.ink3 }}>
            {desc}
          </Texto>
        ) : null}

        <Texto
          style={{
            fontSize: compacto ? 13 : 15, fontWeight: "800",
            color: sobreposto ? "#fff" : cor, marginTop: 2,
            fontVariant: ["tabular-nums"],
          }}
        >
          R$ {preco.toFixed(2)}
        </Texto>
      </View>
    </Pressable>
  );
}
