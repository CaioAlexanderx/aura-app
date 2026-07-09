import { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, Animated,
  ActivityIndicator, RefreshControl, useWindowDimensions,
  TextInput, Platform,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { creditApi, valorAPagarParcela } from "@/services/creditApi";
import { toast } from "@/components/Toast";
import type { AgingRow, CreditBalanceItem } from "@/services/creditApi";
import { CriarLancamentoModal } from "@/components/crediario/CriarLancamentoModal";
import { ClienteCrediarioModal } from "@/components/crediario/ClienteCrediarioModal";
import { CobrancaPreviewModal } from "@/components/crediario/CobrancaPreviewModal";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { Motion, Shadows, webTransition } from "@/constants/motion";

// ============================================================
// AURA. — Crediário (F2 do redesign — spec docs/crediario-redesign-spec.md §2.2)
//
// F2 (08/07/2026):
//  - Header enxuto (sem subtítulo) + Button unificado
//  - Hero GLASS unificado: 1 herói (count-up) + stats inline clicáveis
//    (Vencido/Clientes em atraso filtram a carteira) — some o trio de KPIs
//  - "Carteira por atraso": o mapa de risco É o filtro (barra + pills);
//    chips Com saldo/Em atraso/Em dia removidos (redundantes)
//  - Carteira: hover lift (web, aditivo — sem hover-reveal), pill colorida
//    de atraso, telefone sai da linha (vive na ficha), alvo WhatsApp 40px
//  - Entrada escalonada das seções (FadeInUp) + skeleton com pulse
//  - Fix display-side [ao vivo]: cliente overdue sem next_due_date mostrava
//    "Em atraso" + "—" na coluna de atraso; agora mostra pill "Em atraso"
//  Lógica preservada: busca debounce, A–Z, atraso-por-data, cobrança, modais.
//  refreshMe() no mount mantido (armadilha_plano_stale_jwt).
// ============================================================

var fmt = function(n: number) {
  return "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

var fmtDate = function(iso: string) {
  // A1-FE: date-only strings (YYYY-MM-DD) parsed as UTC midnight by new Date(),
  // causing off-by-one in UTC-3 (Brazil). Split string instead to avoid the issue.
  if (!iso) return "";
  try {
    const s = String(iso);
    if (s.length === 10) {
      const [, m, d] = s.split("-");
      return d + "/" + m;
    }
    return new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  } catch { return ""; }
};

/** Hoje em America/Sao_Paulo no formato YYYY-MM-DD (tz-safe). */
function todaySP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Dias de atraso a partir de next_due_date (0 se em dia / sem data). */
function daysLate(nextDue?: string | null): number {
  if (!nextDue) return 0;
  const due = nextDue.slice(0, 10);
  const today = todaySP();
  if (due >= today) return 0;
  const a = new Date(due + "T00:00:00Z").getTime();
  const b = new Date(today + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Faixa de aging do cliente a partir dos dias de atraso (casa com AGING_ORDER). */
function agingBucket(dl: number): string {
  if (dl <= 0) return "a_vencer";
  if (dl <= 30) return "1_30_dias";
  if (dl <= 60) return "31_60_dias";
  if (dl <= 90) return "61_90_dias";
  return "acima_90";
}

/** Iniciais do cliente para o avatar. */
function initials(name: string): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Atraso por DATA (fonte: backend /balances → overdue/next_due_date).
 * (1) campo overdue explícito; (2) next_due_date < hoje (tz-safe); (3) false.
 */
function isCustomerOverdue(cust: CreditBalanceItem & { overdue?: boolean; next_due_date?: string | null }): boolean {
  if (typeof cust.overdue === "boolean") return cust.overdue;
  if (cust.next_due_date) {
    const dueDateStr = cust.next_due_date.slice(0, 10);
    return dueDateStr < todaySP();
  }
  return false;
}

const AGING_LABELS: Record<string, string> = {
  a_vencer: "Em dia", "1_30_dias": "1–30 dias",
  "31_60_dias": "31–60 dias", "61_90_dias": "61–90 dias", acima_90: "90+ dias",
};

const AGING_COLORS: Record<string, string> = {
  a_vencer: Colors.green, "1_30_dias": Colors.amber,
  "31_60_dias": "#f97316", "61_90_dias": Colors.red, acima_90: "#ef4444",
};

const AGING_ORDER = ["a_vencer", "1_30_dias", "31_60_dias", "61_90_dias", "acima_90"];

const IS_WEB = Platform.OS === "web";

type CobrancaPreviewState = {
  recipientName: string;
  phone: string;
  valorLabel?: string;
  valorDesc?: string;
  message: string;
};

type SortOrder = "balance" | "az";
/** F2: filtro único — "todos" | "atraso" (qualquer vencido) | faixa de aging. */
type FilterSel = "todos" | "atraso" | string;

// ── F2: count-up do número herói (RAF, web+nativo) ─────────────────────
function useCountUp(target: number, duration = 500): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (!isFinite(target) || from === target) { setVal(target); return; }
    fromRef.current = target;
    const start = Date.now();
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setVal(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ── F2: entrada escalonada das seções (fade + translateY 8→0) ─────────
function FadeInUp({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: Motion.slow, delay, useNativeDriver: false }).start();
  }, [anim, delay]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// ── F2: skeleton com pulse (substitui blocos estáticos) ────────────────
function PulseBlock({ w, h, r = 6, mb = 0 }: { w: number | string; h: number; r?: number; mb?: number }) {
  const anim = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 0.65, duration: 700, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0.35, duration: 700, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={{ width: w as any, height: h, borderRadius: r, marginBottom: mb, backgroundColor: Colors.border, opacity: anim }} />;
}

// ── F2: stat inline do hero (clicável quando tem onPress) ──────────────
function HeroStat({ dot, label, value, sub, color, onPress, active }: {
  dot: string; label: string; value: string; sub?: string; color: string;
  onPress?: () => void; active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${label}: ${value}${onPress ? ". Toque para filtrar a carteira" : ""}`}
      style={({ hovered, pressed }: any) => [
        s.stat,
        active && s.statActive,
        onPress && (hovered || pressed) && ({
          transform: [{ translateY: -2 }],
          borderColor: Colors.border2,
          ...(IS_WEB ? ({ boxShadow: Shadows.soft } as any) : null),
        } as any),
        IS_WEB ? (webTransition(["transform", "box-shadow", "border-color"], Motion.base) as any) : null,
      ]}
    >
      <View style={[s.statDot, { backgroundColor: dot }]} />
      <View style={{ minWidth: 0 }}>
        <Text style={s.statLabel} numberOfLines={1}>{label}</Text>
        <Text style={[s.statValue, { color }]} numberOfLines={1}>{value}</Text>
        {!!sub && <Text style={s.statSub} numberOfLines={1}>{sub}</Text>}
      </View>
    </Pressable>
  );
}

export default function CrediarioScreen() {
  const { company, refreshMe } = useAuthStore();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [showCriar, setShowCriar] = useState(false);
  const [modalCust, setModalCust] = useState<{ id: string; name: string } | null>(null);
  const [cobrancaPreview, setCobrancaPreview] = useState<CobrancaPreviewState | null>(null);

  // ── Refetch de plano no mount (combate armadilha_plano_stale_jwt) ──────
  useEffect(() => {
    refreshMe().catch(() => {});
  }, []);

  // ── Busca (DESIGN-38) ──────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearchQ(searchInput.trim()); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const [sortOrder, setSortOrder] = useState<SortOrder>("balance");
  // F2: filtro único (todos | atraso | faixa de aging) — substitui chips + agingFilter.
  const [filterSel, setFilterSel] = useState<FilterSel>("todos");

  const toggleFilter = useCallback((f: FilterSel) => {
    setFilterSel(prev => (prev === f ? "todos" : f));
  }, []);

  const { width } = useWindowDimensions();
  const isWide   = width > 720;
  const isNarrow = width < 500;

  const dashQ = useQuery({
    queryKey: ["credit-dashboard", company?.id],
    queryFn: () => creditApi.getDashboard(company!.id),
    enabled: !!company?.id,
    staleTime: 60_000,
  });

  const agingQ = useQuery({
    queryKey: ["credit-aging", company?.id],
    queryFn: () => creditApi.getAging(company!.id),
    enabled: !!company?.id,
    staleTime: 60_000,
  });

  const carteiraQ = useQuery({
    queryKey: ["credit-balances", company?.id, searchQ],
    queryFn: () => creditApi.listBalances(company!.id, { onlyOpen: true, q: searchQ || undefined }),
    enabled: !!company?.id,
    staleTime: 60_000,
  });

  const rulesQ = useQuery({
    queryKey: ["credit-rules", company?.id],
    queryFn: () => creditApi.getCollectionRules(company!.id),
    enabled: !!company?.id,
    staleTime: 5 * 60_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["credit-dashboard", company?.id] }),
      qc.invalidateQueries({ queryKey: ["credit-aging", company?.id] }),
      qc.invalidateQueries({ queryKey: ["credit-balances", company?.id, searchQ] }),
    ]);
    setRefreshing(false);
  }, [company?.id, searchQ]);

  const handleCobrar = useCallback(async (customerId: string, customerName: string, phone: string | null) => {
    if (!phone) { toast.error("Cliente sem telefone cadastrado"); return; }
    setTriggeringId(customerId);
    try {
      const detail = await creditApi.getCustomerHistory(company!.id, customerId);
      const store  = company?.name || "nossa loja";
      const pixKey = String((rulesQ.data as any)?.pix_key || "").trim();
      const debit  = (detail.transactions || []).find(t => t.type === "debit");
      const prodMatch = debit?.notes ? debit.notes.match(/\(([^)]+)\)/) : null;
      const products  = prodMatch ? prodMatch[1] : "";
      const buyDate   = debit ? fmtDate(debit.created_at) : "";
      const open = (detail.open_installments || []).slice()
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      const nextDue = open[0];

      const lines: string[] = [
        `Olá, ${customerName}! Tudo bem? Passando pra lembrar do seu crediário aqui na ${store}.`,
      ];
      if (debit) lines.push(`Referente à compra do dia ${buyDate}${products ? ` (${products})` : ""}.`);

      let valorLabel: string | undefined;
      let valorDesc: string | undefined;

      if (nextDue) {
        const valor = valorAPagarParcela(nextDue);
        valorLabel = fmt(valor);
        valorDesc = `Parcela ${nextDue.installment_number}/${nextDue.total_installments} · vence ${fmtDate(nextDue.due_date)}`;
        lines.push(`A parcela ${nextDue.installment_number}/${nextDue.total_installments} de ${fmt(valor)} vence em ${fmtDate(nextDue.due_date)}.`);
      } else {
        valorLabel = fmt(detail.balance);
        lines.push(`Seu saldo em aberto é de ${fmt(detail.balance)}.`);
      }
      if (pixKey) lines.push(`Chave Pix para pagamento: ${pixKey}`);
      lines.push(`— ${store}`);

      setCobrancaPreview({
        recipientName: customerName,
        phone,
        valorLabel,
        valorDesc,
        message: lines.join("\n\n"),
      });
    } catch {
      toast.error("Erro ao montar a cobrança");
    } finally {
      setTriggeringId(null);
    }
  }, [company?.id, company?.name, rulesQ.data]);

  const kpis = dashQ.data?.kpis;
  const aging: AgingRow[] = agingQ.data || [];
  const agingMap = Object.fromEntries(aging.map(r => [r.faixa, r]));
  const agingTotal = aging.reduce((s2, r) => s2 + Number(r.amount), 0) || 1;
  const hasOverdueAging = aging.some(r => r.faixa !== "a_vencer" && Number(r.amount) > 0);

  // Prefere portfolio_open_amount (carteira real: parcelado + à vista + avulsos).
  // Fallbacks para total_open de /balances e total_open_amount do dashboard.
  const totalOpen = kpis?.portfolio_open_amount ?? carteiraQ.data?.total_open ?? kpis?.total_open_amount ?? 0;
  const overdueAmount = kpis?.overdue_amount || 0;
  const heroValue = useCountUp(Number(totalOpen) || 0, 500);

  // Carteira: filtro único + ordenação.
  const carteiraRaw = carteiraQ.data?.customers || [];
  const carteira = [...carteiraRaw]
    .filter((c) => {
      if (filterSel === "todos") return true;
      if (filterSel === "atraso") return isCustomerOverdue(c as any);
      // faixa de aging: "a_vencer" = em dia; demais por dias de atraso
      if (filterSel === "a_vencer") return !isCustomerOverdue(c as any);
      return isCustomerOverdue(c as any) && agingBucket(daysLate((c as any).next_due_date)) === filterSel;
    })
    .sort((a, b) => {
      if (sortOrder === "az") return a.name.localeCompare(b.name, "pt-BR");
      // padrão: maior atraso primeiro, depois saldo desc
      const la = daysLate((a as any).next_due_date);
      const lb = daysLate((b as any).next_due_date);
      if (la !== lb) return lb - la;
      return Number(b.balance) - Number(a.balance);
    });

  const isLoading = dashQ.isLoading || agingQ.isLoading;

  const pad = isWide ? 32 : 16;

  if (isLoading) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={[s.content, { padding: pad }]}>
        <View style={{ marginBottom: 20 }}>
          <Text style={s.eyebrow}>Relacionamento · fiado</Text>
          <Text style={s.pageTitle}>Crediário</Text>
        </View>
        <GlassCard tone="gradient" style={{ padding: 22 }}>
          <PulseBlock w={90} h={10} r={5} mb={12} />
          <PulseBlock w={180} h={36} r={8} mb={16} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <PulseBlock w={120} h={44} r={11} />
            <PulseBlock w={120} h={44} r={11} />
            <PulseBlock w={120} h={44} r={11} />
          </View>
        </GlassCard>
      </ScrollView>
    );
  }

  const clearOrLabel = filterSel !== "todos" ? "toque de novo p/ limpar" : "toque numa faixa p/ filtrar";

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { padding: pad }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.violet3} />}
    >
      {/* ── Header: eyebrow + título + ações (F2: sem subtítulo) ── */}
      <View style={[s.headerRow, !isWide && s.headerRowMobile]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.eyebrow}>Relacionamento · fiado</Text>
          <Text style={s.pageTitle}>Crediário</Text>
        </View>
        <View style={[{ flexDirection: "row", gap: 8 }, !isWide && { width: "100%" }]}>
          <Button
            title="Novo lançamento"
            icon="plus"
            variant="secondary"
            onPress={() => setShowCriar(true)}
            style={!isWide ? { flex: 1 } : undefined}
          />
          <Button
            title=""
            icon="settings"
            variant="secondary"
            accessibilityLabel="Configurações do crediário"
            onPress={() => router.push("/crediario/settings" as any)}
            style={{ paddingHorizontal: 13, gap: 0 } as any}
          />
        </View>
      </View>

      {/* ── Hero GLASS unificado: 1 herói + stats inline (F2) ── */}
      <FadeInUp>
        <GlassCard tone="gradient" style={{ padding: isNarrow ? 18 : 24, marginBottom: 14 }}>
          <Text style={s.heroLabel}>Em aberto · total</Text>
          <Text style={[s.heroValue, { fontSize: isNarrow ? 30 : 42 }]}>{fmt(heroValue)}</Text>
          <Text style={s.heroMeta}>
            {(kpis?.customers_with_balance ?? carteiraQ.data?.customers_open ?? carteiraRaw.length)} cliente(s) com saldo em aberto
          </Text>
          <View style={s.heroStats}>
            <HeroStat
              dot={Colors.red} color={Colors.red}
              label="Vencido" value={fmt(overdueAmount)}
              sub={`${kpis?.overdue_count || 0} parcela(s)`}
              onPress={() => toggleFilter("atraso")}
              active={filterSel === "atraso"}
            />
            <HeroStat
              dot={Colors.green} color={Colors.green}
              label="Recebido no mês" value={fmt(kpis?.paid_this_month_amount || 0)}
              sub={`${kpis?.paid_this_month_count || 0} recebimento(s)`}
            />
            <HeroStat
              dot={Colors.amber} color={Colors.amber}
              label="Clientes em atraso" value={String(kpis?.defaulting_customers ?? 0)}
              sub="com parcela vencida"
              onPress={() => toggleFilter("atraso")}
              active={filterSel === "atraso"}
            />
          </View>
        </GlassCard>
      </FadeInUp>

      {/* ── Carteira por atraso: o mapa É o filtro (F2) ── */}
      {aging.length > 0 && (
        <FadeInUp delay={60}>
          <GlassCard style={{ padding: 18, marginBottom: 16 }}>
            <View style={s.riskHead}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={s.riskTick} />
                <Text style={s.riskTitle}>Carteira por atraso</Text>
              </View>
              <Text style={s.riskMeta}>{clearOrLabel}</Text>
            </View>

            <View style={s.stackBar}>
              {AGING_ORDER.map((faixa) => {
                const row = agingMap[faixa];
                const amt = row ? Number(row.amount) : 0;
                if (amt <= 0) return null;
                const pct = Math.max(2, Math.round((amt / agingTotal) * 100));
                const dimmed = filterSel !== "todos" && filterSel !== faixa && !(filterSel === "atraso" && faixa !== "a_vencer");
                return (
                  <Pressable
                    key={faixa}
                    onPress={() => toggleFilter(faixa)}
                    accessibilityRole="button"
                    accessibilityLabel={`${AGING_LABELS[faixa]}: ${fmt(amt)}, ${row.count} cliente(s). Toque para filtrar`}
                    style={({ hovered }: any) => [
                      {
                        width: (`${pct}%` as any),
                        backgroundColor: AGING_COLORS[faixa],
                        opacity: dimmed ? 0.3 : 1,
                        borderRadius: 999,
                      },
                      hovered && ({ transform: [{ scaleY: 1.3 }] } as any),
                      IS_WEB ? (webTransition(["transform", "opacity"], Motion.base) as any) : null,
                    ]}
                  />
                );
              })}
            </View>

            <View style={s.pillRow}>
              <Pressable
                onPress={() => setFilterSel("todos")}
                style={({ hovered }: any) => [s.pill, filterSel === "todos" && s.pillActive, hovered && s.pillHover, IS_WEB ? (webTransition(["transform", "border-color", "background-color"], Motion.base) as any) : null]}
              >
                <Text style={[s.pillLabel, filterSel === "todos" && s.pillLabelActive]}>Todos</Text>
                <Text style={[s.pillAmount, filterSel === "todos" && s.pillLabelActive]}>{fmt(totalOpen)}</Text>
              </Pressable>

              {AGING_ORDER.map((faixa) => {
                const row = agingMap[faixa];
                if (!row || Number(row.amount) <= 0) return null;
                const on = filterSel === faixa;
                return (
                  <Pressable
                    key={faixa}
                    onPress={() => toggleFilter(faixa)}
                    style={({ hovered }: any) => [s.pill, on && s.pillActive, hovered && s.pillHover, IS_WEB ? (webTransition(["transform", "border-color", "background-color"], Motion.base) as any) : null]}
                  >
                    <View style={[s.pillDot, { backgroundColor: AGING_COLORS[faixa] }]} />
                    <Text style={[s.pillLabel, on && s.pillLabelActive]}>{AGING_LABELS[faixa]}</Text>
                    <Text style={[s.pillAmount, on && s.pillLabelActive]}>{fmt(row.amount)}</Text>
                  </Pressable>
                );
              })}

              {hasOverdueAging && (
                <Pressable
                  onPress={() => toggleFilter("atraso")}
                  style={({ hovered }: any) => [s.pill, filterSel === "atraso" && s.pillActive, hovered && s.pillHover, IS_WEB ? (webTransition(["transform", "border-color", "background-color"], Motion.base) as any) : null]}
                >
                  <View style={[s.pillDot, { backgroundColor: Colors.red }]} />
                  <Text style={[s.pillLabel, filterSel === "atraso" && s.pillLabelActive]}>Em atraso · todos</Text>
                </Pressable>
              )}
            </View>
          </GlassCard>
        </FadeInUp>
      )}

      {/* ── Toolbar enxuta: busca + A–Z (F2: chips de estado saíram) ── */}
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Icon name="search" size={14} color={Colors.ink3} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar cliente…"
            placeholderTextColor={Colors.ink3}
            value={searchInput}
            onChangeText={setSearchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchInput.length > 0 && Platform.OS !== "ios" && (
            <Pressable onPress={() => setSearchInput("")} hitSlop={8}>
              <Icon name="x" size={13} color={Colors.ink3} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setSortOrder(p => p === "az" ? "balance" : "az")}
          style={({ hovered }: any) => [s.chip, sortOrder === "az" && s.chipActive, hovered && s.pillHover, IS_WEB ? (webTransition(["transform", "border-color"], Motion.base) as any) : null]}
        >
          <Text style={[s.chipText, sortOrder === "az" && s.chipTextActive]}>A–Z</Text>
        </Pressable>
      </View>

      {/* ── Carteira ── */}
      <FadeInUp delay={120}>
        <GlassCard style={{ overflow: "hidden" }}>
          <View style={s.tableHeadRow}>
            <Text style={[s.th, { flex: 1 }]}>Cliente</Text>
            <Text style={[s.th, s.thRight, { width: 110 }]}>Saldo</Text>
            {isWide && <Text style={[s.th, { width: 100 }]}>Maior atraso</Text>}
            <Text style={[s.th, s.thRight, { width: isWide ? 96 : 64 }]}>Ações</Text>
          </View>

          {carteiraQ.isLoading ? (
            <View style={{ padding: 16 }}>
              {[0, 1, 2].map(i => <PulseBlock key={i} w="100%" h={16} mb={12} />)}
            </View>
          ) : carteira.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: "center", gap: 14 }}>
              <Text style={s.emptyText}>
                {searchQ ? `Nenhum cliente encontrado para "${searchQ}".`
                  : filterSel === "atraso" ? "Nenhum cliente em atraso. 🎉"
                  : filterSel !== "todos" ? `Nenhum cliente na faixa ${AGING_LABELS[filterSel] || filterSel}.`
                  : "Nenhum cliente com saldo em aberto."}
              </Text>
              {!searchQ && filterSel === "todos" && (
                <Button title="Novo lançamento" icon="plus" variant="secondary" onPress={() => setShowCriar(true)} />
              )}
            </View>
          ) : (
            carteira.map((cust) => {
              const overdue = isCustomerOverdue(cust as any);
              const dl = daysLate((cust as any).next_due_date);
              return (
                <Pressable
                  key={cust.id}
                  onPress={() => setModalCust({ id: cust.id, name: cust.name })}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ficha de ${cust.name}, saldo ${fmt(cust.balance)}`}
                  style={({ hovered, pressed }: any) => [
                    s.row,
                    (hovered || pressed) && ({
                      backgroundColor: Colors.violetD,
                      ...(IS_WEB ? ({ transform: [{ translateY: -1 }], boxShadow: Shadows.soft } as any) : null),
                    } as any),
                    IS_WEB ? (webTransition(["background-color", "transform", "box-shadow"], Motion.fast) as any) : null,
                  ]}
                >
                  {/* Cliente: avatar + nome + status (F2: telefone saiu — vive na ficha) */}
                  <View style={s.rowClient}>
                    <View style={[s.avatar, { backgroundColor: overdue ? Colors.red : Colors.violet3 }]}>
                      <Text style={s.avatarText}>{initials(cust.name)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.rowName} numberOfLines={1}>{cust.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <View style={[s.statusDot, { backgroundColor: overdue ? Colors.red : Colors.green }]} />
                        <Text style={s.rowMeta} numberOfLines={1}>
                          {overdue ? "Em atraso" : "Em dia"}
                          {!isWide && dl > 0 ? ` · ${dl}d` : ""}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Saldo */}
                  <Text style={[s.rowBalance, { width: 110, color: overdue ? Colors.red : Colors.ink }]} numberOfLines={1}>
                    {fmt(cust.balance)}
                  </Text>

                  {/* Maior atraso (desktop) — F2: pill colorida; overdue sem data ganha pill "Em atraso" */}
                  {isWide && (
                    <View style={{ width: 100 }}>
                      {dl > 0 ? (
                        <View style={[s.latePill, {
                          backgroundColor: (dl > 60 ? Colors.red : dl > 30 ? "#f97316" : Colors.amber) + "1f",
                          borderColor: (dl > 60 ? Colors.red : dl > 30 ? "#f97316" : Colors.amber) + "55",
                        }]}>
                          <Text style={[s.latePillText, { color: dl > 60 ? Colors.red : dl > 30 ? "#f97316" : Colors.amber }]}>{dl} dias</Text>
                        </View>
                      ) : overdue ? (
                        <View style={[s.latePill, { backgroundColor: Colors.amber + "1f", borderColor: Colors.amber + "55" }]}>
                          <Text style={[s.latePillText, { color: Colors.amber }]}>Em atraso</Text>
                        </View>
                      ) : (
                        <Text style={s.lateTextOk}>—</Text>
                      )}
                    </View>
                  )}

                  {/* Ações — alvo 40px + hover glow */}
                  <View style={[s.rowActions, { width: isWide ? 96 : 64 }]}>
                    <Pressable
                      disabled={triggeringId === cust.id}
                      onPress={() => handleCobrar(cust.id, cust.name, cust.phone)}
                      accessibilityRole="button"
                      accessibilityLabel={`Cobrar ${cust.name} no WhatsApp`}
                      hitSlop={4}
                      style={({ hovered, pressed }: any) => [
                        s.actBtn,
                        triggeringId === cust.id && { opacity: 0.4 },
                        (hovered || pressed) && ({
                          transform: [{ translateY: -2 }],
                          ...(IS_WEB ? ({ boxShadow: Shadows.glowGreen } as any) : null),
                        } as any),
                        IS_WEB ? (webTransition(["transform", "box-shadow"], Motion.fast) as any) : null,
                      ]}
                    >
                      {triggeringId === cust.id
                        ? <ActivityIndicator size="small" color={Colors.green} />
                        : <Icon name="message_circle" size={16} color={Colors.green} />}
                    </Pressable>
                    <Icon name="chevron_right" size={15} color={Colors.ink3} />
                  </View>
                </Pressable>
              );
            })
          )}
        </GlassCard>
      </FadeInUp>

      {carteira.length > 0 && (
        <Text style={s.footerCount}>
          {carteira.length} cliente{carteira.length !== 1 ? "s" : ""}
          {" · "}
          {filterSel === "atraso" ? "em atraso (toque na pill p/ limpar)"
            : filterSel !== "todos" ? `faixa ${AGING_LABELS[filterSel] || filterSel} (toque p/ limpar)`
            : sortOrder === "az" ? "ordem alfabética" : "maior atraso primeiro"}
        </Text>
      )}

      <CriarLancamentoModal visible={showCriar} onClose={() => setShowCriar(false)} />

      <ClienteCrediarioModal
        visible={!!modalCust}
        companyId={company?.id || ""}
        customerId={modalCust?.id || null}
        customerName={modalCust?.name || null}
        pixKey={(rulesQ.data as any)?.pix_key || null}
        storeName={company?.name || null}
        onCobrar={handleCobrar}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["credit-balances", company?.id] });
          qc.invalidateQueries({ queryKey: ["credit-dashboard", company?.id] });
          qc.invalidateQueries({ queryKey: ["credit-aging", company?.id] });
        }}
        onClose={() => setModalCust(null)}
      />

      {cobrancaPreview && (
        <CobrancaPreviewModal
          visible={!!cobrancaPreview}
          recipientName={cobrancaPreview.recipientName}
          phone={cobrancaPreview.phone}
          valorLabel={cobrancaPreview.valorLabel}
          valorDesc={cobrancaPreview.valorDesc}
          initialMessage={cobrancaPreview.message}
          onClose={() => setCobrancaPreview(null)}
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 48, maxWidth: 1040, alignSelf: "center", width: "100%" },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 20, marginBottom: 22 },
  headerRowMobile: { flexDirection: "column", alignItems: "stretch", gap: 14 },
  eyebrow: { fontSize: 10, fontWeight: "800", color: Colors.ink3, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 },
  pageTitle: { fontSize: 30, fontWeight: "800", color: Colors.ink, letterSpacing: -0.6, lineHeight: 32 },

  // Hero (glass gradient)
  heroLabel: { fontSize: 10, fontWeight: "800", color: Colors.violet3, letterSpacing: 1.4, textTransform: "uppercase" },
  heroValue: { fontWeight: "800", color: Colors.ink, letterSpacing: -1, marginTop: 10, marginBottom: 4, fontVariant: ["tabular-nums"] as any },
  heroMeta: { fontSize: 12, color: Colors.ink3, marginBottom: 16 },
  heroStats: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  stat: {
    flexDirection: "row", alignItems: "center", gap: 9,
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border,
    minHeight: 44,
  },
  statActive: { borderColor: Colors.violet2, backgroundColor: Colors.violetD },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3 },
  statValue: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] as any },
  statSub: { fontSize: 10, color: Colors.ink3, marginTop: 1 },

  // Carteira por atraso (risco = filtro)
  riskHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  riskTick: { width: 4, height: 14, borderRadius: 2, backgroundColor: Colors.violet3 },
  riskTitle: { fontSize: 11.5, fontWeight: "800", color: Colors.ink2, letterSpacing: 0.3 },
  riskMeta: { fontSize: 11, color: Colors.ink3 },
  stackBar: { flexDirection: "row", height: 14, borderRadius: 999, backgroundColor: Colors.bg4, gap: 2 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2,
    minHeight: 36,
  },
  pillActive: { borderColor: Colors.violet2, backgroundColor: Colors.violetD },
  pillHover: { transform: [{ translateY: -1 }], borderColor: Colors.border2 },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillLabel: { fontSize: 12, fontWeight: "600", color: Colors.ink2 },
  pillLabelActive: { color: Colors.violet3 },
  pillAmount: { fontSize: 12, fontWeight: "800", color: Colors.ink, fontVariant: ["tabular-nums"] as any },

  // Toolbar
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg3, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 9, flex: 1, minWidth: 220, maxWidth: 360 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.ink, outlineStyle: "none" } as any,
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  chipActive: { borderColor: Colors.violet3, backgroundColor: Colors.violetD },
  chipText: { fontSize: 12, fontWeight: "700", color: Colors.ink3 },
  chipTextActive: { color: Colors.violet3 },

  // Table
  tableHeadRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  th: { fontSize: 10, fontWeight: "800", color: Colors.ink3, letterSpacing: 0.8, textTransform: "uppercase" },
  thRight: { textAlign: "right" },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border2 },
  rowClient: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  rowName: { fontSize: 14, fontWeight: "600", color: Colors.ink },
  rowMeta: { fontSize: 11, color: Colors.ink3 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  rowBalance: { fontSize: 14, fontWeight: "800", textAlign: "right", fontVariant: ["tabular-nums"] as any },
  latePill: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  latePillText: { fontSize: 11, fontWeight: "700" },
  lateTextOk: { fontSize: 12, color: Colors.ink3 },
  rowActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 },
  actBtn: { width: 40, height: 40, borderRadius: 11, backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.35)", alignItems: "center", justifyContent: "center" },

  footerCount: { fontSize: 11, color: Colors.ink3, textAlign: "right", marginTop: 10 },
  emptyText: { fontSize: 13, color: Colors.ink3 },
});
