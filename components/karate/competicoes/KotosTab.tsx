// ============================================================
// AURA KARATÊ — Workspace do campeonato: KOTOS (board do dia)
//
// A planilha "DISTRIBUIÇÃO DE KOTOS" virou board: colunas = áreas do
// evento, cards = categorias, e o cabeçalho de cada koto mostra a carga
// estimada ("~3,5h · 58 atletas") recalculada pelo backend a cada
// movimento — exatamente o número que a federação somava à mão.
//
// Drag-n-drop na web (useBoardDragAndDrop); no mobile, cada card tem o
// seletor "Mover para" por toque (mesma operação, sem arrastar).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput,
  Platform, StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { confirmAsync } from "@/components/karate/ConfirmDialog";
import { toast } from "@/components/Toast";
import {
  karateCompetitionP1Api, ScheduleBoard, BoardArea, BoardCategory, formatEstMinutes,
} from "@/services/karateCompetitionP1Api";
import {
  useBoardDragAndDrop, useDraggableCategoryRef, useColumnDropZoneRef, BoardColumnId,
} from "./useBoardDragAndDrop";

const MODALITY_SHORT: Record<string, string> = {
  kata: "Kata", kumite: "Kumite", kihon_ippon: "Kihon-Ippon",
  team_kata: "Kata Eq.", team_kumite: "Kumite Eq.",
};

