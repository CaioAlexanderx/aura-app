// ============================================================
// AURA KARATÊ — Portal público do sensei (atualização cadastral em escala)
// URL: /karate/roster-update/:token
//
// Backend: GET/PATCH/POST karateRosterPortalPublic.js (ver comentário de
// topo daquele arquivo). PÚBLICA — sem login; o token opaco É a
// autenticação. app/_layout.tsx reconhece segments[1]==="roster-update"
// como rota pública do karatê (bypass do AuthGuard).
//
// ── G1 — "400 praticantes vira gerenciável" ─────────────────────────
// O problema não é digitação, é o PAREDÃO: um dojô grande abre a tela e vê
// 400 nomes, não sabe o que falta em cada um, não vê fim, fecha a aba.
// Esta tela resolve isso em 4 movimentos, nesta ordem:
//   1. Encolher o universo — "Não treina mais" tira gente da lista na hora
//      (reversível, com Desfazer — nunca clique acidental).
//   2. Baratear cada item — abrir um praticante mostra SÓ o que falta
//      (normalmente 1 campo: telefone). Ficha completa fica atrás de um link.
//   3. Transferir o trabalho — a alavanca de verdade pra um dojô de 400:
//      SelfServiceShareCard (link + Copiar + WhatsApp, logo abaixo do
//      cabeçalho, nunca escondido) manda a digitação para o próprio aluno.
//      `data.self_service_url` já vem PRONTO do GET (karateRosterPortalPublic.js
//      gera o token sob demanda se o dojô ainda não tinha um — nunca fica
//      vazio). Planilha (baixar só quem falta, subir de volta) é o
//      caminho alternativo pra quando o sensei prefere digitar ele mesmo.
//   4. Fechar o ciclo — "Concluir atualização" confirma o quadro e avisa
//      a federação (mesmo POST de antes, agora com autosave já persistido
//      campo a campo, então essa etapa final é só formalidade).
//
// Fila é o caminho principal (item 4 do PR): um card por vez, campo já
// focado, Enter avança. Lista é a alternativa pra quem prefere revisar
// tudo de uma vez. Autosave campo a campo (PATCH granular) — nunca um
// botão "Salvar" global que ameaça perder tudo.
//
// Progresso é ESTATELESS por desenho (mesmo princípio do backend: sem
// tabela de baseline). A barra do topo usa progress.essenciais_resolvidos/
// essenciais_total, devolvidos pelo backend a cada PATCH — sempre
// corretos, mesmo se o sensei fechar a aba e voltar semana que vem. A fila
// em si não guarda um índice "onde eu parei": ela é, a cada render, a
// lista de quem ainda tem algo faltando — reabrir o link já É a retomada.
//
// ARMADILHA conhecida (não usar <Modal> aninhado): a confirmação de
// "Não treina mais" e de "Concluir atualização" são ESTÁGIOS INLINE (texto
// + botões substituindo o conteúdo no lugar), nunca um <Modal>. RN Web
// renderiza Modal-dentro-de-Modal atrás da tela (invisível, no-op
// silencioso) — mais simples e mais seguro não usar Modal aqui.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
  Animated,
  Easing,
  Pressable,
  Modal,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts, KarateShadows } from "@/constants/karateTheme";
import { Motion, webTransition } from "@/constants/motion";
import { BeltBadge } from "@/components/karate/BeltBadge";
import { copyToClipboard } from "@/utils/clipboard";
import { DateInput, parseBrDate, formatIsoToBr } from "@/components/inputs/DateInput";
import { maskCpf, maskPhone as maskPhoneUtil } from "@/utils/masks";
import {
  karatePublicApi,
  RosterPractitioner,
  RosterProgress,
  RosterFullRecord,
  PatchPractitionerInput,
  PatchPractitionerResult,
  PractitionerRequestStatus,
} from "@/services/karatePublicApi";
import {
  NewRequestForm,
  StatusList,
  PractitionerRequestBody,
  PractitionerRequestRow,
  RequestPrefill,
} from "@/components/karate/PractitionerRequestForm";

const IS_WEB = Platform.OS === "web";

const GROUP_ORDER: Record<string, number> = { a: 0, b: 1, c: 2 };
// Item 4 (revisão Atualização Cadastral, 15/07/2026) — completude cobre
// TODOS os campos que o portal edita (não só telefone/e-mail — era esse
// o bug: o Caio apagou nascimento e o sistema marcou "OK" só porque
// telefone/e-mail estavam preenchidos). Espelha PORTAL_EDITABLE_FIELDS/
// classifyPraticante do backend (karateRosterPortalPublic.js).
const MISSING_LABEL: Record<string, string> = {
  telefone: "Telefone", email: "E-mail", nascimento: "Nascimento", cpf: "CPF", rg: "RG", endereco: "Endereço",
};
const MISSING_PLACEHOLDER: Record<string, string> = { telefone: "(00) 00000-0000", email: "email@exemplo.com" };
const MISSING_KEYBOARD: Record<string, "phone-pad" | "email-address" | "default"> = {
  telefone: "phone-pad",
  email: "email-address",
};
// Só telefone/e-mail têm editor RÁPIDO inline (FieldInput) na fila/lista —
// os demais (nascimento/cpf/rg/endereço) exigem tipos de input que só a
// "ficha completa" já tem prontos (DateInput, máscara de CPF, campos de
// endereço) — reaproveitar isso em vez de duplicar editores. Um praticante
// com só esses faltando ainda entra na fila/lista com o badge "falta X",
// mas o card aponta pra "Ver ficha completa" em vez de um campo solto.
const QUICK_EDIT_FIELDS = new Set(["telefone", "email"]);

