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
  /**
   * Fase 5 (home nova): só o balão, num círculo de 56 px. Onde não há
   * margem livre ao lado do conteúdo (celular, desktop estreito), a
   * pílula com o texto cobriria o que está embaixo; o círculo ocupa o
   * mínimo. O nome continua para o leitor de tela.
   */
  compacto?: boolean;
  /** Distância da borda direita (a home nova põe o botão na margem). */
  direita?: number;
};

export function AncoraWhatsApp({ numero, nomeDaLoja, corDaLoja, acimaDaBarra, compacto, direita = 16 }: Props) {
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
        right: direita,
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
            paddingHorizontal: compacto ? 0 : 16,
            paddingVertical: compacto ? 0 : 12,
            width: compacto ? 56 : undefined,
            height: compacto ? 56 : undefined,
            justifyContent: "center",
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
        <Icone cor={tinta} tamanho={compacto ? 24 : 18} />
        {compacto ? null : <Texto style={{ color: tinta, fontSize: 13.5, fontWeight: "700" }}>Tirar dúvida</Texto>}
      </Pressable>
    </View>
  );
}

/** O balão do WhatsApp — o mesmo desenho de `components/Icon.tsx`. */
const BALAO_DO_WHATSAPP = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";

/**
 * O ícone do WhatsApp em SVG, não emoji: o design system proíbe emoji, e o
 * emoji renderiza diferente em cada sistema.
 *
 * No web é o mesmo balão do resto do app, desenhado aqui em vez de importar
 * `components/Icon.tsx`: aquele módulo puxa `react-native-svg`, e este
 * arquivo é carregado pelas regras puras de `pedidoPeloWhatsApp.ts` nos
 * testes. O glifo feito de View que existia antes virava uma seta num
 * círculo e não lia como WhatsApp (QA 25/09); fica só no app nativo.
 */
function Icone({ cor, tamanho = 18 }: { cor: string; tamanho?: number }) {
  if (Platform.OS === "web") {
    const svg = `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="${cor}" aria-hidden="true"><path d="${BALAO_DO_WHATSAPP}"/></svg>`;
    return (
      <span
        style={{ width: tamanho, height: tamanho, display: "inline-flex", flexShrink: 0 } as any}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
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
