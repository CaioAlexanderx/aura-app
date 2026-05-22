import { View, Text } from "react-native";
import { FoodColors } from "@/constants/food-tokens";
import { EmptyState } from "@/components/EmptyState";
import { useAuthStore } from "@/stores/auth";

// 2026-05-21 (F4 do polish pre-Fase 7): referência a migration 118 +
// pdv_settings + service_fee_pct só aparece pra is_staff. Cliente vê
// EmptyState (ainda sem UI; toggle é feito via /configuracoes > PDV).

export default function ConfiguracoesScreen() {
  const { user } = useAuthStore();
  if (user?.is_staff) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: FoodColors.ink }}>Configurações</Text>
        <Text style={{ fontSize: 13, color: FoodColors.ink3, lineHeight: 20 }}>
          Toggles do modo food em pdv_settings (food_mode_enabled, service_fee_pct),
          impressora térmica de cozinha, integrações (iFood, marketplaces), políticas do caixa.
        </Text>

        <View style={{
          backgroundColor: FoodColors.surface, borderColor: FoodColors.border, borderWidth: 1,
          borderRadius: 12, padding: 32, alignItems: "center", marginTop: 8,
        }}>
          <Text style={{ fontSize: 48 }}>⚙️</Text>
          <Text style={{ fontSize: 14, color: FoodColors.ink, marginTop: 12, fontWeight: "600" }}>
            [STAFF] Em construção
          </Text>
          <Text style={{ fontSize: 12, color: FoodColors.ink3, marginTop: 4, textAlign: "center", maxWidth: 420 }}>
            Fase 7 do BACKLOG_AURA_FOOD.md. Backend Fase 0:{" "}
            <Text style={{ color: FoodColors.amber }}>migration 118</Text> adiciona{" "}
            <Text style={{ color: FoodColors.amber }}>food_mode_enabled</Text> e{" "}
            <Text style={{ color: FoodColors.amber }}>service_fee_pct</Text> a pdv_settings.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <EmptyState
      icon="settings"
      title="Em breve"
      subtitle="O painel de configurações do Aura Food chega na próxima atualização. Por ora, ajustes do modo restaurante ficam em Configurações > PDV."
    />
  );
}
