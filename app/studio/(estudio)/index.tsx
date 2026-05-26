// ============================================================
// AURA STUDIO . Home (Fase 0) - overhaul 26/05
//
// 26/05/2026 - Guia do Estudio:
//   Substitui checklist estatico antigo por GUIA DO ESTUDIO com 5 passos
//   verificaveis via API real (nao mais via settings.onboarding flags):
//     1. Cadastre seus produtos        -> GET /products limit=1
//     2. Configure personalizacao      -> ao menos 1 produto com is_personalizable + customization_config nao-vazio
//     3. Suba templates de arte        -> studioApi.listTemplates >= 3
//     4. Defina SLA e WhatsApp         -> settings.default_sla_days E approval_wa_phone preenchidos
//     5. Publique a Loja Digital       -> digital_channel_config.is_published === true
//
//   Card grande no TOPO (entre greeting e KPIs), expansivel, com progress bar.
//   Esconde quando 5/5 OU lojista clica "Ja configurei tudo" (persiste
//   studio_settings.guide_dismissed = true via studioApi.saveSettings).
//
// Estrutura final:
//   1. Greeting + Live badge
//   2. GUIA DO ESTUDIO (novo - topo)
//   3. KPIs em cards
//   4. Banner "X produtos podem melhorar" (Fase 9 residual)
//   5. Hint
// ============================================================
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { studioApi, type StudioMetrics, type StudioSettings } from "@/services/studioApi";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { AnimatedKpiCounter } from "@/components/studio/AnimatedKpiCounter";
import { calculateProductScore, type Product as ScoreProduct } from "@/components/studio/ProductQualityScore";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";

type StudioPalette = ReturnType<typeof useStudioTokens>;

// ─── Guia steps (estaticos) ────────────────────────────────────────────────
type GuideStepStatus = "done" | "in_progress" | "todo";

type GuideStep = {
  id: "products" | "customization" | "templates" | "sla_wa" | "publish";
  num: number;
  icon: string;
  title: string;
  helper: string;
  cta: string;
  href: string;
};

const GUIDE_STEPS: GuideStep[] = [
  {
    id: "products",
    num: 1,
    icon: "shopping-bag",
    title: "Cadastre seus produtos",
    helper: "Camisetas, canecas, quadros - o que voce vende personalizado",
    cta: "Cadastrar produto",
    href: "/studio/produtos",
  },
  {
    id: "customization",
    num: 2,
    icon: "edit-3",
    title: "Configure a personalizacao",
    helper: "Defina area de impressao, campos (texto/imagem/cor) e opcoes pro cliente",
    cta: "Configurar",
    href: "/studio/produtos",
  },
  {
    id: "templates",
    num: 3,
    icon: "image",
    title: "Suba templates de arte",
    helper: "Adicione pelo menos 3 templates pro cliente escolher na compra (Dia das Maes, Pais, profissoes)",
    cta: "Subir templates",
    href: "/studio/galeria",
  },
  {
    id: "sla_wa",
    num: 4,
    icon: "clock",
    title: "Defina SLA e WhatsApp",
    helper: "Prazo de producao + telefone que envia mockup pro cliente aprovar",
    cta: "Configurar",
    href: "/studio/configuracoes",
  },
  {
    id: "publish",
    num: 5,
    icon: "globe",
    title: "Publique a Loja Digital",
    helper: "Sua vitrine online com link compartilhavel - cliente compra direto sem voce intermediar",
    cta: "Configurar",
    href: "/canal-digital",
  },
];

function formatBRL(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  try {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } catch {
    return "R$ " + Math.round(v);
  }
}
function fmtCurrency(n: number): string { return formatBRL(n); }
function fmtInteger(n: number): string {
  if (n == null || isNaN(n)) return "—";
  return Math.round(n).toLocaleString("pt-BR");
}

