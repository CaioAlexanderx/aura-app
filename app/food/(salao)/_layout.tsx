import { Redirect } from "expo-router";
import { View, Text } from "react-native";
import { FoodShell } from "@/components/food/FoodShell";
import { EmptyState } from "@/components/EmptyState";
import { FoodColors } from "@/constants/food-tokens";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";

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
//
// 2026-05-21 (F5 do polish pre-Fase 7): segundo gate verifica
// pdv_settings.food_mode_enabled. Empresas com vertical=food mas
// que ainda nao ligaram o modo restaurante (toggle em
// Configuracoes > PDV) recebem EmptyState. is_staff bypassa o gate
// pra poder configurar.
// ============================================================

export default function FoodSalaoLayout() {
  const { company, isHydrated, user } = useAuthStore();
  const { settings, isLoading: pdvLoading } = usePdvSettings();

  if (!isHydrated) return null;

  if ((company as any)?.vertical_active !== "food") {
    return <Redirect href="/(tabs)" />;
  }

  // F5: gate food_mode_enabled. Defensivo — se settings ainda esta
  // carregando, libera (FoodShell renderiza normal e os filhos lidam
  // com seus próprios loaders). Se backend nao retornar o campo
  // (migration 118 nao aplicada), tambem libera — a Fase 0 do food
  // exige a migration mas a sidebar precisa funcionar mesmo durante
  // a janela de deploy.
  const foodModeOff =
    !pdvLoading &&
    settings &&
    (settings as any).food_mode_enabled === false; // explícito false, não undefined

  if (foodModeOff && !user?.is_staff) {
    return (
      <View style={{ flex: 1, backgroundColor: FoodColors.bg, padding: 24 }}>
        <Text style={{
          fontSize: 11, color: FoodColors.red, fontWeight: "700",
          letterSpacing: 1, textTransform: "uppercase", marginBottom: 4,
        }}>
          AURA FOOD
        </Text>
        <Text style={{ fontSize: 22, color: FoodColors.ink, fontWeight: "800", marginBottom: 24 }}>
          Modo restaurante desativado
        </Text>
        <EmptyState
          icon="settings"
          title="Modo food não habilitado"
          subtitle="Para usar Mesas, Comandas e KDS, habilite o modo restaurante em Configurações > PDV > Políticas do Caixa. Você pode também acessar os módulos genéricos do Aura Negócio."
        />
      </View>
    );
  }

  return <FoodShell />;
}
