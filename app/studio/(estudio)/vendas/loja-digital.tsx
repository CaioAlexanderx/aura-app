// ============================================================
// AURA STUDIO · Loja Digital (Storefront)
//
// 25/05/2026: substitui o StudioBridge stub por implementação real.
// Reaproveita o hook useDigitalChannel + os 5 componentes Tab* do
// Canal Digital varejo (TabMeuSite, TabDesign, TabVitrine, TabEntrega,
// TabPedidos) — mesma feature set, mas chrome externo (eyebrow + hero
// + tab bar) com tokens Studio (navy #1E3A8A + accent magenta #EC4899).
//
// Studio não tem gate de plano (memory studio_sem_gate_de_plano_25mai2026)
// — qualquer empresa com vertical=studio ou pdv_settings.studio_enabled
// acessa essa tela.
// ============================================================
import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from "react-native";
import { StudioColors } from "@/constants/studio-tokens";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { Icon } from "@/components/Icon";
import { ListSkeleton } from "@/components/ListSkeleton";
import { TabBar } from "@/components/TabBar";
import { IS_WIDE, TABS } from "@/components/screens/canal/shared";
import { TabMeuSite } from "@/components/screens/canal/TabMeuSite";
import { TabDesign } from "@/components/screens/canal/TabDesign";
import { TabVitrine } from "@/components/screens/canal/TabVitrine";
import { TabEntrega } from "@/components/screens/canal/TabEntrega";
import { TabPedidos } from "@/components/screens/canal/TabPedidos";

const STOREFRONT_BASE = "https://loja.getaura.com.br";

export default function StudioVendasLojaDigital() {
  const [tab, setTab] = useState(0);
  const {
    config, isLoading,
    saveConfig, isSaving,
    requestDomain, isRequestingDomain,
    uploadImage, isUploadingImage,
    deleteImage,
    setupPix, isSettingUpPix,
  } = useDigitalChannel();

  const storefrontUrl = config.storefront_url
    || (config.slug ? `${STOREFRONT_BASE}/${config.slug}` : null);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* Header Studio — eyebrow magenta + título navy */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>VENDAS · LOJA DIGITAL</Text>
          <Text style={s.title}>Storefront pra vender online</Text>
          <Text style={s.sub}>
            Página pública onde o cliente vê seus produtos personalizáveis, configura a personalização e fecha o pedido pelo Pix ou cartão.
          </Text>
        </View>
        {config.is_published && storefrontUrl && (
          <Pressable
            onPress={() => Linking.openURL(storefrontUrl)}
            style={s.viewSiteBtn}
          >
            <Icon name="globe" size={13} color={StudioColors.primary} />
            <Text style={s.viewSiteBtnTxt}>Ver site</Text>
          </Pressable>
        )}
      </View>

      {/* Hero Studio — fundo navy soft com accent */}
      <View style={s.hero}>
        <View style={s.heroIcon}>
          <Icon name="globe" size={22} color={StudioColors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>Sua loja Studio em minutos</Text>
          <Text style={s.heroDesc}>
            Configure vitrine, design, entrega e acompanhe pedidos. Produtos marcados como personalizáveis aparecem com o configurador.
          </Text>
        </View>
        <View style={s.heroPill}>
          <Text style={s.heroPillTxt}>
            {config.is_published ? "PUBLICADA" : "RASCUNHO"}
          </Text>
        </View>
      </View>

      {/* Tabs reaproveitadas do Canal Digital varejo */}
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : (
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
          {tab === 2 && (
            <TabVitrine
              config={config}
              saveConfig={saveConfig}
              isSaving={isSaving}
            />
          )}
          {tab === 3 && (
            <TabEntrega
              config={config}
              saveConfig={saveConfig}
              isSaving={isSaving}
            />
          )}
          {tab === 4 && <TabPedidos />}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: StudioColors.bg },
  container: {
    padding: IS_WIDE ? 32 : 20,
    paddingBottom: 60,
    maxWidth: 1280,
    alignSelf: "center",
    width: "100%",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  eyebrow: {
    fontSize: 11,
    color: StudioColors.accent,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: StudioColors.ink,
    marginTop: 4,
    letterSpacing: -0.4,
  },
  sub: {
    fontSize: 13.5,
    color: StudioColors.ink3,
    marginTop: 4,
    maxWidth: 640,
  },
  viewSiteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: StudioColors.primaryGhost,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: StudioColors.primarySoft,
  },
  viewSiteBtnTxt: {
    fontSize: 12,
    color: StudioColors.primary,
    fontWeight: "700",
  },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: StudioColors.primaryGhost,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: StudioColors.primarySoft,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: StudioColors.primarySoft,
    flexShrink: 0,
  },
  heroTitle: {
    fontSize: 15,
    color: StudioColors.ink,
    fontWeight: "800",
  },
  heroDesc: {
    fontSize: 12,
    color: StudioColors.ink3,
    marginTop: 2,
    lineHeight: 17,
  },
  heroPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: StudioColors.accent,
    borderRadius: 999,
    flexShrink: 0,
  },
  heroPillTxt: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
