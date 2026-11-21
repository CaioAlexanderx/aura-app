import { useState, useRef, useMemo, useEffect } from "react";
import { tourTarget } from "@/utils/tourTarget";
import { useRouter } from "expo-router";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions } from "react-native";
import { Colors, useColors, useThemeStore } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { useProducts } from "@/hooks/useProducts";
import { useProductCategories } from "@/hooks/useProductCategories";
import { useCategories } from "@/hooks/useCategories";
import { expandirComDescendentes } from "@/utils/categoryFilter";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImportExportBar } from "@/components/ImportExportBar";
import { useImportProdutos } from "@/hooks/useImportProdutos";
import { ImportPlanilhaModal } from "@/components/screens/estoque/ImportPlanilhaModal";
// 17/11/2026 (A8): o menu "Importar" saiu da barra. A nota virou origem do
// "Chegou mercadoria" e a planilha, do "Cadastrar vários" (+ Produto) e da
// loja vazia. O componente ImportarMenu foi aposentado.
import { ChegouMercadoriaModal } from "@/components/screens/estoque/chegou/ChegouMercadoriaModal";
import { TEXTOS_CHEGOU } from "@/components/screens/estoque/chegou/textosChegou";
import { BaixarModelo } from "@/components/screens/estoque/BaixarModelo";
import { WebPortal } from "@/components/WebPortal";
import { ItemFormModal } from "@/components/screens/estoque/ItemFormModal";
import { ProductRow } from "@/components/screens/estoque/ProductRow";
import { AlertsList } from "@/components/screens/estoque/AlertsList";
import { PrintLabels } from "@/components/PrintLabels";
import { Pagination } from "@/components/Pagination";
import { ScrollableChips } from "@/components/ScrollableChips";
import { MergeDuplicatesModal } from "@/components/MergeDuplicatesModal";
import { ConferirNomesDeCor } from "@/components/screens/estoque/nomesDeCor/ConferirNomesDeCor";
import { QuickBatchProductsModal } from "@/components/QuickBatchProductsModal";
import { LinkProductModal } from "@/components/LinkProductModal";
import { usePagination } from "@/hooks/usePagination";
import { TABS, DEFAULT_CATEGORIES, fmt } from "@/components/screens/estoque/types";
import type { Product } from "@/components/screens/estoque/types";
import { arrayToCSV, downloadCSV, PRODUCT_COLUMNS } from "@/utils/csv";
import { productMatchesSearch } from "@/utils/productSearch";
import { resumoValorEstoque, legendaValorEstoque } from "@/utils/valorEstoque";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { pedidoLiberado } from "@/utils/pedidoLiberado";
import { companiesApi } from "@/services/api";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
// 19/10/2026 (tq-31): o Continuar do check-in e o "Fazer a primeira venda"
// chegam com ?novo=produto (abre o Novo item) e, no caminho da primeira
// venda, &depois=pdv (fechar depois de salvar leva ao Caixa).
import { depoisVaiAoCaixa, querNovoProduto, ROTA_CAIXA } from "@/utils/checkinDestino";
import { ConvitePlanilha } from "@/components/screens/estoque/ConvitePlanilha";
import { temProdutoQueryKey } from "@/hooks/useTemProduto";
import { Icon } from "@/components/Icon";
import { productLinksApi, type AggregatedProduct } from "@/services/productLinks";
// Sidebar-style premium components (Estoque v2 — 08/05/2026).
// Cada um vive em seu próprio arquivo pra manter este screen <50KB e
// permitir backtracking limpo. Todos web-only (Platform.OS check interno).
import { useEstoquePremiumStyles } from "@/components/screens/estoque/useEstoquePremiumStyles";
import { ScreenHero, ScreenTabs } from "@/components/ScreenHero";
import { pluralize } from "@/utils/plural";
import { OlhoValores } from "@/components/OlhoValores";
import { useValoresOcultos } from "@/stores/valoresOcultos";
import { EstoqueKpiStrip } from "@/components/screens/estoque/EstoqueKpiStrip";
import { CategoryDropdownWeb } from "@/components/screens/estoque/CategoryDropdownWeb";
import { ProductTableWeb } from "@/components/screens/estoque/ProductTableWeb";
import { ProductGridWeb } from "@/components/screens/estoque/ProductGridWeb";
// 22/09/2026 (Matcon M2, docs/CONTRACT_MATCON.md §M2): aviso fiscal do
// Estoque só liga com matcon_enabled + empresa emitindo nota fiscal.
import { readMatconSettings } from "@/constants/matcon";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { useVisibleModules } from "@/hooks/useVisibleModules";
// 30/10/2026: Estoque só consulta (utils/estoqueConsulta.ts). O que a pessoa
// não pode simplesmente some: nada de aviso de bloqueio ou de upgrade.
import { useEstoqueConsulta } from "@/hooks/useEstoqueConsulta";
// 03/11/2026 — entrada de mercadoria por fornecedor e vínculo em lote
// (docs/mockups/estoque-entrada-por-fornecedor.html, telas 1, 2, 6 e 9).
import { EntradaMercadoriaModal, type ProdutoDaEntrada } from "@/components/screens/estoque/EntradaMercadoriaModal";
import { DefinirFornecedorModal } from "@/components/screens/estoque/DefinirFornecedorModal";
import { ordemSemPreco, ordensSemPreco } from "@/utils/estoqueConsulta";
import { nfceApi } from "@/services/nfceApi";
// 23/09/2026 (QA producao, item 5): estoque consolidado (AggregatedView)
// usava "un" fixo e Math.round — errado pra produto fracionado (m², kg).
// 23/09/2026 (QA final Matcon): unidade no plural certo ("16 rolos").
import { fmtQty, qtdComUnidade, unidadeParaQuantidade } from "@/utils/matconUnits";
// 23/09/2026 (QA producao, item 10): "Ultimos adicionados" ordenava alfabetico.
// 23/09/2026: + A–Z / Z–A e a escolha lembrada no navegador (lerOrdemSalva).
import { ordenarProdutos, lerOrdemSalva, salvarOrdem, ORDENS_ESTOQUE, type OrdemEstoque } from "@/utils/productSort";
import { OrdenarBarra } from "@/components/screens/estoque/OrdenarBarra";
// 30/10/2026 (p-52): reajuste de preço em lote pela barra de seleção. O
// botão só aparece com o backend do reajuste no ar (Aura-backend#939).
import { AjustarPrecoModal } from "@/components/screens/estoque/reajuste/AjustarPrecoModal";
import { useReajusteDisponivel } from "@/hooks/useReajusteDisponivel";
// 03/11/2026: "Últimos reajustes" — lista dos reajustes da empresa ativa, com
// detalhe e desfazer por 7 dias (Aura-backend#940). Entrada discreta (link
// de texto abaixo das ações); some no Estoque só consulta, no demo, no
// consolidado, sem reajuste e com backend antigo (404).
import { UltimosReajustesModal } from "@/components/screens/estoque/reajuste/UltimosReajustesModal";
import { useUltimosReajustes, ultimosReajustesQueryKey } from "@/hooks/useUltimosReajustes";
// 10/11/2026 — NFS-e do serviço (docs/mockups/nfse-cadastro-servico.html,
// tela 2): selo "Falta código da NFS-e" e filtro rápido, só para quem emite.
import { useEmiteNfse } from "@/hooks/useEmiteNfse";
// 10/11/2026: transferir entre lojas do grupo + estoque por loja no
// consolidado. Abas e modais dentro do Estoque: reutilizam o mod "estoque"
// (mesma tela, mesma permissão), sem rota nova.
import { TransferirModal } from "@/components/screens/estoque/transferencia/TransferirModal";
import { TransferenciasModal } from "@/components/screens/estoque/transferencia/TransferenciasModal";
// 10/11/2026: "Organizar categorias" abre um modal dentro do Estoque, não
// mais a rota /catalogo/organizar (que caía no Painel ao voltar).
import { OrganizarCategoriasModal } from "@/components/screens/estoque/categorias/OrganizarCategoriasModal";
import { EstoquePorLoja } from "@/components/screens/estoque/transferencia/EstoquePorLoja";
import { BotaoTransferir } from "@/components/screens/estoque/transferencia/BotaoTransferir";
import { lojasDaTransferencia, plural as pluralQtd, textoDosNumeros } from "@/utils/transferenciaEstoque";
import { faltaCodigoNfse } from "@/utils/nfseServico";
import { vaiNaNfse } from "@/utils/notaDoItem";
import { avisoDoFiltroNfse, servicosSemCodigoNfse, SELO_FALTA_NFSE } from "@/components/screens/estoque/nfseNaLista";
// import { EstoqueRightRail } from "@/components/screens/estoque/EstoqueRightRail"; // Phase 2 — right rail

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

// 01/09/2026 (QA onda 2) — FIM DA DUPLICAÇÃO DO CABEÇALHO.
//
// O ScreenHero nasceu da extração deste cabeçalho (29/08), mas o EstoqueHero
// original continuou aqui e os dois coexistiram por três dias: qualquer ajuste
// no padrão precisava ser feito duas vezes, e a tela que TODAS as outras estão
// copiando era justamente a que não usava o componente compartilhado.
// Agora /estoque chama o ScreenHero como todo mundo e o arquivo antigo foi
// apagado. A saída na tela é a mesma: mesma sobrancelha, mesmo título, mesma
// frase, mesmas cores condicionais do alerta.
const fmtInt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const PAGE_SIZE = 20;
// Consolidado multi-CNPJ: o grupo não tem data de cadastro, então
// "Últimos adicionados" não se aplica ali — quem tinha essa escolha vê A–Z.
const ORDENS_CONSOLIDADO: readonly OrdemEstoque[] = ["name_asc", "name_desc", "price_desc", "price_asc", "low_stock"];
function ordemInicialConsolidado(): OrdemEstoque {
  const salva = lerOrdemSalva();
  return ORDENS_CONSOLIDADO.includes(salva) ? salva : "name_asc";
}
// Thresholds reativos pro layout split (table+rail). 1100px = mostra
// rail; 900px = mostra Table/Grid (abaixo cai pra ProductRow).
const RAIL_BREAKPOINT = 1100;
const TABLE_BREAKPOINT = 900;

