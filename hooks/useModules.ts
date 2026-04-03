import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/services/api";

// ============================================================
// VER-01c: useModules hook
// Fetches active vertical modules for the current company
// ============================================================

export type ModuleKey = "odonto" | "barber" | "estetica" | "pet" | "food" | "moda" | "academia";

export interface Module {
  key: ModuleKey;
  name: string;
  accent: string;
  icon: string;
  minPlan: string;
  is_active: boolean;
  activated_at: string | null;
  config: Record<string, any>;
}

interface ModulesResponse {
  total: number;
  active: number;
  modules: Module[];
}

// Demo data for when API is unavailable
const DEMO_MODULES: Module[] = [
  { key: "odonto", name: "Odontologia", accent: "#06B6D4", icon: "tooth", minPlan: "negocio", is_active: false, activated_at: null, config: {} },
  { key: "barber", name: "Barbearia/Salao", accent: "#F59E0B", icon: "scissors", minPlan: "negocio", is_active: false, activated_at: null, config: {} },
  { key: "estetica", name: "Estetica", accent: "#EC4899", icon: "sparkles", minPlan: "negocio", is_active: false, activated_at: null, config: {} },
  { key: "pet", name: "Pet Shop", accent: "#10B981", icon: "paw", minPlan: "negocio", is_active: false, activated_at: null, config: {} },
  { key: "food", name: "Food Service", accent: "#EF4444", icon: "utensils", minPlan: "negocio", is_active: false, activated_at: null, config: {} },
  { key: "moda", name: "Moda/Varejo", accent: "#8B5CF6", icon: "shirt", minPlan: "negocio", is_active: false, activated_at: null, config: {} },
  { key: "academia", name: "Academia", accent: "#3B82F6", icon: "dumbbell", minPlan: "negocio", is_active: false, activated_at: null, config: {} },
];

export function useModules() {
  const { company, token, isDemo } = useAuthStore();

  const { data, isLoading, refetch } = useQuery<ModulesResponse>({
    queryKey: ["modules", company?.id],
    queryFn: () => api.get(`/companies/${company?.id}/modules`),
    enabled: !!company?.id && !!token && !isDemo,
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });

  const modules = data?.modules || (isDemo ? DEMO_MODULES : []);
  const activeModules = modules.filter(m => m.is_active);

  // Convenience checkers
  const hasModule = (key: ModuleKey) => activeModules.some(m => m.key === key);
  const getModule = (key: ModuleKey) => modules.find(m => m.key === key);
  const activeCount = activeModules.length;

  // Get the first active module (for accent color, sidebar highlight, etc)
  const primaryModule = activeModules[0] || null;

  return {
    modules,
    activeModules,
    activeCount,
    primaryModule,
    hasModule,
    getModule,
    isLoading,
    refetch,
  };
}
