// ─── FilterPanel ─────────────────────────────────────────────────────────────
// Painel expandivel de filtros pra lista/kanban. State controlado via props.
// ============================================================================

import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { Colors } from "@/constants/colors";
import { crmStyles as cs } from "../shared/styles";
import { PLANS } from "../shared/constants";
import type { LeadListFilters } from "../shared/types";
import type { ExpectedPlan, LeadStatus } from "@/services/crmApi";

type Meta = {
  cities: { name: string; total: number }[];
  categories: { name: string; total: number }[];
};

type Props = {
  filters: LeadListFilters;
  setFilter: <K extends keyof LeadListFilters>(key: K, value: LeadListFilters[K]) => void;
  meta?: Meta;
  activeCount: number;
  onClear: () => void;
};

export function FilterPanel({ filters, setFilter, meta, activeCount, onClear }: Props) {
  return (
    <View style={[cs.section, { marginBottom: 10 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={cs.sectionTitle}>Filtros</Text>
        {activeCount > 0 && (
          <Pressable onPress={onClear}>
            <Text style={{ fontSize: 11, color: Colors.red, fontWeight: "600" }}>Limpar tudo</Text>
          </Pressable>
        )}
      </View>

      {/* Cidade */}
      <Text style={cs.fieldLabel}>Cidade</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <ChipBtn active={!filters.city} onPress={() => setFilter("city", "")}>Todas</ChipBtn>
          {(meta?.cities || []).slice(0, 12).map((c) => (
            <ChipBtn
              key={c.name}
              active={filters.city === c.name}
              onPress={() => setFilter("city", filters.city === c.name ? "" : c.name)}
            >
              {c.name} ({c.total})
            </ChipBtn>
          ))}
        </View>
      </ScrollView>

      {/* Categoria */}
      <Text style={cs.fieldLabel}>Categoria</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <ChipBtn active={!filters.category} onPress={() => setFilter("category", "")}>Todas</ChipBtn>
          {(meta?.categories || []).slice(0, 12).map((c) => (
            <ChipBtn
              key={c.name}
              active={filters.category === c.name}
              onPress={() => setFilter("category", filters.category === c.name ? "" : c.name)}
            >
              {c.name} ({c.total})
            </ChipBtn>
          ))}
        </View>
      </ScrollView>

      {/* Nota minima Google */}
      <Text style={cs.fieldLabel}>Nota Google minima</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {["", "3", "3.5", "4", "4.5"].map((v) => (
            <ChipBtn
              key={v || "todas"}
              active={filters.min_rating === v}
              onPress={() => setFilter("min_rating", v)}
            >
              {v ? "≥ " + v + " ★" : "Todas"}
            </ChipBtn>
          ))}
        </View>
      </ScrollView>

      {/* Score minimo (NOVO Fase 1) */}
      <Text style={cs.fieldLabel}>Score minimo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[
            { v: "", label: "Todos" },
            { v: "15", label: "≥ 15 (acompanhar)" },
            { v: "30", label: "≥ 30 (mornos)" },
            { v: "50", label: "≥ 50 (quentes)" },
          ].map(({ v, label }) => (
            <ChipBtn key={v || "todos-score"} active={filters.min_score === v} onPress={() => setFilter("min_score", v)}>
              {label}
            </ChipBtn>
          ))}
        </View>
      </ScrollView>

      {/* Plano esperado (NOVO Fase 1) */}
      <Text style={cs.fieldLabel}>Plano esperado</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <ChipBtn active={!filters.expected_plan} onPress={() => setFilter("expected_plan", "")}>Todos</ChipBtn>
          {PLANS.map((p) => (
            <ChipBtn
              key={p.key}
              active={filters.expected_plan === p.key}
              onPress={() => setFilter("expected_plan", filters.expected_plan === p.key ? "" : p.key)}
            >
              {p.label}
            </ChipBtn>
          ))}
        </View>
      </ScrollView>

      {/* Rotten (NOVO Fase 1) */}
      <Text style={cs.fieldLabel}>Rotten (sem atividade)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[
            { v: "" as const,      label: "Todos" },
            { v: "false" as const, label: "Ativos" },
            { v: "true" as const,  label: "Rotten" },
          ].map(({ v, label }) => (
            <ChipBtn key={v || "todos-rotten"} active={filters.is_rotten === v} onPress={() => setFilter("is_rotten", v)}>
              {label}
            </ChipBtn>
          ))}
        </View>
      </ScrollView>

      {/* Toggles */}
      <View style={{ gap: 10 }}>
        {[
          { label: "Somente com telefone", val: filters.has_phone,    key: "has_phone"    as const },
          { label: "Follow-up vencido",    val: filters.followup_due, key: "followup_due" as const },
          { label: "Nunca contatados",     val: filters.no_contact,   key: "no_contact"   as const },
        ].map((t) => (
          <View key={t.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 13, color: Colors.ink, fontWeight: "500" }}>{t.label}</Text>
            <Switch
              value={t.val}
              onValueChange={(v) => setFilter(t.key, v as any)}
              trackColor={{ false: Colors.bg4, true: Colors.violet + "66" }}
              thumbColor={t.val ? Colors.violet : Colors.ink3}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function ChipBtn({ active, onPress, children }: { active: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={[cs.chip, active && cs.chipActive]}>
      <Text style={[cs.chipText, active && cs.chipTextActive]}>{children}</Text>
    </Pressable>
  );
}
