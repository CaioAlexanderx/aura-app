// Estilos comuns das telas da conferência de estoque (p-108). Cores do tema
// do app (Colors troca com claro/escuro); nada de hover: todo controle é um
// toque, e cabe em 375 px (sem largura fixa maior que a tela).
import { Platform, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";

/**
 * Fundo da pilha da conferência (app/(tabs)/conferencia-estoque/_layout.tsx):
 * o mesmo do resto do app, nos dois temas. Na web, transparente — aparece o
 * fundo das abas (Colors.bg com o degradê); no app nativo, Colors.bg, que é
 * o que a casca das abas pinta. Nunca o cinza padrão do React Navigation.
 */
export function fundoDaPilhaDaConferencia(): string {
  return Platform.OS === "web" ? "transparent" : Colors.bg;
}

export const ce = StyleSheet.create({
  tela: { flex: 1, backgroundColor: "transparent" },
  conteudo: { padding: 16, paddingBottom: 56, width: "100%", maxWidth: 760, alignSelf: "center", gap: 12 },
  titulo: { fontSize: 24, fontWeight: "800", color: Colors.ink, letterSpacing: -0.4 },
  sub: { fontSize: 13.5, color: Colors.ink3, lineHeight: 20 },
  card: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    padding: 14, gap: 10, minWidth: 0,
  },
  cardTitulo: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  rotulo: { fontSize: 11, fontWeight: "700", color: Colors.ink3, letterSpacing: 0.8, textTransform: "uppercase" },
  nota: { fontSize: 12.5, color: Colors.ink3, lineHeight: 18 },
  linha: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  espaco: { flex: 1, minWidth: 0 },
  btn: {
    backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    alignItems: "center", justifyContent: "center", minHeight: 44,
  },
  btnTexto: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnFantasma: {
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", minHeight: 40,
  },
  btnFantasmaTexto: { color: Colors.violet3, fontWeight: "700", fontSize: 13.5 },
  btnPequeno: { paddingVertical: 7, paddingHorizontal: 11, minHeight: 34, borderRadius: 10 },
  desligado: { opacity: 0.45 },
  chip: {
    borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bg4,
  },
  chipTexto: { fontSize: 12, fontWeight: "600", color: Colors.ink3 },
  chipVerde: { backgroundColor: Colors.greenD, borderColor: "transparent" },
  chipVerdeTexto: { color: Colors.green },
  chipAmbar: { backgroundColor: Colors.amberD, borderColor: "transparent" },
  chipAmbarTexto: { color: Colors.amber },
  aviso: { backgroundColor: Colors.amberD, borderRadius: 12, padding: 12, gap: 8 },
  avisoTexto: { fontSize: 13, color: Colors.ink, lineHeight: 19 },
  erroTexto: { fontSize: 13, color: Colors.red, lineHeight: 19 },
  input: {
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, color: Colors.ink,
    borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, fontSize: 16, minWidth: 0,
  },
});
