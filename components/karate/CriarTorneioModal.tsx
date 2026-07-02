// ============================================================
// CriarTorneioModal — Aura Karatê Track E (DESIGN-19) · Shoji
//
// Wizard 3 passos, agora em MODAL CENTRADO (overlay + card), igual às
// fichas de ouro (PraticanteFichaModal / DojoFichaModal). Antes abria em
// <Modal presentationStyle="pageSheet"> que no web vira TELA CHEIA.
//
//   Passo 1 — Dados do campeonato (nome, temporada, data, local, etapa, taxa)
//   Passo 2 — Categorias (modalidade, faixa etária, graduação, sexo, vagas, taxa)
//   Passo 3 — Revisão → cria competição + categorias
//
// Wired: karateCompetitionsApi.createCompetition + createCategory.
// Em falha, mostra erro honesto (sem simular sucesso).
//
// Metodologia de forms (decisões Caio):
//   - Máscara de dinheiro consistente (maskMoney) nas DUAS taxas — formata
//     centavos e envia em reais corretamente (antes era parseFloat de texto livre).
//   - Data com validação de calendário real (parseBrDate) — rejeita 31/02.
//   - Validação inline; asterisco real nos obrigatórios; autofocus; Enter avança.
//   - CTA do rodapé ("Próximo"/"Criar campeonato") é primário em sumi (escuro),
//     consistente com "Salvar"; full-width no footer (padrão de form). O
//     vermelhão fica reservado a ações destrutivas.
//
// NOTA: os pickers de graduação oferecem TODAS as faixas de propósito —
// um campeonato tem categorias para qualquer graduação. A regra "só Marrom →
// Preta" vale apenas para EXAMES da federação, não para competições.
//
// Criação de categorias (P2) — transacional no FRONT (backend não muda):
//   A criação NÃO é atômica no backend (1 POST por categoria). Para não
//   fechar com "sucesso" enganoso quando uma categoria falha no meio:
//   - progresso "Criando categorias… N/Total" durante o envio;
//   - status por categoria (pending/ok/error) com a mensagem real;
//   - se alguma falhar, mantém o modal aberto, mostra o estado real e oferece
//     "Tentar novamente as que falharam" — re-envia SÓ as pendentes, reusando
//     a competição já criada (sem re-criar, sem duplicar as que já entraram).
//   - a competição criada é preservada (sem rollback no front).
// ============================================================
import React, { useRef, useState } from "react";
import {
  Modal, View, Text, TextInput, ScrollView, TouchableOpacity, Pressable,
  StyleSheet, useWindowDimensions, ViewStyle, TextStyle, ActivityIndicator, Platform,
} from "react-native";
import { Icon } from "@/components/Icon";
import { ShojiPalette as P, KarateColors, KarateRadius as R, KarateFonts as F, KarateBelts, BeltKey } from "@/constants/karateTheme";
import { Stepper } from "@/components/karate/Stepper";
import { KarateButton } from "@/components/karate/KarateButton";
import { parseBrDate } from "@/components/inputs/DateInput";
import { karateCompetitionsApi, Modality, Sex } from "@/services/karateCompetitionsApi";

const STEPS = ["Dados", "Categorias", "Revisão"];

const onlyD = (v: string) => (v || "").replace(/\D/g, "");

// dd/mm/aaaa parcial enquanto digita (validação real é via parseBrDate)
function maskDate(v: string) {
  const d = onlyD(v).slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  if (d.length > 2) return d.replace(/(\d{2})(\d+)/, "$1/$2");
  return d;
}

// Máscara de dinheiro consistente: trabalha em centavos → exibe X,YY.
function maskMoney(v: string) {
  const cents = onlyD(v).slice(0, 11);
  if (!cents) return "";
  const n = parseInt(cents, 10);
  const reais = Math.floor(n / 100);
  const frac = String(n % 100).padStart(2, "0");
  return `${reais.toLocaleString("pt-BR")},${frac}`;
}
function moneyToNumber(v: string): number {
  const cents = onlyD(v);
  return cents ? parseInt(cents, 10) / 100 : 0;
}

