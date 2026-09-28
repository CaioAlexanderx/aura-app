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
// 25/09/2026 (Fase 1C da vitrine, Tela 7 do mockup studio-vitrine-01):
//   · "Pedidos pela loja" — aba própria (decisão do PO) entre Entrega e
//     Pedidos: fechar/abrir a loja para pedidos com recado e data limite,
//     retirada por app e os IDs de GA4/Pixel. É ABA, não tela: como as
//     outras abas, não tem `mod` próprio — o módulo é o da Loja Digital.
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
//
// 27/09/2026 — QA do painel (Loja Digital):
//   · Troca de aba com PUSH: o voltar do navegador volta para a aba
//     anterior. Com replace, ele saía da Loja Digital.
//   · Aba com formulário avisa `onAlteracoes`; com alteração não salva, a
//     tela pergunta antes de trocar ("Ficar" / "Sair sem salvar").
//   · As abas do canal (Meu Site, Design, Entrega) seguem o tema do Studio
//     pela PaletaDoCanal — antes vinham com o tema do painel Negócio.
//   · Aba ativa em navy com texto branco nos dois temas; alvos de 44 px
//     no celular.
// ============================================================
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Platform, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StudioGradient } from "@/components/studio/StudioGradient";
import { StudioColors, StudioGradients, type StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens, useStudioTheme } from "@/contexts/StudioThemeMode";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { AccentTheme, studioAccent, type AccentTokens } from "@/contexts/AccentTheme";
import { PaletaDoCanal, paletaDoStudio } from "@/components/screens/canal/paletaDoCanal";
import {
  abaDaUrl, trocaDeAba, PERGUNTA_ALTERACOES, type AbaDaLojaDigital,
} from "@/components/screens/studio-loja-digital/abasDaLojaDigital";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { useAuthStore } from "@/stores/auth";
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
import { TabStudioAparencia } from "@/components/screens/studio-loja-digital/TabStudioAparencia";
import { TabStudioGaleria }      from "@/components/screens/studio-loja-digital/TabStudioGaleria";
import { TabStudioRevisoes }     from "@/components/screens/studio-loja-digital/TabStudioRevisoes";
import { TabStudioMarketplaces } from "@/components/screens/studio-loja-digital/TabStudioMarketplaces";
import { TabStudioPedidos }      from "@/components/screens/studio-loja-digital/TabStudioPedidos";
import { TabStudioPedidosPelaLoja } from "@/components/screens/studio-loja-digital/TabStudioPedidosPelaLoja";

const STOREFRONT_BASE = "https://loja.getaura.com.br";

type TabKey = AbaDaLojaDigital;

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "site",          label: "Meu Site",     icon: "globe" },
  { key: "design",        label: "Design",       icon: "edit" },
  // S7 — como as escolhas da lojista chegam NA VITRINE STUDIO. Fica ao
  // lado de Design de proposito: uma configura, a outra mostra.
  { key: "aparencia",     label: "Aparência",    icon: "eye" },
  { key: "configurator",  label: "Configurador", icon: "settings" },
  { key: "gallery",       label: "Galeria",      icon: "image" },
  { key: "revisions",     label: "Revisões",     icon: "refresh" },
  { key: "marketplaces",  label: "Marketplaces", icon: "external-link" },
  { key: "delivery",      label: "Entrega",      icon: "truck" },
  // Fase 1C — temporada (fechar para pedidos, data limite), retirada por
  // app e medição. Ao lado de Entrega: as duas mudam o que o checkout da
  // vitrine oferece.
  { key: "pedidos_loja",  label: "Pedidos pela loja", icon: "calendar" },
  { key: "orders",        label: "Pedidos",      icon: "shopping-bag" },
];

// Índices APÓS os quais inserimos um separador vertical sutil entre grupos.
// Grupos: [0,1,2]=Site/Design/Aparência · [3,4,5,6]=Configurador/Galeria/Revisões/Marketplaces
//         · [7,8,9]=Entrega/Pedidos pela loja/Pedidos
const TAB_GROUP_DIVIDERS = new Set<number>([2, 6]);

// A aba ativa é navy nos DOIS temas (identidade do painel). No escuro o
// token `primary` vira #3B82F6 — o azul claro não é a cor do Studio.
const NAVY = StudioColors.primary;

