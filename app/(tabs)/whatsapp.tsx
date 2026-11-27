// ============================================================
// WhatsApp (varejo) — Fase 6i
//
// Esta tela era 100% maquete: conversas, automações e campanhas saíam de
// MOCK_* em components/screens/whatsapp/types. O modo demonstração ainda
// precisa dela (é o que o vendedor mostra), então a maquete continua
// viva — mas SÓ para `isDemo`. Company real nunca vê mock: ela vê o
// WhatsApp oficial da loja, com as mesmas guardas de custo do dojô.
//
// 26/11/2026 — duas abas no topo:
//   Conversas      — a caixa de atendimento (HubView), que morava em
//                    Agentes → Atendimento. Só aparece com o módulo
//                    hub_social visível; sem ele a tela é só Configurações.
//   Configurações  — tudo o que o WhatsApp da loja precisa, em seções
//                    separadas (SECOES_CONFIG). Para crescer (mensagens
//                    automáticas, régua, aniversários, venda+), acrescente
//                    uma entrada em SECOES_CONFIG e o bloco correspondente.
//     Conexão   — conectar o número (Embedded Signup) + uso do mês
//     Cobranças — a fila do crediário, com o motivo de cada não-envio
//     Templates — criar/acompanhar parcela_lembrete e parcela_atraso
//
// Onde se LIGA o envio automático é a régua, em Configurações do
// Crediário — não aqui. Aqui é onde se prepara e se audita. Um único
// lugar de ligar evita a tela dizer "ligado" e a régua dizer "desligado".
// ============================================================
import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Dimensions, ActivityIndicator } from "react-native";
import { router, Redirect } from "expo-router";
import { empresaSandbox, whatsappOficialLiberadoPara, whatsappOficialVisivel } from "@/utils/whatsappOficialLiberado";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useWaVarejo } from "@/hooks/useWaVarejo";
import { TabConversas } from "@/components/screens/whatsapp/TabConversas";
import { TabAutomacoes } from "@/components/screens/whatsapp/TabAutomacoes";
import { TabCampanhas } from "@/components/screens/whatsapp/TabCampanhas";
import { TabConfig } from "@/components/screens/whatsapp/TabConfig";
import { TABS } from "@/components/screens/whatsapp/types";
import { ConexaoCard } from "@/components/whatsapp/ConexaoCard";
import { UsoCard } from "@/components/whatsapp/UsoCard";
import { FilaCard, filtrarCrediario } from "@/components/whatsapp/FilaCard";
import { TemplatesCard } from "@/components/whatsapp/TemplatesCard";
// Fases 7/8: marketing (aniversário e reativação) é outra categoria na
// Meta, custa mais e exige consentimento declarado. A declaração mora na
// aba Conexão porque é uma propriedade do NÚMERO, não de uma rotina.
import { ConsentimentoMarketingCard } from "@/components/whatsapp/ConsentimentoMarketingCard";
import { fmtPhoneBR } from "@/components/whatsapp/waGuards";
import { ScreenHero, ScreenTabs, type ScreenTabItem } from "@/components/ScreenHero";
import { HubView } from "@/components/screens/hub/HubView";
import { MedidorHub } from "@/components/screens/hub/MedidorHub";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { useWaSaldo } from "@/hooks/useWaSaldo";
import { useWaAutomaticas } from "@/hooks/useWaAutomaticas";
import { AutomaticasCard } from "@/components/whatsapp/AutomaticasCard";
import { AniversarioConfig } from "@/components/whatsapp/AniversarioConfig";
import { VendaMaisConfig } from "@/components/whatsapp/VendaMaisConfig";
import { CrediarioConfig } from "@/components/whatsapp/CrediarioConfig";
import type { WaAutoKey } from "@/services/waConfigApi";
import { MedidorSaldoCard, SaldosApagados } from "@/components/whatsapp/MedidorSaldoCard";
import { Pilula, Spots, V, t, useWaFontes, useWaKeyframes, useWaQuedas } from "@/components/whatsapp/waVidro";
import { CabecalhoWa } from "@/components/whatsapp/CabecalhoWa";
import { WaGuiasHost } from "@/components/whatsapp/guias/WaGuiasHost";
import { useWaGuias } from "@/stores/waGuias";
import type { DestinoAba } from "@/components/whatsapp/guias/guiasConteudo";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

