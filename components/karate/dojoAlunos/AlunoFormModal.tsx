// ============================================================
// AlunoFormModal — criar/editar aluno do dojô (F2)
//
// Modal simples de 1 tela com seções (não é wizard: o cadastro cabe
// numa tela; o DNA TrocaModal fica pro fluxo de importação, que é
// multi-passo de verdade).
//
// Regra da casa "dado faltante ≠ pendência": o ÚNICO campo obrigatório
// é o nome — salvar incompleto é ok e silencioso. Exceção (LGPD,
// espelha o 422 do backend): menor de 18 exige responsável vinculado.
// A seção Responsável fica destacada quando a idade < 18.
//
// Datas: input DD/MM/AAAA mascarado + conversão string-only (tz-safe);
// a idade aparece ao lado assim que o nascimento é preenchido.
// Erros da API (422/409) caem no campo certo via mapStudentSaveError.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { FormField } from "@/components/karate/FormField";
import {
  karateDojoStudentsApi, DojoStudent, DojoStudentPayload, DojoStudentSex,
  DojoStudentStatus, DojoStudentGuardianRef,
} from "@/services/karateDojoStudentsApi";
import { GuardianPicker } from "./GuardianPicker";
import {
  COMMON_BELTS, beltOrderForLabel, ageFromISO, isoToBR, brToISO,
  maskDateBR, maskCpf, onlyDigits, mapStudentSaveError, StudentErrorField,
} from "./helpers";

interface Props {
  visible: boolean;
  federationId: string;
  /** null = criar; preenchido = editar. */
  student: DojoStudent | null;
  onClose: () => void;
  onSaved: (s: DojoStudent) => void;
}

const SEX_OPTIONS: { key: DojoStudentSex; label: string }[] = [
  { key: "M", label: "Masculino" },
  { key: "F", label: "Feminino" },
  { key: "other", label: "Outro" },
];

const STATUS_OPTIONS: { key: DojoStudentStatus; label: string }[] = [
  { key: "active", label: "Ativo" },
  { key: "inactive", label: "Inativo" },
];

