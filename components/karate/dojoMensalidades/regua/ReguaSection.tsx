// ============================================================
// ReguaSection — aba "Régua" da tela Mensalidades (F3c)
//
// Régua de cobrança: lembretes automáticos por e-mail perto do
// vencimento da mensalidade. Contrato Aura-backend (paralelo, MESMO
// contrato de services/karateDojoBillingApi.ts):
//   GET/PUT /federation/:id/dojo/billing/reminder-config
//   GET     /federation/:id/dojo/billing/reminder-log?competence=
//   POST    /federation/:id/dojo/billing/reminders/run
//
// enabled/offsets são salvos juntos (botão "Salvar régua" só habilita
// quando há diferença pro que está salvo no servidor). send_email é
// enviado sempre true — hoje o único canal é e-mail; o campo existe no
// contrato pra suportar canais futuros sem quebrar o payload.
//
// Degrade: 503 SCHEMA_PENDING (migration pendente) → aviso amigável,
// sem crash — mesmo padrão de PixConfigCard/ContaAuraCard. O log é
// secundário: falha nele não derruba a seção inteira.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Switch, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateDojoBillingApi, DojoReminderConfig, DojoReminderLogItem, DojoRunRemindersResult,
} from "@/services/karateDojoBillingApi";
import { currentCompetence, mapBillingError } from "../helpers";
import { CompetenceSelector } from "../CompetenceSelector";
import { OffsetsEditor } from "./OffsetsEditor";
import { ReminderLogList } from "./ReminderLogList";

const DEFAULT_CONFIG: DojoReminderConfig = { enabled: false, offsets: [-3, 0, 3], send_email: true, updated_at: null };

function sameOffsets(a: number[], b: number[]): boolean {
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

export function ReguaSection() {
  const { federationId } = useKarateFederation();

  const [loading, setLoading] = useState(true);
  const [schemaPending, setSchemaPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [offsets, setOffsets] = useState<number[]>([-3, 0, 3]);
  const [saved, setSaved] = useState<DojoReminderConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<DojoRunRemindersResult | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);

  const [logCompetence, setLogCompetence] = useState(currentCompetence());
  const [log, setLog] = useState<DojoReminderLogItem[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logErr, setLogErr] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(null);
    setSchemaPending(false);
    try {
      const cfg = await karateDojoBillingApi.getReminderConfig(federationId);
      setSaved(cfg);
      setEnabled(cfg.enabled);
      setOffsets(cfg.offsets ?? []);
    } catch (e: any) {
      const mapped = mapBillingError(e);
      if (mapped.code === "SCHEMA_PENDING") setSchemaPending(true);
      else setError(mapped.message);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  const loadLog = useCallback(async () => {
    if (!federationId) return;
    setLogLoading(true);
    setLogErr(null);
    try {
      const res = await karateDojoBillingApi.getReminderLog(federationId, logCompetence);
      setLog(res.data ?? []);
    } catch (e: any) {
      // Log é secundário — falha silenciosa não derruba a tela, só o bloco.
      setLogErr(mapBillingError(e).message);
    } finally {
      setLogLoading(false);
    }
  }, [federationId, logCompetence]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { if (!schemaPending) loadLog(); }, [loadLog, schemaPending]);

  if (!federationId) return null;

  const dirty = enabled !== saved.enabled || !sameOffsets(offsets, saved.offsets ?? []);

  async function save() {
    setSaving(true);
    setSaveErr(null);
    try {
      const cfg = await karateDojoBillingApi.updateReminderConfig(federationId, {
        enabled,
        offsets,
        send_email: true,
      });
      setSaved(cfg);
      setEnabled(cfg.enabled);
      setOffsets(cfg.offsets ?? []);
    } catch (e: any) {
      setSaveErr(mapBillingError(e).message);
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setRunErr(null);
    setRunResult(null);
    try {
      const res = await karateDojoBillingApi.runReminders(federationId);
      setRunResult(res);
      loadLog();
    } catch (e: any) {
      setRunErr(mapBillingError(e).message);
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator size="large" color={KarateColors.primary} />
      </View>
    );
  }

  if (schemaPending) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.stateBox}>
          <Icon name="clock" size={26} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>A régua de cobrança ainda não está disponível neste ambiente.</Text>
          <Text style={styles.stateSub}>Uma atualização está pendente no servidor. Tente novamente mais tarde.</Text>
        </View>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.stateBox}>
          <Icon name="alert" size={26} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadConfig} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Icon name="mail-outline" size={16} color={KarateColors.primary} />
            <Text style={styles.cardTitle}>Lembretes automáticos por e-mail</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: KarateColors.border2, true: KarateColors.primarySoft }}
            thumbColor={enabled ? KarateColors.primary : "#fff"}
            accessibilityLabel="Lembretes automáticos por e-mail"
          />
        </View>
        <Text style={styles.cardSub}>
          Quando ativado, o aluno (ou responsável) recebe um e-mail com o link de pagamento da
          mensalidade perto do vencimento — sem precisar de contato manual.
        </Text>

        {enabled && (
          <View style={{ marginTop: 12, gap: 10 }}>
            <Text style={styles.label}>Quando enviar</Text>
            <OffsetsEditor offsets={offsets} onChange={setOffsets} />
          </View>
        )}

        {!!saveErr && <Text style={styles.errTxt}>{saveErr}</Text>}

        <View style={{ flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <KarateButton
            label={saving ? "Salvando…" : "Salvar régua"}
            variant="sumi"
            size="sm"
            loading={saving}
            disabled={!dirty}
            onPress={save}
          />
          <KarateButton
            label={running ? "Enviando…" : "Enviar lembretes agora"}
            variant="secondary"
            size="sm"
            loading={running}
            onPress={runNow}
          />
        </View>

        {!!runErr && <Text style={[styles.errTxt, { marginTop: 8 }]}>{runErr}</Text>}
        {!!runResult && (
          <View style={styles.runResultBox}>
            <Icon name="check_circle" size={14} color={KarateColors.ok} />
            <Text style={styles.runResultTxt}>
              {runResult.sent} enviado(s) · {runResult.skipped} sem e-mail · {runResult.failed} falhou(aram)
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.logHead}>
          <Text style={styles.cardTitle}>Lembretes enviados</Text>
          <CompetenceSelector competence={logCompetence} onChange={setLogCompetence} />
        </View>
        {logLoading && (
          <View style={styles.stateBoxSm}>
            <ActivityIndicator size="small" color={KarateColors.primary} />
          </View>
        )}
        {!logLoading && !!logErr && <Text style={styles.errTxt}>{logErr}</Text>}
        {!logLoading && !logErr && <ReminderLogList items={log} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12.5, color: KarateColors.ink2, marginTop: 8, lineHeight: 18 } as TextStyle,
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2, color: KarateColors.ink2, textTransform: "uppercase" } as TextStyle,
  errTxt: { fontSize: 12, color: KarateColors.danger, marginTop: 8 } as TextStyle,
  runResultBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, backgroundColor: KarateColors.okSoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 10, alignSelf: "flex-start" } as ViewStyle,
  runResultTxt: { fontSize: 12, fontWeight: "700", color: KarateColors.ok } as TextStyle,
  logHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 } as ViewStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 32 } as ViewStyle,
  stateBoxSm: { alignItems: "center", justifyContent: "center", paddingVertical: 16 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 380, lineHeight: 17 } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
});
