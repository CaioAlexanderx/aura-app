// ============================================================
// ContaAuraWizardModal — KYC de ativação da Conta Aura (F3b)
//
// POST /federation/:id/dojo/billing/baas/activate. Fluxo em 2 passos:
//   1) Identificação — PF/PJ, documento, contato, faturamento/renda
//   2) Endereço      — CEP, logradouro, número, complemento, bairro
//
// Sem lookup automático de CEP (zero dependência nova) — o dojô digita
// o endereço completo. Validação local antes de qualquer POST; erros
// 422 da API mapeados heuristicamente pro campo pela mensagem (mesmo
// padrão de PlanoFormModal), com fallback pra um banner geral.
//
// Prefill: nome/CNPJ/telefone/e-mail vêm de useKarateDojo() (dojoMe,
// GET /dojo/me já carregado pelo shell) quando disponíveis — sempre
// editável, nunca bloqueia o preenchimento manual.
// ============================================================
import React, { useEffect, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, Pressable, ScrollView, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { FormField } from "@/components/karate/FormField";
import { useKarateDojo } from "@/contexts/KarateDojo";
import {
  karateDojoBillingApi, BaasCompanyType, BaasPersonType,
  DojoBaasActivatePayload, DojoBaasActivateResponse,
} from "@/services/karateDojoBillingApi";
import {
  maskCpf, maskCnpj, maskPhone, maskDateBr, brDateToIso, maskCurrency, unmaskNumber, onlyDigits,
} from "@/utils/masks";
import { mapBillingError } from "../helpers";

interface Props {
  visible: boolean;
  federationId: string;
  onClose: () => void;
  onActivated: (result: DojoBaasActivateResponse) => void;
}

const COMPANY_TYPE_OPTIONS: { key: BaasCompanyType; label: string }[] = [
  { key: "MEI", label: "MEI" },
  { key: "LIMITED", label: "Limitada (LTDA)" },
  { key: "INDIVIDUAL", label: "Individual" },
  { key: "ASSOCIATION", label: "Associação" },
];

/** CEP: 00000-000. Máscara local — não faz parte de utils/masks (uso restrito a este wizard). */
function maskCep(value: string): string {
  const digits = (value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function ContaAuraWizardModal({ visible, federationId, onClose, onActivated }: Props) {
  const { dojoMe } = useKarateDojo();

  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [generalErr, setGeneralErr] = useState<string | null>(null);

  const [personType, setPersonType] = useState<BaasPersonType>("JURIDICA");
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [companyType, setCompanyType] = useState<BaasCompanyType | null>(null);
  const [email, setEmail] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [incomeMasked, setIncomeMasked] = useState("0,00");

  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [province, setProvince] = useState("");

  const [nameErr, setNameErr] = useState<string | null>(null);
  const [documentErr, setDocumentErr] = useState<string | null>(null);
  const [birthDateErr, setBirthDateErr] = useState<string | null>(null);
  const [companyTypeErr, setCompanyTypeErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [mobilePhoneErr, setMobilePhoneErr] = useState<string | null>(null);
  const [incomeErr, setIncomeErr] = useState<string | null>(null);
  const [postalCodeErr, setPostalCodeErr] = useState<string | null>(null);
  const [addressErr, setAddressErr] = useState<string | null>(null);
  const [addressNumberErr, setAddressNumberErr] = useState<string | null>(null);
  const [provinceErr, setProvinceErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setGeneralErr(null);
    setNameErr(null); setDocumentErr(null); setBirthDateErr(null); setCompanyTypeErr(null);
    setEmailErr(null); setMobilePhoneErr(null); setIncomeErr(null);
    setPostalCodeErr(null); setAddressErr(null); setAddressNumberErr(null); setProvinceErr(null);

    const hasCnpj = !!dojoMe?.cnpj;
    setPersonType(hasCnpj ? "JURIDICA" : "FISICA");
    setName(dojoMe?.name || "");
    setDocument(dojoMe?.cnpj ? maskCnpj(dojoMe.cnpj) : "");
    setBirthDate("");
    setCompanyType(null);
    setEmail(dojoMe?.email || "");
    setMobilePhone(dojoMe?.phone ? maskPhone(dojoMe.phone) : "");
    setIncomeMasked("0,00");
    setPostalCode("");
    setAddress("");
    setAddressNumber("");
    setComplement("");
    setProvince("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const validateStep1 = (): boolean => {
    let ok = true;
    if (!name.trim()) { setNameErr("Informe o nome."); ok = false; } else setNameErr(null);

    const docDigits = onlyDigits(document);
    if (personType === "FISICA") {
      if (docDigits.length !== 11) { setDocumentErr("CPF inválido."); ok = false; } else setDocumentErr(null);
      if (!birthDate.trim() || !brDateToIso(birthDate)) { setBirthDateErr("Informe uma data de nascimento válida."); ok = false; } else setBirthDateErr(null);
      setCompanyTypeErr(null);
    } else {
      if (docDigits.length !== 14) { setDocumentErr("CNPJ inválido."); ok = false; } else setDocumentErr(null);
      if (!companyType) { setCompanyTypeErr("Selecione o tipo de empresa."); ok = false; } else setCompanyTypeErr(null);
      setBirthDateErr(null);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailErr("E-mail inválido."); ok = false; } else setEmailErr(null);

    const phoneDigits = onlyDigits(mobilePhone);
    if (phoneDigits.length < 10) { setMobilePhoneErr("Telefone inválido."); ok = false; } else setMobilePhoneErr(null);

    const income = parseInt(unmaskNumber(incomeMasked) || "0", 10) / 100;
    if (!(income > 0)) { setIncomeErr("Informe o faturamento/renda mensal."); ok = false; } else setIncomeErr(null);

    return ok;
  };

  const validateStep2 = (): boolean => {
    let ok = true;
    if (onlyDigits(postalCode).length !== 8) { setPostalCodeErr("CEP inválido."); ok = false; } else setPostalCodeErr(null);
    if (!address.trim()) { setAddressErr("Informe o logradouro."); ok = false; } else setAddressErr(null);
    if (!addressNumber.trim()) { setAddressNumberErr("Informe o número."); ok = false; } else setAddressNumberErr(null);
    if (!province.trim()) { setProvinceErr("Informe o bairro."); ok = false; } else setProvinceErr(null);
    return ok;
  };

  const goNext = () => { if (validateStep1()) setStep(2); };
  const goBack = () => setStep(1);

  const submit = async () => {
    if (!validateStep2()) return;
    setSaving(true);
    setGeneralErr(null);

    const income = parseInt(unmaskNumber(incomeMasked) || "0", 10) / 100;
    const payload: DojoBaasActivatePayload = {
      person_type: personType,
      name: name.trim(),
      cpf_cnpj: onlyDigits(document),
      email: email.trim(),
      mobile_phone: onlyDigits(mobilePhone),
      income_value: income,
      address: address.trim(),
      address_number: addressNumber.trim(),
      province: province.trim(),
      postal_code: onlyDigits(postalCode),
    };
    if (personType === "FISICA") {
      payload.birth_date = brDateToIso(birthDate) ?? undefined;
    } else {
      payload.company_type = companyType ?? undefined;
    }
    if (complement.trim()) payload.complement = complement.trim();

    try {
      const res = await karateDojoBillingApi.activateBaas(federationId, payload);
      onActivated(res);
    } catch (e: any) {
      const mapped = mapBillingError(e);
      const msg = mapped.message.toLowerCase();
      if (/cpf|cnpj|documento/.test(msg)) { setStep(1); setDocumentErr(mapped.message); }
      else if (/nascim|birth/.test(msg)) { setStep(1); setBirthDateErr(mapped.message); }
      else if (/tipo de empresa|company.type/.test(msg)) { setStep(1); setCompanyTypeErr(mapped.message); }
      else if (/e-?mail/.test(msg)) { setStep(1); setEmailErr(mapped.message); }
      else if (/telefone|celular|phone/.test(msg)) { setStep(1); setMobilePhoneErr(mapped.message); }
      else if (/renda|faturamento|income/.test(msg)) { setStep(1); setIncomeErr(mapped.message); }
      else if (/cep|postal/.test(msg)) { setStep(2); setPostalCodeErr(mapped.message); }
      else if (/n[uú]mero/.test(msg)) { setStep(2); setAddressNumberErr(mapped.message); }
      else if (/bairro|province/.test(msg)) { setStep(2); setProvinceErr(mapped.message); }
      else if (/endere[cç]o|logradouro|address/.test(msg)) { setStep(2); setAddressErr(mapped.message); }
      else setGeneralErr(mapped.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.card}>
          <View style={s.head}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <Icon name="wallet" size={17} color={KarateColors.primary} />
              <View>
                <Text style={s.title}>Ativar Conta Aura</Text>
                <Text style={s.stepTxt}>Passo {step} de 2 — {step === 1 ? "Identificação" : "Endereço"}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="x" size={20} color={KarateColors.ink3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
            {!!generalErr && (
              <View style={s.errBox}>
                <Icon name="alert" size={16} color={KarateColors.danger} />
                <Text style={s.errBoxTxt}>{generalErr}</Text>
              </View>
            )}

            {step === 1 && (
              <>
                <View>
                  <Text style={s.lbl}>Tipo de pessoa</Text>
                  <View style={s.chips}>
                    <TouchableOpacity
                      style={[s.chip, personType === "FISICA" && s.chipOn]}
                      onPress={() => setPersonType("FISICA")}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: personType === "FISICA" }}
                    >
                      <Text style={[s.chipTxt, personType === "FISICA" && s.chipTxtOn]}>Pessoa física</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.chip, personType === "JURIDICA" && s.chipOn]}
                      onPress={() => setPersonType("JURIDICA")}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: personType === "JURIDICA" }}
                    >
                      <Text style={[s.chipTxt, personType === "JURIDICA" && s.chipTxtOn]}>Pessoa jurídica</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <FormField
                  label={personType === "FISICA" ? "Nome completo" : "Razão social"}
                  required
                  value={name}
                  onChangeText={setName}
                  error={nameErr ?? undefined}
                />

                <FormField
                  label={personType === "FISICA" ? "CPF" : "CNPJ"}
                  required
                  value={document}
                  onChangeText={(v) => setDocument(personType === "FISICA" ? maskCpf(v) : maskCnpj(v))}
                  keyboardType="number-pad"
                  error={documentErr ?? undefined}
                />

                {personType === "FISICA" ? (
                  <FormField
                    label="Data de nascimento"
                    required
                    value={birthDate}
                    onChangeText={(v) => setBirthDate(maskDateBr(v))}
                    keyboardType="number-pad"
                    placeholder="DD/MM/AAAA"
                    error={birthDateErr ?? undefined}
                  />
                ) : (
                  <View>
                    <Text style={s.lbl}>Tipo de empresa <Text style={{ color: KarateColors.danger }}>*</Text></Text>
                    <View style={s.chips}>
                      {COMPANY_TYPE_OPTIONS.map((o) => (
                        <TouchableOpacity
                          key={o.key}
                          style={[s.chip, companyType === o.key && s.chipOn]}
                          onPress={() => setCompanyType(o.key)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: companyType === o.key }}
                        >
                          <Text style={[s.chipTxt, companyType === o.key && s.chipTxtOn]}>{o.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {!!companyTypeErr && <Text style={s.err}>{companyTypeErr}</Text>}
                  </View>
                )}

                <FormField
                  label="E-mail"
                  required
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={emailErr ?? undefined}
                />

                <FormField
                  label="Celular (WhatsApp)"
                  required
                  value={mobilePhone}
                  onChangeText={(v) => setMobilePhone(maskPhone(v))}
                  keyboardType="phone-pad"
                  error={mobilePhoneErr ?? undefined}
                />

                <FormField
                  label={personType === "FISICA" ? "Renda mensal (R$)" : "Faturamento mensal (R$)"}
                  required
                  value={incomeMasked}
                  onChangeText={(v) => setIncomeMasked(maskCurrency(v))}
                  keyboardType="decimal-pad"
                  error={incomeErr ?? undefined}
                />
              </>
            )}

            {step === 2 && (
              <>
                <FormField
                  label="CEP"
                  required
                  value={postalCode}
                  onChangeText={(v) => setPostalCode(maskCep(v))}
                  keyboardType="number-pad"
                  placeholder="00000-000"
                  error={postalCodeErr ?? undefined}
                />
                <FormField
                  label="Logradouro"
                  required
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Rua, avenida..."
                  error={addressErr ?? undefined}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <FormField
                    label="Número"
                    required
                    value={addressNumber}
                    onChangeText={setAddressNumber}
                    keyboardType="number-pad"
                    style={{ flex: 1 }}
                    error={addressNumberErr ?? undefined}
                  />
                  <FormField
                    label="Complemento"
                    value={complement}
                    onChangeText={setComplement}
                    style={{ flex: 2 }}
                  />
                </View>
                <FormField
                  label="Bairro"
                  required
                  value={province}
                  onChangeText={setProvince}
                  error={provinceErr ?? undefined}
                />
                <Text style={s.hint}>Sem busca automática por CEP — preencha o endereço manualmente.</Text>
              </>
            )}
          </ScrollView>

          <View style={s.footer}>
            {step === 1 ? (
              <TouchableOpacity onPress={onClose} style={s.btnGhost} accessibilityRole="button">
                <Text style={s.btnGhostTxt}>Cancelar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={goBack} style={s.btnGhost} accessibilityRole="button" disabled={saving}>
                <Text style={s.btnGhostTxt}>Voltar</Text>
              </TouchableOpacity>
            )}
            {step === 1 ? (
              <KarateButton label="Avançar" variant="sumi" size="md" onPress={goNext} />
            ) : (
              <KarateButton label="Ativar Conta Aura" variant="sumi" size="md" onPress={submit} loading={saving} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { width: "100%", maxWidth: 520, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: KarateColors.border2, maxHeight: "92%" } as ViewStyle,
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  title: { fontFamily: KarateFonts.heading, fontSize: 16, color: KarateColors.ink } as TextStyle,
  stepTxt: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  errBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: KarateColors.dangerSoft, borderRadius: KarateRadius.md, padding: 12 } as ViewStyle,
  errBoxTxt: { flex: 1, fontSize: 12.5, color: KarateColors.danger, lineHeight: 18 } as TextStyle,
  lbl: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginBottom: 6 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  chipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  hint: { fontSize: 11.5, color: KarateColors.ink3, lineHeight: 15 } as TextStyle,
  err: { fontSize: 11, color: KarateColors.danger, fontWeight: "600", marginTop: 4 } as TextStyle,
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border, backgroundColor: KarateColors.glassHi } as ViewStyle,
  btnGhost: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border2 } as ViewStyle,
  btnGhostTxt: { fontSize: 13.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
});
