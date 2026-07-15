// ============================================================
// AURA KARATÊ — Ficha de solicitação de praticante novo (H2b)
//
// Componente COMPARTILHADO entre os dois lugares que abrem essa ficha:
//   - app/karate/roster-update/[token].tsx  (link PÚBLICO, sem login —
//     CAMINHO PRINCIPAL, decisão do Caio 14/07/2026: a solicitação de
//     praticante novo mora no link público de atualização cadastral, não
//     atrás de JWT)
//   - app/karate/sensei/solicitacoes.tsx    (Portal do Sensei autenticado
//     — espelho pra quem prefere entrar logado)
//
// Extraído de solicitacoes.tsx (H2) sem duplicar lógica: quem injeta o
// backend (autenticado via JWT/federationId OU público via token opaco) é
// o CALLER, através das props onSubmit/onLookupFpkt/fetchRequests — este
// componente não sabe (nem precisa saber) qual dos dois canais está por
// trás.
//
// Regra de negócio (fechada com o Caio): o sensei NUNCA cria um
// praticante direto — só SOLICITA. A federação aprova e registra o
// número FPKT de verdade (gerado por ela, fora do sistema). Faixa aqui é
// ALEGADA — a federação confere a graduação à parte, nunca prometemos
// aqui.
//
// Padrão de estágio inline (nunca <Modal> dentro de <Modal>, já mordeu
// este produto 4x): a confirmação de envio é um estágio inline que
// substitui o formulário, não um Modal.
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, Image, Platform,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius as R, KarateFonts as F, KarateBelts, BeltKey, resolveBeltKey } from "@/constants/karateTheme";
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";
import { maskCpf, maskPhone as maskPhoneUtil } from "@/utils/masks";
// Item 9 (revisão Atualização Cadastral, 15/07/2026): MESMO mecanismo de
// upload de foto já usado pro praticante existente (PraticanteFichaModal.tsx)
// — picker web + leitura base64. Nada novo inventado aqui.
import { pickFileWeb } from "@/services/studioUploadApi";
import { fileToBase64 } from "@/components/karate/praticante-ficha/FotoSection";

const IS_WEB = Platform.OS === "web";

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

// ── Tipos — shape compartilhado entre canal autenticado (services/karateApi.ts,
// PractitionerRequestInput) e canal público (services/karatePublicApi.ts,
// mesmo shape). Definidos aqui de novo (não importados de nenhum dos
// dois) de propósito: este componente não deve depender de qual canal o
// caller está usando — TypeScript casa estruturalmente. ────────────────
export interface PractitionerRequestBody {
  full_name: string;
  birth_date?: string | null;
  sex?: "M" | "F" | "other" | null;
  cpf?: string | null;
  rg?: string | null;
  phone?: string | null;
  email?: string | null;
  claimed_belt?: string | null;
  fpkt_number_claimed?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  guardian_name?: string | null;
  guardian_cpf?: string | null;
  guardian_phone?: string | null;
  guardian_relationship?: string | null;
}

export interface FpktLookupHint {
  found: boolean;
  is_transfer?: boolean;
  message?: string;
  practitioner?: {
    id: string;
    name: string;
    current_dojo_id: string | null;
    current_dojo_name: string | null;
    is_active: boolean;
  };
}

export interface PractitionerRequestCreateResult {
  /** Item 9: precisamos do id da solicitação recém-criada pra anexar a foto depois. */
  id?: string;
  already_pending: boolean;
  fpkt_lookup?: FpktLookupHint | null;
}

/** Item 9 — upload de foto DEPOIS de criar a solicitação (precisa do id). Mesmo shape nos dois canais (karateApi.ts/karatePublicApi.ts). */
export interface PhotoUploadInput {
  content: string;
  content_type?: "image/jpeg" | "image/png" | "image/webp";
}
export interface PhotoUploadResult {
  photo_url: string;
}

