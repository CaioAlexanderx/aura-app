import { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { caixaApi, type CaixaSessaoHistorico } from "@/services/caixaApi";

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return "R$ 0,00";
  return "R$ " + value.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDuracao(openedAt: string, closedAt: string | null): string {
  if (!closedAt) return "—";
  const diff = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return h + "h " + m + "min";
  return m + "min";
}

// ── Card de sessão ────────────────────────────────────────────────────────

function SessaoCard({ sessao }: { sessao: CaixaSessaoHistorico }) {
  const [expandida, setExpandida] = useState(false);
  const diff = sessao.diferenca;
  const diffColor = diff === null ? Colors.ink3
    : diff > 0 ? Colors.violet3
    : diff < 0 ? (Colors.red || "#ef4444")
    : Colors.green;

  return (
    <Pressable onPress={function() { setExpandida(!expandida); }} style={sc.card}>
      {/* Cabeçalho sempre visível */}
      <View style={sc.top}>
        <View style={{ flex: 1 }}>
          <Text style={sc.date}>{fmtDateTime(sessao.opened_at)}</Text>
          <Text style={sc.operator}>{sessao.opened_by_name}</Text>
        </View>
        <View style={sc.right}>
          <Text style={sc.total}>{fmt(sessao.total_geral)}</Text>
          {diff !== null && (
            <Text style={[sc.diff, { color: diffColor }]}>
              {diff === 0 ? "Exato" : diff > 0 ? "+" + fmt(diff) : fmt(diff)}
            </Text>
          )}
        </View>
        <Icon name={expandida ? "chevron_up" : "chevron_down"} size={14} color={Colors.ink3} />
      </View>

      {/* Detalhe expandido */}
      {expandida && (
        <View style={sc.detail}>
          <View style={sc.divider} />

          <View style={sc.metaRow}>
            <Text style={sc.metaLabel}>Duração</Text>
            <Text style={sc.metaValue}>{fmtDuracao(sessao.opened_at, sessao.closed_at)}</Text>
          </View>
          <View style={sc.metaRow}>
            <Text style={sc.metaLabel}>Troco inicial</Text>
            <Text style={sc.metaValue}>{fmt(sessao.troco_inicial)}</Text>
          </View>
          {sessao.closed_by_name && (
            <View style={sc.metaRow}>
              <Text style={sc.metaLabel}>Fechado por</Text>
              <Text style={sc.metaValue}>{sessao.closed_by_name}</Text>
            </View>
          )}

          <View style={sc.divider} />

          {/* Breakdown por forma de pagamento */}
          {([
            ["Pix",     sessao.total_pix],
            ["Dinheiro",sessao.total_dinheiro],
            ["Débito",  sessao.total_cartao_debito],
            ["Crédito", sessao.total_cartao_credito],
            ["Fiado",   sessao.total_fiado],
            ["Outros",  sessao.total_outros],
          ] as [string, number | null][]).map(([label, val]) => (
            val !== null && val > 0 ? (
              <View key={label} style={sc.metaRow}>
                <Text style={sc.metaLabel}>{label}</Text>
                <Text style={sc.metaValue}>{fmt(val)}</Text>
              </View>
            ) : null
          ))}

          <View style={sc.divider} />

          {/* Conferência de dinheiro */}
          <View style={sc.metaRow}>
            <Text style={sc.metaLabel}>Esperado em dinheiro</Text>
            <Text style={sc.metaValue}>{fmt(sessao.dinheiro_esperado)}</Text>
          </View>
          <View style={sc.metaRow}>
            <Text style={sc.metaLabel}>Dinheiro contado</Text>
            <Text style={sc.metaValue}>{fmt(sessao.dinheiro_contado)}</Text>
          </View>
          {diff !== null && (
            <View style={sc.metaRow}>
              <Text style={sc.metaLabel}>Diferença</Text>
              <Text style={[sc.metaValue, { color: diffColor, fontWeight: "700" }]}>
                {diff === 0 ? "R$ 0,00 (exato)" : fmt(diff)}
              </Text>
            </View>
          )}

          {sessao.obs_fechamento ? (
            <View style={sc.obs}>
              <Icon name="info" size={12} color={Colors.ink3} />
              <Text style={sc.obsText}>{sessao.obs_fechamento}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const sc = StyleSheet.create({
  card:      { backgroundColor: Colors.bg3, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  top:       { flexDirection: "row", alignItems: "center", gap: 10 },
  date:      { fontSize: 13, fontWeight: "600", color: Colors.ink },
  operator:  { fontSize: 11, color: Colors.ink3, marginTop: 2 },
  right:     { alignItems: "flex-end", gap: 2, marginRight: 6 },
  total:     { fontSize: 14, fontWeight: "700", color: Colors.ink },
  diff:      { fontSize: 11, fontWeight: "600" },
  detail:    { gap: 6, marginTop: 6 },
  divider:   { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  metaRow:   { flexDirection: "row", justifyContent: "space-between" },
  metaLabel: { fontSize: 12, color: Colors.ink3 },
  metaValue: { fontSize: 12, color: Colors.ink, fontWeight: "500" },
  obs:       { flexDirection: "row", gap: 6, alignItems: "flex-start", paddingTop: 4 },
  obsText:   { fontSize: 11, color: Colors.ink3, flex: 1, lineHeight: 16 },
});

// ── Tela ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function CaixaHistoricoScreen() {
  const { company } = useAuthStore();
  const [offset, setOffset] = useState(0);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["caixa-historico", company?.id, offset],
    queryFn: function() {
      if (!company?.id) throw new Error("no company");
      return caixaApi.historico(company.id, { limit: PAGE_SIZE, offset: offset });
    },
    enabled: !!company?.id,
    staleTime: 60_000,
    retry: 1,
  });

  const sessoes = data?.sessoes || [];
  const total   = data?.total   || 0;
  const temMais = offset + PAGE_SIZE < total;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={function() { router.back(); }} style={s.backBtn}>
          <Icon name="chevron_left" size={20} color={Colors.ink} />
        </Pressable>
        <Text style={s.headerTitle}>Histórico de Caixa</Text>
      </View>

      {isLoading && (
        <View style={s.centered}>
          <ActivityIndicator color={Colors.violet3} size="large" />
          <Text style={s.loadingText}>Carregando histórico...</Text>
        </View>
      )}

      {error && (
        <View style={s.errorBox}>
          <Icon name="alert" size={16} color={Colors.red} />
          <Text style={s.errorText}>Erro ao carregar histórico</Text>
          <Pressable onPress={function() { refetch(); }} style={s.retryBtn}>
            <Text style={s.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !error && sessoes.length === 0 && (
        <View style={s.emptyBox}>
          <Icon name="receipt" size={32} color={Colors.ink3} />
          <Text style={s.emptyTitle}>Nenhuma sessão encontrada</Text>
          <Text style={s.emptyDesc}>As sessões fechadas aparecerão aqui</Text>
        </View>
      )}

      {sessoes.length > 0 && (
        <>
          <Text style={s.count}>{total} sessão{total !== 1 ? "ões" : ""} no total</Text>
          <View style={s.list}>
            {sessoes.map(function(sessao) {
              return <SessaoCard key={sessao.id} sessao={sessao} />;
            })}
          </View>

          {/* Paginação */}
          <View style={s.pagination}>
            {offset > 0 && (
              <Pressable onPress={function() { setOffset(Math.max(0, offset - PAGE_SIZE)); }} style={s.pageBtn}>
                <Icon name="chevron_left" size={14} color={Colors.violet3} />
                <Text style={s.pageBtnText}>Anterior</Text>
              </Pressable>
            )}
            {temMais && (
              <Pressable onPress={function() { setOffset(offset + PAGE_SIZE); }} style={[s.pageBtn, s.pageBtnRight]}>
                <Text style={s.pageBtnText}>Próximas</Text>
                <Icon name="chevron_right" size={14} color={Colors.violet3} />
              </Pressable>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen:     { flex: 1 },
  content:    { padding: 20, paddingBottom: 48, maxWidth: 600, alignSelf: "center", width: "100%", gap: 12 },
  centered:   { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  loadingText:{ fontSize: 13, color: Colors.ink3 },
  header:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  backBtn:    { padding: 4 },
  headerTitle:{ fontSize: 20, fontWeight: "700", color: Colors.ink },
  count:      { fontSize: 12, color: Colors.ink3 },
  list:       { gap: 8 },
  emptyBox:   { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: Colors.ink },
  emptyDesc:  { fontSize: 12, color: Colors.ink3 },
  errorBox:   { alignItems: "center", paddingVertical: 32, gap: 10 },
  errorText:  { fontSize: 13, color: Colors.red },
  retryBtn:   { backgroundColor: Colors.violetD, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  retryText:  { fontSize: 13, color: Colors.violet3, fontWeight: "600" },
  pagination: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  pageBtn:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg3, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  pageBtnRight:{ marginLeft: "auto" },
  pageBtnText:{ fontSize: 13, color: Colors.violet3, fontWeight: "600" },
});