function prefersReducedMotion(): boolean {
  if (!IS_WEB || typeof window === "undefined" || !window.matchMedia) return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

// ── Grupo (a/b/c) LOCAL após um patch de phone/email/is_active — mesma
//    régua do backend (classifyPraticante em karateRosterPortalPublic.js),
//    sempre contra o snapshot ORIGINAL do servidor (`base.priority_group`),
//    nunca acumulando sobre um override anterior: "grupo a" (faixa-preta
//    com anuidade em atraso) nunca se perde nem se inventa por engano ao
//    longo de várias edições.
//
//    Item 4/5 (revisão Atualização Cadastral, 15/07/2026): `missing` NÃO
//    é mais recalculado aqui — o backend já devolve `missing` PRONTO em
//    todo PATCH (PatchPractitionerResult.missing, calculado por
//    classifyPraticante sobre TODOS os campos, não só phone/email). Um
//    reclassify local só de phone/email ficaria cego pra nascimento/cpf/
//    rg/endereço mudados pela ficha completa — usar sempre a resposta do
//    servidor é a única fonte que não fica desatualizada. Ver
//    applyPatchResult abaixo. ─────────────────────────────────────────
function computeGroupAfterPatch(
  base: RosterPractitioner,
  merged: { phone: string | null; email: string | null; is_active: boolean }
): "a" | "b" | "c" {
  const hasPhone = !!(merged.phone && String(merged.phone).trim());
  const hasEmail = !!(merged.email && String(merged.email).trim());
  if (!merged.is_active) return "c";
  if (base.priority_group === "a") return "a";
  return !hasPhone && !hasEmail ? "b" : "c";
}

function missingSummary(missing: string[]): string {
  if (missing.length === 0) return "";
  return missing.map((m) => MISSING_LABEL[m] || m).join(" e ");
}

// ── Idade a partir de YYYY-MM-DD (para decidir se a seção "Responsável"
// da ficha/grade se aplica — menor de 18). Parse local, sem UTC shift. ──
function ageFromISO(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const mm = t.getMonth() - d.getMonth();
  if (mm < 0 || (mm === 0 && t.getDate() < d.getDate())) a--;
  return a;
}

// ── Colunas essenciais da grade de completude (item 2, "a peça central").
// Cada coluna sabe extrair seu valor do RosterFullRecord e decidir se está
// preenchida. `applicable(rec)` deixa uma coluna NEUTRA (nem vazia nem
// cheia) quando ela simplesmente não se aplica àquele praticante — ex.:
// "Responsável" só faz sentido para menores de 18. Ausência de dado é
// sempre neutra, nunca alerta (regra fechada com o Caio). ──────────────
interface CompletenessColumn {
  key: string;
  label: string;
  short: string;
  applicable: (rec: RosterFullRecord) => boolean;
  filled: (rec: RosterFullRecord) => boolean;
}
const COMPLETENESS_COLUMNS: CompletenessColumn[] = [
  { key: "nascimento", label: "Nascimento", short: "Nasc.", applicable: () => true, filled: (r) => !!r.birth_date },
  { key: "cpf", label: "CPF", short: "CPF", applicable: () => true, filled: (r) => !!(r.cpf_cnpj && r.cpf_cnpj.trim()) },
  { key: "rg", label: "RG", short: "RG", applicable: () => true, filled: (r) => !!(r.rg && r.rg.trim()) },
  { key: "telefone", label: "Telefone", short: "Tel.", applicable: () => true, filled: (r) => !!(r.phone && r.phone.trim()) },
  { key: "email", label: "E-mail", short: "E-mail", applicable: () => true, filled: (r) => !!(r.email && r.email.trim()) },
  {
    key: "endereco", label: "Endereço", short: "End.", applicable: () => true,
    filled: (r) => !!(r.street && r.street.trim() && r.city && r.city.trim() && r.state && r.state.trim()),
  },
  {
    key: "responsavel", label: "Responsável (menores)", short: "Resp.",
    applicable: (r) => (ageFromISO(r.birth_date) ?? 99) < 18,
    filled: (r) => !!(r.guardian_name && r.guardian_name.trim() && r.guardian_phone && r.guardian_phone.trim()),
  },
];

// ── Toast leve (rodapé) — usado pra "Não treina mais" com Desfazer.
// Nunca Modal; fixo no rodapé da página, auto-some. ─────────────────────
interface ToastState { id: number; message: string; undoLabel?: string; onUndo?: () => void; }

function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    Animated.timing(anim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: false }).start(() => onDismiss());
    }, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  if (!toast) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        st.toastWrap,
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
      ]}
    >
      <View style={st.toast}>
        <Icon name="checkmark-circle" size={16} color={P.ok} />
        <Text style={st.toastText}>{toast.message}</Text>
        {toast.onUndo && (
          <Pressable onPress={toast.onUndo} accessibilityRole="button" accessibilityLabel={toast.undoLabel || "Desfazer"}>
            <Text style={st.toastUndo}>{toast.undoLabel || "Desfazer"}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// ── Estágio de confirmação INLINE (nunca Modal) — "Não treina mais" e
// "Concluir atualização" usam o mesmo padrão: some o conteúdo normal,
// mostra pergunta + Cancelar/Confirmar. ─────────────────────────────────
function InlineConfirm({
  message, confirmLabel, cancelLabel = "Cancelar", onConfirm, onCancel, loading, danger,
}: { message: string; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void; loading?: boolean; danger?: boolean }) {
  return (
    <View style={st.inlineConfirm}>
      <Text style={st.inlineConfirmText}>{message}</Text>
      <View style={st.inlineConfirmActions}>
        <Pressable onPress={loading ? undefined : onCancel} style={st.inlineCancelBtn} accessibilityRole="button" accessibilityLabel={cancelLabel}>
          <Text style={st.inlineCancelText}>{cancelLabel}</Text>
        </Pressable>
        <Pressable
          onPress={loading ? undefined : onConfirm}
          style={[st.inlineConfirmBtn, danger && { backgroundColor: P.danger }]}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
        >
          {loading ? <ActivityIndicator size="small" color="#fdf8f2" /> : <Text style={st.inlineConfirmBtnText}>{confirmLabel}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ── Campo de "só o que falta" — usado na fila e na lista. Ref exposta pra
// encadear foco (Enter avança pro próximo campo faltando). ─────────────
const FieldInput = React.forwardRef<TextInput, {
  fieldKey: string;
  value: string;
  onChangeText: (v: string) => void;
  onCommit: () => void;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  saving?: boolean;
  saved?: boolean;
}>(function FieldInput({ fieldKey, value, onChangeText, onCommit, onSubmitEditing, autoFocus, saving, saved }, ref) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={st.fieldLabel}>{MISSING_LABEL[fieldKey] || fieldKey}</Text>
      <View style={st.fieldInputWrap}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onBlur={onCommit}
          onSubmitEditing={() => { onCommit(); onSubmitEditing?.(); }}
          placeholder={MISSING_PLACEHOLDER[fieldKey] || ""}
          placeholderTextColor={P.ink4}
          keyboardType={MISSING_KEYBOARD[fieldKey] || "default"}
          autoFocus={autoFocus}
          returnKeyType="next"
          accessibilityLabel={MISSING_LABEL[fieldKey] || fieldKey}
          style={st.fieldInput}
        />
        {saving ? <ActivityIndicator size="small" color={P.ink3} /> : saved ? <Icon name="checkmark-circle" size={16} color={P.ok} /> : null}
      </View>
    </View>
  );
});

// ── Ficha completa — atrás do link "Ver ficha completa" (e também o
// conteúdo do modal da grade de completude, item 2/3 do H2). Busca sob
// demanda (item 1: não carregar 20 campos de cara pra todo mundo) — MAS
// se o chamador já tem o registro em cache (grade já pré-carregou via
// ensureFullRecord), usa direto: fonte única, nunca um segundo fetch
// divergente do mesmo praticante (armadilha "estado duplicado").
function maskCEPLocal(v: string): string {
  const d = (v || "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? d.replace(/(\d{5})(\d+)/, "$1-$2") : d;
}

const ADDRESS_FIELDS: { key: keyof RosterFullRecord & string; label: string; keyboardType?: "numeric" | "default" }[] = [
  { key: "street", label: "Rua" },
  { key: "number", label: "Número", keyboardType: "numeric" },
  { key: "complement", label: "Complemento" },
  { key: "neighborhood", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
];

// Linha "Atual × Novo" — compacta, concatenada (item 3 do H2: o sensei vê
// o que está no sistema e o que está mudando sem trocar de tela).
function EditFieldRow({
  label, current, value, onChangeText, onCommit, saving, saved, keyboardType, placeholder, dateMode, mono,
}: {
  label: string; current: string; value: string; onChangeText: (v: string) => void; onCommit: () => void;
  saving?: boolean; saved?: boolean; keyboardType?: any; placeholder?: string; dateMode?: boolean; mono?: boolean;
}) {
  return (
    <View style={st.fullGridItem}>
      <Text style={st.fieldLabel}>{label}</Text>
      <Text style={st.currentValueText} numberOfLines={1}>Atual: {current || "vazio"}</Text>
      {dateMode ? (
        <DateInput value={value} onChangeText={onChangeText} onBlur={onCommit} style={[st.fullInput, mono && { fontFamily: KarateFonts.mono }]} />
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onCommit}
          keyboardType={keyboardType}
          placeholder={placeholder}
          style={[st.fullInput, mono && { fontFamily: KarateFonts.mono }]}
          accessibilityLabel={label}
        />
      )}
      {saving ? <ActivityIndicator size="small" color={P.ink3} style={{ marginTop: 4 }} /> : saved ? <Text style={st.savedNote}>Salvo</Text> : null}
    </View>
  );
}

function FullRecordPanel({
  token, studentId, cachedRecord, onLoaded, onFieldSaved,
}: {
  token: string;
  studentId: string;
  /** Já veio pronto da grade de completude (ensureFullRecord) — evita refetch. */
  cachedRecord?: RosterFullRecord | null;
  /** Avisa o pai que buscou um registro do zero, pra ele guardar no cache único. */
  onLoaded?: (record: RosterFullRecord) => void;
  onFieldSaved: (patch: Partial<RosterFullRecord>, result?: PatchPractitionerResult) => void;
}) {
  const [fetched, setFetched] = useState<RosterFullRecord | null>(null);
  const [loading, setLoading] = useState(!cachedRecord);
  const [error, setError] = useState(false);
  const record = cachedRecord || fetched;

  const [values, setValues] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      // BUG item 5 (revisão Atualização Cadastral, 15/07/2026): o RG do
      // Caio estava intacto no banco (backend confirmado: GET ficha completa
      // já seleciona c.rg), mas aparecia em branco no portal — a causa era
      // AQUI: este objeto `v` (baseline/values iniciais do formulário)
      // esquecia de semear `rg`, então `values.rg`/`baseline.rg` ficavam
      // `undefined` e o campo sempre renderizava vazio, não importa o que
      // viesse do servidor. Bug de LEITURA no front, nunca de escrita — o
      // autosave (commit) só manda `{ [apiKey]: valor }` de UM campo por vez
      // (nunca reenvia os outros), então mesmo com esse bug o RG nunca foi
      // sobrescrito/apagado no banco por salvar outro campo.
      const v: Record<string, string> = { phone: record.phone || "", email: record.email || "", cpf_cnpj: record.cpf_cnpj || "", rg: record.rg || "" };
      for (const f of ADDRESS_FIELDS) v[f.key] = (record as any)[f.key] || "";
      v.zip_code = record.zip_code || "";
      v.birth_date = formatIsoToBr(record.birth_date);
      setValues(v);
      setBaseline(v);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(false);
    karatePublicApi.getFullRecord(token, studentId)
      .then((r) => {
        if (!alive) return;
        setFetched(r);
        onLoaded?.(r);
      })
      .catch(() => { if (alive) setError(true); setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, studentId, record?.id]);

  const commit = useCallback(async (key: string, apiKey: string, rawValue?: string) => {
    const value = (rawValue !== undefined ? rawValue : values[key]) || "";
    if (value === (baseline[key] || "")) return; // nada mudou — não bate a API à toa
    setSavingKey(key);
    try {
      let sendValue: string | null = value || null;
      if (key === "birth_date") {
        const iso = parseBrDate(value);
        if (value && !iso) { setSavingKey(null); return; } // data incompleta/inválida — não envia
        sendValue = iso;
      }
      const patch: PatchPractitionerInput = { [apiKey]: sendValue } as any;
      const result = await karatePublicApi.patchPractitioner(token, studentId, patch);
      setBaseline((b) => ({ ...b, [key]: value }));
      setSavedKey(key);
      setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1500);
      const cachePatch: Partial<RosterFullRecord> = key === "birth_date" ? { birth_date: sendValue } : ({ [key]: sendValue } as any);
      onFieldSaved(cachePatch, result);
    } catch { /* silencioso — o campo continua editável, sensei tenta de novo */ }
    finally { setSavingKey(null); }
  }, [token, studentId, values, baseline, onFieldSaved]);

  if (loading) {
    return <View style={{ paddingVertical: 16, alignItems: "center" }}><ActivityIndicator size="small" color={P.ink3} /></View>;
  }
  if (error || !record) {
    return <Text style={st.addFieldError}>Não foi possível carregar a ficha completa. Tente de novo.</Text>;
  }

  const isMinor = (ageFromISO(record.birth_date) ?? 99) < 18;

  return (
    <View style={st.fullRecord}>
      {/* Identificação — SEMPRE somente leitura: FPKT é emitido pela
          federação (o sensei nunca edita) e faixa vive em karate_belt_history
          (append-only), fora do escopo deste PATCH. */}
      <View style={st.readonlyRow}>
        <Icon name="lock-closed" size={13} color={P.ink3} />
        <Text style={st.readonlyRowText}>
          Matrícula FPKT: <Text style={st.readonlyRowStrong}>{record.karate_registration_number || "ainda sem número"}</Text> · emitida pela federação
        </Text>
      </View>
      {!!record.belt_name && (
        <View style={[st.readonlyRow, { marginTop: 6 }]}>
          <BeltBadge beltLevel={record.belt_name || ""} beltName={record.belt_name || undefined} />
          <Text style={st.readonlyRowText}>faixa atual — trajetória gerida pela federação</Text>
        </View>
      )}

      <View style={st.fullGrid}>
        <EditFieldRow
          label="Telefone" current={baseline.phone} value={values.phone || ""}
          onChangeText={(t) => setValues((v) => ({ ...v, phone: maskPhoneUtil(t) }))}
          onCommit={() => commit("phone", "phone")}
          keyboardType="phone-pad" saving={savingKey === "phone"} saved={savedKey === "phone"} mono
        />
        <EditFieldRow
          label="E-mail" current={baseline.email} value={values.email || ""}
          onChangeText={(t) => setValues((v) => ({ ...v, email: t }))}
          onCommit={() => commit("email", "email")}
          keyboardType="email-address" saving={savingKey === "email"} saved={savedKey === "email"}
        />
        <EditFieldRow
          label="Nascimento" current={baseline.birth_date || ""} value={values.birth_date || ""}
          onChangeText={(t) => setValues((v) => ({ ...v, birth_date: t }))}
          onCommit={() => commit("birth_date", "birth_date")}
          dateMode saving={savingKey === "birth_date"} saved={savedKey === "birth_date"} mono
        />
        <EditFieldRow
          label="CPF" current={baseline.cpf_cnpj} value={values.cpf_cnpj || ""}
          onChangeText={(t) => setValues((v) => ({ ...v, cpf_cnpj: maskCpf(t) }))}
          onCommit={() => commit("cpf_cnpj", "cpf")}
          keyboardType="numeric" saving={savingKey === "cpf_cnpj"} saved={savedKey === "cpf_cnpj"} mono
        />
        <EditFieldRow
          label="RG" current={baseline.rg} value={values.rg || ""}
          onChangeText={(t) => setValues((v) => ({ ...v, rg: t }))}
          onCommit={() => commit("rg", "rg")}
          saving={savingKey === "rg"} saved={savedKey === "rg"} mono
        />
        <EditFieldRow
          label="CEP" current={baseline.zip_code} value={values.zip_code || ""}
          onChangeText={(t) => setValues((v) => ({ ...v, zip_code: maskCEPLocal(t) }))}
          onCommit={() => commit("zip_code", "zip_code")}
          keyboardType="numeric" saving={savingKey === "zip_code"} saved={savedKey === "zip_code"} mono
        />
        {ADDRESS_FIELDS.map((f) => (
          <EditFieldRow
            key={f.key}
            label={f.label} current={baseline[f.key]} value={values[f.key] || ""}
            onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
            onCommit={() => commit(f.key, f.key)}
            keyboardType={f.keyboardType} saving={savingKey === f.key} saved={savedKey === f.key}
          />
        ))}
      </View>

      {/* Responsável — somente leitura aqui (o portal do sensei ainda não
          libera PATCH desses campos); "ausência é neutra": nunca alerta,
          só um lembrete de que a federação atualiza esse dado. */}
      <View style={st.guardianReadonlyBox}>
        <Text style={st.fullRecordNote}>
          Responsável{isMinor ? " (menor de 18)" : ""}: {record.guardian_name || "—"}
          {record.guardian_phone ? ` · ${record.guardian_phone}` : ""}
          {record.guardian_relationship ? ` (${record.guardian_relationship})` : ""}
        </Text>
        <Text style={st.guardianReadonlyHint}>Somente leitura neste portal — peça à federação para atualizar o responsável.</Text>
      </View>
    </View>
  );
}

// ── Card da FILA — um praticante, só os campos faltando, Enter avança. ──
function QueueCard({
  p, position, total, token, onPatch, onInactivate, onFichaFieldSaved, onReviewed,
}: {
  p: RosterPractitioner; position: number; total: number; token: string;
  onPatch: (id: string, patch: PatchPractitionerInput) => Promise<void>;
  onInactivate: (p: RosterPractitioner) => void;
  onFichaFieldSaved: (id: string, patch: Partial<RosterFullRecord>, result?: PatchPractitionerResult) => void;
  /** Item 3: avança a fila sem editar nada — "olhei, está certo" (registro
   *  já completo) ou "não tenho esse dado agora, deixa pra depois". */
  onReviewed: (id: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ telefone: p.phone || "", email: p.email || "" }));
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [confirmingInactivate, setConfirmingInactivate] = useState(false);
  // ⚠️ (15/07/2026) "Não devemos interromper o preenchimento" — o Caio.
  // A ficha completa agora é O CARD, sempre aberta. Antes, a fila mostrava só
  // telefone/e-mail (QUICK_EDIT_FIELDS) e escondia nascimento/CPF/RG/endereço
  // atrás de um link "ver ficha completa" — o sensei preenchia os dois campos
  // rápidos e a fila dava a tarefa por encerrada, deixando o resto pra trás.
  // Isso era o resquício da premissa morta ("mostrar só o que falta"): a
  // regra agora é revisar TODO MUNDO, campo por campo, sem interrupção.
  const [showFull] = useState(true);
  const refs = useRef<Record<string, TextInput | null>>({});

  useEffect(() => {
    setValues({ telefone: p.phone || "", email: p.email || "" });
  }, [p.id]);

  const orderedMissing = useMemo(() => [...p.missing].sort((a, b) => (a === "telefone" ? -1 : b === "telefone" ? 1 : 0)), [p.missing]);
  // Só telefone/e-mail têm editor inline aqui — o resto (nascimento/cpf/
  // rg/endereço) mora exclusivamente na ficha completa (item 4: campos
  // que não tinham lugar nenhum na fila antes de virarem obrigatórios).
  const quickMissing = useMemo(() => orderedMissing.filter((f) => QUICK_EDIT_FIELDS.has(f)), [orderedMissing]);
  const fichaOnlyMissing = useMemo(() => orderedMissing.filter((f) => !QUICK_EDIT_FIELDS.has(f)), [orderedMissing]);

  async function commit(field: string, focusNextOf?: string) {
    const apiKey = field === "telefone" ? "phone" : "email";
    const value = values[field]?.trim() || "";
    const original = field === "telefone" ? (p.phone || "") : (p.email || "");
    if (value === original) { if (focusNextOf) refs.current[focusNextOf]?.focus(); return; }
    setSavingField(field);
    try {
      await onPatch(p.id, { [apiKey]: value || null } as any);
      setSavedField(field);
      setTimeout(() => setSavedField((f) => (f === field ? null : f)), 1500);
    } catch { /* o campo segue editável — sensei tenta de novo no próximo blur/Enter */ }
    finally {
      setSavingField(null);
      if (focusNextOf) refs.current[focusNextOf]?.focus();
    }
  }

  return (
    <View style={st.queueCard}>
      <View style={st.queueCardHead}>
        <Text style={st.queuePos}>{position} de {total}</Text>
        {p.priority_group === "a" && <View style={st.alertChip}><Icon name="alert-circle" size={11} color={P.alert} /><Text style={st.alertChipText}>Faixa preta · anuidade em atraso</Text></View>}
      </View>
      <Text style={st.queueName}>{p.name}</Text>
      <View style={st.rowMeta}>
        {p.karate_registration_number && <Text style={st.rowReg}>Nº {p.karate_registration_number}</Text>}
        <BeltBadge beltLevel={p.belt_name || ""} beltName={p.belt_name || undefined} />
      </View>

      {confirmingInactivate ? (
        <InlineConfirm
          message={`Confirma que ${p.name} não treina mais? Some da lista — dá pra desfazer depois.`}
          confirmLabel="Não treina mais"
          onConfirm={() => { onInactivate(p); setConfirmingInactivate(false); }}
          onCancel={() => setConfirmingInactivate(false)}
          danger
        />
      ) : (
        <>
          {quickMissing.length > 0 && (
            <View style={{ marginTop: 14 }}>
              {quickMissing.map((field, idx) => (
                <FieldInput
                  key={field}
                  ref={(r) => { refs.current[field] = r; }}
                  fieldKey={field}
                  value={values[field] || ""}
                  onChangeText={(t) => setValues((v) => ({ ...v, [field]: t }))}
                  onCommit={() => commit(field)}
                  onSubmitEditing={() => commit(field, quickMissing[idx + 1])}
                  autoFocus={idx === 0}
                  saving={savingField === field}
                  saved={savedField === field}
                />
              ))}
            </View>
          )}

          {showFull && (
            <FullRecordPanel
              token={token}
              studentId={p.id}
              onFieldSaved={(patch, result) => {
                if (patch.phone !== undefined) setValues((v) => ({ ...v, telefone: patch.phone || "" }));
                if (patch.email !== undefined) setValues((v) => ({ ...v, email: patch.email || "" }));
                onFichaFieldSaved(p.id, patch, result);
              }}
            />
          )}

          {/* Item 3: sem campo rápido pra digitar aqui — avançar exige uma
              ação explícita do sensei (nunca sai da fila sozinho, mesmo que
              já estivesse tudo preenchido desde o import). */}
          {quickMissing.length === 0 && (
            <View style={st.reviewPrompt}>
              <Text style={st.reviewPromptText}>
                {fichaOnlyMissing.length > 0
                  ? `Falta ${missingSummary(fichaOnlyMissing)} — preencha na ficha completa acima ou deixe para depois.`
                  : "Ficha completa — confira os dados acima e confirme."}
              </Text>
              <Pressable onPress={() => onReviewed(p.id)} accessibilityRole="button" accessibilityLabel="Está tudo certo, confirmar" style={st.reviewBtn}>
                <Icon name="checkmark" size={14} color="#fdf8f2" />
                <Text style={st.reviewBtnText}>{fichaOnlyMissing.length > 0 ? "Deixar para depois" : "Está tudo certo"}</Text>
              </Pressable>
            </View>
          )}

          <Pressable onPress={() => setConfirmingInactivate(true)} accessibilityRole="button" accessibilityLabel="Não treina mais" style={st.inactivateLink}>
            <Icon name="ban" size={13} color={P.ink3} />
            <Text style={st.inactivateLinkText}>Não treina mais</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// ── Linha da LISTA — compacta, expande pra editar. ──────────────────────
function ListRow({
  p, token, onPatch, onInactivate, onFichaFieldSaved,
}: {
  p: RosterPractitioner; token: string;
  onPatch: (id: string, patch: PatchPractitionerInput) => Promise<void>;
  onInactivate: (p: RosterPractitioner) => void;
  onFichaFieldSaved: (id: string, patch: Partial<RosterFullRecord>, result?: PatchPractitionerResult) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => ({ telefone: p.phone || "", email: p.email || "" }));
  const [savingField, setSavingField] = useState<string | null>(null);
  const [confirmingInactivate, setConfirmingInactivate] = useState(false);
  const [showFull, setShowFull] = useState(false);

  async function commit(field: string) {
    const apiKey = field === "telefone" ? "phone" : "email";
    const value = values[field]?.trim() || "";
    const original = field === "telefone" ? (p.phone || "") : (p.email || "");
    if (value === original) return;
    setSavingField(field);
    try { await onPatch(p.id, { [apiKey]: value || null } as any); }
    catch { /* segue editável */ }
    finally { setSavingField(null); }
  }

  return (
    <View style={st.listRow}>
      <Pressable onPress={() => setExpanded((e) => !e)} accessibilityRole="button" accessibilityLabel={`Editar ${p.name}`} style={st.listRowHead}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={st.rowName}>{p.name}</Text>
          <View style={st.rowMeta}>
            {p.karate_registration_number && <Text style={st.rowReg}>Nº {p.karate_registration_number}</Text>}
            <BeltBadge beltLevel={p.belt_name || ""} beltName={p.belt_name || undefined} />
          </View>
        </View>
        {p.missing.length > 0 ? (
          <View style={st.missingChip}><Text style={st.missingChipText}>falta {missingSummary(p.missing)}</Text></View>
        ) : (
          <Icon name="checkmark-circle" size={16} color={P.ok} />
        )}
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={P.ink3} />
      </Pressable>

      {expanded && (
        <View style={st.listRowBody}>
          {confirmingInactivate ? (
            <InlineConfirm
              message={`Confirma que ${p.name} não treina mais? Some da lista — dá pra desfazer depois.`}
              confirmLabel="Não treina mais"
              onConfirm={() => { onInactivate(p); setConfirmingInactivate(false); }}
              onCancel={() => setConfirmingInactivate(false)}
              danger
            />
          ) : (
            <>
              {/* Item 4: só telefone/e-mail têm editor rápido aqui — o
                  resto (nascimento/cpf/rg/endereço) mora na ficha completa
                  (FieldInput/commit deste componente só sabem gravar
                  phone/email; mapear p.missing inteiro chamaria a API
                  errada pros campos novos). */}
              {p.missing.filter((f) => QUICK_EDIT_FIELDS.has(f)).map((field) => (
                <FieldInput
                  key={field}
                  fieldKey={field}
                  value={values[field] || ""}
                  onChangeText={(t) => setValues((v) => ({ ...v, [field]: t }))}
                  onCommit={() => commit(field)}
                  saving={savingField === field}
                />
              ))}
              {p.missing.some((f) => !QUICK_EDIT_FIELDS.has(f)) && (
                <Text style={st.reviewPromptText}>
                  Também falta: {missingSummary(p.missing.filter((f) => !QUICK_EDIT_FIELDS.has(f)))} — veja a ficha completa.
                </Text>
              )}
              <Pressable onPress={() => setShowFull((s) => !s)} accessibilityRole="button" accessibilityLabel="Ver ficha completa">
                <Text style={st.fullLink}>{showFull ? "Ocultar ficha completa" : "Ver ficha completa"}</Text>
              </Pressable>
              {showFull && (
                <FullRecordPanel
                  token={token}
                  studentId={p.id}
                  onFieldSaved={(patch, result) => {
                    if (patch.phone !== undefined) setValues((v) => ({ ...v, telefone: patch.phone || "" }));
                    if (patch.email !== undefined) setValues((v) => ({ ...v, email: patch.email || "" }));
                    onFichaFieldSaved(p.id, patch, result);
                  }}
                />
              )}
              <Pressable onPress={() => setConfirmingInactivate(true)} accessibilityRole="button" accessibilityLabel="Não treina mais" style={st.inactivateLink}>
                <Icon name="ban" size={13} color={P.ink3} />
                <Text style={st.inactivateLinkText}>Não treina mais</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ── Link de auto-atendimento — a alavanca de escala do G1. É o sensei quem
// compartilha com o dojô (cola no grupo do WhatsApp), não a federação, por
// isso o bloco fica logo abaixo do cabeçalho — destaque, não rodapé. Uma
// frase em linguagem de sensei (o que isso tira do colo dele), link, e os
// dois botões que importam: Copiar e Compartilhar no WhatsApp. Some
// silenciosamente (retorna null) só no caso raro de self_service_url vir
// null (migration 225 ainda não aplicada no ambiente) — nunca mostra um
// bloco quebrado. ─────────────────────────────────────────────────────
function SelfServiceShareCard({ url, onCopy, onShareWhatsApp }: { url: string; onCopy: () => void; onShareWhatsApp: () => void }) {
  return (
    <View style={st.selfServiceCard}>
      <View style={st.selfServiceHead}>
        <Icon name="people" size={17} color={P.primary} />
        <Text style={st.selfServiceTitle}>Deixe os alunos atualizarem sozinhos</Text>
      </View>
      <Text style={st.selfServiceDesc}>
        Mande este link no grupo do dojô: cada aluno atualiza o próprio telefone e e-mail, e some da
        sua lista.
      </Text>
      <View style={st.selfServiceLinkRow}>
        <Text style={st.selfServiceLink} numberOfLines={1}>{url}</Text>
      </View>
      <View style={st.selfServiceActions}>
        <Pressable onPress={onCopy} accessibilityRole="button" accessibilityLabel="Copiar link de auto-atendimento" style={st.selfServiceBtn}>
          <Icon name="copy-outline" size={14} color={P.ink} />
          <Text style={st.selfServiceBtnText}>Copiar link</Text>
        </Pressable>
        <Pressable onPress={onShareWhatsApp} accessibilityRole="button" accessibilityLabel="Compartilhar no WhatsApp" style={[st.selfServiceBtn, st.selfServiceBtnPrimary]}>
          <Icon name="logo-whatsapp" size={14} color="#fdf8f2" />
          <Text style={[st.selfServiceBtnText, st.selfServiceBtnTextPrimary]}>Compartilhar no WhatsApp</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Planilha — baixar (completo / só quem falta) e subir de volta. Item
// 1 (decisão do Caio): junto com o link do aluno, é um dos DOIS
// redutores de trabalho reais do portal — por isso mora no topo, aberta
// por padrão (não mais um accordion fechado escondido no rodapé). Bom
// caminho pra dojôs grandes: baixa só quem falta, preenche numa
// planilha de verdade e sobe de volta — sem digitar campo a campo na
// tela. ──────────────────────────────────────────────────────────────
function SpreadsheetPanel({
  token, onImported, hasSelfServiceLink,
}: {
  token: string;
  onImported: (result: { atualizados: number; ignorados: number; erros: { row: number; motivo: string }[] }) => void;
  /** Some o convite pra "auto-atendimento" quando o bloco de destaque
   *  (SelfServiceShareCard) já está visível acima — evita pedir a mesma
   *  coisa duas vezes na mesma tela. Só permanece (com o fallback antigo,
   *  "peça à federação") no caso raro de self_service_url vir null. */
  hasSelfServiceLink: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(true);

  function openUrl(url: string) {
    if (IS_WEB && typeof window !== "undefined") window.open(url, "_blank");
    else Linking.openURL(url).catch(() => {});
  }

  async function handleUpload() {
    if (!IS_WEB || typeof document === "undefined") {
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const text = await file.text();
        const result = await karatePublicApi.importRosterCsv(token, text);
        onImported(result);
      } catch (err: any) {
        onImported({ atualizados: 0, ignorados: 0, erros: [{ row: 0, motivo: err?.message || "Não foi possível importar o arquivo." }] });
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  return (
    <View style={st.sheetCard}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={open ? "Recolher planilha" : "Planilha"} style={st.sheetHead}>
        <Icon name="layers" size={16} color={P.primary} />
        <Text style={st.sheetTitle}>Preencher por planilha</Text>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color={P.ink3} />
      </Pressable>
      {open && (
        <View style={st.sheetBody}>
          <Text style={st.sheetDesc}>
            Bom caminho pra dojôs grandes: baixe o quadro completo, revise/preencha na planilha (mesmo
            quem já está preenchido — vale conferir) e suba de volta.
          </Text>
          <View style={st.sheetActions}>
            {/* Item 2 (revisão Atualização Cadastral, 15/07/2026) — mudança de
                premissa: nesta rodada é revisar TODO MUNDO, não só quem falta
                algo (dado preenchido pode ter vindo errado de import). O botão
                "baixar só quem falta" saiu da UI de propósito; o resto do
                fluxo (planilha completa + reimportação) continua igual. */}
            <Pressable onPress={() => openUrl(karatePublicApi.getRosterExportUrl(token))} accessibilityRole="button" accessibilityLabel="Baixar quadro completo" style={st.sheetBtn}>
              <Icon name="download" size={14} color={P.primary} />
              <Text style={st.sheetBtnText}>Baixar quadro completo (CSV)</Text>
            </Pressable>
            {IS_WEB && (
              <Pressable onPress={uploading ? undefined : handleUpload} accessibilityRole="button" accessibilityLabel="Enviar planilha preenchida" style={st.sheetBtn}>
                {uploading ? <ActivityIndicator size="small" color={P.primary} /> : <Icon name="cloud-upload" size={14} color={P.primary} />}
                <Text style={st.sheetBtnText}>{uploading ? "Enviando..." : "Enviar planilha preenchida"}</Text>
              </Pressable>
            )}
          </View>
          {!hasSelfServiceLink && (
            <Text style={st.sheetHint}>
              Prefere que os próprios alunos atualizem o contato deles? Peça à federação o link de
              auto-atendimento do dojô.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ── "Adicionar praticante" (mantido do portal anterior) ─────────────────
function FocusField({
  icon, value, onChangeText, placeholder, style, inputStyle, accessibilityLabel,
}: {
  icon?: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  style?: any; inputStyle?: any; accessibilityLabel?: string;
}) {
  const focusAnim = useRef(new Animated.Value(0)).current;
  const onFocus = () => Animated.timing(focusAnim, { toValue: 1, duration: Motion.fast, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  const onBlur = () => Animated.timing(focusAnim, { toValue: 0, duration: Motion.fast, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  const borderColor = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [P.border, P.primary] });

  return (
    <Animated.View style={[style, { borderColor }, IS_WEB ? (webTransition(["border-color"], Motion.fast) as any) : null]}>
      {!!icon && <Icon name={icon} size={16} color={P.ink3} />}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={P.ink4}
        accessibilityLabel={accessibilityLabel}
        style={inputStyle}
      />
    </Animated.View>
  );
}

// ── Cadastro de praticante NOVO é SOLICITAÇÃO, nunca criação direta pelo
// portal (regra fechada com o Caio, H1/H2). E mora AQUI, no link público
// (decisão do Caio, 14/07/2026, H2b) — não atrás de JWT: exigir login pra
// abrir uma ficha de matrícula nova condenava a feature a não ser usada
// pelos senseis que só têm o link. Reaproveita o MESMO componente de
// ficha do Portal do Sensei autenticado
// (components/karate/PractitionerRequestForm.tsx) — fonte única, o que
// muda é só QUEM injeta o backend: aqui é o token opaco do link
// (karatePublicApi), lá é o JWT do sensei logado (karateApi). Inline,
// nunca Modal (armadilha conhecida: Modal dentro de Modal no RN Web
// renderiza atrás, no-op silencioso) — expandir/recolher é só estado
// local trocando o conteúdo do próprio card.
function RequestPractitionerSection({ token }: { token: string }) {
  const [expanded, setExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── "Corrigir e reenviar" (item 2) — StatusList devolve a linha
  // rejeitada aqui (onCorrect); repovoamos o formulário (prefill +
  // prefillKey, ver PractitionerRequestForm.tsx), garantimos que ele
  // esteja expandido e rolamos até ele. `anchorRef` aponta pro card que
  // envolve o formulário — no web, o próprio nó DOM sabe se rolar até a
  // view (scrollIntoView); é auto-scroll, nunca deixa o sensei procurando
  // onde a correção foi parar (mesmo princípio dos tours/spotlight). ────
  const [prefill, setPrefill] = useState<RequestPrefill | undefined>(undefined);
  const [prefillKey, setPrefillKey] = useState(0);
  const anchorRef = useRef<View>(null);

  const handleSubmit = useCallback(
    (body: PractitionerRequestBody) => karatePublicApi.addPublicPractitioner(token, body),
    [token]
  );
  const handleLookupFpkt = useCallback(
    (number: string) => karatePublicApi.lookupFpktNumber(token, number),
    [token]
  );
  const handleCreated = useCallback(() => setRefreshKey((k) => k + 1), []);
  // Item 9: foto da solicitação nova, pelo canal PÚBLICO (mesmo token do link).
  const handleUploadPhoto = useCallback(
    (requestId: string, input: { content: string; content_type?: "image/jpeg" | "image/png" | "image/webp" }) =>
      karatePublicApi.uploadPublicPractitionerPhoto(token, requestId, input),
    [token]
  );
  const fetchRequests = useCallback(
    (status?: PractitionerRequestStatus) => karatePublicApi.listPractitionerRequests(token, status),
    [token]
  );
  const handleCorrect = useCallback((r: PractitionerRequestRow) => {
    setPrefill({
      full_name: r.full_name,
      birth_date: r.birth_date,
      claimed_belt: r.claimed_belt,
      fpkt_number_claimed: r.fpkt_number_claimed,
      reject_reason: r.reject_reason,
    });
    setPrefillKey((k) => k + 1);
    setExpanded(true);
    if (IS_WEB) {
      requestAnimationFrame(() => {
        // RN Web repassa o ref pro nó DOM real — scrollIntoView existe nele.
        (anchorRef.current as any)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  return (
    <View style={{ marginBottom: 14, gap: 12 }}>
      <View ref={anchorRef} style={st.requestCard}>
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Recolher solicitar novo praticante" : "Solicitar novo praticante"}
          style={st.requestCardHead}
        >
          <Icon name="user-plus" size={17} color={P.primary} />
          <Text style={st.requestCardTitle}>Solicitar novo praticante</Text>
          <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} color={P.ink3} />
        </Pressable>
        {!expanded && (
          <Text style={st.requestCardDesc}>
            Matricular alguém novo? Preencha a ficha completa aqui mesmo — a federação analisa e emite o
            número FPKT.
          </Text>
        )}
        {expanded && (
          <View style={{ marginTop: 12 }}>
            <NewRequestForm
              onSubmit={handleSubmit}
              onLookupFpkt={handleLookupFpkt}
              onCreated={handleCreated}
              onUploadPhoto={handleUploadPhoto}
              prefill={prefill}
              prefillKey={prefillKey}
              confirmTitle={(alreadyPending) => (alreadyPending ? "Já havia uma solicitação para essa pessoa" : "Enviado à federação")}
              confirmText={(alreadyPending) =>
                alreadyPending
                  ? "Uma solicitação pendente com o mesmo nome e nascimento já existia neste dojô — não duplicamos, a federação já está com ela."
                  : "Ela vai validar e emitir o número FPKT."
              }
            />
          </View>
        )}
      </View>

      <StatusList fetchRequests={fetchRequests} refreshKey={refreshKey} title="Status das solicitações deste dojô" onCorrect={handleCorrect} />
    </View>
  );
}

// ── Grade de completude (item 2 do H2 — "a peça visual central") ───────
// Praticantes nas LINHAS, campos essenciais nas COLUNAS, cada célula é um
// ponto: vazio (falta), cheio (preenchido) ou destacado (acabou de
// preencher — glow por alguns segundos). Numa tela só, sem paginação: pra
// caber ~400 linhas sem virar planilha ilegível, a grade fica DENSA mas
// só 7 colunas fixas (cabe sem scroll horizontal na maioria dos celulares)
// e cada linha é compacta (28px) — a rolagem é a MESMA rolagem vertical
// da página, não uma sub-lista paginada. Toque numa linha abre a ficha.
function Dot({ state }: { state: "empty" | "filled" | "recent" | "na" }) {
  if (state === "na") return <View style={st.dotNa} />;
  if (state === "recent") return <View style={st.dotRecent} />;
  if (state === "filled") return <View style={st.dotFilled} />;
  return <View style={st.dotEmpty} />;
}

function CompletenessGrid({
  rows, fullRecords, loadedCount, totalToLoad, recentlyUpdated, onOpenPractitioner,
}: {
  rows: RosterPractitioner[];
  fullRecords: Record<string, RosterFullRecord>;
  loadedCount: number;
  totalToLoad: number;
  recentlyUpdated: Record<string, number>;
  onOpenPractitioner: (id: string) => void;
}) {
  const stillLoading = loadedCount < totalToLoad;
  return (
    <View style={st.gridCard}>
      <Text style={st.gridCaption}>
        Toque numa linha pra abrir a ficha. Colunas: {COMPLETENESS_COLUMNS.map((c) => c.short).join(" · ")}.
      </Text>

      <View style={st.gridHeaderRow}>
        <Text style={st.gridHeaderName}>Praticante</Text>
        {COMPLETENESS_COLUMNS.map((col) => (
          <Text key={col.key} style={st.gridHeaderCol} numberOfLines={1}>{col.short}</Text>
        ))}
      </View>

      {rows.map((p) => {
        const rec = fullRecords[p.id];
        return (
          <Pressable
            key={p.id}
            onPress={() => onOpenPractitioner(p.id)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ficha de ${p.name}`}
            hitSlop={{ top: 4, bottom: 4 }}
            style={st.gridRow}
          >
            <Text style={st.gridRowName} numberOfLines={1}>{p.name}</Text>
            {COMPLETENESS_COLUMNS.map((col) => {
              if (!rec) {
                return <View key={col.key} style={st.gridCell}><Dot state="na" /></View>;
              }
              if (!col.applicable(rec)) {
                return <View key={col.key} style={st.gridCell}><Dot state="na" /></View>;
              }
              const recentTs = recentlyUpdated[`${p.id}:${col.key}`];
              const isRecent = !!recentTs && Date.now() - recentTs < 4000;
              const state = isRecent ? "recent" : col.filled(rec) ? "filled" : "empty";
              return <View key={col.key} style={st.gridCell}><Dot state={state} /></View>;
            })}
          </Pressable>
        );
      })}

      {stillLoading && (
        <View style={st.gridLoadingRow}>
          <ActivityIndicator size="small" color={P.ink3} />
          <Text style={st.gridLoadingText}>Carregando ficha completa · {loadedCount} de {totalToLoad}</Text>
        </View>
      )}

      <View style={st.gridLegend}>
        <View style={st.gridLegendItem}><Dot state="empty" /><Text style={st.gridLegendText}>falta</Text></View>
        <View style={st.gridLegendItem}><Dot state="filled" /><Text style={st.gridLegendText}>preenchido</Text></View>
        <View style={st.gridLegendItem}><Dot state="recent" /><Text style={st.gridLegendText}>acabou de preencher</Text></View>
        <View style={st.gridLegendItem}><Dot state="na" /><Text style={st.gridLegendText}>não se aplica</Text></View>
      </View>
    </View>
  );
}

// ── Ficha detalhada, aberta pela grade — ÚNICO <Modal> da tela (a grade
// em si não é um Modal, então este não aninha; a confirmação de "não
// treina mais" dentro dele continua sendo um estágio inline, nunca um
// segundo Modal). ───────────────────────────────────────────────────────
function FichaDetailModal({
  visible, token, practitioner, cachedRecord, onLoaded, onFieldSaved, onInactivate, onClose,
}: {
  visible: boolean;
  token: string;
  practitioner: RosterPractitioner | null;
  cachedRecord?: RosterFullRecord | null;
  onLoaded: (record: RosterFullRecord) => void;
  onFieldSaved: (patch: Partial<RosterFullRecord>, result?: PatchPractitionerResult) => void;
  onInactivate: (p: RosterPractitioner) => void;
  onClose: () => void;
}) {
  const [confirmingInactivate, setConfirmingInactivate] = useState(false);

  if (!practitioner) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.fichaBackdrop}>
        <View style={st.fichaCard}>
          <View style={st.fichaHead}>
            <View style={{ flex: 1 }}>
              <Text style={st.fichaName} numberOfLines={1}>{practitioner.name}</Text>
              <View style={st.rowMeta}>
                <BeltBadge beltLevel={practitioner.belt_name || ""} beltName={practitioner.belt_name || undefined} />
              </View>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar ficha" style={st.fichaCloseBtn}>
              <Icon name="close" size={18} color={P.ink2} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {confirmingInactivate ? (
              <InlineConfirm
                message={`Confirma que ${practitioner.name} não treina mais? Some da lista — dá pra desfazer depois.`}
                confirmLabel="Não treina mais"
                onConfirm={() => { onInactivate(practitioner); setConfirmingInactivate(false); onClose(); }}
                onCancel={() => setConfirmingInactivate(false)}
                danger
              />
            ) : (
              <>
                <FullRecordPanel
                  token={token}
                  studentId={practitioner.id}
                  cachedRecord={cachedRecord}
                  onLoaded={onLoaded}
                  onFieldSaved={onFieldSaved}
                />
                <Pressable onPress={() => setConfirmingInactivate(true)} accessibilityRole="button" accessibilityLabel="Não treina mais" style={st.inactivateLink}>
                  <Icon name="ban" size={13} color={P.ink3} />
                  <Text style={st.inactivateLinkText}>Não treina mais</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function RosterUpdatePortalScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const tokenStr = Array.isArray(token) ? token[0] : token || "";

  const [mode, setMode] = useState<"queue" | "list" | "grade">("queue");
  const [search, setSearch] = useState("");
  const [overrides, setOverrides] = useState<Record<string, Partial<RosterPractitioner>>>({});
  const [progress, setProgress] = useState<RosterProgress | null>(null);
  const [validatedBy, setValidatedBy] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastCounter = useRef(0);

  // ── Ficha completa (H2) — FONTE ÚNICA de registros completos, usada
  // tanto pela grade de completude quanto pelo modal de ficha aberto a
  // partir dela E pelo painel "Ver ficha completa" da fila/lista (nunca
  // uma estrutura paralela — armadilha "estado duplicado" já mordeu este
  // produto). `recentlyUpdated` guarda `${id}:${campo} -> timestamp` só
  // pra acender o "destacado" da grade por alguns segundos. ─────────────
  const [fullRecords, setFullRecords] = useState<Record<string, RosterFullRecord>>({});
  const [recentlyUpdated, setRecentlyUpdated] = useState<Record<string, number>>({});
  const [openFichaId, setOpenFichaId] = useState<string | null>(null);
  const fullRecordsLoadedRef = useRef<Set<string>>(new Set());
  const gridLoadGenRef = useRef(0);

  const [importResult, setImportResult] = useState<{ atualizados: number; ignorados: number; erros: { row: number; motivo: string }[] } | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["karate-roster-update", tokenStr],
    queryFn: () => karatePublicApi.getPublicRoster(tokenStr),
    enabled: !!tokenStr,
    retry: 0,
    staleTime: Infinity, // GET é idempotente, mas a fonte de verdade pós-carga é o autosave local
  });

  useEffect(() => {
    if (data?.progress) setProgress(data.progress);
  }, [data?.progress]);

  const baseList = useMemo(() => data?.praticantes || [], [data]);
  const baseById = useMemo(() => new Map(baseList.map((p) => [p.id, p])), [baseList]);

  // Item 4/5: aplica a resposta AUTORITATIVA do servidor após um PATCH —
  // `missing` vem pronto (classifyPraticante sobre TODOS os campos), só o
  // `priority_group` é recalculado localmente (o backend não devolve
  // group no PATCH; ver computeGroupAfterPatch acima). Usado tanto pelo
  // editor rápido (telefone/e-mail na fila/lista) quanto pela ficha
  // completa (nascimento/cpf/rg/endereço) — UMA fonte, nunca dois
  // caminhos divergentes de "o que ainda falta".
  const applyPatchResult = useCallback((id: string, result: PatchPractitionerResult) => {
    const base = baseById.get(id);
    const group = base ? computeGroupAfterPatch(base, result) : undefined;
    setOverrides((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        phone: result.phone,
        email: result.email,
        is_active: result.is_active,
        missing: result.missing,
        ...(group ? { priority_group: group } : {}),
      },
    }));
    if (result.progress) setProgress(result.progress);
  }, [baseById]);

  const practitioners = useMemo<RosterPractitioner[]>(() => {
    return baseList.map((p) => {
      const ov = overrides[p.id];
      return ov ? { ...p, ...ov } : p;
    });
  }, [baseList, overrides]);

  const essenciais = useMemo(
    () => practitioners.filter((p) => p.is_active && (p.priority_group === "a" || p.priority_group === "b")).length,
    [practitioners]
  );
  const demais = practitioners.length - essenciais;

  const workingList = useMemo(() => practitioners.filter((p) => p.is_active), [practitioners]);
  const essentialAlerts = useMemo(
    () => workingList.filter((p) => p.priority_group === "a" && p.missing.length === 0),
    [workingList]
  );

  // ── Item 3 (revisão Atualização Cadastral, 15/07/2026, mudança de
  // premissa): a fila entra TODO MUNDO, não só quem tem campo faltando —
  // "estar preenchido não significa estar correto" (o dado pode ter vindo
  // de import ruim). `reviewedIds` é a marca de "já passei por aqui NESTA
  // sessão" (session-only, de propósito — mesmo espírito stateless do
  // resto desta tela: sem tabela de baseline, reabrir o link retoma do
  // topo, o que é aceitável porque o objetivo é revisar todo mundo pelo
  // menos uma vez por ciclo, não guardar um ponteiro exato).
  //
  // `initiallyComplete` é o snapshot de quem JÁ chegou sem nada faltando
  // (server, no primeiro GET) — esses precisam de CONFIRMAÇÃO explícita
  // do sensei (botão "Está tudo certo") pra sair da fila, porque não há
  // edição nenhuma que dispare o auto-avanço. Quem tinha algo faltando e
  // resolveu preenchendo continua com o auto-avanço de sempre (o efeito
  // abaixo marca como revisado assim que `missing` zera por causa de uma
  // edição).
  const initiallyComplete = useMemo(
    () => new Set(baseList.filter((p) => p.missing.length === 0).map((p) => p.id)),
    [baseList]
  );
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const markReviewed = useCallback((id: string) => {
    setReviewedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  useEffect(() => {
    setReviewedIds((prev) => {
      let next: Set<string> | null = null;
      for (const p of practitioners) {
        if (p.missing.length === 0 && !initiallyComplete.has(p.id) && !prev.has(p.id)) {
          if (!next) next = new Set(prev);
          next.add(p.id);
        }
      }
      return next || prev;
    });
  }, [practitioners, initiallyComplete]);

  const queueItems = useMemo(() => {
    return workingList
      .filter((p) => !reviewedIds.has(p.id))
      .sort((a, b) => {
        const gd = GROUP_ORDER[a.priority_group] - GROUP_ORDER[b.priority_group];
        if (gd !== 0) return gd;
        // Quem ainda tem campo faltando vem antes de quem só precisa de
        // confirmação — a fila continua priorizando trabalho de digitação.
        const missingDiff = (b.missing.length > 0 ? 1 : 0) - (a.missing.length > 0 ? 1 : 0);
        if (missingDiff !== 0) return missingDiff;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [workingList, reviewedIds]);

  const listFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = [...workingList].sort((a, b) => {
      const gd = GROUP_ORDER[a.priority_group] - GROUP_ORDER[b.priority_group];
      if (gd !== 0) return gd;
      return a.name.localeCompare(b.name, "pt-BR");
    });
    if (!q) return source;
    return source.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.karate_registration_number?.toLowerCase().includes(q)
    );
  }, [workingList, search]);

  const savePatch = useCallback(async (id: string, patch: PatchPractitionerInput) => {
    const result = await karatePublicApi.patchPractitioner(tokenStr, id, patch);
    applyPatchResult(id, result);
  }, [tokenStr, applyPatchResult]);

  const showToast = useCallback((message: string, undo?: { label: string; onUndo: () => void }) => {
    toastCounter.current += 1;
    setToast({ id: toastCounter.current, message, undoLabel: undo?.label, onUndo: undo?.onUndo });
  }, []);

  // ── Link de auto-atendimento (item 3, "transferir o trabalho") — mesmo
  // padrão de copiar/whatsapp já usado no bloco da federação
  // (RosterValidationBanner / app/karate/(federation)/dojos/[dojoId].tsx),
  // reaproveitando o utils/clipboard.ts (sem dependência nova). ─────────
  const selfServiceUrl = data?.self_service_url || null;

  const copySelfServiceLink = useCallback(async () => {
    if (!selfServiceUrl) return;
    const ok = await copyToClipboard(selfServiceUrl);
    showToast(ok ? "Link copiado" : "Não foi possível copiar o link");
  }, [selfServiceUrl, showToast]);

  const shareSelfServiceLinkWhatsApp = useCallback(() => {
    if (!selfServiceUrl) return;
    const link = `https://wa.me/?text=${encodeURIComponent(selfServiceUrl)}`;
    if (IS_WEB && typeof window !== "undefined") window.open(link, "_blank");
    else Linking.openURL(link).catch(() => showToast("Não foi possível abrir o WhatsApp. Copie o link e envie manualmente."));
  }, [selfServiceUrl, showToast]);

  const handleInactivate = useCallback(async (p: RosterPractitioner) => {
    try {
      await savePatch(p.id, { is_active: false });
      showToast(`${p.name} marcado como "não treina mais" — saiu da lista.`, {
        label: "Desfazer",
        onUndo: () => {
          savePatch(p.id, { is_active: true }).catch(() => {});
          setToast(null);
        },
      });
    } catch {
      showToast(`Não foi possível atualizar ${p.name}. Tente de novo.`);
    }
  }, [savePatch, showToast]);

  // ── ensureFullRecord — busca (ou reaproveita do cache) a ficha completa
  // de UM praticante. Usada tanto pelo pré-carregamento em lote da grade
  // quanto pela abertura direta da ficha (clique numa linha) — o cache é
  // sempre o mesmo `fullRecords`, então o segundo caminho nunca refaz um
  // fetch que o primeiro já resolveu. ───────────────────────────────────
  const ensureFullRecord = useCallback(async (id: string) => {
    if (fullRecordsLoadedRef.current.has(id)) return;
    fullRecordsLoadedRef.current.add(id);
    try {
      const rec = await karatePublicApi.getFullRecord(tokenStr, id);
      setFullRecords((prev) => ({ ...prev, [id]: rec }));
    } catch {
      fullRecordsLoadedRef.current.delete(id); // falhou — libera pra tentar de novo depois
    }
  }, [tokenStr]);

  // ── Pré-carregamento em lote pra grade de completude — só dispara quando
  // o sensei realmente abre a aba "Grade" (não gasta ~400 requests à toa
  // se ele nunca sai da fila). Concorrência limitada (6 por vez) + guarda
  // de geração: se `workingList` mudar no meio do carregamento (ex.:
  // alguém marcou "não treina mais"), a leva antiga para de escrever no
  // cache — sem isso duas cargas concorrentes poderiam se pisar. ────────
  useEffect(() => {
    if (mode !== "grade") return;
    const myGen = ++gridLoadGenRef.current;
    const pending = workingList.map((p) => p.id).filter((id) => !fullRecordsLoadedRef.current.has(id));
    if (pending.length === 0) return;

    let cancelled = false;
    const CONCURRENCY = 6;
    let cursor = 0;
    async function worker() {
      while (!cancelled && myGen === gridLoadGenRef.current) {
        const idx = cursor++;
        if (idx >= pending.length) return;
        await ensureFullRecord(pending[idx]);
      }
    }
    const workers = Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => worker());
    Promise.all(workers).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, workingList, ensureFullRecord]);

  const fullRecordsLoadedCount = useMemo(
    () => workingList.filter((p) => !!fullRecords[p.id]).length,
    [workingList, fullRecords]
  );

  // ── Handler ÚNICO de "campo da ficha completa salvo" — usado pela fila,
  // pela lista E pelo modal da grade. Atualiza a MESMA fonte única
  // (fullRecords) e, quando o campo também existe em RosterPractitioner
  // (telefone/e-mail/is_active), reaproveita o `progress`/`missing` que o
  // backend já devolveu no PATCH (result) — nunca recalcula isso no
  // cliente por conta própria. Também acende o "destacado" da grade. ────
  const handleFichaFieldSaved = useCallback((id: string, patch: Partial<RosterFullRecord>, result?: PatchPractitionerResult) => {
    setFullRecords((prev) => ({ ...prev, [id]: { ...(prev[id] as RosterFullRecord), ...patch } }));

    // Chave da grade que cada campo do PATCH acende — vários campos de
    // endereço convergem pra UMA coluna só ("endereco"), espelhando
    // COMPLETENESS_COLUMNS.endereco.filled(). ────────────────────────
    const now = Date.now();
    const gridKeys = new Set<string>();
    for (const key of Object.keys(patch)) {
      if (key === "phone") gridKeys.add("telefone");
      else if (key === "email") gridKeys.add("email");
      else if (key === "birth_date") gridKeys.add("nascimento");
      else if (key === "cpf_cnpj") gridKeys.add("cpf");
      else if (key === "rg") gridKeys.add("rg");
      else if (["street", "number", "complement", "neighborhood", "city", "state", "zip_code"].includes(key)) gridKeys.add("endereco");
    }
    if (gridKeys.size > 0) {
      setRecentlyUpdated((prev) => {
        const next = { ...prev };
        for (const gridKey of gridKeys) next[`${id}:${gridKey}`] = now;
        return next;
      });
      // Some o destaque sozinho depois de alguns segundos (a grade só lê o
      // timestamp no render, então precisa de um novo render pra apagar).
      setTimeout(() => {
        setRecentlyUpdated((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const gridKey of gridKeys) {
            if (next[`${id}:${gridKey}`] === now) { delete next[`${id}:${gridKey}`]; changed = true; }
          }
          return changed ? next : prev;
        });
      }, 4200);
    }

    // Item 4/5: usa applyPatchResult (missing PRONTO do servidor) sempre
    // que o PATCH devolveu resultado — cobre nascimento/cpf/rg/endereço,
    // não só telefone/e-mail. Sem isso, corrigir o RG pela ficha completa
    // deixava o badge "falta RG" preso na fila/lista até um refresh.
    if (result) {
      applyPatchResult(id, result);
    }
  }, [applyPatchResult]);

  const handleFullRecordLoaded = useCallback((id: string, record: RosterFullRecord) => {
    fullRecordsLoadedRef.current.add(id);
    setFullRecords((prev) => ({ ...prev, [id]: record }));
  }, []);

  const finishMut = useCallback(async () => {
    setFinishing(true);
    setFinishError(null);
    try {
      const updates = practitioners.map((p) => ({ student_id: p.id, is_active: p.is_active }));
      await karatePublicApi.submitPublicRoster(tokenStr, updates, validatedBy.trim() || undefined);
      setConfirmed(true);
    } catch (e: any) {
      setFinishError(e?.message || "Erro ao concluir a atualização. Tente novamente.");
    } finally {
      setFinishing(false);
      setConfirmingFinish(false);
    }
  }, [practitioners, tokenStr, validatedBy]);

  const reduced = useMemo(prefersReducedMotion, []);
  const pageOpacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const pageY = useRef(new Animated.Value(reduced ? 0 : 14)).current;
  const phase: "loading" | "error" | "confirmed" | "form" = isLoading ? "loading" : error ? "error" : confirmed ? "confirmed" : "form";

  useEffect(() => {
    if (phase === "loading") return;
    if (reduced) { pageOpacity.setValue(1); pageY.setValue(0); return; }
    pageOpacity.setValue(0);
    pageY.setValue(14);
    Animated.parallel([
      Animated.timing(pageOpacity, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(pageY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={st.page}>
        <View style={st.loaderBox}><ActivityIndicator color={P.primary} size="large" /></View>
      </View>
    );
  }

  // ── Token inválido / expirado / erro genérico ───────────
  if (error) {
    const status = (error as any)?.status;
    const isExpired = status === 410;
    const isInvalid = status === 404;
    return (
      <View style={st.page}>
        <Animated.View style={[st.errorWrap, { opacity: pageOpacity, transform: [{ translateY: pageY }] }]}>
          <View style={[st.glyph, { backgroundColor: isExpired ? P.warnSoft : P.dangerSoft }]}>
            <Icon name={isExpired ? "clock" : "alert-circle"} size={26} color={isExpired ? P.warn : P.danger} />
          </View>
          <Text style={st.errorTitle}>{isExpired ? "Este link expirou" : isInvalid ? "Link inválido" : "Não foi possível carregar"}</Text>
          <Text style={st.errorText}>
            {isExpired
              ? "Este link expirou. Peça um novo à federação para atualizar o quadro do seu dojô."
              : isInvalid
              ? "Este link não é válido. Verifique se o endereço foi copiado corretamente ou peça um novo à federação."
              : "Ocorreu um erro ao carregar os dados do seu dojô. Verifique sua conexão e tente novamente."}
          </Text>
          {!isExpired && !isInvalid && (
            <Pressable onPress={() => refetch()} disabled={isRefetching} accessibilityRole="button" accessibilityLabel="Tentar novamente" style={st.retryBtn}>
              {isRefetching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.retryBtnText}>Tentar novamente</Text>}
            </Pressable>
          )}
        </Animated.View>
      </View>
    );
  }

  // ── Confirmação (pós-conclusão) ─────────────────────────
  if (confirmed) {
    return (
      <View style={st.page}>
        <Animated.View style={[st.errorWrap, { opacity: pageOpacity, transform: [{ translateY: pageY }] }]}>
          <View style={[st.glyph, { backgroundColor: P.okSoft }]}>
            <Icon name="checkmark-circle" size={26} color={P.ok} />
          </View>
          <Text style={st.errorTitle}>Quadro confirmado, obrigado!</Text>
          <Text style={st.errorText}>
            Atualizamos o quadro do {data?.dojo_nome || "seu dojô"} com o que você já preencheu.
            {"\n"}Este link já foi utilizado e não pode ser reenviado.
          </Text>
        </Animated.View>
      </View>
    );
  }

  const displayQueue = queueItems;
  const currentCard = displayQueue[0];
  const openFichaPractitioner = openFichaId ? practitioners.find((p) => p.id === openFichaId) || null : null;

  // ── Formulário principal ─────────────────────────────────
  return (
    <View style={st.page}>
      <ScrollView contentContainerStyle={st.content}>
        <Animated.View style={{ opacity: pageOpacity, transform: [{ translateY: pageY }] }}>
          <View style={st.header}>
            <Text style={st.eyebrow}>Portal do sensei</Text>
            <Text style={st.dojoName}>{data?.dojo_nome || "Seu dojô"}</Text>
            <View style={st.headerRule} />
            <Text style={st.subtitle}>A federação precisa do quadro em dia — mas você não precisa digitar tudo à mão.</Text>
          </View>

          <View style={st.countsRow}>
            <Text style={st.countsStrong}>{essenciais}</Text>
            <Text style={st.countsText}> essencia{essenciais !== 1 ? "is" : "l"} · </Text>
            <Text style={st.countsMuted}>{demais} depois</Text>
          </View>

          {!!progress && progress.essenciais_total > 0 && (
            <View style={st.progressWrap}>
              <View style={st.progressTrack}>
                <View style={[st.progressFill, { width: `${Math.min(100, Math.round((progress.essenciais_resolvidos / Math.max(1, progress.essenciais_total)) * 100))}%` }]} />
              </View>
              <Text style={st.progressLabel}>
                {progress.essenciais_resolvidos} de {progress.essenciais_total} praticantes ativos com contato completo
              </Text>
            </View>
          )}

          {essenciais === 0 && workingList.length > 0 && (
            <View style={st.doneBanner}>
              <Icon name="checkmark-circle" size={16} color={P.ok} />
              <Text style={st.doneBannerText}>Tudo essencial resolvido por aqui. O que sobrou pode ficar pra depois.</Text>
            </View>
          )}

          {essentialAlerts.length > 0 && (
            <View style={st.alertBanner}>
              <Icon name="alert-circle" size={15} color={P.alert} />
              <Text style={st.alertBannerText}>
                {essentialAlerts.length} faixa{essentialAlerts.length !== 1 ? "s" : ""}-preta com anuidade em atraso
                (contato já completo — fica com a federação resolver a cobrança).
              </Text>
            </View>
          )}

          <View style={st.quickExitsWrap}>
            <Text style={st.quickExitsEyebrow}>Comece por aqui</Text>
            <Text style={st.quickExitsSub}>
              Resolve sem digitar aluno por aluno — a fila/lista/grade logo abaixo é só pro que sobrar.
            </Text>
            {!!selfServiceUrl && (
              <SelfServiceShareCard
                url={selfServiceUrl}
                onCopy={copySelfServiceLink}
                onShareWhatsApp={shareSelfServiceLinkWhatsApp}
              />
            )}
            <SpreadsheetPanel
              token={tokenStr}
              onImported={(result) => { setImportResult(result); refetch(); }}
              hasSelfServiceLink={!!selfServiceUrl}
            />
            {importResult && (
              <View style={st.importBanner}>
                <Icon name="checkmark-circle" size={15} color={P.ok} />
                <Text style={st.importBannerText}>
                  Planilha importada: {importResult.atualizados} atualizado{importResult.atualizados !== 1 ? "s" : ""}
                  {importResult.ignorados > 0 ? `, ${importResult.ignorados} sem alteração` : ""}
                  {importResult.erros.length > 0 ? `, ${importResult.erros.length} linha${importResult.erros.length !== 1 ? "s" : ""} com erro (sem problema, o resto entrou)` : ""}.
                </Text>
              </View>
            )}
          </View>

          <View style={st.modeToggle}>
            <Pressable onPress={() => setMode("queue")} style={[st.modeBtn, mode === "queue" && st.modeBtnActive]} accessibilityRole="button" accessibilityLabel="Modo fila">
              <Icon name="layers" size={14} color={mode === "queue" ? "#fdf8f2" : P.ink2} />
              <Text style={[st.modeBtnText, mode === "queue" && st.modeBtnTextActive]}>Fila ({queueItems.length})</Text>
            </Pressable>
            <Pressable onPress={() => setMode("list")} style={[st.modeBtn, mode === "list" && st.modeBtnActive]} accessibilityRole="button" accessibilityLabel="Modo lista">
              <Icon name="grid" size={14} color={mode === "list" ? "#fdf8f2" : P.ink2} />
              <Text style={[st.modeBtnText, mode === "list" && st.modeBtnTextActive]}>Lista ({workingList.length})</Text>
            </Pressable>
            <Pressable onPress={() => setMode("grade")} style={[st.modeBtn, mode === "grade" && st.modeBtnActive]} accessibilityRole="button" accessibilityLabel="Grade de completude">
              <Icon name="bar-chart" size={14} color={mode === "grade" ? "#fdf8f2" : P.ink2} />
              <Text style={[st.modeBtnText, mode === "grade" && st.modeBtnTextActive]}>Grade ({workingList.length})</Text>
            </Pressable>
          </View>

          {mode === "queue" ? (
            currentCard ? (
              <QueueCard
                key={currentCard.id}
                p={currentCard}
                position={1}
                total={displayQueue.length}
                token={tokenStr}
                onPatch={savePatch}
                onInactivate={handleInactivate}
                onFichaFieldSaved={handleFichaFieldSaved}
                onReviewed={markReviewed}
              />
            ) : (
              <View style={st.emptyCard}>
                <Icon name="checkmark-circle" size={20} color={P.ok} />
                <Text style={st.emptyText}>Quadro revisado — ninguém na fila.</Text>
              </View>
            )
          ) : mode === "list" ? (
            <View>
              <FocusField
                icon="search"
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar por nome ou registro"
                accessibilityLabel="Buscar praticante por nome ou registro"
                style={st.searchBox}
                inputStyle={st.searchInput}
              />
              {listFiltered.length === 0 ? (
                <View style={st.emptyCard}><Text style={st.emptyText}>Nenhum praticante encontrado.</Text></View>
              ) : (
                listFiltered.map((p) => (
                  <ListRow key={p.id} p={p} token={tokenStr} onPatch={savePatch} onInactivate={handleInactivate} onFichaFieldSaved={handleFichaFieldSaved} />
                ))
              )}
            </View>
          ) : (
            workingList.length === 0 ? (
              <View style={st.emptyCard}><Text style={st.emptyText}>Nenhum praticante ativo por aqui.</Text></View>
            ) : (
              <CompletenessGrid
                rows={workingList}
                fullRecords={fullRecords}
                loadedCount={fullRecordsLoadedCount}
                totalToLoad={workingList.length}
                recentlyUpdated={recentlyUpdated}
                onOpenPractitioner={(id) => { ensureFullRecord(id); setOpenFichaId(id); }}
              />
            )
          )}

          <RequestPractitionerSection token={tokenStr} />

          <View style={st.footerCard}>
            {confirmingFinish ? (
              <InlineConfirm
                message="Concluir encerra este link — ele não poderá ser reaberto. Tudo que você já preencheu já foi salvo."
                confirmLabel={finishing ? "Concluindo..." : "Concluir atualização"}
                onConfirm={finishMut}
                onCancel={() => setConfirmingFinish(false)}
                loading={finishing}
              />
            ) : (
              <>
                <Text style={st.fieldLabel}>Seu nome</Text>
                <FocusField
                  value={validatedBy}
                  onChangeText={setValidatedBy}
                  placeholder="Quem está confirmando o quadro"
                  accessibilityLabel="Seu nome, para registro da confirmação"
                  style={st.textInputWrap}
                  inputStyle={st.textInput}
                />
                {!!finishError && <Text style={st.submitError}>{finishError}</Text>}
                {/* (15/07/2026) "Concluir apenas quando todos os itens forem
                    preenchidos" — o Caio. Enquanto a fila tiver alguém com
                    campo faltando, concluir é bloqueado: encerrar o link com
                    ficha incompleta é justamente o que esta rodada existe para
                    evitar. Saída para o caso impossível (dado que não existe):
                    marcar "não treina mais", que tira a pessoa da fila. */}
                {queueItems.length > 0 ? (
                  <>
                    <View style={st.finishBlocked}>
                      <Icon name="alert-circle" size={13} color={P.ink3} />
                      <Text style={st.finishBlockedText}>
                        {queueItems.length === 1
                          ? "Falta 1 praticante com ficha incompleta."
                          : `Faltam ${queueItems.length} praticantes com ficha incompleta.`}
                        {" "}Complete as fichas para concluir — quem não treina mais pode sair pela própria ficha.
                      </Text>
                    </View>
                    <Pressable
                      disabled
                      accessibilityRole="button"
                      accessibilityState={{ disabled: true }}
                      accessibilityLabel="Concluir atualização (indisponível: há fichas incompletas)"
                      style={[st.confirmBtn, { marginTop: 12, opacity: 0.45 }]}
                    >
                      <Text style={st.confirmBtnText}>Concluir atualização</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable onPress={() => setConfirmingFinish(true)} accessibilityRole="button" accessibilityLabel="Concluir atualização" style={[st.confirmBtn, { marginTop: 12 }]}>
                    <Text style={st.confirmBtnText}>Concluir atualização</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          <View style={st.footer}>
            <Text style={st.footerText}>Portal do sensei · Aura Karatê</Text>
            <Text style={st.footerTextSmall}>Em caso de dúvidas, entre em contato com a federação.</Text>
          </View>
        </Animated.View>
      </ScrollView>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <FichaDetailModal
        visible={!!openFichaId}
        token={tokenStr}
        practitioner={openFichaPractitioner}
        cachedRecord={openFichaId ? fullRecords[openFichaId] : null}
        onLoaded={(record) => { if (openFichaId) handleFullRecordLoaded(openFichaId, record); }}
        onFieldSaved={(patch, result) => { if (openFichaId) handleFichaFieldSaved(openFichaId, patch, result); }}
        onInactivate={handleInactivate}
        onClose={() => setOpenFichaId(null)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: P.bg, position: "relative" },
  content: { padding: 20, paddingTop: 32, paddingBottom: 56, maxWidth: 640, alignSelf: "center", width: "100%" },

  loaderBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 60 },

  errorWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60, paddingHorizontal: 24, maxWidth: 440, alignSelf: "center" },
  glyph: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  errorTitle: { fontFamily: KarateFonts.heading, fontSize: 20, color: P.ink, textAlign: "center" },
  errorText: { fontSize: 13, color: P.ink3, textAlign: "center", lineHeight: 20 },
  retryBtn: { backgroundColor: P.ink, borderRadius: KarateRadius.md, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  retryBtnText: { color: "#fdf8f2", fontSize: 14, fontWeight: "700" },

  header: { alignItems: "center", paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: P.border, marginBottom: 18 },
  eyebrow: { fontSize: 11, color: P.primary, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  dojoName: { fontFamily: KarateFonts.heading, fontSize: 26, color: P.ink, marginTop: 9, textAlign: "center" },
  headerRule: { height: 2, width: 40, borderRadius: 1, backgroundColor: P.primary, marginTop: 12, alignSelf: "center" },
  subtitle: { fontSize: 13, color: P.ink3, marginTop: 12, textAlign: "center" },

  countsRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginBottom: 10 },
  countsStrong: { fontFamily: KarateFonts.heading, fontSize: 22, color: P.ink, fontWeight: "700" },
  countsText: { fontSize: 13, color: P.ink2, fontWeight: "700" },
  countsMuted: { fontSize: 13, color: P.ink3 },

  progressWrap: { marginBottom: 14, gap: 6 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: P.border, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: P.ok },
  progressLabel: { fontSize: 11, color: P.ink3, textAlign: "center" },

  doneBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.okSoft, borderWidth: 1, borderColor: P.okLine, borderRadius: KarateRadius.md, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 14 },
  doneBannerText: { fontSize: 12.5, color: P.ink, fontWeight: "600", flex: 1 },

  alertBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P.alertSoft, borderWidth: 1, borderColor: "rgba(168,84,58,0.25)", borderRadius: KarateRadius.md, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 14 },
  alertBannerText: { fontSize: 12, color: P.ink2, flex: 1, lineHeight: 17 },

  // "Comece por aqui" (item 1, decisão do Caio 14/07/2026) — envolve os
  // DOIS redutores de trabalho reais (link do aluno + planilha) num único
  // bloco logo acima do modo fila/lista/grade. Antes eles viviam
  // separados (link no meio da tela, planilha escondida no rodapé); juntos
  // e em destaque, o sensei vê as duas saídas rápidas ANTES de encarar a
  // digitação manual.
  quickExitsWrap: { marginBottom: 6 },
  quickExitsEyebrow: { fontSize: 11, fontWeight: "800", color: P.primary, textTransform: "uppercase", letterSpacing: 1.1 },
  quickExitsSub: { fontSize: 12, color: P.ink3, lineHeight: 17, marginTop: 4, marginBottom: 12 },

  // Bloco de destaque — link de auto-atendimento (item 3, "transferir o
  // trabalho"). primarySoft/primaryLine (vermelhão de carimbo, acento raro
  // do Shoji) de propósito: é o único bloco da tela com esse tratamento,
  // pra chamar atenção sem virar um segundo header.
  selfServiceCard: { backgroundColor: P.primarySoft, borderWidth: 1, borderColor: P.primaryLine, borderRadius: KarateRadius.lg, padding: 16, marginBottom: 16 },
  selfServiceHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  selfServiceTitle: { fontFamily: KarateFonts.heading, fontSize: 15.5, color: P.ink },
  selfServiceDesc: { fontSize: 12.5, color: P.ink2, lineHeight: 18 },
  selfServiceLinkRow: { marginTop: 10, marginBottom: 12, backgroundColor: P.glass2, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 10 },
  selfServiceLink: { fontFamily: KarateFonts.mono, fontSize: 12, color: P.ink2 },
  selfServiceActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selfServiceBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: P.primaryLine, borderRadius: KarateRadius.md, backgroundColor: P.glass2, paddingVertical: 9, paddingHorizontal: 12 },
  selfServiceBtnText: { fontSize: 12.5, fontWeight: "700", color: P.ink },
  selfServiceBtnPrimary: { backgroundColor: P.primary, borderColor: P.primary },
  selfServiceBtnTextPrimary: { color: "#fdf8f2" },

  modeToggle: { flexDirection: "row", gap: 8, marginBottom: 16 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.md, backgroundColor: P.glass, paddingVertical: 10 },
  modeBtnActive: { backgroundColor: P.ink, borderColor: P.ink },
  modeBtnText: { fontSize: 12.5, fontWeight: "700", color: P.ink2 },
  modeBtnTextActive: { color: "#fdf8f2" },

  queueCard: { backgroundColor: P.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: P.border, padding: 18, marginBottom: 14, ...KarateShadows.sm },
  queueCardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  queuePos: { fontFamily: KarateFonts.mono, fontSize: 11, color: P.ink3 },
  queueName: { fontFamily: KarateFonts.heading, fontSize: 19, color: P.ink },

  alertChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: P.alertSoft, borderRadius: KarateRadius.pill, paddingVertical: 3, paddingHorizontal: 8 },
  alertChipText: { fontSize: 10, fontWeight: "700", color: P.alert },

  emptyCard: { backgroundColor: P.glass, borderRadius: KarateRadius.md, padding: 24, borderWidth: 1, borderColor: P.border, alignItems: "center", gap: 8, marginBottom: 14 },
  emptyText: { fontSize: 13, color: P.ink3, textAlign: "center" },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.glass, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, color: P.ink, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },

  listRow: { backgroundColor: P.glass, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: P.border, marginBottom: 8, overflow: "hidden" },
  listRowHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  listRowBody: { padding: 14, paddingTop: 0, borderTopWidth: 1, borderTopColor: P.border },
  rowName: { fontSize: 14.5, fontWeight: "700", color: P.ink },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  rowReg: { fontFamily: KarateFonts.mono, fontSize: 11.5, color: P.ink3 },
  missingChip: { backgroundColor: P.warnSoft, borderRadius: KarateRadius.pill, paddingVertical: 4, paddingHorizontal: 9 },
  missingChipText: { fontSize: 10.5, fontWeight: "700", color: P.warn },

  fieldLabel: { fontSize: 11.5, fontWeight: "700", color: P.ink2, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  fieldInputWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, backgroundColor: P.paperWarm, paddingHorizontal: 12, paddingVertical: 4 },
  fieldInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: P.ink, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },

  fullLink: { fontSize: 12.5, fontWeight: "700", color: P.primary, marginTop: 4 },
  fullRecord: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: P.border },
  fullRecordNote: { fontSize: 11.5, color: P.ink3, marginBottom: 10 },
  fullGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fullGridItem: { width: "47%", minWidth: 130 },
  fullInput: { borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, backgroundColor: P.paperWarm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: P.ink },
  currentValueText: { fontSize: 10.5, color: P.ink4, marginBottom: 4 },
  savedNote: { fontSize: 10.5, color: P.ok, fontWeight: "700", marginTop: 4 },

  readonlyRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4 },
  readonlyRowText: { fontSize: 11.5, color: P.ink3, flexShrink: 1 },
  readonlyRowStrong: { fontFamily: KarateFonts.mono, color: P.ink2, fontWeight: "700" },
  guardianReadonlyBox: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: P.border },
  guardianReadonlyHint: { fontSize: 10.5, color: P.ink4, marginTop: 4 },

  inactivateLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, alignSelf: "flex-start" },
  inactivateLinkText: { fontSize: 12, fontWeight: "600", color: P.ink3 },
  // Item 3 — prompt de revisão manual (QueueCard, quando não há campo
  // rápido pra digitar): confirma "olhei" e avança a fila.
  reviewPrompt: { marginTop: 14, gap: 8 },
  reviewPromptText: { fontSize: 12.5, color: P.ink2, lineHeight: 18 },
  reviewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: P.primary, borderRadius: 10, paddingVertical: 11, alignSelf: "flex-start", paddingHorizontal: 16 },
  reviewBtnText: { fontSize: 13, fontWeight: "700", color: "#fdf8f2" },

  inlineConfirm: { backgroundColor: P.dangerSoft, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: "rgba(184,70,58,0.25)", padding: 14, marginTop: 12 },
  inlineConfirmText: { fontSize: 13, color: P.ink, lineHeight: 19, marginBottom: 12 },
  inlineConfirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  inlineCancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  inlineCancelText: { fontSize: 13, fontWeight: "700", color: P.ink2 },
  inlineConfirmBtn: { backgroundColor: P.ink, borderRadius: KarateRadius.sm, paddingVertical: 10, paddingHorizontal: 16, minWidth: 90, alignItems: "center" },
  inlineConfirmBtnText: { fontSize: 13, fontWeight: "700", color: "#fdf8f2" },

  sheetCard: { backgroundColor: P.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: P.border2, marginBottom: 16, overflow: "hidden" },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  sheetTitle: { flex: 1, fontSize: 13.5, fontWeight: "700", color: P.ink },
  sheetBody: { padding: 14, paddingTop: 0 },
  sheetDesc: { fontSize: 12, color: P.ink3, lineHeight: 17, marginBottom: 10 },
  sheetActions: { gap: 8 },
  sheetBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  sheetBtnText: { fontSize: 12.5, fontWeight: "700", color: P.primary },
  sheetHint: { fontSize: 11, color: P.ink4, marginTop: 10, lineHeight: 15 },

  importBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: P.okSoft, borderWidth: 1, borderColor: P.okLine, borderRadius: KarateRadius.md, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 14 },
  importBannerText: { fontSize: 12, color: P.ink, flex: 1, lineHeight: 17 },

  addFieldError: { fontSize: 11.5, color: P.danger, marginTop: 6 },

  finishBlocked: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 12,
    backgroundColor: P.paper2, borderWidth: 1, borderColor: P.border, borderRadius: 8, padding: 9 } as any,
  finishBlockedText: { flex: 1, fontSize: 11.5, lineHeight: 16, color: P.ink2 } as any,
  footerCard: { backgroundColor: P.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: P.border, padding: 16, marginTop: 4 },
  textInputWrap: { borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, backgroundColor: P.paperWarm },
  textInput: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: P.ink, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },
  submitError: { fontSize: 12, color: P.danger, marginTop: 10, textAlign: "center" },

  confirmBtn: { borderRadius: KarateRadius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", backgroundColor: P.ink, paddingVertical: 14, paddingHorizontal: 28 },
  confirmBtnText: { fontWeight: "700", letterSpacing: 0.2, color: "#fdf8f2", fontSize: 17 },

  footer: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: P.border, alignItems: "center", gap: 4 },
  footerText: { fontSize: 11, color: P.ink3, fontWeight: "600" },
  footerTextSmall: { fontSize: 10, color: P.ink4, textAlign: "center", maxWidth: 320 },

  // ── "Solicitar novo praticante" inline (H2b — mora aqui, no link público) ──
  requestCard: { backgroundColor: P.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: P.border, padding: 16 },
  requestCardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  requestCardTitle: { fontFamily: KarateFonts.heading, fontSize: 14.5, color: P.ink, flex: 1 },
  requestCardDesc: { fontSize: 12, color: P.ink3, lineHeight: 17, marginTop: 6 },

  // ── Grade de completude (H2 — item 2, "a peça central") ─────────────
  gridCard: { backgroundColor: P.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: P.border, padding: 12, marginBottom: 14 },
  gridCaption: { fontSize: 11.5, color: P.ink3, lineHeight: 16, marginBottom: 10 },
  gridHeaderRow: { flexDirection: "row", alignItems: "center", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: P.border, marginBottom: 2 },
  gridHeaderName: { flex: 1, fontSize: 10, fontWeight: "800", color: P.ink3, textTransform: "uppercase", letterSpacing: 0.3 },
  gridHeaderCol: { width: 30, fontSize: 9.5, fontWeight: "800", color: P.ink2, textAlign: "center", textTransform: "uppercase" },
  gridRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  gridRowName: { flex: 1, fontSize: 12, fontWeight: "600", color: P.ink, paddingRight: 6 },
  gridCell: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  dotEmpty: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.6, borderColor: P.ink3, backgroundColor: "transparent" },
  dotFilled: { width: 10, height: 10, borderRadius: 5, backgroundColor: P.ok },
  dotRecent: { width: 12, height: 12, borderRadius: 6, backgroundColor: P.primary, borderWidth: 2, borderColor: P.primaryLine },
  dotNa: { width: 6, height: 1.6, borderRadius: 1, backgroundColor: P.ink4 },
  gridLoadingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 10 },
  gridLoadingText: { fontSize: 11, color: P.ink3 },
  gridLegend: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: P.border },
  gridLegendItem: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 3 },
  gridLegendText: { fontSize: 11, color: P.ink2 },

  // ── Modal da ficha aberta pela grade (único <Modal> da tela) ─────────
  fichaBackdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", justifyContent: "flex-end" },
  fichaCard: { backgroundColor: P.bg, borderTopLeftRadius: KarateRadius.xl, borderTopRightRadius: KarateRadius.xl, maxHeight: "88%", borderWidth: 1, borderColor: P.border, borderBottomWidth: 0 },
  fichaHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: P.border },
  fichaName: { fontFamily: KarateFonts.heading, fontSize: 17, color: P.ink },
  fichaCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: P.glass2 },

  toastWrap: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: 20, paddingHorizontal: 16 },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.ink, borderRadius: KarateRadius.md, paddingVertical: 12, paddingHorizontal: 16, maxWidth: 480, ...KarateShadows.card },
  toastText: { flex: 1, fontSize: 12.5, color: "#fdf8f2", fontWeight: "600" },
  toastUndo: { fontSize: 12.5, fontWeight: "800", color: "#f4d9a0" },
});
