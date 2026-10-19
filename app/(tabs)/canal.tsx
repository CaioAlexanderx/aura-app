import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { ScreenHero, ScreenTabs } from "@/components/ScreenHero";
import { Icon } from "@/components/Icon";
import { ListSkeleton } from "@/components/ListSkeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WebPortal } from "@/components/WebPortal";
import { IS_WIDE, TABS } from "@/components/screens/canal/shared";
import { TabMeuSite } from "@/components/screens/canal/TabMeuSite";
import { TabDesign } from "@/components/screens/canal/TabDesign";
import { TabVitrine } from "@/components/screens/canal/TabVitrine";
import { TabEntrega } from "@/components/screens/canal/TabEntrega";
import { TabPedidos } from "@/components/screens/canal/TabPedidos";

const STOREFRONT_BASE = 'https://loja.getaura.com.br';

// 10/09/2026: o aviso de pedido (sino e navegador) aponta para
// /canal?tab=pedidos&order_id=<id>. A aba era estado local e ignorava o
// endereco — o clique caia em "Meu Site".
const ABA_PELO_NOME: Record<string, number> = { site: 0, design: 1, vitrine: 2, entrega: 3, pedidos: 4 };
function abaDoEndereco(valor: unknown): number | null {
  const nome = String(Array.isArray(valor) ? valor[0] : valor || "").toLowerCase();
  return nome in ABA_PELO_NOME ? ABA_PELO_NOME[nome] : null;
}

// 01/09/2026 (QA onda 2 — cabeçalho unificado): o PageHeader + o cartão
// "Sua loja online em minutos" viraram um ScreenHero só, igual às outras onze
// abas. O cartão dizia em duas linhas o que o cabeçalho agora diz na
// sobrancelha (situação) e no subtítulo (endereço da loja + próximo passo), e
// o botão "Ver site" virou ação do cabeçalho.
//
// O que NÃO foi tocado: o preview da loja dentro das abas — é o melhor
// elemento da tela.

