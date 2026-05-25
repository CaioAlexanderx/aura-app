// ============================================================
// Layout autenticado do Aura Studio.
// Espelha padrão do app/food/(salao)/_layout.tsx.
//
// Gates (ordem):
//   1. isHydrated — espera auth carregar do storage
//   2. plan === expansao OU is_staff — vertical é Expansão+
//   3. pdv_settings.studio_enabled === true OU is_staff — toggle ligado
//
// Quem não passa: EmptyState pra ativar / pra contratar plano.
// ============================================================
import { Redirect } from "expo-router";
import { View, Text } from "react-native";
import { StudioShell } from "@/components/studio/StudioShell";
import { EmptyState } from "@/components/EmptyState";
import { StudioColors } from "@/constants/studio-tokens";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";

export default function StudioLayout() {
  const { company, isHydrated, user } = useAuthStore();
  const { settings, isLoading: pdvLoading } = usePdvSettings();

  if (!isHydrated) return null;

  // Hard guard: empresa precisa de plano Expansão+ (igual gate do backend)
  const plan = (company as any)?.plan;
  const planOk = plan === "expansao" || plan === "personalizado" || Boolean(user?.is_staff);
  if (!planOk) return <Redirect href="/(tabs)" />;

  // Toggle ligado? (defensivo — settings ainda carregando libera, igual food)
  const studioOff =
    !pdvLoading &&
    settings &&
    (settings as any).studio_enabled === false;

  if (studioOff && !user?.is_staff) {
    return (
      <View style={{ flex: 1, backgroundColor: StudioColors.bg, padding: 24 }}>
        <Text style={{
          fontSize: 11, color: StudioColors.accent, fontWeight: "800",
          letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4,
        }}>
          AURA STUDIO
        </Text>
        <Text style={{ fontSize: 22, color: StudioColors.ink, fontWeight: "800", marginBottom: 24 }}>
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
