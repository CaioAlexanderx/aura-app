// ============================================================
// CarteirinhaQueue — Aura Karatê (sisteminha de gestão de impressão)
//
// Substitui o antigo sub-tab "Carteirinhas" de Certificados
// (CarteirinhaBatchTab, PR #386/F5) por uma tela própria com controle de
// estado de impressão. Desenho fechado com o Caio:
//
//   A imprimir -> Impressa -> Entregue   (só a federação confirma "Entregue")
//
// Regra central: o clique em "Imprimir selecionadas" move automaticamente
// para "Impressa" — mas isso NÃO é prova de que a impressão física saiu
// (o usuário pode cancelar o diálogo, faltar papel, etc.). Por isso toda
// carteirinha "Impressa" ou "Entregue" tem uma ação de volta ("Não saiu /
// reimprimir" e "Reimprimir", respectivamente) que devolve para "A
// imprimir" sem culpa — é isso que conserta o furo, não a detecção.
//
// Lote é o padrão: seleção múltipla + "Imprimir selecionadas" gera UMA
// folha A4 com N carteirinhas (buildCarteirinhaHtml, cartão CR80).
//
// Agrupamento por dojô: a federação entrega por dojô (manda o maço
// junto) — chips de dojô (com contagem da etapa atual) + agrupamento
// visual da lista por dojô quando "Todos" está selecionado.
//
// Ordenação ("gerado por último, visualizado primeiro", regra do Caio,
// vale nas três abas): cada aba ordena pelo timestamp que fez o cartão
// ENTRAR nessa etapa — issued_at em "A imprimir", printed_at em
// "Impressa", delivered_at em "Entregue" — mais recente no topo. Isso é
// feito no backend (listPrintQueue); aqui só preservamos a ordem ao
// agrupar por dojô.
//
// Histórico de vias: print_count (nº de vezes que a carteirinha foi de
// fato marcada como impressa) + printed_at formatam "3ª via — reimpressa
// em DD/MM/AAAA" (formatEventDateNumeric, tz-safe — NUNCA new Date(iso)
// direto, ver utils/eventDate.ts).
//
// Confirmação inline (Modal único, NUNCA aninhado): toda ação que muta —
// imprimir em lote, marcar entregue, devolver para a fila — pede
// confirmação antes. Mesmo padrão askConfirm/confirmDialog de
// CarteirinhaPanel.tsx (Modal transparent de nível único).
// ============================================================
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, TextInput, ActivityIndicator, Modal, ViewStyle, TextStyle } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { KarateButton } from "@/components/karate/KarateButton";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateCardApi, QueueItem, QueueListResult, PrintStatus, MembershipCard } from "@/services/karateCardApi";
import { buildCarteirinhaHtml } from "@/components/karate/carteirinha/buildCarteirinhaHtml";
import { formatEventDateNumeric } from "@/utils/eventDate";

const TABS: { id: PrintStatus; label: string; icon: string }[] = [
  { id: "to_print", label: "A imprimir", icon: "inbox" },
  { id: "printed", label: "Impressa", icon: "credit-card" },
  { id: "delivered", label: "Entregue", icon: "truck" },
];

type ConfirmDialog = { title: string; message: string; confirmLabel: string; onConfirm: () => void } | null;

function viaLabel(item: QueueItem): string {
  const n = item.print_count || 0;
  if (n <= 1) return "1ª via";
  const dateStr = item.printed_at ? formatEventDateNumeric(item.printed_at) : null;
  return dateStr ? `${n}ª via — reimpressa em ${dateStr}` : `${n}ª via`;
}

function stageDateLabel(tab: PrintStatus, item: QueueItem): string {
  if (tab === "delivered") return item.delivered_at ? `Entregue em ${formatEventDateNumeric(item.delivered_at)}` : "Entregue";
  if (tab === "printed") return item.printed_at ? `Impressa em ${formatEventDateNumeric(item.printed_at)}` : "Impressa";
  return item.issued_at ? `Gerada em ${formatEventDateNumeric(item.issued_at)}` : "Gerada";
}

