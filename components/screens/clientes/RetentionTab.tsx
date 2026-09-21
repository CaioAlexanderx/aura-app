// ============================================================
// RetentionTab — aba Retenção de Clientes, de verdade (Fase 1, C1.8)
//
// Antes: texto fixo dizendo que as estatísticas "serão calculadas
// conforme você cadastrar clientes". A aba existia, os dados também (a
// mesma lista que a tela de Clientes já carrega tem primeira compra,
// última compra e total de compras por cliente) — só não tinham virado
// tela. Ver services/retentionCalc.ts para a conta e o que nela é
// aproximado (a lista não guarda CADA compra, só a primeira e a última).
//
// Multi-CNPJ desde o desenho (armadilha 2 do CLAUDE.md): useCustomers()
// já devolve a lista certa nos dois modos — no consolidado, TODAS as
// lojas, um cliente só uma vez. Nada aqui pergunta "e se for
// consolidado?" depois — a conta é a mesma lista, sempre.
//
// Armadilha 1 do CLAUDE.md (plano stale no JWT): esta aba é Negócio+; o
// gate de plano mora em app/(tabs)/clientes.tsx, que já decide se monta
// este componente. Mesmo assim, revalida /auth/me no mount — mesmo
// padrão do ReativacaoEntrada, para não confiar num plano que pode ter
// mudado há uma hora.
// ============================================================
import { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useCustomers } from "@/hooks/useCustomers";
import { useAuthStore } from "@/stores/auth";
import { fmt } from "@/components/screens/clientes/types";
import {
  BASE_MINIMA,
  contarComCompra,
  recompraEmDias,
  intervaloMedioEntreCompras,
  clientesQueVoltaramNoMes,
  novosXRetornandoPorMes,
  distribuicaoPorFaixa,
  type FaixaDistribuicao,
} from "@/services/retentionCalc";
import type { FaixaDias } from "@/components/screens/clientes/diasSemComprar";

// Cor por faixa — mesma leitura da lista (ativo = ok, perdido = grave).
const COR_FAIXA: Record<FaixaDias, string> = {
  ativo: Colors.green,
  em_risco: Colors.amber,
  inativo: Colors.violet3,
  perdido: Colors.red,
};

// Corte de dias que abre a reativação já filtrada nessa faixa — o min de
// cada faixa em diasSemComprar.ts (31, 61, 121); "ativo" não manda para
// lá, a reativação é para quem parou.
const DIAS_DA_FAIXA: Partial<Record<FaixaDias, number>> = {
  em_risco: 31,
  inativo: 61,
  perdido: 121,
};

function irParaReativacao(dias: number) {
  router.push(`/clientes/reativacao?dias=${dias}`);
}

/** "7 em cada 10" a partir de um percentual (0-100). */
function emCada10(percentual: number): number {
  return Math.round(percentual / 10);
}

