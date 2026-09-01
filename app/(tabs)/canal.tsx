import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { ScreenHero, ScreenTabs } from "@/components/ScreenHero";
import { Icon } from "@/components/Icon";
import { ListSkeleton } from "@/components/ListSkeleton";
import { IS_WIDE, TABS } from "@/components/screens/canal/shared";
import { TabMeuSite } from "@/components/screens/canal/TabMeuSite";
import { TabDesign } from "@/components/screens/canal/TabDesign";
import { TabVitrine } from "@/components/screens/canal/TabVitrine";
import { TabEntrega } from "@/components/screens/canal/TabEntrega";
import { TabPedidos } from "@/components/screens/canal/TabPedidos";

const STOREFRONT_BASE = 'https://loja.getaura.com.br';

// 01/09/2026 (QA onda 2 — cabeçalho unificado): o PageHeader + o cartão
// "Sua loja online em minutos" viraram um ScreenHero só, igual às outras onze
// abas. O cartão dizia em duas linhas o que o cabeçalho agora diz na
// sobrancelha (situação) e no subtítulo (endereço da loja + próximo passo), e
// o botão "Ver site" virou ação do cabeçalho.
//
// O que NÃO foi tocado: o preview da loja dentro das abas — é o melhor
// elemento da tela.

export default function CanalDigitalScreen() {
  const [tab, setTab] = useState(0);
  const { company } = useAuthStore();
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
          <Pressable style={s.upgradeBtn}><Text style={s.upgradeBtnText}>Ver planos</Text></Pressable>
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
        onSelect={(k) => setTab(TABS.indexOf(k))}
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
          {tab === 4 && <TabPedidos companyId={company?.id} />}
        </>
      )}
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
