// ============================================================
// Layout autenticado do Aura Studio.
// Espelha padrão do app/food/(salao)/_layout.tsx.
//
// Gates (ordem):
//   1. isHydrated — espera auth carregar do storage
//   2. pdv_settings.studio_enabled === true OU is_staff — toggle ligado
//
// 25/05/2026: gate de plano REMOVIDO — Studio é vertical contratada (não
// gated por plano). Quem chega aqui já passou pelo onboarding com
// vertical='studio' OU clicou no card Studio no Gestão Aura.
// O toggle pdv_settings.studio_enabled continua sendo gate de UI (canônico
// memory convencao_subtoggles_observacionais).
// ============================================================
import { Redirect } from "expo-router";
import { View, Text } from "react-native";
import { StudioShell } from "@/components/studio/StudioShell";
import { EmptyState } from "@/components/EmptyState";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";

export default function StudioLayout() {
  const { company, isHydrated, user } = useAuthStore();
  const tk = useStudioTokens();
  const { settings, isLoading: pdvLoading } = usePdvSettings();

  if (!isHydrated) return null;

  // Toggle ligado? (defensivo — settings ainda carregando libera, igual food)
  const studioOff =
    !pdvLoading &&
    settings &&
    (settings as any).studio_enabled === false;

  if (studioOff && !user?.is_staff) {
    return (
      <View style={{ flex: 1, backgroundColor: tk.bg, padding: 24 }}>
        <Text style={{
          fontSize: 11, color: tk.accent, fontWeight: "800",
          letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4,
        }}>
          AURA STUDIO
        </Text>
        <Text style={{ fontSize: 22, color: tk.ink, fontWeight: "800", marginBottom: 24 }}>
          Modo Studio desativado
        </Text>
        <EmptyState
          icon="settings"
          title="Studio não habilitado"
          subtitle="Pra começar a vender personalizados (canecas, camisetas, brindes) ative o modo Studio em Configurações > PDV > Políticas do Caixa."
        />
      </View>
    );
  }

  return <StudioShell />;
}