export function RetentionTab() {
  const { customers, isLoading, isError, refetch, consolidatedView, companyCount } = useCustomers();

  // Armadilha 1: o plano vem do JWT e não revalida sozinho.
  useEffect(() => {
    const st: any = (useAuthStore as any)?.getState?.();
    st?.refreshMe?.();
  }, []);

  const baseComCompra = useMemo(() => contarComCompra(customers), [customers]);
  const r90 = useMemo(() => recompraEmDias(customers, 90), [customers]);
  const r180 = useMemo(() => recompraEmDias(customers, 180), [customers]);
  const intervaloMedio = useMemo(() => intervaloMedioEntreCompras(customers), [customers]);
  const voltaramMes = useMemo(() => clientesQueVoltaramNoMes(customers), [customers]);
  const meses = useMemo(() => novosXRetornandoPorMes(customers, 6), [customers]);
  const faixas = useMemo(() => distribuicaoPorFaixa(customers), [customers]);

  const lojas = consolidatedView ? companyCount || 1 : 1;
  const cedoDemais = !isLoading && !isError && baseComCompra < BASE_MINIMA;

  if (isLoading) {
    return (
      <View style={s.card} testID="retencao-real-loading">
        <ActivityIndicator color={Colors.violet} />
        <Text style={s.loadingTxt}>Calculando a retenção da sua base…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={s.card} testID="retencao-real-erro">
        <Text style={s.title}>Não foi possível calcular a retenção</Text>
        <Text style={s.desc}>A lista de clientes não chegou do servidor. Tente de novo.</Text>
        <Pressable onPress={() => refetch()} style={s.retryBtn} testID="retencao-real-erro-tentar">
          <Text style={s.retryTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  if (cedoDemais) {
    return (
      <View style={s.card} testID="retencao-real-cedo">
        <Text style={s.title}>Ainda é cedo para medir retenção</Text>
        <Text style={s.desc}>
          {baseComCompra === 0
            ? "Nenhum cliente com compra registrada ainda."
            : `Só ${baseComCompra} ${baseComCompra === 1 ? "cliente tem" : "clientes têm"} compra registrada até agora.`}
          {" "}A partir de {BASE_MINIMA} clientes com compra os números começam a dizer algo.
        </Text>
      </View>
    );
  }

  return (
    <View testID="retencao-real">
      {lojas > 1 && (
        <Text style={s.lojasNota} testID="retencao-real-multi-cnpj">
          Somando as {lojas} lojas da visão consolidada — cada cliente conta uma vez.
        </Text>
      )}

      {/* ---- Indicadores ---- */}
      <View style={s.grid}>
        <Indicador
          testID="retencao-real-recompra-90"
          numero={r90.percentual == null ? "—" : `${r90.percentual.toFixed(0)}%`}
          label="Recompra em 90 dias"
          frase={
            r90.percentual == null
              ? "Ainda não há clientes com pelo menos 90 dias de casa para medir isso."
              : `${emCada10(100 - r90.percentual)} em cada 10 clientes não voltaram a comprar em até 90 dias.`
          }
          botao={r90.percentual != null ? { label: "Ver quem não voltou", dias: 90 } : undefined}
        />
        <Indicador
          testID="retencao-real-recompra-180"
          numero={r180.percentual == null ? "—" : `${r180.percentual.toFixed(0)}%`}
          label="Recompra em 180 dias"
          frase={
            r180.percentual == null
              ? "Ainda não há clientes com pelo menos 180 dias de casa para medir isso."
              : `${emCada10(100 - r180.percentual)} em cada 10 clientes não voltaram a comprar em até 180 dias.`
          }
          botao={r180.percentual != null ? { label: "Ver quem não voltou", dias: 180 } : undefined}
        />
        <Indicador
          testID="retencao-real-intervalo"
          numero={intervaloMedio == null ? "—" : `${Math.round(intervaloMedio)} dias`}
          label="Intervalo médio entre compras"
          frase={
            intervaloMedio == null
              ? "Ainda não há clientes com 2 ou mais compras para medir um intervalo."
              : `Em média, quem repete compra volta a cada ${Math.round(intervaloMedio)} dias.`
          }
        />
        <Indicador
          testID="retencao-real-voltaram-mes"
          numero={String(voltaramMes)}
          label="Voltaram a comprar este mês"
          frase={
            voltaramMes === 0
              ? "Nenhum cliente que já tinha comprado antes voltou este mês, até agora."
              : `${voltaramMes} ${voltaramMes === 1 ? "cliente que já comprava" : "clientes que já compravam"} voltou${voltaramMes === 1 ? "" : "ram"} este mês.`
          }
        />
      </View>

      {/* ---- Novos x retornando ---- */}
      <NovosXRetornando meses={meses} />

      {/* ---- Distribuição pela régua ---- */}
      <Distribuicao faixas={faixas} />
    </View>
  );
}

// ── Bloco de indicador ───────────────────────────────────────
function Indicador({
  testID, numero, label, frase, botao,
}: {
  testID: string;
  numero: string;
  label: string;
  frase: string;
  botao?: { label: string; dias: number };
}) {
  return (
    <View style={s.indCard} testID={testID}>
      <Text style={s.indNumero} testID={`${testID}-valor`}>{numero}</Text>
      <Text style={s.indLabel}>{label}</Text>
      <Text style={s.indFrase}>{frase}</Text>
      {botao && (
        <Pressable
          onPress={() => irParaReativacao(botao.dias)}
          style={s.indBtn}
          testID={`${testID}-btn`}
          accessibilityRole="button"
        >
          <Text style={s.indBtnTxt}>{botao.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Novos x retornando (barras empilhadas, 6 meses) ──────────
function NovosXRetornando({ meses }: { meses: ReturnType<typeof novosXRetornandoPorMes> }) {
  const totalNovos = meses.reduce((s, m) => s + m.novos, 0);
  const totalRetornando = meses.reduce((s, m) => s + m.retornando, 0);
  const maior = Math.max(1, ...meses.map((m) => m.novos + m.retornando));

  return (
    <View style={s.card} testID="retencao-real-grafico">
      <Text style={s.title}>Novos × retornando</Text>
      <Text style={s.desc}>
        Nos últimos {meses.length} meses, a loja trouxe {totalNovos} {totalNovos === 1 ? "cliente novo" : "clientes novos"} e
        {" "}recuperou {totalRetornando} que já {totalRetornando === 1 ? "era" : "eram"} da casa.
      </Text>

      <View style={s.barrasRow}>
        {meses.map((m, i) => {
          const altNovos = (m.novos / maior) * 100;
          const altRet = (m.retornando / maior) * 100;
          return (
            <View key={`${m.ano}-${m.mes}`} style={s.barraCol} testID={`retencao-real-mes-${i}`}>
              <View style={s.barraTrack}>
                <View style={[s.barraSeg, { height: `${altRet}%`, backgroundColor: Colors.green }]} />
                <View style={[s.barraSeg, { height: `${altNovos}%`, backgroundColor: Colors.violet3 }]} />
              </View>
              <Text style={s.barraLabel}>{m.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={s.legenda}>
        <View style={s.legendaItem}>
          <View style={[s.legendaDot, { backgroundColor: Colors.violet3 }]} />
          <Text style={s.legendaTxt}>Novos</Text>
        </View>
        <View style={s.legendaItem}>
          <View style={[s.legendaDot, { backgroundColor: Colors.green }]} />
          <Text style={s.legendaTxt}>Retornando</Text>
        </View>
      </View>
    </View>
  );
}

// ── Distribuição pela régua de dias sem comprar ──────────────
function Distribuicao({ faixas }: { faixas: FaixaDistribuicao[] }) {
  return (
    <View style={s.card} testID="retencao-real-distribuicao">
      <Text style={s.title}>Quem sumiu, e há quanto tempo</Text>
      <Text style={s.desc}>Mesma régua da lista de clientes e da reativação — "inativo" aqui é o mesmo "inativo" lá.</Text>

      <View style={s.faixasList}>
        {faixas.map((f) => {
          const dias = DIAS_DA_FAIXA[f.key];
          return (
            <View key={f.key} style={s.faixaRow} testID={`retencao-real-faixa-${f.key}`}>
              <View style={[s.faixaDot, { backgroundColor: COR_FAIXA[f.key] }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.faixaLabel}>{f.label}</Text>
                <Text style={s.faixaDesc}>{f.desc}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.faixaCount} testID={`retencao-real-faixa-${f.key}-count`}>{f.count}</Text>
                <Text style={s.faixaTotal}>{fmt(f.total)}</Text>
              </View>
              {dias != null && f.count > 0 && (
                <Pressable
                  onPress={() => irParaReativacao(dias)}
                  style={s.faixaBtn}
                  testID={`retencao-real-faixa-${f.key}-btn`}
                  accessibilityRole="button"
                >
                  <Icon name="whatsapp" size={13} color={Colors.violet3} />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg3, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
  },
  title: { fontSize: 15, color: Colors.ink, fontWeight: "700", marginBottom: 6 },
  desc: { fontSize: 12, color: Colors.ink3, lineHeight: 18, marginBottom: 14 },
  loadingTxt: { fontSize: 12, color: Colors.ink3, marginTop: 10, textAlign: "center" },
  retryBtn: {
    marginTop: 12, alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  retryTxt: { fontSize: 12.5, color: Colors.violet3, fontWeight: "600" },
  lojasNota: { fontSize: 11.5, color: Colors.violet3, fontWeight: "600", marginBottom: 12 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  indCard: {
    flexGrow: 1, flexBasis: 220, minWidth: 220,
    backgroundColor: Colors.bg3, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  indNumero: { fontSize: 24, fontWeight: "800", color: Colors.ink, marginBottom: 2 },
  indLabel: { fontSize: 11.5, color: Colors.ink3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  indFrase: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  indBtn: { marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: Colors.violetD },
  indBtnTxt: { fontSize: 11.5, color: Colors.violet3, fontWeight: "700" },

  barrasRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 110, marginBottom: 10 },
  barraCol: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  barraTrack: { width: "100%", maxWidth: 28, flex: 1, justifyContent: "flex-end" },
  barraSeg: { width: "100%", borderRadius: 3 },
  barraLabel: { fontSize: 9.5, color: Colors.ink3, marginTop: 6 },
  legenda: { flexDirection: "row", gap: 16, justifyContent: "center" },
  legendaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendaDot: { width: 8, height: 8, borderRadius: 4 },
  legendaTxt: { fontSize: 11, color: Colors.ink3, fontWeight: "600" },

  faixasList: { gap: 10 },
  faixaRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.bg4, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  faixaDot: { width: 10, height: 10, borderRadius: 5 },
  faixaLabel: { fontSize: 13, color: Colors.ink, fontWeight: "700" },
  faixaDesc: { fontSize: 10.5, color: Colors.ink3, marginTop: 1 },
  faixaCount: { fontSize: 15, color: Colors.ink, fontWeight: "800" },
  faixaTotal: { fontSize: 10.5, color: Colors.ink3, marginTop: 1 },
  faixaBtn: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: Colors.violetD,
    alignItems: "center", justifyContent: "center", marginLeft: 4,
  },
});

export default RetentionTab;
