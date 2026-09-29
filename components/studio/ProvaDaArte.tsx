// ============================================================
// AURA STUDIO · ProvaDaArte — a arte do pedido medida, e o arquivo de
// impressão (28/09/2026)
//
// Na ficha de produção: por lado com arte, onde cada coisa cai na área
// (em cm, a partir do canto superior esquerdo), o DPI efetivo da imagem
// e o botão "Baixar PNG de impressão" — só a área, 300 dpi, fundo
// transparente, pelo mesmo desenho que a cliente viu. Vale também para
// pedido sem ajuste: o layout padrão é medido do mesmo jeito.
//
// Papel é branco: sem tema escuro (a ficha é para imprimir). O botão
// não sai na impressão (nativeID ficha-nao-imprime).
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet, Image } from "react-native";
import type { CustomizationConfig } from "@/services/studioApi";
import { arteDoLado } from "@/components/studio/storefront/valoresDoMotor";
import { medidorDaVitrine, pixelsConhecidos, useVersaoDasMedidas } from "@/components/studio/storefront/produto/medidasDaArte";
import { resolverArte, type ArteDoLado } from "@/components/studio/visualEngine/layoutDaArte";
import { gerarPngDeImpressao, medidasDosItens, pixelsDaArea } from "@/components/studio/visualEngine/pngDeImpressao";
import { textoDoAjuste } from "@/components/studio/customizationConfig";
import { salvarBlob } from "@/utils/salvarArquivo";
import { toast } from "@/components/Toast";

const TINTA = "#151515";
const TINTA2 = "#4A4A4A";
const TINTA3 = "#7A7A7A";

const NOME_DO_LADO = { front: "Frente", back: "Verso", middle: "Meio" } as const;

export function ProvaDaArte({
  config, valores, lados, numero, rotulos,
}: {
  config: CustomizationConfig | null;
  valores: Record<string, any>;
  lados: Array<"front" | "back" | "middle">;
  /** Número do pedido, para o nome do arquivo. */
  numero: string;
  rotulos: Record<string, string>;
}) {
  useVersaoDasMedidas();
  const [gerando, setGerando] = useState<string | null>(null);
  if (!config || Platform.OS !== "web") return null;

  // Posição livre do orçamento (29/09/2026): a arte foi para fora da área
  // de impressão, e a medida em cm da área não a representa. A oficina vê
  // a prévia da peça, guardada no pedido.
  const livres = lados.filter((l) => valores?.orcamento_ajustes?.[l]?.livre === true);
  const porLado = lados
    .filter((l) => !livres.includes(l))
    .map((l) => ({ lado: l, arte: arteDoLado(config, valores, l, { arquivo: pixelsConhecidos }) }))
    .filter((x) => x.arte.areaCm && (x.arte.imagens.length || x.arte.textos.length));
  if (!porLado.length && !livres.length) return null;

  async function baixar(lado: "front" | "back" | "middle", arte: ArteDoLado) {
    setGerando(lado);
    try {
      const r = await gerarPngDeImpressao(arte);
      if (!r) { toast.error("Não deu para gerar o arquivo (imagem sem acesso?). Baixe a arte original."); return; }
      const nome = `${numero || "pedido"} - ${NOME_DO_LADO[lado]}.png`.replace(/[\\/:*?"<>|]+/g, "");
      await salvarBlob(r.blob, nome);
    } finally {
      setGerando(null);
    }
  }

  return (
    <View style={s.caixa}>
      {livres.map((lado) => {
        const previa = typeof valores["orcamento_previa_" + lado] === "string" ? valores["orcamento_previa_" + lado] : null;
        return (
          <View key={lado} style={s.lado} testID={"prova-livre-" + lado}>
            <Text style={s.titulo}>{NOME_DO_LADO[lado]} · posição livre, veja a prévia</Text>
            {previa ? (
              <Image source={{ uri: previa }} style={s.previa} resizeMode="contain" accessibilityLabel={`Prévia da arte livre — ${NOME_DO_LADO[lado]}`} />
            ) : (
              <Text style={s.linha}>A arte foi posicionada livre na peça no orçamento. Confira a prévia do orçamento antes de imprimir.</Text>
            )}
          </View>
        );
      })}
      {porLado.map(({ lado, arte }) => {
        const cm = arte.areaCm!;
        const itens = resolverArte(arte, cm.w, cm.h, medidorDaVitrine(pixelsConhecidos));
        const medidas = medidasDosItens(itens, cm);
        const px = pixelsDaArea(cm);
        const f = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
        return (
          <View key={lado} style={s.lado} testID={"prova-" + lado}>
            <Text style={s.titulo}>{NOME_DO_LADO[lado]} · área {f(cm.w)} × {f(cm.h)} cm · {arte.tecnica === "sublimacao" ? "sublimação" : arte.tecnica === "dtf" ? "DTF" : "técnica livre"}</Text>
            {medidas.map((m) => (
              <Text key={m.campo} style={s.linha}>
                <Text style={s.rotulo}>{rotulos[m.campo] || (m.tipo === "imagem" ? "Imagem" : "Texto")}: </Text>
                {textoDoAjuste(m.ajuste)}
              </Text>
            ))}
            <Pressable
              nativeID="ficha-nao-imprime"
              onPress={() => baixar(lado, arte)}
              style={s.botao}
              accessibilityRole="button"
              testID={"png-de-impressao-" + lado}
            >
              <Text style={s.botaoTxt}>
                {gerando === lado ? "Gerando…" : `Baixar PNG de impressão (${px.w} × ${px.h} px, ${px.dpi} dpi, fundo transparente)`}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { gap: 10, marginTop: 8 },
  lado: { gap: 4 },
  titulo: { fontSize: 12, fontWeight: "700", color: TINTA, letterSpacing: 0.3 },
  linha: { fontSize: 12, color: TINTA2, lineHeight: 17 },
  rotulo: { color: TINTA3 },
  botao: { alignSelf: "flex-start", borderWidth: 1, borderColor: TINTA, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10, marginTop: 4 },
  botaoTxt: { fontSize: 12, color: TINTA, fontWeight: "600" },
  previa: { width: 260, height: 200, borderWidth: 1, borderColor: "#DDDDDD", borderRadius: 6, backgroundColor: "#FAFAFA" },
});
