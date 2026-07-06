// ============================================================
// Competições — Workspace do Campeonato — Aura Karatê (federação)
//
// FASE 1 do Workspace unificado: reestruturação de NAVEGAÇÃO/UI apenas
// (sem mudar o modelo de dados de resultados/ranking). Substitui a tela
// antiga de "categorias expansíveis em lista" por um workspace com:
//   - Rail de categorias (lateral em telas largas / chips no topo em
//     telas estreitas) com dois itens de nível-competição fixos no topo
//     ("Visão geral", "Ranking geral") + uma entrada por categoria.
//   - Ao selecionar uma categoria: abas locais "Inscritos" (lançamento
//     de resultado preservado, EXATAMENTE como na tela antiga) e
//     "Chaves & Resultados"/"Apuração Kata" (usa o CategoryBracketPanel
//     extraído de chaves.tsx — components/karate/chaves/CategoryBracketPanel.tsx).
//   - Header com nome/status/data/local do campeonato e os MESMOS
//     handlers de publicar/editar/encerrar/cancelar de antes (lógica
//     inalterada, só reorganizados na tela).
//
// "Visão geral" e "Ranking geral" são placeholders nesta fase — a
// implementação real entra na Fase 2 (ver comentários `// FASE2:`).
//
// A rota antiga app/karate/(federation)/competicoes/torneio/chaves.tsx
// continua existindo (deep-link), agora também consumindo o mesmo
// CategoryBracketPanel.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle, Animated, useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateFonts, KarateBelts, BeltKey, ShojiPalette as P } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { Badge } from "@/components/karate/Badge";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateCompetitionsApi, Entry, CompetitionDetail, Modality, CompetitionStatus, Category, Sex, EntryStatus,
} from "@/services/karateCompetitionsApi";
import { EventBannerManager } from "@/components/karate/EventBannerManager";
import { EditarTorneioInfoModal } from "@/components/karate/EditarTorneioInfoModal";
import { notify } from "@/utils/webAlert";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { toast } from "@/components/Toast";
import { CategoryBracketPanel } from "@/components/karate/chaves/CategoryBracketPanel";
import { buildRosterHtml } from "@/components/karate/chaves/buildRosterHtml";

const MODALITY_LABEL: Record<Modality, string> = {
  kata: "Kata", kumite: "Kumite", kihon_ippon: "Kihon-Ippon", team_kata: "Kata Equipe", team_kumite: "Kumite Equipe",
};
const STATUS_BADGE: Record<CompetitionStatus, "ok" | "warn" | "alert" | "neutral"> = {
  draft: "neutral", open: "ok", closed: "warn", done: "neutral", cancelled: "alert",
};
const STATUS_LABEL: Record<CompetitionStatus, string> = {
  draft: "Rascunho", open: "Inscrições abertas", closed: "Encerradas", done: "Concluído", cancelled: "Cancelado",
};
const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  registered: "Inscrito", confirmed: "Confirmado", checked_in: "Check-in", competing: "Em disputa", done: "Concluído", withdrawn: "Desistiu",
};

const MODALITIES: { value: Modality; label: string }[] = [
  { value: "kata", label: "Kata" },
  { value: "kumite", label: "Kumite" },
  { value: "kihon_ippon", label: "Kihon-Ippon" },
  { value: "team_kata", label: "Kata Equipe" },
  { value: "team_kumite", label: "Kumite Equipe" },
];
const SEXES: { value: Sex; label: string }[] = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
  { value: "mixed", label: "Misto" },
];
const BELT_KEYS = Object.keys(KarateBelts) as BeltKey[];
const onlyD = (v: string) => (v || "").replace(/\D/g, "");
function maskMoney(v: string) {
  const cents = onlyD(v).slice(0, 11);
  if (!cents) return "";
  const n = parseInt(cents, 10);
  return `${Math.floor(n / 100).toLocaleString("pt-BR")},${String(n % 100).padStart(2, "0")}`;
}
function moneyToNumber(v: string): number {
  const cents = onlyD(v);
  return cents ? parseInt(cents, 10) / 100 : 0;
}

// Breakpoint do workspace: acima disso o rail fica fixo à esquerda;
// abaixo, vira uma faixa horizontal de chips no topo.
const WIDE_BREAKPOINT = 820;

// Seleção no rail: nível-competição ("overview"/"ranking") ou uma
// categoria (guardamos o id da categoria).
type RailSelection = { kind: "overview" } | { kind: "ranking" } | { kind: "category"; categoryId: string };
// Aba local dentro do painel de uma categoria. "chaves" cobre tanto
// Kumite ("Chaves & Resultados") quanto Kata ("Apuração Kata") — o
// rótulo muda conforme a modalidade, mas a intenção (ver o
// chaveamento/apuração) é a mesma, por isso NÃO reseta ao trocar de
// categoria (só o rótulo do botão muda).
type CategoryTab = "inscritos" | "chaves";

