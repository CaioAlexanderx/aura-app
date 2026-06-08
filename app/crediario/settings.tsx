import { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput, Switch } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { creditApi, type PeriodUnit } from "@/services/creditApi";
import { toast } from "@/components/Toast";

// ============================================================
// Configurações do Crediário (Hub F1, 05/06/2026)
// Fase 1 FE (07/06/2026):
//   - Exibe period_unit/period_count (periodicidade)
//   - Novo campo score_warn_min ("avisar quando score < X");
//     nota explícita: só aviso, nunca bloqueia.
//   - require_score_min removido da UI (campo deprecado; enviamos
//     score_warn_min no PUT e omitimos require_score_min).
// Fase 2 FE (08/06/2026):
//   - Seção "Encargos por atraso": toggle late_charges_enabled,
//     multa (late_fee_rate, teto 2% CDC), mora/mês (exibe mensal,
//     envia diário via late_interest_daily = mensal/100/30),
//     carência em dias (late_grace_days).
//   - Banner âmbar com texto legal CDC.
//   - Validação inline (>2% / >1%) bloqueia salvar antes de chegar
//     no backend; trata 422 LATE_FEE_ABOVE_CAP / LATE_INTEREST_ABOVE_CAP.
// ============================================================

type Rule = { id: string; name: string; days_relative: number; template: string; channel: string; enabled: boolean };

const DEFAULT_RULES: Rule[] = [
  { id: "lembrete",   name: "Lembrete",          days_relative: -3, channel: "whatsapp", enabled: true,
    template: "Oi {nome}! Passando pra lembrar que sua parcela de {valor} vence em {vencimento}. Pix: {pix}" },
  { id: "vencimento", name: "No vencimento",     days_relative: 0,  channel: "whatsapp", enabled: true,
    template: "Olá {nome}, sua parcela de {valor} vence hoje. Pague pelo Pix {pix} :)" },
  { id: "atraso_1",   name: "Atraso leve",       days_relative: 1,  channel: "whatsapp", enabled: true,
    template: "{nome}, a parcela de {valor} venceu em {vencimento}. Consegue regularizar?" },
  { id: "atraso_2",   name: "Atraso 2",          days_relative: 7,  channel: "whatsapp", enabled: false,
    template: "{nome}, seu débito de {valor} está com {dias} dias de atraso. Pix: {pix}" },
  { id: "bloqueio",   name: "Aviso de bloqueio", days_relative: 15, channel: "whatsapp", enabled: false,
    template: "{nome}, seu crédito na loja foi suspenso por atraso. Regularize pelo Pix {pix}." },
];

function num(s: string): number {
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
}
function pctToStr(n: number): string {
  return String(Number(n || 0)).replace(".", ",");
}

function periodKey(unit: PeriodUnit, count: number): "semanal" | "quinzenal" | "mensal" | "custom" {
  if (unit === "month" && count === 1) return "mensal";
  if (unit === "week" && count === 1) return "semanal";
  if (unit === "week" && count === 2) return "quinzenal";
  return "custom";
}

// ── Helpers mora: exibir mensal ↔ enviar diário ──────────────
// Backend armazena e espera late_interest_daily (mora ao DIA, decimal).
// UI exibe e recebe do usuário a taxa MENSAL em %.
// Conversão:
//   exibir  → moraMonthlyPct = late_interest_daily * 30 * 100
//   salvar  → late_interest_daily = (moraMonthlyPct / 100) / 30
function dailyToMonthlyPct(daily: number): string {
  // daily = fração diária (ex.: 0.000333...) → 0.000333 * 30 * 100 = 0.999...%
  return pctToStr(+((daily || 0) * 30 * 100).toFixed(4));
}
function monthlyPctToDaily(monthlyPctStr: string): number {
  // "1" → 0.01/30 = 0.000333...
  return +(num(monthlyPctStr) / 100 / 30).toFixed(8);
}

