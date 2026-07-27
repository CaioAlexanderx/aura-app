// ============================================================
// Aura Karatê (dojô) — Certificados (F5b: dados reais)
//
// Dojô vê:
//   1. "Praticantes aptos" — GET /aptos (Aura-backend#426). A UNIDADE é a
//      GRADUAÇÃO (belt_history), não o aluno — por isso a seleção usa
//      belt_history_id como chave (um aluno pode aparecer 2x se tiver 2
//      graduações sem pedido). Seleção múltipla + "Pedir certificados
//      (N)" → POST /cert-orders.
//   2. "Meus pedidos" — GET /cert-orders (dojô-scoped) com filtro por
//      status e EstadoSelo (PedidosList).
//
// Regra de ouro: só aluno FEDERADO chega em /aptos (o backend já filtra
// na origem). Se ainda assim algum item vier recusado no POST (corrida —
// ex.: desvinculado entre o load e o submit), o skip vem mapeado em
// pt-BR (dojoFederativo/helpers.mapSkipReason) com o motivo, e o card de
// resultado oferece o atalho para federar.
//
// Gate: a rota exige dojô conectado (409 DOJO_NAO_CONECTADO) — mesmo
// padrão de eventos.tsx/conexao.tsx: usa `linked` do contexto (fail-open)
// e só chama a API quando conectado; nunca round-trip à toa.
//
// F1→F5b: MOCK_APTOS morreu no polish 25/07; esta rewrite substitui o
// TODO(F5) que ficou marcado no lugar da seção "Praticantes aptos".
//
// QA 27/07 (item 1): loadAptos/loadOrders caíam em catch MUDO (lista
// vazia sem sinalizar nada) — uma falha de leitura (ex.: 503
// SCHEMA_PENDING, 500 SQL_SCHEMA_MISMATCH) ficava indistinguível de
// "realmente não há nada aqui", e a tela mostrava o empty state normal
// como se estivesse tudo certo. Agora cada seção guarda um estado de
// erro próprio (aptosError/ordersError) com mensagem visível + botão
// "Tentar de novo", mesmo padrão já usado em eventos.tsx. A escrita
// (submit → "Pedir certificados") já tinha loading+toast.error, mas o
// ToastContainer não estava montado no grupo (dojo) — corrigido em
// (dojo)/_layout.tsx nesta mesma leva.
//
// StyleSheet: todos os top-level são objetos (WeakMap safe). Sem deps
// novas.
// ============================================================
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, ViewStyle, TextStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateRadius } from "@/constants/karateTheme";
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
          <Text style={st.title}>Certificados</Text>
        </View>
        <View style={st.emptyCard}>
          <Icon name="ribbon" size={32} color={KarateColors.ink4} />
          <Text style={st.emptyText}>Conecte seu dojô à federação para pedir certificados.</Text>
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
        <Text style={st.title}>Certificados</Text>
      </View>

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
        <View style={st.emptyCard}><ActivityIndicator color={KarateColors.primary} /></View>
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

  head: { marginBottom: 18 } as ViewStyle,
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: KarateColors.ink3, fontFamily: "monospace" } as TextStyle,
  title: { fontSize: 24, fontWeight: "800", color: KarateColors.ink, marginTop: 2 } as TextStyle,

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