export default function TorneioDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { federationId, federationName } = useKarateFederation();
  const cid = String(id || "");
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [comp, setComp] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [entriesByCat, setEntriesByCat] = useState<Record<string, Entry[]>>({});
  const [entriesLoadingCat, setEntriesLoadingCat] = useState<string | null>(null);
  const [resultFor, setResultFor] = useState<Entry | null>(null);
  const [copyFor, setCopyFor] = useState<Category | null>(null);
  const [editFor, setEditFor] = useState<Category | null>(null);
  // Tornar evento editável: modal "Editar informações" do torneio (nome, data, local...).
  const [showEditInfo, setShowEditInfo] = useState(false);
  // F6.3: publicar campeonato (draft -> open) para abrir inscrições.
  const [publishing, setPublishing] = useState(false);
  // Celebração sóbria ao publicar: leve glow + check animado no header do
  // status (some sozinha após a animação; sem libs de confete).
  const [justPublished, setJustPublished] = useState(false);
  const celebrateAnim = useRef(new Animated.Value(0)).current;
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (celebrateTimer.current) clearTimeout(celebrateTimer.current); }, []);
  // F7.4: encerrar (open -> done) e cancelar (draft/open -> cancelled) o campeonato.
  const [closing, setClosing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ── Workspace: rail (categorias + Visão geral/Ranking geral) + abas ──
  const [selection, setSelection] = useState<RailSelection>({ kind: "overview" });
  // Aba ativa dentro do painel de categoria — independente de qual
  // categoria está selecionada (não reseta ao trocar de categoria).
  const [activeTab, setActiveTab] = useState<CategoryTab>("inscritos");
  const [printingRoster, setPrintingRoster] = useState(false);

  const load = useCallback(() => {
    if (!cid) return;
    setLoading(true);
    setError(false);
    karateCompetitionsApi.getCompetition(federationId, cid)
      .then(setComp)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [federationId, cid]);
  useEffect(() => { load(); }, [load]);

  const loadEntries = useCallback(async (categoryId: string) => {
    setEntriesLoadingCat(categoryId);
    try {
      const rows = await karateCompetitionsApi.listEntries(federationId, cid, categoryId);
      setEntriesByCat((prev) => ({ ...prev, [categoryId]: rows ?? [] }));
    } catch {
      setEntriesByCat((prev) => ({ ...prev, [categoryId]: [] }));
    } finally {
      setEntriesLoadingCat((prev) => (prev === categoryId ? null : prev));
    }
  }, [federationId, cid]);

  const selectedCategory = useMemo(() => {
    if (selection.kind !== "category" || !comp) return null;
    return comp.categories.find((c) => c.id === selection.categoryId) || null;
  }, [selection, comp]);

  // Ao selecionar uma categoria, carrega os inscritos dela (se ainda não
  // carregados) — igual ao antigo toggleCat, mas disparado pela seleção
  // no rail em vez de um accordion.
  useEffect(() => {
    if (selection.kind === "category" && !entriesByCat[selection.categoryId]) {
      loadEntries(selection.categoryId);
    }
  }, [selection, entriesByCat, loadEntries]);

  // Trocar de categoria mantém a aba ativa, exceto quando a categoria
  // recém-selecionada não suporta a aba atual (não há caso hoje: toda
  // categoria tem Inscritos + Chaves/Apuração — o rótulo só muda com a
  // modalidade). Mantido explícito para clareza de intenção.
  const handleSelectCategory = (categoryId: string) => {
    setSelection({ kind: "category", categoryId });
  };

  // F6.3: publica o campeonato (draft -> open). PATCH já valida status; sem rota nova.
  const handlePublish = async () => {
    if (!comp) return;
    setPublishing(true);
    try {
      await karateCompetitionsApi.patchCompetition(federationId, cid, { status: "open" });
      setComp((prev) => (prev ? { ...prev, status: "open" } : prev));
      notify("Inscrições abertas", "O campeonato foi publicado e já aceita inscrições.");
      setJustPublished(true);
      celebrateAnim.setValue(0);
      Animated.sequence([
        Animated.timing(celebrateAnim, { toValue: 1, duration: 260, useNativeDriver: false }),
        Animated.timing(celebrateAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(celebrateAnim, { toValue: 0, duration: 320, useNativeDriver: false }),
      ]).start(() => setJustPublished(false));
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
      celebrateTimer.current = setTimeout(() => setJustPublished(false), 1600);
    } catch (e: any) {
      notify("Não foi possível publicar", e?.message ?? "Tente novamente.");
    } finally {
      setPublishing(false);
    }
  };

  // F7.4: encerra o campeonato (open -> done). Rota dedicada /close.
  const handleClose = async () => {
    const ok = await confirmAsync({
      title: "Encerrar campeonato?",
      message: "O campeonato será marcado como concluído. Nenhum novo resultado poderá ser lançado depois disso.",
      confirmLabel: "Encerrar",
    });
    if (!ok || !comp) return;
    setClosing(true);
    try {
      await karateCompetitionsApi.closeCompetition(federationId, cid);
      setComp((prev) => (prev ? { ...prev, status: "done" } : prev));
      notify("Campeonato encerrado", "O campeonato foi marcado como concluído.");
    } catch (e: any) {
      notify("Não foi possível encerrar", e?.message ?? "Tente novamente.");
    } finally {
      setClosing(false);
    }
  };

  // F7.4: cancela o campeonato (draft/open -> cancelled).
  const handleCancel = async () => {
    const ok = await confirmAsync({
      title: "Cancelar campeonato?",
      message: "O campeonato será marcado como cancelado. Essa ação não pode ser desfeita pelo app.",
      confirmLabel: "Cancelar campeonato",
      destructive: true,
    });
    if (!ok || !comp) return;
    setCancelling(true);
    try {
      await karateCompetitionsApi.patchCompetition(federationId, cid, { status: "cancelled" });
      setComp((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      notify("Campeonato cancelado", "O campeonato foi cancelado.");
    } catch (e: any) {
      notify("Não foi possível cancelar", e?.message ?? "Tente novamente.");
    } finally {
      setCancelling(false);
    }
  };

  const saveResult = async (entry: Entry, placement: string, points: string) => {
    const body = {
      placement: placement ? parseInt(placement, 10) : null,
      points_awarded: points ? parseInt(points, 10) : 0,
      status: "done" as const,
    };
    try {
      await karateCompetitionsApi.patchEntry(federationId, cid, entry.id, body);
      setEntriesByCat((prev) => ({
        ...prev,
        [entry.category_id]: (prev[entry.category_id] || []).map((e) =>
          e.id === entry.id ? { ...e, placement: body.placement, points_awarded: body.points_awarded, status: "done" } : e
        ),
      }));
      setResultFor(null);
    } catch (e: any) {
      notify("Não foi possível salvar", e?.message ?? "Tente novamente.");
    }
  };

  // Botão "Imprimir lista" da aba Inscritos — stub funcional (Fase 2 refina).
  const handlePrintRoster = useCallback(() => {
    if (!selectedCategory) return;
    setPrintingRoster(true);
    try {
      const entries = entriesByCat[selectedCategory.id] || [];
      const html = buildRosterHtml(entries, {
        competitionName: comp?.name,
        categoryName: selectedCategory.name,
        federationName,
      });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) {
        const w2 = window.open("", "_blank");
        if (w2) { w2.document.write(html); w2.document.close(); }
        else { toast.error("Popup bloqueado — permita popups para app.getaura.com.br"); return; }
      }
      toast.success("Lista aberta para impressão");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar a lista para impressão");
    } finally {
      setPrintingRoster(false);
    }
  }, [selectedCategory, entriesByCat, comp, federationName]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: KarateColors.bg, padding: 24, gap: 12 }}>
        <ActivityIndicator size="large" color={KarateColors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }
  if (error || !comp) return <KarateErrorState onRetry={load} />;

  const isKataModality = (m: Modality) => m === "kata" || m === "team_kata";
  const chavesTabLabel = selectedCategory && isKataModality(selectedCategory.modality) ? "Apuração Kata" : "Chaves & Resultados";

  return (
    <View style={styles.screen}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar">
        <Icon name="chevron-back" size={18} color={KarateColors.primary} />
        <Text style={styles.backText}>Competições</Text>
      </TouchableOpacity>

      {/* ── Header do campeonato ────────────────────────────────────── */}
      <Animated.View style={[
        styles.headerCard,
        justPublished && {
          shadowColor: KarateColors.primary,
          shadowOpacity: celebrateAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
          borderColor: celebrateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [KarateColors.border, KarateColors.primary],
          }),
        },
      ]}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{comp.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {justPublished && (
              <Animated.View style={[styles.celebrateCheck, {
                opacity: celebrateAnim,
                transform: [{ scale: celebrateAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
              }]}>
                <Icon name="checkmark-circle" size={16} color={KarateColors.primary} />
              </Animated.View>
            )}
            <Badge status={STATUS_BADGE[comp.status]} label={STATUS_LABEL[comp.status]} />
          </View>
        </View>
        <Text style={styles.meta}>Temporada {comp.season}{comp.circuit_round ? ` · ${comp.circuit_round}ª etapa` : ""}</Text>
        {!!comp.location && <Text style={styles.meta}>{comp.location}</Text>}
        <View style={styles.statsRow}>
          <Text style={styles.stat}><Text style={styles.statNum}>{comp.categories.length}</Text> {comp.categories.length === 1 ? "categoria" : "categorias"}</Text>
          <Text style={styles.stat}><Text style={styles.statNum}>{comp.entry_count ?? 0}</Text> {(comp.entry_count ?? 0) === 1 ? "inscrito" : "inscritos"}</Text>
        </View>
        {/* F6.3: publicar campeonato (draft -> open) + editável: nome, data, local, etapa, taxa.
            F7.4: Encerrar (open) e Cancelar (draft/open). "Chaves" deixou de ser um botão
            separado — agora é uma aba dentro de cada categoria no workspace abaixo. */}
        <View style={styles.headerActions}>
          {comp.status === "draft" && (
            <KarateButton
              label={publishing ? "Publicando..." : "Publicar / Abrir inscrições"}
              variant="sumi"
              size="sm"
              loading={publishing}
              onPress={handlePublish}
              style={{ flex: 1 }}
            />
          )}
          <KarateButton
            label="Editar informações"
            variant="secondary"
            size="sm"
            onPress={() => setShowEditInfo(true)}
            style={{ flex: 1 }}
          />
          {comp.status === "open" && (
            <KarateButton
              label={closing ? "Encerrando..." : "Encerrar"}
              variant="secondary"
              size="sm"
              loading={closing}
              disabled={closing || cancelling}
              onPress={handleClose}
              style={{ flex: 1 }}
            />
          )}
          {(comp.status === "draft" || comp.status === "open") && (
            <KarateButton
              label={cancelling ? "Cancelando..." : "Cancelar"}
              variant="primary"
              size="sm"
              loading={cancelling}
              disabled={closing || cancelling}
              onPress={handleCancel}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </Animated.View>

      {/* Banner deixou de ser tela própria: agora é anexo do evento. */}
      <EventBannerManager federationId={federationId} eventId={cid} />

      {/* ── Workspace: rail + conteúdo ──────────────────────────────── */}
      <View style={[styles.workspace, isWide ? styles.workspaceWide : styles.workspaceNarrow]}>
        <CategoryRail
          isWide={isWide}
          categories={comp.categories}
          selection={selection}
          onSelect={setSelection}
          onSelectCategory={handleSelectCategory}
          entriesByCat={entriesByCat}
        />

        <View style={styles.contentArea}>
          {selection.kind === "overview" && <VisaoGeralPlaceholder comp={comp} />}
          {selection.kind === "ranking" && <RankingGeralPlaceholder />}
          {selection.kind === "category" && selectedCategory && (
            <View>
              <View style={styles.catHeadRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>{selectedCategory.name}</Text>
                  <Text style={styles.catMeta}>
                    {MODALITY_LABEL[selectedCategory.modality]} · {selectedCategory.entry_count ?? (entriesByCat[selectedCategory.id]?.length ?? 0)} {(selectedCategory.entry_count ?? (entriesByCat[selectedCategory.id]?.length ?? 0)) === 1 ? "inscrito" : "inscritos"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditFor(selectedCategory)}
                  style={styles.iconBtn}
                  accessibilityLabel={`Editar categoria ${selectedCategory.name}`}
                  hitSlop={8}
                >
                  <Icon name="edit" size={15} color={KarateColors.ink3} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCopyFor(selectedCategory)}
                  style={styles.iconBtn}
                  accessibilityLabel={`Copiar categoria ${selectedCategory.name}`}
                  hitSlop={8}
                >
                  <Icon name="copy" size={15} color={KarateColors.ink3} />
                </TouchableOpacity>
              </View>

              {/* Abas locais — trocar de categoria mantém a aba ativa. */}
              <View style={styles.tabsRow}>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === "inscritos" && styles.tabBtnActive]}
                  onPress={() => setActiveTab("inscritos")}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === "inscritos" }}
                >
                  <Text style={[styles.tabBtnText, activeTab === "inscritos" && styles.tabBtnTextActive]}>Inscritos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === "chaves" && styles.tabBtnActive]}
                  onPress={() => setActiveTab("chaves")}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === "chaves" }}
                >
                  <Text style={[styles.tabBtnText, activeTab === "chaves" && styles.tabBtnTextActive]}>{chavesTabLabel}</Text>
                </TouchableOpacity>
              </View>

              {activeTab === "inscritos" && (
                <InscritosTab
                  category={selectedCategory}
                  entries={entriesByCat[selectedCategory.id] || []}
                  loading={entriesLoadingCat === selectedCategory.id}
                  onLaunchResult={setResultFor}
                  onPrintRoster={handlePrintRoster}
                  printing={printingRoster}
                />
              )}

              {activeTab === "chaves" && (
                <CategoryBracketPanel
                  federationId={federationId}
                  cid={cid}
                  catId={selectedCategory.id}
                  catName={selectedCategory.name}
                  modality={selectedCategory.modality}
                  competitionName={comp.name}
                  federationName={federationName}
                />
              )}
            </View>
          )}
        </View>
      </View>

      <ResultadoModal entry={resultFor} onClose={() => setResultFor(null)} onSave={saveResult} />
      <CategoriaFormModal
        mode="copy"
        category={copyFor}
        federationId={federationId}
        competitionId={cid}
        onClose={() => setCopyFor(null)}
        onSaved={(newCat) => {
          setCopyFor(null);
          setComp((prev) => prev ? { ...prev, categories: [...prev.categories, newCat] } : prev);
        }}
      />
      <CategoriaFormModal
        mode="edit"
        category={editFor}
        federationId={federationId}
        competitionId={cid}
        onClose={() => setEditFor(null)}
        onSaved={(updatedCat) => {
          setEditFor(null);
          setComp((prev) => prev
            ? { ...prev, categories: prev.categories.map((c) => (c.id === updatedCat.id ? { ...c, ...updatedCat } : c)) }
            : prev);
        }}
      />

      <EditarTorneioInfoModal
        visible={showEditInfo}
        competition={comp}
        federationId={federationId}
        competitionId={cid}
        onClose={() => setShowEditInfo(false)}
        onSaved={(updated) => {
          setShowEditInfo(false);
          setComp((prev) => (prev ? { ...prev, ...updated } : prev));
        }}
      />
    </View>
  );
}

