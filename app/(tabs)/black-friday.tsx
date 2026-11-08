// ============================================================
// Black Friday (13/10/2026) — rota /black-friday
//
// A página da temporada de fim de ano. O arquivo só monta o corpo
// (components/screens/blackfriday/PaginaBlackFriday) dentro do shell padrão
// do app e guarda a porta: fora do período (constants/blackFriday.ts) ou
// sem o módulo `black_friday` (permissão ou override) ou, por enquanto, sem
// ser conta de teste (BLACK_FRIDAY_LIBERADA_PARA_TODOS), volta para o Painel
// — quem digitou a URL de uma página que o menu não mostra não fica nela.
//
// 08/11/2026 (QA De/Por): recarregar /black-friday (ou abrir o link direto)
// derrubava o app em "Algo deu errado" — "Attempted to navigate before
// mounting the Root Layout component". No primeiro render a sessão ainda não
// hidratou (sem usuário, sem empresa), a porta dava "sem acesso" e o
// router.replace do efeito rodava antes do layout raiz montar. Agora a tela
// só decide com a sessão e as permissões carregadas (useVisibleModulesProntos)
// e manda embora com <Redirect>, que espera a navegação estar pronta. Sem
// sessão a tela fica vazia: o AuthGuard (app/_layout) leva ao login.
// ============================================================
import { ScrollView, StyleSheet, Dimensions } from "react-native";
import { Redirect } from "expo-router";
import { PaginaBlackFriday } from "@/components/screens/blackfriday/PaginaBlackFriday";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { BLACK_FRIDAY_MOD } from "@/constants/blackFriday";
import { useBlackFridayLiberada } from "@/hooks/useBlackFridayLiberada";

const IS_WIDE = Dimensions.get("window").width > 768;

export default function BlackFridayScreen() {
  const visible = useVisibleModules();
  const pronto = useVisibleModulesProntos();
  const liberada = useBlackFridayLiberada();
  const permitido = liberada && visible.has(BLACK_FRIDAY_MOD);

  if (!pronto) return null;
  if (!permitido) return <Redirect href={"/" as any} />;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <PaginaBlackFriday />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 1100, alignSelf: "center", width: "100%" },
});
