// ============================================================
// Saúde da Rede — Standing da rede (Fase 6) · Shoji
//
// Drill-down segmentado do "standing" agregado: praticantes
// ativos/inativos, faixas-pretas em dia/atrasadas (+ R$ em aberto) e
// dojôs por situação financeira. Fonte ÚNICA: GET
// /federation/:id/standing/summary (karateApi.getStandingSummary),
// a MESMA usada no bloco de KPIs do Painel — nada é recomputado aqui.
//
// Mantido em arquivo próprio (mesmo critério dos demais Tracks de
// Saúde da Rede) para reduzir conflito de merge com MetricCards.tsx.
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import {
  KarateColors as C, ShojiPalette as P,
} from "@/constants/karateTheme";
import { StandingSummary } from "@/services/karateApi";
import { st, fmtBRL, fmtPct, Sk, SectionRow, FadeIn } from "./shared";

type CardCallbacks = { onDetail?: () => void };

type Segment = { label: string; n: number; color: string };

function SegmentedBar({ segments, total }: { segments: Segment[]; total: number }) {
  if (total <= 0) {
    return (
      <View style={[st.stackBarWrap, { backgroundColor: "rgba(43,38,32,0.06)" }]} />
    );
  }
  return (
    <View style={st.stackBarWrap}>
      {segments.map((seg) => (
        <View
          key={seg.label}
          style={[
            st.stackBarSeg,
            { flex: seg.n / total, backgroundColor: seg.color, opacity: seg.n === 0 ? 0 : 1 },
          ]}
        />
      ))}
    </View>
  );
}

function SegmentLegend({ segments, total, unit }: { segments: Segment[]; total: number; unit: string }) {
  return (
    <>
      {segments.map((seg) => (
        <View key={seg.label} style={st.inadLegendRow}>
          <View style={[st.inadDot, { backgroundColor: seg.color }]} />
          <Text style={[st.inadLegLabel, { flex: 1 }]}>{seg.label}</Text>
          <Text style={st.inadLegN}>{seg.n} {unit}</Text>
          <Text style={st.inadLegPct}>{total > 0 ? fmtPct((seg.n / total) * 100) : "—"}</Text>
        </View>
      ))}
    </>
  );
}

// Subseção com título discreto + barra segmentada + legenda.
function StandingSection({
  title, segments, total, unit, meta,
}: { title: string; segments: Segment[]; total: number; unit: string; meta?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: "System", fontSize: 12, fontWeight: "700", color: C.ink2 }}>{title}</Text>
        {meta ? <Text style={{ fontFamily: "System", fontSize: 11, color: C.ink3 }}>{meta}</Text> : null}
      </View>
      <SegmentedBar segments={segments} total={total} />
      <SegmentLegend segments={segments} total={total} unit={unit} />
    </View>
  );
}

export function StandingCard({
  data, loading, onDetail,
}: { data: StandingSummary | null; loading: boolean } & CardCallbacks) {
  const isEmpty = !loading && !!data
    && data.praticantes.total === 0
    && data.pretas.total === 0
    && data.dojos.ativos === 0 && data.dojos.em_dia === 0 && data.dojos.atrasado === 0 && data.dojos.inativos === 0;

  return (
    <View style={st.card}>
      <SectionRow
        title="Standing da rede"
        sub="Situação ativa/inativa e financeira de praticantes, faixas-pretas e dojôs"
        onDetail={onDetail}
        csvData={data ? {
          filename: "standing-rede",
          headers: ["Indicador", "Valor"],
          rows: [
            ["Praticantes ativos", String(data.praticantes.ativos)],
            ["Praticantes inativos", String(data.praticantes.inativos)],
            ["Pretas em dia", String(data.pretas.em_dia)],
            ["Pretas atrasadas", String(data.pretas.atrasado)],
            ["Pretas · R$ em aberto", fmtBRL(data.pretas.valor_em_aberto)],
            ["Dojôs ativos", String(data.dojos.ativos)],
            ["Dojôs em dia", String(data.dojos.em_dia)],
            ["Dojôs atrasados", String(data.dojos.atrasado)],
            ["Dojôs inativos", String(data.dojos.inativos)],
          ],
        } : undefined}
      />
      {loading || !data ? (
        <><Sk h={36} mb={8} /><Sk h={120} /></>
      ) : isEmpty ? (
        <View style={{ paddingVertical: 20, alignItems: "center" }}>
          <Text style={{ fontFamily: "System", fontSize: 12, color: C.ink4 }}>Sem dados de standing ainda.</Text>
        </View>
      ) : (
        <FadeIn style={{ gap: 18 }}>
          <StandingSection
            title="Praticantes"
            unit="praticantes"
            total={data.praticantes.total}
            meta={`${data.praticantes.total} no total`}
            segments={[
              { label: "Ativos", n: data.praticantes.ativos, color: P.ok },
              { label: "Inativos", n: data.praticantes.inativos, color: C.ink3 },
            ]}
          />
          <StandingSection
            title="Faixas-pretas · financeiro"
            unit="pretas"
            total={data.pretas.em_dia + data.pretas.atrasado}
            meta={data.pretas.valor_em_aberto > 0 ? `${fmtBRL(data.pretas.valor_em_aberto)} em aberto` : "sem valor em aberto"}
            segments={[
              { label: "Em dia", n: data.pretas.em_dia, color: P.ok },
              { label: "Atrasado", n: data.pretas.atrasado, color: P.danger },
            ]}
          />
          <StandingSection
            title="Dojôs · situação"
            unit="dojôs"
            total={data.dojos.em_dia + data.dojos.atrasado + data.dojos.inativos}
            meta={`${data.dojos.ativos} ativo(s)`}
            segments={[
              { label: "Em dia", n: data.dojos.em_dia, color: P.ok },
              { label: "Atrasado", n: data.dojos.atrasado, color: P.danger },
              { label: "Inativo", n: data.dojos.inativos, color: C.ink3 },
            ]}
          />
        </FadeIn>
      )}
    </View>
  );
}
