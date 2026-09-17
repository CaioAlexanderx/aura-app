// ============================================================
// AURA. — D-UNIFY: Modal de novo agendamento / editar agendamento odonto
// POST  /companies/:id/dental/appointments
// PATCH /companies/:id/dental/appointments/:aid   (modo edição)
//
// Melhorias:
// - Cadastro rápido de paciente integrado
// - #13 (2026-05-09): busca de paciente só dispara com 2+ chars;
//   lista não exibida antes de digitar (privacidade).
// - Mockup "Agenda Odonto" (16/09/2026, aba D):
//   * mesmo modal para Novo e Editar (prop `appointment`);
//   * conflito aparece logo abaixo da hora (mesma regra do backend, com os
//     agendamentos do dia) com "Usar HH:MM · próximo livre"; salvar assim
//     vira "Salvar como encaixe";
//   * "antes → agora" e "Avisar no WhatsApp" quando data/hora mudam;
//   * remarcar falta/justificada volta o status para agendado; cancelado é
//     terminal no backend, então a remarcação cria um agendamento novo;
//   * uma cadeira ativa → chip fixo; várias → seletor;
//   * no celular (< 768 px) vira folha de baixo com Salvar sempre visível.
// - Horário de funcionamento (17/09/2026): novo agendamento começa com a
//   duração padrão da clínica; horário fora do turno mostra um aviso âmbar
//   e salva normalmente (vira encaixe).
// ============================================================
import { useState, useEffect, useMemo, useRef, createElement } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from "react-native";
import { IS_DARK_MODE } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { dentalConfigApi } from "@/services/dentalConfigApi";
import { localDateTimeToISO } from "@/utils/mask";
import { toDateOnlyString, todayLocalString } from "@/utils/dateOnly";
import { openWhatsApp, rescheduleText } from "@/utils/whatsapp";
import { notify } from "@/utils/webAlert";
import {
  conflictLabel, findConflicts, hhmm, localDayBoundsISO, nextFreeSlot, rescheduleMode, shortDayTime, slotSummary, whenLine,
} from "@/utils/dentalAgenda";
import {
  APPOINTMENT_LIST_KEYS, apiErrorMessage, useDentalAppointmentMutation, type AppointmentPatch,
} from "@/hooks/useDentalAppointmentMutation";
import { useClinicHours } from "@/hooks/useClinicHours";
import { NewPatientModal } from "./NewPatientModal";
import { AC, AgendaBtn, AgendaModalFrame, CheckRow, Chip, FieldLabel, Hint, useIsSheet } from "./agendaModalKit";

export interface EditableAppointment {
  id: string;
  patient_id?: string | null;
  customer_id?: string | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  allergies?: string | null;
  scheduled_at: string;
  duration_min?: number | null;
  practitioner_id?: string | null;
  chief_complaint?: string | null;
  status?: string | null;
}

export interface PatientSeed {
  id: string;
  name: string;
  phone?: string | null;
  allergies?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  initialDateTime?: string;
  /** Modo edição/remarcação. */
  appointment?: EditableAppointment | null;
  /** Paciente pré-escolhido (ex.: "Agendar retorno"). */
  initialPatient?: PatientSeed | null;
  initialNote?: string;
  /** Depois de salvar (id do agendamento salvo/criado). */
  onSaved?: (saved: { id: string }) => void;
}

const DURATIONS = [30, 45, 60, 90];
const pad = (n: number) => String(n).padStart(2, "0");
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
const firstName = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "o paciente";

