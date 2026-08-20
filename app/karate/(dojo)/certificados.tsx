// ============================================================
// Aura Karatê (dojô) — Certificados (F9.1: só acompanhamento do OFICIAL)
//
// DECISÃO DE PRODUTO (04/08/2026, dono do produto):
//   "Vamos deixar o certificado dentro de eventos, idêntico ao que temos
//    na federação. Dentro de eventos vamos fazer a emissão e impressão em
//    massa e também criar o design. Essa página então será apenas para
//    visualizar o status dos certificados que foram pedidos para a
//    federação. Processo: Dojô faz exame de kyu, emite certificado do
//    Dojô para os aprovados e solicita para a federação o certificado de
//    Kyu da federação, que é o oficial."
//
// DOIS CERTIFICADOS DISTINTOS PARA A MESMA GRADUAÇÃO — o risco real é o
// sensei achar que são o mesmo documento:
//   • O DA FEDERAÇÃO (OFICIAL) — esta tela. "Praticantes aptos" +
//     "Meus pedidos" (Track J, intocado nesta leva): fila derivada de
//     graduação sem pedido ativo, POST /cert-orders, acompanhamento de
//     status. Documento HOMOLOGADO pela FPKT.
//   • O DO PRÓPRIO DOJÔ (NÃO OFICIAL) — NÃO mora mais aqui. Editor de
//     modelo + emissão/impressão em massa agora vivem DENTRO do exame de
//     kyu ("Meus eventos" → exame concluído), reusando
//     DojoExamCertificatesManager.tsx (novo, F9.1) — o mesmo motor de
//     renderização da federação (buildCertificateHtml.ts/
//     CertificatePreview.tsx), sem tocá-lo. Documento interno, que o
//     sensei entrega na hora ao aluno.
//
// Por isso o card de explicação logo abaixo do título: ele existe nas
// DUAS variantes da tela (conectado e não conectado) — quem chega aqui
// achando que vai "emitir o certificado do dojô" precisa ser redirecionado
// para "Meus eventos" ANTES de esbarrar num formulário que não é o que
// procura.
//
// Gate: a fila do OFICIAL exige dojô conectado (409 DOJO_NAO_CONECTADO)
// — regra que não muda (é a federação que homologa). O card de explicação
// aparece MESMO sem conexão, porque a pergunta "onde emito o certificado
// do meu dojô" independe de estar conectado ou não.
//
// F1→F5b→F9.1: o corpo funcional (loadAptos/loadOrders/submit/UI de
// Praticantes aptos + Meus pedidos) é o MESMO da F5b — não alterado além
// do texto de cabeçalho e da inserção do card de distinção. Ver
// bug_karate_parcela_vence_hoje_overdue_30jul2026 / qa_aura_dojo_prod_27jul2026
// para o histórico desta seção.
// ============================================================
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateFonts, KarateColors, KarateRadius } from "@/constants/karateTheme";
import { useKarateFederation } from "@/contexts/KarateFederation";
import { useKarateDojo } from "@/contexts/KarateDojo";
import { toast } from "@/components/Toast";
import {
  karateDojoFederativoApi, AptoRow, DojoCertOrderRow, DojoCertOrderStatus, CreateCertOrdersResult,
} from "@/services/karateDojoFederativoApi";
import { AptosList } from "@/components/karate/dojoFederativo/AptosList";
import { PedidosList } from "@/components/karate/dojoFederativo/PedidosList";
import { ResultadoLoteCard } from "@/components/karate/dojoFederativo/ResultadoLoteCard";
import { mapDojoFederativoError } from "@/components/karate/dojoFederativo/helpers";
import { Skeleton } from "@/components/karate/Skeleton";

