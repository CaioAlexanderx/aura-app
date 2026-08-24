// ============================================================
// Ficha técnica do produto — material, medidas, cuidados.
//
// Porte da loja comum (backend #597), onde a ficha nasceu. As duas lojas
// não compartilham uma linha de código de UI: a loja comum é HTML gerado
// no servidor, esta é React Native Web. O que é compartilhado é o payload,
// e há um teste no backend que falha se um campo existir só de um lado.
//
// Por que ficha e não mais um parágrafo de descrição: material e medidas
// são o que a pessoa procura quando já decidiu que gostou e precisa saber
// se serve. Enterrar isso num texto corrido obriga a ler tudo pra achar
// "34 cm". Em linhas rotuladas, o olho vai direto.
//
// Some inteira quando a lojista não preencheu nada — bloco vazio com
// título "Ficha técnica" e nada embaixo é pior que bloco nenhum.
// ============================================================
import { View } from "react-native";
import { Texto } from "./TipografiaVitrine";
import type { StudioStoreProduct } from "./types";

type Props = {
  produto: StudioStoreProduct;
  /** Paleta da loja, já resolvida pelo chamador. */
  T: { ink: string; ink2: string; ink3: string; border: string };
  marcaTexto: string;
};

/** As três linhas, na ordem em que a pessoa pergunta. */
export function linhasDaFicha(p: StudioStoreProduct): Array<[string, string]> {
  return ([
    ["Material", p.material],
    ["Medidas", p.medidas],
    ["Cuidados", p.cuidados],
  ] as Array<[string, string | null | undefined]>)
    .filter((l): l is [string, string] => !!l[1] && String(l[1]).trim().length > 0)
    .map(([rot, val]) => [rot, String(val).trim()]);
}

export function FichaTecnica({ produto, T, marcaTexto }: Props) {
  const linhas = linhasDaFicha(produto);
  if (!linhas.length) return null;

  return (
    <View style={{ gap: 8 }}>
      <Texto
        style={{
          fontSize: 10.5,
          color: marcaTexto,
          fontWeight: "800",
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        Ficha técnica
      </Texto>

      <View style={{ borderTopWidth: 1, borderTopColor: T.border }}>
        {linhas.map(([rotulo, valor]) => (
          <View
            key={rotulo}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
              paddingVertical: 9,
              borderBottomWidth: 1,
              borderBottomColor: T.border,
            }}
          >
            {/* Largura fixa no rótulo: sem ela as três colunas de valor
                começam em pontos diferentes e a ficha deixa de se ler
                como tabela. */}
            <Texto style={{ width: 82, fontSize: 12, color: T.ink3, fontWeight: "700" }}>
              {rotulo}
            </Texto>
            <Texto style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: T.ink }}>
              {valor}
            </Texto>
          </View>
        ))}
      </View>
    </View>
  );
}
