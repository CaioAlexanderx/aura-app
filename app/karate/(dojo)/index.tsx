// ============================================================
// Aura Karatê (dojô) — Painel (F1; F2 no card de faixas)
// Home do shell completo do dojô: cards-resumo com os MESMOS dados que
// as telas internas já buscam:
//   • Alunos / faixas       → alunos PRÓPRIOS (F2, summary) quando
//                             existirem; senão karateApi.listSenseiPractitioners
//   • Situação da anuidade  → karateApi.getSenseiAnnuity
//   • Últimas solicitações  → karateApi.listPractitionerRequests
//   • Atalho p/ Certificados
// Cada bloco falha sozinho (Promise.allSettled) — um endpoint fora do
// ar não derruba o painel inteiro. Datas: parse manual tz-safe.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import {
  KarateColors, KarateRadius, KarateBelts, BeltKey, resolveBeltKey,
  beltRank, annuityStatusView,
} from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { karateApi, SenseiPractitioner, SenseiAnnuityResponse } from "@/services/karateApi";
import { karateDojoStudentsApi, DojoStudentsSummary } from "@/services/karateDojoStudentsApi";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Formata 'YYYY-MM-DD' sem cair no bug de -1 dia (parse manual, sem Date UTC).
function fmtDataLonga(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  const [, y, mo, d] = m;
  const mi = parseInt(mo, 10) - 1;
  if (mi < 0 || mi > 11) return String(iso);
  return `${parseInt(d, 10)} de ${MESES[mi]} de ${y}`;
}

function fmtValor(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// listPractitionerRequests: normalização defensiva do envelope (o Painel
// só precisa de nome/status/data — não acopla no shape exato da lista).
function normalizeRequests(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.requests)) return res.requests;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

const REQ_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Recusada",
  refused: "Recusada",
};

