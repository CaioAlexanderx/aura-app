// ============================================================
// useClinicHours — horário de funcionamento da clínica (empresa
// ativa em useAuthStore), pronto para a Agenda consumir.
//
// Fonte: GET /companies/:cid/dental/hours (Aura-backend#725).
// Query key: ["dental-hours", cid] — mesma usada pelo card de
// configuração (ClinicHoursCard.tsx), então salvar lá invalida
// e atualiza aqui automaticamente.
//
// Usado pela Agenda (OdontoClinicTabs → AgendaDental/AgendaDentalWeek:
// faixa de horas, fundo por turno, confirmação fora do horário) e pelo
// NewAppointmentModal (duração padrão e aviso de encaixe).
// ============================================================
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { dentalConfigApi } from "@/services/dentalConfigApi";
import {
  clinicGridRange,
  isWithinClinicHours,
  normalizeClinicHours,
  type ClinicHours,
} from "@/utils/clinicHours";

export type UseClinicHoursResult = {
  configured: boolean;
  hours: ClinicHours;
  gridStartHour: number;
  gridEndHour: number;
  isWithinHours: (date: Date, durationMin: number) => boolean;
  defaultIntervalMin: 15 | 20 | 30 | 45 | 60 | null;
  isLoading: boolean;
};

export function useClinicHours(): UseClinicHoursResult {
  const cid = useAuthStore((s) => s.company?.id);

  const { data, isLoading } = useQuery({
    queryKey: ["dental-hours", cid],
    queryFn: () => dentalConfigApi.getHours(cid as string),
    enabled: !!cid,
    staleTime: 30000,
  });

  const configured = !!data?.configured;

  const hours = useMemo(
    () => normalizeClinicHours(configured ? data?.hours : null),
    [data, configured]
  );

  const { startHour: gridStartHour, endHour: gridEndHour } = useMemo(
    () => clinicGridRange(hours, configured),
    [hours, configured]
  );

  const defaultIntervalMin = configured ? (data?.default_interval_min ?? null) : null;

  return {
    configured,
    hours,
    gridStartHour,
    gridEndHour,
    isWithinHours: (date: Date, durationMin: number) => isWithinClinicHours(hours, date, durationMin),
    defaultIntervalMin,
    isLoading,
  };
}

export default useClinicHours;
