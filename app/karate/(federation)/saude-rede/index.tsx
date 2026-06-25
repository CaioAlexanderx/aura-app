// ============================================================
// Saúde da Rede — Aura Karatê (Track L) · Shoji
//
// Painel de inteligência institucional da federação:
//   Afiliação · Cobertura · Inadimplência · Projeção de Receita
//   Graduações · Relação de Faixas + drawers de detalhe + CSV.
//
// Design: Shoji (papel de arroz opaco, sumi, vermelhão raro).
// Indicadores derivados de dados INSTITUCIONAIS da federação:
//   afiliações, anuidades, exames registrados, competições, geografia.
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
import { st, fmtBRL, fmtPct, fmtN, dateSlice, downloadCsv } from "@/components/karate/saude-rede/shared";
import { KpiStrip } from "@/components/karate/saude-rede/KpiStrip";
import { DetailDrawer, DrawerCol, DrawerRow } from "@/components/karate/saude-rede/DetailDrawer";
import { ReportWidget } from "@/components/karate/saude-rede/ReportWidget";
import {
  AfiliacaoCard, CoberturaCard, InadimplenciaCard, ProjecaoCard,
  GraduacoesCard, RelacaoFaixasCard,
} from "@/components/karate/saude-rede/MetricCards";

type DrawerKey =
  | "afiliacao" | "cobertura" | "inadimplencia" | "projecao-receita"
  | "graduacoes" | "relacao-faixas"
  | null;

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
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        isRefresh ? setRefreshing(true) : setLoading(true);
        const [s, a, cob, i, p, g, f] = await Promise.allSettled([
          karateNetworkHealthApi.getSummary(federationId),
          karateNetworkHealthApi.getAfiliacao(federationId),
          karateNetworkHealthApi.getCobertura(federationId),
          karateNetworkHealthApi.getInadimplencia(federationId),
          karateNetworkHealthApi.getProjecaoReceita(federationId),
          karateNetworkHealthApi.getGraduacoes(federationId),
          karateNetworkHealthApi.getRelacaoFaixas(federationId),
        ]);
        if (s.status === "fulfilled") setSummary(s.value);
        if (a.status === "fulfilled") setAfiliacao(a.value);
        if (cob.status === "fulfilled") setCobertura(cob.value);
        if (i.status === "fulfilled") setInad(i.value);
        if (p.status === "fulfilled") setProjecao(p.value);
        if (g.status === "fulfilled") setGraduacoes(g.value);
        if (f.status === "fulfilled") setFaixas(f.value);
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
        title: "Afiliação da rede",
        sub: "Dojôs afiliados · situação de afiliação " + afiliacao.season,
        cols: [
          { key: "name", label: "Dojô" },
          { key: "city", label: "Cidade" },
          { key: "region", label: "Região" },
          { key: "affiliated_since", label: "Afiliado desde", align: "right" },
          { key: "annuity_status", label: "Anuidade" },
        ],
        rows: afiliacao.dojos.map((d) => ({
          name: d.name,
          city: d.city || "",
          region: d.region || "",
          affiliated_since: dateSlice(d.affiliated_since),
          annuity_status: d.annuity_status || "sem registro",
        })),
      };
    }
    if (drawerKey === "cobertura" && cobertura) {
      return {
        title: "Cobertura geográfica",
        sub: "Regiões administrativas de SP · densidade de dojôs ativos",
        cols: [
          { key: "regiao", label: "Região" },
          { key: "dojos", label: "Dojôs", align: "right" },
          { key: "mun_covered", label: "Mun. c/ dojô", align: "right" },
          { key: "mun_total", label: "Mun. na região", align: "right" },
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
            situacao: r.dojos === 0 ? "Sem dojô" : r.dojos < 3 ? "Cobertura baixa" : "Coberta",
          })),
      };
    }
    if (drawerKey === "inadimplencia" && inad) {
      return {
        title: "Inadimplência da rede",
        sub: "Anuidades de afiliação dos dojôs · status de pagamento",
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
          due_date: dateSlice(r.due_date),
          amount: fmtBRL(r.amount),
          status: r.status,
        })),
      };
    }
    if (drawerKey === "projecao-receita" && projecao) {
      let acc = 0;
      return {
        title: "Projeção de receita",
        sub: "Por mês de vencimento de anuidade",
        cols: [
          { key: "month", label: "Mês de vencimento" },
          { key: "annuities", label: "Anuidades vencendo", align: "right" },
          { key: "realized_fmt", label: "Realizado", align: "right" },
          { key: "projected_fmt", label: "Projetado", align: "right" },
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
          exam_date: dateSlice(g.exam_date),
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
        title: "Relação de faixas",
        sub: "Distribuição atual da rede por graduação (snapshot)",
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
          eyebrow={`Inteligência da rede · ${new Date().getFullYear()}`}
          title="Saúde da Rede"
          sub="Visão institucional da rede de afiliados. Indicadores numéricos derivados de dados que a federação possui — afiliação de dojôs, anuidades, graduações registradas e cobertura geográfica. Cada número abre os registros por trás dele e exporta em CSV."
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
            <InadimplenciaCard
              data={inad}
              loading={loading}
              onCsv={() => downloadCsv(federationId, "inadimplencia")}
              onDetail={() => setDrawerKey("inadimplencia")}
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
