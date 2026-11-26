// ============================================================
// AURA. — Vendas › aba Condicionais (C4, 25/11/2026)
//
// Só o contêiner da aba, com o estado "Vazio, primeira vez" do mockup
// aprovado (condicional/mockup.html, tela 1), texto idêntico. A lista, o
// totalizador, os filtros, o erro, o consolidado, o ícone de cabide e o
// botão "Nova condicional" entram no C5 (o botão só quando o fluxo do C6
// existir, para não haver botão que não faz nada).
//
// Quem decide se a aba existe é useAbaCondicionais (trava + módulo).
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

export const TEXTOS_DAS_CONDICIONAIS = {
  aba: "Condicionais",
  subtitulo: "Peças que as clientes levaram para experimentar. Nada é cobrado até ela decidir.",
  vazioTitulo: "Nenhuma condicional por aqui",
  vazioTexto: "Quando uma cliente quiser levar peças para experimentar em casa, registre aqui. A loja sabe o que saiu, com quem está e até quando volta.",
};

export function AbaCondicionais() {
  return (
    <View testID="aba-condicionais" style={s.vazio}>
      <Text style={s.titulo}>{TEXTOS_DAS_CONDICIONAIS.vazioTitulo}</Text>
      <Text style={s.texto}>{TEXTOS_DAS_CONDICIONAIS.vazioTexto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  // Mockup: .empty{padding:44px 24px;text-align:center;gap:10px}, card com borda.
  vazio: {
    alignItems: "center", gap: 10, paddingVertical: 44, paddingHorizontal: 24,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg3,
  },
  titulo: { fontSize: 18, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  texto: { fontSize: 13.5, lineHeight: 20, color: Colors.ink2, textAlign: "center", maxWidth: 460 },
});

export default AbaCondicionais;
