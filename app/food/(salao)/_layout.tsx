import { Redirect } from "expo-router";
import { FoodShell } from "@/components/food/FoodShell";
import { useAuthStore } from "@/stores/auth";

// ============================================================
// Layout da experiencia Aura Food autenticada.
//
// Substitui (tabs)/_layout para o usuario com vertical=food.
// AuthGuard em app/_layout.tsx redireciona /(tabs) para ca
// quando company.vertical_active === "food".
//
// Hard guard: alguem sem vertical=food que tente acessar
// /food/(salao)/* direto pela URL eh redirecionado pra /(tabs).
// Evita renderizar shell food + tentar carregar dados food pra
// empresa que nao tem a vertical ativa.
//
// Aguardamos isHydrated antes de decidir: sem isso, o primeiro
// render (com company=null vindo do storage async) jogaria todo
// mundo pra /(tabs) antes do auth terminar de carregar.
// ============================================================

export default function FoodSalaoLayout() {
  const { company, isHydrated } = useAuthStore();

  if (!isHydrated) return null;

  if ((company as any)?.vertical_active !== "food") {
    return <Redirect href="/(tabs)" />;
  }

  return <FoodShell />;
}