export default function StudioHome() {
  const router = useRouter();
  const { company, user } = useAuthStore();
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);

  // Digital channel (passo 5 do guia)
  const { config: digitalConfig } = useDigitalChannel();

  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metrics, setMetrics] = useState<StudioMetrics | null>(null);
  const [productsToImprove, setProductsToImprove] = useState(0);

  // Guia do Estudio - estado por passo
  const [guideLoading, setGuideLoading] = useState(true);
  const [guideExpanded, setGuideExpanded] = useState(true);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [stepStatus, setStepStatus] = useState<Record<GuideStep["id"], GuideStepStatus>>({
    products: "todo",
    customization: "todo",
    templates: "todo",
    sla_wa: "todo",
    publish: "todo",
  });
  const [expandedStep, setExpandedStep] = useState<GuideStep["id"] | null>(null);
  const [dismissing, setDismissing] = useState(false);

  // ─── KPIs (metrics reais) ───────────────────────────────────────────────
  useEffect(() => {
    if (!company?.id) return;
    studioApi.getMetrics(company.id, 7)
      .then((m) => setMetrics(m))
      .catch((err) => {
        console.error("[StudioHome] getMetrics:", err);
        setMetrics(null);
      })
      .finally(() => setMetricsLoading(false));
  }, [company?.id]);

  // ─── Produtos pra melhorar (Fase 9) ─────────────────────────────────────
  useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await request<any>(
          "/companies/" + company.id + "/products?limit=500",
          { method: "GET", retry: 1, timeout: 10000 }
        );
        const list: any[] = Array.isArray(data)
          ? data
          : (data?.products || data?.items || []);
        const personalizables = list.filter(
          (p) => p && p.is_personalizable && !p.isHydrating
        );
        const toImprove = personalizables.reduce((acc, p) => {
          try {
            const { score } = calculateProductScore(p as ScoreProduct);
            return score < 75 ? acc + 1 : acc;
          } catch {
            return acc;
          }
        }, 0);
        if (!cancelled) setProductsToImprove(toImprove);
      } catch (err) {
        console.error("[StudioHome] productsToImprove:", err);
        if (!cancelled) setProductsToImprove(0);
      }
    })();
    return () => { cancelled = true; };
  }, [company?.id]);

  // ─── Guia do Estudio - deteccao de progresso ─────────────────────────────
  // 5 fetches em paralelo (Promise.allSettled pra falhar gracioso)
  const runGuideDetection = useCallback(async () => {
    if (!company?.id) return;
    setGuideLoading(true);
    const cid = company.id;
    try {
      const [productsRes, settingsRes, templatesRes] = await Promise.allSettled([
        request<any>("/companies/" + cid + "/products?limit=500", { method: "GET", retry: 1, timeout: 10000 }),
        studioApi.getSettings(cid),
        studioApi.listTemplates(cid, { limit: 10 }),
      ]);

      // Lista de produtos (usada nos passos 1 e 2)
      let productList: any[] = [];
      if (productsRes.status === "fulfilled") {
        const data = productsRes.value;
        productList = Array.isArray(data) ? data : (data?.products || data?.items || []);
      }

      // Passo 1: >=1 produto cadastrado
      const products: GuideStepStatus = productList.length >= 1 ? "done" : "todo";

      // Passo 2: algum produto com is_personalizable=true E customization_config nao-vazio
      const personalizables = productList.filter((p) => p && p.is_personalizable);
      const withCfg = personalizables.filter((p) => {
        const cfg = p.customization_config;
        if (!cfg) return false;
        if (typeof cfg === "object") {
          const fields = (cfg as any).fields;
          return Array.isArray(fields) && fields.length > 0;
        }
        return false;
      });
      let customization: GuideStepStatus = "todo";
      if (withCfg.length >= 1 && withCfg.length === personalizables.length && personalizables.length > 0) {
        customization = "done";
      } else if (withCfg.length >= 1) {
        customization = "in_progress";
      } else if (personalizables.length >= 1) {
        customization = "in_progress";
      }

      // Passo 3: >=3 templates na galeria
      let templatesCount = 0;
      if (templatesRes.status === "fulfilled") {
        templatesCount = (templatesRes.value.templates || []).length;
      }
      const templates: GuideStepStatus =
        templatesCount >= 3 ? "done" :
        templatesCount >= 1 ? "in_progress" : "todo";

      // Passo 4: settings.default_sla_days E approval_wa_phone preenchidos
      let slaWa: GuideStepStatus = "todo";
      let dismissed = false;
      if (settingsRes.status === "fulfilled") {
        const st: StudioSettings = settingsRes.value.settings || {};
        const hasSla = !!(st.default_sla_days && st.default_sla_days > 0);
        const hasWa = !!(st.approval_wa_phone && String(st.approval_wa_phone).trim().length > 5);
        if (hasSla && hasWa) slaWa = "done";
        else if (hasSla || hasWa) slaWa = "in_progress";
        dismissed = !!st.guide_dismissed;
      }

      // Passo 5: digital_channel_config.is_published === true
      const publish: GuideStepStatus =
        (digitalConfig && (digitalConfig as any).is_published === true) ? "done" : "todo";

      setStepStatus({ products, customization, templates, sla_wa: slaWa, publish });
      setGuideDismissed(dismissed);
    } catch (err) {
      console.error("[StudioHome] runGuideDetection:", err);
    } finally {
      setGuideLoading(false);
    }
  }, [company?.id, digitalConfig]);

  useEffect(() => { runGuideDetection(); }, [runGuideDetection]);

  const doneCount = useMemo(
    () => Object.values(stepStatus).filter((v) => v === "done").length,
    [stepStatus]
  );
  const allDone = doneCount === GUIDE_STEPS.length;
  const guidePct = Math.round((doneCount / GUIDE_STEPS.length) * 100);

  // Dispensa guia (persiste em settings.guide_dismissed)
  const handleDismissGuide = useCallback(async () => {
    if (!company?.id) return;
    setDismissing(true);
    try {
      await studioApi.saveSettings(company.id, { guide_dismissed: true } as any);
      setGuideDismissed(true);
      toast.success("Guia oculto. Tudo pronto pra operar!");
    } catch (err: any) {
      console.error("[StudioHome] handleDismissGuide:", err);
      toast.error(err?.message || "Erro ao ocultar guia");
    } finally {
      setDismissing(false);
    }
  }, [company?.id]);

  const firstName = (user as any)?.name?.split(" ")[0] || "lojista";

  // KPIs dinamicos
  const kpis = useMemo(() => [
    { label: "Em producao",      value: metrics ? metrics.em_producao : 0,      format: fmtInteger,  icon: "clock",        color: t.warning },
    { label: "Aguardando arte",  value: metrics ? metrics.aguardando_arte : 0,  format: fmtInteger,  icon: "alert-circle", color: t.accent  },
    { label: "Prontos hoje",     value: metrics ? metrics.prontos_hoje : 0,     format: fmtInteger,  icon: "check",        color: t.success },
    { label: "Vendas 7d",        value: metrics ? metrics.revenue_7d : 0,       format: fmtCurrency, icon: "trending-up",  color: t.primary },
  ], [metrics, t]);

  // Guia: esconde se dismissed OU se todos os passos estao done
  const showGuide = !guideDismissed;
  const showCompactCelebrate = showGuide && allDone;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* ───── Greeting ───── */}
      <View style={s.greetingRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>
            Bom dia, <Text style={s.h1Accent}>{firstName}!</Text>
          </Text>
          <Text style={s.h1Sub}>
            {allDone
              ? "Loja redonda. Hora de mostrar produto pro mundo."
              : "Bora deixar a loja redonda pros proximos pedidos"}
          </Text>
        </View>
        <View style={s.liveBadge}>
          <View style={s.livePulse} />
          <Text style={s.liveTxt}>Studio aberto</Text>
        </View>
      </View>

      {/* ═══════ GUIA DO ESTUDIO ═══════ */}
      {showGuide && showCompactCelebrate && (
        <View style={s.guideCompact}>
          <View style={s.guideCompactIcon}>
            <Icon name="check" size={18} color={t.successInk} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.guideCompactTitle}>Tudo configurado!</Text>
            <Text style={s.guideCompactSub}>Loja pronta pra receber pedidos. Bora vender.</Text>
          </View>
          <Pressable
            onPress={handleDismissGuide}
            disabled={dismissing}
            style={s.guideCompactBtn}
          >
            {dismissing
              ? <ActivityIndicator size="small" color={t.ink2} />
              : <Text style={s.guideCompactBtnTxt}>Ocultar</Text>}
          </Pressable>
        </View>
      )}

      {showGuide && !showCompactCelebrate && (
        <View style={s.guideCard}>
          {/* Header */}
          <Pressable onPress={() => setGuideExpanded((v) => !v)} style={s.guideHead}>
            <View style={s.guideHeadIcon}>
              <Icon name="compass" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.guideEyebrow}>GUIA DO ESTUDIO</Text>
              <Text style={s.guideTitle}>Configure tudo em 5 passos pra comecar</Text>
            </View>
            <View style={s.guideProgressPill}>
              <Text style={s.guideProgressPillTxt}>{doneCount}/{GUIDE_STEPS.length} feitos</Text>
            </View>
            <Icon name={guideExpanded ? "chevron-up" : "chevron-down"} size={18} color={t.ink3} />
          </Pressable>

          {/* Progress bar */}
          <View style={s.guideProgressBar}>
            <View style={[s.guideProgressFill, { width: `${guidePct}%` }]} />
          </View>

          {guideLoading && (
            <View style={{ paddingVertical: 22, alignItems: "center" }}>
              <ActivityIndicator size="small" color={t.primary} />
              <Text style={{ marginTop: 8, fontSize: 12, color: t.ink3 }}>Verificando seu progresso...</Text>
            </View>
          )}

          {/* Steps */}
          {!guideLoading && guideExpanded && GUIDE_STEPS.map((step) => {
            const status = stepStatus[step.id];
            const isExpanded = expandedStep === step.id;
            const borderColor =
              status === "done" ? t.success :
              status === "in_progress" ? t.accent :
              t.ink5;

            // Detalhe contextual quando em_progress
            let progressDetail: string | null = null;
            if (step.id === "customization" && status === "in_progress") {
              progressDetail = "Continue configurando os produtos restantes";
            } else if (step.id === "templates" && status === "in_progress") {
              progressDetail = "Adicione mais templates ate chegar a 3";
            } else if (step.id === "sla_wa" && status === "in_progress") {
              progressDetail = "Falta preencher SLA ou WhatsApp";
            }

            return (
              <View key={step.id} style={[s.stepCard, { borderColor }]}>
                <Pressable
                  onPress={() => setExpandedStep(isExpanded ? null : step.id)}
                  style={s.stepHead}
                >
                  {/* Numero + status icon */}
                  <View style={s.stepNumWrap}>
                    <StepStatusIcon status={status} t={t} />
                    <Text style={s.stepNum}>Passo {step.num}</Text>
                  </View>

                  {/* Title + status text inline */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.stepTitle} numberOfLines={1}>{step.title}</Text>
                    <Text style={[s.stepStatusTxt, {
                      color:
                        status === "done" ? t.successInk :
                        status === "in_progress" ? t.accent :
                        t.ink3,
                    }]}>
                      {status === "done" && "feito"}
                      {status === "in_progress" && "em andamento"}
                      {status === "todo" && "nao iniciado"}
                    </Text>
                  </View>

                  <Icon
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={t.ink4}
                  />
                </Pressable>

                {isExpanded && (
                  <View style={s.stepBody}>
                    <Text style={s.stepHelper}>{step.helper}</Text>
                    {progressDetail && (
                      <Text style={s.stepProgressDetail}>{progressDetail}</Text>
                    )}
                    {status !== "done" && (
                      <Pressable
                        onPress={() => router.push(step.href as any)}
                        style={[
                          s.stepCta,
                          { backgroundColor: status === "in_progress" ? t.accent : t.primary },
                        ]}
                      >
                        <Icon name={step.icon as any} size={14} color="#fff" />
                        <Text style={s.stepCtaTxt}>
                          {status === "in_progress" ? "Continuar" : step.cta}
                        </Text>
                      </Pressable>
                    )}
                    {status === "done" && (
                      <View style={s.stepDoneRow}>
                        <Icon name="check" size={14} color={t.successInk} />
                        <Text style={s.stepDoneTxt}>Passo concluido</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Footer - dispensar */}
          {!guideLoading && guideExpanded && (
            <Pressable
              onPress={handleDismissGuide}
              disabled={dismissing}
              style={s.guideDismissBtn}
            >
              {dismissing
                ? <ActivityIndicator size="small" color={t.ink3} />
                : <Text style={s.guideDismissTxt}>Ja configurei tudo, ocultar guia</Text>}
            </Pressable>
          )}
        </View>
      )}

      {/* ───── KPIs ───── */}
      <View style={s.kpisRow}>
        {kpis.map((k) => (
          <View key={k.label} style={s.kpiCard}>
            <View style={[s.kpiBubble, { backgroundColor: k.color }]}>
              <Icon name={k.icon as any} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.kpiLabel}>{k.label}</Text>
              {metricsLoading ? (
                <ActivityIndicator size="small" color={t.ink4} style={{ alignSelf: "flex-start", marginTop: 4 }} />
              ) : (
                <View style={{ alignItems: "flex-start", marginTop: 1 }}>
                  <AnimatedKpiCounter
                    value={k.value}
                    format={k.format}
                    fontSize={18}
                    color={t.ink}
                  />
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* ───── Banner "X produtos podem melhorar" ───── */}
      {productsToImprove > 0 && (
        <View style={s.improveBanner}>
          <View style={s.improveIcon}>
            <Icon name="trending-up" size={18} color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.improveTitleRow}>
              <AnimatedKpiCounter
                value={productsToImprove}
                format={fmtInteger}
                fontSize={14}
                color={t.ink}
              />
              <Text style={s.improveTitle}>
                {" "}produto{productsToImprove > 1 ? "s" : ""} pode{productsToImprove > 1 ? "m" : ""} melhorar
              </Text>
            </View>
            <Text style={s.improveDesc}>
              Adicione fotos, descricao e templates pra subir o score e vender mais.
            </Text>
          </View>
          <Pressable onPress={() => router.push("/studio/produtos" as any)} style={s.improveBtn}>
            <Text style={s.improveBtnTxt}>Melhorar</Text>
          </Pressable>
        </View>
      )}

      {/* ───── Hint ───── */}
      {!allDone && !guideDismissed && (
        <View style={s.hintCard}>
          <Icon name="info" size={16} color={t.primary} />
          <Text style={s.hintTxt}>
            <Text style={s.hintBold}>Dica:</Text> assim que cadastrar produto e
            subir templates, a aba Producao comeca a popular a fila automaticamente.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ═══ helpers ═══════════════════════════════════════════════════════════════
function StepStatusIcon({ status, t }: { status: GuideStepStatus; t: StudioPalette }) {
  if (status === "done") {
    return (
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: t.success,
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon name="check" size={12} color="#fff" />
      </View>
    );
  }
  if (status === "in_progress") {
    return (
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: t.accentSoft,
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon name="clock" size={12} color={t.accent} />
      </View>
    );
  }
  return (
    <View style={{
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 1.5, borderColor: t.ink4,
      alignItems: "center", justifyContent: "center",
    }} />
  );
}

function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: t.bg },
    container: { padding: 28, paddingBottom: 60, maxWidth: 1100, alignSelf: "center", width: "100%" },

    // greeting
    greetingRow: {
      flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
      marginBottom: 22, gap: 16, flexWrap: "wrap",
    },
    h1: { fontSize: 28, fontWeight: "800", color: t.ink, letterSpacing: -0.5 },
    h1Accent: { color: t.accent, fontWeight: "900" },
    h1Sub: { fontSize: 13.5, color: t.ink3, marginTop: 6 },
    liveBadge: {
      flexDirection: "row", alignItems: "center", gap: 7,
      backgroundColor: t.mintSoft,
      paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999,
    },
    livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.mint },
    liveTxt: { fontSize: 12, fontWeight: "700", color: t.successInk },

    // Guia compacto (5/5 + nao dismissed)
    guideCompact: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: t.mintSoft,
      borderWidth: 1, borderColor: t.success,
      borderRadius: 18, padding: 14,
      marginBottom: 22,
    },
    guideCompactIcon: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: "#fff",
      alignItems: "center", justifyContent: "center",
    },
    guideCompactTitle: { fontSize: 14, fontWeight: "800", color: t.ink },
    guideCompactSub: { fontSize: 12, color: t.ink3, marginTop: 2 },
    guideCompactBtn: {
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: "#fff",
      borderWidth: 1, borderColor: t.ink5,
    },
    guideCompactBtnTxt: { fontSize: 12, fontWeight: "700", color: t.ink2 },

    // Guia card principal
    guideCard: {
      backgroundColor: t.paperCard,
      borderRadius: 24, padding: 22,
      borderWidth: 1, borderColor: t.ink5,
      marginBottom: 22,
    },
    guideHead: {
      flexDirection: "row", alignItems: "center", gap: 12,
      marginBottom: 14,
    },
    guideHeadIcon: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: t.primary,
      alignItems: "center", justifyContent: "center",
    },
    guideEyebrow: {
      fontSize: 10.5, color: t.accent, fontWeight: "800",
      letterSpacing: 1, textTransform: "uppercase",
    },
    guideTitle: { fontSize: 17, fontWeight: "800", color: t.ink, marginTop: 3 },
    guideProgressPill: {
      backgroundColor: t.primarySoft,
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    },
    guideProgressPillTxt: { fontSize: 12, fontWeight: "800", color: t.primary },

    guideProgressBar: {
      height: 6, backgroundColor: t.ink5,
      borderRadius: 3, overflow: "hidden",
      marginBottom: 14,
    },
    guideProgressFill: {
      height: "100%",
      backgroundColor: t.mint,
      borderRadius: 3,
    },

    // step cards (cada passo do guia)
    stepCard: {
      backgroundColor: t.bg,
      borderRadius: 14, padding: 12,
      borderWidth: 1.5,
      marginBottom: 8,
    },
    stepHead: {
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    stepNumWrap: {
      flexDirection: "row", alignItems: "center", gap: 8,
      minWidth: 110,
    },
    stepNum: { fontSize: 12, fontWeight: "700", color: t.ink3 },
    stepTitle: { fontSize: 13.5, fontWeight: "700", color: t.ink },
    stepStatusTxt: { fontSize: 11.5, fontWeight: "600", marginTop: 1 },
    stepBody: {
      paddingTop: 10, marginTop: 10,
      borderTopWidth: 1, borderTopColor: t.ink5,
      gap: 8,
    },
    stepHelper: { fontSize: 12.5, color: t.ink3, lineHeight: 18 },
    stepProgressDetail: {
      fontSize: 11.5, color: t.accent, fontWeight: "700",
      backgroundColor: t.accentGhost,
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 6, alignSelf: "flex-start",
    },
    stepCta: {
      flexDirection: "row", alignItems: "center", gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 14, paddingVertical: 9,
      borderRadius: 10, marginTop: 4,
    },
    stepCtaTxt: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
    stepDoneRow: {
      flexDirection: "row", alignItems: "center", gap: 6,
      marginTop: 2,
    },
    stepDoneTxt: { fontSize: 12, color: t.successInk, fontWeight: "700" },

    guideDismissBtn: {
      marginTop: 12, paddingVertical: 10,
      alignItems: "center",
    },
    guideDismissTxt: { fontSize: 12, color: t.ink3, fontWeight: "600", textDecorationLine: "underline" },

    // KPIs
    kpisRow: {
      flexDirection: "row", flexWrap: "wrap", gap: 12,
      marginBottom: 22,
    },
    kpiCard: {
      flex: 1, minWidth: 180,
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: t.paperCard,
      borderRadius: 22, padding: 14,
      borderWidth: 1, borderColor: t.ink5,
    },
    kpiBubble: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: "center", justifyContent: "center",
    },
    kpiLabel: { fontSize: 11.5, color: t.ink3, fontWeight: "600" },

    // Improve banner
    improveBanner: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: t.accentGhost,
      borderWidth: 1, borderColor: t.accentSoft,
      borderRadius: 18, padding: 14,
      marginBottom: 22,
    },
    improveIcon: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: t.accentSoft,
      alignItems: "center", justifyContent: "center",
    },
    improveTitleRow: {
      flexDirection: "row", alignItems: "baseline", flexWrap: "wrap",
    },
    improveTitle: { fontSize: 14, fontWeight: "800", color: t.ink },
    improveDesc: { fontSize: 12, color: t.ink3, marginTop: 2 },
    improveBtn: {
      backgroundColor: t.accent,
      paddingHorizontal: 14, paddingVertical: 9,
      borderRadius: 12,
    },
    improveBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },

    hintCard: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: t.primaryGhost,
      borderRadius: 14, padding: 14, marginTop: 4,
      borderWidth: 1, borderColor: t.primarySoft,
    },
    hintTxt: { fontSize: 12.5, color: t.ink2, flex: 1, lineHeight: 18 },
    hintBold: { fontWeight: "700", color: t.primary },
  });
}
