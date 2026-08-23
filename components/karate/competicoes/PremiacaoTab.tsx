// ============================================================
// AURA KARATÊ — Workspace do campeonato: FILA DE PREMIAÇÃO (P2)
//
// A mesa de premiação deixa de receber papel: quando o mesário fecha o
// resultado de uma categoria (POST .../bracket/finalize, Modo Mesário),
// ela aparece aqui COM o pódio pronto. A mesa marca "Medalhas entregues"
// (com desfazer) e a categoria sai da frente da fila.
//
// Ordenação vem do backend: pendentes primeiro, na ordem do board
// (koto → ordem do dia). Auto-refresh a cada ~20s enquanto a aba está
// visível (o componente desmonta ao trocar de aba, o que encerra o timer).
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { Skeleton } from "@/components/karate/Skeleton";
import { toast } from "@/components/Toast";
import { karateCompetitionP1Api, AwardsQueue, AwardsQueueItem } from "@/services/karateCompetitionP1Api";

const REFRESH_MS = 20000;

const MODALITY_SHORT: Record<string, string> = {
  kata: "Kata", kumite: "Kumite", kihon_ippon: "Kihon-Ippon",
  team_kata: "Kata Equipe", team_kumite: "Kumite Equipe",
  enbu: "Enbu", fukugo: "Fukugo",
};

function placementLabel(placement: number): string {
  return `${placement}º`;
}

