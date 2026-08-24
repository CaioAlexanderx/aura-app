// ============================================================
// AURA DOJÔ — Campeonatos: VITRINE (cara de engine de eventos)
//
// Cards dos campeonatos 'open' da federação — e dos closed/done onde o
// dojô TEM delegação (dia do evento: badge "Inscrições encerradas" e CTA
// "Presença e chaves"): data em destaque, local, divisões como chips,
// "a partir de R$ X" e o CTA → /karate/(dojo)/campeonatos/[cid].
//
// Gate de conexão via resposta { not_linked } (nunca 403 mudo) → CTA de
// conexão. schema_pending degrada para aviso (migração pendente).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors as C, KarateFonts as F, KarateRadius as R } from "@/constants/karateTheme";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { KarateButton } from "@/components/karate/KarateButton";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { formatEventDateLong } from "@/utils/eventDate";
import { karateDelegationsApi, OpenCompetition, formatBRL, isEnrollmentOpen } from "@/services/karateDelegationsApi";

export function VitrineTab() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const [items, setItems] = useState<OpenCompetition[] | null>(null);
  const [notLinked, setNotLinked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!federationId) return;
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await karateDelegationsApi.listOpenCompetitions(federationId);
      setNotLinked(!!res.not_linked);
      setItems(res.data || []);
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar os campeonatos.");
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  if (items === null && !error) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />;
  }

  if (notLinked) {
    return (
      <View style={{ padding: 16 }}>
        <KarateEmptyState
          icon="link"
          title="Conecte seu dojô à federação"
          subtitle="Campeonatos são atos federativos — conecte-se para ver e inscrever sua delegação."
        />
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <KarateButton label="Ir para Conexão" variant="sumi" size="md" onPress={() => router.push("/karate/(dojo)/conexao" as any)} />
        </View>
      </View>
    );
  }

  if (error) {
    return <KarateErrorState message={error} onRetry={() => load()} />;
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      // PREMISSA (24/08): coluna central com largura máxima — cards da
      // vitrine não esticam em monitor largo (mesmo padrão da mesa pública).
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40, width: "100%", maxWidth: 920, alignSelf: "center" }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.primary} />}
    >
      {!items || items.length === 0 ? (
        <KarateEmptyState
          icon="trophy"
          title="Nenhum campeonato com inscrições abertas"
          subtitle="Quando a federação abrir as inscrições de um campeonato, ele aparece aqui."
          style={{ paddingVertical: 40 }}
        />
      ) : (
        items.map((comp) => <CompetitionCard key={comp.id} comp={comp} onEnroll={() => router.push(`/karate/(dojo)/campeonatos/${comp.id}` as any)} />)
      )}
    </ScrollView>
  );
}

function CompetitionCard({ comp, onEnroll }: { comp: OpenCompetition; onEnroll: () => void }) {
  // "A partir de": menor valor conhecido no card. A cotação real (com
  // bandas, equipes e isenções) é papel do carrinho — aqui é só vitrine.
  const fromPrice = comp.fee_amount != null && comp.fee_amount > 0 ? comp.fee_amount : null;
  // closed/done só chegam aqui quando o dojô TEM delegação — no dia do
  // evento o card vira a porta da Presença/Minhas chaves, não da inscrição.
  const open = isEnrollmentOpen(comp);
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={s.dateBadge}>
          <Icon name="calendar" size={13} color={C.primary} />
          <Text style={s.dateTxt}>{formatEventDateLong(comp.event_date)}</Text>
        </View>
        {!open ? (
          <View style={s.closedBadge}>
            <Icon name="lock-closed" size={11} color={C.ink3} />
            <Text style={s.closedBadgeTxt}>Inscrições encerradas</Text>
          </View>
        ) : comp.rectification_deadline ? (
          <Text style={s.deadline}>Retificações até {formatEventDateLong(comp.rectification_deadline)}</Text>
        ) : null}
      </View>

      <Text style={s.name}>{comp.name}</Text>
      {comp.location ? (
        <View style={s.metaRow}>
          <Icon name="map-pin" size={13} color={C.ink3} />
          <Text style={s.metaTxt}>{comp.location}</Text>
        </View>
      ) : null}

      {comp.divisions.length > 0 && (
        <View style={s.chips}>
          {comp.divisions.map((d) => (
            <View key={d.id} style={s.chip}>
              <Text style={s.chipTxt}>{d.name}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={s.footer}>
        <View>
          {!open ? (
            <Text style={s.priceHint}>Sua delegação está inscrita</Text>
          ) : comp.has_pricing ? (
            <Text style={s.priceHint}>Cotação por atleta e equipe no carrinho</Text>
          ) : fromPrice ? (
            <Text style={s.price}>a partir de <Text style={s.priceStrong}>{formatBRL(fromPrice)}</Text></Text>
          ) : (
            <Text style={s.priceHint}>Consulte valores no carrinho</Text>
          )}
        </View>
        <KarateButton label={open ? "Inscrever delegação" : "Presença e chaves"} variant="sumi" size="md" onPress={onEnroll} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, padding: 16, gap: 8 } as ViewStyle,
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 } as ViewStyle,
  dateBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.primarySoft, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 4 } as ViewStyle,
  dateTxt: { fontSize: 12.5, fontWeight: "700", color: C.primary } as TextStyle,
  deadline: { fontSize: 11, color: C.ink3 } as TextStyle,
  closedBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: C.border2, backgroundColor: C.glassHi, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 } as ViewStyle,
  closedBadgeTxt: { fontSize: 11, fontWeight: "700", color: C.ink3 } as TextStyle,
  name: { fontSize: 18, fontFamily: F.heading, color: C.ink, marginTop: 2 } as TextStyle,
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  metaTxt: { fontSize: 13, color: C.ink2 } as TextStyle,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 } as ViewStyle,
  chip: { borderWidth: 1, borderColor: C.border2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: C.glassHi } as ViewStyle,
  chipTxt: { fontSize: 11.5, fontWeight: "600", color: C.ink2 } as TextStyle,
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, gap: 10, flexWrap: "wrap" } as ViewStyle,
  price: { fontSize: 13, color: C.ink2 } as TextStyle,
  priceStrong: { fontSize: 15, fontWeight: "800", color: C.ink } as TextStyle,
  priceHint: { fontSize: 12, color: C.ink3, maxWidth: 180 } as TextStyle,
});
