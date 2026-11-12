// ============================================================
// Conferência de estoque (p-108) — pilha própria da pasta, para as telas
// novas não mexerem no layout das abas. As quatro rotas ficam declaradas
// aqui desde já (entrega B: index e [id]/index; entrega C: [id]/diferencas
// e historico), assim a entrega C não precisa tocar neste arquivo.
//
// Fundo (QA 11/11): cada tela da pilha fica num contêiner absoluto pintado
// com o `colors.background` do tema do React Navigation — o padrão é
// rgb(242,242,242), cinza claro. O `contentStyle` só pinta a View de dentro,
// então as telas com raiz transparente (começar e contar) ficavam cinza, com
// o título claro quase sumindo; diferenças e histórico só escapavam porque
// a raiz delas pintava Colors.bg por cima. A correção é na pilha: o tema
// desta pilha usa o fundo do app. Na web, transparente (aparece o fundo das
// abas, com o mesmo degradê do resto do app); no app nativo, Colors.bg, que
// é o que a casca das abas pinta. Colors troca com o tema claro/escuro.
// ============================================================
import { useMemo } from "react";
import { Stack } from "expo-router";
import { ThemeProvider, useTheme } from "@react-navigation/native";
import { fundoDaPilhaDaConferencia } from "@/components/screens/conferencia/estilos";

export default function ConferenciaEstoqueLayout() {
  const tema = useTheme();
  const fundo = fundoDaPilhaDaConferencia();
  const temaDaPilha = useMemo(
    () => ({ ...tema, colors: { ...tema.colors, background: fundo } }),
    [tema, fundo],
  );
  return (
    <ThemeProvider value={temaDaPilha}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: fundo } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]/index" />
        <Stack.Screen name="[id]/diferencas" />
        <Stack.Screen name="historico" />
        <Stack.Screen name="custos" />
      </Stack>
    </ThemeProvider>
  );
}
