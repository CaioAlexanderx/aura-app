// ============================================================
// AURA STUDIO · Gestão / Orçamentos
//
// Lista de orçamentos do estúdio com status pills coloridos,
// filtro por status (pills horizontais — padrão pedidos.tsx),
// CTA "Novo orçamento" e linha clicável pro editor/detalhe.
//
// P2 (30/05/2026): rotas unificadas sob gestao/orcamentos/
// Editor vive em /studio/gestao/orcamentos/[id].
//
// Agente E (02/06/2026): migrado pra useStudioTokens dark-aware +
// StudioScreen + StudioPageHeader + StudioLoading + StudioEmpty.
// Filtros de status: ScrollView horizontal de pills, espelhando
// o padrão de pedidos.tsx. Lógica de filtragem inalterada.
// ============================================================
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/hooks/useAuth";
import { studioApi, type StudioQuote, type StudioQuoteStatus } from "@/services/studioApi";
import { type StudioPalette } from "@/constants/studio-tokens";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
import { StudioLoading } from "@/components/studio/StudioLoading";
import { StudioEmpty } from "@/components/studio/StudioEmpty";

// ─── Status config ────────────────────────────────────────────
const STATUS_LABEL: Record<StudioQuoteStatus, string> = {
  draft:     "Rascunho",
  sent:      "Enviado",
  accepted:  "Aceito",
  rejected:  "Recusado",
  expired:   "Expirado",
  converted: "Convertido",
};

// Cores estáticas dos pills de status nas linhas (não dependem do theme —
// os chips semânticos são os mesmos no light e dark).
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
  const router        = useRouter();
  const { companyId } = useAuth();
  const t             = useStudioTokens();
  const s             = useMemo(() => makeStyles(t), [t]);

  const [quotes, setQuotes]             = useState<StudioQuote[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StudioQuoteStatus | "">("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await studioApi.listQuotes(companyId, {
        status: filterStatus || undefined,
        days:   180,
        limit:  200,
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

  // ─── Pills de filtro (mesmo padrão de pedidos.tsx) ─────────
  const FILTER_OPTIONS = [
    { value: "" as const,            label: "Todos"     },
    { value: "draft" as const,       label: "Rascunho"  },
    { value: "sent" as const,        label: "Enviado"   },
    { value: "accepted" as const,    label: "Aceito"    },
    { value: "rejected" as const,    label: "Recusado"  },
    { value: "expired" as const,     label: "Expirado"  },
    { value: "converted" as const,   label: "Convertido"},
  ];

  return (
    <StudioScreen variant="reading">
      {/* Header */}
      <StudioPageHeader
        eyebrow="GESTÃO · ORÇAMENTOS"
        title="Orçamentos"
        subtitle="Crie, envie e acompanhe propostas. Orçamentos aceitos convertem em pedidos com um clique."
        rightSlot={
          <Pressable
            style={s.btnNew}
            onPress={() => router.push("/studio/gestao/orcamentos/novo" as any)}
          >
            <Icon name="plus" size={16} color="#fff" />
            <Text style={s.btnNewTxt}>Novo orçamento</Text>
          </Pressable>
        }
      />

      {/* Pills de filtro — horizontal, mesmo padrão de pedidos.tsx */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterBar}
      >
        {FILTER_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value || "all"}
            style={[s.tab, filterStatus === opt.value && s.tabActive]}
            onPress={() => setFilterStatus(opt.value)}
          >
            <Text style={[s.tabTxt, filterStatus === opt.value && s.tabTxtActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Lista */}
      {loading ? (
        <StudioLoading variant="skeleton-list" rows={6} />
      ) : error ? (
        <View style={s.center}>
          <Icon name="alert-circle" size={28} color={t.danger} />
          <Text style={[s.errorTxt, { color: t.dangerInk }]}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={load}>
            <Text style={s.retryTxt}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : quotes.length === 0 ? (
        <StudioEmpty
          icon="file-text"
          title="Nenhum orçamento"
          desc="Crie seu primeiro orçamento e envie o link direto pro cliente aprovar."
          primaryCta={{
            label: "Novo orçamento",
            onPress: () => router.push("/studio/gestao/orcamentos/novo" as any),
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {quotes.map((q) => (
            <Pressable
              key={q.id}
              style={s.card}
              onPress={() => router.push(`/studio/gestao/orcamentos/${q.id}` as any)}
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
                color={t.ink5}
                style={s.cardArrow}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </StudioScreen>
  );
}

function makeStyles(t: StudioPalette) {
  return StyleSheet.create({
    // CTA
    btnNew: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.primary,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 999,
    },
    btnNewTxt: { color: "#fff", fontWeight: "700", fontSize: 13.5 },

    // Pills de filtro — espelho exato de pedidos.tsx (tabs/tab/tabActive/tabTxt/tabTxtActive)
    filterBar: { paddingHorizontal: 20, paddingVertical: 10, gap: 6, flexDirection: "row" },
    tab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: t.bgSoft,
      borderWidth: 1,
      borderColor: t.ink5,
    },
    tabActive:    { backgroundColor: t.primary, borderColor: t.primary },
    tabTxt:       { fontSize: 12.5, color: t.ink2, fontWeight: "600" },
    tabTxtActive: { color: "#fff" },

    // Estados
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
    errorTxt: { fontSize: 14, textAlign: "center" },
    retryBtn: {
      marginTop: 4,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: t.primary,
    },
    retryTxt: { color: "#fff", fontWeight: "700" },

    // Lista
    list: { padding: 14, gap: 10 },

    // Card de orçamento
    card: {
      backgroundColor: t.paperCard,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: t.ink5,
      position: "relative",
    },
    cardTop:    { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
    cardName:   { fontSize: 15, fontWeight: "700", color: t.ink, flex: 1 },
    cardPhone:  { fontSize: 12, color: t.ink3, marginTop: 2 },
    cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardTotal:  { fontSize: 17, fontWeight: "800", color: t.primary },
    cardDate:   { fontSize: 12, color: t.ink3 },
    cardArrow:  { position: "absolute", right: 14, top: "50%" as any },
  });
}
