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
//   3. Transferir o trabalho — planilha (baixar só quem falta, subir de
//      volta) para os dojôs grandes.
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
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";
import { KarateColors as P, KarateRadius, KarateFonts, KarateShadows, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { Motion, webTransition } from "@/constants/motion";
import { BeltBadge } from "@/components/karate/BeltBadge";
import {
  karatePublicApi,
  RosterPractitioner,
  RosterProgress,
  RosterFullRecord,
  PatchPractitionerInput,
  AddPractitionerInput,
} from "@/services/karatePublicApi";

const IS_WEB = Platform.OS === "web";

const NON_LEGACY_BELT_KEYS: BeltKey[] = (Object.keys(KarateBelts) as BeltKey[]).filter(
  (k) => !KarateBelts[k].isLegacy
);

const GROUP_ORDER: Record<string, number> = { a: 0, b: 1, c: 2 };
const MISSING_LABEL: Record<string, string> = { telefone: "Telefone", email: "E-mail" };
const MISSING_PLACEHOLDER: Record<string, string> = { telefone: "(00) 00000-0000", email: "email@exemplo.com" };
const MISSING_KEYBOARD: Record<string, "phone-pad" | "email-address" | "default"> = {
  telefone: "phone-pad",
  email: "email-address",
};

function prefersReducedMotion(): boolean {
  if (!IS_WEB || typeof window === "undefined" || !window.matchMedia) return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

// ── Reclassifica um praticante LOCALMENTE após um patch (phone/email/
//    is_active), com a MESMA régua do backend (classifyPraticante em
//    karateRosterPortalPublic.js) — sempre contra o snapshot ORIGINAL do
//    servidor (`base`), nunca acumulando sobre um override anterior, então
//    "grupo a" (faixa-preta com anuidade em atraso) nunca se perde nem se
//    inventa por engano ao longo de várias edições. ─────────────────────
function reclassify(
  base: RosterPractitioner,
  patch: Partial<Pick<RosterPractitioner, "phone" | "email" | "is_active">>
): RosterPractitioner {
  const merged: RosterPractitioner = { ...base, ...patch };
  const hasPhone = !!(merged.phone && String(merged.phone).trim());
  const hasEmail = !!(merged.email && String(merged.email).trim());
  const missing: string[] = [];
  if (!hasPhone) missing.push("telefone");
  if (!hasEmail) missing.push("email");

  let group = base.priority_group;
  if (!merged.is_active) {
    group = "c";
  } else if (base.priority_group !== "a") {
    group = !hasPhone && !hasEmail ? "b" : "c";
  }
  return { ...merged, missing, priority_group: group };
}

function missingSummary(missing: string[]): string {
  if (missing.length === 0) return "";
  return missing.map((m) => MISSING_LABEL[m] || m).join(" e ");
}

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

// ── Ficha completa — atrás do link "Ver ficha completa". Busca sob
// demanda (item 1: não carregar 20 campos de cara pra todo mundo). ─────
const FULL_FIELDS: { key: keyof RosterFullRecord & string; label: string; readOnly?: boolean }[] = [
  { key: "cpf_cnpj", label: "CPF" },
  { key: "rg", label: "RG" },
  { key: "birth_date", label: "Nascimento (AAAA-MM-DD)" },
  { key: "street", label: "Rua" },
  { key: "number", label: "Número" },
  { key: "complement", label: "Complemento" },
  { key: "neighborhood", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
  { key: "zip_code", label: "CEP" },
];

function FullRecordPanel({
  token, studentId, onFieldSaved,
}: { token: string; studentId: string; onFieldSaved: (patch: PatchPractitionerInput & { phone?: string | null; email?: string | null }) => void }) {
  const [record, setRecord] = useState<RosterFullRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    karatePublicApi.getFullRecord(token, studentId)
      .then((r) => {
        if (!alive) return;
        setRecord(r);
        const v: Record<string, string> = {};
        for (const f of FULL_FIELDS) v[f.key] = (r as any)[f.key] || "";
        v.phone = r.phone || "";
        v.email = r.email || "";
        setValues(v);
      })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token, studentId]);

  const commit = useCallback(async (key: string, apiKey: string) => {
    setSavingKey(key);
    try {
      const patch: PatchPractitionerInput = { [apiKey]: values[key] || null } as any;
      await karatePublicApi.patchPractitioner(token, studentId, patch);
      if (apiKey === "phone" || apiKey === "email") onFieldSaved({ [apiKey]: values[key] || null } as any);
    } catch { /* silencioso — o campo continua editável, sensei tenta de novo */ }
    finally { setSavingKey(null); }
  }, [token, studentId, values, onFieldSaved]);

  if (loading) {
    return <View style={{ paddingVertical: 16, alignItems: "center" }}><ActivityIndicator size="small" color={P.ink3} /></View>;
  }
  if (error || !record) {
    return <Text style={st.addFieldError}>Não foi possível carregar a ficha completa. Tente de novo.</Text>;
  }

  return (
    <View style={st.fullRecord}>
      {!!(record.guardian_name || record.guardian_phone) && (
        <Text style={st.fullRecordNote}>
          Responsável: {record.guardian_name || "—"}{record.guardian_phone ? ` · ${record.guardian_phone}` : ""}
          {record.guardian_relationship ? ` (${record.guardian_relationship})` : ""}
        </Text>
      )}
      <View style={st.fullGrid}>
        <View style={st.fullGridItem}>
          <Text style={st.fieldLabel}>Telefone</Text>
          <TextInput
            value={values.phone}
            onChangeText={(t) => setValues((v) => ({ ...v, phone: t }))}
            onBlur={() => commit("phone", "phone")}
            keyboardType="phone-pad"
            style={st.fullInput}
            accessibilityLabel="Telefone"
          />
        </View>
        <View style={st.fullGridItem}>
          <Text style={st.fieldLabel}>E-mail</Text>
          <TextInput
            value={values.email}
            onChangeText={(t) => setValues((v) => ({ ...v, email: t }))}
            onBlur={() => commit("email", "email")}
            keyboardType="email-address"
            style={st.fullInput}
            accessibilityLabel="E-mail"
          />
        </View>
        {FULL_FIELDS.map((f) => (
          <View key={f.key} style={st.fullGridItem}>
            <Text style={st.fieldLabel}>{f.label}</Text>
            <TextInput
              value={values[f.key] || ""}
              onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
              onBlur={() => commit(f.key, f.key === "cpf_cnpj" ? "cpf" : f.key)}
              style={st.fullInput}
              accessibilityLabel={f.label}
            />
            {savingKey === f.key && <ActivityIndicator size="small" color={P.ink3} style={{ marginTop: 4 }} />}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Card da FILA — um praticante, só os campos faltando, Enter avança. ──
function QueueCard({
  p, position, total, token, onPatch, onInactivate,
}: {
  p: RosterPractitioner; position: number; total: number; token: string;
  onPatch: (id: string, patch: PatchPractitionerInput) => Promise<void>;
  onInactivate: (p: RosterPractitioner) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ telefone: p.phone || "", email: p.email || "" }));
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [confirmingInactivate, setConfirmingInactivate] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const refs = useRef<Record<string, TextInput | null>>({});

  useEffect(() => {
    setValues({ telefone: p.phone || "", email: p.email || "" });
  }, [p.id]);

  const orderedMissing = useMemo(() => [...p.missing].sort((a, b) => (a === "telefone" ? -1 : b === "telefone" ? 1 : 0)), [p.missing]);

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
          <View style={{ marginTop: 14 }}>
            {orderedMissing.map((field, idx) => (
              <FieldInput
                key={field}
                ref={(r) => { refs.current[field] = r; }}
                fieldKey={field}
                value={values[field] || ""}
                onChangeText={(t) => setValues((v) => ({ ...v, [field]: t }))}
                onCommit={() => commit(field)}
                onSubmitEditing={() => commit(field, orderedMissing[idx + 1])}
                autoFocus={idx === 0}
                saving={savingField === field}
                saved={savedField === field}
              />
            ))}
          </View>

          <Pressable onPress={() => setShowFull((s) => !s)} accessibilityRole="button" accessibilityLabel="Ver ficha completa" style={{ marginTop: 2, marginBottom: showFull ? 10 : 0 }}>
            <Text style={st.fullLink}>{showFull ? "Ocultar ficha completa" : "Ver ficha completa"}</Text>
          </Pressable>
          {showFull && (
            <FullRecordPanel
              token={token}
              studentId={p.id}
              onFieldSaved={(patch) => {
                if (patch.phone !== undefined) setValues((v) => ({ ...v, telefone: patch.phone || "" }));
                if (patch.email !== undefined) setValues((v) => ({ ...v, email: patch.email || "" }));
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
  );
}

// ── Linha da LISTA — compacta, expande pra editar. ──────────────────────
function ListRow({
  p, token, onPatch, onInactivate,
}: { p: RosterPractitioner; token: string; onPatch: (id: string, patch: PatchPractitionerInput) => Promise<void>; onInactivate: (p: RosterPractitioner) => void }) {
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
              {p.missing.map((field) => (
                <FieldInput
                  key={field}
                  fieldKey={field}
                  value={values[field] || ""}
                  onChangeText={(t) => setValues((v) => ({ ...v, [field]: t }))}
                  onCommit={() => commit(field)}
                  saving={savingField === field}
                />
              ))}
              <Pressable onPress={() => setShowFull((s) => !s)} accessibilityRole="button" accessibilityLabel="Ver ficha completa">
                <Text style={st.fullLink}>{showFull ? "Ocultar ficha completa" : "Ver ficha completa"}</Text>
              </Pressable>
              {showFull && (
                <FullRecordPanel
                  token={token}
                  studentId={p.id}
                  onFieldSaved={(patch) => {
                    if (patch.phone !== undefined) setValues((v) => ({ ...v, telefone: patch.phone || "" }));
                    if (patch.email !== undefined) setValues((v) => ({ ...v, email: patch.email || "" }));
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

// ── Planilha — baixar (completo / só quem falta) e subir de volta. ─────
function SpreadsheetPanel({
  token, onImported,
}: { token: string; onImported: (result: { atualizados: number; ignorados: number; erros: { row: number; motivo: string }[] }) => void }) {
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

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
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel="Planilha" style={st.sheetHead}>
        <Icon name="layers" size={16} color={P.primary} />
        <Text style={st.sheetTitle}>Prefere planilha?</Text>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={16} color={P.ink3} />
      </Pressable>
      {open && (
        <View style={st.sheetBody}>
          <Text style={st.sheetDesc}>
            Bom caminho pra dojôs grandes: baixe só quem falta, preencha telefone/e-mail na planilha e
            suba de volta.
          </Text>
          <View style={st.sheetActions}>
            <Pressable onPress={() => openUrl(karatePublicApi.getRosterExportMissingUrl(token))} accessibilityRole="button" accessibilityLabel="Baixar só quem falta" style={st.sheetBtn}>
              <Icon name="download" size={14} color={P.primary} />
              <Text style={st.sheetBtnText}>Baixar só quem falta (CSV)</Text>
            </Pressable>
            <Pressable onPress={() => openUrl(karatePublicApi.getRosterExportUrl(token))} accessibilityRole="button" accessibilityLabel="Baixar quadro completo" style={st.sheetBtn}>
              <Icon name="download" size={14} color={P.ink2} />
              <Text style={[st.sheetBtnText, { color: P.ink2 }]}>Baixar quadro completo (CSV)</Text>
            </Pressable>
            {IS_WEB && (
              <Pressable onPress={uploading ? undefined : handleUpload} accessibilityRole="button" accessibilityLabel="Enviar planilha preenchida" style={st.sheetBtn}>
                {uploading ? <ActivityIndicator size="small" color={P.primary} /> : <Icon name="cloud-upload" size={14} color={P.primary} />}
                <Text style={st.sheetBtnText}>{uploading ? "Enviando..." : "Enviar planilha preenchida"}</Text>
              </Pressable>
            )}
          </View>
          <Text style={st.sheetHint}>
            Prefere que os próprios alunos atualizem o contato deles? Peça à federação o link de
            auto-atendimento do dojô.
          </Text>
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

function AddPractitionerForm({
  onSubmit, onCancel, submitting, apiError,
}: {
  onSubmit: (input: AddPractitionerInput) => void;
  onCancel: () => void;
  submitting: boolean;
  apiError?: string | null;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [beltKey, setBeltKey] = useState<BeltKey | null>(null);
  const [touched, setTouched] = useState(false);

  const nameOk = !!name.trim();
  const beltOk = !!beltKey;
  const contactOk = !!(phone.trim() || email.trim());
  const valid = nameOk && beltOk && contactOk;

  function handleSubmit() {
    setTouched(true);
    if (!valid || submitting) return;
    const belt = beltKey ? KarateBelts[beltKey] : null;
    onSubmit({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      belt_level: beltKey as string,
      belt_name: belt?.label || (beltKey as string),
    });
  }

  return (
    <View style={st.addCard}>
      <Text style={st.addCardTitle}>Novo praticante</Text>

      <Text style={st.fieldLabel}>Nome *</Text>
      <FocusField
        value={name}
        onChangeText={setName}
        placeholder="Nome completo do praticante"
        accessibilityLabel="Nome do novo praticante"
        style={st.textInputWrap}
        inputStyle={st.textInput}
      />
      {touched && !nameOk && <Text style={st.addFieldError}>Informe o nome do praticante.</Text>}

      <Text style={[st.fieldLabel, { marginTop: 12 }]}>Telefone</Text>
      <FocusField
        value={phone}
        onChangeText={setPhone}
        placeholder="(00) 00000-0000"
        accessibilityLabel="Telefone do novo praticante"
        style={st.textInputWrap}
        inputStyle={st.textInput}
      />

      <Text style={[st.fieldLabel, { marginTop: 12 }]}>E-mail</Text>
      <FocusField
        value={email}
        onChangeText={setEmail}
        placeholder="email@exemplo.com"
        accessibilityLabel="E-mail do novo praticante"
        style={st.textInputWrap}
        inputStyle={st.textInput}
      />
      {touched && !contactOk && (
        <Text style={st.addFieldError}>Informe pelo menos um contato (telefone ou e-mail).</Text>
      )}

      <Text style={[st.fieldLabel, { marginTop: 12 }]}>Faixa *</Text>
      <View style={st.beltChipsRow}>
        {NON_LEGACY_BELT_KEYS.map((key) => {
          const belt = KarateBelts[key];
          const selected = beltKey === key;
          return (
            <Pressable
              key={key}
              onPress={() => setBeltKey(key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Faixa ${belt.label}`}
              style={[
                st.beltChip,
                { backgroundColor: belt.color, borderColor: selected ? P.ink : "rgba(0,0,0,0.12)" },
                selected && st.beltChipSelected,
              ]}
            >
              <Text style={[st.beltChipLabel, { color: belt.textColor }]}>{belt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {touched && !beltOk && <Text style={st.addFieldError}>Selecione a faixa do praticante.</Text>}

      {!!apiError && <Text style={st.submitError}>{apiError}</Text>}

      <View style={st.addFormActions}>
        <Pressable
          onPress={submitting ? undefined : onCancel}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Cancelar cadastro de praticante"
          style={[st.addCancelBtn, submitting && { opacity: 0.5 }]}
        >
          <Text style={st.addCancelBtnText}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={submitting ? undefined : handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Adicionar praticante"
          style={[st.confirmBtn, st.addSubmitBtn, submitting && { opacity: 0.6 }]}
        >
          {submitting ? <ActivityIndicator color="#fdf8f2" size="small" /> : <Text style={st.confirmBtnText}>Adicionar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

export default function RosterUpdatePortalScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const tokenStr = Array.isArray(token) ? token[0] : token || "";

  const [mode, setMode] = useState<"queue" | "list">("queue");
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

  const [addedPracticantes, setAddedPracticantes] = useState<RosterPractitioner[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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

  const baseList = useMemo(() => [...(data?.praticantes || []), ...addedPracticantes], [data, addedPracticantes]);
  const practitioners = useMemo<RosterPractitioner[]>(() => {
    return baseList.map((p) => {
      const ov = overrides[p.id];
      return ov ? reclassify(p, ov) : p;
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
  const queueItems = useMemo(() => {
    return workingList
      .filter((p) => p.missing.length > 0)
      .sort((a, b) => {
        const gd = GROUP_ORDER[a.priority_group] - GROUP_ORDER[b.priority_group];
        if (gd !== 0) return gd;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [workingList]);

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
    setOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], phone: result.phone, email: result.email, is_active: result.is_active },
    }));
    if (result.progress) setProgress(result.progress);
  }, [tokenStr]);

  const showToast = useCallback((message: string, undo?: { label: string; onUndo: () => void }) => {
    toastCounter.current += 1;
    setToast({ id: toastCounter.current, message, undoLabel: undo?.label, onUndo: undo?.onUndo });
  }, []);

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

  const addMut = useCallback(async (input: AddPractitionerInput) => {
    setAddSubmitting(true);
    setAddError(null);
    try {
      const created = await karatePublicApi.addPublicPractitioner(tokenStr, input);
      const newPractitioner: RosterPractitioner = {
        id: created.id,
        name: created.name,
        karate_registration_number: created.karate_registration_number,
        belt_name: created.belt_name,
        is_active: true,
        phone: input.phone || null,
        email: input.email || null,
        missing: [!input.phone && "telefone", !input.email && "email"].filter(Boolean) as string[],
        priority_group: "c",
      };
      setAddedPracticantes((prev) => [...prev, newPractitioner]);
      setShowAddForm(false);
      showToast(`${newPractitioner.name} foi adicionado ao quadro.`);
    } catch (e: any) {
      setAddError(e?.message || "Erro ao adicionar praticante. Tente novamente.");
    } finally {
      setAddSubmitting(false);
    }
  }, [tokenStr, showToast]);

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

  function handleDownloadCsv() {
    const url = karatePublicApi.getRosterExportUrl(tokenStr);
    if (IS_WEB && typeof window !== "undefined") window.open(url, "_blank");
    else Linking.openURL(url).catch(() => {});
  }

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

  // ── Formulário principal ─────────────────────────────────
  return (
    <View style={st.page}>
      <ScrollView contentContainerStyle={st.content}>
        <Animated.View style={{ opacity: pageOpacity, transform: [{ translateY: pageY }] }}>
          <View style={st.header}>
            <Text style={st.eyebrow}>Portal do sensei</Text>
            <Text style={st.dojoName}>{data?.dojo_nome || "Seu dojô"}</Text>
            <View style={st.headerRule} />
            <Text style={st.subtitle}>Só o que falta pra fechar o quadro — o resto pode esperar.</Text>
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

          <View style={st.modeToggle}>
            <Pressable onPress={() => setMode("queue")} style={[st.modeBtn, mode === "queue" && st.modeBtnActive]} accessibilityRole="button" accessibilityLabel="Modo fila">
              <Icon name="layers" size={14} color={mode === "queue" ? "#fdf8f2" : P.ink2} />
              <Text style={[st.modeBtnText, mode === "queue" && st.modeBtnTextActive]}>Fila ({queueItems.length})</Text>
            </Pressable>
            <Pressable onPress={() => setMode("list")} style={[st.modeBtn, mode === "list" && st.modeBtnActive]} accessibilityRole="button" accessibilityLabel="Modo lista">
              <Icon name="grid" size={14} color={mode === "list" ? "#fdf8f2" : P.ink2} />
              <Text style={[st.modeBtnText, mode === "list" && st.modeBtnTextActive]}>Lista ({workingList.length})</Text>
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
              />
            ) : (
              <View style={st.emptyCard}>
                <Icon name="checkmark-circle" size={20} color={P.ok} />
                <Text style={st.emptyText}>Ninguém com contato faltando por aqui.</Text>
              </View>
            )
          ) : (
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
                  <ListRow key={p.id} p={p} token={tokenStr} onPatch={savePatch} onInactivate={handleInactivate} />
                ))
              )}
            </View>
          )}

          {showAddForm ? (
            <AddPractitionerForm
              submitting={addSubmitting}
              apiError={addError}
              onSubmit={addMut}
              onCancel={() => { setShowAddForm(false); setAddError(null); }}
            />
          ) : (
            <Pressable onPress={() => setShowAddForm(true)} accessibilityRole="button" accessibilityLabel="Adicionar praticante" style={st.addToggleBtn}>
              <Icon name="user-plus" size={16} color={P.primary} />
              <Text style={st.addToggleBtnText}>Adicionar praticante</Text>
            </Pressable>
          )}

          <SpreadsheetPanel
            token={tokenStr}
            onImported={(result) => { setImportResult(result); refetch(); }}
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
                <Pressable onPress={() => setConfirmingFinish(true)} accessibilityRole="button" accessibilityLabel="Concluir atualização" style={[st.confirmBtn, { marginTop: 12 }]}>
                  <Text style={st.confirmBtnText}>Concluir atualização</Text>
                </Pressable>
                <Pressable onPress={handleDownloadCsv} accessibilityRole="button" accessibilityLabel="Baixar quadro completo CSV" style={st.csvBtn}>
                  <Icon name="download" size={16} color={P.primary} />
                  <Text style={st.csvBtnText}>Baixar quadro completo (CSV)</Text>
                </Pressable>
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

  inactivateLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, alignSelf: "flex-start" },
  inactivateLinkText: { fontSize: 12, fontWeight: "600", color: P.ink3 },

  inlineConfirm: { backgroundColor: P.dangerSoft, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: "rgba(184,70,58,0.25)", padding: 14, marginTop: 12 },
  inlineConfirmText: { fontSize: 13, color: P.ink, lineHeight: 19, marginBottom: 12 },
  inlineConfirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  inlineCancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  inlineCancelText: { fontSize: 13, fontWeight: "700", color: P.ink2 },
  inlineConfirmBtn: { backgroundColor: P.ink, borderRadius: KarateRadius.sm, paddingVertical: 10, paddingHorizontal: 16, minWidth: 90, alignItems: "center" },
  inlineConfirmBtnText: { fontSize: 13, fontWeight: "700", color: "#fdf8f2" },

  sheetCard: { backgroundColor: P.glass, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: P.border, marginBottom: 14, overflow: "hidden" },
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

  addToggleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.md, backgroundColor: P.glass, paddingVertical: 12, marginBottom: 14 },
  addToggleBtnText: { fontSize: 13.5, fontWeight: "700", color: P.primary },

  addCard: { backgroundColor: P.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: P.border, padding: 16, marginBottom: 14 },
  addCardTitle: { fontFamily: KarateFonts.heading, fontSize: 16, color: P.ink, marginBottom: 12 },
  addFieldError: { fontSize: 11.5, color: P.danger, marginTop: 6 },

  beltChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  beltChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: KarateRadius.sm, borderWidth: 1 },
  beltChipSelected: { borderWidth: 2, ...KarateShadows.sm },
  beltChipLabel: { fontSize: 12.5, fontWeight: "700" },

  addFormActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 16 },
  addCancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  addCancelBtnText: { fontSize: 13.5, fontWeight: "700", color: P.ink3 },
  addSubmitBtn: { paddingVertical: 12, paddingHorizontal: 22 },

  footerCard: { backgroundColor: P.glass, borderRadius: KarateRadius.lg, borderWidth: 1, borderColor: P.border, padding: 16, marginTop: 4 },
  textInputWrap: { borderWidth: 1, borderColor: P.border, borderRadius: KarateRadius.sm, backgroundColor: P.paperWarm },
  textInput: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: P.ink, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },
  submitError: { fontSize: 12, color: P.danger, marginTop: 10, textAlign: "center" },

  confirmBtn: { borderRadius: KarateRadius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", backgroundColor: P.ink, paddingVertical: 14, paddingHorizontal: 28 },
  confirmBtnText: { fontWeight: "700", letterSpacing: 0.2, color: "#fdf8f2", fontSize: 17 },

  csvBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, marginTop: 10 },
  csvBtnText: { fontSize: 13, fontWeight: "700", color: P.primary },

  footer: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: P.border, alignItems: "center", gap: 4 },
  footerText: { fontSize: 11, color: P.ink3, fontWeight: "600" },
  footerTextSmall: { fontSize: 10, color: P.ink4, textAlign: "center", maxWidth: 320 },

  toastWrap: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: 20, paddingHorizontal: 16 },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: P.ink, borderRadius: KarateRadius.md, paddingVertical: 12, paddingHorizontal: 16, maxWidth: 480, ...KarateShadows.card },
  toastText: { flex: 1, fontSize: 12.5, color: "#fdf8f2", fontWeight: "600" },
  toastUndo: { fontSize: 12.5, fontWeight: "800", color: "#f4d9a0" },
});
