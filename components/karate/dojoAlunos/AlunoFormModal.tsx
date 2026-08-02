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
//
// F7.0 (30/07/2026 — Aura-backend migration 262): RG + endereço
// completo (zip_code/street/number/complement/neighborhood/city/state).
// O dojô passou a ser FONTE DA IDENTIDADE da pessoa (decisão de
// arquitetura do Caio: "o fluxo de informação sobe, dojô → federação") —
// sem esses campos o dojô não consegue preencher a ficha H1 que a
// federação exige para adotar/federar um aluno. Endereço entra numa
// seção RECOLHIDA por padrão (acordeão) pra não alongar ainda mais um
// formulário que já é longo; abre sozinha ao editar um aluno que já tem
// algo preenchido.
//
// F8.2 (01/08/2026 — pedido do Caio: "a ficha de cadastro do aluno DEVE
// ser igual à ficha de cadastro do praticante da federação"):
//   • Foto: o dojô ganhou o mesmo caminho de upload que o praticante já
//     usa (endpoint dedicado, criado em PR paralelo do backend) — ver
//     FotoSection/fileToBase64 (reusados de praticante-ficha/) e
//     karateDojoStudentsApi.uploadStudentPhoto. Campo permanente:
//     karate_photo_url.
//   • Faixa: Marrom ganha os 3 kyus distintos (3º/2º/1º) e Preta ganha o
//     grau Dan (1º a 10º) — mesma escala oficial FPKT e mesmo de-para
//     (BELT_KYUS/DAN_OPTIONS/buildBeltName) que a ficha do praticante já
//     usa em praticante-detalhe/helpers.ts. Grau é opcional: um aluno já
//     cadastrado com "Marrom" ou "Preta" sem grau continua válido.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { BeltKey, KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { FormField } from "@/components/karate/FormField";
import {
  karateDojoStudentsApi, DojoStudent, DojoStudentPayload, DojoStudentSex,
  DojoStudentStatus, DojoStudentGuardianRef,
} from "@/services/karateDojoStudentsApi";
import { GuardianPicker } from "./GuardianPicker";
import {
  COMMON_BELTS, beltOrderForLabel, parseCommonBelt, ageFromISO, isoToBR, brToISO,
  maskDateBR, maskCpf, maskCep, onlyDigits, mapStudentSaveError, StudentErrorField,
} from "./helpers";
// F8.2: mesmo de-para (kyus/dans) que a ficha do praticante da federação
// já usa — reaproveitado aqui pra ficha do aluno ter a MESMA escala
// oficial FPKT (pedido do Caio: "a ficha de cadastro do aluno DEVE ser
// igual à ficha de cadastro do praticante da federação").
import { BELT_KYUS, DAN_OPTIONS, buildBeltName } from "../praticante-detalhe/helpers";
// F8.2: foto do aluno — MESMO caminho de upload já usado pra foto do
// praticante (endpoint dedicado criado em PR paralelo do backend, mesmo
// padrão do uploadPractitionerPhoto em services/karateApi.ts).
import { FotoSection, fileToBase64 } from "@/components/karate/praticante-ficha/FotoSection";
import { pickFileWeb } from "@/services/studioUploadApi";

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
  const [rg, setRg] = useState("");
  const [sex, setSex] = useState<DojoStudentSex | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // F8.2: base (BeltKey) + grau (kyu/dan) separados — mesmo modelo da
  // ficha do praticante (praticante-ficha/FaixaSection.tsx beltKey/danDeg/
  // kyuDeg), só que aqui os dois graus (kyu de Marrom, dan de Preta)
  // convergem num único `beltDegree` porque só um deles fica visível de
  // cada vez (a base escolhida decide qual sub-seletor aparece).
  const [beltKey, setBeltKey] = useState<BeltKey | null>(null);
  const [beltDegree, setBeltDegree] = useState<number | null>(null);
  const [beltFree, setBeltFree] = useState(false);
  const [beltFreeText, setBeltFreeText] = useState("");
  const [status, setStatus] = useState<DojoStudentStatus>("active");
  const [enrolledBR, setEnrolledBR] = useState("");
  const [guardian, setGuardian] = useState<DojoStudentGuardianRef | null>(null);
  const [consent, setConsent] = useState(false);
  const [notes, setNotes] = useState("");
  // F7.0: endereço — acordeão recolhido por padrão (formulário já é longo).
  const [addressOpen, setAddressOpen] = useState(false);
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [ufState, setUfState] = useState("");
  // F8.2: foto do aluno — mesmo trio de estado que a ficha do praticante
  // usa (PraticanteFichaModal.tsx): preview local (blob URL) até o save,
  // File pendente guardado em ref pro upload rodar depois do create/update.
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const pendingPhotoFile = useRef<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<StudentErrorField, string>>>({});
  const [saving, setSaving] = useState(false);

  // Polish QA 25/07 (item 5): ao falhar a validação o erro renderizava
  // abaixo da área visível do modal — parecia que "Cadastrar aluno" não
  // fazia nada. Fix: refs nos campos que podem errar + scrollTo no
  // ScrollView, medindo a posição via measureLayout contra o node interno
  // do próprio ScrollView (padrão RN-web, sem dependência nova).
  const scrollViewRef = useRef<ScrollView>(null);
  const fullNameFieldRef = useRef<View>(null);
  const birthFieldRef = useRef<View>(null);
  const cpfFieldRef = useRef<View>(null);
  const guardianFieldRef = useRef<View>(null);
  const generalErrRef = useRef<View>(null);

  function scrollToField(ref: React.RefObject<View>) {
    const node = ref.current as any;
    const scrollNode = scrollViewRef.current as any;
    if (!node || !scrollNode || typeof node.measureLayout !== "function") return;
    try {
      const innerNode = typeof scrollNode.getInnerViewNode === "function"
        ? scrollNode.getInnerViewNode()
        : scrollNode;
      node.measureLayout(
        innerNode,
        (_x: number, y: number) => scrollViewRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true }),
        () => { /* falha ao medir — melhor não rolar do que quebrar o modal */ }
      );
    } catch {
      // silencioso — o formulário segue usável mesmo sem o auto-scroll
    }
  }

  // Roda DEPOIS do commit de `errors` (não dentro de save()): o campo de
  // erro geral (generalErrRef) só monta quando errors.general existe, então
  // medir a posição precisa esperar o re-render acontecer primeiro.
  useEffect(() => {
    if (!visible || Object.keys(errors).length === 0) return;
    const order: Array<[StudentErrorField, React.RefObject<View>]> = [
      ["full_name", fullNameFieldRef],
      ["birth_date", birthFieldRef],
      ["cpf", cpfFieldRef],
      ["guardian", guardianFieldRef],
      ["general", generalErrRef],
    ];
    const hit = order.find(([field]) => !!errors[field]);
    if (hit) scrollToField(hit[1]);
  }, [errors, visible]);

  // Hidrata ao abrir (criar = limpo; editar = dados do aluno).
  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setSaving(false);
    if (student) {
      setFullName(student.full_name ?? "");
      setBirthBR(isoToBR(student.birth_date));
      setCpf(student.cpf ? maskCpf(student.cpf) : "");
      setRg(student.rg ?? "");
      setSex(student.sex ?? null);
      setPhone(student.phone ?? "");
      setEmail(student.email ?? "");
      const label = student.belt_label ?? null;
      // F8.2: parseCommonBelt reconhece as 9 faixas comuns COM ou SEM grau
      // (ex.: "Marrom 2º kyu", "Preta 5°", "Marrom" cru) — um rótulo fora
      // dessa escala cai no campo livre "Outra…", igual antes.
      const parsedBelt = label ? parseCommonBelt(label) : null;
      setBeltFree(!!label && !parsedBelt);
      setBeltFreeText(label && !parsedBelt ? label : "");
      setBeltKey(parsedBelt ? parsedBelt.base : null);
      setBeltDegree(parsedBelt ? parsedBelt.degree : null);
      setStatus(student.status ?? "active");
      setEnrolledBR(isoToBR(student.enrolled_at));
      setGuardian(student.guardian ?? null);
      setConsent(student.consent_lgpd === true);
      setNotes(student.notes ?? "");
      setCep(student.zip_code ? maskCep(student.zip_code) : "");
      setStreet(student.street ?? "");
      setNumber(student.number ?? "");
      setComplement(student.complement ?? "");
      setNeighborhood(student.neighborhood ?? "");
      setCity(student.city ?? "");
      setUfState(student.state ?? "");
      // F8.2: preview da foto já salva (campo permanente karate_photo_url,
      // gravado pelo backend após o upload — mesmo padrão do praticante).
      setPhotoUrl(student.karate_photo_url || "");
      pendingPhotoFile.current = null;
      // Abre o acordeão sozinho quando já há algo de RG/endereço salvo —
      // esconder dado já preenchido seria pior do que a parede de campos.
      setAddressOpen(
        !!(student.rg || student.zip_code || student.street || student.number ||
           student.complement || student.neighborhood || student.city || student.state)
      );
    } else {
      setFullName("");
      setBirthBR("");
      setCpf("");
      setRg("");
      setSex(null);
      setPhone("");
      setEmail("");
      setBeltKey(null);
      setBeltDegree(null);
      setBeltFree(false);
      setBeltFreeText("");
      setStatus("active");
      setEnrolledBR("");
      setGuardian(null);
      setConsent(false);
      setNotes("");
      setCep("");
      setStreet("");
      setNumber("");
      setComplement("");
      setNeighborhood("");
      setCity("");
      setUfState("");
      setAddressOpen(false);
      setPhotoUrl("");
      pendingPhotoFile.current = null;
    }
    setPhotoLoading(false);
  }, [visible, student]);

  const birthISO = brToISO(birthBR);
  const age = birthISO ? ageFromISO(birthISO) : null;
  const isMinor = age != null && age < 18;
  // F8.2: monta o rótulo final (com grau quando aplicável) com o MESMO
  // helper que a ficha do praticante usa (praticante-detalhe/helpers.ts
  // buildBeltName) — garante texto idêntico entre dojô e federação.
  const effectiveBelt = beltFree
    ? (beltFreeText.trim() || null)
    : beltKey
      ? buildBeltName(
          beltKey,
          beltKey === "preta" ? (beltDegree ?? undefined) : undefined,
          beltKey === "marrom" ? (beltDegree ?? undefined) : undefined
        )
      : null;

  // CEP autopreenche o endereço (ViaCEP) — mesmo padrão já usado na ficha
  // do praticante na federação (praticante-ficha/EnderecoSection.tsx).
  // Silencioso em erro: endereço é opcional, uma falha na busca não pode
  // travar o cadastro do aluno.
  async function onCepChange(raw: string) {
    const masked = maskCep(raw);
    setCep(masked);
    const digits = onlyDigits(masked);
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const j = await r.json();
      if (!j?.erro) {
        setStreet((v) => j.logradouro || v);
        setNeighborhood((v) => j.bairro || v);
        setCity((v) => j.localidade || v);
        setUfState((v) => j.uf || v);
      }
    } catch {
      // silencioso — CEP é opcional
    } finally {
      setCepLoading(false);
    }
  }

  // F8.2: handler de foto — abre picker, gera preview local, guarda File
  // no ref. Mesmo mecanismo de handlePickPhoto em PraticanteFichaModal.tsx.
  const handlePickPhoto = async () => {
    setPhotoLoading(true);
    try {
      const file = await pickFileWeb("image/*");
      if (!file) return;
      pendingPhotoFile.current = file;
      const blobUrl = URL.createObjectURL(file);
      setPhotoUrl(blobUrl);
    } catch {
      // erro silencioso — usuário cancelou ou falha de leitura
    } finally {
      setPhotoLoading(false);
    }
  };

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
      rg: rg.trim() || null,
      sex,
      phone: phone.trim() || null,
      email: email.trim() || null,
      zip_code: onlyDigits(cep) || null,
      street: street.trim() || null,
      number: number.trim() || null,
      complement: complement.trim() || null,
      neighborhood: neighborhood.trim() || null,
      city: city.trim() || null,
      state: ufState.trim() ? ufState.trim().toUpperCase().slice(0, 2) : null,
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
      let finalStudent = saved;

      // F8.2: upload da foto (se o usuário escolheu uma nova) — ocorre
      // APÓS o create/update pra garantir que o id exista. Mesmo padrão
      // do praticante (PraticanteFichaModal.tsx handleSave): falha no
      // upload NÃO reverte o cadastro, só avisa.
      const fileToUpload = pendingPhotoFile.current;
      if (fileToUpload) {
        try {
          const { content, content_type } = await fileToBase64(fileToUpload);
          const photoResult = await karateDojoStudentsApi.uploadStudentPhoto(federationId, saved.id, { content, content_type });
          finalStudent = { ...saved, karate_photo_url: photoResult.photo_url };
          pendingPhotoFile.current = null;
        } catch {
          setErrors({ general: "Aluno salvo, mas a foto não pôde ser enviada. Tente trocar a foto novamente." });
        }
      }

      onSaved(finalStudent);
    } catch (e: any) {
      const m = mapStudentSaveError(e);
      setErrors({ [m.field]: m.message });
    } finally {
      setSaving(false);
    }
  };

  const addressSummary = [city, ufState].filter(Boolean).join(" / ");

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

          <ScrollView ref={scrollViewRef} style={{ flexShrink: 1 }} contentContainerStyle={styles.body}>
            <Text style={styles.lead}>
              Só o nome é obrigatório — dá para completar o resto depois. A exceção: menor de 18 anos precisa de responsável (LGPD).
            </Text>

            <Text style={styles.section}>Dados do aluno</Text>

            {/* F8.2: foto do aluno — mesmo componente/caminho de upload já
                usado na ficha do praticante (praticante-ficha/FotoSection). */}
            <FotoSection
              photoUrl={photoUrl}
              photoLoading={photoLoading}
              onPickPhoto={handlePickPhoto}
              onRemovePhoto={() => {
                setPhotoUrl("");
                pendingPhotoFile.current = null;
              }}
            />

            <View ref={fullNameFieldRef}>
              <FormField
                label="Nome completo"
                required
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nome do aluno"
                error={errors.full_name}
              />
            </View>
            <View style={styles.row2}>
              <View style={{ flex: 1 }} ref={birthFieldRef}>
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
              <View style={{ flex: 1 }} ref={cpfFieldRef}>
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
            <FormField
              label="RG"
              value={rg}
              onChangeText={setRg}
              placeholder="00.000.000-0"
            />

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
                const on = !beltFree && beltKey === b.key;
                return (
                  <TouchableOpacity
                    key={b.label}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => {
                      setBeltFree(false);
                      if (on) { setBeltKey(null); setBeltDegree(null); }
                      else { setBeltKey(b.key); setBeltDegree(null); }
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
                onPress={() => {
                  setBeltFree(!beltFree);
                  setBeltKey(null);
                  setBeltDegree(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: beltFree }}
              >
                <Text style={[styles.chipTxt, beltFree && styles.chipTxtOn]}>Outra…</Text>
              </TouchableOpacity>
            </View>

            {/* F8.2: Marrom tem 3 kyus distintos (escala oficial FPKT) — mesmo
                de-para da ficha do praticante (praticante-detalhe/helpers.ts
                BELT_KYUS). Grau opcional: "Marrom" sem kyu continua válido. */}
            {!beltFree && beltKey === "marrom" && (
              <View style={styles.degreeBlock}>
                <Text style={styles.label}>Kyu</Text>
                <View style={styles.chips}>
                  {(BELT_KYUS.marrom ?? []).map((k) => {
                    const on = beltDegree === k;
                    return (
                      <TouchableOpacity
                        key={k}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => setBeltDegree(on ? null : k)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{k}º kyu</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* F8.2: Preta aceita grau Dan (1º a 10º) — mesmo de-para da ficha
                do praticante (praticante-detalhe/helpers.ts DAN_OPTIONS). Grau
                opcional: "Preta" sem dan continua válido. */}
            {!beltFree && beltKey === "preta" && (
              <View style={styles.degreeBlock}>
                <Text style={styles.label}>Grau Dan</Text>
                <View style={styles.chips}>
                  {DAN_OPTIONS.map((d) => {
                    const on = beltDegree === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => setBeltDegree(on ? null : d)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{d}º</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

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

            {/* F7.0: Endereço — acordeão recolhido por padrão (formulário já é
                longo); abre sozinho ao editar aluno com algo já preenchido
                (ver hidratação acima). Necessário pra ficha H1 da federação
                (RG + endereço completo) e pra o dojô ser fonte da identidade. */}
            <TouchableOpacity
              style={styles.addressToggle}
              onPress={() => setAddressOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: addressOpen }}
              accessibilityLabel="Endereço"
            >
              <Icon name="location" size={14} color={KarateColors.ink3} />
              <Text style={styles.addressToggleTxt}>Endereço</Text>
              <Text style={styles.addressToggleHint} numberOfLines={1}>
                {addressOpen ? "" : (addressSummary || "opcional")}
              </Text>
              <Icon name={addressOpen ? "chevron_up" : "chevron_down"} size={14} color={KarateColors.ink3} />
            </TouchableOpacity>

            {addressOpen && (
              <View style={styles.addressBox}>
                <FormField
                  label="CEP"
                  value={cep}
                  onChangeText={onCepChange}
                  placeholder="00000-000"
                  keyboardType="numeric"
                  hint={cepLoading ? "Buscando endereço…" : "preenche o endereço automaticamente"}
                />
                <View style={styles.row2}>
                  <View style={{ flex: 2 }}>
                    <FormField label="Logradouro" value={street} onChangeText={setStreet} placeholder="Rua, avenida…" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField label="Número" value={number} onChangeText={setNumber} placeholder="000" keyboardType="numeric" />
                  </View>
                </View>
                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <FormField label="Complemento" value={complement} onChangeText={setComplement} placeholder="Apto, bloco…" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField label="Bairro" value={neighborhood} onChangeText={setNeighborhood} />
                  </View>
                </View>
                <View style={styles.row2}>
                  <View style={{ flex: 2 }}>
                    <FormField label="Cidade" value={city} onChangeText={setCity} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField
                      label="UF"
                      value={ufState}
                      onChangeText={(t) => setUfState(t.toUpperCase().slice(0, 2))}
                      maxLength={2}
                      placeholder="SP"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              </View>
            )}

            <View ref={guardianFieldRef} style={[styles.guardianBox, isMinor && styles.guardianBoxMinor]}>
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

            <View ref={generalErrRef}>
              {!!errors.general && <Text style={styles.generalErr}>{errors.general}</Text>}
            </View>
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
  // F8.2: sub-seletor de grau (kyu/dan) — mesmo espaçamento negativo que o
  // bloco de faixas usa entre si (marginTop: 4 no chips), só que aqui some
  // a folga extra do <Text style={styles.label}> logo acima (kyu/dan é
  // continuação visual da faixa base, não uma seção nova).
  degreeBlock: { marginTop: -4 } as ViewStyle,
  // F7.0: acordeão de endereço — some da vista por padrão, some sem
  // engordar visualmente o resto do formulário.
  addressToggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  addressToggleTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  addressToggleHint: { flex: 1, fontSize: 11.5, color: KarateColors.ink3, textAlign: "right" } as TextStyle,
  addressBox: { gap: 10, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.surface } as ViewStyle,
  guardianBox: { gap: 8, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.surface, marginTop: 4 } as ViewStyle,
  guardianBoxMinor: { borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  consentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 } as ViewStyle,
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: KarateColors.border2, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" } as ViewStyle,
  checkboxOn: { backgroundColor: KarateColors.ink, borderColor: KarateColors.ink } as ViewStyle,
  consentTxt: { flex: 1, fontSize: 12, color: KarateColors.ink2, lineHeight: 17 } as TextStyle,
  generalErr: { fontSize: 12.5, color: KarateColors.danger, fontWeight: "600", lineHeight: 18 } as TextStyle,
  foot: { flexDirection: "row", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
});
