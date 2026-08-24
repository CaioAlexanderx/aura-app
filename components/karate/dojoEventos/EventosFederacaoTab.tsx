// ============================================================
// EventosFederacaoTab — Aura Karatê (dojô) · F1→F9
//
// Aba "Da federação" de app/karate/(dojo)/eventos.tsx (antes o arquivo
// inteiro, quando só existia consumo de eventos da FEDERAÇÃO). Próximos
// exames e cursos ABERTOS da federação (GET /federation/:id/dojo/events).
// exam_type distingue o fluxo: 'exame' → "Enviar candidatos" (banca
// decide quem gradua); qualquer outro valor ('curso', 'competicao'…) →
// "Inscrever alunos" (a inscrição em si já é aceite — sem decisão de
// graduação envolvida).
//
// F9 (04/08): extraído do antigo eventos.tsx pra virar UMA aba —
// components/karate/dojoEventos/MeusEventosTab é a outra, com os eventos
// que o PRÓPRIO dojô organiza (curso/seminário + exame de kyu). As duas
// fontes são conceitualmente diferentes (evento QUE A FEDERAÇÃO abre vs.
// evento QUE O DOJÔ cria) e o dono do produto pediu que a UI deixasse
// isso explícito — daí abas, não uma lista só. Ver decisão completa no
// corpo do PR/cabeçalho de app/karate/(dojo)/eventos.tsx. Lógica desta
// aba NÃO mudou nesta leva — só o container (era tela, virou componente).
//
// F5b (Aura-backend#426): a inscrição deixou de ser "manda e-mail pra
// federação" (modal "Como inscrever seus alunos" removido) — agora é
// POST /events/:eventId/enroll (cursos/competições) ou
// POST /belt-exams/:examId/candidates (exames), em lote, com seletor de
// alunos federados (SelecionarAlunosModal, reusado dos dois fluxos) e
// resultado (ResultadoLoteCard) mostrando quantos entraram e quem foi
// pulado — pt-BR, motivo por motivo.
//
// REGRA DE OURO (só nesta aba — não vale pra MeusEventosTab): só aluno
// FEDERADO participa de evento da federação. O seletor já desabilita
// não-federados com atalho pra ficha; se ainda assim algum item vier
// pulado do backend (corrida), o card de resultado explica e oferece o
// mesmo atalho.
//
// Polish QA 25/07 (item 3, mantido): a rota some da nav (DojoShell)
// enquanto o dojô não está conectado (`linked === false`,
// contexts/KarateDojo). Se o usuário chegar direto pela URL, esta aba
// mostra um estado explicativo em vez da lista (e nunca chama a API à
// toa). O backend também devolve `not_linked: true` (lista vazia) quando
// a conexão cai DEPOIS do primeiro load — o teste seguro é
// `!!body.not_linked`, então o gate cobre os dois sinais.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { karateApi, SenseiEvent, SenseiEventsResponse } from "@/services/karateApi";
import { toast } from "@/components/Toast";
import { karateDojoFederativoApi, SkippedItem } from "@/services/karateDojoFederativoApi";
import { SelecionarAlunosModal } from "@/components/karate/dojoFederativo/SelecionarAlunosModal";
import { ResultadoLoteCard } from "@/components/karate/dojoFederativo/ResultadoLoteCard";
import { mapDojoFederativoError } from "@/components/karate/dojoFederativo/helpers";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Formata 'YYYY-MM-DD' sem cair no bug de -1 dia (parse manual, sem Date UTC).
function fmtDataLonga(iso: string | null): string {
  if (!iso) return "Data a definir";
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  const [, y, mo, d] = m;
  const mi = parseInt(mo, 10) - 1;
  if (mi < 0 || mi > 11) return String(iso);
  return `${parseInt(d, 10)} de ${MESES[mi]} de ${y}`;
}

function fmtTaxa(v: number | null): string | null {
  if (v == null) return null;
  if (v === 0) return "Gratuito";
  return `Taxa: ${v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por aluno`;
}

function isExame(e: SenseiEvent): boolean {
  return e.exam_type === "exame";
}

function tipoLabel(examType: string): string {
  return examType === "curso" ? "Curso / seminário" : examType === "exame" ? "Exame de faixa" : "Evento";
}

interface EventExtra {
  loading: boolean;
  loaded: boolean;
  count: number;
  rows: { id: string; student_name: string }[];
  expanded: boolean;
}

interface EventResult {
  successCount: number;
  successLabel: string;
  skipped: SkippedItem[];
}