// ── Rail de categorias ────────────────────────────────────────────
// Telas largas (>= WIDE_BREAKPOINT): coluna fixa à esquerda.
// Telas estreitas: faixa horizontal de chips no topo (ScrollView horizontal).
function CategoryRail({
  isWide, categories, selection, onSelect, onSelectCategory, entriesByCat,
}: {
  isWide: boolean;
  categories: Category[];
  selection: RailSelection;
  onSelect: (s: RailSelection) => void;
  onSelectCategory: (categoryId: string) => void;
  entriesByCat: Record<string, Entry[]>;
}) {
  const isOverview = selection.kind === "overview";
  const isRanking = selection.kind === "ranking";

  const items = (
    <>
      <RailItem
        isWide={isWide}
        icon="grid"
        label="Visão geral"
        active={isOverview}
        onPress={() => onSelect({ kind: "overview" })}
      />
      <RailItem
        isWide={isWide}
        icon="trophy"
        label="Ranking geral"
        active={isRanking}
        onPress={() => onSelect({ kind: "ranking" })}
      />
      {categories.length > 0 && <View style={isWide ? styles.railDividerWide : styles.railDividerNarrow} />}
      {categories.map((cat) => {
        const count = cat.entry_count ?? (entriesByCat[cat.id]?.length ?? 0);
        return (
          <RailItem
            key={cat.id}
            isWide={isWide}
            icon="albums-outline"
            label={cat.name}
            sub={`${MODALITY_LABEL[cat.modality]} · ${count} ${count === 1 ? "inscrito" : "inscritos"}`}
            active={selection.kind === "category" && selection.categoryId === cat.id}
            onPress={() => onSelectCategory(cat.id)}
          />
        );
      })}
      {categories.length === 0 && (
        <Text style={styles.railEmpty}>Sem categorias cadastradas.</Text>
      )}
    </>
  );

  if (isWide) {
    return (
      <ScrollView style={styles.railWide} contentContainerStyle={{ gap: 4, paddingBottom: 24 }}>
        {items}
      </ScrollView>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.railNarrow} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
      {items}
    </ScrollView>
  );
}

