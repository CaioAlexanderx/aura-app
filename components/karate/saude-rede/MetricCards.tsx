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
  AfiliacaoPayload, CoberturaPayload, ProjecaoPayload,
  GraduacoesPayload, RelacaoFaixasPayload, RelacaoFaixasStatus,
  karateNetworkHealthApi,
} from "@/services/karateNetworkHealthApi";
import { StandingSummary } from "@/services/karateApi";
import { BELT_HEX as CANONICAL_BELT_HEX } from "@/constants/karateBelts";
import { Chip } from "@/components/karate/shoji";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { st, fmtBRL, fmtPct, fmtN, fmtMesAno, Sk, SectionRow, BarChart, FadeIn, AnimatedWidthBar } from "./shared";

type CardCallbacks = { onDetail: () => void };

// ── Filiação ──────────────────────────────────────────
export function AfiliacaoCard({
  data, loading, onDetail,
}: { data: AfiliacaoPayload | null; loading: boolean } & CardCallbacks) {
  return (
    <View style={st.card}>
      <SectionRow
        title="Filiação da rede"
        sub="Quantos dojôs estão filiados à federação e como isso mudou ao longo do ano"
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
        <FadeIn>
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
        </FadeIn>
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
        sub="Quantos dojôs a federação tem em cada região de SP"
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
        <FadeIn>
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
        </FadeIn>
      )}
    </View>
  );
}

