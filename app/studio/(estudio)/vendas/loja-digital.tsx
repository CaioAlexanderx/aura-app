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
//
// 26/05/2026 — Residual tema Studio:
//   · Migração pra useStudioTokens() (dark mode aware via Platform context)
//     com buildStyles(t) lazy via useMemo.
//   · Hero ganha gradient navy→magenta (StudioGradients.brand) no lugar
//     do primaryGhost antigo — presença Studio reforçada.
//   · Tab ativa ganha sombra navy sutil (boxShadow web / elevation native).
//   · Separadores verticais sutis (t.ink5) entre os 3 grupos semânticos de
//     tabs: [Site/Design] | [Configurador/Galeria/Revisões/Marketplaces] |
//     [Entrega/Pedidos] — ajudam scan visual sem poluir.
//   · View Site Button: primaryGhost → primarySoft (mais cor, mais Studio).
//
// 26/05/2026 — Fix Cloudflare build:
//   · expo-linear-gradient NÃO está no package.json (build CF Workers quebrou).
//   · Substituído por <StudioGradient> (zero-deps): CSS linear-gradient no web,
//     cor sólida central no native. Props start/end removidas (usa "direction"
//     CSS-style: "to bottom right", "to right", "135deg", etc).
// ============================================================
import { useState, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Platform } from "react-native";
import { StudioGradient } from "@/components/studio/StudioGradient";
import { StudioColors, StudioGradients, type StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
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

// Índices APÓS os quais inserimos um separador vertical sutil entre grupos.
// Grupos: [0,1]=Site/Design · [2,3,4,5]=Configurador/Galeria/Revisões/Marketplaces
//         · [6,7]=Entrega/Pedidos
const TAB_GROUP_DIVIDERS = new Set<number>([1, 5]);

export default function StudioVendasLojaDigital() {
  const [tab, setTab] = useState<TabKey>("site");
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);
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
              <Icon name="globe" size={13} color={t.primary} />
              <Text style={s.viewSiteBtnTxt}>Ver site</Text>
            </Pressable>
          ) : undefined}
        />

        {/* Hero Studio — gradient navy→magenta (StudioGradients.brand) reforça
            presença do vertical. Texto e ícone passam pra branco/sobre-gradient. */}
        <StudioGradient
          colors={StudioGradients.brand as unknown as string[]}
          direction="to bottom right"
          style={s.hero}
        >
          <View style={s.heroIcon}>
            <Icon name="globe" size={22} color={t.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Loja Digital pronta pra personalizados</Text>
            <Text style={s.heroDesc}>
              Tudo que o cliente precisa: ver produtos, configurar arte com texto/foto/cores, escolher template e fechar pelo Pix ou cartão.
            </Text>
          </View>
          {/* Pill semântico: success quando publicada (ativo positivo), branco
              translúcido quando rascunho (neutro, sobre gradient escuro). */}
          <View
            style={[
              s.heroPill,
              {
                backgroundColor: config.is_published
                  ? t.success
                  : "rgba(255,255,255,0.22)",
              },
            ]}
          >
            <Text style={s.heroPillTxt}>
              {config.is_published ? "PUBLICADA" : "RASCUNHO"}
            </Text>
          </View>
        </StudioGradient>

        {/* Tabs Studio (8) — scroll horizontal em mobile, com fade-edges (Fase 2) */}
        <View style={s.tabsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 20 }}
          >
            {TABS.map((tDef, idx) => {
              const active = tDef.key === tab;
              return (
                <View key={tDef.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Pressable
                    onPress={() => setTab(tDef.key)}
                    style={[s.tabBtn, active && s.tabBtnActive]}
                  >
                    <Icon name={tDef.icon as any} size={13} color={active ? "#fff" : t.ink3} />
                    <Text style={[s.tabBtnTxt, active && s.tabBtnTxtActive]}>{tDef.label}</Text>
                  </Pressable>
                  {/* Separador vertical sutil entre grupos semânticos */}
                  {TAB_GROUP_DIVIDERS.has(idx) && <View style={s.tabGroupDivider} />}
                </View>
              );
            })}
          </ScrollView>
          {/* Fade-edges: só renderiza em mobile (IS_WIDE === false em < ~1024px).
              bg sólido = StudioColors.bg (#E8E9F0). pointerEvents none não interfere
              em taps/scroll. Top:0 cobre toda altura das tabs (~ 38–40px). */}
          {!IS_WIDE && (
            <>
              <StudioGradient
                colors={["rgba(232,233,240,1)", "rgba(232,233,240,0)"]}
                direction="to right"
                style={s.fadeLeft}
                pointerEvents="none"
              />
              <StudioGradient
                colors={["rgba(232,233,240,0)", "rgba(232,233,240,1)"]}
                direction="to right"
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

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: t.bg },
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
    // primarySoft (mais cor) vs primaryGhost antigo (quase branco)
    backgroundColor: t.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: t.primaryBorder,
  },
  viewSiteBtnTxt: {
    fontSize: 12,
    color: t.primary,
    fontWeight: "700",
  },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    // backgroundColor agora é o gradient navy→magenta (StudioGradients.brand)
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    // borda sutil clara pra "selar" o gradient
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    ...(Platform.OS === "web"
      ? { boxShadow: t.shadowNavy as any }
      : { elevation: 4 }),
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    // Bolha branca opaca pra destacar ícone navy sobre gradient escuro
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    flexShrink: 0,
  },
  heroTitle: {
    fontSize: 15,
    // Texto branco sobre gradient navy→magenta
    color: "#fff",
    fontWeight: "800",
  },
  heroDesc: {
    fontSize: 12,
    // Branco translúcido pra hierarquia (description menos forte que title)
    color: "rgba(255,255,255,0.88)",
    marginTop: 2,
    lineHeight: 17,
  },
  heroPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    // backgroundColor agora vem inline (success | rgba branco translúcido)
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
    backgroundColor: t.paperCard,
    borderWidth: 1,
    borderColor: t.ink5,
  },
  tabBtnActive: {
    backgroundColor: t.primary,
    borderColor: t.primary,
    // Sombra navy sutil pra dar presença ao estado ativo
    ...(Platform.OS === "web"
      ? { boxShadow: t.shadowNavy as any }
      : { elevation: 4 }),
  },
  tabBtnTxt: {
    fontSize: 12.5,
    fontWeight: "700",
    color: t.ink2,
  },
  tabBtnTxtActive: {
    color: "#fff",
  },

  // Divisor vertical sutil entre grupos de tabs (Site/Design | Studio core | Entrega/Pedidos)
  tabGroupDivider: {
    width: 1,
    height: 20,
    backgroundColor: t.ink5,
    marginHorizontal: 4,
    opacity: 0.7,
  },
});
