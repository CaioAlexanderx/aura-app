// ============================================================
// Canal digital · escolher a tipografia
//
// REFEITO em 24/08/2026, em DUAS etapas — e a primeira estava errada.
//
// A queixa foi "as fontes ainda são muito parecidas". A primeira leitura
// foi que o defeito era a AMOSTRA: o cartão antigo era um mini-hero com
// logo, cor e prateleira, e o único elemento que mudava entre as quatro
// opções era o nome da loja em 22px. Isso era verdade e valia consertar —
// cada opção virou um espécime de tipo, palavra em 34px com a linha de
// corpo abaixo, sem logo e sem cor disputando atenção.
//
// Mas NÃO era a causa. Medido na tela depois: os quatro espécimes
// computavam a MESMA font-family e a MESMA largura em pixels. As quatro
// famílias carregavam, a escolha chegava aqui, e a regra global do painel
// — `*, *::before, *::after { font-family: <corpo> !important }` — vencia
// todas elas. `!important` num seletor universal ganha de qualquer estilo
// de componente.
//
// O conserto é o `dataSet` nos dois textos abaixo, que é o mesmo padrão
// que o wordmark já usava (ver AuraStudioMark). A lição: verificar que a
// fonte CARREGA não é verificar que ela é APLICADA.
// ============================================================
import { useEffect } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { TIPOGRAFIAS, cssDeTodasTipografias, type ChaveTipografia } from "@/constants/fonts";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";

/** Do mais próximo da marca Aura ao mais distante. */
const ORDEM: ChaveTipografia[] = ["classic", "modern", "editorial", "humanist"];

type Props = {
  valor?: string | null;
  onChange: (v: ChaveTipografia) => void;
  /** Cor da loja — entra só como marca de seleção, não como fundo. */
  cor: string;
  nomeDaLoja?: string | null;
};

export function PreviewTipografia({ valor, onChange, cor, nomeDaLoja }: Props) {
  const escolhida = (ORDEM.includes(valor as ChaveTipografia) ? valor : "classic") as ChaveTipografia;

  // A palavra do espécime é o nome da loja quando ele tem tamanho para
  // mostrar as letras. Nome curto não serve de amostra — "Aura" tem
  // quatro letras e nenhuma descendente. A palavra de reserva tem
  // ascendente, descendente, curva e diagonal de propósito.
  const bruto = (nomeDaLoja || "").trim();
  const palavra = bruto.length >= 6 ? bruto : "Agradável";

  // O painel carrega as QUATRO famílias — ao contrário da loja, que
  // carrega só a escolhida. Sem isto as quatro amostras sairiam na mesma
  // fonte de fallback e o preview mentiria.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const id = "aura-tipografias";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    // href sempre reatribuído: quando os pares mudam, um <link> antigo
    // deixaria as famílias novas de fora e tudo cairia no fallback — que
    // é exatamente como quatro fontes diferentes viram quatro iguais.
    link.href = cssDeTodasTipografias();
  }, []);

  return (
    <View style={{ gap: 8 }}>
      {ORDEM.map((chave) => {
        const par = TIPOGRAFIAS[chave];
        const sel = chave === escolhida;

        return (
          <Pressable
            key={chave}
            onPress={() => onChange(chave)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={`Tipografia ${par.nome}. ${par.hint}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 12,
              borderWidth: sel ? 1.5 : 1,
              // Selecionado se marca pela BORDA na cor da loja, não por
              // fundo colorido: fundo atrás de um espécime muda como a
              // letra é percebida, que é justamente o que está em jogo.
              borderColor: sel ? cor : Colors.border,
              backgroundColor: Colors.bg3,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              {/* O espécime. 34px é onde serifa, peso e largura aparecem;
                  em 22px as quatro pareciam a mesma fonte.

                  O `dataSet` NÃO é decoração. Ele vira `data-aura-display`
                  no DOM e é o que faz a fonte escolhida sobreviver à regra
                  global do painel — `* { font-family: … !important }`, que
                  ganha de qualquer `fontFamily` que um componente defina.
                  Sem ele as quatro amostras saem em DM Sans, que é o que
                  estava acontecendo: medido na tela, os quatro espécimes
                  computavam a MESMA família e a MESMA largura em pixels.
                  Ver `cssDeExcecaoDeFonte` em constants/fonts. */}
              <Text
                numberOfLines={1}
                {...({ dataSet: { auraDisplay: chave } } as any)}
                style={{
                  fontFamily: par.display,
                  color: Colors.ink,
                  fontSize: 34,
                  lineHeight: 44,
                }}
              >
                {palavra}
              </Text>

              {/* A fonte de CORPO também precisa aparecer: metade do texto
                  da loja sai nela, e par bonito no título às vezes falha
                  no tamanho pequeno. */}
              <Text
                numberOfLines={2}
                {...({ dataSet: { auraBody: chave } } as any)}
                style={{ fontFamily: par.body, color: Colors.ink3, fontSize: 13, lineHeight: 18 }}
              >
                {par.hint}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end", gap: 5, minWidth: 76 }}>
              <Text style={{ fontSize: 12.5, fontWeight: "800", color: sel ? cor : Colors.ink2 }}>
                {par.nome}
              </Text>
              {sel ? <Icon name="check-circle" size={15} color={cor} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
