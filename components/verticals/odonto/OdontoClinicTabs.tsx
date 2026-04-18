// ============================================================
// AURA. — Odonto Clinical Tab Wrappers (patient-centric)
// AgendaTab, PacientesTab, OdontogramaTab, ProntuarioTab
// Extracted from OdontoTabWrappers.tsx
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

function useCompanyId() { return useAuthStore().company?.id; }
function Loader() { return <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator color={Colors.violet3} /></View>; }

export function AgendaTab() {
  var cid = useCompanyId();
  var { data, isLoading } = useQuery({
    queryKey: ["dental-agenda", cid],
    queryFn: function() {
      var now = new Date();
      var start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      return request("/companies/" + cid + "/dental/agenda?start=" + start + "&end=" + end);
    },
    enabled: !!cid, staleTime: 15000,
  });
  if (isLoading) return <Loader />;
  var appointments = ((data as any)?.appointments || []).map(function(a: any) {
    return {
      id: a.id, patient_name: a.patient_name || "Paciente", patient_phone: a.patient_phone,
      scheduled_at: a.scheduled_at, duration_min: a.duration_min || 60,
      chief_complaint: a.chief_complaint, status: a.status || "agendado",
      chair: a.chair, professional_name: a.professional_name,
    };
  });
  return <AgendaDental appointments={appointments} />;
}

export function PacientesTab() {
  var cid = useCompanyId();
  var [search, setSearch] = useState("");
  var { data, isLoading } = useQuery({
    queryKey: ["dental-patients", cid, search],
    queryFn: function() { return request("/companies/" + cid + "/dental/patients?search=" + encodeURIComponent(search) + "&limit=50"); },
    enabled: !!cid, staleTime: 30000,
  });
  var patients = ((data as any)?.patients) || [];
  return (
    <View style={{ gap: 10 }}>
      <View style={z.searchBox}>
        <Icon name="search" size={14} color={Colors.ink3} />
        <TextInput style={z.searchInput} placeholder="Buscar paciente..." placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
      </View>
      {isLoading && <Loader />}
      {!isLoading && patients.length === 0 && <View style={z.empty}><Icon name="users" size={24} color={Colors.ink3} /><Text style={z.emptyText}>Nenhum paciente encontrado</Text></View>}
      {patients.map(function(p: any) {
        return (
          <View key={p.id} style={z.patientCard}>
            <View style={{ flex: 1 }}>
              <Text style={z.patientName}>{p.full_name}</Text>
              <Text style={z.patientMeta}>{p.phone || ""}{p.email ? " | " + p.email : ""}</Text>
              {p.insurance_name && <Text style={z.patientInsurance}>{p.insurance_name}</Text>}
            </View>
            {p.lgpd_consent && <View style={z.lgpdBadge}><Text style={z.lgpdText}>LGPD</Text></View>}
          </View>
        );
      })}
    </View>
  );
}

