// ============================================================
// Vitrine Studio · o rodapé inteiro
//
// Três colunas — quem é a loja, como ela atende, por onde navegar — e
// embaixo o jurídico com a assinatura da Aura UMA vez. É o mesmo rodapé
// que a loja comum ganhou em 09/2026; a vitrine terminava a página no
// último produto.
//
// NÃO DECIDE NADA. O que aparece sai de conteudoDoRodape.ts; o texto
// institucional chega pronto do backend (services/rodapeInstitucional.js,
// um módulo só para as duas lojas). Aqui só se desenha.
//
// No celular as colunas viram uma pilha: três colunas de 33% num
// telefone dariam três textos espremidos e ilegíveis.
// ============================================================
import { View, Text, Image, Pressable, Linking, StyleSheet, useWindowDimensions } from "react-native";
import { usePaletaDaVitrine } from "./TemaDaVitrine";
import { montarConteudoDoRodape } from "./conteudoDoRodape";
import { RodapeInstitucional } from "./RodapeInstitucional";
import type { PortaDoRodape } from "./conteudoDoRodape";

/** A partir daqui cabem as três colunas lado a lado. */
const LARGURA_DE_TRES_COLUNAS = 760;

function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return <Text style={[s.etiqueta, { color: cor }]}>{texto}</Text>;
}

export function RodapeDaVitrine({
  store,
  onAbrirCategoria,
}: {
  store: any;
  onAbrirCategoria?: (porta: PortaDoRodape) => void;
}) {
  const T = usePaletaDaVitrine();
  const { width } = useWindowDimensions();
  const emColunas = width >= LARGURA_DE_TRES_COLUNAS;

  const r = montarConteudoDoRodape(store);
  if (!r.temAlgo) return null;

  const { identidade } = r;
  const enderecoEHorario = [identidade.endereco, identidade.horario]
    .filter(Boolean)
    .join("\n");

  return (
    <View testID="rodape-da-vitrine" style={[s.caixa, { borderTopColor: T.border }]}>
      <View style={[s.colunas, emColunas ? s.colunasLado : s.colunasPilha]}>
        {/* 1 · Quem é a loja */}
        <View style={[s.coluna, emColunas && s.colunaIdentidade]}>
          {identidade.logoUrl ? (
            <Image
              source={{ uri: identidade.logoUrl }}
              style={s.logo}
              resizeMode="contain"
              accessibilityLabel={identidade.nome}
            />
          ) : (
            <Text testID="rodape-nome" style={[s.nome, { color: T.ink }]}>
              {identidade.nome}
            </Text>
          )}

          {enderecoEHorario ? (
            <Text testID="rodape-endereco" style={[s.corpo, { color: T.ink3 }]}>
              {enderecoEHorario}
            </Text>
          ) : null}

          {identidade.redes.length > 0 ? (
            <View testID="rodape-redes" style={s.redes}>
              {identidade.redes.map((rede) => (
                <Pressable
                  key={rede.rede + rede.url}
                  onPress={() => Linking.openURL(rede.url)}
                  accessibilityRole="link"
                  accessibilityLabel={`${rede.nome}${rede.handle ? " " + rede.handle : ""}`}
                  style={({ hovered }: any) => [
                    s.rede,
                    { borderColor: T.border, backgroundColor: T.card },
                    hovered && { borderColor: T.primary },
                  ]}
                >
                  <Text style={[s.redeTexto, { color: T.ink2 }]}>{rede.nome}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* 2 · Como ela atende — texto do backend, desenho daqui */}
        <View style={[s.coluna, emColunas && s.colunaMeio]}>
          <RodapeInstitucional
            rodape={store?.rodape_institucional}
            corDoTexto={T.ink}
            corFraca={T.ink3}
            corDaLinha="transparent"
            compacto
          />
        </View>

        {/* 3 · Por onde navegar */}
        {r.navegacao.length > 0 ? (
          <View testID="rodape-navegacao" style={[s.coluna, emColunas && s.colunaNav]}>
            <Etiqueta texto="Navegue" cor={T.ink3} />
            {r.navegacao.map((porta) => (
              <Pressable
                key={porta.id}
                onPress={() => onAbrirCategoria?.(porta)}
                accessibilityRole="link"
                accessibilityLabel={porta.nome}
                style={({ hovered }: any) => [s.porta, hovered && { opacity: 0.6 }]}
              >
                <Text style={[s.portaTexto, { color: T.ink2 }]}>{porta.nome}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Jurídico e assinatura. A Aura aparece UMA vez, na mesma
          frase-link, com o selo ao lado — igual à loja comum. */}
      <View style={[s.baixo, { borderTopColor: T.border }, emColunas ? s.baixoLado : s.baixoPilha]}>
        <Text testID="rodape-legal" style={[s.legal, { color: T.ink4 }]}>
          {r.linhaLegal}
        </Text>
        <View style={s.assinatura}>
          <Pressable
            onPress={() => Linking.openURL("https://getaura.com.br")}
            accessibilityRole="link"
            accessibilityLabel="Loja desenvolvida com Aura — quero a minha"
          >
            <Text style={[s.legal, { color: T.ink4 }]}>
              Loja desenvolvida com{" "}
              <Text style={{ fontWeight: "700", color: T.ink3 }}>Aura.</Text>
              <Text style={{ color: T.ink4 }}> — quero a minha</Text>
            </Text>
          </Pressable>
          <View style={[s.selo, { borderColor: T.border }]}>
            <Text style={[s.seloTexto, { color: T.ink4 }]}>✓ Loja verificada Aura</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  caixa: { borderTopWidth: 1, marginTop: 40, paddingTop: 32, paddingHorizontal: 20, paddingBottom: 28 },
  colunas: { width: "100%", maxWidth: 960, alignSelf: "center" },
  colunasLado: { flexDirection: "row", gap: 48, alignItems: "flex-start" },
  colunasPilha: { flexDirection: "column", gap: 28 },
  coluna: { minWidth: 0 },
  colunaIdentidade: { flex: 1.4 },
  colunaMeio: { flex: 1.4 },
  colunaNav: { flex: 1 },

  logo: { width: 132, height: 44, marginBottom: 10, alignSelf: "flex-start" },
  nome: { fontSize: 21, fontWeight: "600", marginBottom: 8 },
  corpo: { fontSize: 13, lineHeight: 20 },

  redes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  rede: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  redeTexto: { fontSize: 12.5, fontWeight: "600" },

  etiqueta: { fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, fontWeight: "600" },
  // 44px de alvo: no celular estas são as únicas portas do rodapé.
  porta: { paddingVertical: 11, justifyContent: "center" },
  portaTexto: { fontSize: 14 },

  baixo: {
    width: "100%", maxWidth: 960, alignSelf: "center",
    borderTopWidth: 1, marginTop: 28, paddingTop: 18, gap: 12,
  },
  baixoLado: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  baixoPilha: { flexDirection: "column", alignItems: "flex-start" },
  legal: { fontSize: 12 },
  assinatura: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  selo: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  seloTexto: { fontSize: 10.5, letterSpacing: 0.2 },
});
