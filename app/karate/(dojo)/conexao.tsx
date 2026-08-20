// ============================================================
// Aura Karatê (dojô) — Federação: conexão/filiação + envio de alunos (F6 + F9)
// Rota: /karate/(dojo)/conexao
//
// Antes desta tela, o dojô self-serve ficava PRESO: linked=false fazia
// "Eventos" sumir da nav, "Anuidade"/"Certificados" mostrarem um estado
// de "conecte seu dojô" e a solicitação de praticante devolver 409 — mas
// não existia CAMINHO NENHUM no produto para se conectar. Esta tela é
// essa porta (contrato Aura-backend#424 + migration 252, canal
// autenticado JWT — GET/POST /federation/:id/dojo/connection).
//
// 4 estados (status vem do backend, nunca inferido no cliente):
//   none      — nunca pediu. Explica o que a conexão destrava + formulário.
//   pending   — pediu, aguardando a federação. Sem botão de reenviar (o
//               back é idempotente — já_pending — mas não incentivamos).
//   approved  — conectado. Se t "request" (dojô criado direto pela
//               federação, sem pedido), variante enxuta sem inventar
//               data de pedido.
//   rejected  — motivo em destaque + "Enviar nova solicitação" (permitido
//               pelo back).
//
// Nota sobre o "resumo do que foi enviado" no estado pending: o contrato
// de GET /connection devolve `request:{id,status,created_at,reviewed_at,
// rejection_reason}` — SEM ecoar os dados de contato enviados (nome,
// telefone, endereço...). Por isso o resumo detalhado só existe NA MESMA
// sessão em que o formulário foi enviado (guardado em memória,
// `lastSubmitted`); depois de um reload da página, mostramos só as datas
// que o backend garante. Dado ausente não é tratado como pendência —
// não inventamos um resumo que o servidor não devolveu.
//
// linked/dojoReload (contexts/KarateDojo): quando esta tela detecta
// info.linked=true, dispara reload() do contexto pra sincronizar a nav
// do DojoShell (item "Eventos" reaparece) sem exigir um refresh manual.
//
// Sem Modal: formulário e ações de reenvio ficam INLINE na própria tela
// (mesmo racional documentado em conexoes/solicitacoes/[requestId].tsx —
// RN Web renderiza Modal-dentro-de-Modal atrás da tela).
//
// F9 (04/08/2026 — pedido do Caio): a aba "Solicitações" (formulário que
// REDIGITAVA a ficha de um praticante que provavelmente já está
// registrado no dojô) e a aba "Federação" (esta tela) viravam duas
// entradas de nav pra uma coisa só — o vínculo do dojô com a FPKT e os
// envios de alunos convivem no mesmo lugar. A antiga
// app/karate/(dojo)/solicitacoes.tsx virou redirect fino pra cá; o item
// "Solicitações" saiu do DojoShell. Quando o dojô está conectado
// (`info.linked`), esta tela também mostra a lista de seleção múltipla
// dos alunos do dojô pra enviar em lote pra federação validar — ver
// components/karate/dojoAlunos/FederacaoEnviarAlunosSection.tsx (reusa
// karateDojoStudentsApi.requestFederation, a mesma rota que a ficha do
// aluno já usa em "Solicitar filiação" — sem endpoint novo).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateFonts, KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useKarateDojo } from "@/contexts/KarateDojo";
import {
  karateAffiliationApi, DojoConnectionInfo, DojoConnectionRequestBody,
} from "@/services/karateAffiliationApi";
import { ApiError } from "@/services/api";
import { toast } from "@/components/Toast";
import { Skeleton } from "@/components/karate/Skeleton";
import { FederacaoEnviarAlunosSection } from "@/components/karate/dojoAlunos/FederacaoEnviarAlunosSection";

// Formata ISO de data (pura 'YYYY-MM-DD' OU timestamptz completo) sem
// cair no bug de -1 dia: datas puras usam parse manual; timestamps de
// verdade usam Date real (o fuso local É o certo nesse caso).
function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const raw = String(iso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, mo, d] = raw.split("-");
    return `${d}/${mo}/${y}`;
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface FormState {
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  cnpj: string;
  cpf: string;
  address: string;
  city: string;
  state: string;
  students_count: string;
  notes: string;
}
const EMPTY_FORM: FormState = {
  contact_name: "", contact_phone: "", contact_email: "", cnpj: "", cpf: "",
  address: "", city: "", state: "", students_count: "", notes: "",
};

