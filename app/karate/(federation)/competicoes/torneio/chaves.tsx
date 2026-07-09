// ============================================================
// Competições — Chaves (Track M) · Shoji
//
// Orquestrador da tela de chaveamento por categoria:
//   Kata  : apuração por bateria (eliminatória + final, ranked by nota)
//   Kumite: bracket eliminatório single-elimination
//
// Acesso: /karate/(federation)/competicoes/torneio/chaves?id=<cid>
// Parâmetros: id (competition id), catId (category id), catName, modality
// Dados reais via karateBracketsApi; falhas mostram erro honesto.
//
// REFATORAÇÃO (re-skin Shoji + decomposição): TODO o data-fetching,
// state, effects e handlers permanecem inalterados. As sub-views
// (SorteioPanel, BracketView/MatchCard, KataView, DraftMatchCard) foram
// extraídas para components/karate/chaves/. A lógica de bracket/kata
// (avanço, byes, ranqueamento, medalhas, idempotência) NÃO foi tocada.
//
// FASE 1 do Workspace unificado (torneio/[id].tsx): toda a lógica
// POR-CATEGORIA de bracket/kata (loadBracket/loadKata, sorteio,
// generate/lock/reopen/advance, modal de nota) foi extraída para
// components/karate/chaves/CategoryBracketPanel.tsx, reaproveitado
// também pelo workspace novo. Esta tela mantém só o seletor de
// categoria (rota antiga preservada para deep-link) e delega o corpo
// por-categoria ao painel extraído.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import {
  KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F, KarateSpacing as SP,
} from "@/constants/karateTheme";
import { ShojiBackground, PageHead } from "@/components/karate/shoji";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateCompetitionsApi } from "@/services/karateCompetitionsApi";
import { CategoryBracketPanel } from "@/components/karate/chaves/CategoryBracketPanel";
import { KarateEmptyState } from "@/components/karate/EmptyState";

// ── Component ─────────────────────────────────────────────────────────
export default function ChavesScreen() {
  const { id: cid, catId, catName, modality } = useLocalSearchParams<{
    id: string; catId: string; catName: string; modality: string;
  }>();
  const router = useRouter();
  const { federationId, federationName } = useKarateFederation();

  // ── Category list state (pick category)
  const [categories, setCategories] = useState<Array<{ id: string; name: string; modality: string }>>([]);
  const [selectedCatId, setSelectedCatId] = useState(catId || "");
  const [selectedModality, setSelectedModality] = useState(modality || "");
  const [selectedCatName, setSelectedCatName] = useState(catName || "");
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [competitionName, setCompetitionName] = useState("");

  // Load categories for the competition
  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const cats = await karateCompetitionsApi.listCategories(federationId, cid || "");
      if (cats && cats.length) {
        setCategories(cats.map((c) => ({ id: c.id, name: c.name, modality: c.modality })));
        if (!selectedCatId && cats.length > 0) {
          setSelectedCatId(cats[0].id);
          setSelectedModality(cats[0].modality);
          setSelectedCatName(cats[0].name);
        }
      } else {
        setCategories([]);
      }
    } catch {
      // sem categorias: mantém vazio
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, [federationId, cid, selectedCatId]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // Nome do campeonato (cabeçalho da folha impressa dentro do painel extraído).
  useEffect(() => {
    if (!cid) return;
    karateCompetitionsApi.getCompetition(federationId, cid)
      .then((comp) => setCompetitionName(comp?.name || ""))
      .catch(() => setCompetitionName(""));
  }, [federationId, cid]);

  return (
    <ShojiBackground>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Icon name="chevron-back" size={16} color={P.red} />
          <Text style={styles.backText}>Competição</Text>
        </TouchableOpacity>

        <PageHead
          title="Chaves"
          sub="Sorteio e visualização do chaveamento por categoria. O Kumite gera um bracket eliminatório; o Kata é apurado por bateria, ranqueado por nota."
        />

        {/* Category selector */}
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catChip, selectedCatId === cat.id && styles.catChipActive]}
                onPress={() => {
                  setSelectedCatId(cat.id);
                  setSelectedModality(cat.modality);
                  setSelectedCatName(cat.name);
                }}
              >
                <Text style={[styles.catMod, cat.modality === "kumite" && styles.catModKumite]}>
                  {cat.modality === "kata" || cat.modality === "team_kata" ? "Kata" : "Kumite"}
                </Text>
                <Text style={styles.catChipName} numberOfLines={2}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.divider} />

        {/* ============= EMPTY STATE: ainda carregando categorias ============= */}
        {categoriesLoading && !selectedCatId && (
          <ActivityIndicator color={P.red} style={{ marginTop: 32 }} />
        )}

        {/* ============= EMPTY STATE: sem categorias no campeonato ============= */}
        {!categoriesLoading && categories.length === 0 && (
          <KarateEmptyState
            icon="layers"
            title="Este campeonato ainda não tem categorias"
            subtitle="Cadastre uma categoria na tela da competição para gerar chaves."
          />
        )}

        {/* ============= EMPTY STATE: há categorias, mas nenhuma selecionada ============= */}
        {!categoriesLoading && categories.length > 0 && !selectedCatId && (
          <KarateEmptyState
            icon="layers"
            title="Selecione uma categoria"
            subtitle="Escolha uma categoria acima para ver ou gerar a chave."
          />
        )}

        {/* ============= Corpo por-categoria (bracket/kata) ============= */}
        {!categoriesLoading && !!selectedCatId && (
          <CategoryBracketPanel
            federationId={federationId}
            cid={cid || ""}
            catId={selectedCatId}
            catName={selectedCatName}
            modality={selectedModality}
            competitionName={competitionName}
            federationName={federationName}
          />
        )}
      </ScrollView>
    </ShojiBackground>
  );
}

// ── Styles (orquestrador: header + chips de categoria) ─────────
const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 40, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center", gap: 12 } as ViewStyle,
  backRow: { flexDirection: "row", alignItems: "center", gap: 2 } as ViewStyle,
  backText: { fontFamily: F.body, fontSize: 13, fontWeight: "700", color: P.red } as TextStyle,
  catScroll: { flexGrow: 0 } as ViewStyle,
  catChip: {
    minWidth: 160, padding: 12, borderRadius: R.md,
    borderWidth: 1, borderColor: C.line, backgroundColor: P.glass2,
    marginRight: 8, gap: 6,
  } as ViewStyle,
  catChipActive: { borderColor: P.redLine, backgroundColor: P.redWash } as ViewStyle,
  catMod: {
    fontFamily: F.body, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    backgroundColor: P.glass2, color: C.ink3, alignSelf: "flex-start",
    borderWidth: 1, borderColor: C.line,
  } as TextStyle,
  catModKumite: { backgroundColor: C.ink, color: P.paperWarm, borderColor: C.ink } as TextStyle,
  catChipName: { fontFamily: F.body, fontSize: 13, fontWeight: "600", color: C.ink, lineHeight: 18 } as TextStyle,
  divider: { height: 1, backgroundColor: C.line, marginVertical: 8 } as ViewStyle,
});
