// ============================================================
// AURA STUDIO · Loja Digital (Storefront) — 8 Tabs Studio-native
//
// 25/05/2026: separação da Loja Digital Studio do Canal Digital varejo
// (memory studio_bridges_completas_25mai2026 → evolução).
//
// 8 Tabs:
//   1. Meu Site     — reuso TabMeuSite (canal varejo, tematizado via AccentTheme)
//   2. Design       — reuso TabDesign (canal varejo, tematizado)
//   3. Configurador — NOVO Studio (lista produtos personalizáveis + atalho /studio/produtos)
//   4. Galeria      — NOVO Studio (templates de arte prontos pra cliente)
//   5. Revisões     — NOVO Studio (max_revisions_included + extra_revision_price)
//   6. Marketplaces — NOVO Studio (conectar ML/Shopee via OAuth popup)
//   7. Entrega      — reuso TabEntrega (canal varejo, tematizado)
//   8. Pedidos      — NOVO Studio (unifica digital + pdv + marketplace)
//
// Envelopa em <AccentTheme tokens={studioAccent}> — tematização navy+magenta
// completa nas 3 tabs reaproveitadas + tabs novas usam StudioColors direto.
//
// 26/05/2026 — Fases 2+3 UX:
//   · Fase 2: fade-edge gradients nas bordas do ScrollView horizontal de tabs
//     (mobile mostra 3 de 8; gradient sinaliza "tem mais pra ver"). Escondido
//     em desktop wide (IS_WIDE), onde as 8 tabs já cabem na viewport.
//   · Fase 3: header trocado pelo componente canônico StudioPageHeader
//     (eyebrow magenta + title + subtitle + rightSlot opcional).
// ============================================================
import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StudioColors } from "@/constants/studio-tokens";
import { AccentTheme, studioAccent } from "@/contexts/AccentTheme";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { Icon } from "@/components/Icon";
import { ListSkeleton } from "@/components/ListSkeleton";
import { IS_WIDE } from "@/components/screens/canal/shared";
import { StudioPageHeader } from "@/components/studio/StudioPageHeader";
// Reuso do canal varejo (tabs já tematizadas via useAccent/useChannelStyles)
import { TabMeuSite } from "@/components/screens/canal/TabMeuSite";
import { TabDesign }  from "@/components/screens/canal/TabDesign";
import { TabEntrega } from "@/components/screens/canal/TabEntrega";
// Tabs Studio-native novas
import { TabStudioConfigurador } from "@/components/screens/studio-loja-digital/TabStudioConfigurador";
import { TabStudioGaleria }      from "@/components/screens/studio-loja-digital/TabStudioGaleria";
import { TabStudioRevisoes }     from "@/components/screens/studio-loja-digital/TabStudioRevisoes";
import { TabStudioMarketplaces } from "@/components/screens/studio-loja-digital/TabStudioMarketplaces";
import { TabStudioPedidos }      from "@/components/screens/studio-loja-digital/TabStudioPedidos";

const STOREFRONT_BASE = "https://loja.getaura.com.br";

type TabKey = "site" | "design" | "configurator" | "gallery" | "revisions" | "marketplaces" | "delivery" | "orders";

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "site",          label: "Meu Site",     icon: "globe" },
  { key: "design",        label: "Design",       icon: "edit" },
  { key: "configurator",  label: "Configurador", icon: "settings" },
  { key: "gallery",       label: "Galeria",      icon: "image" },
  { key: "revisions",     label: "Revisões",     icon: "refresh" },
  { key: "marketplaces",  label: "Marketplaces", icon: "external-link" },
  { key: "delivery",      label: "Entrega",      icon: "truck" },
  { key: "orders",        label: "Pedidos",      icon: "shopping-bag" },
];

