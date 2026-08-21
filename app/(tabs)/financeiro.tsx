import { useState, useMemo, useRef, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, useWindowDimensions, TextInput } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useTransactionsApi, invalidateFinanceiroQueries } from "@/hooks/useTransactions";
import { maskDateBR, brDateToISO } from "@/utils/mask";
import { ListSkeleton } from "@/components/ListSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TransactionModal } from "@/components/screens/financeiro/TransactionModal";
import { TabVisaoGeral } from "@/components/screens/financeiro/TabVisaoGeral";
import { TabLancamentos } from "@/components/screens/financeiro/TabLancamentos";
import { MonthExpensesBanner } from "@/components/screens/financeiro/MonthExpensesBanner";
import { ExportDreModal } from "@/components/screens/financeiro/ExportDreModal";
import { TABS, TAB_INDEX } from "@/components/screens/financeiro/types";
import type { PeriodKey, Transaction } from "@/components/screens/financeiro/types";
import { arrayToCSV, downloadCSV, pickFileAndParse, TRANSACTION_COLUMNS } from "@/utils/csv";
import { toast } from "@/components/Toast";
import { FinanceiroToolbar } from "@/components/FinanceiroToolbar";
import { AgentBanner } from "@/components/AgentBanner";
import { useAuthStore } from "@/stores/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/services/api";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { ConsolidatedBreakdownCard } from "@/components/screens/dashboard/ConsolidatedBreakdownCard";
// V2 redesign (04/05/2026): Topbar nova + 2 abas novas (Receitas, Despesas).
import { FinanceiroTopbar, TabReceitas, TabDespesas } from "@/components/screens/financeiro/v2";
// F3-3D (29/05/2026): Surface de A Receber do crediario na aba Visao Geral.
import { creditApi } from "@/services/creditApi";

var isWeb = Platform.OS === "web";

var TAB_KEY_TO_INDEX: Record<string, number> = {
  visao: TAB_INDEX.visao,
  receitas: TAB_INDEX.receitas,
  despesas: TAB_INDEX.despesas,
  lancamentos: TAB_INDEX.lancamentos,
  // F6: nao sao mais abas, mas seguem aceitos como alias — o efeito de
  // redirect abaixo manda pras rotas novas antes de qualquer render.
  retirada: TAB_INDEX.retirada,
  cupons: TAB_INDEX.cupons,
};

// Inverso, pra manter a URL em sincronia com a aba ativa (B4).
var TAB_INDEX_TO_KEY: Record<number, string> = {
  [TAB_INDEX.visao]: "visao",
  [TAB_INDEX.receitas]: "receitas",
  [TAB_INDEX.despesas]: "despesas",
  [TAB_INDEX.lancamentos]: "lancamentos",
};

function getLayoutForWidth(w: number): { maxWidth: number | "100%"; padding: number } {
  if (w < 480) return { maxWidth: "100%", padding: 14 };
  if (w < 768) return { maxWidth: "100%", padding: 20 };
  if (w < 1280) return { maxWidth: 1100, padding: 28 };
  if (w < 1900) return { maxWidth: 1340, padding: 32 };
  return { maxWidth: 1600, padding: 36 };
}

// FIX 24/08/2026 (QA Financeiro C2/B7): maskDate/brToISO viviam copiados aqui,
// em ComparativeSection e em ExportDreModal — as tres copias com o mesmo bug:
// aceitavam datas inexistentes (31/04) e o ISO invalido virava "NaN-NaN-NaN"
// na query string, esvaziando a tela sem feedback. Agora todo mundo usa o util
// compartilhado, que valida o dia contra o mes de verdade.

