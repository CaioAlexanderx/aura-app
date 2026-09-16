import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { DateInput } from "@/components/inputs/DateInput";
import {
  addMonths, spCurrentMonth, MONTH_NAMES,
  type PeriodKey, type MonthAnchor,
} from "@/utils/vendasPeriodo";

// ============================================================
// AURA. — Barra de filtros de /vendas (I0.6, 16/09/2026)
//
// Extraida de app/(tabs)/vendas.tsx: em telas largas (>=1024px) a tela
// gastava a dobra inteira so com filtros (periodo numa linha, mes
// noutra, status noutra, busca noutra) e a lista de vendas comecava fora
// da tela em 1920x911. A linguagem visual (pilulas) nao mudou — so a
// disposicao: em telas largas periodo+mes+status+busca cabem numa unica
// linha; em telas estreitas mantem a pilha (rotulos incluidos).
//
// Nenhuma mudanca de comportamento dos filtros: mesmas opcoes, mesmos
// callbacks, mesma logica de mes/personalizado.
// ============================================================

export type StatusKey = "all" | "active" | "cancelled";

export const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "custom", label: "Personalizado" },
  { key: "all", label: "Tudo" },
];

export const STATUS_OPTIONS: Array<{ key: StatusKey; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "active", label: "Ativas" },
  { key: "cancelled", label: "Canceladas" },
];

type VendasFiltrosProps = {
  /** true em telas largas (>=1024px): periodo/mes/status/busca numa linha so. */
  wide: boolean;
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  monthAnchor: MonthAnchor;
  onMonthAnchorChange: (m: MonthAnchor) => void;
  customFromBr: string;
  onCustomFromBrChange: (v: string) => void;
  customToBr: string;
  onCustomToBrChange: (v: string) => void;
  onCustomFromIsoChange: (v: string | null) => void;
  onCustomToIsoChange: (v: string | null) => void;
  status: StatusKey;
  onStatusChange: (s: StatusKey) => void;
  search: string;
  onSearchChange: (v: string) => void;
};

