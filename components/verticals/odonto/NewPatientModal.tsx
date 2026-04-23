// ============================================================
// AURA. — D-UNIFY: Modal de cadastro de paciente
// POST /companies/:id/dental/patients
// Masks: CPF (000.000.000-00), Telefone ((00) 00000-0000), Data (DD/MM/AAAA)
// ============================================================
import { useState } from "react";
import { Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { maskCpf, maskPhone, maskDateBR, brDateToISO, onlyDigits, isValidCpf } from "@/utils/mask";

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated?: (patient: any) => void;
}

export function NewPatientModal({ visible, onClose, onCreated }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDateBR, setBirthDateBR] = useState(""); // DD/MM/AAAA
  const [gender, setGender] = useState<"M" | "F" | "outro" | "">("");
  const [allergies, setAllergies] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [medications, setMedications] = useState("");
  const [insuranceName, setInsuranceName] = useState("");
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFullName(""); setCpf(""); setPhone(""); setEmail(""); setBirthDateBR("");
    setGender(""); setAllergies(""); setMedicalHistory(""); setMedications("");
    setInsuranceName(""); setLgpdConsent(false); setError(null);
  }

  const createMut = useMutation({
    mutationFn: () => {
      const birthISO = birthDateBR.trim() ? brDateToISO(birthDateBR.trim()) : null;
      return request(`/companies/${cid}/dental/patients`, {
        method: "POST",
        body: {
          full_name: fullName.trim(),
          cpf: onlyDigits(cpf) || null,
          phone: onlyDigits(phone) || null,
          email: email.trim() || null,
          birth_date: birthISO,
          gender: gender || null,
          allergies: allergies.trim() || null,
          medical_history: medicalHistory.trim() || null,
          medications: medications.trim() || null,
          insurance_name: insuranceName.trim() || null,
          lgpd_consent: lgpdConsent,
        },
      });
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["dental-patients"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      if (onCreated) onCreated(res?.patient);
      reset();
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.message || err?.error || "Erro ao cadastrar paciente";
      setError(msg);
    },
  });

  function handleSubmit() {
    setError(null);
    if (!fullName.trim()) return setError("Nome e obrigatorio");
    if (cpf.trim() && !isValidCpf(cpf)) return setError("CPF invalido");
    if (birthDateBR.trim() && !brDateToISO(birthDateBR)) return setError("Data de nascimento invalida (use DD/MM/AAAA)");
    if (!lgpdConsent) return setError("Consentimento LGPD e obrigatorio para dados de saude");
    createMut.mutate();
  }

  function handleClose() {
    if (createMut.isPending) return;
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View>
              <Text style={s.title}>Novo paciente</Text>
              <Text style={s.subtitle}>Cadastro clinico + consentimento LGPD</Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Icon name="close" size={20} color={Colors.ink3} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.form} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>Identificacao</Text>

            <Field label="Nome completo *" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            <Field label="CPF" value={cpf} onChangeText={(v: string) => setCpf(maskCpf(v))} keyboardType="numeric" placeholder="000.000.000-00" maxLength={14} />
            <Row>
              <Field label="Telefone" value={phone} onChangeText={(v: string) => setPhone(maskPhone(v))} keyboardType="phone-pad" placeholder="(00) 00000-0000" maxLength={15} style={{ flex: 1 }} />
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={{ flex: 1 }} />
            </Row>
            <Row>
              <Field label="Data nasc." value={birthDateBR} onChangeText={(v: string) => setBirthDateBR(maskDateBR(v))} keyboardType="numeric" placeholder="DD/MM/AAAA" maxLength={10} style={{ flex: 1 }} />
              <GenderSelect value={gender} onChange={setGender} />
            </Row>

            <Text style={[s.sectionLabel, { marginTop: 16 }]}>Ficha clinica</Text>

            <Field label="Alergias" value={allergies} onChangeText={setAllergies} multiline />
            <Field label="Historico medico" value={medicalHistory} onChangeText={setMedicalHistory} multiline />
            <Field label="Medicamentos em uso" value={medications} onChangeText={setMedications} multiline />
            <Field label="Convenio" value={insuranceName} onChangeText={setInsuranceName} placeholder="Ex: Amil, Unimed..." />

            <Pressable onPress={() => setLgpdConsent(!lgpdConsent)} style={[s.lgpdBox, lgpdConsent && s.lgpdBoxActive]}>
              <View style={[s.checkbox, lgpdConsent && s.checkboxActive]}>
                {lgpdConsent && <Icon name="check" size={12} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.lgpdTitle}>Consentimento LGPD Art. 11 *</Text>
                <Text style={s.lgpdText}>O paciente autoriza o tratamento de dados de saude conforme a Lei 13.709/2018. Obrigatorio para cadastro.</Text>
              </View>
            </Pressable>

            {error && <Text style={s.error}>{error}</Text>}
          </ScrollView>

          <View style={s.footer}>
            <Pressable onPress={handleClose} style={[s.btn, s.btnGhost]} disabled={createMut.isPending}>
              <Text style={s.btnGhostText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSubmit} style={[s.btn, s.btnPrimary, createMut.isPending && { opacity: 0.6 }]} disabled={createMut.isPending}>
              {createMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Cadastrar paciente</Text>}
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
      <TextInput
        {...rest}
        style={[s.input, multiline && s.inputMultiline]}
        placeholderTextColor={Colors.ink3}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

function Row({ children }: any) {
  return <View style={{ flexDirection: "row", gap: 8 }}>{children}</View>;
}

function GenderSelect({ value, onChange }: any) {
  const opts: Array<{ v: "M" | "F" | "outro" | ""; l: string }> = [
    { v: "", l: "-" }, { v: "M", l: "M" }, { v: "F", l: "F" }, { v: "outro", l: "Outro" },
  ];
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={s.fieldLabel}>Sexo</Text>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {opts.map(o => (
          <Pressable key={o.v} onPress={() => onChange(o.v)} style={[s.pill, value === o.v && s.pillActive]}>
            <Text style={[s.pillText, value === o.v && s.pillTextActive]}>{o.l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.bg2 || "#0f0f1e", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", borderWidth: 1, borderColor: Colors.border, borderBottomWidth: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  form: { padding: 20, gap: 10, paddingBottom: 30 },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: Colors.violet3, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  fieldLabel: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  input: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink } as any,
  inputMultiline: { minHeight: 60, textAlignVertical: "top" } as any,
  pill: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  pillActive: { backgroundColor: Colors.violet || "#6d28d9", borderColor: Colors.violet || "#6d28d9" },
  pillText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  pillTextActive: { color: "#fff" },
  lgpdBox: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, marginTop: 6 },
  lgpdBoxActive: { borderColor: Colors.violet3 || "#a78bfa", backgroundColor: "rgba(109,40,217,0.08)" },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center", marginTop: 2 },
  checkboxActive: { backgroundColor: Colors.violet || "#6d28d9", borderColor: Colors.violet || "#6d28d9" },
  lgpdTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink, marginBottom: 2 },
  lgpdText: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  error: { color: "#EF4444", fontSize: 12, textAlign: "center", marginTop: 6 },
  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  btnPrimary: { backgroundColor: Colors.violet || "#6d28d9" },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

export default NewPatientModal;
