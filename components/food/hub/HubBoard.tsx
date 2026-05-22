import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform, ScrollView, ActivityIndicator } from "react-native";
import { FoodTokensV2 } from "@/constants/food-tokens";
import { HubOrderCard } from "./HubOrderCard";
import type { HubOrder, BoardColumn } from "@/hooks/useFoodHub";
import { orderBoardColumn } from "@/hooks/useFoodHub";

interface Props {
  orders: HubOrder[];
  loading?: boolean;
  onAccept?: (o: HubOrder) => void;
  onReject?: (o: HubOrder) => void;
  onPrint?: (o: HubOrder) => void;
  onDispatch?: (o: HubOrder) => void;
  onOpenNfce?: (o: HubOrder) => void;
  onOpenOrder?: (o: HubOrder) => void;
}

const COLUMNS: { key: BoardColumn; label: string; color: string; subtitle: string }[] = [
  { key: "new",        label: "Novo",       color: FoodTokensV2.stNovo,  subtitle: "aguardando confirmar" },
  { key: "preparing",  label: "Preparando", color: FoodTokensV2.stPrep,  subtitle: "na cozinha" },
  { key: "ready",      label: "Pronto",     color: FoodTokensV2.stPronto, subtitle: "aguardando despacho/retirada" },
  { key: "in_route",   label: "Em rota",    color: FoodTokensV2.stRota,  subtitle: "com motoboy" },
];

export function HubBoard({ orders, loading, onAccept, onReject, onPrint, onDispatch, onOpenNfce, onOpenOrder }: Props) {
  const grouped = useMemo(() => {
    const map: Record<BoardColumn, HubOrder[]> = { new: [], preparing: [], ready: [], in_route: [], other: [] };
    for (const o of orders) {
      const col = orderBoardColumn(o);
      map[col].push(o);
    }
    // sort por created_at desc dentro de cada coluna
    for (const k of Object.keys(map) as BoardColumn[]) {
      map[k].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return map;
  }, [orders]);

  if (loading && orders.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={FoodTokensV2.primary} />
        <Text style={styles.loadingText}>Carregando pedidos...</Text>
      </View>
    );
  }

  // Em web (desktop), 4 colunas lado a lado via grid; em mobile/native, scroll horizontal.
  return (
    <ScrollView
      horizontal={Platform.OS !== "web"}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={Platform.OS !== "web" ? styles.nativeRow : undefined}
    >
      <View style={styles.board as any}>
        {COLUMNS.map((col) => {
          const list = grouped[col.key];
          return (
            <View key={col.key} style={styles.column}>
              <View style={styles.columnHeader}>
                <View style={[styles.colDot, { backgroundColor: col.color }]} />
                <Text style={styles.colLabel}>{col.label}</Text>
                <View style={styles.colCountBox}>
                  <Text style={styles.colCount}>{list.length}</Text>
                </View>
              </View>
              <Text style={styles.colSub}>{col.subtitle}</Text>

              <View style={styles.columnBody}>
                {list.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>Nenhum pedido</Text>
                  </View>
                ) : (
                  list.map((o) => (
                    <HubOrderCard
                      key={o.source + ":" + o.id}
                      order={o}
                      onAccept={onAccept}
                      onReject={onReject}
                      onPrint={onPrint}
                      onDispatch={onDispatch}
                      onOpenNfce={onOpenNfce}
                      onOpen={onOpenOrder}
                    />
                  ))
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nativeRow: { paddingRight: 16 },
  board: {
    flexDirection: "row",
    gap: 14,
    ...(Platform.OS === "web" ? ({ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" } as any) : {}),
  } as any,
  column: {
    width: Platform.OS === "web" ? "100%" : 300,
    minWidth: Platform.OS === "web" ? 0 : 300,
    gap: 4,
  } as any,
  columnHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  colDot: { width: 8, height: 8, borderRadius: 4 },
  colLabel: { fontSize: 13, fontWeight: "800", color: FoodTokensV2.ink, letterSpacing: -0.2 },
  colCountBox: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: FoodTokensV2.bg2 },
  colCount: { fontSize: 10, fontWeight: "700", color: FoodTokensV2.ink3 },
  colSub: { fontSize: 10, color: FoodTokensV2.ink4, marginBottom: 6 },
  columnBody: { gap: 2 },
  empty: {
    padding: 24,
    borderRadius: FoodTokensV2.rMd,
    backgroundColor: FoodTokensV2.surfaceFlat,
    borderWidth: 1, borderColor: FoodTokensV2.line,
    borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
  },
  emptyText: { fontSize: 11, color: FoodTokensV2.ink4 },
  loading: {
    padding: 32, alignItems: "center", justifyContent: "center", gap: 10,
  },
  loadingText: { fontSize: 12, color: FoodTokensV2.ink3 },
});
