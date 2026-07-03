// ============================================================
// AURA STUDIO · StudioOnboarding (Onda 2 — checklist-herói)
//
// Checklist-herói inline que guia o usuário na CONFIGURAÇÃO da loja:
//   1) Cadastrar um insumo  → /studio/insumos?action=novo-insumo
//   2) Montar ficha técnica → /studio/estoque (catálogo)
//   3) Publicar um produto  → /studio/estoque?action=novo-produto
//
// Status lido SEMPRE do endpoint fresco (Agente B):
//   GET /companies/:id/studio/onboarding-status
//   → { temInsumo, temFicha, temProduto, temVenda }
//
// Comportamento:
//   - Barra de progresso real ("X de 3 prontos")
//   - Próximo passo pendente recebe destaque navy (ring + CTA primário)
//   - temVenda=true: não renderiza NADA (nem conclusão)
//   - Config completa e temVenda=false: card discreto de conclusão
//     ("Tudo pronto para vender 🎉") com CTA pro PDV + botão "Ocultar"
//   - "Ocultar" persiste em StudioSettings.onboarding.setup_done_dismissed;
//     fallback: se a leitura/gravação do settings falhar, esconde só
//     na sessão (estado local), sem quebrar
//   - reduceMotion: animação de progresso desativada
//   - Multi-CNPJ: status e settings são por empresa (cid do contexto)
//
// 02/06/2026 — Agente F, Onda 2, feat/studio-shell-clareza
// 05/06/2026 — fix: silenciar AbortError no catch do fetchStatus
// 03/07/2026 — Racional novo: venda é resultado, não tarefa —
//   checklist só cobra configuração (insumo, ficha, produto).
//   "Fazer a 1ª venda" saiu das pendências e do progresso; virou
//   card de conclusão dismissível. onComplete passa a disparar
//   quando a configuração está completa (ou já existe venda),
//   não mais apenas com a 1ª venda. Par backend: Aura-backend#300
//   (temVenda conta venda de qualquer fonte).
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

// ─── Definição dos passos de CONFIGURAÇÃO ────────────────────
// 03/07/2026: venda é resultado, não tarefa — checklist só cobra
// configuração. O antigo passo 4 ("Fazer a 1ª venda") saiu daqui.
type ChecklistStep = {
  id: keyof OnboardingStatus;
  num: 1 | 2 | 3;
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
];

const TOTAL = STEPS.length;

// Chave em StudioSettings.onboarding que persiste o "Ocultar"
// do card de conclusão (por empresa).
const DISMISS_KEY = "setup_done_dismissed";

