// ============================================================
// AURA STUDIO · Gestão / Orçamentos — a lista
//
// 29/09/2026 (modal do orçamento, mockup docs/mockups/studio-orcamento-
// modal.html): a lista continua a página, e "Novo orçamento" e o toque
// numa linha abrem o OrcamentoModal POR CIMA dela. As rotas
// /studio/gestao/orcamentos e /studio/gestao/orcamentos/[id] renderizam
// esta mesma tela; a segunda já abre com o modal do orçamento.
// Multi-CNPJ: no consolidado a lista junta as lojas do grupo, com o chip
// da loja em cada linha, e o orçamento novo pede a loja.
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
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { OrcamentoModal, type LojaDoOrcamento } from "./OrcamentoModal";
import { studioApi, type StudioQuote, type StudioQuoteStatus } from "@/services/studioApi";
import { temAjustePendente, COR_DO_AJUSTE } from "@/components/studio/orcamentoVideo/ajusteDoOrcamento";
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
  // 28/09/2026 (migration 360): a loja fechou sem venda.
  closed:    "Encerrado",
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
  closed:    { bg: "#E2E8F0", text: "#475569" },
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
type Aberto = { cid: string | null; id: string };

export function ListaDeOrcamentos({ abrirId }: { abrirId?: string }) {
  const router        = useRouter();
  const { companyId, company } = useAuth();
  const consolidadoNaConta = useAuthStore((st) => st.consolidatedView);
  const consolidado   = consolidadoNaConta && !companyId;
  const empresas      = useAuthStore((st) => st.availableCompanies);
  const carregarEmpresas = useAuthStore((st) => st.loadCompanies);
  const logoDaLoja    = useAuthStore((st) => st.companyLogo);
  const t             = useStudioTokens();
  const s             = useMemo(() => makeStyles(t), [t]);

  const [quotes, setQuotes]             = useState<StudioQuote[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StudioQuoteStatus | "">("");
  const [aberto, setAberto]             = useState<Aberto | null>(null);

  // As lojas do orçamento: a aberta, ou todas as do grupo no consolidado.
  const lojas: LojaDoOrcamento[] = useMemo(() => {
    if (!consolidado) return company ? [{ id: company.id, name: (company as any).name || "", logo_url: logoDaLoja }] : [];
    return (empresas || []).map((e) => ({ id: e.id, name: e.trade_name || e.name, logo_url: e.logo_url }));
  }, [consolidado, company, empresas, logoDaLoja]);
  const nomeDaLoja = (cid: string) => lojas.find((l) => l.id === cid)?.name || "";
  const idsDasLojas = lojas.map((l) => l.id).join(",");

  useEffect(() => {
    if (consolidado && !(empresas || []).length) carregarEmpresas().catch(() => {});
  }, [consolidado]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    // QA item 12: early return sem setLoading(false) podia travar o
    // skeleton se companyId nunca resolvesse.
    const cids = companyId ? [companyId] : consolidado ? idsDasLojas.split(",").filter(Boolean) : [];
    if (!cids.length) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const listas = await Promise.all(cids.map((cid) => studioApi.listQuotes(cid, {
        status: filterStatus || undefined,
        days:   180,
        limit:  200,
      })));
      const todas = listas.flatMap((l) => l.quotes || []);
      todas.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      setQuotes(todas);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar orçamentos");
    } finally {
      setLoading(false);
    }
  }, [companyId, consolidado, idsDasLojas, filterStatus]);

  useEffect(() => { load(); }, [load]);

  // /orcamentos/[id]: a lista abre já com o modal do orçamento.
  const abriuDaRota = useRef(false);
  useEffect(() => {
    if (!abrirId || abriuDaRota.current) return;
    if (abrirId === "novo" || companyId) {
      abriuDaRota.current = true;
      setAberto({ cid: companyId || (lojas.length === 1 ? lojas[0].id : null), id: abrirId });
      return;
    }
    // Consolidado: a loja vem da linha do orçamento.
    if (loading) return;
    abriuDaRota.current = true;
    const q = quotes.find((x) => x.id === abrirId);
    if (q) setAberto({ cid: q.company_id, id: q.id });
    else toast.info("Não achei esse orçamento nas lojas do grupo");
  }, [abrirId, companyId, loading, quotes, lojas]);

  function abrirNovo() {
    setAberto({ cid: companyId || (lojas.length === 1 ? lojas[0].id : null), id: "novo" });
  }

  function fecharModal() {
    setAberto(null);
    if (abrirId) router.replace("/studio/gestao/orcamentos" as any);
  }

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
    { value: "closed" as const,      label: "Encerrado" },
  ];

  return (
    <StudioScreen variant="reading">
      {/* Header */}
      <StudioPageHeader
        eyebrow="GESTÃO · ORÇAMENTOS"
        title="Orçamentos"
        subtitle="Crie, envie pelo WhatsApp e acompanhe. Aprovado vira pedido na Produção."
        rightSlot={
          <Pressable
            style={s.btnNew}
            onPress={abrirNovo}
            accessibilityRole="button"
            testID="novo-orcamento"
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
          desc="Crie o primeiro orçamento e mande pelo WhatsApp, com o vídeo da peça ou o link."
          primaryCta={{
            label: "Novo orçamento",
            onPress: abrirNovo,
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={s.list}>
          {quotes.map((q) => (
            <Pressable
              key={q.id}
              style={s.card}
              onPress={() => setAberto({ cid: q.company_id, id: q.id })}
              accessibilityRole="button"
              testID={"linha-" + q.id}
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
                {consolidado && lojas.length > 1 ? (
                  <View style={s.chipLoja}><Text style={s.chipLojaTxt} numberOfLines={1}>{nomeDaLoja(q.company_id)}</Text></View>
                ) : null}
                {/* Orçamento em vídeo 3D (28/09/2026): o selo diz que há
                    vídeo guardado para baixar ou mandar de novo. */}
                {q.tem_video ? (
                  <View style={s.seloVideo}>
                    <Icon name="camera" size={11} color={t.accentInk} />
                    <Text style={s.seloVideoTxt}>vídeo</Text>
                  </View>
                ) : null}
                {/* "Cliente pediu ajuste" (362): pedido registrado, ainda não
                    reenviado. O selo toma o lugar do "Rascunho". */}
                {temAjustePendente(q) ? (
                  <View style={[pill.wrap, { backgroundColor: COR_DO_AJUSTE.bg }]}>
                    <Text style={[pill.txt, { color: COR_DO_AJUSTE.text }]}>Ajuste pedido</Text>
                  </View>
                ) : (
                  <StatusPill status={q.status} />
                )}
              </View>

              <View style={s.cardBottom}>
                <Text style={s.cardTotal}>{fmtCurrency(q.total)}</Text>
                <Text style={s.cardDate}>
                  {q.expires_at
                    ? `Válido até ${fmtDate(q.expires_at)}`
                    : `Criado ${fmtDate(q.created_at)}`}
                </Text>
              </View>

              <View style={s.cardArrow} pointerEvents="none">
                <Icon name="chevron-right" size={16} color={t.ink5} />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {aberto ? (
        <OrcamentoModal
          key={(aberto.cid || "sem-loja") + ":" + aberto.id}
          cid={aberto.cid}
          quoteId={aberto.id}
          lojas={lojas}
          consolidado={consolidado && lojas.length > 1}
          logoDaLoja={companyId ? logoDaLoja : null}
          onClose={fecharModal}
          onMudou={() => { load(); }}
        />
      ) : null}
    </StudioScreen>
  );
}

export default ListaDeOrcamentos;

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
    seloVideo: {
      flexDirection: "row", alignItems: "center", gap: 4, marginRight: 6,
      backgroundColor: t.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    },
    seloVideoTxt: { fontSize: 11, fontWeight: "800", color: t.accentInk },
    chipLoja: {
      maxWidth: 160, marginRight: 6, backgroundColor: t.bgSoft, borderWidth: 1, borderColor: t.ink5,
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    },
    chipLojaTxt: { fontSize: 11, fontWeight: "700", color: t.ink2 },
    cardTop:    { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
    cardName:   { fontSize: 15, fontWeight: "700", color: t.ink, flex: 1 },
    cardPhone:  { fontSize: 12, color: t.ink3, marginTop: 2 },
    cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardTotal:  { fontSize: 17, fontWeight: "800", color: t.primary },
    cardDate:   { fontSize: 12, color: t.ink3 },
    // QA item 24: faltava a translateY(-50%) — chevron ficava visivelmente
    // abaixo do centro. marginTop negativo (metade do size=16 do ícone)
    // resolve sem depender de transform percentual (instável em RN).
    cardArrow:  { position: "absolute", right: 14, top: "50%" as any, marginTop: -8 },
  });
}
