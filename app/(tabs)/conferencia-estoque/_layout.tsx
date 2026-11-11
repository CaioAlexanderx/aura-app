// ============================================================
// Conferência de estoque (p-108) — pilha própria da pasta, para as telas
// novas não mexerem no layout das abas. As quatro rotas ficam declaradas
// aqui desde já (entrega B: index e [id]/index; entrega C: [id]/diferencas
// e historico), assim a entrega C não precisa tocar neste arquivo.
// ============================================================
import { Stack } from "expo-router";

export default function ConferenciaEstoqueLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/diferencas" />
      <Stack.Screen name="historico" />
    </Stack>
  );
}
