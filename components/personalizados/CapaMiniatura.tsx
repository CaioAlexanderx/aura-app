// ============================================================
// AURA. — Personalizados: miniatura da peça no cartão da Fila
//
// A cascata de capa que o Studio já usa (capaDoCartao): mockup da aprovação →
// render → prévia da personalização da cliente → foto do catálogo →
// monograma. Aqui em 48 px, no canto do cartão.
// ============================================================
import { useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import type { StudioPalette } from "@/constants/studio-tokens";
import type { StudioOrder } from "@/services/studioApi";
import { capaDoCartao } from "@/components/studio/capaDoCartao";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";

export const TAMANHO_DA_MINIATURA = 48;

/** A letra do monograma: a 1ª letra ou número do nome; "?" quando não há nome. */
export function inicialDoNome(nome: string | null | undefined): string {
  const m = String(nome || "").trim().match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : "?";
}

export function CapaMiniatura({ o, nome, t }: { o: StudioOrder; nome: string; t: StudioPalette }) {
  const [falhou, setFalhou] = useState(false);
  const base = capaDoCartao(o);
  const capa = falhou && (base.tipo === "arte" || base.tipo === "foto") ? ({ tipo: "monograma" } as const) : base;
  const caixa = {
    width: TAMANHO_DA_MINIATURA, height: TAMANHO_DA_MINIATURA, borderRadius: 8, overflow: "hidden" as const,
    backgroundColor: t.primaryGhost, borderWidth: 1, borderColor: t.ink5, alignItems: "center" as const, justifyContent: "center" as const,
  };
  return (
    <View style={caixa} testID={`producao-capa-${o.id}`} accessibilityLabel={`Peça do pedido de ${nome}`}>
      {capa.tipo === "arte" || capa.tipo === "foto" ? (
        <Image
          source={{ uri: capa.url }}
          style={st.imagem}
          resizeMode="cover"
          onError={() => setFalhou(true)}
          // Imagem que "carrega" sem tamanho (URL vencida, resposta vazia) é miniatura em branco.
          onLoad={(ev: any) => {
            const src = ev?.nativeEvent?.source || ev?.nativeEvent || {};
            if (src.width === 0 || src.height === 0) setFalhou(true);
          }}
          testID={`producao-capa-imagem-${o.id}`}
        />
      ) : capa.tipo === "previa" ? (
        <PersonalizationPreview config={capa.config} values={capa.values} side={capa.side} size={TAMANHO_DA_MINIATURA} showLabel={false} />
      ) : (
        <Text style={[st.inicial, { color: t.accentInk }]} testID={`producao-capa-monograma-${o.id}`}>{inicialDoNome(nome)}</Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  imagem: { width: "100%", height: "100%" },
  inicial: { fontSize: 18, fontWeight: "800" },
});

export default CapaMiniatura;
