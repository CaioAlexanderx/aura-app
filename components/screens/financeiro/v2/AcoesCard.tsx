// components/screens/financeiro/v2/AcoesCard.tsx
//
// F3 (24/08/2026) — "Para fazer agora".
//
// Funde tres cards que antes disputavam a mesma dobra dizendo variações da
// mesma coisa:
//   · BiggestLever  — "cobrar R$ X em atraso" (com jargao de alavanca/runway)
//   · PendingCards  — "A receber / A pagar" avulsos
//   · AnomalyAlerts — categorias com gasto fora da media (vinha la embaixo,
//                     na aba Despesas, onde ninguem via a tempo)
//
// Vira uma lista curta e ordenada por urgencia, cada linha com uma acao
// concreta. Sem nada pendente, mostra um estado positivo de uma linha em vez
// de tres cards vazios.

import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Platform, useWindowDimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { fmt, parseDateLocal } from "../types";
import type { Transaction } from "../types";
import type { FinancialInsights } from "./types";

var isWeb = Platform.OS === "web";
var MAX_ACTIONS = 3;

type Tone = "critical" | "warning" | "info";

type Action = {
  id: string;
  tone: Tone;
  icon: string;
  title: string;
  detail: string;
  cta: string;
  onPress?: () => void;
  weight: number; // ordena a lista — maior aparece primeiro
};

type Props = {
  transactions: Transaction[];
  insights: FinancialInsights;
  consolidated?: boolean;
  onGoToLancamentos: () => void;
  onGoToDespesas?: () => void;
};

function toneColors(tone: Tone): { fg: string; bg: string } {
  if (tone === "critical") return { fg: Colors.red, bg: Colors.redD };
  if (tone === "warning") return { fg: Colors.amber, bg: Colors.amberD };
  return { fg: Colors.violet3, bg: Colors.violetD };
}

