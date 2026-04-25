// ============================================================
// AURA. — IncomeDetail
// Visualizacao detalhada de receitas para a aba Visao Geral
// (espelha ExpenseDetail, mas em paleta verde/teal/violeta e
// com semantica invertida: subir e bom, descer e ruim)
// ============================================================
import { useMemo } from "react";
import { View, Text, StyleSheet, Platform, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import type { Transaction } from "./types";
import { fmt, fmtK } from "./types";

var isWeb = Platform.OS === "web";

// Paleta receita: verdes, teais e violeta (Claude Design)
var INCOME_PALETTE = [
  "#34d399", // emerald
  "#0d9488", // teal escuro
  "#22c55e", // green-500
  "#a78bfa", // violet 2 (acento compartilhado)
  "#10b981", // emerald-500
  "#06b6d4", // cyan-500
  "#14b8a6", // teal-500
  "#84cc16", // lime
];

var METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  credit: "Credito",
  debit: "Debito",
  voucher: "Vale",
  transfer: "Transferencia",
  boleto: "Boleto",
};

type Props = {
  transactions: Transaction[];
  previousIncome?: number | null;
};

export function IncomeDetail({ transactions, previousIncome }: Props) {
  var data = useMemo(function() {
    var incomes = transactions.filter(function(t) { return t.type === "income"; });
    if (incomes.length === 0) return null;

    var total = incomes.reduce(function(s, t) { return s + t.amount; }, 0);
    var avg = total / incomes.length;

    // --- Por categoria ---
    var byCat: Record<string, { total: number; count: number }> = {};
    incomes.forEach(function(t) {
      var k = t.category || "Outros";
      if (!byCat[k]) byCat[k] = { total: 0, count: 0 };
      byCat[k].total += t.amount;
      byCat[k].count++;
    });
    var cats = Object.keys(byCat).map(function(k) {
      return { name: k, total: byCat[k].total, count: byCat[k].count, pct: total > 0 ? (byCat[k].total / total) * 100 : 0 };
    }).sort(function(a, b) { return b.total - a.total; });

    // --- Top 5 recebimentos ---
    var top = incomes.slice().sort(function(a, b) { return b.amount - a.amount; }).slice(0, 5);

    // --- Tendencia diaria (ate 30 dias com lancamento) ---
    var byDay: Record<string, number> = {};
    incomes.forEach(function(t) {
      var raw = t.due_date || t.created_at || "";
      if (!raw) return;
      var d = new Date(raw);
      if (isNaN(d.getTime())) return;
      var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      byDay[key] = (byDay[key] || 0) + t.amount;
    });
    var sortedDays = Object.keys(byDay).sort();
    var daily = sortedDays.slice(-30).map(function(k) {
      var d = new Date(k + "T00:00:00");
      return {
        key: k,
        label: String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"),
        value: byDay[k],
        dayOfMonth: d.getDate(),
      };
    });

    // --- A receber timeline ---
    // Atrasadas = cliente devendo vencido (vermelho — alerta)
    // Esta semana / Este mes = boa noticia, dinheiro entrando (verde / teal)
    // Futuras = mais distante (violeta)
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var weekEnd = new Date(todayStart); weekEnd.setDate(todayStart.getDate() + 7);
    var monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    var buckets = {
      overdue: { c: 0, t: 0 },
      week: { c: 0, t: 0 },
      month: { c: 0, t: 0 },
      future: { c: 0, t: 0 },
    };
    incomes.forEach(function(t) {
      if (t.status !== "pending") return;
      var raw = t.due_date || t.created_at || "";
      var d = raw ? new Date(raw) : null;
      if (!d || isNaN(d.getTime())) {
        buckets.future.c++; buckets.future.t += t.amount; return;
      }
      if (d < todayStart) { buckets.overdue.c++; buckets.overdue.t += t.amount; }
      else if (d <= weekEnd) { buckets.week.c++; buckets.week.t += t.amount; }
      else if (d <= monthEnd) { buckets.month.c++; buckets.month.t += t.amount; }
      else { buckets.future.c++; buckets.future.t += t.amount; }
    });
    var totalPending = buckets.overdue.t + buckets.week.t + buckets.month.t + buckets.future.t;

    // --- Forma de recebimento ---
    var byMethod: Record<string, { total: number; count: number }> = {};
    incomes.forEach(function(t) {
      if (!t.payment_method) return;
      var m = t.payment_method;
      if (!byMethod[m]) byMethod[m] = { total: 0, count: 0 };
      byMethod[m].total += t.amount;
      byMethod[m].count++;
    });
    var totalWithMethod = Object.keys(byMethod).reduce(function(s, k) { return s + byMethod[k].total; }, 0);
    var methods = Object.keys(byMethod).map(function(k) {
      return {
        name: k,
        total: byMethod[k].total,
        count: byMethod[k].count,
        pct: totalWithMethod > 0 ? (byMethod[k].total / totalWithMethod) * 100 : 0,
      };
    }).sort(function(a, b) { return b.total - a.total; });

    var received = incomes.filter(function(t) { return t.status === "confirmed"; }).reduce(function(s, t) { return s + t.amount; }, 0);

    return { total: total, avg: avg, count: incomes.length, cats: cats, top: top, daily: daily, buckets: buckets, totalPending: totalPending, methods: methods, received: received };
  }, [transactions]);

  if (!data) {
    return (
      <View style={s.empty}>
        <View style={s.emptyIconWrap}><Text style={s.emptyIcon}>+</Text></View>
        <Text style={s.emptyTitle}>Nenhuma receita no periodo</Text>
        <Text style={s.emptyHint}>Quando voce lancar receitas, esta area trara o detalhamento completo.</Text>
      </View>
    );
  }

  var delta: number | null = previousIncome != null && previousIncome > 0
    ? ((data.total - previousIncome) / previousIncome) * 100
    : null;

  // Receita: subir e bom (verde/up), descer e ruim (vermelho/down)
  var deltaIsGood = delta != null && delta >= 0;

  return (
    <View style={s.container}>
      {/* HEADER — total + delta + strip de KPIs */}
      <View style={s.headerCard}>
        {isWeb ? (
          <div style={{ position: "absolute", top: -90, right: -90, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.22), transparent 70%)", pointerEvents: "none" } as any} />
        ) : (
          <View style={s.headerOrb} />
        )}
        <View style={s.headerContent}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.headerLabel}>Receitas no periodo</Text>
              <Text style={s.headerValue}>{fmt(data.total)}</Text>
            </View>
            {delta != null && (
              <View style={[s.deltaPill, deltaIsGood ? s.deltaPillGood : s.deltaPillBad]}>
                <Text style={[s.deltaPillText, { color: deltaIsGood ? Colors.green : Colors.red }]}>
                  {deltaIsGood ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                </Text>
                <Text style={s.deltaPillHint}>vs anterior</Text>
              </View>
            )}
          </View>
          <View style={s.headerStrip}>
            <View style={s.headerStripCell}>
              <Text style={s.headerStripLabel}>Lancamentos</Text>
              <Text style={s.headerStripValue}>{data.count}</Text>
            </View>
            <View style={s.headerStripDivider} />
            <View style={s.headerStripCell}>
              <Text style={s.headerStripLabel}>Ticket medio</Text>
              <Text style={s.headerStripValue}>{fmtK(data.avg)}</Text>
            </View>
            <View style={s.headerStripDivider} />
            <View style={s.headerStripCell}>
              <Text style={s.headerStripLabel}>Recebido</Text>
              <Text style={[s.headerStripValue, { color: Colors.green }]}>{fmtK(data.received)}</Text>
            </View>
            <View style={s.headerStripDivider} />
            <View style={s.headerStripCell}>
              <Text style={s.headerStripLabel}>A receber</Text>
              <Text style={[s.headerStripValue, { color: Colors.amber }]}>{fmtK(data.totalPending)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* CATEGORIAS — donut + ranking */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Categorias de receita</Text>
            <Text style={s.cardHint}>De onde o dinheiro esta vindo</Text>
          </View>
          <View style={s.cardBadge}>
            <Text style={s.cardBadgeText}>{data.cats.length} categoria{data.cats.length > 1 ? "s" : ""}</Text>
          </View>
        </View>
        <CategorySection cats={data.cats} total={data.total} />
      </View>

      {/* TENDENCIA DIARIA */}
      {data.daily.length >= 3 && (
        <View style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Receitas por dia</Text>
              <Text style={s.cardHint}>Ultimos {data.daily.length} dias com lancamento</Text>
            </View>
          </View>
          <DailyTrend daily={data.daily} />
        </View>
      )}

      {/* TOP 5 INDIVIDUAIS */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Maiores recebimentos</Text>
            <Text style={s.cardHint}>Top 5 lancamentos por valor</Text>
          </View>
        </View>
        <TopIncomes top={data.top} max={data.top[0]?.amount || 1} />
      </View>

      {/* A RECEBER TIMELINE */}
      {data.totalPending > 0 && (
        <View style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>A receber — linha do tempo</Text>
              <Text style={s.cardHint}>Distribuicao das receitas pendentes</Text>
            </View>
            <View style={[s.cardBadge, { backgroundColor: Colors.greenD, borderColor: Colors.green + "40" }]}>
              <Text style={[s.cardBadgeText, { color: Colors.green }]}>{fmtK(data.totalPending)}</Text>
            </View>
          </View>
          <ReceivableTimeline buckets={data.buckets} total={data.totalPending} />
        </View>
      )}

      {/* FORMAS DE RECEBIMENTO */}
      {data.methods.length > 0 && (
        <View style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Formas de recebimento</Text>
              <Text style={s.cardHint}>Como as receitas foram recebidas</Text>
            </View>
          </View>
          <MethodsBars methods={data.methods} />
        </View>
      )}
    </View>
  );
}

// ============================================================
// SUB: Categorias — donut SVG (web) + lista com barras
// ============================================================
function CategorySection({ cats, total }: { cats: { name: string; total: number; count: number; pct: number }[]; total: number }) {
  if (cats.length === 0) return null;

  if (!isWeb) {
    return (
      <View style={{ marginTop: 12, gap: 12 }}>
        {cats.map(function(c, i) {
          var clr = INCOME_PALETTE[i % INCOME_PALETTE.length];
          return (
            <View key={c.name}>
              <View style={cs.catItemHead}>
                <View style={[cs.catDot, { backgroundColor: clr }]} />
                <Text style={cs.catName} numberOfLines={1}>{c.name}</Text>
                <Text style={cs.catPct}>{c.pct.toFixed(1)}%</Text>
              </View>
              <View style={cs.catBarBg}>
                <View style={[cs.catBarFill, { width: (Math.max(c.pct, 1)) + "%", backgroundColor: clr }]} />
              </View>
              <View style={cs.catFooterRow}>
                <Text style={cs.catCount}>{c.count} lanc.</Text>
                <Text style={cs.catTotal}>{fmt(c.total)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  var size = 180, cx = 90, cy = 90, r = 70, sw = 26;
  var circ = 2 * Math.PI * r;
  var offset = 0;
  var slices = cats.map(function(c, i) {
    var pct = total > 0 ? c.total / total : 0;
    var dash = circ * pct;
    var gap = circ - dash;
    var o = offset; offset += dash;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INCOME_PALETTE[i % INCOME_PALETTE.length]}" stroke-width="${sw}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-o}" opacity="0.92"/>`;
  }).join("");
  var svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);filter:drop-shadow(0 4px 12px rgba(52,211,153,0.20))">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${Colors.bg4}" stroke-width="${sw}"/>
    ${slices}
  </svg>`;
  var center = `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none">
    <div style="font-size:9px;color:${Colors.ink3};font-weight:700;letter-spacing:0.6px;text-transform:uppercase">Total</div>
    <div style="font-size:18px;font-weight:800;color:${Colors.ink};margin-top:3px;font-variant-numeric:tabular-nums">${fmtK(total)}</div>
  </div>`;

  return (
    <View style={cs.catWrap}>
      <View style={cs.catDonutWrap}>
        <div style={{ width: size, height: size, position: "relative", flexShrink: 0 } as any}
          dangerouslySetInnerHTML={{ __html: svg + center }} />
      </View>
      <View style={cs.catList}>
        {cats.map(function(c, i) {
          var clr = INCOME_PALETTE[i % INCOME_PALETTE.length];
          return (
            <View key={c.name} style={{ marginBottom: 4 }}>
              <View style={cs.catItemHead}>
                <View style={[cs.catDot, { backgroundColor: clr }]} />
                <Text style={cs.catName} numberOfLines={1}>{c.name}</Text>
                <Text style={cs.catPct}>{c.pct.toFixed(1)}%</Text>
              </View>
              <View style={cs.catBarBg}>
                <View style={[cs.catBarFill, { width: Math.max(c.pct, 1) + "%", backgroundColor: clr }]} />
              </View>
              <View style={cs.catFooterRow}>
                <Text style={cs.catCount}>{c.count} lanc.</Text>
                <Text style={cs.catTotal}>{fmt(c.total)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================
// SUB: Tendencia diaria — barras SVG com gradient + linha de media
// ============================================================
function DailyTrend({ daily }: { daily: { key: string; label: string; value: number; dayOfMonth: number }[] }) {
  var max = Math.max.apply(null, daily.map(function(d) { return d.value; }).concat([1]));
  var avg = daily.reduce(function(s, d) { return s + d.value; }, 0) / daily.length;

  if (!isWeb) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, paddingVertical: 8, paddingHorizontal: 4 }}>
          {daily.map(function(d) {
            var h = Math.max((d.value / max) * 120, 4);
            return (
              <View key={d.key} style={{ alignItems: "center", gap: 4, width: 22 }}>
                <View style={{ height: h, width: 14, borderRadius: 4, backgroundColor: "#34d399", opacity: 0.85 }} />
                <Text style={{ fontSize: 8, color: Colors.ink3, fontWeight: "500" }}>{String(d.dayOfMonth).padStart(2, "0")}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  var W = Math.max(daily.length * 24 + 60, 360);
  var H = 170, pad = 28, chartH = H - pad - 22;
  var stepX = (W - 50) / daily.length;
  var barW = Math.min(stepX - 6, 18);
  var avgY = pad + chartH - (avg / max) * chartH;

  var grid = "";
  for (var i = 0; i <= 4; i++) {
    var y = pad + (chartH / 4) * i;
    var v = max - (max / 4) * i;
    grid += `<line x1="40" y1="${y}" x2="${W - 4}" y2="${y}" stroke="${Colors.border}" stroke-width="0.5" stroke-dasharray="3 3"/>`;
    grid += `<text x="36" y="${y + 3}" fill="${Colors.ink3}" font-size="8" text-anchor="end" font-family="sans-serif">${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v.toFixed(0)}</text>`;
  }

  var bars = daily.map(function(d, idx) {
    var x = 45 + idx * stepX;
    var h = Math.max((d.value / max) * chartH, 2);
    var by = pad + chartH - h;
    var bx = x + (stepX - barW) / 2;
    var isPeak = d.value === max;
    return `<g>
      <rect x="${bx}" y="${by}" width="${barW}" height="${h}" rx="3" fill="url(#incGrad${isPeak ? "Peak" : (idx % 2 === 0 ? "A" : "B")})"/>
      ${isPeak ? `<circle cx="${bx + barW / 2}" cy="${by - 4}" r="2.5" fill="#34d399"/>` : ""}
    </g>`;
  }).join("");

  var step = daily.length > 14 ? Math.ceil(daily.length / 8) : Math.max(1, Math.ceil(daily.length / 14));
  var labels = daily.map(function(d, idx) {
    if (idx % step !== 0 && idx !== daily.length - 1) return "";
    var x = 45 + idx * stepX + stepX / 2;
    return `<text x="${x}" y="${H - 4}" fill="${Colors.ink3}" font-size="8" text-anchor="middle" font-family="sans-serif">${d.label}</text>`;
  }).join("");

  var avgLine = avg > 0 ? `
    <line x1="40" y1="${avgY}" x2="${W - 4}" y2="${avgY}" stroke="#a78bfa" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.75"/>
    <rect x="${W - 110}" y="${avgY - 14}" width="105" height="12" rx="3" fill="${Colors.bg4}" opacity="0.95"/>
    <text x="${W - 8}" y="${avgY - 5}" fill="#a78bfa" font-size="9" font-weight="700" text-anchor="end" font-family="sans-serif">media ${fmtK(avg).replace("R$ ", "R$ ")}</text>
  ` : "";

  var defs = `<defs>
    <linearGradient id="incGradPeak" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#34d399" stop-opacity="1"/>
      <stop offset="100%" stop-color="#0d9488" stop-opacity="0.7"/>
    </linearGradient>
    <linearGradient id="incGradA" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#34d399" stop-opacity="0.45"/>
    </linearGradient>
    <linearGradient id="incGradB" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d9488" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#0d9488" stop-opacity="0.45"/>
    </linearGradient>
  </defs>`;

  var svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${grid}${bars}${avgLine}${labels}</svg>`;

  return (
    <View style={{ marginTop: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </ScrollView>
      <View style={dt.legend}>
        <View style={dt.legendItem}>
          <View style={[dt.legendDot, { backgroundColor: "#34d399" }]} />
          <Text style={dt.legendText}>Receita diaria</Text>
        </View>
        <View style={dt.legendItem}>
          <View style={[dt.legendBar, { backgroundColor: "#a78bfa" }]} />
          <Text style={dt.legendText}>Media do periodo</Text>
        </View>
      </View>
    </View>
  );
}

// ============================================================
// SUB: Top 5 individuais — ranked rows
// ============================================================
function TopIncomes({ top, max }: { top: Transaction[]; max: number }) {
  return (
    <View style={{ marginTop: 12, gap: 12 }}>
      {top.map(function(t, i) {
        var pct = max > 0 ? (t.amount / max) * 100 : 0;
        var dateStr = t.due_date
          ? new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
          : t.date;
        return (
          <View key={t.id} style={topS.row}>
            <View style={[topS.rank, i === 0 && topS.rankFirst]}>
              <Text style={[topS.rankNum, i === 0 && topS.rankNumFirst]}>{i + 1}</Text>
            </View>
            <View style={topS.body}>
              <View style={topS.headRow}>
                <Text style={topS.desc} numberOfLines={1}>{t.desc}</Text>
                <Text style={topS.amount}>{fmt(t.amount)}</Text>
              </View>
              <View style={topS.barBg}>
                <View style={[topS.barFill, { width: Math.max(pct, 4) + "%" }]} />
              </View>
              <View style={topS.metaRow}>
                <View style={topS.metaCatPill}>
                  <Text style={topS.metaCatText}>{t.category}</Text>
                </View>
                <Text style={topS.metaDate}>{dateStr}</Text>
                {t.status === "pending" && (
                  <View style={topS.metaPendingPill}>
                    <Text style={topS.metaPendingText}>a receber</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ============================================================
// SUB: A receber timeline — stacked bar + grid de buckets
// ============================================================
type BucketsT = {
  overdue: { c: number; t: number };
  week: { c: number; t: number };
  month: { c: number; t: number };
  future: { c: number; t: number };
};

function ReceivableTimeline({ buckets, total }: { buckets: BucketsT; total: number }) {
  // Para receita: atrasada = vermelho (cliente devendo, alerta);
  // proximas semanas/mes = verde/teal (boa noticia entrando);
  // futuras = violeta (mais distante)
  var items = [
    { key: "overdue", label: "Atrasadas", hint: "cliente em atraso", color: "#f87171", data: buckets.overdue },
    { key: "week", label: "Esta semana", hint: "prox. 7 dias", color: "#34d399", data: buckets.week },
    { key: "month", label: "Este mes", hint: "ainda neste mes", color: "#0d9488", data: buckets.month },
    { key: "future", label: "Futuras", hint: "depois deste mes", color: "#a78bfa", data: buckets.future },
  ];

  return (
    <View style={{ marginTop: 12, gap: 14 }}>
      <View style={tlS.stackBar}>
        {items.map(function(it) {
          if (it.data.t <= 0) return null;
          var w = (it.data.t / total) * 100;
          return <View key={it.key} style={[tlS.stackSeg, { backgroundColor: it.color, width: w + "%" }]} />;
        })}
      </View>

      <View style={tlS.grid}>
        {items.map(function(it) {
          var pct = total > 0 ? (it.data.t / total) * 100 : 0;
          var dim = it.data.c === 0;
          return (
            <View key={it.key} style={[tlS.cell, dim && { opacity: 0.42 }]}>
              <View style={[tlS.cellAccent, { backgroundColor: it.color }]} />
              <View style={tlS.cellHead}>
                <View style={[tlS.cellDot, { backgroundColor: it.color }]} />
                <Text style={tlS.cellLabel}>{it.label}</Text>
              </View>
              <Text style={tlS.cellHint}>{it.hint}</Text>
              <Text style={[tlS.cellValue, { color: dim ? Colors.ink3 : it.color }]}>{fmtK(it.data.t)}</Text>
              <View style={tlS.cellFoot}>
                <Text style={tlS.cellCount}>{it.data.c} lanc.</Text>
                <Text style={tlS.cellPct}>{pct.toFixed(0)}%</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================
// SUB: Formas de recebimento — barras horizontais
// ============================================================
function MethodsBars({ methods }: { methods: { name: string; total: number; count: number; pct: number }[] }) {
  var maxPct = Math.max.apply(null, methods.map(function(m) { return m.pct; }).concat([1]));
  return (
    <View style={{ marginTop: 12, gap: 12 }}>
      {methods.map(function(m, i) {
        var label = METHOD_LABELS[m.name] || m.name;
        var clr = INCOME_PALETTE[i % INCOME_PALETTE.length];
        return (
          <View key={m.name}>
            <View style={mthS.head}>
              <View style={mthS.headLeft}>
                <View style={[mthS.headDot, { backgroundColor: clr }]} />
                <Text style={mthS.label}>{label}</Text>
              </View>
              <Text style={mthS.value}>{fmt(m.total)}</Text>
            </View>
            <View style={mthS.barBg}>
              <View style={[mthS.barFill, { width: Math.max((m.pct / maxPct) * 100, 3) + "%", backgroundColor: clr }]} />
            </View>
            <View style={mthS.foot}>
              <Text style={mthS.foot1}>{m.count} lanc.</Text>
              <Text style={mthS.foot2}>{m.pct.toFixed(1)}% do total</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
var s = StyleSheet.create({
  container: { marginBottom: 24, gap: 12 },

  empty: { padding: 24, backgroundColor: Colors.bg3, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 20, alignItems: "center" },
  emptyIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  emptyIcon: { fontSize: 18, color: Colors.ink3, fontWeight: "800" },
  emptyTitle: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  emptyHint: { fontSize: 11, color: Colors.ink3, marginTop: 4, textAlign: "center" },

  headerCard: { backgroundColor: Colors.bg3, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.border, position: "relative", overflow: "hidden" },
  headerOrb: { position: "absolute", top: -80, right: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(52,211,153,0.10)" } as any,
  headerContent: { position: "relative" } as any,
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  headerLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  headerValue: { fontSize: 30, fontWeight: "800", color: Colors.ink, marginTop: 4, ...(isWeb ? ({ fontVariantNumeric: "tabular-nums" } as any) : {}) },

  deltaPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, alignItems: "flex-end" },
  deltaPillGood: { backgroundColor: Colors.greenD, borderColor: Colors.green + "40" },
  deltaPillBad: { backgroundColor: Colors.redD, borderColor: Colors.red + "40" },
  deltaPillText: { fontSize: 12, fontWeight: "800" },
  deltaPillHint: { fontSize: 9, color: Colors.ink3, fontWeight: "600", marginTop: 1 },

  headerStrip: { flexDirection: "row", marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: "center" },
  headerStripCell: { flex: 1, alignItems: "flex-start" },
  headerStripDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  headerStripLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  headerStripValue: { fontSize: 14, color: Colors.ink, fontWeight: "800", marginTop: 4, ...(isWeb ? ({ fontVariantNumeric: "tabular-nums" } as any) : {}) },

  card: { backgroundColor: Colors.bg3, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontSize: 14, color: Colors.ink, fontWeight: "700" },
  cardHint: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
  cardBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  cardBadgeText: { fontSize: 10, color: Colors.violet3, fontWeight: "700" },
});

var cs = StyleSheet.create({
  catWrap: { flexDirection: "row", marginTop: 14, gap: 18, alignItems: "center", flexWrap: "wrap" },
  catDonutWrap: { width: 180, height: 180, position: "relative" } as any,
  catList: { flex: 1, minWidth: 220, gap: 10 },
  catItemHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { flex: 1, fontSize: 12, color: Colors.ink, fontWeight: "600" },
  catPct: { fontSize: 12, color: Colors.ink, fontWeight: "800", ...(isWeb ? ({ fontVariantNumeric: "tabular-nums" } as any) : {}) },
  catBarBg: { height: 6, borderRadius: 3, backgroundColor: Colors.bg4, overflow: "hidden" },
  catBarFill: { height: 6, borderRadius: 3 },
  catFooterRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  catCount: { fontSize: 10, color: Colors.ink3 },
  catTotal: { fontSize: 11, color: Colors.ink2, fontWeight: "700", ...(isWeb ? ({ fontVariantNumeric: "tabular-nums" } as any) : {}) },
});

var dt = StyleSheet.create({
  legend: { flexDirection: "row", gap: 16, marginTop: 8, justifyContent: "center", flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendBar: { width: 14, height: 2, borderRadius: 1 },
  legendText: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
});

var topS = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  rank: { width: 30, height: 30, borderRadius: 9, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  rankFirst: { backgroundColor: "rgba(52,211,153,0.14)", borderColor: "rgba(52,211,153,0.40)" },
  rankNum: { fontSize: 13, color: Colors.ink2, fontWeight: "800" },
  rankNumFirst: { color: "#34d399" },
  body: { flex: 1 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  desc: { flex: 1, fontSize: 12, color: Colors.ink, fontWeight: "600", paddingRight: 8 },
  amount: { fontSize: 13, color: Colors.green, fontWeight: "800", ...(isWeb ? ({ fontVariantNumeric: "tabular-nums" } as any) : {}) },
  barBg: { height: 5, borderRadius: 3, backgroundColor: Colors.bg4, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 3, backgroundColor: "#34d399" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6, flexWrap: "wrap" },
  metaCatPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  metaCatText: { fontSize: 9, color: Colors.violet3, fontWeight: "700" },
  metaDate: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
  metaPendingPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: Colors.greenD, borderWidth: 1, borderColor: Colors.green + "40" },
  metaPendingText: { fontSize: 9, color: Colors.green, fontWeight: "700" },
});

var tlS = StyleSheet.create({
  stackBar: { flexDirection: "row", height: 12, borderRadius: 6, backgroundColor: Colors.bg4, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  stackSeg: { height: 12 },
  grid: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  cell: { flex: 1, minWidth: 140, padding: 14, paddingLeft: 16, borderRadius: 14, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, position: "relative", overflow: "hidden" },
  cellAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  cellHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  cellDot: { width: 8, height: 8, borderRadius: 4 },
  cellLabel: { fontSize: 11, color: Colors.ink, fontWeight: "700" },
  cellHint: { fontSize: 9, color: Colors.ink3, marginTop: 2 },
  cellValue: { fontSize: 17, fontWeight: "800", marginTop: 8, ...(isWeb ? ({ fontVariantNumeric: "tabular-nums" } as any) : {}) },
  cellFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  cellCount: { fontSize: 10, color: Colors.ink3 },
  cellPct: { fontSize: 10, color: Colors.ink3, fontWeight: "700" },
});

var mthS = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headDot: { width: 9, height: 9, borderRadius: 4.5 },
  label: { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  value: { fontSize: 12, color: Colors.ink, fontWeight: "800", ...(isWeb ? ({ fontVariantNumeric: "tabular-nums" } as any) : {}) },
  barBg: { height: 8, borderRadius: 4, backgroundColor: Colors.bg4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  foot: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  foot1: { fontSize: 10, color: Colors.ink3 },
  foot2: { fontSize: 10, color: Colors.ink3, fontWeight: "600" },
});

export default IncomeDetail;
