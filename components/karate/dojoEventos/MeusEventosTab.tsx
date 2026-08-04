// ============================================================
// MeusEventosTab — Aura Karatê (dojô) · F9
//
// Aba "Meus eventos" de app/karate/(dojo)/eventos.tsx: a listagem
// UNIFICADA do que o PRÓPRIO dojô organiza — curso, seminário (criados
// aqui) e exame de faixa/kyu (criado na tela de Graduação, ainda por vir
// — o backend já existe: karate_dojo_belt_exams). Fonte única:
// GET /federation/:id/dojo/events-hub (karateDojoEventsApi.listEventsHub),
// que já devolve os três juntos com o discriminador `source`.
//
// NATUREZA DIFERENTE, deixada EXPLÍCITA na interface (pedido do dono do
// produto — "o sensei não pode confundir evento que eu criei com evento
// da federação"): aqui a distinção é DENTRO do próprio hub — exame de
// kyu é uma avaliação do SENSEI (não tem inscrição em lote por aqui,
// não tem botão de ação nenhum: o consumidor daquele fluxo é outra
// tela, ainda não construída) enquanto curso/seminário são organizados
// e preenchidos livremente pelo dojô, com inscrição em lote própria.
//
// NÃO oferece criar exame de kyu (CriarEventoDojoModal só sabe
// curso/seminario) — de propósito, ver cabeçalho do modal.
//
// Inscrição: reusa SelecionarAlunosModal (mesmo seletor da federação),
// mas com requireFederated={false} — aluno não federado também participa
// de curso/seminário do PRÓPRIO dojô (o backend ancorou a inscrição no
// aluno do dojô, karate_dojo_students, justamente por isso).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateFonts as F } from "@/constants/karateTheme";
import {
  PageHead, SectionHead, Card, KpiBand, ShojiBadge, ShojiButton,
} from "@/components/karate/shoji";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { toast } from "@/components/Toast";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateDojoEventsApi, EventsHubItem, DojoEventStatus, EnrollmentListRow,
} from "@/services/karateDojoEventsApi";
import { CriarEventoDojoModal } from "./CriarEventoDojoModal";
import { SelecionarAlunosModal } from "@/components/karate/dojoFederativo/SelecionarAlunosModal";
import { ResultadoLoteCard } from "@/components/karate/dojoFederativo/ResultadoLoteCard";
import { formatEventDateShort } from "@/utils/eventDate";

const STATUS_VIEW: Record<DojoEventStatus, { label: string; badge: "neutral" | "ok" | "danger" }> = {
  scheduled: { label: "Agendado", badge: "neutral" },
  completed: { label: "Concluído", badge: "ok" },
  cancelled: { label: "Cancelado", badge: "danger" },
};

const KIND_TAG: Record<string, { label: string; icon: string; accent?: boolean }> = {
  curso: { label: "Curso", icon: "dumbbell" },
  seminario: { label: "Seminário", icon: "users" },
  exame_kyu: { label: "Exame de faixa (kyu)", icon: "ribbon", accent: true },
};

interface ExtraState {
  loading: boolean;
  loaded: boolean;
  rows: EnrollmentListRow[];
  expanded: boolean;
}

interface EnrollResultState {
  successCount: number;
  skipped: { student_id: string | null; name: string | null; reason: string; message?: string | null }[];
}

