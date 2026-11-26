// ============================================================
// useWhatsappOficialVisivel — a trava do WhatsApp oficial para telas que
// NÃO carregam o /whatsapp/status por conta própria (18/11/2026).
//
// Trava ligada (ou equipe Aura): true, sem chamada nenhuma. Desligada: pergunta o status
// da company (mesma queryKey ["wa-status", id] do Crediário e do
// BirthdayCouponModal, então é cache compartilhado) e só devolve true para
// quem já tem o número conectado — hoje, o dojô Kondei. Enquanto o status
// não veio, ou se falhou, devolve false: o lado certo é não prometer.
// Ver utils/whatsappOficialLiberado.ts.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { waApi } from "@/services/waApi";
import { empresaSandbox, whatsappOficialLiberadoPara, whatsappOficialVisivel } from "@/utils/whatsappOficialLiberado";

export function useWhatsappOficialVisivel(): boolean {
  const company = useAuthStore((s) => s.company) as any;
  const user = useAuthStore((s) => s.user);
  const consolidado = useAuthStore((s) => s.consolidatedView) === true;
  const sandbox = empresaSandbox(company, consolidado);
  const companyId: string | null = company?.id ?? null;
  const q = useQuery({
    queryKey: ["wa-status", companyId],
    queryFn: () => waApi.getStatus(companyId as string),
    enabled: !whatsappOficialLiberadoPara(user, undefined, sandbox) && !!companyId,
    staleTime: 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return whatsappOficialVisivel(q.data ?? null, user, undefined, sandbox);
}