export default function CrediarioSettingsScreen() {
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const touch = () => setDirty(true);

  // Parcelamento
  const [maxInst, setMaxInst] = useState("12");
  const [minInst, setMinInst] = useState("20,00");
  // Periodicidade
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>("month");
  const [periodCount, setPeriodCount] = useState(1);
  const [customDays, setCustomDays] = useState("20");
  // Juros & encargos (opt-in)
  const [interestOn, setInterestOn] = useState(false);
  const [interestPct, setInterestPct] = useState("2,5");
  const [lateFeeOn, setLateFeeOn] = useState(false);
  const [lateFee, setLateFee] = useState("2");
  const [moraOn, setMoraOn] = useState(false);
  const [mora, setMora] = useState("0,033");
  // Fase 1: score_warn_min (só aviso, nunca bloqueia)
  const [scoreWarnOn, setScoreWarnOn] = useState(false);
  const [scoreWarnMin, setScoreWarnMin] = useState("300");
  // Cobrança
  const [pixKey, setPixKey] = useState("");
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);

  // ── Fase 2: encargos por atraso ─────────────────────────────
  const [lateChargesOn, setLateChargesOn] = useState(false);
  /** Multa em %, ex.: "2" = 2% = 0.02 */
  const [lateFeePct, setLateFeePct] = useState("2");
  /** Mora MENSAL em %, ex.: "1" = 1%/mês = 0.01/30 diário */
  const [moraMonthlyPct, setMoraMonthlyPct] = useState("1");
  /** Carência em dias (inteiro) */
  const [graceStr, setGraceStr] = useState("3");
  /** Erros de validação inline (CDC) */
  const [lateFeeError, setLateFeePctError] = useState<string | null>(null);
  const [moraPctError, setMoraPctError] = useState<string | null>(null);

  const cfgQ = useQuery({
    queryKey: ["credit-plan-config", company?.id],
    queryFn: () => creditApi.getPlanConfig(company!.id),
    enabled: !!company?.id,
  });
  const rulesQ = useQuery({
    queryKey: ["credit-rules", company?.id],
    queryFn: () => creditApi.getCollectionRules(company!.id),
    enabled: !!company?.id,
  });

  // Hidrata estado a partir da config
  useEffect(() => {
    const c = cfgQ.data;
    if (!c) return;
    if (c.max_installments != null) setMaxInst(String(c.max_installments));
    if (c.min_installment_value != null) setMinInst(pctToStr(c.min_installment_value));

    const u = (c.period_unit as PeriodUnit) || "month";
    const cnt = c.period_count != null ? c.period_count : 1;
    setPeriodUnit(u); setPeriodCount(cnt);
    if (u === "day") setCustomDays(String(cnt));
    else if (u === "week" && cnt !== 1 && cnt !== 2) setCustomDays(String(cnt));

    const ir = Number(c.interest_rate || 0);
    setInterestOn(ir > 0); if (ir > 0) setInterestPct(pctToStr(+(ir * 100).toFixed(4)));
    const lf = Number(c.late_fee_rate || 0);
    setLateFeeOn(lf > 0); if (lf > 0) setLateFee(pctToStr(lf));
    const md = Number(c.late_interest_daily || 0);
    setMoraOn(md > 0); if (md > 0) setMora(pctToStr(md));

    // Fase 1: score_warn_min (preferência) ou require_score_min (legado) como fallback
    const swm = c.score_warn_min != null ? c.score_warn_min
      : (c.require_score_min ?? 0);
    setScoreWarnOn(swm > 0);
    if (swm > 0) setScoreWarnMin(String(swm));

    // ── Fase 2: encargos por atraso ──────────────────────────
    // late_charges_enabled pode vir undefined em configs antigas → tratar como false
    setLateChargesOn(c.late_charges_enabled === true);
    // late_fee_rate já é decimal (ex.: 0.02 = 2%); exibir como %
    const lfr = Number(c.late_fee_rate || 0);
    if (lfr > 0) setLateFeePct(pctToStr(+(lfr * 100).toFixed(4)));
    // late_interest_daily → converter para % mensal para exibição
    const lid = Number(c.late_interest_daily || 0);
    if (lid > 0) setMoraMonthlyPct(dailyToMonthlyPct(lid));
    // late_grace_days pode vir undefined → default 3
    if (c.late_grace_days != null) setGraceStr(String(c.late_grace_days));
  }, [cfgQ.data]);

  // Hidrata Pix + régua
  useEffect(() => {
    const d: any = rulesQ.data;
    if (!d) return;
    setPixKey(d.pix_key || "");
    if (Array.isArray(d.rules) && d.rules.length) {
      setRules(d.rules.map((r: any, i: number) => ({
        id: r.id || `stage_${i}`, name: r.name || `Etapa ${i + 1}`,
        days_relative: Number(r.days_relative ?? 0), template: r.template || "",
        channel: r.channel || "whatsapp", enabled: r.enabled !== false,
      })));
    }
  }, [rulesQ.data]);

  const pKey = periodKey(periodUnit, periodCount);

  function selectPeriod(k: "semanal" | "quinzenal" | "mensal" | "custom") {
    touch();
    if (k === "semanal")   { setPeriodUnit("week");  setPeriodCount(1); }
    else if (k === "quinzenal") { setPeriodUnit("week"); setPeriodCount(2); }
    else if (k === "mensal") { setPeriodUnit("month"); setPeriodCount(1); }
    else { setPeriodUnit("day"); setPeriodCount(Math.max(1, parseInt(customDays, 10) || 1)); }
  }

  // Validação CDC inline
  function validateLateCharges(): boolean {
    let ok = true;
    if (lateChargesOn) {
      const feeVal = num(lateFeePct);
      if (feeVal > 2) {
        setLateFeePctError("Máximo 2% (CDC)");
        ok = false;
      } else {
        setLateFeePctError(null);
      }
      const moraVal = num(moraMonthlyPct);
      if (moraVal > 1) {
        setMoraPctError("Máximo 1%/mês (CDC)");
        ok = false;
      } else {
        setMoraPctError(null);
      }
    } else {
      setLateFeePctError(null);
      setMoraPctError(null);
    }
    return ok;
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!validateLateCharges()) {
        throw new Error("Valores acima do teto CDC.");
      }
      const finalUnit: PeriodUnit = pKey === "custom" ? "day" : periodUnit;
      const finalCount = pKey === "custom" ? Math.max(1, parseInt(customDays, 10) || 1) : periodCount;

      // Fase 2: calcular late_interest_daily a partir de % mensal
      const lateInterestDailyValue = lateChargesOn && num(moraMonthlyPct) > 0
        ? monthlyPctToDaily(moraMonthlyPct)
        : 0;
      const lateFeeRateValue = lateChargesOn && num(lateFeePct) > 0
        ? +(num(lateFeePct) / 100).toFixed(6)
        : 0;

      await creditApi.updatePlanConfig(company!.id, {
        max_installments: Math.max(1, parseInt(maxInst, 10) || 1),
        min_installment_value: num(minInst),
        interest_rate: interestOn ? +(num(interestPct) / 100).toFixed(4) : 0,
        late_fee_rate: lateFeeRateValue,
        late_interest_daily: lateInterestDailyValue,
        // Fase 1: envia score_warn_min; omite require_score_min (deprecado)
        score_warn_min: scoreWarnOn ? Math.max(0, parseInt(scoreWarnMin, 10) || 0) : null,
        period_unit: finalUnit,
        period_count: finalCount,
        // Fase 2: encargos por atraso
        late_charges_enabled: lateChargesOn,
        late_grace_days: lateChargesOn ? Math.max(0, parseInt(graceStr, 10) || 0) : undefined,
      } as any);
      await creditApi.updateCollectionRules(company!.id, {
        enabled: (rulesQ.data as any)?.enabled ?? true,
        rules: rules as any,
        pix_key: pixKey.trim(),
      } as any);
    },
    onSuccess: () => {
      toast.success("Configurações salvas!");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["credit-plan-config", company?.id] });
      qc.invalidateQueries({ queryKey: ["credit-rules", company?.id] });
    },
    onError: (err: any) => {
      // Tratar 422 do backend (LATE_FEE_ABOVE_CAP / LATE_INTEREST_ABOVE_CAP)
      const code = err?.data?.code;
      const max = err?.data?.max;
      if (code === "LATE_FEE_ABOVE_CAP") {
        const maxPct = max != null ? (Number(max) * 100).toFixed(0) : "2";
        setLateFeePctError(`Acima do teto permitido: máx. ${maxPct}% (CDC)`);
        toast.error(`Multa acima do teto CDC: máx. ${maxPct}%`);
      } else if (code === "LATE_INTEREST_ABOVE_CAP") {
        const maxMonthly = max != null ? (Number(max) * 30 * 100).toFixed(2) : "1";
        setMoraPctError(`Acima do teto permitido: máx. ${maxMonthly}%/mês (CDC)`);
        toast.error(`Mora acima do teto CDC: máx. ${maxMonthly}%/mês`);
      } else {
        toast.error(err?.data?.error || err?.message || "Erro ao salvar");
      }
    },
  });

  function updateRule(i: number, patch: Partial<Rule>) {
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    touch();
  }

  const loading = cfgQ.isLoading || rulesQ.isLoading;

  const periodLabel = useMemo(() => {
    if (pKey === "semanal") return "A cada 7 dias";
    if (pKey === "quinzenal") return "A cada 15 dias";
    if (pKey === "mensal") return "A cada mês (padrão)";
    return `A cada ${customDays || "?"} dias`;
  }, [pKey, customDays]);

  // Bloquear salvar se houver erros CDC
  const hasCdcErrors = !!lateFeeError || !!moraPctError;

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <View style={st.headerRow}>
        <Pressable onPress={() => router.back()} style={st.backBtn}>
          <Icon name="chevron_right" size={16} color={Colors.violet3} style={{ transform: [{ rotate: "180deg" }] } as any} />
          <Text style={st.backText}>Crediário</Text>
        </Pressable>
      </View>

      <Text style={st.pageTitle}>Configurações do Crediário</Text>
      <Text style={st.pageSubtitle}>Regras padrão do fiado da sua loja. Tudo pode ser ajustado por venda.</Text>

      {loading ? (
        <View style={st.loadingBox}><ActivityIndicator color={Colors.violet3} /></View>
      ) : (
        <>
          {/* PARCELAMENTO */}
          <Text style={st.sectionTitle}>Parcelamento</Text>
          <View style={st.card}>
            <View style={st.row2}>
              <View style={st.col}>
                <Text style={st.lbl}>Nº máximo de parcelas</Text>
                <TextInput style={st.input} value={maxInst} keyboardType="numeric"
                  onChangeText={(v) => { setMaxInst(v.replace(/\D/g, "").slice(0, 2)); touch(); }} />
              </View>
              <View style={st.col}>
                <Text style={st.lbl}>Valor mínimo da parcela</Text>
                <View style={st.inpPref}>
                  <Text style={st.pref}>R$</Text>
                  <TextInput style={st.inpFlex} value={minInst} keyboardType="numeric"
                    onChangeText={(v) => { setMinInst(v.replace(/[^\d,.]/g, "")); touch(); }} />
                </View>
              </View>
            </View>
          </View>

          {/* PERIODICIDADE */}
          <Text style={st.sectionTitle}>Periodicidade padrão</Text>
          <View style={st.card}>
            <View style={st.chips}>
              {([["semanal", "Semanal"], ["quinzenal", "Quinzenal"], ["mensal", "Mensal"], ["custom", "Personalizado"]] as const).map(([k, label]) => (
                <Pressable key={k} onPress={() => selectPeriod(k)} style={[st.chip, pKey === k && st.chipOn]}>
                  <Text style={[st.chipTxt, pKey === k && st.chipTxtOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {pKey === "custom" && (
              <View style={st.customRow}>
                <Text style={st.customLbl}>A cada</Text>
                <TextInput style={st.customNum} value={customDays} keyboardType="numeric"
                  onChangeText={(v) => {
                    const d = v.replace(/\D/g, "").slice(0, 3);
                    setCustomDays(d);
                    setPeriodUnit("day");
                    setPeriodCount(parseInt(d, 10) || 1);
                    touch();
                  }} />
                <Text style={st.customLbl}>dias</Text>
              </View>
            )}
            <Text style={st.hint}>{periodLabel} entre parcelas. Pode ser trocada em cada venda.</Text>
          </View>

          {/* JUROS & ENCARGOS */}
          <Text style={st.sectionTitle}>Juros & encargos · opcional</Text>
          <View style={st.card}>
            <ToggleRow label="Juros de financiamento" sub="aplicado ao parcelar uma venda" suffix="% mês"
              on={interestOn} setOn={(v) => { setInterestOn(v); touch(); }}
              value={interestPct} setValue={(v) => { setInterestPct(v); touch(); }} />
            <ToggleRow label="Multa por atraso (parcelado)" sub="cobrada uma vez na parcela vencida" suffix="% dia"
              on={lateFeeOn} setOn={(v) => { setLateFeeOn(v); touch(); }}
              value={lateFee} setValue={(v) => { setLateFee(v); touch(); }} />
            <ToggleRow label="Juros de mora ao dia (parcelado)" sub="acumula por dia de atraso" suffix="% dia"
              on={moraOn} setOn={(v) => { setMoraOn(v); touch(); }}
              value={mora} setValue={(v) => { setMora(v); touch(); }} />
            <Text style={st.hint}>Tudo opcional. Deixe desligado para não cobrar juros — você decide.</Text>
          </View>

          {/* ENCARGOS POR ATRASO (Fase 2) */}
          <Text style={st.sectionTitle}>Encargos por atraso</Text>
          <View style={st.card}>
            {/* Banner legal âmbar */}
            <View style={st.cdcBanner}>
              <Icon name="alert_triangle" size={13} color={Colors.amber} />
              <Text style={st.cdcBannerTxt}>
                Tetos seguem o <Text style={{ fontWeight: "700" }}>CDC</Text>: multa até{" "}
                <Text style={{ fontWeight: "700" }}>2%</Text> e mora até{" "}
                <Text style={{ fontWeight: "700" }}>1% ao mês</Text>.
              </Text>
            </View>

            {/* Toggle principal */}
            <View style={st.trow}>
              <View style={{ flex: 1 }}>
                <Text style={st.trowTitle}>Cobrar mora e multa no atraso</Text>
                <Text style={st.trowSub}>aplica encargos em parcelas vencidas além da carência</Text>
              </View>
              <Switch
                value={lateChargesOn}
                onValueChange={(v) => { setLateChargesOn(v); setLateFeePctError(null); setMoraPctError(null); touch(); }}
                trackColor={{ false: Colors.bg4 as any, true: Colors.violet }}
                thumbColor="#fff"
              />
            </View>

            {lateChargesOn && (
              <>
                {/* Multa */}
                <View style={[st.trow, { alignItems: "flex-start" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.trowTitle}>Multa por atraso (%)</Text>
                    <Text style={st.trowSub}>cobrada uma única vez · máx. 2% (CDC)</Text>
                    {!!lateFeeError && (
                      <Text style={st.cdcError}>{lateFeeError}</Text>
                    )}
                  </View>
                  <View style={[st.miniInpWrap, !!lateFeeError && { borderColor: Colors.red }]}>
                    <TextInput
                      style={st.miniInp}
                      value={lateFeePct}
                      keyboardType="decimal-pad"
                      onChangeText={(v) => {
                        const cleaned = v.replace(/[^\d,.]/g, "");
                        setLateFeePct(cleaned);
                        setLateFeePctError(num(cleaned) > 2 ? "Máximo 2% (CDC)" : null);
                        touch();
                      }}
                    />
                    <Text style={st.miniSuffix}>%</Text>
                  </View>
                </View>

                {/* Mora mensal */}
                <View style={[st.trow, { alignItems: "flex-start" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.trowTitle}>Mora ao mês (%)</Text>
                    <Text style={st.trowSub}>acumula diariamente · máx. 1%/mês (CDC)</Text>
                    {!!moraPctError && (
                      <Text style={st.cdcError}>{moraPctError}</Text>
                    )}
                  </View>
                  <View style={[st.miniInpWrap, !!moraPctError && { borderColor: Colors.red }]}>
                    <TextInput
                      style={st.miniInp}
                      value={moraMonthlyPct}
                      keyboardType="decimal-pad"
                      onChangeText={(v) => {
                        const cleaned = v.replace(/[^\d,.]/g, "");
                        setMoraMonthlyPct(cleaned);
                        setMoraPctError(num(cleaned) > 1 ? "Máximo 1%/mês (CDC)" : null);
                        touch();
                      }}
                    />
                    <Text style={st.miniSuffix}>%/mês</Text>
                  </View>
                </View>

                {/* Carência */}
                <View style={st.trow}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.trowTitle}>Carência (dias)</Text>
                    <Text style={st.trowSub}>dias após o vencimento sem cobrança de encargos</Text>
                  </View>
                  <View style={st.miniInpWrap}>
                    <TextInput
                      style={st.miniInp}
                      value={graceStr}
                      keyboardType="numeric"
                      onChangeText={(v) => { setGraceStr(v.replace(/\D/g, "").slice(0, 3)); touch(); }}
                    />
                    <Text style={st.miniSuffix}>dias</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* POLÍTICA DE VENDA — Fase 1: score_warn_min */}
          <Text style={st.sectionTitle}>Política de venda</Text>
          <View style={st.card}>
            <ToggleRow
              label="Avisar quando score estiver baixo"
              sub="exibe alerta na tela do cliente — nunca bloqueia a venda"
              suffix="pts"
              on={scoreWarnOn}
              setOn={(v) => { setScoreWarnOn(v); touch(); }}
              value={scoreWarnMin}
              setValue={(v) => { setScoreWarnMin(v.replace(/\D/g, "")); touch(); }}
              intOnly
            />
            <View style={st.warnNote}>
              <Icon name="alert_triangle" size={13} color={Colors.amber} />
              <Text style={st.warnNoteTxt}>
                Score baixo <Text style={{ fontWeight: "700" }}>nunca bloqueia</Text> uma venda — apenas exibe um aviso no painel do cliente para que você decida conscientemente.
              </Text>
            </View>
          </View>

          {/* COBRANÇA */}
          <Text style={st.sectionTitle}>Cobrança</Text>
          <View style={st.card}>
            <Text style={st.lbl}>Chave Pix (entra na mensagem de cobrança)</Text>
            <View style={st.pixCard}>
              <Icon name="dollar" size={15} color={Colors.violet3} />
              <TextInput style={st.pixInput} value={pixKey} autoCapitalize="none"
                onChangeText={(v) => { setPixKey(v); touch(); }}
                placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" placeholderTextColor={Colors.ink3} />
            </View>

            <Text style={[st.lbl, { marginTop: 18 }]}>Régua de cobrança</Text>
            <Text style={st.reguaSub}>Mensagens por etapa. Hoje o envio é manual pelo WhatsApp (wa.me) ao tocar em "Cobrar". Variáveis: {"{"}nome{"}"}, {"{"}valor{"}"}, {"{"}vencimento{"}"}, {"{"}pix{"}"}, {"{"}dias{"}"}.  </Text>

            {rules.map((r, i) => (
              <View key={r.id} style={[st.stage, !r.enabled && st.stageOff]}>
                <View style={st.stageHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.stageName}>{r.name}</Text>
                    <View style={st.daysRow}>
                      <Text style={st.daysLbl}>Disparo:</Text>
                      <TextInput style={st.daysInput} value={String(r.days_relative)} keyboardType="numbers-and-punctuation"
                        onChangeText={(v) => updateRule(i, { days_relative: parseInt(v.replace(/[^\d-]/g, ""), 10) || 0 })} />
                      <Text style={st.daysLbl}>dias (negativo = antes do vencimento)</Text>
                    </View>
                  </View>
                  <Switch value={r.enabled} onValueChange={(v) => updateRule(i, { enabled: v })}
                    trackColor={{ false: Colors.bg4 as any, true: Colors.violet }} thumbColor="#fff" />
                </View>
                <TextInput style={st.template} value={r.template} multiline
                  onChangeText={(v) => updateRule(i, { template: v })}
                  placeholder="Mensagem desta etapa" placeholderTextColor={Colors.ink3} />
              </View>
            ))}
          </View>

          <Pressable onPress={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending || hasCdcErrors}
            style={[st.saveBtn, (!dirty || saveMut.isPending || hasCdcErrors) && st.saveBtnDisabled]}>
            {saveMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={st.saveBtnText}>Salvar configurações</Text>}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function ToggleRow(props: {
  label: string; sub: string; suffix: string; on: boolean; setOn: (v: boolean) => void;
  value: string; setValue: (v: string) => void; intOnly?: boolean;
}) {
  const { label, sub, suffix, on, setOn, value, setValue, intOnly } = props;
  return (
    <View style={st.trow}>
      <View style={{ flex: 1 }}>
        <Text style={st.trowTitle}>{label}</Text>
        <Text style={st.trowSub}>{sub}</Text>
      </View>
      {on && (
        <View style={st.miniInpWrap}>
          <TextInput style={st.miniInp} value={value} keyboardType="numeric"
            onChangeText={(v) => setValue(intOnly ? v.replace(/\D/g, "") : v.replace(/[^\d,.]/g, ""))} />
          <Text style={st.miniSuffix}>{suffix}</Text>
        </View>
      )}
      <Switch value={on} onValueChange={setOn} trackColor={{ false: Colors.bg4 as any, true: Colors.violet }} thumbColor="#fff" />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 20, paddingBottom: 56, maxWidth: 640, alignSelf: "center", width: "100%" },

  headerRow: { marginBottom: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 13, color: Colors.violet3, fontWeight: "600" },

  pageTitle: { fontSize: 22, fontWeight: "800", color: Colors.ink, marginBottom: 6, letterSpacing: -0.4 },
  pageSubtitle: { fontSize: 12, color: Colors.ink3, lineHeight: 17, marginBottom: 22 },
  loadingBox: { paddingVertical: 40, alignItems: "center" },

  sectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: Colors.ink3, textTransform: "uppercase", marginBottom: 10, marginTop: 18 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },

  row2: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  lbl: { fontSize: 12, fontWeight: "600", color: Colors.ink2, marginBottom: 7 },
  input: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: Colors.ink },
  inpPref: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 13 },
  pref: { color: Colors.ink3, fontWeight: "600", fontSize: 14 },
  inpFlex: { flex: 1, paddingVertical: 11, fontSize: 14, color: Colors.ink, fontWeight: "700" },
  hint: { fontSize: 11, color: Colors.ink3, marginTop: 12, lineHeight: 16 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg2 },
  chipOn: { backgroundColor: Colors.violet, borderColor: Colors.violet2 },
  chipTxt: { fontSize: 13, fontWeight: "700", color: Colors.ink2 },
  chipTxtOn: { color: "#fff" },
  customRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, padding: 10 },
  customLbl: { fontSize: 13, color: Colors.ink2, fontWeight: "600" },
  customNum: { width: 64, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingVertical: 7, textAlign: "center", color: Colors.ink, fontWeight: "800", fontSize: 14 },

  trow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  trowTitle: { fontSize: 13.5, fontWeight: "700", color: Colors.ink },
  trowSub: { fontSize: 11, color: Colors.ink3, marginTop: 1 },
  miniInpWrap: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingHorizontal: 9 },
  miniInp: { width: 52, paddingVertical: 7, fontSize: 13, fontWeight: "700", color: Colors.ink, textAlign: "right" },
  miniSuffix: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },

  // Banner âmbar CDC (Fase 2)
  cdcBanner: { flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: Colors.amber + "14", borderRadius: 9, padding: 10, marginBottom: 4, borderWidth: 1, borderColor: Colors.amber + "33" },
  cdcBannerTxt: { flex: 1, fontSize: 11, color: Colors.amber, lineHeight: 16 },
  cdcError: { fontSize: 11, color: Colors.red, marginTop: 3, fontWeight: "600" },

  // Nota de aviso score
  warnNote: { flexDirection: "row", alignItems: "flex-start", gap: 7, backgroundColor: Colors.amber + "14", borderRadius: 9, padding: 10, marginTop: 10, borderWidth: 1, borderColor: Colors.amber + "33" },
  warnNoteTxt: { flex: 1, fontSize: 11, color: Colors.amber, lineHeight: 16 },

  pixCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.bg2, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: Colors.border2 },
  pixInput: { flex: 1, fontSize: 14, color: Colors.ink, fontWeight: "600", paddingVertical: 0 },

  reguaSub: { fontSize: 11, color: Colors.ink3, lineHeight: 16, marginTop: 4, marginBottom: 12 },
  stage: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, marginBottom: 9, backgroundColor: Colors.bg2 },
  stageOff: { opacity: 0.6 },
  stageHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stageName: { fontSize: 13.5, fontWeight: "800", color: Colors.ink },
  daysRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  daysLbl: { fontSize: 11, color: Colors.ink3 },
  daysInput: { width: 48, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 7, paddingVertical: 5, textAlign: "center", color: Colors.ink, fontWeight: "700", fontSize: 12 },
  template: { marginTop: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, padding: 10, fontSize: 12.5, color: Colors.ink2, minHeight: 56, textAlignVertical: "top", lineHeight: 18 },

  saveBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 22 },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
} as any);