export function KotosTab({ federationId, competitionId }: { federationId: string; competitionId: string }) {
  const router = useRouter();
  const [board, setBoard] = useState<ScheduleBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newAreaName, setNewAreaName] = useState("");
  const [busy, setBusy] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBoard(await karateCompetitionP1Api.getScheduleBoard(federationId, competitionId));
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar o board do dia.");
    }
  }, [federationId, competitionId]);

  useEffect(() => { load(); }, [load]);

  // Move a categoria para um koto (ou para "não alocadas"), otimista com
  // rollback: o board volta do servidor com a carga recalculada.
  const moveCategory = useCallback(async (categoryId: string, toColumn: BoardColumnId) => {
    if (!board) return;
    const current = board.areas.find((a) => a.categories.some((c) => c.id === categoryId));
    const currentColumn: BoardColumnId = current ? current.id : null;
    if (currentColumn === toColumn) return;

    setMovingId(categoryId);
    try {
      const targetArea = toColumn ? board.areas.find((a) => a.id === toColumn) : null;
      await karateCompetitionP1Api.assignCategoryArea(federationId, competitionId, categoryId, {
        area_id: toColumn,
        area_order: targetArea ? targetArea.categories.length : null,
      });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível mover a categoria.");
    } finally {
      setMovingId(null);
    }
  }, [board, federationId, competitionId, load]);

  const dnd = useBoardDragAndDrop(moveCategory);

  const createArea = async () => {
    const name = newAreaName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await karateCompetitionP1Api.createArea(federationId, competitionId, {
        name, sort_order: board ? board.areas.length : 0,
      });
      setNewAreaName("");
      toast.success(`${name} criado.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível criar a área.");
    } finally {
      setBusy(false);
    }
  };

  const removeArea = async (area: BoardArea) => {
    const ok = await confirmAsync({
      title: `Excluir ${area.name}?`,
      message: area.categories.length
        ? `As ${area.categories.length} categoria(s) deste koto voltam para "Não alocadas".`
        : "O koto será removido do evento.",
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    try {
      await karateCompetitionP1Api.deleteArea(federationId, competitionId, area.id);
      toast.success("Área excluída.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível excluir a área.");
    }
  };

  if (!board && !error) return <ActivityIndicator style={{ marginTop: 28 }} color={C.primary} />;
  if (error) return <KarateErrorState message={error} onRetry={load} />;
  if (!board) return null;

  const columns: { id: BoardColumnId; area: BoardArea | null; cats: BoardCategory[] }[] = [
    ...board.areas.map((a) => ({ id: a.id as BoardColumnId, area: a, cats: a.categories })),
    { id: null, area: null, cats: board.unassigned },
  ];

  return (
    <View style={{ gap: 12 }}>
      {/* Cabeçalho: criar koto + totais */}
      <View style={s.head}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.title}>Kotos e ordem do dia</Text>
          <Text style={s.hint}>
            {board.totals.assigned} de {board.totals.categories} categorias alocadas · {board.totals.entry_count} inscritos
            {dnd.isWeb ? " · arraste os cards entre as áreas" : " · use “Mover” em cada card"}
          </Text>
        </View>
        <View style={s.newArea}>
          <TextInput
            style={s.newAreaInput}
            value={newAreaName}
            onChangeText={setNewAreaName}
            placeholder='Nova área (ex.: "Koto A")'
            placeholderTextColor={C.ink4}
          />
          <KarateButton label={busy ? "..." : "Criar"} variant="sumi" size="sm" onPress={createArea} disabled={busy || !newAreaName.trim()} />
        </View>
      </View>

      {board.areas.length === 0 && (
        <View style={s.emptyBox}>
          <Icon name="grid" size={16} color={C.ink3} />
          <Text style={s.emptyTxt}>
            Crie as áreas do evento (Koto A, B, C…) e distribua as categorias — a carga estimada de cada koto aparece no cabeçalho.
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 12, paddingBottom: 10 }}>
        {columns.map((col) => (
          <BoardColumn
            key={col.id === null ? "__unassigned__" : col.id}
            column={col.id}
            area={col.area}
            categories={col.cats}
            areas={board.areas}
            dnd={dnd}
            movingId={movingId}
            onMove={moveCategory}
            onRemoveArea={removeArea}
            onOpenMesario={(areaId) =>
              router.push(`/karate/competicoes/torneio/koto?id=${competitionId}&area=${areaId}` as any)
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function BoardColumn({
  column, area, categories, areas, dnd, movingId, onMove, onRemoveArea, onOpenMesario,
}: {
  column: BoardColumnId;
  area: BoardArea | null;
  categories: BoardCategory[];
  areas: BoardArea[];
  dnd: ReturnType<typeof useBoardDragAndDrop>;
  movingId: string | null;
  onMove: (categoryId: string, to: BoardColumnId) => void;
  onRemoveArea: (area: BoardArea) => void;
  /** P2: abre o Modo Mesário deste koto (tela operacional do dia). */
  onOpenMesario: (areaId: string) => void;
}) {
  const dropRef = useColumnDropZoneRef(column, dnd.onDrop, dnd.onHoverChange);
  const isHover = dnd.hoverColumn === column;
  const isUnassigned = column === null;

  return (
    <View ref={dropRef} style={[s.column, isHover && s.columnHover, isUnassigned && s.columnUnassigned]}>
      <View style={s.colHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.colTitle} numberOfLines={1}>
            {isUnassigned ? "Não alocadas" : area!.name}
          </Text>
          <Text style={s.colMeta}>
            {isUnassigned
              ? `${categories.length} categoria${categories.length === 1 ? "" : "s"}`
              : `${formatEstMinutes(area!.est_minutes)} · ${area!.entry_count} atleta${area!.entry_count === 1 ? "" : "s"}`}
          </Text>
        </View>
        {!isUnassigned && (
          <TouchableOpacity onPress={() => onRemoveArea(area!)} hitSlop={8} accessibilityLabel={`Excluir ${area!.name}`}>
            <Icon name="trash" size={14} color={C.ink3} />
          </TouchableOpacity>
        )}
      </View>

      {/* P2: entrada do Modo Mesário — a tela operacional do koto no dia. */}
      {!isUnassigned && (
        <TouchableOpacity
          style={s.mesarioBtn}
          onPress={() => onOpenMesario(area!.id)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir o Modo Mesário do ${area!.name}`}
        >
          <Icon name="play_circle" size={14} color={C.primary} />
          <Text style={s.mesarioBtnTxt}>Modo Mesário</Text>
          <Icon name="arrow_right" size={13} color={C.primary} />
        </TouchableOpacity>
      )}

      <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 6, padding: 8 }}>
        {categories.length === 0 ? (
          <Text style={s.colEmpty}>
            {isUnassigned ? "Tudo alocado 🎉" : dnd.isWeb ? "Solte categorias aqui" : "Sem categorias"}
          </Text>
        ) : (
          categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat}
              column={column}
              areas={areas}
              dnd={dnd}
              moving={movingId === cat.id}
              onMove={onMove}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function CategoryCard({
  cat, column, areas, dnd, moving, onMove,
}: {
  cat: BoardCategory;
  column: BoardColumnId;
  areas: BoardArea[];
  dnd: ReturnType<typeof useBoardDragAndDrop>;
  moving: boolean;
  onMove: (categoryId: string, to: BoardColumnId) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dragRef = useDraggableCategoryRef(true, cat.id, dnd.onDragStart, dnd.onDragEnd);
  const isDragging = dnd.draggingCategory === cat.id;

  return (
    <View ref={dragRef} style={[s.card, isDragging && s.cardDragging, moving && { opacity: 0.5 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={s.cardName} numberOfLines={1}>{cat.name}</Text>
        {moving ? <ActivityIndicator size="small" color={C.primary} /> : null}
      </View>
      <View style={s.cardMetaRow}>
        <Text style={s.cardMeta} numberOfLines={1}>
          {MODALITY_SHORT[cat.modality] || cat.modality}
          {cat.group_label ? ` · ${cat.group_label}` : ""}
        </Text>
        <Text style={s.cardLoad}>{cat.entry_count} · {formatEstMinutes(cat.est_minutes)}</Text>
      </View>

      {/* Mover por toque — o caminho universal (nativo e web) */}
      <TouchableOpacity style={s.moveBtn} onPress={() => setMenuOpen((v) => !v)} accessibilityRole="button">
        <Icon name={menuOpen ? "chevron-up" : "chevron-down"} size={12} color={C.ink3} />
        <Text style={s.moveBtnTxt}>Mover</Text>
      </TouchableOpacity>
      {menuOpen && (
        <View style={s.menu}>
          {areas.filter((a) => a.id !== column).map((a) => (
            <TouchableOpacity key={a.id} style={s.menuItem} onPress={() => { setMenuOpen(false); onMove(cat.id, a.id); }}>
              <Text style={s.menuTxt} numberOfLines={1}>{a.name}</Text>
            </TouchableOpacity>
          ))}
          {column !== null && (
            <TouchableOpacity style={s.menuItem} onPress={() => { setMenuOpen(false); onMove(cat.id, null); }}>
              <Text style={[s.menuTxt, { color: C.ink3 }]}>Não alocadas</Text>
            </TouchableOpacity>
          )}
          {areas.length === 0 && <Text style={s.menuEmpty}>Crie uma área primeiro.</Text>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", gap: 12, flexWrap: "wrap" } as ViewStyle,
  title: { fontSize: 14, fontWeight: "800", color: C.ink } as TextStyle,
  hint: { fontSize: 12, color: C.ink3, marginTop: 2 } as TextStyle,
  newArea: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  newAreaInput: { width: 190, fontSize: 13, color: C.ink, borderWidth: 1, borderColor: C.border2, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.glassHi } as TextStyle,
  emptyBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 12 } as ViewStyle,
  emptyTxt: { flex: 1, fontSize: 12.5, color: C.ink2 } as TextStyle,
  column: { width: 250, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.md, overflow: "hidden" } as ViewStyle,
  columnHover: { borderColor: C.primary, backgroundColor: C.primarySoft } as ViewStyle,
  columnUnassigned: { backgroundColor: C.glassHi, borderStyle: "dashed" } as ViewStyle,
  colHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.glassHi } as ViewStyle,
  mesarioBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.primarySoft } as ViewStyle,
  mesarioBtnTxt: { fontSize: 11.5, fontWeight: "700", color: C.primary } as TextStyle,
  colTitle: { fontSize: 13.5, fontWeight: "800", color: C.ink } as TextStyle,
  colMeta: { fontSize: 11, color: C.ink3, marginTop: 1, fontVariant: ["tabular-nums"] } as TextStyle,
  colEmpty: { fontSize: 12, color: C.ink4, textAlign: "center", paddingVertical: 20 } as TextStyle,
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, padding: 9, gap: 4 } as ViewStyle,
  cardDragging: { opacity: 0.4, borderColor: C.primary } as ViewStyle,
  cardName: { flex: 1, fontSize: 12.5, fontWeight: "700", color: C.ink } as TextStyle,
  cardMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 } as ViewStyle,
  cardMeta: { flex: 1, fontSize: 11, color: C.ink3 } as TextStyle,
  cardLoad: { fontSize: 10.5, color: C.ink3, fontVariant: ["tabular-nums"] } as TextStyle,
  moveBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" } as ViewStyle,
  moveBtnTxt: { fontSize: 11, fontWeight: "700", color: C.ink3 } as TextStyle,
  menu: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 4, gap: 2 } as ViewStyle,
  menuItem: { paddingVertical: 5, paddingHorizontal: 6, borderRadius: 4, backgroundColor: C.glassHi } as ViewStyle,
  menuTxt: { fontSize: 11.5, fontWeight: "600", color: C.ink2 } as TextStyle,
  menuEmpty: { fontSize: 11, color: C.ink4, paddingVertical: 4 } as TextStyle,
});