export default function CanalDigitalScreen() {
  const params = useLocalSearchParams<{ tab?: string; order_id?: string }>();
  const [tab, setTab] = useState(() => abaDoEndereco(params.tab) ?? 0);
  const pedidoDoEndereco = typeof params.order_id === "string" ? params.order_id : undefined;
  // 19/10/2026 (tq-49): Meu Site avisa quando tem alteração não salva
  // (contrato `onAlteracoes`). Trocar de aba nesse estado joga a edição fora;
  // então pergunta antes. NÃO há gravação automática: salvar é sempre decisão
  // da lojista ("Salvar" aqui chama o mesmo handleSave dos botões da aba).
  const [alteracaoNoSite, setAlteracaoNoSite] = useState(false);
  const [abaPendente, setAbaPendente] = useState<number | null>(null);
  const [salvandoAntesDeSair, setSalvandoAntesDeSair] = useState(false);
  const salvarSiteRef = useRef<(() => Promise<boolean>) | null>(null);
  const avisarAlteracoes = useCallback((v: boolean) => setAlteracaoNoSite(v), []);
  const siteSujo = tab === 0 && alteracaoNoSite;

  const irParaAba = useCallback((next: number) => {
    setAbaPendente(null);
    setAlteracaoNoSite(false);
    setTab(next);
  }, []);
  // Clique numa aba (ou no aviso/link com a tela já aberta): com Meu Site
  // sujo, pergunta; sem alteração, troca direto.
  const trocarDeAba = useCallback((next: number) => {
    if (next === tab) return;
    if (siteSujo) setAbaPendente(next);
    else irParaAba(next);
  }, [tab, siteSujo, irParaAba]);

  // Clique no aviso com a tela ja aberta: o endereco muda, a aba acompanha.
  useEffect(() => {
    const aba = abaDoEndereco(params.tab);
    if (aba !== null) trocarDeAba(aba);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tab, params.order_id]);

  // Recarregar ou fechar a página com alteração não salva: o navegador pergunta.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !siteSujo) return;
    const segurar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", segurar);
    return () => window.removeEventListener("beforeunload", segurar);
  }, [siteSujo]);

  async function salvarEIr() {
    if (abaPendente === null || salvandoAntesDeSair) return;
    const destino = abaPendente;
    setSalvandoAntesDeSair(true);
    let gravou = false;
    try { gravou = (await salvarSiteRef.current?.()) === true; } catch { gravou = false; }
    setSalvandoAntesDeSair(false);
    // Falhou: o erro já foi avisado pelo hook; a edição continua na tela.
    if (gravou) irParaAba(destino);
    else setAbaPendente(null);
  }
  const { company } = useAuthStore();
  const router = useRouter();
  const {
    config, isLoading,
    saveConfig, isSaving,
    requestDomain, isRequestingDomain,
    uploadImage, isUploadingImage,
    deleteImage,
    setupPix, isSettingUpPix,
  } = useDigitalChannel();
  const plan = company?.plan || "essencial";
  const hasAccess = ({ essencial: 0, negocio: 1, expansao: 2 }[plan] ?? 0) >= 1;

  if (!hasAccess) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <ScreenHero
          eyebrow="Sua loja online"
          title="Canal Digital"
          subtitle="Vitrine de produtos, domínio personalizado e pedidos — disponível a partir do plano Negócio."
        />
        <View style={s.lockBox}>
          <Icon name="globe" size={36} color={Colors.ink3} />
          <Text style={s.lockTitle}>Canal Digital</Text>
          <Text style={s.lockDesc}>Crie sua loja online em minutos. Vitrine de produtos, domínio personalizado e mais.</Text>
          <View style={s.lockBadge}><Text style={s.lockBadgeText}>Disponível no plano Negócio</Text></View>
          {/* 19/10/2026 (p-33): o botão existia sem onPress. Quem chega aqui pela URL
              ou por um atalho de outra tela vê o caminho para os planos. */}
          <Pressable style={s.upgradeBtn} onPress={() => router.push("/(tabs)/planos" as any)} accessibilityRole="button">
            <Text style={s.upgradeBtnText}>Ver planos</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const storefrontUrl = config.storefront_url || (config.slug ? `${STOREFRONT_BASE}/${config.slug}` : null);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <ScreenHero
        eyebrow="Sua loja online"
        title="Canal Digital"
        live={!!config.is_published}
        badge={config.is_published ? "Publicada" : "Rascunho"}
        subtitle={
          config.is_published && storefrontUrl
            ? (
              <>
                {storefrontUrl.replace(/^https?:\/\//, "")} ·{" "}
                <Text style={{ color: Colors.green, fontWeight: "600" }}>visível para clientes</Text>
                {" "}· compartilhe o link e comece a vender
              </>
            )
            : "Ainda não publicada. Configure, personalize e publique — o link fica pronto para compartilhar."
        }
        actions={config.is_published && storefrontUrl ? (
          <Pressable onPress={() => Linking.openURL(storefrontUrl)} style={s.viewSiteBtn}>
            <Icon name="globe" size={13} color={Colors.violet3} />
            <Text style={s.viewSiteBtnText}>Ver site</Text>
          </Pressable>
        ) : undefined}
      />
      <ScreenTabs
        tabs={TABS.map((t) => ({ key: t, label: t }))}
        active={TABS[tab]}
        onSelect={(k) => trocarDeAba(TABS.indexOf(k))}
      />
      {isLoading ? <ListSkeleton rows={4} /> : (
        <>
          {tab === 0 && (
            <TabMeuSite
              config={config}
              saveConfig={saveConfig}
              isSaving={isSaving}
              requestDomain={requestDomain}
              isRequestingDomain={isRequestingDomain}
              uploadImage={uploadImage}
              isUploadingImage={isUploadingImage}
              setupPix={setupPix}
              isSettingUpPix={isSettingUpPix}
              onAlteracoes={avisarAlteracoes}
              salvarRef={salvarSiteRef}
            />
          )}
          {tab === 1 && (
            <TabDesign
              config={config}
              saveConfig={saveConfig}
              isSaving={isSaving}
              uploadImage={uploadImage}
              isUploadingImage={isUploadingImage}
              deleteImage={deleteImage}
            />
          )}
          {tab === 2 && <TabVitrine config={config} saveConfig={saveConfig} isSaving={isSaving} />}
          {tab === 3 && <TabEntrega config={config} saveConfig={saveConfig} isSaving={isSaving} />}
          {/* 17/08/2026: a prop `companyId` passou a ser explícita. Sem ela,
              TabPedidos derivava o cid de `orders[0]?.company_id` e fazia
              early-return mudo quando a lista não trazia esse campo. O hook
              ainda cai na empresa do store se a prop vier undefined. */}
          {tab === 4 && <TabPedidos companyId={company?.id} orderIdInicial={pedidoDoEndereco} />}
        </>
      )}
      <WebPortal active={abaPendente !== null}>
        <ConfirmDialog
          visible={abaPendente !== null}
          title="Alterações não salvas"
          message="Você tem alterações não salvas em Meu Site. Salvar antes de sair?"
          confirmLabel={salvandoAntesDeSair ? "Salvando..." : "Salvar"}
          destructive={false}
          onConfirm={salvarEIr}
          secondaryLabel="Descartar"
          onSecondary={() => { if (!salvandoAntesDeSair && abaPendente !== null) irParaAba(abaPendente); }}
          cancelLabel="Continuar editando"
          onCancel={() => { if (!salvandoAntesDeSair) setAbaPendente(null); }}
        />
      </WebPortal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: IS_WIDE ? 32 : 20, paddingBottom: 48, maxWidth: 1280, alignSelf: "center", width: "100%" },
  viewSiteBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.bg3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border2, flexShrink: 0 },
  viewSiteBtnText: { fontSize: 11, color: Colors.violet3, fontWeight: "600" },
  lockBox: { alignItems: "center", paddingVertical: 48, gap: 12, backgroundColor: Colors.bg3, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 32 },
  lockTitle: { fontSize: 22, color: Colors.ink, fontWeight: "800" },
  lockDesc: { fontSize: 13, color: Colors.ink3, textAlign: "center", lineHeight: 20, maxWidth: 320 },
  lockBadge: { backgroundColor: Colors.violetD, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border2 },
  lockBadgeText: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  upgradeBtn: { backgroundColor: Colors.violet, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  upgradeBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
