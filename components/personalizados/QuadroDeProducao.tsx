// ============================================================
// AURA. — Personalizados: quadro de Produção no shell Negócio (p-129)
//
// Porte do quadro do Studio (app/studio/(estudio)/producao.tsx) para dentro
// do Negócio. Mesmos dados e mesmas rotas; o que muda é a casca:
//
//   - AÇÕES SEMPRE VISÍVEIS. Nada aparece só no hover (regra 7 do
//     CLAUDE.md): cada cartão mostra os botões o tempo todo, no mouse e no
//     toque.
//   - SEM ARRASTAR. O cartão anda pelo botão da próxima etapa. O arraste do
//     Studio é só do mouse e já deu defeito no react-native-web.
//   - NO CELULAR, UMA ETAPA POR VEZ. Abaixo de 768 px o quadro vira um
//     seletor de etapas com a contagem e a lista da etapa escolhida.
//   - OVERLAY POR WebPortal. O pedido de aprovação da arte abre por
//     WebPortal: dentro do shell o z-index:0 do react-native-web prende
//     qualquer position:fixed.
//   - CORES DO NEGÓCIO. A tela lê useStudioTokens(), e quem monta a rota
//     envolve o quadro em <TemaDoNegocio>.
//
// O que ainda NÃO está aqui (fica para os próximos cards): abrir o pedido
// (detalhe), coletar a personalização de pedido de marketplace e o modo
// vitrine. Por isso o cartão não é clicável.
//
// Regras sem tela: components/personalizados/regrasDaProducao.ts.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Image, useWindowDimensions } from "react-native";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { WebPortal } from "@/components/WebPortal";
import { confirmAlert } from "@/utils/webAlert";
import { useStudioTokens, useStudioSemantic, useStudioTheme } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { studioApi, type StudioOrder, type StudioProductionStatus } from "@/services/studioApi";
import { ApprovalRequestModal } from "@/components/studio/ApprovalRequestModal";
import { RegistrarPagamentoSheet } from "@/components/studio/RegistrarPagamentoSheet";
import { useCobrarSaldo } from "@/components/studio/useCobrarSaldo";
import { useRegistrarPagamento } from "@/components/studio/useRegistrarPagamento";
import { PersonalizationPreview } from "@/components/studio/PersonalizationPreview";
import { capaDoCartao } from "@/components/studio/capaDoCartao";
import { comEtapaDoPedido } from "@/components/studio/etapaDoPedido";
import { riscoDoCard } from "@/components/studio/fluxoDoQuadro";
import { numeroDoPedido, situacaoDoPixNoCartao, reais } from "@/components/studio/pagamentoDoPedido";
import { rotuloDeItens } from "@/components/studio/rotuloDeItens";
import {
  ETAPAS, PROXIMA_ETAPA, LARGURA_DO_CELULAR, agruparPorEtapa, emAberto, etapaDe, etapaInicialNoCelular,
  etapasVisiveis, prazoDoCartao, semAntigosDaAtivacao, type Etapa,
} from "@/components/personalizados/regrasDaProducao";

type Props = {
  companyId: string;
  /** pdv_settings.personalizados_ativado_em (ISO) ou null. Ver regrasDaProducao.ts. */
  ativadoEm: string | null;
};

function diaEMes(iso?: string | null) {
  if (!iso) return "";
  const [, m, d] = String(iso).slice(0, 10).split("-");
  return d && m ? `${d}/${m}` : String(iso);
}

