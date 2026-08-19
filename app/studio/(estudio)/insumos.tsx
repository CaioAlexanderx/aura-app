// ============================================================
// AURA STUDIO · Insumos / Matéria-prima + Fichas Técnicas
//
// Duas abas:
//   "Insumos"         — CRUD funcional de matérias-primas
//   "Fichas Técnicas" — Lista SOMENTE-LEITURA: produto + custo + margem.
//                       Tocar numa linha navega para /studio/estoque
//                       com ?action=edit-product&id=<pid>, onde o editor
//                       canônico (StudioFichaTecnicaPanel) vive.
//                       Nenhum caminho de escrita de ficha existe aqui.
//
// Deep-link: ?action=novo-insumo → abre NovoInsumoModal (depende de
// params.action, não só do mount — re-dispara em qualquer navegação com
// esse query param, param consumido via router.replace).
//
// Cadastro/edição: form inline eliminado (19/08/2026 QA) — CTA do header,
// empty state, linha da lista (editar) e deep-link do onboarding todos
// abrem o mesmo NovoInsumoModal (que agora também cobre edição).
// ============================================================
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { type StudioPalette } from "@/constants/studio-tokens";
import { studioApi, type StudioInput, type CompositionSummary } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { confirmAlert } from "@/utils/webAlert";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { StudioEmpty } from "@/components/studio/StudioEmpty";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { AnimatedKpiCounter } from "@/components/studio/AnimatedKpiCounter";
import NovoInsumoModal from "@/components/studio/NovoInsumoModal";

// ─── Semáforo de margem ───────────────────────────────────────────────────────
function marginColor(pct: number | null): string {
  if (pct == null) return "#94a3b8";
  if (pct >= 30) return "#22c55e";
  if (pct >= 10) return "#f59e0b";
  return "#ef4444";
}
function marginLabel(pct: number | null): string {
  if (pct == null) return "—";
  return pct.toFixed(1) + "%";
}