// ─── Props públicas ──────────────────────────────────────────
export type StudioOnboardingProps = {
  /** Quando true, renderiza nada (já superado). */
  visible?: boolean;
  /**
   * Callback chamado quando a configuração está completa
   * (insumo + ficha + produto) OU quando já existe venda.
   * O painel usa isso pra tirar os KPIs do modo discreto.
   * (03/07/2026: antes só disparava com temVenda=true.)
   */
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
      // Config completa (ou venda já existente) → painel sai do modo discreto
      const configDone = data.temInsumo && data.temFicha && data.temProduto;
      if (configDone || data.temVenda) onComplete?.();
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.code === 20) return; // fetch abortado — normal no desmonte
      setError("Não foi possível carregar o progresso.");
      console.error("[StudioOnboarding] fetchStatus:", err);
    } finally {
      setLoading(false);
    }
  }, [cid, onComplete]);

  // Refetch no mount (nunca confia no JWT)
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ─── "Ocultar" persistido em StudioSettings.onboarding ────
  // dismissed: card de conclusão ocultado (persistido ou só sessão)
  // settingsChecked: leitura inicial resolvida (evita flash do card
  // de conclusão antes de saber se já foi ocultado)
  const [dismissed, setDismissed] = useState(false);
  const [settingsChecked, setSettingsChecked] = useState(false);

  useEffect(() => {
    if (!cid) return;
    let mounted = true;
    studioApi
      .getSettings(cid)
      .then(({ settings }) => {
        if (!mounted) return;
        if (settings?.onboarding?.[DISMISS_KEY]) setDismissed(true);
      })
      .catch((err: any) => {
        // Fallback: sem settings, o "Ocultar" vale só na sessão
        console.warn("[StudioOnboarding] getSettings:", err?.message || err);
      })
      .finally(() => {
        if (mounted) setSettingsChecked(true);
      });
    return () => { mounted = false; };
  }, [cid]);

  const handleDismiss = useCallback(async () => {
    // Otimista: some imediatamente (pelo menos nesta sessão)
    setDismissed(true);
    if (!cid) return;
    try {
      // Lê o settings atual pra não sobrescrever outras flags de onboarding
      const { settings } = await studioApi.getSettings(cid);
      await studioApi.saveSettings(cid, {
        onboarding: { ...(settings?.onboarding || {}), [DISMISS_KEY]: true },
      });
    } catch (err: any) {
      // Fallback: persistência falhou — fica oculto só nesta sessão
      console.warn("[StudioOnboarding] handleDismiss:", err?.message || err);
    }
  }, [cid]);

  // ─── reduceMotion ─────────────────────────────────────────
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    return () => { mounted = false; };
  }, []);

  // ─── Barra de progresso animada (só passos de config) ─────
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

  // ─── Decisão de renderização (racional 03/07/2026) ────────
  // temVenda=true → nada (nem conclusão). Config completa e sem
  // venda → card discreto de conclusão (a menos que ocultado).
  // Config pendente → checklist normal (só tarefas de config).
  if (!visible) return null;
  if (!loading && status.temVenda) return null;

  const configDone =
    status.temInsumo && status.temFicha && status.temProduto;

  if (!loading && !error && configDone) {
    // Conclusão ocultada (persistida ou nesta sessão) → nada.
    // Antes de resolver a leitura do settings, também nada (anti-flash).
    if (dismissed || !settingsChecked) return null;

    return (
      <View style={s.doneCard}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.doneTitle}>Tudo pronto para vender 🎉</Text>
          <Text style={s.doneText}>
            Sua loja está configurada. Registre vendas pelo PDV ou divulgue
            sua Loja Online.
          </Text>
        </View>
        <View style={s.doneActions}>
          <Pressable
            onPress={() => router.push("/studio/vendas/caixa" as any)}
            style={s.donePdvBtn}
            accessibilityLabel="Abrir PDV"
          >
            <Text style={s.donePdvBtnTxt}>Abrir PDV</Text>
            <Icon name="arrow-right" size={11} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleDismiss}
            style={s.doneDismissBtn}
            accessibilityLabel="Ocultar"
          >
            <Text style={s.doneDismissTxt}>Ocultar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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

      {/* Lista de passos (só configuração — venda não é pendência) */}
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
          {[1, 2, 3].map((i) => (
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

    // ── Card de conclusão (03/07/2026) ──
    // Discreto de propósito: 1 linha, sem barra de progresso,
    // sem lista — a configuração acabou, venda é resultado.
    doneCard: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 12,
      backgroundColor: t.paperCard,
      borderRadius: StudioRadiusV2.xl as number,
      borderWidth: 1,
      borderColor: t.ink5,
      paddingHorizontal: 18,
      paddingVertical: 14,
      marginBottom: 18,
    },
    doneTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: t.ink,
      letterSpacing: -0.2,
    },
    doneText: {
      fontSize: 12,
      color: t.ink3,
      marginTop: 3,
      lineHeight: 17,
    },
    doneActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
    },
    donePdvBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: t.primary,
    },
    donePdvBtnTxt: {
      fontSize: 12,
      fontWeight: "700",
      color: "#fff",
    },
    doneDismissBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: "transparent",
    },
    doneDismissTxt: {
      fontSize: 12,
      fontWeight: "700",
      color: t.ink3,
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
