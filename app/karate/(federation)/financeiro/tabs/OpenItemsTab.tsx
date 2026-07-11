// ============================================================
// OpenItemsTab — Financeiro · Em aberto (Fase 5)
//
// Duas correntes de cobrança SEGMENTADAS, nunca somadas num número só:
//   - Pretas em atraso (anuidade individual CPF — só faixa-preta ativa)
//   - Dojôs em atraso (taxa administrativa 2026)
//
// Wired: GET /federation/:id/financial/open-items
//
// "Preparar cobrança" apenas AGREGA a seleção local (contagem + valor).
// NÃO dispara e-mail nem qualquer ação irreversível — o disparo real do
// workflow de cobrança fica para uma fase futura. Isto é só a preparação.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import {
  KarateColors as C,
  ShojiPalette as P,
  KarateRadius as R,
  KarateFonts as F,
  KarateSpacing as SP,
} from "@/constants/karateTheme";
import { Icon } from "@/components/Icon";
import { Skeleton } from "@/components/karate/Skeleton";
import { KarateErrorState } from "@/components/karate/ErrorState";
import { KarateEmptyState } from "@/components/karate/EmptyState";
import { ShojiBackground, SectionHead, Card, KpiBand } from "@/components/karate/shoji";
import { karateApi, OpenItemsResponse, OpenItemPreta, OpenItemDojo } from "@/services/karateApi";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

