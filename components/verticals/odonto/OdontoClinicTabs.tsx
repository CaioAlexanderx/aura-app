// ============================================================
// AURA. — Odonto Clinical Tab Wrappers (patient-centric)
// D-UNIFY + agenda Dia/Semana/Mes com navegacao prev/next.
// W1-01: PacientesTab agora abre PatientHub drill-down ao clicar paciente.
// W1-04 fix: removido onNewAppointment passado ao AgendaDental — o botao
//            "Agendar" violeta no header do AgendaTab ja faz a mesma coisa
//            e fica visivel em todas as views (dia/semana/mes). Botao
//            ciano interno do AgendaDental era redundante.
// UX: badge LGPD removida da listagem (consentimento obrigatorio internamente).
//     Indicador de aniversario (🎂) aparece para pacientes com aniversario
//     nos proximos 7 dias. Agenda abre em semana por padrao.
// PR24 (2026-04-28): PacientesTab consome ?open_patient=ID&tab=prontuario
// pra abrir PatientHub via deep-link (botoes "Prontuario" da agenda).
// PR26 (2026-04-28): AgendaTab.handleAppointmentPress -> ConsultaShell
// pra status ativos. UAT mostrou que click na agenda caia no modal simples
// e usuario nunca chegava na tela de atendimento real.
// PR28 (2026-04-28): PacientesTab agora delega UI pro PatientsList
// (tela com grid/lista, filtros, bulk actions, importar CSV) seguindo
// mockup-pacientes-v1 aprovado. Logica de hub/edit/deep-link mantida aqui.
// ============================================================
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { Icon } from "@/components/Icon";
import { AgendaDental } from "@/components/verticals/odonto/AgendaDental";
import { AgendaDentalWeek } from "@/components/verticals/odonto/AgendaDentalWeek";
import { AgendaDentalMonth } from "@/components/verticals/odonto/AgendaDentalMonth";
import { AgendaNavigator, agendaRangeFor, type AgendaView } from "@/components/verticals/odonto/AgendaNavigator";
import { OdontogramaSVG } from "@/components/verticals/odonto/OdontogramaSVG";
import { ProntuarioTimeline } from "@/components/verticals/odonto/ProntuarioTimeline";
import { PatientFormModal, type PatientFormData } from "@/components/verticals/odonto/PatientFormModal";
import { NewAppointmentModal } from "@/components/verticals/odonto/NewAppointmentModal";
import { AppointmentDetailModal } from "@/components/verticals/odonto/AppointmentDetailModal";
import { AppointmentsList } from "@/components/verticals/odonto/AppointmentsList";
import { PatientHub, type PatientLite } from "@/components/verticals/odonto/PatientHub";
import { PatientsList } from "@/components/verticals/odonto/PatientsList";
import { dentalConfigApi } from "@/services/dentalConfigApi";

function useCompanyId() { return useAuthStore().company?.id; }
function Loader() { return <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>; }

function chairLabelFor(practitionerId: string | null | undefined, settings: any, practitioners: any[]): string | undefined {
  if (!practitionerId || !settings) return undefined;
  const idx = settings.chair_practitioner_ids.indexOf(practitionerId);
  if (idx === -1) return undefined;
  if (!settings.chairs_active[idx]) return undefined;
  const p = practitioners.find(x => x.id === practitionerId);
  return p ? `Cadeira ${idx + 1} - ${p.name}` : `Cadeira ${idx + 1}`;
}

const ACTIVE_STATUSES = new Set(["agendado", "avaliacao", "aprovado", "em_atendimento"]);

type ViewMode = "calendar" | "list";

