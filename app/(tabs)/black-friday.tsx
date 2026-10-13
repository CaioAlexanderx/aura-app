// ============================================================
// Black Friday (13/10/2026) — rota /black-friday
//
// A página da temporada de fim de ano. O arquivo só monta o corpo
// (components/screens/blackfriday/PaginaBlackFriday) dentro do shell padrão
// do app e guarda a porta: fora do período (constants/blackFriday.ts) ou
// sem o módulo `black_friday` (permissão ou override) ou, por enquanto, sem
// ser conta de teste (BLACK_FRIDAY_LIBERADA_PARA_TODOS), volta para o Painel
// — quem digitou a URL de uma página que o menu não mostra não fica nela.
// ============================================================
import { useEffect } from "react";
import { ScrollView, StyleSheet, Dimensions } from "react-native";
import { router } from "expo-router";
import { PaginaBlackFriday } from "@/components/screens/blackfriday/PaginaBlackFriday";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { BLACK_FRIDAY_MOD } from "@/constants/blackFriday";
import { useBlackFridayLiberada } from "@/hooks/useBlackFridayLiberada";

const IS_WIDE = Dimensions.get("window").width > 768;

export default function BlackFridayScreen() {
  const visible = useVisibleModules();
  const liberada = useBlackFridayLiberada();
  const permitido = liberada && visible.has(BLACK_FRIDAY_MOD);

  useEffect(() => {
    if (!permitido) router.replace("/" as any);
  }, [permitido]);

  if (!permitido) return null;

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
