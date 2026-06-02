// ============================================================
// AURA STUDIO . Home (Painel) - 26/05/2026
//
// Substitui home antiga (greeting + guia 5 passos full + KPIs)
// por Painel real: KPIs com delta + faturamento line chart + top 5
// produtos bar horizontal + funil aprovacao. Guia 5 passos mantido,
// mas em forma colapsada (1 linha gradient brand) no topo, e some
// quando 5/5.
//
// Lib de graficos: SVG inline via react-native-svg (mesmo approach
// do dashboard varejo: sparklines + bar lists). Sem nova dependencia.
//
// Backend: GET /studio/painel?days=N (rota nova, paralela). Falha
// gracioso com toast + UI degradada quando 4xx/5xx.
//
// 26/05/2026 (Painel v2): KPI "Lucro Bruto . mes" virou
// "Lucro Liquido . mes" (Receita - Despesa, fonte transactions).
// Sub-label espelha Receita / Despesa em pt-BR. Faixa colorida do
// card vira danger quando value < 0 (prejuizo) e o valor aparece
// com sinal "-" em cor danger. Acompanha refactor do backend.
//
// 31/05/2026 (Fase 4): adiciona animacao stroke-dashoffset no
// FaturamentoChart (linha desenha de esquerda pra direita 700ms)
// e hover-lift web-only nos cards (KpiCard + chart cards). Tudo
// behind AccessibilityInfo.isReduceMotionEnabled().
// ============================================================
import { useEffect, useState, useMemo, useCallback, ReactNode } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  Platform, AccessibilityInfo,
} from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import Reanimated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import {
  studioApi,
  type StudioSettings,
  type PainelData,
  type PainelSeriePoint,
} from "@/services/studioApi";
import { request } from "@/services/api";
import { toast } from "@/components/Toast";
import { StudioGradient } from "@/components/studio/StudioGradient";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import type { StudioPalette } from "@/constants/studio-tokens";

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

// ─── HoverLift (Fase 4 — desktop only, behind reduceMotion) ──────
// Wrapper leve que adiciona translateY(-2) + sombra suave no hover.
// Pressable usado pelo onHoverIn/onHoverOut do RN-Web; cursor mantém
// default pra nao parecer clickable.
function HoverLift({ children, style }: { children: ReactNode; style: any }) {
  const [hovered, setHovered] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => { mounted = false; };
  }, []);

  const isWeb = Platform.OS === "web";
  const canLift = isWeb && !reduceMotion;
  const lifted = hovered && canLift;

  return (
    <Pressable
      onHoverIn={canLift ? () => setHovered(true) : undefined}
      onHoverOut={canLift ? () => setHovered(false) : undefined}
      style={[
        style,
        isWeb && ({
          transition: "transform 0.18s ease, box-shadow 0.18s ease",
          cursor: "default",
        } as any),
        lifted && { transform: [{ translateY: -2 }] },
        lifted && ({ boxShadow: "0 10px 24px rgba(15,23,42,0.08)" } as any),
      ]}
    >
      {children}
    </Pressable>
  );
}

// ─── Guia steps (mantido pro card colapsado) ───────────────────
type GuideStepStatus = "done" | "in_progress" | "todo";

type GuideStep = {
  id: "products" | "customization" | "templates" | "sla_wa" | "publish";
  num: number;
  title: string;
  desc: string;
  cta: string;
  href: string;
};

const GUIDE_STEPS: GuideStep[] = [
  { id: "products",      num: 1, title: "Cadastre seus produtos",     desc: "Adicione ao menos 1 produto ao catálogo do estúdio.",            cta: "Cadastrar",        href: "/studio/produtos" },
  { id: "customization", num: 2, title: "Configure a personalização", desc: "Marque produtos como personalizáveis e defina os campos da arte.", cta: "Configurar",       href: "/studio/produtos" },
  { id: "templates",     num: 3, title: "Suba templates de arte",     desc: "Suba pelo menos 3 artes/templates pra agilizar os pedidos.",       cta: "Subir artes",      href: "/studio/galeria" },
  { id: "sla_wa",        num: 4, title: "Defina SLA e WhatsApp",      desc: "Defina o prazo (SLA) e o WhatsApp de aprovação de arte.",          cta: "Configurar",       href: "/studio/configuracoes" },
  { id: "publish",       num: 5, title: "Publique a Loja Digital",    desc: "Publique sua Loja Digital pra receber pedidos online.",            cta: "Publicar",         href: "/canal-digital" },
];

type Period = "hoje" | "7d" | "30d";

function periodToDays(p: Period): number {
  if (p === "hoje") return 1;
  if (p === "30d") return 30;
  return 7;
}

function periodLabel(p: Period): string {
  if (p === "hoje") return "Hoje";
  if (p === "30d") return "30 dias";
  return "7 dias";
}

