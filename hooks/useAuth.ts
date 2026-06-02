// useAuth — wrapper fino sobre useAuthStore.
// Criado pra destravar o build: telas de Orçamentos (Camada 1) importavam
// @/hooks/useAuth, que nunca foi criado.
import { useAuthStore } from "@/stores/auth";

export function useAuth() {
  const company = useAuthStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
  return {
    companyId: company?.id ?? null,
    company,
    user,
  };
}

export default useAuth;
