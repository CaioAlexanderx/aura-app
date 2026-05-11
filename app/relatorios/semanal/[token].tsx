// ============================================================
// AURA. — Pagina publica do relatorio semanal
// Acessada via link no email semanal: /relatorios/semanal/<token>
// Token JWT valido por 30 dias, validado pelo backend.
//
// Gating por plano (espelha o template do email):
//   Essencial   -> KPIs + curva diaria + top produtos + pagamentos + narrativas
//   Negocio+    -> + heatmap + clientes dormentes
//   Expansao+   -> + AI Insights banner
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  fetchWeeklyReport,
  type DailyRevenuePoint,
  type Priority,
  type TopProduct,
  type WeeklyReport,
  type WeeklyReportError,
} from "@/services/weeklyReportApi";

// ─── Constantes de design (alinhado ao email) ────────────────
const C = {
  bg:        "#08090f",
  card:      "#0f1019",
  cardAlt:   "#0c0d18",
  border:    "#1e293b",
  borderAcc: "#1e1b4b",
  text:      "#e2e8f0",
  textMuted: "#94a3b8",
  textDim:   "#64748b",
  textFaint: "#475569",
  brand:     "#7c3aed",
  brandSoft: "#c4b5fd",
  brandDark: "#4c1d95",
  good:      "#34d399",
  warn:      "#fbbf24",
  bad:       "#f87171",
};

// ─── Helpers ─────────────────────────────────────────────────
function fmtBRL(v: number, opts: { compact?: boolean } = {}): string {
  if (v == null || isNaN(v)) return "R$ 0,00";
  const n = Number(v);
  if (opts.compact && Math.abs(n) >= 1000) {
    if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
    if (Math.abs(n) >= 1_000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  }
  return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d),)/g, ".");
}

function stripHtml(s: string): string {
  return String(s || "").replace(/<[^>]+>/g, "");
}

function deltaColor(dir: "up" | "down" | string): string {
  if (dir === "up") return C.good;
  if (dir === "down") return C.bad;
  return C.textDim;
}

function deltaArrow(dir: "up" | "down" | string): string {
  if (dir === "up") return "↑";
  if (dir === "down") return "↓";
  return "·";
}

function healthColor(score: number): string {
  if (score >= 70) return C.good;
  if (score >= 40) return C.warn;
  return C.bad;
}

// ─── Pagina ──────────────────────────────────────────────────
export default function WeeklyReportPage() {
  const params = useLocalSearchParams();
  const token = String((params as any).token || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WeeklyReportError | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWeeklyReport(token).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setReport(r.data);
        setError(null);
        if (Platform.OS === "web" && typeof document !== "undefined") {
          document.title = `Relatório semanal — ${r.data.company.name}`;
        }
      } else {
        setError(r.error);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) return <LoadingView />;
  if (error || !report) return <ErrorView error={error || { code: "unknown", message: "Relatório indisponível." }} />;

  return <ReportView report={report} />;
}

// ─── Estados ─────────────────────────────────────────────────
function LoadingView() {
  return (
    <View style={styles.fullCenter}>
      <ActivityIndicator size="large" color={C.brand} />
      <Text style={[styles.muted, { marginTop: 16 }]}>Carregando relatório...</Text>
    </View>
  );
}

