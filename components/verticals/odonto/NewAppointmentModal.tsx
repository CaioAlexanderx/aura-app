// ============================================================
// AURA. — D-UNIFY: Modal de novo agendamento odonto
// POST /companies/:id/dental/appointments
// Seleciona paciente existente (busca) + data/hora + queixa.
// ============================================================
import { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";

interface Props {
  visible: boolean;
  onClose: () => void;
  initialDateTime?: string;
}

export function NewAppointmentModal({ visible, onClose, initialDateTime }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (initialDateTime) {
      const d = new Date(initialDateTime);
      setDate(d.toISOString().split("T")[0]);
      setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    } else {
      const now = new Date();
      setDate(now.toISOString().split("T")[0]);
      setTime("09:00");
    }
  }, [visible, initialDateTime]);

  const { data: patientsData } = useQuery({
    queryKey: ["dental-patients-picker", cid, search],
    queryFn: () => request(`/companies/${cid}/dental/patients?search=${encodeURIComponent(search)}&limit=20`),
    enabled: !!cid && visible && !patientId,
    staleTime: 30000,
  });

  function reset() {
    setPatientId(null); setPatientName(""); setSearch("");
    setDate(""); setTime(""); setDuration("60"); setChiefComplaint(""); setError(null);
  }

  const createMut = useMutation({
    mutationFn: () => {
      const scheduledAt = `${date}T${time}:00`;
      return request(`/companies/${cid}/dental/appointments`, {
        method: "POST",
        body: {
          patient_id: patientId,
          scheduled_at: scheduledAt,
          duration_min: parseInt(duration) || 60,
          chief_complaint: chiefComplaint.trim() || null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dental-agenda"] });
      reset();
      onClose();
    },
    onError: (err: any) => {
      setError(err?.message || err?.error || "Erro ao agendar");
    },
  });

  function handleSubmit() {
    setError(null);
    if (!patientId) return setError("Selecione um paciente");
    if (!date || !time) return setError("Data e horario sao obrigatorios");
    createMut.mutate();
  }

  function handleClose() {
    if (createMut.isPending) return;
    reset();
    onClose();
  }

  const patients = (patientsData as any)?.patients || [];

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Novo agendamento</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Icon name="close" size={20} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.form} showsVerticalScrollIndicator={false}>
            {/* Paciente */}
            <Text style={s.sectionLabel}>Paciente *</Text>
            {patientId ? (
              <View style={s.selectedPatient}>
                <View style={{ flex: 1 }}>
                  <Text style={s.selectedPatientName}>{patientName}</Text>
                  <Text style={s.selectedPatientHint}>Paciente selecionado</Text>
                </View>
                <Pressable onPress={() => { setPatientId(null); setPatientName(""); }}>
                  <Text style={s.changeLink}>Trocar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={s.searchBox}>
                  <Icon name="search" size={14} color={Colors.ink3} />
                  <TextInput style={s.searchInput} placeholder="Buscar paciente..." placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
                </View>
                {patients.slice(0, 6).map((p: any) => (
                  <Pressable key={p.id} onPress={() => { setPatientId(p.id); setPatientName(p.full_name || p.name); }} style={s.patientItem}>
                    <Text style={s.patientItemName}>{p.full_name || p.name}</Text>
                    <Text style={s.patientItemMeta}>{p.phone || ""}</Text>
                  </Pressable>
                ))}
                {patients.length === 0 && search && <Text style={s.hint}>Nenhum paciente encontrado</Text>}
                {patients.length === 0 && !search && <Text style={s.hint}>Comece a digitar para buscar</Text>}
              </>
            )}

            {/* Data/hora/duracao */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>Data e horario</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Field label="Data" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" style={{ flex: 2 }} />
              <Field label="Hora" value={time} onChangeText={setTime} placeholder="HH:MM" style={{ flex: 1 }} />
              <Field label="Min" value={duration} onChangeText={setDuration} keyboardType="numeric" style={{ flex: 1 }} />
            </View>

            {/* Queixa */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>Detalhes</Text>
            <Field label="Queixa principal" value={chiefComplaint} onChangeText={setChiefComplaint} placeholder="Ex: Dor no dente 36, avaliacao, limpeza..." multiline />

            {error && <Text style={s.error}>{error}</Text>}
          </ScrollView>

          <View style={s.footer}>
            <Pressable onPress={handleClose} style={[s.btn, s.btnGhost]} disabled={createMut.isPending}>
              <Text style={s.btnGhostText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSubmit} style={[s.btn, s.btnPrimary, createMut.isPending && { opacity: 0.6 }]} disabled={createMut.isPending}>
              {createMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Agendar</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field(props: any) {
  const { label, style, multiline, ...rest } = props;
  return (
    <View style={[{ gap: 4 }, style]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput {...rest} style={[s.input, multiline && s.inputMultiline]} placeholderTextColor={Colors.ink3} multiline={multiline} />
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.bg2 || "#0f0f1e", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%", borderWidth: 1, borderColor: Colors.border, borderBottomWidth: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  form: { padding: 20, gap: 10, paddingBottom: 30 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: Colors.violet3, textTransform: "uppercase", letterSpacing: 0.6 },
  fieldLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  input: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink } as any,
  inputMultiline: { minHeight: 60, textAlignVertical: "top" } as any,
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink } as any,
  patientItem: { padding: 12, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  patientItemName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  patientItemMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  selectedPatient: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.violet3 || "#a78bfa", backgroundColor: "rgba(109,40,217,0.08)" },
  selectedPatientName: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  selectedPatientHint: { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  changeLink: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  hint: { fontSize: 12, color: Colors.ink3, textAlign: "center", paddingVertical: 12 },
  error: { color: "#EF4444", fontSize: 12, textAlign: "center", marginTop: 6 },
  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  btnPrimary: { backgroundColor: Colors.violet || "#6d28d9" },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

export default NewAppointmentModal;
