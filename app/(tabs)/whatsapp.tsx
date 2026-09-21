// ============================================================
// WhatsApp (varejo) — Fase 6i
//
// Esta tela era 100% maquete: conversas, automações e campanhas saíam de
// MOCK_* em components/screens/whatsapp/types. O modo demonstração ainda
// precisa dela (é o que o vendedor mostra), então a maquete continua
// viva — mas SÓ para `isDemo`. Company real nunca vê mock: ela vê o
// WhatsApp oficial da loja, com as mesmas guardas de custo do dojô.
//
// Três abas, na ordem em que o lojista precisa delas:
//   Conexão   — conectar o número (Embedded Signup) + uso do mês
//   Cobranças — a fila do crediário, com o motivo de cada não-envio
//   Templates — criar/acompanhar parcela_lembrete e parcela_atraso
//
// Onde se LIGA o envio automático é a régua, em Configurações do
// Crediário — não aqui. Aqui é onde se prepara e se audita. Um único
// lugar de ligar evita a tela dizer "ligado" e a régua dizer "desligado".
// ============================================================
import { useState, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Dimensions, ActivityIndicator } from "react-native";
import { router } from "expo-router";
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
import { ReativacaoEntrada } from "@/components/screens/clientes/ReativacaoEntrada";
import { useCustomers } from "@/hooks/useCustomers";
import { fmtPhoneBR } from "@/components/whatsapp/waGuards";
import { ScreenHero, ScreenTabs, type ScreenTabItem } from "@/components/ScreenHero";

const IS_WIDE = (typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width) > 768;

const TABS_REAIS = ["Conexão", "Cobranças", "Templates"];

export default function WhatsAppScreen() {
  const [tab, setTab] = useState(0);
  const scrollRef = useRef<any>(null);
  const { company, isDemo } = useAuthStore();
  const companyId = company?.id || "";
  const demo = isDemo === true;

  const wa = useWaVarejo(companyId, !demo);

  // A entrada da reativação conta em cima da lista de clientes. Mesma
  // queryKey do hook da tela de Clientes (react-query), então isto é
  // cache compartilhado, não uma chamada nova — e no consolidado a
  // lista já vem de todas as lojas (MULTICNPJ).
  const clientes = useCustomers();

  // A maquete só aparece no modo demonstração; o hook dela já não busca
  // nada em company real (queries com enabled: !isDemo).
  const mock = useWhatsApp();

  const abas = demo ? TABS : TABS_REAIS;
  const ativa = Math.min(tab, abas.length - 1);

  // I1.3 — cabeçalho editorial padrão (ScreenHero), igual às outras onze
  // telas. Subtítulo lê o estado da conexão + mensagens do mês direto do
  // wa.status que a aba Conexão já carrega — nenhuma chamada nova.
  const tabsHero: ScreenTabItem[] = abas.map((t, i) => ({
    key: String(i),
    label: t,
    testID: `wa-varejo-aba-${i}`,
  }));

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
    : "Número da loja ainda não conectado — conecte na aba Conexão.";

  return (
    <ScrollView ref={scrollRef} style={s.screen} contentContainerStyle={s.content}>
      <ScreenHero eyebrow="Canal oficial da loja" title="WhatsApp" subtitle={heroSub} />

      <ScreenTabs
        tabs={tabsHero}
        active={String(ativa)}
        onSelect={(k) => { setTab(Number(k)); scrollRef.current?.scrollTo?.({ y: 0, animated: true }); }}
      />

      {demo ? (
        <View testID="wa-varejo-maquete">
          {ativa === 0 && <TabConversas conversations={mock.conversations} messages={mock.messages} onSend={mock.sendMessage} />}
          {ativa === 1 && <TabAutomacoes automations={mock.automations} activeCount={mock.activeAutomations} totalSent={mock.totalSent} onToggle={mock.toggleAutomation} />}
          {ativa === 2 && <TabCampanhas campaigns={mock.campaigns} />}
          {ativa === 3 && <TabConfig isConnected={mock.isConnected} />}
          <View style={s.demoBanner}><Text style={s.demoText}>Modo demonstrativo</Text></View>
        </View>
      ) : (
        <View style={{ gap: 14 }} testID="wa-varejo-real">
          {wa.statusLoading && !wa.status && (
            <View style={s.loadingBox} testID="wa-varejo-carregando">
              <ActivityIndicator size="small" color={Colors.violet3} />
            </View>
          )}

          {ativa === 0 && (
            <>
              <ConexaoCard companyId={companyId} status={wa.status} onChanged={wa.reloadAll} />
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
              {/* Fase 0 (I0.2): era um link que só dizia ONDE ficava a
                  reativação. Agora diz QUANTOS clientes sumiram e quanto
                  eles já gastaram, com o corte de dias escolhido aqui —
                  mesma régua e mesmo bloco da aba Retenção de Clientes,
                  na variante compacta. */}
              <ReativacaoEntrada
                customers={clientes.customers}
                plan={clientes.plan}
                carregando={clientes.isLoading}
                companyCount={clientes.consolidatedView ? clientes.companyCount : 1}
                compacto
                idBase="wa-varejo-ir-para-reativacao"
              />
            </>
          )}

          {ativa === 1 && (
            <FilaCard
              items={filtrarCrediario(wa.outbox)}
              loading={wa.outboxLoading}
              notConnected={wa.outboxNotConnected}
              error={wa.outboxError}
              onReload={wa.reloadOutbox}
            />
          )}

          {ativa === 2 && (
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
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 960, alignSelf: "center", width: "100%" },
  loadingBox: { paddingVertical: 28, alignItems: "center" },
  linkCard: {
    flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: Colors.violetD,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, paddingVertical: 12, paddingHorizontal: 14,
  },
  linkTxt: { flex: 1, fontSize: 12, color: Colors.ink2, fontWeight: "600", lineHeight: 17 },
  demoBanner: { alignSelf: "center", backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 16 },
  demoText: { fontSize: 11, color: Colors.violet3, fontWeight: "500" },
});