function ErrorView({ error }: { error: WeeklyReportError }) {
  const isExpired = error.code === "expired";
  const isInvalid = error.code === "invalid" || error.code === "missing_token";
  return (
    <View style={styles.fullCenter}>
      <View style={[styles.card, { maxWidth: 480, padding: 32, alignItems: "center" }]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>
          {isExpired ? "⏳" : isInvalid ? "🔒" : "⚠️"}
        </Text>
        <Text style={[styles.h2, { textAlign: "center", marginBottom: 8 }]}>
          {isExpired ? "Link expirado" : isInvalid ? "Link inválido" : "Erro ao carregar"}
        </Text>
        <Text style={[styles.muted, { textAlign: "center", marginBottom: 24 }]}>{error.message}</Text>
        <Pressable
          onPress={() => Linking.openURL("https://app.getaura.com.br")}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.buttonText}>Abrir painel completo</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Relatorio completo ──────────────────────────────────────
function ReportView({ report }: { report: WeeklyReport }) {
  const { company, period, kpis, health, daily_revenue, top_products, payments, priorities, wow_insight, narratives, heatmap, dormant, stale_products, gating } = report;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ alignItems: "center", paddingVertical: 32, paddingHorizontal: 16 }}>
      <View style={{ width: "100%", maxWidth: 760 }}>
        {/* Header */}
        <View style={[styles.card, { padding: 24, marginBottom: 16 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            {company.logo_url ? (
              <Image source={{ uri: company.logo_url }} style={{ width: 48, height: 48, borderRadius: 12, marginRight: 12 }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 12, marginRight: 12, backgroundColor: C.brandDark, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.brandSoft, fontSize: 20, fontWeight: "800" }}>{company.name.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.brandLabel}>Aura<Text style={{ color: C.brand }}>.</Text> · Relatório semanal</Text>
              <Text style={styles.h2}>{company.name}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
            <Pill icon="📅" label={period.label} />
            <Pill icon="#" label={`Edição ${period.edition}`} />
            <Pill icon="✉" label={period.sent_at} />
          </View>
        </View>

        {/* Health Score */}
        <View style={[styles.card, { padding: 24, marginBottom: 16, alignItems: "center" }]}>
          <Text style={[styles.caption, { marginBottom: 8 }]}>SAÚDE DO NEGÓCIO</Text>
          <Text style={{ color: healthColor(health.score), fontSize: 56, fontWeight: "800", lineHeight: 64 }}>
            {health.score}
            <Text style={{ color: C.textDim, fontSize: 22 }}>/100</Text>
          </Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>{health.label}</Text>
        </View>

        {/* KPI grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <KpiCard label="Receita"        value={fmtBRL(kpis.revenue)}                 deltaPct={kpis.revenue_delta}   dir={kpis.revenue_dir}   color={C.brandSoft} />
          <KpiCard label="Vendas"         value={String(kpis.sales)}                   deltaPct={null}                 dir="up"                 sublabel={`${kpis.active_days} dias ativos`} />
          <KpiCard label="Ticket médio"   value={fmtBRL(kpis.avg_ticket)}              deltaPct={kpis.ticket_delta}    dir={kpis.ticket_dir} />
          <KpiCard label="Clientes únicos" value={String(kpis.new_customers)}          deltaAbs={kpis.customers_delta} dir={kpis.customers_dir} />
        </View>

        {/* Daily Revenue Bar Chart */}
        <Section title="Receita por dia" subtitle="Comparativo entre os dias úteis da semana">
          <DailyChart data={daily_revenue} />
        </Section>

        {/* WOW Insight */}
        {wow_insight && (
          <View style={[styles.card, styles.wowCard, { padding: 20, marginBottom: 16 }]}>
            <View style={{ flexDirection: "row" }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.brandDark, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Text style={{ fontSize: 18 }}>{iconFor(wow_insight.icon_type)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.caption, { marginBottom: 4, color: C.brand }]}>INSIGHT DA SEMANA</Text>
                <Text style={[styles.body, { lineHeight: 22 }]}>{stripHtml(wow_insight.text)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Priorities */}
        {priorities && priorities.length > 0 && (
          <Section title="3 prioridades para a próxima semana">
            <View style={{ gap: 12 }}>
              {priorities.map((p) => (
                <PriorityRow key={p.num} priority={p} />
              ))}
            </View>
          </Section>
        )}

        {/* Narratives */}
        {narratives && (
          <Section title="Análise da semana">
            <NarrativeCard title="Receita & vendas" text={narratives.revenue} />
            <NarrativeCard title="Produtos" text={narratives.products} />
            <NarrativeCard title="Pagamentos" text={narratives.payments} />
          </Section>
        )}

        {/* Top Products */}
        {top_products && top_products.length > 0 && (
          <Section title="Top 5 produtos" subtitle="Produtos com maior receita na semana">
            <View style={{ gap: 8 }}>
              {top_products.map((p) => (
                <TopProductRow key={p.rank} product={p} />
              ))}
            </View>
          </Section>
        )}

        {/* Payments */}
        {payments && payments.length > 0 && (
          <Section title="Pagamentos" subtitle="Distribuição por método">
            <View style={{ gap: 10 }}>
              {payments.map((p) => (
                <PaymentBar key={p.name} name={p.name} pct={p.pct} />
              ))}
            </View>
          </Section>
        )}

        {/* Heatmap (Negocio+) */}
        {gating.show_heatmap && heatmap && heatmap.length > 0 && (
          <Section title="Mapa de calor de vendas" subtitle="Seg–Sáb × hora do dia (intensidade = vendas)">
            <Heatmap data={heatmap} />
          </Section>
        )}

        {/* Dormant customers (Negocio+) */}
        {gating.show_dormant && dormant && dormant.topDormant && dormant.topDormant.length > 0 && (
          <Section title="Clientes que sumiram" subtitle={`${dormant.count} cliente${dormant.count === 1 ? "" : "s"} sem comprar há mais de 30 dias`}>
            <View style={{ gap: 8 }}>
              {dormant.topDormant.slice(0, 3).map((c) => (
                <DormantRow key={c.id} customer={c} />
              ))}
            </View>
          </Section>
        )}

        {/* Stale products */}
        {stale_products && stale_products.length > 0 && (
          <Section title="Produtos parados" subtitle="Em estoque, sem venda há 14+ dias">
            <View style={{ gap: 8 }}>
              {stale_products.slice(0, 3).map((p) => (
                <StaleProductRow key={p.id} product={p} />
              ))}
            </View>
          </Section>
        )}

        {/* AI Insights placeholder (Expansao+) */}
        {gating.show_ai && (
          <View style={[styles.card, { padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.brand }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>✨</Text>
              <Text style={[styles.caption, { color: C.brand }]}>AI INSIGHTS · PLANO EXPANSÃO</Text>
            </View>
            <Text style={[styles.body, { lineHeight: 22 }]}>
              {narratives?.revenue || "Insights personalizados gerados por IA para esta semana."}
            </Text>
          </View>
        )}

        {/* CTA */}
        <View style={{ alignItems: "center", marginTop: 8, marginBottom: 24 }}>
          <Pressable
            onPress={() => Linking.openURL("https://app.getaura.com.br")}
            style={({ pressed }) => [styles.button, { paddingHorizontal: 28 }, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.buttonText}>Abrir painel completo →</Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View style={{ paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border, alignItems: "center" }}>
          <Text style={[styles.footer, { textAlign: "center" }]}>
            Aura<Text style={{ color: C.brand }}>.</Text> · Tecnologia para Negócios{"\n"}
            Relatório gerado automaticamente · Plano <Text style={{ textTransform: "capitalize" }}>{company.plan}</Text>
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────
function Pill({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.cardAlt, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
      <Text style={{ color: C.textDim, fontSize: 11, marginRight: 6 }}>{icon}</Text>
      <Text style={{ color: C.textMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { padding: 20, marginBottom: 16 }]}>
      <Text style={styles.h3}>{title}</Text>
      {subtitle ? <Text style={[styles.muted, { marginTop: 2, marginBottom: 16 }]}>{subtitle}</Text> : <View style={{ height: 12 }} />}
      {children}
    </View>
  );
}

function KpiCard({
  label, value, sublabel, deltaPct, deltaAbs, dir, color,
}: {
  label: string;
  value: string;
  sublabel?: string;
  deltaPct?: number | null;
  deltaAbs?: number | null;
  dir?: "up" | "down" | string;
  color?: string;
}) {
  const hasDelta = deltaPct != null || deltaAbs != null;
  return (
    <View style={[styles.card, { flexBasis: 0, flexGrow: 1, minWidth: 150, padding: 16 }]}>
      <Text style={styles.caption}>{label.toUpperCase()}</Text>
      <Text style={{ color: color || C.text, fontSize: 22, fontWeight: "800", marginTop: 6 }} numberOfLines={1}>{value}</Text>
      {hasDelta && dir && (
        <Text style={{ color: deltaColor(dir), fontSize: 12, marginTop: 4, fontWeight: "600" }}>
          {deltaArrow(dir)} {deltaPct != null ? `${Math.abs(deltaPct).toFixed(1)}%` : ""}
          {deltaAbs != null ? `${deltaAbs > 0 ? "+" : ""}${deltaAbs}` : ""}
          <Text style={{ color: C.textDim, fontWeight: "400" }}> vs sem. ant.</Text>
        </Text>
      )}
      {sublabel && !hasDelta && (
        <Text style={[styles.muted, { fontSize: 12, marginTop: 4 }]}>{sublabel}</Text>
      )}
    </View>
  );
}

function DailyChart({ data }: { data: DailyRevenuePoint[] }) {
  const max = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);
  const chartHeight = 160;
  return (
    <View>
      <View style={{ height: chartHeight, flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        {data.map((d) => {
          const h = Math.max(4, (d.value / max) * chartHeight);
          return (
            <View key={d.date} style={{ flex: 1, height: chartHeight, justifyContent: "flex-end" }}>
              <View style={{ height: h, backgroundColor: d.is_best ? C.brand : C.brandDark, borderRadius: 6, opacity: d.value === 0 ? 0.25 : 1 }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
        {data.map((d) => (
          <View key={d.date + "label"} style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: d.is_best ? C.brandSoft : C.textDim, fontSize: 11, fontWeight: d.is_best ? "700" : "400" }}>{d.day}</Text>
            <Text style={{ color: d.is_best ? C.text : C.textFaint, fontSize: 10, marginTop: 2 }} numberOfLines={1}>
              {fmtBRL(d.value, { compact: true })}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PriorityRow({ priority }: { priority: Priority }) {
  const txt = stripHtml(priority.text || priority.description || priority.title || "");
  return (
    <View style={{ flexDirection: "row" }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.brand, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{priority.num}</Text>
      </View>
      <View style={{ flex: 1, paddingTop: 4 }}>
        {priority.title && priority.text ? (
          <>
            <Text style={[styles.body, { fontWeight: "700", marginBottom: 4 }]}>{stripHtml(priority.title)}</Text>
            <Text style={[styles.muted, { lineHeight: 20 }]}>{txt}</Text>
          </>
        ) : (
          <Text style={[styles.body, { lineHeight: 22 }]}>{txt}</Text>
        )}
      </View>
    </View>
  );
}

function NarrativeCard({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.caption, { color: C.brandSoft, marginBottom: 4 }]}>{title.toUpperCase()}</Text>
      <Text style={[styles.body, { lineHeight: 22 }]}>{stripHtml(text)}</Text>
    </View>
  );
}

function TopProductRow({ product }: { product: TopProduct }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <Text style={{ color: C.textDim, fontSize: 12, width: 24 }}>#{product.rank}</Text>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[styles.body, { fontWeight: "600" }]} numberOfLines={1}>{product.name}</Text>
        <Text style={[styles.muted, { fontSize: 11, marginTop: 2 }]}>{product.category} · {product.qty} un.</Text>
      </View>
      <Text style={{ color: C.brandSoft, fontWeight: "700" }}>{fmtBRL(product.revenue, { compact: true })}</Text>
    </View>
  );
}

function PaymentBar({ name, pct }: { name: string; pct: number }) {
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={[styles.body, { fontSize: 13 }]}>{name}</Text>
        <Text style={{ color: C.brandSoft, fontWeight: "700", fontSize: 13 }}>{pct.toFixed(1)}%</Text>
      </View>
      <View style={{ height: 6, backgroundColor: C.cardAlt, borderRadius: 3, overflow: "hidden" }}>
        <View style={{ height: 6, width: `${Math.min(100, Math.max(0, pct))}%` as any, backgroundColor: C.brand, borderRadius: 3 }} />
      </View>
    </View>
  );
}

function Heatmap({ data }: { data: { dow: number; hour: number; sale_count: number; revenue: number }[] }) {
  // dow: 1=seg, ..., 6=sab. Mostrar horas 6-23 para evitar matriz vazia.
  const DAYS_LABELS = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 06h-23h
  const max = Math.max(...data.map((c) => c.sale_count), 1);
  const cellMap: Record<string, number> = {};
  data.forEach((c) => { cellMap[`${c.dow}-${c.hour}`] = c.sale_count; });
  return (
    <View>
      {/* Hour labels */}
      <View style={{ flexDirection: "row", marginBottom: 4, marginLeft: 36 }}>
        {hours.filter((h) => h % 3 === 0).map((h) => (
          <Text key={h} style={{ color: C.textFaint, fontSize: 9, flex: 1, textAlign: "center" }}>{h}h</Text>
        ))}
      </View>
      {[1, 2, 3, 4, 5, 6].map((dow) => (
        <View key={dow} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
          <Text style={{ color: C.textMuted, fontSize: 11, width: 32 }}>{DAYS_LABELS[dow]}</Text>
          <View style={{ flex: 1, flexDirection: "row", gap: 2 }}>
            {hours.map((h) => {
              const v = cellMap[`${dow}-${h}`] || 0;
              const intensity = v / max;
              return (
                <View
                  key={`${dow}-${h}`}
                  style={{
                    flex: 1,
                    height: 18,
                    borderRadius: 3,
                    backgroundColor: v === 0 ? C.cardAlt : `rgba(124, 58, 237, ${0.2 + intensity * 0.8})`,
                  }}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function DormantRow({ customer }: { customer: { name: string; total_spent: number; days_dormant: number } }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.brandDark, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <Text style={{ color: C.brandSoft, fontWeight: "700", fontSize: 13 }}>{(customer.name || "?").slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[styles.body, { fontWeight: "600" }]} numberOfLines={1}>{customer.name}</Text>
        <Text style={[styles.muted, { fontSize: 11, marginTop: 2 }]}>Histórico: {fmtBRL(customer.total_spent, { compact: true })}</Text>
      </View>
      <Text style={{ color: C.warn, fontWeight: "600", fontSize: 13 }}>{customer.days_dormant}d</Text>
    </View>
  );
}

function StaleProductRow({ product }: { product: { name: string; category: string; stock_qty: number; days_idle: number | null } }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.cardAlt, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <Text style={{ fontSize: 14 }}>📦</Text>
      </View>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[styles.body, { fontWeight: "600" }]} numberOfLines={1}>{product.name}</Text>
        <Text style={[styles.muted, { fontSize: 11, marginTop: 2 }]}>{product.category} · {product.stock_qty} em estoque</Text>
      </View>
      <Text style={{ color: C.bad, fontWeight: "600", fontSize: 13 }}>{product.days_idle != null ? `${product.days_idle}d` : "14+ d"}</Text>
    </View>
  );
}

function iconFor(t: string): string {
  if (t === "box") return "📦";
  if (t === "user") return "👤";
  if (t === "chart") return "📊";
  return "✨";
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  fullCenter: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    minHeight: Platform.OS === "web" ? ("100vh" as any) : undefined,
  },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderAcc,
    borderRadius: 16,
  },
  wowCard: {
    borderColor: C.brand,
    backgroundColor: C.cardAlt,
  },
  brandLabel: {
    color: C.textMuted,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  h2: {
    color: C.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  h3: {
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
  },
  body: {
    color: C.text,
    fontSize: 14,
  },
  muted: {
    color: C.textMuted,
    fontSize: 13,
  },
  caption: {
    color: C.textDim,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  footer: {
    color: C.textFaint,
    fontSize: 11,
    lineHeight: 18,
  },
  button: {
    backgroundColor: C.brand,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
