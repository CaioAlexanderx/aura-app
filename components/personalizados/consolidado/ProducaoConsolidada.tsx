// ============================================================
// AURA. — Personalizados › Produção de todas as lojas (p-187)
//
// O consolidado multi-CNPJ ("Todas as empresas") da Fila de produção. Lê
// GET /me/studio/orders (Aura-backend#1052) e mostra, SÓ PARA LER:
//   - o seletor de lojas (do `breakdown`), só com as lojas que têm a frente;
//   - os cartões com o nome da loja;
//   - o filtro de etapa e a paginação;
//   - em cada cartão, "Abrir na loja": troca para a empresa e abre a Fila
//     dela com o pedido em destaque (?pedido=<id>). Mover de etapa, pedir
//     aprovação, cobrar e dar baixa só lá (mutação só por CNPJ).
//
// Quem chega aqui já passou pela trava PERSONALIZADOS_LIBERADO (a rota só
// monta esta tela com ela ligada). Plano e permissão: sem
// personalizados.producao visível, ou sem nenhuma loja com a frente, a tela
// não existe (volta ao Painel), como na tela da loja.
// ============================================================
import { useEffect, useMemo } from "react";
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { ScreenHero } from "@/components/ScreenHero";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { useLojasComPersonalizados } from "@/hooks/useLojasComPersonalizados";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import type { StudioProductionStatus } from "@/services/studioApi";
import { meAggregatesApi, type StudioOrderConsolidado } from "@/services/meAggregates";
import { comEtapaDoPedido } from "@/components/studio/etapaDoPedido";
import { numeroDoPedido, reais } from "@/components/studio/pagamentoDoPedido";
import { rotuloDeItens } from "@/components/studio/rotuloDeItens";
import { nomeDoCliente, origemDoPedido, prazoDoCartao, ehAtivo } from "@/components/personalizados/regrasDaProducao";
import {
  DIAS_DOS_PEDIDOS, FILTROS_DE_ETAPA, rotaDoPedidoNaLoja, rotuloDaEtapa,
} from "@/components/personalizados/regrasDoConsolidado";
import {
  AvisoSoLeitura, BotaoAbrirNaLoja, ChipsDeFiltro, Paginacao, SeletorDeLojasView, SeloDaLoja,
  useAbrirNaLoja, useListaConsolidada,
} from "@/components/personalizados/consolidado/PartesDoConsolidado";

const MOD_DA_TELA = "personalizados.producao";

