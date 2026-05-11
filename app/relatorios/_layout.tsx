// Layout publico das paginas de relatorio (acessadas via token JWT no email).
// Sem AuthGuard — bypass adicionado em app/_layout.tsx via segments[0]==='relatorios'.
import { Stack } from "expo-router";

export default function RelatoriosLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
