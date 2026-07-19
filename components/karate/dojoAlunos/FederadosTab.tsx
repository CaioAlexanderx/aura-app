// ============================================================
// FederadosTab — aba "Na federação" da tela Alunos (F2)
//
// É o conteúdo da ANTIGA tela (dojo)/praticantes.tsx (F1), movido para
// cá quando a tela virou "Alunos" com duas abas. Sem mudança de
// comportamento: praticantes FEDERADOS, read-only, dados reais via
// GET /federation/:id/dojo/practitioners; pirâmide derivada da lista.
// (A rota antiga segue viva como redirect fino → alunos.)
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius, KarateBelts, BeltKey, resolveBeltKey, beltRank } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateApi, SenseiPractitioner, SenseiPractitionersResponse } from "@/services/karateApi";

function BeltChip({ practitioner }: { practitioner: SenseiPractitioner }) {
  const key = resolveBeltKey(practitioner.belt_name || practitioner.belt_level || "");
  const belt = key ? KarateBelts[key] : null;
  const label = practitioner.belt_name || (belt ? belt.label : "Sem faixa");
  const bg = belt ? belt.color : KarateColors.bg2;
  const text = belt ? belt.textColor : KarateColors.ink3;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipTxt, { color: text }]}>{label}</Text>
    </View>
  );
}

export function FederadosTab() {
  const { federationId } = useKarateFederation();
  const [q, setQ] = useState("");
  const [data, setData] = useState<SenseiPractitionersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await karateApi.listSenseiPractitioners(federationId);
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const praticantes: SenseiPractitioner[] = data?.practitioners ?? [];
  const total = data?.count ?? praticantes.length;

  // Pirâmide de faixas: conta praticantes ATIVOS por faixa resolvida
  // (belt_name com fallback pra belt_level) e ordena pela hierarquia
  // oficial (beltRank), da mais alta pra mais baixa.
  const piramide = useMemo(() => {
    const counts = new Map<BeltKey, number>();
    for (const p of praticantes) {
      if (!p.is_active) continue;
      const key = resolveBeltKey(p.belt_name || p.belt_level || "");
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([belt, n]) => ({ belt, n }))
      .sort((a, b) => beltRank(b.belt) - beltRank(a.belt));
  }, [praticantes]);
  const maxP = Math.max(1, ...piramide.map((p) => p.n));

  const list = praticantes.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.lead}>
          {total} praticante{total === 1 ? "" : "s"} do seu dojô registrados na federação. A faixa e a anuidade vêm da FPKT — aqui você só acompanha. O registro próprio do dojô fica na aba "Meus alunos".
        </Text>
      </View>

      {loading && (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={KarateColors.primary} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.stateBox}>
          <Icon name="alert-circle" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Não foi possível carregar os praticantes.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
            <Text style={styles.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && praticantes.length === 0 && (
        <View style={styles.stateBox}>
          <Icon name="people-outline" size={28} color={KarateColors.ink3} />
          <Text style={styles.stateTxt}>Nenhum praticante cadastrado ainda.</Text>
          <Text style={styles.stateSub}>Quando a federação cadastrar alunos do seu dojô, eles aparecem aqui.</Text>
        </View>
      )}

      {!loading && !error && praticantes.length > 0 && (
        <>
          {/* Pirâmide de faixas */}
          {piramide.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Faixas na federação</Text>
              <Text style={styles.cardSub}>Como estão distribuídos os praticantes ativos</Text>
              <View style={{ gap: 7, marginTop: 8 }}>
                {piramide.map((p) => (
                  <View key={p.belt} style={styles.pyRow}>
                    <Text style={styles.pyLabel} numberOfLines={1}>{KarateBelts[p.belt].label}</Text>
                    <View style={styles.pyTrack}>
                      <View style={[styles.pyBar, { width: `${(p.n / maxP) * 100}%`, backgroundColor: KarateBelts[p.belt].color }]} />
                    </View>
                    <Text style={styles.pyNum}>{p.n}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Busca + lista */}
          <View style={styles.search}>
            <Icon name="search" size={16} color={KarateColors.ink3} />
            <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="Buscar praticante por nome" placeholderTextColor={KarateColors.ink4} />
          </View>

          {list.map((p) => (
            <View key={p.practitioner_id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{p.name}</Text>
              </View>
              <BeltChip practitioner={p} />
              <View style={[styles.status, p.is_active ? styles.statusOk : styles.statusPend]}>
                <Icon name={p.is_active ? "checkmark-circle" : "close-circle"} size={13} color={p.is_active ? KarateColors.ok : KarateColors.ink3} />
                <Text style={[styles.statusTxt, { color: p.is_active ? KarateColors.ok : KarateColors.ink3 }]}>{p.is_active ? "Ativo" : "Inativo"}</Text>
              </View>
            </View>
          ))}

          {list.length === 0 && (
            <View style={styles.stateBox}>
              <Icon name="search" size={22} color={KarateColors.ink3} />
              <Text style={styles.stateTxt}>Nenhum praticante encontrado para "{q}".</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, lineHeight: 18, maxWidth: 520 } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 } as ViewStyle,
  stateTxt: { fontSize: 14, fontWeight: "600", color: KarateColors.ink2, textAlign: "center" } as TextStyle,
  stateSub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 320 } as TextStyle,
  retryBtn: { marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,
  card: { backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardSub: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  pyRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  pyLabel: { width: 84, fontSize: 12, color: KarateColors.ink2 } as TextStyle,
  pyTrack: { flex: 1, height: 14, borderRadius: 7, backgroundColor: KarateColors.bg2, overflow: "hidden" } as ViewStyle,
  pyBar: { height: 14, borderRadius: 7, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" } as ViewStyle,
  pyNum: { width: 24, textAlign: "right", fontSize: 12, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.surface, borderWidth: 1, borderColor: KarateColors.border, borderRadius: KarateRadius.sm, paddingHorizontal: 12 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 14, color: KarateColors.ink, paddingVertical: 11 } as TextStyle,
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: KarateColors.surface, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 12 } as ViewStyle,
  nome: { fontSize: 14, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" } as ViewStyle,
  chipTxt: { fontSize: 11, fontWeight: "800" } as TextStyle,
  status: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 } as ViewStyle,
  statusOk: { backgroundColor: KarateColors.okSoft } as ViewStyle,
  statusPend: { backgroundColor: KarateColors.bg2 } as ViewStyle,
  statusTxt: { fontSize: 11, fontWeight: "700" } as TextStyle,
});