type AbaReal = "conversas" | "automaticas" | "venda_mais" | "config";

// Seções da aba Configurações, na ordem em que aparecem. Cada uma é um bloco
// próprio: acrescentar uma é acrescentar uma linha aqui + o bloco abaixo.
//
// `nova: true` = seção da tela nova de 26/11/2026 (Aniversário, Crediário e o
// Editor). Até a liberação elas só aparecem para a equipe Aura e para a
// empresa sandbox (whatsappOficialLiberadoPara): a loja real conectada
// continua vendo Conexão, Cobranças e Templates.
// Automáticas e Venda+ são abas do topo (artboard GuiaCentral), não seções.
const SECOES_CONFIG = [
  { key: "conexao", label: "Conexão", nova: false },
  { key: "aniversario", label: "Aniversário", nova: true },
  { key: "crediario", label: "Crediário", nova: true },
  { key: "cobrancas", label: "Cobranças", nova: false },
  { key: "templates", label: "Templates", nova: false },
] as const;
type SecaoKey = (typeof SECOES_CONFIG)[number]["key"];

// Cabeçalho de cada tela nova (textos literais dos artboards aprovados).
const CABECALHO: Record<string, { titulo: string; sub: string; voltar?: boolean }> = {
  automaticas: { titulo: "Mensagens que trabalham sozinhas", sub: "Mensagem, presente e dia já vêm prontos. Um toque liga." },
  aniversario: { titulo: "Aniversário", sub: "Escolha com um toque em cada linha. Tudo já vem preenchido.", voltar: true },
  venda_mais: { titulo: "Venda+", sub: "Chame de volta quem parou de comprar, com um presente." },
  crediario: { titulo: "Crediário", sub: "Cobra sozinho quem deve. Oferece para quem paga em dia.", voltar: true },
};