export function OpenItemsTab({ federationId }: { federationId: string }) {
  const [data, setData]           = useState<OpenItemsResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPretas, setSelectedPretas] = useState<Set<string>>(new Set());
  const [selectedDojos, setSelectedDojos]   = useState<Set<string>>(new Set());
  const [prepared, setPrepared]   = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(false);
    try {
      setData(await karateApi.getOpenItems(federationId));
    } catch {
      setError(true);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [federationId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ShojiBackground><KarateErrorState onRetry={() => load()} /></ShojiBackground>;

  const togglePreta = (id: string) => {
    setPrepared(false);
    setSelectedPretas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleDojo = (id: string) => {
    setPrepared(false);
    setSelectedDojos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pretasItems = data?.pretas.items ?? [];
  const dojosItems  = data?.dojos.items ?? [];
  const selectedPretasTotal = pretasItems
    .filter((p) => selectedPretas.has(p.student_id))
    .reduce((sum, p) => sum + (p.valor_em_aberto || 0), 0);
  const hasSelection = selectedPretas.size > 0 || selectedDojos.size > 0;

  return (
    <ShojiBackground>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={P.red} />}
      >
        {loading ? (
          <>
            <Skeleton height={100} style={{ marginBottom: 16, borderRadius: R.xl }} />
            <Skeleton height={220} style={{ borderRadius: R.xl }} />
          </>
        ) : (
          <>
            {/* Card de topo — totais SEGMENTADOS (nunca somados num só número) */}
            <KpiBand
              items={[
                {
                  label: "Pretas em atraso",
                  value: data?.pretas.count ?? 0,
                  meta: fmt(data?.pretas.total ?? 0),
                  accent: (data?.pretas.count ?? 0) > 0,
                },
                {
                  label: "Dojôs em atraso",
                  value: data?.dojos.count ?? 0,
                  accent: (data?.dojos.count ?? 0) > 0,
                },
              ]}
            />

            {/* Pretas em atraso (anuidade CPF) */}
            <View style={styles.section}>
              <SectionHead
                title="Pretas em atraso (anuidade CPF)"
                sub="Faixas-pretas ativas com a anuidade individual vencida."
              />
              <Card flush>
                {pretasItems.length === 0 ? (
                  <KarateEmptyState icon="check_circle" title="Nenhuma faixa-preta em atraso" style={{ paddingVertical: 32 }} />
                ) : (
                  pretasItems.map((p, i) => (
                    <RowPreta
                      key={p.student_id}
                      item={p}
                      selected={selectedPretas.has(p.student_id)}
                      onToggle={() => togglePreta(p.student_id)}
                      last={i === pretasItems.length - 1}
                    />
                  ))
                )}
              </Card>
            </View>

            {/* Dojôs em atraso (taxa administrativa) */}
            <View style={styles.section}>
              <SectionHead
                title="Dojôs em atraso (taxa administrativa)"
                sub="Dojôs filiados ativos sem a taxa do ano corrente paga."
              />
              <Card flush>
                {dojosItems.length === 0 ? (
                  <KarateEmptyState icon="check_circle" title="Nenhum dojô em atraso" style={{ paddingVertical: 32 }} />
                ) : (
                  dojosItems.map((d, i) => (
                    <RowDojo
                      key={d.dojo_id}
                      item={d}
                      selected={selectedDojos.has(d.dojo_id)}
                      onToggle={() => toggleDojo(d.dojo_id)}
                      last={i === dojosItems.length - 1}
                    />
                  ))
                )}
              </Card>
            </View>

            {/* Workflow de cobrança — só AGREGA a seleção. Não envia nada. */}
            {hasSelection && (
              <View style={styles.section}>
                <SectionHead
                  title="Preparar cobrança"
                  sub="Agrega a seleção atual. Nenhuma mensagem é enviada nesta etapa."
                />
                <Card>
                  <View style={styles.prepareRow}>
                    <Text style={styles.prepareLine}>
                      {selectedPretas.size} preta(s) selecionada(s)
                      {selectedPretas.size > 0 ? ` — ${fmt(selectedPretasTotal)}` : ""}
                    </Text>
                    <Text style={styles.prepareLine}>{selectedDojos.size} dojô(s) selecionado(s)</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.prepareBtn}
                    onPress={() => setPrepared(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Preparar cobrança"
                  >
                    <Icon name="send" size={14} color="#fdf8f2" />
                    <Text style={styles.prepareBtnLabel}>Preparar cobrança</Text>
                  </TouchableOpacity>
                  {prepared && (
                    <View style={styles.preparedNote}>
                      <Icon name="check_circle" size={14} color={C.ok} />
                      <Text style={styles.preparedText}>
                        Seleção preparada. O disparo de cobrança (e-mail/WhatsApp) será habilitado em uma fase futura.
                      </Text>
                    </View>
                  )}
                </Card>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ShojiBackground>
  );
}

function RowPreta({
  item, selected, onToggle, last,
}: { item: OpenItemPreta; selected: boolean; onToggle: () => void; last: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Selecionar ${item.full_name}`}
    >
      <Checkbox checked={selected} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowName}>{item.full_name}</Text>
        <Text style={styles.rowMeta}>
          {item.karate_registration_number || "—"} · {item.dojo_nome || "—"}
        </Text>
        <Text style={styles.rowMeta}>Vencimento: {fmtDate(item.annuity_due_date)}</Text>
      </View>
      <Text style={styles.rowAmount}>{fmt(item.valor_em_aberto)}</Text>
    </TouchableOpacity>
  );
}

function RowDojo({
  item, selected, onToggle, last,
}: { item: OpenItemDojo; selected: boolean; onToggle: () => void; last: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Selecionar ${item.nome}`}
    >
      <Checkbox checked={selected} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{item.nome}</Text>
      </View>
    </TouchableOpacity>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked ? <Icon name="check" size={12} color="#fdf8f2" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 40, paddingTop: 32, paddingBottom: 72, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
  section: { marginTop: SP[8] } as ViewStyle,
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: SP[6] } as ViewStyle,
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  rowName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  rowMeta: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,
  rowAmount: { fontFamily: F.mono, fontSize: 14, fontWeight: "700", color: C.ink } as TextStyle,
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.ink4, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" } as ViewStyle,
  checkboxChecked: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,
  prepareRow: { gap: 4, marginBottom: 12 } as ViewStyle,
  prepareLine: { fontFamily: F.body, fontSize: 13, color: C.ink2 } as TextStyle,
  prepareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: P.red, borderRadius: R.md, paddingVertical: 11, alignSelf: "flex-start", paddingHorizontal: 18 } as ViewStyle,
  prepareBtnLabel: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
  preparedNote: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 10, borderRadius: R.md, backgroundColor: "rgba(0,0,0,0.03)" } as ViewStyle,
  preparedText: { flex: 1, fontFamily: F.body, fontSize: 12, color: C.ink2 } as TextStyle,
});
