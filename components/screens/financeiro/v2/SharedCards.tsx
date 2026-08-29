// components/screens/financeiro/v2/SharedCards.tsx
//
// Cards compartilhados entre TabReceitas e TabDespesas (Onda 2).
// Renderiza Top5List, HBarList (formas pagamento), Timeline (a receber/pagar),
// DowBars (dia da semana).
//
// F5 (24/08/2026): Gauge e AnomalyAlerts sairam. O Gauge repetia pela terceira
// vez o mesmo dado (a barra de gasto do ResumoHero e a margem do KPI strip ja
// dizem quanto da receita vira despesa); as anomalias viraram banner condicional
// na aba Despesas e linha no card "Para fazer agora".
//
// Multi-CNPJ: Top5List exibe badge da loja (company_name) quando disponivel.
//
// 06/05/2026: traducao pt-BR de payment_method (backend retorna em ingles)
// + tooltips nativos do browser via title= no hover (web only).
//
// 07/05/2026: FIX DowBars — mesmo padrão do TabReceitas: dowTrack(flex:1)
// dentro de dowCol sem altura definida → resolvia 0px → barras invisíveis.
// Solução: dowTrack recebe height:96 explícita; dowBars perde height+alignItems.

import { View, Text, StyleSheet, Platform, Dimensions, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { fmt, fmtK } from "../types";
import type {
  TopTransaction,
  PaymentMethodSlice,
  TimelineBuckets,
  DowItem,
} from "./types";

var W = Dimensions.get("window").width;
var NARROW = W < 480;
var isWeb = Platform.OS === "web";

// FIX 06/05/2026: backend serializa payment_method em ingles. Centraliza
// traducao aqui (espelha o dict de IncomeDetail/ExpenseDetail). Se a chave
// nao for reconhecida, repassa o original — assim categorias custom ou
// labels ja em portugues nao sao destruidas.
var METHOD_LABELS_PT: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  dinheiro: "Dinheiro",
  credit: "Crédito",
  credit_card: "Crédito",
  credito: "Crédito",
  "crédito (a vista)": "Crédito",
  debit: "Débito",
  debit_card: "Débito",
  debito: "Débito",
  voucher: "Vale",
  vale: "Vale",
  ticket: "Vale",
  transfer: "Transferência",
  bank_transfer: "Transferência",
  transferencia: "Transferência",
  boleto: "Boleto",
  check: "Cheque",
  cheque: "Cheque",
  installment: "Parcelado",
  parcelado: "Parcelado",
  // 24/08/2026: faltavam. O PDV grava payment_method 'crediario' e
  // 'crediario_credito' (credito de troca), e sem traducao o card "Como seus
  // clientes pagam" exibia a chave crua do banco pro usuario final.
  crediario: "Crediário",
  credit_account: "Crediário",
  store_credit: "Crediário",
  fiado: "Crediário",
  crediario_credito: "Crédito na loja",
  other: "Outros",
  others: "Outros",
  outros: "Outros",
  unknown: "Não informado",
  none: "Não informado",
  null: "Não informado",
};

function translateMethod(label: string | null | undefined): string {
  if (!label) return "Não informado";
  var k = String(label).toLowerCase().trim();
  return METHOD_LABELS_PT[k] || String(label);
}

// Helper pra montar o tooltip nativo (title= em RN-Web). Em native, prop
// nao existe — fica como any cast, ignorada em runtime.
function tip(text: string): any {
  return Platform.OS === "web" ? { title: text } : {};
}