export function AgendaTab() {
  const cid = useCompanyId();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [agendaView, setAgendaView] = useState<AgendaView>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [showNew, setShowNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [initialDateTime, setInitialDateTime] = useState<string | undefined>(undefined);

  const { start: rangeStart, end: rangeEnd } = agendaRangeFor(agendaView, anchorDate);

  const { data, isLoading } = useQuery({
    queryKey: ["dental-agenda", cid, agendaView, rangeStart.toISOString()],
    queryFn: () => {
      const qs = `start=${encodeURIComponent(rangeStart.toISOString())}&end=${encodeURIComponent(rangeEnd.toISOString())}`;
      return request(`/companies/${cid}/dental/agenda?${qs}`);
    },
    enabled: !!cid && viewMode === "calendar",
    staleTime: 15000,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["dental-settings", cid],
    queryFn: () => dentalConfigApi.getSettings(cid!),
    enabled: !!cid, staleTime: 30000,
  });
  const { data: practitionersData } = useQuery({
    queryKey: ["dental-practitioners", cid],
    queryFn: () => dentalConfigApi.listPractitioners(cid!),
    enabled: !!cid, staleTime: 30000,
  });

  const settings = settingsData?.settings;
  const practitioners = practitionersData?.practitioners || [];

  let chairs: string[] | undefined;
  if (settings) {
    chairs = [];
    settings.chairs_active.forEach((active: boolean, idx: number) => {
      if (!active) return;
      const allocId = settings.chair_practitioner_ids[idx];
      const allocated = practitioners.find((p: any) => p.id === allocId);
      chairs!.push(allocated ? `Cadeira ${idx + 1} - ${allocated.name}` : `Cadeira ${idx + 1}`);
    });
    if (chairs.length === 0) chairs = ["Cadeira 1"];
  }

  const appointments = ((data as any)?.appointments || []).map((a: any) => ({
    id: a.id,
    patient_name: a.patient_name || "Paciente",
    patient_phone: a.patient_phone,
    scheduled_at: a.scheduled_at,
    duration_min: a.duration_min || 60,
    chief_complaint: a.chief_complaint,
    status: a.status || "agendado",
    chair: chairLabelFor(a.practitioner_id, settings, practitioners),
    professional_name: a.professional_name,
  }));

  function handleNewAppointment() { setInitialDateTime(undefined); setShowNew(true); }
  function handleSlotPressDay(_chair: string, time: string) {
    const dt = new Date(anchorDate);
    const [h, m] = time.split(":");
    dt.setHours(parseInt(h) || 9, parseInt(m) || 0, 0, 0);
    setInitialDateTime(dt.toISOString());
    setShowNew(true);
  }
  function handleSlotPressWeek(dt: Date) { setInitialDateTime(dt.toISOString()); setShowNew(true); }
  function handleDayPressMonth(d: Date) { setAnchorDate(d); setAgendaView("day"); }

  function handleAppointmentPress(a: { id: string; status: string }) {
    if (ACTIVE_STATUSES.has(a.status)) router.push(`/dental/consulta/${a.id}` as any);
    else setDetailId(a.id);
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={v.toggleRow}>
        <Pressable onPress={() => setViewMode("calendar")} style={[v.toggleBtn, viewMode === "calendar" && v.toggleBtnActive]}>
          <Icon name="calendar" size={13} color={viewMode === "calendar" ? "#fff" : Colors.ink3} />
          <Text style={[v.toggleText, viewMode === "calendar" && v.toggleTextActive]}>Calendario</Text>
        </Pressable>
        <Pressable onPress={() => setViewMode("list")} style={[v.toggleBtn, viewMode === "list" && v.toggleBtnActive]}>
          <Icon name="list" size={13} color={viewMode === "list" ? "#fff" : Colors.ink3} />
          <Text style={[v.toggleText, viewMode === "list" && v.toggleTextActive]}>Lista</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={handleNewAppointment} style={v.newBtn}>
          <Icon name="plus" size={13} color="#fff" />
          <Text style={v.newBtnText}>Agendar</Text>
        </Pressable>
      </View>

      {viewMode === "calendar" && (
        <>
          <AgendaNavigator view={agendaView} date={anchorDate} onViewChange={setAgendaView} onDateChange={setAnchorDate} />
          {isLoading && <Loader />}
          {!isLoading && agendaView === "day" && <AgendaDental appointments={appointments} chairs={chairs} date={anchorDate} onAppointmentPress={handleAppointmentPress} onSlotPress={handleSlotPressDay} />}
          {!isLoading && agendaView === "week" && <AgendaDentalWeek appointments={appointments} anchorDate={anchorDate} onAppointmentPress={handleAppointmentPress} onSlotPress={handleSlotPressWeek} />}
          {!isLoading && agendaView === "month" && <AgendaDentalMonth appointments={appointments} anchorDate={anchorDate} onDayPress={handleDayPressMonth} onAppointmentPress={handleAppointmentPress} />}
        </>
      )}

      {viewMode === "list" && <AppointmentsList />}

      <NewAppointmentModal visible={showNew} onClose={() => setShowNew(false)} initialDateTime={initialDateTime} />
      <AppointmentDetailModal visible={!!detailId} appointmentId={detailId} onClose={() => setDetailId(null)} />
    </View>
  );
}

// ──────────────────────────────────────────────────────────
// PacientesTab
// PR28: delega UI pro PatientsList (mockup-pacientes-v1 aprovado).
// Mantem aqui: PatientHub, PatientFormModal, deep-link ?open_patient=ID.
// ──────────────────────────────────────────────────────────
export function PacientesTab() {
  const cid = useCompanyId();
  const router = useRouter();
  const params = useLocalSearchParams<{ open_patient?: string; tab?: string }>();
  const [showNew, setShowNew] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientLite | null>(null);
  const [editingPatient, setEditingPatient] = useState<PatientLite | null>(null);
  const [hubInitialTab, setHubInitialTab] = useState<string | undefined>(undefined);

  // Deep-link: ?open_patient=ID&tab=prontuario abre o hub diretamente.
  useEffect(() => {
    const openId = params.open_patient;
    if (!openId || !cid) return;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await request(`/companies/${cid}/dental/patients/${openId}`);
        if (cancelled || !res?.patient) return;
        const p = res.patient;
        setSelectedPatient({
          id: p.id,
          name: p.full_name || p.name,
          full_name: p.full_name,
          phone: p.phone,
          phone_secondary: p.phone_secondary,
          email: p.email,
          cpf: p.cpf_cnpj || p.cpf,
          birthday: p.birth_date,
          birth_date: p.birth_date,
          gender: p.gender,
          postal_code: p.postal_code,
          street: p.street,
          address_number: p.address_number,
          complement: p.complement,
          neighborhood: p.neighborhood,
          city: p.city,
          state: p.state,
          allergies: p.allergies,
          medical_history: p.medical_history,
          medications: p.medications,
          insurance_name: p.insurance_name,
          notes: p.notes,
          created_at: p.created_at,
          is_patient: true,
          photo_url: p.photo_url || null,
        });
        setHubInitialTab(typeof params.tab === "string" ? params.tab : undefined);
        router.replace("/dental/(clinic)/pacientes" as any);
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.open_patient, cid]);

  return (
    <>
      <PatientsList
        onOpenPatient={(p) => setSelectedPatient(p)}
        onNewPatient={() => setShowNew(true)}
      />

      <PatientFormModal
        visible={showNew || !!editingPatient}
        mode={editingPatient ? "edit" : "create"}
        patient={editingPatient as any}
        onClose={() => { setShowNew(false); setEditingPatient(null); }}
        onSaved={(saved: PatientFormData | undefined) => {
          if (editingPatient && saved && selectedPatient && saved.id === selectedPatient.id) {
            setSelectedPatient({
              ...selectedPatient,
              name:           saved.full_name || selectedPatient.name,
              full_name:      saved.full_name || selectedPatient.full_name,
              phone:          saved.phone ?? null,
              phone_secondary: saved.phone_secondary ?? null,
              email:          saved.email ?? null,
              cpf:            saved.cpf ?? null,
              birthday:       saved.birth_date ?? null,
              birth_date:     saved.birth_date ?? null,
              gender:         saved.gender ?? null,
              postal_code:    saved.postal_code ?? null,
              street:         saved.street ?? null,
              address_number: saved.address_number ?? null,
              complement:     saved.complement ?? null,
              neighborhood:   saved.neighborhood ?? null,
              city:           saved.city ?? null,
              state:          saved.state ?? null,
              allergies:      saved.allergies ?? null,
              medical_history: saved.medical_history ?? null,
              medications:    saved.medications ?? null,
              insurance_name: saved.insurance_name ?? null,
            });
          }
          setShowNew(false); setEditingPatient(null);
        }}
      />
      <PatientHub
        visible={!!selectedPatient}
        patient={selectedPatient}
        onClose={() => { setSelectedPatient(null); setHubInitialTab(undefined); }}
        onEdit={(p) => setEditingPatient(p)}
        initialTab={hubInitialTab}
      />
    </>
  );
}

export function OdontogramaTab() {
  const cid = useCompanyId();
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const { data: patientsData } = useQuery({
    queryKey: ["dental-patients-mini", cid, patientSearch],
    queryFn: () => request(`/companies/${cid}/dental/patients?search=${encodeURIComponent(patientSearch)}&limit=10`),
    enabled: !!cid && !patientId, staleTime: 30000,
  });
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["dental-chart", cid, patientId],
    queryFn: () => request(`/companies/${cid}/dental/patients/${patientId}/chart`),
    enabled: !!cid && !!patientId, staleTime: 15000,
  });
  const statusMut = useMutation({
    mutationFn: (p: { tooth: number; status: string }) =>
      request(`/companies/${cid}/dental/patients/${patientId}/chart`, {
        method: "POST",
        body: { tooth_number: p.tooth, status: p.status },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dental-chart"] }); },
  });

  if (!patientId) {
    const patients = ((patientsData as any)?.patients) || [];
    return (
      <View style={{ gap: 10 }}>
        <Text style={z.sectionTitle}>Selecione um paciente</Text>
        <View style={z.searchBox}><Icon name="search" size={14} color={Colors.ink3} /><TextInput style={z.searchInput} placeholder="Buscar..." placeholderTextColor={Colors.ink3} value={patientSearch} onChangeText={setPatientSearch} /></View>
        {patients.map((p: any) => <Pressable key={p.id} onPress={() => setPatientId(p.id)} style={z.patientCard}><Text style={z.patientName}>{p.full_name}</Text><Icon name="arrow_right" size={14} color={Colors.ink3} /></Pressable>)}
        {patients.length === 0 && <Text style={z.hintText}>Digite o nome para buscar</Text>}
      </View>
    );
  }
  if (isLoading) return <Loader />;
  const teethRaw = ((chartData as any)?.teeth) || [];
  const teeth = teethRaw.map((t: any) => {
    const faces: any = { M: null, D: null, O: null, V: null, L: null };
    (t.faces || []).forEach((f: any) => { if (f.face && faces.hasOwnProperty(f.face)) faces[f.face] = f.status || null; });
    return { number: t.tooth, status: (t.faces && t.faces[0]?.status) || "higido", faces };
  });
  return (
    <View>
      <Pressable onPress={() => setPatientId(null)} style={z.backBtn}><Icon name="arrow_left" size={14} color={Colors.violet3} /><Text style={z.backText}>Trocar paciente</Text></Pressable>
      <OdontogramaSVG teeth={teeth} onStatusChange={(toothNum, status) => statusMut.mutate({ tooth: toothNum, status })} />
    </View>
  );
}

export function ProntuarioTab() {
  const cid = useCompanyId();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientName, setPatientName] = useState("");
  const { data: patientsData } = useQuery({
    queryKey: ["dental-prontuario-search", cid, patientSearch],
    queryFn: () => request(`/companies/${cid}/dental/patients?search=${encodeURIComponent(patientSearch)}&limit=10`),
    enabled: !!cid && !patientId, staleTime: 30000,
  });
  const { data: prescData, isLoading } = useQuery({
    queryKey: ["dental-prescriptions", cid, patientId],
    queryFn: () => request(`/companies/${cid}/dental/patients/${patientId}/prescriptions`),
    enabled: !!cid && !!patientId, staleTime: 15000,
  });
  if (!patientId) {
    const patients = ((patientsData as any)?.patients) || [];
    return (
      <View style={{ gap: 10 }}>
        <Text style={z.sectionTitle}>Selecione um paciente</Text>
        <View style={z.searchBox}><Icon name="search" size={14} color={Colors.ink3} /><TextInput style={z.searchInput} placeholder="Buscar..." placeholderTextColor={Colors.ink3} value={patientSearch} onChangeText={setPatientSearch} /></View>
        {patients.map((p: any) => <Pressable key={p.id} onPress={() => { setPatientId(p.id); setPatientName(p.full_name); }} style={z.patientCard}><Text style={z.patientName}>{p.full_name}</Text><Icon name="arrow_right" size={14} color={Colors.ink3} /></Pressable>)}
      </View>
    );
  }
  if (isLoading) return <Loader />;
  const entries = (((prescData as any)?.prescriptions) || []).map((p: any) => ({
    id: p.id, type: p.doc_type || "receituario", date: p.issued_at, description: p.content, professional: "",
  }));
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Pressable onPress={() => setPatientId(null)} style={z.backBtn}><Icon name="arrow_left" size={14} color={Colors.violet3} /><Text style={z.backText}>Trocar</Text></Pressable>
        <Text style={z.sectionTitle}>{patientName}</Text>
      </View>
      <ProntuarioTimeline entries={entries} patientName={patientName} />
    </View>
  );
}

const v = StyleSheet.create({
  toggleRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  toggleBtnActive: { backgroundColor: Colors.violet || "#6d28d9", borderColor: Colors.violet || "#6d28d9" },
  toggleText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.violet3 || "#a78bfa", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  newBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});

const z = StyleSheet.create({
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink } as any,
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet || "#6d28d9", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  newBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
  emptyHint: { fontSize: 12, color: Colors.ink3 },
  hintText: { fontSize: 12, color: Colors.ink3, textAlign: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  patientCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  patientName: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  patientMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  patientInsurance: { fontSize: 10, color: Colors.violet3, marginTop: 2, fontWeight: "500" },
  bdayDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.15)", alignItems: "center", justifyContent: "center" },
  bdayDotText: { fontSize: 13 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  backText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});