// ── Inadimplência ────────────────────────────────────
// Fonte ÚNICA (fix "Inadimplência 0,0%" contradizendo o standing): este
// card usava o payload antigo /inadimplencia (cobrança de anuidade de dojô
// "vencida"), que fica preso em 0,0% e contradiz karate_dojo_standing (18
// dojôs atrasados). Passamos a ler diretamente StandingSummary.dojos —
// a MESMA fonte do bloco de KPIs do Painel e do StandingCard abaixo — sem
// recomputar nada aqui. O endpoint /inadimplencia antigo NÃO é alterado
// (outros consumidores podem existir); só a fonte exibida neste card muda.
export function InadimplenciaCard({
  standing, loading, onDetail,
}: { standing: StandingSummary | null; loading: boolean } & CardCallbacks) {
  const ativos = standing?.dojos.ativos ?? 0;
  const emDia = standing?.dojos.em_dia ?? 0;
  const atrasado = standing?.dojos.atrasado ?? 0;
  const pct = ativos > 0 ? (atrasado / ativos) * 100 : 0;

  return (
    <View style={st.card}>
      <SectionRow
        title="Dojôs em atraso"
        sub="Dojôs filiados ativos e a situação da anuidade de cada um"
        onDetail={onDetail}
        csvData={{
          filename: "inadimplencia-rede",
          headers: ["Status", "Dojôs", "Percentual"],
          rows: standing ? [
            ["Em dia", String(emDia), ativos > 0 ? fmtPct(emDia / ativos * 100) : "—"],
            ["Em atraso", String(atrasado), ativos > 0 ? fmtPct(atrasado / ativos * 100) : "—"],
          ] : [],
        }}
      />
      {loading || !standing ? (
        <><Sk h={36} mb={8} /><Sk h={60} /></>
      ) : (
        <FadeIn>
          <View style={st.heroRow}>
            <Text style={[st.heroNum, { color: atrasado > 0 ? C.danger : C.ink }]}>
              {fmtPct(pct)}
            </Text>
            <Text style={st.heroSub}>
              {ativos > 0 ? `${atrasado} de ${ativos} filiados em atraso` : "nenhum dojô ativo com anuidade registrada"}
            </Text>
          </View>
          {/* Stack bar — em dia / atrasado (standing.dojos) */}
          <View style={st.stackBarWrap}>
            {[
              { label: "Em dia", n: emDia, color: P.ok },
              { label: "Em atraso", n: atrasado, color: P.danger },
            ].map((seg) => (
              ativos > 0 && (
                <View
                  key={seg.label}
                  style={[
                    st.stackBarSeg,
                    {
                      flex: seg.n / ativos,
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
            { label: "Em dia", n: emDia, color: P.ok },
            { label: "Em atraso", n: atrasado, color: P.danger },
          ].map((seg) => (
            <View key={seg.label} style={st.inadLegendRow}>
              <View style={[st.inadDot, { backgroundColor: seg.color }]} />
              <Text style={[st.inadLegLabel, { flex: 1 }]}>{seg.label}</Text>
              <Text style={st.inadLegN}>{seg.n} dojôs</Text>
              <Text style={st.inadLegPct}>
                {ativos > 0 ? fmtPct(seg.n / ativos * 100) : "—"}
              </Text>
            </View>
          ))}
        </FadeIn>
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
        sub="Quanto a federação recebe (ou espera receber) de anuidade, mês a mês — próximos 8 meses"
        onDetail={onDetail}
        csvData={{
          filename: "projecao-receita",
          headers: ["Mês/Ano", "Total (R$)", "Tipo"],
          rows: (data?.data || []).map((d) => [
            fmtMesAno(d.mes, d.ano),
            String(d.total),
            d.kind === "proj" ? "Previsto" : "Já recebido",
          ]),
        }}
      />
      {loading || !data ? (
        <><Sk h={36} mb={8} /><Sk h={120} /></>
      ) : (
        <FadeIn>
          <View style={st.heroRow}>
            <Text style={st.heroNum}>
              {fmtBRL(data.total_realized + data.total_projected)}
            </Text>
            <Text style={st.heroSub}>total esperado no período</Text>
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
              <Text style={st.legendLabel}>Já recebido</Text>
            </View>
            <View style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: P.redWash, borderWidth: 1, borderColor: P.red, borderStyle: "dashed" }]} />
              <Text style={st.legendLabel}>Previsto</Text>
            </View>
          </View>
        </FadeIn>
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
        title="Graduações registradas no ano"
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
        <FadeIn>
          <View style={st.heroRow}>
            <Text style={st.heroNum}>{data.total}</Text>
            <Text style={st.heroSub}>graduações neste ano</Text>
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
            <Text style={st.gradNote}>Registro da federação — não é dado de gestão do dojô</Text>
          </View>
        </FadeIn>
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

// Kyu por faixa (rótulo) — FPKT Shotokan. Dan (preta) não tem kyu.
const KYU_BY_FAIXA: Record<string, string> = {
  "Branca": "10º kyu", "Amarela": "9º kyu", "Laranja": "8º kyu", "Verde": "7º kyu",
  "Azul Claro": "6º kyu", "Roxa": "5º kyu", "Azul Escuro": "4º kyu", "Marrom": "3º–1º kyu",
};

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
        title="Distribuição por faixa"
        sub="Quantos praticantes a rede tem em cada faixa, hoje"
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
        <FadeIn style={{ flexDirection: "row", gap: 24, alignItems: "center" }}>
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
            {effectiveData.buckets.map((b, i) => (
              <View key={b.faixa} style={st.beltRow}>
                <View style={{ width: 110 }}>
                  <Text style={st.beltRowLabel} numberOfLines={1}>{b.faixa}</Text>
                  {KYU_BY_FAIXA[b.faixa] ? (
                    <Text style={{ fontFamily: F.body, fontSize: 10, color: C.ink3, marginTop: 1 }} numberOfLines={1}>{KYU_BY_FAIXA[b.faixa]}</Text>
                  ) : null}
                </View>
                <View style={st.beltBarTrack}>
                  <AnimatedWidthBar
                    index={i}
                    pct={Math.round(b.n / maxN * 100)}
                    style={[
                      st.beltBar,
                      { backgroundColor: BELT_HEX[b.faixa] || C.ink2 },
                    ]}
                  />
                </View>
                <Text style={st.beltRowCount}>
                  {fmtN(b.n)} <Text style={st.beltRowPct}>{fmtPct(b.pct)}</Text>
                </Text>
              </View>
            ))}
          </View>
        </FadeIn>
      )}
    </View>
  );
}