export default function StudioVendasLojaDigital() {
  const [tab, setTab] = useState<TabKey>("site");
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
    <AccentTheme tokens={studioAccent}>
      <ScrollView style={s.scroll} contentContainerStyle={s.container}>
        {/* Header canônico Studio (Fase 3) */}
        <StudioPageHeader
          eyebrow="VENDAS · LOJA DIGITAL"
          title="Sua loja Studio na internet"
          subtitle="Configure tudo do storefront: produtos personalizáveis, galeria de templates, política de revisões, marketplaces e pedidos unificados."
          rightSlot={config.is_published && storefrontUrl ? (
            <Pressable onPress={() => Linking.openURL(storefrontUrl)} style={s.viewSiteBtn}>
              <Icon name="globe" size={13} color={StudioColors.primary} />
              <Text style={s.viewSiteBtnTxt}>Ver site</Text>
            </Pressable>
          ) : undefined}
        />

        {/* Hero Studio — fundo navy soft com accent */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Icon name="globe" size={22} color={StudioColors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Loja Digital pronta pra personalizados</Text>
            <Text style={s.heroDesc}>
              Tudo que o cliente precisa: ver produtos, configurar arte com texto/foto/cores, escolher template e fechar pelo Pix ou cartão.
            </Text>
          </View>
          {/* Pill semântico: verde mint quando publicada (estado ativo positivo),
              cinza ink4 quando rascunho (estado neutro). Antes era accent magenta
              em ambos os casos, o que dava falso CTA. */}
          <View style={[s.heroPill, { backgroundColor: config.is_published ? StudioColors.success : StudioColors.ink4 }]}>
            <Text style={s.heroPillTxt}>
              {config.is_published ? "PUBLICADA" : "RASCUNHO"}
            </Text>
          </View>
        </View>

        {/* Tabs Studio (8) — scroll horizontal em mobile, com fade-edges (Fase 2) */}
        <View style={s.tabsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ flexDirection: "row", gap: 6, paddingRight: 20 }}
          >
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={[s.tabBtn, active && s.tabBtnActive]}
                >
                  <Icon name={t.icon as any} size={13} color={active ? "#fff" : StudioColors.ink3} />
                  <Text style={[s.tabBtnTxt, active && s.tabBtnTxtActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {/* Fade-edges: só renderiza em mobile (IS_WIDE === false em < ~1024px).
              bg sólido = StudioColors.bg (#E8E9F0). pointerEvents none não interfere
              em taps/scroll. Top:0 cobre toda altura das tabs (~ 38–40px). */}
          {!IS_WIDE && (
            <>
              <LinearGradient
                colors={["rgba(232,233,240,1)", "rgba(232,233,240,0)"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={s.fadeLeft}
                pointerEvents="none"
              />
              <LinearGradient
                colors={["rgba(232,233,240,0)", "rgba(232,233,240,1)"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={s.fadeRight}
                pointerEvents="none"
              />
            </>
          )}
        </View>

        {/* Conteúdo da tab ativa */}
        {tab === "site" && (
          isLoading ? <ListSkeleton rows={4} /> : (
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
          )
        )}

        {tab === "design" && (
          isLoading ? <ListSkeleton rows={4} /> : (
            <TabDesign
              config={config}
              saveConfig={saveConfig}
              isSaving={isSaving}
              uploadImage={uploadImage}
              isUploadingImage={isUploadingImage}
              deleteImage={deleteImage}
            />
          )
        )}

        {tab === "configurator"  && <TabStudioConfigurador />}
        {tab === "gallery"       && <TabStudioGaleria />}
        {tab === "revisions"     && <TabStudioRevisoes />}
        {tab === "marketplaces"  && <TabStudioMarketplaces />}

        {tab === "delivery" && (
          isLoading ? <ListSkeleton rows={4} /> : (
            <TabEntrega
              config={config}
              saveConfig={saveConfig}
              isSaving={isSaving}
            />
          )
        )}

        {tab === "orders" && <TabStudioPedidos />}
      </ScrollView>
    </AccentTheme>
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

  viewSiteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: StudioColors.primaryGhost,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: StudioColors.primaryBorder,
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
    borderColor: StudioColors.primaryBorder,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: StudioColors.primaryBorder,
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
    // backgroundColor agora vem inline (success | ink4 conforme is_published)
    borderRadius: 999,
    flexShrink: 0,
  },
  heroPillTxt: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  tabsWrap: {
    position: "relative",
    marginBottom: 18,
  },
  fadeLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 24,
    zIndex: 2,
  },
  fadeRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
    zIndex: 2,
  },

  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: StudioColors.paperCard,
    borderWidth: 1,
    borderColor: StudioColors.ink5,
  },
  tabBtnActive: {
    backgroundColor: StudioColors.primary,
    borderColor: StudioColors.primary,
  },
  tabBtnTxt: {
    fontSize: 12.5,
    fontWeight: "700",
    color: StudioColors.ink2,
  },
  tabBtnTxtActive: {
    color: "#fff",
  },
});
