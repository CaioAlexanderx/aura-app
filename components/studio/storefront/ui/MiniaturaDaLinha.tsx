// ============================================================
// components/studio/storefront/ui/MiniaturaDaLinha.tsx
//
// A miniatura de uma linha da sacola: a ARTE da cliente na peça, não a
// foto de catálogo (Fase 2, Tela 1 — "é a arte dele que está ali").
//
// Mesma decisão que CartItemList (Cart.tsx) já tomava: com foto ou com
// personalização desenhável, o LivePreview com os `values` da linha; sem
// nenhum dos dois (gravação opcional deixada em branco), a capa composta,
// como na prateleira — a área de impressão vazia não diz qual peça é.
// ============================================================
import { View } from "react-native";
import type { CartLine } from "../types";
import { LivePreview } from "../LivePreview";
import { CapaProduto } from "../CapaProduto";
import { temPersonalizacaoVisivel } from "@/components/studio/customizationConfig";
import { usePaletaDaVitrine } from "../TemaDaVitrine";
import { useTipografia, Numero } from "../TipografiaVitrine";

export function MiniaturaDaLinha({
  line, tamanho, corDaLoja, quantidade,
}: {
  line: Pick<CartLine, "product" | "values">;
  tamanho: number;
  corDaLoja?: string | null;
  /** Mostra a contagem num selo no canto (resumo do checkout). */
  quantidade?: number;
}) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  const p: any = line.product;
  const desenho = p.image_url || temPersonalizacaoVisivel(p.customization_config, line.values) ? (
    <LivePreview
      config={p.customization_config}
      values={line.values}
      size={tamanho}
      productName={p.name}
      showLabel={false}
      fotoProduto={p.image_url}
    />
  ) : (
    <CapaProduto nome={p.name} tamanho={tamanho} corDaLoja={corDaLoja} fonteDisplay={tipo.display} />
  );
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.16),
        overflow: "visible", backgroundColor: T.bg,
        borderWidth: 1, borderColor: T.border,
      }}
    >
      <View style={{ width: "100%", height: "100%", borderRadius: Math.round(tamanho * 0.16), overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        {desenho}
      </View>
      {quantidade != null ? (
        <View
          style={{
            position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10,
            paddingHorizontal: 5, backgroundColor: T.ink, alignItems: "center", justifyContent: "center",
          }}
        >
          <Numero style={{ color: T.bg, fontSize: 10.5, fontWeight: "700" }}>{quantidade}</Numero>
        </View>
      ) : null}
    </View>
  );
}
