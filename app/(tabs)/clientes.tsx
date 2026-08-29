import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, Platform, Dimensions, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { useCustomers } from "@/hooks/useCustomers";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImportExportBar } from "@/components/ImportExportBar";
import { Pagination } from "@/components/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { AddCustomerForm } from "@/components/screens/clientes/AddCustomerForm";
import { CustomerRow } from "@/components/screens/clientes/CustomerRow";
import { RankingTab } from "@/components/screens/clientes/RankingTab";
import { RetentionTab } from "@/components/screens/clientes/RetentionTab";
import { fmt } from "@/components/screens/clientes/types";
// 29/08/2026: cabecalho e abas compartilhados com /vendas (padrao do /estoque).
import { ScreenHero, ScreenTabs, type ScreenTabItem } from "@/components/ScreenHero";
import { ListSkeleton } from "@/components/ListSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { pluralize } from "@/utils/plural";
import type { Customer } from "@/components/screens/clientes/types";
import { arrayToCSV, downloadCSV, CUSTOMER_COLUMNS } from "@/utils/csv";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";
import { RetentionCard } from "@/components/RetentionCard";
import { ReviewsList } from "@/components/ReviewsList";
import { ServerImport } from "@/components/ServerImport";
import { Icon } from "@/components/Icon";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;
const PAGE_SIZE = 20;

// PLAN-01 (11/05/2026): UpgradeCard local pras tabs avancadas (Ranking,
// Retencao, Avaliacoes) que sao Negocio+.
function UpgradeCard({ title, description, features }: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <View style={u.wrap}>
      <View style={u.iconWrap}>
        <Icon name="star" size={20} color={Colors.violet3} />
      </View>
      <Text style={u.title}>{title}</Text>
      <Text style={u.desc}>{description}</Text>
      <View style={u.featuresList}>
        {features.map(f => (
          <View key={f} style={u.featureRow}>
            <Icon name="check" size={12} color={Colors.green} />
            <Text style={u.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={() => router.push("/(tabs)/planos")}
        style={u.cta}
      >
        <Text style={u.ctaText}>Conhecer o plano Negócio</Text>
      </Pressable>
      <Text style={u.hint}>A partir de R$ 169/mês — ative quando quiser</Text>
    </View>
  );
}

const u = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: Colors.violetD,
    borderWidth: 1, borderColor: Colors.border2,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: "700", color: Colors.ink, marginBottom: 6, textAlign: "center" },
  desc: { fontSize: 13, color: Colors.ink3, textAlign: "center", marginBottom: 20, lineHeight: 18, maxWidth: 380 },
  featuresList: { gap: 10, marginBottom: 20, alignSelf: "stretch", maxWidth: 380, marginHorizontal: "auto" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 13, color: Colors.ink, flex: 1 },
  cta: {
    backgroundColor: Colors.violet,
    borderRadius: 12,
    paddingHorizontal: 22, paddingVertical: 12,
    marginBottom: 10,
  },
  ctaText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  hint: { fontSize: 11, color: Colors.ink3, textAlign: "center" },
});