// ─── F3-3D: Card de A Receber do crediario ──────────────────
// Consome GET /financial/receivables (Negocio+).
// Gating no backend: planos inferiores recebem 403 e o card nao renderiza.
// Mostra KPIs: total aberto, vencido, recebido no mes. Link para /crediario.
// 17/08/2026 — vocabulário por vertical.
// Em personalizados quase não existe fiado: a lojista não pensa "crediário",
// pensa em encomenda com saldo em aberto. O DADO continua sendo crediário
// (mesma tabela, mesma categoria 'Crediario - A Receber' gravada pelo ledger)
// — só o rótulo muda. Renomear a categoria no backend quebraria o varejo, que
// compartilha o mesmo código, e o _mapCategory do DRE, que casa por string.
function CrediarioReceivablesCard({ companyId }: { companyId: string }) {
  const { company } = useAuthStore();
  const isStudio = (company as any)?.vertical_active === "studio";
  const { data, isLoading } = useQuery({
    queryKey: ["financial-receivables", companyId],
    queryFn: () => creditApi.getReceivables(companyId),
    staleTime: 120_000,
    retry: false, // nao retentar em 403 (plano insuficiente)
  });

  // Nao mostrar se: carregando, erro (403/plano), ou sem clientes em aberto.
  // 24/08/2026 (QA): `data.kpis` sem optional chaining derrubava a Visao Geral
  // inteira com TypeError se o backend respondesse 200 sem o bloco `kpis`.
  if (isLoading || !data?.kpis || data.kpis.customers_open === 0) return null;

  const { kpis } = data;
  const fmtR = (n: number) =>
    "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <View style={rcv.card}>
      <View style={rcv.headerRow}>
        <View style={rcv.iconBox}>
          <Icon name="percent" size={15} color={Colors.violet3} />
        </View>
        <Text style={rcv.title}>{isStudio ? "Encomendas — A Receber" : "Crediário — A Receber"}</Text>
        {/* No Studio o detalhe mora na aba "A receber" do Hub de Pedidos —
            mandar pra tela de Crediário do varejo tiraria ela do shell. */}
        <Pressable
          onPress={() => router.push((isStudio ? "/studio/pedidos" : "/(tabs)/crediario") as any)}
          style={rcv.linkBtn}
        >
          <Text style={rcv.linkBtnText}>Ver detalhes</Text>
          <Icon name="chevron_right" size={11} color={Colors.violet3} />
        </Pressable>
      </View>

      <View style={rcv.kpiRow}>
        <View style={rcv.kpi}>
          <Text style={rcv.kpiLabel}>ABERTO</Text>
          <Text style={[rcv.kpiValue, { color: Colors.violet3 }]}>{fmtR(kpis.total_open)}</Text>
          <Text style={rcv.kpiMeta}>{kpis.customers_open} cliente{kpis.customers_open !== 1 ? "s" : ""}</Text>
        </View>
        {kpis.total_overdue > 0 && (
          <View style={rcv.kpi}>
            <Text style={rcv.kpiLabel}>VENCIDO</Text>
            <Text style={[rcv.kpiValue, { color: Colors.red }]}>{fmtR(kpis.total_overdue)}</Text>
          </View>
        )}
        <View style={rcv.kpi}>
          <Text style={rcv.kpiLabel}>RECEBIDO MÊS</Text>
          <Text style={[rcv.kpiValue, { color: Colors.green }]}>{fmtR(kpis.received_month)}</Text>
        </View>
      </View>
    </View>
  );
}

const rcv = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border2, marginTop: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  iconBox: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
  },
  title: { flex: 1, fontSize: 12, fontWeight: "700", color: Colors.ink },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  linkBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  kpiRow: { flexDirection: "row", gap: 10 },
  kpi: { flex: 1 },
  kpiLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 0.8, color: Colors.ink3, textTransform: "uppercase", marginBottom: 4 },
  kpiValue: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },
  kpiMeta: { fontSize: 10, color: Colors.ink3, marginTop: 2 },
});

