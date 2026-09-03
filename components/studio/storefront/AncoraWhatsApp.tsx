// ============================================================
// AURA STUDIO · vitrine — âncora de WhatsApp (fase 03)
//
// Quem compra personalizado tem dúvida ANTES de comprar: "serve no meu
// tamanho?", "dá tempo pro dia 12?", "consigo mandar a arte depois?".
// A vitrine não tinha para onde mandar essa dúvida — e dúvida sem
// destino vira carrinho abandonado.
//
// O WhatsApp é o canal de venda real destas lojas, não um canal de
// suporte. Por isso ele fica alcançável de qualquer ponto da prateleira,
// como no Oscar, e não escondido num rodapé.
// ============================================================
import { View, Pressable, Platform, Linking } from "react-native";
import { AURA, wash, parLegivel } from "./theme";

import { Texto } from "./TipografiaVitrine";
/**
 * Número em E.164 sem sinais, como o wa.me exige.
 *
 * A lojista digita como quiser: "(34) 98412-4181", "34 9 8412 4181",
 * "+55 34 98412-4181". Sem DDI, assume Brasil — é de onde vêm todas as
 * lojas, e mandar um link quebrado é pior que não mandar.
 */
export function numeroWhatsApp(bruto?: string | null): string | null {
  const so = String(bruto || "").replace(/\D/g, "");
  if (!so) return null;
  // 10 = fixo com DDD, 11 = celular com DDD.
  if (so.length === 10 || so.length === 11) return "55" + so;
  // Já veio com DDI.
  if (so.length === 12 || so.length === 13) return so;
  return null;
}

/** Link do wa.me com a primeira mensagem já escrita. */
export function linkWhatsApp(bruto?: string | null, nomeDaLoja?: string | null): string | null {
  const num = numeroWhatsApp(bruto);
  if (!num) return null;
  const loja = String(nomeDaLoja || "").trim();
  const texto = loja
    ? `Olá! Vim pela loja ${loja} e queria tirar uma dúvida.`
    : "Olá! Vim pela loja e queria tirar uma dúvida.";
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

type Props = {
  numero?: string | null;
  nomeDaLoja?: string | null;
  corDaLoja?: string | null;
  /** Sobe o botão quando a barra do carrinho está na tela. */
  acimaDaBarra?: boolean;
};

/**
 * O link do WhatsApp para pedido em lote.
 *
 * Ate o assistente publico existir (S6), o bloco B2B da home leva a
 * conversa para o WhatsApp com o assunto ja escrito — que e como a
 * lojista atende esse pedido hoje. Melhor um caminho real e curto do que
 * um botao que ainda nao faz nada.
 */
export function linkDeLote(bruto?: string | null, nomeDaLoja?: string | null): string | null {
  const num = numeroWhatsApp(bruto);
  if (!num) return null;
  const loja = String(nomeDaLoja || "").trim();
  const texto = loja
    ? `Olá! Vim pela loja ${loja} e queria um orçamento em lote (peças personalizadas com nomes).`
    : "Olá! Queria um orçamento em lote de peças personalizadas com nomes.";
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

export function AncoraWhatsApp({ numero, nomeDaLoja, corDaLoja, acimaDaBarra }: Props) {
  const href = linkWhatsApp(numero, nomeDaLoja);
  // Sem número configurado não há botão. Um botão que não leva a lugar
  // nenhum é pior que ausência.
  if (!href) return null;

  const corBruta = corDaLoja || AURA.violet;
  // `parLegivel`, nao `corLegivelSobre(cor, "#FFF")`. O segundo devolve
  // uma versao da COR legivel sobre BRANCO — eu aplicava isso como tinta
  // sobre a propria pilula colorida, entao em #dc2626 o botao saia
  // vermelho-escuro em vermelho: uma pilula solida, sem icone nem texto.
  //
  // E `tintaSobre` sozinho tambem nao basta: ele escolhe a melhor das
  // duas tintas, e no meio-tom NENHUMA passa de 4.5 (medido: 4.02 e
  // 4.20). Botao preenchido precisa do par que MOVE o preenchimento —
  // e exatamente pra isso que parLegivel existe desde a fase 01.
  const { fundo: cor, tinta } = parLegivel(corBruta);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        right: 16,
        bottom: acimaDaBarra ? 92 : 20,
        zIndex: 40,
      }}
    >
      <Pressable
        onPress={() => Linking.openURL(href)}
        accessibilityRole="link"
        accessibilityLabel={`Falar com ${nomeDaLoja || "a loja"} no WhatsApp`}
        style={({ hovered, pressed }: any) => [
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: cor,
            borderWidth: 1,
            borderColor: wash(cor, 0.35),
            transform: [{ translateY: hovered ? -2 : 0 }, { scale: pressed ? 0.98 : 1 }],
          },
          Platform.OS === "web"
            ? ({
                transition: `transform ${AURA.motion.base}ms ${AURA.motion.ease}, box-shadow ${AURA.motion.base}ms ${AURA.motion.ease}`,
                boxShadow: hovered
                  ? `0 12px 28px -12px ${wash(cor, 0.6)}`
                  : `0 6px 18px -10px ${wash(cor, 0.5)}`,
                cursor: "pointer",
              } as any)
            : ({ elevation: 5 } as any),
        ]}
      >
        <Icone cor={tinta} />
        <Texto style={{ color: tinta, fontSize: 13.5, fontWeight: "700" }}>Tirar dúvida</Texto>
      </Pressable>
    </View>
  );
}

/**
 * O glifo do WhatsApp desenhado com View, não emoji.
 *
 * O design system proíbe emoji, e o emoji ainda renderiza diferente em
 * cada sistema — no Windows sai um quadrado verde sem o telefone.
 */
function Icone({ cor }: { cor: string }) {
  return (
    <View
      style={{
        width: 17, height: 17, borderRadius: 9,
        borderWidth: 1.8, borderColor: cor,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 6.5, height: 6.5, borderRadius: 2,
          borderLeftWidth: 1.8, borderBottomWidth: 1.8, borderColor: cor,
          transform: [{ rotate: "-45deg" }],
        }}
      />
    </View>
  );
}