export function AlunoFormModal({ visible, federationId, student, onClose, onSaved }: Props) {
  const editing = !!student;
  const [fullName, setFullName] = useState("");
  const [birthBR, setBirthBR] = useState("");
  const [cpf, setCpf] = useState("");
  const [sex, setSex] = useState<DojoStudentSex | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [beltLabel, setBeltLabel] = useState<string | null>(null);
  const [beltFree, setBeltFree] = useState(false);
  const [beltFreeText, setBeltFreeText] = useState("");
  const [status, setStatus] = useState<DojoStudentStatus>("active");
  const [enrolledBR, setEnrolledBR] = useState("");
  const [guardian, setGuardian] = useState<DojoStudentGuardianRef | null>(null);
  const [consent, setConsent] = useState(false);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<StudentErrorField, string>>>({});
  const [saving, setSaving] = useState(false);

  // Hidrata ao abrir (criar = limpo; editar = dados do aluno).
  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setSaving(false);
    if (student) {
      setFullName(student.full_name ?? "");
      setBirthBR(isoToBR(student.birth_date));
      setCpf(student.cpf ? maskCpf(student.cpf) : "");
      setSex(student.sex ?? null);
      setPhone(student.phone ?? "");
      setEmail(student.email ?? "");
      const label = student.belt_label ?? null;
      const isCommon = !!label && COMMON_BELTS.some((b) => b.label.toLowerCase() === label.trim().toLowerCase());
      setBeltFree(!!label && !isCommon);
      setBeltFreeText(label && !isCommon ? label : "");
      setBeltLabel(isCommon ? label : null);
      setStatus(student.status ?? "active");
      setEnrolledBR(isoToBR(student.enrolled_at));
      setGuardian(student.guardian ?? null);
      setConsent(student.consent_lgpd === true);
      setNotes(student.notes ?? "");
    } else {
      setFullName("");
      setBirthBR("");
      setCpf("");
      setSex(null);
      setPhone("");
      setEmail("");
      setBeltLabel(null);
      setBeltFree(false);
      setBeltFreeText("");
      setStatus("active");
      setEnrolledBR("");
      setGuardian(null);
      setConsent(false);
      setNotes("");
    }
  }, [visible, student]);

  const birthISO = brToISO(birthBR);
  const age = birthISO ? ageFromISO(birthISO) : null;
  const isMinor = age != null && age < 18;
  const effectiveBelt = beltFree ? (beltFreeText.trim() || null) : beltLabel;

  const save = async () => {
    const errs: Partial<Record<StudentErrorField, string>> = {};
    if (!fullName.trim()) errs.full_name = "Informe o nome do aluno — é o único campo obrigatório.";
    if (birthBR.trim() && !birthISO) errs.birth_date = "Data inválida. Use DD/MM/AAAA.";
    const enrolledISO = brToISO(enrolledBR);
    if (enrolledBR.trim() && !enrolledISO) errs.general = "Data de início inválida. Use DD/MM/AAAA.";
    const cpfDigits = onlyDigits(cpf);
    if (cpfDigits.length > 0 && cpfDigits.length !== 11) errs.cpf = "CPF incompleto — são 11 dígitos.";
    // Única exceção à regra "dado faltante ≠ pendência": menor sem responsável (LGPD).
    if (isMinor && !guardian) errs.guardian = "Aluno menor de 18 anos precisa de um responsável vinculado (LGPD).";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    const payload: DojoStudentPayload = {
      full_name: fullName.trim(),
      birth_date: birthISO,
      cpf: cpfDigits || null,
      sex,
      phone: phone.trim() || null,
      email: email.trim() || null,
      belt_label: effectiveBelt,
      belt_order: beltOrderForLabel(effectiveBelt),
      status,
      guardian_id: guardian?.id ?? null,
      consent_lgpd: consent,
      notes: notes.trim() || null,
      enrolled_at: enrolledISO,
    };

    setSaving(true);
    setErrors({});
    try {
      const saved = student
        ? await karateDojoStudentsApi.updateStudent(federationId, student.id, payload)
        : await karateDojoStudentsApi.createStudent(federationId, payload);
      onSaved(saved);
    } catch (e: any) {
      const m = mapStudentSaveError(e);
      setErrors({ [m.field]: m.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.headTitle}>{editing ? "Editar aluno" : "Novo aluno"}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" style={styles.closeBtn}>
              <Icon name="close" size={18} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.body}>
            <Text style={styles.lead}>
              Só o nome é obrigatório — dá para completar o resto depois. A exceção: menor de 18 anos precisa de responsável (LGPD).
            </Text>

            <Text style={styles.section}>Dados do aluno</Text>
            <FormField
              label="Nome completo"
              required
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nome do aluno"
              error={errors.full_name}
            />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Nascimento"
                  value={birthBR}
                  onChangeText={(t) => setBirthBR(maskDateBR(t))}
                  placeholder="DD/MM/AAAA"
                  keyboardType="numeric"
                  error={errors.birth_date}
                  hint={age != null ? `${age} anos${isMinor ? " — exige responsável" : ""}` : undefined}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="CPF"
                  value={cpf}
                  onChangeText={(t) => setCpf(maskCpf(t))}
                  placeholder="000.000.000-00"
                  keyboardType="numeric"
                  error={errors.cpf}
                />
              </View>
            </View>

            <Text style={styles.label}>Sexo</Text>
            <View style={styles.chips}>
              {SEX_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, sex === o.key && styles.chipOn]}
                  onPress={() => setSex(sex === o.key ? null : o.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sex === o.key }}
                >
                  <Text style={[styles.chipTxt, sex === o.key && styles.chipTxtOn]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Faixa</Text>
            <View style={styles.chips}>
              {COMMON_BELTS.map((b) => {
                const on = !beltFree && beltLabel === b.label;
                return (
                  <TouchableOpacity
                    key={b.label}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => {
                      setBeltFree(false);
                      setBeltLabel(on ? null : b.label);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{b.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.chip, beltFree && styles.chipOn]}
                onPress={() => setBeltFree(!beltFree)}
                accessibilityRole="button"
                accessibilityState={{ selected: beltFree }}
              >
                <Text style={[styles.chipTxt, beltFree && styles.chipTxtOn]}>Outra…</Text>
              </TouchableOpacity>
            </View>
            {beltFree && (
              <FormField
                label="Faixa (texto livre)"
                value={beltFreeText}
                onChangeText={setBeltFreeText}
                placeholder='Ex.: "Preta 2º Dan"'
                hint="Faixa fora da lista comum não entra na ordenação da pirâmide."
              />
            )}

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Início no dojô"
                  value={enrolledBR}
                  onChangeText={(t) => setEnrolledBR(maskDateBR(t))}
                  placeholder="DD/MM/AAAA"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Status</Text>
                <View style={styles.chips}>
                  {STATUS_OPTIONS.map((o) => (
                    <TouchableOpacity
                      key={o.key}
                      style={[styles.chip, status === o.key && styles.chipOn]}
                      onPress={() => setStatus(o.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: status === o.key }}
                    >
                      <Text style={[styles.chipTxt, status === o.key && styles.chipTxtOn]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.section}>Contato</Text>
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="Telefone"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(91) 90000-0000"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@exemplo.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  error={errors.email}
                />
              </View>
            </View>

            <View style={[styles.guardianBox, isMinor && styles.guardianBoxMinor]}>
              <Text style={styles.section2}>
                Responsável {isMinor ? "· obrigatório para menor de 18" : "· opcional para adulto"}
              </Text>
              <GuardianPicker
                federationId={federationId}
                value={guardian}
                onChange={(g) => {
                  setGuardian(g);
                  if (g) setErrors((prev) => ({ ...prev, guardian: undefined }));
                }}
                errorText={errors.guardian ?? null}
              />
            </View>

            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setConsent(!consent)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
            >
              <View style={[styles.checkbox, consent && styles.checkboxOn]}>
                {consent && <Icon name="checkmark" size={12} color="#fdf8f2" />}
              </View>
              <Text style={styles.consentTxt}>
                Tenho o consentimento (LGPD) do aluno ou do responsável para guardar estes dados.
              </Text>
            </TouchableOpacity>

            <FormField
              label="Observações"
              value={notes}
              onChangeText={setNotes}
              placeholder="Anotações internas do dojô"
              multiline
              numberOfLines={3}
            />

            {!!errors.general && <Text style={styles.generalErr}>{errors.general}</Text>}
          </ScrollView>

          <View style={styles.foot}>
            <KarateButton label="Cancelar" variant="ghost" size="md" onPress={onClose} style={{ flex: 1 }} />
            <KarateButton
              label={editing ? "Salvar alterações" : "Cadastrar aluno"}
              variant="sumi"
              size="md"
              onPress={save}
              loading={saving}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 16 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 620, maxHeight: "92%", backgroundColor: "#fdf8f2", borderRadius: 16, overflow: "hidden" } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  headTitle: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  closeBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" } as ViewStyle,
  body: { padding: 16, gap: 12 } as ViewStyle,
  lead: { fontSize: 12.5, color: KarateColors.ink3, lineHeight: 18 } as TextStyle,
  section: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 4 } as TextStyle,
  section2: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  label: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, letterSpacing: 0.2, marginBottom: 4 } as TextStyle,
  row2: { flexDirection: "row", gap: 10 } as ViewStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  chipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  guardianBox: { gap: 8, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.surface, marginTop: 4 } as ViewStyle,
  guardianBoxMinor: { borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  consentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 } as ViewStyle,
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" } as ViewStyle,
  checkboxOn: { backgroundColor: KarateColors.ink, borderColor: KarateColors.ink } as ViewStyle,
  consentTxt: { flex: 1, fontSize: 12, color: KarateColors.ink2, lineHeight: 17 } as TextStyle,
  generalErr: { fontSize: 12.5, color: KarateColors.danger, fontWeight: "600", lineHeight: 18 } as TextStyle,
  foot: { flexDirection: "row", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
});
