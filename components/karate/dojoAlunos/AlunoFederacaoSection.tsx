// ============================================================
// AlunoFederacaoSection — seção "Federação" da ficha do aluno (F5a/F5b)
//
// Sub-componente importado por AlunoFichaModal.tsx (edição cirúrgica —
// NUNCA modal aninhado; bloco inline dentro do modal existente, mesmo
// racional do GuardianPicker/AlunoAssinaturaSection que já expandem
// dentro do form/ficha).
//
// DECISÃO DE PRODUTO: o aluno do dojô é registro PRÓPRIO (F2). O sensei
// DECLARA se o aluno é federado; a federação CONFIRMA. Não federado =
// privado do dojô. Federado = existe também no cadastro da federação e
// fica visível para ela (pré-requisito de certificado/exame/inscrição
// na F5b).
//
// 3 estados (federation_link_status do backend, nunca inferido no
// cliente): 'none' (2 caminhos: número FPKT existente OU solicitação
// com a ficha H1 completa) · 'pending' (aguardando, sem reenvio) ·
// 'linked' (badge + FPKT + praticante + desvincular).
//
// Se o dojô não está conectado à federação (contexts/KarateDojo,
// linked===false — fail-open, nunca bloqueia por loading/erro), a seção
// mostra só a explicação + botão para /karate/(dojo)/conexao, mesmo
// padrão que a F6 já usou em eventos.tsx/anuidade.tsx.
//
// F5b (30/07 — Aura-backend#447 + migration 262): DECISÃO DE PRODUTO — o
// fluxo de informação SOBE (dojô → federação). O dojô é fonte da
// identidade da pessoa; vincular um aluno a um praticante passa a dar ao
// dojô o direito de SOBRESCREVER a ficha daquela pessoa na federação.
// Até aqui, o vínculo por número FPKT gravava IMEDIATO — o backend
// confirmava e ligava na mesma chamada, sem perguntar nada antes. Achado
// em produção: uma aluna de 12 anos (CPF 123…, nascida em 1998) foi
// vinculada a um praticante nascido em 2020, com CPF diferente, sem
// nenhum aviso. O app até detectava nomes divergentes e mostrava
// "Confirme o vínculo" — mas o backend já tinha gravado ANTES de
// perguntar (painel pós-fato, heurística de nome só, `namesDivergent`).
//
// Esta seção agora faz a conferência ANTES de gravar:
//   1. Sensei informa o número FPKT → POST .../federate SEM `confirm`
//      (preview — não grava nada). Ver loadPreview.
//   2. AlunoFederacaoComparePanel mostra quem foi encontrado (nome,
//      matrícula, dojô atual, aviso se `is_transfer`) e a comparação
//      campo a campo dojô × federação, com escolha por campo (o
//      `suggested` do backend vem pré-selecionado). `can_link:false`
//      esconde a confirmação — os `blockers` (ex.: CPF_CONFLITANTE, sem
//      override possível) aparecem com a mensagem do servidor.
//   3. Confirmar → POST .../federate COM `confirm:true` + `resolution`
//      (grava). O resultado (`applied`) fica visível até o sensei tocar
//      em "Concluir" — depois disso a seção volta ao estado 'linked'
//      normal (ver appliedSummary/lastLinkResult abaixo).
//
// F8.2 (01/08/2026 — pedido do Caio: ficha do aluno igual à ficha do
// praticante): rótulo "FPKT" no card 'linked' vira "Matrícula FPKT" —
// mesmo vocabulário do campo de matrícula na ficha do praticante
// (praticante-ficha/MatriculaSection.tsx, "Número de matrícula (FPKT)").
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { FormField } from "@/components/karate/FormField";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { ApiError } from "@/services/api";
import {
  karateDojoStudentsApi, DojoStudent, DojoStudentFederationLinkStatus,
  DojoStudentSex, FederationRequestPayload,
  FederatePreviewResult, FederateConfirmResult, FederationResolution,
} from "@/services/karateDojoStudentsApi";
import {
  ageFromISO, brToISO, isoToBR, maskDateBR, maskCpf, maskCep, onlyDigits,
  formatPhone, mapFederationError, COMMON_BELTS,
} from "./helpers";
import { AlunoFederacaoComparePanel } from "./AlunoFederacaoComparePanel";

interface Props {
  federationId: string;
  student: DojoStudent;
  onChanged?: () => void;
}

interface FedState {
  federated: boolean;
  status: DojoStudentFederationLinkStatus;
  fpktNumber: string | null;
  practitionerName: string | null;
}