function RailItem({
  isWide, icon, label, sub, active, onPress,
}: {
  isWide: boolean;
  icon: string;
  label: string;
  sub?: string;
  active: boolean;
  onPress: () => void;
}) {
  if (isWide) {
    return (
      <TouchableOpacity
        style={[styles.railItemWide, active && styles.railItemWideActive]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Icon name={icon as any} size={16} color={active ? KarateColors.primary : KarateColors.ink3} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.railItemWideLabel, active && styles.railItemWideLabelActive]} numberOfLines={1}>{label}</Text>
          {!!sub && <Text style={styles.railItemWideSub} numberOfLines={1}>{sub}</Text>}
        </View>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.railChip, active && styles.railChipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Icon name={icon as any} size={14} color={active ? KarateColors.primary : KarateColors.ink3} />
      <Text style={[styles.railChipLabel, active && styles.railChipLabelActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Placeholders (Fase 2 — outro agente implementa o conteúdo real) ──
function VisaoGeralPlaceholder({ comp }: { comp: CompetitionDetail }) {
  // FASE2: substituir por dashboard real da competição (KPIs agregados,
  // progresso de chaves/kata por categoria, atalhos). Por ora, um slot
  // simples no shell só para o workspace ter algo navegável.
  return (
    <View style={styles.placeholderCard}>
      <Icon name="grid" size={22} color={KarateColors.ink3} />
      <Text style={styles.placeholderTitle}>Visão geral — em construção</Text>
      <Text style={styles.placeholderSub}>
        Um resumo do campeonato (progresso por categoria, pendências, atalhos) chega na Fase 2.
      </Text>
    </View>
  );
}

function RankingGeralPlaceholder() {
  // FASE2: substituir por getSeasonRanking (karateCompetitionsApi) com
  // tabela de classificação consolidada do campeonato/temporada.
  return (
    <View style={styles.placeholderCard}>
      <Icon name="trophy" size={22} color={KarateColors.ink3} />
      <Text style={styles.placeholderTitle}>Ranking geral — em construção</Text>
      <Text style={styles.placeholderSub}>
        A classificação consolidada do campeonato (getSeasonRanking) chega na Fase 2.
      </Text>
    </View>
  );
}

// ── Aba "Inscritos" — lista + lançamento de resultado (preservado) ──
function InscritosTab({
  category, entries, loading, onLaunchResult, onPrintRoster, printing,
}: {
  category: Category;
  entries: Entry[];
  loading: boolean;
  onLaunchResult: (e: Entry) => void;
  onPrintRoster: () => void;
  printing: boolean;
}) {
  return (
    <View style={styles.entriesPanel}>
      <View style={styles.entriesPanelHead}>
        <Text style={styles.entriesPanelTitle}>Inscritos</Text>
        <KarateButton
          label={printing ? "Gerando..." : "Imprimir lista"}
          variant="secondary"
          size="sm"
          loading={printing}
          onPress={onPrintRoster}
        />
      </View>
      {loading ? (
        <ActivityIndicator color={KarateColors.primary} style={{ marginTop: 20 }} />
      ) : entries.length === 0 ? (
        <Text style={styles.emptyEntries}>Nenhum inscrito nesta categoria.</Text>
      ) : (
        entries.map((e) => (
          <View key={e.id} style={styles.entryRow}>
            <View style={styles.placeBadge}>
              <Text style={styles.placeText}>{e.placement ? `${e.placement}º` : "—"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryName}>{e.student_name}</Text>
              <Text style={styles.entryMeta}>
                {e.karate_registration_number ?? "—"} · {e.dojo_name ?? "—"} · {ENTRY_STATUS_LABEL[e.status] ?? e.status}
              </Text>
            </View>
            {e.points_awarded > 0 ? <Text style={styles.entryPts}>{e.points_awarded} pts</Text> : null}
            <TouchableOpacity onPress={() => onLaunchResult(e)} style={styles.resultBtn} accessibilityLabel={`Lançar resultado de ${e.student_name}`}>
              <Icon name="create-outline" size={16} color={KarateColors.primary} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

// ── Modal: Lançar resultado ──────────────────────────────────
function ResultadoModal({ entry, onClose, onSave }: {
  entry: Entry | null;
  onClose: () => void;
  onSave: (e: Entry, placement: string, points: string) => void;
}) {
  const [placement, setPlacement] = useState("");
  const [points, setPoints] = useState("");
  useEffect(() => {
    setPlacement(entry?.placement ? String(entry.placement) : "");
    setPoints(entry?.points_awarded ? String(entry.points_awarded) : "");
  }, [entry]);
  if (!entry) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Lançar resultado</Text>
          <Text style={styles.sheetSub}>{entry.student_name}</Text>
          <Text style={styles.inputLabel}>Colocação</Text>
          <TextInput style={styles.input} value={placement} onChangeText={setPlacement} keyboardType="numeric" placeholder="1" placeholderTextColor={KarateColors.ink4} />
          <Text style={styles.inputLabel}>Pontos FPKT</Text>
          <TextInput style={styles.input} value={points} onChangeText={setPoints} keyboardType="numeric" placeholder="100" placeholderTextColor={KarateColors.ink4} />
          <View style={styles.sheetActions}>
            <KarateButton label="Cancelar" variant="ghost" size="md" onPress={onClose} style={{ flex: 1 }} />
            <KarateButton label="Salvar" variant="primary" size="md" onPress={() => onSave(entry, placement, points)} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Modal: Copiar / Editar categoria ──────────────────────────
// Form único para os dois fluxos: "copy" cria uma categoria nova a partir dos
// dados de outra (sufixo "(cópia)", POST /categories); "edit" altera a própria
// categoria existente (sem sufixo, PATCH /categories/:catId).
function CategoriaFormModal({ mode, category, federationId, competitionId, onClose, onSaved }: {
  mode: "copy" | "edit";
  category: Category | null;
  federationId: string;
  competitionId: string;
  onClose: () => void;
  onSaved: (cat: Category) => void;
}) {
  const [name, setName] = useState("");
  const [modality, setModality] = useState<Modality>("kata");
  const [sex, setSex] = useState<Sex>("mixed");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [beltMin, setBeltMin] = useState<BeltKey | "">("");
  const [beltMax, setBeltMax] = useState<BeltKey | "">("");
  const [maxEntries, setMaxEntries] = useState("");
  const [fee, setFee] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preenche o formulário com os dados da categoria (copiar adiciona sufixo; editar não)
  useEffect(() => {
    if (!category) return;
    setName(mode === "copy" ? `${category.name} (cópia)` : category.name);
    setModality(category.modality);
    setSex(category.sex);
    setAgeMin(category.min_age != null ? String(category.min_age) : "");
    setAgeMax(category.max_age != null ? String(category.max_age) : "");
    setBeltMin((category.belt_min as BeltKey | null) ?? "");
    setBeltMax((category.belt_max as BeltKey | null) ?? "");
    setMaxEntries(category.max_entries != null ? String(category.max_entries) : "");
    const cents = category.fee_amount != null ? Math.round(category.fee_amount * 100) : 0;
    setFee(cents ? maskMoney(String(cents)) : "");
    setError(null);
    setSaving(false);
  }, [category, mode]);

  if (!category) return null;

  const handleSave = async () => {
    if (!name.trim()) { setError("Informe o nome da categoria."); return; }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        modality,
        min_age: ageMin ? parseInt(ageMin, 10) : null,
        max_age: ageMax ? parseInt(ageMax, 10) : null,
        belt_min: beltMin || null,
        belt_max: beltMax || null,
        sex,
        max_entries: maxEntries ? parseInt(maxEntries, 10) : null,
        fee_amount: fee ? moneyToNumber(fee) : null,
      };
      const saved = mode === "edit"
        ? await karateCompetitionsApi.updateCategory(federationId, competitionId, category.id, payload)
        : await karateCompetitionsApi.createCategory(federationId, competitionId, payload);
      onSaved(saved);
    } catch (e: any) {
      const fallback = mode === "edit" ? "Não foi possível salvar a categoria. Tente novamente." : "Não foi possível criar a categoria. Tente novamente.";
      setError(e?.message ?? fallback);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, styles.sheetLarge]}>
          <Text style={styles.sheetTitle}>{mode === "edit" ? "Editar categoria" : "Copiar categoria"}</Text>
          <Text style={styles.sheetSub}>{mode === "edit" ? "Altere os campos e salve." : "Ajuste os campos e salve como nova categoria."}</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Icon name="alert_circle" size={14} color={P.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Nome da categoria <Text style={{ color: P.red }}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Kata Adulto Faixa Preta Masc."
              placeholderTextColor={KarateColors.ink4}
              autoFocus
            />

            <Text style={styles.inputLabel}>Modalidade</Text>
            <View style={styles.chipsRow}>
              {MODALITIES.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setModality(m.value)}
                  style={[styles.chip, modality === m.value && styles.chipActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: modality === m.value }}
                >
                  <Text style={[styles.chipText, modality === m.value && styles.chipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Sexo</Text>
            <View style={styles.chipsRow}>
              {SEXES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  onPress={() => setSex(s.value)}
                  style={[styles.chip, sex === s.value && styles.chipActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sex === s.value }}
                >
                  <Text style={[styles.chipText, sex === s.value && styles.chipTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Idade mín.</Text>
                <TextInput style={styles.input} value={ageMin} onChangeText={(v) => setAgeMin(onlyD(v).slice(0, 3))} keyboardType="numeric" placeholder="—" placeholderTextColor={KarateColors.ink4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Idade máx.</Text>
                <TextInput style={styles.input} value={ageMax} onChangeText={(v) => setAgeMax(onlyD(v).slice(0, 3))} keyboardType="numeric" placeholder="—" placeholderTextColor={KarateColors.ink4} />
              </View>
            </View>

            <Text style={styles.inputLabel}>Graduação mínima</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {BELT_KEYS.map((k) => (
                <TouchableOpacity
                  key={`min-${k}`}
                  onPress={() => setBeltMin(beltMin === k ? "" : k)}
                  style={[styles.beltChip, { backgroundColor: KarateBelts[k].color }, beltMin === k && styles.beltChipSelected]}
                  accessibilityLabel={`Faixa mínima ${KarateBelts[k].label}`}
                >
                  <Text style={[styles.beltChipText, { color: KarateBelts[k].textColor }]}>{KarateBelts[k].label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Graduação máxima</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {BELT_KEYS.map((k) => (
                <TouchableOpacity
                  key={`max-${k}`}
                  onPress={() => setBeltMax(beltMax === k ? "" : k)}
                  style={[styles.beltChip, { backgroundColor: KarateBelts[k].color }, beltMax === k && styles.beltChipSelected]}
                  accessibilityLabel={`Faixa máxima ${KarateBelts[k].label}`}
                >
                  <Text style={[styles.beltChipText, { color: KarateBelts[k].textColor }]}>{KarateBelts[k].label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Vagas</Text>
                <TextInput style={styles.input} value={maxEntries} onChangeText={(v) => setMaxEntries(onlyD(v))} keyboardType="numeric" placeholder="sem limite" placeholderTextColor={KarateColors.ink4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Taxa (R$)</Text>
                <TextInput style={styles.input} value={fee} onChangeText={(v) => setFee(maskMoney(v))} keyboardType="numeric" placeholder="0,00" placeholderTextColor={KarateColors.ink4} />
              </View>
            </View>
          </ScrollView>

          <View style={styles.sheetActions}>
            <KarateButton label="Cancelar" variant="ghost" size="md" onPress={onClose} style={{ flex: 1 }} disabled={saving} />
            <KarateButton
              label={saving ? (mode === "edit" ? "Salvando…" : "Criando…") : (mode === "edit" ? "Salvar alterações" : "Criar cópia")}
              variant="primary" size="md" loading={saving} onPress={handleSave} style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  back: { flexDirection: "row", alignItems: "center", gap: 2, padding: 24, paddingBottom: 0 } as ViewStyle,
  backText: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  headerCard: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 16, gap: 4, marginHorizontal: 24, marginTop: 16 } as ViewStyle,
  headerTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 } as ViewStyle,
  celebrateCheck: { alignItems: "center", justifyContent: "center" } as ViewStyle,
  title: { flex: 1, fontFamily: KarateFonts.heading, fontSize: 22, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  meta: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  statsRow: { flexDirection: "row", gap: 18, marginTop: 6 } as ViewStyle,
  headerActions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" } as ViewStyle,
  stat: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,
  statNum: { fontSize: 14, fontWeight: "800", color: KarateColors.ink, fontFamily: KarateFonts.mono } as TextStyle,

  // ── Workspace layout ──
  workspace: { flex: 1, marginHorizontal: 24, marginTop: 16, marginBottom: 24, gap: 16 } as ViewStyle,
  workspaceWide: { flexDirection: "row" } as ViewStyle,
  workspaceNarrow: { flexDirection: "column" } as ViewStyle,
  contentArea: { flex: 1, minWidth: 0 } as ViewStyle,

  // ── Rail (wide) ──
  railWide: { width: 260, flexGrow: 0, flexShrink: 0 } as ViewStyle,
  railItemWide: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: KarateRadius.md } as ViewStyle,
  railItemWideActive: { backgroundColor: KarateColors.primarySoft } as ViewStyle,
  railItemWideLabel: { fontSize: 13, fontWeight: "700", color: KarateColors.ink2 } as TextStyle,
  railItemWideLabelActive: { color: KarateColors.primary } as TextStyle,
  railItemWideSub: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  railDividerWide: { height: 1, backgroundColor: KarateColors.border, marginVertical: 8 } as ViewStyle,
  railEmpty: { fontSize: 12, color: KarateColors.ink3, paddingVertical: 8, paddingHorizontal: 12 } as TextStyle,

  // ── Rail (narrow / chips) ──
  railNarrow: { flexGrow: 0 } as ViewStyle,
  railChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  railChipActive: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primary } as ViewStyle,
  railChipLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, maxWidth: 140 } as TextStyle,
  railChipLabelActive: { color: KarateColors.primary } as TextStyle,
  railDividerNarrow: { width: 1, backgroundColor: KarateColors.border, marginHorizontal: 4 } as ViewStyle,

  // ── Placeholders (Fase 2) ──
  placeholderCard: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, borderStyle: "dashed", padding: 28, alignItems: "center", gap: 8 } as ViewStyle,
  placeholderTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  placeholderSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 420 } as TextStyle,

  // ── Categoria: header + abas ──
  catHeadRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 } as ViewStyle,
  catName: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  catMeta: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  iconBtn: { padding: 6, borderRadius: 8, backgroundColor: KarateColors.surface } as ViewStyle,
  tabsRow: { flexDirection: "row", gap: 8, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: KarateColors.border, paddingBottom: 10 } as ViewStyle,
  tabBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  tabBtnActive: { backgroundColor: KarateColors.primarySoft, borderColor: KarateColors.primary } as ViewStyle,
  tabBtnText: { fontSize: 12.5, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,
  tabBtnTextActive: { color: KarateColors.primary } as TextStyle,

  // ── Aba Inscritos ──
  entriesPanel: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, overflow: "hidden" } as ViewStyle,
  entriesPanelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  entriesPanelTitle: { fontSize: 13, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  emptyEntries: { fontSize: 12, color: KarateColors.ink3, padding: 14 } as TextStyle,
  entryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  placeBadge: { width: 34, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: KarateColors.surface } as ViewStyle,
  placeText: { fontSize: 12, fontWeight: "800", color: KarateColors.ink2, fontFamily: KarateFonts.mono } as TextStyle,
  entryName: { fontSize: 13, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  entryMeta: { fontSize: 11, color: KarateColors.ink3, marginTop: 1 } as TextStyle,
  entryPts: { fontSize: 13, fontWeight: "800", color: KarateColors.primary, fontFamily: KarateFonts.mono } as TextStyle,
  resultBtn: { padding: 6, borderRadius: 8, backgroundColor: KarateColors.primarySoft } as ViewStyle,

  // ── Modais ──
  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  sheet: { width: "100%", maxWidth: 360, backgroundColor: KarateColors.bg, borderRadius: KarateRadius.lg, padding: 20, gap: 8 } as ViewStyle,
  sheetLarge: { maxWidth: 520 } as ViewStyle,
  sheetTitle: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sheetSub: { fontSize: 13, color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  inputLabel: { fontSize: 12, fontWeight: "700", color: KarateColors.ink2, marginTop: 4 } as TextStyle,
  input: { borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: KarateColors.ink, backgroundColor: KarateColors.surface, fontFamily: KarateFonts.mono } as TextStyle,
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 12 } as ViewStyle,
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(184,70,58,0.08)", borderWidth: 1, borderColor: "rgba(184,70,58,0.42)", borderRadius: 10, padding: 10 } as ViewStyle,
  errorText: { fontSize: 12.5, color: P.red2, flex: 1 } as TextStyle,
  row2: { flexDirection: "row", gap: 10 } as ViewStyle,
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 } as ViewStyle,
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.surface } as ViewStyle,
  chipActive: { backgroundColor: "rgba(184,70,58,0.08)", borderColor: P.red } as ViewStyle,
  chipText: { fontSize: 12, fontWeight: "600", color: KarateColors.ink3 } as TextStyle,
  chipTextActive: { color: P.red, fontWeight: "700" } as TextStyle,
  beltChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 8, borderWidth: 2, borderColor: "transparent" } as ViewStyle,
  beltChipSelected: { borderColor: P.ink } as ViewStyle,
  beltChipText: { fontSize: 12, fontWeight: "700" } as TextStyle,
});