export function MeusEventosTab() {
  const { federationId } = useKarateFederation();
  const [items, setItems] = useState<EventsHubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showCriar, setShowCriar] = useState(false);

  const [enrollTarget, setEnrollTarget] = useState<EventsHubItem | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [results, setResults] = useState<Record<string, EnrollResultState>>({});
  const [extras, setExtras] = useState<Record<string, ExtraState>>({});

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await karateDojoEventsApi.listEventsHub(federationId, { pageSize: 200 });
      setItems(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const scheduled = items.filter((i) => i.status === "scheduled");
  const cursosSeminarios = scheduled.filter((i) => i.source === "dojo_event").length;
  const examesKyu = scheduled.filter((i) => i.source === "belt_exam").length;
  const participantes = scheduled.reduce((sum, i) => sum + (i.participants_count || 0), 0);

  const ensureExtra = useCallback(async (item: EventsHubItem) => {
    if (!federationId) return;
    setExtras((prev) => ({ ...prev, [item.id]: { loading: true, loaded: false, rows: [], expanded: true } }));
    try {
      const res = await karateDojoEventsApi.listEnrollments(federationId, item.id);
      setExtras((prev) => ({ ...prev, [item.id]: { loading: false, loaded: true, rows: res.data, expanded: true } }));
    } catch {
      setExtras((prev) => ({ ...prev, [item.id]: { loading: false, loaded: true, rows: [], expanded: true } }));
    }
  }, [federationId]);

  const toggleExtra = (item: EventsHubItem) => {
    const cur = extras[item.id];
    if (!cur?.loaded) { ensureExtra(item); return; }
    setExtras((prev) => ({ ...prev, [item.id]: { ...prev[item.id], expanded: !prev[item.id].expanded } }));
  };

  const closeSelector = () => { if (!submitBusy) setEnrollTarget(null); };

  const handleSubmitEnroll = async (studentIds: string[]) => {
    if (!federationId || !enrollTarget) return;
    const target = enrollTarget;
    setSubmitBusy(true);
    try {
      const res = await karateDojoEventsApi.enrollBatch(federationId, target.id, studentIds);
      setResults((prev) => ({
        ...prev,
        [target.id]: { successCount: res.enrolled, skipped: res.skipped },
      }));
      if (res.enrolled > 0) {
        toast.success(`${res.enrolled} aluno${res.enrolled === 1 ? "" : "s"} inscrito${res.enrolled === 1 ? "" : "s"}.`);
      }
      setEnrollTarget(null);
      setExtras((prev) => { const next = { ...prev }; delete next[target.id]; return next; });
      load();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível inscrever os alunos. Tente de novo.");
    } finally {
      setSubmitBusy(false);
    }
  };

  if (error) return <KarateErrorState onRetry={load} />;

  return (
    <>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.wrap}>
      <PageHead
        eyebrow="Seu dojô"
        title="Meus eventos"
        sub="Curso, seminário e exame de faixa — tudo o que o seu dojô organiza, num só lugar. O exame de faixa é avaliação do sensei; curso e seminário aceitam qualquer aluno, federado ou não."
        actions={<ShojiButton label="Criar evento" icon="add" variant="sumi" onPress={() => setShowCriar(true)} />}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={P.red} />
      ) : (
        <>
          <KpiBand items={[
            { label: "Cursos e seminários", value: cursosSeminarios },
            { label: "Exames de faixa", value: examesKyu },
            { label: "Participantes agendados", value: participantes },
          ]} />

          <View style={styles.section}>
            <SectionHead title="Próximos e recentes" sub="Ordenado por data — mais recente primeiro." />

            {items.length === 0 ? (
              <Card>
                <KarateEmptyState
                  icon="calendar"
                  title="Nenhum evento ainda"
                  subtitle="Crie um curso ou seminário para começar. Exames de faixa aparecem aqui quando forem lançados."
                  action={<ShojiButton label="Criar evento" icon="add" variant="sumi" onPress={() => setShowCriar(true)} style={{ marginTop: 12 }} />}
                  style={{ paddingVertical: 28 }}
                />
              </Card>
            ) : (
              items.map((item) => {
                const kindTag = KIND_TAG[item.kind] ?? KIND_TAG.curso;
                const statusView = STATUS_VIEW[item.status] ?? STATUS_VIEW.scheduled;
                const isOwn = item.source === "dojo_event";
                const canEnroll = isOwn && item.status === "scheduled";
                const extra = extras[item.id];
                const result = results[item.id];

                return (
                  <Card key={`${item.source}-${item.id}`} style={{ marginBottom: 12 }}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={[styles.kindTag, kindTag.accent && styles.kindTagAccent]}>
                          <Icon name={kindTag.icon as any} size={12} color={kindTag.accent ? P.red : C.ink2} />
                          <Text style={[styles.kindTagText, kindTag.accent && styles.kindTagTextAccent]}>{kindTag.label}</Text>
                        </View>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                      </View>
                      <ShojiBadge status={statusView.badge} label={statusView.label} />
                    </View>

                    <View style={styles.metaRow}>
                      <Meta icon="calendar" text={formatEventDateShort(item.event_date, "Data a definir")} />
                      {!!item.location && <Meta icon="location" text={item.location} />}
                      <Meta icon="users" text={`${item.participants_count} participante${item.participants_count === 1 ? "" : "s"}`} />
                    </View>

                    {isOwn ? (
                      <View style={styles.actionsRow}>
                        {canEnroll && (
                          <ShojiButton label="Inscrever alunos" icon="user_plus" variant="ghost" onPress={() => setEnrollTarget(item)} />
                        )}
                        <TouchableOpacity style={styles.counterRow} onPress={() => toggleExtra(item)} accessibilityRole="button">
                          <Icon name={extra?.expanded ? "chevron_up" : "chevron_down"} size={13} color={C.ink3} />
                          <Text style={styles.counterTxt}>
                            {extra?.loaded ? `${extra.rows.length} inscrito(s)` : "Ver alunos inscritos"}
                          </Text>
                          {extra?.loading && <ActivityIndicator size="small" color={C.ink3} />}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.examNote}>
                        Avaliação conduzida pelo sensei — gerida pelo fluxo de graduação do dojô, não por aqui.
                      </Text>
                    )}

                    {extra?.expanded && !extra.loading && (
                      <View style={styles.counterList}>
                        {extra.rows.length === 0 ? (
                          <Text style={styles.counterEmpty}>Nenhum aluno inscrito ainda.</Text>
                        ) : (
                          extra.rows.map((r) => (
                            <Text key={r.id} style={styles.counterItemTxt} numberOfLines={1}>
                              • {r.name || "Aluno"}{!r.federated ? " · não federado" : ""}
                            </Text>
                          ))
                        )}
                      </View>
                    )}

                    {!!result && (
                      <ResultadoLoteCard
                        successCount={result.successCount}
                        successLabel={result.successCount === 1 ? "aluno inscrito" : "alunos inscritos"}
                        skipped={result.skipped}
                        onClose={() => setResults((prev) => { const next = { ...prev }; delete next[item.id]; return next; })}
                      />
                    )}
                  </Card>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>

    <CriarEventoDojoModal
      visible={showCriar}
      onClose={() => setShowCriar(false)}
      federationId={federationId}
      onCreated={load}
    />

    <SelecionarAlunosModal
      visible={!!enrollTarget}
      onClose={closeSelector}
      federationId={federationId}
      title="Inscrever alunos"
      subtitle={enrollTarget?.name}
      ctaLabel="Inscrever"
      busy={submitBusy}
      onSubmit={handleSubmitEnroll}
      requireFederated={false}
    />
    </>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return <View style={styles.metaItem}><Icon name={icon as any} size={13} color={C.ink3} /><Text style={styles.metaTxt}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40 } as ViewStyle,
  section: { marginTop: 20 } as ViewStyle,

  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 } as ViewStyle,
  cardTitle: { fontFamily: F.heading, fontSize: 17, color: C.ink } as TextStyle,

  kindTag: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: P.glass2, borderWidth: 1, borderColor: P.line2, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 } as ViewStyle,
  kindTagAccent: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  kindTagText: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", color: C.ink2, textTransform: "uppercase", letterSpacing: 0.3 } as TextStyle,
  kindTagTextAccent: { color: P.red } as TextStyle,

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 10 } as ViewStyle,
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  metaTxt: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,

  actionsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14 } as ViewStyle,
  examNote: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, fontStyle: "italic", lineHeight: 16 } as TextStyle,

  counterRow: { flexDirection: "row", alignItems: "center", gap: 5 } as ViewStyle,
  counterTxt: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: C.ink3 } as TextStyle,
  counterList: { backgroundColor: C.bg2, borderRadius: 10, padding: 10, gap: 3, marginTop: 10 } as ViewStyle,
  counterEmpty: { fontFamily: F.body, fontSize: 12, color: C.ink3 } as TextStyle,
  counterItemTxt: { fontFamily: F.body, fontSize: 12.5, color: C.ink2 } as TextStyle,
});
