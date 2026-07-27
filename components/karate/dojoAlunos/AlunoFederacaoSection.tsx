// ============================================================
// AlunoFederacaoSection — seção "Federação" da ficha do aluno (F5a)
//
// Sub-componente importado por AlunoFichaModal.tsx (edição cirúrgica —
// NUNCA modal aninhado; bloco inline dentro do modal existente, mesmo
// racional do GuardianPicker/AlunoAssinaturaSection que já expandem
// dentro do form/ficha).
//
// DECISÃO DE PRODUTO: o aluno do dojô é registro PRÓPRIO (F2). Agora o
// sensei DECLARA se o aluno é federado; a federação CONFIRMA. Não
// federado = privado do dojô. Federado = existe também no cadastro da
// federação e fica visível para ela (pré-requisito de certificado/exame/
// inscrição na F5b).
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
// Nota sobre "vínculo por número FPKT": o contrato do backend
// (Aura-backend#425) já CONFIRMA e LIGA na mesma chamada (200
// {linked:true, practitioner, is_transfer}) — não existe um endpoint de
// pré-visualização separado. Por isso o "mostra o praticante encontrado
// e se é transferência" acontece como confirmação IMEDIATA após vincular
// (não antes) — a seção já nasce no estado 'linked' com essa informação
// visível.
//
// QA 27/07 (item 2): as duas frases desta seção usavam `federationName`
// de useKarateFederation(), que resolve pra `company?.name` — CORRETO só
// quando a company logada É a federação. Aqui a company logada é o
// DOJÔ (contexto karate_dojo), então `company.name` é o nome do PRÓPRIO
// dojô, não da federação — a tela mostrava "conecte-se à Dojô Kondei"
// em vez de "conecte-se à FPKT". Fonte corrigida: dojoMe.federation_name
// (services/karateDojoInfoApi.ts, GET /dojo/me — mesmo dado que
// alimenta o breadcrumb/sidebar do DojoShell), a mesma fonte de verdade
// que conexao.tsx usa (lá vem de GET /connection → info.federation.name;
// aqui vem de /dojo/me → dojoMe.federation_name — ambos o nome REAL da
// federação, nunca o do dojô).
//
// QA 27/07 (item 5): vincular por número FPKT digitado à mão é
// propenso a erro de digitação — um número certo mas de OUTRO
// praticante vinculava o aluno errado silenciosamente. Como o backend
// não tem endpoint de pré-visualização (nota acima), a confirmação
// acontece LOGO APÓS o vínculo confirmado pelo backend: se o nome do
// praticante encontrado diverge do nome do aluno (dojoAlunos/helpers.
// namesDivergent — normalizado, sem acento, ignora conectores), a seção
// NÃO fecha direto no estado 'linked' — mostra um painel "Confirme o
// vínculo" com os dois nomes lado a lado. "Cancelar" desfaz na hora
// (DELETE .../federate, o mesmo endpoint do botão "Desvincular").
// "Confirmar vínculo" segue pro estado 'linked' normal. Quando os nomes
// batem, o fluxo permanece direto, sem esse passo extra.
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
  DojoStudentSex, FederationRequestPayload, FederateByNumberResult,
} from "@/services/karateDojoStudentsApi";
import {
  ageFromISO, brToISO, isoToBR, maskDateBR, maskCpf, maskCep, onlyDigits,
  formatPhone, mapFederationError, namesDivergent, COMMON_BELTS,
} from "./helpers";

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

  // ── vínculo por número FPKT ──────────────────────────────
  const [numberOpen, setNumberOpen] = useState(false);
  const [fpktInput, setFpktInput] = useState("");
  const [numberBusy, setNumberBusy] = useState(false);
  const [numberErr, setNumberErr] = useState<string | null>(null);
  const [lastLinkResult, setLastLinkResult] = useState<FederateByNumberResult | null>(null);

  // QA 27/07 (item 5): resultado do vínculo com nome divergente,
  // aguardando confirmação explícita (ver nota no cabeçalho do arquivo).
  const [pendingConfirm, setPendingConfirm] = useState<FederateByNumberResult | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const submitNumber = async () => {
    const num = fpktInput.trim();
    if (!num) {
      setNumberErr("Informe o número FPKT.");
      return;
    }
    setNumberBusy(true);
    setNumberErr(null);
    try {
      const res = await karateDojoStudentsApi.federateByNumber(federationId, student.id, num);
      if (namesDivergent(student.full_name, res.practitioner.name)) {
        // Backend já confirmou e ligou — não tem "antes" de verdade pra
        // pré-visualizar (nota do cabeçalho). Segura o estado 'linked' e
        // pede confirmação explícita; "Cancelar" desfaz na hora.
        setPendingConfirm(res);
        setNumberOpen(false);
        setFpktInput("");
      } else {
        setLastLinkResult(res);
        setFed({
          federated: true,
          status: "linked",
          fpktNumber: res.practitioner.fpkt_number,
          practitionerName: res.practitioner.name,
        });
        setNumberOpen(false);
        setFpktInput("");
        onChanged?.();
      }
    } catch (e: any) {
      setNumberErr(mapFederationError(e).message);
    } finally {
      setNumberBusy(false);
    }
  };

  const confirmDivergentLink = () => {
    if (!pendingConfirm) return;
    setLastLinkResult(pendingConfirm);
    setFed({
      federated: true,
      status: "linked",
      fpktNumber: pendingConfirm.practitioner.fpkt_number,
      practitionerName: pendingConfirm.practitioner.name,
    });
    setPendingConfirm(null);
    onChanged?.();
  };

  const cancelDivergentLink = async () => {
    if (!pendingConfirm) return;
    setConfirmBusy(true);
    try {
      await karateDojoStudentsApi.unfederate(federationId, student.id);
    } catch {
      // Mesmo se o desfazer falhar (rede etc.), não trava a UI — o vínculo
      // (correto ou não) fica visível no estado normal, onde "Desvincular"
      // já existe pro sensei tentar de novo manualmente.
    } finally {
      setFed(extractFed(student)); // volta pro estado conhecido antes desta tentativa
      setPendingConfirm(null);
      setConfirmBusy(false);
      onChanged?.();
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

      {dojoLinked && !!pendingConfirm && (
        <View style={styles.confirmDivergentBox}>
          <View style={styles.pendingBadge}>
            <Icon name="alert_circle" size={13} color={KarateColors.warn} />
            <Text style={styles.pendingBadgeTxt}>Confirme o vínculo</Text>
          </View>
          <Text style={styles.hint}>
            O nome do praticante encontrado é bem diferente do nome deste aluno. Confira antes de continuar.
          </Text>
          <View style={styles.compareRow}>
            <View style={styles.compareCol}>
              <Text style={styles.compareLabel}>Aluno no dojô</Text>
              <Text style={styles.compareName}>{student.full_name}</Text>
            </View>
            <Text style={styles.compareArrow}>→</Text>
            <View style={styles.compareCol}>
              <Text style={styles.compareLabel}>Praticante encontrado</Text>
              <Text style={styles.compareName}>{pendingConfirm.practitioner.name}</Text>
              <Text style={styles.infoLine}>FPKT {pendingConfirm.practitioner.fpkt_number}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={cancelDivergentLink} loading={confirmBusy} style={{ flex: 1 }} />
            <KarateButton label="Confirmar vínculo" variant="sumi" size="sm" onPress={confirmDivergentLink} disabled={confirmBusy} style={{ flex: 1 }} />
          </View>
        </View>
      )}

      {dojoLinked && !pendingConfirm && fed.status === "linked" && (
        <View style={{ gap: 8 }}>
          <View style={styles.linkedBadge}>
            <Icon name="shield" size={13} color={KarateColors.ok} />
            <Text style={styles.linkedBadgeTxt}>Federado</Text>
          </View>
          <Text style={styles.infoLine}>FPKT: <Text style={styles.infoStrong}>{fed.fpktNumber ?? "—"}</Text></Text>
          <Text style={styles.infoLine}>Praticante: <Text style={styles.infoStrong}>{fed.practitionerName ?? "—"}</Text></Text>
          {!!lastLinkResult?.is_transfer && (
            <Text style={styles.hint}>Este praticante já era federado em outro dojô — a transferência foi registrada.</Text>
          )}

          {!unlinkConfirm ? (
            <KarateButton label="Desvincular" variant="ghost" size="sm" onPress={() => setUnlinkConfirm(true)} style={{ alignSelf: "flex-start", marginTop: 2 }} />
          ) : (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTxt}>
                Desvincular {student.full_name} da federação? O praticante continua existindo no cadastro da federação — só o vínculo com este aluno some.
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

      {dojoLinked && !pendingConfirm && fed.status === "pending" && (
        <View style={{ gap: 4 }}>
          <View style={styles.pendingBadge}>
            <Icon name="time-outline" size={13} color={KarateColors.warn} />
            <Text style={styles.pendingBadgeTxt}>Aguardando a federação</Text>
          </View>
          <Text style={styles.hint}>Solicitação enviada — aguardando a federação analisar.</Text>
        </View>
      )}

      {dojoLinked && !pendingConfirm && fed.status === "none" && (
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
                onPress={() => { setNumberOpen(true); setFpktInput(""); setNumberErr(null); }}
              />
              <KarateButton label="Solicitar filiação" variant="sumi" size="sm" onPress={openRequest} />
            </View>
          )}

          {numberOpen && (
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
              <View style={{ flexDirection: "row", gap: 8 }}>
                <KarateButton label="Cancelar" variant="ghost" size="sm" onPress={() => setNumberOpen(false)} style={{ flex: 1 }} />
                <KarateButton label="Vincular" variant="sumi" size="sm" onPress={submitNumber} loading={numberBusy} style={{ flex: 1 }} />
              </View>
            </View>
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
  // QA 27/07 (item 5): painel de confirmação de vínculo com nome divergente.
  confirmDivergentBox: { gap: 10, borderWidth: 1, borderColor: KarateColors.warn, borderRadius: KarateRadius.md, padding: 12, backgroundColor: KarateColors.bg2 } as ViewStyle,
  compareRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  compareCol: { flex: 1, gap: 2 } as ViewStyle,
  compareLabel: { fontSize: 10.5, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.3 } as TextStyle,
  compareName: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  compareArrow: { fontSize: 16, color: KarateColors.ink3 } as TextStyle,
});
