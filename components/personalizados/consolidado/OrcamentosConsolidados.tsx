// ============================================================
// AURA. — Personalizados › Orçamentos 3D de todas as lojas (p-187)
//
// O consolidado multi-CNPJ ("Todas as empresas") dos Orçamentos 3D. Lê
// GET /me/studio/quotes (Aura-backend#1052) e mostra, SÓ PARA LER:
//   - o seletor de lojas (do `breakdown`), só com as lojas que têm a frente;
//   - as linhas com o nome da loja;
//   - o filtro de situação e a paginação;
//   - em cada linha, "Abrir na loja": troca para a empresa e abre o
//     orçamento lá (?orcamento=<id>, o mesmo modal da tela da loja). Criar,
//     editar, enviar e aprovar só lá (mutação só por CNPJ). Por isso aqui
//     não existe "Novo orçamento".
//
// Quem chega aqui já passou pela trava PERSONALIZADOS_LIBERADO (a rota só
// monta esta tela com ela ligada). Plano e permissão: sem
// personalizados.orcamentos visível, ou sem nenhuma loja com a frente, a
// tela não existe (volta ao Painel), como na tela da loja.
// ============================================================
import { useEffect, useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { ScreenHero } from "@/components/ScreenHero";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { useLojasComPersonalizados } from "@/hooks/useLojasComPersonalizados";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import type { StudioQuoteStatus } from "@/services/studioApi";
import { meAggregatesApi, type StudioQuoteConsolidado } from "@/services/meAggregates";
import { StatusPill } from "@/components/studio/orcamentoModal/ListaDeOrcamentos";
import { reais } from "@/components/studio/pagamentoDoPedido";
import {
  DIAS_DOS_ORCAMENTOS, FILTROS_DE_SITUACAO, rotaDoOrcamentoNaLoja,
} from "@/components/personalizados/regrasDoConsolidado";
import {
  AvisoSoLeitura, BotaoAbrirNaLoja, ChipsDeFiltro, Paginacao, SeletorDeLojasView, SeloDaLoja,
  useAbrirNaLoja, useListaConsolidada,
} from "@/components/personalizados/consolidado/PartesDoConsolidado";

const MOD_DA_TELA = "personalizados.orcamentos";

const data = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

export function OrcamentosConsolidados() {
  const t = useStudioTokens();
  const s = useMemo(() => estilos(t), [t]);
  const refreshMe = useAuthStore((st) => st.refreshMe);
  const visiveis = useVisibleModules();
  const modsProntos = useVisibleModulesProntos();
  const { ligadas, prontas } = useLojasComPersonalizados();
  const { abrir, abrindo } = useAbrirNaLoja();

  // Armadilha 1: plano e module_overrides do JWT não se revalidam sozinhos.
  useEffect(() => {
    if (typeof refreshMe === "function") refreshMe().catch(() => {});
  }, [refreshMe]);

  const decidido = modsProntos && prontas;
  const existe = decidido && visiveis.has(MOD_DA_TELA) && ligadas.size > 0;

  const lista = useListaConsolidada<StudioQuoteStatus, Awaited<ReturnType<typeof meAggregatesApi.studioQuotes>>>({
    ativo: existe,
    ligadas,
    buscar: (p) => meAggregatesApi.studioQuotes({ ...p, days: DIAS_DOS_ORCAMENTOS }),
  });

  if (!decidido) {
    return (
      <View style={s.espera} testID="personalizados-orcamentos-esperando">
        <Text style={s.esperaTxt}>Carregando…</Text>
      </View>
    );
  }
  if (!existe || (lista.respondeu && lista.seletor.lojas.length === 0)) {
    return <Redirect href="/" />;
  }

  const r = lista.resposta;
  const orcamentos = (r?.quotes || []).filter((q) => ligadas.has(String(q.company_id)));

  let corpo: React.ReactNode;
  if (!r && lista.erro) {
    corpo = (
      <View style={s.vazio} testID="orcamentos-consolidados-erro">
        <Text style={s.vazioTitulo}>Não deu para carregar os orçamentos</Text>
        <Text style={s.vazioTxt}>{lista.erro}</Text>
        <Pressable style={s.botao} onPress={lista.tentarDeNovo} accessibilityRole="button" testID="orcamentos-consolidados-tentar-de-novo">
          <Text style={s.botaoTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  } else if (!r) {
    corpo = <View style={s.vazio} testID="orcamentos-consolidados-carregando"><Text style={s.vazioTxt}>Carregando os orçamentos…</Text></View>;
  } else if (orcamentos.length === 0) {
    corpo = (
      <View style={s.vazio} testID="orcamentos-consolidados-vazio">
        <Text style={s.vazioTitulo}>Nenhum orçamento</Text>
        <Text style={s.vazioTxt}>Nenhum orçamento nos últimos {DIAS_DOS_ORCAMENTOS} dias com este filtro.</Text>
      </View>
    );
  } else {
    corpo = (
      <View style={s.lista} testID="orcamentos-consolidados-lista">
        {orcamentos.map((q) => (
          <Linha
            key={`${q.company_id}:${q.id}`}
            q={q}
            s={s}
            abrindo={abrindo === q.id}
            onAbrir={() => abrir(String(q.company_id), rotaDoOrcamentoNaLoja(q.id), q.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={s.tela} testID="personalizados-orcamentos-consolidados">
      <ScreenHero eyebrow="Personalizados" title="Orçamentos 3D" subtitle="Todas as lojas" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.dentro}>
        <AvisoSoLeitura texto="Aqui você vê os orçamentos de todas as lojas, só para ler. Para criar, enviar ou aprovar, abra o orçamento na loja." />
        <SeletorDeLojasView seletor={lista.seletor} escolhida={lista.filtro} onEscolher={lista.escolherLoja} />
        <ChipsDeFiltro opcoes={FILTROS_DE_SITUACAO} escolhida={lista.status} onEscolher={lista.escolherStatus} prefixo="orcamentos-consolidados" />
        {corpo}
        {r ? (
          <Paginacao
            offset={lista.offset}
            naPagina={(r.quotes || []).length}
            total={r.total}
            carregando={lista.carregando}
            onAnterior={lista.anterior}
            onProxima={lista.proxima}
            prefixo="orcamentos-consolidados"
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Linha({
  q, s, abrindo, onAbrir,
}: {
  q: StudioQuoteConsolidado;
  s: ReturnType<typeof estilos>;
  abrindo: boolean;
  onAbrir: () => void;
}) {
  const nome = q.customer_name || "Sem cliente";
  return (
    <View style={s.linha} testID={`orcamentos-consolidados-linha-${q.id}`}>
      <View style={s.linhaInfo}>
        <View style={s.linhaTopo}>
          <Text style={s.nome} numberOfLines={1}>{nome}</Text>
          <StatusPill status={q.status} />
        </View>
        <View style={s.linhaTopo}>
          <SeloDaLoja nome={q.company_name} />
          {q.tem_video ? <Text style={s.meta}>com vídeo</Text> : null}
        </View>
        <Text style={s.meta}>
          {reais(q.total)} · criado em {data(q.created_at)}
          {q.expires_at ? ` · vale até ${data(q.expires_at)}` : ""}
        </Text>
      </View>
      <View style={s.linhaAcao}>
        <BotaoAbrirNaLoja
          nomeDaLoja={q.company_name}
          abrindo={abrindo}
          onPress={onAbrir}
          testID={`orcamentos-consolidados-abrir-${q.id}`}
        />
      </View>
    </View>
  );
}

function estilos(t: StudioPalette) {
  return StyleSheet.create({
    tela: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    dentro: { paddingBottom: 24 },
    espera: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 320 },
    esperaTxt: { color: t.ink3, fontSize: 13 },

    vazio: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 24, gap: 10, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: t.primaryBorder, backgroundColor: t.bgSoft },
    vazioTitulo: { fontSize: 17, fontWeight: "700", color: t.ink, textAlign: "center" },
    vazioTxt: { fontSize: 13, color: t.ink3, textAlign: "center", maxWidth: 420, lineHeight: 20 },

    lista: { gap: 8 },
    linha: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, backgroundColor: t.paperCard, borderRadius: 11, borderWidth: 1, borderColor: t.ink5, padding: 12 },
    linhaInfo: { flexGrow: 1, flexBasis: 220, gap: 5 },
    linhaTopo: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    linhaAcao: { flexGrow: 0, minWidth: 140 },
    nome: { fontSize: 13.5, fontWeight: "700", color: t.ink, flexShrink: 1 },
    meta: { fontSize: 12, color: t.ink3 },

    botao: { alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: t.primaryBorder, backgroundColor: t.paperCard },
    botaoTxt: { fontSize: 12, fontWeight: "600", color: t.ink2 },
  });
}

export default OrcamentosConsolidados;