// ============================================================
// Top 5 List — top 5 maiores receitas/despesas do periodo
// ============================================================
export function Top5List({
  items, kind, showCompanyBadge,
}: {
  items: TopTransaction[];
  kind: "income" | "expense";
  showCompanyBadge?: boolean;
}) {
  var color = kind === "income" ? Colors.green : Colors.red;
  var bg = kind === "income" ? Colors.greenD : Colors.redD;

  if (items.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={[s.emptyText, { color: Colors.ink3 }]}>
          {kind === "income" ? "Sem receitas confirmadas no período" : "Sem despesas confirmadas no período"}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {items.map(function(t, i) {
        var methodPt = t.payment_method ? translateMethod(t.payment_method) : "";
        var tipText = "#" + (i + 1) + " · " + t.description + " · " + (kind === "income" ? "+" : "−") + fmt(t.amount) + (methodPt ? " (" + methodPt + ")" : "");
        return (
          <View
            key={t.id}
            {...tip(tipText)}
            style={[s.top5Row, { borderBottomColor: Colors.border }, i === items.length - 1 ? { borderBottomWidth: 0 } : null]}
          >
            <View style={[s.top5Rank, { backgroundColor: bg }]}>
              <Text style={[s.top5RankNum, { color: color }]}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.top5Desc, { color: Colors.ink }]} numberOfLines={1}>{t.description}</Text>
              <View style={s.top5Meta}>
                <Text style={[s.top5MetaText, { color: Colors.ink3 }]}>{t.category}</Text>
                {t.payment_method && (
                  <>
                    <View style={[s.top5MetaDot, { backgroundColor: Colors.ink3 }]} />
                    <Text style={[s.top5MetaText, { color: Colors.ink3 }]}>{methodPt}</Text>
                  </>
                )}
                {showCompanyBadge && t.company_name && (
                  <View style={[s.top5CompanyBadge, { backgroundColor: Colors.violetD, borderColor: Colors.border2 }]}>
                    <Icon name="globe" size={9} color={Colors.violet3} />
                    <Text style={[s.top5CompanyText, { color: Colors.violet3 }]} numberOfLines={1}>{t.company_name}</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={[s.top5Amount, { color: color }]}>
              {kind === "income" ? "+" : "−"}{fmtK(t.amount)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ============================================================
// HBar List — formas de pagamento como barras horizontais
// ============================================================
export function HBarList({ items, kind }: { items: PaymentMethodSlice[]; kind: "income" | "expense" }) {
  var palette = kind === "income"
    ? ["#34d399", "#7c3aed", "#a78bfa", "#fbbf24", "#5b8cff", "#f87171", "#c4b5fd", "#22d3ee"]
    : ["#a78bfa", "#7c3aed", "#34d399", "#fbbf24", "#5b8cff", "#f87171", "#c4b5fd", "#22d3ee"];

  if (items.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={[s.emptyText, { color: Colors.ink3 }]}>Nenhuma forma de pagamento registrada no período</Text>
      </View>
    );
  }

  var max = Math.max(1, ...items.map(function(i) { return i.value; }));

  return (
    <View>
      {items.map(function(m, i) {
        var c = palette[i % palette.length];
        var w = (m.value / max) * 100;
        var labelPt = translateMethod(m.label);
        var tipText = labelPt + " · " + fmt(m.value) + " · " + m.pct.toFixed(1) + "%";
        return (
          <View key={m.label} {...tip(tipText)} style={s.hbarRow}>
            <View style={s.hbarHead}>
              <Text style={[s.hbarLabel, { color: Colors.ink }]} numberOfLines={1}>{labelPt}</Text>
              <Text style={[s.hbarValue, { color: Colors.ink2 }]}>
                {fmtK(m.value)}
                <Text style={[s.hbarPct, { color: Colors.ink3 }]}>  ·  {m.pct.toFixed(0)}%</Text>
              </Text>
            </View>
            <View style={[s.hbarTrack, { backgroundColor: Colors.bg4 }]}>
              <View
                style={[
                  s.hbarFill,
                  { width: w + "%", backgroundColor: c },
                  isWeb ? ({ transition: "width 0.5s ease" } as any) : null,
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ============================================================
// Timeline — atrasadas / esta_semana / este_mes / futuras
// ============================================================
export function Timeline({ buckets, kind, onSeeItems }: {
  buckets: TimelineBuckets;
  kind: "receivable" | "payable";
  // Leva pra lista de lancamentos, onde estao os nomes. O card mostra prazos;
  // quem quer saber DE QUEM precisa de um caminho, nao de um titulo que promete.
  onSeeItems?: () => void;
}) {
  var totalSum = buckets.atrasadas.total + buckets.esta_semana.total + buckets.este_mes.total + buckets.futuras.total;

  if (totalSum === 0) {
    return (
      <View style={s.empty}>
        <Text style={[s.emptyText, { color: Colors.ink3 }]}>
          {kind === "receivable" ? "Nenhum recebimento pendente" : "Nenhum pagamento pendente"}
        </Text>
      </View>
    );
  }

  var rows = [
    { key: "atrasadas", label: "Atrasadas", b: buckets.atrasadas, c: Colors.red, urgentCopy: "vencidas" },
    { key: "esta_semana", label: "Esta semana", b: buckets.esta_semana, c: Colors.amber, urgentCopy: "vencem em 7 dias" },
    { key: "este_mes", label: "Este mês", b: buckets.este_mes, c: Colors.violet3, urgentCopy: "vencem este mês" },
    { key: "futuras", label: "Futuras", b: buckets.futuras, c: Colors.green, urgentCopy: "além deste mês" },
  ];

  return (
    <View>
      {/* Stack bar — visualiza proporcao ENTRE categorias. Com uma unica
          categoria preenchida ela nao informa nada: vira uma faixa chapada de
          ponta a ponta (no QA, uma barra vermelha gigante so porque todo o
          valor estava em "Atrasadas"). Nesse caso a lista abaixo ja diz tudo. */}
      {rows.filter(function(r) { return r.b.total > 0; }).length > 1 && (
      <View style={[s.timelineStack, { backgroundColor: Colors.bg4 }]}>
        {rows.filter(function(r) { return r.b.total > 0; }).map(function(r) {
          var w = (r.b.total / totalSum) * 100;
          var pct = ((r.b.total / totalSum) * 100).toFixed(1);
          return (
            <View
              key={r.key}
              {...tip(r.label + ": " + fmt(r.b.total) + " (" + pct + "%)" )}
              style={[s.timelineSegment, { width: w + "%", backgroundColor: r.c }]}
            />
          );
        })}
      </View>
      )}

      {/* Lista de buckets */}
      <View style={{ marginTop: 14, gap: 10 }}>
        {rows.map(function(r) {
          if (r.b.count === 0 && r.b.total === 0) return null;
          return (
            <View key={r.key} {...tip(r.label + ": " + r.b.count + " " + (r.b.count === 1 ? "lançamento" : "lançamentos") + " · " + fmt(r.b.total))} style={s.timelineRow}>
              <View style={[s.timelineDot, { backgroundColor: r.c }]} />
              <View style={s.timelineText}>
                <Text style={[s.timelineLabel, { color: Colors.ink }]}>{r.label}</Text>
                <Text style={[s.timelineSub, { color: Colors.ink3 }]}>{r.b.count} {r.b.count === 1 ? "lançamento" : "lançamentos"} · {r.urgentCopy}</Text>
              </View>
              <Text style={[s.timelineValue, { color: r.c }]}>{fmtK(r.b.total)}</Text>
            </View>
          );
        })}
      </View>

      {onSeeItems && (
        <Pressable
          onPress={onSeeItems}
          accessibilityRole="button"
          accessibilityLabel={kind === "receivable" ? "Ver quem está devendo" : "Ver as contas a pagar"}
          style={({ hovered }: any) => [
            s.timelineCta,
            isWeb && hovered ? { opacity: 0.75 } : null,
            isWeb ? ({ transition: "opacity 0.15s ease", cursor: "pointer" } as any) : null,
          ]}
        >
          <Text style={[s.timelineCtaText, { color: Colors.violet3 }]}>
            {kind === "receivable" ? "Ver quem está devendo" : "Ver as contas"}
          </Text>
          <Icon name="chevron_right" size={11} color={Colors.violet3} />
        </Pressable>
      )}
    </View>
  );
}

// ============================================================
// DowBars — dia da semana
// ============================================================
export function DowBars({ items, kind }: { items: DowItem[]; kind: "income" | "expense" }) {
  if (items.length === 0 || items.every(function(d) { return d.total === 0; })) {
    return (
      <View style={s.empty}>
        <Text style={[s.emptyText, { color: Colors.ink3 }]}>Sem dados de dia da semana</Text>
      </View>
    );
  }

  var max = Math.max(1, ...items.map(function(d) { return d.total; }));
  var peakIdx = items.reduce(function(idx, d, i) { return d.total > items[idx].total ? i : idx; }, 0);
  var color = kind === "income" ? Colors.green : Colors.red;

  return (
    <View>
      <View style={[s.dowBars]}>
        {items.map(function(d, i) {
          var h = Math.max(2, (d.total / max) * 100);
          var isPeak = i === peakIdx && d.total > 0;
          return (
            <View key={i} {...tip(d.label + ": " + fmt(d.total))} style={s.dowCol}>
              <Text style={[s.dowValue, { color: isPeak ? color : Colors.ink3, fontWeight: isPeak ? "700" : "500" }]}>
                {d.total > 0 ? fmtK(d.total) : "—"}
              </Text>
              <View style={[s.dowTrack, { backgroundColor: Colors.bg4 }]}>
                <View
                  style={[
                    s.dowFill,
                    { height: h + "%", backgroundColor: color },
                    isPeak ? { opacity: 1 } : { opacity: 0.55 },
                  ]}
                />
              </View>
              <Text style={[s.dowLabel, { color: isPeak ? Colors.ink : Colors.ink3, fontWeight: isPeak ? "700" : "500" }]}>{d.label}</Text>
            </View>
          );
        })}
      </View>
      {peakIdx >= 0 && items[peakIdx].total > 0 && (
        <Text style={[s.dowFooter, { color: Colors.ink3 }]}>
          Pico: <Text style={{ color: color, fontWeight: "700" }}>{items[peakIdx].label}</Text>
        </Text>
      )}
    </View>
  );
}

var s = StyleSheet.create({
  empty: { paddingVertical: 28, alignItems: "center" },
  emptyText: { fontSize: 12, fontStyle: "italic", textAlign: "center" },

  // Top5
  top5Row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  top5Rank: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  top5RankNum: { fontSize: 12, fontWeight: "800" },
  top5Desc: { fontSize: 13, fontWeight: "600" },
  top5Meta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" },
  top5MetaText: { fontSize: 10.5 },
  top5MetaDot: { width: 3, height: 3, borderRadius: 2, opacity: 0.5 },
  top5CompanyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    marginLeft: 4,
    maxWidth: 140,
  },
  top5CompanyText: { fontSize: 9, fontWeight: "600", letterSpacing: 0.2 },
  top5Amount: { fontSize: 14, fontWeight: "800", minWidth: 90, textAlign: "right" },

  // HBar
  hbarRow: { marginBottom: 12 },
  hbarHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  hbarLabel: { fontSize: 13, fontWeight: "600", flex: 1, minWidth: 0 },
  hbarValue: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  hbarPct: { fontSize: 11, fontWeight: "500" },
  hbarTrack: { height: 7, borderRadius: 4, overflow: "hidden" },
  hbarFill: { height: 7, borderRadius: 4 },

  // Timeline
  timelineStack: { height: 18, borderRadius: 9, overflow: "hidden", flexDirection: "row" },
  timelineSegment: { height: "100%" },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timelineCta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 14, alignSelf: "flex-start" },
  timelineCtaText: { fontSize: 12, fontWeight: "700" },
  // FIX 24/08/2026 (feedback do Caio): este bloco era `flex: 1` puro, entao
  // empurrava o valor pra borda do card. Num card de 1100px, ler "Atrasadas" e
  // achar "R$ 434,51" custava mais de mil pixels de travessia. Com teto, o
  // valor encosta no rotulo e as colunas seguem alinhadas entre as linhas.
  timelineText: { flex: 1, minWidth: 0, maxWidth: 360 },
  timelineDot: { width: 8, height: 8, borderRadius: 4 },
  timelineLabel: { fontSize: 12.5, fontWeight: "600" },
  timelineSub: { fontSize: 10.5, marginTop: 1 },
  timelineValue: { fontSize: 13, fontWeight: "800", minWidth: 80, textAlign: "right" },

  // DOW — FIX 07/05/2026: dowTrack com height explícita (96px) em vez de
  // flex:1. Ver comentário no topo do arquivo para explicação completa.
  dowBars: { flexDirection: "row", gap: 6, marginBottom: 4 },
  dowCol: { flex: 1, alignItems: "center", gap: 4 },
  dowValue: { fontSize: 9.5 },
  dowTrack: { width: "100%", height: 96, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  dowFill: { width: "100%", borderRadius: 4 },
  dowLabel: { fontSize: 11 },
  dowFooter: { fontSize: 11, marginTop: 10, alignSelf: "center" },
});
