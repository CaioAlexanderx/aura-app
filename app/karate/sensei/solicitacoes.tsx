// ============================================================
// Painel do Sensei — Solicitações de praticante (H2)
// Aba nova: /karate/sensei/solicitacoes
//
// Consome o backend H1 (aura-backend PR #381, karateDojoPractitionerRequests.js):
//   POST /federation/:id/dojo/practitioner-requests
//   GET  /federation/:id/dojo/practitioner-requests?status=
//   GET  /federation/:id/dojo/practitioner-requests/lookup-fpkt?number=
// Esses endpoints são token-gated via requireDojoAccess (Canal A JWT de
// acesso padrão OU Canal B portal OTP do responsável) — o sensei aqui já
// está logado na própria conta Aura (Canal A), então o Bearer JWT sai
// automático do request() core (services/api.ts). NÃO é a mesma coisa do
// link público /karate/roster-update/:token (token opaco, sem JWT — por
// isso "solicitar novo praticante" mora aqui e não naquele link: o link
// público não tem como chamar uma rota JWT-gated).
//
// Regra de negócio fechada com o Caio: o sensei NUNCA cria um praticante
// direto — só SOLICITA. A federação aprova e registra o número FPKT de
// verdade (gerado por ela, fora do sistema). Faixa aqui é ALEGADA — a
// federação confere a graduação à parte, nunca prometemos aqui.
//
// Padrão de estágio inline (nunca <Modal> dentro de <Modal>, já mordeu
// este produto 4x): a confirmação de envio é um estágio inline que
// substitui o formulário, não um Modal.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius as R, KarateFonts as F, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateApi,
  PractitionerRequestInput,
  PractitionerRequestRow,
  PractitionerRequestStatus,
  FpktLookupHint,
} from "@/services/karateApi";
import { ApiError } from "@/services/api";
import { DateInput, parseBrDate } from "@/components/inputs/DateInput";
import { maskCpf, maskPhone as maskPhoneUtil } from "@/utils/masks";

const NON_LEGACY_BELT_KEYS: BeltKey[] = (Object.keys(KarateBelts) as BeltKey[]).filter(
  (k) => !KarateBelts[k].isLegacy
);

const GUARDIAN_RELATIONSHIPS = ["pai", "mãe", "avó/avô", "tio/tia", "responsável legal", "outro"];
const SEX_OPTIONS: { key: "M" | "F" | "other"; label: string }[] = [
  { key: "M", label: "Masculino" },
  { key: "F", label: "Feminino" },
  { key: "other", label: "Outro" },
];

function onlyD(v: string) {
  return (v || "").replace(/\D/g, "");
}
function maskCEP(v: string) {
  const d = onlyD(v).slice(0, 8);
  return d.length > 5 ? d.replace(/(\d{5})(\d+)/, "$1-$2") : d;
}
function ageFromISO(iso: string | null): number | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const mm = t.getMonth() - d.getMonth();
  if (mm < 0 || (mm === 0 && t.getDate() < d.getDate())) a--;
  return a;
}
function cpfValido(c: string) {
  c = onlyD(c);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
  let d = 11 - (s % 11); if (d >= 10) d = 0; if (d !== +c[9]) return false;
  s = 0; for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
  d = 11 - (s % 11); if (d >= 10) d = 0; return d === +c[10];
}

const STATUS_META: Record<PractitionerRequestStatus, { label: string; color: string; soft: string; icon: string }> = {
  pendente: { label: "Pendente", color: P.warn, soft: P.warnSoft, icon: "time" },
  aprovada: { label: "Aprovada", color: P.ok, soft: P.okSoft, icon: "checkmark-circle" },
  rejeitada: { label: "Rejeitada", color: P.danger, soft: P.dangerSoft, icon: "close-circle" },
};

// ── Formulário de nova solicitação ──────────────────────────
interface FormState {
  full_name: string;
  birth_date_br: string; // dd/mm/aaaa
  sex: "M" | "F" | "other" | "";
  cpf: string;
  rg: string;
  phone: string;
  email: string;
  belt_key: BeltKey | null;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  guardian_name: string;
  guardian_cpf: string;
  guardian_phone: string;
  guardian_relationship: string;
}
const EMPTY_FORM: FormState = {
  full_name: "", birth_date_br: "", sex: "", cpf: "", rg: "", phone: "", email: "",
  belt_key: null, zip_code: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
  guardian_name: "", guardian_cpf: "", guardian_phone: "", guardian_relationship: "",
};

