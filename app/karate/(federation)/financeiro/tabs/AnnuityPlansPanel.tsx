// ============================================================
// AnnuityPlansPanel — "Valores e planos" (Fase F2) · Shoji
//
// 4 cards de plano — 3 de dojô (anual/semestral/trimestral) + 1 de
// praticante (cpf, sempre 'anual', N=1) — com valor por parcela editável
// e os meses de vencimento (pills). Salvar = PUT /financial/fees no
// formato NOVO (plan-based, karateApi.updateFeePlan).
//
// Vigência é APPEND-ONLY (mesma regra do backend): salvar NUNCA altera
// parcelas já geradas — só a próxima geração (próximo /charge ou próxima
// temporada) usa o valor novo. Isso fica EXPLÍCITO na UI (nota fixa em
// cada card), para não passar a impressão de que o valor "retroage".
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP } from "@/constants/karateTheme";
import { SectionHead, Card, Body } from "@/components/karate/shoji";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { toast } from "@/components/Toast";
import { karateApi, AnnuityFeePlan, AnnuityPlan } from "@/services/karateApi";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Modelo canônico (nota da migration 222 — mesmos valores usados no
// backfill): dojô anual 1x R$500 (Mai) / semestral 2x R$280 (Mai, Nov) /
// trimestral 4x R$150 (Fev, Mai, Ago, Nov); praticante 1x R$60 (Mai).
// Usados só como PONTO DE PARTIDA quando o ambiente ainda não tem a fee
// configurada (karate_annual_fees vazia para essa combinação) — o valor
// real vigente, quando existe, sempre prevalece.
type CardDef = { fee_type: "dojo" | "cpf"; plan: AnnuityPlan; count: number; defaultAmount: number; defaultMonths: number[] };
const CARD_DEFS: CardDef[] = [
  { fee_type: "dojo", plan: "anual",      count: 1, defaultAmount: 500, defaultMonths: [5] },
  { fee_type: "dojo", plan: "semestral",  count: 2, defaultAmount: 280, defaultMonths: [5, 11] },
  { fee_type: "dojo", plan: "trimestral", count: 4, defaultAmount: 150, defaultMonths: [2, 5, 8, 11] },
  { fee_type: "cpf",  plan: "anual",      count: 1, defaultAmount: 60,  defaultMonths: [5] },
];

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function planTitle(def: CardDef): string {
  if (def.fee_type === "cpf") return "Praticante (faixa-preta) · Anual";
  return `Dojô · ${def.plan === "anual" ? "Anual" : def.plan === "semestral" ? "Semestral" : "Trimestral"}`;
}

// Card de um plano — recebe federationId direto (quem busca a lista de
// fees é o painel abaixo; o card só chama updateFeePlan e devolve o
// registro criado via onSaved).
function PlanCard({ federationId, def, fee, onSaved }: {
  federationId: string; def: CardDef; fee: AnnuityFeePlan | null; onSaved: (f: AnnuityFeePlan) => void;
}) {
  const [amountTxt, setAmountTxt] = useState(String(fee?.amount ?? def.defaultAmount).replace(".", ","));
  const [months, setMonths] = useState<number[]>(fee?.due_months ?? def.defaultMonths);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setAmountTxt(String(fee?.amount ?? def.defaultAmount).replace(".", ","));
    setMonths(fee?.due_months ?? def.defaultMonths);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fee?.id]);

  const toggleMonth = (m: number) => {
    setDirty(true);
    setMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)));
  };

  const countOk = months.length === def.count;
  const amount = parseFloat(amountTxt.replace(",", "."));
  const amountOk = !isNaN(amount) && amount > 0;
  const title = planTitle(def);

  const handleSave = async () => {
    if (!amountOk) { toast.error("Valor deve ser maior que zero."); return; }
    if (!countOk) { toast.error(`Selecione exatamente ${def.count} ${def.count === 1 ? "mês" : "meses"} de vencimento.`); return; }
    setSaving(true);
    try {
      const created = await karateApi.updateFeePlan(federationId, {
        fee_type: def.fee_type,
        plan: def.plan,
        amount,
        due_months: months,
      });
      onSaved(created);
      setDirty(false);
      toast.success("Nova vigência salva");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardCount}>{def.count}× cobrança{def.count > 1 ? "s" : ""}/temporada</Text>
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Valor por parcela</Text>
        <View style={styles.amountInputWrap}>
          <Text style={styles.currencyPrefix}>R$</Text>
          <TextInput
            value={amountTxt}
            onChangeText={(t) => { setAmountTxt(t); setDirty(true); }}
            keyboardType="decimal-pad"
            style={styles.amountInput}
            accessibilityLabel={`Valor da anuidade ${title}`}
          />
        </View>
      </View>

      <Text style={styles.monthsLabel}>Meses de vencimento ({months.length}/{def.count})</Text>
      <View style={styles.monthsRow}>
        {MONTHS.map((label, idx) => {
          const m = idx + 1;
          const active = months.includes(m);
          return (
            <TouchableOpacity
              key={m}
              style={[styles.monthPill, active && styles.monthPillActive]}
              onPress={() => toggleMonth(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Vencimento em ${label}`}
            >
              <Text style={[styles.monthPillLabel, active && styles.monthPillLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {fee ? (
        <Body muted style={styles.vigenteNote}>Vigente desde {fee.effective_from} — {fmtMoney(fee.amount)} × {fee.due_months?.length ?? def.count}</Body>
      ) : (
        <Body muted style={styles.vigenteNote}>Ainda não configurado nesta federação — usando valores de referência.</Body>
      )}

      <View style={styles.warnBox}>
        <Icon name="information-circle-outline" size={14} color={C.ink3} />
        <Text style={styles.warnText}>
          Salvar cria uma vigência nova a partir de hoje. Cobranças já lançadas (parcelas geradas) NÃO mudam de valor — só a próxima geração usa o valor novo.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnOff]}
        onPress={handleSave}
        disabled={!dirty || saving}
        accessibilityRole="button"
        accessibilityLabel={`Salvar nova vigência de ${title}`}
      >
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnLabel}>Salvar nova vigência</Text>}
      </TouchableOpacity>
    </Card>
  );
}

export function AnnuityPlansPanel({ federationId }: { federationId: string }) {
  const [fees, setFees] = useState<AnnuityFeePlan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await karateApi.getFeePlans(federationId);
      setFees(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  const feeFor = useMemo(() => (fee_type: "dojo" | "cpf", plan: AnnuityPlan) =>
    fees?.find((f) => f.fee_type === fee_type && f.plan === plan) ?? null, [fees]);

  const handleSaved = useCallback((created: AnnuityFeePlan) => {
    setFees((prev) => {
      const rest = (prev ?? []).filter((f) => !(f.fee_type === created.fee_type && f.plan === created.plan));
      return [...rest, created];
    });
  }, []);

  if (error) return <KarateErrorState onRetry={load} style={{ paddingVertical: 60 }} />;

  return (
    <View style={{ gap: SP[6] }}>
      <SectionHead title="Valores e planos" sub="Tabela de anuidades da temporada — dojô por plano e praticante faixa-preta." />
      {loading ? (
        <View style={styles.grid}>
          {[1, 2, 3, 4].map((k) => <Skeleton key={k} height={260} style={{ borderRadius: R.xl, flexGrow: 1, flexBasis: 260 }} />)}
        </View>
      ) : (
        <View style={styles.grid}>
          {CARD_DEFS.map((def) => (
            <PlanCard key={`${def.fee_type}-${def.plan}`} federationId={federationId} def={def} fee={feeFor(def.fee_type, def.plan)} onSaved={handleSaved} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 } as ViewStyle,
  card: { flexGrow: 1, flexBasis: 280, minWidth: 260, gap: 12 } as ViewStyle,
  cardHead: { gap: 3 } as ViewStyle,
  cardTitle: { fontFamily: F.heading, fontSize: 17, color: C.ink } as TextStyle,
  cardCount: { fontFamily: F.body, fontSize: 11, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.6 } as TextStyle,

  amountRow: { gap: 6 } as ViewStyle,
  amountLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "600", color: C.ink3 } as TextStyle,
  amountInputWrap: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: C.line2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: P.glass2 } as ViewStyle,
  currencyPrefix: { fontFamily: F.mono, fontSize: 13, color: C.ink3 } as TextStyle,
  amountInput: { flex: 1, fontFamily: F.mono, fontSize: 16, fontWeight: "700", color: C.ink } as TextStyle,

  monthsLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "600", color: C.ink3 } as TextStyle,
  monthsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 } as ViewStyle,
  monthPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.pill, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass2 } as ViewStyle,
  monthPillActive: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  monthPillLabel: { fontFamily: F.body, fontSize: 11.5, fontWeight: "600", color: C.ink3 } as TextStyle,
  monthPillLabelActive: { color: P.red, fontWeight: "800" } as TextStyle,

  vigenteNote: { fontSize: 11, lineHeight: 16 } as TextStyle,

  warnBox: { flexDirection: "row", gap: 8, backgroundColor: P.paperWarm, borderRadius: R.sm, padding: 10, borderWidth: 1, borderColor: C.line } as ViewStyle,
  warnText: { flex: 1, fontFamily: F.body, fontSize: 10.5, lineHeight: 15, color: C.ink3 } as TextStyle,

  saveBtn: { backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 11, alignItems: "center", justifyContent: "center" } as ViewStyle,
  saveBtnOff: { opacity: 0.4 } as ViewStyle,
  saveBtnLabel: { fontSize: 13, fontWeight: "700", color: "#fff" } as TextStyle,
});
