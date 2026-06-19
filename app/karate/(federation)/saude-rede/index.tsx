// ============================================================
// Saúde da Rede — Aura Karatê (Track L)
//
// Painel de inteligência institucional da federação:
//   Afiliação · Cobertura · Inadimplência · Projeção de Receita
//   Graduações · Relação de Faixas + drawers de detalhe + CSV.
//
// Design: Shoji (vermelho #B91C1C, papel #FDFAF5).
// Indicadores derivados de dados INSTITUCIONAIS da federação:
//   afiliações, anuidades, exames registrados, competições, geografia.
// NÃO inclui métricas internas de dojô (presença, churn local).
// ============================================================
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  RefreshControl,
  Platform,
  Linking,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KarateColors, KarateRadius, ShojiPalette, KarateFonts } from "@/constants/karateTheme";
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
  DormenciaPayload,
  ConcentracaoPayload,
  RenovacaoPayload,
} from "@/services/karateNetworkHealthApi";

// ── helpers ───────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(1).replace(".", ",") + "%";
}
function fmtN(v: number): string {
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function dateSlice(s: string | null | undefined): string {
  if (!s) return "";
  return s.slice(0, 10).split("-").reverse().join("/");
}

// Download CSV via Linking (web: opens in new tab; native: opens browser)
function downloadCsv(fedId: string, indicator: string, token?: string): void {
  let url = karateNetworkHealthApi.csvUrl(fedId, indicator);
  if (token) url += `&token=${encodeURIComponent(token)}`;
  Linking.openURL(url);
}

// ── Skeleton placeholder ────────────────────────────────────────

function Sk({ h, mb }: { h: number; mb?: number }) {
  return (
    <View
      style={[st.skeletonBase, { height: h, marginBottom: mb || 0 }]}
      accessibilityLabel="carregando"
    />
  );
}

// ── Section header ──────────────────────────────────────────

function SH({
  title,
  sub,
  onCsv,
  onDetail,
}: {
  title: string;
  sub: string;
  onCsv?: () => void;
  onDetail?: () => void;
}) {
  return (
    <View style={st.shRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.shTitle}>{title}</Text>
        <Text style={st.shSub}>{sub}</Text>
      </View>
      <View style={st.shActions}>
        {onCsv && (
          <TouchableOpacity
            style={st.btnCsv}
            onPress={onCsv}
            accessibilityLabel={`Exportar CSV: ${title}`}
          >
            <Ionicons name="download-outline" size={13} color={KarateColors.ink3} />
            <Text style={st.btnCsvLabel}>CSV</Text>
          </TouchableOpacity>
        )}
        {onDetail && (
          <TouchableOpacity
            style={st.btnDetail}
            onPress={onDetail}
            accessibilityLabel={`Ver detalhe: ${title}`}
          >
            <Text style={st.btnDetailLabel}>Ver detalhe</Text>
            <Ionicons name="arrow-forward" size={13} color={KarateColors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Drawer genérico ───────────────────────────────────────────

interface DrawerCol { key: string; label: string; align?: "right" }
interface DrawerRow { [key: string]: string | number | null | undefined }

function DetailDrawer({
  open,
  onClose,
  title,
  sub,
  cols,
  rows,
  onExportCsv,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub: string;
  cols: DrawerCol[];
  rows: DrawerRow[];
  onExportCsv?: () => void;
}) {
  const [q, setQ] = useState("");
  useEffect(() => { if (!open) setQ(""); }, [open]);

  const filtered = q.trim()
    ? rows.filter((r) =>
        cols.some((c) =>
          String(r[c.key] ?? "").toLowerCase().includes(q.toLowerCase())
        )
      )
    : rows;

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.drawerOverlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View style={st.drawerSheet}>
          {/* Header */}
          <View style={st.drawerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={st.drawerEyebrow}>Registros por trás do indicador</Text>
              <Text style={st.drawerTitle}>{title}</Text>
              <Text style={st.drawerSub}>{sub}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar" style={st.drawerClose}>
              <Ionicons name="close" size={18} color={KarateColors.ink} />
            </TouchableOpacity>
          </View>

          {/* Toolbar */}
          <View style={st.drawerToolbar}>
            <View style={st.searchBox}>
              <Ionicons name="search" size={14} color={KarateColors.ink4} style={{ marginRight: 6 }} />
              <TextInput
                style={st.searchInput as any}
                placeholder="Filtrar registros…"
                placeholderTextColor={KarateColors.ink4}
                value={q}
                onChangeText={setQ}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            {onExportCsv && (
              <TouchableOpacity style={st.btnExport} onPress={onExportCsv}>
                <Ionicons name="download-outline" size={14} color="#fff" />
                <Text style={st.btnExportLabel}>Exportar CSV</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Table */}
          <ScrollView style={{ flex: 1 }} horizontal>
            <View style={{ minWidth: "100%" }}>
              {/* Head */}
              <View style={st.tblHead}>
                {cols.map((c) => (
                  <Text key={c.key} style={[st.tblTh, c.align === "right" && { textAlign: "right" }]}>
                    {c.label}
                  </Text>
                ))}
              </View>
              {/* Body */}
              {filtered.length === 0 ? (
                <Text style={st.drawerEmpty}>Nenhum registro corresponde ao filtro.</Text>
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={({ item, index }) => (
                    <View style={[st.tblRow, index % 2 === 1 && st.tblRowAlt]}>
                      {cols.map((c) => (
                        <Text
                          key={c.key}
                          style={[st.tblTd, c.align === "right" && { textAlign: "right" }]}
                          numberOfLines={1}
                        >
                          {String(item[c.key] ?? "")}
                        </Text>
                      ))}
                    </View>
                  )}
                />
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={st.drawerFooter}>
            <Text style={st.drawerCount}>{filtered.length} de {rows.length} registros</Text>
            <Text style={st.drawerClause}>Exportação CSV · Cláusula 17</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── KPI Strip ────────────────────────────────────────────────

function KpiStrip({ data }: { data: NetworkSummary | null }) {
  const items = data?.kpis || [];
  if (!items.length) {
    return (
      <View style={st.kpiRow}>
        {[1, 2, 3, 4, 5].map((k) => <View key={k} style={st.kpiCard}><Sk h={40} /></View>)}
      </View>
    );
  }
  return (
    <View style={st.kpiRow}>
      {items.map((k) => (
        <View key={k.key} style={st.kpiCard}>
          <Text style={st.kpiLabel}>{k.label}</Text>
          <Text style={[st.kpiValue, k.key === "inadimplencia" && k.value > 10 && { color: KarateColors.danger }]}>
            {k.unit === "BRL" ? fmtBRL(k.value) : k.unit === "%" ? fmtPct(k.value) : fmtN(k.value)}
            {k.unit && k.unit !== "BRL" && k.unit !== "%" && (
              <Text style={st.kpiUnit}> {k.unit}</Text>
            )}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Bar chart helper ─────────────────────────────────────────

function BarChart({
  items,
  maxVal,
  barColor,
  projColor,
}: {
  items: Array<{ label: string; sublabel?: string; value: number; isProj?: boolean }>;
  maxVal: number;
  barColor: string;
  projColor?: string;
}) {
  const chartH = 120;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartH + 28, gap: 4 }}>
      {items.map((item, i) => {
        const pct = maxVal > 0 ? item.value / maxVal : 0;
        const barH = Math.max(4, Math.round(pct * chartH));
        const bg = item.isProj ? (projColor || barColor) : barColor;
        return (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
            <Text style={st.barValLabel}>
              {item.value > 0 ? fmtN(Math.round(item.value)) : ""}
            </Text>
            <View
              style={[
                st.bar,
                {
                  height: barH,
                  backgroundColor: bg,
                  opacity: item.isProj ? 0.55 : 1,
                  borderStyle: item.isProj ? "dashed" : "solid",
                  borderWidth: item.isProj ? 1 : 0,
                  borderColor: item.isProj ? KarateColors.primary : "transparent",
                },
              ]}
            />
            <Text style={st.barLabel}>{item.label}</Text>
            {item.sublabel && <Text style={st.barSublabel}>{item.sublabel}</Text>}
          </View>
        );
      })}
    </View>
  );
}

// ── Cards individuais ──────────────────────────────────────────

// Afiliação card
function AfiliacaoCard({
  data,
  loading,
  onCsv,
  onDetail,
}: {
  data: AfiliacaoPayload | null;
  loading: boolean;
  onCsv: () => void;
  onDetail: () => void;
}) {
  return (
    <View style={st.card}>
      <SH
        title="Afiliação da rede"
        sub="Dojôs afiliados · evolução anual"
        onCsv={onCsv}
        onDetail={onDetail}
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
              barColor={KarateColors.ink2}
            />
          </View>
          <View style={st.twinBoxRow}>
            <View style={[st.twinBox, st.twinBoxOk]}>
              <Text style={st.twinBoxNum}>+{data.novas_affiliacoes}</Text>
              <Text style={st.twinBoxLabel}>novas afiliações · {data.season}</Text>
            </View>
            <View style={[st.twinBox, st.twinBoxDanger]}>
              <Text style={[st.twinBoxNum, { color: KarateColors.danger }]}>{data.nao_renovaram}</Text>
              <Text style={st.twinBoxLabel}>não renovaram · {data.season}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// Cobertura geográfica card
function CoberturaCard({
  data,
  loading,
  onCsv,
  onDetail,
}: {
  data: CoberturaPayload | null;
  loading: boolean;
  onCsv: () => void;
  onDetail: () => void;
}) {
  const top5 = data ? [...data.regions].sort((a, b) => b.dojos - a.dojos).slice(0, 5) : [];
  const maxD = top5[0]?.dojos || 1;

  return (
    <View style={st.card}>
      <SH
        title="Cobertura geográfica"
        sub="Densidade de dojôs por região administrativa de SP"
        onCsv={onCsv}
        onDetail={onDetail}
      />
      {loading || !data ? (
        <><Sk h={120} mb={8} /><Sk h={60} /></>
      ) : (
        <>
          {/* Ranking */}
          <View style={{ gap: 8, marginBottom: 12 }}>
            {top5.map((r) => (
              <View key={r.regiao} style={st.covRow}>
                <Text style={st.covLabel} numberOfLines={1}>{r.short}</Text>
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
          {/* Lacunas */}
          {data.gap_count > 0 && (
            <View style={st.gapBox}>
              <Text style={st.gapTitle}>Lacunas de cobertura</Text>
              <Text style={st.gapBody}>
                <Text style={{ fontWeight: "700" }}>{data.gap_count} regiões</Text>
                {" sem dojô afiliado — "}{data.gap_names}.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// Inadimplência card
function InadimplenciaCard({
  data,
  loading,
  onCsv,
  onDetail,
}: {
  data: InadimplenciaPayload | null;
  loading: boolean;
  onCsv: () => void;
  onDetail: () => void;
}) {
  return (
    <View style={st.card}>
      <SH
        title="Inadimplência da rede"
        sub="Status das anuidades de afiliação dos dojôs"
        onCsv={onCsv}
        onDetail={onDetail}
      />
      {loading || !data ? (
        <><Sk h={36} mb={8} /><Sk h={60} /></>
      ) : (
        <>
          <View style={st.heroRow}>
            <Text style={[st.heroNum, { color: KarateColors.danger }]}>
              {fmtPct(data.inad_pct)}
            </Text>
            <Text style={st.heroSub}>das anuidades de afiliação vencidas</Text>
          </View>
          {/* Stack bar */}
          <View style={st.stackBarWrap}>
            {[
              { label: "Em dia", n: data.em_dia, color: ShojiPalette.ok },
              { label: "Vencendo (7d)", n: data.vencendo, color: ShojiPalette.warn },
              { label: "Vencido", n: data.vencido, color: ShojiPalette.danger },
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
            { label: "Em dia", n: data.em_dia, color: ShojiPalette.ok },
            { label: "Vencendo (7d)", n: data.vencendo, color: ShojiPalette.warn },
            { label: "Vencido", n: data.vencido, color: ShojiPalette.danger },
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

// Projeção de receita card
function ProjecaoCard({
  data,
  loading,
  onCsv,
  onDetail,
}: {
  data: ProjecaoPayload | null;
  loading: boolean;
  onCsv: () => void;
  onDetail: () => void;
}) {
  const items = data?.data || [];
  const maxVal = items.length ? Math.max(...items.map((d) => d.total), 1) : 1;

  return (
    <View style={st.card}>
      <SH
        title="Projeção de receita"
        sub="Por mês de vencimento de anuidade · próximos 8 meses"
        onCsv={onCsv}
        onDetail={onDetail}
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
              label: d.mes,
              sublabel: d.ano,
              value: d.total,
              isProj: d.kind === "proj",
            }))}
            maxVal={maxVal}
            barColor={KarateColors.ink2}
            projColor={KarateColors.primaryDim}
          />
          <View style={st.legendRow}>
            <View style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: KarateColors.ink2 }]} />
              <Text style={st.legendLabel}>Realizado</Text>
            </View>
            <View style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: KarateColors.primaryDim, borderWidth: 1, borderColor: KarateColors.primary, borderStyle: "dashed" }]} />
              <Text style={st.legendLabel}>Projetado</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// Graduações registradas card
function GraduacoesCard({
  data,
  loading,
  onCsv,
  onDetail,
}: {
  data: GraduacoesPayload | null;
  loading: boolean;
  onCsv: () => void;
  onDetail: () => void;
}) {
  const items = data?.monthly || [];
  const maxVal = items.length ? Math.max(...items.map((d) => d.total), 1) : 1;

  return (
    <View style={st.card}>
      <SH
        title="Graduações registradas"
        sub="Exames Kyu → Dan registrados na federação"
        onCsv={onCsv}
        onDetail={onDetail}
      />
      {loading || !data ? (
        <><Sk h={36} mb={8} /><Sk h={120} /></>
      ) : (
        <>
          <View style={st.heroRow}>
            <Text style={st.heroNum}>{data.total}</Text>
            <Text style={st.heroSub}>graduações nos últimos 8 meses</Text>
          </View>
          <BarChart
            items={items.map((d) => ({ label: d.mes, sublabel: d.ano, value: d.total }))}
            maxVal={maxVal}
            barColor={KarateColors.ink2}
          />
          <View style={st.legendRow}>
            <View style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: KarateColors.ink2 }]} />
              <Text style={st.legendLabel}>Kyu <Text style={{ fontFamily: KarateFonts.mono, color: KarateColors.ink }}>{data.kyu}</Text></Text>
            </View>
            <View style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: KarateColors.ink }]} />
              <Text style={st.legendLabel}>Dan <Text style={{ fontFamily: KarateFonts.mono, color: KarateColors.ink }}>{data.dan}</Text></Text>
            </View>
            <Text style={st.gradNote}>Registro · não é gestão de dojô</Text>
          </View>
        </>
      )}
    </View>
  );
}

// Relação de faixas (snapshot)
const BELT_HEX: Record<string, string> = {
  "Kyu iniciante": "#e0d8c6",
  "Kyu intermediário": "#c06f35",
  "Kyu avançado": "#7a4e30",
  "1º Dan": "#2b2620",
  "2º Dan ou acima": "#1c1714",
};

function RelacaoFaixasCard({
  data,
  loading,
  onCsv,
  onDetail,
}: {
  data: RelacaoFaixasPayload | null;
  loading: boolean;
  onCsv: () => void;
  onDetail: () => void;
}) {
  const maxN = data ? Math.max(...data.buckets.map((b) => b.n), 1) : 1;

  return (
    <View style={st.card}>
      <SH
        title="Relação de faixas"
        sub="Distribuição atual de atletas por graduação · snapshot da rede"
        onCsv={onCsv}
        onDetail={onDetail}
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
            <Text style={st.beltHeroNote}>Snapshot — não é funil de coorte.</Text>
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
                      backgroundColor: BELT_HEX[b.faixa] || KarateColors.ink2,
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

// Dormência card (compact)
function DormenciaCard({
  data,
  loading,
  onCsv,
  onDetail,
}: {
  data: DormenciaPayload | null;
  loading: boolean;
  onCsv: () => void;
  onDetail: () => void;
}) {
  return (
    <View style={st.card}>
      <SH
        title="Dojô ativo × dormente"
        sub="Registrou exame e/ou inscrição em competição na season"
        onCsv={onCsv}
        onDetail={onDetail}
      />
      {loading || !data ? (
        <Sk h={60} />
      ) : (
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={[st.twinBox, st.twinBoxOk]}>
            <Text style={st.twinBoxNum}>{data.ativos}</Text>
            <Text style={st.twinBoxLabel}>ativos · {data.season}</Text>
          </View>
          <View style={[st.twinBox, st.twinBoxWarn]}>
            <Text style={[st.twinBoxNum, { color: KarateColors.warn }]}>{data.dormentes}</Text>
            <Text style={st.twinBoxLabel}>dormentes · {data.season}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// Concentração card (compact)
function ConcentracaoCard({
  data,
  loading,
  onCsv,
  onDetail,
}: {
  data: ConcentracaoPayload | null;
  loading: boolean;
  onCsv: () => void;
  onDetail: () => void;
}) {
  return (
    <View style={st.card}>
      <SH
        title="Concentração"
        sub="Share da rede nos top-5 dojôs (praticantes + receita)"
        onCsv={onCsv}
        onDetail={onDetail}
      />
      {loading || !data ? (
        <Sk h={60} />
      ) : (
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={st.twinBox}>
            <Text style={st.twinBoxNum}>{fmtPct(data.top5_pct_practitioners)}</Text>
            <Text style={st.twinBoxLabel}>praticantes top-5</Text>
          </View>
          <View style={st.twinBox}>
            <Text style={st.twinBoxNum}>{fmtPct(data.top5_pct_revenue)}</Text>
            <Text style={st.twinBoxLabel}>receita top-5</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Relatório periódico widget ───────────────────────────────

function ReportWidget({ federationId }: { federationId: string }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const send = useCallback(async () => {
    setSending(true);
    setResult(null);
    try {
      const r = await karateNetworkHealthApi.sendReport(federationId);
      setResult(r.sent ? `Relatório enviado para ${r.to}` : "Falha ao enviar.");
    } catch (e: any) {
      setResult("Erro: " + (e?.message || "desconhecido"));
    } finally {
      setSending(false);
    }
  }, [federationId]);

  return (
    <View style={st.card}>
      <View style={st.shRow}>
        <View style={{ flex: 1 }}>
          <Text style={st.shTitle}>Relatório periódico</Text>
          <Text style={st.shSub}>Resume Saúde da Rede e envia por e-mail ao admin · DESIGN-28</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[st.btnSend, sending && { opacity: 0.6 }]}
        onPress={send}
        disabled={sending}
        accessibilityLabel="Enviar relatório agora"
      >
        <Ionicons name="mail-outline" size={15} color="#fff" />
        <Text style={st.btnSendLabel}>{sending ? "Enviando…" : "Enviar agora"}</Text>
      </TouchableOpacity>
      {result && <Text style={st.reportResult}>{result}</Text>}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────

type DrawerKey =
  | "afiliacao" | "cobertura" | "inadimplencia" | "projecao-receita"
  | "dormencia" | "concentracao" | "graduacoes" | "relacao-faixas"
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
  const [dormencia, setDormencia] = useState<DormenciaPayload | null>(null);
  const [concentracao, setConcentracao] = useState<ConcentracaoPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        isRefresh ? setRefreshing(true) : setLoading(true);
        const [s, a, cob, i, p, g, f, d, c] = await Promise.allSettled([
          karateNetworkHealthApi.getSummary(federationId),
          karateNetworkHealthApi.getAfiliacao(federationId),
          karateNetworkHealthApi.getCobertura(federationId),
          karateNetworkHealthApi.getInadimplencia(federationId),
          karateNetworkHealthApi.getProjecaoReceita(federationId),
          karateNetworkHealthApi.getGraduacoes(federationId),
          karateNetworkHealthApi.getRelacaoFaixas(federationId),
          karateNetworkHealthApi.getDormencia(federationId),
          karateNetworkHealthApi.getConcentracao(federationId),
        ]);
        if (s.status === "fulfilled") setSummary(s.value);
        if (a.status === "fulfilled") setAfiliacao(a.value);
        if (cob.status === "fulfilled") setCobertura(cob.value);
        if (i.status === "fulfilled") setInad(i.value);
        if (p.status === "fulfilled") setProjecao(p.value);
        if (g.status === "fulfilled") setGraduacoes(g.value);
        if (f.status === "fulfilled") setFaixas(f.value);
        if (d.status === "fulfilled") setDormencia(d.value);
        if (c.status === "fulfilled") setConcentracao(c.value);
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
        sub: "Regiões administrativas de SP · densidade e lacunas",
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
    if (drawerKey === "dormencia" && dormencia) {
      return {
        title: "Dojô ativo × dormente",
        sub: `Season ${dormencia.season}: exames e inscrições em competição`,
        cols: [
          { key: "name", label: "Dojô" },
          { key: "city", label: "Cidade" },
          { key: "region", label: "Região" },
          { key: "has_exam", label: "Exame" },
          { key: "has_comp", label: "Competição" },
          { key: "situacao", label: "Situação" },
        ],
        rows: dormencia.dojos.map((d) => ({
          name: d.name,
          city: d.city || "",
          region: d.region || "",
          has_exam: d.has_exam ? "Sim" : "Não",
          has_comp: d.has_comp ? "Sim" : "Não",
          situacao: d.active ? "Ativo" : "Dormente",
        })),
      };
    }
    if (drawerKey === "concentracao" && concentracao) {
      const tp = concentracao.total_practitioners;
      const tr = concentracao.total_revenue;
      return {
        title: "Concentração",
        sub: "Share dos dojôs em praticantes e receita de anuidade",
        cols: [
          { key: "name", label: "Dojô" },
          { key: "practitioners", label: "Praticantes", align: "right" },
          { key: "pct_pract", label: "% praticantes", align: "right" },
          { key: "revenue_fmt", label: "Receita", align: "right" },
          { key: "pct_rev", label: "% receita", align: "right" },
        ],
        rows: concentracao.all.map((d) => ({
          name: d.name,
          practitioners: d.practitioners,
          pct_pract: tp > 0 ? fmtPct(d.practitioners / tp * 100) : "—",
          revenue_fmt: fmtBRL(d.revenue),
          pct_rev: tr > 0 ? fmtPct(d.revenue / tr * 100) : "—",
        })),
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
    <>
      <ScrollView
        style={st.screen}
        contentContainerStyle={st.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={KarateColors.primary}
          />
        }
      >
        {/* Page head */}
        <View style={st.pageHead}>
          <Text style={st.eyebrow}>Inteligência da rede · {new Date().getFullYear()}</Text>
          <Text style={st.pageTitle}>Saúde da Rede</Text>
          <Text style={st.pageSub}>
            Visão institucional da rede de afiliados. Indicadores numéricos derivados de dados que a
            federação possui — afiliação de dojôs, anuidades, graduações registradas e cobertura
            geográfica. Cada número abre os registros por trás dele e exporta em CSV.
          </Text>
        </View>

        {/* KPI strip */}
        <KpiStrip data={loading ? null : summary} />

        {/* Cards */}
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
        <View style={st.row2}>
          <View style={{ flex: 1 }}>
            <DormenciaCard
              data={dormencia}
              loading={loading}
              onCsv={() => downloadCsv(federationId, "dormencia")}
              onDetail={() => setDrawerKey("dormencia")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ConcentracaoCard
              data={concentracao}
              loading={loading}
              onCsv={() => downloadCsv(federationId, "concentracao")}
              onDetail={() => setDrawerKey("concentracao")}
            />
          </View>
        </View>

        {/* Periodic report (DESIGN-28) */}
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
    </>
  );
}

// ── StyleSheet ────────────────────────────────────────────────
// Top-level entries are OBJECTS (not strings/colors) to avoid the
// WeakMap pitfall (aura-app armadilha 08/06).

const st = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 12, paddingBottom: 48 } as ViewStyle,

  // Page head
  pageHead:  { marginBottom: 4 } as ViewStyle,
  eyebrow:   { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, color: KarateColors.ink3, marginBottom: 4 } as TextStyle,
  pageTitle: { fontFamily: KarateFonts.heading, fontSize: 30, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  pageSub:   { fontSize: 12, color: KarateColors.ink3, lineHeight: 18, marginTop: 6 } as TextStyle,

  // KPI strip
  kpiRow:   { flexDirection: "row", flexWrap: "wrap", gap: 8 } as ViewStyle,
  kpiCard:  { flex: 1, minWidth: 100, backgroundColor: KarateColors.glass, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, padding: 10 } as ViewStyle,
  kpiLabel: { fontSize: 10, color: KarateColors.ink3, fontWeight: "600", marginBottom: 4 } as TextStyle,
  kpiValue: { fontSize: 18, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  kpiUnit:  { fontSize: 11, fontWeight: "400", color: KarateColors.ink3 } as TextStyle,

  // Cards
  card:    { backgroundColor: KarateColors.glass, borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 10 } as ViewStyle,
  row2:    { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12 } as ViewStyle,

  // Section header
  shRow:        { flexDirection: "row", alignItems: "flex-start", gap: 8 } as ViewStyle,
  shTitle:      { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  shSub:        { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  shActions:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 } as ViewStyle,
  btnCsv:       { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  btnCsvLabel:  { fontSize: 11, fontWeight: "500", color: KarateColors.ink3 } as TextStyle,
  btnDetail:    { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  btnDetailLabel: { fontSize: 11, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  // Hero numbers
  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 10 } as ViewStyle,
  heroNum: { fontSize: 32, fontWeight: "800", color: KarateColors.ink, lineHeight: 36 } as TextStyle,
  heroSub: { fontSize: 11, color: KarateColors.ink3, flexShrink: 1 } as TextStyle,

  // Twin boxes
  twinBoxRow:    { flexDirection: "row", gap: 10 } as ViewStyle,
  twinBox:       { flex: 1, padding: 11, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, backgroundColor: KarateColors.bg2 } as ViewStyle,
  twinBoxOk:     { borderColor: ShojiPalette.ok + "44", backgroundColor: ShojiPalette.okSoft } as ViewStyle,
  twinBoxDanger: { borderColor: ShojiPalette.danger + "44", backgroundColor: ShojiPalette.dangerSoft } as ViewStyle,
  twinBoxWarn:   { borderColor: ShojiPalette.warn + "44", backgroundColor: ShojiPalette.warnSoft } as ViewStyle,
  twinBoxNum:    { fontSize: 18, fontWeight: "800", color: KarateColors.ok } as TextStyle,
  twinBoxLabel:  { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  // Bar chart
  bar:          { borderRadius: 4, width: "100%" } as ViewStyle,
  barValLabel:  { fontSize: 9, color: KarateColors.ink3, marginBottom: 2, textAlign: "center" } as TextStyle,
  barLabel:     { fontSize: 10, color: KarateColors.ink3, marginTop: 4, textAlign: "center" } as TextStyle,
  barSublabel:  { fontSize: 9, color: KarateColors.ink4, textAlign: "center" } as TextStyle,

  // Coverage
  covRow:   { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  covLabel: { width: 88, fontSize: 12, color: KarateColors.ink2 } as TextStyle,
  covBarBg: { flex: 1, height: 7, borderRadius: 999, backgroundColor: KarateColors.bg2, overflow: "hidden" } as ViewStyle,
  covBarFill: { height: 7, borderRadius: 999, backgroundColor: KarateColors.primary, opacity: 0.7 } as ViewStyle,
  covCount:   { fontSize: 12, fontWeight: "700", color: KarateColors.ink, width: 24, textAlign: "right" } as TextStyle,
  gapBox:     { padding: 13, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.primaryLine, backgroundColor: KarateColors.primarySoft } as ViewStyle,
  gapTitle:   { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: KarateColors.primary, marginBottom: 6 } as TextStyle,
  gapBody:    { fontSize: 12, color: KarateColors.ink, lineHeight: 18 } as TextStyle,

  // Inad
  stackBarWrap:    { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", borderWidth: 1, borderColor: KarateColors.border } as ViewStyle,
  stackBarSeg:     { height: "100%" } as ViewStyle,
  inadLegendRow:   { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  inadDot:         { width: 9, height: 9, borderRadius: 2 } as ViewStyle,
  inadLegLabel:    { fontSize: 12, color: KarateColors.ink2 } as TextStyle,
  inadLegN:        { fontSize: 12, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  inadLegPct:      { fontSize: 11, color: KarateColors.ink3, width: 48, textAlign: "right" } as TextStyle,

  // Legend row
  legendRow:   { flexDirection: "row", gap: 14, marginTop: 8, flexWrap: "wrap" } as ViewStyle,
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 6 } as ViewStyle,
  legendDot:   { width: 11, height: 11, borderRadius: 3 } as ViewStyle,
  legendLabel: { fontSize: 11, color: KarateColors.ink3 } as TextStyle,

  // Grad note
  gradNote:    { marginLeft: "auto", fontSize: 10, color: KarateColors.ink4 } as TextStyle,

  // Belt relation
  beltHero:      { paddingRight: 16, borderRightWidth: 1, borderRightColor: KarateColors.border, minWidth: 100 } as ViewStyle,
  beltHeroPct:   { fontSize: 44, fontWeight: "800", color: KarateColors.ink, lineHeight: 48 } as TextStyle,
  beltHeroPctUnit: { fontSize: 22, color: KarateColors.ink3 } as TextStyle,
  beltHeroSub:   { fontSize: 12, color: KarateColors.ink2, marginTop: 8, lineHeight: 16 } as TextStyle,
  beltHeroNote:  { fontSize: 10, color: KarateColors.ink4, marginTop: 8, lineHeight: 15 } as TextStyle,
  beltStat:      { fontSize: 17, fontWeight: "700", color: KarateColors.ink } as TextStyle,
  beltStatLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  beltRow:       { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  beltRowLabel:  { fontSize: 12, color: KarateColors.ink2, width: 110 } as TextStyle,
  beltBar:       { height: 20, borderRadius: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" } as ViewStyle,
  beltRowCount:  { fontSize: 13, fontWeight: "700", color: KarateColors.ink, textAlign: "right" } as TextStyle,
  beltRowPct:    { fontSize: 11, fontWeight: "400", color: KarateColors.ink3 } as TextStyle,

  // Skeleton
  skeletonBase: { backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm } as ViewStyle,

  // Drawer
  drawerOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,38,32,0.32)" } as ViewStyle,
  drawerSheet:   { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%", paddingBottom: 24 } as ViewStyle,
  drawerHeader:  { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  drawerEyebrow: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: KarateColors.ink3, marginBottom: 6 } as TextStyle,
  drawerTitle:   { fontFamily: KarateFonts.heading, fontSize: 22, fontWeight: "400", color: KarateColors.ink } as TextStyle,
  drawerSub:     { fontSize: 12, color: KarateColors.ink3, marginTop: 4 } as TextStyle,
  drawerClose:   { padding: 6, backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm } as ViewStyle,
  drawerToolbar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  drawerEmpty:   { padding: 32, textAlign: "center", color: KarateColors.ink3, fontSize: 12 } as TextStyle,
  drawerFooter:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: KarateColors.border } as ViewStyle,
  drawerCount:   { fontSize: 11, color: KarateColors.ink3, fontVariant: ["tabular-nums"] as any } as TextStyle,
  drawerClause:  { fontSize: 10, color: KarateColors.ink4 } as TextStyle,

  // Drawer table
  tblHead:  { flexDirection: "row", backgroundColor: KarateColors.bg2, paddingVertical: 8, paddingHorizontal: 12 } as ViewStyle,
  tblTh:    { flex: 1, fontSize: 11, fontWeight: "700", color: KarateColors.ink3, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 4 } as TextStyle,
  tblRow:   { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: KarateColors.border } as ViewStyle,
  tblRowAlt: { backgroundColor: KarateColors.bg } as ViewStyle,
  tblTd:    { flex: 1, fontSize: 12, color: KarateColors.ink, paddingHorizontal: 4 } as TextStyle,

  // Search
  searchBox:   { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: KarateColors.bg2, borderRadius: KarateRadius.sm, borderWidth: 1, borderColor: KarateColors.border, paddingHorizontal: 10, paddingVertical: 6 } as ViewStyle,
  searchInput: { flex: 1, fontSize: 13, color: KarateColors.ink } as TextStyle,

  // Export button
  btnExport:      { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 14 } as ViewStyle,
  btnExportLabel: { fontSize: 12, fontWeight: "700", color: "#fff" } as TextStyle,

  // Report widget
  btnSend:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 10, paddingHorizontal: 18, alignSelf: "flex-start" } as ViewStyle,
  btnSendLabel: { fontSize: 13, fontWeight: "700", color: "#fff" } as TextStyle,
  reportResult: { fontSize: 12, color: KarateColors.ink3, marginTop: 4 } as TextStyle,
});
