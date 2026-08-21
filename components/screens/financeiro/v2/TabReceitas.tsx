// components/screens/financeiro/v2/TabReceitas.tsx
//
// Aba "Receitas" do Financeiro v2. Onda 2: KPI Strip + tendencia diaria +
// breakdown por categoria (cliente) + Top 5 + formas de pagamento + timeline
// a receber + dia da semana (do server, via useFinancialInsights).
//
// Onda 3 vai adicionar: ranking profissionais (employees JOIN), evolucao 12m.
// Multi-CNPJ aware: passa flag pros componentes mostrarem badges/dicas.
//
// 24/08/2026 (F4/F5): a curva ABC saiu daqui pra /financeiro/produtos (era uma
// mini-tela de 610 linhas, com seletor de periodo proprio concorrendo com o
// global) — restou o card-link no fim. Os cards secundarios passaram a abrir
// sob demanda em CollapsibleSection.
//
// 06/05/2026: parseDateLocal corrige bug de timezone em dailyIncomeSeries
// (due_date como '2026-05-06' virava 5/maio em BRT) + tooltips no hover
// das barras e categorias via title= (web only).
//
// 07/05/2026: FIX barras invisíveis — track recebia flex:1 dentro de pai
// sem altura definida (alignItems:flex-end no container → barCol só cresce
// até o conteúdo do texto → flex:1 resolve 0px → height:"X%" fica 0px).
// Solução: track com height explícita (118px); container sem height/alignItems.

import { View, Text, StyleSheet, Platform, Pressable, useWindowDimensions } from "react-native";
import type { DimensionValue } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { Transaction } from "../types";
import { fmt, fmtK, parseDateLocal } from "../types";
import { useMemo } from "react";
import { useFinancialInsights } from "@/hooks/useFinancialInsights";
import { Top5List, HBarList, Timeline, DowBars } from "./SharedCards";
// Onda 3: ranking de profissionais (a evolucao 12m vive so em Despesas)
import { ProfessionalsRanking } from "./Onda3Cards";
// F5 (24/08/2026): cards secundarios agora abrem sob demanda.
import { CollapsibleSection } from "../CollapsibleSection";

var isWeb = Platform.OS === "web";

// FIX M8 (QA pos-F7): os breakpoints liam Dimensions.get no escopo do modulo,
// congelados no primeiro load — e NARROW ainda era consumido dentro de
// StyleSheet.create, entao os KPI cards nunca reagiam a resize ou rotacao.
// Agora saem de useWindowDimensions e o estilo dependente vai inline.

// Tooltip nativo do browser via title= (RN-Web). No native ignora.
function tip(text: string): any {
  return Platform.OS === "web" ? { title: text } : {};
}

type Summary = { income: number; expenses: number; balance: number; pendingIncome?: number; pendingExpenses?: number };

type Props = {
  transactions: Transaction[];
  summary: Summary;
  previousSummary?: Summary | null;
  period: string;
  consolidated: boolean;
  // Leva pra aba Lancamentos: e la que estao os nomes por tras dos prazos.
  onSeeItems?: () => void;
};

function groupIncomeByCategory(txs: Transaction[]): { label: string; value: number; pct: number }[] {
  var groups: Record<string, number> = {};
  txs.filter(function(t) { return t.type === "income" && t.status === "confirmed"; })
    .forEach(function(t) { groups[t.category || "Outros"] = (groups[t.category || "Outros"] || 0) + t.amount; });
  var total = Object.values(groups).reduce(function(s, v) { return s + v; }, 0);
  var rows = Object.keys(groups).map(function(k) { return { label: k, value: groups[k], pct: total > 0 ? (groups[k] / total) * 100 : 0 }; });
  rows.sort(function(a, b) { return b.value - a.value; });
  return rows.slice(0, 6);
}

function dailyIncomeSeries(txs: Transaction[]): { day: number; value: number }[] {
  var map: Record<number, number> = {};
  txs.filter(function(t) { return t.type === "income" && t.status === "confirmed"; })
    .forEach(function(t) {
      var raw = (t as any).due_date || (t as any).created_at;
      if (!raw) return;
      // FIX 06/05/2026 (timezone): parseDateLocal evita o shift de 1 dia
      // em date-only strings (UTC midnight -> BRT 21h dia anterior).
      var d = parseDateLocal(raw);
      if (isNaN(d.getTime())) return;
      var k = d.getDate();
      map[k] = (map[k] || 0) + t.amount;
    });
  return Object.keys(map).sort(function(a, b) { return Number(a) - Number(b); }).map(function(k) {
    return { day: Number(k), value: map[Number(k)] };
  });
}