// Converte hex (#RRGGBB) do StudioPalette pra rgba com alpha — usado só pro
// fade-edge das tabs, que precisa acompanhar o bg do tema (achado #20:
// antes era rgba(232,233,240,...) fixo, o bg CLARO, e ficava duas barras
// cinza-claras cobrindo as tabs no dark mode).
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function StudioVendasLojaDigital() {
  const t = useStudioTokens();
  const { isDark } = useStudioTheme();
  const { width } = useWindowDimensions();
  const celular = width < 768;
  const s = useMemo(() => buildStyles(t, isDark, celular), [t, isDark, celular]);
  // As abas do canal seguem o tema do Studio: cores neutras pela paleta,
  // e no escuro o accent também vem do tema (o #EFF6FF claro do accent
  // fixo virava uma faixa branca no meio da tela escura).
  const paleta = useMemo(() => paletaDoStudio(t), [t]);
  const accent: AccentTokens = useMemo(() => (isDark
    // AA fix (QA rodada 2, 28/09/2026): t.accent puro em texto pequeno
    // não tem contraste garantido sobre paperCard escuro — t.accentInk é
    // a mesma família já escolhida pra isso (6,1:1).
    ? { primary: t.primary, primaryStrong: t.accentInk, primarySoft: t.primarySoft, border: t.ink5 }
    : studioAccent), [isDark, t]);
  const router = useRouter();
  // QA fix (achado #12): as 8 tabs só existiam em estado local — F5 sempre
  // voltava pra "Meu Site" e não dava pra favoritar/compartilhar link
  // direto pra uma tab específica. Sincroniza com ?tab= na URL.
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTabState] = useState<TabKey>(abaDaUrl(params.tab));

  // Abas com alteração não salva (contrato `onAlteracoes`) e a troca que
  // espera a resposta da lojista.
  const [alteradas, setAlteradas] = useState<Partial<Record<TabKey, boolean>>>({});
  const [pendente, setPendente] = useState<TabKey | null>(null);
  const avisos = useMemo(() => {
    const marcar = (aba: TabKey) => (v: boolean) =>
      setAlteradas((antes) => (!!antes[aba] === v ? antes : { ...antes, [aba]: v }));
    return { site: marcar("site"), delivery: marcar("delivery"), pedidos_loja: marcar("pedidos_loja") };
  }, []);

  // PUSH, não replace: cada aba vira uma entrada no histórico e o voltar
  // do navegador volta para a aba anterior (QA 26/09). O expo-router monta
  // a tela de novo com o ?tab= novo; a config vem do cache do react-query.
  const irPara = useCallback((next: TabKey) => {
    setPendente(null);
    setAlteradas({});
    setTabState(next);
    router.push({ pathname: "/studio/vendas/loja-digital", params: { tab: next } } as any);
  }, [router]);

  function setTab(next: TabKey) {
    const acao = trocaDeAba({ atual: tab, proxima: next, alteradas });
    if (acao === "perguntar") setPendente(next);
    else if (acao === "ir") irPara(next);
  }

  // Se o ?tab= mudar nesta mesma tela (link de suporte), acompanha — sem
  // passar por cima de uma edição pela metade.
  useEffect(() => {
    const daUrl = abaDaUrl(params.tab);
    if (typeof params.tab !== "string" || daUrl === tab) return;
    if (alteradas[tab]) setPendente(daUrl);
    else setTabState(daUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tab]);

  // Recarregar ou fechar a página com alteração não salva: o navegador
  // pergunta (web).
  const temAlteracao = Object.values(alteradas).some(Boolean);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !temAlteracao) return;
    const segurar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", segurar);
    return () => window.removeEventListener("beforeunload", segurar);
  }, [temAlteracao]);

  // No celular as abas rolam de lado: a ativa entra na tela ao abrir.
  const abasRef = useRef<ScrollView | null>(null);
  const {
    config, isLoading,
    saveConfig, isSaving,
    requestDomain, isRequestingDomain,
    uploadImage, isUploadingImage,
    deleteImage,
    setupPix, isSettingUpPix,
  } = useDigitalChannel();
  // A empresa ativa (multi-CNPJ): a config da loja é dela.
  const company = useAuthStore((st) => st.company);

  const storefrontUrl = config.storefront_url
    || (config.slug ? `${STOREFRONT_BASE}/${config.slug}` : null);

  return (
    <AccentTheme tokens={accent}>
      <PaletaDoCanal paleta={paleta}>
      <StudioScreen variant="grid">
        {/* Header canônico Studio (Fase 3) */}
        <StudioPageHeader
          eyebrow="VENDAS · LOJA DIGITAL"
          title="Sua loja Studio na internet"
          subtitle="Configure tudo da sua loja: peças personalizáveis, artes prontas, política de revisões, marketplaces e pedidos num só lugar."
          rightSlot={config.is_published && storefrontUrl ? (
            <Pressable onPress={() => Linking.openURL(storefrontUrl)} style={s.viewSiteBtn} accessibilityRole="link">
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
            <Text style={s.heroTitle}>Loja Digital pronta para personalizados</Text>
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
            ref={abasRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 20 }}
          >
            {TABS.map((tDef, idx) => {
              const active = tDef.key === tab;
              return (
                <View
                  key={tDef.key}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  onLayout={active ? (e) => {
                    const x = e.nativeEvent.layout.x;
                    abasRef.current?.scrollTo({ x: Math.max(0, x - 24), animated: false });
                  } : undefined}
                >
                  <Pressable
                    onPress={() => setTab(tDef.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    aria-selected={active}
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
                colors={[hexToRgba(t.bg, 1), hexToRgba(t.bg, 0)]}
                direction="to right"
                style={s.fadeLeft}
                pointerEvents="none"
              />
              <StudioGradient
                colors={[hexToRgba(t.bg, 0), hexToRgba(t.bg, 1)]}
                direction="to right"
                style={s.fadeRight}
                pointerEvents="none"
              />
            </>
          )}
        </View>

        {/* Troca de aba com alteração não salva: pergunta na tela, logo
            abaixo das abas, onde ela acabou de clicar. */}
        {pendente ? (
          <View style={s.confirma} accessibilityRole="alert" testID="confirmar-troca-de-aba">
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", flex: 1, minWidth: 220 }}>
              <Icon name="alert" size={16} color={t.warningInk} />
              <Text style={s.confirmaTxt}>{PERGUNTA_ALTERACOES}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setPendente(null)} accessibilityRole="button" style={s.confirmaFicar}>
                <Text style={s.confirmaFicarTxt}>Ficar</Text>
              </Pressable>
              <Pressable onPress={() => irPara(pendente)} accessibilityRole="button" style={s.confirmaSair}>
                <Text style={s.confirmaSairTxt}>Sair sem salvar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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
              onAlteracoes={avisos.site}
            />
          )
        )}

        {tab === "design" && (
          isLoading ? <ListSkeleton rows={4} /> : (
            <TabDesign
              vitrine="studio"
              config={config}
              saveConfig={saveConfig}
              isSaving={isSaving}
              uploadImage={uploadImage}
              isUploadingImage={isUploadingImage}
              deleteImage={deleteImage}
            />
          )
        )}

        {tab === "aparencia" && (
          isLoading ? <ListSkeleton rows={3} /> : (
            <TabStudioAparencia config={config} onIrPara={(a) => setTab(a as TabKey)} />
          )
        )}

        {tab === "configurator"  && <TabStudioConfigurador />}
        {tab === "gallery"       && <TabStudioGaleria />}
        {tab === "revisions"     && <TabStudioRevisoes />}
        {tab === "marketplaces"  && <TabStudioMarketplaces />}

        {tab === "delivery" && (
          isLoading ? <ListSkeleton rows={4} /> : (
            <TabEntrega
              vitrine="studio"
              config={config}
              saveConfig={saveConfig}
              isSaving={isSaving}
              onAlteracoes={avisos.delivery}
            />
          )
        )}

        {tab === "pedidos_loja" && (
          isLoading ? <ListSkeleton rows={4} /> : (
            // key = empresa ativa: trocar de CNPJ recomeça o formulário do
            // zero, em vez de carregar a edição de uma loja para a outra.
            <TabStudioPedidosPelaLoja
              key={company?.id || "sem-empresa"}
              config={config}
              saveConfig={saveConfig}
              isSaving={isSaving}
              onAlteracoes={avisos.pedidos_loja}
            />
          )
        )}

        {tab === "orders" && <TabStudioPedidos />}
      </StudioScreen>
      </PaletaDoCanal>
    </AccentTheme>
  );
}

const buildStyles = (t: StudioPalette, isDark: boolean, celular: boolean) => StyleSheet.create({
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
    // Alvo de toque de 44 px no celular.
    minHeight: celular ? 44 : undefined,
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
    // Alvo de 44 px sempre (achado do QA, 28/09/2026: 36 px no Chrome
    // desktop) — não só no celular, que é quando `celular` fica true.
    minHeight: 44,
  },
  tabBtnActive: {
    // Navy nos dois temas, texto branco (12:1). No escuro o navy encosta
    // no fundo #0F172A: a borda no azul do tema desenha o contorno.
    backgroundColor: NAVY,
    borderColor: isDark ? t.primary : NAVY,
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

  // Confirmação de troca de aba com alteração não salva.
  confirma: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    backgroundColor: t.warningSoft,
    borderWidth: 1,
    borderColor: t.warning,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  confirmaTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: t.warningInk, lineHeight: 18 },
  confirmaFicar: {
    minHeight: 44, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: NAVY, alignItems: "center", justifyContent: "center",
  },
  confirmaFicarTxt: { fontSize: 13, fontWeight: "700", color: "#fff" },
  confirmaSair: {
    minHeight: 44, paddingHorizontal: 16, borderRadius: 10,
    borderWidth: 1, borderColor: t.ink4, backgroundColor: t.paperCard,
    alignItems: "center", justifyContent: "center",
  },
  confirmaSairTxt: { fontSize: 13, fontWeight: "700", color: t.ink },

  // Divisor vertical sutil entre grupos de tabs (Site/Design | Studio core | Entrega/Pedidos)
  tabGroupDivider: {
    width: 1,
    height: 20,
    backgroundColor: t.ink5,
    marginHorizontal: 4,
    opacity: 0.7,
  },
});
