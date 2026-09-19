import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { companiesApi, birthdayApi, type BirthdayCustomer } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { BirthdayCouponModal } from "@/components/BirthdayCouponModal";
// Fase 8: o parabéns pode sair sozinho pelo WhatsApp oficial. O
// interruptor mora aqui, ao lado da lista que ele afeta — e não numa
// tela de configuração que ninguém abre.
import { AniversarioAutoCard } from "@/components/whatsapp/AniversarioAutoCard";
import { normalizeBrPhone } from "@/services/messaging";
// 01/09/2026: helper compartilhado de plural — a linha dizia "em 1 dias".
import { pluralize } from "@/utils/plural";
// MULTICNPJ Fase 1 (C1.8): no consolidado não existe endpoint de
// aniversariantes agregado. /me/customers já traz `birth_date` por
// cliente de todas as lojas do dono — dá para montar a mesma lista sem
// chamada nova (e sem uma chamada por loja: ver nota grande abaixo).
import { meAggregatesApi, type ConsolidatedCustomer } from "@/services/meAggregates";
import { toast } from "@/components/Toast";

type Tab = "today" | "week";

/** Aniversariante calculado no front (consolidado) — mesmo shape de
 * BirthdayCustomer, com a loja de origem a mais. */
export type ConsolidatedBirthdayCustomer = BirthdayCustomer & {
  company_id: string | null;
  company_name: string | null;
};

/**
 * Próximo aniversário a partir de uma data ISO ("YYYY-MM-DD..."),
 * ignorando o ano (aniversário se repete). `null` sem data válida.
 * Cálculo puro — sem rede, sem React — mesma disciplina de
 * diasSemComprar.ts, para poder testar sem mock.
 */
