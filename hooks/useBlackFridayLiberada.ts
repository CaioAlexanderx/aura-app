// ============================================================
// AURA. — A página Black Friday está liberada para esta conta? (13/10/2026)
//
// Uma só leitura para o menu (Sidebar e MBar), a rota /black-friday e o
// atalho em Configurações: período + (BLACK_FRIDAY_LIBERADA_PARA_TODOS ou
// conta de teste). Ver constants/blackFriday.ts.
// ============================================================
import { useAuthStore } from "@/stores/auth";
import { blackFridayLiberada } from "@/constants/blackFriday";

export function useBlackFridayLiberada(): boolean {
  const { isStaff, isDemo, user, company } = useAuthStore() as any;
  return blackFridayLiberada({ isStaff, isDemo, user, company });
}
