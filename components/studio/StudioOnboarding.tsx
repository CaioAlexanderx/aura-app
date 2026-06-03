// ============================================================
// AURA STUDIO · StudioOnboarding (Onda 2 — checklist-herói)
//
// Substitui o banner/tour modal por um checklist-herói inline que
// guia o usuário de zero até a primeira venda:
//   1) Cadastrar um insumo  → /studio/insumos?action=novo-insumo
//   2) Montar ficha técnica → /studio/estoque (catálogo)
//   3) Publicar um produto  → /studio/estoque?action=novo-produto
//   4) Fazer a 1ª venda     → /studio/vendas/caixa
//
// Status lido SEMPRE do endpoint fresco (Agente B):
//   GET /companies/:id/studio/onboarding-status
//   → { temInsumo, temFicha, temProduto, temVenda }
//
// Comportamento:
//   - Barra de progresso real ("X de 4 prontos")
//   - Próximo passo pendente recebe destaque navy (ring + CTA primário)
//   - Quando todos os 4 done (ou temVenda=true): some silenciosamente
//   - reduceMotion: animação de progresso desativada
//   - Multi-CNPJ: status é por empresa (cid do contexto)
//
// 02/06/2026 — Agente F, Onda 2, feat/studio-shell-clareza
// ============================================================
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  AccessibilityInfo,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { StudioRadiusV2 } from "@/constants/studio-tokens-v2";
import { Icon } from "@/components/Icon";
import { studioApi } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import type { StudioPalette } from "@/constants/studio-tokens";

// ─── Tipo do status retornado pelo endpoint ──────────────────
export type OnboardingStatus = {
  temInsumo: boolean;
  temFicha: boolean;
  temProduto: boolean;
  temVenda: boolean;
};

const EMPTY_STATUS: OnboardingStatus = {
  temInsumo: false,
  temFicha: false,
  temProduto: false,
  temVenda: false,
};

// ─── Definição dos 4 passos ──────────────────────────────────
type ChecklistStep = {
  id: keyof OnboardingStatus;
  num: 1 | 2 | 3 | 4;
  title: string;
  why: string;  // "o porquê" — 1 linha
  cta: string;
  href: string;
};

const STEPS: ChecklistStep[] = [
  {
    id: "temInsumo",
    num: 1,
    title: "Cadastrar um insumo",
    why: "É o que você consome de verdade — papel, tinta, embalagem.",
    cta: "Cadastrar insumo",
    href: "/studio/insumos?action=novo-insumo",
  },
  {
    id: "temFicha",
    num: 2,
    title: "Montar a ficha técnica",
    why: "Junta os insumos no produto — o Studio calcula seu custo.",
    cta: "Abrir catálogo",
    href: "/studio/estoque",
  },
  {
    id: "temProduto",
    num: 3,
    title: "Publicar um produto",
    why: "Com a ficha pronta, sua margem aparece automática.",
    cta: "Novo produto",
    href: "/studio/estoque?action=novo-produto",
  },
  {
    id: "temVenda",
    num: 4,
    title: "Fazer a 1ª venda",
    why: "Abra o PDV e venda em 1 toque.",
    cta: "Abrir caixa",
    href: "/studio/vendas/caixa",
  },
];

const TOTAL = STEPS.length;

// ─── Props públicas ──────────────────────────────────────────
export type StudioOnboardingProps = {
  /** Quando true, renderiza nada (já superado). */
  visible?: boolean;
  /** Callback chamado quando temVenda=true (checklist completo). */
  onComplete?: () => void;
};