export function OdontogramaTab() {
  var cid = useCompanyId();
  var qc = useQueryClient();
  var [patientId, setPatientId] = useState<string | null>(null);
  var [patientSearch, setPatientSearch] = useState("");
  var { data: patientsData } = useQuery({
    queryKey: ["dental-patients-mini", cid, patientSearch],
    queryFn: function() { return request("/companies/" + cid + "/dental/patients?search=" + encodeURIComponent(patientSearch) + "&limit=10"); },
    enabled: !!cid && !patientId, staleTime: 30000,
  });
  var { data: chartData, isLoading } = useQuery({
    queryKey: ["dental-chart", cid, patientId],
    queryFn: function() { return request("/companies/" + cid + "/dental/patients/" + patientId + "/chart"); },
    enabled: !!cid && !!patientId, staleTime: 15000,
  });
  var statusMut = useMutation({
    mutationFn: function(p: { tooth: number; status: string }) {
      return request("/companies/" + cid + "/dental/patients/" + patientId + "/chart", { method: "POST", body: { tooth_number: p.tooth, status: p.status } });
    },
    onSuccess: function() { qc.invalidateQueries({ queryKey: ["dental-chart"] }); },
  });
  if (!patientId) {
    var patients = ((patientsData as any)?.patients) || [];
    return (
      <View style={{ gap: 10 }}>
        <Text style={z.sectionTitle}>Selecione um paciente</Text>
        <View style={z.searchBox}><Icon name="search" size={14} color={Colors.ink3} /><TextInput style={z.searchInput} placeholder="Buscar..." placeholderTextColor={Colors.ink3} value={patientSearch} onChangeText={setPatientSearch} /></View>
        {patients.map(function(p: any) { return <Pressable key={p.id} onPress={function() { setPatientId(p.id); }} style={z.patientCard}><Text style={z.patientName}>{p.full_name}</Text><Icon name="arrow_right" size={14} color={Colors.ink3} /></Pressable>; })}
        {patients.length === 0 && <Text style={z.hintText}>Digite o nome para buscar</Text>}
      </View>
    );
  }
  if (isLoading) return <Loader />;
  var teethRaw = ((chartData as any)?.teeth) || [];
  var teeth = teethRaw.map(function(t: any) {
    var faces: any = { M: null, D: null, O: null, V: null, L: null };
    (t.faces || []).forEach(function(f: any) { if (f.face && faces.hasOwnProperty(f.face)) faces[f.face] = f.status || null; });
    return { number: t.tooth, status: (t.faces && t.faces[0]?.status) || "higido", faces: faces };
  });
  return (
    <View>
      <Pressable onPress={function() { setPatientId(null); }} style={z.backBtn}><Icon name="arrow_left" size={14} color={Colors.violet3} /><Text style={z.backText}>Trocar paciente</Text></Pressable>
      <OdontogramaSVG teeth={teeth} onStatusChange={function(toothNum, status) { statusMut.mutate({ tooth: toothNum, status: status }); }} />
    </View>
  );
}

export function ProntuarioTab() {
  var cid = useCompanyId();
  var [patientId, setPatientId] = useState<string | null>(null);
  var [patientSearch, setPatientSearch] = useState("");
  var [patientName, setPatientName] = useState("");
  var { data: patientsData } = useQuery({
    queryKey: ["dental-patients-prontuario", cid, patientSearch],
    queryFn: function() { return request("/companies/" + cid + "/dental/patients?search=" + encodeURIComponent(patientSearch) + "&limit=10"); },
    enabled: !!cid && !patientId, staleTime: 30000,
  });
  var { data: prescData, isLoading } = useQuery({
    queryKey: ["dental-prescriptions", cid, patientId],
    queryFn: function() { return request("/companies/" + cid + "/dental/patients/" + patientId + "/prescriptions"); },
    enabled: !!cid && !!patientId, staleTime: 15000,
  });
  if (!patientId) {
    var patients = ((patientsData as any)?.patients) || [];
    return (
      <View style={{ gap: 10 }}>
        <Text style={z.sectionTitle}>Selecione um paciente</Text>
        <View style={z.searchBox}><Icon name="search" size={14} color={Colors.ink3} /><TextInput style={z.searchInput} placeholder="Buscar..." placeholderTextColor={Colors.ink3} value={patientSearch} onChangeText={setPatientSearch} /></View>
        {patients.map(function(p: any) { return <Pressable key={p.id} onPress={function() { setPatientId(p.id); setPatientName(p.full_name); }} style={z.patientCard}><Text style={z.patientName}>{p.full_name}</Text><Icon name="arrow_right" size={14} color={Colors.ink3} /></Pressable>; })}
      </View>
    );
  }
  if (isLoading) return <Loader />;
  var entries = (((prescData as any)?.prescriptions) || []).map(function(p: any) {
    return { id: p.id, type: p.doc_type || "receituario", date: p.issued_at, description: p.content, professional: "" };
  });
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Pressable onPress={function() { setPatientId(null); }} style={z.backBtn}><Icon name="arrow_left" size={14} color={Colors.violet3} /><Text style={z.backText}>Trocar</Text></Pressable>
        <Text style={z.sectionTitle}>{patientName}</Text>
      </View>
      <ProntuarioTimeline entries={entries} patientName={patientName} />
    </View>
  );
}

var z = StyleSheet.create({
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink } as any,
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.ink3, fontWeight: "600" },
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
