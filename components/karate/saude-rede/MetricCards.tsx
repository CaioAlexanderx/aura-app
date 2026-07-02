// ============================================================
// Saúde da Rede — Cards de indicadores · Shoji
//
// Filiação · Cobertura · Inadimplência · Projeção de receita
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
  GraduacoesPayload, RelacaoFaixasPayload, RelacaoFaixasStatus,
  karateNetworkHealthApi,
} from "@/services/karateNetworkHealthApi";
import { BELT_HEX as CANONICAL_BELT_HEX } from "@/constants/karateBelts";
import { Chip } from "@/components/karate/shoji";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { st, fmtBRL, fmtPct, fmtN, fmtMesAno, Sk, SectionRow, BarChart } from "./shared";

type CardCallbacks = { onDetail: () => void };

// ── Filiação ──────────────────────────────────────────
export function AfiliacaoCard({
  data, loading, onDetail,
}: { data: AfiliacaoPayload | null; loading: boolean } & CardCallbacks) {
  return (
    <View style={st.card}>
      <SectionRow
        title="Filiação da rede"
        sub="Dojôs filiados · evolução anual"
        onDetail={onDetail}
        csvData={{
          filename: "afiliacao-rede",
          headers: ["Ano", "Novas filiações"],
          rows: (data?.yearly || []).map((y) => [String(y.ano), String(y.new_affiliations)]),
        }}
      />
      {loading || !data ? (
        <><Sk h={36} mb={8} /><Sk h={80} /></>
      ) : (
        <>
          <View style={st.heroRow}>
            <Text style={st.heroNum}>{data.total_now ?? 0}</Text>
            <Text style={st.heroSub}>dojôs cadastrados em {data.season}</Text>
          </View>
          <View style={st.twinBoxRow}>
            <View style={[st.twinBox, st.twinBoxOk]}>
              <Text style={st.twinBoxNum}>{data.dojos_ativos ?? 0}</Text>
              <Text style={st.twinBoxLabel}>ativos</Text>
            </View>
            <View style={[st.twinBox, st.twinBoxWarn]}>
              <Text style={[st.twinBoxNum, { color: C.ink2 }]}>{data.dojos_inativos ?? 0}</Text>
              <Text style={st.twinBoxLabel}>inativos</Text>
            </View>
            <View style={[st.twinBox, st.twinBoxOk]}>
              <Text style={st.twinBoxNum}>+{data.novas_affiliacoes ?? 0}</Text>
              <Text style={st.twinBoxLabel}>novas filiações · {data.season}</Text>
            </View>
            <View style={[st.twinBox, st.twinBoxDanger]}>
              <Text style={[st.twinBoxNum, { color: C.danger }]}>{data.nao_renovaram ?? 0}</Text>
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
                <Text style={st.covCount} numberOfLines={1}>{r.dojos}</Text>
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
        sub="Status das anuidades de filiação dos dojôs"
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
            <Text style={[st.heroNum, { color: data.inad_pct > 0 ? C.danger : C.ink }]}>
              {fmtPct(data.inad_pct)}
            </Text>
            <Text style={st.heroSub}>das anuidades de filiação vencidas</Text>
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
// Cores por faixa: pega o hex canônico de constants/karateBelts.ts
// (BELT_HEX, chaveado por slug) e reindexa pelo LABEL em PT que o
// backend devolve em `buckets[].faixa` (~10 linhas por faixa, mais
// os graus de Dan que não têm slug próprio — mapeados manualmente
// para o tom "preta"). Fallback `|| C.ink2` para chave desconhecida.
const BELT_HEX: Record<string, string> = {
  "Branca": CANONICAL_BELT_HEX.branca,
  "Amarela": CANONICAL_BELT_HEX.amarela,
  "Laranja": CANONICAL_BELT_HEX.laranja,
  "Verde": CANONICAL_BELT_HEX.verde,
  "Azul Claro": CANONICAL_BELT_HEX.azul_claro,
  "Roxa": CANONICAL_BELT_HEX.roxa,
  "Azul Escuro": CANONICAL_BELT_HEX.azul_escuro,
  "Marrom": CANONICAL_BELT_HEX.marrom,
  "1º Dan": CANONICAL_BELT_HEX.preta,
  "2º Dan ou acima": CANONICAL_BELT_HEX.preta,
};

// ── Filtro de status (Todos / Ativos / Inativos) ───────────────
const STATUS_FILTERS: Array<{ key: RelacaoFaixasStatus; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "inactive", label: "Inativos" },
];

export function RelacaoFaixasCard({
  data, loading, onDetail,
}: { data: RelacaoFaixasPayload | null; loading: boolean } & CardCallbacks) {
  const { federationId } = useKarateFederation();

  // Estado LOCAL do filtro de status — escopo restrito a este card.
  // Não mexe no load centralizado de Saúde da Rede (Promise.allSettled
  // no orquestrador): busca relacao-faixas de forma independente aqui
  // quando o filtro muda, sem afetar os outros cards.
  const [status, setStatus] = React.useState<RelacaoFaixasStatus>("all");
  const [localData, setLocalData] = React.useState<RelacaoFaixasPayload | null>(null);
  const [localLoading, setLocalLoading] = React.useState(false);
  const [hasFiltered, setHasFiltered] = React.useState(false);

  React.useEffect(() => {
    // "Todos" no primeiro render == o `data` que já veio do load
    // compartilhado; só dispara fetch próprio quando o usuário de fato
    // troca o filtro (evita um /relacao-faixas duplicado no mount).
    if (status === "all" && !hasFiltered) return;
    if (!federationId) return;
    let cancelled = false;
    setLocalLoading(true);
    karateNetworkHealthApi
      .getRelacaoFaixas(federationId, status)
      .then((res) => { if (!cancelled) setLocalData(res); })
      .catch((err) => { console.error("[saude-rede] relacao-faixas filtro:", err); })
      .finally(() => { if (!cancelled) setLocalLoading(false); });
    return () => { cancelled = true; };
  }, [federationId, status, hasFiltered]);

  const effectiveData = hasFiltered ? localData : data;
  const effectiveLoading = hasFiltered ? localLoading : loading;
  const maxN = effectiveData ? Math.max(...effectiveData.buckets.map((b) => b.n), 1) : 1;

  return (
    <View style={st.card}>
      <SectionRow
        title="Relação de faixas"
        sub="Distribuição atual de praticantes por graduação"
        onDetail={onDetail}
        csvData={{
          filename: "relacao-faixas",
          headers: ["Faixa", "Praticantes", "Percentual"],
          rows: (effectiveData?.buckets || []).map((b) => [b.faixa, String(b.n), fmtPct(b.pct)]),
        }}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        {STATUS_FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            active={status === f.key}
            onPress={() => { setHasFiltered(true); setStatus(f.key); }}
          />
        ))}
      </View>
      {effectiveLoading || !effectiveData ? (
        <><Sk h={36} mb={8} /><Sk h={100} /></>
      ) : (
        <View style={{ flexDirection: "row", gap: 24, alignItems: "center" }}>
          {/* Hero */}
          <View style={st.beltHero}>
            <Text style={st.beltHeroPct}>
              {(effectiveData.dan_pct ?? 0).toFixed(0)}<Text style={st.beltHeroPctUnit}>%</Text>
            </Text>
            <Text style={st.beltHeroSub}>chegam ao Dan (faixa preta)</Text>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
              <View><Text style={st.beltStat}>{fmtN(effectiveData.kyu ?? 0)}</Text><Text style={st.beltStatLabel}>Kyu</Text></View>
              <View><Text style={st.beltStat}>{fmtN(effectiveData.dan ?? 0)}</Text><Text style={st.beltStatLabel}>Dan</Text></View>
            </View>
          </View>
          {/* Pyramid */}
          <View style={{ flex: 1, gap: 10 }}>
            {effectiveData.buckets.map((b) => (
              <View key={b.faixa} style={st.beltRow}>
                <Text style={st.beltRowLabel} numberOfLines={1}>{b.faixa}</Text>
                <View style={st.beltBarTrack}>
                  <View
                    style={[
                      st.beltBar,
                      {
                        width: `${Math.round(b.n / maxN * 100)}%` as any,
                        backgroundColor: BELT_HEX[b.faixa] || C.ink2,
                      },
                    ]}
                  />
                </View>
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