export default function DojoPainel() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const { dojoName } = useKarateDojo();

  const [loading, setLoading] = useState(true);
  // null = aquele bloco falhou (mostra aviso no card); [] = veio vazio.
  const [pracs, setPracs] = useState<SenseiPractitioner[] | null>(null);
  const [annuity, setAnnuity] = useState<SenseiAnnuityResponse | null>(null);
  const [annuityFailed, setAnnuityFailed] = useState(false);
  const [requests, setRequests] = useState<any[] | null>(null);
  // F2: summary dos alunos PRÓPRIOS do dojô (null = endpoint falhou/sem dado).
  const [ownSummary, setOwnSummary] = useState<DojoStudentsSummary | null>(null);

  const load = useCallback(async () => {
    if (!federationId) return;
    setLoading(true);
    const [p, a, r, s] = await Promise.allSettled([
      karateApi.listSenseiPractitioners(federationId),
      karateApi.getSenseiAnnuity(federationId),
      karateApi.listPractitionerRequests(federationId),
      karateDojoStudentsApi.listStudents(federationId, { summary: true }),
    ]);
    setPracs(p.status === "fulfilled" ? ((p.value as any)?.practitioners ?? []) : null);
    setAnnuity(a.status === "fulfilled" ? (a.value as SenseiAnnuityResponse) : null);
    setAnnuityFailed(a.status !== "fulfilled");
    setRequests(r.status === "fulfilled" ? normalizeRequests(r.value) : null);
    setOwnSummary(s.status === "fulfilled" ? ((s.value as any)?.summary ?? null) : null);
    setLoading(false);
  }, [federationId]);

  useEffect(() => { load(); }, [load]);

  // F2: quando o dojô já tem alunos PRÓPRIOS (summary.total > 0), o card
  // de faixas passa a usar summary.by_belt deles — é o dado que o dojô
  // controla. Sem nenhum aluno próprio (ou com o endpoint fora do ar),
  // MANTÉM a derivação federada da F1: o painel nunca fica pior do que
  // era antes de existir o registro próprio.
  const useOwn = !!ownSummary && ownSummary.total > 0;
  const piramide = useMemo(() => {
    if (useOwn && ownSummary) {
      return (ownSummary.by_belt ?? [])
        .filter((b) => b.count > 0)
        .sort((a, b) => (b.belt_order ?? -1) - (a.belt_order ?? -1))
        .map((b) => {
          const key = b.belt_label ? resolveBeltKey(b.belt_label) : null;
          return {
            id: `own-${b.belt_label ?? "sem-faixa"}`,
            label: b.belt_label ?? "Sem faixa",
            color: key ? KarateBelts[key].color : KarateColors.bg2,
            n: b.count,
          };
        });
    }
    const counts = new Map<BeltKey, number>();
    for (const p of pracs ?? []) {
      if (!p.is_active) continue;
      const key = resolveBeltKey(p.belt_name || p.belt_level || "");
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => beltRank(b[0]) - beltRank(a[0]))
      .map(([belt, n]) => ({ id: belt as string, label: KarateBelts[belt].label, color: KarateBelts[belt].color, n }));
  }, [pracs, ownSummary, useOwn]);

  const total = useOwn && ownSummary ? ownSummary.total : (pracs?.length ?? 0);
  const ativos = useOwn && ownSummary ? ownSummary.active : (pracs ?? []).filter((p) => p.is_active).length;
  const maxP = Math.max(1, ...piramide.map((p) => p.n));
  const topFaixas = piramide.slice(0, 4);
  const outrasFaixas = piramide.length > 4 ? piramide.slice(4).reduce((s, p) => s + p.n, 0) : 0;

  const pending = annuity?.pending ?? null;
  const annuityMeta = pending
    ? annuityStatusView(pending.status)
    : { ...annuityStatusView("paid"), label: "Em dia" };
  const annuityDue = pending ? fmtDataLonga(pending.due_date) : null;

  const reqs = requests ?? [];
  const pendReqCount = reqs.filter((r) => String(r?.status ?? "pending") === "pending").length;
  const recentes = [...reqs]
    .sort((a, b) => String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? "")))
    .slice(0, 3);

  const go = (route: string) => router.push(route as any);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.eyebrow}>Aura Karatê · {dojoName}</Text>
        <Text style={styles.title}>Painel do dojô</Text>
        <Text style={styles.lead}>O resumo do seu dojô num lugar só: alunos, anuidade, solicitações e certificados.</Text>
      </View>

      {loading && (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={KarateColors.primary} />
        </View>
      )}

      {!loading && (
        <View style={styles.grid}>
          {/* ── Card: Alunos / faixas (F2: próprios > federados) ── */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Icon name="users" size={16} color={KarateColors.primary} />
              <Text style={styles.cardTitle}>Alunos</Text>
            </View>
            {pracs === null && !useOwn ? (
              <Text style={styles.cardErr}>Não foi possível carregar. <Text style={styles.cardErrLink} onPress={load}>Tentar de novo</Text></Text>
            ) : (
              <>
                <View style={styles.bigRow}>
                  <Text style={styles.bigNum}>{total}</Text>
                  <Text style={styles.bigSub}>{ativos} ativo{ativos === 1 ? "" : "s"}{useOwn ? "" : " · na federação"}</Text>
                </View>
                {topFaixas.length > 0 && (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    {topFaixas.map((p) => (
                      <View key={p.id} style={styles.pyRow}>
                        <Text style={styles.pyLabel} numberOfLines={1}>{p.label}</Text>
                        <View style={styles.pyTrack}>
                          <View style={[styles.pyBar, { width: `${(p.n / maxP) * 100}%`, backgroundColor: p.color }]} />
                        </View>
                        <Text style={styles.pyNum}>{p.n}</Text>
                      </View>
                    ))}
                    {outrasFaixas > 0 && (
                      <Text style={styles.pyMore}>+ {outrasFaixas} em outras faixas</Text>
                    )}
                  </View>
                )}
                {total === 0 && (
                  <Text style={styles.cardEmpty}>Nenhum aluno cadastrado ainda.</Text>
                )}
              </>
            )}
            <TouchableOpacity style={styles.cardLinkBtn} onPress={() => go("/karate/(dojo)/alunos")} accessibilityRole="link">
              <Text style={styles.cardLinkTxt}>Ver alunos</Text>
              <Icon name="arrow-forward" size={13} color={KarateColors.primary} />
            </TouchableOpacity>
          </View>

          {/* ── Card: Anuidade ── */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Icon name="wallet" size={16} color={KarateColors.primary} />
              <Text style={styles.cardTitle}>Anuidade</Text>
            </View>
            {annuityFailed ? (
              <Text style={styles.cardErr}>Não foi possível carregar. <Text style={styles.cardErrLink} onPress={load}>Tentar de novo</Text></Text>
            ) : (
              <View style={[styles.annuityBox, { backgroundColor: annuityMeta.bg, borderColor: annuityMeta.color }]}>
                <Icon name={annuityMeta.icon as any} size={20} color={annuityMeta.color} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.annuityT, { color: annuityMeta.color }]}>
                    {pending ? `Anuidade ${pending.reference_period} · ${annuityMeta.label}` : `Anuidade · ${annuityMeta.label}`}
                  </Text>
                  {!!annuityDue && <Text style={styles.annuitySub}>Vence em {annuityDue}</Text>}
                  {!pending && <Text style={styles.annuitySub}>Nenhuma pendência no momento</Text>}
                </View>
                {pending && <Text style={styles.annuityValor}>{fmtValor(pending.amount)}</Text>}
              </View>
            )}
            <TouchableOpacity style={styles.cardLinkBtn} onPress={() => go("/karate/(dojo)/anuidade")} accessibilityRole="link">
              <Text style={styles.cardLinkTxt}>Ver anuidade e Pix</Text>
              <Icon name="arrow-forward" size={13} color={KarateColors.primary} />
            </TouchableOpacity>
          </View>

          {/* ── Card: Solicitações ── */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Icon name="paper-plane-outline" size={16} color={KarateColors.primary} />
              <Text style={styles.cardTitle}>Solicitações</Text>
            </View>
            {requests === null ? (
              <Text style={styles.cardErr}>Não foi possível carregar. <Text style={styles.cardErrLink} onPress={load}>Tentar de novo</Text></Text>
            ) : (
              <>
                <View style={styles.bigRow}>
                  <Text style={styles.bigNum}>{pendReqCount}</Text>
                  <Text style={styles.bigSub}>pendente{pendReqCount === 1 ? "" : "s"} de análise</Text>
                </View>
                {recentes.length > 0 ? (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    {recentes.map((r, i) => {
                      const nome = String(r?.name ?? r?.full_name ?? "Praticante");
                      const st = String(r?.status ?? "pending");
                      return (
                        <View key={String(r?.id ?? i)} style={styles.reqRow}>
                          <Text style={styles.reqNome} numberOfLines={1}>{nome}</Text>
                          <Text style={styles.reqStatus}>{REQ_STATUS_LABEL[st] ?? st}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.cardEmpty}>Nenhuma solicitação enviada ainda.</Text>
                )}
              </>
            )}
            <TouchableOpacity style={styles.cardLinkBtn} onPress={() => go("/karate/(dojo)/solicitacoes")} accessibilityRole="link">
              <Text style={styles.cardLinkTxt}>Solicitar praticante novo</Text>
              <Icon name="arrow-forward" size={13} color={KarateColors.primary} />
            </TouchableOpacity>
          </View>

          {/* ── Card: atalho Certificados ── */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Icon name="ribbon" size={16} color={KarateColors.primary} />
              <Text style={styles.cardTitle}>Certificados</Text>
            </View>
            <Text style={styles.cardBody}>
              Peça o certificado impresso dos praticantes aprovados em banca e acompanhe o estado de cada pedido — a federação imprime e envia.
            </Text>
            <TouchableOpacity style={styles.cardLinkBtn} onPress={() => go("/karate/(dojo)/certificados")} accessibilityRole="link">
              <Text style={styles.cardLinkTxt}>Ir para Certificados</Text>
              <Icon name="arrow-forward" size={13} color={KarateColors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, gap: 14, paddingBottom: 40 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.primary, textTransform: "uppercase" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,
  lead: { fontSize: 13, color: KarateColors.ink3, marginTop: 4, lineHeight: 18, maxWidth: 460 } as TextStyle,
  stateBox: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 } as ViewStyle,

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 } as ViewStyle,
  card: {
    flexGrow: 1,
    flexBasis: 300,
    backgroundColor: KarateColors.surface,
    borderRadius: KarateRadius.md,
    borderWidth: 1,
    borderColor: KarateColors.border,
    padding: 14,
    gap: 10,
  } as ViewStyle,
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle,
  cardTitle: { fontSize: 14, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  cardBody: { fontSize: 12.5, color: KarateColors.ink2, lineHeight: 18 } as TextStyle,
  cardEmpty: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,
  cardErr: { fontSize: 12.5, color: KarateColors.ink3, lineHeight: 18 } as TextStyle,
  cardErrLink: { color: KarateColors.primary, fontWeight: "700" } as TextStyle,

  bigRow: { flexDirection: "row", alignItems: "baseline", gap: 8 } as ViewStyle,
  bigNum: { fontSize: 28, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  bigSub: { fontSize: 12, color: KarateColors.ink3 } as TextStyle,

  pyRow: { flexDirection: "row", alignItems: "center", gap: 10 } as ViewStyle,
  pyLabel: { width: 84, fontSize: 11.5, color: KarateColors.ink2 } as TextStyle,
  pyTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: KarateColors.bg2, overflow: "hidden" } as ViewStyle,
  pyBar: { height: 12, borderRadius: 6, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" } as ViewStyle,
  pyNum: { width: 24, textAlign: "right", fontSize: 11.5, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,
  pyMore: { fontSize: 11, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  annuityBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: KarateRadius.sm,
    borderWidth: 1,
    padding: 12,
  } as ViewStyle,
  annuityT: { fontSize: 13, fontWeight: "800" } as TextStyle,
  annuitySub: { fontSize: 11.5, color: KarateColors.ink2, marginTop: 2 } as TextStyle,
  annuityValor: { fontSize: 15, fontWeight: "800", color: KarateColors.ink, fontFamily: "monospace" } as TextStyle,

  reqRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 } as ViewStyle,
  reqNome: { flex: 1, fontSize: 12.5, fontWeight: "600", color: KarateColors.ink } as TextStyle,
  reqStatus: { fontSize: 11, fontWeight: "700", color: KarateColors.ink3 } as TextStyle,

  cardLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 2,
    backgroundColor: KarateColors.primarySoft,
    borderRadius: KarateRadius.sm,
    paddingVertical: 7,
    paddingHorizontal: 11,
  } as ViewStyle,
  cardLinkTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,
});
