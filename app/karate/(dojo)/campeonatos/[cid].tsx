// ============================================================
// AURA DOJÔ — P0 Hub de Campeonatos: CARRINHO DA DELEGAÇÃO
//
// A tela que substitui a planilha: o técnico monta a delegação
// (atletas → categorias, equipes com roster, nº de oficiais), vê a
// COTAÇÃO AO VIVO (dry-run no backend a cada mudança — linhas, isenções,
// avisos de compatibilidade, cotas por clube) e submete UM pedido:
// PIX consolidado da federação OU envio de comprovante (modo manual).
//
// Regras de UX herdadas do backend (e dos regulamentos):
//   • skips (não federado, já inscrito) aparecem como aviso por item —
//     nunca derrubam o carrinho;
//   • compatibilidade de categoria é SÓ AVISO (FPKT #1);
//   • cota por clube estourada BLOQUEIA o envio (o técnico decide quem
//     fica — o backend recusaria com 422 QUOTA_EXCEEDED).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateFonts as F, KarateRadius as R } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { PixQRCode } from "@/components/karate/PixQRCode";
import { toast } from "@/components/Toast";
import { copyToClipboard } from "@/utils/clipboard";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useDojoSectionLabel } from "@/components/karate/DojoShell";
import { formatEventDateLong } from "@/utils/eventDate";
import { SelecionarAlunosModal } from "@/components/karate/dojoFederativo/SelecionarAlunosModal";
import { CategoryPickerModal } from "@/components/karate/dojoCampeonatos/CategoryPickerModal";
import { karateDojoStudentsApi, DojoStudent, DOJO_STUDENTS_MAX_LIMIT } from "@/services/karateDojoStudentsApi";
import {
  karateDelegationsApi, OpenCompetition, EnrollmentCategory, QuoteResponse,
  SubmitResponse, DelegationBody, formatBRL,
} from "@/services/karateDelegationsApi";

type TeamDraft = {
  key: string;
  name: string;
  sex: "M" | "F" | "mixed";
  category_ids: string[];
  titular_ids: string[];
  reserve_ids: string[];
};

type PickerTarget =
  | { type: "athletes" }
  | { type: "team-titulares"; key: string }
  | { type: "team-reservas"; key: string };

const SEX_OPTIONS: ["M" | "F" | "mixed", string][] = [["M", "Masc"], ["F", "Fem"], ["mixed", "Misto"]];

