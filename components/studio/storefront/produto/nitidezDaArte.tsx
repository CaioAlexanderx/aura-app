// ============================================================
// components/studio/storefront/produto/nitidezDaArte.tsx
//
// A nitidez da imagem pelo tamanho que ela tem NA PEÇA (DPI efetivo) e o
// selo que a mostra (28/09/2026). Arquivo próprio para o cartão da arte
// (EnvioDaArte) e o editor (EditorDaArte) não se importarem em círculo.
// ============================================================
import { View } from "react-native";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero } from "../TipografiaVitrine";
import { wash } from "../theme";
import { dpiEfetivo, faixaDeNitidez, type ItemDaArte } from "@/components/studio/visualEngine/layoutDaArte";


export function nitidezDoItem(it: ItemDaArte | null, emCm: boolean): { dpi: number; faixa: "boa" | "aceitavel" | "ruim" } | null {
  if (!it || it.tipo !== "imagem" || !it.arquivo || !emCm) return null;
  const d = dpiEfetivo(it.arquivo.w, it.w);
  const f = faixaDeNitidez(d);
  return d != null && f ? { dpi: Math.round(d), faixa: f } : null;
}

export function SeloDeNitidez({ dpi, faixa }: { dpi: number; faixa: "boa" | "aceitavel" | "ruim" }) {
  const t = useTemaDaVitrine();
  const cor = faixa === "boa" ? t.green : faixa === "aceitavel" ? t.ink2 : t.amber;
  const rotulo = faixa === "boa" ? "Nítida" : faixa === "aceitavel" ? "Aceitável" : "Pode sair borrada";
  return (
    <View
      accessibilityLabel={`${rotulo}, ${dpi} pontos por polegada`}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: wash(cor, 0.12) }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor }} />
      <Texto style={{ fontSize: 12.5, fontWeight: "600", color: cor }}>
        {rotulo} · <Numero style={{ fontSize: 12.5, fontWeight: "600", color: cor }}>{dpi}</Numero> dpi
      </Texto>
    </View>
  );
}

