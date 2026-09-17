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
//
// PR29 (2026-04-28): photo_url + WebcamCapture (3o lugar pedido).
// Avatar 56px no topo da secao IDENTIFICACAO com botao pra capturar
// ou trocar foto. Persistido no submit junto com outros campos.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { todayLocalString } from "@/utils/dateOnly";
import {
  Animated, Modal, View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, ActivityIndicator, Platform, useWindowDimensions, Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { DentalForm } from "@/constants/dental-tokens";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api";
import { maskCpf, maskPhone, maskDateBR, brDateToISO, onlyDigits, isValidCpf } from "@/utils/mask";
import { WebcamCapture } from "@/components/verticals/odonto/WebcamCapture";

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
  /** PR29: foto do paciente (data URL ou URL backend) */
  photo_url?: string | null;
  created_at?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: (patient: PatientFormData) => void;
  mode?: "create" | "edit";
  patient?: PatientFormData | null;
  /** Pre-preenche o nome — ex: texto digitado na busca do NewAppointmentModal. */
  initialName?: string;
}

interface FieldErrors {
  fullName?: string;
  cpf?: string;
  birthDate?: string;
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
// Hoje no fuso local, formato YYYY-MM-DD — comparavel lexicograficamente com o
// ISO de brDateToISO (mesmo formato largura-fixa).

export function PatientFormModal({ visible, onClose, onSaved, mode = "create", patient, initialName }: Props) {
  const cid = useAuthStore().company?.id;
  const qc = useQueryClient();
  const router = useRouter();
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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cepLookupLoading, setCepLookupLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [cpfDuplicate, setCpfDuplicate] = useState<{ patientId: string; patientName: string } | null>(null);
  // Ref (nao state) porque precisa estar atualizado *antes* do proximo
  // mutate() — "Cadastrar mesmo assim" dispara o submit na mesma acao que
  // liga a flag, sem esperar um re-render.
  const allowDuplicateCpfRef = useRef(false);

  // Scroll-to-erro (mesmo padrao do AlunoFormModal): mede a posicao do
  // wrapper do campo via measureLayout contra o node interno do proprio
  // ScrollView e rola ate ele; depois foca o input.
  const scrollRef = useRef<ScrollView>(null);
  const fullNameFieldRef = useRef<View>(null);
  const cpfFieldRef = useRef<View>(null);
  const birthDateFieldRef = useRef<View>(null);
  const fullNameInputRef = useRef<TextInput>(null);
  const cpfInputRef = useRef<TextInput>(null);
  const birthDateInputRef = useRef<TextInput>(null);
  const fieldRefs: Record<keyof FieldErrors, React.RefObject<View>> = {
    fullName: fullNameFieldRef,
    cpf: cpfFieldRef,
    birthDate: birthDateFieldRef,
  };
  const fieldInputRefs: Record<keyof FieldErrors, React.RefObject<TextInput>> = {
    fullName: fullNameInputRef,
    cpf: cpfInputRef,
    birthDate: birthDateInputRef,
  };

  function scrollToField(key: keyof FieldErrors) {
    const node = fieldRefs[key].current as any;
    const scrollNode = scrollRef.current as any;
    if (node && scrollNode && typeof node.measureLayout === "function") {
      try {
        const innerNode = typeof scrollNode.getInnerViewNode === "function"
          ? scrollNode.getInnerViewNode()
          : scrollNode;
        node.measureLayout(
          innerNode,
          (_x: number, y: number) => scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true }),
          () => { /* falha ao medir — melhor nao rolar do que quebrar o modal */ }
        );
      } catch {
        // silencioso — formulario segue usavel mesmo sem o auto-scroll
      }
    }
    // Pequeno delay pra nao competir com o scrollTo (web em particular
    // ignora o focus se disparado no mesmo tick de um scroll programatico).
    setTimeout(() => fieldInputRefs[key].current?.focus?.(), 60);
  }

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
    setInsuranceName(""); setPhotoUrl(null); setError(null);
    setFieldErrors({}); setCpfDuplicate(null);
    allowDuplicateCpfRef.current = false;
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
      setPhotoUrl(patient.photo_url || null);
      setError(null);
      setFieldErrors({}); setCpfDuplicate(null);
      allowDuplicateCpfRef.current = false;
    } else {
      reset();
      // Cadastro rapido a partir da busca do NewAppointmentModal: o nome ja
      // digitado nao pode se perder ao abrir o form completo.
      if (initialName) setFullName(initialName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isEdit, patient?.id, initialName]);

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
        photo_url: photoUrl || null,
      };
      if (isEdit && patient?.id) {
        return request(`/companies/${cid}/dental/patients/${patient.id}`, { method: "PATCH", body });
      }
      return request(`/companies/${cid}/dental/patients`, {
        method: "POST",
        body: {
          ...body,
          lgpd_consent: true,
          ...(allowDuplicateCpfRef.current ? { allow_duplicate_cpf: true } : {}),
        },
      });
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["dental-patients"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onSaved?.(res?.patient);
      onClose();
    },
    onError: (err: any) => {
      const status = err?.status;
      const code = err?.data?.code;
      // 409: CPF ja cadastrado em outro paciente — o backend manda o nome e
      // id do dono atual pra oferecer "Abrir ficha" ou forcar o cadastro.
      if (status === 409 && code === "CPF_DUPLICADO") {
        setCpfDuplicate({ patientId: err.data.patient_id, patientName: err.data.patient_name });
        setError(null);
        scrollToField("cpf");
        return;
      }
      // 400: data de nascimento no futuro escapou da validacao client-side
      // (ex: relogio do dispositivo errado) — o backend e a fonte da verdade.
      if (status === 400 && code === "BIRTH_DATE_FUTURE") {
        setFieldErrors((prev) => ({ ...prev, birthDate: "Data de nascimento não pode ser no futuro" }));
        setError("Corrija os campos destacados acima");
        scrollToField("birthDate");
        return;
      }
      setError(err?.data?.error || err?.message || (isEdit ? "Erro ao atualizar paciente" : "Erro ao cadastrar paciente"));
    },
  });

  function handleSubmit() {
    setError(null);
    setCpfDuplicate(null);

    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = "Nome é obrigatório";
    if (cpf.trim() && !isValidCpf(cpf)) errors.cpf = "CPF inválido";
    if (birthDateBR.trim()) {
      const iso = brDateToISO(birthDateBR);
      if (!iso) errors.birthDate = "Data de nascimento inválida (use DD/MM/AAAA)";
      else if (iso > todayLocalString()) errors.birthDate = "Data de nascimento não pode ser no futuro";
    }
    setFieldErrors(errors);

    const order: Array<keyof FieldErrors> = ["fullName", "cpf", "birthDate"];
    const firstInvalid = order.find((k) => errors[k]);
    if (firstInvalid) {
      setError("Corrija os campos destacados acima");
      scrollToField(firstInvalid);
      return;
    }

    allowDuplicateCpfRef.current = false;
    saveMut.mutate();
  }

  function handleOpenDuplicateFicha() {
    if (!cpfDuplicate) return;
    const id = cpfDuplicate.patientId;
    onClose();
    router.push(`/dental/(clinic)/pacientes?open_patient=${id}` as any);
  }
  function handleForceDuplicateCpf() {
    allowDuplicateCpfRef.current = true;
    setCpfDuplicate(null);
    saveMut.mutate();
  }
  function handleClose() {
    if (saveMut.isPending) return;
    onClose();
  }

  const initials = (fullName || "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

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

            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.form} showsVerticalScrollIndicator={false}>
              {/* PR29: Avatar + botao webcam no topo */}
              <View style={s.photoBlock}>
                <View style={s.avatarWrap}>
                  {photoUrl ? (
                    <Image source={{ uri: photoUrl }} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, { alignItems: "center", justifyContent: "center", backgroundColor: "#06B6D4" }]}>
                      <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>{initials}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.photoLabel}>Foto do paciente</Text>
                  <Text style={s.photoHint}>Opcional. Use a webcam ou selecione uma imagem.</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable onPress={() => setShowCamera(true)} style={s.photoBtn}>
                      <Text style={s.photoBtnText}>📷 {photoUrl ? "Trocar" : "Tirar foto"}</Text>
                    </Pressable>
                    {photoUrl && (
                      <Pressable onPress={() => setPhotoUrl(null)} style={[s.photoBtn, { backgroundColor: "transparent", borderColor: "rgba(239,68,68,0.35)" }]}>
                        <Text style={[s.photoBtnText, { color: "#EF4444" }]}>Remover</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>

              <Text style={s.sectionLabel}>IDENTIFICAÇÃO</Text>
              <View ref={fullNameFieldRef}>
                <Field
                  label="Nome completo *"
                  value={fullName}
                  onChangeText={(v: string) => { setFullName(v); if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: undefined })); }}
                  autoCapitalize="words"
                  inputRef={fullNameInputRef}
                  errorText={fieldErrors.fullName}
                  testID="patient-form-fullname"
                />
              </View>
              <View ref={cpfFieldRef}>
                <Field
                  label="CPF"
                  value={cpf}
                  onChangeText={(v: string) => {
                    setCpf(maskCpf(v));
                    if (fieldErrors.cpf) setFieldErrors((p) => ({ ...p, cpf: undefined }));
                    if (cpfDuplicate) setCpfDuplicate(null);
                  }}
                  keyboardType="numeric"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  inputRef={cpfInputRef}
                  errorText={fieldErrors.cpf}
                  testID="patient-form-cpf"
                />
                {cpfDuplicate && (
                  <View style={s.cpfDupBox} testID="patient-form-cpfdup-box">
                    <Text style={s.cpfDupText}>
                      Já existe um paciente com este CPF: {cpfDuplicate.patientName}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                      <Pressable onPress={handleOpenDuplicateFicha} style={s.cpfDupBtn} testID="patient-form-cpfdup-open">
                        <Text style={s.cpfDupBtnText}>Abrir ficha</Text>
                      </Pressable>
                      <Pressable onPress={handleForceDuplicateCpf} style={[s.cpfDupBtn, s.cpfDupBtnGhost]} testID="patient-form-cpfdup-force">
                        <Text style={[s.cpfDupBtnText, s.cpfDupBtnGhostText]}>Cadastrar mesmo assim</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
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
                <View style={{ flex: 1 }} ref={birthDateFieldRef}>
                  <Field
                    label="Data de nascimento"
                    value={birthDateBR}
                    onChangeText={(v: string) => {
                      setBirthDateBR(maskDateBR(v));
                      if (fieldErrors.birthDate) setFieldErrors((p) => ({ ...p, birthDate: undefined }));
                    }}
                    keyboardType="numeric"
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    inputRef={birthDateInputRef}
                    errorText={fieldErrors.birthDate}
                    testID="patient-form-birthdate"
                  />
                </View>
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

              {error && <Text style={s.error} testID="patient-form-summary-error">{error}</Text>}
            </ScrollView>

            <View style={s.footer}>
              <Pressable onPress={handleClose} style={[s.btn, s.btnGhost]} disabled={saveMut.isPending}>
                <Text style={s.btnGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                style={[s.btn, s.btnPrimary, saveMut.isPending && { opacity: 0.6 }]}
                disabled={saveMut.isPending}
                testID="patient-form-submit"
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

      <WebcamCapture
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={(dataUrl) => setPhotoUrl(dataUrl)}
        title="Foto do paciente"
        hint={fullName ? `Capturando foto de ${fullName}` : "Posicione o paciente no enquadramento"}
        facing="user"
      />
    </Modal>
  );
}

function Field(props: any) {
  const { label, style, multiline, errorText, inputRef, testID, ...rest } = props;
  return (
    <View style={[{ gap: 4 }, style]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        ref={inputRef}
        testID={testID}
        {...rest}
        style={[s.input, multiline && s.inputMultiline, errorText && s.inputError]}
        placeholderTextColor={Colors.ink3}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
      {errorText ? <Text style={s.fieldErrorText} testID={testID ? `${testID}-error` : undefined}>{errorText}</Text> : null}
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
  photoBlock: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, marginBottom: 10, backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  avatarWrap: { position: "relative" },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  photoLabel: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  photoHint: { fontSize: 11, color: Colors.ink3 },
  photoBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#06B6D4", borderWidth: 1, borderColor: "#06B6D4" },
  photoBtnText: { fontSize: 11, color: "#fff", fontWeight: "700" },
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
  inputError: { borderColor: "#EF4444" },
  fieldErrorText: { color: "#EF4444", fontSize: 11, marginTop: 2 },
  cpfDupBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
  },
  cpfDupText: { fontSize: 12, color: "#EF4444", fontWeight: "600" },
  cpfDupBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: "#EF4444" },
  cpfDupBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  cpfDupBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(239,68,68,0.35)" },
  cpfDupBtnGhostText: { color: "#EF4444" },
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
