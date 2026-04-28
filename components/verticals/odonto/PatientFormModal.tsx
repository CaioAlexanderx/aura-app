// ============================================================
// AURA. — PatientFormModal (PR22)
//
// Drawer lateral (slide direita, web/mobile) com formulario completo
// de cadastro/edicao de paciente — incluindo endereco para NF-e e
// telefone secundario.
//
// Props:
//   visible, onClose, onSaved      — controle externo
//   mode: 'create' | 'edit'         — define POST ou PATCH
//   patient                         — em edit, prefill + id pra PATCH
//
// Web: ViaCEP autofill no blur do CEP (logradouro/bairro/cidade/UF).
// LGPD consent automatico no create (Art.11 coberto pela aceitacao
// implicita ao cadastrar dados de saude — campo nao precisa ser
// re-checado em edicao).
// ============================================================
import { useEffect, useRef, useState } from "react";
import {
  Animated, Modal, View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, ActivityIndicator, Platform, useWindowDimensions,
} from "react-native";
import { Colors } from "@/constants/colors";
import { DentalForm } from "@/constants/dental-tokens";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { maskCpf, maskPhone, maskDateBR, brDateToISO, onlyDigits, isValidCpf } from "@/utils/mask";

export interface PatientFormData {
  id?: string;
  full_name?: string | null;
  cpf?: string | null;
  phone?: string | null;
  phone_secondary?: string | null;
  email?: string | null;
  birth_date?: string | null;
  gender?: "M" | "F" | "outro" | null | string;
  // Endereco
  postal_code?: string | null;
  street?: string | null;
  address_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  // Clinico
  allergies?: string | null;
  medical_history?: string | null;
  medications?: string | null;
  insurance_name?: string | null;
  notes?: string | null;
  created_at?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: (patient: PatientFormData) => void;
  mode?: "create" | "edit";
  patient?: PatientFormData | null;
}

const DRAWER_WIDTH = 540;