export function proximoAniversario(
  birthDate: string | null | undefined,
  agora: number = Date.now()
): { diasAte: number; isToday: boolean } | null {
  if (!birthDate) return null;
  const datePart = String(birthDate).split("T")[0];
  const partes = datePart.split("-").map(Number);
  if (partes.length !== 3) return null;
  const [, mes, dia] = partes;
  if (!Number.isFinite(mes) || !Number.isFinite(dia) || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const hoje = new Date(agora);
  const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  let proximo = new Date(hoje.getFullYear(), mes - 1, dia).getTime();
  if (proximo < hojeZero) proximo = new Date(hoje.getFullYear() + 1, mes - 1, dia).getTime();

  const diasAte = Math.round((proximo - hojeZero) / 864e5);
  return { diasAte, isToday: diasAte === 0 };
}

/**
 * Monta a lista de aniversariantes (próximos `days` dias) a partir da
 * lista consolidada de clientes (/me/customers) — sem chamada por loja
 * nem por cliente. Ordenada por proximidade, como o backend já devolve
 * para o modo single-company.
 */
export function birthdaysFromConsolidatedCustomers(
  customers: ConsolidatedCustomer[],
  days: number,
  agora: number = Date.now()
): ConsolidatedBirthdayCustomer[] {
  const out: ConsolidatedBirthdayCustomer[] = [];
  for (const c of customers || []) {
    const info = proximoAniversario(c.birth_date, agora);
    if (!info || info.diasAte > days) continue;
    out.push({
      id: c.id,
      name: c.name || "Cliente",
      phone: c.phone || null,
      email: c.email || null,
      birth_date: c.birth_date,
      total_purchases: c.visits ?? c.visit_count ?? 0,
      total_spent: c.total_spent ?? c.totalSpent ?? 0,
      days_until: info.diasAte,
      is_today: info.isToday,
      // Sem opt-out aqui de propósito: a ação real (enviar) só acontece
      // depois de trocar para a loja de origem, onde o dado vem certo do
      // backend — nunca se envia a partir desta lista aproximada.
      marketing_opt_out: undefined,
      company_id: c.company_id || null,
      company_name: c.company_name || null,
    });
  }
  out.sort((a, b) => a.days_until - b.days_until);
  return out;
}

/**
 * BirthdaysCard — quadro de aniversariantes no painel violeta.
 *
 * Tabs:
 *   - "Hoje"        → days=0
 *   - "Próximos 7"  → days=7
 *
 * Cada linha mostra cliente + dias até + status (✓ enviado | sem telefone | opt-out)
 * e um botão "Cupom" que abre o modal de criação/envio.
 *
 * Gate: aparece só se módulo "clientes" estiver visível
 * (precedência: company.module_overrides.clientes > plan default).
 *
 * Decisão de produto: o modal único agrega "criar cupom" e
 * "criar + enviar", evitando dois caminhos paralelos no painel.
 *
 * MULTICNPJ Fase 1 (C1.8) — este card sumia inteiro no consolidado
 * (`!consolidatedView` em app/(tabs)/index.tsx). O motivo não era um
 * limite técnico forte: `company` fica `null` em modo consolidado
 * (stores/auth.ts), e todo o card girava em torno de `company.id`
 * (aniversariantes, "já enviado", módulo, e o cupom em si).
 *
 * O que muda agora, só no consolidado:
 * 1. Gate por módulo: sem `company.module_overrides` por loja no
 *    switcher (SwitcherCompany não carrega isso), o gate vira "alguma
 *    das empresas do dono está no Negócio ou Expansão" — mesma régua de
 *    fallback que o modo single-company já usava.
 * 2. Lista de aniversariantes: computada de /me/customers (via
 *    useCustomers-like, `meAggregatesApi.customers()`), que já tem
 *    `birth_date` por cliente de TODAS as lojas — nenhuma chamada nova.
 *    Cada aniversariante mostra a loja de origem (`company_name`).
 * 3. "Já enviado este ano": aproximado — fica de fora no consolidado.
 *    `birthdayApi.sentThisYear` é por empresa; somar isso exigiria uma
 *    chamada por loja (não por cliente, mas ainda assim uma chamada a
 *    mais por card só para pintar um selo). Documentado aqui em vez de
 *    inventado: o selo "Enviado" não aparece no consolidado.
 * 4. Ação "Cupom": BirthdayCouponModal usa `company` do auth store do
 *    início ao fim (settings, status do WhatsApp, criar cupom, enviar) —
 *    e module está FORA do escopo desta mudança. Abri-lo direto no
 *    consolidado mandaria a chamada para a empresa errada (ou para
 *    nenhuma, com `company` null). Em vez disso, o botão troca o
 *    contexto para a loja do cliente (`switchCompany`, já usado pelo
 *    app para isso — ver RequireCompanyScope) e a pessoa clica de novo
 *    já na loja certa, com o modal funcionando como sempre funcionou.
 */
export function BirthdaysCard() {
  const { company, consolidatedView, availableCompanies, switchCompany } = useAuthStore();
  const [tab, setTab] = useState<Tab>("today");
  const [modalCustomer, setModalCustomer] = useState<BirthdayCustomer | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Gate por module_overrides com precedência sobre o plano (single-company).
  // No consolidado não há module_overrides por loja no switcher — cai no
  // fallback por plano, testando todas as empresas do dono.
  const visible = useMemo(() => {
    if (consolidatedView) {
      return (availableCompanies || []).some((c) => c.plan === "negocio" || c.plan === "expansao");
    }
    if (!company) return false;
    const ov = (company.module_overrides ?? {}) as Record<string, boolean>;
    if (ov.clientes === true) return true;
    if (ov.clientes === false) return false;
    return company.plan === "negocio" || company.plan === "expansao";
  }, [company, consolidatedView, availableCompanies]);

  const days = tab === "today" ? 0 : 7;

  const birthdaysQuery = useQuery({
    queryKey: ["birthdays", company?.id, days],
    queryFn: () => companiesApi.birthdays(company!.id, days),
    enabled: visible && !consolidatedView && !!company?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const sentQuery = useQuery({
    queryKey: ["birthday-sent", company?.id],
    queryFn: () => birthdayApi.sentThisYear(company!.id),
    enabled: visible && !consolidatedView && !!company?.id,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const sentMap = useMemo(() => {
    const map: Record<string, true> = {};
    sentQuery.data?.sent?.forEach((row) => { map[row.customer_id] = true; });
    return map;
  }, [sentQuery.data]);

  // Mesma queryKey que useCustomers() usa no consolidado ("customers",
  // "me", "name") — se a lista de Clientes já foi visitada nesta sessão,
  // reaproveita o cache em vez de buscar de novo.
  const consolidatedQuery = useQuery({
    queryKey: ["customers", "me", "name"],
    queryFn: () => meAggregatesApi.customers(),
    enabled: visible && consolidatedView,
    staleTime: 30000,
  });

  const consolidatedCustomers = useMemo(
    () => birthdaysFromConsolidatedCustomers(consolidatedQuery.data?.customers ?? [], days),
    [consolidatedQuery.data, days]
  );

  if (!visible) return null;

  const customers: BirthdayCustomer[] = consolidatedView
    ? consolidatedCustomers
    : birthdaysQuery.data?.customers ?? [];
  const isLoading = consolidatedView ? consolidatedQuery.isLoading : birthdaysQuery.isLoading;
  const isError = consolidatedView ? consolidatedQuery.isError : birthdaysQuery.isError;

  function abrirAcao(c: BirthdayCustomer) {
    const companyId = (c as ConsolidatedBirthdayCustomer).company_id;
    if (consolidatedView && companyId) {
      // A ação real (criar/enviar cupom) precisa da loja certa — o modal
      // é escopo fora desta mudança e depende de `company` do store.
      // Troca o contexto e deixa a pessoa clicar de novo já na loja dela.
      setSwitchingId(c.id);
      switchCompany(companyId).catch((err: any) => {
        setSwitchingId(null);
        toast.error(err?.message || "Não foi possível trocar de loja");
      });
      return;
    }
    setModalCustomer(c);
  }

  return (
    <>
      <View style={s.panel}>
        {/* Header: título + tabs */}
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.titleRow}>
              <Icon name="cake" size={16} color={Colors.violet} />
              <Text style={s.title}>Aniversariantes</Text>
              {customers.length > 0 && (
                <View style={s.countBadge}>
                  <Text style={s.countBadgeText}>{customers.length}</Text>
                </View>
              )}
            </View>
            <Text style={s.subtitle}>
              {tab === "today" ? "Quem está fazendo aniversário hoje" : "Aniversariantes nos próximos 7 dias"}
            </Text>
          </View>
          <View style={s.tabs}>
            <Pressable onPress={() => setTab("today")} style={[s.tabBtn, tab === "today" && s.tabBtnActive]}>
              <Text style={[s.tabText, tab === "today" && s.tabTextActive]}>Hoje</Text>
            </Pressable>
            <Pressable onPress={() => setTab("week")} style={[s.tabBtn, tab === "week" && s.tabBtnActive]}>
              <Text style={[s.tabText, tab === "week" && s.tabTextActive]}>7 dias</Text>
            </Pressable>
          </View>
        </View>

        {/* Conteúdo */}
        {isLoading && (
          <View style={s.center}>
            <ActivityIndicator color={Colors.violet} />
          </View>
        )}

        {isError && !isLoading && (
          <View style={s.center}>
            <Text style={s.errorText}>Não foi possível carregar a lista.</Text>
            <Pressable
              onPress={() => (consolidatedView ? consolidatedQuery.refetch() : birthdaysQuery.refetch())}
              style={s.retryBtn}
            >
              <Text style={s.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && customers.length === 0 && (
          <EmptyState tab={tab} />
        )}

        {!isLoading && !isError && customers.length > 0 && (
          <View style={s.list}>
            {consolidatedView && (
              <Text style={s.consolidatedNote} testID="birthdays-card-consolidado">
                Somando todas as lojas. "Já enviado este ano" não é calculado aqui — confira na loja.
              </Text>
            )}
            {customers.map((c) => (
              <BirthdayRow
                key={c.id}
                customer={c}
                alreadySent={!!sentMap[c.id]}
                consolidatedCompanyName={consolidatedView ? (c as ConsolidatedBirthdayCustomer).company_name : null}
                switching={switchingId === c.id}
                onAction={() => abrirAcao(c)}
              />
            ))}
          </View>
        )}

        {!consolidatedView && !!company?.id && <AniversarioAutoCard companyId={company.id} />}
      </View>

      <BirthdayCouponModal
        visible={!!modalCustomer}
        onClose={() => setModalCustomer(null)}
        customer={modalCustomer}
        onSuccess={() => {
          birthdaysQuery.refetch();
          sentQuery.refetch();
        }}
      />
    </>
  );
}

export default BirthdaysCard;

// ── Subcomponentes ────────────────────────────────────────
function EmptyState({ tab }: { tab: Tab }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyEmoji}>🎈</Text>
      <Text style={s.emptyTitle}>
        {tab === "today" ? "Nenhum aniversariante hoje" : "Nenhum aniversariante nos próximos 7 dias"}
      </Text>
      <Text style={s.emptySubtitle}>
        {tab === "today"
          ? "Mude pra \"7 dias\" pra ver quem aniversaria essa semana."
          : "Quando aparecer alguém aqui, você pode mandar um cupom em 1 clique."}
      </Text>
    </View>
  );
}

type RowProps = {
  customer: BirthdayCustomer;
  alreadySent: boolean;
  onAction: () => void;
  /** MULTICNPJ: nome da loja de origem — só passado no consolidado. */
  consolidatedCompanyName?: string | null;
  /** Trocando de loja para agir neste cliente (consolidado). */
  switching?: boolean;
};
function BirthdayRow({ customer, alreadySent, onAction, consolidatedCompanyName, switching }: RowProps) {
  const phoneOk = !!normalizeBrPhone(customer.phone);
  const optedOut = customer.marketing_opt_out === true;
  const initials = (customer.name || "?")
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(p => p[0]).join("").toUpperCase() || "?";

  const dayLabel = customer.is_today
    ? "Hoje 🎂"
    : customer.days_until === 1
      ? "Amanhã"
      : "em " + pluralize(customer.days_until, "dia");

  return (
    <View style={s.row}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>{initials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{customer.name}</Text>
          {alreadySent && (
            <View style={s.sentBadge}>
              <Icon name="check" size={10} color={Colors.green} />
              <Text style={s.sentBadgeText}>Enviado</Text>
            </View>
          )}
        </View>
        <View style={s.metaRow}>
          <Text style={s.metaDay}>{dayLabel}</Text>
          {customer.phone && (
            <Text style={s.metaPhone} numberOfLines={1}>{customer.phone}</Text>
          )}
          {!phoneOk && customer.phone && (
            <Text style={s.metaWarn}>fone inválido</Text>
          )}
          {!customer.phone && (
            <Text style={s.metaWarn}>sem fone</Text>
          )}
          {optedOut && <Text style={s.metaWarn}>opt-out</Text>}
          {!!consolidatedCompanyName && (
            <View style={s.companyBadge}>
              <Text style={s.companyBadgeText} numberOfLines={1}>{consolidatedCompanyName}</Text>
            </View>
          )}
        </View>
      </View>
      <Pressable onPress={onAction} style={s.actionBtn} disabled={switching} testID="birthday-row-acao">
        <Icon name={consolidatedCompanyName ? "arrow-right" : "gift"} size={14} color="#fff" />
        <Text style={s.actionText}>
          {switching ? "Trocando…" : consolidatedCompanyName ? "Ir para a loja" : "Cupom"}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────
const s = StyleSheet.create({
  panel: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 20,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  countBadge: {
    backgroundColor: Colors.violet + "22",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 4,
  },
  countBadgeText: { fontSize: 11, color: Colors.violet, fontWeight: "700" },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  tabs: { flexDirection: "row", gap: 4, backgroundColor: Colors.bg4, borderRadius: 10, padding: 3 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tabBtnActive: { backgroundColor: Colors.violet },
  tabText: { fontSize: 12, color: Colors.ink3, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.bg4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.violet + "22",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.violet + "44",
  },
  avatarText: { fontSize: 12, color: Colors.violet, fontWeight: "700" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontSize: 14, color: Colors.ink, fontWeight: "600", flexShrink: 1 },
  sentBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.green + "22",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
  },
  sentBadgeText: { fontSize: 10, color: Colors.green, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" },
  metaDay: { fontSize: 11, color: Colors.violet, fontWeight: "600" },
  metaPhone: { fontSize: 11, color: Colors.ink3, fontVariant: ["tabular-nums"] as any },
  metaWarn: { fontSize: 10, color: "#f59e0b", fontWeight: "600", textTransform: "uppercase" },
  // MULTICNPJ: badge da loja de origem, mesma ideia do showCompanyBadge
  // da lista de clientes — só aparece no consolidado.
  companyBadge: {
    backgroundColor: Colors.violet + "18", borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2, maxWidth: 140,
  },
  companyBadgeText: { fontSize: 9.5, color: Colors.violet3, fontWeight: "700" },
  consolidatedNote: { fontSize: 10.5, color: Colors.violet3, fontWeight: "600", marginBottom: 4 },
  actionBtn: {
    backgroundColor: Colors.violet,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  actionText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  center: { paddingVertical: 40, alignItems: "center" },
  errorText: { fontSize: 13, color: Colors.ink3, marginBottom: 8 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  retryText: { fontSize: 12, color: Colors.violet, fontWeight: "600" },
  empty: { paddingVertical: 32, alignItems: "center", gap: 4 },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: { fontSize: 14, color: Colors.ink, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { fontSize: 12, color: Colors.ink3, textAlign: "center", maxWidth: 320 },
});
