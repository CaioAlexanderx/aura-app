// ============================================================
// Vitrine Studio · a grade de modelos de um grupo
//
// Tocar em "Canecas · 9 modelos" abria direto o PRIMEIRO modelo, e os
// outros oito viravam chips de 104px sem foto. Agora abre aqui: os nove,
// com foto, preço e o que muda de um para o outro.
//
// A tela não decide nada — a ordem, o eixo que varia e o resumo saem de
// modelosDoGrupo.ts, que tem teste.
// ============================================================
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { usePaletaDaVitrine } from "./TemaDaVitrine";
import { useTipografia, Texto } from "./TipografiaVitrine";
import { ProductCard } from "./ProductCard";
import { fotosDoProduto } from "./CarrosselFoto";
import { chipsDoProduto } from "./selosDoProduto";
import {
  modelosOrdenados, eixoQueVaria, faixaDePrecos, resumoDoGrupo,
} from "./modelosDoGrupo";
import type { StudioStoreProduct, StoreCategory } from "./types";

const COLUNA_MAX = 1040;
const GAP = 14;

function dinheiro(v: number): string {
  return "R$ " + v.toFixed(2).replace(".", ",");
}

export function GradeDeModelos({
  categoria,
  produtos,
  corDaLoja,
  estiloCartao,
  onEscolher,
  onVoltar,
}: {
  categoria: StoreCategory | null;
  produtos: StudioStoreProduct[];
  corDaLoja: string;
  estiloCartao?: string;
  onEscolher: (p: StudioStoreProduct) => void;
  onVoltar: () => void;
}) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  const { width } = useWindowDimensions();

  const modelos = modelosOrdenados(produtos);
  const eixo = eixoQueVaria(modelos);
  const faixa = faixaDePrecos(modelos);

  const larguraUtil = Math.min(width, COLUNA_MAX) - 32;
  // Dois no celular já basta para comparar; a partir de 700 cabem três.
  const colunas = larguraUtil >= 940 ? 4 : larguraUtil >= 700 ? 3 : 2;
  const larguraCartao = Math.floor((larguraUtil - GAP * (colunas - 1)) / colunas);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={s.rolo}>
        <View style={s.coluna}>
          <Pressable
            onPress={onVoltar}
            accessibilityRole="button"
            accessibilityLabel="Voltar para a loja"
            style={s.voltar}
          >
            <Text style={[s.voltarTxt, { color: T.ink3 }]}>← Voltar para a loja</Text>
          </Pressable>

          <Texto style={[s.titulo, { color: T.ink, fontFamily: tipo.display }]}>
            {categoria?.name || "Modelos"}
          </Texto>

          <Text style={[s.resumo, { color: T.ink3 }]}>{resumoDoGrupo(modelos)}</Text>

          {faixa ? (
            <Text style={[s.faixa, { color: T.ink2 }]}>
              De {dinheiro(faixa.min)} a {dinheiro(faixa.max)}
            </Text>
          ) : null}

          {/* A frase muda com o que de fato varia entre estes modelos —
              gritar preço quando todos custam igual seria ruído. */}
          <Text style={[s.dica, { color: T.ink3 }]}>
            {eixo === "preco"
              ? "Cada modelo tem um preço. Toque para ver a peça de perto."
              : eixo === "cor"
              ? "Mesmo preço; o que muda é a cor disponível em cada um."
              : "Mesmo preço; o que muda é o acabamento da peça."}
          </Text>

          <View style={s.grade}>
            {modelos.map((m) => (
              <ProductCard
                key={m.produto.id}
                nome={m.produto.name}
                preco={m.preco}
                fotos={fotosDoProduto((m.produto as any).gallery_urls, m.produto.image_url)}
                descricao={m.produto.description}
                largura={larguraCartao}
                corDaLoja={corDaLoja}
                fonteDisplay={tipo.display}
                estilo={estiloCartao as any}
                chips={chipsDoProduto(m.produto)}
                onPress={() => onEscolher(m.produto)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  rolo: { paddingBottom: 60 },
  coluna: { width: "100%", maxWidth: COLUNA_MAX, alignSelf: "center", paddingHorizontal: 16, paddingTop: 12 },
  // 44px de alvo: no celular é a única saída desta tela.
  voltar: { paddingVertical: 12, alignSelf: "flex-start" },
  voltarTxt: { fontSize: 14 },
  titulo: { fontSize: 30, fontWeight: "600", marginTop: 4, letterSpacing: -0.4 },
  resumo: { fontSize: 13.5, marginTop: 6 },
  faixa: { fontSize: 15, marginTop: 10, fontWeight: "600" },
  dica: { fontSize: 13.5, marginTop: 8, marginBottom: 20, maxWidth: 460 },
  grade: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
});
