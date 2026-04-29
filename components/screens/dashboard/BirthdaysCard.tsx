import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { companiesApi, birthdayApi, type BirthdayCustomer } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { BirthdayCouponModal } from "@/components/BirthdayCouponModal";
import { normalizeBrPhone } from "@/services/messaging";

type Tab = "today" | "week";

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
 */
export function BirthdaysCard() {
  const { company } = useAuthStore();
  const [tab, setTab] = useState<Tab>("today");
  const [modalCustomer, setModalCustomer] = useState<BirthdayCustomer | null>(null);

  // Gate por module_overrides com precedência sobre o plano
  const visible = useMemo(() => {
    if (!company) return false;
    const ov = (company.module_overrides ?? {}) as Record<string, boolean>;
    if (ov.clientes === true) return true;
    if (ov.clientes === false) return false;
    return company.plan === "negocio" || company.plan === "expansao";
  }, [company]);

  const days = tab === "today" ? 0 : 7;

  const birthdaysQuery = useQuery({
    queryKey: ["birthdays", company?.id, days],
    queryFn: () => companiesApi.birthdays(company!.id, days),
    enabled: visible && !!company?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const sentQuery = useQuery({
    queryKey: ["birthday-sent", company?.id],
    queryFn: () => birthdayApi.sentThisYear(company!.id),
    enabled: visible && !!company?.id,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const sentMap = useMemo(() => {
    const map: Record<string, true> = {};
    sentQuery.data?.sent?.forEach((row) => { map[row.customer_id] = true; });
    return map;
  }, [sentQuery.data]);

  if (!visible) return null;

  const customers = birthdaysQuery.data?.customers ?? [];
  const isLoading = birthdaysQuery.isLoading;
  const isError = birthdaysQuery.isError;

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
            <Pressable onPress={() => birthdaysQuery.refetch()} style={s.retryBtn}>
              <Text style={s.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && customers.length === 0 && (
          <EmptyState tab={tab} />
        )}

        {!isLoading && !isError && customers.length > 0 && (
          <View style={s.list}>
            {customers.map((c) => (
              <BirthdayRow
                key={c.id}
                customer={c}
                alreadySent={!!sentMap[c.id]}
                onAction={() => setModalCustomer(c)}
              />
            ))}
          </View>
        )}
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

type RowProps = { customer: BirthdayCustomer; alreadySent: boolean; onAction: () => void };
function BirthdayRow({ customer, alreadySent, onAction }: RowProps) {
  const phoneOk = !!normalizeBrPhone(customer.phone);
  const optedOut = customer.marketing_opt_out === true;
  const initials = (customer.name || "?")
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(p => p[0]).join("").toUpperCase() || "?";

  const dayLabel = customer.is_today
    ? "Hoje 🎂"
    : customer.days_until === 1
      ? "Amanhã"
      : `em ${customer.days_until} dias`;

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
        </View>
      </View>
      <Pressable onPress={onAction} style={s.actionBtn}>
        <Icon name="gift" size={14} color="#fff" />
        <Text style={s.actionText}>Cupom</Text>
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