export function TabReceitas({ transactions, summary, previousSummary, period, consolidated, onSeeItems }: Props) {
  var { width: vw } = useWindowDimensions();
  var NARROW = vw < 480;
  var IS_WIDE = vw > 768;
  // FIX M3 (24/08/2026): o ticket medio dividia summary.income — que soma so
  // lancamentos CONFIRMADOS — pela contagem de todas as receitas, incluindo
  // pendentes. Com pendencia no periodo o ticket saia sistematicamente
  // subestimado. Numerador e denominador agora falam do mesmo conjunto.
  var confirmedIncomeCount = useMemo(function() {
    return transactions.filter(function(t) { return t.type === "income" && t.status === "confirmed"; }).length;
  }, [transactions]);
  var avgTicket = confirmedIncomeCount > 0 ? summary.income / confirmedIncomeCount : 0;

  var incomeDelta = previousSummary && previousSummary.income > 0
    ? ((summary.income - previousSummary.income) / previousSummary.income) * 100
    : null;

  var collected = summary.income;

  // Insights enriquecidos (Onda 2): top5, payment_methods, timeline, dow do server
  var insights = useFinancialInsights({
    transactions: transactions,
    summary: summary,
    previousSummary: previousSummary,
    period: period,
  });
  var ib = insights.income_breakdown;

  // FIX 24/08/2026 (QA no app rodando): o KPI usava summary.pendingIncome, que
  // conta so o que vence DENTRO do periodo selecionado, enquanto a timeline
  // logo abaixo soma todo o horizonte (atrasadas de meses anteriores +
  // futuras). O resultado aparecia lado a lado se contradizendo: "A receber
  // R$ 0,00" com "Atrasadas R$ 434,51" dois centimetros abaixo.
  //
  // "A receber" sem qualificador significa "quanto me devem", nao "quanto
  // vence neste mes" — entao o KPI passa a somar os mesmos baldes da timeline
  // quando ela existe, e so cai no valor do periodo como fallback.
  var receivable = useMemo(function() {
    var t = ib?.timeline;
    if (!t) return summary.pendingIncome || 0;
    return (t.atrasadas?.total || 0) + (t.esta_semana?.total || 0)
         + (t.este_mes?.total || 0) + (t.futuras?.total || 0);
  }, [ib, summary.pendingIncome]);

  var categories = useMemo(function() { return groupIncomeByCategory(transactions); }, [transactions]);
  var topCategoryColor = ["#7c3aed", "#a78bfa", "#34d399", "#5b8cff", "#fbbf24", "#f87171"];

  var daily = useMemo(function() { return dailyIncomeSeries(transactions); }, [transactions]);
  var maxDaily = Math.max(1, ...daily.map(function(d) { return d.value; }));
  var avgDaily = daily.length > 0 ? daily.reduce(function(s, d) { return s + d.value; }, 0) / daily.length : 0;

  // F5 (24/08/2026): a aba tinha 10 cards empilhados, todos abertos. Agora a
  // primeira dobra responde "quanto entrou e quem me deve"; o resto abre sob
  // demanda. O CollapsibleSection persiste aberto/fechado por id, entao quem
  // usa um card toda semana o mantem aberto.
  return (
    <View>
      {/* === PRIMEIRA DOBRA === */}
      <View style={[s.kpiStrip, NARROW ? s.kpiStripNarrow : null]}>
        <KpiCard narrow={NARROW} label="Recebido no período" value={fmtK(collected)} delta={incomeDelta} color={Colors.green} />
        <KpiCard narrow={NARROW} label="A receber" value={fmtK(receivable)} delta={null} color={Colors.amber} />
        <KpiCard narrow={NARROW} label="Valor médio por venda" value={fmtK(avgTicket)} delta={null} color={Colors.violet3} />
      </View>

      {/* Timeline promovida: e a parte acionavel da aba (cobranca). */}
      <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        {/* FIX 24/08/2026 (feedback do Caio): o titulo era "Quem te deve" mas o
            card nao mostra ninguem — mostra baldes de prazo (atrasadas, esta
            semana, futuras). Promessa que o conteudo nao cumpre.
            Listar nomes de verdade depende do backend: o /financeiro/insights
            devolve so os totais por balde, e a lista client-side e escopada ao
            periodo — no proprio QA os 3 atrasados eram de 80 dias atras, fora
            do mes, entao a lista sairia vazia ao lado de um total de R$ 434,51.
            Ate o server expor os itens, o titulo diz o que a tela realmente
            mostra, e o rodape leva pra onde os nomes estao. */}
        <Text style={[s.kicker, { color: Colors.ink3 }]}>A RECEBER</Text>
        <Text style={[s.cardTitle, { color: Colors.ink }]}>Quando você vai receber</Text>
        {/* FIX (QA pos-F7): o fallback era um "Carregando…" sem timeout. A
            query de insights nao roda em demo e desiste depois de 1 retry num
            403 — o texto ficava eterno. Como este card subiu pra primeira
            dobra no F5, isso passou a ser a segunda coisa que o usuario ve. */}
        {ib?.timeline ? <Timeline buckets={ib.timeline} kind="receivable" onSeeItems={onSeeItems} /> : (
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: Colors.ink3 }]}>
              {receivable > 0
                ? "Não conseguimos detalhar quem te deve agora."
                : "Ninguém está te devendo neste período."}
            </Text>
          </View>
        )}
      </View>

      {/* === ABAIXO DA DOBRA — abre sob demanda === */}
      <CollapsibleSection
        id="receitas-origem"
        title="De onde vem seu dinheiro"
        subtitle={categories.length > 0 ? categories[0].label + " lidera com " + categories[0].pct.toFixed(0) + "%" : "Categorias e principais clientes"}
      >
        <View style={IS_WIDE ? s.row2 : s.col}>
          <View style={[s.card, IS_WIDE ? { flex: 1 } : null, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
            <Text style={[s.kicker, { color: Colors.ink3 }]}>MAIORES RECEBIMENTOS</Text>
            <Text style={[s.cardTitle, { color: Colors.ink }]}>Quem mais movimentou</Text>
            <Top5List items={ib?.top5 || []} kind="income" showCompanyBadge={consolidated} />
          </View>

          <View style={[s.card, IS_WIDE ? { flex: 1 } : null, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
            <Text style={[s.kicker, { color: Colors.ink3 }]}>FORMAS DE RECEBIMENTO</Text>
            <Text style={[s.cardTitle, { color: Colors.ink }]}>Como seus clientes pagam</Text>
            <HBarList items={ib?.payment_methods || []} kind="income" />
          </View>
        </View>

        <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>CATEGORIAS DE RECEITA</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>Onde a receita nasce</Text>
          {categories.length === 0 ? (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: Colors.ink3 }]}>Nenhuma categoria de receita no período</Text>
            </View>
          ) : (
            categories.map(function(c, i) {
              var color = topCategoryColor[i % topCategoryColor.length];
              var tipText = c.label + ": " + fmt(c.value) + " (" + c.pct.toFixed(1) + "%)";
              return (
                <View key={c.label} {...tip(tipText)} style={s.catRow}>
                  <View style={[s.catDot, { backgroundColor: color }]} />
                  <Text style={[s.catLabel, { color: Colors.ink }]} numberOfLines={1}>{c.label}</Text>
                  <View style={[s.catBarTrack, { backgroundColor: Colors.bg4 }]}>
                    <View style={[s.catBarFill, { width: (c.pct + "%") as DimensionValue, backgroundColor: color }]} />
                  </View>
                  <Text style={[s.catValue, { color: Colors.ink2 }]}>{fmtK(c.value)}</Text>
                  <Text style={[s.catPct, { color: Colors.ink3 }]}>{c.pct.toFixed(0)}%</Text>
                </View>
              );
            })
          )}
        </View>
      </CollapsibleSection>

      <CollapsibleSection
        id="receitas-tendencia"
        title="Receita por dia"
        subtitle={avgDaily > 0 ? "Média de " + fmt(avgDaily) + " por dia no período" : "Sem receita confirmada no período"}
      >
        <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          {daily.length === 0 ? (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: Colors.ink3 }]}>Sem receitas confirmadas no período</Text>
            </View>
          ) : (
            <View style={s.bars}>
              {daily.map(function(d, i) {
                var h = Math.max(2, (d.value / maxDaily) * 100);
                var tipText = "Dia " + String(d.day).padStart(2, "0") + ": " + fmt(d.value);
                return (
                  <View key={i} {...tip(tipText)} style={s.barCol}>
                    <View style={[s.barTrack, { backgroundColor: Colors.bg4 }]}>
                      <View style={[s.barFill, { height: (h + "%") as DimensionValue, backgroundColor: Colors.green }]} />
                    </View>
                    <Text style={[s.barLabel, { color: Colors.ink3 }]}>{d.day}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </CollapsibleSection>

      {/* Analises que respondem perguntas mais raras — juntas num acordeao so,
          em vez de tres cards permanentes no fim da aba.
          A "Evolucao 12m" NAO fica aqui: era o mesmo componente com a mesma
          prop renderizado tambem em Despesas. A versao de la mostra receita e
          despesa lado a lado, entao responde as duas perguntas de uma vez. */}
      <CollapsibleSection
        id="receitas-avancado"
        title="Análises avançadas"
        subtitle="Seus dias mais fortes e o ranking da equipe"
      >
        <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>DIA DA SEMANA</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>Seus dias mais fortes</Text>
          <DowBars items={ib?.dow || []} kind="income" />
        </View>

        <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
          <Text style={[s.kicker, { color: Colors.ink3 }]}>EQUIPE</Text>
          <Text style={[s.cardTitle, { color: Colors.ink }]}>
            {consolidated ? "Disponível ao selecionar uma empresa" : "Quem mais movimentou no período"}
          </Text>
          <ProfessionalsRanking items={insights.professional_ranking || []} consolidated={consolidated} />
        </View>
      </CollapsibleSection>

      {/* F4: a curva ABC virou tela propria. Aqui fica so a porta de entrada —
          antes eram 610 linhas de mini-tela (com seletor de periodo proprio,
          concorrendo com o global) empilhadas no meio da aba. */}
      <Pressable
        onPress={function() { router.push("/financeiro/produtos" as any); }}
        accessibilityRole="button"
        accessibilityLabel="Abrir análise de produtos que mais dão dinheiro"
        style={({ hovered }: any) => [
          s.linkCard,
          { backgroundColor: Colors.bg3, borderColor: Colors.border2 },
          isWeb && hovered ? { borderColor: Colors.violet3 } : null,
          isWeb ? ({ transition: "all 0.18s ease", cursor: "pointer" } as any) : null,
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[s.linkTitle, { color: Colors.ink }]}>Produtos que mais dão dinheiro</Text>
          <Text style={[s.linkSub, { color: Colors.ink3 }]}>
            Veja quais produtos respondem pela maior parte do seu faturamento
          </Text>
        </View>
        <Icon name="chevron_right" size={14} color={Colors.violet3} />
      </Pressable>
    </View>
  );
}

function KpiCard({ label, value, delta, color, narrow }: { label: string; value: string; delta: number | null; color: string; narrow?: boolean }) {
  return (
    <View style={[k.card, narrow ? k.cardNarrow : k.cardWide, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
      <View style={[k.accent, { backgroundColor: color }]} />
      <Text style={[k.label, { color: Colors.ink3 }]}>{label}</Text>
      <Text style={[k.value, { color: Colors.ink }]} numberOfLines={1}>{value}</Text>
      {delta !== null && (
        <Text style={[k.delta, { color: delta >= 0 ? Colors.green : Colors.red }]}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1).replace(".", ",")}% vs ant.
        </Text>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  kpiStrip: { flexDirection: "row", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  kpiStripNarrow: { gap: 8 },
  row2: { flexDirection: "row", gap: 14 },
  col: { flexDirection: "column" },
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  kicker: { fontSize: 9.5, letterSpacing: 1.2, fontWeight: "600", textTransform: "uppercase" },
  cardTitle: { fontSize: 16, fontWeight: "700", marginTop: 4, marginBottom: 14, letterSpacing: -0.3 },
  empty: { paddingVertical: 32, alignItems: "center" },
  emptyText: { fontSize: 12, fontStyle: "italic" },
  // FIX 07/05/2026: height explícita no barTrack (118px) em vez de flex:1.
  // Antes: container com alignItems:"flex-end" → barCol só ganha altura do
  // texto do label → barTrack(flex:1) resolve 0px → height:"X%" fica 0px.
  bars: { flexDirection: "row", gap: 3, marginBottom: 4 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barTrack: { width: "100%", height: 118, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  barFill: { width: "100%", borderRadius: 4 },
  barLabel: { fontSize: 9 },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catLabel: { fontSize: 13, fontWeight: "600", flex: 1, minWidth: 0 },
  catBarTrack: { flex: 1.4, height: 6, borderRadius: 3, overflow: "hidden" },
  catBarFill: { height: 6, borderRadius: 3 },
  catValue: { fontSize: 12, fontWeight: "700", minWidth: 56, textAlign: "right" },
  catPct: { fontSize: 11, minWidth: 38, textAlign: "right", fontWeight: "600" },
  // F4: porta de entrada pra tela de produtos (ex-curva ABC)
  linkCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, borderWidth: 1, borderStyle: "dashed",
    paddingHorizontal: 18, paddingVertical: 16, marginBottom: 14,
  },
  linkTitle: { fontSize: 14, fontWeight: "700" },
  linkSub: { fontSize: 11.5, marginTop: 2, lineHeight: 16 },
});

var k = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
    position: "relative",
  },
  cardWide: { flex: 1, minWidth: 0 },
  cardNarrow: { minWidth: "47%" },
  accent: { position: "absolute", top: 0, left: 0, right: 0, height: 2, opacity: 0.85 },
  label: { fontSize: 9, letterSpacing: 0.6, fontWeight: "600", textTransform: "uppercase" },
  value: { fontSize: 20, fontWeight: "800", marginTop: 8, letterSpacing: -0.4 },
  delta: { fontSize: 11, fontWeight: "700", marginTop: 6 },
});

export default TabReceitas;
