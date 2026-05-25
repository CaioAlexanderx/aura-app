// ============================================================
// AURA STUDIO · StudioWorkflow (wrapper canônico de wizards)
//
// Aplicar SÓ em features Studio-específicas (NÃO em listagens, home,
// gestão genérica). Ver BACKLOG_AURA_STUDIO.md seção "Workflow-first".
//
// Features que usam:
//   - Fase 1: Configurar produto personalizável (4 passos)
//   - Fase 2: Subir template galeria (4 passos)
//   - Fase 5: Solicitar aprovação de arte via wa.me (3 passos)
//   - Fase 6: Criar pedido em massa pra evento (5 passos)
//
// Features que NÃO usam:
//   - Home /studio (dashboard playful)
//   - Listagens (produtos, pedidos, galeria, insumos)
//   - Gestão (Financeiro, NF-e, Contabilidade)
// ============================================================
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";

type Props = {
  title: string;
  steps: string[];               // ex: ["Área", "Campos", "Preview", "Salvar"]
  current: number;               // 1-based index
  onBack?: () => void;
  onNext?: () => void;
  onConcluir?: () => Promise<void> | void;
  primaryCta?: string;           // "Continuar" no meio, "Concluir" no fim
  primaryDisabled?: boolean;
  draftKey?: string;             // se setado, salva o draft passado em saveDraft()
  draft?: any;                   // payload pra persistir em cada passo
  onDraftRestored?: (draft: any) => void; // chamado se houver draft salvo
  children: React.ReactNode;
};

const DRAFT_PREFIX = "studio_workflow_draft__";

export function StudioWorkflow({
  title, steps, current,
  onBack, onNext, onConcluir,
  primaryCta, primaryDisabled,
  draftKey, draft, onDraftRestored,
  children,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const total = steps.length;
  const isLast = current >= total;
  const ctaLabel = primaryCta || (isLast ? "Concluir" : "Continuar");

  // ─── Auto-save draft ───────────────────────────────────────
  useEffect(() => {
    if (!draftKey || draft === undefined) return;
    AsyncStorage.setItem(DRAFT_PREFIX + draftKey, JSON.stringify(draft)).catch(() => {});
  }, [draftKey, draft]);

  // ─── Restaurar draft no mount ──────────────────────────────
  useEffect(() => {
    if (!draftKey || !onDraftRestored) return;
    AsyncStorage.getItem(DRAFT_PREFIX + draftKey).then((raw) => {
      if (raw) {
        try { onDraftRestored(JSON.parse(raw)); } catch (_) {}
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const clearDraft = useCallback(() => {
    if (!draftKey) return;
    AsyncStorage.removeItem(DRAFT_PREFIX + draftKey).catch(() => {});
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
      {/* ───── Header ───── */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>
            Passo {Math.min(current, total)} de {total} · {steps[current - 1] || ""}
          </Text>
          <Text style={s.title}>{title}</Text>
        </View>
        {draftKey && (
          <View style={s.draftChip}>
            <View style={s.draftDot} />
            <Text style={s.draftTxt}>Salvando rascunho</Text>
          </View>
        )}
      </View>

      {/* ───── Stepper ───── */}
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
                style={[s.stepLabel, (active || done) && { color: StudioColors.ink2, fontWeight: "600" }]}
                numberOfLines={1}
              >
                {label}
              </Text>
              {i < steps.length - 1 && <View style={[s.stepSep, done && { backgroundColor: StudioColors.accentSoft }]} />}
            </View>
          );
        })}
      </View>

      {/* ───── Conteúdo ───── */}
      <ScrollView style={s.body} contentContainerStyle={{ padding: 24, paddingBottom: 8 }}>
        {children}
      </ScrollView>

      {/* ───── Footer ───── */}
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
            isLast && { backgroundColor: StudioColors.mint },
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

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: StudioColors.bg },
  header: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 24, paddingTop: 22, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: StudioColors.ink5,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11, color: StudioColors.accent, fontWeight: "800",
    letterSpacing: 0.8, textTransform: "uppercase",
  },
  title: { fontSize: 22, fontWeight: "800", color: StudioColors.ink, marginTop: 4, letterSpacing: -0.3 },
  draftChip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: StudioColors.mintSoft,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999,
  },
  draftDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: StudioColors.mint,
  },
  draftTxt: { fontSize: 11, color: "#065F46", fontWeight: "700" },

  stepper: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 24, paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 1, borderBottomColor: StudioColors.ink5,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2, borderColor: StudioColors.ink4,
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: StudioColors.primary, borderColor: StudioColors.primary },
  stepDotDone: { backgroundColor: StudioColors.mint, borderColor: StudioColors.mint },
  stepDotTxt: { fontSize: 11, fontWeight: "800", color: StudioColors.ink3 },
  stepLabel: { fontSize: 12, color: StudioColors.ink3 },
  stepSep: {
    width: 28, height: 1.5, backgroundColor: StudioColors.ink5,
    marginHorizontal: 4,
  },

  body: { flex: 1 },

  footer: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: StudioColors.ink5,
    backgroundColor: "#fff",
    gap: 12,
  },
  btnPri: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: StudioColors.primary,
    paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12,
    minWidth: 160, justifyContent: "center",
  },
  btnPriTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnSec: {
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12,
    borderWidth: 1.5, borderColor: StudioColors.ink5,
    backgroundColor: "#fff",
  },
  btnSecTxt: { color: StudioColors.ink2, fontSize: 13, fontWeight: "600" },
});

export default StudioWorkflow;