export function EventosFederacaoTab() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const { linked } = useKarateDojo();
  const [data, setData] = useState<SenseiEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [selectorEvent, setSelectorEvent] = useState<SenseiEvent | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [results, setResults] = useState<Record<string, EventResult>>({});
  const [extras, setExtras] = useState<Record<string, EventExtra>>({});

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listSenseiEvents(federationId);
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  // Aditivo do backend (Aura-backend#422): `not_linked` não está no tipo
  // ainda (services/karateApi.ts é grande demais pra tocar por 1 campo
  // aditivo) — cast local, teste seguro `!!`.
  const notLinked = !linked || !!(data as any)?.not_linked;
  const eventos: SenseiEvent[] = data?.events ?? [];

  const ensureExtra = useCallback(async (e: SenseiEvent) => {
    if (!federationId) return;
    setExtras((prev) => ({ ...prev, [e.id]: { ...(prev[e.id] || { count: 0, rows: [], expanded: true, loaded: false }), loading: true, expanded: true } }));
    try {
      const res = isExame(e)
        ? await karateDojoFederativoApi.listExamCandidates(federationId, e.id)
        : await karateDojoFederativoApi.listEventEnrollments(federationId, e.id);
      const rows = res.data.map((r) => ({ id: r.id, student_name: r.student_name }));
      setExtras((prev) => ({ ...prev, [e.id]: { loading: false, loaded: true, count: res.count, rows, expanded: true } }));
    } catch {
      setExtras((prev) => ({ ...prev, [e.id]: { loading: false, loaded: true, count: 0, rows: [], expanded: true } }));
    }
  }, [federationId]);

  const toggleExtra = (e: SenseiEvent) => {
    const cur = extras[e.id];
    if (!cur?.loaded) { ensureExtra(e); return; }
    setExtras((prev) => ({ ...prev, [e.id]: { ...prev[e.id], expanded: !prev[e.id].expanded } }));
  };

  const closeSelector = () => { if (!submitBusy) setSelectorEvent(null); };

  const handleSubmitSelector = async (studentIds: string[]) => {
    if (!federationId || !selectorEvent) return;
    const e = selectorEvent;
    setSubmitBusy(true);
    try {
      if (isExame(e)) {
        const res = await karateDojoFederativoApi.submitExamCandidates(federationId, e.id, studentIds);
        setResults((prev) => ({
          ...prev,
          [e.id]: {
            successCount: res.submitted,
            successLabel: res.submitted === 1 ? "candidato enviado" : "candidatos enviados",
            skipped: res.skipped,
          },
        }));
        if (res.submitted > 0) {
          toast.success(`${res.submitted} candidato${res.submitted === 1 ? "" : "s"} enviado${res.submitted === 1 ? "" : "s"} à banca.`);
        }
      } else {
        const res = await karateDojoFederativoApi.enrollInEvent(federationId, e.id, studentIds);
        setResults((prev) => ({
          ...prev,
          [e.id]: {
            successCount: res.enrolled,
            successLabel: res.enrolled === 1 ? "aluno inscrito" : "alunos inscritos",
            skipped: res.skipped,
          },
        }));
        if (res.enrolled > 0) {
          toast.success(`${res.enrolled} aluno${res.enrolled === 1 ? "" : "s"} inscrito${res.enrolled === 1 ? "" : "s"}.`);
        }
      }
      setSelectorEvent(null);
      // Força recarregar o contador desta card na próxima expansão.
      setExtras((prev) => {
        const next = { ...prev };
        delete next[e.id];
        return next;
      });
    } catch (err: any) {
      toast.error(mapDojoFederativoError(err));
    } finally {
      setSubmitBusy(false);
    }
  };

  const goFederar = () => router.push("/karate/(dojo)/alunos" as any);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>Abertos ao seu dojô</Text>
        <Text style={styles.title}>Próximos eventos</Text>
        <Text style={styles.lead}>Exames e cursos da federação. Inscreva seus alunos federados direto por aqui, em lote.</Text>
      </View>

      {notLinked ? (
        <View style={styles.stateBox}>
          <Icon name="calendar" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Conecte seu dojô à federação para ver exames, cursos e inscrever seus alunos.</Text>
          <TouchableOpacity style={styles.connectBtn} onPress={() => router.push("/karate/(dojo)/conexao" as any)} accessibilityRole="button" accessibilityLabel="Conectar meu dojô à federação">
            <Icon name="link" size={14} color={KarateColors.primary} />
            <Text style={styles.connectBtnTxt}>Conectar meu dojô</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {loading && (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color={KarateColors.primary} />
            </View>
          )}

          {!loading && error && (
            <View style={styles.stateBox}>
              <Icon name="alert_circle" size={28} color={KarateColors.ink3} />
              <Text style={styles.stateTxt}>Não foi possível carregar os eventos.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
                <Text style={styles.retryTxt}>Tentar de novo</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && eventos.length === 0 && (
            <View style={styles.stateBox}>
              <Icon name="calendar" size={28} color={KarateColors.ink3} />
              <Text style={styles.stateTxt}>Nenhum evento aberto no momento.</Text>
              <Text style={styles.stateSub}>Quando a federação abrir exames ou cursos, eles aparecem aqui.</Text>
            </View>
          )}

          {!loading && !error && eventos.map((e) => {
            const taxa = fmtTaxa(e.fee_amount);
            const exame = isExame(e);
            const extra = extras[e.id];
            const result = results[e.id];
            return (
              <View key={e.id} style={styles.card}>
                <Text style={styles.evEyebrow}>{tipoLabel(e.exam_type)}</Text>
                <Text style={styles.evTipo}>{e.name}</Text>
                <View style={styles.metaRow}><Icon name="calendar" size={13} color={KarateColors.ink3} /><Text style={styles.meta}>{fmtDataLonga(e.event_date)}</Text></View>
                {!!e.location && (
                  <View style={styles.metaRow}><Icon name="location-outline" size={13} color={KarateColors.ink3} /><Text style={styles.meta} numberOfLines={1}>{e.location}</Text></View>
                )}
                {!!taxa && (
                  <View style={styles.metaRow}><Icon name="pricetag-outline" size={13} color={KarateColors.ink3} /><Text style={styles.meta}>{taxa}</Text></View>
                )}
                {exame && (
                  <Text style={styles.examNote}>A banca da federação decide quem gradua — o dojô só envia os candidatos.</Text>
                )}

                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.askBtn} onPress={() => setSelectorEvent(e)} accessibilityRole="button">
                    <Icon name={exame ? "send" : "user_plus"} size={14} color={KarateColors.primary} />
                    <Text style={styles.askTxt}>{exame ? "Enviar candidatos" : "Inscrever alunos"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.counterRow} onPress={() => toggleExtra(e)} accessibilityRole="button">
                    <Icon name={extra?.expanded ? "chevron_up" : "chevron_down"} size={13} color={KarateColors.ink3} />
                    <Text style={styles.counterTxt}>
                      {extra?.loaded
                        ? `${extra.count} ${exame ? "candidato(s) enviado(s)" : "aluno(s) inscrito(s)"}`
                        : (exame ? "Ver candidatos enviados" : "Ver alunos inscritos")}
                    </Text>
                    {extra?.loading && <ActivityIndicator size="small" color={KarateColors.ink3} />}
                  </TouchableOpacity>
                </View>

                {extra?.expanded && !extra.loading && (
                  <View style={styles.counterList}>
                    {extra.rows.length === 0 ? (
                      <Text style={styles.counterEmpty}>Nenhum ainda.</Text>
                    ) : (
                      extra.rows.map((r) => (
                        <Text key={r.id} style={styles.counterItemTxt} numberOfLines={1}>• {r.student_name}</Text>
                      ))
                    )}
                  </View>
                )}

                {!!result && (
                  <ResultadoLoteCard
                    successCount={result.successCount}
                    successLabel={result.successLabel}
                    skipped={result.skipped}
                    onGoFederar={goFederar}
                    onClose={() => setResults((prev) => { const next = { ...prev }; delete next[e.id]; return next; })}
                  />
                )}
              </View>
            );
          })}
        </>
      )}

      <SelecionarAlunosModal
        visible={!!selectorEvent}
        onClose={closeSelector}
        federationId={federationId}
        title={selectorEvent ? (isExame(selectorEvent) ? "Enviar candidatos" : "Inscrever alunos") : ""}
        subtitle={selectorEvent?.name}
        ctaLabel={selectorEvent && isExame(selectorEvent) ? "Enviar candidatos" : "Inscrever"}
        busy={submitBusy}
        onSubmit={handleSubmitSelector}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  // PREMISSA (24/08): coluna central com largura máxima — eventos da
  // federação não esticam em monitor largo (padrão da mesa pública).
  content: { padding: 16, gap: 12, paddingBottom: 40, width: "100%", maxWidth: 920, alignSelf: "center" } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center", maxWidth: 380 } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 320 } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  connectBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 9, paddingHorizontal: 16 } as ViewStyle,
  connectBtnTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 8 } as ViewStyle,
  evEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  evTipo: { fontSize: 15, fontWeight: "700", color: KarateColors.ink, marginBottom: 2 } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  meta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  examNote: { fontSize: 11.5, color: KarateColors.ink3, fontStyle: "italic", marginTop: 2, lineHeight: 16 } as TextStyle,
  actionsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 6 } as ViewStyle,
  askBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 12 } as ViewStyle,
  askTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  counterRow: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  counterTxt: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  counterList: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, padding: 10, gap: 3, marginTop: 2 } as ViewStyle,
  counterEmpty: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  counterItemTxt: { fontSize: 12.5, color: KarateColors.ink2 } as TextStyle,
});