function Field({ label, required, value, onChangeText, placeholder, error, multiline, keyboardType }: {
  label: string; required?: boolean; value: string; onChangeText: (t: string) => void;
  placeholder?: string; error?: string; multiline?: boolean; keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{required ? " *" : ""}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, !!error && styles.inputErrorBorder] as any}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={KarateColors.ink4}
        multiline={multiline}
        keyboardType={keyboardType}
        accessibilityLabel={label}
      />
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

const BENEFITS = [
  "Eventos e exames de faixa abertos pela federação",
  "Anuidade do dojô à federação (situação e Pix)",
  "Solicitação de praticantes novos para a federação",
  "Certificados de graduação dos seus praticantes",
];

export default function DojoConexao() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const { reload: dojoReload } = useKarateDojo();

  const [info, setInfo] = useState<DojoConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState<DojoConnectionRequestBody | null>(null);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await karateAffiliationApi.getConnection(federationId);
      setInfo(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  // Sincroniza a nav do DojoShell (item "Eventos") assim que esta tela
  // enxerga linked=true — sem isso o sensei precisaria dar F5 manual.
  useEffect(() => {
    if (info?.linked) dojoReload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.linked]);

  const setField = (k: keyof FormState) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const openForm = () => { setForm(EMPTY_FORM); setFieldErrors({}); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setFieldErrors({}); };

  const handleSubmit = useCallback(async () => {
    if (!federationId) return;
    const name = form.contact_name.trim();
    const phone = form.contact_phone.trim();
    const errs: Record<string, string> = {};
    if (!name) errs.contact_name = "Informe o nome do contato.";
    if (!phone) errs.contact_phone = "Informe o telefone do contato.";
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    const body: DojoConnectionRequestBody = { contact_name: name, contact_phone: phone };
    if (form.contact_email.trim()) body.contact_email = form.contact_email.trim();
    if (form.cnpj.trim()) body.cnpj = form.cnpj.trim();
    if (form.cpf.trim()) body.cpf = form.cpf.trim();
    if (form.address.trim()) body.address = form.address.trim();
    if (form.city.trim()) body.city = form.city.trim();
    if (form.state.trim()) body.state = form.state.trim().toUpperCase();
    if (form.notes.trim()) body.notes = form.notes.trim();
    const studentsCount = parseInt(form.students_count, 10);
    if (Number.isFinite(studentsCount) && studentsCount >= 0) body.students_count = studentsCount;

    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await karateAffiliationApi.requestConnection(federationId, body);
      setLastSubmitted(body);
      toast.success(
        res.already_pending
          ? "Você já tinha uma solicitação em análise — nada foi duplicado."
          : "Solicitação enviada. A federação vai analisar."
      );
      setShowForm(false);
      await load();
    } catch (e: any) {
      if (e instanceof ApiError) {
        const code = e.data?.code;
        if (e.status === 422) {
          const rawErrs = e.data?.errors || e.data?.fields;
          if (rawErrs && typeof rawErrs === "object") {
            const mapped: Record<string, string> = {};
            for (const k of Object.keys(rawErrs)) mapped[k] = String((rawErrs as any)[k]);
            setFieldErrors(mapped);
          }
          toast.error(e.message || "Confira os campos e tente novamente.");
        } else if (e.status === 409 && code === "JA_CONECTADO") {
          toast.info("Este dojô já está conectado à federação.");
          await load();
        } else if (e.status === 503) {
          toast.error("A conexão com a federação ainda está sendo configurada. Tente novamente em instantes.");
        } else if (e.status === 403 && code === "PORTAL_READ_ONLY") {
          toast.error("Esta ação não está disponível neste canal.");
        } else {
          toast.error(e.message || "Não foi possível enviar a solicitação.");
        }
      } else {
        toast.error("Não foi possível enviar a solicitação. Tente de novo.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [federationId, form, load]);

  if (loading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={{ gap: 8 }}>
          <Skeleton width={90} height={11} />
          <Skeleton width={220} height={24} />
          <Skeleton width="90%" height={13} />
          <Skeleton width="80%" height={13} />
        </View>
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Skeleton width={44} height={44} radius={KarateRadius.pill} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="70%" height={15} />
              <Skeleton width="45%" height={12} />
            </View>
          </View>
          <Skeleton width="100%" height={12} />
          <Skeleton width="85%" height={12} />
          <Skeleton width="100%" height={44} radius={KarateRadius.md} style={{ marginTop: 4 }} />
        </View>
      </ScrollView>
    );
  }

  if (error || !info) {
    return (
      <View style={styles.centerBox}>
        <Icon name="alert_circle" size={28} color={KarateColors.ink3} />
        <Text style={styles.stateTxt}>Não foi possível carregar a conexão com a federação.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
          <Text style={styles.retryTxt}>Tentar de novo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const federationName = info.federation?.name || "a federação";

  if (info.schema_pending) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Federação</Text>
        <Text style={styles.title}>Conexão com a federação</Text>
        <View style={styles.card}>
          <Icon name="time-outline" size={26} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>A conexão com a federação ainda está sendo configurada pela Aura.</Text>
          <Text style={styles.stateSub}>Tente novamente mais tarde.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const req = info.request;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>Federação</Text>
        <Text style={styles.title}>Conexão com {federationName}</Text>
        <Text style={styles.lead}>
          A conexão do seu dojô com a federação destrava eventos, anuidade, certificados e o envio de alunos
          para validação da federação.
        </Text>
      </View>

      {/* ── none: nunca pediu ───────────────────── */}
      {info.status === "none" && (
        <>
          <View style={styles.card}>
            <View style={styles.heroRow}>
              <View style={styles.heroIco}><Icon name="link" size={22} color={KarateColors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Seu dojô ainda não está conectado</Text>
                <Text style={styles.cardSub}>A conexão destrava:</Text>
              </View>
            </View>
            {BENEFITS.map((b) => (
              <View key={b} style={styles.benefitRow}>
                <Icon name="checkmark" size={14} color={KarateColors.ok} />
                <Text style={styles.benefitTxt}>{b}</Text>
              </View>
            ))}
            {!showForm && (
              <TouchableOpacity style={styles.primaryBtn} onPress={openForm} accessibilityRole="button">
                <Icon name="paper-plane-outline" size={15} color="#fff" />
                <Text style={styles.primaryBtnTxt}>Solicitar conexão</Text>
              </TouchableOpacity>
            )}
          </View>

          {showForm && (
            <ConnectionForm
              form={form} setField={setField} fieldErrors={fieldErrors}
              submitting={submitting} onCancel={closeForm} onSubmit={handleSubmit}
            />
          )}
        </>
      )}

      {/* ── pending: aguardando a federação ────────────────── */}
      {info.status === "pending" && (
        <View style={styles.card}>
          <View style={styles.heroRow}>
            <View style={[styles.heroIco, { borderColor: KarateColors.warn }]}>
              <Icon name="time-outline" size={22} color={KarateColors.warn} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Solicitação enviada</Text>
              <Text style={styles.cardSub}>
                {req?.created_at ? `Enviado em ${fmtDate(req.created_at)} · aguardando análise da federação` : "Aguardando análise da federação"}
              </Text>
            </View>
          </View>
          {lastSubmitted && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Resumo do que foi enviado</Text>
              <Text style={styles.summaryLine}>Contato: {lastSubmitted.contact_name} · {lastSubmitted.contact_phone}</Text>
              {!!lastSubmitted.contact_email && <Text style={styles.summaryLine}>E-mail: {lastSubmitted.contact_email}</Text>}
              {!!(lastSubmitted.cnpj || lastSubmitted.cpf) && (
                <Text style={styles.summaryLine}>{lastSubmitted.cnpj ? `CNPJ: ${lastSubmitted.cnpj}` : `CPF: ${lastSubmitted.cpf}`}</Text>
              )}
              {!!(lastSubmitted.city || lastSubmitted.state) && (
                <Text style={styles.summaryLine}>Cidade: {[lastSubmitted.city, lastSubmitted.state].filter(Boolean).join("/")}</Text>
              )}
              {lastSubmitted.students_count != null && (
                <Text style={styles.summaryLine}>Alunos informados: {lastSubmitted.students_count}</Text>
              )}
            </View>
          )}
          <Text style={styles.stateSub}>Sem ação necessária agora — a federação avisa quando decidir.</Text>
        </View>
      )}

      {/* ── approved: conectado ──────────────────────── */}
      {info.status === "approved" && (
        <View style={styles.card}>
          <View style={styles.heroRow}>
            <View style={[styles.heroIco, { borderColor: KarateColors.ok }]}>
              <Icon name="checkmark-circle" size={22} color={KarateColors.ok} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {req
                  ? `Conectado à ${federationName}${info.linked_at ? ` desde ${fmtDate(info.linked_at)}` : ""}`
                  : `Conectado à ${federationName}`}
              </Text>
              {/* Sem "request" = dojô cadastrado direto pela federação — variante
                  enxuta, sem inventar uma data de pedido que nunca existiu. */}
              <Text style={styles.cardSub}>Seu dojô já usa tudo que a conexão destrava:</Text>
            </View>
          </View>
          {BENEFITS.map((b) => (
            <View key={b} style={styles.benefitRow}>
              <Icon name="checkmark" size={14} color={KarateColors.ok} />
              <Text style={styles.benefitTxt}>{b}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── rejected: motivo + nova solicitação ─────────────── */}
      {info.status === "rejected" && (
        <>
          <View style={styles.card}>
            <View style={styles.heroRow}>
              <View style={[styles.heroIco, { borderColor: KarateColors.danger }]}>
                <Icon name="alert_circle" size={22} color={KarateColors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Solicitação não aprovada</Text>
                {req?.reviewed_at && <Text style={styles.cardSub}>Analisada em {fmtDate(req.reviewed_at)}</Text>}
              </View>
            </View>
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Motivo</Text>
              <Text style={styles.reasonTxt}>{req?.rejection_reason || "Não informado."}</Text>
            </View>
            {!showForm && (
              <TouchableOpacity style={styles.primaryBtn} onPress={openForm} accessibilityRole="button">
                <Icon name="paper-plane-outline" size={15} color="#fff" />
                <Text style={styles.primaryBtnTxt}>Enviar nova solicitação</Text>
              </TouchableOpacity>
            )}
          </View>

          {showForm && (
            <ConnectionForm
              form={form} setField={setField} fieldErrors={fieldErrors}
              submitting={submitting} onCancel={closeForm} onSubmit={handleSubmit}
            />
          )}
        </>
      )}

      {/* F9: envio em lote de alunos do dojô para a federação validar —
          só quando o dojô já está conectado (a rota reusada exige
          conexão; ver FederacaoEnviarAlunosSection). */}
      {info.linked && (
        <FederacaoEnviarAlunosSection federationId={federationId} />
      )}

      <TouchableOpacity style={styles.backLink} onPress={() => router.push("/karate/(dojo)" as any)} accessibilityRole="button">
        <Icon name="chevron-back" size={16} color={KarateColors.primary} />
        <Text style={styles.backLinkTxt}>Voltar ao painel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ConnectionForm({ form, setField, fieldErrors, submitting, onCancel, onSubmit }: {
  form: FormState; setField: (k: keyof FormState) => (v: string) => void;
  fieldErrors: Record<string, string>; submitting: boolean;
  onCancel: () => void; onSubmit: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Dados para a federação analisar</Text>
      <Text style={styles.cardSub}>Campos com * são obrigatórios — o resto ajuda a federação, mas pode ficar em branco.</Text>

      <Field label="Nome do contato" required value={form.contact_name} onChangeText={setField("contact_name")} error={fieldErrors.contact_name} placeholder="Quem a federação pode procurar" />
      <Field label="Telefone do contato" required value={form.contact_phone} onChangeText={setField("contact_phone")} error={fieldErrors.contact_phone} placeholder="(00) 00000-0000" />
      <Field label="E-mail (opcional)" value={form.contact_email} onChangeText={setField("contact_email")} error={fieldErrors.contact_email} placeholder="contato@dojo.com" />
      <Field label="CNPJ (opcional)" value={form.cnpj} onChangeText={setField("cnpj")} error={fieldErrors.cnpj} placeholder="Se o dojô tiver CNPJ" />
      <Field label="CPF (opcional)" value={form.cpf} onChangeText={setField("cpf")} error={fieldErrors.cpf} placeholder="Se não tiver CNPJ" />
      <Field label="Endereço (opcional)" value={form.address} onChangeText={setField("address")} error={fieldErrors.address} />
      <Field label="Cidade (opcional)" value={form.city} onChangeText={setField("city")} error={fieldErrors.city} />
      <Field label="UF (opcional)" value={form.state} onChangeText={setField("state")} error={fieldErrors.state} placeholder="PA" />
      <Field label="Número de alunos (opcional)" value={form.students_count} onChangeText={setField("students_count")} error={fieldErrors.students_count} keyboardType="numeric" />
      <Field label="Observações (opcional)" value={form.notes} onChangeText={setField("notes")} error={fieldErrors.notes} multiline placeholder="Algo que ajude a federação a entender seu dojô" />

      <View style={styles.formActions}>
        <TouchableOpacity onPress={submitting ? undefined : onCancel} style={styles.cancelBtn} accessibilityRole="button">
          <Text style={styles.cancelTxt}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, submitting && styles.btnDisabled]}
          onPress={submitting ? undefined : onSubmit}
          accessibilityRole="button"
        >
          {submitting ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <Icon name="paper-plane-outline" size={15} color="#fff" />
              <Text style={styles.primaryBtnTxt}>Enviar solicitação</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 48, maxWidth: 640, width: "100%", alignSelf: "center" } as ViewStyle,
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24, backgroundColor: KarateColors.bg } as ViewStyle,

  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  title: { fontSize: 24, fontFamily: KarateFonts.heading, fontWeight: "400", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 480 } as TextStyle,

  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 10 } as ViewStyle,
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 } as ViewStyle,
  heroIco: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", borderWidth: 1, borderColor: KarateColors.primary, alignItems: "center", justifyContent: "center" } as ViewStyle,
  cardTitle: { fontSize: 15, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12.5, color: KarateColors.ink3, marginTop: 3, lineHeight: 18 } as TextStyle,

  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 } as ViewStyle,
  benefitTxt: { fontSize: 13, color: KarateColors.ink2, flex: 1 } as TextStyle,

  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.md, paddingVertical: 12, paddingHorizontal: 18, marginTop: 6, alignSelf: "flex-start" } as ViewStyle,
  primaryBtnTxt: { fontSize: 14, fontWeight: "700", color: "#fff" } as TextStyle,
  btnDisabled: { opacity: 0.6 } as ViewStyle,

  formActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 8 } as ViewStyle,
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14 } as ViewStyle,
  cancelTxt: { fontSize: 13, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,

  field: { marginBottom: 4 } as ViewStyle,
  fieldLabel: { fontSize: 11, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 } as TextStyle,
  input: { fontSize: 13, color: KarateColors.ink, backgroundColor: KarateColors.bg2, borderWidth: 1, borderColor: KarateColors.border2, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 10 } as any,
  inputMultiline: { minHeight: 72, textAlignVertical: "top" } as any,
  inputErrorBorder: { borderColor: KarateColors.danger } as any,
  fieldError: { fontSize: 11.5, color: KarateColors.danger, marginTop: 4 } as TextStyle,

  summaryBox: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, padding: 12, gap: 3 } as ViewStyle,
  summaryTitle: { fontSize: 11.5, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 } as TextStyle,
  summaryLine: { fontSize: 12.5, color: KarateColors.ink2 } as TextStyle,

  reasonBox: { backgroundColor: KarateColors.dangerSoft, borderRadius: KarateRadius.md, padding: 12, gap: 3 } as ViewStyle,
  reasonLabel: { fontSize: 11, fontWeight: "700", color: KarateColors.danger, textTransform: "uppercase", letterSpacing: 0.4 } as TextStyle,
  reasonTxt: { fontSize: 13, color: KarateColors.ink, marginTop: 2, lineHeight: 18 } as TextStyle,

  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center", maxWidth: 380 } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 340 } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16, alignSelf: "center" } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  backLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 4 } as ViewStyle,
  backLinkTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
});
