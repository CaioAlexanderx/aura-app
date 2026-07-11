// ============================================================
// Saúde da Rede — Aura Karatê (Track L) · Shoji
//
// Painel de inteligência institucional da federação:
//   Filiação · Cobertura · Inadimplência · Projeção de Receita
//   Graduações · Relação de Faixas + drawers de detalhe + CSV.
//
// Design: Shoji (papel de arroz opaco, sumi, vermelhão raro).
// Indicadores derivados de dados INSTITUCIONAIS da federação:
//   filiações, anuidades, exames registrados, competições, geografia.
// NÃO inclui métricas internas de dojô (presença, churn local).
//
// Orquestrador slim: mantém todo o data-fetching e a montagem dos
// drawers; UI extraída para components/karate/saude-rede/*.
//
// NOTA: os indicadores "Dojô ativo × dormente" (dormência) e
// "Concentração" foram removidos da UI a pedido da federação. O backend
// segue computando esses dados (endpoints intactos); só não renderizamos.
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, RefreshControl, StyleSheet, ViewStyle } from "react-native";
import { ShojiBackground, PageHead } from "@/components/karate/shoji";
import { ShojiPalette as P, KarateSpacing as SP } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import {
  karateNetworkHealthApi,
  NetworkSummary,
  AfiliacaoPayload,
  CoberturaPayload,
  InadimplenciaPayload,
  ProjecaoPayload,
  GraduacoesPayload,
  RelacaoFaixasPayload,
} from "@/services/karateNetworkHealthApi";
import { karateApi, StandingSummary } from "@/services/karateApi";
import { st, fmtBRL, fmtPct, fmtN, dateSlice, downloadCsv } from "@/components/karate/saude-rede/shared";
import { KpiStrip } from "@/components/karate/saude-rede/KpiStrip";
import { DetailDrawer, DrawerCol, DrawerRow } from "@/components/karate/saude-rede/DetailDrawer";
import { ReportWidget } from "@/components/karate/saude-rede/ReportWidget";
import { StandingCard } from "@/components/karate/saude-rede/StandingCard";
import {
  AfiliacaoCard, CoberturaCard, InadimplenciaCard, ProjecaoCard,
  GraduacoesCard, RelacaoFaixasCard,
} from "@/components/karate/saude-rede/MetricCards";

type DrawerKey =
  | "afiliacao" | "cobertura" | "inadimplencia" | "projecao-receita"
  | "graduacoes" | "relacao-faixas" | "standing"
  | null;

// Formata data ISO (ou dd/mm/yyyy de dateSlice) para "dd/mm" sem ano e sem
// dia da semana. Usa dateSlice para normalizar primeiro (→ "dd/mm/yyyy"),
// depois fatia os primeiros 5 caracteres.
function dateDayMonth(s: string | null | undefined): string {
  const full = dateSlice(s); // "dd/mm/yyyy" ou ""
  return full ? full.slice(0, 5) : "";
}