export function VendasFiltros(props: VendasFiltrosProps) {
  const {
    wide, period, onPeriodChange, monthAnchor, onMonthAnchorChange,
    customFromBr, onCustomFromBrChange, customToBr, onCustomToBrChange,
    onCustomFromIsoChange, onCustomToIsoChange,
    status, onStatusChange, search, onSearchChange,
  } = props;

  const nowMonth = spCurrentMonth();
  const isCurrentMonth = monthAnchor.y === nowMonth.y && monthAnchor.m === nowMonth.m;

  const periodChips = (
    <View style={s.chipRow} testID="vendas-filtro-periodo">
      {PERIOD_OPTIONS.map(function(opt) {
        const active = period === opt.key;
        return (
          <Pressable key={opt.key} onPress={function() { onPeriodChange(opt.key); }} style={[s.chip, active && s.chipActive]}>
            <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const statusChips = (
    <View style={s.chipRow} testID="vendas-filtro-status">
      {STATUS_OPTIONS.map(function(opt) {
        const active = status === opt.key;
        return (
          <Pressable key={opt.key} onPress={function() { onStatusChange(opt.key); }} style={[s.chip, active && s.chipActive]}>
            <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const monthNav = period === "month" && (
    <View style={wide ? s.monthNavCompact : s.monthNav} testID="vendas-filtro-mes">
      <Pressable
        onPress={function() { onMonthAnchorChange(addMonths(monthAnchor, -1)); }}
        style={s.monthNavBtn}
        accessibilityLabel="Mês anterior"
      >
        <Icon name="chevron_left" size={14} color={Colors.violet3} />
      </Pressable>
      <View style={s.monthNavLabelWrap}>
        <Text style={s.monthNavLabel} numberOfLines={1}>
          {MONTH_NAMES[monthAnchor.m]} de {monthAnchor.y}
        </Text>
        {!isCurrentMonth && (
          <Pressable onPress={function() { onMonthAnchorChange(spCurrentMonth()); }}>
            <Text style={s.monthNavToday}>Voltar pro mês atual</Text>
          </Pressable>
        )}
      </View>
      <Pressable
        onPress={function() { if (!isCurrentMonth) onMonthAnchorChange(addMonths(monthAnchor, 1)); }}
        disabled={isCurrentMonth}
        style={[s.monthNavBtn, isCurrentMonth && s.monthNavBtnDisabled]}
        accessibilityLabel="Próximo mês"
      >
        <Icon name="chevron_right" size={14} color={isCurrentMonth ? Colors.ink3 : Colors.violet3} />
      </Pressable>
    </View>
  );

  const customRow = period === "custom" && (
    <View style={s.customRow} testID="vendas-filtro-personalizado">
      <View style={s.customField}>
        <Text style={s.customLabel}>De</Text>
        <DateInput
          value={customFromBr}
          onChangeText={onCustomFromBrChange}
          onValidChange={onCustomFromIsoChange}
          style={s.customInput}
        />
      </View>
      <View style={s.customField}>
        <Text style={s.customLabel}>Até</Text>
        <DateInput
          value={customToBr}
          onChangeText={onCustomToBrChange}
          onValidChange={onCustomToIsoChange}
          style={s.customInput}
        />
      </View>
    </View>
  );

  const searchBox = (wideStyle?: object) => (
    <View style={[s.searchWrap, wideStyle]} testID="vendas-filtro-busca">
      <Icon name="search" size={13} color={Colors.ink3} />
      <TextInput
        style={s.searchInput}
        value={search}
        onChangeText={onSearchChange}
        placeholder="Buscar cliente ou vendedora…"
        placeholderTextColor={Colors.ink3}
      />
      {search.length > 0 && (
        <Pressable onPress={function() { onSearchChange(""); }} style={s.clearBtn}>
          <Icon name="x" size={11} color={Colors.ink3} />
        </Pressable>
      )}
    </View>
  );

  // ── Telas largas (>=1024px): periodo, mes, status e busca numa linha so.
  // Os rotulos "PERIODO"/"STATUS" somem — o contexto ja fica obvio pelas
  // proprias pilulas ("Hoje", "Ativas" etc). "Personalizado" (2 campos de
  // data) nao cabe na linha e desce pra uma linha propria abaixo.
  if (wide) {
    return (
      <View style={s.filtersWrapWide} testID="vendas-filtros">
        <View style={s.rowWide}>
          {periodChips}
          {monthNav}
          <View style={s.rowDivider} />
          {statusChips}
          {searchBox(s.searchGrow)}
        </View>
        {customRow}
      </View>
    );
  }

  // ── Telas estreitas: pilha (periodo -> mes/personalizado -> status -> busca),
  // com rotulos em caixa alta, igual ao desenho original.
  return (
    <View style={s.filtersWrap} testID="vendas-filtros">
      <View style={s.filterGroup}>
        <Text style={s.filterLabel}>Período</Text>
        {periodChips}
        {monthNav}
        {customRow}
      </View>

      <View style={s.filterGroup}>
        <Text style={s.filterLabel}>Status</Text>
        {statusChips}
      </View>

      {searchBox()}
    </View>
  );
}

const s = StyleSheet.create({
  // Estreito (pilha) — mesmo desenho de antes, so um pouco mais compacto.
  filtersWrap: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 14, gap: 10 },
  filterGroup: { gap: 6 },
  filterLabel: { fontSize: 9.5, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },

  // Largo (linha unica)
  filtersWrapWide: { backgroundColor: Colors.bg3, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, gap: 8 },
  rowWide: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  rowDivider: { width: 1, alignSelf: "stretch", backgroundColor: Colors.border, marginVertical: 2 },
  searchGrow: { flex: 1, minWidth: 220 },

  chipRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.violetD, borderColor: Colors.violet },
  chipText: { fontSize: 11, color: Colors.ink3, fontWeight: "500" },
  chipTextActive: { color: Colors.violet3, fontWeight: "700" },

  // Seletor de mes (period === "month") — versao empilhada
  monthNav: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 6, paddingVertical: 6 },
  // versao compacta, ao lado das pilulas de periodo na linha unica
  monthNavCompact: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.bg4, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 4, paddingVertical: 4 },
  monthNavBtn: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: Colors.violetD, borderWidth: 1, borderColor: Colors.border2 },
  monthNavBtnDisabled: { backgroundColor: Colors.bg3, borderColor: Colors.border },
  monthNavLabelWrap: { alignItems: "center", paddingHorizontal: 4 },
  monthNavLabel: { fontSize: 12.5, color: Colors.ink, fontWeight: "700" },
  monthNavToday: { fontSize: 10, color: Colors.violet3, fontWeight: "600", marginTop: 2 },

  customRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  customField: { flex: 1, gap: 4 },
  customLabel: { fontSize: 9.5, color: Colors.ink3, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  customInput: { backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, color: Colors.ink, fontSize: 12 },

  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 12, color: Colors.ink, paddingVertical: 4 },
  clearBtn: { width: 22, height: 22, borderRadius: 5, backgroundColor: Colors.bg3, alignItems: "center", justifyContent: "center" },
});

export default VendasFiltros;