function useScreenWidth(): number {
  const [w, setW] = useState(
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.innerWidth
      : Dimensions.get("window").width
  );
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

function SummaryCard({ label, value, color, sub, onPress }: { label: string; value: string; color?: string; sub?: string; onPress?: () => void }) {
  const [h, sH] = useState(false); const w = Platform.OS === "web";
  return <Pressable onPress={onPress} onHoverIn={w ? () => sH(true) : undefined} onHoverOut={w ? () => sH(false) : undefined}
    style={[s.card, h && { transform: [{ translateY: -2 }], borderColor: Colors.border2 }, w && { transition: "all 0.2s ease", cursor: onPress ? "pointer" : "default" } as any]}>
    <Text style={s.cardLabel}>{label}</Text>
    <Text style={[s.cardValue, color ? { color } : {}]}>{value}</Text>
    {sub && <Text style={s.cardSub}>{sub}</Text>}
  </Pressable>;
}


// ────────────────────────────────────────────────────────────
// MSL-06: View AGREGADA (modo "Todas as empresas")
// ────────────────────────────────────────────────────────────
function AggregatedView() {
  const [search, setSearch] = useState("");
  const { m } = useValoresOcultos();
  const { consulta } = useEstoqueConsulta();
  const [refreshKey, setRefreshKey] = useState(0);
  const [ordem, setOrdem] = useState<OrdemEstoque>(ordemInicialConsolidado);
  const trocarOrdem = (o: OrdemEstoque) => { setOrdem(o); salvarOrdem(o); };
  const ordemVista = consulta ? ordemSemPreco(ordem, "name_asc") : ordem;

  const { data, isLoading, error } = useQuery({
    queryKey: ["productsAggregated", refreshKey],
    queryFn: () => productLinksApi.aggregated(),
    staleTime: 30000,
  });

  const groups = data?.products || [];
  // 07/05/2026: usa productMatchesSearch pra paridade com Estoque single-company
  // e PDV (acentos normalizados, multi-termo AND, haystack consolidado).
  const filtered = useMemo(() => {
    if (!search) return groups;
    return groups.filter((g: AggregatedProduct) =>
      productMatchesSearch(
        {
          name: g.name,
          barcode: g.barcode,
          sku: g.sku,
          code: g.master_sku,
          category: g.category,
        },
        search
      )
    );
  }, [groups, search]);

  const ordenados = useMemo(
    () => ordenarProdutos(filtered, ordemVista, (g: AggregatedProduct) => ({
      id: g.group_key,
      name: g.name,
      price: g.avg_price,
      stock: g.total_stock,
    })),
    [filtered, ordemVista],
  );

  const linkedCount = groups.filter((g: AggregatedProduct) => g.is_linked).length;
  const totalUnits = groups.reduce((acc: number, g: AggregatedProduct) => acc + g.total_stock, 0);

  if (isLoading) return <ListSkeleton rows={4} showCards />;

  if (error) {
    return (
      <View style={agg.errorBox}>
        <Text style={agg.errorText}>Erro ao carregar produtos agregados.</Text>
        <Pressable onPress={() => setRefreshKey((k) => k + 1)} style={agg.retryBtn}>
          <Text style={agg.retryText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <View style={agg.banner}>
        <Icon name="bag" size={16} color="#7c3aed" />
        <View style={{ flex: 1 }}>
          <Text style={agg.bannerTitle}>Visão consolidada — todas suas empresas</Text>
          <Text style={agg.bannerDesc}>
            Estoque somado entre CNPJs vinculados via código mestre. Para editar produtos, troque para uma empresa específica no switcher.
          </Text>
        </View>
      </View>

      <View style={s.summaryRow}>
        <SummaryCard label="GRUPOS" value={String(groups.length)} sub={`${linkedCount} vinculados entre empresas`} />
        <SummaryCard label="UNIDADES TOTAIS" value={String(Math.round(totalUnits))} />
        <SummaryCard label="EMPRESAS" value={String(data?.searched_companies ?? 0)} />
      </View>

      <TextInput
        style={s.searchInput}
        placeholder="Buscar por nome, código mestre, SKU ou código de barras..."
        placeholderTextColor={Colors.ink3}
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }} contentContainerStyle={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
        <OrdenarBarra value={ordemVista} onChange={trocarOrdem} opcoes={consulta ? ordensSemPreco(ORDENS_CONSOLIDADO) : ORDENS_CONSOLIDADO} />
      </ScrollView>

      {filtered.length === 0 && (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 13, color: Colors.ink3 }}>
            {search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado em nenhuma empresa"}
          </Text>
        </View>
      )}

      <View style={s.listCard}>
        {ordenados.map((g: AggregatedProduct) => (
          <View key={g.group_key} style={agg.row}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={agg.nameLine}>
                <Text style={agg.name} numberOfLines={1}>{g.name}</Text>
                {g.is_linked && (
                  <View style={agg.linkedBadge}>
                    <Text style={agg.linkedBadgeText}>{"🔗 " + g.company_count + " CNPJs"}</Text>
                  </View>
                )}
              </View>
              <Text style={agg.meta}>
                {g.master_sku ? "Código: " + g.master_sku : (g.sku || g.barcode || "Sem código")}
                {g.category ? " · " + g.category : ""}
              </Text>
              {g.is_linked && (
                <View style={agg.itemsList}>
                  {g.items.map((item) => (
                    <View key={item.product_id} style={agg.itemChip}>
                      {/* 23/09/2026 (QA producao, item 5 — "un" fixo mesmo
                          quando o produto e vendido em m²/kg/etc.): usa a
                          unidade do grupo, com fmtQty pra nao truncar
                          estoque fracionado ("12,5 m²" em vez de "12"). */}
                      <Text style={agg.itemChipText}>
                        {item.company_name}: {qtdComUnidade(item.stock_qty, g.unit || "un")}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={agg.rightCol}>
              {/* 23/09/2026 (QA producao, item 5): fmtQty em vez de
                  Math.round — estoque fracionado (m², kg) nao pode virar
                  inteiro truncado. */}
              <Text style={agg.totalStock}>{fmtQty(g.total_stock)}</Text>
              <Text style={agg.totalStockLabel}>{unidadeParaQuantidade(g.total_stock, g.unit || "un")}</Text>
              {!consulta && <Text style={agg.price}>{m(fmt(g.avg_price))}</Text>}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const agg = StyleSheet.create({
  banner: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    backgroundColor: "#7c3aed12", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#7c3aed30", marginBottom: 16,
  },
  bannerTitle: { fontSize: 13, fontWeight: "700", color: Colors.ink },
  bannerDesc: { fontSize: 11, color: Colors.ink3, marginTop: 4, lineHeight: 16 },
  errorBox: { alignItems: "center", padding: 32, gap: 12 },
  errorText: { fontSize: 13, color: Colors.red },
  retryBtn: { backgroundColor: Colors.violet, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  row: {
    flexDirection: "row", gap: 12, paddingVertical: 14, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: "flex-start",
  },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontSize: 13, color: Colors.ink, fontWeight: "700", flexShrink: 1 },
  linkedBadge: {
    backgroundColor: "#7c3aed20", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: "#7c3aed40",
  },
  linkedBadgeText: { fontSize: 10, color: "#7c3aed", fontWeight: "700" },
  meta: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
  itemsList: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  itemChip: {
    backgroundColor: Colors.bg4, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  itemChipText: { fontSize: 10, color: Colors.ink3, fontWeight: "500" },
  rightCol: { alignItems: "flex-end", gap: 2, minWidth: 70 },
  totalStock: { fontSize: 18, fontWeight: "800", color: Colors.ink, lineHeight: 22 },
  totalStockLabel: { fontSize: 9, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.5 },
  price: { fontSize: 11, color: Colors.ink3, marginTop: 4 },
});

export default function EstoqueScreen() {
  useEstoquePremiumStyles();
  const { m } = useValoresOcultos();
  const { products, categories, isLoading, isDemo, deleteProduct, bulkDeleteProducts, mergeSuggestion, clearMergeSuggestion, updateProduct } = useProducts();
  // D2 (F0): `flattened` alimenta o filtro hierarquico. O vinculo de
  // categoria do produto recem-criado passou para o ItemFormModal.
  const { flattened: categoriasFlat } = useCategories();
  const { categoryNames: managedCategoryNames } = useProductCategories();
  const router = useRouter();
  const { company, availableCompanies, consolidatedView } = useAuthStore();
  // 17/11/2026 (Pedido, A4): "N reservado · X livres para vender" na linha.
  // Trava do Pedido (a mesma da aba Pedidos); desligada, a linha de sempre.
  const reservaLiberada = pedidoLiberado(useAuthStore(st => (st as any).user));
  // 18/10/2026 (card p-36): "mudar" o desenho da etiqueta leva a Configurações.
  const modulosVisiveis = useVisibleModules();
  const podeMudarDesenho = modulosVisiveis.has("configuracoes");
  // 11/11/2026 (p-108): "Conferir estoque" abre a conferência, que tem
  // módulo próprio (conferencia_estoque). No consolidado ela pergunta a loja.
  const podeConferir = modulosVisiveis.has("conferencia_estoque") && !isDemo;
  // 03/11/2026: semCusto = consulta OU funcionário sem retaguarda (custo,
  // margem e valor do estoque somem; preço e edição ficam).
  const { consulta, carregando: consultaCarregando, semCusto } = useEstoqueConsulta();
  // 22/09/2026 (Matcon M2): aviso fiscal (CEST) da aba Alertas. Loja sem o
  // módulo nunca lê nfce_config aqui — o aviso nem calcula (AlertsList).
  const { settings: pdvSettings } = usePdvSettings();
  const matcon = readMatconSettings(pdvSettings);
  const { data: nfceCfgEstoque } = useQuery({
    queryKey: ["nfce-config", company?.id],
    queryFn: () => nfceApi.getConfig(company!.id),
    enabled: !!company?.id && matcon.matcon_enabled && !consulta,
    staleTime: 300_000,
    retry: 1,
  });
  const emiteNotaEstoque = !!(nfceCfgEstoque as any)?.config?.is_active;
  // Multi-CNPJ: no consolidado (sem empresa selecionada) o aviso some —
  // código fiscal se resolve no cadastro de cada CNPJ.
  const matconFiscalOn = matcon.matcon_enabled && !consolidatedView && !!company?.id && !consulta;
  const qc = useQueryClient();
  const scrollRef = useRef<any>(null);
  const C = useColors();
  const { isDark } = useThemeStore();
  const screenW = useScreenWidth();
  // Web-wide habilita Hero + KpiStrip + Table/Grid + multi-select cat.
  // Em narrow web ou native, mantém o layout antigo (compat 100%).
  const isWebWide = Platform.OS === "web" && screenW > TABLE_BREAKPOINT;
  const isMobileNarrow = Platform.OS === "web" && screenW < 500;
  const showRailDefault = Platform.OS === "web" && screenW >= RAIL_BREAKPOINT;

  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  // catFilter: single-select chip (narrow). catsMulti: dropdown (wide).
  // effectiveCats abaixo combina os dois.
  const [catFilter, setCatFilter] = useState("Todos");
  const [catsMulti, setCatsMulti] = useState<string[]>([]);
  // 10/11/2026: filtro rápido "Falta código da NFS-e".
  const [soFaltaNfse, setSoFaltaNfse] = useState(false);
  const [view, setView] = useState<"table" | "grid">("table");
  const [showRail, setShowRail] = useState(true);
  // 09/09/2026: os dois formulários viraram UM formulário aberto
  // (ItemFormModal, que substituiu o wizard de 3 passos). `formOpen` +
  // `formType` + `editProduct` substituem showAddForm/showServiceForm.
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<"product" | "service">("product");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [labelSelection, setLabelSelection] = useState<string[]>([]);

  const [bulkMode, setBulkMode] = useState(false);
  // Entrada de mercadoria de UM produto (o "Entrada" da linha, pendência 9).
  const [entrada, setEntrada] = useState<{ produto: ProdutoDaEntrada | null } | null>(null);
  const [definirFornecedor, setDefinirFornecedor] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  // p-52: quem já pode mexer no produto (mesmo gate do Selecionar/editar:
  // fora do demo, com a permissão do Estoque que abre esta tela).
  const reajusteNoAr = useReajusteDisponivel(company?.id, !isDemo && !consolidatedView);
  const [reajusteAberto, setReajusteAberto] = useState(false);
  const temUltimosReajustes = useUltimosReajustes(company?.id, !isDemo && !consolidatedView && !consulta && !consultaCarregando);
  const [ultimosAberto, setUltimosAberto] = useState(false);
  // p-53: "Reimprimir etiquetas" abre a aba Etiquetas com os reajustados marcados.
  const [etiquetasDoReajuste, setEtiquetasDoReajuste] = useState<string[] | undefined>(undefined);

  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  // E2 (17/11/2026): a lista aberta pelo "Cadastrar vários" do "+ Produto"
  // ganha "← Voltar" para a escolha; voltar reabre o cadastro já nela.
  const [listaComVoltar, setListaComVoltar] = useState(false);
  const [formEmVarios, setFormEmVarios] = useState(false);
  // A8 (17/11/2026): o "Chegou mercadoria" (wizard da Fase 3). Montado só
  // enquanto aberto: cada abertura nasce com a sua idempotency_key.
  const [chegouAberto, setChegouAberto] = useState(false);
  // 22/09/2026: botão "Importar planilha" na barra de ações — antes o
  // ServerImport só aparecia no estado vazio (0 produtos), então quem já
  // tinha itens cadastrados não achava como importar mais. Mesmo fluxo do
  // ServerImport (useServerImport), mesmo gate de plano/permissão do
  // "Importar DANFE" (!isDemo).
  // 23/09/2026 (QA): a planilha agora passa por uma conferência antes de
  // gravar e termina num relatório (ImportPlanilhaModal). Um controlador
  // só, usado pelo menu "Importar" da barra e pelo estado vazio.
  const importPlanilha = useImportProdutos(handleImportComplete);

  // Scanner popup: TextInput inline simples (sem ScannerInput pra evitar
  // conflitos de auto-focus + overlay). Foco é dado via ref.focus() quando
  // o popup abre. Ao bipar (Enter) ou clicar Aplicar, joga no search.
  const [scanOpen, setScanOpen] = useState(false);
  const [scanText, setScanText] = useState("");
  const scanRef = useRef<any>(null);
  const scanInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!scanOpen || Platform.OS !== "web") return;
    function onDoc(e: MouseEvent) {
      if (scanRef.current && !scanRef.current.contains(e.target)) {
        setScanOpen(false);
        setScanText("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [scanOpen]);

  // Auto-focus quando popup abre — pequeno timeout pra esperar o render.
  useEffect(() => {
    if (!scanOpen) return;
    const t = setTimeout(() => {
      scanInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [scanOpen]);

  // Abre MergeDuplicatesModal automaticamente se backend retornou merge_suggestion
  useEffect(() => {
    if (mergeSuggestion) setShowMergeModal(true);
  }, [mergeSuggestion]);

  const [linkTarget, setLinkTarget] = useState<Product | null>(null);
  // Escolha lembrada no navegador (chave só desta tela); sem nada salvo ou
  // sem localStorage, "Últimos adicionados".
  const [sortOrder, setSortOrderState] = useState<OrdemEstoque>(lerOrdemSalva);
  const setSortOrder = (o: OrdemEstoque) => { setSortOrderState(o); salvarOrdem(o); };
  const hasMultipleCnpjs = (availableCompanies?.length || 0) >= 2;
  const canLinkProducts = hasMultipleCnpjs && !consolidatedView && !!company?.id && !consulta;
  // 10/11/2026: transferir entre lojas — só numa loja específica (nunca no
  // consolidado), com outra loja do grupo que o usuário acessa.
  const lojasTransferencia = lojasDaTransferencia(availableCompanies, company?.id, {
    consolidado: consolidatedView, consulta, demo: isDemo, nomeAtual: company?.name,
  });
  const podeTransferir = !!lojasTransferencia;
  const [transferirAberto, setTransferirAberto] = useState(false);
  const [transferenciasAberto, setTransferenciasAberto] = useState(false);
  const [organizarAberto, setOrganizarAberto] = useState(false);
  // As mutações da árvore já invalidam ["categories"] e ["products"]; os
  // nomes do filtro (chips e dropdown) vêm de ["product-categories"], que
  // elas não tocam. Ao fechar, recarrega tudo o que o filtro usa.
  function fecharOrganizar() {
    setOrganizarAberto(false);
    qc.invalidateQueries({ queryKey: ["product-categories", company?.id] });
    qc.invalidateQueries({ queryKey: ["categories", company?.id] });
    qc.invalidateQueries({ queryKey: ["products", company?.id] });
  }
  const [visaoConsolidado, setVisaoConsolidado] = useState<"somado" | "por_loja">("somado");

  const { data: dupGroupsData, refetch: refetchDupGroups } = useQuery({
    queryKey: ["duplicateGroups", company?.id],
    queryFn: () => companiesApi.duplicateGroups(company!.id),
    enabled: !!company?.id && !isDemo && !consolidatedView && !consulta && !consultaCarregando,
    staleTime: 60000,
  });
  const dupGroupsCount = ((dupGroupsData as any)?.groups?.length || 0);

  const allCategories = useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_CATEGORIES,
      ...managedCategoryNames,
      ...categories,
      ...products.map(p => p.category),
    ])).filter(Boolean);
  }, [managedCategoryNames, categories, products]);

  const filterCategories = ["Todos", ...allCategories];

  // effectiveCats: combina single (catFilter) + multi (catsMulti).
  // Wide usa o multi-select. Narrow usa o single-chip antigo.
  // Vazio = "Todos".
  const effectiveCats = useMemo<string[]>(() => {
    const escolhidas = isWebWide ? catsMulti : (catFilter === "Todos" ? [] : [catFilter]);
    return expandirComDescendentes(escolhidas, categoriasFlat);
  }, [isWebWide, catsMulti, catFilter, categoriasFlat]);

  // 07/05/2026: paridade com PDV via utils/productSearch — fix bug Davi.
  // Antes a busca falhava em três cenários reportados:
  //   - acentos no nome ("tenis" não achava "Tênis")
  //   - ordem de palavras invertida ("preto activita" vs "Activita ... Preto")
  //   - busca por marca/cor/tamanho/categoria (campos não cobertos)
  // Agora normalizeText + tokenização AND + haystack consolidado resolvem
  // os três (mesma lógica que o PDV já usava e o Davi confirmou funcional).
  // 10/11/2026 (NFS-e do serviço): a config de NFS-e só é lida quando há
  // serviço na lista — loja só de produtos não faz requisição nova.
  // 10/11/2026 (migration 442): "serviço" aqui é item que sai na NFS-e —
  // também o produto com "Sai em: Nota de serviço" (utils/notaDoItem).
  const temServico = useMemo(() => products.some(vaiNaNfse), [products]);
  const emiteNfseEstoque = useEmiteNfse(temServico && !isDemo && !consulta);
  const semCodigoNfse = useMemo(() => servicosSemCodigoNfse(products, emiteNfseEstoque), [products, emiteNfseEstoque]);
  // Resolvidos todos, o filtro se desliga sozinho (o chip some junto).
  const filtroNfseAtivo = soFaltaNfse && semCodigoNfse.length > 0;

  const filtered = useMemo(() => {
    const q = (search || "").trim();
    return products.filter(p => {
      const matchSearch = productMatchesSearch(p, q);
      const matchCat = effectiveCats.length === 0 || effectiveCats.includes(p.category);
      const matchNfse = !filtroNfseAtivo || faltaCodigoNfse(p, true);
      return matchSearch && matchCat && matchNfse;
    });
  }, [products, search, effectiveCats, filtroNfseAtivo]);

  const ordemVista = consulta ? ordemSemPreco(sortOrder, "recent") : sortOrder;
  const sorted = useMemo(() => ordenarProdutos(filtered, ordemVista), [filtered, ordemVista]);

  // Pagination key inclui catsMulti pra resetar página quando user
  // troca categorias no wide layout (multi-select dropdown).
  const { paginated, page, totalPages, total: filteredTotal, goTo } = usePagination(sorted, PAGE_SIZE, search + catFilter + catsMulti.join(",") + sortOrder + (filtroNfseAtivo ? "|nfse" : ""));
  const lowStock = products.filter(p => p.stock <= p.minStock && p.unit !== "srv");
  const valorEstoque = resumoValorEstoque(products);
  const totalItems = products.reduce((acc, p) => acc + p.stock, 0);
  const serviceCount = products.filter(p => p.category === "Servicos" || p.unit === "srv").length;

  // 09/09/2026: o modal cuida de tudo num Salvar só (POST/PATCH +
  // vínculo de categoria + PUT /variations + fila de fotos). A tela só
  // abre, fecha e recarrega o que depende da lista.
  // ?novo=produto: abre o cadastro na chegada. `depois=pdv` vale só para
  // esse cadastro: fechar sem salvar fica no Estoque. O parâmetro NÃO é
  // limpo no mount (montagem dupla: a segunda montagem, a visível, precisa
  // ainda vê-lo); sai da URL quando a pessoa fecha o cadastro. O setParams
  // com undefined vira "undefined", que querNovoProduto rejeita.
  // ?importar=planilha: ConvitePlanilha (mesmo cuidado, mais a marca de sessão).
  const params = useLocalSearchParams<{ novo?: string; depois?: string; importar?: string }>();
  const caixaDepoisRef = useRef(false);
  const salvouRef = useRef(false);
  const veioPeloParamRef = useRef(false);
  useEffect(() => {
    if (!querNovoProduto(params.novo) || consolidatedView || consulta || consultaCarregando) return;
    veioPeloParamRef.current = true;
    caixaDepoisRef.current = depoisVaiAoCaixa(params.depois);
    salvouRef.current = false;
    abrirCadastro("product");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.novo, consultaCarregando]);

  function abrirCadastro(tipo: "product" | "service", prod?: Product | null, naEscolhaDeVarios = false) {
    if (consulta) return;
    setFormEmVarios(naEscolhaDeVarios && !prod && tipo === "product");
    setEditProduct(prod || null);
    setFormType(prod ? (prod.unit === "srv" ? "service" : "product") : tipo);
    setFormOpen(true);
    setActiveTab(0);
  }

  function fecharCadastro() {
    setFormOpen(false);
    setEditProduct(null);
    const irAoCaixa = caixaDepoisRef.current && salvouRef.current;
    caixaDepoisRef.current = false;
    salvouRef.current = false;
    if (veioPeloParamRef.current) {
      veioPeloParamRef.current = false;
      try { router.setParams({ novo: undefined, depois: undefined } as any); } catch {}
    }
    if (irAoCaixa) router.push(ROTA_CAIXA as any);
  }

  // ── E2: "Cadastrar vários" (faixa do "+ Produto") ────────
  function abrirLista(comVoltar: boolean) {
    setListaComVoltar(comVoltar);
    setShowBatchModal(true);
  }
  function listaPeloCadastro() {
    fecharCadastro();
    abrirLista(true);
  }
  function voltarDaLista() {
    setShowBatchModal(false);
    setListaComVoltar(false);
    abrirCadastro("product", null, true);
  }
  // A planilha abre o seletor de arquivo de hoje. O cadastro só fecha quando
  // a importação abre de fato (arquivo escolhido): cancelar o seletor deixa
  // a pessoa na escolha, onde estava.
  const planilhaPeloCadastroRef = useRef(false);
  useEffect(() => {
    if (!importPlanilha.aberto) return;
    if (planilhaPeloCadastroRef.current && formOpen) fecharCadastro();
    planilhaPeloCadastroRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importPlanilha.aberto]);
  // ── A8: "Chegou mercadoria" ──────────────────────────────
  // A entrada é sempre de UMA loja: some no consolidado (que nem tem barra),
  // no demo e no Estoque só consulta. Aparece também com a loja vazia: com a
  // nota, o wizard cadastra o que faltar.
  const podeChegou = !isDemo && !consolidatedView && !consulta && !!company?.id;
  function abrirChegou() {
    if (!podeChegou) return;
    setChegouAberto(true);
  }
  function chegouPeloCadastro() {
    fecharCadastro();
    abrirChegou();
  }
  function aposChegou() {
    qc.invalidateQueries({ queryKey: temProdutoQueryKey(company?.id) });
    setTimeout(() => refetchDupGroups(), 500);
  }
  // "Ver os produtos novos" do Pronto: a lista volta ao começo, sem busca nem
  // filtro, em "Últimos adicionados" (sem trocar a ordem salva da pessoa).
  function verNovosDoChegou() {
    setChegouAberto(false);
    setSearch("");
    setCatFilter("Todos");
    setCatsMulti([]);
    setSoFaltaNfse(false);
    setSortOrderState("recent");
    handleTabSelect(0);
  }

  const acoesCadastrarVarios = !isDemo && !consolidatedView && !consulta ? {
    onPlanilha: () => { planilhaPeloCadastroRef.current = true; importPlanilha.escolherArquivo(); },
    onLista: listaPeloCadastro,
    planilhaOcupada: importPlanilha.ocupado,
    abrirNaEscolha: formEmVarios,
    onChegou: podeChegou ? chegouPeloCadastro : undefined,
  } : undefined;

  function aposSalvarItem() {
    salvouRef.current = true;
    qc.invalidateQueries({ queryKey: ["products", company?.id] });
    qc.invalidateQueries({ queryKey: temProdutoQueryKey(company?.id) });
    setTimeout(() => refetchDupGroups(), 500);
  }

  function handleEdit(product: Product) {
    abrirCadastro(product.unit === "srv" ? "service" : "product", product);
  }

  function handleTabSelect(i: number) { setActiveTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  function applyScan() {
    const cleaned = (scanText || "").trim();
    if (!cleaned) return;
    setSearch(cleaned);
    setScanOpen(false);
    setScanText("");
    // Feedback rápido se for match único
    setTimeout(() => {
      const matches = products.filter(p =>
        (p as any).barcode === cleaned ||
        (p as any).sku === cleaned ||
        p.code === cleaned
      );
      if (matches.length === 1) {
        toast.success(matches[0].name);
      } else if (matches.length === 0) {
        toast.info("Nenhum produto com esse código. Mostrando busca textual.");
      }
    }, 50);
  }

  function handleExport() {
    if (products.length === 0) { toast.error("Nenhum produto para exportar"); return; }
    downloadCSV(arrayToCSV(products, PRODUCT_COLUMNS), `aura_estoque_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function handleImportComplete() {
    qc.invalidateQueries({ queryKey: ["products", company?.id] });
    refetchDupGroups();
  }

  function toggleBulkSelect(id: string) {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    if (bulkSelected.size === filtered.length) setBulkSelected(new Set());
    else setBulkSelected(new Set(filtered.map(p => p.id)));
  }

  function exitBulkMode() { setBulkMode(false); setBulkSelected(new Set()); }

  function paraEntrada(p: Product): ProdutoDaEntrada {
    return { id: p.id, name: p.name, stock: p.stock, cost: p.cost ?? null, price: p.price, unit: p.unit, has_variants: !!(p as any).has_variants };
  }
  function abrirEntrada(p: Product) { setEntrada({ produto: paraEntrada(p) }); }

  async function handleBulkDelete() {
    await bulkDeleteProducts(Array.from(bulkSelected));
    exitBulkMode();
    refetchDupGroups();
  }

  if (consultaCarregando) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <ListSkeleton rows={4} showCards />
      </ScrollView>
    );
  }

  if (consolidatedView) {
    return (
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={visaoConsolidado === "por_loja" && isWebWide ? s.contentWide : s.content}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>Estoque consolidado</Text>
          </View>
        </View>
        <ScreenTabs
          tabs={[
            { key: "somado", label: "Somado", testID: "estoque-consolidado-somado" },
            { key: "por_loja", label: "Por loja", testID: "estoque-consolidado-por-loja" },
          ]}
          active={visaoConsolidado}
          onSelect={(k: string) => setVisaoConsolidado(k === "por_loja" ? "por_loja" : "somado")}
        />
        {visaoConsolidado === "por_loja" ? <EstoquePorLoja semPreco={consulta} mascarar={m} /> : <AggregatedView />}
      </ScrollView>
    );
  }

  // Helper: botões de ação do header (reusados em wide e narrow)
  // 12/05/2026: "Selecionar" volta como toggle do bulkMode (Eryca).
  // 23/09/2026: chamado como função ({ActionButtons()}), não como
  // <ActionButtons />: como componente, cada render da tela criava um tipo
  // novo e remontava os botões.
  //
  // 17/11/2026 (E1 e A8, estoque-portas-mockup-17-11.html, partes 1 e 6):
  // a barra ficou com cinco botões: olho, Selecionar, Conferir estoque,
  // "Chegou mercadoria" e "+ Produto" (sempre na ponta). Saíram "+ Serviço"
  // (escolha Produto · Serviço dentro do "+ Produto"), "+ Em lote" e o menu
  // "Importar" ("Cadastrar vários" no "+ Produto" e origens do wizard).
  // Demo: só o olho e "+ Produto".
  //
  // No celular (web < 500 px), as três ações de apoio ficam como ícone ao
  // lado do título, com nome para leitor de tela, e as duas portas ganham
  // uma linha só delas, com nome escrito (pendência 10).
  const AcoesDeApoio = () => (
    <>
      <OlhoValores variant="botao" alvo44={isMobileNarrow} />
      {/* 12/05/2026: botao Selecionar — toggle bulk mode. So aparece se ja tem produto e usuario nao e demo. */}
      {!isDemo && products.length > 0 && (
        <Pressable
          onPress={() => { if (bulkMode) { exitBulkMode(); } else { setBulkMode(true); } }}
          style={[s.bulkBtn, bulkMode && s.bulkBtnActive, isMobileNarrow && s.btnIconOnly]}
          accessibilityRole="button"
          accessibilityLabel={bulkMode ? TEXTOS_CHEGOU.rotuloSairDaSelecao : TEXTOS_CHEGOU.rotuloSelecionar}
          testID="estoque-selecionar"
        >
          <Icon name="check" size={isMobileNarrow ? 16 : 14} color={bulkMode ? "#fff" : Colors.violet3} />
          {!isMobileNarrow && <Text style={[s.bulkBtnText, bulkMode && { color: "#fff" }]}>
            {bulkMode ? "Sair da seleção" : "Selecionar"}
          </Text>}
        </Pressable>
      )}
      {podeConferir && products.length > 0 && (
        <Pressable onPress={() => router.push("/conferencia-estoque" as any)} style={[s.batchBtn, isMobileNarrow && s.btnIconOnly]}
          accessibilityRole="button" accessibilityLabel={TEXTOS_CHEGOU.rotuloConferir} testID="estoque-conferir">
          <Icon name="clipboard" size={isMobileNarrow ? 16 : 14} color={Colors.violet3} />
          {!isMobileNarrow && <Text style={s.batchBtnText}>Conferir estoque</Text>}
        </Pressable>
      )}
    </>
  );
  const BotaoChegou = () => (
    <Pressable onPress={abrirChegou} style={[s.batchBtn, isMobileNarrow && s.chegouCelular]}
      accessibilityRole="button" accessibilityLabel={TEXTOS_CHEGOU.titulo} testID="estoque-chegou-mercadoria">
      <Icon name="inbox" size={isMobileNarrow ? 16 : 15} color={Colors.violet3} />
      <Text style={[s.batchBtnText, isMobileNarrow && s.chegouCelularTxt]}>{TEXTOS_CHEGOU.titulo}</Text>
    </Pressable>
  );
  const BotaoProduto = () => (
    <Pressable onPress={() => abrirCadastro("product")} style={[s.addBtn, isMobileNarrow && s.produtoCelular]}
      accessibilityRole="button" testID="estoque-novo-produto" {...tourTarget("estoque.novo_produto")}>
      <Icon name={isMobileNarrow ? "plus" : "package"} size={14} color="#fff" />
      <Text style={s.addBtnText}>{isMobileNarrow ? TEXTOS_CHEGOU.produtoCelular : "+ Produto"}</Text>
    </Pressable>
  );
  const ActionButtons = () => (
    <>
      {AcoesDeApoio()}
      {podeChegou && BotaoChegou()}
      {BotaoProduto()}
    </>
  );

  // 12/05/2026: barra de acoes em lote. Renderizada quando bulkMode=true.
  // Mostra contador + select-all + delete + cancel. Botoes propagam pros
  // handlers ja existentes (handleSelectAll, setShowBulkConfirm, exitBulkMode).
  const BulkActionBar = () => {
    if (!bulkMode) return null;
    const allSelected = filtered.length > 0 && bulkSelected.size === filtered.length;
    return (
      <View style={s.bulkBar}>
        <Text style={s.bulkCount}>
          {bulkSelected.size} de {filtered.length} selecionado{bulkSelected.size === 1 ? "" : "s"}
        </Text>
        <Pressable onPress={handleSelectAll} style={s.bulkAction} disabled={filtered.length === 0}>
          <Text style={s.bulkActionText}>
            {allSelected ? "Limpar seleção" : "Selecionar todos"}
          </Text>
        </Pressable>
        {reajusteNoAr && !consulta && (
          <Pressable
            onPress={() => { if (bulkSelected.size > 0) setReajusteAberto(true); }}
            disabled={bulkSelected.size === 0}
            style={[s.bulkAction, s.bulkPriceAction, bulkSelected.size === 0 && { opacity: 0.4 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: bulkSelected.size === 0 }}
            testID="estoque-ajustar-preco"
          >
            <Text style={[s.bulkActionText, { color: "#fff" }]}>Ajustar preço</Text>
          </Pressable>
        )}
        {!consulta && !consolidatedView && (
          <Pressable
            onPress={() => { if (bulkSelected.size > 0) setDefinirFornecedor(true); }}
            disabled={bulkSelected.size === 0}
            style={[s.bulkAction, bulkSelected.size === 0 && { opacity: 0.4 }]}
            accessibilityRole="button"
            testID="estoque-definir-fornecedor"
          >
            <Text style={s.bulkActionText}>Definir fornecedor</Text>
          </Pressable>
        )}
        <BotaoTransferir lojas={lojasTransferencia} selecionados={bulkSelected.size} onPress={() => setTransferirAberto(true)} />
        <Pressable
          onPress={() => { if (bulkSelected.size > 0) setShowBulkConfirm(true); }}
          disabled={bulkSelected.size === 0}
          style={[s.bulkAction, s.bulkDeleteAction, bulkSelected.size === 0 && { opacity: 0.4 }]}
        >
          <Text style={[s.bulkActionText, { color: Colors.red }]}>
            Excluir{bulkSelected.size > 0 ? " (" + bulkSelected.size + ")" : ""}
          </Text>
        </Pressable>
        <Pressable onPress={exitBulkMode} style={s.bulkAction}>
          <Text style={s.bulkActionText}>Cancelar</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={s.wrapper}>
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={isWebWide ? s.contentWide : s.content}>
        {isWebWide ? (
          <>
            <ScreenHero
              eyebrow="Painel da loja"
              title="Estoque"
              live
              subtitle={
                <>
                  {fmtInt(products.length)} produtos cadastrados · {fmtInt(totalItems)} unidades em prateleira ·
                  <Text style={{
                    color: lowStock.length > 0 ? (isDark ? "#fbbf24" : "#b45309") : (isDark ? "#34d399" : "#059669"),
                    fontWeight: "600",
                  }}>
                    {" " + (lowStock.length > 0
                      ? pluralize(lowStock.length, "alerta") + " de estoque baixo"
                      : "tudo em ordem")}
                  </Text>
                </>
              }
            />
            {!consulta && (
              <View style={[s.headerRow, { marginBottom: 18, marginTop: 4 }]}>
                <View style={s.headerActions}>
                  {ActionButtons()}
                </View>
              </View>
            )}
          </>
        ) : isMobileNarrow ? (
          <View style={s.celTopo}>
            <View style={s.celTitulo}>
              <Text style={[s.pageTitle, { flex: 1, minWidth: 0 }]}>Estoque</Text>
              {!consulta && AcoesDeApoio()}
            </View>
            {!consulta && (
              <View style={s.celPortas} testID="estoque-portas-celular">
                {podeChegou && BotaoChegou()}
                {BotaoProduto()}
              </View>
            )}
          </View>
        ) : (
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.pageTitle}>Estoque</Text>
            </View>
            {!consulta && (
              <View style={s.headerActions}>
                {ActionButtons()}
              </View>
            )}
          </View>
        )}

        {(temUltimosReajustes || podeTransferir) && (
          <View style={s.linksTopo}>
            {podeTransferir && (
              <Pressable
                onPress={() => setTransferenciasAberto(true)}
                style={s.ultimosLink}
                testID="estoque-transferencias"
                accessibilityRole="button"
              >
                <Text style={{ color: Colors.violet3, fontSize: 13, fontWeight: "800" }}>⇄</Text>
                <Text style={s.ultimosLinkText}>Transferências</Text>
              </Pressable>
            )}
            {temUltimosReajustes && (
              <Pressable
                onPress={() => setUltimosAberto(true)}
                style={s.ultimosLink}
                testID="estoque-ultimos-reajustes"
                accessibilityRole="button"
              >
                <Icon name="rotate_ccw" size={13} color={Colors.violet3} />
                <Text style={s.ultimosLinkText}>Últimos reajustes</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* 19/10/2026 (tq-31): quem respondeu "planilha" no check-in chega
            com ?importar=planilha (components/screens/estoque/ConvitePlanilha). */}
        <ConvitePlanilha
          importar={params.importar}
          escondido={consolidatedView || importPlanilha.aberto || consulta}
          ocupado={importPlanilha.ocupado}
          onEscolher={importPlanilha.escolherArquivo}
        />

        {canLinkProducts && products.length > 0 && (
          <View style={s.multicnpjHint}>
            <Icon name="bag" size={14} color="#7c3aed" />
            <Text style={s.multicnpjHintText}>
              Você tem {availableCompanies.length} CNPJs. Toque em qualquer produto e use "🔗 Vincular CNPJ" para somar estoque entre lojas.
            </Text>
          </View>
        )}

        {products.length > 0 && (
          isWebWide ? (
            <EstoqueKpiStrip
              totalValue={valorEstoque.custo}
              saleValue={valorEstoque.venda}
              withoutCost={valorEstoque.semCusto}
              totalProducts={products.length}
              totalUnits={totalItems}
              lowCount={lowStock.length}
              onLowClick={lowStock.length > 0 ? () => setActiveTab(1) : undefined}
              semValores={consulta || semCusto}
            />
          ) : (
            <View style={s.summaryRow}>
              <SummaryCard label="TOTAL PRODUTOS" value={String(products.length)} sub={`${totalItems} unidades` + (serviceCount > 0 ? ` + ${serviceCount} servico${serviceCount > 1 ? "s" : ""}` : "")} />
              {!consulta && !semCusto && <SummaryCard label="VALOR EM ESTOQUE" value={m(fmt(valorEstoque.custo))} sub={legendaValorEstoque(valorEstoque, n => m(fmt(n)))} />}
              <SummaryCard label="ESTOQUE BAIXO" value={String(lowStock.length)} color={lowStock.length > 0 ? Colors.red : Colors.green} sub={lowStock.length > 0 ? "Ver alertas" : "Tudo OK"} onPress={lowStock.length > 0 ? () => setActiveTab(1) : undefined} />
            </View>
          )
        )}

        {/* 14/11/2026 (CP5 da revisão de cores): nomes de cor cortados ou em
            maiúsculas, para a lojista confirmar. Some no consolidado, no demo
            e no Estoque só consulta (o backend também responde 403). */}
        <ConferirNomesDeCor companyId={company?.id} ativo={!isDemo && !consolidatedView && !consulta && !consultaCarregando} />

        {dupGroupsCount > 0 && !isDemo && !consulta && (
          <Pressable onPress={() => setShowMergeModal(true)} style={s.dupBanner}>
            <View style={s.dupBannerIcon}><Text style={s.dupBannerIconText}>!</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.dupBannerTitle}>{dupGroupsCount} grupo{dupGroupsCount > 1 ? "s" : ""} de produtos duplicados</Text>
              {/* 23/09/2026 (QA producao, item 11): a deteccao (backend,
                  GET /duplicate-groups) passou a exigir mesmo nome + mesma
                  unidade + mesma marca — antes agrupava so por nome e
                  sugeria unificar "manta em metro" com "manta em rolo", ou
                  cimento de marcas diferentes. O texto agora explica o
                  criterio pra ficar claro por que esses produtos entraram
                  no grupo. */}
              <Text style={s.dupBannerDesc}>Mesmo nome, mesma unidade e mesma marca — provavelmente é o mesmo produto em cor ou tamanho diferente.</Text>
            </View>
            <View style={s.dupBannerCta}><Text style={s.dupBannerCtaText}>Unificar</Text><Text style={s.dupBannerArrow}>{"›"}</Text></View>
          </Pressable>
        )}

        {isLoading && <ListSkeleton rows={4} showCards />}

        {!isLoading && products.length === 0 && !isDemo && consulta && (
          <EmptyState icon="package" iconColor={Colors.amber} title="Nenhum produto cadastrado" subtitle="Quando a loja cadastrar produtos, eles aparecem aqui." />
        )}

        {/* 17/11/2026 (A8, mockup parte 6): a loja vazia mostra as duas
            portas. A nota vai pelo "Chegou mercadoria" (cadastra e dá
            entrada); a planilha e o cadastro à mão, como hoje. */}
        {!isLoading && products.length === 0 && !isDemo && !consulta && (
          <View testID="estoque-vazio">
            <View style={s.vazio}>
              <View style={s.vazioIco}><Icon name="package" size={isMobileNarrow ? 24 : 26} color={Colors.amber} /></View>
              <Text style={s.vazioTitulo}>{TEXTOS_CHEGOU.vazioTitulo}</Text>
              <Text style={s.vazioApoio}>{isMobileNarrow ? TEXTOS_CHEGOU.vazioApoioCelular : TEXTOS_CHEGOU.vazioApoio}</Text>
            </View>
            <View style={[s.vazioOrigens, isMobileNarrow && { flexDirection: "column" }]}>
              {podeChegou && (
                <View style={[s.vazioOrigem, isMobileNarrow && s.vazioOrigemCelular]} testID="estoque-vazio-nota">
                  <View style={s.vazioOrigemIco}><Icon name="file_text" size={20} color={Colors.violet3} /></View>
                  <View style={isMobileNarrow ? { flex: 1, minWidth: 0 } : null}>
                    <Text style={s.vazioOrigemTitulo}>{TEXTOS_CHEGOU.vazioNotaTitulo}</Text>
                    <Text style={s.vazioOrigemTxt}>{isMobileNarrow ? TEXTOS_CHEGOU.vazioNotaApoioCelular : TEXTOS_CHEGOU.vazioNotaApoio}</Text>
                  </View>
                  <View style={[s.vazioAcoes, isMobileNarrow && { width: "100%" }]}>
                    <Pressable onPress={abrirChegou} style={[s.vazioBtnPri, isMobileNarrow && s.vazioBtnCelular]} accessibilityRole="button" testID="estoque-vazio-chegou">
                      <Text style={s.vazioBtnPriTxt}>{TEXTOS_CHEGOU.titulo}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <View style={[s.vazioOrigem, isMobileNarrow && s.vazioOrigemCelular]} testID="estoque-vazio-planilha-cartao">
                <View style={s.vazioOrigemIco}><Icon name="grid" size={20} color={Colors.violet3} /></View>
                <View style={isMobileNarrow ? { flex: 1, minWidth: 0 } : null}>
                  <Text style={s.vazioOrigemTitulo}>{TEXTOS_CHEGOU.vazioPlanilhaTitulo}</Text>
                  <Text style={s.vazioOrigemTxt}>{isMobileNarrow ? TEXTOS_CHEGOU.vazioPlanilhaApoioCelular : TEXTOS_CHEGOU.vazioPlanilhaApoio}</Text>
                </View>
                <View style={[s.vazioAcoes, isMobileNarrow && { width: "100%" }]}>
                  <Pressable onPress={importPlanilha.escolherArquivo} disabled={importPlanilha.ocupado} style={[s.vazioBtnSec, isMobileNarrow && s.vazioBtnCelular, importPlanilha.ocupado && { opacity: 0.6 }]} accessibilityRole="button" testID="estoque-vazio-planilha">
                    <Text style={s.vazioBtnSecTxt}>{TEXTOS_CHEGOU.vazioPlanilhaBotao}</Text>
                  </Pressable>
                  <BaixarModelo testID="estoque-vazio-modelo" />
                </View>
              </View>
              <View style={[s.vazioOrigem, isMobileNarrow && s.vazioOrigemCelular]} testID="estoque-vazio-mao">
                <View style={s.vazioOrigemIco}><Icon name="plus" size={20} color={Colors.violet3} /></View>
                <View style={isMobileNarrow ? { flex: 1, minWidth: 0 } : null}>
                  <Text style={s.vazioOrigemTitulo}>{TEXTOS_CHEGOU.vazioMaoTitulo}</Text>
                  <Text style={s.vazioOrigemTxt}>{TEXTOS_CHEGOU.vazioMaoApoio}</Text>
                </View>
                <View style={[s.vazioAcoes, isMobileNarrow && { width: "100%" }]}>
                  <Pressable onPress={() => abrirCadastro("product")} style={[s.vazioBtnSec, isMobileNarrow && s.vazioBtnCelular]} accessibilityRole="button" testID="estoque-vazio-produto">
                    <Text style={s.vazioBtnSecTxt}>{TEXTOS_CHEGOU.vazioMaoProduto}</Text>
                  </Pressable>
                  <Pressable onPress={() => abrirLista(false)} style={[s.vazioBtnSec, isMobileNarrow && s.vazioBtnCelular]} accessibilityRole="button" testID="estoque-vazio-lista">
                    <Text style={s.vazioBtnSecTxt}>{TEXTOS_CHEGOU.vazioMaoLista}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 01/09/2026: TabBar local (cópia byte a byte do ScreenTabs) saiu. */}
        {products.length > 0 && (
          <ScreenTabs
            tabs={TABS.filter((t) => !(consulta && t === "Etiquetas")).map((t) => ({ key: t, label: t }))}
            active={TABS[activeTab]}
            onSelect={(k) => handleTabSelect(TABS.indexOf(k))}
          />
        )}

        {products.length > 0 && activeTab === 0 && (
          <View>
            <View style={s.searchRow} ref={scanRef as any}>
              <TextInput
                style={s.searchInput}
                placeholder="Buscar por nome, código, SKU ou código de barras..."
                placeholderTextColor={Colors.ink3}
                value={search}
                onChangeText={setSearch}
              />
              <Pressable onPress={() => setScanOpen(o => !o)} style={[s.scanBtn, scanOpen && s.scanBtnActive]}>
                <Icon name="barcode" size={20} color={scanOpen ? "#fff" : Colors.violet3} />
              </Pressable>
              {scanOpen && (
                <View style={s.scanPop}>
                  <Text style={s.scanPopTitle}>Bipar código de barras</Text>
                  <View style={s.scanInputRow}>
                    <Icon name="barcode" size={16} color={Colors.violet3} />
                    <TextInput
                      ref={scanInputRef}
                      style={s.scanInput}
                      placeholder="Bipe ou digite o código…"
                      placeholderTextColor={Colors.ink3}
                      value={scanText}
                      onChangeText={setScanText}
                      onSubmitEditing={applyScan}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                    />
                    <Pressable
                      onPress={applyScan}
                      disabled={!scanText.trim()}
                      style={[s.scanApply, !scanText.trim() && { opacity: 0.4 }]}
                    >
                      <Text style={s.scanApplyTxt}>Aplicar</Text>
                    </Pressable>
                  </View>
                  <Text style={s.scanPopHint}>
                    Aponte o leitor USB ou digite manualmente. Aceita código de barras, SKU ou código interno.
                  </Text>
                </View>
              )}
            </View>
            {/* Sort + view toggle */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 10 }} contentContainerStyle={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <OrdenarBarra value={ordemVista} onChange={setSortOrder} opcoes={consulta ? ordensSemPreco(ORDENS_ESTOQUE) : undefined} />
              {isWebWide && Platform.OS === "web" && !consulta ? (
                <>
                  <View style={{ width: 12 } as any} />
                  <View style={s.viewToggleWrap}>
                    <Pressable onPress={() => setView("table")} style={[s.viewToggleBtn, view === "table" && s.viewToggleBtnActive]}>
                      <Icon name="menu" size={14} color={view === "table" ? "#fff" : Colors.ink3} />
                    </Pressable>
                    <Pressable onPress={() => setView("grid")} style={[s.viewToggleBtn, view === "grid" && s.viewToggleBtnActive]}>
                      <Icon name="grid" size={14} color={view === "grid" ? "#fff" : Colors.ink3} />
                    </Pressable>
                  </View>
                </>
              ) : null}
            </ScrollView>

            {/* Category filter — multi-select dropdown (wide) ou ScrollableChips (narrow) */}
            {isWebWide ? (
              <View style={{ marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" } as any}>
                <CategoryDropdownWeb categories={allCategories} selected={catsMulti} onChange={setCatsMulti} />
                {!isDemo && !consulta && (
                  <Pressable
                    onPress={() => setOrganizarAberto(true)}
                    style={s.catBtn}
                    accessibilityRole="button"
                    testID="estoque-organizar-categorias"
                  >
                    <Icon name="layers" size={14} color={Colors.violet3} />
                    <Text style={s.catBtnText}>Organizar categorias</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                <ScrollableChips items={filterCategories} active={catFilter} onSelect={setCatFilter} />
                {!isDemo && !consulta && (
                  <Pressable
                    onPress={() => setOrganizarAberto(true)}
                    style={[s.catBtn, { alignSelf: "flex-start", marginBottom: 12 }]}
                    accessibilityRole="button"
                    testID="estoque-organizar-categorias"
                  >
                    <Icon name="layers" size={14} color={Colors.violet3} />
                    <Text style={s.catBtnText}>Organizar categorias</Text>
                  </Pressable>
                )}
              </>
            )}

            {/* 10/11/2026: filtro rápido da NFS-e — só para quem emite e tem serviço sem código */}
            {semCodigoNfse.length > 0 && (
              <View style={{ marginBottom: 12 } as any}>
                <Pressable
                  onPress={() => setSoFaltaNfse((v) => !v)}
                  style={[s.nfseChip, filtroNfseAtivo && s.nfseChipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filtroNfseAtivo }}
                  accessibilityLabel={SELO_FALTA_NFSE + ": " + semCodigoNfse.length}
                  testID="estoque-filtro-nfse"
                >
                  <Icon name="receipt" size={12} color={filtroNfseAtivo ? "#fff" : Colors.amber} />
                  <Text style={[s.nfseChipTxt, filtroNfseAtivo && { color: "#fff" }]}>{SELO_FALTA_NFSE}</Text>
                  <View style={[s.nfseChipN, filtroNfseAtivo && { backgroundColor: "rgba(255,255,255,0.22)" }]}>
                    <Text style={[s.nfseChipNTxt, filtroNfseAtivo && { color: "#fff" }]}>{String(semCodigoNfse.length)}</Text>
                  </View>
                </Pressable>
                {filtroNfseAtivo && (() => {
                  const av = avisoDoFiltroNfse(semCodigoNfse.length, semCodigoNfse.some((p) => p.isGroupShared));
                  return (
                    <View style={s.nfseAviso} testID="estoque-aviso-nfse">
                      <Icon name="alert" size={15} color={Colors.amber} />
                      <Text style={s.nfseAvisoTxt}>
                        <Text style={{ fontWeight: "700", color: Colors.ink }}>{av.forte}</Text>
                        {av.resto}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* 12/05/2026: barra de acoes em lote — visivel apenas quando bulkMode=true */}
            <BulkActionBar />

            {/* List view: ProductTableWeb / ProductGridWeb (wide) ou ProductRow (narrow) */}
            {isWebWide ? (
              <View style={{ marginBottom: 12 } as any}>
                {view === "table" || consulta ? (
                  <ProductTableWeb
                    items={paginated}
                    consulta={consulta}
                    semCusto={semCusto}
                    onEntrada={!isDemo && !consulta && !consolidatedView ? abrirEntrada : undefined}
                    onEdit={!isDemo && !consulta ? handleEdit : undefined}
                    onDelete={!isDemo && !consulta ? (id) => setDeleteTarget(id) : undefined}
                    onLink={canLinkProducts ? (p) => setLinkTarget(p) : undefined}
                    bulkMode={bulkMode}
                    bulkSelected={bulkSelected}
                    onSelect={toggleBulkSelect}
                    canLink={canLinkProducts}
                    emiteNfse={emiteNfseEstoque}
                    reservaLiberada={reservaLiberada}
                  />
                ) : (
                  <ProductGridWeb
                    items={paginated}
                    onEdit={!isDemo ? handleEdit : undefined}
                    onDelete={!isDemo ? (id) => setDeleteTarget(id) : undefined}
                    onLink={canLinkProducts ? (p) => setLinkTarget(p) : undefined}
                    bulkMode={bulkMode}
                    bulkSelected={bulkSelected}
                    onSelect={toggleBulkSelect}
                    canLink={canLinkProducts}
                    emiteNfse={emiteNfseEstoque}
                  />
                )}
              </View>
            ) : (
              <View style={s.listCard}>
                {paginated.map(p => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    consulta={consulta}
                    semCusto={semCusto}
                    onEntrada={!isDemo && !bulkMode && !consulta && !consolidatedView ? abrirEntrada : undefined}
                    onDelete={!isDemo && !bulkMode && !consulta ? (id) => setDeleteTarget(id) : undefined}
                    onEdit={!isDemo && !bulkMode && !consulta ? handleEdit : undefined}
                    onLink={canLinkProducts && !bulkMode ? (prod) => setLinkTarget(prod) : undefined}
                    isSelected={bulkSelected.has(p.id)}
                    onSelect={bulkMode ? toggleBulkSelect : undefined}
                    emiteNfse={emiteNfseEstoque}
                    reservaLiberada={reservaLiberada}
                  />
                ))}
                {filtered.length === 0 && <View style={{ alignItems: "center", paddingVertical: 40 }}><Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum produto encontrado</Text></View>}
              </View>
            )}
            <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
          </View>
        )}

        {/* Aba 1: Alertas (era 2 antes da Curva ABC migrar) */}
        {activeTab === 1 && (
          <AlertsList
            products={products}
            matconOn={matconFiscalOn}
            emiteNota={emiteNotaEstoque}
            onUpdateCest={(product, cest) => updateProduct({ ...product, cest })}
            consulta={consulta || semCusto}
          />
        )}
        {/* Aba 2: Etiquetas (era 3 antes da Curva ABC migrar) */}
        {activeTab === 2 && !consulta && <PrintLabels products={products} selectedIds={labelSelection} onSelectionChange={setLabelSelection} podeMudarDesenho={podeMudarDesenho} marcarAoAbrir={etiquetasDoReajuste} />}

      </ScrollView>

      {/* === Modais e overlays — fora do ScrollView para renderizar fixos na viewport === */}
      <ConfirmDialog visible={!!deleteTarget} title="Excluir produto?" message="Esta ação não pode ser desfeita." confirmLabel="Excluir" destructive onConfirm={() => { if (deleteTarget) { deleteProduct(deleteTarget); setDeleteTarget(null); refetchDupGroups(); } }} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog visible={showBulkConfirm} title={`Excluir ${bulkSelected.size} produto${bulkSelected.size > 1 ? "s" : ""}`} message="Esta ação não pode ser desfeita. Todos os produtos selecionados serão removidos permanentemente." confirmLabel="Excluir todos" destructive onConfirm={() => { setShowBulkConfirm(false); handleBulkDelete(); }} onCancel={() => setShowBulkConfirm(false)} />
      <MergeDuplicatesModal visible={showMergeModal} onClose={() => { setShowMergeModal(false); clearMergeSuggestion(); }} onComplete={() => { qc.invalidateQueries({ queryKey: ["products", company?.id] }); refetchDupGroups(); clearMergeSuggestion(); }} />
      <QuickBatchProductsModal
        visible={showBatchModal}
        onClose={() => { setShowBatchModal(false); setListaComVoltar(false); }}
        onVoltar={listaComVoltar ? voltarDaLista : undefined}
        allCategories={allCategories}
      />
      {chegouAberto && podeChegou && company?.id && (
        <ChegouMercadoriaModal
          visible
          companyId={company.id}
          lojaNome={company.name || null}
          products={products}
          semCusto={semCusto}
          onClose={() => setChegouAberto(false)}
          onFeito={aposChegou}
          onVerNovos={verNovosDoChegou}
        />
      )}
      <WebPortal active={reajusteAberto && !!company?.id}>
        <AjustarPrecoModal
          companyId={company?.id || ""}
          produtos={products.filter(p => bulkSelected.has(p.id))}
          onFechar={() => setReajusteAberto(false)}
          onPrecosMudaram={() => {
            qc.invalidateQueries({ queryKey: ["products", company?.id] });
            qc.invalidateQueries({ queryKey: ultimosReajustesQueryKey(company?.id) });
          }}
          onReimprimir={(ids) => {
            setReajusteAberto(false);
            exitBulkMode();
            setLabelSelection(ids);
            setEtiquetasDoReajuste(ids);
            handleTabSelect(TABS.indexOf("Etiquetas"));
          }}
        />
      </WebPortal>
      <WebPortal active={ultimosAberto && temUltimosReajustes && !!company?.id}>
        <UltimosReajustesModal
          companyId={company?.id || ""}
          onFechar={() => setUltimosAberto(false)}
          onPrecosMudaram={() => {
            qc.invalidateQueries({ queryKey: ["products", company?.id] });
            qc.invalidateQueries({ queryKey: ultimosReajustesQueryKey(company?.id) });
          }}
        />
      </WebPortal>
      <WebPortal active={transferirAberto && !!lojasTransferencia}>
        <TransferirModal
          origem={lojasTransferencia?.origem || { id: "", nome: "" }}
          destinos={lojasTransferencia?.destinos || []}
          produtos={products.filter((p) => bulkSelected.has(p.id) && p.unit !== "srv")}
          onFechar={() => setTransferirAberto(false)}
          onEstoqueMudou={() => {
            qc.invalidateQueries({ queryKey: ["products", company?.id] });
            qc.invalidateQueries({ queryKey: ["productsAggregated"] });
          }}
          onConcluido={(numeros, pecas, destino) => {
            toast.success((numeros.length > 1 ? "Transferências " : "Transferência ") + textoDosNumeros(numeros) + (numeros.length > 1 ? " feitas: " : " feita: ") + pluralQtd(pecas, "peça", "peças") + " para " + destino.nome);
            setTransferirAberto(false);
            exitBulkMode();
          }}
        />
      </WebPortal>
      <WebPortal active={organizarAberto && !!company?.id}>
        <OrganizarCategoriasModal
          onFechar={fecharOrganizar}
          onAbrirMigracao={() => { fecharOrganizar(); router.push("/catalogo/migracao?de=estoque"); }}
        />
      </WebPortal>
      <WebPortal active={transferenciasAberto && !!lojasTransferencia}>
        <TransferenciasModal
          companyId={company?.id || ""}
          nomes={lojasTransferencia?.nomes || {}}
          onFechar={() => setTransferenciasAberto(false)}
        />
      </WebPortal>
      <WebPortal active={importPlanilha.aberto}>
        <ImportPlanilhaModal
          fase={importPlanilha.fase}
          resumo={importPlanilha.resumo}
          resultado={importPlanilha.resultado}
          erro={importPlanilha.erro}
          nomeArquivo={importPlanilha.nomeArquivo}
          onImportar={importPlanilha.importar}
          onFechar={importPlanilha.fechar}
          onBaixarProblemas={importPlanilha.baixarProblemas}
          lojas={importPlanilha.lojas}
          porLoja={importPlanilha.porLoja}
        />
      </WebPortal>
      {linkTarget && company?.id && (
        <LinkProductModal
          visible={!!linkTarget}
          companyId={company.id}
          productId={linkTarget.id}
          onClose={() => setLinkTarget(null)}
          onLinked={() => {
            qc.invalidateQueries({ queryKey: ["products", company?.id] });
            qc.invalidateQueries({ queryKey: ["productsAggregated"] });
          }}
        />
      )}

      {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}

      <EntradaMercadoriaModal
        visible={!!entrada}
        produto={entrada?.produto || null}
        semCusto={semCusto}
        onClose={() => setEntrada(null)}
      />
      <DefinirFornecedorModal
        visible={definirFornecedor}
        productIds={Array.from(bulkSelected)}
        semCusto={semCusto}
        onClose={() => setDefinirFornecedor(false)}
        onFeito={exitBulkMode}
      />
      <ItemFormModal
        visible={formOpen}
        onClose={fecharCadastro}
        initialType={formType}
        editProduct={editProduct}
        onSaved={aposSalvarItem}
        cadastrarVarios={acoesCadastrarVarios}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1, position: "relative" },
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  // Wide layout: max-width maior pra acomodar Hero + Table; padding reduzido.
  contentWide: { padding: 28, paddingBottom: 60, maxWidth: 1480, alignSelf: "center", width: "100%" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 8, flexWrap: "wrap" },
  pageTitle: { fontSize: 22, color: Colors.ink, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  // Link de texto (ação secundária): sem cara de botão, alvo de 44 px.
  linksTopo: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 14 },
  ultimosLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", minHeight: 44, paddingHorizontal: 4, marginTop: -8, marginBottom: 4 },
  ultimosLinkText: { fontSize: 12.5, color: Colors.violet3, fontWeight: "600", textDecorationLine: "underline" },
  batchBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2 },
  batchBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  danfeBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(124,58,237,0.18)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(167,139,250,0.35)", borderStyle: "dashed" as any },
  danfeBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  btnIconOnly: { paddingHorizontal: 10, gap: 0, minWidth: 44, minHeight: 44, justifyContent: "center" },
  // A8: topo do celular (título + três ícones; linha das duas portas).
  celTopo: { marginBottom: 20, gap: 12 },
  celTitulo: { flexDirection: "row", alignItems: "center", gap: 8 },
  celPortas: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  chegouCelular: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 12 },
  chegouCelularTxt: { flexShrink: 1, lineHeight: 16 },
  produtoCelular: { minHeight: 44, flexShrink: 0 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginBottom: 20 },
  card: { backgroundColor: Colors.bg3, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, flex: 1, minWidth: IS_WIDE ? 140 : "45%", margin: 4 },
  cardLabel: { fontSize: 10, color: Colors.ink3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  cardValue: { fontSize: 20, fontWeight: "800", color: Colors.ink, letterSpacing: -0.5 },
  cardSub: { fontSize: 10, color: Colors.ink3, marginTop: 4 },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" },
  catBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  catBtnText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  // 10/11/2026: filtro rápido "Falta código da NFS-e" e o aviso dele.
  nfseChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.amberD, borderWidth: 1, borderColor: "rgba(251,191,36,0.35)" },
  nfseChipOn: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  nfseChipTxt: { fontSize: 12, fontWeight: "700", color: Colors.amber },
  nfseChipN: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: "rgba(251,191,36,0.18)" },
  nfseChipNTxt: { fontSize: 11, fontWeight: "700", color: Colors.amber },
  nfseAviso: { flexDirection: "row", gap: 9, alignItems: "flex-start", marginTop: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.amberD, borderWidth: 1, borderColor: "rgba(251,191,36,0.35)" },
  nfseAvisoTxt: { flex: 1, fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  // 12/05/2026: bulkBtn agora vive no header (junto com Servico/Lote/DANFE/Produto).
  // bulkBtnActive aplica quando bulkMode=true pra dar feedback visual.
  bulkBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border2 },
  bulkBtnActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  bulkBtnText: { fontSize: 13, color: Colors.violet3, fontWeight: "700" },
  dupBtn: { backgroundColor: Colors.amberD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)" },
  dupBtnText: { fontSize: 12, color: Colors.amber, fontWeight: "700" },
  bulkBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border2, flexWrap: "wrap" },
  bulkCount: { fontSize: 13, color: Colors.violet3, fontWeight: "700", flex: 1 },
  bulkAction: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  bulkPriceAction: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  bulkDeleteAction: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  bulkActionText: { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, position: "relative", zIndex: 50 },
  searchInput: { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink },
  scanBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  scanBtnActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  scanPop: {
    position: "absolute",
    top: 50, right: 0,
    width: 360, maxWidth: "100%" as any,
    backgroundColor: Colors.bg3,
    borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
    padding: 14,
    zIndex: 999,
    ...(Platform.OS === "web" ? {
      boxShadow: "0 20px 40px -10px rgba(124,58,237,0.25)",
    } as any : {}),
  } as any,
  scanPopTitle: {
    fontSize: 10, fontWeight: "700", color: Colors.ink3,
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10,
  },
  scanInputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.bg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1.5, borderColor: "rgba(124,58,237,0.4)",
  },
  scanInput: {
    flex: 1, fontSize: 13, color: Colors.ink, fontWeight: "500",
    paddingVertical: 10,
    ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}),
  } as any,
  scanApply: {
    backgroundColor: Colors.violet,
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scanApplyTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  scanPopHint: {
    fontSize: 10, color: Colors.ink3, marginTop: 8,
    lineHeight: 14,
  },
  listCard: { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  // A8: loja vazia (mockup parte 6).
  vazio: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 18 },
  vazioIco: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.amberD, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  vazioTitulo: { fontSize: 17, fontWeight: "700", color: Colors.ink, textAlign: "center" },
  vazioApoio: { fontSize: 13, color: Colors.ink3, marginTop: 4, textAlign: "center", lineHeight: 19 },
  vazioOrigens: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  vazioOrigem: { flex: 1, minWidth: 0, gap: 8, padding: 16, borderRadius: 14, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  vazioOrigemCelular: { flex: undefined as any, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 12, padding: 14 },
  vazioOrigemIco: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.violetD, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  vazioOrigemTitulo: { fontSize: 15, fontWeight: "700", color: Colors.ink },
  vazioOrigemTxt: { fontSize: 12.5, color: Colors.ink2, lineHeight: 18, marginTop: 2 },
  vazioAcoes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: "auto" as any, paddingTop: 6 },
  vazioBtnPri: { minHeight: 40, justifyContent: "center", alignItems: "center", backgroundColor: Colors.violet, borderRadius: 10, paddingHorizontal: 14 },
  vazioBtnPriTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  vazioBtnSec: { minHeight: 40, justifyContent: "center", alignItems: "center", backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border2 },
  vazioBtnSecTxt: { color: Colors.violet3, fontSize: 13, fontWeight: "600" },
  vazioBtnCelular: { minHeight: 44, flexGrow: 1 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
  dupBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fef3c7", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", marginBottom: 16 },
  dupBannerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f59e0b", alignItems: "center", justifyContent: "center" },
  dupBannerIconText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  dupBannerTitle: { fontSize: 13, fontWeight: "700", color: "#78350f" },
  dupBannerDesc: { fontSize: 11.5, color: "#92400e", marginTop: 2, lineHeight: 16 },
  dupBannerCta: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f59e0b", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  dupBannerCtaText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  dupBannerArrow: { fontSize: 14, color: "#fff", fontWeight: "800" },
  multicnpjHint: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#7c3aed10", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#7c3aed30", marginBottom: 16,
  },
  multicnpjHintText: { fontSize: 11.5, color: Colors.ink, flex: 1, lineHeight: 16 },
  // Estoque Premium v2 (08/05/2026) — view toggle (table/grid)
  viewToggleWrap: {
    flexDirection: "row",
    backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 3, gap: 2,
  },
  viewToggleBtn: {
    width: 32, height: 28, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },
  viewToggleBtnActive: {
    backgroundColor: Colors.violet,
  },
});