export default function DelegationCart() {
  const router = useRouter();
  const { cid } = useLocalSearchParams<{ cid: string }>();
  const { federationId } = useKarateFederation();
  useDojoSectionLabel("Campeonatos");

  // ── Dados base ──
  const [competition, setCompetition] = useState<OpenCompetition | null>(null);
  const [categories, setCategories] = useState<EnrollmentCategory[]>([]);
  const [students, setStudents] = useState<Map<string, DojoStudent>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Carrinho ──
  const [athleteCats, setAthleteCats] = useState<Map<string, string[]>>(new Map());
  const [teams, setTeams] = useState<TeamDraft[]>([]);
  const [officials, setOfficials] = useState(0);
  const [paymentMode, setPaymentMode] = useState<"pix_direct" | "manual">("pix_direct");

  // ── Modais ──
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [catPickerFor, setCatPickerFor] = useState<{ type: "athlete"; id: string } | { type: "team"; key: string } | null>(null);

  // ── Cotação / envio ──
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!federationId || !cid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [comps, cats, studs] = await Promise.all([
        karateDelegationsApi.listOpenCompetitions(federationId),
        karateDelegationsApi.listCategories(federationId, String(cid)),
        karateDojoStudentsApi.listStudents(federationId, { status: "active", limit: DOJO_STUDENTS_MAX_LIMIT }),
      ]);
      const comp = (comps.data || []).find((c) => c.id === String(cid)) || null;
      if (!comp) {
        setLoadError("Campeonato não encontrado ou com inscrições encerradas.");
      }
      setCompetition(comp);
      setCategories(cats.data || []);
      setStudents(new Map((studs.data || []).map((st) => [st.id, st])));
    } catch (e: any) {
      setLoadError(e?.message || "Não foi possível carregar o campeonato.");
    } finally {
      setLoading(false);
    }
  }, [federationId, cid]);

  useEffect(() => { load(); }, [load]);

  // ── Corpo do pedido (compartilhado por quote e submit) ──
  const body: DelegationBody = useMemo(() => ({
    athletes: [...athleteCats.entries()]
      .filter(([, catsSel]) => catsSel.length > 0)
      .map(([student_id, category_ids]) => ({ student_id, category_ids })),
    teams: teams
      .filter((t) => t.name.trim() && t.category_ids.length > 0 && t.titular_ids.length >= 2)
      .map((t) => ({
        name: t.name.trim(), sex: t.sex, category_ids: t.category_ids,
        titular_ids: t.titular_ids, reserve_ids: t.reserve_ids,
      })),
    officials_count: officials,
  }), [athleteCats, teams, officials]);

  const cartHasItems = body.athletes.length > 0 || body.teams.length > 0;

  // ── Cotação ao vivo (debounce 600ms) ──
  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    if (!cartHasItems || !competition) { setQuote(null); return; }
    setQuoting(true);
    quoteTimer.current = setTimeout(async () => {
      try {
        const q = await karateDelegationsApi.quote(federationId, competition.id, body);
        setQuote(q);
      } catch (e: any) {
        // Cotação falhou (ex.: 409 fechou no meio) — mostra e não trava.
        toast.error(e?.message || "Não foi possível cotar a delegação.");
        setQuote(null);
      } finally {
        setQuoting(false);
      }
    }, 600);
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(body), competition?.id, federationId]);

  // ── Ações do carrinho ──
  const addAthletes = (ids: string[]) => {
    setAthleteCats((prev) => {
      const next = new Map(prev);
      for (const id of ids) if (!next.has(id)) next.set(id, []);
      return next;
    });
  };
  const removeAthlete = (id: string) => {
    setAthleteCats((prev) => { const next = new Map(prev); next.delete(id); return next; });
  };
  const setAthleteCategories = (id: string, catIds: string[]) => {
    setAthleteCats((prev) => new Map(prev).set(id, catIds));
  };

  const addTeam = () => {
    setTeams((prev) => [...prev, {
      key: `t-${Date.now()}`, name: "", sex: "mixed", category_ids: [], titular_ids: [], reserve_ids: [],
    }]);
  };
  const patchTeam = (key: string, patch: Partial<TeamDraft>) => {
    setTeams((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  };
  const removeTeam = (key: string) => setTeams((prev) => prev.filter((t) => t.key !== key));

  const onPickerSubmit = (ids: string[]) => {
    if (!pickerTarget) return;
    if (pickerTarget.type === "athletes") addAthletes(ids);
    else if (pickerTarget.type === "team-titulares") {
      patchTeam(pickerTarget.key, { titular_ids: [...new Set(ids)] });
    } else {
      patchTeam(pickerTarget.key, { reserve_ids: [...new Set(ids)] });
    }
    setPickerTarget(null);
  };

  // ── Envio ──
  const canSubmit = cartHasItems && !submitting
    && (!quote || quote.quota_violations.length === 0);

  const submit = async () => {
    if (!competition) return;
    setSubmitting(true);
    try {
      const res = await karateDelegationsApi.submit(federationId, competition.id, {
        ...body, payment_mode: paymentMode,
      });
      setResult(res);
      toast.success("Delegação enviada.");
    } catch (e: any) {
      if (e?.data?.quota_violations) {
        toast.error("Cota por clube excedida — ajuste a delegação.");
        // Recarrega a cotação para exibir as violações atualizadas.
        try { setQuote(await karateDelegationsApi.quote(federationId, competition.id, body)); } catch (_) { /* noop */ }
      } else {
        toast.error(e?.message || "Não foi possível enviar a delegação.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──
  if (loading) return <ActivityIndicator style={{ marginTop: 48 }} color={C.primary} />;
  if (loadError || !competition) {
    return <KarateErrorState message={loadError || "Campeonato não encontrado."} onRetry={load} />;
  }

  if (result) {
    return <SuccessView result={result} onDone={() => router.replace("/karate/(dojo)/campeonatos" as any)} />;
  }

  const nameOf = (id: string) => students.get(id)?.full_name || "Aluno";
  const catNameOf = (id: string) => categories.find((c) => c.id === id)?.name || "categoria";

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 140 }}>
        {/* Cabeçalho do campeonato */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Voltar">
            <Icon name="arrow-left" size={20} color={C.ink2} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.compName} numberOfLines={2}>{competition.name}</Text>
            <Text style={s.compMeta}>
              {formatEventDateLong(competition.event_date)}{competition.location ? ` · ${competition.location}` : ""}
            </Text>
          </View>
        </View>

        {/* ── Atletas ── */}
        <Section
          title="Atletas — provas individuais"
          action={<AddButton label="Adicionar atletas" onPress={() => setPickerTarget({ type: "athletes" })} />}
        >
          {athleteCats.size === 0 ? (
            <Text style={s.emptyHint}>Adicione os atletas e escolha as categorias de cada um.</Text>
          ) : (
            [...athleteCats.entries()].map(([id, catsSel]) => (
              <View key={id} style={s.athleteRow}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.athleteName} numberOfLines={1}>{nameOf(id)}</Text>
                  {catsSel.length === 0 ? (
                    <Text style={s.athleteNoCat}>Sem categoria — toque em "Categorias"</Text>
                  ) : (
                    <View style={s.miniChips}>
                      {catsSel.map((cId) => (
                        <View key={cId} style={s.miniChip}><Text style={s.miniChipTxt} numberOfLines={1}>{catNameOf(cId)}</Text></View>
                      ))}
                    </View>
                  )}
                </View>
                <TouchableOpacity style={s.smallBtn} onPress={() => setCatPickerFor({ type: "athlete", id })}>
                  <Text style={s.smallBtnTxt}>Categorias</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeAthlete(id)} hitSlop={8} accessibilityLabel="Remover atleta">
                  <Icon name="x" size={16} color={C.ink3} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </Section>

        {/* ── Equipes ── */}
        <Section
          title="Equipes"
          action={<AddButton label="Nova equipe" onPress={addTeam} />}
        >
          {teams.length === 0 ? (
            <Text style={s.emptyHint}>Kata/Kumite equipe: monte o time com titulares e reserva.</Text>
          ) : (
            teams.map((t) => (
              <View key={t.key} style={s.teamCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TextInput
                    style={s.teamNameInput}
                    value={t.name}
                    onChangeText={(v) => patchTeam(t.key, { name: v })}
                    placeholder="Nome da equipe (ex.: Kondei A)"
                    placeholderTextColor={C.ink4}
                    accessibilityLabel="Nome da equipe"
                  />
                  <TouchableOpacity onPress={() => removeTeam(t.key)} hitSlop={8} accessibilityLabel="Remover equipe">
                    <Icon name="trash" size={16} color={C.primary} />
                  </TouchableOpacity>
                </View>

                <View style={s.sexRow}>
                  {SEX_OPTIONS.map(([value, label]) => (
                    <TouchableOpacity
                      key={value}
                      style={[s.sexChip, t.sex === value && s.sexChipOn]}
                      onPress={() => patchTeam(t.key, { sex: value })}
                    >
                      <Text style={[s.sexChipTxt, t.sex === value && s.sexChipTxtOn]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={s.smallBtn} onPress={() => setCatPickerFor({ type: "team", key: t.key })}>
                    <Text style={s.smallBtnTxt}>
                      {t.category_ids.length ? `${t.category_ids.length} prova${t.category_ids.length > 1 ? "s" : ""}` : "Provas"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <RosterLine
                  label="Titulares"
                  ids={t.titular_ids}
                  nameOf={nameOf}
                  onEdit={() => setPickerTarget({ type: "team-titulares", key: t.key })}
                />
                <RosterLine
                  label="Reservas"
                  ids={t.reserve_ids}
                  nameOf={nameOf}
                  onEdit={() => setPickerTarget({ type: "team-reservas", key: t.key })}
                />
                {t.titular_ids.length > 0 && t.titular_ids.length < 2 && (
                  <Text style={s.teamWarn}>Equipe precisa de pelo menos 2 titulares.</Text>
                )}
              </View>
            ))
          )}
        </Section>

        {/* ── Oficiais ── */}
        <Section title="Oficiais do dojô (árbitros, mesários, staff)">
          <View style={s.officialsRow}>
            <Text style={s.officialsHint}>
              Contrapartida do regulamento: oficiais inscritos geram isenção de atletas na cotação.
            </Text>
            <View style={s.stepper}>
              <TouchableOpacity style={s.stepBtn} onPress={() => setOfficials((n) => Math.max(0, n - 1))} accessibilityLabel="Diminuir oficiais">
                <Text style={s.stepBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={s.stepValue}>{officials}</Text>
              <TouchableOpacity style={s.stepBtn} onPress={() => setOfficials((n) => n + 1)} accessibilityLabel="Aumentar oficiais">
                <Text style={s.stepBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* ── Cotação / avisos ── */}
        {cartHasItems && (
          <Section title="Cotação">
            {quoting && !quote ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 8 }} />
            ) : quote ? (
              <QuotePanel quote={quote} />
            ) : (
              <Text style={s.emptyHint}>A cotação aparece aqui.</Text>
            )}
          </Section>
        )}
      </ScrollView>

      {/* ── Rodapé fixo: pagamento + enviar ── */}
      <View style={s.footerBar}>
        <View style={s.payRow}>
          {([["pix_direct", "PIX da federação"], ["manual", "Comprovante depois"]] as const).map(([mode, label]) => (
            <TouchableOpacity
              key={mode}
              style={[s.payChip, paymentMode === mode && s.payChipOn]}
              onPress={() => setPaymentMode(mode)}
            >
              <Text style={[s.payChipTxt, paymentMode === mode && s.payChipTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.footerRow}>
          <View>
            <Text style={s.footerTotalLabel}>Total{quoting ? " (atualizando…)" : ""}</Text>
            <Text style={s.footerTotal}>{quote ? formatBRL(quote.quote.total) : "—"}</Text>
          </View>
          <KarateButton
            label={submitting ? "Enviando…" : "Enviar delegação"}
            variant="sumi"
            size="lg"
            onPress={submit}
            disabled={!canSubmit}
          />
        </View>
      </View>

      {/* ── Modais ── */}
      <SelecionarAlunosModal
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        federationId={federationId}
        title={pickerTarget?.type === "athletes" ? "Adicionar atletas"
          : pickerTarget?.type === "team-titulares" ? "Titulares da equipe" : "Reservas da equipe"}
        subtitle="Somente alunos federados participam de campeonatos."
        ctaLabel="Confirmar"
        busy={false}
        onSubmit={onPickerSubmit}
      />
      <CategoryPickerModal
        visible={catPickerFor !== null}
        onClose={() => setCatPickerFor(null)}
        title={catPickerFor?.type === "athlete" ? `Categorias — ${nameOf(catPickerFor.id)}` : "Provas da equipe"}
        subtitle={competition.name}
        categories={categories}
        mode={catPickerFor?.type === "team" ? "team" : "individual"}
        initialSelected={
          catPickerFor?.type === "athlete"
            ? (athleteCats.get(catPickerFor.id) || [])
            : catPickerFor?.type === "team"
              ? (teams.find((t) => t.key === catPickerFor.key)?.category_ids || [])
              : []
        }
        onConfirm={(ids) => {
          if (!catPickerFor) return;
          if (catPickerFor.type === "athlete") setAthleteCategories(catPickerFor.id, ids);
          else patchTeam(catPickerFor.key, { category_ids: ids });
        }}
      />
    </View>
  );
}

// ── Subcomponentes ──────────────────────────────────────────

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.addBtn} onPress={onPress} accessibilityRole="button">
      <Icon name="plus" size={14} color={C.primary} />
      <Text style={s.addBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function RosterLine({ label, ids, nameOf, onEdit }: {
  label: string; ids: string[]; nameOf: (id: string) => string; onEdit: () => void;
}) {
  return (
    <View style={s.rosterLine}>
      <Text style={s.rosterLabel}>{label}</Text>
      <Text style={s.rosterNames} numberOfLines={2}>
        {ids.length ? ids.map(nameOf).join(", ") : "—"}
      </Text>
      <TouchableOpacity style={s.smallBtn} onPress={onEdit}>
        <Text style={s.smallBtnTxt}>{ids.length ? "Editar" : "Escolher"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function QuotePanel({ quote }: { quote: QuoteResponse }) {
  return (
    <View style={{ gap: 10 }}>
      {quote.quota_violations.length > 0 && (
        <View style={s.blockBox}>
          <Icon name="alert" size={15} color={C.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.blockTitle}>Cota por clube excedida — o envio está bloqueado</Text>
            {quote.quota_violations.map((v, i) => (
              <Text key={i} style={s.blockTxt}>
                {v.category_name || v.category_id}: limite {v.limit}, {v.existing} já inscrito{v.existing === 1 ? "" : "s"} + {v.adding} no carrinho ({v.over} a mais)
              </Text>
            ))}
          </View>
        </View>
      )}

      {quote.skipped.length > 0 && (
        <View style={s.warnBox}>
          <Text style={s.warnTitle}>Fora do pedido ({quote.skipped.length})</Text>
          {quote.skipped.map((sk, i) => (
            <Text key={i} style={s.warnTxt}>• {sk.name || sk.student_id || sk.team}: {sk.message}</Text>
          ))}
        </View>
      )}

      {quote.warnings.length > 0 && (
        <View style={s.warnBox}>
          <Text style={s.warnTitle}>Avisos de categoria (não bloqueiam)</Text>
          {quote.warnings.map((w, i) => (
            <Text key={i} style={s.warnTxt}>• {w.name} em {w.category_name}: {w.warnings.join(" ")}</Text>
          ))}
        </View>
      )}

      {quote.quote.lines.map((l, i) => (
        <View key={i} style={s.quoteLine}>
          <Text style={[s.quoteLabel, l.exempted && s.quoteExempt]} numberOfLines={1}>
            {l.label}{l.exempted ? " (isento)" : ""}
          </Text>
          <Text style={[s.quoteAmount, l.exempted && s.quoteExempt]}>{formatBRL(l.amount)}</Text>
        </View>
      ))}
      {quote.quote.discount > 0 && (
        <View style={s.quoteLine}>
          <Text style={s.quoteLabel}>
            Isenções por oficiais ({quote.quote.exemptions.applied} de {quote.quote.exemptions.earned})
          </Text>
          <Text style={[s.quoteAmount, { color: "#2e7d4f" }]}>−{formatBRL(quote.quote.discount)}</Text>
        </View>
      )}
      <View style={s.quoteTotalLine}>
        <Text style={s.quoteTotalLabel}>Total da delegação</Text>
        <Text style={s.quoteTotalValue}>{formatBRL(quote.quote.total)}</Text>
      </View>
    </View>
  );
}

function SuccessView({ result, onDone }: { result: SubmitResponse; onDone: () => void }) {
  const pix = result.payment && !result.payment.error ? result.payment : null;
  const nEntries = result.enrolled.athletes.length
    + result.enrolled.teams.reduce((sum, t) => sum + t.entry_ids.length, 0);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, gap: 14, alignItems: "center" }}>
      <Icon name="check_circle" size={44} color="#2e7d4f" />
      <Text style={s.successTitle}>Delegação enviada</Text>
      <Text style={s.successSub}>
        {nEntries} inscriç{nEntries === 1 ? "ão" : "ões"} registradas
        {result.skipped.length ? ` · ${result.skipped.length} fora do pedido` : ""} · total {formatBRL(result.order.total_amount)}
      </Text>

      {pix && pix.payload ? (
        <View style={s.pixCard}>
          <Text style={s.pixTitle}>Pague o PIX consolidado</Text>
          <PixQRCode payload={pix.payload} qrImage={pix.qr_image || undefined} size={190} />
          <TouchableOpacity
            style={s.copyBtn}
            onPress={async () => { await copyToClipboard(pix.payload || ""); toast.success("Código PIX copiado."); }}
          >
            <Icon name="copy" size={14} color={C.primary} />
            <Text style={s.copyBtnTxt}>Copiar código PIX</Text>
          </TouchableOpacity>
          <Text style={s.pixHint}>Após o pagamento, a confirmação é automática.</Text>
        </View>
      ) : result.order.total_amount > 0 ? (
        <View style={s.pixCard}>
          <Text style={s.pixTitle}>
            {result.payment?.error ? "PIX indisponível agora" : "Pagamento por transferência"}
          </Text>
          <Text style={s.pixHint}>
            {result.payment?.error
              ? `${result.payment.error} Você pode enviar o comprovante em "Meus pedidos".`
              : 'Pague no PIX/conta da federação e envie o comprovante em "Meus pedidos" — a federação confirma na conferência.'}
          </Text>
        </View>
      ) : (
        <Text style={s.pixHint}>Sem valores a pagar — inscrições confirmadas.</Text>
      )}

      <KarateButton label="Ver meus pedidos" variant="sumi" size="lg" onPress={onDone} />
    </ScrollView>
  );
}

// ── Estilos ─────────────────────────────────────────────────
const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 } as ViewStyle,
  compName: { fontSize: 19, fontFamily: F.heading, color: C.ink } as TextStyle,
  compMeta: { fontSize: 12.5, color: C.ink3, marginTop: 2 } as TextStyle,
  section: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10 } as ViewStyle,
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" } as ViewStyle,
  sectionTitle: { fontSize: 13, fontWeight: "800", color: C.ink, flexShrink: 1 } as TextStyle,
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: C.primaryLine, backgroundColor: C.primarySoft, borderRadius: R.sm, paddingHorizontal: 11, paddingVertical: 6 } as ViewStyle,
  addBtnTxt: { fontSize: 12.5, fontWeight: "700", color: C.primary } as TextStyle,
  emptyHint: { fontSize: 12.5, color: C.ink3 } as TextStyle,
  athleteRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 } as ViewStyle,
  athleteName: { fontSize: 13.5, fontWeight: "700", color: C.ink } as TextStyle,
  athleteNoCat: { fontSize: 11.5, color: C.primary } as TextStyle,
  miniChips: { flexDirection: "row", flexWrap: "wrap", gap: 4 } as ViewStyle,
  miniChip: { borderRadius: 999, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 8, paddingVertical: 2, maxWidth: 220 } as ViewStyle,
  miniChipTxt: { fontSize: 10.5, fontWeight: "600", color: C.ink2 } as TextStyle,
  smallBtn: { borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.glassHi } as ViewStyle,
  smallBtnTxt: { fontSize: 12, fontWeight: "700", color: C.ink2 } as TextStyle,
  teamCard: { borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 11, gap: 8, backgroundColor: C.surface } as ViewStyle,
  teamNameInput: { flex: 1, fontSize: 14, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.glassHi } as TextStyle,
  sexRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" } as ViewStyle,
  sexChip: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 11, paddingVertical: 5 } as ViewStyle,
  sexChipOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  sexChipTxt: { fontSize: 12, fontWeight: "600", color: C.ink3 } as TextStyle,
  sexChipTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  rosterLine: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  rosterLabel: { width: 64, fontSize: 11.5, fontWeight: "700", color: C.ink3 } as TextStyle,
  rosterNames: { flex: 1, fontSize: 12.5, color: C.ink2 } as TextStyle,
  teamWarn: { fontSize: 11.5, color: C.primary } as TextStyle,
  officialsRow: { flexDirection: "row", alignItems: "center", gap: 12 } as ViewStyle,
  officialsHint: { flex: 1, fontSize: 12, color: C.ink3 } as TextStyle,
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  stepBtn: { width: 34, height: 34, borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, alignItems: "center", justifyContent: "center", backgroundColor: C.glassHi } as ViewStyle,
  stepBtnTxt: { fontSize: 18, fontWeight: "700", color: C.ink } as TextStyle,
  stepValue: { minWidth: 26, textAlign: "center", fontSize: 16, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  blockBox: { flexDirection: "row", gap: 8, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: C.primaryLine, borderRadius: R.md, padding: 11 } as ViewStyle,
  blockTitle: { fontSize: 12.5, fontWeight: "800", color: C.primary2 } as TextStyle,
  blockTxt: { fontSize: 12, color: C.primary2, marginTop: 2 } as TextStyle,
  warnBox: { backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 11, gap: 3 } as ViewStyle,
  warnTitle: { fontSize: 11.5, fontWeight: "800", color: C.ink2 } as TextStyle,
  warnTxt: { fontSize: 12, color: C.ink2 } as TextStyle,
  quoteLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 } as ViewStyle,
  quoteLabel: { flex: 1, fontSize: 12.5, color: C.ink2 } as TextStyle,
  quoteAmount: { fontSize: 12.5, color: C.ink2, fontVariant: ["tabular-nums"] } as TextStyle,
  quoteExempt: { textDecorationLine: "line-through", color: C.ink3 } as TextStyle,
  quoteTotalLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 } as ViewStyle,
  quoteTotalLabel: { fontSize: 13.5, fontWeight: "800", color: C.ink } as TextStyle,
  quoteTotalValue: { fontSize: 17, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  footerBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 12, gap: 8 } as ViewStyle,
  payRow: { flexDirection: "row", gap: 6 } as ViewStyle,
  payChip: { borderRadius: 999, borderWidth: 1, borderColor: C.border2, paddingHorizontal: 12, paddingVertical: 6 } as ViewStyle,
  payChipOn: { backgroundColor: C.primarySoft, borderColor: C.primaryLine } as ViewStyle,
  payChipTxt: { fontSize: 12, fontWeight: "600", color: C.ink3 } as TextStyle,
  payChipTxtOn: { color: C.primary, fontWeight: "700" } as TextStyle,
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 } as ViewStyle,
  footerTotalLabel: { fontSize: 11, color: C.ink3 } as TextStyle,
  footerTotal: { fontSize: 19, fontWeight: "800", color: C.ink, fontVariant: ["tabular-nums"] } as TextStyle,
  successTitle: { fontSize: 22, fontFamily: F.heading, color: C.ink } as TextStyle,
  successSub: { fontSize: 13.5, color: C.ink2, textAlign: "center", maxWidth: 420 } as TextStyle,
  pixCard: { width: "100%", maxWidth: 420, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, padding: 16, alignItems: "center", gap: 10 } as ViewStyle,
  pixTitle: { fontSize: 15, fontWeight: "800", color: C.ink } as TextStyle,
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: C.primaryLine, backgroundColor: C.primarySoft, borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 8 } as ViewStyle,
  copyBtnTxt: { fontSize: 13, fontWeight: "700", color: C.primary } as TextStyle,
  pixHint: { fontSize: 12, color: C.ink3, textAlign: "center" } as TextStyle,
});