export function PremiacaoTab({ federationId, competitionId }: { federationId: string; competitionId: string }) {
  const [queue, setQueue] = useState<AwardsQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyCat, setBusyCat] = useState<string | null>(null);
  // Evita que um refresh silencioso pisque a lista inteira.
  const firstLoad = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setError(null);
    try {
      const data = await karateCompetitionP1Api.getAwardsQueue(federationId, competitionId);
      setQueue(data);
      setError(null);
    } catch (e: any) {
      // Refresh silencioso que falha não derruba a fila já exibida.
      if (!silent || !queue) setError(e?.message || "Não foi possível carregar a fila de premiação.");
    } finally {
      firstLoad.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [federationId, competitionId]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const toggleDelivered = async (item: AwardsQueueItem) => {
    setBusyCat(item.category_id);
    try {
      const next = !item.awards_delivered;
      await karateCompetitionP1Api.setAwardsDelivered(federationId, competitionId, item.category_id, next);
      toast.success(next ? "Medalhas marcadas como entregues." : "Entrega desfeita — a categoria voltou à fila.");
      await load(true);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível atualizar a entrega.");
    } finally {
      setBusyCat(null);
    }
  };

  if (!queue && !error) {
    return (
      <View style={{ gap: 10 }}>
        <Skeleton width={220} height={20} />
        <Skeleton height={120} radius={R.md} />
        <Skeleton height={120} radius={R.md} />
      </View>
    );
  }
  if (error && !queue) return <KarateErrorState message={error} onRetry={() => load()} />;
  if (!queue) return null;

  if (queue.schema_pending) {
    return (
      <View style={s.emptyBox}>
        <Icon name="clock" size={18} color={C.ink3} />
        <Text style={s.emptyTitle}>Fila de premiação ainda não disponível</Text>
        <Text style={s.emptyTxt}>O sistema está sendo atualizado (migração pendente). Tente novamente em instantes.</Text>
      </View>
    );
  }

  const pendingCount = queue.pending ?? queue.data.filter((c) => !c.awards_delivered).length;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.head}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.title}>Fila de premiação</Text>
          <Text style={s.hint}>
            {queue.count === 0
              ? "Nenhum pódio fechado ainda."
              : `${pendingCount} pendente${pendingCount === 1 ? "" : "s"} de ${queue.count} categoria${queue.count === 1 ? "" : "s"} com pódio · atualiza sozinha a cada 20s`}
          </Text>
        </View>
        <KarateButton label="Atualizar" variant="secondary" size="sm" onPress={() => load()} />
      </View>

      {queue.data.length === 0 && (
        <View style={s.emptyBox}>
          <Icon name="ribbon" size={18} color={C.ink3} />
          <Text style={s.emptyTitle}>Sem pódios na fila</Text>
          <Text style={s.emptyTxt}>
            Quando o mesário fechar o resultado de uma categoria no Modo Mesário, ela aparece aqui com o pódio pronto para a entrega das medalhas.
          </Text>
        </View>
      )}

      {queue.data.map((item) => (
        <View key={item.category_id} style={[s.card, item.awards_delivered && s.cardDone]}>
          <View style={s.cardHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.cardName} numberOfLines={2}>{item.category_name}</Text>
              <Text style={s.cardMeta} numberOfLines={1}>
                {MODALITY_SHORT[item.modality] || item.modality}
                {item.group_label ? ` · ${item.group_label}` : ""}
                {item.division_name ? ` · ${item.division_name}` : ""}
                {item.area_name ? ` · ${item.area_name}` : ""}
              </Text>
            </View>
            {item.awards_delivered ? (
              <View style={s.doneBadge}>
                <Icon name="check" size={13} color={P.ok} />
                <Text style={s.doneBadgeTxt}>Entregue</Text>
              </View>
            ) : (
              <View style={s.pendBadge}>
                <Icon name="ribbon" size={13} color={P.warn} />
                <Text style={s.pendBadgeTxt}>Aguardando</Text>
              </View>
            )}
          </View>

          <View style={s.podium}>
            {item.podium.map((p) => (
              <View key={p.entry_id} style={s.podiumRow}>
                <View style={[s.placeTile, p.placement === 1 && s.placeTileGold]}>
                  <Text style={[s.placeTxt, p.placement === 1 && s.placeTxtGold]}>{placementLabel(p.placement)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.athleteName} numberOfLines={1}>{p.name || "—"}</Text>
                  {!!p.dojo && <Text style={s.athleteDojo} numberOfLines={1}>{p.dojo}</Text>}
                </View>
                {p.points_awarded > 0 && (
                  <Text style={s.points}>{p.points_awarded} pts</Text>
                )}
              </View>
            ))}
          </View>

          <View style={s.cardActions}>
            {item.awards_delivered ? (
              <KarateButton
                label={busyCat === item.category_id ? "..." : "Desfazer entrega"}
                variant="ghost"
                size="sm"
                disabled={busyCat === item.category_id}
                onPress={() => toggleDelivered(item)}
              />
            ) : (
              <KarateButton
                label={busyCat === item.category_id ? "Marcando..." : "Medalhas entregues"}
                variant="sumi"
                size="md"
                loading={busyCat === item.category_id}
                disabled={busyCat === item.category_id}
                onPress={() => toggleDelivered(item)}
              />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", gap: 12, flexWrap: "wrap" } as ViewStyle,
  title: { fontFamily: F.heading, fontSize: 19, fontWeight: "400", color: C.ink } as TextStyle,
  hint: { fontFamily: F.body, fontSize: 12, color: C.ink3, marginTop: 2 } as TextStyle,
  emptyBox: { alignItems: "center", gap: 6, backgroundColor: C.glassHi, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingVertical: 28, paddingHorizontal: 20 } as ViewStyle,
  emptyTitle: { fontFamily: F.heading, fontSize: 15, fontWeight: "600", color: C.ink } as TextStyle,
  emptyTxt: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, textAlign: "center", lineHeight: 18, maxWidth: 420 } as TextStyle,
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 14, gap: 10 } as ViewStyle,
  cardDone: { opacity: 0.72, backgroundColor: C.glassHi } as ViewStyle,
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 } as ViewStyle,
  cardName: { fontFamily: F.heading, fontSize: 16, fontWeight: "600", color: C.ink, lineHeight: 21 } as TextStyle,
  cardMeta: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, marginTop: 2 } as TextStyle,
  doneBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: P.okWash, borderWidth: 1, borderColor: P.okLine, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 } as ViewStyle,
  doneBadgeTxt: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: P.ok } as TextStyle,
  pendBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: P.warnWash, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 } as ViewStyle,
  pendBadgeTxt: { fontFamily: F.body, fontSize: 11, fontWeight: "700", color: P.warn } as TextStyle,
  podium: { gap: 6 } as ViewStyle,
  podiumRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  placeTile: { width: 36, height: 30, borderRadius: R.sm, borderWidth: 1, borderColor: C.border2, backgroundColor: C.glassHi, alignItems: "center", justifyContent: "center" } as ViewStyle,
  placeTileGold: { backgroundColor: P.redWash, borderColor: P.redLine } as ViewStyle,
  placeTxt: { fontFamily: F.mono, fontSize: 13, color: C.ink2 } as TextStyle,
  placeTxtGold: { color: P.red2 } as TextStyle,
  athleteName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  athleteDojo: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,
  points: { fontFamily: F.mono, fontSize: 12, color: C.ink3 } as TextStyle,
  cardActions: { flexDirection: "row", justifyContent: "flex-end" } as ViewStyle,
});
