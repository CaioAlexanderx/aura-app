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
// enabled/offsets/send_whatsapp_auto são salvos juntos (botão "Salvar
// régua" só habilita quando há diferença pro que está salvo no
// servidor). send_email é enviado sempre true — e-mail é o canal base.
//
// Onda 5b: send_whatsapp_auto liga o SEGUNDO canal automático — templates
// de WhatsApp pela Cloud API (aba "WhatsApp" da mesma tela, contrato em
// services/waApi.ts). Depende de número conectado + template aprovado
// pela Meta, e o opt-out do destinatário vence sempre. Backend anterior
// à Onda 5b não devolve o campo: ausente = desligado.
//
// Degrade: 503 SCHEMA_PENDING (migration pendente) → aviso amigável,
// sem crash — mesmo padrão de PixConfigCard/ContaAuraCard. O log é
// secundário: falha nele não derruba a seção inteira.
//
// QA 27/07 (item 3, contrato #429 FINAL):
//   • o resumo do "Enviar lembretes agora" passa a usar buildRunSummary
//     (sent/skipped_no_email/skipped_sent/failed) em vez do `skipped`
//     genérico, que misturava "sem e-mail" com dedupe.
//   • nova seção WhatsAppQueueSection (canal alternativo pro responsável
//     sem e-mail — no Brasil ele tem telefone, não e-mail).
//
// QA prod 30/07 (item 4): salvar a régua muda quem é elegível HOJE pro
// WhatsApp (offsets/enabled mudam o cálculo de "quem vence perto o
// suficiente") — sem refazer a fila, ela ficava vazia até um reload da
// página inteira. `queueRefreshKey` incrementa a cada salvamento
// bem-sucedido e é passado pro WhatsAppQueueSection, que refaz o load
// sozinho (sem recarregar o resto da tela).
//
// Fase 3c — GUARDAS DE CUSTO no toggle do WhatsApp automático:
// diferente do e-mail, cada mensagem de WhatsApp é COBRADA pela Meta na
// conta do dojô. Por isso o sub-toggle não é mais um interruptor livre:
//   • fica DESABILITADO enquanto faltar addon, número conectado,
//     template aprovado — ou enquanto a fila estiver pausada —, com o
//     motivo escrito logo abaixo (waAutoBlockers em ../../dojoWhatsapp);
//   • LIGAR abre a prévia (WaPreviewModal): o sensei vê quantos alunos
//     receberiam hoje antes de confirmar;
//   • DESLIGAR nunca é bloqueado — quem já está gastando tem que poder
//     parar de gastar, mesmo com o status falhando.
// O backend repete todas as guardas (403 ADDON_REQUIRED / 409
// NAO_CONECTADO no PUT reminder-config); a UI existe para o sensei não
// chegar lá. Campos novos ausentes = desconhecido, e desconhecido
// bloqueia: é melhor uma ligação para a Aura do que uma fatura surpresa.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Switch, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useAuthStore } from "@/stores/auth";
import {
  karateDojoBillingApi, DojoReminderConfig, DojoReminderLogItem, DojoRunRemindersResult,
} from "@/services/karateDojoBillingApi";
import { waApi, WaStatus } from "@/services/waApi";
import {
  isWaErrorCode, mapWaError, waAutoBlockers,
} from "@/components/karate/dojoWhatsapp/helpers";
import { WaPreviewModal } from "@/components/karate/dojoWhatsapp/WaPreviewModal";
import { buildRunSummary, currentCompetence, mapBillingError } from "../helpers";
import { CompetenceSelector } from "../CompetenceSelector";
import { OffsetsEditor } from "./OffsetsEditor";
import { ReminderLogList } from "./ReminderLogList";
import { WhatsAppQueueSection } from "./WhatsAppQueueSection";

const DEFAULT_CONFIG: DojoReminderConfig = {
  enabled: false, offsets: [-3, 0, 3], send_email: true, send_whatsapp_auto: false, updated_at: null,
};

