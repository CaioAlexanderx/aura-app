// ============================================================
// AURA. — "Baixar modelo": planilha modelo de produtos (tq-36)
//
// O arquivo é estático, public/modelo-produtos-aura.xlsx (gerado por
// scripts/gerar-modelo-produtos.js), e aparece em três lugares: no convite
// "Importar sua planilha" do check-in, na conferência da importação e no
// menu Importar do Estoque. Nada disso toca na importação em si.
//
//   · Web: o botão é um <a href download> de verdade (o Pressable do
//     react-native-web vira <a> quando tem href). O download é do
//     navegador, sem JavaScript no meio — não depende de estado nenhum.
//   · Nativo: abre a mesma URL pelo Linking, como o resto do app faz com
//     arquivo e link externo.
//   · Baixar NÃO encerra nada: o convite, a conferência e o menu seguem
//     como estavam (o `onBaixar` é só para quem quiser reagir).
// ============================================================
import { Linking, Platform, Pressable, StyleSheet, Text } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

export const MODELO_PRODUTOS = {
  arquivo: "modelo-produtos-aura.xlsx",
  caminho: "/modelo-produtos-aura.xlsx",
  // O nativo não tem origem relativa.
  url: "https://app.getaura.com.br/modelo-produtos-aura.xlsx",
} as const;

export const TEXTO_BAIXAR_MODELO = "Baixar modelo";

/** Props que transformam um Pressable em "baixar o modelo". */
export function propsDoModelo(onBaixar?: () => void): Record<string, unknown> {
  if (Platform.OS === "web") {
    return {
      href: MODELO_PRODUTOS.caminho,
      hrefAttrs: { download: MODELO_PRODUTOS.arquivo, rel: "noopener" },
      accessibilityRole: "link",
      onPress: onBaixar,
    };
  }
  return {
    accessibilityRole: "button",
    onPress: () => {
      onBaixar?.();
      Linking.openURL(MODELO_PRODUTOS.url).catch(() => {});
    },
  };
}

type Props = {
  testID: string;
  /** "botao": contorno violeta (convite). "link": texto sublinhado (conferência). */
  estilo?: "botao" | "link";
  onBaixar?: () => void;
};

export function BaixarModelo({ testID, estilo = "botao", onBaixar }: Props) {
  const link = estilo === "link";
  return (
    <Pressable
      {...(propsDoModelo(onBaixar) as any)}
      accessibilityLabel="Baixar a planilha modelo de produtos"
      style={link ? s.link : s.botao}
      testID={testID}
    >
      <Icon name="download" size={link ? 13 : 14} color={Colors.violet3} />
      <Text style={link ? s.linkTxt : s.botaoTxt}>{TEXTO_BAIXAR_MODELO}</Text>
    </Pressable>
  );
}

// Sem hover: o estado é permanente (CLAUDE.md, armadilha 7).
const s = StyleSheet.create({
  botao: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36,
    borderWidth: 1, borderColor: Colors.violet3,
  },
  botaoTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  link: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6, minHeight: 32 },
  linkTxt: { fontSize: 12.5, color: Colors.violet3, fontWeight: "600", textDecorationLine: "underline" },
});

export default BaixarModelo;
