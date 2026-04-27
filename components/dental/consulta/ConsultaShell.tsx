// ============================================================
// ConsultaShell — Orquestrador do Modo Consulta.
//
// Estados:
//   - intro:  brief pre-consulta + botao "Iniciar"
//   - active: stage com odontograma + prontuario + voz + IA + FABs
//   - ended:  modal de encerramento aberto
//
// Fetches (via React Query):
//   - GET /companies/:cid/dental/appointments/:aid
//   - GET /companies/:cid/dental/patients/:pid/chart
//
// Mutations:
//   - POST /companies/:cid/dental/patients/:pid/chart  (ao salvar tooth popover)
//   - PATCH /companies/:cid/dental/appointments/:aid (no end modal)
//
// Modais filhos: RxTemplateModal, ExamRequestModal,
// AgendarProximoModal, ConsultaEndModal, ToothPopover.
//
// PR19: ConsultaAiPanel real (substituiu Gated). briefSeed propaga
// resposta do brief auto da Intro pra ser exibida como 1a mensagem.
// ============================================================

import { useMemo, useReducer, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { DentalColors } from "@/constants/dental-tokens";
import type { ToothData, ToothStatus } from "@/components/verticals/odonto/OdontogramaSVG";
import type {
  ConsultaPatient, ConsultaAppointment, ConsultaState,
  ToothChange, VoiceSegment,
} from "@/lib/dentalConsultaTypes";

import { ConsultaIntro } from "./ConsultaIntro";
import { ConsultaTopbar } from "./ConsultaTopbar";
import { ConsultaPatientBar } from "./ConsultaPatientBar";
import { ConsultaOdontogramaPanel } from "./ConsultaOdontogramaPanel";
import { ConsultaProntuarioPanel } from "./ConsultaProntuarioPanel";
import { ConsultaVoicePanel } from "./ConsultaVoicePanel";
import { ConsultaAiPanel } from "./ConsultaAiPanel";
import { ToothPopover } from "./ToothPopover";
import { RxTemplateModal } from "./RxTemplateModal";
import { ExamRequestModal } from "./ExamRequestModal";
import { AgendarProximoModal } from "./AgendarProximoModal";
import { ConsultaEndModal } from "./ConsultaEndModal";

interface Props {
  appointmentId: string;
}

interface AppointmentResp {
  appointment: {
    id: string;
    patient_id: string;
    customer_id: string;
    scheduled_at: string;
    duration_min: number;
    chief_complaint: string | null;
    status: string;
    practitioner_id: string | null;
    professional_name: string | null;
    patient_name: string;
    patient_phone: string | null;
    insurance_name: string | null;
    allergies: string | null;
  };
}
interface ChartResp {
  patient_id: string;
  teeth: Array<{
    tooth: number;
    faces: Array<{ status: string; face: string | null; notes: string | null }>;
  }>;
}

const UPPER_TEETH = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER_TEETH = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

type ToothStatusKey = ToothStatus;
function isValidStatus(s: string): s is ToothStatusKey {
  return ["higido", "carie", "restaurado", "planejado", "ausente"].indexOf(s) >= 0;
}

function buildTeethFromChart(chart?: ChartResp | null, overrides?: Record<number, { status: ToothStatus; notes?: string | null }>): ToothData[] {
  const byNum: Record<number, ToothData> = {};
  for (const n of [...UPPER_TEETH, ...LOWER_TEETH]) {
    byNum[n] = { number: n, status: "higido", faces: { M: null, D: null, O: null, V: null, L: null } };
  }
  if (chart?.teeth) {
    for (const t of chart.teeth) {
      const cur = byNum[t.tooth];
      if (!cur) continue;
      const last = (t.faces || [])[0];
      if (last && isValidStatus(last.status)) cur.status = last.status;
      if (last?.notes) cur.notes = last.notes;
    }
  }
  if (overrides) {
    for (const n in overrides) {
      const num = Number(n);
      if (!byNum[num]) continue;
      byNum[num] = { ...byNum[num], status: overrides[num].status, notes: overrides[num].notes || byNum[num].notes };
    }
  }
  return Object.values(byNum);
}

type Action =
  | { type: "start" }
  | { type: "tooth_change"; change: ToothChange }
  | { type: "transcript_append"; segment: VoiceSegment }
  | { type: "transcript_command"; segment: VoiceSegment }
  | { type: "show_end" }
  | { type: "hide_end" };

function reducer(s: ConsultaState, a: Action): ConsultaState {
  switch (a.type) {
    case "start": return { ...s, stage: "active", startedAt: new Date().toISOString() };
    case "tooth_change":
      return { ...s, toothChanges: [...s.toothChanges.filter((c) => c.tooth_number !== a.change.tooth_number), a.change] };
    case "transcript_append":
      return { ...s, transcript: [...s.transcript, a.segment] };
    case "transcript_command":
      return { ...s, transcript: [...s.transcript, { ...a.segment, isCommand: true }] };
    case "show_end": return { ...s, stage: "ended" };
    case "hide_end": return { ...s, stage: "active" };
    default: return s;
  }
}

const initialState: ConsultaState = {
  stage: "intro", startedAt: null, endedAt: null,
  toothChanges: [], transcript: [], evolutionDraft: "", whatsappDraft: "", nextAppointmentDraft: "",
};

export function ConsultaShell({ appointmentId }: Props) {
  const cid = useAuthStore().company?.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [state, dispatch] = useReducer(reducer, initialState);
  const [selectedTooth, setSelectedTooth] = useState<ToothData | null>(null);
  const [showProntuarioMobile, setShowProntuarioMobile] = useState(false);
  const [openModal, setOpenModal] = useState<"none" | "rx" | "exam" | "agendar">("none");
  const [briefSeed, setBriefSeed] = useState<string | null>(null);

  const apptQ = useQuery({
    queryKey: ["dental-appt", cid, appointmentId],
    queryFn: () => request<AppointmentResp>(`/companies/${cid}/dental/appointments/${appointmentId}`),
    enabled: !!cid && !!appointmentId,
    staleTime: 15000,
  });
  const appointment: ConsultaAppointment | null = apptQ.data?.appointment
    ? {
        id: apptQ.data.appointment.id,
        scheduled_at: apptQ.data.appointment.scheduled_at,
        duration_min: apptQ.data.appointment.duration_min,
        chief_complaint: apptQ.data.appointment.chief_complaint,
        status: apptQ.data.appointment.status,
        practitioner_id: apptQ.data.appointment.practitioner_id,
        professional_name: apptQ.data.appointment.professional_name,
      }
    : null;

  const patientId = apptQ.data?.appointment?.customer_id || apptQ.data?.appointment?.patient_id || null;
  const patient: ConsultaPatient | null = apptQ.data?.appointment
    ? {
        id: patientId!,
        name: apptQ.data.appointment.patient_name,
        phone: apptQ.data.appointment.patient_phone,
        insurance_name: apptQ.data.appointment.insurance_name,
        allergies: apptQ.data.appointment.allergies,
      }
    : null;

  const chartQ = useQuery({
    queryKey: ["dental-chart", cid, patientId],
    queryFn: () => request<ChartResp>(`/companies/${cid}/dental/patients/${patientId}/chart`),
    enabled: !!cid && !!patientId,
    staleTime: 30000,
  });

  const toothOverrides = useMemo(() => {
    const out: Record<number, { status: ToothStatus; notes?: string | null }> = {};
    for (const c of state.toothChanges) {
      out[c.tooth_number] = { status: c.status, notes: c.notes };
    }
    return out;
  }, [state.toothChanges]);

  const teeth = useMemo(() => buildTeethFromChart(chartQ.data, toothOverrides), [chartQ.data, toothOverrides]);

  const chartMut = useMutation({
    mutationFn: (input: { tooth_number: number; status: ToothStatus; notes: string | null }) =>
      request(`/companies/${cid}/dental/patients/${patientId}/chart`, {
        method: "POST",
        body: {
          appointment_id: appointmentId,
          tooth_number: input.tooth_number,
          status: input.status,
          notes: input.notes,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-chart", cid, patientId] });
    },
    onError: (e: any) => toast.error(e?.data?.error || "Erro ao salvar dente"),
  });

  function onToothSelect(t: ToothData) {
    setSelectedTooth(t);
  }
  function onToothPopoverSave({ status, notes }: { status: ToothStatus; notes: string | null }) {
    if (!selectedTooth) return;
    const prev = selectedTooth.status;
    const change: ToothChange = {
      tooth_number: selectedTooth.number,
      prev_status: prev,
      status,
      notes,
      added_at: new Date().toISOString(),
    };
    dispatch({ type: "tooth_change", change });
    chartMut.mutate({ tooth_number: selectedTooth.number, status, notes });
    toast.success("Dente " + selectedTooth.number + " · " + status);
    setSelectedTooth(null);
  }
  function onVoiceSegment(seg: VoiceSegment) {
    dispatch({ type: "transcript_append", segment: seg });
  }
  function onVoiceCommand(kind: "marcar" | "anotar" | "prescrever", text?: string) {
    if (text) dispatch({ type: "transcript_command", segment: { id: Date.now() + "_cmd", text, ts: new Date().toISOString() } });
    if (kind === "prescrever") setOpenModal("rx");
    else if (kind === "marcar") toast.success("Comando: marcar dente — clique no dente desejado");
    else if (kind === "anotar") toast.success("Comando: anotar — clique no dente pra adicionar nota");
  }

  if (state.stage === "intro") {
    return (
      <View style={{ flex: 1, backgroundColor: DentalColors.bg }}>
        {apptQ.isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8 }}>
            <ActivityIndicator color={DentalColors.cyan} />
            <Text style={{ color: DentalColors.ink3, fontSize: 11 }}>Carregando consulta...</Text>
          </View>
        ) : (
          <ConsultaIntro
            patient={patient}
            appointment={appointment}
            appointmentId={appointmentId}
            patientId={patientId || ""}
            loading={apptQ.isFetching}
            onStart={() => dispatch({ type: "start" })}
            onCancel={() => router.back()}
            onBriefReady={setBriefSeed}
          />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: DentalColors.bg }}>
      <ConsultaTopbar onEnd={() => dispatch({ type: "show_end" })} onMinimize={() => router.back()} />
      <ConsultaPatientBar patient={patient} appointment={appointment} startedAt={state.startedAt} />

      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={{ flex: 1.3, borderRightWidth: isDesktop ? 1 : 0, borderRightColor: DentalColors.border }}>
          <ConsultaOdontogramaPanel
            teeth={teeth}
            onToothSelect={onToothSelect}
            highlightTeeth={state.toothChanges.map((c) => c.tooth_number)}
          />
        </View>
        {isDesktop ? (
          <View style={{ flex: 1 }}>
            <ConsultaProntuarioPanel patient={patient} planItems={[]} timeline={[]} />
          </View>
        ) : null}
      </View>

      <View style={{
        height: 200, flexDirection: "row",
        borderTopWidth: 1, borderTopColor: DentalColors.border,
      }}>
        <View style={{ flex: 1.1, borderRightWidth: 1, borderRightColor: DentalColors.border }}>
          <ConsultaVoicePanel
            transcript={state.transcript}
            onAppendSegment={onVoiceSegment}
            onCommand={onVoiceCommand}
          />
        </View>
        <View style={{ flex: 1 }}>
          <ConsultaAiPanel appointmentId={appointmentId} patientId={patientId || ''} briefSeed={briefSeed || undefined} />
        </View>
      </View>

      <View style={{
        position: "absolute", bottom: 220, right: 14, zIndex: 40,
        gap: 8,
      }}>
        <FabBtn label="💊" color={DentalColors.violet} onPress={() => setOpenModal("rx")} />
        <FabBtn label="🔬" color={DentalColors.amber} onPress={() => setOpenModal("exam")} />
        <FabBtn label="📅" color={DentalColors.green} onPress={() => setOpenModal("agendar")} />
      </View>

      {!isDesktop ? (
        <Pressable
          onPress={() => setShowProntuarioMobile(true)}
          style={{
            position: "absolute", bottom: 220, left: 14, zIndex: 40,
            backgroundColor: DentalColors.violet, paddingHorizontal: 12, paddingVertical: 10,
            borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 6,
          }}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>📋 Prontuario</Text>
        </Pressable>
      ) : null}

      {!isDesktop && showProntuarioMobile ? (
        <View style={{
          position: "absolute", top: 0, right: 0, bottom: 0,
          width: "85%", maxWidth: 380, zIndex: 100,
          backgroundColor: DentalColors.bg2,
          borderLeftWidth: 1, borderLeftColor: DentalColors.border,
          shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 24,
        }}>
          <View style={{
            flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            padding: 14, borderBottomWidth: 1, borderBottomColor: DentalColors.border,
          }}>
            <Text style={{ color: DentalColors.ink, fontSize: 13, fontWeight: "700" }}>📋 Prontuario</Text>
            <Pressable onPress={() => setShowProntuarioMobile(false)}>
              <Text style={{ color: DentalColors.ink2, fontSize: 14 }}>✕</Text>
            </Pressable>
          </View>
          <ConsultaProntuarioPanel patient={patient} planItems={[]} timeline={[]} />
        </View>
      ) : null}

      <ToothPopover
        tooth={selectedTooth}
        onClose={() => setSelectedTooth(null)}
        onSave={onToothPopoverSave}
      />
      <RxTemplateModal
        open={openModal === "rx"}
        patientId={patientId}
        appointmentId={appointmentId}
        practitionerId={appointment?.practitioner_id || null}
        patientName={patient?.name}
        onClose={() => setOpenModal("none")}
      />
      <ExamRequestModal
        open={openModal === "exam"}
        patientId={patientId}
        appointmentId={appointmentId}
        practitionerId={appointment?.practitioner_id || null}
        patientName={patient?.name}
        onClose={() => setOpenModal("none")}
      />
      <AgendarProximoModal
        open={openModal === "agendar"}
        patientId={patientId}
        patientName={patient?.name}
        practitionerId={appointment?.practitioner_id || null}
        defaultDurationMin={appointment?.duration_min || 60}
        onClose={() => setOpenModal("none")}
      />
      <ConsultaEndModal
        open={state.stage === "ended"}
        appointmentId={appointmentId}
        patientId={patientId || null}
        toothChanges={state.toothChanges}
        transcript={state.transcript}
        procedureSeed={appointment?.chief_complaint || ""}
        patientName={patient?.name}
        onClose={() => dispatch({ type: "hide_end" })}
        onDone={() => router.replace("/dental/(clinic)/hoje")}
      />
    </View>
  );
}

function FabBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: color,
      alignItems: "center", justifyContent: "center",
      shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 8,
    }}>
      <Text style={{ fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}
