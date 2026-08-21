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
import { View, Text, Pressable, Platform } from "react-native";
import { Fonts } from "@/constants/fonts";
import { T } from "./types";
import { wash, AURA } from "./theme";
import { CarrosselFoto } from "./CarrosselFoto";
import { resumo } from "./capaModel";

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
  onPress: () => void;
};

export function ProductCard({
  nome, preco, fotos, descricao, selo, largura, corDaLoja, onPress,
}: Props) {
  const cor = corDaLoja || AURA.violet;
  const desc = resumo(descricao, 64);

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
          borderWidth: 1,
          borderColor: hovered ? wash(cor, 0.3) : T.border,
          padding: 10,
          gap: 10,
          // Movimento do design system: sobe e cresce de leve, numa curva
          // só. Nada de spring.
          transform: [{ translateY: hovered ? -2 : 0 }, { scale: pressed ? 0.985 : 1 }],
        },
        Platform.OS === "web"
          ? ({
              transition: `transform ${AURA.motion.base}ms ${AURA.motion.ease}, border-color ${AURA.motion.base}ms ${AURA.motion.ease}, box-shadow ${AURA.motion.base}ms ${AURA.motion.ease}`,
              boxShadow: hovered
                ? `0 10px 24px -12px ${wash(cor, 0.45)}`
                : `0 2px 8px -6px ${wash(cor, 0.35)}`,
              cursor: "pointer",
            } as any)
          : ({ elevation: hovered ? 4 : 2 } as any),
      ]}
    >
      <CarrosselFoto fotos={fotos} nome={nome} tamanho={largura - 20} corDaLoja={cor} />

      <View style={{ gap: 3, paddingHorizontal: 2, paddingBottom: 2 }}>
        {selo ? (
          <Text
            style={{
              fontSize: 10, fontWeight: "800", letterSpacing: 0.8,
              textTransform: "uppercase", color: cor,
            }}
          >
            {selo}
          </Text>
        ) : null}

        <Text
          numberOfLines={2}
          style={{
            fontFamily: Fonts.heading,
            fontSize: 16,
            lineHeight: 20,
            color: T.ink,
          }}
        >
          {nome}
        </Text>

        {desc ? (
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: T.ink3 }}>
            {desc}
          </Text>
        ) : null}

        <Text
          style={{
            fontSize: 15, fontWeight: "800", color: cor, marginTop: 2,
            fontVariant: ["tabular-nums"],
          }}
        >
          R$ {preco.toFixed(2)}
        </Text>
      </View>
    </Pressable>
  );
}
