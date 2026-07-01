// ============================================================
// CarteirinhaBatchTab — Aura Karatê (F5: impressão em lote)
//
// Nova sub-tab de Certificados: lista praticantes com carteirinha ATIVA
// (karateCardApi.listCards), busca simples, seleção via checkbox +
// "selecionar todos", e botão "Imprimir selecionadas (N)".
//
// Ao imprimir: busca os dados completos de cada carteirinha selecionada
// (karateCardApi.getCard, em paralelo) e monta um único documento HTML
// (buildCarteirinhaHtml) que abre via window.open — mesmo padrão/fallback
// de components/PrintLabels.tsx (blob URL, fallback document.write se popup
// bloqueado). Só disponível em web; em nativo, o botão fica desabilitado
// com aviso (impressão HTML é recurso do browser).
// ============================================================
import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { KarateColors as C, ShojiPalette as P, KarateRadius as R, KarateFonts as F } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { karateCardApi, CardListItem, MembershipCard } from "@/services/karateCardApi";
import { buildCarteirinhaHtml } from "@/components/karate/carteirinha/buildCarteirinhaHtml";

const PAGE_SIZE = 200;

export function CarteirinhaBatchTab() {
  const { federationId, federationName } = useKarateFederation();
  const isWeb = Platform.OS === "web";

  const [items, setItems] = useState<CardListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await karateCardApi.listCards(federationId, { status: "active", pageSize: PAGE_SIZE });
      setItems(res.data || []);
    } catch (err) {
      console.error("[CarteirinhaBatchTab] Falha ao listar carteirinhas:", err);
      setError("Não foi possível carregar as carteirinhas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const active = items.filter((i) => i.status === "active");
    if (!q) return active;
    return active.filter((i) =>
      (i.student_name || "").toLowerCase().includes(q) ||
      (i.dojo_name || "").toLowerCase().includes(q) ||
      (i.card_number || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.student_id));

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const ids = filtered.map((i) => i.student_id);
      const allSel = ids.every((id) => prev.has(id));
      if (allSel) {
        const n = new Set(prev);
        ids.forEach((id) => n.delete(id));
        return n;
      }
      return new Set([...Array.from(prev), ...ids]);
    });
  }

  async function handlePrint() {
    if (!isWeb) { toast.error("Impressão de carteirinhas disponível apenas na versão web"); return; }
    if (!federationId || selected.size === 0) { toast.error("Selecione ao menos uma carteirinha"); return; }

    setPrinting(true);
    setPrintProgress({ done: 0, total: selected.size });
    try {
      const ids = Array.from(selected);
      const cards: MembershipCard[] = [];
      const errors: string[] = [];

      // Busca em paralelo com progresso incremental (settle individual).
      await Promise.all(ids.map(async (studentId) => {
        try {
          const card = await karateCardApi.getCard(federationId, studentId);
          cards.push(card);
        } catch (err) {
          console.error("[CarteirinhaBatchTab] Falha ao buscar carteirinha", studentId, err);
          errors.push(studentId);
        } finally {
          setPrintProgress((prev) => prev ? { done: prev.done + 1, total: prev.total } : prev);
        }
      }));

      if (cards.length === 0) {
        toast.error("Não foi possível carregar os dados das carteirinhas selecionadas");
        return;
      }

      const html = buildCarteirinhaHtml(cards, { federationName });

      try {
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (!w) {
          const w2 = window.open("", "_blank");
          if (w2) { w2.document.write(html); w2.document.close(); }
          else { toast.error("Popup bloqueado — permita popups para app.getaura.com.br"); return; }
        }
        if (errors.length > 0) {
          toast.warning(cards.length + " carteirinha(s) abertas para impressão — " + errors.length + " falharam ao carregar");
        } else {
          toast.success(cards.length + " carteirinha(s) abertas para impressão");
        }
      } catch (err) {
        console.error("[CarteirinhaBatchTab] Erro ao abrir impressão:", err);
        toast.error("Erro ao gerar carteirinhas para impressão");
      }
    } finally {
      setPrinting(false);
      setPrintProgress(null);
    }
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text style={s.title}>Impressão em lote — Carteirinhas</Text>
          <Text style={s.hint}>Selecione os praticantes com carteirinha ativa. O documento é gerado em A4, várias carteirinhas por página.</Text>
        </View>
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

      {!isWeb && (
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
          <Icon name="ribbon" size={28} color={C.ink4} />
          <Text style={s.emptyText}>
            {items.length === 0 ? "Nenhuma carteirinha ativa encontrada" : "Nenhum resultado para essa busca"}
          </Text>
        </View>
      ) : (
        <ScrollView style={s.list} nestedScrollEnabled>
          {filtered.map((item) => {
            const sel = selected.has(item.student_id);
            return (
              <Pressable key={item.student_id} onPress={() => toggle(item.student_id)} style={[s.item, sel && s.itemSelected]}>
                <View style={[s.checkbox, sel && s.checkboxSelected]}>
                  {sel && <Icon name="check" size={10} color="#fff" />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.itemName} numberOfLines={1}>{item.student_name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }}>
                    <Text style={s.itemMeta} numberOfLines={1}>
                      {item.card_number || "sem nº"} · {item.dojo_name || "—"}
                    </Text>
                    {item.belt_name ? <Text style={s.beltBadge}>{item.belt_name}</Text> : null}
                    {item.is_minor ? <Text style={s.minorBadge}>Menor</Text> : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <Pressable
        onPress={handlePrint}
        style={[s.printBtn, (selected.size === 0 || printing || !isWeb) && { opacity: 0.5 }]}
        disabled={selected.size === 0 || printing || !isWeb}
      >
        {printing ? (
          <>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={s.printBtnText}>
              Preparando{printProgress ? " (" + printProgress.done + "/" + printProgress.total + ")" : "..."}
            </Text>
          </>
        ) : (
          <>
            <Icon name="download" size={16} color="#fff" />
            <Text style={s.printBtnText}>Imprimir selecionadas ({selected.size})</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  header: { backgroundColor: P.glass2, borderRadius: R.lg, padding: 16, borderWidth: 1, borderColor: C.border },
  title: { fontFamily: F.heading, fontSize: 16, fontWeight: "700", color: C.ink },
  hint: { fontFamily: F.body, fontSize: 11, color: C.ink3, marginTop: 4, lineHeight: 16 },
  toolbar: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  searchBox: { flex: 1, minWidth: 200, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.glass2, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontFamily: F.body, fontSize: 13, color: C.ink } as any,
  selectAllBtn: { backgroundColor: P.redWash, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border2 },
  selectAllText: { fontFamily: F.body, fontSize: 11, color: P.red, fontWeight: "600" },
  warnBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.warnWash, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.warn + "33" },
  warnBannerText: { fontFamily: F.body, fontSize: 11, color: C.warn, flex: 1 },
  list: { backgroundColor: P.glass2, borderRadius: R.lg, padding: 8, borderWidth: 1, borderColor: C.border, maxHeight: 520 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: R.sm, marginBottom: 3 },
  itemSelected: { backgroundColor: P.redWash, borderWidth: 1, borderColor: C.border2 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.border2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxSelected: { backgroundColor: P.red, borderColor: P.red },
  itemName: { fontFamily: F.body, fontSize: 13, color: C.ink, fontWeight: "600" },
  itemMeta: { fontFamily: F.mono, fontSize: 10.5, color: C.ink3 },
  beltBadge: { fontFamily: F.body, fontSize: 9, fontWeight: "700", color: C.ink2, backgroundColor: P.paper2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  minorBadge: { fontFamily: F.body, fontSize: 8, fontWeight: "700", color: C.warn, backgroundColor: P.warnWash, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 10, backgroundColor: P.glass2, borderRadius: R.lg, borderWidth: 1, borderColor: C.border },
  emptyText: { fontFamily: F.body, fontSize: 12.5, color: C.ink3, textAlign: "center", maxWidth: 320 },
  retryBtn: { marginTop: 4, backgroundColor: P.ink, borderRadius: R.sm, paddingVertical: 8, paddingHorizontal: 14 },
  retryBtnText: { fontFamily: F.body, fontSize: 12, fontWeight: "600", color: P.paperWarm },
  printBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: P.ink, borderRadius: R.md, paddingVertical: 14 },
  printBtnText: { fontFamily: F.body, fontSize: 14, color: "#fff", fontWeight: "700" },
});

export default CarteirinhaBatchTab;