// ── "Corrigir e reenviar" (item 2 — rejeição corrigível) ─────────────
// Subconjunto dos campos de uma PractitionerRequestRow REJEITADA que dá
// pra devolver pro formulário sem o sensei redigitar do zero: nome,
// nascimento, faixa alegada e número FPKT alegado — os únicos campos que
// a LISTAGEM de solicitações já devolve (a ficha completa, com
// telefone/CPF/endereço/responsável, não vem na listagem — o sensei
// preenche esses de novo, o resto já vem pronto).
export interface RequestPrefill {
  full_name?: string | null;
  birth_date?: string | null; // ISO (yyyy-mm-dd)
  claimed_belt?: string | null; // label (ex.: "Roxa")
  fpkt_number_claimed?: string | null;
  /** Motivo da rejeição original — só pra reforçar o aviso no topo do formulário durante a correção. */
  reject_reason?: string | null;
}

export type PractitionerRequestStatus = "pendente" | "aprovada" | "rejeitada";

export interface PractitionerRequestRow {
  id: string;
  status: PractitionerRequestStatus;
  resolution: string | null;
  reject_reason: string | null;
  full_name: string;
  birth_date: string | null;
  claimed_belt: string | null;
  fpkt_number_claimed: string | null;
  resolved_practitioner_id: string | null;
  resolved_fpkt_number: string | null;
  resolved_practitioner_name: string | null;
  created_at: string;
  resolved_at: string | null;
}