// Quantos dias faltam (negativo = ja venceu) pro vencimento.
function daysUntil(raw?: string | null): number | null {
  if (!raw) return null;
  var d = parseDateLocal(raw);
  if (isNaN(d.getTime())) return null;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function AcoesCard({ transactions, insights, consolidated, onGoToLancamentos, onGoToDespesas }: Props) {
  var { width: vw } = useWindowDimensions();
  var NARROW = vw < 640;

  var actions = useMemo(function() {
    var list: Action[] = [];

    // 1. Cobrar atrasados — vem do biggest_lever (server ou client-side).
    var lever = insights.biggest_lever;
    if (lever && lever.amount > 0) {
      var oldest = lever.oldest_days != null && lever.oldest_days > 0
        ? " A mais antiga está há " + lever.oldest_days + " dia" + (lever.oldest_days === 1 ? "" : "s") + " esperando."
        : "";
      list.push({
        id: "cobrar",
        tone: "critical",
        icon: "clock",
        title: "Cobre " + fmt(lever.amount) + " em atraso",
        detail: lever.count + " conta" + (lever.count === 1 ? "" : "s") + " vencida" + (lever.count === 1 ? "" : "s") + "." + oldest +
          (consolidated ? " Some de todas as empresas — abra uma pra cobrar." : ""),
        cta: "Ver contas",
        onPress: onGoToLancamentos,
        weight: 100 + Math.min(20, lever.count),
      });
    }

    // 2. Contas a pagar chegando. Recorrentes (aluguel, energia) ficam de fora:
    //    sao previsiveis e ja entram no orcamento — mesma regra do PendingCards.
    var payableSoon = transactions.filter(function(t) {
      if (t.status !== "pending" || t.type !== "expense") return false;
      if ((t as any).recurrence_group_id) return false;
      var d = daysUntil((t as any).due_date);
      return d != null && d >= 0 && d <= 7;
    });
    if (payableSoon.length > 0) {
      var payableTotal = payableSoon.reduce(function(s, t) { return s + t.amount; }, 0);
      var nearest = payableSoon.reduce(function(min, t) {
        var d = daysUntil((t as any).due_date);
        return d != null && d < min ? d : min;
      }, 999);
      list.push({
        id: "pagar",
        tone: "warning",
        icon: "calendar",
        title: "Pague " + fmt(payableTotal) + " nos próximos dias",
        detail: payableSoon.length + " conta" + (payableSoon.length === 1 ? "" : "s") +
          (nearest === 0 ? " — a primeira vence hoje." : nearest === 1 ? " — a primeira vence amanhã." : " — a primeira vence em " + nearest + " dias."),
        cta: "Ver contas",
        onPress: onGoToLancamentos,
        weight: 80 - Math.min(nearest, 7),
      });
    }

    // 3. Gasto fora do padrao — so a categoria mais destoante, pra nao virar
    //    lista de alertas. O detalhe completo continua na aba Despesas.
    var anomalies = insights.expense_breakdown?.anomalies || [];
    var worst = anomalies.filter(function(a) { return a.diff_pct > 0; })
      .sort(function(a, b) { return b.diff_pct - a.diff_pct; })[0];
    // Sem destino nao vira acao: um item com CTA "Revisar" que nao navega e
    // pior que nao listar (o contrato permite onGoToDespesas undefined).
    if (worst && onGoToDespesas) {
      list.push({
        id: "anomalia",
        tone: "info",
        icon: "alert",
        title: "Gasto fora do normal em " + worst.category,
        detail: fmt(worst.current) + " neste período — " + Math.round(worst.diff_pct) + "% acima da sua média dos últimos meses.",
        cta: "Revisar",
        onPress: onGoToDespesas,
        weight: 40 + Math.min(30, worst.diff_pct / 4),
      });
    }

    // 4. Receber avulso (sem atraso) — so entra se ainda sobrou espaco.
    if (list.length < MAX_ACTIONS) {
      var receivable = transactions.filter(function(t) {
        if (t.status !== "pending" || t.type !== "income") return false;
        if ((t as any).recurrence_group_id) return false;
        var d = daysUntil((t as any).due_date);
        return d == null || d >= 0;
      });
      if (receivable.length > 0) {
        var recTotal = receivable.reduce(function(s, t) { return s + t.amount; }, 0);
        list.push({
          id: "receber",
          tone: "info",
          icon: "trending_up",
          title: fmt(recTotal) + " a receber",
          detail: receivable.length + " lançamento" + (receivable.length === 1 ? "" : "s") + " ainda não confirmado" + (receivable.length === 1 ? "" : "s") + ".",
          cta: "Acompanhar",
          onPress: onGoToLancamentos,
          weight: 20,
        });
      }
    }

    return list.sort(function(a, b) { return b.weight - a.weight; }).slice(0, MAX_ACTIONS);
  }, [transactions, insights, consolidated, onGoToLancamentos, onGoToDespesas]);

  // Estado positivo: uma linha, nao um card vazio de 200px.
  if (actions.length === 0) {
    return (
      <View style={[s.card, s.cardClear, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
        <View style={[s.iconBox, { backgroundColor: Colors.greenD }]}>
          <Icon name="check" size={16} color={Colors.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.clearTitle, { color: Colors.ink }]}>Nada precisa da sua atenção agora</Text>
          <Text style={[s.clearSub, { color: Colors.ink3 }]}>
            {consolidated
              ? "Nenhuma empresa tem conta atrasada ou vencendo nos próximos dias."
              : "Sem contas atrasadas nem vencendo nos próximos dias."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.card, { backgroundColor: Colors.bg3, borderColor: Colors.border }]}>
      <View style={s.header}>
        <View style={[s.iconBox, { backgroundColor: Colors.violetD }]}>
          <Icon name="zap" size={15} color={Colors.violet3} />
        </View>
        <Text style={[s.title, { color: Colors.ink }]}>Para fazer agora</Text>
        <Text style={[s.count, { color: Colors.ink3 }]}>
          {actions.length} {actions.length === 1 ? "item" : "itens"}
        </Text>
      </View>

      {actions.map(function(a, i) {
        var tc = toneColors(a.tone);
        return (
          <Pressable
            key={a.id}
            onPress={a.onPress}
            accessibilityRole="button"
            accessibilityLabel={a.title + ". " + a.detail}
            style={({ hovered, pressed }: any) => [
              s.row,
              i > 0 ? { borderTopWidth: 1, borderTopColor: Colors.border } : null,
              isWeb && hovered ? { backgroundColor: Colors.bg4 } : null,
              pressed ? { opacity: 0.92 } : null,
              isWeb ? ({ transition: "background-color 0.15s ease", cursor: "pointer" } as any) : null,
            ]}
          >
            <View style={[s.rowIcon, { backgroundColor: tc.bg }]}>
              <Icon name={a.icon as any} size={15} color={tc.fg} />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: Colors.ink }]}>{a.title}</Text>
              <Text style={[s.rowDetail, { color: Colors.ink3 }]}>{a.detail}</Text>
            </View>
            {!NARROW && (
              <View style={[s.rowCta, { borderColor: Colors.border2, backgroundColor: Colors.violetD }]}>
                <Text style={[s.rowCtaText, { color: Colors.violet3 }]}>{a.cta}</Text>
                <Icon name="chevron_right" size={11} color={Colors.violet3} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

var s = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 6, marginBottom: 14 },
  cardClear: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14 },
  iconBox: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
  count: { fontSize: 11, fontWeight: "600" },
  clearTitle: { fontSize: 14, fontWeight: "700" },
  clearSub: { fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 13, marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 10 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13.5, fontWeight: "700" },
  rowDetail: { fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  rowCta: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  rowCtaText: { fontSize: 11.5, fontWeight: "700" },
});

export default AcoesCard;
