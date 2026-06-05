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
// Expõe as regras padrão do fiado: parcelamento, periodicidade,
// juros/encargos (sempre opt-in), score mínimo, chave Pix e a
// régua de cobrança. O disparo da régua segue MANUAL (wa.me) —
// o envio automático chega numa onda futura (WhatsApp Cloud).
// ============================================================

type Rule = { id: string; name: string; days_relative: number; template: string; channel: string; enabled: boolean };

const DEFAULT_RULES: Rule[] = [
  { id: "lembrete",   name: "Lembrete",          days_relative: -3, channel: "whatsapp", enabled: true,
    template: "Oi {nome}! Passando pra lembrar que sua parcela de {valor} vence em {vencimento}. Pix: {pix}" },
  { id: "vencimento", name: "No vencimento",     days_relative: 0,  channel: "whatsapp", enabled: true,
    template: "Olá {nome}, sua parcela de {valor} vence hoje. Pague pelo Pix {pix} 🙂" },
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
  const [interestPct, setInterestPct] = useState("2,5");   // exibido em %/mês; salvo como decimal
  const [lateFeeOn, setLateFeeOn] = useState(false);
  const [lateFee, setLateFee] = useState("2");             // %
  const [moraOn, setMoraOn] = useState(false);
  const [mora, setMora] = useState("0,033");               // %/dia
  // Política de venda
  const [scoreOn, setScoreOn] = useState(false);
  const [scoreMin, setScoreMin] = useState("300");
  // Cobrança
  const [pixKey, setPixKey] = useState("");
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);

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
    const ir = Number(c.interest_rate || 0);
    setInterestOn(ir > 0); if (ir > 0) setInterestPct(pctToStr(+(ir * 100).toFixed(4)));
    const lf = Number(c.late_fee_rate || 0);
    setLateFeeOn(lf > 0); if (lf > 0) setLateFee(pctToStr(lf));
    const md = Number(c.late_interest_daily || 0);
    setMoraOn(md > 0); if (md > 0) setMora(pctToStr(md));
    const sm = Number(c.require_score_min || 0);
    setScoreOn(sm > 0); if (sm > 0) setScoreMin(String(sm));
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

  const saveMut = useMutation({
    mutationFn: async () => {
      const finalUnit: PeriodUnit = pKey === "custom" ? "day" : periodUnit;
      const finalCount = pKey === "custom" ? Math.max(1, parseInt(customDays, 10) || 1) : periodCount;
      await creditApi.updatePlanConfig(company!.id, {
        max_installments: Math.max(1, parseInt(maxInst, 10) || 1),
        min_installment_value: num(minInst),
        interest_rate: interestOn ? +(num(interestPct) / 100).toFixed(4) : 0,
        late_fee_rate: lateFeeOn ? num(lateFee) : 0,
        late_interest_daily: moraOn ? num(mora) : 0,
        require_score_min: scoreOn ? Math.max(0, parseInt(scoreMin, 10) || 0) : 0,
        period_unit: finalUnit,
        period_count: finalCount,
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
    onError: (err: any) => toast.error(err?.data?.error || "Erro ao salvar"),
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
                  onChangeText={(v) => { const d = v.replace(/\D/g, "").slice(0, 3); setCustomDays(d); setPeriodUnit("day"); setPeriodCount(parseInt(d, 10) || 1); touch(); }} />
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
            <ToggleRow label="Multa por atraso" sub="cobrada uma vez na parcela vencida" suffix="%"
              on={lateFeeOn} setOn={(v) => { setLateFeeOn(v); touch(); }}
              value={lateFee} setValue={(v) => { setLateFee(v); touch(); }} />
            <ToggleRow label="Juros de mora ao dia" sub="acumula por dia de atraso" suffix="% dia"
              on={moraOn} setOn={(v) => { setMoraOn(v); touch(); }}
              value={mora} setValue={(v) => { setMora(v); touch(); }} />
            <Text style={st.hint}>Tudo opcional. Deixe desligado para não cobrar juros — você decide.</Text>
          </View>

          {/* POLÍTICA DE VENDA */}
          <Text style={st.sectionTitle}>Política de venda</Text>
          <View style={st.card}>
            <ToggleRow label="Score mínimo para vender a prazo" sub="bloqueia clientes abaixo do score" suffix="pts"
              on={scoreOn} setOn={(v) => { setScoreOn(v); touch(); }}
              value={scoreMin} setValue={(v) => { setScoreMin(v.replace(/\D/g, "")); touch(); }} intOnly />
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
            <Text style={st.reguaSub}>Mensagens por etapa. Hoje o envio é manual pelo WhatsApp (wa.me) ao tocar em “Cobrar”. Variáveis: {"{nome}"}, {"{valor}"}, {"{vencimento}"}, {"{pix}"}, {"{dias}"}.</Text>

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
                    trackColor={{ false: Colors.bg4, true: Colors.violet }} thumbColor="#fff" />
                </View>
                <TextInput style={st.template} value={r.template} multiline
                  onChangeText={(v) => updateRule(i, { template: v })}
                  placeholder="Mensagem desta etapa" placeholderTextColor={Colors.ink3} />
              </View>
            ))}
          </View>

          <Pressable onPress={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending}
            style={[st.saveBtn, (!dirty || saveMut.isPending) && st.saveBtnDisabled]}>
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
      <Switch value={on} onValueChange={setOn} trackColor={{ false: Colors.bg4, true: Colors.violet }} thumbColor="#fff" />
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
});
