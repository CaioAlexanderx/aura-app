// ============================================================
// components/studio/storefront/ui/CorDaLinha.tsx
//
// "● Cor: preto" — a cor da peça de uma linha da sacola, com a bolinha.
//
// QA 28/09 (CL-34/CL-33): a polo comprada em preto aparecia no aviso
// "Adicionado à sacola", na sacola e no resumo do checkout só como "Sua
// foto · Texto: HELENA". O mockup na foto mostra a peça na cor
// fotografada (branca), então a cliente não tinha onde conferir a cor
// que escolheu. A regra (nome e hex) é resumoDaPeca.corDaPecaDaLinha;
// aqui só o desenho, igual nos três lugares.
// ============================================================
import { View } from "react-native";
import type { CartLine } from "../types";
import { Texto } from "../TipografiaVitrine";
import { corDaPecaDaLinha } from "../resumoDaPeca";

export function CorDaLinha({
  line, cor, tamanho = 12.5, borda, testID = "cor-da-linha",
}: {
  line: Pick<CartLine, "product" | "values">;
  /** A cor do texto (a mesma do resumo em volta). */
  cor: string;
  tamanho?: number;
  /** O contorno da bolinha: separa o branco do fundo claro. */
  borda: string;
  testID?: string;
}) {
  const c = corDaPecaDaLinha(line);
  if (!c) return null;
  const lado = Math.round(tamanho * 0.8);
  return (
    <View testID={testID} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {c.hex ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ width: lado, height: lado, borderRadius: lado / 2, backgroundColor: c.hex, borderWidth: 1, borderColor: borda }}
        />
      ) : null}
      <Texto numberOfLines={1} style={{ fontSize: tamanho, color: cor, flexShrink: 1 }}>
        {c.rotulo}: {c.nome}
      </Texto>
    </View>
  );
}
