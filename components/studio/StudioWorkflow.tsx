// ============================================================
// AURA STUDIO · StudioWorkflow (wrapper canônico de wizards)
//
// 25/05 hotfix: removida dep @react-native-async-storage/async-storage
//               que não estava no package.json (build CF Pages quebrava).
//               Substituído por draftStore: localStorage no web,
//               no-op no mobile (rascunho é só conveniência, não crítico).
//
// Aplicar SÓ em features Studio-específicas (NÃO em listagens, home,
// gestão genérica). Ver BACKLOG_AURA_STUDIO.md seção "Workflow-first".
// ============================================================
import { useMemo, useEffect, useState, useCallback } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator, Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { type StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";

type Props = {
  title: string;
  steps: string[];
  current: number;
  onBack?: () => void;
  onNext?: () => void;
  onConcluir?: () => Promise<void> | void;
  primaryCta?: string;
  primaryDisabled?: boolean;
  draftKey?: string;
  draft?: any;
  onDraftRestored?: (draft: any) => void;
  children: React.ReactNode;
};

const DRAFT_PREFIX = "studio_workflow_draft__";

// ─── Storage helper sem dep externa ──────────────────────────
// Web: localStorage. Mobile: no-op (drafts são opcionais).
// Tudo encapsulado pra não quebrar SSR/build se window/localStorage ausentes.
const draftStore = {
  setItem(key: string, value: string): void {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (_) { /* quota / privacy mode → ignora */ }
  },
  getItem(key: string): string | null {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (_) {}
    return null;
  },
  removeItem(key: string): void {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (_) {}
  },
};

export function StudioWorkflow({
  title, steps, current,
  onBack, onNext, onConcluir,
  primaryCta, primaryDisabled,
  draftKey, draft, onDraftRestored,
  children,
}: Props) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const [submitting, setSubmitting] = useState(false);
  const total = steps.length;
  const isLast = current >= total;
  const ctaLabel = primaryCta || (isLast ? "Concluir" : "Continuar");

  // ─── Auto-save draft ───────────────────────────────────────
  useEffect(() => {
    if (!draftKey || draft === undefined) return;
    draftStore.setItem(DRAFT_PREFIX + draftKey, JSON.stringify(draft));
  }, [draftKey, draft]);

  // ─── Restaurar draft no mount ──────────────────────────────
  useEffect(() => {
    if (!draftKey || !onDraftRestored) return;
    const raw = draftStore.getItem(DRAFT_PREFIX + draftKey);
    if (raw) {
      try { onDraftRestored(JSON.parse(raw)); } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    if (!draftKey) return;
    draftStore.removeItem(DRAFT_PREFIX + draftKey);
  }, [draftKey]);

  async function handlePrimary() {
    if (isLast && onConcluir) {
      setSubmitting(true);
      try {
        await onConcluir();
        clearDraft();
      } finally {
        setSubmitting(false);
      }
    } else if (onNext) {
      onNext();
    }
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>
            Passo {Math.min(current, total)} de {total} · {steps[current - 1] || ""}
          </Text>
          <Text style={s.title}>{title}</Text>
        </View>
        {draftKey && Platform.OS === "web" && (
          <View style={s.draftChip}>
            <View style={s.draftDot} />
            <Text style={s.draftTxt}>Salvando rascunho</Text>
          </View>
        )}
      </View>

      <View style={s.stepper}>
        {steps.map((label, i) => {
          const idx = i + 1;
          const done = idx < current;
          const active = idx === current;
          return (
            <View key={label} style={s.stepItem}>
              <View
                style={[
                  s.stepDot,
                  done && s.stepDotDone,
                  active && s.stepDotActive,
                ]}
              >
                {done
                  ? <Icon name="check" size={11} color="#fff" />
                  : <Text style={[s.stepDotTxt, active && { color: "#fff" }]}>{idx}</Text>}
              </View>
              <Text
                style={[s.stepLabel, (active || done) && { color: t.ink2, fontWeight: "600" }]}
                numberOfLines={1}
              >
                {label}
              </Text>
              {i < steps.length - 1 && <View style={[s.stepSep, done && { backgroundColor: t.accentSoft }]} />}
            </View>
          );
        })}
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ padding: 24, paddingBottom: 8 }}>
        {children}
      </ScrollView>

      <View style={s.footer}>
        {current > 1 && onBack ? (
          <Pressable style={s.btnSec} onPress={onBack}>
            <Text style={s.btnSecTxt}>← Voltar</Text>
          </Pressable>
        ) : <View />}

        <Pressable
          style={[
            s.btnPri,
            primaryDisabled && { opacity: 0.45 },
            isLast && { backgroundColor: t.mint },
          ]}
          onPress={handlePrimary}
          disabled={primaryDisabled || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              {isLast && <Icon name="check" size={14} color="#fff" />}
              <Text style={s.btnPriTxt}>{ctaLabel}</Text>
              {!isLast && <Text style={s.btnPriTxt}> →</Text>}
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: t.bg },
  header: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 24, paddingTop: 22, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: t.ink5,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11, color: t.accent, fontWeight: "800",
    letterSpacing: 0.8, textTransform: "uppercase",
  },
  title: { fontSize: 22, fontWeight: "800", color: t.ink, marginTop: 4, letterSpacing: -0.3 },
  draftChip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: t.mintSoft,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999,
  },
  draftDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: t.mint,
  },
  draftTxt: { fontSize: 11, color: "#065F46", fontWeight: "700" },

  stepper: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 24, paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 1, borderBottomColor: t.ink5,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: t.paperCardElev,
    borderWidth: 2, borderColor: t.ink4,
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: t.primary, borderColor: t.primary },
  stepDotDone: { backgroundColor: t.mint, borderColor: t.mint },
  stepDotTxt: { fontSize: 11, fontWeight: "800", color: t.ink3 },
  stepLabel: { fontSize: 12, color: t.ink3 },
  stepSep: {
    width: 28, height: 1.5, backgroundColor: t.ink5,
    marginHorizontal: 4,
  },

  body: { flex: 1 },

  footer: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: t.ink5,
    backgroundColor: t.paperCardElev,
    gap: 12,
  },
  btnPri: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: t.primary,
    paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12,
    minWidth: 160, justifyContent: "center",
  },
  btnPriTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnSec: {
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12,
    borderWidth: 1.5, borderColor: t.ink5,
    backgroundColor: t.paperCardElev,
  },
  btnSecTxt: { color: t.ink2, fontSize: 13, fontWeight: "600" },
});

export default StudioWorkflow;