// ─── Tela principal ──────────────────────────────────────────
// 19/08/2026 (QA — dedup de header): prop `embedded?: boolean` (default
// false, varejo não muda) repassada ao FinanceiroTopbar pra suprimir só o
// kicker "FINANCEIRO ·" quando a tela é embutida em
// app/studio/(estudio)/gestao/financeiro.tsx (que já renderiza um título
// "Financeiro do estúdio"). Não escondemos o Topbar inteiro: ele carrega o
// seletor de período e os botões Exportar/Novo lançamento, que são
// funcionais (não decorativos) e continuam necessários dentro do Studio.
export default function FinanceiroScreen({ embedded }: { embedded?: boolean } = {}) {
  var { width: vw } = useWindowDimensions();
  var layout = getLayoutForWidth(vw);
  var IS_WIDE = vw >= 768;
  var IS_NARROW = vw < 480;

  var params = useLocalSearchParams<{ tab?: string; focus?: string }>();
  var paramTab = typeof params.tab === "string" ? params.tab : undefined;
  var paramFocus = typeof params.focus === "string" ? params.focus : undefined;
  var initialTab = paramTab && TAB_KEY_TO_INDEX[paramTab] !== undefined ? TAB_KEY_TO_INDEX[paramTab] : TAB_INDEX.visao;

  var [activeTab, setActiveTab] = useState(initialTab);
  var [period, setPeriod] = useState<PeriodKey>("month");
  var [showModal, setShowModal] = useState(false);
  var [showExport, setShowExport] = useState(false);
  var [editTx, setEditTx] = useState<Transaction | null>(null);
  var [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  var [importing, setImporting] = useState(false);
  var scrollRef = useRef<any>(null);

  var [customStartBR, setCustomStartBR] = useState("");
  var [customEndBR, setCustomEndBR] = useState("");
  var parsedStart = brDateToISO(customStartBR) || undefined;
  var parsedEnd = brDateToISO(customEndBR) || undefined;

  // FIX 24/08/2026 (QA Financeiro A2): nada validava a ordem das datas. Com
  // "De 20/08 · Ate 01/01" o range saia invertido, a lista voltava vazia e o
  // check verde aparecia mesmo assim (so testava que as duas datas parsearam).
  // Agora o range so vale quando esta completo E em ordem — enquanto estiver
  // invertido a tela segue no periodo anterior e o usuario ve o aviso abaixo.
  var customRangeInverted = !!parsedStart && !!parsedEnd && parsedStart > parsedEnd;
  var customRangeValid = !!parsedStart && !!parsedEnd && !customRangeInverted;
  var customStart = customRangeValid ? parsedStart : undefined;
  var customEnd = customRangeValid ? parsedEnd : undefined;

  var {
    transactions, summary, previousSummary, currentMonthExpenses,
    isLoading, isDemo, isError, refetch,
    createTransaction, deleteTransaction,
    consolidatedView, consolidatedBreakdown,
  } = useTransactionsApi(period, customStart, customEnd);
  var { company, token, companyCount } = useAuthStore();
  var qc = useQueryClient();

  // F6 (24/08/2026): Retirada e Cupons deixaram de ser abas. Os deep-links
  // antigos continuam valendo e levam pras rotas novas — nada que ja circula
  // por ai (favorito do usuario, link colado no WhatsApp) quebra.
  //
  // FIX (QA pos-F7): so redireciona FORA do Studio. Esta tela e reusada por
  // app/studio/(estudio)/gestao/financeiro.tsx com `embedded`, e os destinos
  // vivem no shell do varejo: /cupons esta em (tabs), e o AuthGuard do
  // app/_layout rebota usuario de Studio que entra em (tabs) de volta pra home
  // do estudio — o cliente clicaria no link e seria expulso da tela sem ver o
  // que pediu. Dentro do Studio o alias antigo cai na Visao Geral, que e um
  // destino valido, em vez de tirar o usuario do shell.
  useEffect(function() {
    if (!embedded) {
      if (paramTab === "retirada") { router.replace("/financeiro/retirada" as any); return; }
      if (paramTab === "cupons") { router.replace("/cupons" as any); return; }
    }
    if (paramTab && TAB_KEY_TO_INDEX[paramTab] !== undefined) {
      setActiveTab(TAB_KEY_TO_INDEX[paramTab]);
    }
  }, [paramTab, embedded]);

  // F4 (24/08/2026): a curva ABC virou tela propria (/financeiro/produtos).
  // O deep-link antigo do Painel (?tab=receitas&focus=abc) continua valendo —
  // antes ele rolava ate um card no meio da aba Receitas; agora leva direto
  // pra tela dedicada. replace() pra "voltar" nao cair de novo no redirect.
  // Mesma ressalva do Studio acima.
  useEffect(function() {
    if (paramFocus !== "abc" || embedded) return;
    router.replace("/financeiro/produtos" as any);
  }, [paramFocus, embedded]);

  // Enquanto o redirect nao acontece, nao renderiza a tela por baixo — evita
  // flash de skeleton/abas antes de sair (e, no caso de retirada/cupons, de
  // uma faixa de abas sem nenhuma ativa).
  var redirecting = !embedded && (paramFocus === "abc" || paramTab === "retirada" || paramTab === "cupons");

  // FIX M5 (24/08/2026): a comparacao era com "outros" minusculo, mas
  // mapApiTransaction normaliza ausencia de categoria pra "Outros" e as
  // categorias canonicas sao capitalizadas — nenhum lancamento default
  // chegava a alimentar o "Categorizar com IA".
  var uncategorized = transactions
    .filter(function(t: any) { return !t.category || String(t.category).toLowerCase() === "outros"; })
    .map(function(t: any) { return t.desc || t.description; })
    .filter(Boolean);

  var showMonthBanner = period !== "month" && period !== "all" && currentMonthExpenses && currentMonthExpenses.count > 0;

  var breakdownForCard = useMemo(function() {
    if (!consolidatedBreakdown || !consolidatedBreakdown.length) return [];
    return consolidatedBreakdown.map(function(b: any) {
      return {
        company_id: b.company_id,
        company_name: b.company_name,
        is_primary: b.is_primary,
        revenue: b.income || 0,
        expenses: b.expenses || 0,
        net: b.net || 0,
        pending_income: b.pending_income || 0,
        pending_expenses: b.pending_expenses || 0,
        sales_count_month: 0,
        sales_today: 0,
      };
    });
  }, [consolidatedBreakdown]);

  // FIX B4 (24/08/2026): a URL nao acompanhava a aba ativa — dar refresh ou
  // compartilhar o link devolvia a aba do parametro antigo, nao a que estava
  // aberta. setParams mantem os dois em sincronia sem empilhar historico.
  function handleTabSelect(i: number) {
    setActiveTab(i);
    var key = TAB_INDEX_TO_KEY[i];
    if (key) router.setParams({ tab: key });
    scrollRef.current?.scrollTo?.({ y: 0, animated: true });
  }

  // B3: showCustomPeriod era espelho exato de `period === "custom"` — a
  // condicao `period === "custom" || showCustomPeriod` nunca divergia.
  function handlePeriodChange(p: PeriodKey) {
    setPeriod(p);
  }

  // Exporta CSV dos lancamentos visiveis (usado na aba Lancamentos).
  function handleExport() {
    if (transactions.length === 0) { toast.error("Nenhum lançamento para exportar"); return; }
    downloadCSV(arrayToCSV(transactions, TRANSACTION_COLUMNS), "aura_lancamentos_" + new Date().toISOString().slice(0, 10) + ".csv");
  }

  async function handleImport() {
    if (consolidatedView) {
      toast.error("Escolha uma empresa no seletor para importar lançamentos");
      return;
    }
    if (!company?.id || !token) { toast.error("Sua sessão expirou. Entre novamente."); return; }
    try {
      setImporting(true);
      var rows = await pickFileAndParse();
      if (rows.length === 0) { toast.error("Arquivo vazio"); setImporting(false); return; }
      var res = await fetch(BASE_URL + "/companies/" + company.id + "/transactions/batch?partial=true", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ transactions: rows }),
      });
      var data = await res.json();
      if (!res.ok) { toast.error(data.error || "Erro " + res.status); setImporting(false); return; }
      // FIX 24/08/2026 (QA Financeiro A5): antes invalidava so ["transactions"],
      // deixando Health Score, comparativo, banner do mes e Painel com numeros
      // velhos depois de um import de centenas de lancamentos.
      invalidateFinanceiroQueries(qc, company.id);
      toast.success(data.saved > 0 ? data.saved + " lançamentos importados!" + (data.error_count > 0 ? " (" + data.error_count + " com erro)" : "") : "0 lançamentos válidos");
    } catch (err: any) { toast.error("Erro ao importar: " + (err?.message || "tente novamente")); } finally { setImporting(false); }
  }

  function handleSaleCreated() {
    qc.invalidateQueries({ queryKey: ["transactions", company?.id] });
    qc.invalidateQueries({ queryKey: ["dashboard", company?.id] });
    qc.invalidateQueries({ queryKey: ["products", company?.id] });
  }

  // FIX A7 (24/08/2026): havia aqui um guard de consolidado que era
  // inalcancavel — `onEdit` ja chega undefined nesse modo, entao o toast nunca
  // disparava — e que instruia "toque no badge da loja", sendo que o badge em
  // TransactionRow e um View sem onPress. Instrucao falsa em codigo morto.
  function handleEdit(tx: Transaction) {
    setEditTx(tx); setShowModal(true);
  }

  function handleNewTransaction() {
    if (consolidatedView) {
      toast.error("Escolha uma empresa no seletor para criar lançamentos");
      return;
    }
    setEditTx(null); setShowModal(true);
  }

  var contentStyle = {
    padding: layout.padding,
    paddingBottom: 48,
    maxWidth: layout.maxWidth as any,
    alignSelf: "center" as const,
    width: "100%" as const,
  };

  // Redirect em andamento: nao pinta a tela por baixo (evita flash).
  if (redirecting) return <View style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1 }}>
      <WebPortal active={showModal}>
        <TransactionModal
          visible={showModal}
          onClose={function() { setShowModal(false); setEditTx(null); }}
          onSave={createTransaction}
          onSaleCreated={handleSaleCreated}
          editTransaction={editTx}
        />
      </WebPortal>
      <WebPortal active={showExport}>
        <ExportDreModal
          visible={showExport}
          onClose={function() { setShowExport(false); }}
          consolidated={!!consolidatedView}
          companyName={company?.name || ""}
          companyCount={companyCount || 0}
        />
      </WebPortal>
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={contentStyle}>
        <FinanceiroTopbar
          companyName={company?.name || ""}
          consolidated={!!consolidatedView}
          companyCount={companyCount || 0}
          period={period}
          onPeriodChange={handlePeriodChange}
          onExport={function() { setShowExport(true); }}
          onNew={consolidatedView ? undefined : handleNewTransaction}
          embedded={embedded}
        />

        {consolidatedView && (
          <View style={s.consolidatedBanner}>
            <Icon name="globe" size={14} color="#a78bfa" />
            <View style={{ flex: 1 }}>
              <Text style={s.consolidatedTitle}>
                Visão consolidada · {companyCount} empresa{companyCount !== 1 ? "s" : ""}
              </Text>
              <Text style={s.consolidatedSub}>
                Somando os lançamentos de todas as empresas. Para criar ou editar, escolha uma empresa no seletor.
              </Text>
            </View>
          </View>
        )}

        {!consolidatedView && <AgentBanner context="financeiro" />}

        {period === "custom" && (
          <View>
            <View style={[s.customRow, IS_NARROW ? { flexDirection: "column", alignItems: "stretch" } : null]}>
              <View style={s.customField}>
                <Text style={s.customLabel}>De</Text>
                <TextInput style={s.customInput} value={customStartBR} onChangeText={function(v) { setCustomStartBR(maskDateBR(v)); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} accessibilityLabel="Data inicial do período" />
              </View>
              {!IS_NARROW && <Icon name="arrow_right" size={14} color={Colors.ink3} />}
              <View style={s.customField}>
                <Text style={s.customLabel}>Até</Text>
                <TextInput style={s.customInput} value={customEndBR} onChangeText={function(v) { setCustomEndBR(maskDateBR(v)); }} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.ink3} keyboardType="number-pad" maxLength={10} accessibilityLabel="Data final do período" />
              </View>
              {customRangeValid && (
                <View style={s.customOk}>
                  <Icon name="check" size={14} color={Colors.green} />
                </View>
              )}
            </View>
            {customRangeInverted && (
              <Text style={s.customWarn}>A data inicial precisa vir antes da data final.</Text>
            )}
          </View>
        )}

        {showMonthBanner && (
          <MonthExpensesBanner
            count={currentMonthExpenses.count}
            total={currentMonthExpenses.total}
            onSwitchToMonth={function() { setPeriod("month"); }}
          />
        )}

        {consolidatedView && activeTab === TAB_INDEX.visao && breakdownForCard.length > 0 && (
          <ConsolidatedBreakdownCard breakdown={breakdownForCard as any} />
        )}

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 16 }} contentContainerStyle={{ flexDirection: "row", gap: IS_NARROW ? 4 : IS_WIDE ? 8 : 6 }}>
          {TABS.map(function(tab, i) {
            return <Pressable key={tab} onPress={function() { handleTabSelect(i); }} style={[s.tab, IS_NARROW ? s.tabNarrow : null, activeTab === i && s.tabActive, isWeb && { transition: "all 0.15s ease" } as any]}>
              <Text style={[s.tabText, IS_NARROW && s.tabTextNarrow, activeTab === i && s.tabTextActive]}>{tab}</Text>
            </Pressable>;
          })}
        </ScrollView>

        {/* F2 (24/08/2026): a FinanceiroToolbar (Exportar Vendas + Categorizar com
            IA) saiu da Visao Geral. Ela competia com o "Exportar" da Topbar logo
            acima e empurrava o resumo pra baixo. "Categorizar com IA" pertence a
            Lancamentos, que e onde o usuario ve as categorias erradas. */}
        {!isDemo && transactions.length > 0 && activeTab === TAB_INDEX.lancamentos && !consolidatedView && <FinanceiroToolbar uncategorizedDescriptions={uncategorized} />}
        {/* B9: skeleton nao pode coexistir com a aba montada — antes os dois
            renderizavam no primeiro load (heroes zerados sob o skeleton).
            FIX (QA pos-F7): o guard valia so pra Visao Geral; nas outras tres
            abas o skeleton seguia empilhado por cima dos KPIs zerados. */}
        {isLoading && <ListSkeleton rows={4} showCards />}

        {/* FIX A3 (QA pos-F7): o estado de erro tinha sido ligado so na Visao
            Geral. Nas outras abas a falha de rede continuava virando lista
            vazia — e em Lancamentos isso mostrava "Lance sua primeira receita"
            pra quem tem anos de historico, o bug exato que o F0 declarou
            corrigido. Como o erro e da MESMA query pras quatro abas, o lugar
            certo do estado e aqui, uma vez so. */}
        {isError && !isLoading && !isDemo && (
          <EmptyState
            icon="alert"
            iconColor={Colors.amber}
            title="Não conseguimos carregar seus dados"
            subtitle="Verifique sua conexão e tente de novo. Seus lançamentos continuam salvos."
            actionLabel="Tentar de novo"
            onAction={refetch}
          />
        )}

        {activeTab === TAB_INDEX.visao && !isLoading && !isError && (
          <>
            <TabVisaoGeral
              transactions={transactions}
              summary={summary}
              previousSummary={previousSummary}
              period={period}
              customStart={customStart}
              customEnd={customEnd}
              isLoading={isLoading}
              isDemo={isDemo}
              isError={isError}
              onRetry={refetch}
              onNewTransaction={handleNewTransaction}
              onImport={!importing && !consolidatedView ? handleImport : undefined}
              onGoToLancamentos={function() { handleTabSelect(TAB_INDEX.lancamentos); }}
              onGoToDespesas={function() { handleTabSelect(TAB_INDEX.despesas); }}
              onDelete={consolidatedView ? undefined : function(id) { setDeleteTarget(id); }}
              onEdit={!isDemo && !consolidatedView ? handleEdit : undefined}
            />
            {/* F3-3D (29/05/2026): A Receber crediario -- so em empresa individual, Negocio+ */}
            {!consolidatedView && company?.id && !isError && (
              <CrediarioReceivablesCard companyId={company.id} />
            )}
          </>
        )}

        {activeTab === TAB_INDEX.receitas && !isLoading && !isError && (
          <TabReceitas
            transactions={transactions}
            summary={summary}
            previousSummary={previousSummary}
            period={period}
            consolidated={!!consolidatedView}
          />
        )}
        {activeTab === TAB_INDEX.despesas && !isLoading && !isError && (
          <TabDespesas
            transactions={transactions}
            summary={summary}
            previousSummary={previousSummary}
            period={period}
            consolidated={!!consolidatedView}
          />
        )}

        {activeTab === TAB_INDEX.lancamentos && !isLoading && !isError && (
          <TabLancamentos
            transactions={transactions}
            isLoading={isLoading}
            importing={importing}
            onNewTransaction={consolidatedView ? undefined : handleNewTransaction}
            onExport={handleExport}
            onImport={consolidatedView ? undefined : handleImport}
            onDelete={!isDemo && !consolidatedView ? function(id) { setDeleteTarget(id); } : undefined}
            onEdit={!isDemo && !consolidatedView ? handleEdit : undefined}
          />
        )}

        <ConfirmDialog visible={!!deleteTarget} title="Excluir lançamento?" message="Esta ação não pode ser desfeita." confirmLabel="Excluir" destructive onConfirm={function() { if (deleteTarget) { deleteTransaction(deleteTarget); setDeleteTarget(null); } }} onCancel={function() { setDeleteTarget(null); }} />
        {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
      </ScrollView>
    </View>
  );
}

var s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  customRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, backgroundColor: Colors.bg3, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border2 },
  customField: { flex: 1 },
  customLabel: { fontSize: 9, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  customInput: { backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.ink, textAlign: "center" },
  customOk: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.greenD, alignItems: "center", justifyContent: "center" },
  customWarn: { fontSize: 11.5, color: Colors.amber, fontWeight: "600", marginTop: -8, marginBottom: 16, marginLeft: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  tabNarrow: { paddingHorizontal: 8, paddingVertical: 7 },
  tabActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  tabText: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
  tabTextNarrow: { fontSize: 11 },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },

  consolidatedBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "rgba(124,58,237,0.10)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.28)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  consolidatedTitle: { fontSize: 12.5, fontWeight: "700", color: "#c4b5fd", letterSpacing: 0.2 },
  consolidatedSub: { fontSize: 11, color: Colors.ink3, marginTop: 2, lineHeight: 14 },
});