export function ProducaoConsolidada() {
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

  const lista = useListaConsolidada<StudioProductionStatus, Awaited<ReturnType<typeof meAggregatesApi.studioOrders>>>({
    ativo: existe,
    ligadas,
    buscar: (p) => meAggregatesApi.studioOrders({ ...p, days: DIAS_DOS_PEDIDOS }),
  });

  if (!decidido) {
    return (
      <View style={s.espera} testID="personalizados-producao-esperando">
        <Text style={s.esperaTxt}>Carregando…</Text>
      </View>
    );
  }
  if (!existe || (lista.respondeu && lista.seletor.lojas.length === 0)) {
    return <Redirect href="/" />;
  }

  const r = lista.resposta;
  const pedidos = (r?.orders || []).filter((o) => ligadas.has(String(o.company_id))).map(comEtapaDoPedido);

  let corpo: React.ReactNode;
  if (!r && lista.erro) {
    corpo = (
      <View style={s.vazio} testID="producao-consolidada-erro">
        <Text style={s.vazioTitulo}>Não deu para carregar os pedidos</Text>
        <Text style={s.vazioTxt}>{lista.erro}</Text>
        <Pressable style={s.botao} onPress={lista.tentarDeNovo} accessibilityRole="button" testID="producao-consolidada-tentar-de-novo">
          <Text style={s.botaoTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  } else if (!r) {
    corpo = <View style={s.vazio} testID="producao-consolidada-carregando"><Text style={s.vazioTxt}>Carregando os pedidos…</Text></View>;
  } else if (pedidos.length === 0) {
    corpo = (
      <View style={s.vazio} testID="producao-consolidada-vazia">
        <Text style={s.vazioTitulo}>Nenhum pedido</Text>
        <Text style={s.vazioTxt}>Nenhum pedido nos últimos {DIAS_DOS_PEDIDOS} dias com este filtro.</Text>
      </View>
    );
  } else {
    corpo = (
      <View style={s.grade} testID="producao-consolidada-lista">
        {pedidos.map((o) => (
          <Cartao
            key={`${o.company_id}:${o.id}`}
            o={o}
            t={t}
            s={s}
            abrindo={abrindo === o.id}
            onAbrir={() => abrir(String(o.company_id), rotaDoPedidoNaLoja(o.id), o.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={s.tela} testID="personalizados-producao-consolidada">
      <ScreenHero eyebrow="Personalizados" title="Fila de produção" subtitle="Todas as lojas" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.dentro}>
        <AvisoSoLeitura texto="Aqui você vê os pedidos de todas as lojas, só para ler. Para mudar a etapa, cobrar ou dar baixa, abra o pedido na loja." />
        <SeletorDeLojasView seletor={lista.seletor} escolhida={lista.filtro} onEscolher={lista.escolherLoja} />
        <ChipsDeFiltro opcoes={FILTROS_DE_ETAPA} escolhida={lista.status} onEscolher={lista.escolherStatus} prefixo="producao-consolidada" />
        {r?.degraded ? (
          <Text style={s.nota} testID="producao-consolidada-degradada">Saldo, capa e prazo não vieram agora. Abra na loja para ver tudo.</Text>
        ) : null}
        {corpo}
        {r ? (
          <Paginacao
            offset={lista.offset}
            naPagina={(r.orders || []).length}
            total={r.total}
            carregando={lista.carregando}
            onAnterior={lista.anterior}
            onProxima={lista.proxima}
            prefixo="producao-consolidada"
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function Cartao({
  o, t, s, abrindo, onAbrir,
}: {
  o: StudioOrderConsolidado;
  t: StudioPalette;
  s: ReturnType<typeof estilos>;
  abrindo: boolean;
  onAbrir: () => void;
}) {
  const nome = nomeDoCliente(o);
  const origem = origemDoPedido(o);
  const ativo = ehAtivo(o);
  const prazo = ativo ? prazoDoCartao(o) : null;
  const temSaldo = o.balance_amount != null && Number(o.balance_amount) > 0;

  return (
    <View style={s.cartao} testID={`producao-consolidada-cartao-${o.id}`}>
      <View style={s.linha}>
        {o.card_image_url ? (
          <Image source={{ uri: o.card_image_url }} style={s.capa} accessibilityIgnoresInvertColors />
        ) : null}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={s.linha}>
            <Text style={s.numero}>{numeroDoPedido(o as any)}</Text>
            {origem ? <Text style={s.origem}>{origem}</Text> : null}
          </View>
          <SeloDaLoja nome={o.company_name} />
        </View>
      </View>
      <Text style={s.nome} numberOfLines={1}>{nome}</Text>
      <Text style={s.meta}>{rotuloDeItens(o.item_count)} · {reais(o.total_amount)}</Text>
      <View style={s.selos}>
        <View style={s.selo}><Text style={s.seloTxt}>{rotuloDaEtapa(o.studio_production_status)}</Text></View>
        {prazo ? (
          <View style={[s.selo, prazo.tom === "atencao" && { backgroundColor: t.warningSoft }, prazo.tom === "atrasado" && { backgroundColor: t.dangerSoft }]}>
            <Text style={[s.seloTxt, prazo.tom === "atencao" && { color: t.warningInk }, prazo.tom === "atrasado" && { color: t.dangerInk }]}>{prazo.texto}</Text>
          </View>
        ) : null}
      </View>
      {temSaldo ? (
        <Text style={s.meta} testID={`producao-consolidada-saldo-${o.id}`}>
          Saldo <Text style={s.saldo}>{reais(o.balance_amount)}</Text>
          {o.balance_status === "overdue" ? " · vencido" : ""}
        </Text>
      ) : null}
      <BotaoAbrirNaLoja
        nomeDaLoja={o.company_name}
        abrindo={abrindo}
        onPress={onAbrir}
        testID={`producao-consolidada-abrir-${o.id}`}
      />
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
    nota: { fontSize: 12, color: t.warningInk, marginBottom: 10 },

    grade: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    cartao: { flexGrow: 1, flexBasis: 240, maxWidth: 360, backgroundColor: t.paperCard, borderRadius: 11, borderWidth: 1, borderColor: t.ink5, padding: 10, gap: 6 },
    linha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    capa: { width: 44, height: 44, borderRadius: 8, backgroundColor: t.bgSoft },
    numero: { fontSize: 11.5, fontWeight: "700", color: t.accentInk, fontVariant: ["tabular-nums"] },
    origem: { fontSize: 10.5, fontWeight: "700", color: t.ink3 },
    nome: { fontSize: 13, fontWeight: "700", color: t.ink },
    meta: { fontSize: 12, color: t.ink3 },
    saldo: { fontWeight: "700", color: t.ink, fontVariant: ["tabular-nums"] },
    selos: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    selo: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: t.bgSoft },
    seloTxt: { fontSize: 10.5, fontWeight: "700", color: t.ink3 },

    botao: { alignItems: "center", justifyContent: "center", minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: t.primaryBorder, backgroundColor: t.paperCard },
    botaoTxt: { fontSize: 12, fontWeight: "600", color: t.ink2 },
  });
}

export default ProducaoConsolidada;