const MODALITIES: { value: Modality; label: string }[] = [
  { value: "kata",        label: "Kata" },
  { value: "kumite",      label: "Kumite" },
  { value: "kihon_ippon", label: "Kihon-Ippon" },
  { value: "team_kata",   label: "Kata Equipe" },
  { value: "team_kumite", label: "Kumite Equipe" },
];
const SEXES: { value: Sex; label: string }[] = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
  { value: "mixed", label: "Misto" },
];

type CatState = "pending" | "ok" | "error";

interface DraftCategory {
  key: string;
  name: string;
  modality: Modality;
  ageMin: string;
  ageMax: string;
  beltMin: BeltKey | "";
  beltMax: BeltKey | "";
  sex: Sex;
  maxEntries: string;
  fee: string;
  // estado de envio (transacional no front) — não enviado ao backend
  state?: CatState;
  errorMsg?: string;
}

const BELT_KEYS = Object.keys(KarateBelts) as BeltKey[];

let __k = 0;
const newKey = () => `cat-${Date.now()}-${++__k}`;
const emptyDraft = (): DraftCategory => ({
  key: newKey(), name: "", modality: "kata", ageMin: "", ageMax: "",
  beltMin: "", beltMax: "", sex: "mixed", maxEntries: "", fee: "",
});

interface Props {
  visible: boolean;
  onClose: () => void;
  federationId: string;
  onCreated?: () => void;
}