export function QuadroDeProducao({ companyId, ativadoEm }: Props) {
  const t = useStudioTokens();
  const sem = useStudioSemantic();
  const { isDark } = useStudioTheme();
  const s = useMemo(() => estilos(t), [t]);
  const { width } = useWindowDimensions();
  const celular = width < LARGURA_DO_CELULAR;

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<StudioOrder[]>([]);
  const [aprovacaoDe, setAprovacaoDe] = useState<StudioOrder | null>(null);
  const [etapaNoCelular, setEtapaNoCelular] = useState<StudioProductionStatus | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await studioApi.listOrders(companyId, { days: 60, limit: 300 });
      setPedidos((r.orders || []).map(comEtapaDoPedido));
      setErro(null);
    } catch (e: any) {
      setErro(e?.message || "Não deu para carregar os pedidos.");
    } finally {
      setCarregando(false);
    }
  }, [companyId]);

  useEffect(() => { carregar(); }, [carregar]);

  const noQuadro = useMemo(() => semAntigosDaAtivacao(pedidos, ativadoEm), [pedidos, ativadoEm]);
  const grupos = useMemo(() => agruparPorEtapa(noQuadro), [noQuadro]);
  const etapas = useMemo(() => etapasVisiveis(grupos), [grupos]);
  const etapaAberta = etapaNoCelular && etapas.some((e) => e.key === etapaNoCelular)
    ? etapaNoCelular
    : etapaInicialNoCelular(grupos);

  const mover = useCallback(async (pedido: StudioOrder, destino: StudioProductionStatus, forcar?: boolean) => {
    const atual = etapaDe(pedido);
    setPedidos((antes) => antes.map((o) => (o.id === pedido.id ? { ...o, studio_production_status: destino } : o)));
    try {
      await studioApi.updateProductionStatus(companyId, pedido.id, destino, forcar);
      const etapa = ETAPAS.find((e) => e.key === destino);
      toast.success(`Movido para ${etapa ? etapa.label : "a próxima etapa"}`);
    } catch (e: any) {
      setPedidos((antes) => antes.map((o) => (o.id === pedido.id ? { ...o, studio_production_status: atual } : o)));
      const semSinal = (e?.status === 409 || e?.code === 409)
        && (e?.data?.error === "deposit_required" || e?.error === "deposit_required");
      if (semSinal) {
        confirmAlert(
          "Sinal não recebido",
          e?.data?.message || "O sinal deste pedido ainda não foi confirmado. Quer iniciar a produção mesmo assim?",
          "Iniciar mesmo assim",
          () => mover(pedido, destino, true),
          { destructive: true },
        );
        return;
      }
      toast.error(e?.message || "Não deu para mover o pedido. Tente de novo.");
      carregar();
    }
  }, [companyId, carregar]);

  const avancar = useCallback((pedido: StudioOrder) => {
    const proxima = PROXIMA_ETAPA[etapaDe(pedido)];
    if (proxima) mover(pedido, proxima);
  }, [mover]);

  const { cobrar, cobrandoId } = useCobrarSaldo(companyId);
  const baixa = useRegistrarPagamento(companyId, { onSucesso: carregar });

  const cartao = (o: StudioOrder, etapa: Etapa) => (
    <Cartao
      key={o.id}
      o={o}
      etapa={etapa}
      t={t}
      s={s}
      corDaEtapa={sem[etapa.intent].base}
      // No tema escuro a cor da etapa é clara: texto escuro por cima.
      corSobreAEtapa={isDark ? "#0b0f1a" : "#ffffff"}
      onAvancar={avancar}
      onAprovacao={setAprovacaoDe}
      cobrando={cobrandoId === o.balance_installment_id}
      onCobrar={() => o.balance_installment_id && cobrar({
        orderId: o.id, installmentId: o.balance_installment_id, phone: o.customer_phone,
        customerName: o.customer_name, dueDate: o.balance_due_date, status: o.balance_status,
      })}
      onRecebi={() => o.balance_installment_id && o.balance_amount != null && baixa.abrir({
        orderId: o.id, installmentId: o.balance_installment_id, customerName: o.customer_name,
        amount: Number(o.balance_amount) || 0, dueDate: o.balance_due_date, status: o.balance_status,
      })}
    />
  );

  let corpo: React.ReactNode;
  if (carregando && pedidos.length === 0) {
    corpo = <View style={s.aviso} testID="producao-carregando"><Text style={s.avisoTxt}>Carregando os pedidos…</Text></View>;
  } else if (erro && pedidos.length === 0) {
    corpo = (
      <View style={s.aviso} testID="producao-erro">
        <Text style={s.avisoTitulo}>Não deu para carregar a produção</Text>
        <Text style={s.avisoTxt}>{erro}</Text>
        <Pressable style={s.botaoNeutro} onPress={carregar} accessibilityRole="button" testID="producao-tentar-de-novo">
          <Text style={s.botaoNeutroTxt}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  } else if (noQuadro.length === 0) {
    corpo = (
      <View style={s.aviso} testID="producao-vazia">
        <Text style={s.avisoTitulo}>Nenhum pedido na produção</Text>
        <Text style={s.avisoTxt}>Quando entrar um pedido de produto personalizado, ele aparece aqui.</Text>
      </View>
    );
  } else if (celular) {
    const etapa = etapas.find((e) => e.key === etapaAberta) || etapas[0];
    const lista = grupos[etapa.key];
    corpo = (
      <View style={{ flex: 1 }} testID="producao-uma-etapa">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.seletor} contentContainerStyle={s.seletorDentro}>
          {etapas.map((e) => {
            const ativa = e.key === etapa.key;
            const cor = sem[e.intent];
            return (
              <Pressable
                key={e.key}
                testID={`producao-etapa-${e.key}`}
                onPress={() => setEtapaNoCelular(e.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
                accessibilityLabel={`${e.label}, ${grupos[e.key].length} ${grupos[e.key].length === 1 ? "pedido" : "pedidos"}`}
                style={[s.chip, ativa && { backgroundColor: cor.soft, borderColor: cor.base }]}
              >
                <Text style={[s.chipTxt, ativa && { color: cor.ink }]}>{e.curto}</Text>
                <Text style={[s.chipConta, ativa && { color: cor.ink }]}>{grupos[e.key].length}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.listaDoCelular}>
          <Text style={s.tituloDaEtapa} testID="producao-etapa-aberta">{etapa.label}</Text>
          {lista.length === 0
            ? <Text style={s.etapaVazia}>Nenhum pedido nesta etapa.</Text>
            : lista.map((o) => cartao(o, etapa))}
        </ScrollView>
      </View>
    );
  } else {
    corpo = (
      <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={s.quadro} testID="producao-colunas">
        {etapas.map((e) => {
          const cor = sem[e.intent];
          return (
            <View key={e.key} style={s.coluna} testID={`producao-coluna-${e.key}`}>
              <View style={[s.colunaTopo, { backgroundColor: cor.soft }]}>
                <Icon name={e.icon as any} size={13} color={cor.base} />
                <Text style={[s.colunaTitulo, { color: cor.ink }]}>{e.label}</Text>
                <Text style={[s.colunaConta, { color: cor.ink }]}>{grupos[e.key].length}</Text>
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={s.colunaDentro}>
                {grupos[e.key].length === 0
                  ? <Text style={s.etapaVazia}>Nenhum pedido.</Text>
                  : grupos[e.key].map((o) => cartao(o, e))}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={s.tela} testID="producao-quadro">
      <View style={s.barra}>
        <Text style={s.resumo} testID="producao-resumo">
          {noQuadro.length === 0
            ? "Sem pedidos em aberto"
            : `${emAberto(grupos)} em aberto · ${grupos.delivered.length} ${grupos.delivered.length === 1 ? "entregue" : "entregues"} nos últimos 60 dias`}
        </Text>
        <Pressable style={s.botaoNeutro} onPress={carregar} disabled={carregando} accessibilityRole="button" testID="producao-atualizar">
          <Icon name="refresh-cw" size={13} color={t.ink2} />
          <Text style={s.botaoNeutroTxt}>{carregando ? "Atualizando…" : "Atualizar"}</Text>
        </Pressable>
      </View>

      {corpo}

      {/* Pedido de aprovação da arte: por WebPortal, fora da árvore do shell. */}
      <WebPortal active={!!aprovacaoDe}>
        <View style={s.overlay} testID="producao-overlay-aprovacao">
          {aprovacaoDe ? (
            <ApprovalRequestModal
              order={aprovacaoDe}
              onClose={() => setAprovacaoDe(null)}
              onSent={() => { setAprovacaoDe(null); carregar(); }}
            />
          ) : null}
        </View>
      </WebPortal>

      {/* Baixa do saldo: o sheet abre pelo Modal do react-native-web, que já
          monta em document.body. */}
      <RegistrarPagamentoSheet controller={baixa} />
    </View>
  );
}

function Cartao({
  o, etapa, t, s, corDaEtapa, corSobreAEtapa, onAvancar, onAprovacao, onCobrar, onRecebi, cobrando,
}: {
  o: StudioOrder;
  etapa: Etapa;
  t: StudioPalette;
  s: ReturnType<typeof estilos>;
  corDaEtapa: string;
  corSobreAEtapa: string;
  onAvancar: (o: StudioOrder) => void;
  onAprovacao: (o: StudioOrder) => void;
  onCobrar: () => void;
  onRecebi: () => void;
  cobrando: boolean;
}) {
  const [imgFalhou, setImgFalhou] = useState(false);
  const [alturaPrevia, setAlturaPrevia] = useState(0);
  const capaBase = capaDoCartao(o);
  const capa = imgFalhou && (capaBase.tipo === "arte" || capaBase.tipo === "foto")
    ? ({ tipo: "monograma" } as const)
    : capaBase;
  const nome = o.customer_name || o.display_name || "Sem cadastro";
  const inicial = nome.trim().charAt(0).toUpperCase() || "?";
  const prazo = prazoDoCartao(o as any);
  const risco = riscoDoCard(o as any);
  const pix = situacaoDoPixNoCartao(o as any);
  const temSaldo = !!o.balance_installment_id && o.balance_amount != null;
  const vencido = o.balance_status === "overdue";

  return (
    <View style={s.cartao} testID={`producao-cartao-${o.id}`}>
      {capa.tipo === "arte" || capa.tipo === "foto" ? (
        <Image source={{ uri: capa.url }} style={s.capa} resizeMode="cover" onError={() => setImgFalhou(true)} accessibilityLabel={`Arte de ${nome}`} />
      ) : capa.tipo === "previa" ? (
        <View
          style={[s.capa, s.capaCentro]}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h > 0 && h !== alturaPrevia) setAlturaPrevia(h);
          }}
          accessibilityLabel={`Prévia da personalização de ${nome}`}
        >
          {alturaPrevia > 0 ? (
            <PersonalizationPreview config={capa.config} values={capa.values} side={capa.side} size={alturaPrevia} showLabel={false} />
          ) : null}
        </View>
      ) : (
        <View style={[s.capa, s.capaCentro]}><Text style={s.capaInicial}>{inicial}</Text></View>
      )}

      <View style={s.linha}>
        <Text style={s.numero}>{numeroDoPedido(o as any)}</Text>
        <View style={[s.selo, prazo.tom === "atencao" && { backgroundColor: t.warningSoft }, prazo.tom === "atrasado" && { backgroundColor: t.dangerSoft }]}>
          <Text style={[s.seloTxt, prazo.tom === "atencao" && { color: t.warningInk }, prazo.tom === "atrasado" && { color: t.dangerInk }]}>{prazo.texto}</Text>
        </View>
      </View>
      <Text style={s.nome} numberOfLines={1}>{nome}</Text>
      <Text style={s.meta}>{rotuloDeItens(o.item_count)} · {reais(o.total_amount)}</Text>

      {pix ? (
        <View style={[s.selo, s.seloSolto, { backgroundColor: pix.tom === "sucesso" ? t.successSoft : t.warningSoft }]}>
          <Text style={[s.seloTxt, { color: pix.tom === "sucesso" ? t.successInk : t.warningInk }]}>{pix.rotulo}</Text>
        </View>
      ) : null}
      {o.pending_approval_url ? (
        <View style={[s.selo, s.seloSolto, { backgroundColor: t.infoSoft }]}>
          <Text style={[s.seloTxt, { color: t.infoInk }]}>Aprovação enviada</Text>
        </View>
      ) : null}
      {temSaldo ? (
        <View style={[s.selo, s.seloSolto, { backgroundColor: vencido ? t.dangerSoft : t.warningSoft }]}>
          <Text style={[s.seloTxt, { color: vencido ? t.dangerInk : t.warningInk }]}>
            Saldo {reais(o.balance_amount)} · {vencido ? "venceu" : "vence"} {diaEMes(o.balance_due_date)}
          </Text>
        </View>
      ) : null}
      {risco === "apertado" ? (
        <Text style={[s.meta, { color: t.warningInk }]}>Entrega chegando e ainda não foi para a produção</Text>
      ) : null}

      {/* Ações: sempre na tela, sem hover. */}
      <View style={s.acoes} testID={`producao-acoes-${o.id}`}>
        {temSaldo ? (
          <View style={s.acoesLado}>
            <Pressable
              style={[s.botaoNeutro, s.cresce]}
              onPress={onCobrar}
              disabled={cobrando}
              accessibilityRole="button"
              accessibilityLabel={`Cobrar o saldo de ${nome} pelo WhatsApp`}
              testID={`producao-cobrar-${o.id}`}
            >
              <Text style={s.botaoNeutroTxt}>{cobrando ? "Abrindo…" : "Cobrar saldo"}</Text>
            </Pressable>
            <Pressable
              style={[s.botaoNeutro, s.cresce, { borderColor: t.success }]}
              onPress={onRecebi}
              accessibilityRole="button"
              accessibilityLabel={`Registrar o recebimento de ${nome}`}
              testID={`producao-recebi-${o.id}`}
            >
              <Text style={[s.botaoNeutroTxt, { color: t.successInk }]}>Recebi</Text>
            </Pressable>
          </View>
        ) : null}
        {etapa.key === "pending_art" ? (
          <Pressable
            style={s.botaoNeutro}
            onPress={() => onAprovacao(o)}
            accessibilityRole="button"
            accessibilityLabel={`Pedir a aprovação da arte de ${nome} pelo WhatsApp`}
            testID={`producao-aprovacao-${o.id}`}
          >
            <Icon name="whatsapp" size={13} color={t.ink2} />
            <Text style={s.botaoNeutroTxt}>Pedir aprovação da arte</Text>
          </Pressable>
        ) : null}
        {etapa.avancar ? (
          <Pressable
            style={[s.botaoCheio, { backgroundColor: corDaEtapa }]}
            onPress={() => onAvancar(o)}
            accessibilityRole="button"
            accessibilityLabel={`${etapa.avancar}: pedido de ${nome}`}
            testID={`producao-avancar-${o.id}`}
          >
            <Text style={[s.botaoCheioTxt, { color: corSobreAEtapa }]}>{etapa.avancar}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function estilos(t: StudioPalette) {
  return StyleSheet.create({
    tela: { flex: 1, minHeight: 420 },
    barra: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 12, flexWrap: "wrap" },
    resumo: { fontSize: 13, color: t.ink3, flexShrink: 1 },

    aviso: { alignItems: "center", justifyContent: "center", paddingVertical: 56, paddingHorizontal: 24, gap: 10 },
    avisoTitulo: { fontSize: 16, fontWeight: "700", color: t.ink, textAlign: "center" },
    avisoTxt: { fontSize: 13, color: t.ink3, textAlign: "center", maxWidth: 380, lineHeight: 19 },

    quadro: { gap: 12, paddingBottom: 16 },
    coluna: { width: 288, backgroundColor: t.bgSoft, borderRadius: 14, borderWidth: 1, borderColor: t.ink5, overflow: "hidden", maxHeight: 760 },
    colunaTopo: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
    colunaTitulo: { flex: 1, fontSize: 13, fontWeight: "700" },
    colunaConta: { fontSize: 13, fontWeight: "700" },
    colunaDentro: { padding: 10, gap: 10 },
    etapaVazia: { fontSize: 12.5, color: t.ink3, paddingVertical: 14, textAlign: "center" },

    seletor: { flexGrow: 0, marginBottom: 12 },
    seletorDentro: { gap: 8, paddingRight: 8 },
    // 44 px de altura: alvo de toque confortável no celular.
    chip: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCard },
    chipTxt: { fontSize: 13, fontWeight: "600", color: t.ink2 },
    chipConta: { fontSize: 13, fontWeight: "700", color: t.ink3 },
    listaDoCelular: { gap: 12, paddingBottom: 24 },
    tituloDaEtapa: { fontSize: 15, fontWeight: "700", color: t.ink },

    cartao: { backgroundColor: t.paperCard, borderRadius: 12, borderWidth: 1, borderColor: t.ink5, padding: 12, gap: 6 },
    capa: { width: "100%", height: 120, borderRadius: 8, backgroundColor: t.bgSoft, marginBottom: 4 },
    capaCentro: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
    capaInicial: { fontSize: 34, fontWeight: "700", color: t.ink4 },
    linha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    numero: { fontSize: 12, fontWeight: "700", color: t.ink3 },
    nome: { fontSize: 14.5, fontWeight: "700", color: t.ink },
    meta: { fontSize: 12.5, color: t.ink3 },
    selo: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: t.bgSoft },
    seloSolto: { alignSelf: "flex-start" },
    seloTxt: { fontSize: 11.5, fontWeight: "600", color: t.ink3 },

    acoes: { gap: 8, marginTop: 6 },
    acoesLado: { flexDirection: "row", gap: 8 },
    cresce: { flex: 1 },
    botaoNeutro: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: t.ink5, backgroundColor: t.paperCardElev },
    botaoNeutroTxt: { fontSize: 12.5, fontWeight: "600", color: t.ink2 },
    botaoCheio: { alignItems: "center", justifyContent: "center", minHeight: 42, paddingHorizontal: 12, borderRadius: 10 },
    botaoCheioTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },

    // O contêiner do WebPortal é um <div> fixo, sem flex: o overlay se
    // estica por conta própria.
    overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.bg },
  });
}

export default QuadroDeProducao;