export function CarteirinhaQueue() {
  const { federationId, federationName } = useKarateFederation();
  const isWeb = Platform.OS === "web";
  const params = useLocalSearchParams<{ tab?: string; dojo?: string }>();

  const initialTab: PrintStatus = (params.tab === "printed" || params.tab === "delivered") ? (params.tab as PrintStatus) : "to_print";

  const [tab, setTab] = useState<PrintStatus>(initialTab);
  const [dojoId, setDojoId] = useState<string | null>(typeof params.dojo === "string" ? params.dojo : null);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<QueueListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);

  const askConfirm = (title: string, message: string, confirmLabel: string, onConfirm: () => void) =>
    setConfirmDialog({ title, message, confirmLabel, onConfirm });

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await karateCardApi.listQueue(federationId, { print_status: tab, pageSize: 500 });
      setResult(res);
    } catch (err) {
      console.error("[CarteirinhaQueue] Falha ao carregar a fila:", err);
      setError("Não foi possível carregar a fila. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [federationId, tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected(new Set()); }, [tab]);

  const items = result?.data || [];

  const filtered = useMemo(() => {
    let out = items;
    if (dojoId) out = out.filter((i) => (i.dojo_id || "sem-dojo") === dojoId);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((i) =>
        (i.student_name || "").toLowerCase().includes(q) ||
        (i.card_number || "").toLowerCase().includes(q) ||
        (i.dojo_name || "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [items, dojoId, search]);

  // Agrupamento por dojô — preserva a ordem vinda do backend (mais
  // recente primeiro) dentro de cada grupo.
  const grouped = useMemo(() => {
    const map = new Map<string, QueueItem[]>();
    for (const it of filtered) {
      const key = it.dojo_name || "Sem dojô";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [filtered]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const ids = filtered.map((i) => i.id);
      const allSel = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSel) {
        const n = new Set(prev);
        ids.forEach((id) => n.delete(id));
        return n;
      }
      return new Set([...Array.from(prev), ...ids]);
    });
  }

  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  // ── Ações que mutam — todas passam por confirmação inline ──────
  async function doPrint(ids: string[]) {
    setBusyAction(true);
    try {
      const studentIds = ids.map((id) => byId.get(id)?.student_id).filter(Boolean) as string[];
      const cards: MembershipCard[] = [];
      const failed: string[] = [];
      await Promise.all(studentIds.map(async (sid) => {
        try { cards.push(await karateCardApi.getCard(federationId, sid)); }
        catch (err) { console.error("[CarteirinhaQueue] Falha ao buscar carteirinha", sid, err); failed.push(sid); }
      }));

      if (cards.length === 0) {
        toast.error("Não foi possível carregar os dados das carteirinhas selecionadas");
        return;
      }

      const html = buildCarteirinhaHtml(cards, { federationName });
      let opened = false;
      try {
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (w) {
          opened = true;
        } else {
          const w2 = window.open("", "_blank");
          if (w2) { w2.document.write(html); w2.document.close(); opened = true; }
        }
      } catch (err) {
        console.error("[CarteirinhaQueue] Erro ao abrir impressão:", err);
      }

      if (!opened) {
        toast.error("Popup bloqueado — permita popups para app.getaura.com.br. Nada foi marcado como impresso.");
        return;
      }

      // Só marca como impressa DEPOIS de conseguir abrir a folha — o
      // clique em "Imprimir" move automaticamente, mas só quando a folha
      // de fato foi produzida para o usuário.
      const res = await karateCardApi.markPrinted(federationId, ids);
      if (res.errors.length > 0) {
        toast.warning(`${res.ok.length} marcada(s) como impressa(s) — ${res.errors.length} com erro`);
      } else {
        toast.success(`${res.ok.length} carteirinha(s) marcadas como impressas`);
      }
      setSelected(new Set());
      load();
    } finally {
      setBusyAction(false);
    }
  }

  async function doDeliver(ids: string[]) {
    setBusyAction(true);
    try {
      const res = await karateCardApi.markDelivered(federationId, ids);
      if (res.errors.length > 0) {
        toast.warning(`${res.ok.length} marcada(s) como entregue(s) — ${res.errors.length} com erro`);
      } else {
        toast.success(`${res.ok.length} carteirinha(s) marcadas como entregues`);
      }
      setSelected(new Set());
      load();
    } finally {
      setBusyAction(false);
    }
  }

  async function doReturn(ids: string[]) {
    setBusyAction(true);
    try {
      const res = await karateCardApi.returnToQueue(federationId, ids);
      if (res.errors.length > 0) {
        toast.warning(`${res.ok.length} devolvida(s) para a fila — ${res.errors.length} com erro`);
      } else {
        toast.success(`${res.ok.length} carteirinha(s) devolvidas para "A imprimir"`);
      }
      setSelected(new Set());
      load();
    } finally {
      setBusyAction(false);
    }
  }

  function askPrint() {
    if (!isWeb) { toast.error("Impressão de carteirinhas disponível apenas na versão web"); return; }
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    askConfirm(
      "Imprimir selecionadas?",
      `${ids.length} carteirinha(s) serão marcadas como impressas e abertas numa folha para impressão. Se a impressão não sair de fato, use "Não saiu / reimprimir" depois — sem culpa.`,
      "Imprimir",
      () => doPrint(ids)
    );
  }

  function askDeliver() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    askConfirm(
      "Marcar como entregue?",
      `${ids.length} carteirinha(s) serão marcadas como entregues ao praticante. Confirme só depois de entregar de fato — essa etapa não tem volta automática.`,
      "Marcar entregue",
      () => doDeliver(ids)
    );
  }

  function askReturnBatch() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const fromDelivered = tab === "delivered";
    askConfirm(
      fromDelivered ? "Reimprimir selecionadas?" : "Não saiu / reimprimir?",
      fromDelivered
        ? `${ids.length} carteirinha(s) voltam para "A imprimir" (perdeu, rasgou ou trocou de faixa). O histórico de vias é preservado.`
        : `${ids.length} carteirinha(s) voltam para "A imprimir". Use quando a impressão não saiu de verdade (faltou papel, diálogo cancelado, etc.).`,
      fromDelivered ? "Reimprimir" : "Devolver para a fila",
      () => doReturn(ids)
    );
  }

  function askReturnOne(item: QueueItem) {
    const fromDelivered = tab === "delivered";
    askConfirm(
      fromDelivered ? `Reimprimir a carteirinha de ${item.student_name}?` : `"${item.student_name}" não saiu / reimprimir?`,
      fromDelivered
        ? "Volta para \"A imprimir\" (perdeu, rasgou ou trocou de faixa). O histórico de vias é preservado."
        : "Volta para \"A imprimir\". Use quando a impressão não saiu de verdade.",
      fromDelivered ? "Reimprimir" : "Devolver para a fila",
      () => doReturn([item.id])
    );
  }

  const counters = result?.counters || { to_print: 0, printed: 0, delivered: 0 };

  return (
    <View style={s.container}>
      {/* Contadores no topo */}
      <View style={s.countersBar}>
        <Text style={s.countersText}>
          <Text style={s.countersNum}>{counters.to_print}</Text> a imprimir · <Text style={s.countersNum}>{counters.printed}</Text> impressas · <Text style={s.countersNum}>{counters.delivered}</Text> entregues
        </Text>
      </View>

      {/* Abas de etapa */}
      <View style={s.tabBar}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[s.tab, tab === t.id && s.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id }}
          >
            <Icon name={t.icon} size={14} color={tab === t.id ? "#fff" : C.ink3} />
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
            <Text style={[s.tabCount, tab === t.id && s.tabCountActive]}>{counters[t.id]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Icon name="search" size={14} color={C.ink3} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por aluno, dojô ou nº de registro..."
            placeholderTextColor={C.ink3}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Icon name="x" size={12} color={C.ink3} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={toggleAll} style={s.selectAllBtn} disabled={filtered.length === 0}>
          <Text style={s.selectAllText}>{allSelected ? "Desmarcar" : "Selecionar"} todos ({filtered.length})</Text>
        </Pressable>
      </View>

      {/* Chips de dojô — agrupamento/filtro (a federação entrega por dojô) */}
      {(result?.dojos?.length || 0) > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dojoChipsRow}>
          <Pressable onPress={() => setDojoId(null)} style={[s.dojoChip, !dojoId && s.dojoChipActive]}>
            <Text style={[s.dojoChipText, !dojoId && s.dojoChipTextActive]}>Todos os dojôs</Text>
          </Pressable>
          {(result?.dojos || []).map((d) => {
            const key = d.dojo_id || "sem-dojo";
            const active = dojoId === key;
            return (
              <Pressable key={key} onPress={() => setDojoId(active ? null : key)} style={[s.dojoChip, active && s.dojoChipActive]}>
                <Text style={[s.dojoChipText, active && s.dojoChipTextActive]} numberOfLines={1}>{d.dojo_name} ({d.count})</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {!isWeb && tab === "to_print" && (
        <View style={s.warnBanner}>
          <Icon name="alert" size={14} color={C.warn} />
          <Text style={s.warnBannerText}>Impressão disponível apenas na versão web do Aura.</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={P.red} style={{ marginVertical: 32 }} />
      ) : error ? (
        <View style={s.emptyBox}>
          <Icon name="alert" size={28} color={C.ink4} />
          <Text style={s.emptyText}>{error}</Text>
          <Pressable onPress={load} style={s.retryBtn}>
            <Text style={s.retryBtnText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyBox}>
          <Icon name={TABS.find((t) => t.id === tab)?.icon || "inbox"} size={28} color={C.ink4} />
          <Text style={s.emptyText}>
            {items.length === 0 ? `Nenhuma carteirinha em "${TABS.find((t) => t.id === tab)?.label}"` : "Nenhum resultado para esse filtro"}
          </Text>
        </View>
      ) : (
        <ScrollView style={s.list} nestedScrollEnabled>
          {grouped.map(([dojoName, groupItems]) => (
            <View key={dojoName} style={s.dojoGroup}>
              <Text style={s.dojoGroupTitle}>{dojoName} · {groupItems.length}</Text>
              {groupItems.map((item) => {
                const sel = selected.has(item.id);
                return (
                  <Pressable key={item.id} onPress={() => toggle(item.id)} style={[s.item, sel && s.itemSelected]}>
                    <View style={[s.checkbox, sel && s.checkboxSelected]}>
                      {sel && <Icon name="check" size={10} color="#fff" />}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.itemName} numberOfLines={1}>{item.student_name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1, flexWrap: "wrap" }}>
                        <Text style={s.itemMeta} numberOfLines={1}>{item.card_number || "sem nº"}</Text>
                        <Text style={s.itemMetaSep}>·</Text>
                        <Text style={s.itemMeta} numberOfLines={1}>{stageDateLabel(tab, item)}</Text>
                        {item.belt_name ? <Text style={s.beltBadge}>{item.belt_name}</Text> : null}
                        {item.is_minor ? <Text style={s.minorBadge}>Menor</Text> : null}
                        {tab !== "to_print" ? <Text style={s.viaBadge}>{viaLabel(item)}</Text> : null}
                      </View>
                    </View>
                    {tab !== "to_print" && (
                      <Pressable
                        onPress={(e) => { e.stopPropagation?.(); askReturnOne(item); }}
                        style={s.rowActionBtn}
                        accessibilityRole="button"
                        accessibilityLabel={tab === "printed" ? "Não saiu / reimprimir" : "Reimprimir"}
                      >
                        <Icon name="refresh-cw" size={13} color={C.ink3} />
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Barra de ação — varia por etapa */}
      <View style={s.actionBar}>
        {tab === "to_print" && (
          <Pressable
            onPress={askPrint}
            style={[s.primaryBtn, (selected.size === 0 || busyAction || !isWeb) && s.btnDisabled]}
            disabled={selected.size === 0 || busyAction || !isWeb}
          >
            {busyAction ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="download" size={16} color="#fff" />}
            <Text style={s.primaryBtnText}>Imprimir selecionadas ({selected.size})</Text>
          </Pressable>
        )}
        {tab === "printed" && (
          <>
            <Pressable
              onPress={askReturnBatch}
              style={[s.secondaryBtn, (selected.size === 0 || busyAction) && s.btnDisabled]}
              disabled={selected.size === 0 || busyAction}
            >
              <Icon name="refresh-cw" size={15} color={C.ink2} />
              <Text style={s.secondaryBtnText}>Não saiu / reimprimir ({selected.size})</Text>
            </Pressable>
            <Pressable
              onPress={askDeliver}
              style={[s.primaryBtn, (selected.size === 0 || busyAction) && s.btnDisabled]}
              disabled={selected.size === 0 || busyAction}
            >
              {busyAction ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="check_circle" size={16} color="#fff" />}
              <Text style={s.primaryBtnText}>Marcar entregue ({selected.size})</Text>
            </Pressable>
          </>
        )}
        {tab === "delivered" && (
          <Pressable
            onPress={askReturnBatch}
            style={[s.secondaryBtn, (selected.size === 0 || busyAction) && s.btnDisabled]}
            disabled={selected.size === 0 || busyAction}
          >
            <Icon name="refresh-cw" size={15} color={C.ink2} />
            <Text style={s.secondaryBtnText}>Reimprimir selecionadas ({selected.size})</Text>
          </Pressable>
        )}
      </View>

      {/* Confirmação inline (Modal único, nunca aninhado) */}
      <Modal transparent visible={!!confirmDialog} animationType="fade" onRequestClose={() => setConfirmDialog(null)}>
        <View style={s.overlay}>
          <View style={s.confirmSheet}>
            <Text style={s.confirmTitle}>{confirmDialog?.title}</Text>
            <Text style={s.confirmMessage}>{confirmDialog?.message}</Text>
            <View style={s.confirmActions}>
              <KarateButton label="Cancelar" variant="ghost" size="md" onPress={() => setConfirmDialog(null)} style={{ flex: 1 }} disabled={busyAction} />
              <KarateButton
                label={confirmDialog?.confirmLabel || "Confirmar"}
                variant="primary"
                size="md"
                loading={busyAction}
                disabled={busyAction}
                onPress={() => { const cb = confirmDialog?.onConfirm; setConfirmDialog(null); cb && cb(); }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 } as ViewStyle,
  countersBar: { backgroundColor: P.glass2, borderRadius: R.lg, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border } as ViewStyle,
  countersText: { fontFamily: F.body, fontSize: 13, color: C.ink2 } as TextStyle,
  countersNum: { fontFamily: F.heading, fontWeight: "700", color: C.ink } as TextStyle,

  tabBar: { flexDirection: "row", gap: 6 } as ViewStyle,
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.border } as ViewStyle,
  tabActive: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,
  tabText: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600", color: C.ink2 } as TextStyle,
  tabTextActive: { color: "#fff" } as TextStyle,
  tabCount: { fontFamily: F.mono, fontSize: 11, fontWeight: "700", color: C.ink3 } as TextStyle,
  tabCountActive: { color: "#fff" } as TextStyle,

  toolbar: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" } as ViewStyle,
  searchBox: { flex: 1, minWidth: 200, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.glass2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: C.border } as ViewStyle,
  searchInput: { flex: 1, fontFamily: F.body, fontSize: 13, color: C.ink } as any,
  selectAllBtn: { backgroundColor: P.redWash, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border2 } as ViewStyle,
  selectAllText: { fontFamily: F.body, fontSize: 11, color: P.red, fontWeight: "600" } as TextStyle,

  dojoChipsRow: { flexDirection: "row", gap: 6, paddingVertical: 2 } as any,
  dojoChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: P.glass2, borderWidth: 1, borderColor: C.border } as ViewStyle,
  dojoChipActive: { backgroundColor: C.ink, borderColor: C.ink } as ViewStyle,
  dojoChipText: { fontFamily: F.body, fontSize: 11.5, color: C.ink2, fontWeight: "600" } as TextStyle,
  dojoChipTextActive: { color: "#fff" } as TextStyle,

  warnBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.warnWash, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.warn + "33" } as ViewStyle,
  warnBannerText: { fontFamily: F.body, fontSize: 11, color: C.warn, flex: 1 } as TextStyle,

  list: { backgroundColor: P.glass2, borderRadius: R.lg, padding: 8, borderWidth: 1, borderColor: C.border, maxHeight: 560 } as ViewStyle,
  dojoGroup: { marginBottom: 6 } as ViewStyle,
  dojoGroupTitle: { fontFamily: F.body, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: C.ink3, paddingHorizontal: 10, paddingVertical: 6 } as TextStyle,
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: R.sm, marginBottom: 3 } as ViewStyle,
  itemSelected: { backgroundColor: P.redWash, borderWidth: 1, borderColor: C.border2 } as ViewStyle,
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.border2, alignItems: "center", justifyContent: "center", flexShrink: 0 } as ViewStyle,
  checkboxSelected: { backgroundColor: P.red, borderColor: P.red } as ViewStyle,
  itemName: { fontFamily: F.body, fontSize: 13, color: C.ink, fontWeight: "600" } as TextStyle,
  itemMeta: { fontFamily: F.mono, fontSize: 10.5, color: C.ink3 } as TextStyle,
  itemMetaSep: { fontSize: 10.5, color: C.ink4 } as TextStyle,
  beltBadge: { fontFamily: F.body, fontSize: 9, fontWeight: "700", color: C.ink2, backgroundColor: P.paper2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" } as TextStyle,
  minorBadge: { fontFamily: F.body, fontSize: 8, fontWeight: "700", color: C.warn, backgroundColor: P.warnWash, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" } as TextStyle,
  viaBadge: { fontFamily: F.body, fontSize: 8.5, fontWeight: "700", color: P.red, backgroundColor: P.redWash, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" } as TextStyle,
  rowActionBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: P.paper2, flexShrink: 0 } as ViewStyle,

  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 10, backgroundColor: P.glass2, borderRadius: R.lg, borderWidth: 1, borderColor: C.border } as ViewStyle,
  emptyText: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, textAlign: "center", maxWidth: 320 } as TextStyle,
  retryBtn: { marginTop: 4, backgroundColor: P.ink, borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: 14 } as ViewStyle,
  retryBtnText: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: P.paperWarm } as TextStyle,

  actionBar: { flexDirection: "row", gap: 8 } as ViewStyle,
  primaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 14 } as ViewStyle,
  primaryBtnText: { fontFamily: F.body, fontSize: 14, color: "#fff", fontWeight: "700" } as TextStyle,
  secondaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", borderRadius: R.md, paddingVertical: 14, borderWidth: 1, borderColor: C.border2 } as ViewStyle,
  secondaryBtnText: { fontFamily: F.body, fontSize: 14, color: C.ink2, fontWeight: "700" } as TextStyle,
  btnDisabled: { opacity: 0.5 } as ViewStyle,

  overlay: { flex: 1, backgroundColor: "rgba(28,23,20,0.45)", alignItems: "center", justifyContent: "center", padding: 24 } as ViewStyle,
  confirmSheet: { width: "100%", maxWidth: 400, backgroundColor: P.paperWarm, borderRadius: R.lg, padding: 20, gap: 10 } as ViewStyle,
  confirmTitle: { fontFamily: F.heading, fontSize: 16, fontWeight: "800", color: C.ink } as TextStyle,
  confirmMessage: { fontFamily: F.body, fontSize: 13, color: C.ink2, lineHeight: 19 } as TextStyle,
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 6 } as ViewStyle,
});

export default CarteirinhaQueue;