function extractFed(s: DojoStudent): FedState {
  return {
    federated: !!s.federated,
    status: s.federation_link_status ?? "none",
    fpktNumber: s.fpkt_number ?? null,
    practitionerName: s.practitioner_name ?? null,
  };
}

interface ReqForm {
  full_name: string;
  birth_date_br: string;
  sex: DojoStudentSex;
  cpf: string;
  rg: string;
  phone: string;
  email: string;
  claimed_belt: string;
  zip_code: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_relationship: string;
}

function seedReqForm(s: DojoStudent): ReqForm {
  return {
    full_name: s.full_name ?? "",
    birth_date_br: s.birth_date ? isoToBR(s.birth_date) : "",
    sex: s.sex ?? "M",
    cpf: s.cpf ? maskCpf(s.cpf) : "",
    rg: "",
    phone: s.phone ? formatPhone(s.phone) : "",
    email: s.email ?? "",
    claimed_belt: s.belt_label ?? "",
    zip_code: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    guardian_name: s.guardian?.full_name ?? "",
    guardian_phone: s.guardian?.phone ? formatPhone(s.guardian.phone) : "",
    guardian_relationship: s.guardian?.relationship ?? "",
  };
}

const SEX_OPTIONS: { key: DojoStudentSex; label: string }[] = [
  { key: "M", label: "Masculino" },
  { key: "F", label: "Feminino" },
  { key: "other", label: "Outro" },
];

