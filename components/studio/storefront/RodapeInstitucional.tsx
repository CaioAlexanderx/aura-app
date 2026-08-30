// ============================================================
// Vitrine Studio · rodapé institucional
//
// Como pagar, e o que acontece se a peça não servir. As duas coisas que
// todo e-commerce grande tem no rodapé — a loja comum ganhou em 24/08 e
// a vitrine tinha ficado sem.
//
// NÃO CALCULA NADA. As formas de pagamento e o texto da política chegam
// prontos em `store.rodape_institucional`, resolvidos em
// services/rodapeInstitucional.js no backend. Se esta tela remontasse a
// lista, um dia a loja comum diria "Pix · Cartão" e a vitrine só "Pix" —
// e ninguém perceberia, porque as duas nunca são olhadas juntas.
//
// A vitrine decide COMO desenhar; o backend decide O QUE dizer.
// ============================================================
import { View, Text, StyleSheet } from "react-native";

export type RodapeDaLoja = {
  formas?: string[];
  politica_titulo?: string;
  politica?: string;
};

export function RodapeInstitucional({
  rodape, corDoTexto, corFraca, corDaLinha,
}: {
  rodape?: RodapeDaLoja | null;
  corDoTexto: string;
  corFraca: string;
  corDaLinha: string;
}) {
  const formas = Array.isArray(rodape?.formas) ? rodape!.formas : [];
  const politica = typeof rodape?.politica === "string" ? rodape!.politica.trim() : "";

  // Base sem o campo (payload antigo em cache, ou backend anterior ao
  // PR #632) não desenha um bloco vazio com dois títulos soltos.
  if (!formas.length && !politica) return null;

  return (
    <View testID="rodape-institucional" style={[s.caixa, { borderTopColor: corDaLinha }]}>
      {formas.length > 0 && (
        <View style={s.bloco}>
          <Text style={[s.titulo, { color: corDoTexto }]}>Formas de pagamento</Text>
          {/* Junta com ' · ', igual à loja comum. Sem selo de bandeira:
              não temos as marcas, e desenhar um retângulo escrito "VISA"
              seria falsificar. */}
          <Text testID="rodape-formas" style={[s.texto, { color: corFraca }]}>
            {formas.join(" · ")}
          </Text>
        </View>
      )}

      {politica.length > 0 && (
        <View style={s.bloco}>
          <Text style={[s.titulo, { color: corDoTexto }]}>
            {rodape?.politica_titulo || "Trocas e devoluções"}
          </Text>
          <Text testID="rodape-politica" style={[s.texto, { color: corFraca }]}>
            {politica}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  caixa: {
    borderTopWidth: 1,
    paddingTop: 24,
    marginTop: 32,
    gap: 20,
  },
  bloco: { gap: 6 },
  titulo: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  texto: { fontSize: 13, lineHeight: 20 },
});