function formatBRL(v: number | null | undefined, decimals = 2): string {
  if (v == null || isNaN(v)) return "—";
  try {
    return v.toLocaleString("pt-BR", {
      style: "currency", currency: "BRL",
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    });
  } catch {
    return "R$ " + (decimals === 0 ? Math.round(v) : v.toFixed(decimals));
  }
}

function formatBRLCompact(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  const n = Math.abs(v);
  if (n >= 1000) return "R$ " + (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return formatBRL(v, 0);
}

// Quebra "R$ 1.842,50" em parte inteira + decimais para estilizar.
// Quando value < 0, formatBRL devolve "-R$ 1.842,50" (locale pt-BR usa
// hifen ASCII como sinal); preservamos o sinal no main.
function splitBRL(v: number): { main: string; decimals: string } {
  const s = formatBRL(v, 2);
  const idx = s.lastIndexOf(",");
  if (idx === -1) return { main: s, decimals: "" };
  return { main: s.slice(0, idx), decimals: s.slice(idx) };
}

const EMPTY_PAINEL: PainelData = {
  period_days: 7,
  computed_at: "",
  kpis: {
    vendas_dia:        { value: 0, delta_pct: null, sub_label: null },
    ticket_medio:      { value: 0, delta_pct: null, sub_label: null },
    lucro_liquido_mes: { value: 0, receita_mes: 0, despesa_mes: 0, margem_pct: null, delta_pct: null },
  },
  faturamento_serie: [],
  faturamento_total: 0,
  top_produtos: [],
  funil_aprovacao: {
    pendentes:  { count: 0, pct: 0 },
    aprovados:  { count: 0, pct: 0 },
    alteracoes: { count: 0, pct: 0 },
    expirados:  { count: 0, pct: 0 },
    total_enviados: 0,
    aprovacao_primeira_pct: null,
    tempo_medio_resposta_min: null,
  },
};

export default function StudioPainel() {
  const router = useRouter();
  const auth = useAuthStore();
  const cid = (auth.company as any)?.id;
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);

  const { config: digitalConfig } = useDigitalChannel();

  // ─── Painel data ──────────────────────────────────
  const [period, setPeriod] = useState<Period>("7d");
  const [painel, setPainel] = useState<PainelData | null>(null);
  const [painelLoading, setPainelLoading] = useState(true);

  const fetchPainel = useCallback(async () => {
    if (!cid) return;
    setPainelLoading(true);
    try {
      const data = await studioApi.getPainel(cid, periodToDays(period));
      setPainel(data);
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || "Erro desconhecido";
      console.error("[StudioPainel] getPainel:", status, msg);
      toast.error("Painel indisponivel (" + (status || "rede") + "). " + msg);
      // UI degradada: tudo zero, mas tela nao quebra
      setPainel(EMPTY_PAINEL);
    } finally {
      setPainelLoading(false);
    }
  }, [cid, period]);

  useEffect(() => { fetchPainel(); }, [fetchPainel]);

  // ─── Guia 5 passos (mantido — detecta progresso real) ──────
  const [guideLoading, setGuideLoading] = useState(true);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [stepStatus, setStepStatus] = useState<Record<GuideStep["id"], GuideStepStatus>>({
    products: "todo", customization: "todo", templates: "todo", sla_wa: "todo", publish: "todo",
  });
  const [dismissing, setDismissing] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);

  const runGuideDetection = useCallback(async () => {
    if (!cid) return;
    setGuideLoading(true);
    try {
      const [productsRes, settingsRes, templatesRes] = await Promise.allSettled([
        request<any>("/companies/" + cid + "/products?limit=500", { method: "GET", retry: 1, timeout: 10000 }),
        studioApi.getSettings(cid),
        studioApi.listTemplates(cid, { limit: 10 }),
      ]);

      // Lista de produtos (passos 1 e 2)
      let productList: any[] = [];
      if (productsRes.status === "fulfilled") {
        const data = productsRes.value;
        productList = Array.isArray(data) ? data : (data?.products || data?.items || []);
      }

      // Passo 1: >=1 produto
      const products: GuideStepStatus = productList.length >= 1 ? "done" : "todo";

      // Passo 2: produto personalizavel com customization_config nao-vazio
      const personalizables = productList.filter((p) => p && p.is_personalizable);
      const withCfg = personalizables.filter((p) => {
        const cfg = p.customization_config;
        if (!cfg || typeof cfg !== "object") return false;
        const fields = (cfg as any).fields;
        return Array.isArray(fields) && fields.length > 0;
      });
      let customization: GuideStepStatus = "todo";
      if (withCfg.length >= 1 && withCfg.length === personalizables.length && personalizables.length > 0) {
        customization = "done";
      } else if (withCfg.length >= 1 || personalizables.length >= 1) {
        customization = "in_progress";
      }

      // Passo 3: >=3 templates
      let templatesCount = 0;
      if (templatesRes.status === "fulfilled") {
        templatesCount = (templatesRes.value.templates || []).length;
      }
      const templates: GuideStepStatus =
        templatesCount >= 3 ? "done" :
        templatesCount >= 1 ? "in_progress" : "todo";

      // Passo 4: SLA + WhatsApp
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

      // Passo 5: Loja Digital publicada
      const publish: GuideStepStatus =
        (digitalConfig && (digitalConfig as any).is_published === true) ? "done" : "todo";

      setStepStatus({ products, customization, templates, sla_wa: slaWa, publish });
      setGuideDismissed(dismissed);
    } catch (err) {
      console.error("[StudioPainel] runGuideDetection:", err);
    } finally {
      setGuideLoading(false);
    }
  }, [cid, digitalConfig]);

  useEffect(() => { runGuideDetection(); }, [runGuideDetection]);

  const doneCount = useMemo(
    () => Object.values(stepStatus).filter((v) => v === "done").length,
    [stepStatus]
  );
  const allDone = doneCount === GUIDE_STEPS.length;

  // Proximo passo nao concluido — usado pra CTA do card colapsado
  const nextStep = useMemo(() => {
    return GUIDE_STEPS.find((step) => stepStatus[step.id] !== "done") || null;
  }, [stepStatus]);

  const handleDismissGuide = useCallback(async () => {
    if (!cid) return;
    setDismissing(true);
    try {
      await studioApi.saveSettings(cid, { guide_dismissed: true } as any);
      setGuideDismissed(true);
      toast.success("Guia oculto.");
    } catch (err: any) {
      console.error("[StudioPainel] handleDismissGuide:", err);
      toast.error(err?.message || "Erro ao ocultar guia");
    } finally {
      setDismissing(false);
    }
  }, [cid]);

  // Render guia: oculto se dismissed ou se 5/5
  const showGuide = !guideDismissed && !allDone && !guideLoading && !!nextStep;

  // ─── Data shortcuts ───────────────────────────────────
  const d = painel || EMPTY_PAINEL;
  const kpiVendas = d.kpis.vendas_dia;
  const kpiTicket = d.kpis.ticket_medio;
  const kpiLucro  = d.kpis.lucro_liquido_mes;

  // Sub-label do card de Lucro: "Receita R$ X . Despesa R$ Y"
  // (formatado pt-BR, sem decimais pra ficar compacto).
  const lucroSubLabel =
    "Receita " + formatBRL(kpiLucro.receita_mes, 0) +
    " . Despesa " + formatBRL(kpiLucro.despesa_mes, 0);

  // Prejuizo no mes: faixa danger + valor em vermelho
  const isLoss = kpiLucro.value < 0;

  return (
    <StudioScreen variant="grid" scroll={false} padded={false}>
      <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* ═══════ GUIA 5 PASSOS (colapsado) ═══════ */}
      {showGuide && nextStep && (
        <StudioGradient
          colors={["#1E3A8A", "#EC4899"]}
          direction="135deg"
          style={s.guideCard}
        >
          {/* Header */}
          <View style={s.guideHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.guideHeaderTitle} numberOfLines={1}>Configure seu estúdio</Text>
              <Text style={s.guideCompactSub}>
                {doneCount} de {GUIDE_STEPS.length} passos concluídos
                {!guideExpanded && nextStep ? " · próximo: " + nextStep.title.toLowerCase() : ""}
              </Text>
              <View style={[s.guideDotsWrap, { marginTop: 8 }]}>
                {GUIDE_STEPS.map((step) => (
                  <View key={step.id} style={[s.guideDot, stepStatus[step.id] === "done" && s.guideDotDone]} />
                ))}
              </View>
            </View>
            <Pressable onPress={() => setGuideExpanded((v) => !v)} style={s.guideCompactBtn} accessibilityLabel={guideExpanded ? "Recolher guia" : "Ver passos"}>
              <Text style={s.guideCompactBtnTxt}>{guideExpanded ? "Recolher" : "Ver passos"}</Text>
              <Icon name={guideExpanded ? "chevron-up" : "chevron-down"} size={12} color="#fff" />
            </Pressable>
            <Pressable onPress={handleDismissGuide} disabled={dismissing} style={s.guideCompactX} hitSlop={8}>
              {dismissing ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="x" size={14} color="#fff" />}
            </Pressable>
          </View>

          {/* Passos (expandido) */}
          {guideExpanded && (
            <View style={s.guideSteps}>
              {GUIDE_STEPS.map((step) => {
                const st = stepStatus[step.id];
                const done = st === "done";
                const inprog = st === "in_progress";
                return (
                  <View key={step.id} style={s.guideStepRow}>
                    <View style={[s.guideStepIcon, done && s.guideStepIconDone]}>
                      {done ? <Icon name="check" size={13} color="#1E3A8A" /> : <Text style={s.guideStepNum}>{step.num}</Text>}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.guideStepTitle, done && s.guideStepTitleDone]} numberOfLines={1}>{step.title}</Text>
                      <Text style={s.guideStepDesc}>{done ? "Concluído" : (inprog ? "Em andamento · " : "") + step.desc}</Text>
                    </View>
                    {!done && (
                      <Pressable onPress={() => router.push(step.href as any)} style={s.guideStepCta}>
                        <Text style={s.guideStepCtaTxt}>{inprog ? "Continuar" : step.cta}</Text>
                        <Icon name="arrow-right" size={11} color="#1E3A8A" />
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* CTA rápido do próximo passo (colapsado) */}
          {!guideExpanded && nextStep && (
            <Pressable onPress={() => router.push(nextStep.href as any)} style={[s.guideCompactBtn, { alignSelf: "flex-start", marginTop: 12 }]}>
              <Text style={s.guideCompactBtnTxt}>{nextStep.cta}: {nextStep.title.toLowerCase()}</Text>
              <Icon name="arrow-right" size={12} color="#fff" />
            </Pressable>
          )}
        </StudioGradient>
      )}

      {/* ═══════ HEADER + Toggle periodo ═══════ */}
      <View style={s.pageHeader}>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <Text style={s.eyebrow}>ESTUDIO . PAINEL</Text>
          <Text style={s.pageTitle}>Indicadores do dia</Text>
          <Text style={s.pageSub}>Acompanhe vendas, pedidos e margem em tempo real.</Text>
        </View>
        <View style={s.togglePeriod}>
          {(["hoje", "7d", "30d"] as Period[]).map((p) => {
            const active = period === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[s.toggleChip, active && s.toggleChipActive]}
              >
                <Text style={[s.toggleChipTxt, active && s.toggleChipTxtActive]}>
                  {periodLabel(p)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ═══════ LOADING (full) ═══════ */}
      {painelLoading && !painel && (
        <StudioLoading variant="spinner" label="Carregando painel..." />
      )}

      {/* ═══════ Conteudo (mesmo durante refetch, com opacity reduzida) ═══════ */}
      {(!painelLoading || painel) && (
        <View style={[painelLoading && { opacity: 0.6 }]}>
          {/* ─── KPI row ─── */}
          <View style={s.kpiRow}>
            <KpiCard
              t={t}
              variant="primary"
              label="Vendas no dia"
              value={kpiVendas.value}
              format="currency"
              deltaPct={kpiVendas.delta_pct}
              subLabel={kpiVendas.sub_label || "Hoje"}
            />
            <KpiCard
              t={t}
              variant="accent"
              label={"Ticket medio (" + (period === "hoje" ? "hoje" : period === "30d" ? "30d" : "7d") + ")"}
              value={kpiTicket.value}
              format="currency"
              deltaPct={kpiTicket.delta_pct}
              subLabel={kpiTicket.sub_label || "Periodo selecionado"}
            />
            <KpiCard
              t={t}
              variant={isLoss ? "danger" : "success"}
              label="Lucro Liquido . mes"
              value={kpiLucro.value}
              format="currency"
              deltaPct={kpiLucro.delta_pct}
              subLabel={lucroSubLabel}
              valueIsNegative={isLoss}
            />
          </View>

          {/* ─── Charts row ─── */}
          <View style={s.chartsRow}>
            {/* Faturamento line chart */}
            <HoverLift style={s.chartCardWide}>
              <View style={s.chartHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.chartEyebrow}>RECEITA</Text>
                  <Text style={s.chartTitle}>
                    Faturamento {period === "hoje" ? "de hoje" : "ultimos " + (period === "30d" ? "30 dias" : "7 dias")}
                  </Text>
                </View>
                <Text style={s.chartMeta}>
                  Total: {formatBRL(d.faturamento_total, 2)}
                </Text>
              </View>
              <FaturamentoChart data={d.faturamento_serie} t={t} />
            </HoverLift>

            {/* Top 5 produtos */}
            <HoverLift style={s.chartCardNarrow}>
              <View style={s.chartHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.chartEyebrow}>TOP VENDAS</Text>
                  <Text style={s.chartTitle}>
                    Top 5 produtos . {periodLabel(period).toLowerCase()}
                  </Text>
                </View>
              </View>
              <TopProdutosList data={d.top_produtos} t={t} />
            </HoverLift>
          </View>

          {/* ─── Funil aprovacao (full width) ─── */}
          <HoverLift style={s.chartCardFull}>
            <View style={s.chartHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.chartEyebrow}>APROVACAO DE ARTE (wa.me)</Text>
                <Text style={s.chartTitle}>
                  Funil de aprovacao . {periodLabel(period).toLowerCase()}
                </Text>
              </View>
              <Text style={s.chartMeta}>
                {d.funil_aprovacao.total_enviados} links enviados
              </Text>
            </View>
            <FunilAprovacao data={d.funil_aprovacao} t={t} />
          </HoverLift>
        </View>
      )}
      </ScrollView>
    </StudioScreen>
  );
}

// ═══════ KPI Card ══════════════════════════════════════════
// variant "danger" foi adicionado pra cobrir prejuizo no card de Lucro.
// Quando valueIsNegative, o valor numerico recebe a cor danger.
// Fase 4: HoverLift desktop-only behind reduceMotion.
function KpiCard({
  t, variant, label, value, format, deltaPct, subLabel, valueIsNegative,
}: {
  t: StudioPalette;
  variant: "primary" | "accent" | "success" | "danger";
  label: string;
  value: number;
  format: "currency" | "integer";
  deltaPct: number | null;
  subLabel: string | null;
  valueIsNegative?: boolean;
}) {
  const s = useMemo(() => buildKpiStyles(t), [t]);
  const stripeColors: readonly string[] =
    variant === "primary" ? ["#1E3A8A", "#3B82F6"] :
    variant === "accent"  ? ["#EC4899", "#F472B6"] :
    variant === "danger"  ? ["#DC2626", "#F87171"] :
                            ["#10B981", "#34D399"];

  const split = format === "currency" ? splitBRL(value) : { main: String(Math.round(value)), decimals: "" };

  const deltaUp = (deltaPct ?? 0) >= 0;
  const showDelta = deltaPct !== null && deltaPct !== undefined && !isNaN(deltaPct);

  return (
    <HoverLift style={s.card}>
      <StudioGradient
        colors={stripeColors}
        direction="90deg"
        style={s.stripe}
        pointerEvents="none"
      />
      <Text style={s.label}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" }}>
        <Text style={[s.value, valueIsNegative && s.valueNegative]}>{split.main}</Text>
        {split.decimals ? (
          <Text style={[s.valueDecimals, valueIsNegative && s.valueDecimalsNegative]}>{split.decimals}</Text>
        ) : null}
      </View>
      {showDelta && (
        <View style={[s.deltaPill, deltaUp ? s.deltaUp : s.deltaDown]}>
          <Text style={[s.deltaTxt, deltaUp ? s.deltaTxtUp : s.deltaTxtDown]}>
            {deltaUp ? "+" : ""}{deltaPct.toFixed(0)}%
          </Text>
        </View>
      )}
      {subLabel && <Text style={s.subLabel}>{subLabel}</Text>}
    </HoverLift>
  );
}

function buildKpiStyles(t: StudioPalette) {
  return StyleSheet.create({
    card: {
      flex: 1, minWidth: 220,
      backgroundColor: t.paperCard,
      borderWidth: 1, borderColor: t.ink5,
      borderRadius: 14,
      padding: 18,
      paddingTop: 22,
      position: "relative",
      overflow: "hidden",
    },
    stripe: {
      position: "absolute",
      top: 0, left: 0, right: 0,
      height: 4,
    },
    label: {
      fontSize: 10,
      color: t.ink3,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    value: {
      fontSize: 26,
      fontWeight: "800",
      color: t.ink,
      letterSpacing: -0.5,
      lineHeight: 30,
    },
    valueNegative: { color: t.dangerInk },
    valueDecimals: {
      fontSize: 18,
      color: t.ink3,
      fontWeight: "700",
    },
    valueDecimalsNegative: { color: t.dangerInk },
    deltaPill: {
      marginTop: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    deltaUp:   { backgroundColor: t.successSoft },
    deltaDown: { backgroundColor: t.dangerSoft },
    deltaTxt:    { fontSize: 11, fontWeight: "700" },
    deltaTxtUp:  { color: t.successInk },
    deltaTxtDown:{ color: t.dangerInk },
    subLabel: {
      fontSize: 11,
      color: t.ink4,
      marginTop: 8,
    },
  });
}

// ═══════ Faturamento line chart (SVG) ════════════════════════
// Fase 4: linha anima com stroke-dashoffset (700ms ease-out) ao
// mudar `data` (period change ou refetch). Behind reduceMotion.
function FaturamentoChart({ data, t }: { data: PainelSeriePoint[]; t: StudioPalette }) {
  const progress = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => { mounted = false; };
  }, []);

  if (!data || data.length === 0) {
    return (
      <View style={{ height: 220, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 12, color: t.ink4 }}>Sem dados no periodo</Text>
      </View>
    );
  }

  const W = 700;
  const H = 220;
  const padL = 40;
  const padR = 10;
  const padT = 30;   // espaco pro tooltip "Hoje"
  const padB = 30;   // espaco pros x labels
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxVal = Math.max(1, ...data.map((p) => p.value));
  // Arredonda max pra cima ao multiplo de 500 (gridlines bonitas)
  const niceMax = Math.ceil(maxVal / 500) * 500 || 500;

  // 4 gridlines + 4 y labels
  const gridSteps = [1, 0.75, 0.5, 0.25];

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;

  const points = data.map((p, i) => ({
    x: padL + i * xStep,
    y: padT + chartH * (1 - p.value / niceMax),
    point: p,
  }));

  // Path da linha
  const linePath = points
    .map((pt, i) => (i === 0 ? "M " : "L ") + pt.x.toFixed(1) + " " + pt.y.toFixed(1))
    .join(" ");

  // Path da area (linha + fechamento na base)
  const lastX = points[points.length - 1].x;
  const firstX = points[0].x;
  const baseY = padT + chartH;
  const areaPath =
    linePath +
    " L " + lastX.toFixed(1) + " " + baseY.toFixed(1) +
    " L " + firstX.toFixed(1) + " " + baseY.toFixed(1) +
    " Z";

  // Pathlength estimado via soma de distancias (cross-platform safe).
  const pathLength = (() => {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return Math.max(total, 50);
  })();

  // Dispara animacao quando data muda. progress 0 → 1.
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [data, reduceMotion, progress]);

  const animatedLineProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - progress.value),
  }));

  const todayIdx = data.findIndex((p) => p.is_today);
  const todayPt = todayIdx >= 0 ? points[todayIdx] : null;

  return (
    <View style={{ width: "100%" }}>
      <View style={{ width: "100%", aspectRatio: W / H }}>
        <Svg
          viewBox={"0 0 " + W + " " + H}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor="#EC4899" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#EC4899" stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Gridlines + y labels */}
          {gridSteps.map((step, i) => {
            const y = padT + chartH * (1 - step);
            const labelVal = niceMax * step;
            return (
              <Line
                key={"grid-" + i}
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke="#EEF0F5"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
            );
          })}
          {gridSteps.map((step, i) => {
            const y = padT + chartH * (1 - step);
            const labelVal = niceMax * step;
            return (
              <SvgText
                key={"y-" + i}
                x={padL - 6}
                y={y + 4}
                fill="#94A3B8"
                fontSize={10}
                textAnchor="end"
              >
                {formatBRLCompact(labelVal)}
              </SvgText>
            );
          })}

          {/* Area */}
          <Path d={areaPath} fill="url(#lineGrad)" />

          {/* Line — animated stroke-dashoffset */}
          <AnimatedPath
            d={linePath}
            fill="none"
            stroke="#EC4899"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength as any}
            animatedProps={animatedLineProps}
          />

          {/* Dots */}
          {points.map((pt, i) => {
            const isToday = pt.point.is_today;
            return (
              <Circle
                key={"dot-" + i}
                cx={pt.x}
                cy={pt.y}
                r={isToday ? 5 : 4}
                fill={isToday ? "#EC4899" : "#FFFFFF"}
                stroke={isToday ? "#FFFFFF" : "#EC4899"}
                strokeWidth={2}
              />
            );
          })}

          {/* Tooltip "Hoje" no ultimo ponto se is_today */}
          {todayPt && (
            <>
              <Rect
                x={Math.max(padL, Math.min(W - padR - 110, todayPt.x - 55))}
                y={Math.max(0, todayPt.y - 32)}
                width={110}
                height={24}
                rx={6}
                fill="#0F172A"
              />
              <SvgText
                x={Math.max(padL + 55, Math.min(W - padR - 55, todayPt.x))}
                y={Math.max(16, todayPt.y - 16)}
                fill="#FFFFFF"
                fontSize={11}
                fontWeight="700"
                textAnchor="middle"
              >
                {"Hoje . " + formatBRLCompact(todayPt.point.value)}
              </SvgText>
            </>
          )}

          {/* X labels */}
          {points.map((pt, i) => {
            const isToday = pt.point.is_today;
            // Skip labels intermediarios se serie muito longa (30d)
            if (data.length > 14) {
              const step = Math.ceil(data.length / 7);
              if (i % step !== 0 && i !== data.length - 1) return null;
            }
            return (
              <SvgText
                key={"x-" + i}
                x={pt.x}
                y={H - 8}
                fill={isToday ? "#EC4899" : "#94A3B8"}
                fontSize={10}
                fontWeight={isToday ? "700" : "400"}
                textAnchor="middle"
              >
                {pt.point.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

// ═══════ Top 5 produtos (bar horizontal) ══════════════════════
function TopProdutosList({
  data, t,
}: {
  data: { product_id: string | null; name: string; revenue: number; qty: number }[];
  t: StudioPalette;
}) {
  if (!data || data.length === 0) {
    return (
      <View style={{ paddingVertical: 30, alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: t.ink4 }}>Sem vendas no periodo</Text>
      </View>
    );
  }

  const top5 = data.slice(0, 5);
  const maxRev = Math.max(1, ...top5.map((p) => p.revenue));

  return (
    <View style={{ gap: 10 }}>
      {top5.map((p, i) => {
        const rank = i + 1;
        const widthPct = (p.revenue / maxRev) * 100;
        // Rank colors: 1 navy, 2-3 accent, 4-5 ink4 com opacity reduzida
        const rankBg =
          rank === 1 ? "#1E3A8A" :
          rank <= 3 ? "#F472B6" : "#94A3B8";
        const fillOpacity = rank <= 3 ? 1 : (rank === 4 ? 0.85 : 0.7);

        return (
          <View key={p.product_id || ("idx-" + i)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: rankBg,
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{rank}</Text>
            </View>
            <Text
              numberOfLines={1}
              style={{
                width: 110,
                fontSize: 12,
                color: t.ink2,
                fontWeight: "600",
              }}
            >
              {p.name || "Sem nome"}
            </Text>
            <View style={{
              flex: 1,
              height: 22,
              backgroundColor: t.bgSoft,
              borderRadius: 999,
              overflow: "hidden",
            }}>
              <StudioGradient
                colors={["#1E3A8A", "#EC4899"]}
                direction="90deg"
                style={{
                  width: (widthPct + "%") as any,
                  height: "100%",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: 8,
                  opacity: fillOpacity,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
                  {formatBRLCompact(p.revenue)}
                </Text>
              </StudioGradient>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ═══════ Funil aprovacao ══════════════════════════════════
function FunilAprovacao({
  data, t,
}: {
  data: PainelData["funil_aprovacao"];
  t: StudioPalette;
}) {
  const stages = [
    { key: "pendentes",  label: "Pendentes",  color: t.warning, count: data.pendentes.count,  pct: data.pendentes.pct },
    { key: "aprovados",  label: "Aprovados",  color: t.success, count: data.aprovados.count,  pct: data.aprovados.pct },
    { key: "alteracoes", label: "Alteracoes", color: t.info,    count: data.alteracoes.count, pct: data.alteracoes.pct },
    { key: "expirados",  label: "Expirados",  color: t.ink4,    count: data.expirados.count,  pct: data.expirados.pct },
  ];

  const total = Math.max(1, ...stages.map((st) => st.count));
  const empty = data.total_enviados === 0;

  // Sumario tempo medio
  let tempoTxt = "—";
  if (data.tempo_medio_resposta_min !== null && data.tempo_medio_resposta_min !== undefined) {
    const m = Math.round(data.tempo_medio_resposta_min);
    if (m < 60) tempoTxt = m + "min";
    else {
      const h = Math.floor(m / 60);
      const r = m % 60;
      tempoTxt = h + "h" + (r > 0 ? " " + r + "min" : "");
    }
  }

  return (
    <View>
      {empty && (
        <View style={{ paddingVertical: 20, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: t.ink4 }}>Nenhum link de aprovacao enviado no periodo</Text>
        </View>
      )}
      {!empty && (
        <View style={{ gap: 8 }}>
          {stages.map((st) => {
            const widthPct = (st.count / total) * 100;
            return (
              <View key={st.key} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{
                  width: 110,
                  fontSize: 11,
                  fontWeight: "700",
                  color: t.ink2,
                }}>
                  {st.label}
                </Text>
                <View style={{
                  flex: 1,
                  height: 28,
                  backgroundColor: st.color,
                  borderRadius: 8,
                  alignItems: "flex-start",
                  justifyContent: "center",
                  paddingHorizontal: 10,
                  minWidth: 32,
                  // largura proporcional via maxWidth nao funciona em RN flex,
                  // usamos um wrapper transparente
                }}>
                  <View style={{
                    position: "absolute",
                    top: 0, left: 0,
                    width: (Math.max(8, widthPct) + "%") as any,
                    height: "100%",
                    backgroundColor: st.color,
                    borderRadius: 8,
                  }} />
                  <Text style={{
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: "800",
                    zIndex: 1,
                  }}>
                    {st.count}
                  </Text>
                </View>
                <Text style={{
                  width: 50,
                  textAlign: "right",
                  fontSize: 12,
                  fontWeight: "700",
                  color: t.ink3,
                }}>
                  {Math.round(st.pct)}%
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Sumario */}
      <View style={{
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: t.ink5,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "600" }}>
          Taxa de aprovacao na 1a:{" "}
          <Text style={{ color: t.success, fontSize: 16, fontWeight: "800" }}>
            {data.aprovacao_primeira_pct !== null && data.aprovacao_primeira_pct !== undefined
              ? Math.round(data.aprovacao_primeira_pct) + "%"
              : "—"}
          </Text>
        </Text>
        <Text style={{ fontSize: 11, color: t.ink4, fontWeight: "600" }}>
          Tempo medio de resposta: {tempoTxt}
        </Text>
      </View>
    </View>
  );
}

// ═══════ Styles ═══════════════════════════════════════════
function buildStyles(t: StudioPalette) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: t.bg },
    container: {
      padding: 24,
      paddingBottom: 60,
      maxWidth: 1280,
      alignSelf: "center",
      width: "100%",
    },

    // ── Guia colapsado ──
    guideCompactCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      borderRadius: 18,
      padding: 16,
      paddingHorizontal: 20,
      marginBottom: 18,
      ...(Platform.OS === "web" ? ({ boxShadow: "0 6px 16px rgba(15,23,42,0.12)" } as any) : null),
    },
    guideDotsWrap: { flexDirection: "row", gap: 4 },
    guideDot: {
      width: 24, height: 8, borderRadius: 4,
      backgroundColor: "rgba(255,255,255,0.3)",
    },
    guideDotDone: { backgroundColor: "#fff" },
    guideCompactTitle: {
      fontSize: 14, fontWeight: "700", color: "#fff",
    },
    guideCompactSub: {
      fontSize: 12, color: "rgba(255,255,255,0.85)",
      marginTop: 2,
    },
    guideCompactBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.2)",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.4)",
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 999,
    },
    guideCompactBtnTxt: {
      color: "#fff", fontSize: 12, fontWeight: "700",
    },
    guideCompactX: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
    },
    guideCard: {
      borderRadius: 18,
      padding: 18,
      marginBottom: 18,
      ...(Platform.OS === "web" ? ({ boxShadow: "0 6px 16px rgba(15,23,42,0.12)" } as any) : null),
    },
    guideHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    guideHeaderTitle: { fontSize: 15, fontWeight: "800", color: "#fff" },
    guideSteps: { marginTop: 14, gap: 8 },
    guideStepRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 12, padding: 10,
    },
    guideStepIcon: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center", justifyContent: "center",
    },
    guideStepIconDone: { backgroundColor: "#fff" },
    guideStepNum: { color: "#fff", fontSize: 13, fontWeight: "800" },
    guideStepTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
    guideStepTitleDone: { opacity: 0.7 },
    guideStepDesc: { color: "rgba(255,255,255,0.82)", fontSize: 11.5, marginTop: 1 },
    guideStepCta: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    },
    guideStepCtaTxt: { color: "#1E3A8A", fontSize: 12, fontWeight: "800" },

    // ── Page header ──
    pageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginBottom: 22,
      gap: 16,
      flexWrap: "wrap",
    },
    eyebrow: {
      fontSize: 11, color: t.accent, fontWeight: "800",
      letterSpacing: 1.4, textTransform: "uppercase",
      marginBottom: 6,
    },
    pageTitle: {
      fontSize: 28, fontWeight: "800",
      color: t.ink, letterSpacing: -0.6,
    },
    pageSub: { fontSize: 13, color: t.ink3, marginTop: 4 },

    // ── Toggle periodo ──
    togglePeriod: {
      flexDirection: "row",
      backgroundColor: t.paperCard,
      borderWidth: 1.5, borderColor: t.ink5,
      borderRadius: 999,
      padding: 4,
      gap: 2,
    },
    toggleChip: {
      paddingHorizontal: 16, paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: "transparent",
    },
    toggleChipActive: { backgroundColor: t.primary },
    toggleChipTxt: {
      fontSize: 12, fontWeight: "700",
      color: t.ink3,
    },
    toggleChipTxtActive: { color: "#fff" },

    // ── KPI row ──
    kpiRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 14,
      marginBottom: 18,
    },

    // ── Charts row ──
    chartsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 14,
      marginBottom: 18,
    },
    chartCardWide: {
      flexGrow: 3,
      flexShrink: 1,
      flexBasis: 420,
      minWidth: 300,
      backgroundColor: t.paperCard,
      borderWidth: 1, borderColor: t.ink5,
      borderRadius: 14,
      padding: 18,
    },
    chartCardNarrow: {
      flexGrow: 2,
      flexShrink: 1,
      flexBasis: 280,
      minWidth: 280,
      backgroundColor: t.paperCard,
      borderWidth: 1, borderColor: t.ink5,
      borderRadius: 14,
      padding: 18,
    },
    chartCardFull: {
      backgroundColor: t.paperCard,
      borderWidth: 1, borderColor: t.ink5,
      borderRadius: 14,
      padding: 18,
    },
    chartHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
      gap: 8,
    },
    chartEyebrow: {
      fontSize: 10, color: t.ink4, fontWeight: "700",
      letterSpacing: 0.4, textTransform: "uppercase",
      marginBottom: 2,
    },
    chartTitle: {
      fontSize: 13, fontWeight: "800",
      color: t.ink, letterSpacing: -0.1,
    },
    chartMeta: {
      fontSize: 11, color: t.ink4, fontWeight: "600",
    },
  });
}