export function AlunoFederacaoSection({ federationId, student, onChanged }: Props) {
  const router = useRouter();
  const { linked: dojoLinked, dojoMe } = useKarateDojo();
  // QA 27/07 (item 2): nome REAL da federação — nunca o do dojô logado.
  const federationName = dojoMe?.federation_name || "a federação";

  const [fed, setFed] = useState<FedState>(() => extractFed(student));
  useEffect(() => {
    setFed(extractFed(student));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, student.federated, student.federation_link_status, student.fpkt_number, student.practitioner_name]);

  // ── vínculo por número FPKT (F5b: preview → confirmação) ──────────
  const [numberOpen, setNumberOpen] = useState(false);
  const [fpktInput, setFpktInput] = useState("");
  const [numberBusy, setNumberBusy] = useState(false);
  const [numberErr, setNumberErr] = useState<string | null>(null);

  // Preview carregado (nada gravado ainda) + o número que gerou esse preview
  // (precisa viajar de novo na confirmação).
  const [preview, setPreview] = useState<FederatePreviewResult | null>(null);
  const [previewFpkt, setPreviewFpkt] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);

  // Resultado da última confirmação: `lastLinkResult` persiste (hint de
  // is_transfer no card 'linked' normal); `appliedSummary` é o mesmo
  // objeto mas some assim que o sensei toca "Concluir" — é o retorno
  // (`applied`) exigido pela conferência, mostrado uma vez.
  const [lastLinkResult, setLastLinkResult] = useState<FederateConfirmResult | null>(null);
  const [appliedSummary, setAppliedSummary] = useState<FederateConfirmResult | null>(null);
  const [appliedFieldLabels, setAppliedFieldLabels] = useState<Record<string, string>>({});

  const loadPreview = async () => {
    const num = fpktInput.trim();
    if (!num) {
      setNumberErr("Informe o número FPKT.");
      return;
    }
    setNumberBusy(true);
    setNumberErr(null);
    try {
      const res = await karateDojoStudentsApi.previewFederateByNumber(federationId, student.id, num);
      setPreview(res);
      setPreviewFpkt(num);
      setConfirmErr(null);
    } catch (e: any) {
      setNumberErr(mapFederationError(e).message);
    } finally {
      setNumberBusy(false);
    }
  };

  const cancelPreview = () => {
    // Volta pro campo de número (editável) — nada foi gravado até aqui.
    setPreview(null);
    setPreviewFpkt(null);
    setConfirmErr(null);
  };

  const confirmPreview = async (resolution: FederationResolution) => {
    if (!preview || !previewFpkt) return;
    setConfirmBusy(true);
    setConfirmErr(null);
    try {
      const res = await karateDojoStudentsApi.confirmFederateByNumber(federationId, student.id, previewFpkt, resolution);
      const labels: Record<string, string> = {};
      for (const f of preview.comparison ?? []) labels[f.field] = f.label;
      setAppliedFieldLabels(labels);
      setLastLinkResult(res);
      setAppliedSummary(res);
      setFed({
        federated: true,
        status: "linked",
        fpktNumber: res.practitioner.fpkt_number,
        practitionerName: res.practitioner.name,
      });
      setPreview(null);
      setPreviewFpkt(null);
      setNumberOpen(false);
      setFpktInput("");
      onChanged?.();
    } catch (e: any) {
      setConfirmErr(mapFederationError(e).message);
    } finally {
      setConfirmBusy(false);
    }
  };

  // ── solicitação de filiação (ficha H1) ───────────────────
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqForm, setReqForm] = useState<ReqForm>(() => seedReqForm(student));
  const [reqErrors, setReqErrors] = useState<Record<string, string>>({});
  const [reqBusy, setReqBusy] = useState(false);
  const [reqGeneralErr, setReqGeneralErr] = useState<string | null>(null);

  const openRequest = () => {
    setReqForm(seedReqForm(student));
    setReqErrors({});
    setReqGeneralErr(null);
    setRequestOpen(true);
  };

  const setReqField = (k: keyof ReqForm) => (v: string) => setReqForm((p) => ({ ...p, [k]: v }));

  const reqAge = ageFromISO(brToISO(reqForm.birth_date_br));
  const reqMinor = reqAge != null && reqAge < 18;

  const submitRequest = async () => {
    const errs: Record<string, string> = {};
    const iso = brToISO(reqForm.birth_date_br);
    if (!reqForm.full_name.trim()) errs.full_name = "Informe o nome completo.";
    if (!iso) errs.birth_date_br = "Data de nascimento inválida. Use DD/MM/AAAA.";
    if (onlyDigits(reqForm.cpf).length !== 11) errs.cpf = "CPF inválido — confira os 11 dígitos.";
    if (!reqForm.rg.trim()) errs.rg = "Informe o RG.";
    if (onlyDigits(reqForm.phone).length < 10) errs.phone = "Telefone inválido.";
    if (!reqForm.email.trim()) errs.email = "Informe o e-mail.";
    if (!reqForm.claimed_belt.trim()) errs.claimed_belt = "Informe a faixa.";
    if (onlyDigits(reqForm.zip_code).length !== 8) errs.zip_code = "CEP inválido.";
    if (!reqForm.street.trim()) errs.street = "Informe a rua.";
    if (!reqForm.number.trim()) errs.number = "Informe o número.";
    if (!reqForm.neighborhood.trim()) errs.neighborhood = "Informe o bairro.";
    if (!reqForm.city.trim()) errs.city = "Informe a cidade.";
    if (reqForm.state.trim().length !== 2) errs.state = "UF com 2 letras.";
    if (reqMinor) {
      if (!reqForm.guardian_name.trim()) errs.guardian_name = "Informe o nome do responsável.";
      if (onlyDigits(reqForm.guardian_phone).length < 10) errs.guardian_phone = "Telefone do responsável inválido.";
      if (!reqForm.guardian_relationship.trim()) errs.guardian_relationship = "Informe o parentesco.";
    }
    if (Object.keys(errs).length) {
      setReqErrors(errs);
      return;
    }

    const payload: FederationRequestPayload = {
      full_name: reqForm.full_name.trim(),
      birth_date: iso!,
      sex: reqForm.sex,
      cpf: onlyDigits(reqForm.cpf),
      rg: reqForm.rg.trim(),
      phone: onlyDigits(reqForm.phone),
      email: reqForm.email.trim(),
      claimed_belt: reqForm.claimed_belt.trim(),
      zip_code: onlyDigits(reqForm.zip_code),
      street: reqForm.street.trim(),
      number: reqForm.number.trim(),
      neighborhood: reqForm.neighborhood.trim(),
      city: reqForm.city.trim(),
      state: reqForm.state.trim().toUpperCase(),
    };
    if (reqMinor) {
      payload.guardian_name = reqForm.guardian_name.trim();
      payload.guardian_phone = onlyDigits(reqForm.guardian_phone);
      payload.guardian_relationship = reqForm.guardian_relationship.trim();
    }

    setReqErrors({});
    setReqGeneralErr(null);
    setReqBusy(true);
    try {
      await karateDojoStudentsApi.requestFederation(federationId, student.id, payload);
      setFed((p) => ({ ...p, status: "pending" }));
      setRequestOpen(false);
      onChanged?.();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 422) {
        const raw = e.data?.errors || e.data?.fields;
        if (raw && typeof raw === "object") {
          const mapped: Record<string, string> = {};
          for (const k of Object.keys(raw)) mapped[k] = String((raw as any)[k]);
          setReqErrors(mapped);
        }
        setReqGeneralErr(e.message || "Confira os campos e tente de novo.");
      } else {
        setReqGeneralErr(mapFederationError(e).message);
      }
    } finally {
      setReqBusy(false);
    }
  };

  // ── desvincular ───────────────────────────────────────────
  const [unlinkConfirm, setUnlinkConfirm] = useState(false);
  const [unlinkBusy, setUnlinkBusy] = useState(false);
  const [unlinkErr, setUnlinkErr] = useState<string | null>(null);

  const doUnfederate = async () => {
    setUnlinkBusy(true);
    setUnlinkErr(null);
    try {
      await karateDojoStudentsApi.unfederate(federationId, student.id);
      setFed({ federated: false, status: "none", fpktNumber: null, practitionerName: null });
      setLastLinkResult(null);
      setAppliedSummary(null);
      setUnlinkConfirm(false);
      onChanged?.();
    } catch (e: any) {
      setUnlinkErr(mapFederationError(e).message);
    } finally {
      setUnlinkBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Federação</Text>

      {!dojoLinked && (
        <View style={{ gap: 8 }}>
          <Text style={styles.hint}>
            Para federar alunos, seu dojô precisa primeiro se conectar à {federationName}.
          </Text>
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={() => router.push("/karate/(dojo)/conexao" as any)}
            accessibilityRole="button"
          >
            <Icon name="link" size={14} color={KarateColors.primary} />
            <Text style={styles.connectBtnTxt}>Conectar meu dojô</Text>
          </TouchableOpacity>
        </View>
      )}

      {dojoLinked && !!appliedSummary && (
        <View style={styles.appliedBox}>
          <View style={styles.linkedBadge}>
            <Icon name="shield" size={13} color={KarateColors.ok} />
            <Text style={styles.linkedBadgeTxt}>Federado</Text>
          </View>
          <Text style={styles.hint}>
            {appliedSummary.is_transfer
              ? `Vínculo confirmado — este praticante estava em outro dojô; a transferência foi registrada. A partir de agora, o cadastro de ${appliedSummary.practitioner.name} na federação é mantido por este dojô.`
              : `Vínculo confirmado. A partir de agora, o cadastro de ${appliedSummary.practitioner.name} na federação é mantido por este dojô.`}
          </Text>
          {appliedSummary.applied.length > 0 && (
            <View style={{ gap: 3 }}>
              <Text style={styles.panelSub}>O que foi atualizado:</Text>
              {appliedSummary.applied.map((a) => (
                <Text key={a.field} style={styles.infoLine}>
                  {appliedFieldLabels[a.field] ?? a.field}: <Text style={styles.infoStrong}>{a.value?.toString().trim() ? a.value : "—"}</Text>
                </Text>
              ))}
            </View>
          )}
          <KarateButton label="Concluir" variant="sumi" size="sm" onPress={() => setAppliedSummary(null)} style={{ alignSelf: "flex-start" }} />
        </View>
      )}

      {dojoLinked && !appliedSummary && fed.status === "linked" && (
        <View style={{ gap: 8 }}>
          <View style={styles.linkedBadge}>
            <Icon name="shield" size={13} color={KarateColors.ok} />
            <Text style={styles.linkedBadgeTxt}>Federado</Text>
          </View>
          <Text style={styles.infoLine}>Matrícula FPKT: <Text style={styles.infoStrong}>{fed.fpktNumber ?? "—"}</Text></Text>
          <Text style={styles.infoLine}>Praticante: <Text style={styles.infoStrong}>{fed.practitionerName ?? "—"}</Text></Text>
          {!!lastLinkResult?.is_transfer && (
            <Text style={styles.hint}>Este praticante já era federado em outro dojô — a transferência foi registrada.</Text>
          )}

          {!unlinkConfirm ? (
            <KarateButton label="Desvincular" variant="ghost" size="sm" onPress={() => setUnlinkConfirm(true)} style={{ alignSelf: "flex-start", marginTop: 2 }} />
          ) : (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTxt}>
                Desvincular {student.full_name} da federação? O cadastro dessa pessoa continua existindo na federação — só que a gestão da ficha deixa de ser deste dojô e volta para a federação.
              </Text>
              {!!unlinkErr && <Text style={styles.err}>{unlinkErr}</Text>}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <KarateButton label="Voltar" variant="ghost" size="sm" onPress={() => setUnlinkConfirm(false)} style={{ flex: 1 }} />
                <KarateButton label="Desvincular" variant="primary" size="sm" onPress={doUnfederate} loading={unlinkBusy} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </View>
      )}

      {dojoLinked && !appliedSummary && fed.status === "pending" && (
        <View style={{ gap: 4 }}>
          <View style={styles.pendingBadge}>
            <Icon name="time-outline" size={13} color={KarateColors.warn} />
            <Text style={styles.pendingBadgeTxt}>Aguardando a federação</Text>
          </View>
          <Text style={styles.hint}>Solicitação enviada — aguardando a federação analisar.</Text>
        </View>
      )}

      {dojoLinked && !appliedSummary && fed.status === "none" && (
        <View style={{ gap: 10 }}>
          <Text style={styles.hint}>
            Alunos federados aparecem para a {federationName} e podem ser inscritos em exames, cursos e pedir certificado.
          </Text>

          {!numberOpen && !requestOpen && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <KarateButton
                label="Já tem número FPKT"
                variant="secondary"
                size="sm"
                onPress={() => { setNumberOpen(true); setFpktInput(""); setNumberErr(null); setPreview(null); setPreviewFpkt(null); }}
              />
              <KarateButton label="Solicitar filiação" variant="sumi" size="sm" onPress={openRequest} />
            </View>
          )}

          {numberOpen && !preview && (
            <View style={styles.panel}>
              <FormField
                label="Número FPKT"
                required
                value={fpktInput}
                onChangeText={setFpktInput}
                placeholder="FPKT-000000"
                error={numberErr ?? undefined}
                autoCapitalize="characters"
              />
              <Text style={styles.panelSub}>Nada é gravado agora — o próximo passo mostra o que foi encontrado antes de confirmar.</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => setNumberOpen(false)} style={{ flex: 1 }} />
                <KarateButton label="Continuar" variant="sumi" size="sm" onPress={loadPreview} loading={numberBusy} style={{ flex: 1 }} />
              </View>
            </View>
          )}

          {!!preview && (
            <AlunoFederacaoComparePanel
              key={preview.practitioner.id}
              preview={preview}
              busy={confirmBusy}
              error={confirmErr}
              onCancel={cancelPreview}
              onConfirm={confirmPreview}
            />
          )}

          {requestOpen && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Ficha para a federação analisar</Text>
              <Text style={styles.panelSub}>Todos os campos são obrigatórios — já pré-preenchemos o que tínhamos.</Text>

              <FormField label="Nome completo" required value={reqForm.full_name} onChangeText={setReqField("full_name")} error={reqErrors.full_name} />
              <FormField
                label="Data de nascimento"
                required
                value={reqForm.birth_date_br}
                onChangeText={(v) => setReqField("birth_date_br")(maskDateBR(v))}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                error={reqErrors.birth_date_br}
              />

              <View>
                <Text style={styles.label}>Sexo</Text>
                <View style={styles.chips}>
                  {SEX_OPTIONS.map((o) => (
                    <TouchableOpacity
                      key={o.key}
                      style={[styles.chip, reqForm.sex === o.key && styles.chipOn]}
                      onPress={() => setReqField("sex")(o.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: reqForm.sex === o.key }}
                    >
                      <Text style={[styles.chipTxt, reqForm.sex === o.key && styles.chipTxtOn]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <FormField label="CPF" required value={reqForm.cpf} onChangeText={(v) => setReqField("cpf")(maskCpf(v))} keyboardType="number-pad" error={reqErrors.cpf} />
              <FormField label="RG" required value={reqForm.rg} onChangeText={setReqField("rg")} error={reqErrors.rg} />
              <FormField label="Telefone" required value={reqForm.phone} onChangeText={(v) => setReqField("phone")(formatPhone(v))} keyboardType="phone-pad" error={reqErrors.phone} />
              <FormField label="E-mail" required value={reqForm.email} onChangeText={setReqField("email")} keyboardType="email-address" autoCapitalize="none" error={reqErrors.email} />

              <View>
                <Text style={styles.label}>Faixa declarada</Text>
                <View style={styles.chips}>
                  {COMMON_BELTS.map((b) => (
                    <TouchableOpacity
                      key={b.label}
                      style={[styles.chip, reqForm.claimed_belt === b.label && styles.chipOn]}
                      onPress={() => setReqField("claimed_belt")(b.label)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: reqForm.claimed_belt === b.label }}
                    >
                      <Text style={[styles.chipTxt, reqForm.claimed_belt === b.label && styles.chipTxtOn]}>{b.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!!reqErrors.claimed_belt && <Text style={styles.err}>{reqErrors.claimed_belt}</Text>}
              </View>

              <FormField label="CEP" required value={reqForm.zip_code} onChangeText={(v) => setReqField("zip_code")(maskCep(v))} keyboardType="number-pad" error={reqErrors.zip_code} />
              <FormField label="Rua" required value={reqForm.street} onChangeText={setReqField("street")} error={reqErrors.street} />
              <FormField label="Número" required value={reqForm.number} onChangeText={setReqField("number")} keyboardType="number-pad" error={reqErrors.number} />
              <FormField label="Bairro" required value={reqForm.neighborhood} onChangeText={setReqField("neighborhood")} error={reqErrors.neighborhood} />
              <FormField label="Cidade" required value={reqForm.city} onChangeText={setReqField("city")} error={reqErrors.city} />
              <FormField label="UF" required value={reqForm.state} onChangeText={(v) => setReqField("state")(v.toUpperCase().slice(0, 2))} placeholder="PA" error={reqErrors.state} />

              {reqMinor && (
                <View style={styles.minorBox}>
                  <Text style={styles.minorTitle}>Responsável (obrigatório — aluno menor de 18)</Text>
                  <FormField label="Nome do responsável" required value={reqForm.guardian_name} onChangeText={setReqField("guardian_name")} error={reqErrors.guardian_name} />
                  <FormField label="Telefone do responsável" required value={reqForm.guardian_phone} onChangeText={(v) => setReqField("guardian_phone")(formatPhone(v))} keyboardType="phone-pad" error={reqErrors.guardian_phone} />
                  <FormField label="Parentesco" required value={reqForm.guardian_relationship} onChangeText={setReqField("guardian_relationship")} placeholder="mãe, pai, avó…" error={reqErrors.guardian_relationship} />
                </View>
              )}

              {!!reqGeneralErr && <Text style={styles.err}>{reqGeneralErr}</Text>}

              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => setRequestOpen(false)} style={{ flex: 1 }} />
                <KarateButton label="Enviar solicitação" variant="sumi" size="sm" onPress={submitRequest} loading={reqBusy} style={{ flex: 2 }} />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.surface, marginTop: 4 } as ViewStyle,
  title: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  hint: { fontSize: 12, color: KarateColors.ink3, lineHeight: 17 } as TextStyle,
  connectBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 14 } as ViewStyle,
  connectBtnTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  linkedBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: KarateColors.okSoft, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 } as ViewStyle,
  linkedBadgeTxt: { fontSize: 11, fontWeight: "700", color: KarateColors.ok } as TextStyle,
  pendingBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: KarateColors.bg2, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 } as ViewStyle,
  pendingBadgeTxt: { fontSize: 11, fontWeight: "700", color: KarateColors.warn } as TextStyle,
  infoLine: { fontSize: 12.5, color: KarateColors.ink2 } as TextStyle,
  infoStrong: { fontWeight: "700", color: KarateColors.ink } as TextStyle,
  panel: { gap: 8, marginTop: 2, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, backgroundColor: KarateColors.glass2, padding: 10 } as ViewStyle,
  panelTitle: { fontSize: 12.5, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  panelSub: { fontSize: 11.5, color: KarateColors.ink3, marginBottom: 2 } as TextStyle,
  label: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginBottom: 6 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: "#fff" } as ViewStyle,
  chipOn: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primaryLine } as ViewStyle,
  chipTxt: { fontSize: 12.5, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTxtOn: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,
  minorBox: { gap: 8, borderWidth: 1, borderColor: KarateColors.primaryLine, borderRadius: KarateRadius.sm, backgroundColor: "#fff", padding: 10, marginTop: 4 } as ViewStyle,
  minorTitle: { fontSize: 11.5, fontWeight: "800", color: KarateColors.ink2 } as TextStyle,
  err: { fontSize: 11.5, color: KarateColors.danger, fontWeight: "600" } as TextStyle,
  confirmBox: { gap: 8, borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, padding: 10, backgroundColor: KarateColors.glass2, marginTop: 4 } as ViewStyle,
  confirmTxt: { fontSize: 12, color: KarateColors.ink2, lineHeight: 17 } as TextStyle,
  // F5b: painel transitório mostrado logo após a confirmação, com o
  // resultado (`applied`) — some quando o sensei toca "Concluir".
  appliedBox: { gap: 8, borderWidth: 1, borderColor: KarateColors.ok, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.okSoft } as ViewStyle,
});
