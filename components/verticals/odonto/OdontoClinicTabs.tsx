// ============================================================
// AURA. — Odonto Clinical Tab Wrappers (patient-centric)
// D-UNIFY + D-FIX agenda: mapeia chair via practitioner_id + settings.
// Agendamentos com practitioner_id alocado a uma cadeira ativa
// aparecem automaticamente na coluna correspondente.
// ============================================================
import { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { Icon } from "@/components/Icon";
import { AgendaDental } from "@/components/verticals/odonto/AgendaDental";
import { OdontogramaSVG } from "@/components/verticals/odonto/OdontogramaSVG";
import { ProntuarioTimeline } from "@/components/verticals/odonto/ProntuarioTimeline";
import { NewPatientModal } from "@/components/verticals/odonto/NewPatientModal";
import { NewAppointmentModal } from "@/components/verticals/odonto/NewAppointmentModal";
import { AppointmentDetailModal } from "@/components/verticals/odonto/AppointmentDetailModal";
import { dentalConfigApi } from "@/services/dentalConfigApi";

function useCompanyId() { return useAuthStore().company?.id; }
function Loader() { return <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>; }

// Retorna a label da cadeira ("Cadeira N - Dr Nome") para um practitioner_id,
// ou undefined se nao estiver alocado a uma cadeira ativa.
function chairLabelFor(practitionerId: string | null | undefined, settings: any, practitioners: any[]): string | undefined {
  if (!practitionerId || !settings) return undefined;
  const idx = settings.chair_practitioner_ids.indexOf(practitionerId);
  if (idx === -1) return undefined;
  if (!settings.chairs_active[idx]) return undefined;
  const p = practitioners.find(x => x.id === practitionerId);
  return p ? `Cadeira ${idx + 1} - ${p.name}` : `Cadeira ${idx + 1}`;
}

export function AgendaTab() {
  const cid = useCompanyId();
  const [showNew, setShowNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [initialDateTime, setInitialDateTime] = useState<string | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ["dental-agenda", cid],
    queryFn: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      return request(`/companies/${cid}/dental/agenda?start=${start}&end=${end}`);
    },
    enabled: !!cid, staleTime: 15000,
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

  if (isLoading) return <Loader />;

  const settings = settingsData?.settings;
  const practitioners = practitionersData?.practitioners || [];

  // Monta lista de cadeiras ativas (labels)
  let chairs: string[] | undefined;
  if (settings) {
    chairs = [];
    settings.chairs_active.forEach((active, idx) => {
      if (!active) return;
      const allocId = settings.chair_practitioner_ids[idx];
      const allocated = practitioners.find(p => p.id === allocId);
      chairs!.push(allocated ? `Cadeira ${idx + 1} - ${allocated.name}` : `Cadeira ${idx + 1}`);
    });
    if (chairs.length === 0) chairs = ["Cadeira 1"];
  }

  // Mapeia cada appointment pra sua cadeira (via practitioner_id)
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

  function handleNewAppointment() {
    setInitialDateTime(undefined);
    setShowNew(true);
  }

  function handleSlotPress(_chair: string, time: string) {
    const today = new Date();
    const [h, m] = time.split(":");
    today.setHours(parseInt(h) || 9, parseInt(m) || 0, 0, 0);
    setInitialDateTime(today.toISOString());
    setShowNew(true);
  }

  return (
    <>
      <AgendaDental
        appointments={appointments}
        chairs={chairs}
        onNewAppointment={handleNewAppointment}
        onAppointmentPress={(a) => setDetailId(a.id)}
        onSlotPress={handleSlotPress}
      />
      <NewAppointmentModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        initialDateTime={initialDateTime}
      />
      <AppointmentDetailModal
        visible={!!detailId}
        appointmentId={detailId}
        onClose={() => setDetailId(null)}
      />
    </>
  );
}

export function PacientesTab() {
  const cid = useCompanyId();
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dental-patients", cid, search],
    queryFn: () => request(`/companies/${cid}/dental/patients?search=${encodeURIComponent(search)}&limit=50`),
    enabled: !!cid, staleTime: 30000,
  });
  const patients = ((data as any)?.patients) || [];

  return (
    <>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={[z.searchBox, { flex: 1 }]}>
            <Icon name="search" size={14} color={Colors.ink3} />
            <TextInput
              style={z.searchInput}
              placeholder="Buscar paciente..."
              placeholderTextColor={Colors.ink3}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Pressable onPress={() => setShowNew(true)} style={z.newBtn}>
            <Icon name="plus" size={14} color="#fff" />
            <Text style={z.newBtnText}>Novo paciente</Text>
          </Pressable>
        </View>

        {isLoading && <Loader />}
        {!isLoading && patients.length === 0 && (
          <View style={z.empty}>
            <Icon name="users" size={24} color={Colors.ink3} />
            <Text style={z.emptyText}>Nenhum paciente cadastrado</Text>
            <Text style={z.emptyHint}>Clique em "Novo paciente" para comecar</Text>
          </View>
        )}
        {patients.map((p: any) => (
          <View key={p.id} style={z.patientCard}>
            <View style={{ flex: 1 }}>
              <Text style={z.patientName}>{p.full_name}</Text>
              <Text style={z.patientMeta}>{p.phone || ""}{p.email ? " | " + p.email : ""}</Text>
              {p.insurance_name && <Text style={z.patientInsurance}>{p.insurance_name}</Text>}
            </View>
            {p.lgpd_consent && <View style={z.lgpdBadge}><Text style={z.lgpdText}>LGPD</Text></View>}
          </View>
        ))}
      </View>

      <NewPatientModal visible={showNew} onClose={() => setShowNew(false)} />
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
    queryKey: ["dental-patients-prontuario", cid, patientSearch],
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
  lgpdBadge: { backgroundColor: Colors.greenD, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  lgpdText: { fontSize: 8, color: Colors.green, fontWeight: "700" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  backText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
});