// Card fixo no topo — distingue o certificado OFICIAL (esta tela) do
// certificado do PRÓPRIO DOJÔ (emitido dentro do evento/exame). Mesmo em
// telas sem conexão: a pergunta "onde emito o do meu dojô" não depende
// de estar conectado à federação.
function DoisDocumentosCard({ onGoEventos }: { onGoEventos: () => void }) {
  return (
    <View style={st.docsCard}>
      <View style={st.docsRow}>
        <View style={[st.docsGlyph, { backgroundColor: KarateColors.primarySoft }]}>
          <Icon name="ribbon" size={18} color={KarateColors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.docsTitle}>Certificado oficial · Federação FPKT</Text>
          <Text style={st.docsBody}>
            É o que esta página acompanha: o dojô faz o exame de kyu, e os aprovados entram na fila abaixo para
            o pedido do certificado <Text style={{ fontWeight: "800" }}>homologado pela federação</Text>.
          </Text>
        </View>
      </View>
      <View style={st.docsDivider} />
      <View style={st.docsRow}>
        <View style={[st.docsGlyph, { backgroundColor: KarateColors.bg2 }]}>
          <Icon name="edit" size={18} color={KarateColors.ink2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.docsTitle}>Certificado do próprio dojô · não oficial</Text>
          <Text style={st.docsBody}>
            O documento que você desenha e entrega na hora ao aluno agora se emite <Text style={{ fontWeight: "800" }}>dentro do exame de kyu</Text>,
            em "Meus eventos" — com editor de modelo e impressão em massa. Não substitui o certificado oficial acima.
          </Text>
          <TouchableOpacity style={st.docsLinkBtn} onPress={onGoEventos} accessibilityRole="button" accessibilityLabel="Ir para Meus eventos">
            <Text style={st.docsLinkTxt}>Ir para Meus eventos</Text>
            <Icon name="arrow_right" size={13} color={KarateColors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function DojoCertificadosScreen() {
  const router = useRouter();
  const { federationId } = useKarateFederation();
  const { dojoName, linked } = useKarateDojo();

  const [aptos, setAptos] = useState<AptoRow[]>([]);
  const [aptosLoading, setAptosLoading] = useState(true);
  const [aptosError, setAptosError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<CreateCertOrdersResult | null>(null);

  const [orders, setOrders] = useState<DojoCertOrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DojoCertOrderStatus | "all">("all");

  const goEventos = () => router.push("/karate/(dojo)/eventos" as any);

  const loadAptos = useCallback(async () => {
    if (!federationId || !linked) { setAptosLoading(false); return; }
    setAptosLoading(true);
    setAptosError(false);
    try {
      const res = await karateDojoFederativoApi.getAptos(federationId);
      setAptos(res.data);
    } catch (e: any) {
      // Erro de leitura: nunca fica indistinguível de "vazio de verdade" —
      // aptosError liga o estado de erro (com retry) em vez do empty state.
      setAptos([]);
      setAptosError(true);
    } finally {
      setAptosLoading(false);
    }
  }, [federationId, linked]);

  const loadOrders = useCallback(async () => {
    if (!federationId || !linked) { setOrdersLoading(false); return; }
    setOrdersLoading(true);
    setOrdersError(false);
    try {
      const res = await karateDojoFederativoApi.listCertOrders(federationId, {
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setOrders(res.data);
    } catch (e: any) {
      setOrders([]);
      setOrdersError(true);
    } finally {
      setOrdersLoading(false);
    }
  }, [federationId, linked, statusFilter]);

  useEffect(() => { loadAptos(); }, [loadAptos]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  const toggleApto = (beltHistoryId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(beltHistoryId)) next.delete(beltHistoryId); else next.add(beltHistoryId);
      return next;
    });
  };

  const submit = async () => {
    if (!federationId || selected.size === 0) return;
    setCreating(true);
    setResult(null);
    try {
      const items = aptos
        .filter((a) => selected.has(a.belt_history_id))
        .map((a) => ({ student_id: a.student_id, belt_history_id: a.belt_history_id }));
      const res = await karateDojoFederativoApi.createCertOrders(federationId, { items });
      setResult(res);
      setSelected(new Set());
      if (res.created > 0) {
        toast.success(`${res.created} certificado${res.created === 1 ? "" : "s"} pedido${res.created === 1 ? "" : "s"}.`);
      }
      await Promise.all([loadAptos(), loadOrders()]);
    } catch (e: any) {
      toast.error(mapDojoFederativoError(e));
    } finally {
      setCreating(false);
    }
  };

  const goFederar = () => router.push("/karate/(dojo)/alunos" as any);

  if (!linked) {
    return (
      <ScrollView style={st.screen} contentContainerStyle={st.content}>
        <View style={st.head}>
          <Text style={st.eyebrow}>{dojoName}</Text>
          <Text style={st.title}>Certificados · Federação</Text>
        </View>
        <DoisDocumentosCard onGoEventos={goEventos} />
        <View style={st.emptyCard}>
          <Icon name="ribbon" size={32} color={KarateColors.ink4} />
          <Text style={st.emptyText}>Conecte seu dojô à federação para pedir certificados oficiais.</Text>
          <TouchableOpacity
            style={st.connectBtn}
            onPress={() => router.push("/karate/(dojo)/conexao" as any)}
            accessibilityRole="button"
            accessibilityLabel="Conectar meu dojô à federação"
          >
            <Icon name="link" size={14} color={KarateColors.primary} />
            <Text style={st.connectBtnTxt}>Conectar meu dojô</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={st.screen} contentContainerStyle={st.content}>
      <View style={st.head}>
        <Text style={st.eyebrow}>{dojoName}</Text>
        <Text style={st.title}>Certificados · Federação</Text>
      </View>

      <DoisDocumentosCard onGoEventos={goEventos} />

      {/* Section: Praticantes aptos */}
      <View style={st.sectionHead}>
        <View>
          <Text style={st.h2}>Praticantes aptos</Text>
          <Text style={st.sh}>Aprovados em banca — graduação já consta no histórico</Text>
        </View>
        {selected.size > 0 && (
          <TouchableOpacity style={st.btnPrimary} onPress={submit} disabled={creating} accessibilityRole="button">
            {creating ? <ActivityIndicator size="small" color="#fff" /> : (
              <Text style={st.btnPrimaryText}>Pedir certificados ({selected.size})</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {!!result && (
        <ResultadoLoteCard
          successCount={result.created}
          successLabel={result.created === 1 ? "certificado pedido" : "certificados pedidos"}
          skipped={result.skipped}
          onGoFederar={goFederar}
          onClose={() => setResult(null)}
        />
      )}

      {aptosLoading ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {[0, 1, 2, 3].map((c) => (
            <View
              key={c}
              style={{ flexBasis: 280, flexGrow: 1, maxWidth: 380, backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, gap: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Skeleton width={20} height={20} radius={5} />
                <View style={{ flex: 1, gap: 5 }}>
                  <Skeleton width="70%" height={13} />
                  <Skeleton width="45%" height={12} />
                </View>
              </View>
              <Skeleton width="80%" height={11} />
              <Skeleton width="60%" height={11} />
            </View>
          ))}
        </View>
      ) : aptosError ? (
        <View style={st.emptyCard}>
          <Icon name="alert_circle" size={28} color={KarateColors.ink3} />
          <Text style={st.emptyText}>Não foi possível carregar os praticantes aptos.</Text>
          <TouchableOpacity style={st.retryBtn} onPress={loadAptos} accessibilityRole="button">
            <Text style={st.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      ) : aptos.length === 0 ? (
        <View style={st.emptyCard}>
          <Icon name="ribbon" size={32} color={KarateColors.ink4} />
          <Text style={st.emptyText}>Nenhum praticante apto no momento</Text>
          <Text style={st.emptySub}>
            Quando a federação aprovar graduações do seu dojô em banca, os aptos aparecem aqui para você pedir o certificado.
          </Text>
        </View>
      ) : (
        <AptosList aptos={aptos} selected={selected} onToggle={toggleApto} />
      )}

      {/* Section: Meus pedidos */}
      <View style={[st.sectionHead, { marginTop: 24 }]}>
        <View>
          <Text style={st.h2}>Meus pedidos</Text>
          <Text style={st.sh}>Solicitações deste dojô — estado atualizado pela federação</Text>
        </View>
      </View>

      {ordersError ? (
        <View style={st.emptyCard}>
          <Icon name="alert_circle" size={28} color={KarateColors.ink3} />
          <Text style={st.emptyText}>Não foi possível carregar seus pedidos.</Text>
          <TouchableOpacity style={st.retryBtn} onPress={loadOrders} accessibilityRole="button">
            <Text style={st.retryTxt}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <PedidosList
          orders={orders}
          loading={ordersLoading}
          statusFilter={statusFilter}
          onChangeFilter={setStatusFilter}
        />
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: KarateColors.bg } as ViewStyle,
  content: { padding: 16, paddingBottom: 48 } as ViewStyle,

  head: { marginBottom: 14 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: KarateFonts.mono } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,

  docsCard: { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, padding: 14, marginBottom: 18, gap: 12 } as ViewStyle,
  docsRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" } as ViewStyle,
  docsGlyph: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" } as ViewStyle,
  docsTitle: { fontSize: 13, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  docsBody: { fontSize: 12, color: KarateColors.ink3, marginTop: 3, lineHeight: 17 } as TextStyle,
  docsDivider: { height: 1, backgroundColor: KarateColors.border } as ViewStyle,
  docsLinkBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, alignSelf: "flex-start" } as ViewStyle,
  docsLinkTxt: { fontSize: 12.5, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  sectionHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 10 } as ViewStyle,
  h2: { fontSize: 16, fontWeight: "800", color: KarateColors.ink } as TextStyle,
  sh: { fontSize: 12, color: KarateColors.ink3, marginTop: 2 } as TextStyle,

  emptyCard: { backgroundColor: "#fff", borderRadius: KarateRadius.md, borderWidth: 1, borderColor: KarateColors.border, alignItems: "center", paddingVertical: 32, paddingHorizontal: 24, gap: 8, marginBottom: 12 } as ViewStyle,
  emptyText: { fontSize: 13, color: KarateColors.ink4, fontWeight: "600", textAlign: "center" } as TextStyle,
  emptySub: { fontSize: 12, color: KarateColors.ink3, textAlign: "center", maxWidth: 360, lineHeight: 17 } as TextStyle,

  connectBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 9, paddingHorizontal: 16 } as ViewStyle,
  connectBtnTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  retryBtn: { marginTop: 2, backgroundColor: KarateColors.primarySoft, borderRadius: KarateRadius.sm, paddingVertical: 8, paddingHorizontal: 16 } as ViewStyle,
  retryTxt: { fontSize: 13, fontWeight: "700", color: KarateColors.primary } as TextStyle,

  btnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: KarateColors.primary, borderRadius: KarateRadius.sm, paddingVertical: 10, paddingHorizontal: 16 } as ViewStyle,
  btnPrimaryText: { fontSize: 13, fontWeight: "700", color: "#fff" } as TextStyle,
});