export function NewAppointmentModal({ visible, onClose, initialDateTime, appointment, initialPatient, initialNote, onSaved }: Props) {
  const company = useAuthStore().company;
  const cid = company?.id;
  const qc = useQueryClient();
  const sheet = useIsSheet();
  const isEdit = !!appointment;

  const [patient, setPatient] = useState<PatientSeed | null>(null);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [notifyWa, setNotifyWa] = useState(true);
  const clinicHours = useClinicHours();
  const defaultDur = clinicHours.defaultIntervalMin;
  // Duração escolhida à mão não é sobrescrita quando o horário da clínica chega.
  const durationTouched = useRef(false);

  function applyDuration(m: number) {
    setDuration(m);
    setCustomDuration(DURATIONS.includes(m) ? "" : String(m));
  }

  useEffect(() => {
    if (!visible) return;
    setError(null);
    durationTouched.current = false;
    if (appointment) {
      const d = new Date(appointment.scheduled_at);
      setDate(toDateOnlyString(d));
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      const dur = appointment.duration_min || 60;
      setDuration(dur);
      setCustomDuration(DURATIONS.includes(dur) ? "" : String(dur));
      setChiefComplaint(appointment.chief_complaint || "");
      setPractitionerId(appointment.practitioner_id || null);
      setPatient({
        id: String(appointment.customer_id || appointment.patient_id || ""),
        name: appointment.patient_name || "Paciente",
        phone: appointment.patient_phone,
        allergies: appointment.allergies,
      });
      setNotifyWa(!!appointment.patient_phone);
      return;
    }
    if (initialPatient) setPatient(initialPatient);
    if (initialNote) setChiefComplaint(initialNote);
    if (defaultDur) applyDuration(defaultDur);
    if (initialDateTime) {
      const d = new Date(initialDateTime);
      setDate(toDateOnlyString(d));
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else {
      // dia local: via toISOString, depois das 21h abria com a data de amanha
      setDate(todayLocalString());
      setTime("09:00");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialDateTime, appointment?.id, initialPatient?.id]);

  // Horário da clínica carregou depois de abrir: aplica a duração padrão (só no novo).
  useEffect(() => {
    if (!visible || appointment || !defaultDur || durationTouched.current) return;
    applyDuration(defaultDur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, defaultDur, appointment?.id]);

  // #13: busca so dispara com 2+ chars
  const { data: patientsData } = useQuery({
    queryKey: ["dental-patients-picker", cid, search],
    queryFn: () => request(`/companies/${cid}/dental/patients?search=${encodeURIComponent(search)}&limit=20`),
    enabled: !!cid && visible && !patient && search.trim().length >= 2,
    staleTime: 30000,
  });

  // Settings + practitioners para seletor de cadeira
  const { data: settingsData } = useQuery({
    queryKey: ["dental-settings", cid],
    queryFn: () => dentalConfigApi.getSettings(cid!),
    enabled: !!cid && visible, staleTime: 30000,
  });
  const { data: practitionersData } = useQuery({
    queryKey: ["dental-practitioners", cid],
    queryFn: () => dentalConfigApi.listPractitioners(cid!),
    enabled: !!cid && visible, staleTime: 30000,
  });

  // Agendamentos do dia escolhido, para avisar do conflito ANTES de salvar.
  const bounds = localDayBoundsISO(date);
  const { data: dayData } = useQuery({
    queryKey: ["dental-agenda-day", cid, date],
    queryFn: () => request<any>(`/companies/${cid}/dental/agenda?start=${encodeURIComponent(bounds!.start)}&end=${encodeURIComponent(bounds!.end)}`),
    enabled: !!cid && visible && !!bounds,
    staleTime: 15000,
  });

  // Monta lista de cadeiras ativas com o practitioner alocado
  const chairOptions: Array<{ idx: number; practitionerId: string; practitionerName: string; label: string }> = [];
  const settings = settingsData?.settings;
  const practitioners = practitionersData?.practitioners || [];
  if (settings) {
    settings.chairs_active.forEach((active: boolean, idx: number) => {
      if (!active) return;
      const pid = settings.chair_practitioner_ids[idx];
      if (!pid) return;
      const p = practitioners.find((x: any) => x.id === pid);
      if (!p) return;
      chairOptions.push({ idx, practitionerId: pid, practitionerName: p.name, label: `Cadeira ${idx + 1} · ${p.name}` });
    });
  }

  // Auto-seleciona a primeira cadeira. Na edição só quando há uma cadeira
  // (o chip é fixo) — com várias, não muda a cadeira de quem já estava marcado.
  useEffect(() => {
    if (!visible || practitionerId || chairOptions.length === 0) return;
    if (isEdit && chairOptions.length > 1) return;
    setPractitionerId(chairOptions[0].practitionerId);
  }, [visible, chairOptions.length, practitionerId, isEdit]);

  // ── horário, conflito, próximo livre ──
  const durationValid = Number.isInteger(duration) && duration >= 5 && duration <= 1440;
  const scheduledISO = date && /^\d{2}:\d{2}$/.test(time) ? localDateTimeToISO(date, time) : null;
  const originalAt = appointment ? new Date(appointment.scheduled_at) : null;
  const newAt = scheduledISO ? new Date(scheduledISO) : null;
  const moved = !!(originalAt && newAt && originalAt.getTime() !== newAt.getTime());
  const durChanged = !!(appointment && duration !== (appointment.duration_min || 60));
  const mode = appointment ? rescheduleMode(appointment.status, moved) : { mode: "create" as const };
  const selfId = appointment && mode.mode === "patch" ? appointment.id : null;

  const dayList = (dayData as any)?.appointments || [];
  const target = scheduledISO && durationValid
    ? { id: selfId, scheduled_at: scheduledISO, duration_min: duration, practitioner_id: practitionerId }
    : null;
  const conflicts = useMemo(() => (target ? findConflicts(target, dayList) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduledISO, duration, practitionerId, selfId, dayData]);
  // Fora do turno da clínica (só com horário salvo): aviso, nunca bloqueio.
  const outsideHours = !!(clinicHours.configured && newAt && durationValid && !clinicHours.isWithinHours(newAt, duration));
  const free = useMemo(() => (target && conflicts.length ? nextFreeSlot(target, dayList) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conflicts]);

  function reset() {
    setPatient(null); setSearch("");
    setDate(""); setTime(""); setDuration(defaultDur || 60); setCustomDuration(""); setChiefComplaint("");
    setPractitionerId(null); setError(null); setNotifyWa(true);
  }

  function invalidateLists() {
    for (const k of APPOINTMENT_LIST_KEYS) qc.invalidateQueries({ queryKey: k });
  }

  function savedMessage(fit: boolean, opened: boolean, verb: "agendada" | "remarcada" | "atualizado") {
    const who = firstName(patient?.name);
    const at = newAt ? shortDayTime(newAt) : "";
    let msg = verb === "atualizado" ? `Agendamento de ${who} atualizado` : `Consulta de ${who} ${verb} para ${at}`;
    if (fit) msg += " como encaixe";
    if (opened) msg += " · WhatsApp aberto com o aviso";
    return msg;
  }

  const createMut = useMutation({
    mutationFn: () =>
      request<any>(`/companies/${cid}/dental/appointments`, {
        method: "POST",
        body: {
          patient_id: patient?.id,
          scheduled_at: scheduledISO,
          duration_min: duration,
          chief_complaint: chiefComplaint.trim() || null,
          practitioner_id: practitionerId || null,
        },
      }),
  });
  const patchMut = useDentalAppointmentMutation(cid);
  const pending = createMut.isPending || patchMut.isPending;

  function handleSubmit() {
    setError(null);
    if (!patient?.id) return setError("Selecione um paciente");
    if (!date || !time || !scheduledISO) return setError("Data e horário são obrigatórios");
    if (!durationValid) return setError("Duração inválida (mínimo 5 minutos)");

    // WhatsApp abre no mesmo tick do clique (regra do pop-up no web).
    const wantsWa = !!appointment && moved && notifyWa && !!patient.phone;
    const openWa = () =>
      wantsWa && originalAt && newAt
        ? openWhatsApp(patient.phone, rescheduleText({ patientName: patient.name, clinicName: company?.name, from: originalAt, to: newAt }))
        : false;

    if (appointment && mode.mode === "patch") {
      const patch: AppointmentPatch = {};
      if (moved) patch.scheduled_at = scheduledISO;
      if (durChanged) patch.duration_min = duration;
      if ((practitionerId || null) !== (appointment.practitioner_id || null)) patch.practitioner_id = practitionerId || null;
      if ((chiefComplaint.trim() || null) !== (appointment.chief_complaint || null)) patch.chief_complaint = chiefComplaint.trim() || null;
      if (mode.status) patch.status = mode.status;
      if (!Object.keys(patch).length) { onClose(); return; }
      const opened = openWa();
      patchMut.mutate(
        { id: appointment.id, patch, silent: true },
        {
          onSuccess: (res) => {
            const fit = conflicts.length > 0 || !!res?.conflicts?.length || (moved && (res?.outside_hours ?? outsideHours));
            notify(savedMessage(fit, opened, moved ? "remarcada" : "atualizado"));
            reset();
            if (onSaved) onSaved({ id: appointment.id }); else onClose();
          },
          onError: (err) => setError(apiErrorMessage(err, "Erro ao salvar")),
        },
      );
      return;
    }

    const opened = openWa();
    createMut.mutate(undefined, {
      onSuccess: (res) => {
        invalidateLists();
        const fit = conflicts.length > 0 || !!res?.conflicts?.length || !!(res?.outside_hours ?? outsideHours);
        notify(savedMessage(fit, opened, appointment ? "remarcada" : "agendada"));
        const id = res?.appointment?.id;
        reset();
        if (id && onSaved) onSaved({ id }); else onClose();
      },
      onError: (err: any) => setError(apiErrorMessage(err, "Erro ao agendar")),
    });
  }

  function handleClose() {
    if (pending) return;
    reset();
    onClose();
  }

  function applyFreeSlot() {
    if (!free) return;
    setDate(toDateOnlyString(free));
    setTime(hhmm(free));
  }

  const patients = (patientsData as any)?.patients || [];
  const saveLabel = conflicts.length ? "Salvar como encaixe" : appointment && mode.mode === "patch" ? "Salvar alterações" : "Agendar";
  const endAt = newAt && durationValid ? new Date(newAt.getTime() + duration * 60000) : null;

  const header = (
    <View style={s.head}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.kicker}>{isEdit ? "Editar agendamento" : "Novo agendamento"}</Text>
        <Text style={s.name} numberOfLines={1}>{patient?.name || "Escolha o paciente"}</Text>
        {appointment && (
          <Text style={s.sub}>Marcada para {whenLine(appointment.scheduled_at, appointment.duration_min || 60).replace(/^(Hoje|Amanhã)/, (m) => m.toLowerCase())}</Text>
        )}
      </View>
      <Pressable onPress={handleClose} hitSlop={8} style={s.close} accessibilityLabel="Fechar">
        <Icon name="x" size={16} color={AC.ink2} />
      </Pressable>
    </View>
  );

  const saveBtn = (
    <AgendaBtn testID="appt-save" variant="primary" large={sheet} label={saveLabel} loading={pending} onPress={handleSubmit} />
  );
  const backBtn = (
    <AgendaBtn testID="appt-back" variant={sheet ? "ghost" : "outline"} label={sheet ? "Voltar sem salvar" : "Voltar"} onPress={handleClose} disabled={pending} />
  );

  return (
    <>
      <AgendaModalFrame
        visible={visible}
        onClose={handleClose}
        sheet={sheet}
        testID="appt-form-modal"
        header={header}
        footer={sheet ? <>{saveBtn}{backBtn}</> : <>{backBtn}<View style={{ flex: 1 }} />{saveBtn}</>}
      >
        {/* Paciente */}
        <FieldLabel first>Paciente</FieldLabel>
        {patient ? (
          <View style={s.pcard} testID="appt-patient">
            <View style={s.avatar}><Text style={s.avatarText}>{initials(patient.name)}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.pname} numberOfLines={1}>{patient.name}</Text>
              <Text style={s.pmeta} numberOfLines={2}>
                {patient.phone || "Sem telefone"}
                {patient.allergies ? <Text style={s.allergyMini}>{` · Alergia: ${patient.allergies}`}</Text> : null}
              </Text>
            </View>
            {!isEdit && (
              <AgendaBtn small label="Trocar" onPress={() => { setPatient(null); setSearch(""); }} />
            )}
          </View>
        ) : (
          <>
            <View style={s.searchBox}>
              <Icon name="search" size={14} color={AC.ink3} />
              <TextInput style={s.searchInput} placeholder="Buscar por nome, CPF ou telefone" placeholderTextColor={AC.ink3} value={search} onChangeText={setSearch} />
            </View>
            {/* #13: gate — so exibe lista com 2+ chars */}
            {search.trim().length >= 2 ? (
              <View style={{ gap: 4, marginTop: 6 }}>
                {patients.slice(0, 8).map((p: any) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setPatient({ id: p.id, name: p.full_name || p.name, phone: p.phone, allergies: p.allergies })}
                    style={s.pitem}
                  >
                    <Text style={s.pitemName}>{p.full_name || p.name}</Text>
                    <Text style={s.pitemMeta}>{p.phone || ""}</Text>
                  </Pressable>
                ))}
                {patients.length === 0 && (
                  <>
                    <Hint>Nenhum paciente encontrado</Hint>
                    <Pressable onPress={() => setShowNewPatient(true)} style={s.quickReg}>
                      <Icon name="plus" size={13} color={AC.cyanInk} />
                      <Text style={s.quickRegText}>Cadastrar "{search}" como novo paciente</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : (
              <Hint>{search.trim().length === 1 ? "Continue digitando..." : "Digite o nome, CPF ou telefone para buscar"}</Hint>
            )}
          </>
        )}

        {/* Data e hora */}
        <View style={s.row2}>
          <View style={{ flex: 1.3 }}>
            <FieldLabel>Data</FieldLabel>
            <NativeDateInput value={date} onChange={setDate} testID="appt-date" />
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel>Hora</FieldLabel>
            <NativeTimeInput value={time} onChange={setTime} testID="appt-time" />
          </View>
        </View>

        {conflicts.length > 0 && (
          <View style={s.warn} testID="appt-conflict" accessibilityRole="alert">
            <View style={s.warnCaret} />
            <View style={{ flexDirection: "row", gap: 7, alignItems: "flex-start" }}>
              <Icon name="alert" size={16} color={AC.amberInk} />
              <Text style={s.warnTitle}>Esse horário já tem {conflicts.map(conflictLabel).join(" e ")}.</Text>
            </View>
            <View style={s.warnActions}>
              {free && (
                <>
                  <AgendaBtn testID="appt-use-free" small label={`Usar ${hhmm(free)} · próximo livre`} onPress={applyFreeSlot} />
                  <Text style={s.warnMuted}>ou</Text>
                </>
              )}
              <Text style={s.warnMuted}>salve assim para marcar como encaixe.</Text>
            </View>
          </View>
        )}

        {outsideHours && (
          <View style={s.outside} testID="appt-outside-hours" accessibilityRole="alert">
            <Icon name="clock" size={14} color={AC.amberInk} />
            <Text style={s.outsideText}>Fora do horário de funcionamento — será marcado como encaixe</Text>
          </View>
        )}

        {/* Duração */}
        <FieldLabel>Duração</FieldLabel>
        <View style={s.chips}>
          {DURATIONS.map((m) => (
            <Chip
              key={m}
              testID={`appt-dur-${m}`}
              label={`${m} min`}
              on={duration === m && !customDuration}
              onPress={() => { durationTouched.current = true; setDuration(m); setCustomDuration(""); }}
            />
          ))}
          <View style={[s.customChip, !!customDuration && s.customChipOn]}>
            <Text style={[s.customText, !!customDuration && { color: AC.cyanInk }]}>Outra</Text>
            <TextInput
              testID="appt-dur-custom"
              value={customDuration}
              onChangeText={(v) => {
                durationTouched.current = true;
                const clean = v.replace(/\D/g, "").slice(0, 4);
                setCustomDuration(clean);
                if (clean) setDuration(parseInt(clean, 10));
                else setDuration(60);
              }}
              placeholder="__"
              placeholderTextColor={AC.ink3}
              keyboardType="numeric"
              accessibilityLabel="Duração em minutos"
              style={s.customInput}
            />
            <Text style={[s.customText, !!customDuration && { color: AC.cyanInk }]}>min</Text>
          </View>
        </View>
        {endAt && <Hint>Termina às {hhmm(endAt)}</Hint>}

        {/* Cadeira */}
        {chairOptions.length === 1 && (
          <>
            <FieldLabel>Cadeira</FieldLabel>
            <View style={s.chips}><Chip testID="appt-chair-fixed" fixed on label={chairOptions[0].label} /></View>
            <Hint>Você tem uma cadeira. Com mais de uma, a escolha aparece aqui.</Hint>
          </>
        )}
        {chairOptions.length > 1 && (
          <>
            <FieldLabel>Cadeira</FieldLabel>
            <View style={s.chips}>
              {chairOptions.map((opt) => (
                <Chip
                  key={opt.practitionerId}
                  label={opt.label}
                  on={practitionerId === opt.practitionerId}
                  onPress={() => setPractitionerId(opt.practitionerId)}
                />
              ))}
            </View>
          </>
        )}
        {settings && chairOptions.length === 0 && (
          <View style={s.warnBox}>
            <Text style={s.warnText}>
              Nenhuma cadeira configurada. Acesse Configurações do módulo odonto para ativar cadeiras e alocar dentistas.
            </Text>
          </View>
        )}

        {/* Observação */}
        <FieldLabel>Observação</FieldLabel>
        <TextInput
          value={chiefComplaint}
          onChangeText={setChiefComplaint}
          placeholder="Ex.: avaliação, limpeza, trazer o raio-X"
          placeholderTextColor={AC.ink3}
          multiline
          style={[s.input, s.inputMultiline]}
        />

        {appointment && (moved || durChanged) && originalAt && newAt && (
          <View style={s.diff} testID="appt-diff">
            <Text style={s.diffMuted}>Antes</Text>
            <Text style={s.diffOld}>{slotSummary(originalAt, appointment.duration_min || 60)}</Text>
            <Text style={s.diffMuted}>→ Agora</Text>
            <Text style={s.diffNew}>{slotSummary(newAt, duration)}</Text>
          </View>
        )}
        {appointment && moved && mode.mode === "patch" && mode.status === "agendado" && (
          <Hint>Ao salvar, o status volta para Agendado.</Hint>
        )}
        {appointment && mode.mode === "create" && (
          <Hint>A consulta cancelada fica no histórico; a remarcação cria um agendamento novo.</Hint>
        )}
        {appointment && moved && (patient?.phone ? (
          <CheckRow
            testID="appt-notify"
            label={`Avisar ${firstName(patient?.name)} da mudança no WhatsApp`}
            value={notifyWa}
            onChange={setNotifyWa}
          />
        ) : (
          <Hint style={{ marginTop: 14 }}>Sem telefone cadastrado: avise {firstName(patient?.name)} por outro meio.</Hint>
        ))}

        {error && <Text style={s.error} testID="appt-error">{error}</Text>}
      </AgendaModalFrame>

      <NewPatientModal
        visible={showNewPatient}
        onClose={() => setShowNewPatient(false)}
        initialName={search}
        onCreated={(p: any) => {
          setPatient({ id: p.id, name: p.full_name || p.name, phone: p.phone, allergies: p.allergies });
          setShowNewPatient(false);
        }}
      />
    </>
  );
}

// ── Native date/time inputs (web: HTML native; mobile: TextInput fallback) ──
const webInputStyle = {
  backgroundColor: AC.bg3, border: `1px solid ${AC.border2}`, borderRadius: 9,
  padding: "9px 11px", fontSize: 13.5, color: AC.ink, fontFamily: "inherit",
  colorScheme: IS_DARK_MODE ? "dark" : "light", width: "100%", boxSizing: "border-box", minHeight: 40,
};

function NativeDateInput({ value, onChange, testID }: { value: string; onChange: (v: string) => void; testID?: string }) {
  if (Platform.OS === "web") {
    return createElement("input", {
      type: "date", value, "data-testid": testID, "aria-label": "Data",
      onChange: (e: any) => onChange(e.target.value),
      style: webInputStyle,
    });
  }
  return <TextInput testID={testID} value={value} onChangeText={onChange} placeholder="AAAA-MM-DD" placeholderTextColor={AC.ink3} style={s.input} keyboardType="numeric" />;
}

function NativeTimeInput({ value, onChange, testID }: { value: string; onChange: (v: string) => void; testID?: string }) {
  if (Platform.OS === "web") {
    return createElement("input", {
      type: "time", value, step: 300, "data-testid": testID, "aria-label": "Hora",
      onChange: (e: any) => onChange(e.target.value),
      style: webInputStyle,
    });
  }
  return <TextInput testID={testID} value={value} onChangeText={onChange} placeholder="HH:MM" placeholderTextColor={AC.ink3} style={s.input} keyboardType="numeric" />;
}

const s = StyleSheet.create({
  head: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, alignItems: "flex-start" },
  kicker: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", color: AC.cyanInk },
  name: { fontSize: 18, fontWeight: "700", color: AC.ink, letterSpacing: -0.2 },
  sub: { fontSize: 12.5, color: AC.ink2, marginTop: 1 },
  close: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: AC.border, backgroundColor: AC.surface, alignItems: "center", justifyContent: "center" },
  pcard: { flexDirection: "row", gap: 10, alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: AC.cyanSoft, backgroundColor: AC.cyanDim },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: AC.cyan, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  pname: { fontSize: 13.5, fontWeight: "700", color: AC.ink },
  pmeta: { fontSize: 12, color: AC.ink2 },
  allergyMini: { color: AC.redInk, fontWeight: "700" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: AC.bg3, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: AC.border2 },
  searchInput: { flex: 1, fontSize: 13.5, color: AC.ink } as any,
  pitem: { flexDirection: "row", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: AC.border, backgroundColor: AC.bg3, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 10, minHeight: 44, alignItems: "center" },
  pitemName: { fontSize: 13, fontWeight: "700", color: AC.ink, flexShrink: 1 },
  pitemMeta: { fontSize: 12, color: AC.ink3 },
  quickReg: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: AC.cyan, borderStyle: "dashed", backgroundColor: AC.cyanGhost },
  quickRegText: { fontSize: 12, color: AC.cyanInk, flex: 1 },
  row2: { flexDirection: "row", gap: 10 },
  warn: { marginTop: 10, borderWidth: 1, borderColor: AC.amberBorder, backgroundColor: AC.amberBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  warnCaret: { position: "absolute", top: -6, left: "70%" as any, width: 10, height: 10, backgroundColor: AC.modal, borderLeftWidth: 1, borderTopWidth: 1, borderColor: AC.amberBorder, transform: [{ rotate: "45deg" }] },
  warnTitle: { fontSize: 13, fontWeight: "700", color: AC.amberInk, flex: 1 },
  warnActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 },
  warnMuted: { fontSize: 12, color: AC.ink2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  customChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: AC.border2, backgroundColor: AC.bg3, borderRadius: 9, paddingHorizontal: 12, minHeight: 36 },
  customChipOn: { backgroundColor: AC.cyanDim, borderColor: AC.cyan },
  customText: { fontSize: 13, fontWeight: "600", color: AC.ink },
  customInput: { width: 48, borderBottomWidth: 1, borderBottomColor: AC.border2, color: AC.ink, fontSize: 13, textAlign: "center", paddingVertical: 2 } as any,
  input: { backgroundColor: AC.bg3, borderWidth: 1, borderColor: AC.border2, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13.5, color: AC.ink } as any,
  inputMultiline: { minHeight: 56, textAlignVertical: "top" } as any,
  outside: { marginTop: 10, flexDirection: "row", gap: 7, alignItems: "center", borderWidth: 1, borderColor: AC.amberBorder, backgroundColor: AC.amberBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  outsideText: { fontSize: 12.5, fontWeight: "600", color: AC.amberInk, flex: 1 },
  warnBox: { marginTop: 14, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: AC.amberBorder, backgroundColor: AC.amberBg },
  warnText: { fontSize: 12, color: AC.amberInk, lineHeight: 17 },
  diff: { marginTop: 14, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: AC.surface, borderWidth: 1, borderColor: AC.border, flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  diffMuted: { fontSize: 12.5, color: AC.ink3 },
  diffOld: { fontSize: 12.5, color: AC.ink2, textDecorationLine: "line-through" },
  diffNew: { fontSize: 12.5, color: AC.ink, fontWeight: "700" },
  error: { color: AC.redInk, fontSize: 12.5, textAlign: "center", marginTop: 10 },
});

export default NewAppointmentModal;
