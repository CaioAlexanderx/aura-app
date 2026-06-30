// ============================================================
// Saúde da Rede — Cards de indicadores · Shoji
//
// Afiliação · Cobertura · Inadimplência · Projeção de receita
// Graduações · Relação de faixas.
// Cada card recebe data/loading + callbacks de CSV/detalhe por props.
//
// NOTA: os cards "Dojô ativo × dormente" (dormência) e "Concentração"
// foram removidos da UI a pedido da federação. O backend segue
// computando esses indicadores (endpoints intactos).
// ============================================================
import React from "react";
import { View, Text } from "react-native";
import {
  KarateColors as C, ShojiPalette as P, KarateFonts as F,
} from "@/constants/karateTheme";
import {
  AfiliacaoPayload, CoberturaPayload, InadimplenciaPayload, ProjecaoPayload,
  GraduacoesPayload, RelacaoFaixasPayload,
} from "@/services/karateNetworkHealthApi";
import { st, fmtBRL, fmtPct, fmtN, fmtMesAno, Sk, SectionRow, BarChart } from "./shared";

type CardCallbacks = { onDetail: () => void };

// ── Afiliação ──────────────────────────────────────────
export function AfiliacaoCard({
  data, loading, onDetail,
}: { data: AfiliacaoPayload | null; loading: boolean } & CardCallbacks) {
  return (
    <View style={st.card}>
      <SectionRow
        title="Afiliação da rede"
        sub="Dojôs afiliados · evolução anual"
        onDetail={onDetail}
        csvData={{
          filename: "afiliacao-rede",
          headers: ["Ano", "Novas afiliações"],
          rows: (data?.yearly || []).map((y) => [String(y.ano), String(y.new_affiliations)]),
        }}
      />
      {loading || !data ? (
        <><Sk h={36} mb={8} /><Sk h={80} /></>
      ) : (
        <>
          <View style={st.heroRow}>
            <Text style={st.heroNum}>{data.total_now}</Text>
            <Text style={st.heroSub}>dojôs afiliados em {data.season}</Text>
          </View>
          <View style={{ marginTop: 8 }}>
            <BarChart
              items={data.yearly.map((y) => ({ label: String(y.ano), value: y.new_affiliations }))}
              maxVal={Math.max(...data.yearly.map((y) => y.new_affiliations), 1)}
              barColor={C.ink2}
            />
          </View>
          <View style={st.twinBoxRow}>
            <View style={[st.twinBox, st.twinBoxOk]}>
              <Text style={st.twinBoxNum}>+{data.novas_affiliacoes}</Text>
              <Text style={st.twinBoxLabel}>novas afiliações · {data.season}</Text>
            </View>
            <View style={[st.twinBox, st.twinBoxDanger]}>
              <Text style={[st.twinBoxNum, { color: C.danger }]}>{data.nao_renovaram}</Text>
              <Text style={st.twinBoxLabel}>não renovaram · {data.season}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ── Cobertura geográfica ─────────────────────────────────
export function CoberturaCard({
  data, loading, onDetail,
}: { data: CoberturaPayload | null; loading: boolean } & CardCallbacks) {
  const top5 = data ? [...data.regions].sort((a, b) => b.dojos - a.dojos).slice(0, 5) : [];
  const maxD = top5[0]?.dojos || 1;

  return (
    <View style={st.card}>
      <SectionRow
        title="Cobertura geográfica"
        sub="Densidade de dojôs por região administrativa de SP"
        onDetail={onDetail}
        csvData={{
          filename: "cobertura-geografica",
          headers: ["Região", "Dojôs"],
          rows: top5.map((r) => [r.regiao, String(r.dojos)]),
        }}
      />
      {loading || !data ? (
        <><Sk h={120} mb={8} /><Sk h={60} /></>
      ) : (
        <>
          {/* Ranking */}
          <View style={{ gap: 8, marginBottom: 12 }}>
            {top5.map((r) => (
              <View key={r.regiao} style={st.covRow}>
                <Text style={[st.covLabel, { flex: 1, width: undefined }]}>{r.regiao}</Text>
                <View style={st.covBarBg}>
                  <View
                    style={[
                      st.covBarFill,
                      { width: `${Math.round(r.dojos / maxD * 100)}%` as any },
                    ]}
                  />
                </View>
                <Text style={st.covCount}>{r.dojos}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ── Inadimplência ────────────────────────────────────
export function InadimplenciaCard({
  data, loading, onDetail,
}: { data: InadimplenciaPayload | null; loading: boolean } & CardCallbacks) {
  return (
    <View style={st.card}>
      <SectionRow
        title="Inadimplência da rede"
        sub="Status das anuidades de afiliação dos dojôs"
        onDetail={onDetail}
        csvData={{
          filename: "inadimplencia-rede",
          headers: ["Status", "Dojôs", "Percentual"],
          rows: data ? [
            ["Em dia", String(data.em_dia ?? ""), fmtPct(data.em_dia / data.total * 100)],
            ["Vencendo (7d)", String(data.vencendo ?? ""), fmtPct(data.vencendo / data.total * 100)],
            ["Vencido", String(data.vencido ?? ""), fmtPct(data.vencido / data.total * 100)],
          ] : [],
        }}
      />
      {loading || !data ? (
        <><Sk h={36} mb={8} /><Sk h={60} /></>
      ) : (
        <>
          <View style={st.heroRow}>
            <Text style={[st.heroNum, { color: C.danger }]}>
              {fmtPct(data.inad_pct)}
            </Text>
            <Text style={st.heroSub}>das anuidades de afiliação vencidas</Text>
          </View>
          {/* Stack bar */}
          <View style={st.stackBarWrap}>
            {[
              { label: "Em dia", n: data.em_dia, color: P.ok },
              { label: "Vencendo (7d)", n: data.vencendo, color: P.warn },
              { label: "Vencido", n: data.vencido, color: P.danger },
            ].map((seg) => (
              data.total > 0 && (
                <View
                  key={seg.label}
                  style={[
                    st.stackBarSeg,
                    {
                      flex: seg.n / data.total,
                      backgroundColor: seg.color,
                      opacity: seg.n === 0 ? 0 : 1,
                    },
                  ]}
                />
              )
            ))}
          </View>
          {/* Legend */}
          {[
            { label: "Em dia", n: data.em_dia, color: P.ok },
            { label: "Vencendo (7d)", n: data.vencendo, color: P.warn },
            { label: "Vencido", n: data.vencido, color: P.danger },
          ].map((seg) => (
            <View key={seg.label} style={st.inadLegendRow}>
              <View style={[st.inadDot, { backgroundColor: seg.color }]} />
              <Text style={[st.inadLegLabel, { flex: 1 }]}>{seg.label}</Text>
              <Text style={st.inadLegN}>{seg.n} dojôs</Text>
              <Text style={st.inadLegPct}>
                {data.total > 0 ? fmtPct(seg.n / data.total * 100) : "—"}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

// ── Projeção de receita ────────────────────────────────
export function ProjecaoCard({
  data, loading, onDetail,
}: { data: ProjecaoPayload | null; loading: boolean } & CardCallbacks) {
  const items = data?.data || [];
  const maxVal = items.length ? Math.max(...items.map((d) => d.total), 1) : 1;

  return (
    <View style={st.card}>
      <SectionRow
        title="Projeção de receita"
        sub="Por mês de vencimento de anuidade · próximos 8 meses"
        onDetail={onDetail}
        csvData={{
          filename: "projecao-receita",
          headers: ["Mês/Ano", "Total (R$)", "Tipo"],
          rows: (data?.data || []).map((d) => [
            fmtMesAno(d.mes, d.ano),
            String(d.total),
            d.kind === "proj" ? "Projetado" : "Realizado",
          ]),
        }}
      />
      {loading || !data ? (
        <><Sk h={36} mb={8} /><Sk h={120} /></>
      ) : (
        <>
          <View style={st.heroRow}>
            <Text style={st.heroNum}>
              {fmtBRL(data.total_realized + data.total_projected)}
            </Text>
            <Text style={st.heroSub}>total no período</Text>
          </View>
          <BarChart
            items={items.map((d) => ({
              label: fmtMesAno(d.mes, d.ano),
              value: d.total,
              isProj: d.kind === "proj",
            }))}
            maxVal={maxVal}
            barColor={C.ink2}
            projColor={P.redWash}
          />
          <View style={st.legendRow}>
            <View style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: C.ink2 }]} />
              <Text style={st.legendLabel}>Realizado</Text>
            </View>
            <View style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: P.redWash, borderWidth: 1, borderColor: P.red, borderStyle: "dashed" }]} />
              <Text style={st.legendLabel}>Projetado</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ── Graduações registradas ─────────────────────────────
export function GraduacoesCard({
  data, loading, onDetail,
}: { data: GraduacoesPayload | null; loading: boolean } & CardCallbacks) {
  const items = data?.monthly || [];
  const maxVal = items.length ? Math.max(...items.map((d) => d.total), 1) : 1;

  return (
    <View style={st.card}>
      <SectionRow
        title="Graduações registradas — YTD"
        sub="Exames Kyu → Dan registrados na federação"
        onDetail={onDetail}
        csvData={{
          filename: "graduacoes-ytd",
          headers: ["Mês/Ano", "Graduações"],
          rows: (data?.monthly || []).map((d) => [fmtMesAno(d.mes, d.ano), String(d.total)]),
        }}
      />
      {loading || !data ? (
        <><Sk h={36} mb={8} /><Sk h={120} /></>
      ) : (
        <>
          <View style={st.heroRow}>
            <Text style={st.heroNum}>{data.total}</Text>
            <Text style={st.heroSub}>graduações YTD (no ano corrente)</Text>
          </View>
          <BarChart
            items={items.map((d) => ({ label: fmtMesAno(d.mes, d.ano), value: d.total }))}
            maxVal={maxVal}
            barColor={C.ink2}
          />
          <View style={st.legendRow}>
            <View style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: C.ink2 }]} />
              <Text style={st.legendLabel}>Kyu <Text style={{ fontFamily: F.mono, color: C.ink }}>{data.kyu}</Text></Text>
            </View>
            <View style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: C.ink }]} />
              <Text style={st.legendLabel}>Dan <Text style={{ fontFamily: F.mono, color: C.ink }}>{data.dan}</Text></Text>
            </View>
            <Text style={st.gradNote}>Registro · não é gestão de dojô</Text>
          </View>
        </>
      )}
    </View>
  );
}

// ── Relação de faixas (snapshot) ───────────────────────
const BELT_HEX: Record<string, string> = {
  "Kyu iniciante": "#e0d8c6",
  "Kyu intermediário": "#c06f35",
  "Kyu avançado": "#7a4e30",
  "1º Dan": "#2b2620",
  "2º Dan ou acima": "#2b2620",
};

export function RelacaoFaixasCard({
  data, loading, onDetail,
}: { data: RelacaoFaixasPayload | null; loading: boolean } & CardCallbacks) {
  const maxN = data ? Math.max(...data.buckets.map((b) => b.n), 1) : 1;

  return (
    <View style={st.card}>
      <SectionRow
        title="Relação de faixas"
        sub="Distribuição atual de praticantes por graduação"
        onDetail={onDetail}
        csvData={{
          filename: "relacao-faixas",
          headers: ["Faixa", "Praticantes", "Percentual"],
          rows: (data?.buckets || []).map((b) => [b.faixa, String(b.n), fmtPct(b.pct)]),
        }}
      />
      {loading || !data ? (
        <><Sk h={36} mb={8} /><Sk h={100} /></>
      ) : (
        <View style={{ flexDirection: "row", gap: 24, alignItems: "center" }}>
          {/* Hero */}
          <View style={st.beltHero}>
            <Text style={st.beltHeroPct}>
              {data.dan_pct.toFixed(0)}<Text style={st.beltHeroPctUnit}>%</Text>
            </Text>
            <Text style={st.beltHeroSub}>chegam ao Dan (faixa preta)</Text>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
              <View><Text style={st.beltStat}>{fmtN(data.kyu)}</Text><Text style={st.beltStatLabel}>Kyu</Text></View>
              <View><Text style={st.beltStat}>{fmtN(data.dan)}</Text><Text style={st.beltStatLabel}>Dan</Text></View>
            </View>
          </View>
          {/* Pyramid */}
          <View style={{ flex: 1, gap: 10 }}>
            {data.buckets.map((b) => (
              <View key={b.faixa} style={st.beltRow}>
                <Text style={st.beltRowLabel} numberOfLines={1}>{b.faixa}</Text>
                <View
                  style={[
                    st.beltBar,
                    {
                      width: `${Math.round(b.n / maxN * 100)}%` as any,
                      backgroundColor: BELT_HEX[b.faixa] || C.ink2,
                    },
                  ]}
                />
                <Text style={st.beltRowCount}>
                  {fmtN(b.n)} <Text style={st.beltRowPct}>{fmtPct(b.pct)}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
