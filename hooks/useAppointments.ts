import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

export type Appointment = {
  id: string;
  professional_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  professional_name: string | null;
  professional_color: string | null;
  client_name: string;
  scheduled_at: string;
  duration_min: number;
  total_amount: number;
  status: string;
  notes: string | null;
};

export type AppointmentKpis = { total: number; confirmed: number; pending: number; revenue: number };

export function useAppointments(start?: string, end?: string) {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const cid = company?.id;

  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();
  const s = start || defaultStart;
  const e = end || defaultEnd;

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', cid, s, e],
    queryFn: () => companiesApi.appointments(cid!, s, e),
    enabled: !!cid,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => companiesApi.createAppointment(cid!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments', cid] }); toast.success('Agendamento criado'); },
    onError: (err: any) => toast.error(err?.message || 'Erro ao agendar'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ aid, body }: { aid: string; body: any }) => companiesApi.updateAppointment(cid!, aid, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments', cid] }); toast.success('Agendamento atualizado'); },
    onError: (err: any) => toast.error(err?.message || 'Erro ao atualizar'),
  });

  const cancelMutation = useMutation({
    mutationFn: (aid: string) => companiesApi.cancelAppointment(cid!, aid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments', cid] }); toast.success('Agendamento cancelado'); },
    onError: (err: any) => toast.error(err?.message || 'Erro ao cancelar'),
  });

  return {
    appointments: (data?.appointments || []) as Appointment[],
    kpis: (data?.kpis || { total: 0, confirmed: 0, pending: 0, revenue: 0 }) as AppointmentKpis,
    isLoading,
    createAppointment: createMutation.mutateAsync,
    updateAppointment: (aid: string, body: any) => updateMutation.mutateAsync({ aid, body }),
    cancelAppointment: cancelMutation.mutateAsync,
  };
}