// ============================================================
// 29/08/2026 — QA de coerencia entre telas:
//
// 1. Cabecalho: era um "Clientes" de 22px sem-serifa + dois cards
//    genericos. Agora usa o ScreenHero (mesmo cabecalho editorial de
//    /estoque e /vendas), com as metricas na linha de subtitulo — os
//    dois cards saíram porque diziam exatamente isso.
// 2. Abas: continuam em pilula, mas vindas do ScreenTabs compartilhado.
// 3. Estado vazio: mostrava "Nenhum cliente cadastrado" e mais nada —
//    beco sem saida. Ganhou botao de cadastrar + importar CSV.
// 4. CARREGAMENTO (a causa do "0 clientes" do QA): a tela lia isLoading
//    do useCustomers e nunca usava. Enquanto a query estava em voo ela
//    renderizava "TOTAL CLIENTES 0" + "Nenhum cliente cadastrado" com a
//    mesma cara de lista vazia de verdade — e o seletor do PDV, que le
//    O MESMO hook (usePdvState -> useCustomers -> ["customers", companyId]),
//    ja tinha cache quente e listava dezenas. Nao havia divergencia de
//    escopo entre as telas: era estado de carregamento sem skeleton.
// ============================================================
export default function ClientesScreen() {
  const {
    customers, isLoading, isDemo, planBlocked, bulkDeleting,
    addCustomer, updateCustomer, deleteCustomer, bulkDeleteCustomers,
    consolidatedView, companyCount,
    plan, planLimit,
  } = useCustomers();
  const { company } = useAuthStore();
  const qc = useQueryClient();
  const scrollRef = useRef<any>(null);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // feat(dup-prevention, 19/06/2026): estado para cadastro duplicado detectado
  const [dupPending, setDupPending] = useState<{ newCustomer: Customer; existing: Customer } | null>(null);

  // PLAN-01: tabs avancadas (Ranking, Retencao, Avaliacoes) sao Negocio+.
  const isEssencial = plan === "essencial";

  // Formulario de cliente (add e editar) — bottom sheet, mesmo padrao do estoque.
  const formOpen = showAdd || !!editTarget;
  function closeFormModal() { setShowAdd(false); setEditTarget(null); }

  const filtered = customers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.email.toLowerCase().includes(s) || c.instagram.toLowerCase().includes(s);
  });

  const { paginated, page, totalPages, total: filteredTotal, goTo } = usePagination(filtered, PAGE_SIZE, search);
  const totalLtv = customers.reduce((s, c) => s + c.totalSpent, 0);

  const pageIds        = paginated.map(c => c.id);
  const pageAllSelected = pageIds.length > 0 && pageIds.every(id => bulkSelected.has(id));

  const showCompanyBadge = (companyCount || 1) > 1;

  /**
   * Detecta duplicata por telefone (forte) ou nome exato (fraca) na lista
   * local de clientes já carregada. Retorna o cliente existente ou null.
   */
  function findDuplicate(c: Customer): Customer | null {
    const cleanPhone = (c.phone || '').replace(/\D/g, '');
    const normName   = (c.name || '').trim().toLowerCase();

    if (cleanPhone.length >= 10) {
      const byPhone = customers.find(x => (x.phone || '').replace(/\D/g, '') === cleanPhone);
      if (byPhone) return byPhone;
    }
    if (normName.length >= 2) {
      const byName = customers.find(x => (x.name || '').trim().toLowerCase() === normName);
      if (byName) return byName;
    }
    return null;
  }

  function handleAdd(c: Customer) {
    const dup = findDuplicate(c);
    if (dup) {
      // Não fecha o form — aguarda decisão do usuário no ConfirmDialog
      setDupPending({ newCustomer: c, existing: dup });
      return;
    }
    addCustomer(c);
    closeFormModal();
  }

  function handleEdit(c: Customer) { updateCustomer(c.id, c); closeFormModal(); }
  function handleTabSelect(i: number) { setTab(i); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }

  function handleExport() {
    if (customers.length === 0) { toast.error("Nenhum cliente para exportar"); return; }
    downloadCSV(arrayToCSV(customers, CUSTOMER_COLUMNS), `aura_clientes_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function toggleBulkSelect(id: string) {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSelectPage() {
    if (pageAllSelected) {
      setBulkSelected(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setBulkSelected(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.add(id));
        return next;
      });
    }
  }

  function exitBulkMode() { setBulkMode(false); setBulkSelected(new Set()); }

  async function handleBulkDelete() {
    await bulkDeleteCustomers(Array.from(bulkSelected));
    exitBulkMode();
  }

  const bulkConfirmMessage = bulkSelected.size > 50
    ? `Você selecionou ${bulkSelected.size} clientes. Esta ação não pode ser desfeita e pode levar alguns segundos.`
    : "Esta ação não pode ser desfeita. Os clientes selecionados serão removidos permanentemente.";

  const nearLimit = planLimit && planLimit < 999999 && customers.length / planLimit >= 0.85;

  // Mensagem do ConfirmDialog de duplicata
  const dupMessage = dupPending
    ? (() => {
        const existing = dupPending.existing;
        const newC     = dupPending.newCustomer;
        const samePhone =
          (existing.phone || '').replace(/\D/g, '').length >= 10 &&
          (existing.phone || '').replace(/\D/g, '') === (newC.phone || '').replace(/\D/g, '');
        const field = samePhone ? 'telefone' : 'nome';
        return `Já existe um cliente com este ${field}: "${existing.name}"${existing.phone ? ` (${existing.phone})` : ''}. Deseja criar um novo cadastro mesmo assim?`;
      })()
    : '';

  // Abas: rotulos acentuados definidos aqui porque
  // components/screens/clientes/types.ts pertence a outra frente.
  const TABS_CLIENTES: ScreenTabItem[] = [
    { key: "0", label: "Lista" },
    { key: "1", label: "Ranking",    locked: isEssencial },
    { key: "2", label: "Retenção",   locked: isEssencial },
    { key: "3", label: "Avaliações", locked: isEssencial },
  ];

  // Linha de metricas do cabecalho. Enquanto carrega ela nao mente dizendo
  // que a base esta vazia — ver nota 4 no topo do arquivo.
  const heroSub = isLoading
    ? "Carregando sua base de clientes…"
    : customers.length === 0
    ? "Nenhum cliente cadastrado ainda — comece cadastrando um ou importando sua lista."
    : (
      <>
        {pluralize(customers.length, "cliente cadastrado", "clientes cadastrados")}
        {planLimit && planLimit < 999999 ? " de " + planLimit.toLocaleString("pt-BR") + " do plano" : ""}
        {" · "}{fmt(totalLtv)} de faturamento acumulado
      </>
    );

  return (
    <View style={s.wrapper}>
      <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
        {/* 29/08/2026: mesmo cabecalho editorial de /estoque e /vendas. */}
        <ScreenHero
          eyebrow="Base de clientes"
          title="Clientes"
          subtitle={heroSub}
          actions={
            <Pressable onPress={() => { setShowAdd(true); setEditTarget(null); setTab(0); }} style={s.addBtn}>
              <Text style={s.addBtnText}>+ Adicionar cliente</Text>
            </Pressable>
          }
        />

        {showCompanyBadge && (
          <View style={s.consolidatedBanner}>
            <Icon name="users" size={14} color="#a78bfa" />
            <View style={{ flex: 1 }}>
              <Text style={s.consolidatedTitle}>
                {consolidatedView
                  ? `Lista única · ${companyCount} empresas`
                  : `Lista compartilhada entre suas ${companyCount} empresas`}
              </Text>
              <Text style={s.consolidatedSub}>
                Os clientes são do dono, não da loja. Cada cliente aparece uma só vez, mesmo que compre em qualquer das suas empresas.
              </Text>
            </View>
          </View>
        )}

        {nearLimit && (
          <Pressable onPress={() => router.push("/(tabs)/planos")} style={s.nearLimitBanner}>
            <Icon name="alert" size={14} color={Colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={s.nearLimitTitle}>
                {customers.length >= planLimit
                  ? `Limite do plano atingido (${planLimit.toLocaleString("pt-BR")} clientes)`
                  : `Você está perto do limite (${customers.length} / ${planLimit.toLocaleString("pt-BR")})`}
              </Text>
              <Text style={s.nearLimitSub}>Toque para ver opções de upgrade</Text>
            </View>
            <Icon name="chevron_right" size={16} color={Colors.amber} />
          </Pressable>
        )}

        {planBlocked && (
          <View style={s.planBlock}><Text style={s.planBlockText}>Sem acesso ao módulo de clientes neste momento.</Text></View>
        )}

        {tab === 0 && !planBlocked && !isDemo && !consolidatedView && !isEssencial && <RetentionCard />}

        <ScreenTabs
          tabs={TABS_CLIENTES}
          active={String(tab)}
          onSelect={(k) => handleTabSelect(Number(k))}
        />

        {tab === 0 && !planBlocked && !isLoading && customers.length > 0 && (
          <View style={s.importRow}>
            <ImportExportBar onExport={handleExport} itemCount={customers.length} />
            {!consolidatedView && (
              <ServerImport entity="customers" onComplete={() => qc.invalidateQueries({ queryKey: ["customers"] })} />
            )}
            {!bulkMode ? (
              <Pressable onPress={() => setBulkMode(true)} style={s.bulkBtn}>
                <Text style={s.bulkBtnText}>Selecionar</Text>
              </Pressable>
            ) : (
              <Pressable onPress={exitBulkMode} style={[s.bulkBtn, { backgroundColor: Colors.bg4 }]}>
                <Text style={[s.bulkBtnText, { color: Colors.ink3 }]}>Cancelar</Text>
              </Pressable>
            )}
          </View>
        )}

        {bulkMode && (
          <View style={s.bulkBar}>
            <Pressable onPress={handleSelectPage} style={s.bulkAction}>
              <Text style={s.bulkActionText}>
                {pageAllSelected ? "Desmarcar página" : "Pág. atual"}
              </Text>
            </Pressable>

            {bulkSelected.size > 0 ? (
              <>
                <Text style={s.bulkCount}>{pluralize(bulkSelected.size, "selecionado", "selecionados")}</Text>
                <Pressable
                  onPress={() => setShowBulkConfirm(true)}
                  disabled={bulkDeleting}
                  style={[s.bulkAction, s.bulkDeleteAction, bulkDeleting && { opacity: 0.5 }]}
                >
                  {bulkDeleting
                    ? <ActivityIndicator size="small" color={Colors.red} />
                    : <Text style={[s.bulkActionText, { color: Colors.red }]}>Excluir {bulkSelected.size}</Text>
                  }
                </Pressable>
              </>
            ) : (
              <Text style={[s.bulkCount, { color: Colors.ink3, fontWeight: "400" }]}>
                Toque nos clientes para selecionar
              </Text>
            )}
          </View>
        )}

        {/* CARREGANDO — sem isto a tela dizia "Nenhum cliente cadastrado" com a
            query ainda em voo, enquanto o seletor do PDV (mesmo hook, cache
            quente) listava dezenas. Era o "0 clientes" do QA. 29/08/2026. */}
        {tab === 0 && isLoading && <ListSkeleton rows={6} />}

        {tab === 0 && !isLoading && (
          <View>
            {(customers.length > 0 || search.length > 0) && (
              <TextInput style={s.searchInput} placeholder="Buscar por nome, telefone, e-mail ou Instagram…" placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
            )}

            {/* VAZIO DE VERDADE — com saida: cadastrar ou importar. */}
            {customers.length === 0 && !planBlocked && (
              <View style={s.emptyWrap}>
                <EmptyState
                  icon="users"
                  iconColor={Colors.violet3}
                  title="Nenhum cliente cadastrado"
                  subtitle="Cadastre o primeiro cliente ou traga sua lista de outro sistema por CSV. Cliente cadastrado aparece no Caixa pra vincular à venda."
                  actionLabel="Cadastrar primeiro cliente"
                  onAction={() => { setShowAdd(true); setEditTarget(null); }}
                />
                {!consolidatedView && !isDemo && (
                  <View style={s.emptyImport}>
                    <ServerImport entity="customers" onComplete={() => qc.invalidateQueries({ queryKey: ["customers"] })} />
                  </View>
                )}
              </View>
            )}

            {/* Base tem clientes, mas a busca nao achou nenhum. */}
            {customers.length > 0 && filtered.length === 0 && (
              <View style={s.listCard}>
                <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
                  <Text style={{ fontSize: 13, color: Colors.ink3 }}>Nenhum cliente encontrado para “{search}”</Text>
                  <Pressable onPress={() => setSearch("")}>
                    <Text style={{ fontSize: 12, color: Colors.violet3, fontWeight: "600" }}>Limpar busca</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {filtered.length > 0 && (
            <View style={s.listCard}>
              {paginated.map(c => (
                <CustomerRow
                  key={c.id}
                  c={c}
                  expanded={!bulkMode && expandedId === c.id}
                  onToggle={() => !bulkMode && setExpandedId(expandedId === c.id ? null : c.id)}
                  onEdit={!bulkMode ? (customer) => { setEditTarget(customer); setShowAdd(false); } : undefined}
                  onDelete={!bulkMode ? (id) => setDeleteTarget(id) : undefined}
                  isSelected={bulkSelected.has(c.id)}
                  onSelect={bulkMode ? toggleBulkSelect : undefined}
                  showCompanyBadge={showCompanyBadge}
                />
              ))}
            </View>
            )}
            {filtered.length > 0 && (
              <Pagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={PAGE_SIZE} onPage={goTo} />
            )}
          </View>
        )}

        {tab === 1 && (isEssencial ? (
          <UpgradeCard
            title="Ranking de clientes"
            description="Veja seus clientes ordenados por faturamento, visitas e ticket médio. Identifique seus VIPs e quem precisa de atenção."
            features={[
              "Top clientes por LTV (faturamento total)",
              "Top por frequência (número de visitas)",
              "Ticket médio por cliente",
              "Status automático: VIP, Frequente, Novo, Inativo",
            ]}
          />
        ) : <RankingTab customers={customers} />)}

        {tab === 2 && (isEssencial ? (
          <UpgradeCard
            title="Retenção e clientes em risco"
            description="Saiba quem voltou e quem não voltou. Reaja antes de perder um bom cliente."
            features={[
              "Taxa de retenção mensal",
              "Clientes em risco (30 a 90 dias sem comprar)",
              "Clientes perdidos (90+ dias)",
              "Comparativo: novos x voltando",
            ]}
          />
        ) : <RetentionTab />)}

        {tab === 3 && (isEssencial ? (
          <UpgradeCard
            title="Avaliações de clientes"
            description="Receba avaliações após cada compra e construa reputação pública."
            features={[
              "Pedido automático de avaliação após a venda",
              "Resumo: média de estrelas + total de avaliações",
              "Comentários públicos no Canal Digital",
              "Notificação quando você recebe uma avaliação",
            ]}
          />
        ) : <ReviewsList />)}

        {isDemo && <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>}
      </ScrollView>

      {/* === Modais e overlays — fora do ScrollView, mesmo padrao do estoque === */}
      <ConfirmDialog visible={!!deleteTarget} title="Excluir cliente?" message="Esta ação não pode ser desfeita." confirmLabel="Excluir" destructive
        onConfirm={() => { if (deleteTarget) { deleteCustomer(deleteTarget); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)} />

      <ConfirmDialog
        visible={showBulkConfirm}
        title={"Excluir " + pluralize(bulkSelected.size, "cliente", "clientes")}
        message={bulkConfirmMessage}
        confirmLabel="Confirmar exclusão"
        destructive
        onConfirm={() => { setShowBulkConfirm(false); handleBulkDelete(); }}
        onCancel={() => setShowBulkConfirm(false)}
      />

      {/* ConfirmDialog de duplicata — aparece por cima do form (formOpen mantido) */}
      <ConfirmDialog
        visible={!!dupPending}
        title="Cliente já cadastrado"
        message={dupMessage}
        confirmLabel="Criar mesmo assim"
        onConfirm={() => {
          if (dupPending) { addCustomer(dupPending.newCustomer); closeFormModal(); }
          setDupPending(null);
        }}
        onCancel={() => setDupPending(null)}
      />

      {/* Bottom sheet de formulario (add e editar) — mesmo padrao de formOverlay/formSheet do estoque.tsx */}
      {formOpen && (
        <Pressable style={s.formOverlay} onPress={closeFormModal}>
          <Pressable style={s.formSheet} onPress={() => {}}>
            <View style={s.formHandle} />
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              <AddCustomerForm
                initialData={editTarget || undefined}
                onSave={editTarget ? handleEdit : handleAdd}
                onCancel={closeFormModal}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper:          { flex: 1, position: "relative" },
  screen:           { flex: 1, backgroundColor: "transparent" },
  content:          { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  addBtn:           { backgroundColor: Colors.violet, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  addBtnText:       { color: "#fff", fontSize: 13, fontWeight: "700" },
  planBlock:        { backgroundColor: Colors.amberD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.amber + "44" },
  planBlockText:    { fontSize: 12, color: Colors.amber, fontWeight: "500" },
  // 29/08/2026: cards de resumo e estilos de aba sairam daqui — as metricas
  // foram pro subtitulo do ScreenHero e as abas vem do ScreenTabs.
  importRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" },
  bulkBtn:          { backgroundColor: Colors.violetD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: Colors.border2 },
  bulkBtnText:      { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  bulkBar:          { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.violetD, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border2, flexWrap: "wrap" },
  bulkCount:        { fontSize: 13, color: Colors.violet3, fontWeight: "700", flex: 1 },
  bulkAction:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  bulkDeleteAction: { backgroundColor: Colors.redD, borderColor: Colors.red + "33" },
  bulkActionText:   { fontSize: 12, color: Colors.violet3, fontWeight: "600" },
  searchInput:      { backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, color: Colors.ink, marginBottom: 16 },
  emptyWrap:        { backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, paddingBottom: 24, marginBottom: 8 },
  emptyImport:      { alignItems: "center", marginTop: -8 },
  listCard:         { backgroundColor: Colors.bg3, borderRadius: 16, padding: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  demoBanner:       { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 },
  demoText:         { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  // MULTICNPJ Onda 2.3
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
  // PLAN-01: banner near-limit
  nearLimitBanner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: Colors.amberD,
    borderWidth: 1,
    borderColor: Colors.amber + "44",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  nearLimitTitle: { fontSize: 13, color: Colors.amber, fontWeight: "700" },
  nearLimitSub: { fontSize: 11, color: Colors.amber, opacity: 0.85, marginTop: 1 },
  // Bottom sheet — mesmo padrao formOverlay/formSheet do estoque.tsx (08/05/2026)
  formOverlay: {
    position: (Platform.OS === "web" ? "fixed" : "absolute") as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 100,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  formSheet: {
    backgroundColor: Colors.bg3,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "88%",
    width: "100%",
    maxWidth: 640,
  },
  formHandle: {
    width: 40, height: 4,
    backgroundColor: Colors.border2,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
});
