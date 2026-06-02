// ============================================================
// AURA STUDIO · PDV — chrome (Fase 6): Hero, KPI strip, Toolbar.
// ============================================================
import { View, Text, ScrollView, TextInput, Pressable, Platform } from "react-native";
import type { StudioPalette } from "@/contexts/StudioThemeMode";
import { KpiCard, StationPill, money } from "./ui";
import { Ic } from "./icons";
import type { DayStats } from "./types";

const HERO_GRAD = "linear-gradient(115deg, #1E3A8A 0%, #4338CA 45%, #DB2777 100%)";
const MAX = 1280;

export function Hero({
  t, operatorName, dateLabel, timeLabel, stats, hasStats, xPad,
}: {
  t: StudioPalette; operatorName: string; dateLabel: string; timeLabel: string;
  stats: DayStats; hasStats: boolean; xPad: number;
}) {
  return (
    <View
      style={[
        { paddingHorizontal: xPad, paddingTop: 22, paddingBottom: 22, backgroundColor: t.primary },
        Platform.OS === "web" ? ({ background: HERO_GRAD } as any) : {},
      ]}
    >
      <View style={{ maxWidth: MAX, alignSelf: "center", width: "100%", flexDirection: "row", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399" }} />
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1.1, color: "rgba(255,255,255,0.85)", textTransform: "uppercase" }}>
              Caixa · estação aberta
            </Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: "800", color: "#fff", marginTop: 5, lineHeight: 32 }}>
            Caixa do estúdio
          </Text>
          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.78)", marginTop: 4, textTransform: "capitalize" }}>
            {dateLabel}
          </Text>
          <StationPill label={`${operatorName} · ${timeLabel}`} />
        </View>
        {hasStats && (
          <View style={{ flexDirection: "row", gap: 24, alignItems: "flex-start" }}>
            <View>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>Faturamento hoje</Text>
              <Text style={{ fontSize: 24, color: "#fff", fontWeight: "800" }}>R$ {money(stats.faturamento_hoje)}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>Pedidos hoje</Text>
              <Text style={{ fontSize: 24, color: "#fff", fontWeight: "800" }}>{stats.pedidos_hoje}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

export function KpiStrip({ t, stats, xPad }: { t: StudioPalette; stats: DayStats; xPad: number }) {
  return (
    <View style={{ paddingHorizontal: xPad, paddingTop: 14 }}>
      <View style={{ maxWidth: MAX, alignSelf: "center", width: "100%" }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
          <KpiCard t={t} icon="receipt" tone="primary" label="Pedidos hoje" value={String(stats.pedidos_hoje)} />
          <KpiCard t={t} icon="dollar" tone="success" label="Faturamento hoje" value={`R$ ${money(stats.faturamento_hoje)}`} />
          <KpiCard t={t} icon="palette" tone="warn" label="Aguardando arte" value={String(stats.aguardando_arte)} />
          <KpiCard t={t} icon="package" tone="accent" label="Em produção" value={String(stats.em_producao)} />
        </ScrollView>
      </View>
    </View>
  );
}

export function Toolbar({
  t, query, setQuery, scanStatus, xPad,
}: {
  t: StudioPalette; query: string; setQuery: (s: string) => void;
  scanStatus: { tone: "ok" | "hit" | "miss"; text: string }; xPad: number;
}) {
  const scanColor = scanStatus.tone === "miss" ? t.danger : scanStatus.tone === "hit" ? t.accentInk : t.success;
  return (
    <View style={{ paddingHorizontal: xPad, paddingTop: 16 }}>
      <View style={{ maxWidth: MAX, alignSelf: "center", width: "100%", flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View
          style={{
            flex: 1, minWidth: 220, flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: t.paperCardElev, borderRadius: 12, borderWidth: 1, borderColor: t.ink5,
            paddingHorizontal: 12,
          }}
        >
          <Ic name="search" size={19} color={t.ink3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar produto, código ou SKU…"
            placeholderTextColor={t.ink3}
            style={{ flex: 1, color: t.ink, fontSize: 13.5, paddingVertical: 12, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) }}
          />
        </View>
        <View
          style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            backgroundColor: t.paperCardElev, borderRadius: 12, borderWidth: 1, borderColor: t.ink5,
            paddingHorizontal: 12, paddingVertical: 8,
          }}
        >
          <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: t.successSoft, alignItems: "center", justifyContent: "center" }}>
            <Ic name="barcode" size={20} color={t.success} />
          </View>
          <View>
            <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "600" }}>Leitor de código</Text>
            <Text style={{ fontSize: 12, color: scanColor, fontWeight: "700" }} numberOfLines={1}>
              {scanStatus.text}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
