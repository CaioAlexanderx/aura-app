// components/screens/financeiro/v2/FinanceiroTopbar.tsx
//
// Topbar nova do Financeiro v2 — combina:
//   - Identidade da empresa (ou "Consolidado · N empresas" em multi-CNPJ)
//   - Período segmentado inline (Hoje · Semana · Mês · Período)
//   - Botões Exportar e Novo lançamento (escondidos em consolidated p/ mutations)
//
// Substitui o ScreenHeader + periodBar legado em app/(tabs)/financeiro.tsx.

import { View, Text, Pressable, StyleSheet, Platform, Dimensions } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import type { PeriodKey } from "../types";
import { PERIODS } from "../types";

var W = Dimensions.get("window").width;
var IS_WIDE = W > 768;
var NARROW = W < 480;
var isWeb = Platform.OS === "web";

type Props = {
  companyName: string;
  consolidated: boolean;
  companyCount: number;
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  // Acoes — em consolidated, "Novo lancamento" some (precisa empresa especifica)
  onExport?: () => void;
  onNew?: () => void;
};

// Subset reduzido pra o Topbar (a Topbar nao mostra todos os 7 — UI muito carregada).
// Periodos avancados (year/prev_year/all) ficam acessiveis no botao "Periodo".
var TOPBAR_PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
];

export function FinanceiroTopbar({ companyName, consolidated, companyCount, period, onPeriodChange, onExport, onNew }: Props) {
  // Periodo "custom" botao traz o periodo customizado (ex.: data inicio/fim).
  // Por enquanto custom abre seletor inline na tela — Topbar so registra clique.
  var isCustomActive = period === "custom" || period === "year" || period === "prev_year" || period === "all";
  var customLabel = period === "year" ? "Ano" : period === "prev_year" ? "Ano ant." : period === "all" ? "Todos" : "Periodo";

  return (
    <View style={[s.bar, { borderBottomColor: Colors.border }]}>
      {/* Esquerda: identidade */}
      <View style={s.left}>
        <Text style={[s.kicker, { color: Colors.ink3 }]}>FINANCEIRO</Text>
        <Text style={[s.dot, { color: Colors.ink3 }]}>·</Text>
        {consolidated ? (
          <View style={[s.consolidatedPill, { backgroundColor: Colors.violetD, borderColor: Colors.border2 }]}>
            <Icon name="globe" size={11} color={Colors.violet3} />
            <Text style={[s.consolidatedText, { color: Colors.violet3 }]}>
              Consolidado · {companyCount} empresa{companyCount !== 1 ? "s" : ""}
            </Text>
          </View>
        ) : (
          <Text style={[s.companyName, { color: Colors.ink }]} numberOfLines={1}>{companyName}</Text>
        )}
      </View>

      {/* Direita: periodo + acoes (em wide). Em mobile, periodo vai abaixo. */}
      {IS_WIDE && (
        <View style={s.right}>
          <PeriodSegmented period={period} onChange={onPeriodChange} customLabel={customLabel} customActive={isCustomActive} />
          {onExport && (
            <Pressable onPress={onExport} style={({ hovered }: any) => [
              s.btnGhost,
              { borderColor: Colors.border, backgroundColor: "transparent" },
              isWeb && hovered ? { borderColor: Colors.violet3 } : null,
              isWeb ? ({ transition: "all 0.2s ease", cursor: "pointer" } as any) : null,
            ]}>
              <Icon name="download" size={13} color={Colors.ink2} />
              <Text style={[s.btnGhostText, { color: Colors.ink2 }]}>Exportar</Text>
            </Pressable>
          )}
          {onNew && !consolidated && (
            <Pressable onPress={onNew} style={({ hovered }: any) => [
              s.btnPrimary,
              { backgroundColor: Colors.violet },
              isWeb && hovered ? { transform: [{ translateY: -1 }] } : null,
              isWeb ? ({ transition: "all 0.2s ease", cursor: "pointer" } as any) : null,
            ]}>
              <Icon name="plus" size={13} color="#fff" />
              <Text style={s.btnPrimaryText}>Novo lancamento</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Mobile: periodo embaixo (linha 2) */}
      {!IS_WIDE && (
        <View style={s.mobileBottom}>
          <PeriodSegmented period={period} onChange={onPeriodChange} customLabel={customLabel} customActive={isCustomActive} compact />
          {onNew && !consolidated && (
            <Pressable onPress={onNew} style={[s.btnPrimary, s.btnPrimaryMobile, { backgroundColor: Colors.violet }]}>
              <Icon name="plus" size={12} color="#fff" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function PeriodSegmented({
  period, onChange, customLabel, customActive, compact,
}: {
  period: PeriodKey;
  onChange: (p: PeriodKey) => void;
  customLabel: string;
  customActive: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[ps.seg, { backgroundColor: Colors.bg, borderColor: Colors.border }]}>
      {TOPBAR_PERIODS.map(function(p) {
        var active = period === p.key;
        return (
          <Pressable key={p.key} onPress={function() { onChange(p.key); }} style={[
            ps.btn,
            compact ? ps.btnCompact : null,
            active ? { backgroundColor: Colors.violet } : null,
            isWeb ? ({ transition: "all 0.15s ease", cursor: "pointer" } as any) : null,
          ]}>
            <Text style={[ps.text, compact ? ps.textCompact : null, { color: active ? "#fff" : Colors.ink2 }, active ? { fontWeight: "700" } : null]}>{p.label}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={function() { onChange("custom"); }} style={[
        ps.btn, ps.btnCustom,
        compact ? ps.btnCompact : null,
        customActive ? { backgroundColor: Colors.violet } : null,
        isWeb ? ({ transition: "all 0.15s ease", cursor: "pointer" } as any) : null,
      ]}>
        <Icon name="calendar" size={11} color={customActive ? "#fff" : Colors.ink2} />
        <Text style={[ps.text, compact ? ps.textCompact : null, { color: customActive ? "#fff" : Colors.ink2 }, customActive ? { fontWeight: "700" } : null]}>{customLabel}</Text>
      </Pressable>
    </View>
  );
}

var s = StyleSheet.create({
  bar: {
    flexDirection: IS_WIDE ? "row" : "column",
    alignItems: IS_WIDE ? "center" : "stretch",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: NARROW ? 16 : 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0, flex: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 10 },
  kicker: { fontSize: 9.5, letterSpacing: 1.2, fontWeight: "600" },
  dot: { fontSize: 12 },
  companyName: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3, flexShrink: 1 },
  consolidatedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  consolidatedText: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.2 },
  mobileBottom: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  btnGhost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnGhostText: { fontSize: 12, fontWeight: "600" },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnPrimaryText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
  btnPrimaryMobile: { paddingHorizontal: 12, paddingVertical: 8 },
});

var ps = StyleSheet.create({
  seg: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    flexShrink: 0,
    flex: NARROW ? 1 : 0,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    flex: NARROW ? 1 : 0,
    justifyContent: "center",
  },
  btnCompact: { paddingHorizontal: 10, paddingVertical: 5 },
  btnCustom: { gap: 4 },
  text: { fontSize: 12, fontWeight: "500" },
  textCompact: { fontSize: 11 },
});

export default FinanceiroTopbar;
