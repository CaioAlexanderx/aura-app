// ============================================================
// OpenItemsTab — Financeiro · Em aberto (Fase 5 → Correção 2)
//
// Duas correntes de cobrança SEGMENTADAS, nunca somadas num número só:
//   - Pretas em atraso (anuidade individual CPF — só faixa-preta ativa)
//   - Dojôs em atraso (taxa administrativa 2026)
//
// Correção 2 — a federação NÃO cobra 625 pretas uma a uma: ela cobra
// através do dojô/sensei. A lista de pretas agora é uma WORKLIST POR
// DOJÔ — um bloco por dojô (ordenado pelo maior valor em aberto = maior
// rombo primeiro), colapsado por padrão (só cabeçalho + subtotal),
// expandindo sob demanda. Cada bloco tem export CSV próprio e cada
// preta mostra o WhatsApp (link wa.me — abre a conversa, NÃO dispara
// mensagem automática).
//
// Wired: GET /federation/:id/financial/open-items (agora com dojo_id
// em cada item de pretas).
//
// "Preparar cobrança" apenas AGREGA a seleção local (contagem + valor).
// NÃO dispara e-mail nem qualquer ação irreversível — o disparo real do
// workflow de cobrança fica para uma fase futura. Isto é só a preparação.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Linking,
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
import { ShojiBackground, SectionHead, Card, KpiBand, ShojiButton } from "@/components/karate/shoji";
import { exportRowsToCsv } from "@/components/karate/saude-rede/shared";
import { karateApi, OpenItemsResponse, OpenItemPreta, OpenItemDojo } from "@/services/karateApi";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

// slug simples pro nome do arquivo CSV (sem dependências novas)
const slug = (s: string) =>
  (s || "dojo").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "dojo";

// WhatsApp: formata pra exibição e monta o link wa.me (sem `text=` — só
// abre a conversa, nunca dispara mensagem automática).
function fmtWhatsapp(raw: string | null): string {
  if (!raw) return "—";
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}
function waLink(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  const withCountry = d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
  return `https://wa.me/${withCountry}`;
}

// ── Agrupamento por dojô — DNA da cobrança real da federação ─────
interface DojoGroup {
  groupKey: string;
  dojoId: string | null;
  dojoName: string;
  items: OpenItemPreta[];
  subtotal: number;
}

function groupPretasByDojo(items: OpenItemPreta[]): DojoGroup[] {
  const map = new Map<string, DojoGroup>();
  for (const p of items) {
    const key = p.dojo_id || `sem-dojo:${p.dojo_nome || "indefinido"}`;
    let g = map.get(key);
    if (!g) {
      g = { groupKey: key, dojoId: p.dojo_id, dojoName: p.dojo_nome || "Dojô não identificado", items: [], subtotal: 0 };
      map.set(key, g);
    }
    g.items.push(p);
    g.subtotal += p.valor_em_aberto || 0;
  }
  // maior rombo primeiro
  return Array.from(map.values()).sort((a, b) => b.subtotal - a.subtotal);
}