type FpktMode = "unset" | "tem" | "nao_tem";

function NewRequestForm({ federationId, onCreated }: { federationId: string; onCreated: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));

  const [fpktMode, setFpktMode] = useState<FpktMode>("unset");
  const [fpktNumber, setFpktNumber] = useState("");
  const [fpktLookup, setFpktLookup] = useState<FpktLookupHint | null>(null);
  const [fpktLookupLoading, setFpktLookupLoading] = useState(false);
  const lookupReqId = useRef(0);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ alreadyPending: boolean; lookup: FpktLookupHint | null } | null>(null);

  const birthIso = parseBrDate(form.birth_date_br);
  const birthComplete = form.birth_date_br.length === 10;
  const birthBad = birthComplete && birthIso === null;
  const age = ageFromISO(birthIso);
  const isMinor = age !== null && age < 18;
  const cpfBad = form.cpf.length > 0 && !cpfValido(form.cpf);

  const nameOk = !!form.full_name.trim();
  const contactOk = !!(form.phone.trim() || form.email.trim());
  const valid = nameOk && contactOk && !birthBad && !cpfBad;

  // ── Auto-localizar (debounced, guarda de corrida por id de requisição —
  // armadilha conhecida: descartar resposta obsoleta se o sensei já digitou
  // outro número enquanto a resposta anterior ainda não chegou). ─────────
  const runLookup = useCallback((number: string) => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const digits = number.trim();
    if (!digits) { setFpktLookup(null); setFpktLookupLoading(false); return; }
    setFpktLookupLoading(true);
    lookupTimer.current = setTimeout(async () => {
      const myId = ++lookupReqId.current;
      try {
        const hint = await karateApi.lookupFpktNumber(federationId, digits);
        if (myId !== lookupReqId.current) return; // resposta obsoleta — descarta
        setFpktLookup(hint);
      } catch {
        if (myId !== lookupReqId.current) return;
        setFpktLookup(null);
      } finally {
        if (myId === lookupReqId.current) setFpktLookupLoading(false);
      }
    }, 500);
  }, [federationId]);

  function handleFpktNumberChange(v: string) {
    setFpktNumber(v);
    runLookup(v);
  }

  function resetAll() {
    setForm(EMPTY_FORM);
    setFpktMode("unset");
    setFpktNumber("");
    setFpktLookup(null);
    setTouched(false);
    setSubmitError(null);
    setResult(null);
  }

  async function handleSubmit() {
    setTouched(true);
    setSubmitError(null);
    if (!valid || submitting) return;

    const belt = form.belt_key ? KarateBelts[form.belt_key] : null;
    const body: PractitionerRequestInput = {
      full_name: form.full_name.trim(),
      birth_date: birthIso || null,
      sex: form.sex || null,
      cpf: form.cpf.trim() || null,
      rg: form.rg.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      claimed_belt: belt?.label || null,
      fpkt_number_claimed: fpktMode === "tem" ? (fpktNumber.trim() || null) : null,
      street: form.street.trim() || null,
      number: form.number.trim() || null,
      complement: form.complement.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip_code: form.zip_code.trim() || null,
      guardian_name: form.guardian_name.trim() || null,
      guardian_cpf: form.guardian_cpf.trim() || null,
      guardian_phone: form.guardian_phone.trim() || null,
      guardian_relationship: form.guardian_relationship || null,
    };

    setSubmitting(true);
    try {
      const created = await karateApi.createPractitionerRequest(federationId, body);
      setResult({ alreadyPending: !!created.already_pending, lookup: created.fpkt_lookup || fpktLookup });
      onCreated();
    } catch (e: any) {
      if (e instanceof ApiError) setSubmitError(e.message || "Não foi possível enviar a solicitação.");
      else setSubmitError("Não foi possível enviar a solicitação. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Estágio de confirmação (inline, nunca Modal) ────────────
  if (result) {
    return (
      <View style={fs.confirmCard}>
        <View style={[fs.confirmGlyph, { backgroundColor: P.okSoft }]}>
          <Icon name="checkmark-circle" size={24} color={P.ok} />
        </View>
        <Text style={fs.confirmTitle}>
          {result.alreadyPending ? "Já havia uma solicitação para essa pessoa" : "Solicitação enviada"}
        </Text>
        <Text style={fs.confirmText}>
          {result.alreadyPending
            ? "Uma solicitação pendente com o mesmo nome e nascimento já existia neste dojô — não duplicamos, a federação já está com ela."
            : "A federação vai analisar a ficha e, se aprovar, registrar o número FPKT oficial. Acompanhe o andamento na lista abaixo."}
        </Text>
        {result.lookup?.is_transfer && (
          <View style={fs.transferBanner}>
            <Icon name="swap-horizontal" size={15} color={P.warn} />
            <Text style={fs.transferBannerText}>
              O número informado já pertence a {result.lookup.practitioner?.name || "outro praticante"} — isto será
              analisado como TRANSFERÊNCIA, não como criação.
            </Text>
          </View>
        )}
        <Pressable onPress={resetAll} accessibilityRole="button" accessibilityLabel="Nova solicitação" style={fs.confirmBtn}>
          <Text style={fs.confirmBtnText}>Fazer outra solicitação</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={fs.card}>
      <Text style={fs.cardTitle}>Solicitar praticante novo</Text>
      <Text style={fs.cardSubtitle}>
        Preencha a ficha completa. A federação analisa e registra o número FPKT — o sensei nunca cadastra o
        praticante direto.
      </Text>

      <Text style={fs.sectionLabel}>Identidade</Text>
      <Field label="Nome completo *" value={form.full_name} onChangeText={(v) => set("full_name", v)} placeholder="Nome completo do praticante" />
      {touched && !nameOk && <Text style={fs.errorText}>Informe o nome do praticante.</Text>}

      <Row>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Nascimento{age !== null ? `  ·  ${age} anos` : ""}</Text>
          <DateInput value={form.birth_date_br} onChangeText={(v) => set("birth_date_br", v)} style={fs.dateInput} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>CPF</Text>
          <TextInput
            value={form.cpf}
            onChangeText={(v) => set("cpf", maskCpf(v))}
            placeholder="000.000.000-00"
            keyboardType="numeric"
            style={[fs.input, cpfBad && fs.inputBad]}
            accessibilityLabel="CPF"
          />
          {cpfBad && <Text style={fs.errorText}>Dígitos não conferem.</Text>}
        </View>
      </Row>

      <Row>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>RG</Text>
          <TextInput value={form.rg} onChangeText={(v) => set("rg", v)} style={fs.input} accessibilityLabel="RG" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Sexo</Text>
          <View style={fs.chipsRow}>
            {SEX_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => set("sex", form.sex === opt.key ? "" : opt.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: form.sex === opt.key }}
                style={[fs.chip, form.sex === opt.key && fs.chipActive]}
              >
                <Text style={[fs.chipText, form.sex === opt.key && fs.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Row>

      <Text style={fs.sectionLabel}>Contato</Text>
      <Row>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Telefone</Text>
          <TextInput
            value={form.phone}
            onChangeText={(v) => set("phone", maskPhoneUtil(v))}
            placeholder="(00) 00000-0000"
            keyboardType="numeric"
            style={fs.input}
            accessibilityLabel="Telefone"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>E-mail</Text>
          <TextInput
            value={form.email}
            onChangeText={(v) => set("email", v)}
            placeholder="email@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            style={fs.input}
            accessibilityLabel="E-mail"
          />
        </View>
      </Row>
      {touched && !contactOk && <Text style={fs.errorText}>Informe pelo menos um contato (telefone ou e-mail).</Text>}

      <Text style={fs.sectionLabel}>Endereço</Text>
      <Row>
        <View style={{ width: 140 }}>
          <Text style={fs.fieldLabel}>CEP</Text>
          <TextInput
            value={form.zip_code}
            onChangeText={(v) => set("zip_code", maskCEP(v))}
            placeholder="00000-000"
            keyboardType="numeric"
            style={fs.input}
            accessibilityLabel="CEP"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Rua</Text>
          <TextInput value={form.street} onChangeText={(v) => set("street", v)} style={fs.input} accessibilityLabel="Rua" />
        </View>
      </Row>
      <Row>
        <View style={{ width: 90 }}>
          <Text style={fs.fieldLabel}>Número</Text>
          <TextInput value={form.number} onChangeText={(v) => set("number", v)} style={fs.input} keyboardType="numeric" accessibilityLabel="Número" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Complemento</Text>
          <TextInput value={form.complement} onChangeText={(v) => set("complement", v)} style={fs.input} accessibilityLabel="Complemento" />
        </View>
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Bairro</Text>
          <TextInput value={form.neighborhood} onChangeText={(v) => set("neighborhood", v)} style={fs.input} accessibilityLabel="Bairro" />
        </View>
        <View style={{ flex: 1.4 }}>
          <Text style={fs.fieldLabel}>Cidade</Text>
          <TextInput value={form.city} onChangeText={(v) => set("city", v)} style={fs.input} accessibilityLabel="Cidade" />
        </View>
        <View style={{ width: 64 }}>
          <Text style={fs.fieldLabel}>UF</Text>
          <TextInput
            value={form.state}
            onChangeText={(v) => set("state", v.toUpperCase().slice(0, 2))}
            style={fs.input}
            maxLength={2}
            accessibilityLabel="UF"
          />
        </View>
      </Row>

      {isMinor && (
        <>
          <Text style={fs.sectionLabel}>Responsável</Text>
          <View style={fs.infoNote}>
            <Icon name="information-circle" size={13} color={P.ink3} />
            <Text style={fs.infoNoteText}>Menor de 18 anos — dados do responsável ajudam a federação a validar.</Text>
          </View>
          <Field label="Nome do responsável" value={form.guardian_name} onChangeText={(v) => set("guardian_name", v)} placeholder="Nome completo" />
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={fs.fieldLabel}>CPF do responsável</Text>
              <TextInput
                value={form.guardian_cpf}
                onChangeText={(v) => set("guardian_cpf", maskCpf(v))}
                keyboardType="numeric"
                style={fs.input}
                accessibilityLabel="CPF do responsável"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={fs.fieldLabel}>Telefone do responsável</Text>
              <TextInput
                value={form.guardian_phone}
                onChangeText={(v) => set("guardian_phone", maskPhoneUtil(v))}
                keyboardType="numeric"
                style={fs.input}
                accessibilityLabel="Telefone do responsável"
              />
            </View>
          </Row>
          <Text style={fs.fieldLabel}>Parentesco</Text>
          <View style={fs.chipsRow}>
            {GUARDIAN_RELATIONSHIPS.map((rel) => (
              <Pressable
                key={rel}
                onPress={() => set("guardian_relationship", form.guardian_relationship === rel ? "" : rel)}
                style={[fs.chip, form.guardian_relationship === rel && fs.chipActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: form.guardian_relationship === rel }}
              >
                <Text style={[fs.chipText, form.guardian_relationship === rel && fs.chipTextActive]}>{rel}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text style={fs.sectionLabel}>Faixa alegada</Text>
      <View style={fs.infoNote}>
        <Icon name="information-circle" size={13} color={P.ink3} />
        <Text style={fs.infoNoteText}>O que o dojô informa — a federação confere a graduação por conta própria, isto não é uma promessa de faixa.</Text>
      </View>
      <View style={fs.beltGrid}>
        {NON_LEGACY_BELT_KEYS.map((key) => {
          const belt = KarateBelts[key];
          const selected = form.belt_key === key;
          return (
            <Pressable
              key={key}
              onPress={() => set("belt_key", key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[fs.beltChip, { backgroundColor: belt.color, borderColor: selected ? P.ink : "rgba(0,0,0,0.12)" }, selected && fs.beltChipSelected]}
            >
              <Text style={[fs.beltChipText, { color: belt.textColor }]}>{belt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={fs.sectionLabel}>Número FPKT</Text>
      <View style={fs.chipsRow}>
        <Pressable
          onPress={() => setFpktMode("tem")}
          style={[fs.fpktModeChip, fpktMode === "tem" && fs.fpktModeChipActive]}
          accessibilityRole="radio"
          accessibilityState={{ checked: fpktMode === "tem" }}
        >
          <Text style={[fs.fpktModeChipText, fpktMode === "tem" && fs.fpktModeChipTextActive]}>Tenho o número</Text>
        </Pressable>
        <Pressable
          onPress={() => { setFpktMode("nao_tem"); setFpktNumber(""); setFpktLookup(null); }}
          style={[fs.fpktModeChip, fpktMode === "nao_tem" && fs.fpktModeChipActive]}
          accessibilityRole="radio"
          accessibilityState={{ checked: fpktMode === "nao_tem" }}
        >
          <Text style={[fs.fpktModeChipText, fpktMode === "nao_tem" && fs.fpktModeChipTextActive]}>Não tenho</Text>
        </Pressable>
      </View>

      {fpktMode === "tem" && (
        <View style={{ marginTop: 8 }}>
          <View style={fs.fpktInputRow}>
            <TextInput
              value={fpktNumber}
              onChangeText={handleFpktNumberChange}
              placeholder="Número FPKT"
              style={[fs.input, { flex: 1 }]}
              accessibilityLabel="Número FPKT — auto-localizar"
            />
            {fpktLookupLoading && <ActivityIndicator size="small" color={P.ink3} style={{ marginLeft: 8 }} />}
          </View>
          {!fpktLookupLoading && fpktLookup?.found && (
            <View style={fs.transferBanner}>
              <Icon name="swap-horizontal" size={15} color={P.warn} />
              <Text style={fs.transferBannerText}>
                Esse número já é de {fpktLookup.practitioner?.name || "outro praticante"}
                {fpktLookup.practitioner?.current_dojo_name ? ` (${fpktLookup.practitioner.current_dojo_name})` : ""} —
                isto será tratado como TRANSFERÊNCIA, não criação.
              </Text>
            </View>
          )}
          {!fpktLookupLoading && fpktLookup && !fpktLookup.found && fpktNumber.trim() && (
            <Text style={fs.fpktFreeNote}>Número livre — segue junto com a solicitação para a federação conferir.</Text>
          )}
        </View>
      )}
      {fpktMode === "nao_tem" && (
        <Text style={fs.fpktFreeNote}>Sem problema — a federação atribui o número quando aprovar.</Text>
      )}

      {!!submitError && <Text style={fs.submitError}>{submitError}</Text>}

      <Pressable
        onPress={submitting ? undefined : handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Enviar solicitação"
        style={[fs.submitBtn, submitting && { opacity: 0.6 }]}
      >
        {submitting ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={fs.submitBtnText}>Enviar solicitação</Text>}
      </Pressable>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={fs.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} style={fs.input} accessibilityLabel={label} />
    </View>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>{children}</View>;
}

// ── Status das solicitações ──────────────────────────────────
const FILTERS: { key: PractitionerRequestStatus | "todas"; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "pendente", label: "Pendentes" },
  { key: "aprovada", label: "Aprovadas" },
  { key: "rejeitada", label: "Rejeitadas" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function RequestStatusRow({ r }: { r: PractitionerRequestRow }) {
  const meta = STATUS_META[r.status];
  return (
    <View style={rs.row}>
      <View style={{ flex: 1 }}>
        <Text style={rs.name}>{r.full_name}</Text>
        <Text style={rs.meta}>
          {r.claimed_belt ? `Faixa alegada: ${r.claimed_belt} · ` : ""}
          Enviada em {fmtDate(r.created_at)}
        </Text>
        {r.status === "aprovada" && (
          <Text style={rs.resolvedOk}>
            Registrado{r.resolved_fpkt_number ? ` como Nº ${r.resolved_fpkt_number}` : ""}
            {r.resolved_practitioner_name && r.resolved_practitioner_name !== r.full_name ? ` — ${r.resolved_practitioner_name}` : ""}
          </Text>
        )}
        {r.status === "rejeitada" && (
          <Text style={rs.resolvedBad}>{r.reject_reason ? `Motivo: ${r.reject_reason}` : "Sem motivo informado."}</Text>
        )}
        {r.status === "pendente" && <Text style={rs.pendingNote}>Aguardando análise da federação.</Text>}
      </View>
      <View style={[rs.badge, { backgroundColor: meta.soft }]}>
        <Icon name={meta.icon as any} size={12} color={meta.color} />
        <Text style={[rs.badgeText, { color: meta.color }]}>{meta.label}</Text>
      </View>
    </View>
  );
}

function StatusList({ federationId, refreshKey }: { federationId: string; refreshKey: number }) {
  const [filter, setFilter] = useState<PractitionerRequestStatus | "todas">("todas");
  const [rows, setRows] = useState<PractitionerRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const myGen = ++genRef.current;
    setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listPractitionerRequests(federationId, filter === "todas" ? undefined : filter);
      if (myGen !== genRef.current) return; // descarta resposta obsoleta
      setRows(res.data || []);
    } catch {
      if (myGen !== genRef.current) return;
      setError(true);
    } finally {
      if (myGen === genRef.current) setLoading(false);
    }
  }, [federationId, filter]);

  useEffect(() => { if (federationId) load(); }, [load, federationId, refreshKey]);

  return (
    <View style={rs.card}>
      <Text style={rs.title}>Status das solicitações</Text>
      <View style={rs.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[rs.filterChip, filter === f.key && rs.filterChipActive]}
            accessibilityRole="button"
            accessibilityLabel={f.label}
          >
            <Text style={[rs.filterChipText, filter === f.key && rs.filterChipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}><ActivityIndicator color={P.primary} size="small" /></View>
      ) : error ? (
        <View style={rs.emptyBox}>
          <Text style={rs.emptyText}>Não foi possível carregar as solicitações.</Text>
          <Pressable onPress={load} accessibilityRole="button" accessibilityLabel="Tentar novamente"><Text style={rs.retryText}>Tentar de novo</Text></Pressable>
        </View>
      ) : rows.length === 0 ? (
        <View style={rs.emptyBox}><Text style={rs.emptyText}>Nenhuma solicitação por aqui ainda.</Text></View>
      ) : (
        rows.map((r) => <RequestStatusRow key={r.id} r={r} />)
      )}
    </View>
  );
}

export default function SenseiSolicitacoes() {
  const { federationId } = useKarateFederation();
  const [refreshKey, setRefreshKey] = useState(0);

  if (!federationId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
        <ActivityIndicator color={P.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Solicitações de praticante novo</Text>
      <Text style={styles.subtitle}>
        O número FPKT é emitido pela federação — preencha a ficha completa e envie para análise.
      </Text>

      <NewRequestForm federationId={federationId} onCreated={() => setRefreshKey((k) => k + 1)} />
      <StatusList federationId={federationId} refreshKey={refreshKey} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, gap: 16 } as ViewStyle,
  eyebrow: { fontFamily: F.heading, fontSize: 19, color: P.ink, marginTop: 4 } as TextStyle,
  subtitle: { fontSize: 12.5, color: P.ink3, lineHeight: 18, marginBottom: 4 } as TextStyle,
});

const fs = StyleSheet.create({
  card: { backgroundColor: P.glass, borderRadius: R.lg, borderWidth: 1, borderColor: P.border, padding: 16 } as ViewStyle,
  cardTitle: { fontFamily: F.heading, fontSize: 16, color: P.ink } as TextStyle,
  cardSubtitle: { fontSize: 12, color: P.ink3, lineHeight: 17, marginTop: 4, marginBottom: 14 } as TextStyle,
  sectionLabel: { fontSize: 11, fontWeight: "800", color: P.ink2, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 8 } as TextStyle,
  fieldLabel: { fontSize: 11.5, fontWeight: "700", color: P.ink2, marginBottom: 5 } as TextStyle,
  input: { borderWidth: 1, borderColor: P.border, borderRadius: R.sm, backgroundColor: P.paperWarm, paddingHorizontal: 11, paddingVertical: 9, fontSize: 14, color: P.ink } as TextStyle,
  inputBad: { borderColor: P.danger },
  dateInput: { borderWidth: 1, borderColor: P.border, borderRadius: R.sm, backgroundColor: P.paperWarm, paddingHorizontal: 11, paddingVertical: 9, fontSize: 14, color: P.ink } as TextStyle,
  errorText: { fontSize: 11, color: P.danger, marginTop: 4 } as TextStyle,

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  chip: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: R.pill, borderWidth: 1, borderColor: P.border, backgroundColor: P.paperWarm } as ViewStyle,
  chipActive: { backgroundColor: P.ink, borderColor: P.ink } as ViewStyle,
  chipText: { fontSize: 12, fontWeight: "600", color: P.ink2 } as TextStyle,
  chipTextActive: { color: "#fdf8f2" } as TextStyle,

  infoNote: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 10 } as ViewStyle,
  infoNoteText: { flex: 1, fontSize: 11.5, color: P.ink3, lineHeight: 16 } as TextStyle,

  beltGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 } as ViewStyle,
  beltChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: R.sm, borderWidth: 1 } as ViewStyle,
  beltChipSelected: { borderWidth: 2 } as ViewStyle,
  beltChipText: { fontSize: 12.5, fontWeight: "700" } as TextStyle,

  fpktModeChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1, borderColor: P.border, backgroundColor: P.paperWarm } as ViewStyle,
  fpktModeChipActive: { backgroundColor: P.primary, borderColor: P.primary } as ViewStyle,
  fpktModeChipText: { fontSize: 12.5, fontWeight: "700", color: P.ink2 } as TextStyle,
  fpktModeChipTextActive: { color: "#fdf8f2" } as TextStyle,
  fpktInputRow: { flexDirection: "row", alignItems: "center" } as ViewStyle,
  fpktFreeNote: { fontSize: 11.5, color: P.ink3, marginTop: 6 } as TextStyle,

  transferBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P.warnSoft, borderWidth: 1, borderColor: "rgba(168,84,58,0.25)", borderRadius: R.md, padding: 10, marginTop: 8 } as ViewStyle,
  transferBannerText: { flex: 1, fontSize: 12, color: P.ink2, lineHeight: 16 } as TextStyle,

  submitError: { fontSize: 12, color: P.danger, marginTop: 14, textAlign: "center" } as TextStyle,
  submitBtn: { marginTop: 18, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 14, alignItems: "center" } as ViewStyle,
  submitBtnText: { color: "#fdf8f2", fontSize: 15, fontWeight: "800" } as TextStyle,

  confirmCard: { backgroundColor: P.glass, borderRadius: R.lg, borderWidth: 1, borderColor: P.border, padding: 22, alignItems: "center", gap: 10 } as ViewStyle,
  confirmGlyph: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" } as ViewStyle,
  confirmTitle: { fontFamily: F.heading, fontSize: 17, color: P.ink, textAlign: "center" } as TextStyle,
  confirmText: { fontSize: 12.5, color: P.ink3, textAlign: "center", lineHeight: 18 } as TextStyle,
  confirmBtn: { marginTop: 6, borderWidth: 1, borderColor: P.border, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 18 } as ViewStyle,
  confirmBtnText: { fontSize: 13, fontWeight: "700", color: P.primary } as TextStyle,
});

const rs = StyleSheet.create({
  card: { backgroundColor: P.glass, borderRadius: R.lg, borderWidth: 1, borderColor: P.border, padding: 16 } as ViewStyle,
  title: { fontFamily: F.heading, fontSize: 16, color: P.ink, marginBottom: 10 } as TextStyle,
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 } as ViewStyle,
  filterChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: R.pill, borderWidth: 1, borderColor: P.border } as ViewStyle,
  filterChipActive: { backgroundColor: P.ink, borderColor: P.ink } as ViewStyle,
  filterChipText: { fontSize: 11.5, fontWeight: "700", color: P.ink2 } as TextStyle,
  filterChipTextActive: { color: "#fdf8f2" } as TextStyle,

  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: P.border } as ViewStyle,
  name: { fontSize: 14, fontWeight: "700", color: P.ink } as TextStyle,
  meta: { fontSize: 11, color: P.ink3, marginTop: 2 } as TextStyle,
  resolvedOk: { fontSize: 11.5, color: P.ok, fontWeight: "700", marginTop: 4 } as TextStyle,
  resolvedBad: { fontSize: 11.5, color: P.danger, marginTop: 4, lineHeight: 15 } as TextStyle,
  pendingNote: { fontSize: 11, color: P.ink4, marginTop: 4 } as TextStyle,

  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 9 } as ViewStyle,
  badgeText: { fontSize: 10.5, fontWeight: "800" } as TextStyle,

  emptyBox: { paddingVertical: 24, alignItems: "center", gap: 8 } as ViewStyle,
  emptyText: { fontSize: 12.5, color: P.ink3, textAlign: "center" } as TextStyle,
  retryText: { fontSize: 12.5, fontWeight: "700", color: P.primary } as TextStyle,
});