export default function StudioInsumos() {
  const { company } = useAuthStore();
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
  const router = useRouter();

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"insumos" | "fichas">("insumos");

  // ── Deep-link: ?action=novo-insumo abre modal ──────────────────────────────
  // QA item 9: antes o useEffect tinha deps [] (só no mount) — se a tela já
  // estivesse montada, clicar "Cadastrar insumo" no checklist não abria nada.
  // Agora depende de params.action e consome o param via router.replace,
  // então volta a disparar em toda navegação com esse query param.
  const params = useLocalSearchParams<{ action?: string }>();

  // ═══════════════════════════════════════════════════════════════════════════
  // ABA INSUMOS — estado e lógica
  // ═══════════════════════════════════════════════════════════════════════════
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<StudioInput[]>([]);
  // QA item 5: unificado — o form inline foi eliminado. openNew/openEdit
  // controlam o mesmo NovoInsumoModal usado pelo deep-link do onboarding.
  const [insumoModalOpen, setInsumoModalOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<StudioInput | null>(null);

  const load = useCallback(async () => {
    // QA item 12: early return sem setLoading(false) podia travar o skeleton
    // se company?.id nunca resolvesse.
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await studioApi.listInputs(company.id);
      setInputs(r.inputs || []);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar insumos");
    } finally { setLoading(false); }
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (params.action === "novo-insumo") {
      setEditingInsumo(null);
      setInsumoModalOpen(true);
      // Consome o param para não reabrir em re-renders/voltas de navegação
      router.replace("/studio/insumos" as any);
    }
  }, [params.action, router]);

  const lowStock = inputs.filter((i) => i.is_low_stock);

  function openNew() {
    setEditingInsumo(null);
    setInsumoModalOpen(true);
  }

  function openEdit(i: StudioInput) {
    setEditingInsumo(i);
    setInsumoModalOpen(true);
  }

  // QA item 4: exclusão sem confirmação — um toque errado apagava o insumo
  // (o ícone de lixeira fica a 14px do bloco de quantidade dentro da linha
  // clicável) e podia invalidar fichas técnicas/custo de produtos.
  function remove(i: StudioInput) {
    if (!company?.id) return;
    confirmAlert(
      "Remover insumo?",
      `"${i.name}" será removido. Fichas técnicas que usam esse insumo perdem essa referência de custo.`,
      "Remover",
      async () => {
        try {
          await studioApi.deleteInput(company.id!, i.id);
          toast.success("Insumo removido");
          load();
        } catch (e: any) { toast.error(e?.message || "Erro ao remover insumo"); }
      },
      { destructive: true }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ABA FICHAS TÉCNICAS — lista somente-leitura
  // Toque navega para o editor canônico em /studio/estoque
  // ═══════════════════════════════════════════════════════════════════════════
  const [fichasLoading, setFichasLoading] = useState(false);
  const [compositions, setCompositions] = useState<CompositionSummary[]>([]);
  const [fichasLoaded, setFichasLoaded] = useState(false);
  // QA item 10: erro no fetch virava empty state mentiroso ("Nenhuma ficha
  // técnica" pra quem tem 40) — agora tem estado de erro dedicado.
  const [fichasError, setFichasError] = useState<string | null>(null);

  const loadFichas = useCallback(async () => {
    if (!company?.id) return;
    setFichasLoading(true);
    setFichasError(null);
    try {
      const compRes = await studioApi.listCompositionsSummary(company.id);
      setCompositions(compRes.compositions || []);
      setFichasLoaded(true);
    } catch (e: any) {
      const msg = e?.message || "Erro ao carregar fichas técnicas";
      setFichasError(msg);
      toast.error(msg);
    } finally { setFichasLoading(false); }
  }, [company?.id]);

  // Carrega fichas apenas quando a aba é acessada pela 1ª vez
  useEffect(() => {
    if (activeTab === "fichas" && !fichasLoaded) {
      loadFichas();
    }
  }, [activeTab, fichasLoaded, loadFichas]);

  // Navega para o editor canônico de produto em Catálogo
  function navigateToProductEditor(productId: string) {
    router.push(`/studio/estoque?action=edit-product&id=${productId}` as any);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <StudioScreen variant="board" scroll={false} padded={false}>
      <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* Header */}
      <StudioPageHeader
        eyebrow="INSUMOS"
        title="Estoque do estúdio"
        subtitle="Controle o que você consome de verdade. Cada venda dá baixa nos insumos, não no produto-final."
        rightSlot={
          activeTab === "insumos" ? (
            <Pressable style={s.ctaPri} onPress={openNew}>
              <Icon name="plus" size={16} color="#fff" />
              <Text style={s.ctaPriTxt}>Novo insumo</Text>
            </Pressable>
          ) : null
        }
      />

      {/* Tab switcher */}
      <View style={s.tabRow}>
        <Pressable
          style={[s.tabBtn, activeTab === "insumos" && s.tabBtnActive]}
          onPress={() => setActiveTab("insumos")}
        >
          <Icon name="package" size={14} color={activeTab === "insumos" ? "#fff" : t.ink3} />
          <Text style={[s.tabBtnTxt, activeTab === "insumos" && s.tabBtnTxtActive]}>Insumos</Text>
        </Pressable>
        <Pressable
          style={[s.tabBtn, activeTab === "fichas" && s.tabBtnActive]}
          onPress={() => setActiveTab("fichas")}
        >
          <Icon name="clipboard-list" size={14} color={activeTab === "fichas" ? "#fff" : t.ink3} />
          <Text style={[s.tabBtnTxt, activeTab === "fichas" && s.tabBtnTxtActive]}>Fichas Técnicas</Text>
        </Pressable>
      </View>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ABA: INSUMOS                                          */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "insumos" && (
        <>
          {/* Alertas críticos */}
          {lowStock.length > 0 && (
            <View style={s.alertCard}>
              <View style={s.alertHead}>
                <View style={s.alertIco}>
                  <Icon name="alert-circle" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <AnimatedKpiCounter
                      value={lowStock.length}
                      style={{ fontSize: 28, fontWeight: "800", color: t.danger }}
                    />
                    <Text style={s.alertSub}>insumos abaixo do mínimo</Text>
                  </View>
                  <Text style={s.alertSub}>Pedido de reposição recomendado pra evitar parar produção</Text>
                </View>
              </View>
              <View style={s.alertList}>
                {lowStock.map((i) => (
                  <View key={i.id} style={s.alertRow}>
                    <Text style={s.alertRowName}>{i.name}</Text>
                    <Text style={s.alertRowQty}>
                      <Text style={{ color: t.danger, fontWeight: "800" }}>
                        {i.stock_qty} {i.unit}
                      </Text>
                      <Text> de {i.stock_min} mín.</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Celebration: nada crítico */}
          {!loading && inputs.length > 0 && lowStock.length === 0 && (
            <StudioEmpty
              emoji="✅"
              title="Nada crítico no estoque"
              desc="Todos seus insumos estão acima do mínimo."
              tone="celebration"
              compact
            />
          )}

          {/* Loading */}
          {loading && <StudioLoading variant="skeleton-list" rows={5} />}

          {/* Lista vazia */}
          {!loading && inputs.length === 0 && (
            <StudioEmpty
              icon="package"
              title="Sem insumos cadastrados"
              desc="Cadastre o que você usa pra produzir (tinta, papel, tecido…). Depois vincule aos produtos via composição."
              primaryCta={{ label: "Cadastrar insumo", onPress: () => openNew() }}
            />
          )}

          {/* Lista */}
          {!loading && inputs.length > 0 && (
            <View style={s.list}>
              {inputs.map((i) => (
                <Pressable key={i.id} style={[s.itemRow, i.is_low_stock && s.itemRowLow]} onPress={() => openEdit(i)}>
                  <View style={[s.itemDot, i.is_low_stock && { backgroundColor: t.danger }]}>
                    <Icon name="package" size={14} color={i.is_low_stock ? "#fff" : t.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.itemNameRow}>
                      <Text style={s.itemName} numberOfLines={1}>{i.name}</Text>
                      {i.is_low_stock && (
                        <View style={s.lowBadge}>
                          <Text style={s.lowBadgeTxt}>CRÍTICO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.itemMeta}>
                      R$ {Number(i.unit_cost).toFixed(2)} / {i.unit}
                      {i.supplier_name && <Text style={{ color: t.ink3 }}> · {i.supplier_name}</Text>}
                    </Text>
                  </View>
                  <View style={s.itemQtyBlock}>
                    <Text style={[s.itemQty, i.is_low_stock && { color: t.danger }]}>
                      {Number(i.stock_qty).toFixed(0)} {i.unit}
                    </Text>
                    {i.stock_min != null && (
                      <Text style={s.itemMin}>min {Number(i.stock_min).toFixed(0)}</Text>
                    )}
                  </View>
                  {/* QA item 4: separado do bloco de quantidade (borda + padding
                      próprios) pra reduzir toque acidental; exclusão agora sempre
                      passa por confirmAlert (destructive) antes de chamar a API. */}
                  <Pressable
                    onPress={(e: any) => { e?.stopPropagation?.(); remove(i); }}
                    style={s.delBtn}
                    hitSlop={10}
                    accessibilityLabel={`Remover ${i.name}`}
                  >
                    <Icon name="trash" size={14} color={t.ink4} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* ABA: FICHAS TÉCNICAS — somente-leitura                */}
      {/* Toque → navega pro editor canônico em Catálogo        */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeTab === "fichas" && (
        <>
          {/* Callout explicativo */}
          <View style={s.fichasHint}>
            <Icon name="info" size={14} color={t.infoInk ?? t.ink3} />
            <Text style={[s.fichasHintText, { color: t.infoInk ?? t.ink3 }]}>
              Toque numa ficha para editar no Catálogo. O editor canônico fica na tela de produto.
            </Text>
          </View>

          {/* Loading */}
          {fichasLoading && <StudioLoading variant="skeleton-list" rows={4} />}

          {/* QA item 10: erro dedicado — antes caía no empty state genérico
              ("Nenhuma ficha técnica" pra quem tem 40, se a request falhasse). */}
          {!fichasLoading && fichasError && (
            <StudioEmpty
              icon="alert-circle"
              title="Não foi possível carregar as fichas técnicas"
              desc={fichasError}
              tone="warning"
              primaryCta={{ label: "Tentar novamente", onPress: () => loadFichas() }}
            />
          )}

          {/* Lista vazia */}
          {!fichasLoading && !fichasError && compositions.length === 0 && (
            <StudioEmpty
              icon="clipboard-list"
              title="Nenhuma ficha técnica"
              desc="Crie fichas técnicas pelo Catálogo — abra um produto e expanda a seção Ficha Técnica."
              primaryCta={{
                label: "Ir para o Catálogo",
                onPress: () => router.push("/studio/estoque" as any),
              }}
            />
          )}

          {/* Lista de fichas — somente-leitura */}
          {!fichasLoading && !fichasError && compositions.length > 0 && (
            <>
              {/* Cabeçalho da lista */}
              <View style={s.listHeader}>
                <Text style={[s.listHeaderTxt, { flex: 2 }]}>Produto</Text>
                <Text style={[s.listHeaderTxt, { flex: 1, textAlign: "right" }]}>Custo</Text>
                <Text style={[s.listHeaderTxt, { flex: 1, textAlign: "right" }]}>Margem</Text>
                <Text style={[s.listHeaderTxt, { width: 60, textAlign: "right" }]}>Insumos</Text>
                <View style={{ width: 28 }} />
              </View>

              <View style={s.list}>
                {compositions.map((c) => (
                  <Pressable
                    key={c.composition_id}
                    style={s.fichaRow}
                    onPress={() => navigateToProductEditor(c.product_id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ficha de ${c.product_name} no Catálogo`}
                  >
                    <View style={[s.itemDot, { backgroundColor: t.primarySoft }]}>
                      <Icon name="clipboard-list" size={14} color={t.primary} />
                    </View>
                    <View style={{ flex: 2, minWidth: 0 }}>
                      <Text style={s.itemName} numberOfLines={1}>{c.product_name}</Text>
                      <Text style={s.itemMeta}>
                        Venda: R$ {Number(c.product_price).toFixed(2)}
                      </Text>
                    </View>
                    <Text style={[s.fichaCell, { flex: 1, textAlign: "right" }]}>
                      R$ {Number(c.total_cost).toFixed(2)}
                    </Text>
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text style={[s.fichaCell, { color: marginColor(c.margin_pct), fontWeight: "800" }]}>
                        {marginLabel(c.margin_pct)}
                      </Text>
                      <View style={[s.marginDot, { backgroundColor: marginColor(c.margin_pct), marginTop: 3 }]} />
                    </View>
                    <Text style={[s.fichaCell, { width: 60, textAlign: "right", color: t.ink3 }]}>
                      {c.item_count}
                    </Text>
                    <Icon name="chevron-right" size={14} color={t.ink4} />
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </>
      )}
      </ScrollView>

      {/* Modal novo/editar insumo — acessível via CTA, linha da lista (editar),
          deep-link do onboarding (novo) e checklist ("Cadastrar insumo"). */}
      <NovoInsumoModal
        visible={insumoModalOpen}
        companyId={company?.id || ""}
        editing={editingInsumo}
        onClose={() => setInsumoModalOpen(false)}
        onCreated={() => {
          // QA item 16: prepend otimista com objeto incompleto (sem stock_min,
          // supplier_name, is_low_stock) fazia o item recém-criado aparecer sem
          // alerta de estoque mínimo nem fornecedor. Recarrega a lista completa.
          load();
          setInsumoModalOpen(false);
        }}
        onUpdated={() => {
          load();
          setInsumoModalOpen(false);
        }}
      />
    </StudioScreen>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.bg },
  container: { padding: 28, paddingBottom: 60, maxWidth: 1000, alignSelf: "center", width: "100%" },

  // ─── Tab switcher ────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: "row", gap: 8, marginBottom: 20,
    borderBottomWidth: 1, borderBottomColor: t.ink5, paddingBottom: 12,
  },
  tabBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999,
    backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5,
  },
  tabBtnActive: { backgroundColor: t.primary, borderColor: t.primary },
  tabBtnTxt: { fontSize: 13, fontWeight: "700", color: t.ink3 },
  tabBtnTxtActive: { color: "#fff" },

  // ─── Buttons ─────────────────────────────────────────────────────────────
  ctaPri: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.primary, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
  ctaPriTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },

  // ─── Alert card ──────────────────────────────────────────────────────────
  alertCard: {
    backgroundColor: t.dangerSoft, borderWidth: 1, borderColor: t.danger,
    borderRadius: 18, padding: 18, marginBottom: 18,
  },
  alertHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  alertIco: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.danger, alignItems: "center", justifyContent: "center" },
  alertSub: { fontSize: 12, color: t.danger, marginTop: 2 },
  alertList: { gap: 8 },
  alertRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 10 },
  alertRowName: { fontSize: 13, fontWeight: "700", color: t.ink },
  alertRowQty: { fontSize: 12.5, color: t.ink2 },

  // ─── Lista insumos ────────────────────────────────────────────────────────
  list: { gap: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, backgroundColor: t.paperCard, borderRadius: 14, borderWidth: 1, borderColor: t.ink5 },
  itemRowLow: { borderColor: t.danger, backgroundColor: t.dangerSoft },
  itemDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.primarySoft, alignItems: "center", justifyContent: "center" },
  itemNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemName: { fontSize: 14, fontWeight: "700", color: t.ink, flexShrink: 1 },
  lowBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: t.danger },
  lowBadgeTxt: { fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  itemMeta: { fontSize: 12, color: t.ink3, marginTop: 2 },
  itemQtyBlock: { alignItems: "flex-end" },
  itemQty: { fontSize: 14, fontWeight: "800", color: t.ink, letterSpacing: -0.2 },
  itemMin: { fontSize: 11, color: t.ink4, marginTop: 1 },
  // QA item 4: lixeira separada do bloco de quantidade com borda + margem
  // própria (antes ficava a 14px, colada, dentro da mesma linha clicável).
  delBtn: {
    width: 34, height: 34, alignItems: "center", justifyContent: "center",
    marginLeft: 4, borderLeftWidth: 1, borderLeftColor: t.ink5, paddingLeft: 10,
  },

  // ─── Fichas: hint somente-leitura ────────────────────────────────────────
  fichasHint: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10,
    backgroundColor: t.infoSoft ?? t.bgSoft,
    marginBottom: 16,
  },
  fichasHintText: { fontSize: 12, fontWeight: "500", flex: 1, lineHeight: 17 },

  // ─── Fichas: lista resumo ────────────────────────────────────────────────
  listHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: t.ink5, marginBottom: 4 },
  listHeaderTxt: { fontSize: 10, fontWeight: "700", color: t.ink4, textTransform: "uppercase", letterSpacing: 0.4 },
  fichaRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, backgroundColor: t.paperCard, borderRadius: 14, borderWidth: 1, borderColor: t.ink5,
  },
  fichaCell: { fontSize: 13, color: t.ink2 },
  marginDot: { width: 8, height: 8, borderRadius: 4 },
});