export function OpenItemsTab({ federationId }: { federationId: string }) {
  const [data, setData]           = useState<OpenItemsResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPretas, setSelectedPretas] = useState<Set<string>>(new Set());
  const [selectedDojos, setSelectedDojos]   = useState<Set<string>>(new Set());
  const [expandedDojos, setExpandedDojos]   = useState<Set<string>>(new Set());
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

  const pretasItems = data?.pretas.items ?? [];
  const dojosItems  = data?.dojos.items ?? [];

  const dojoGroups = useMemo(() => groupPretasByDojo(pretasItems), [pretasItems]);

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
  const toggleDojoExpand = (groupKey: string) => {
    setExpandedDojos((prev) => {
      const next = new Set(prev);
      next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
      return next;
    });
  };

  const exportDojoCsv = (group: DojoGroup) => {
    exportRowsToCsv(
      `em_aberto_${slug(group.dojoName)}`,
      ["Nome", "Nº Registro", "WhatsApp", "Vencimento", "Valor"],
      group.items.map((p) => [
        p.full_name,
        p.karate_registration_number || "",
        p.whatsapp || "",
        fmtDate(p.annuity_due_date),
        fmt(p.valor_em_aberto),
      ])
    );
  };

  const exportAllCsv = () => {
    exportRowsToCsv(
      "em_aberto_pretas_geral",
      ["Nome", "Nº Registro", "Dojô", "WhatsApp", "Vencimento", "Valor"],
      pretasItems.map((p) => [
        p.full_name,
        p.karate_registration_number || "",
        p.dojo_nome || "",
        p.whatsapp || "",
        fmtDate(p.annuity_due_date),
        fmt(p.valor_em_aberto),
      ])
    );
  };

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

            {/* Pretas em atraso — WORKLIST POR DOJÔ (a federação cobra pelo
                dojô/sensei, não preta a preta). Blocos colapsados por padrão,
                ordenados pelo maior rombo primeiro. */}
            <View style={styles.section}>
              <SectionHead
                title="Pretas em atraso, por dojô (anuidade CPF)"
                sub="Faixas-pretas ativas com a anuidade individual vencida, agrupadas pelo dojô — é assim que a federação cobra."
                actions={
                  pretasItems.length > 0 ? (
                    <ShojiButton label="Exportar tudo" icon="download" variant="ghost" onPress={exportAllCsv} />
                  ) : undefined
                }
              />
              {dojoGroups.length === 0 ? (
                <Card flush>
                  <KarateEmptyState icon="check_circle" title="Nenhuma faixa-preta em atraso" style={{ paddingVertical: 32 }} />
                </Card>
              ) : (
                <View style={{ gap: 10 }}>
                  {dojoGroups.map((group) => (
                    <DojoBlock
                      key={group.groupKey}
                      group={group}
                      expanded={expandedDojos.has(group.groupKey)}
                      onToggleExpand={() => toggleDojoExpand(group.groupKey)}
                      onExportCsv={() => exportDojoCsv(group)}
                      selectedPretas={selectedPretas}
                      onTogglePreta={togglePreta}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Dojôs em atraso (taxa administrativa) — segunda corrente de
                cobrança, DISTINTA da anuidade das pretas. Nunca misturar. */}
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

// ── Bloco por dojô — cabeçalho (nome · N pretas · subtotal) colapsável,
// com export CSV próprio. Só renderiza as linhas quando expandido: com
// 625 pretas em ~100+ dojôs, expandir tudo de cara custaria caro à toa. ──
function DojoBlock({
  group, expanded, onToggleExpand, onExportCsv, selectedPretas, onTogglePreta,
}: {
  group: DojoGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  onExportCsv: () => void;
  selectedPretas: Set<string>;
  onTogglePreta: (id: string) => void;
}) {
  return (
    <Card flush>
      <View style={styles.dojoHeaderRow}>
        <TouchableOpacity
          style={styles.dojoHeaderMain}
          onPress={onToggleExpand}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${expanded ? "Recolher" : "Expandir"} dojô ${group.dojoName}`}
        >
          <Icon name={expanded ? "chevron_up" : "chevron_down"} size={16} color={C.ink3} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dojoName}>{group.dojoName}</Text>
            <Text style={styles.dojoMeta}>
              {group.items.length} preta{group.items.length !== 1 ? "s" : ""} · {fmt(group.subtotal)}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={onExportCsv}
          accessibilityRole="button"
          accessibilityLabel={`Exportar CSV do dojô ${group.dojoName}`}
        >
          <Icon name="download" size={13} color={C.ink3} />
          <Text style={styles.exportBtnLabel}>Exportar</Text>
        </TouchableOpacity>
      </View>
      {expanded && (
        <View style={styles.dojoBody}>
          {group.items.map((p, i) => (
            <RowPreta
              key={p.student_id}
              item={p}
              selected={selectedPretas.has(p.student_id)}
              onToggle={() => onTogglePreta(p.student_id)}
              last={i === group.items.length - 1}
            />
          ))}
        </View>
      )}
    </Card>
  );
}

function RowPreta({
  item, selected, onToggle, last,
}: { item: OpenItemPreta; selected: boolean; onToggle: () => void; last: boolean }) {
  const wa = waLink(item.whatsapp);
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <TouchableOpacity
        style={styles.rowMain}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`Selecionar ${item.full_name}`}
      >
        <Checkbox checked={selected} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowName}>{item.full_name}</Text>
          <Text style={styles.rowMeta}>
            {item.karate_registration_number || "—"} · Vencimento: {fmtDate(item.annuity_due_date)}
          </Text>
        </View>
        <Text style={styles.rowAmount}>{fmt(item.valor_em_aberto)}</Text>
      </TouchableOpacity>
      {wa ? (
        <TouchableOpacity
          style={styles.waBtn}
          onPress={() => Linking.openURL(wa)}
          accessibilityRole="link"
          accessibilityLabel={`Abrir WhatsApp de ${item.full_name}`}
        >
          <Icon name="whatsapp" size={14} color="#25D366" />
          <Text style={styles.waBtnLabel}>{fmtWhatsapp(item.whatsapp)}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.waMissing}>Sem WhatsApp</Text>
      )}
    </View>
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
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 } as ViewStyle,
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.line } as ViewStyle,
  rowName: { fontFamily: F.body, fontSize: 13.5, fontWeight: "600", color: C.ink } as TextStyle,
  rowMeta: { fontFamily: F.body, fontSize: 11.5, color: C.ink3 } as TextStyle,
  rowAmount: { fontFamily: F.mono, fontSize: 14, fontWeight: "700", color: C.ink } as TextStyle,
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.ink4, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" } as ViewStyle,
  checkboxChecked: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,

  // Bloco por dojô
  dojoHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: SP[6] } as ViewStyle,
  dojoHeaderMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 } as ViewStyle,
  dojoName: { fontFamily: F.body, fontSize: 14, fontWeight: "700", color: C.ink } as TextStyle,
  dojoMeta: { fontFamily: F.body, fontSize: 11.5, color: C.ink3, marginTop: 2 } as TextStyle,
  dojoBody: { borderTopWidth: 1, borderTopColor: C.line } as ViewStyle,
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: R.md, borderWidth: 1, borderColor: C.line2, backgroundColor: P.glass2 } as ViewStyle,
  exportBtnLabel: { fontFamily: F.body, fontSize: 11, fontWeight: "600", color: C.ink3 } as TextStyle,

  // WhatsApp
  waBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 9, borderRadius: R.md, backgroundColor: "rgba(37,211,102,0.1)", borderWidth: 1, borderColor: "rgba(37,211,102,0.3)" } as ViewStyle,
  waBtnLabel: { fontFamily: F.mono, fontSize: 11, fontWeight: "600", color: "#128C4A" } as TextStyle,
  waMissing: { fontFamily: F.body, fontSize: 11, color: C.ink4 } as TextStyle,

  prepareRow: { gap: 4, marginBottom: 12 } as ViewStyle,
  prepareLine: { fontFamily: F.body, fontSize: 13, color: C.ink2 } as TextStyle,
  prepareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: P.red, borderRadius: R.md, paddingVertical: 11, alignSelf: "flex-start", paddingHorizontal: 18 } as ViewStyle,
  prepareBtnLabel: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: "#fdf8f2" } as TextStyle,
  preparedNote: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 10, borderRadius: R.md, backgroundColor: "rgba(0,0,0,0.03)" } as ViewStyle,
  preparedText: { flex: 1, fontFamily: F.body, fontSize: 12, color: C.ink2 } as TextStyle,
});