export function CriarTorneioModal({ visible, onClose, federationId, onCreated }: Props) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(700, width - 24);

  const [step, setStep] = useState(0);

  // Passo 1
  const [name, setName] = useState("");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [circuitRound, setCircuitRound] = useState("");
  const [fee, setFee] = useState("");

  // Passo 2
  const [categories, setCategories] = useState<DraftCategory[]>([]);
  const [draft, setDraft] = useState<DraftCategory>(emptyDraft());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── estado de criação transacional (front) ──────────────────
  // competição já criada nesta tentativa (reusada em retries → não re-cria)
  const [createdCompId, setCreatedCompId] = useState<string | null>(null);
  // progresso do envio das categorias
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // resultado por categoria (após pelo menos uma tentativa)
  const [catResult, setCatResult] = useState<Record<string, { state: CatState; errorMsg?: string }>>({});
  const [toast, setToast] = useState<string | null>(null);

  const dateBad = eventDate.length === 10 && parseBrDate(eventDate) === null;
  const failedCount = Object.values(catResult).filter((r) => r.state === "error").length;
  const okCount = Object.values(catResult).filter((r) => r.state === "ok").length;
  const attempted = Object.keys(catResult).length > 0;

  const resetAndClose = () => {
    setStep(0); setName(""); setSeason(String(new Date().getFullYear()));
    setEventDate(""); setLocation(""); setCircuitRound(""); setFee("");
    setCategories([]); setDraft(emptyDraft()); setLoading(false); setError(null);
    setCreatedCompId(null); setProgress(null); setCatResult({}); setToast(null);
    onClose();
  };

  const handleStep1Next = () => {
    if (!name.trim()) { setError("Informe o nome do campeonato."); return; }
    if (eventDate && parseBrDate(eventDate) === null) { setError("Data inválida — use dd/mm/aaaa."); return; }
    setError(null); setStep(1);
  };

  const addCategory = () => {
    if (!draft.name.trim()) { setError("Informe o nome da categoria."); return; }
    setError(null);
    setCategories((prev) => [...prev, draft]);
    setDraft(emptyDraft());
  };

  const copyCategory = (cat: DraftCategory) => {
    const copy: DraftCategory = {
      ...cat,
      key: newKey(),
      name: `${cat.name} (cópia)`,
      state: undefined,
      errorMsg: undefined,
    };
    setCategories((prev) => [...prev, copy]);
  };

  const removeCategory = (key: string) => {
    setCategories((prev) => prev.filter((c) => c.key !== key));
    setCatResult((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  // Envia (ou re-envia) categorias. Só processa as que ainda NÃO entraram (ok).
  // Reusa a competição já criada se houver (createdCompId) — não re-cria.
  const sendCategories = async (compId: string, toSend: DraftCategory[]) => {
    let done = 0;
    setProgress({ done: 0, total: toSend.length });
    const results: Record<string, { state: CatState; errorMsg?: string }> = {};
    for (const c of toSend) {
      try {
        await karateCompetitionsApi.createCategory(federationId, compId, {
          name: c.name.trim(), modality: c.modality,
          min_age: c.ageMin ? parseInt(c.ageMin, 10) : null,
          max_age: c.ageMax ? parseInt(c.ageMax, 10) : null,
          belt_min: c.beltMin || null, belt_max: c.beltMax || null,
          sex: c.sex,
          max_entries: c.maxEntries ? parseInt(c.maxEntries, 10) : null,
          fee_amount: c.fee ? moneyToNumber(c.fee) : null,
        });
        results[c.key] = { state: "ok" };
      } catch (e: any) {
        results[c.key] = { state: "error", errorMsg: e?.message || "Falha ao criar categoria." };
      }
      done += 1;
      setProgress({ done, total: toSend.length });
      // atualização incremental do mapa de resultados (UI ao vivo)
      setCatResult((prev) => ({ ...prev, [c.key]: results[c.key] }));
    }
    return results;
  };

  const finishUp = (allOk: boolean) => {
    setProgress(null);
    if (allOk) {
      setToast(`"${name}" criado com ${categories.length} categoria(s).`);
      onCreated?.();
      setTimeout(() => resetAndClose(), 700);
    }
    // se NÃO allOk, não fecha: o passo de revisão renderiza o estado real + retry
  };

  const handleFinish = async () => {
    setLoading(true); setError(null);
    try {
      // cria a competição UMA vez; em retries ela já existe e é reusada
      let compId = createdCompId;
      if (!compId) {
        const comp = await karateCompetitionsApi.createCompetition(federationId, {
          name: name.trim(),
          season: parseInt(season, 10) || new Date().getFullYear(),
          event_date: parseBrDate(eventDate),
          location: location || null,
          circuit_round: circuitRound ? parseInt(circuitRound, 10) : null,
          fee_amount: fee ? moneyToNumber(fee) : 0,
        });
        compId = comp.id;
        setCreatedCompId(compId);
      }

      // sem categorias → competição criada é o suficiente
      if (categories.length === 0) {
        finishUp(true);
        return;
      }

      const results = await sendCategories(compId, categories);
      const allOk = categories.every((c) => results[c.key]?.state === "ok");
      finishUp(allOk);
      if (!allOk) setError("Algumas categorias não entraram. Veja abaixo e tente novamente as que falharam.");
    } catch (e: any) {
      // falha ao CRIAR A COMPETIÇÃO (antes das categorias) — nada parcial ainda
      setError(e?.message || "Não foi possível criar o campeonato. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Re-tenta SÓ as categorias que falharam (as ok não são reenviadas → sem duplicar).
  const handleRetryFailed = async () => {
    if (!createdCompId) return;
    const toRetry = categories.filter((c) => catResult[c.key]?.state === "error");
    if (toRetry.length === 0) return;
    setLoading(true); setError(null);
    try {
      const results = await sendCategories(createdCompId, toRetry);
      // allOk considera TODAS as categorias (as já-ok + as reenviadas agora)
      const allOk = categories.every((c) =>
        (catResult[c.key]?.state === "ok") || results[c.key]?.state === "ok");
      finishUp(allOk);
      if (!allOk) setError("Ainda há categorias com falha. Você pode tentar novamente ou concluir depois no detalhe do campeonato.");
    } catch (e: any) {
      setError(e?.message || "Falha ao reenviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // rótulo do botão de criação no passo 3
  const finishLabel = (() => {
    if (loading) {
      if (progress) return `Criando categorias… ${progress.done}/${progress.total}`;
      return createdCompId ? "Reenviando…" : "Criando campeonato…";
    }
    if (attempted && failedCount > 0) return `Tentar novamente (${failedCount})`;
    return "Criar campeonato";
  })();

  const onFinishPress = attempted && failedCount > 0 && createdCompId ? handleRetryFailed : handleFinish;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={resetAndClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={resetAndClose} />
        <View style={[styles.card, { width: cardW }]}>
          {/* header */}
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>空  FPKT · Novo campeonato</Text>
              <Text style={styles.title}>Criar campeonato<Text style={{ color: P.red }}>.</Text></Text>
              <Text style={styles.sub}>Defina os dados e monte as categorias.</Text>
            </View>
            <TouchableOpacity onPress={resetAndClose} hitSlop={10} style={styles.close} accessibilityLabel="Fechar modal">
              <Icon name="x" size={20} color={P.ink2} />
            </TouchableOpacity>
          </View>

          <Stepper steps={STEPS} currentStep={step} style={styles.stepper} />

          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {error ? (
              <View style={styles.errorBanner}>
                <Icon name="alert_circle" size={15} color={P.red} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* STEP 1 — DADOS */}
            {step === 0 && (
              <View style={styles.stepContent}>
                <Field label="Nome do campeonato" req value={name} onChangeText={setName}
                  placeholder="Ex: Copa Interior 2026 — 1ª Etapa" autoFocus returnKeyType="next" />
                <Row2>
                  <Field flex label="Temporada" mono value={season} onChangeText={(v) => setSeason(onlyD(v).slice(0, 4))}
                    placeholder="2026" keyboardType="numeric" maxLength={4} />
                  <Field flex label="Data do evento" hint="dd/mm/aaaa" mono value={eventDate}
                    onChangeText={(v) => setEventDate(maskDate(v))} placeholder="dd/mm/aaaa" keyboardType="numeric"
                    maxLength={10} bad={dateBad} note={dateBad ? "Data inválida. Use dd/mm/aaaa." : undefined} />
                </Row2>
                <Field label="Local" value={location} onChangeText={setLocation}
                  placeholder="Ginásio Municipal — Jacareí/SP" returnKeyType="next" />
                <Row2>
                  <Field flex label="Etapa do circuito" mono value={circuitRound}
                    onChangeText={(v) => setCircuitRound(onlyD(v))} placeholder="1" keyboardType="numeric" />
                  <Field flex label="Taxa padrão de inscrição" hint="opcional" mono value={fee}
                    onChangeText={(v) => setFee(maskMoney(v))} placeholder="0,00" keyboardType="numeric" prefix="R$" />
                </Row2>
              </View>
            )}

            {/* STEP 2 — CATEGORIAS */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={styles.stepHint}>Adicione as categorias do campeonato. Cada uma pode ter faixa etária, graduação e sexo próprios.</Text>

                {categories.map((c) => (
                  <View key={c.key} style={styles.catRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catName}>{c.name}</Text>
                      <Text style={styles.catMeta}>
                        {MODALITIES.find((m) => m.value === c.modality)?.label}
                        {c.sex !== "mixed" ? ` · ${c.sex === "M" ? "Masc." : "Fem."}` : " · Misto"}
                        {c.ageMin || c.ageMax ? ` · ${c.ageMin || "0"}–${c.ageMax || "∞"} anos` : ""}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => copyCategory(c)} accessibilityLabel={`Copiar ${c.name}`} style={styles.iconBtn}>
                      <Icon name="copy" size={18} color={P.ink3} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeCategory(c.key)} accessibilityLabel={`Remover ${c.name}`}>
                      <Icon name="trash" size={18} color={P.red} />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Editor de nova categoria */}
                <View style={styles.editor}>
                  <Text style={styles.editorTitle}>Nova categoria</Text>
                  <Field label="Nome da categoria" value={draft.name} onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
                    placeholder="Ex: Kata Adulto Faixa Preta Masc." returnKeyType="next" />

                  <Text style={styles.fieldLabel}>Modalidade</Text>
                  <View style={styles.chipsRow}>
                    {MODALITIES.map((m) => (
                      <TouchableOpacity key={m.value}
                        onPress={() => setDraft((d) => ({ ...d, modality: m.value }))}
                        style={[styles.chip, draft.modality === m.value && styles.chipActive]}
                        accessibilityRole="radio" accessibilityState={{ checked: draft.modality === m.value }}>
                        <Text style={[styles.chipText, draft.modality === m.value && styles.chipTextActive]}>{m.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Sexo</Text>
                  <View style={styles.chipsRow}>
                    {SEXES.map((s) => (
                      <TouchableOpacity key={s.value}
                        onPress={() => setDraft((d) => ({ ...d, sex: s.value }))}
                        style={[styles.chip, draft.sex === s.value && styles.chipActive]}
                        accessibilityRole="radio" accessibilityState={{ checked: draft.sex === s.value }}>
                        <Text style={[styles.chipText, draft.sex === s.value && styles.chipTextActive]}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Row2>
                    <Field flex label="Idade mín." mono value={draft.ageMin}
                      onChangeText={(v) => setDraft((d) => ({ ...d, ageMin: onlyD(v).slice(0, 3) }))} placeholder="—" keyboardType="numeric" />
                    <Field flex label="Idade máx." mono value={draft.ageMax}
                      onChangeText={(v) => setDraft((d) => ({ ...d, ageMax: onlyD(v).slice(0, 3) }))} placeholder="—" keyboardType="numeric" />
                  </Row2>

                  <Text style={styles.fieldLabel}>Graduação mínima</Text>
                  <BeltPickerRow
                    selected={draft.beltMin}
                    onSelect={(k) => setDraft((d) => ({ ...d, beltMin: k }))}
                    keyPrefix="min"
                  />
                  <Text style={styles.fieldLabel}>Graduação máxima</Text>
                  <BeltPickerRow
                    selected={draft.beltMax}
                    onSelect={(k) => setDraft((d) => ({ ...d, beltMax: k }))}
                    keyPrefix="max"
                  />

                  <Field label="Vagas" mono value={draft.maxEntries}
                    onChangeText={(v) => setDraft((d) => ({ ...d, maxEntries: onlyD(v) }))} placeholder="sem limite" keyboardType="numeric" />
                  <Field label="Taxa da categoria" hint="usa a taxa padrão se vazio" mono value={draft.fee}
                    onChangeText={(v) => setDraft((d) => ({ ...d, fee: maskMoney(v) }))} placeholder="0,00" keyboardType="numeric" prefix="R$" />

                  <KarateButton label="Adicionar categoria" variant="secondary" size="sm" onPress={addCategory} />
                </View>
              </View>
            )}

            {/* STEP 3 — REVISÃO */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <View style={styles.reviewCard}>
                  <Text style={styles.reviewTitle}>{name || "—"}</Text>
                  <Text style={styles.reviewMeta}>Temporada {season}{circuitRound ? ` · ${circuitRound}ª etapa` : ""}</Text>
                  {!!location && <Text style={styles.reviewMeta}>{location}</Text>}
                  {!!eventDate && <Text style={styles.reviewMeta}>{eventDate}</Text>}
                  <Text style={styles.reviewMeta}>Taxa padrão: {fee ? `R$ ${fee}` : "—"}</Text>
                  {createdCompId ? (
                    <View style={styles.createdTag}>
                      <Icon name="check" size={13} color={P.ok} />
                      <Text style={styles.createdTagTxt}>Competição criada — concluindo as categorias.</Text>
                    </View>
                  ) : null}
                </View>

                {/* progresso ao vivo durante o envio */}
                {progress ? (
                  <View style={styles.progressRow}>
                    <ActivityIndicator size="small" color={P.red} />
                    <Text style={styles.progressTxt}>Criando categorias… {progress.done}/{progress.total}</Text>
                  </View>
                ) : null}

                {/* resumo do resultado (após tentativa) */}
                {attempted && !progress ? (
                  <View style={[styles.resultBanner, failedCount > 0 ? styles.resultBannerWarn : styles.resultBannerOk]}>
                    <Icon name={failedCount > 0 ? "alert" : "check"} size={15} color={failedCount > 0 ? P.red : P.ok} />
                    <Text style={styles.resultTxt}>
                      {okCount} entraram{failedCount > 0 ? ` · ${failedCount} falharam` : ""}. {failedCount > 0 ? "Tente novamente as que falharam." : "Tudo certo."}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.fieldLabel}>{categories.length} categoria(s)</Text>
                {categories.length === 0 ? (
                  <Text style={styles.stepHint}>Nenhuma categoria adicionada. Você pode adicioná-las depois no detalhe do campeonato.</Text>
                ) : (
                  categories.map((c) => {
                    const r = catResult[c.key];
                    return (
                      <View key={c.key} style={[styles.catRow, r?.state === "error" && styles.catRowError, r?.state === "ok" && styles.catRowOk]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.catName}>{c.name}</Text>
                          {r?.state === "error" && r.errorMsg ? <Text style={styles.catErr}>{r.errorMsg}</Text> : null}
                        </View>
                        {r?.state === "ok" ? <Icon name="check" size={18} color={P.ok} /> : null}
                        {r?.state === "error" ? <Icon name="x" size={18} color={P.red} /> : null}
                        {r?.state === "pending" || (loading && !r) ? <ActivityIndicator size="small" color={P.ink3} /> : null}
                      </View>
                    );
                  })
                )}
                <Text style={styles.stepHint}>O campeonato será criado como rascunho. Você poderá abrir inscrições e lançar resultados no detalhe.</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step > 0 && !attempted && (
              <KarateButton label="Voltar" variant="ghost" size="md" onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} disabled={loading} />
            )}
            {step === 0 && (
              <KarateButton label="Próximo" variant="sumi" size="md" onPress={handleStep1Next} style={{ flex: 1 }} />
            )}
            {step === 1 && (
              <KarateButton label="Próximo" variant="sumi" size="md" onPress={() => { setError(null); setStep(2); }} style={{ flex: 1 }} />
            )}
            {step === 2 && (
              <>
                {attempted && failedCount === 0 && okCount === 0 ? null : null}
                {attempted && (failedCount > 0) ? (
                  <KarateButton label="Concluir depois" variant="ghost" size="md" onPress={resetAndClose} style={{ flex: 1 }} disabled={loading} />
                ) : null}
                <KarateButton label={finishLabel} variant="sumi" size="md" loading={loading} onPress={onFinishPress} style={{ flex: 1 }} />
              </>
            )}
          </View>

          {/* toast de sucesso (inline) */}
          {toast ? (
            <View pointerEvents="none" style={styles.toast}>
              <Icon name="check" size={16} color="#bfe3c4" />
              <Text style={styles.toastTxt}>Campeonato criado — {toast}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ── subcomponentes (padrão das fichas) ───────────────────────
// BeltPickerRow — chips de faixa em ScrollView horizontal, com setas
// laterais (‹ ›) só no web: sem toque/scrollbar, o ScrollView é difícil
// de rolar com mouse. No mobile o toque já rola, então as setas somem.
const BELT_SCROLL_STEP = 120;

function BeltPickerRow({
  selected, onSelect, keyPrefix,
}: {
  selected: BeltKey | "";
  onSelect: (k: BeltKey) => void;
  keyPrefix: string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);

  const scrollBy = (delta: number) => {
    const next = Math.max(0, offsetRef.current + delta);
    offsetRef.current = next;
    scrollRef.current?.scrollTo({ x: next, animated: true });
  };

  return (
    <View style={styles.beltPickerRow}>
      {Platform.OS === "web" ? (
        <TouchableOpacity
          onPress={() => scrollBy(-BELT_SCROLL_STEP)}
          style={styles.beltArrow}
          accessibilityLabel="Rolar faixas para a esquerda"
        >
          <Icon name="chevron-back" size={16} color={P.ink3} />
        </TouchableOpacity>
      ) : null}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.beltPicker}
        onScroll={(e) => { offsetRef.current = e.nativeEvent.contentOffset.x; }}
        scrollEventThrottle={16}
      >
        {BELT_KEYS.map((k) => (
          <TouchableOpacity key={`${keyPrefix}-${k}`} onPress={() => onSelect(k)}
            style={[styles.beltChip, { backgroundColor: KarateBelts[k].color }, selected === k && styles.beltChipSelected]}>
            <Text style={[styles.beltChipText, { color: KarateBelts[k].textColor }]}>{KarateBelts[k].label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {Platform.OS === "web" ? (
        <TouchableOpacity
          onPress={() => scrollBy(BELT_SCROLL_STEP)}
          style={styles.beltArrow}
          accessibilityLabel="Rolar faixas para a direita"
        >
          <Icon name="chevron-forward" size={16} color={P.ink3} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <View style={styles.row2}>{children}</View>;
}
function Field(props: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  hint?: string; req?: boolean; mono?: boolean; flex?: boolean; bad?: boolean; prefix?: string;
  note?: string; noteOk?: boolean; keyboardType?: any; autoCapitalize?: any; maxLength?: number;
  autoFocus?: boolean; returnKeyType?: any;
}) {
  return (
    <View style={[styles.field, props.flex && { flex: 1 }]}>
      <Text style={styles.label}>{props.label}{props.req ? <Text style={{ color: P.red }}> *</Text> : null}{props.hint ? <Text style={styles.labelHint}>  · {props.hint}</Text> : null}</Text>
      <View style={[styles.inputWrap, props.bad && styles.inputBad]}>
        {props.prefix ? <Text style={styles.prefix}>{props.prefix}</Text> : null}
        <TextInput
          style={[styles.input, props.mono && styles.mono]}
          value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder}
          placeholderTextColor={P.ink4} keyboardType={props.keyboardType} autoCapitalize={props.autoCapitalize}
          maxLength={props.maxLength} autoFocus={props.autoFocus} returnKeyType={props.returnKeyType}
        />
      </View>
      {props.note ? <Text style={[styles.note, props.noteOk ? styles.noteOk : props.bad ? styles.noteBad : null]}>{props.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,38,32,0.45)", alignItems: "center", justifyContent: "center", padding: 12 } as ViewStyle,
  card: { backgroundColor: P.paper, borderRadius: R.xl, overflow: "hidden", maxHeight: "92%", borderWidth: 1, borderColor: P.line2 } as ViewStyle,

  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: P.line, backgroundColor: P.glassHi } as ViewStyle,
  eyebrow: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.4, color: P.ink3, textTransform: "uppercase" } as TextStyle,
  title: { fontFamily: F.heading, fontSize: 24, color: P.ink, marginTop: 2 } as TextStyle,
  sub: { fontFamily: F.body, fontSize: 12.5, color: P.ink2, marginTop: 3 } as TextStyle,
  close: { padding: 4, borderRadius: 999 } as ViewStyle,

  stepper: { marginHorizontal: 20, marginTop: 14 } as ViewStyle,

  bodyContent: { padding: 20, paddingTop: 12, gap: 12 } as ViewStyle,
  stepContent: { gap: 4 } as ViewStyle,
  stepHint: { fontFamily: F.body, fontSize: 12, color: P.ink3, marginBottom: 4 } as TextStyle,

  row2: { flexDirection: "row", gap: 12 } as ViewStyle,
  field: { marginBottom: 11 } as ViewStyle,
  label: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 5 } as TextStyle,
  labelHint: { fontWeight: "500", color: P.ink4 } as TextStyle,
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2, borderRadius: R.md, paddingHorizontal: 12 } as ViewStyle,
  inputBad: { borderColor: P.red } as ViewStyle,
  prefix: { fontFamily: F.mono, fontSize: 13, color: P.ink3, marginRight: 6 } as TextStyle,
  input: { flex: 1, fontFamily: F.body, fontSize: 14, color: P.ink, paddingVertical: 11, outlineStyle: "none" as any } as TextStyle,
  mono: { fontFamily: F.mono, letterSpacing: 0.5 } as TextStyle,
  note: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 4 } as TextStyle,
  noteOk: { color: P.ok } as TextStyle,
  noteBad: { color: P.red } as TextStyle,

  fieldLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: P.ink2, marginBottom: 5 } as TextStyle,
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 } as ViewStyle,
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glassHi } as ViewStyle,
  chipActive: { backgroundColor: P.redWash, borderColor: P.red } as ViewStyle,
  chipText: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: P.ink3 } as TextStyle,
  chipTextActive: { color: P.red, fontWeight: "700" } as TextStyle,
  beltPickerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 4 } as ViewStyle,
  beltPicker: { flex: 1 } as ViewStyle,
  beltArrow: { padding: 4, borderRadius: 999, backgroundColor: P.glassHi, borderWidth: 1, borderColor: P.line2 } as ViewStyle,
  beltChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, borderWidth: 2, borderColor: "transparent" } as ViewStyle,
  beltChipSelected: { borderColor: P.ink } as ViewStyle,
  beltChipText: { fontFamily: F.body, fontSize: 12, fontWeight: "700" } as TextStyle,
  editor: { backgroundColor: P.glassHi, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, padding: 14, gap: 4, marginTop: 4 } as ViewStyle,
  editorTitle: { fontFamily: F.body, fontSize: 14, fontWeight: "800", color: P.ink, marginBottom: 4 } as TextStyle,
  catRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: P.glassHi, borderRadius: R.sm, borderWidth: 1, borderColor: P.line2, marginBottom: 8 } as ViewStyle,
  catRowError: { borderColor: P.redLine, backgroundColor: "rgba(184,70,58,0.06)" } as ViewStyle,
  catRowOk: { borderColor: P.line2, opacity: 0.85 } as ViewStyle,
  catName: { fontFamily: F.body, fontSize: 14, fontWeight: "700", color: P.ink } as TextStyle,
  catMeta: { fontFamily: F.body, fontSize: 11, color: P.ink3, marginTop: 2 } as TextStyle,
  catErr: { fontFamily: F.body, fontSize: 11, color: P.red2, marginTop: 2 } as TextStyle,
  iconBtn: { padding: 2 } as ViewStyle,
  reviewCard: { backgroundColor: P.glassHi, borderRadius: R.md, borderWidth: 1, borderColor: P.line2, padding: 14, gap: 3, marginBottom: 4 } as ViewStyle,
  reviewTitle: { fontFamily: F.heading, fontSize: 16, color: P.ink } as TextStyle,
  reviewMeta: { fontFamily: F.body, fontSize: 12, color: P.ink3 } as TextStyle,
  createdTag: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 } as ViewStyle,
  createdTagTxt: { fontFamily: F.body, fontSize: 11.5, color: P.ink2 } as TextStyle,

  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 } as ViewStyle,
  progressTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: P.ink } as TextStyle,

  resultBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 4 } as ViewStyle,
  resultBannerOk: { backgroundColor: "rgba(74,124,89,0.08)", borderColor: "rgba(74,124,89,0.35)" } as ViewStyle,
  resultBannerWarn: { backgroundColor: "rgba(184,70,58,0.08)", borderColor: P.redLine } as ViewStyle,
  resultTxt: { fontFamily: F.body, fontSize: 12.5, color: P.ink, flex: 1 } as TextStyle,

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: P.redLine, borderRadius: 12, padding: 11 } as ViewStyle,
  errorText: { fontFamily: F.body, fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,

  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: P.line, backgroundColor: P.glassHi } as ViewStyle,

  // toast de sucesso (inline, ancorado no rodapé do card)
  toast: { position: "absolute", left: 16, right: 16, bottom: 74, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 11, paddingHorizontal: 14 } as ViewStyle,
  toastTxt: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: "#fdf8f2", flex: 1 } as TextStyle,
});