export default function WhatsAppScreen() {
  useWaFontes();
  useWaKeyframes();
  useWaQuedas();
  const [tab, setTab] = useState(0);
  const [emConversa, setEmConversa] = useState(false);
  const [abaReal, setAbaReal] = useState<AbaReal>("conversas");
  const [secaoSel, setSecao] = useState<SecaoKey>("conexao");
  const scrollRef = useRef<any>(null);
  const { company, isDemo, user, consolidatedView } = useAuthStore();
  const companyId = company?.id || "";
  const demo = isDemo === true;

  const wa = useWaVarejo(companyId, !demo);
  // Guias do WhatsApp (27/11/2026): o guia 2 precisa das automáticas lidas mesmo fora da aba delas.
  const guiaAberto = useWaGuias((s) => s.aberto);
  // Telas novas: só equipe Aura ou empresa sandbox, até a liberação.
  const novas = whatsappOficialLiberadoPara(user, undefined, empresaSandbox(company, consolidatedView === true));
  const secao: SecaoKey = SECOES_CONFIG.some((sc) => sc.key === secaoSel && (!sc.nova || novas)) ? secaoSel : "conexao";

  // Atendimento (hub social) — módulo próprio vendável como add-on. Sem ele
  // não existe a aba Conversas.
  const hubVisible = useVisibleModules().has("hub_social");
  // Sem as telas novas só existem Conversas e Configurações.
  const abaPedida: AbaReal = !novas && (abaReal === "automaticas" || abaReal === "venda_mais") ? "config" : abaReal;
  const abaAtiva: AbaReal = hubVisible ? abaPedida : abaPedida === "conversas" ? "config" : abaPedida;

  // O saldo é por loja: no consolidado multi-CNPJ não se lê (a tela pede para escolher a loja).
  const saldo = useWaSaldo(companyId, !demo && !consolidatedView && novas);
  // As automáticas (divisão, liga/desliga, escolhas) alimentam as telas Automáticas, Venda+, Aniversário e Crediário.
  const autoAtiva = !demo && !consolidatedView && novas
    && (guiaAberto === 2 || abaAtiva === "automaticas" || abaAtiva === "venda_mais" || (abaAtiva === "config" && (secao === "aniversario" || secao === "crediario")));
  const lojaNome = String((company as any)?.trade_name || (company as any)?.name || "");
  const auto = useWaAutomaticas(companyId, autoAtiva);

  // A maquete só aparece no modo demonstração; o hook dela já não busca
  // nada em company real (queries com enabled: !isDemo).
  const mock = useWhatsApp();

  const abas: string[] = demo ? TABS : [];
  const ativa = Math.min(tab, Math.max(abas.length - 1, 0));

  // Abas do topo (artboard GuiaCentral): Conversas · Automáticas · Venda+ · Configurações.
  const tabsHero: ScreenTabItem[] = demo
    ? abas.map((t2, i) => ({ key: String(i), label: t2, testID: `wa-varejo-aba-${i}` }))
    : [
        ...(hubVisible ? [{ key: "conversas", label: "Conversas", testID: "wa-varejo-aba-conversas" }] : []),
        ...(novas ? [
          { key: "automaticas", label: "Automáticas", testID: "wa-varejo-aba-automaticas" },
          { key: "venda_mais", label: "Venda+", testID: "wa-varejo-aba-venda_mais" },
        ] : []),
        { key: "config", label: "Configurações", testID: "wa-varejo-aba-config" },
      ];

  const heroSub = demo
    ? "Modo demonstrativo — conversas, automações e campanhas de exemplo."
    : wa.statusLoading && !wa.status
    ? "Verificando a conexão do WhatsApp da loja…"
    : wa.status?.connected
    ? (
      <>
        Número {fmtPhoneBR(wa.status.phone_display)} conectado
        {typeof wa.status?.usage?.month_sent === "number"
          ? ` · ${wa.status.usage.month_sent} mensagens enviadas este mês`
          : ""}
      </>
    )
    : "Número da loja ainda não conectado — conecte em Configurações.";

  // 18/11/2026 — trava do WhatsApp oficial (utils/whatsappOficialLiberado):
  // até a Meta aprovar, só a loja que já tem o número conectado abre esta
  // tela. O menu já não mostra o item; quem chega pela URL volta ao Painel,
  // depois de o status responder (sem status, a tela fica vazia).
  // 26/11/2026 — a equipe Aura abre sempre: conecta o número da própria Aura.
  if (!whatsappOficialVisivel(wa.status, user, undefined, empresaSandbox(company, consolidatedView === true))) {
    if (!demo && wa.statusLoading) return null;
    return <Redirect href={"/" as any} />;
  }

  const hero = <ScreenHero eyebrow="Canal oficial da loja" title="WhatsApp" subtitle={heroSub} />;

  const irPara = (k: AbaReal) => { setAbaReal(k); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); };

  // Aba destacada: Aniversário e Crediário moram sob "Automáticas" (o voltar diz "← Automáticas").
  const abaDestaque: AbaReal = abaAtiva === "config" && (secao === "aniversario" || secao === "crediario") ? "automaticas" : abaAtiva;
  const chaveCab = abaAtiva === "automaticas" ? "automaticas" : abaAtiva === "venda_mais" ? "venda_mais"
    : abaAtiva === "config" && (secao === "aniversario" || secao === "crediario") ? secao : null;

  // Cabeçalho das telas novas (artboards Main e GuiaCentral): título à esquerda; abas
  // (pílulas translúcidas) e o botão "Guias" à direita, na mesma linha. No celular, uma
  // linha só, rolável, com o Guias só em ícone.
  const cabecalhoNovo = () => (
    <CabecalhoWa
      largo={IS_WIDE} lojaNome={lojaNome} tabs={tabsHero} ativa={abaDestaque}
      titulo={chaveCab ? CABECALHO[chaveCab].titulo : abaAtiva === "conversas" ? "Conversas" : "Configurações"}
      sub={chaveCab ? CABECALHO[chaveCab].sub : undefined}
      voltar={chaveCab ? !!CABECALHO[chaveCab].voltar : false}
      onSelect={(k) => irPara(k as AbaReal)} onVoltar={() => irPara("automaticas")}
      onGuias={() => useWaGuias.getState().abrirMenu()}
      extra={abaAtiva === "conversas" && !consolidatedView ? <MedidorHub saldo={saldo.saldo} /> : undefined}
    />
  );

  // Guias (27/11/2026): só a tela nova (equipe Aura e sandbox). O guia troca a aba antes de procurar o alvo.
  const guiaIrPara = (d: DestinoAba) => {
    if (d.secao) setSecao(d.secao as SecaoKey);
    setAbaReal(d.aba);
  };
  const guias = novas && !demo ? (
    <WaGuiasHost
      userId={(user as any)?.id}
      ctx={{
        companyId, lojaNome, status: wa.status ?? null, conectado: wa.status?.connected === true,
        telefone: fmtPhoneBR(wa.status?.phone_display), auto, saldo: saldo.saldo, hubVisible, celular: !IS_WIDE,
        irPara: guiaIrPara,
      }}
    />
  ) : null;

  // Conversas: container próprio — o HubView tem os seus ScrollViews
  // internos (lista + thread) e não pode ficar dentro de outro ScrollView.
  // No consolidado multi-CNPJ o próprio HubView mostra "Escolha uma loja".
  if (!demo && abaAtiva === "conversas") {
    return (
      <View style={s.screen} testID="wa-varejo-conversas">
        {/* Celular, dentro de uma conversa: sem título e abas; a conversa ocupa a tela, só com o cabeçalho de vidro (artboard Celular). */}
        <View style={[s.content, { flex: 1 }, novas && { maxWidth: 1360 }, !IS_WIDE && emConversa && { padding: 0 }]}>
          {novas && <Spots />}
          {!(IS_WIDE === false && emConversa) && (novas ? cabecalhoNovo() : (<>{hero}<ScreenTabs tabs={tabsHero} active="conversas" onSelect={(k) => setAbaReal(k as AbaReal)} /></>))}
          <HubView onConversaAberta={setEmConversa} />
        </View>
        {guias}
      </View>
    );
  }

  const medidor = !novas ? null : consolidatedView ? (
    <View style={s.linkCard} testID="wa-varejo-escolha-loja">
      <Icon name="alert" size={14} color={Colors.violet3} />
      <Text style={s.linkTxt}>
        As mensagens e as automáticas do WhatsApp são por loja. Saia da visão consolidada e escolha a loja.
      </Text>
    </View>
  ) : (
    <MedidorSaldoCard
      companyId={companyId}
      saldo={saldo.saldo}
      carregando={saldo.carregando}
      falhou={saldo.falhou}
      status={wa.status}
      onRetry={saldo.recarregar}
    />
  );

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={[s.content, novas && !demo && { maxWidth: 1360 }]}>
      {novas && !demo && <Spots />}
      {novas && !demo ? cabecalhoNovo() : (
        <>
          {hero}
          {demo ? (
            <ScreenTabs
              tabs={tabsHero}
              active={String(ativa)}
              onSelect={(k) => { setTab(Number(k)); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }}
            />
          ) : tabsHero.length > 1 ? (
            <ScreenTabs tabs={tabsHero} active={abaAtiva} onSelect={(k) => irPara(k as AbaReal)} quebraNoCelular />
          ) : null}
        </>
      )}

      {demo ? (
        <View testID="wa-varejo-maquete">
          {ativa === 0 && <TabConversas conversations={mock.conversations} messages={mock.messages} onSend={mock.sendMessage} />}
          {ativa === 1 && <TabAutomacoes automations={mock.automations} activeCount={mock.activeAutomations} totalSent={mock.totalSent} onToggle={mock.toggleAutomation} />}
          {ativa === 2 && <TabCampanhas campaigns={mock.campaigns} />}
          {ativa === 3 && <TabConfig isConnected={mock.isConnected} />}
          <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>
        </View>
      ) : abaAtiva === "automaticas" ? (
        <View style={{ gap: 24, zIndex: 1 }} testID="wa-varejo-real">
          {medidor}
          {!consolidatedView && (
            <View testID="wa-varejo-bloco-automaticas">
              <AutomaticasCard
                auto={auto}
                companyId={companyId}
                onAjustar={(k: WaAutoKey) => {
                  if (k === "venda_mais") { irPara("venda_mais"); return; }
                  setSecao(k === "aniversario" ? "aniversario" : "crediario");
                  irPara("config");
                }}
              />
            </View>
          )}
        </View>
      ) : abaAtiva === "venda_mais" ? (
        <View style={{ gap: 24, zIndex: 1 }} testID="wa-varejo-real">
          {!consolidatedView && (
            <View testID="wa-varejo-bloco-venda-mais">
              <VendaMaisConfig companyId={companyId} auto={auto} saldo={saldo.saldo} status={wa.status} lojaNome={lojaNome} />
            </View>
          )}
        </View>
      ) : (
        <View style={{ gap: novas ? 24 : 14, zIndex: 1 }} testID="wa-varejo-real">
          {/* Seções de Configurações: uma de cada vez, cada uma num bloco
              próprio (SECOES_CONFIG). */}
          <View style={s.secoes} testID="wa-varejo-config-secoes">
            {SECOES_CONFIG.filter((sc) => !sc.nova || novas).map((sc) => (
              <Pilula
                key={sc.key}
                onPress={() => setSecao(sc.key)}
                ligada={secao === sc.key}
                estado={{ selected: secao === sc.key }}
                testID={`wa-varejo-secao-${sc.key}`}
              >
                <Text style={t(14, secao === sc.key ? V.onTxt : V.ink, "600")}>{sc.label}</Text>
              </Pilula>
            ))}
          </View>

          {wa.statusLoading && !wa.status && (
            <View style={s.loadingBox} testID="wa-varejo-carregando">
              <ActivityIndicator size="small" color={Colors.violet3} />
            </View>
          )}

          {secao === "conexao" && (
            <View style={{ gap: 14 }} testID="wa-varejo-bloco-conexao">
              {novas ? (
                // GuiaExecucao, guia 1: a conexão e os saldos lado a lado.
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
                  <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 480, minWidth: 0 }}>
                    <ConexaoCard companyId={companyId} status={wa.status} onChanged={wa.reloadAll} vidro />
                  </View>
                  <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 480, minWidth: 0 }}>{wa.status?.connected === true ? medidor : <SaldosApagados />}</View>
                </View>
              ) : (
                <ConexaoCard companyId={companyId} status={wa.status} onChanged={wa.reloadAll} />
              )}
              <UsoCard status={wa.status} companyId={companyId} onChanged={wa.reloadStatus} />
              <ConsentimentoMarketingCard
                companyId={companyId}
                status={wa.status}
                onChanged={wa.reloadStatus}
              />
              <Pressable
                onPress={() => router.push("/crediario/settings")}
                accessibilityRole="button"
                style={s.linkCard}
                testID="wa-varejo-ir-para-regua"
              >
                <Icon name="arrow_right" size={14} color={Colors.violet3} />
                <Text style={s.linkTxt}>
                  O envio automático das cobranças liga na régua, em Configurações do Crediário.
                </Text>
              </Pressable>
            </View>
          )}

          {secao === "aniversario" && !consolidatedView && (
            <View testID="wa-varejo-bloco-aniversario">
              <AniversarioConfig companyId={companyId} auto={auto} lojaNome={lojaNome} />
            </View>
          )}

          {secao === "crediario" && !consolidatedView && (
            <View testID="wa-varejo-bloco-crediario">
              <CrediarioConfig companyId={companyId} auto={auto} saldo={saldo.saldo} status={wa.status} lojaNome={lojaNome} />
            </View>
          )}

          {secao === "cobrancas" && (
            <FilaCard
              items={filtrarCrediario(wa.outbox)}
              loading={wa.outboxLoading}
              notConnected={wa.outboxNotConnected}
              error={wa.outboxError}
              onReload={wa.reloadOutbox}
            />
          )}

          {secao === "templates" && (
            <TemplatesCard
              companyId={companyId}
              templates={wa.templates}
              status={wa.status}
              loading={wa.templatesLoading}
              notConnected={wa.templatesNotConnected}
              error={wa.templatesError}
              onReload={() => { wa.reloadTemplates(); wa.reloadStatus(); }}
            />
          )}
        </View>
      )}
      {guias}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  secoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  abasLinha: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 },
  secaoPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  secaoPillOn: { backgroundColor: Colors.violetD, borderColor: Colors.border2 },
  secaoTxt: { fontSize: 12, fontWeight: "600", color: Colors.ink3 },
  secaoTxtOn: { color: Colors.violet3 },
  loadingBox: { paddingVertical: 28, alignItems: "center" },
  linkCard: {
    flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: Colors.violetD,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, paddingVertical: 12, paddingHorizontal: 14,
  },
  linkTxt: { flex: 1, fontSize: 12, color: Colors.ink2, fontWeight: "600", lineHeight: 17 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
