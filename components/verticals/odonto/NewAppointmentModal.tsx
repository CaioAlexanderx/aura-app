// ============================================================
// AURA. — D-UNIFY: Modal de novo agendamento odonto
// POST /companies/:id/dental/appointments
//
// Melhorias:
// - Date input: <input type="date"> na web, TextInput mask mobile.
// - Time input: <input type="time"> na web, TextInput mask mobile.
// - Seletor de cadeira (via settings + practitioners) -> practitioner_id.
// - ISO com TZ explicito (evita interpretacao UTC pelo BE).
// ============================================================
import { useState, useEffect, createElement } from "react";
import { Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { dentalConfigApi } from "@/services/dentalConfigApi";
import { localDateTimeToISO } from "@/utils/mask";

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
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
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

  // Busca de pacientes
  const { data: patientsData } = useQuery({
    queryKey: ["dental-patients-picker", cid, search],
    queryFn: () => request(`/companies/${cid}/dental/patients?search=${encodeURIComponent(search)}&limit=20`),
    enabled: !!cid && visible && !patientId,
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

  // Monta lista de cadeiras ativas com o practitioner alocado
  const chairOptions: Array<{ idx: number; practitionerId: string; practitionerName: string; label: string }> = [];
  const settings = settingsData?.settings;
  const practitioners = practitionersData?.practitioners || [];
  if (settings) {
    settings.chairs_active.forEach((active, idx) => {
      if (!active) return;
      const pid = settings.chair_practitioner_ids[idx];
      if (!pid) return;
      const p = practitioners.find(x => x.id === pid);
      if (!p) return;
      chairOptions.push({ idx, practitionerId: pid, practitionerName: p.name, label: `Cadeira ${idx + 1} - ${p.name}` });
    });
  }

  // Auto-seleciona primeira cadeira disponivel
  useEffect(() => {
    if (!visible) return;
    if (!practitionerId && chairOptions.length > 0) {
      setPractitionerId(chairOptions[0].practitionerId);
    }
  }, [visible, chairOptions.length, practitionerId]);

  function reset() {
    setPatientId(null); setPatientName(""); setSearch("");
    setDate(""); setTime(""); setDuration("60"); setChiefComplaint("");
    setPractitionerId(null); setError(null);
  }

  const createMut = useMutation({
    mutationFn: () => {
      const scheduledAt = localDateTimeToISO(date, time);
      return request(`/companies/${cid}/dental/appointments`, {
        method: "POST",
        body: {
          patient_id: patientId,
          scheduled_at: scheduledAt,
          duration_min: parseInt(duration) || 60,
          chief_complaint: chiefComplaint.trim() || null,
          practitioner_id: practitionerId || null,
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

            {/* Cadeira */}
            {chairOptions.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 16 }]}>Cadeira *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {chairOptions.map(opt => (
                    <Pressable
                      key={opt.practitionerId}
                      onPress={() => setPractitionerId(opt.practitionerId)}
                      style={[s.chairPill, practitionerId === opt.practitionerId && s.chairPillActive]}
                    >
                      <Text style={[s.chairPillText, practitionerId === opt.practitionerId && s.chairPillTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {chairOptions.length === 0 && (
              <View style={s.warnBox}>
                <Text style={s.warnText}>
                  Nenhuma cadeira configurada. Acesse Configuracoes do modulo odonto para ativar cadeiras e alocar dentistas.
                </Text>
              </View>
            )}

            {/* Data/hora/duracao */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>Data e horario *</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <NativeDateInput label="Data" value={date} onChange={setDate} style={{ flex: 2 }} />
              <NativeTimeInput label="Hora" value={time} onChange={setTime} style={{ flex: 1 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.fieldLabel}>Duracao</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
                  {["30", "60", "90"].map(d => (
                    <Pressable key={d} onPress={() => setDuration(d)} style={[s.durPill, duration === d && s.durPillActive]}>
                      <Text style={[s.durPillText, duration === d && s.durPillTextActive]}>{d}m</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
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

// ── Native date/time inputs (web: HTML native; mobile: TextInput fallback) ──
function NativeDateInput({ label, value, onChange, style }: any) {
  if (Platform.OS === "web") {
    return (
      <View style={[{ gap: 4 }, style]}>
        <Text style={s.fieldLabel}>{label}</Text>
        {createElement("input", {
          type: "date",
          value: value,
          onChange: (e: any) => onChange(e.target.value),
          style: {
            backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
            borderRadius: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
            fontSize: 13, color: Colors.ink, fontFamily: "inherit",
            colorScheme: "dark",
          },
        })}
      </View>
    );
  }
  return (
    <View style={[{ gap: 4 }, style]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder="AAAA-MM-DD" placeholderTextColor={Colors.ink3} style={s.input} keyboardType="numeric" />
    </View>
  );
}

function NativeTimeInput({ label, value, onChange, style }: any) {
  if (Platform.OS === "web") {
    return (
      <View style={[{ gap: 4 }, style]}>
        <Text style={s.fieldLabel}>{label}</Text>
        {createElement("input", {
          type: "time",
          value: value,
          onChange: (e: any) => onChange(e.target.value),
          step: 300,
          style: {
            backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
            borderRadius: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
            fontSize: 13, color: Colors.ink, fontFamily: "inherit",
            colorScheme: "dark",
          },
        })}
      </View>
    );
  }
  return (
    <View style={[{ gap: 4 }, style]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder="HH:MM" placeholderTextColor={Colors.ink3} style={s.input} keyboardType="numeric" />
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
  chairPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  chairPillActive: { backgroundColor: Colors.violet || "#6d28d9", borderColor: Colors.violet || "#6d28d9" },
  chairPillText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  chairPillTextActive: { color: "#fff" },
  warnBox: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#F59E0B", backgroundColor: "rgba(245,158,11,0.08)" },
  warnText: { fontSize: 11, color: "#F59E0B", lineHeight: 16 },
  durPill: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, minWidth: 34 },
  durPillActive: { backgroundColor: Colors.violet || "#6d28d9", borderColor: Colors.violet || "#6d28d9" },
  durPillText: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },
  durPillTextActive: { color: "#fff" },
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
