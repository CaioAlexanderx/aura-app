import { useMemo } from "react";
import { useModules, ModuleKey } from "./useModules";

// ============================================================
// VER-02f: useVerticalSections hook
// Returns which conditional sections should show based on active modules
// Use in clientes, estoque, PDV, agendamento screens
// ============================================================

export interface VerticalSections {
  // Dental sections
  showOdontograma: boolean;
  showTreatmentPlan: boolean;
  showAnamnese: boolean;
  showDentalHistory: boolean;

  // Barber sections
  showCutHistory: boolean;
  showCommission: boolean;
  showQueue: boolean;
  showPackages: boolean;

  // Pet sections
  showPetInfo: boolean;
  showVaccineCard: boolean;

  // Food sections
  showTableMap: boolean;
  showKitchenOrders: boolean;

  // Generic
  showAppointments: boolean;
  showVerticalTab: boolean;
  activeModuleKey: ModuleKey | null;
}

export function useVerticalSections(): VerticalSections {
  const { hasModule, primaryModule } = useModules();

  return useMemo(() => {
    const hasOdonto = hasModule("odonto");
    const hasBarber = hasModule("barber");
    const hasPet = hasModule("pet");
    const hasFood = hasModule("food");

    return {
      // Dental
      showOdontograma: hasOdonto,
      showTreatmentPlan: hasOdonto,
      showAnamnese: hasOdonto,
      showDentalHistory: hasOdonto,

      // Barber
      showCutHistory: hasBarber,
      showCommission: hasBarber,
      showQueue: hasBarber,
      showPackages: hasBarber,

      // Pet
      showPetInfo: hasPet,
      showVaccineCard: hasPet,

      // Food
      showTableMap: hasFood,
      showKitchenOrders: hasFood,

      // Generic
      showAppointments: hasOdonto || hasBarber || hasPet,
      showVerticalTab: !!(primaryModule),
      activeModuleKey: primaryModule?.key || null,
    };
  }, [hasModule, primaryModule]);
}
