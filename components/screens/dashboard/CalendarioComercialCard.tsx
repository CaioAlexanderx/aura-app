import { useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { companiesApi } from "@/services/api";
import { type CommercialDateRow } from "@/services/companiesApi";
import { useAuthStore } from "@/stores/auth";

/**
 * CalendarioComercialCard — datas que movimentam o comércio, no Painel.
 *
 * Posição: abaixo dos KPIs (Visão geral) e acima da seção Vendas.
 * Mostra a data mais próxima em destaque + as próximas em chips, cada
 * uma classificada por intensidade (1/2/3). Janela de antecedência e
 * ordenação por proximidade vêm prontas do backend
 * (GET /companies/:id/commercial-dates).
 *
 * Intensidade → cor: 1 violeta · 2 âmbar · 3 vermelho (escala de demanda).
 * Disponível em todos os planos; per-company (escondido em consolidado).
 */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function intensityColor(n: number): string {
  if (n >= 3) return Colors.red;
  if (n === 2) return Colors.amber;
  return Colors.violet;
}
function intensityLabel(n: number): string {
  if (n >= 3) return "Nível 3";
  if (n === 2) return "Nível 2";
  return "Nível 1";
}
function dayMonth(dateStr: string): { day: string; mon: string } {
  const p = (dateStr || "").split("-");
  const mon = MESES[(parseInt(p[1], 10) || 1) - 1] || "";
  return { day: String(parseInt(p[2], 10) || "--"), mon: mon };
}
function countdownLabel(days: number): string {
  if (days <= 0) return "É hoje";
  if (days === 1) return "Amanhã";
  return "faltam " + days + " dias";
}

export function CalendarioComercialCard() {
  const { company } = useAuthStore();

  const q = useQuery({
    queryKey: ["commercial-dates", company?.id],
    queryFn: () => companiesApi.commercialDates(company!.id, 400),
    enabled: !!company?.id,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const dates = q.data?.dates ?? [];
  const featured = dates[0];
  const following = useMemo(() => dates.slice(1, 5), [dates]);

  if (q.isLoading) {
    return (
      <View style={[s.panel, s.center]}>
        <ActivityIndicator color={Colors.violet} />
      </View>
    );
  }
  // Sem dados / erro: não polui o Painel.
  if (q.isError || !featured) return null;

  const fc = intensityColor(featured.intensity);
  const fdm = dayMonth(featured.date);

  return (
    <View style={s.panel}>
      <View style={s.header}>
        <View style={s.iconBox}>
          <Icon name="calendar" size={18} color={Colors.violet} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title}>Calendário comercial</Text>
          <Text style={s.subtitle}>Datas que movimentam suas vendas</Text>
        </View>
      </View>

      {/* Data mais próxima — destaque */}
      <View style={[s.featured, { backgroundColor: fc + "14", borderColor: fc + "33" }]}>
        <View style={s.dayBox}>
          <Text style={[s.dayNum, { color: fc }]}>{fdm.day}</Text>
          <Text style={[s.dayMon, { color: fc }]}>{fdm.mon}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.featTitleRow}>
            <Text style={s.featName} numberOfLines={1}>{featured.name}</Text>
            <View style={[s.badge, { backgroundColor: fc + "22" }]}>
              <Text style={[s.badgeText, { color: fc }]}>{intensityLabel(featured.intensity)}</Text>
            </View>
          </View>
          {!!featured.description && (
            <Text style={s.featDesc} numberOfLines={2}>{featured.description}</Text>
          )}
          <View style={s.countdownRow}>
            <Icon name="clock" size={13} color={fc} />
            <Text style={[s.countdownText, { color: fc }]}>{countdownLabel(featured.days_until)}</Text>
          </View>
        </View>
      </View>

      {/* Próximas datas */}
      {following.length > 0 && (
        <View style={s.chips}>
          {following.map((d) => (
            <UpcomingChip key={d.slug} item={d} />
          ))}
        </View>
      )}

      {/* Legenda de intensidade */}
      <View style={s.legend}>
        <Text style={s.legendLabel}>Intensidade</Text>
        <LegendItem color={Colors.violet} text="1 · movimenta" />
        <LegendItem color={Colors.amber} text="2 · muito" />
        <LegendItem color={Colors.red} text="3 · extremo" />
      </View>
    </View>
  );
}

export default CalendarioComercialCard;

function UpcomingChip({ item }: { item: CommercialDateRow }) {
  const c = intensityColor(item.intensity);
  const dm = dayMonth(item.date);
  return (
    <View style={s.chip}>
      <View style={s.bars}>
        <View style={[s.bar, { backgroundColor: item.intensity >= 1 ? c : Colors.border2 }]} />
        <View style={[s.bar, { backgroundColor: item.intensity >= 2 ? c : Colors.border2 }]} />
        <View style={[s.bar, { backgroundColor: item.intensity >= 3 ? c : Colors.border2 }]} />
      </View>
      <Text style={s.chipName} numberOfLines={1}>{item.name}</Text>
      <Text style={s.chipMeta} numberOfLines={1}>{dm.day} {dm.mon} · {item.days_until}d</Text>
    </View>
  );
}

function LegendItem({ color, text }: { color: string; text: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    backgroundColor: Colors.bg3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 20,
    marginBottom: 16,
  },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.violet + "1A",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  subtitle: { fontSize: 12, color: Colors.ink3, marginTop: 1 },

  featured: {
    flexDirection: "row", gap: 14, alignItems: "center",
    borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14,
  },
  dayBox: {
    width: 56, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.bg3, borderRadius: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  dayNum: { fontSize: 22, fontWeight: "700", lineHeight: 24 },
  dayMon: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  featTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  featName: { fontSize: 15, fontWeight: "700", color: Colors.ink, flexShrink: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 4 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  featDesc: { fontSize: 12, color: Colors.ink3, marginTop: 4, marginBottom: 6 },
  countdownRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  countdownText: { fontSize: 12, fontWeight: "600" },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  chip: {
    flexGrow: 1, flexBasis: 140, minWidth: 140,
    backgroundColor: Colors.bg4, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 12,
  },
  bars: { flexDirection: "row", gap: 3, marginBottom: 8 },
  bar: { flex: 1, height: 4, borderRadius: 999 },
  chipName: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  chipMeta: { fontSize: 11, color: Colors.ink3, marginTop: 2 },

  legend: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  legendLabel: { fontSize: 11, color: Colors.ink3 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 16, height: 4, borderRadius: 999 },
  legendText: { fontSize: 11, color: Colors.ink3 },
});