export default function SaudeRedeScreen() {
  const { federationId } = useKarateFederation();

  const [refreshing, setRefreshing] = useState(false);
  const [drawerKey, setDrawerKey] = useState<DrawerKey>(null);

  // Per-indicator state
  const [summary, setSummary] = useState<NetworkSummary | null>(null);
  const [afiliacao, setAfiliacao] = useState<AfiliacaoPayload | null>(null);
  const [cobertura, setCobertura] = useState<CoberturaPayload | null>(null);
  const [inad, setInad] = useState<InadimplenciaPayload | null>(null);
  const [projecao, setProjecao] = useState<ProjecaoPayload | null>(null);
  const [graduacoes, setGraduacoes] = useState<GraduacoesPayload | null>(null);
  const [faixas, setFaixas] = useState<RelacaoFaixasPayload | null>(null);
  const [standing, setStanding] = useState<StandingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        isRefresh ? setRefreshing(true) : setLoading(true);
        const [s, a, cob, i, p, g, f, st_] = await Promise.allSettled([
          karateNetworkHealthApi.getSummary(federationId),
          karateNetworkHealthApi.getAfiliacao(federationId),
          karateNetworkHealthApi.getCobertura(federationId),
          karateNetworkHealthApi.getInadimplencia(federationId),
          karateNetworkHealthApi.getProjecaoReceita(federationId),
          karateNetworkHealthApi.getGraduacoes(federationId),
          karateNetworkHealthApi.getRelacaoFaixas(federationId),
          karateApi.getStandingSummary(federationId),
        ]);
        if (s.status === "fulfilled") setSummary(s.value);
        if (a.status === "fulfilled") setAfiliacao(a.value);
        if (cob.status === "fulfilled") setCobertura(cob.value);
        if (i.status === "fulfilled") setInad(i.value);
        if (p.status === "fulfilled") setProjecao(p.value);
        if (g.status === "fulfilled") setGraduacoes(g.value);
        if (f.status === "fulfilled") setFaixas(f.value);
        if (st_.status === "fulfilled") setStanding(st_.value);
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [federationId]
  );

  useEffect(() => { load(); }, [load]);

  // Build drawer content dynamically
  function drawerProps(): { title: string; sub: string; cols: DrawerCol[]; rows: DrawerRow[] } {
    if (drawerKey === "afiliacao" && afiliacao) {
      return {
        title: "Filiação da rede",
        sub: "Todos os dojôs filiados e a situação da anuidade de cada um em " + afiliacao.season,
        cols: [
          { key: "name", label: "Dojô" },
          { key: "city", label: "Cidade" },
          { key: "region", label: "Região" },
          { key: "affiliated_since", label: "Filiado desde", align: "right" },
          { key: "annuity_status", label: "Anuidade" },
        ],
        rows: afiliacao.dojos.map((d) => ({
          name: d.name,
          city: d.city || "",
          region: d.region || "",
          affiliated_since: dateDayMonth(d.affiliated_since),
          annuity_status: d.annuity_status || "sem registro",
        })),
      };
    }
    if (drawerKey === "cobertura" && cobertura) {
      return {
        title: "Cobertura geográfica",
        sub: "Quantos dojôs ativos a federação tem, região por região de SP",
        cols: [
          { key: "regiao", label: "Região" },
          { key: "dojos", label: "Dojôs", align: "right" },
          { key: "mun_covered", label: "Cidades com dojô", align: "right" },
          { key: "mun_total", label: "Total de cidades", align: "right" },
          { key: "practitioners", label: "Praticantes", align: "right" },
          { key: "situacao", label: "Situação" },
        ],
        rows: [...cobertura.regions]
          .sort((a, b) => b.dojos - a.dojos)
          .map((r) => ({
            regiao: r.regiao,
            dojos: r.dojos,
            mun_covered: r.mun_covered,
            mun_total: r.mun_total,
            practitioners: fmtN(r.practitioners),
            situacao: r.dojos === 0 ? "Sem dojô ainda" : r.dojos < 3 ? "Poucos dojôs" : "Bem atendida",
          })),
      };
    }
    if (drawerKey === "inadimplencia" && inad) {
      return {
        title: "Anuidades dos dojôs",
        sub: "Quais dojôs estão com a anuidade em dia, vencendo ou em atraso",
        cols: [
          { key: "dojo_name", label: "Dojô" },
          { key: "city", label: "Cidade" },
          { key: "due_date", label: "Vencimento", align: "right" },
          { key: "amount", label: "Valor", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows: inad.rows.map((r) => ({
          dojo_name: r.dojo_name,
          city: r.city || "",
          due_date: dateDayMonth(r.due_date),
          amount: fmtBRL(r.amount),
          status: r.status,
        })),
      };
    }
    if (drawerKey === "projecao-receita" && projecao) {
      let acc = 0;
      return {
        title: "Projeção de receita",
        sub: "Quanto a federação já recebeu e quanto ainda espera receber de anuidade, mês a mês",
        cols: [
          { key: "month", label: "Mês de vencimento" },
          { key: "annuities", label: "Anuidades que vencem", align: "right" },
          { key: "realized_fmt", label: "Já recebido", align: "right" },
          { key: "projected_fmt", label: "Previsto", align: "right" },
          { key: "accum", label: "Acumulado", align: "right" },
        ],
        rows: projecao.data.map((d) => {
          acc += d.total;
          return {
            month: d.month,
            annuities: d.annuities,
            realized_fmt: fmtBRL(d.realized),
            projected_fmt: fmtBRL(d.projected),
            accum: fmtBRL(acc),
          };
        }),
      };
    }
    if (drawerKey === "graduacoes" && graduacoes) {
      return {
        title: "Graduações registradas",
        sub: "Exames Kyu → Dan registrados na federação",
        cols: [
          { key: "exam_date", label: "Data" },
          { key: "dojo_name", label: "Dojô" },
          { key: "student_name", label: "Candidato" },
          { key: "from_belt", label: "De" },
          { key: "to_belt", label: "Para" },
          { key: "examiner", label: "Banca" },
        ],
        rows: graduacoes.list.map((g) => ({
          exam_date: dateDayMonth(g.exam_date),
          dojo_name: g.dojo_name || "",
          student_name: g.student_name,
          from_belt: g.from_belt || "",
          to_belt: g.to_belt || "",
          examiner: g.examiner || "",
        })),
      };
    }
    if (drawerKey === "relacao-faixas" && faixas) {
      return {
        title: "Distribuição por faixa",
        sub: "Quantos praticantes a rede tem em cada faixa, hoje",
        cols: [
          { key: "long", label: "Faixa de graduação" },
          { key: "praticantes", label: "Praticantes", align: "right" },
          { key: "pct", label: "% do total", align: "right" },
        ],
        rows: faixas.buckets.map((b) => ({
          long: b.long,
          praticantes: fmtN(b.n),
          pct: fmtPct(b.pct),
        })),
      };
    }
    if (drawerKey === "standing" && standing) {
      return {
        title: "Situação da rede",
        sub: "Quem está ativo, quem está em dia e quem está devendo — praticantes, faixas-pretas e dojôs",
        cols: [
          { key: "indicador", label: "Indicador" },
          { key: "valor", label: "Valor", align: "right" },
        ],
        rows: [
          { indicador: "Praticantes ativos", valor: fmtN(standing.praticantes.ativos) },
          { indicador: "Praticantes inativos", valor: fmtN(standing.praticantes.inativos) },
          { indicador: "Praticantes · total", valor: fmtN(standing.praticantes.total) },
          { indicador: "Faixas-pretas em dia", valor: fmtN(standing.pretas.em_dia) },
          { indicador: "Faixas-pretas em atraso", valor: fmtN(standing.pretas.atrasado) },
          { indicador: "Faixas-pretas · R$ a receber", valor: fmtBRL(standing.pretas.valor_em_aberto) },
          { indicador: "Dojôs ativos", valor: fmtN(standing.dojos.ativos) },
          { indicador: "Dojôs em dia", valor: fmtN(standing.dojos.em_dia) },
          { indicador: "Dojôs em atraso", valor: fmtN(standing.dojos.atrasado) },
          { indicador: "Dojôs inativos", valor: fmtN(standing.dojos.inativos) },
        ],
      };
    }
    return { title: "", sub: "", cols: [], rows: [] };
  }

  const dp = drawerProps();

  return (
    <ShojiBackground>
      <ScrollView
        contentContainerStyle={ist.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={P.red}
          />
        }
      >
        {/* Page head */}
        <PageHead
          title="Saúde da Rede"
          sub="Um retrato da sua rede: quantos dojôs estão filiados, quem está em dia com a anuidade, quantos praticantes vocês têm e como a rede está crescendo. Toque em qualquer número para ver os registros por trás dele e exportar em CSV."
        />

        {/* KPI strip */}
        <KpiStrip data={loading ? null : summary} />

        {/* Cards */}
        <View style={{ height: 12 }} />
        <AfiliacaoCard
          data={afiliacao}
          loading={loading}
          onCsv={() => downloadCsv(federationId, "afiliacao")}
          onDetail={() => setDrawerKey("afiliacao")}
        />
        <View style={st.row2}>
          <View style={{ flex: 1.35 }}>
            <CoberturaCard
              data={cobertura}
              loading={loading}
              onCsv={() => downloadCsv(federationId, "cobertura")}
              onDetail={() => setDrawerKey("cobertura")}
            />
          </View>
          <View style={{ flex: 1 }}>
            {/* Fonte única: standing.dojos (mesma base do KpiBand do Painel e do
                StandingCard abaixo) — não mais o payload /inadimplencia antigo, que
                fica preso em 0,0% e contradiz o standing (18 dojôs atrasados).
                "Ver detalhes" abre o drawer de standing, com a mesma fonte. */}
            <InadimplenciaCard
              standing={standing}
              loading={loading}
              onDetail={() => setDrawerKey("standing")}
            />
          </View>
        </View>
        <ProjecaoCard
          data={projecao}
          loading={loading}
          onCsv={() => downloadCsv(federationId, "projecao-receita")}
          onDetail={() => setDrawerKey("projecao-receita")}
        />
        <GraduacoesCard
          data={graduacoes}
          loading={loading}
          onCsv={() => downloadCsv(federationId, "graduacoes")}
          onDetail={() => setDrawerKey("graduacoes")}
        />
        <RelacaoFaixasCard
          data={faixas}
          loading={loading}
          onCsv={() => downloadCsv(federationId, "relacao-faixas")}
          onDetail={() => setDrawerKey("relacao-faixas")}
        />

        {/* Standing da rede (Fase 6) — drill-down segmentado (ativo/inativo,
            em dia/atrasado, R$ em aberto), mesma fonte do bloco de KPIs do Painel */}
        <StandingCard
          data={standing}
          loading={loading}
          onDetail={() => setDrawerKey("standing")}
        />

        {/* Relatório periódico */}
        <ReportWidget federationId={federationId} />

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Detail Drawer */}
      <DetailDrawer
        open={drawerKey !== null}
        onClose={() => setDrawerKey(null)}
        title={dp.title}
        sub={dp.sub}
        cols={dp.cols}
        rows={dp.rows}
        onExportCsv={
          drawerKey
            ? () => downloadCsv(federationId, drawerKey)
            : undefined
        }
      />
    </ShojiBackground>
  );
}

const ist = StyleSheet.create({
  content: { padding: 40, paddingTop: 40, paddingBottom: 72, gap: 12, maxWidth: SP.contentMax, width: "100%", alignSelf: "center" } as ViewStyle,
});