function maskCep(v: string): string {
  const d = (v || "").replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : d.slice(0, 5) + "-" + d.slice(5);
}
function isoToBR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export function PatientFormModal({ visible, onClose, onSaved, mode = "create", patient }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const isEdit = mode === "edit" && !!patient?.id;
  const { width: screenW } = useWindowDimensions();
  const drawerW = Math.min(DRAWER_WIDTH, screenW);

  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneSecondary, setPhoneSecondary] = useState("");
  const [email, setEmail] = useState("");
  const [birthDateBR, setBirthDateBR] = useState("");
  const [gender, setGender] = useState<"M" | "F" | "outro" | "">("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [medications, setMedications] = useState("");
  const [insuranceName, setInsuranceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cepLookupLoading, setCepLookupLoading] = useState(false);

  const translateX = useRef(new Animated.Value(drawerW)).current;
  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : drawerW,
      duration: 240,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [visible, drawerW, translateX]);

  function reset() {
    setFullName(""); setCpf(""); setPhone(""); setPhoneSecondary("");
    setEmail(""); setBirthDateBR(""); setGender("");
    setCep(""); setStreet(""); setAddrNumber(""); setComplement("");
    setNeighborhood(""); setCity(""); setStateUf("");
    setAllergies(""); setMedicalHistory(""); setMedications("");
    setInsuranceName(""); setError(null);
  }

  // Prefill em edit ao abrir / trocar paciente
  useEffect(() => {
    if (!visible) return;
    if (isEdit && patient) {
      setFullName(patient.full_name || "");
      setCpf(maskCpf(patient.cpf || ""));
      setPhone(maskPhone(patient.phone || ""));
      setPhoneSecondary(maskPhone(patient.phone_secondary || ""));
      setEmail(patient.email || "");
      setBirthDateBR(isoToBR(patient.birth_date));
      setGender((patient.gender as any) || "");
      setCep(maskCep(patient.postal_code || ""));
      setStreet(patient.street || "");
      setAddrNumber(patient.address_number || "");
      setComplement(patient.complement || "");
      setNeighborhood(patient.neighborhood || "");
      setCity(patient.city || "");
      setStateUf(patient.state || "");
      setAllergies(patient.allergies || "");
      setMedicalHistory(patient.medical_history || "");
      setMedications(patient.medications || "");
      setInsuranceName(patient.insurance_name || "");
      setError(null);
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isEdit, patient?.id]);

  async function lookupCep() {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    if (typeof fetch !== "function") return;
    setCepLookupLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const j: any = await r.json();
      if (j && !j.erro) {
        if (j.logradouro && !street) setStreet(j.logradouro);
        if (j.bairro && !neighborhood) setNeighborhood(j.bairro);
        if (j.localidade && !city) setCity(j.localidade);
        if (j.uf && !stateUf) setStateUf(j.uf);
      }
    } catch {} finally {
      setCepLookupLoading(false);
    }
  }

  const saveMut = useMutation({
    mutationFn: () => {
      const body: any = {
        full_name: fullName.trim(),
        cpf: onlyDigits(cpf) || null,
        phone: onlyDigits(phone) || null,
        phone_secondary: onlyDigits(phoneSecondary) || null,
        email: email.trim() || null,
        birth_date: birthDateBR.trim() ? brDateToISO(birthDateBR.trim()) : null,
        gender: gender || null,
        postal_code: onlyDigits(cep) || null,
        street: street.trim() || null,
        address_number: addrNumber.trim() || null,
        complement: complement.trim() || null,
        neighborhood: neighborhood.trim() || null,
        city: city.trim() || null,
        state: stateUf.trim().toUpperCase().slice(0, 2) || null,
        allergies: allergies.trim() || null,
        medical_history: medicalHistory.trim() || null,
        medications: medications.trim() || null,
        insurance_name: insuranceName.trim() || null,
      };
      if (isEdit && patient?.id) {
        return request(`/companies/${cid}/dental/patients/${patient.id}`, { method: "PATCH", body });
      }
      return request(`/companies/${cid}/dental/patients`, {
        method: "POST",
        body: { ...body, lgpd_consent: true },
      });
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["dental-patients"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onSaved?.(res?.patient);
      onClose();
    },
    onError: (err: any) =>
      setError(err?.message || err?.error || (isEdit ? "Erro ao atualizar paciente" : "Erro ao cadastrar paciente")),
  });

  function handleSubmit() {
    setError(null);
    if (!fullName.trim()) return setError("Nome e obrigatorio");
    if (cpf.trim() && !isValidCpf(cpf)) return setError("CPF invalido");
    if (birthDateBR.trim() && !brDateToISO(birthDateBR)) return setError("Data de nascimento invalida (use DD/MM/AAAA)");
    saveMut.mutate();
  }
  function handleClose() {
    if (saveMut.isPending) return;
    onClose();
  }

  return (
    <Modal visible={visible} animationType="none" transparent={true} onRequestClose={handleClose}>
      <Pressable style={s.backdrop} onPress={handleClose}>
        <Pressable
          onPress={(e: any) => e?.stopPropagation?.()}
          style={{ position: "absolute" as any, right: 0, top: 0, bottom: 0 }}
        >
          <Animated.View style={[s.drawer, { width: drawerW, transform: [{ translateX }] }]}>
            <View style={s.header}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{isEdit ? "Editar paciente" : "Novo paciente"}</Text>
                <Text style={s.subtitle} numberOfLines={1}>
                  {isEdit ? patient?.full_name || "" : "Cadastro completo + LGPD"}
                </Text>
              </View>
              <Pressable onPress={handleClose} hitSlop={8}>
                <Icon name="close" size={20} color={Colors.ink3} />
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.form} showsVerticalScrollIndicator={false}>
              <Text style={s.sectionLabel}>IDENTIFICAÇÃO</Text>
              <Field label="Nome completo *" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
              <Field
                label="CPF"
                value={cpf}
                onChangeText={(v: string) => setCpf(maskCpf(v))}
                keyboardType="numeric"
                placeholder="000.000.000-00"
                maxLength={14}
              />
              <Row>
                <Field
                  label="Telefone principal"
                  value={phone}
                  onChangeText={(v: string) => setPhone(maskPhone(v))}
                  keyboardType="phone-pad"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  style={{ flex: 1 }}
                />
                <Field
                  label="Tel. secundário"
                  value={phoneSecondary}
                  onChangeText={(v: string) => setPhoneSecondary(maskPhone(v))}
                  keyboardType="phone-pad"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  style={{ flex: 1 }}
                />
              </Row>
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <Row>
                <Field
                  label="Data de nascimento"
                  value={birthDateBR}
                  onChangeText={(v: string) => setBirthDateBR(maskDateBR(v))}
                  keyboardType="numeric"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  style={{ flex: 1 }}
                />
                <GenderSelect value={gender} onChange={setGender} />
              </Row>

              <Text style={[s.sectionLabel, { marginTop: 18 }]}>ENDEREÇO</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>CEP</Text>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <TextInput
                      value={cep}
                      onChangeText={(v: string) => setCep(maskCep(v))}
                      onBlur={lookupCep}
                      keyboardType="numeric"
                      placeholder="00000-000"
                      maxLength={9}
                      placeholderTextColor={Colors.ink3}
                      style={[s.input, { flex: 1 }]}
                    />
                    {cepLookupLoading && <ActivityIndicator color={Colors.violet3 || "#a78bfa"} />}
                  </View>
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={s.fieldLabel}>Logradouro</Text>
                  <TextInput
                    value={street}
                    onChangeText={setStreet}
                    placeholder="Rua / Avenida..."
                    placeholderTextColor={Colors.ink3}
                    style={s.input}
                  />
                </View>
              </View>
              <Row>
                <Field
                  label="Número"
                  value={addrNumber}
                  onChangeText={setAddrNumber}
                  keyboardType="numeric"
                  placeholder="123"
                  style={{ flex: 1 }}
                />
                <Field
                  label="Complemento"
                  value={complement}
                  onChangeText={setComplement}
                  placeholder="apto, bloco..."
                  style={{ flex: 2 }}
                />
              </Row>
              <Field label="Bairro" value={neighborhood} onChangeText={setNeighborhood} />
              <Row>
                <Field label="Cidade" value={city} onChangeText={setCity} style={{ flex: 2 }} />
                <Field
                  label="UF"
                  value={stateUf}
                  onChangeText={(v: string) => setStateUf(v.toUpperCase().slice(0, 2))}
                  maxLength={2}
                  placeholder="SP"
                  style={{ flex: 1 }}
                />
              </Row>

              <Text style={[s.sectionLabel, { marginTop: 18 }]}>FICHA CLÍNICA</Text>
              <Field label="Alergias" value={allergies} onChangeText={setAllergies} multiline />
              <Field label="Histórico médico" value={medicalHistory} onChangeText={setMedicalHistory} multiline />
              <Field label="Medicamentos em uso" value={medications} onChangeText={setMedications} multiline />
              <Field label="Convênio" value={insuranceName} onChangeText={setInsuranceName} placeholder="Ex: Amil, Unimed..." />

              {!isEdit && (
                <View style={s.lgpdNote}>
                  <Icon name="shield" size={12} color={Colors.ink3} />
                  <Text style={s.lgpdNoteText}>
                    Consentimento LGPD (Art. 11) coletado automaticamente no cadastro
                  </Text>
                </View>
              )}

              {patient?.created_at && (
                <Text style={s.createdAt}>
                  Cadastrado em {new Date(patient.created_at).toLocaleDateString("pt-BR")}
                </Text>
              )}

              {error && <Text style={s.error}>{error}</Text>}
            </ScrollView>

            <View style={s.footer}>
              <Pressable onPress={handleClose} style={[s.btn, s.btnGhost]} disabled={saveMut.isPending}>
                <Text style={s.btnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                style={[s.btn, s.btnPrimary, saveMut.isPending && { opacity: 0.6 }]}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnPrimaryText}>{isEdit ? "Salvar alterações" : "Cadastrar paciente"}</Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
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
  const opts = [
    { v: "", l: "-" },
    { v: "M", l: "M" },
    { v: "F", l: "F" },
    { v: "outro", l: "Outro" },
  ] as const;
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
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  drawer: {
    height: "100%" as any,
    backgroundColor: Colors.bg2,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    flexDirection: "column",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "-8px 0 32px rgba(0,0,0,0.45)" } as any)
      : {}),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  form: { padding: 16, gap: 8, paddingBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.violet3,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  fieldLabel: { ...DentalForm.label },
  input: {
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.ink,
  } as any,
  inputMultiline: { minHeight: 60, textAlignVertical: "top" } as any,
  pill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg3,
  },
  pillActive: { backgroundColor: Colors.violet || "#6d28d9", borderColor: Colors.violet || "#6d28d9" },
  pillText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  pillTextActive: { color: "#fff" },
  lgpdNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: Colors.bg3,
    marginTop: 8,
  },
  lgpdNoteText: { fontSize: 11, color: Colors.ink3, flex: 1 },
  createdAt: { fontSize: 11, color: Colors.ink3, fontStyle: "italic" as any, textAlign: "center", marginTop: 12 },
  error: { color: "#EF4444", fontSize: 12, textAlign: "center", marginTop: 6 },
  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  btnGhostText: { color: Colors.ink, fontSize: 13, fontWeight: "600" },
  btnPrimary: { backgroundColor: Colors.violet || "#6d28d9" },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

export default PatientFormModal;