// "rejeitada" aqui é reenquadrada como "Precisa de ajuste" (decisão do
// Caio, item 2): construtiva, não punitiva — nunca vermelho de alarme.
// O sensei vê o motivo e corrige ali mesmo (ver RequestStatusRow +
// onCorrect); "Rejeitada" tecnicamente é só o rótulo do FILTRO acima.
const STATUS_META: Record<PractitionerRequestStatus, { label: string; color: string; soft: string; icon: string }> = {
  pendente: { label: "Pendente", color: P.warn, soft: P.warnSoft, icon: "time" },
  aprovada: { label: "Aprovada", color: P.ok, soft: P.okSoft, icon: "checkmark-circle" },
  rejeitada: { label: "Precisa de ajuste", color: P.warn, soft: P.warnSoft, icon: "edit" },
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

// Item 9: preview local da foto (blob URL) — o File real fica num ref
// (mesmo padrão de PraticanteFichaModal.tsx), sobe DEPOIS que a
// solicitação existe (precisa de um id pra anexar em karate_practitioner_requests).

type FpktMode = "unset" | "tem" | "nao_tem";

export interface NewRequestFormProps {
  /** Cria a SOLICITAÇÃO (nunca o praticante) — backend derivado pelo caller (JWT+federationId ou token público). */
  onSubmit: (body: PractitionerRequestBody) => Promise<PractitionerRequestCreateResult>;
  /** Auto-localizar: dado um número FPKT, diz se já pertence a alguém (mesma federação do backend do caller). */
  onLookupFpkt: (number: string) => Promise<FpktLookupHint>;
  /** Chamado após uma solicitação criada com sucesso (inclusive already_pending) — o caller decide o que refrescar. */
  onCreated: () => void;
  /**
   * Item 9: sobe a foto da solicitação recém-criada (base64 -> R2, mesmo
   * mecanismo de karateApi.ts#uploadPractitionerPhoto). Opcional — quando
   * ausente, a seção de foto não aparece (caller não suporta upload por
   * este canal ainda).
   */
  onUploadPhoto?: (requestId: string, input: PhotoUploadInput) => Promise<PhotoUploadResult>;
  /** Texto do estágio de confirmação — default cobre o caso genérico; cada tela ajusta a redação. */
  confirmTitle?: (alreadyPending: boolean) => string;
  confirmText?: (alreadyPending: boolean) => string;
  /**
   * "Corrigir e reenviar" (item 2): quando `prefillKey` MUDA (o caller
   * incrementa um contador), o formulário é limpo e repovoado com
   * `prefill` — nome/nascimento/faixa/FPKT de uma solicitação rejeitada,
   * pro sensei não redigitar do zero. Sem `prefillKey` novo, não faz nada
   * (evita reaplicar o mesmo prefill a cada render).
   */
  prefill?: RequestPrefill;
  prefillKey?: number;
}

export function NewRequestForm({ onSubmit, onLookupFpkt, onCreated, confirmTitle, confirmText, prefill, prefillKey, onUploadPhoto }: NewRequestFormProps) {
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
  // Local (não deriva de prefillKey direto): liga no efeito abaixo,
  // desliga em resetAll — sem isso o aviso "Corrigindo..." ficaria preso
  // depois de "Fazer outra solicitação".
  const [correcting, setCorrecting] = useState(false);

  // ── Item 9: foto do praticante — mesmo padrão de PraticanteFichaModal.tsx
  // (preview local via blob URL, File guardado num ref, upload real DEPOIS
  // do submit, quando já existe um id de solicitação pra anexar). ───────
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const pendingPhotoFile = useRef<File | null>(null);

  const handlePickPhoto = useCallback(async () => {
    if (!IS_WEB) return;
    setPhotoLoading(true);
    try {
      const file = await pickFileWeb("image/*");
      if (!file) return;
      pendingPhotoFile.current = file;
      setPhotoPreview(URL.createObjectURL(file));
      setPhotoUploadError(null);
    } catch { /* cancelado ou falha de leitura — silencioso */ }
    finally { setPhotoLoading(false); }
  }, []);

  const handleRemovePhoto = useCallback(() => {
    pendingPhotoFile.current = null;
    setPhotoPreview("");
    setPhotoUploadError(null);
  }, []);

  // ── Aplica o prefill de "Corrigir e reenviar" (item 2) — só quando
  // `prefillKey` MUDA (nunca a cada render; sem isso um novo digitar do
  // sensei seria apagado a cada re-render do pai). Repovoa nome,
  // nascimento (ISO → BR), faixa (label → BeltKey via resolveBeltKey) e
  // número FPKT alegado; o resto (contato, endereço, responsável) fica
  // em branco — não veio na listagem, o sensei preenche de novo. ───────
  useEffect(() => {
    if (!prefillKey) return;
    setForm({
      ...EMPTY_FORM,
      full_name: prefill?.full_name || "",
      birth_date_br: formatIsoToBr(prefill?.birth_date) || "",
      belt_key: prefill?.claimed_belt ? resolveBeltKey(prefill.claimed_belt) : null,
    });
    if (prefill?.fpkt_number_claimed) {
      setFpktMode("tem");
      setFpktNumber(prefill.fpkt_number_claimed);
    } else {
      setFpktMode("unset");
      setFpktNumber("");
    }
    setFpktLookup(null);
    setTouched(false);
    setSubmitError(null);
    setResult(null);
    setCorrecting(true);
    pendingPhotoFile.current = null;
    setPhotoPreview("");
    setPhotoUploadError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  const birthIso = parseBrDate(form.birth_date_br);
  const birthComplete = form.birth_date_br.length === 10;
  const birthBad = birthComplete && birthIso === null;
  const age = ageFromISO(birthIso);
  const isMinor = age !== null && age < 18;
  const cpfBad = form.cpf.length > 0 && !cpfValido(form.cpf);

  // Item 6 (revisão Atualização Cadastral, 15/07/2026) — TODOS os campos
  // da ficha são obrigatórios agora (antes só nome + um dos dois
  // contatos). Espelha 1:1 validatePractitionerRequestPayload do backend
  // (karatePractitionerRequestValidation.js) — complement continua
  // opcional (modificador de endereço, nem toda casa tem apto/fundos);
  // guardian_* só entra quando `isMinor`. O backend valida de novo mesmo
  // se este front deixar passar algo (defesa em profundidade).
  const nameOk = !!form.full_name.trim();
  const birthOk = birthComplete && !birthBad;
  const sexOk = !!form.sex;
  const cpfOk = form.cpf.trim().length > 0 && !cpfBad;
  const rgOk = !!form.rg.trim();
  const phoneOk = !!form.phone.trim();
  const emailOk = !!form.email.trim();
  const beltOk = !!form.belt_key;
  const addressOk = !!(form.zip_code.trim() && form.street.trim() && form.number.trim() && form.neighborhood.trim() && form.city.trim() && form.state.trim());
  const guardianOk = !isMinor || !!(form.guardian_name.trim() && form.guardian_phone.trim() && form.guardian_relationship);

  const valid = nameOk && birthOk && sexOk && cpfOk && rgOk && phoneOk && emailOk && beltOk && addressOk && guardianOk;

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
        const hint = await onLookupFpkt(digits);
        if (myId !== lookupReqId.current) return; // resposta obsoleta — descarta
        setFpktLookup(hint);
      } catch {
        if (myId !== lookupReqId.current) return;
        setFpktLookup(null);
      } finally {
        if (myId === lookupReqId.current) setFpktLookupLoading(false);
      }
    }, 500);
  }, [onLookupFpkt]);

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
    setCorrecting(false);
    pendingPhotoFile.current = null;
    setPhotoPreview("");
    setPhotoUploadError(null);
  }

  async function handleSubmit() {
    setTouched(true);
    setSubmitError(null);
    setPhotoUploadError(null);
    if (!valid || submitting) return;

    const belt = form.belt_key ? KarateBelts[form.belt_key] : null;
    const body: PractitionerRequestBody = {
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
      const created = await onSubmit(body);
      setResult({ alreadyPending: !!created.already_pending, lookup: created.fpkt_lookup || fpktLookup });
      onCreated();

      // ── Item 9: sobe a foto DEPOIS que a solicitação existe (precisa do
      // id). Falha no upload não desfaz a solicitação já criada — mesmo
      // princípio de PraticanteFichaModal.tsx (cadastro salvo mesmo se só a
      // foto falhar), só que aqui o aviso fica junto da confirmação. ─────
      const fileToUpload = pendingPhotoFile.current;
      if (fileToUpload && created.id && onUploadPhoto) {
        try {
          const { content, content_type } = await fileToBase64(fileToUpload);
          await onUploadPhoto(created.id, { content, content_type });
        } catch {
          setPhotoUploadError("Solicitação enviada, mas a foto não pôde ser anexada. A federação pode pedir de novo.");
        }
      }
    } catch (e: any) {
      setSubmitError(e?.message || "Não foi possível enviar a solicitação. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Estágio de confirmação (inline, nunca Modal) ────────────
  if (result) {
    const title = confirmTitle
      ? confirmTitle(result.alreadyPending)
      : (result.alreadyPending ? "Já havia uma solicitação para essa pessoa" : "Solicitação enviada");
    const text = confirmText
      ? confirmText(result.alreadyPending)
      : (result.alreadyPending
        ? "Uma solicitação pendente com o mesmo nome e nascimento já existia neste dojô — não duplicamos, a federação já está com ela."
        : "A federação vai analisar a ficha e, se aprovar, registrar o número FPKT oficial.");
    return (
      <View style={fs.confirmCard}>
        <View style={[fs.confirmGlyph, { backgroundColor: P.okSoft }]}>
          <Icon name="checkmark-circle" size={24} color={P.ok} />
        </View>
        <Text style={fs.confirmTitle}>{title}</Text>
        <Text style={fs.confirmText}>{text}</Text>
        {result.lookup?.is_transfer && (
          <View style={fs.transferBanner}>
            <Icon name="swap-horizontal" size={15} color={P.warn} />
            <Text style={fs.transferBannerText}>
              O número informado já pertence a {result.lookup.practitioner?.name || "outro praticante"} — isto será
              analisado como TRANSFERÊNCIA, não como criação.
            </Text>
          </View>
        )}
        {!!photoUploadError && (
          <View style={fs.transferBanner}>
            <Icon name="alert-circle" size={15} color={P.warn} />
            <Text style={fs.transferBannerText}>{photoUploadError}</Text>
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
      {correcting && (
        <View style={fs.correctingBanner}>
          <Icon name="edit" size={14} color={P.warn} />
          <View style={{ flex: 1 }}>
            <Text style={fs.correctingBannerTitle}>Corrigindo a solicitação de {prefill?.full_name || "praticante"}</Text>
            {!!prefill?.reject_reason && (
              <Text style={fs.correctingBannerText}>Motivo da federação: {prefill.reject_reason}</Text>
            )}
            <Text style={fs.correctingBannerText}>
              Nome, nascimento, faixa e número FPKT já vieram preenchidos — confira, ajuste o que pedirem e complete o resto.
            </Text>
          </View>
        </View>
      )}
      <Text style={fs.cardTitle}>Solicitar praticante novo</Text>
      <Text style={fs.cardSubtitle}>
        Preencha a ficha completa. A federação analisa e registra o número FPKT — o sensei nunca cadastra o
        praticante direto.
      </Text>

      {/* Item 9 (revisão Atualização Cadastral, 15/07/2026): foto do
          praticante novo, reusando o MESMO mecanismo de upload já usado
          pro praticante existente (uploadPractitionerPhoto/uploadToR2,
          nada novo). Só aparece quando o caller injeta onUploadPhoto —
          hoje isso cobre os dois canais (link público do sensei e Portal
          do Sensei autenticado); se algum canal futuro não puder subir
          foto, a seção simplesmente não aparece (nunca quebra o resto do
          formulário). Sobe DEPOIS do envio, quando já existe um id de
          solicitação pra anexar. */}
      {IS_WEB && onUploadPhoto && (
        <View style={fs.photoRow}>
          <Pressable onPress={handlePickPhoto} accessibilityRole="button" accessibilityLabel="Escolher foto" style={fs.photoCircle}>
            {photoLoading ? (
              <ActivityIndicator size="small" color={P.ink3} />
            ) : photoPreview ? (
              <Image source={{ uri: photoPreview }} style={fs.photoImg} />
            ) : (
              <Icon name="camera" size={20} color={P.ink3} />
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={fs.fieldLabel}>Foto (opcional)</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={handlePickPhoto} accessibilityRole="button" accessibilityLabel="Escolher foto">
                <Text style={fs.fullLinkLike}>{photoPreview ? "Trocar" : "Escolher arquivo"}</Text>
              </Pressable>
              {!!photoPreview && (
                <Pressable onPress={handleRemovePhoto} accessibilityRole="button" accessibilityLabel="Remover foto">
                  <Text style={[fs.fullLinkLike, { color: P.warn }]}>Remover</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      )}

      <Text style={fs.sectionLabel}>Identidade</Text>
      <Field label="Nome completo *" value={form.full_name} onChangeText={(v) => set("full_name", v)} placeholder="Nome completo do praticante" />
      {touched && !nameOk && <Text style={fs.errorText}>Informe o nome do praticante.</Text>}

      <Row>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Nascimento *{age !== null ? `  ·  ${age} anos` : ""}</Text>
          <DateInput value={form.birth_date_br} onChangeText={(v) => set("birth_date_br", v)} style={fs.dateInput} />
          {touched && !birthOk && <Text style={fs.errorText}>{birthBad ? "Data inválida." : "Informe a data de nascimento."}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>CPF *</Text>
          <TextInput
            value={form.cpf}
            onChangeText={(v) => set("cpf", maskCpf(v))}
            placeholder="000.000.000-00"
            keyboardType="numeric"
            style={[fs.input, (cpfBad || (touched && !cpfOk)) && fs.inputBad]}
            accessibilityLabel="CPF"
          />
          {cpfBad ? <Text style={fs.errorText}>Dígitos não conferem.</Text> : (touched && !cpfOk && <Text style={fs.errorText}>Informe o CPF.</Text>)}
        </View>
      </Row>

      <Row>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>RG *</Text>
          <TextInput value={form.rg} onChangeText={(v) => set("rg", v)} style={[fs.input, touched && !rgOk && fs.inputBad]} accessibilityLabel="RG" />
          {touched && !rgOk && <Text style={fs.errorText}>Informe o RG.</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Sexo *</Text>
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
          {touched && !sexOk && <Text style={fs.errorText}>Selecione o sexo.</Text>}
        </View>
      </Row>

      <Text style={fs.sectionLabel}>Contato</Text>
      <Row>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Telefone *</Text>
          <TextInput
            value={form.phone}
            onChangeText={(v) => set("phone", maskPhoneUtil(v))}
            placeholder="(00) 00000-0000"
            keyboardType="numeric"
            style={[fs.input, touched && !phoneOk && fs.inputBad]}
            accessibilityLabel="Telefone"
          />
          {touched && !phoneOk && <Text style={fs.errorText}>Informe o telefone.</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>E-mail *</Text>
          <TextInput
            value={form.email}
            onChangeText={(v) => set("email", v)}
            placeholder="email@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            style={[fs.input, touched && !emailOk && fs.inputBad]}
            accessibilityLabel="E-mail"
          />
          {touched && !emailOk && <Text style={fs.errorText}>Informe o e-mail.</Text>}
        </View>
      </Row>

      <Text style={fs.sectionLabel}>Endereço</Text>
      <Row>
        <View style={{ width: 140 }}>
          <Text style={fs.fieldLabel}>CEP *</Text>
          <TextInput
            value={form.zip_code}
            onChangeText={(v) => set("zip_code", maskCEP(v))}
            placeholder="00000-000"
            keyboardType="numeric"
            style={[fs.input, touched && !form.zip_code.trim() && fs.inputBad]}
            accessibilityLabel="CEP"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Rua *</Text>
          <TextInput value={form.street} onChangeText={(v) => set("street", v)} style={[fs.input, touched && !form.street.trim() && fs.inputBad]} accessibilityLabel="Rua" />
        </View>
      </Row>
      <Row>
        <View style={{ width: 90 }}>
          <Text style={fs.fieldLabel}>Número *</Text>
          <TextInput value={form.number} onChangeText={(v) => set("number", v)} style={[fs.input, touched && !form.number.trim() && fs.inputBad]} keyboardType="numeric" accessibilityLabel="Número" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Complemento</Text>
          <TextInput value={form.complement} onChangeText={(v) => set("complement", v)} style={fs.input} accessibilityLabel="Complemento" />
        </View>
      </Row>
      <Row>
        <View style={{ flex: 1 }}>
          <Text style={fs.fieldLabel}>Bairro *</Text>
          <TextInput value={form.neighborhood} onChangeText={(v) => set("neighborhood", v)} style={[fs.input, touched && !form.neighborhood.trim() && fs.inputBad]} accessibilityLabel="Bairro" />
        </View>
        <View style={{ flex: 1.4 }}>
          <Text style={fs.fieldLabel}>Cidade *</Text>
          <TextInput value={form.city} onChangeText={(v) => set("city", v)} style={[fs.input, touched && !form.city.trim() && fs.inputBad]} accessibilityLabel="Cidade" />
        </View>
        <View style={{ width: 64 }}>
          <Text style={fs.fieldLabel}>UF *</Text>
          <TextInput
            value={form.state}
            onChangeText={(v) => set("state", v.toUpperCase().slice(0, 2))}
            style={[fs.input, touched && !form.state.trim() && fs.inputBad]}
            maxLength={2}
            accessibilityLabel="UF"
          />
        </View>
      </Row>
      {touched && !addressOk && <Text style={fs.errorText}>Preencha o endereço completo (complemento é o único campo opcional).</Text>}

      {isMinor && (
        <>
          <Text style={fs.sectionLabel}>Responsável</Text>
          <View style={fs.infoNote}>
            <Icon name="information-circle" size={13} color={P.ink3} />
            <Text style={fs.infoNoteText}>Menor de 18 anos — nome, telefone e parentesco do responsável são obrigatórios.</Text>
          </View>
          <Field label="Nome do responsável *" value={form.guardian_name} onChangeText={(v) => set("guardian_name", v)} placeholder="Nome completo" />
          {touched && !form.guardian_name.trim() && <Text style={fs.errorText}>Informe o nome do responsável.</Text>}
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
              <Text style={fs.fieldLabel}>Telefone do responsável *</Text>
              <TextInput
                value={form.guardian_phone}
                onChangeText={(v) => set("guardian_phone", maskPhoneUtil(v))}
                keyboardType="numeric"
                style={[fs.input, touched && !form.guardian_phone.trim() && fs.inputBad]}
                accessibilityLabel="Telefone do responsável"
              />
              {touched && !form.guardian_phone.trim() && <Text style={fs.errorText}>Informe o telefone do responsável.</Text>}
            </View>
          </Row>
          <Text style={fs.fieldLabel}>Parentesco *</Text>
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
          {touched && !form.guardian_relationship && <Text style={fs.errorText}>Selecione o parentesco.</Text>}
        </>
      )}

      <Text style={fs.sectionLabel}>Faixa alegada *</Text>
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
      {touched && !beltOk && <Text style={fs.errorText}>Selecione a faixa alegada.</Text>}

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
  { key: "rejeitada", label: "Precisam de ajuste" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function RequestStatusRow({ r, onCorrect }: { r: PractitionerRequestRow; onCorrect?: (r: PractitionerRequestRow) => void }) {
  const meta = STATUS_META[r.status];
  const isRejected = r.status === "rejeitada";
  return (
    <View style={[rs.row, isRejected && rs.rowCorrection]}>
      <View style={rs.rowTop}>
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
          {r.status === "pendente" && <Text style={rs.pendingNote}>Aguardando análise da federação.</Text>}
        </View>
        <View style={[rs.badge, { backgroundColor: meta.soft }]}>
          <Icon name={meta.icon as any} size={12} color={meta.color} />
          <Text style={[rs.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
      {/* Item 2 — "rejeição corrigível no link": nunca um beco. O motivo
          fica visível e "Corrigir e reenviar" abre o formulário ACIMA já
          preenchido (ver onCorrect → RequestPractitionerSection, que
          expande + rola até o form). Nunca vermelho de alarme — mesmo
          tom construtivo do badge acima. */}
      {isRejected && (
        <View style={rs.correctionBox}>
          <Text style={rs.correctionReason}>
            {r.reject_reason ? r.reject_reason : "A federação não registrou um motivo — entre em contato se tiver dúvida."}
          </Text>
          {onCorrect && (
            <Pressable
              onPress={() => onCorrect(r)}
              accessibilityRole="button"
              accessibilityLabel={`Corrigir e reenviar solicitação de ${r.full_name}`}
              style={rs.correctionBtn}
            >
              <Icon name="send" size={13} color={P.ink} />
              <Text style={rs.correctionBtnText}>Corrigir e reenviar</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export interface StatusListProps {
  /** Busca as solicitações do dojô do caller (JWT+federationId ou token público). `status` omitido = todas. */
  fetchRequests: (status?: PractitionerRequestStatus) => Promise<{ data: PractitionerRequestRow[] }>;
  /** Incremente pra forçar um reload (ex.: depois de criar uma solicitação nova). */
  refreshKey: number;
  title?: string;
  /** "Corrigir e reenviar" (item 2) — chamado quando o sensei toca no botão de uma linha REJEITADA. O caller decide o que fazer (abrir/prefillar o formulário acima). Sem esta prop, a linha rejeitada mostra o motivo mas sem o botão de correção. */
  onCorrect?: (r: PractitionerRequestRow) => void;
}

export function StatusList({ fetchRequests, refreshKey, title, onCorrect }: StatusListProps) {
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
      const res = await fetchRequests(filter === "todas" ? undefined : filter);
      if (myGen !== genRef.current) return; // descarta resposta obsoleta
      setRows(res.data || []);
    } catch {
      if (myGen !== genRef.current) return;
      setError(true);
    } finally {
      if (myGen === genRef.current) setLoading(false);
    }
  }, [fetchRequests, filter]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <View style={rs.card}>
      <Text style={rs.title}>{title || "Status das solicitações"}</Text>
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
        rows.map((r) => <RequestStatusRow key={r.id} r={r} onCorrect={onCorrect} />)
      )}
    </View>
  );
}

const fs = StyleSheet.create({
  card: { backgroundColor: P.glass, borderRadius: R.lg, borderWidth: 1, borderColor: P.border, padding: 16 } as ViewStyle,
  correctingBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P.warnSoft, borderWidth: 1, borderColor: "rgba(122,87,36,0.28)", borderRadius: R.md, padding: 11, marginBottom: 14 } as ViewStyle,
  correctingBannerTitle: { fontSize: 12.5, fontWeight: "700", color: P.ink } as TextStyle,
  correctingBannerText: { fontSize: 11.5, color: P.ink2, lineHeight: 16, marginTop: 3 } as TextStyle,
  cardTitle: { fontFamily: F.heading, fontSize: 16, color: P.ink } as TextStyle,
  cardSubtitle: { fontSize: 12, color: P.ink3, lineHeight: 17, marginTop: 4, marginBottom: 14 } as TextStyle,
  sectionLabel: { fontSize: 11, fontWeight: "800", color: P.ink2, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 8 } as TextStyle,
  fieldLabel: { fontSize: 11.5, fontWeight: "700", color: P.ink2, marginBottom: 5 } as TextStyle,
  input: { borderWidth: 1, borderColor: P.border, borderRadius: R.sm, backgroundColor: P.paperWarm, paddingHorizontal: 11, paddingVertical: 9, fontSize: 14, color: P.ink } as TextStyle,
  inputBad: { borderColor: P.danger },
  dateInput: { borderWidth: 1, borderColor: P.border, borderRadius: R.sm, backgroundColor: P.paperWarm, paddingHorizontal: 11, paddingVertical: 9, fontSize: 14, color: P.ink } as TextStyle,
  errorText: { fontSize: 11, color: P.danger, marginTop: 4 } as TextStyle,

  // Item 9 — foto (mesmo espírito visual do photoSlot de PraticanteFichaModal.tsx).
  photoRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 4 } as ViewStyle,
  photoCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: P.paperWarm, borderWidth: 1, borderColor: P.border, alignItems: "center", justifyContent: "center", overflow: "hidden" } as ViewStyle,
  photoImg: { width: 56, height: 56, borderRadius: 28 },
  fullLinkLike: { fontSize: 12.5, fontWeight: "700", color: P.primary } as TextStyle,

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

  row: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: P.border } as ViewStyle,
  rowCorrection: { paddingBottom: 12 } as ViewStyle,
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  name: { fontSize: 14, fontWeight: "700", color: P.ink } as TextStyle,
  meta: { fontSize: 11, color: P.ink3, marginTop: 2 } as TextStyle,
  resolvedOk: { fontSize: 11.5, color: P.ok, fontWeight: "700", marginTop: 4 } as TextStyle,
  pendingNote: { fontSize: 11, color: P.ink4, marginTop: 4 } as TextStyle,

  // "Precisa de ajuste" (item 2) — caixa construtiva, nunca vermelha:
  // motivo + convite claro pra corrigir e reenviar ali mesmo.
  correctionBox: { marginTop: 10, backgroundColor: P.warnSoft, borderWidth: 1, borderColor: "rgba(122,87,36,0.25)", borderRadius: R.md, padding: 10 } as ViewStyle,
  correctionReason: { fontSize: 12, color: P.ink, lineHeight: 17 } as TextStyle,
  correctionBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.border, borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 12 } as ViewStyle,
  correctionBtnText: { fontSize: 12, fontWeight: "700", color: P.ink } as TextStyle,

  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 9 } as ViewStyle,
  badgeText: { fontSize: 10.5, fontWeight: "800" } as TextStyle,

  emptyBox: { paddingVertical: 24, alignItems: "center", gap: 8 } as ViewStyle,
  emptyText: { fontSize: 12.5, color: P.ink3, textAlign: "center" } as TextStyle,
  retryText: { fontSize: 12.5, fontWeight: "700", color: P.primary } as TextStyle,
});
