// ============================================================
// AURA STUDIO · Gestão / Orçamentos
//
// Lista de orçamentos do estúdio com status pills coloridos,
// filtro por status, CTA "Novo orçamento" e linha clicável
// pro editor/detalhe.
// ============================================================
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/hooks/useAuth";
import { studioApi, type StudioQuote, type StudioQuoteStatus } from "@/services/studioApi";

// ─── Status pill ─────────────────────────────────────────────
const STATUS_LABEL: Record<StudioQuoteStatus, string> = {
  draft:     "Rascunho",
  sent:      "Enviado",
  accepted:  "Aceito",
  rejected:  "Recusado",
  expired:   "Expirado",
  converted: "Convertido",
};

const STATUS_COLORS: Record<StudioQuoteStatus, { bg: string; text: string }> = {
  draft:     { bg: "#F1F5F9", text: "#64748B" },
  sent:      { bg: "#DBEAFE", text: "#1D4ED8" },
  accepted:  { bg: "#D1FAE5", text: "#065F46" },
  rejected:  { bg: "#FEE2E2", text: "#991B1B" },
  expired:   { bg: "#FEF3C7", text: "#92400E" },
  converted: { bg: "#EDE9FE", text: "#5B21B6" },
};

function StatusPill({ status }: { status: StudioQuoteStatus }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <View style={[pill.wrap, { backgroundColor: c.bg }]}>
      <Text style={[pill.txt, { color: c.text }]}>{STATUS_LABEL[status] || status}</Text>
    </View>
  );
}

const pill = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  txt:  { fontSize: 11, fontWeight: "700" },
});

// ─── Componente principal ────────────────────────────────────
export default function StudioOrcamentosScreen() {
  const router      = useRouter();
  const { companyId } = useAuth();
  const [quotes, setQuotes]   = useState<StudioQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StudioQuoteStatus | "">("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await studioApi.listQuotes(companyId, {
        status: filterStatus || undefined,
        days: 180,
        limit: 200,
      });
      setQuotes(data.quotes);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar orçamentos");
    } finally {
      setLoading(false);
    }
  }, [companyId, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const fmtCurrency = (v: number) =>
    "R$ " + (v || 0).toFixed(2).replace(".", ",");

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("pt-BR") : "—";

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>GESTÃO · ORÇAMENTOS</Text>
          <Text style={s.title}>Orçamentos</Text>
        </View>
        <Pressable
          style={s.btnNew}
          onPress={() => router.push("/studio/orcamentos/novo")}
        >
          <Icon name="plus" size={16} color="#fff" />
          <Text style={s.btnNewTxt}>Novo orçamento</Text>
        </Pressable>
      </View>

      {/* Filtro de status */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterBar}
      >
        {(["", "draft", "sent", "accepted", "rejected", "expired", "converted"] as const).map((st) => (
          <Pressable
            key={st || "all"}
            style={[s.filterChip, filterStatus === st && s.filterChipActive]}
            onPress={() => setFilterStatus(st)}
          >
            <Text style={[s.filterChipTxt, filterStatus === st && s.filterChipTxtActive]}>
              {st === "" ? "Todos" : STATUS_LABEL[st]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Lista */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Icon name="alert-circle" size={28} color="#DC2626" />
          <Text style={s.errorTxt}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={load}>
            <Text style={s.retryTxt}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : quotes.length === 0 ? (
        <View style={s.center}>
          <Icon name="file-text" size={40} color="#CBD5E1" />
          <Text style={s.emptyTitle}>Nenhum orçamento</Text>
          <Text style={s.emptySub}>Crie seu primeiro orçamento</Text>
          <Pressable
            style={s.btnNew}
            onPress={() => router.push("/studio/orcamentos/novo")}
          >
            <Icon name="plus" size={16} color="#fff" />
            <Text style={s.btnNewTxt}>Novo orçamento</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {quotes.map((q) => (
            <Pressable
              key={q.id}
              style={s.card}
              onPress={() => router.push(`/studio/orcamentos/${q.id}`)}
            >
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName} numberOfLines={1}>
                    {q.customer_name || "Cliente não informado"}
                  </Text>
                  {q.customer_phone ? (
                    <Text style={s.cardPhone}>{q.customer_phone}</Text>
                  ) : null}
                </View>
                <StatusPill status={q.status} />
              </View>

              <View style={s.cardBottom}>
                <Text style={s.cardTotal}>{fmtCurrency(q.total)}</Text>
                <Text style={s.cardDate}>
                  {q.expires_at
                    ? `Válido até ${fmtDate(q.expires_at)}`
                    : `Criado ${fmtDate(q.created_at)}`}
                </Text>
              </View>

              <Icon
                name="chevron-right"
                size={16}
                color="#CBD5E1"
                style={s.cardArrow}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const NAVY = "#1E3A8A";
const MAGENTA = "#EC4899";

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  eyebrow: {
    fontSize: 11,
    color: MAGENTA,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: { fontSize: 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.4 },

  btnNew: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: NAVY,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnNewTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },

  filterBar: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  filterChipActive: { backgroundColor: "#EFF6FF", borderColor: NAVY },
  filterChipTxt: { fontSize: 12.5, fontWeight: "600", color: "#64748B" },
  filterChipTxtActive: { color: NAVY },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  errorTxt: { fontSize: 14, color: "#DC2626", textAlign: "center" },
  retryBtn: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: NAVY,
  },
  retryTxt: { color: "#fff", fontWeight: "700" },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A" },
  emptySub: { fontSize: 13, color: "#64748B" },

  list: { padding: 14, gap: 10 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    position: "relative",
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#0F172A", flex: 1 },
  cardPhone: { fontSize: 12, color: "#64748B", marginTop: 2 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTotal: { fontSize: 17, fontWeight: "800", color: NAVY },
  cardDate: { fontSize: 12, color: "#94A3B8" },
  cardArrow: { position: "absolute", right: 14, top: "50%" },
});