export function StudioOnboarding({
  visible = true,
  onComplete,
}: StudioOnboardingProps) {
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const router = useRouter();

  const auth = useAuthStore();
  const cid = (auth.company as any)?.id as string | undefined;

  // ─── Status fresco do endpoint ────────────────────────────
  const [status, setStatus] = useState<OnboardingStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    setError(null);
    try {
      const data = await studioApi.getOnboardingStatus(cid);
      setStatus(data);
      if (data.temVenda) onComplete?.();
    } catch (err: any) {
      console.error("[StudioOnboarding] fetchStatus:", err);
      setError("Não foi possível carregar o progresso.");
    } finally {
      setLoading(false);
    }
  }, [cid, onComplete]);

  // Refetch no mount (nunca confia no JWT)
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ─── reduceMotion ─────────────────────────────────────────
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    return () => { mounted = false; };
  }, []);

  // ─── Barra de progresso animada ───────────────────────────
  const doneCount = useMemo(
    () => STEPS.filter((step) => status[step.id]).length,
    [status]
  );
  const progressPct = doneCount / TOTAL;

  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      progressAnim.setValue(progressPct);
      return;
    }
    Animated.timing(progressAnim, {
      toValue: progressPct,
      duration: 450,
      useNativeDriver: false, // width não suporta native driver
    }).start();
  }, [progressPct, reduceMotion, progressAnim]);

  // ─── Próximo passo pendente ───────────────────────────────
  const nextStep = useMemo(
    () => STEPS.find((step) => !status[step.id]) ?? null,
    [status]
  );

  // ─── Ocultar quando completo ──────────────────────────────
  if (!visible) return null;
  if (!loading && status.temVenda) return null;

  return (
    <View style={s.card}>
      {/* Cabeçalho */}
      <View style={s.cardHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.eyebrow}>CONFIGURAÇÃO</Text>
          <Text style={s.cardTitle}>Primeiros passos</Text>
          <Text style={s.cardSub}>
            {loading
              ? "Verificando seu progresso..."
              : error
              ? error
              : doneCount === TOTAL
              ? "Tudo pronto! ✓"
              : `${doneCount} de ${TOTAL} prontos`}
          </Text>
        </View>

        {/* Botão recarregar em caso de erro */}
        {error && !loading && (
          <Pressable
            onPress={fetchStatus}
            style={s.retryBtn}
            accessibilityLabel="Tentar novamente"
          >
            <Icon name="refresh-cw" size={14} color={t.primary} />
          </Pressable>
        )}

        {loading && (
          <ActivityIndicator size="small" color={t.accent} />
        )}
      </View>

      {/* Barra de progresso */}
      <View style={s.progressTrack}>
        <Animated.View
          style={[
            s.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>

      {/* Lista de passos */}
      {!loading && !error && (
        <View style={s.stepsList}>
          {STEPS.map((step) => {
            const done = status[step.id];
            const isNext = step.id === nextStep?.id;

            return (
              <View
                key={step.id}
                style={[
                  s.stepRow,
                  done && s.stepRowDone,
                  isNext && s.stepRowNext,
                ]}
              >
                {/* Número / Check */}
                <View
                  style={[
                    s.stepBadge,
                    done && s.stepBadgeDone,
                    isNext && s.stepBadgeNext,
                  ]}
                >
                  {done ? (
                    <Icon name="check" size={12} color="#fff" />
                  ) : (
                    <Text
                      style={[
                        s.stepNum,
                        isNext && s.stepNumNext,
                      ]}
                    >
                      {step.num}
                    </Text>
                  )}
                </View>

                {/* Texto */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      s.stepTitle,
                      done && s.stepTitleDone,
                    ]}
                    numberOfLines={1}
                  >
                    {step.title}
                  </Text>
                  <Text style={s.stepWhy} numberOfLines={2}>
                    {done ? "Concluído" : step.why}
                  </Text>
                </View>

                {/* CTA (apenas não concluídos) */}
                {!done && (
                  <Pressable
                    onPress={() => router.push(step.href as any)}
                    style={[
                      s.stepCta,
                      isNext && s.stepCtaNext,
                    ]}
                    accessibilityLabel={step.cta}
                  >
                    <Text
                      style={[
                        s.stepCtaTxt,
                        isNext && s.stepCtaTxtNext,
                      ]}
                    >
                      {step.cta}
                    </Text>
                    <Icon
                      name="arrow-right"
                      size={11}
                      color={isNext ? "#fff" : t.primary}
                    />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Skeleton (loading) */}
      {loading && (
        <View style={s.skeletonWrap}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={s.skeletonRow}>
              <View style={s.skeletonCircle} />
              <View style={{ flex: 1, gap: 5 }}>
                <View style={[s.skeletonLine, { width: "60%" }]} />
                <View style={[s.skeletonLine, { width: "85%", opacity: 0.5 }]} />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default StudioOnboarding;

// ─── Styles ─────────────────────────────────────────────────
const buildStyles = (t: StudioPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.paperCard,
      borderRadius: StudioRadiusV2.xl as number,
      borderWidth: 1,
      borderColor: t.ink5,
      padding: 20,
      marginBottom: 18,
      ...(Platform.OS === "web"
        ? ({ boxShadow: "0 2px 12px rgba(15,23,42,0.06)" } as any)
        : null),
    },

    // ── Header ──
    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 14,
    },
    eyebrow: {
      fontSize: 10,
      color: t.accent,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 3,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: t.ink,
      letterSpacing: -0.2,
    },
    cardSub: {
      fontSize: 12,
      color: t.ink3,
      marginTop: 3,
    },
    retryBtn: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: t.bgSoft,
    },

    // ── Barra de progresso ──
    progressTrack: {
      height: 6,
      backgroundColor: t.bgSoft,
      borderRadius: 999,
      overflow: "hidden",
      marginBottom: 18,
    },
    progressFill: {
      height: "100%",
      backgroundColor: t.primary,
      borderRadius: 999,
    },

    // ── Passos ──
    stepsList: { gap: 8 },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: t.bgSoft,
    },
    stepRowDone: {
      opacity: 0.6,
    },
    stepRowNext: {
      backgroundColor: t.paperCardElev,
      borderWidth: 2,
      borderColor: t.primary,
    },

    // Badge (número ou check)
    stepBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.ink5,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    stepBadgeDone: {
      backgroundColor: t.success ?? "#10B981",
    },
    stepBadgeNext: {
      backgroundColor: t.primary,
    },
    stepNum: {
      fontSize: 12,
      fontWeight: "800",
      color: t.ink3,
    },
    stepNumNext: {
      color: "#fff",
    },

    // Textos
    stepTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: t.ink,
    },
    stepTitleDone: {
      textDecorationLine: "line-through",
      color: t.ink4,
    },
    stepWhy: {
      fontSize: 11.5,
      color: t.ink3,
      marginTop: 2,
      lineHeight: 16,
    },

    // CTAs
    stepCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: t.primary,
      backgroundColor: "transparent",
      flexShrink: 0,
    },
    stepCtaNext: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    stepCtaTxt: {
      fontSize: 12,
      fontWeight: "700",
      color: t.primary,
    },
    stepCtaTxtNext: {
      color: "#fff",
    },

    // ── Skeleton ──
    skeletonWrap: { gap: 10 },
    skeletonRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: t.bgSoft,
    },
    skeletonCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.ink5,
    },
    skeletonLine: {
      height: 11,
      borderRadius: 6,
      backgroundColor: t.ink5,
    },
  });