function sameOffsets(a: number[], b: number[]): boolean {
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

export function ReguaSection() {
  const { federationId } = useKarateFederation();
  // No karatê o dojô É uma company — o /whatsapp/status é por company.
  const company = useAuthStore((s) => s.company) as any;
  const companyId: string | null = company?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [schemaPending, setSchemaPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [offsets, setOffsets] = useState<number[]>([-3, 0, 3]);
  // Onda 5b — canal automático por WhatsApp (Cloud API), ver aba "WhatsApp".
  const [waAuto, setWaAuto] = useState(false);
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

  // QA 30/07 (item 4): incrementa a cada "Salvar régua" bem-sucedido —
  // WhatsAppQueueSection refaz o load sozinho quando isto muda.
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);

  // Fase 3c — guardas de custo do canal WhatsApp.
  const [waStatus, setWaStatus] = useState<WaStatus | null>(null);
  const [waLoading, setWaLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

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
      setWaAuto(cfg.send_whatsapp_auto === true);
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

  // Falha aqui NÃO derruba a seção: o canal base é o e-mail. O que ela
  // faz é manter waStatus null — e null bloqueia o toggle do WhatsApp,
  // que é exatamente o comportamento seguro.
  const loadWaStatus = useCallback(async () => {
    if (!companyId) { setWaLoading(false); return; }
    setWaLoading(true);
    try {
      setWaStatus(await waApi.getStatus(companyId));
    } catch {
      setWaStatus(null);
    } finally {
      setWaLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { if (!schemaPending) loadLog(); }, [loadLog, schemaPending]);
  useEffect(() => { loadWaStatus(); }, [loadWaStatus]);

  if (!federationId) return null;

  const dirty =
    enabled !== saved.enabled ||
    !sameOffsets(offsets, saved.offsets ?? []) ||
    waAuto !== (saved.send_whatsapp_auto === true);

  // Enquanto o status não chega, waStatus é null → waAutoBlockers devolve
  // SEM_STATUS e o switch fica travado. É o lado certo do erro.
  const waBlockers = waAutoBlockers(waStatus);
  const waAutoTravado = !waAuto && (waLoading || waBlockers.length > 0);

  /**
   * `waAutoValue` existe porque a ativação pela prévia salva ANTES do
   * estado do switch assentar: o modal confirma e o PUT já sai com
   * true, sem depender de um re-render no meio do caminho.
   */
  async function save(waAutoValue: boolean = waAuto) {
    setSaving(true);
    setSaveErr(null);
    try {
      const cfg = await karateDojoBillingApi.updateReminderConfig(federationId, {
        enabled,
        offsets,
        send_email: true,
        send_whatsapp_auto: waAutoValue,
      });
      setSaved(cfg);
      setEnabled(cfg.enabled);
      setOffsets(cfg.offsets ?? []);
      setWaAuto(cfg.send_whatsapp_auto === true);
      setPreviewOpen(false);
      // Quem é elegível hoje pro WhatsApp muda junto com a régua.
      setQueueRefreshKey((k) => k + 1);
    } catch (e: any) {
      // O gate do WhatsApp responde 403 ADDON_REQUIRED / 409 NAO_CONECTADO
      // nesta MESMA rota, e mapBillingError transformaria qualquer 409 em
      // "Essa cobrança já foi paga" — texto errado e assustador.
      const code = e?.data?.code ?? e?.code ?? null;
      setSaveErr(isWaErrorCode(code) ? mapWaError(e).message : mapBillingError(e).message);
      // Guarda recusada pelo servidor: o status local está velho.
      if (isWaErrorCode(code)) { setWaAuto(saved.send_whatsapp_auto === true); loadWaStatus(); }
    } finally {
      setSaving(false);
    }
  }

  // Ligar é o único caminho que passa pela prévia. Desligar é sempre
  // livre e imediato: quem está gastando tem que poder parar de gastar.
  function onToggleWaAuto(next: boolean) {
    if (!next) { setWaAuto(false); return; }
    setSaveErr(null);
    setPreviewOpen(true);
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

            <View style={styles.subToggle} testID="regua-wa-auto">
              <View style={styles.subToggleHead}>
                <View style={styles.subToggleTitleRow}>
                  <Icon name="whatsapp" size={15} color={KarateColors.whatsapp} />
                  <Text style={styles.subToggleTitle}>Enviar também por WhatsApp (automático)</Text>
                </View>
                <Switch
                  value={waAuto}
                  onValueChange={onToggleWaAuto}
                  disabled={waAutoTravado}
                  trackColor={{ false: KarateColors.border2, true: KarateColors.primarySoft }}
                  thumbColor={waAuto ? KarateColors.primary : "#fff"}
                  accessibilityLabel="Enviar também por WhatsApp (automático)"
                  accessibilityState={{ disabled: waAutoTravado, checked: waAuto }}
                  testID={waAutoTravado ? "regua-wa-switch-travado" : "regua-wa-switch"}
                />
              </View>
              <Text style={styles.subToggleSub}>
                Nos mesmos dias da régua, o lembrete também sai por WhatsApp — sem você abrir o
                aplicativo. Cada mensagem é cobrada pela Meta na conta do dojô, então antes de
                ligar você vê quantos alunos receberiam hoje. Quem pediu para não receber nunca
                recebe, mesmo com isto ligado. A fila manual abaixo continua disponível de
                qualquer forma.
              </Text>

              {waLoading && !waAuto && (
                <Text style={styles.verificandoTxt} testID="regua-wa-verificando">
                  Verificando a conexão do WhatsApp do dojô…
                </Text>
              )}

              {!waLoading && waAutoTravado && (
                <View style={styles.motivos} testID="regua-wa-motivos">
                  {waBlockers.map((b) => (
                    <View key={b.code} style={styles.motivoRow}>
                      <Icon name="alert" size={12} color={KarateColors.warn} />
                      <Text style={styles.motivoTxt}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
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
            <Text style={styles.runResultTxt}>{buildRunSummary(runResult)}</Text>
          </View>
        )}
      </View>

      <WhatsAppQueueSection refreshKey={queueRefreshKey} />

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

      {!!companyId && (
        <WaPreviewModal
          visible={previewOpen}
          companyId={companyId}
          status={waStatus}
          saving={saving}
          onCancel={() => setPreviewOpen(false)}
          onConfirm={() => { setWaAuto(true); save(true); }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40, width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,
  subToggle: { marginTop: 4, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, padding: 11 } as ViewStyle,
  subToggleHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 } as ViewStyle,
  subToggleTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 } as ViewStyle,
  subToggleTitle: { fontSize: 13, fontWeight: "700", color: KarateColors.ink, flexShrink: 1 } as TextStyle,
  subToggleSub: { fontSize: 11.5, color: KarateColors.ink2, marginTop: 7, lineHeight: 16.5, maxWidth: 620 } as TextStyle,
  motivos: { gap: 4, marginTop: 9 } as ViewStyle,
  motivoRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 } as ViewStyle,
  motivoTxt: { flex: 1, fontSize: 11.5, fontWeight: "600", color: KarateColors.warn, lineHeight: 16.5, maxWidth: 600 } as TextStyle,
  verificandoTxt: { fontSize: 11.5, color: KarateColors.ink3, marginTop: 9, lineHeight: 16.5 } as TextStyle,
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
