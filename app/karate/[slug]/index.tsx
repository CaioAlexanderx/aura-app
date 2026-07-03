// ============================================================
// Hub do Portal Público FPKT — Redesign
// Rota: /karate/[slug]
//
// Layout: sidebar colapsável (desktop) + área de conteúdo principal.
// Fundo Shoji (papel de arroz + lavagem de chá). Hero com logo FPKT.
// Grade de cards: Inscrições, Carteirinha/Consulta, Ranking, Anuidade (cadeado).
// Carrossel de banners (placement=hub, aspect-ratio respeitado).
// Footer "Desenvolvido por Aura Karatê" linkando getaura.com.br/dojo.
// Ícones via wrapper components/Icon.tsx (nunca @expo/vector-icons).
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ViewStyle, TextStyle, Platform, Linking, Dimensions, Animated, Easing,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { KarateColors, KarateFonts, KarateRadius, ShojiPalette } from "@/constants/karateTheme";
import { FpktLogo } from "@/components/karate/FpktLogo";
import { ShojiBackground } from "@/components/karate/shoji";
import { BannerCarousel } from "@/components/karate/portal/BannerCarousel";
import { karateCompetitionsApi } from "@/services/karateCompetitionsApi";
import { karatePortalApi, OpenEvent } from "@/services/karatePortalApi";
import { toast } from "@/components/Toast";
import { formatEventDateShort } from "@/utils/eventDate";

const C = KarateColors;
const F = KarateFonts;
const R = KarateRadius;
const P = ShojiPalette;

// ─── Navegação da sidebar ─────────────────────────────────────
type NavItem = {
  key: string;
  label: string;
  icon: string;
  action: "card_inscricoes" | "card_consulta" | "card_ranking" | "card_anuidade" | "external";
};

const NAV_ITEMS: NavItem[] = [
  { key: "home",       label: "Início",            icon: "shield",    action: "card_inscricoes" },
  { key: "inscricoes", label: "Inscrições",         icon: "calendar",  action: "card_inscricoes" },
  { key: "consulta",   label: "Buscar praticante",  icon: "search",    action: "card_consulta"   },
  { key: "ranking",    label: "Ranking",            icon: "trophy",    action: "card_ranking"    },
  { key: "anuidade",   label: "Anuidade",           icon: "wallet",    action: "card_anuidade"   },
];

// ─── Cards do hub ─────────────────────────────────────────────
type CardDef = {
  key: string;
  title: string;
  desc: string;
  icon: string;
  cta: string;
  locked?: boolean;
};

const HUB_CARDS: CardDef[] = [
  {
    key: "inscricoes",
    title: "Inscrições",
    desc: "Inscreva-se em eventos e campeonatos da federação.",
    icon: "calendar",
    cta: "Acessar",
  },
  {
    key: "consulta",
    title: "Carteirinha",
    desc: "Consulte e valide a carteirinha digital pelo número FPKT, CPF ou e-mail.",
    icon: "qr_code",
    cta: "Verificar",
  },
  {
    key: "ranking",
    title: "Ranking",
    desc: "Pontuação acumulada por temporada e categoria.",
    icon: "trophy",
    cta: "Ver ranking",
  },
  {
    key: "anuidade",
    title: "Anuidade do dojô",
    desc: "Situação financeira e praticantes do seu dojô — acesse pelo link exclusivo enviado pela federação.",
    icon: "wallet",
    cta: "Pelo seu link privado",
    locked: true,
  },
];

// ─── Sidebar ─────────────────────────────────────────────────
function Sidebar({
  collapsed,
  onToggle,
  activeKey,
  onNav,
  fedName,
}: {
  collapsed: boolean;
  onToggle: () => void;
  activeKey: string;
  onNav: (item: NavItem) => void;
  fedName: string;
}) {
  const w = collapsed ? 72 : 248;
  return (
    <View style={[styles.side, { width: w, minWidth: w }]}>
      {/* Logo + nome */}
      <View style={styles.sideTop}>
        <View style={styles.sideMark}>
          <FpktLogo size={28} />
        </View>
        {!collapsed && (
          <View style={{ flex: 1 }}>
            <Text style={styles.sideName} numberOfLines={1}>
              {fedName || "FPKT"}
            </Text>
            <Text style={styles.sideNameSub}>Portal</Text>
          </View>
        )}
      </View>

      {/* Nav */}
      <View style={styles.sideNav}>
        {NAV_ITEMS.map((item) => {
          const active = item.key === activeKey;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.navItem,
                collapsed && styles.navItemCollapsed,
                active && styles.navItemActive,
              ]}
              onPress={() => onNav(item)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
            >
              <Icon
                name={item.icon}
                size={20}
                color={active ? P.red2 : C.ink2}
              />
              {!collapsed && (
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {item.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Toggle collapse */}
      <View style={styles.sideFoot}>
        <TouchableOpacity
          style={styles.collapseBtn}
          onPress={onToggle}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <Icon
            name={collapsed ? "menu" : "chevron_left"}
            size={16}
            color={C.ink3}
          />
          {!collapsed && (
            <Text style={styles.collapseLbl}>Recolher</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── CascadeIn ──────────────────────────────────────────────
// Entrada em cascata: opacity 0→1 + translateY 8→0, delay incremental
// por índice (~70ms). Usado nos cards do grid (HUB_CARDS) e nos
// EventCard de "Inscrições abertas". useNativeDriver:false (web-safe;
// anima opacity + transform juntos no mesmo driver).
function CascadeIn({ index, style, children }: { index: number; style?: any; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const delay = Math.min(index, 20) * 70;
    const timer = Animated.timing(anim, {
      toValue: 1,
      duration: 360,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    timer.start();
    return () => { timer.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// ─── HubCard ────────────────────────────────────────────────
function HubCard({
  card,
  onPress,
}: {
  card: CardDef;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, card.locked && styles.cardLocked]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={card.title}
    >
      {card.locked && (
        <View style={styles.cardPrivTag}>
          <Icon name="lock" size={11} color={C.ink3} />
          <Text style={styles.cardPrivText}>Privado</Text>
        </View>
      )}
      <View style={[styles.cardIco, card.locked && styles.cardIcoLocked]}>
        <Icon
          name={card.icon}
          size={22}
          color={card.locked ? C.ink2 : P.red}
        />
      </View>
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.cardDesc}>{card.desc}</Text>
      <View style={styles.cardCta}>
        <Text style={[styles.cardCtaText, card.locked && { color: C.ink3 }]}>
          {card.cta}
        </Text>
        {!card.locked && (
          <Icon name="arrow_right" size={14} color={P.red2} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Eventos abertos (Bloco B) ─────────────────────────────────
function fmtEventDate(iso?: string | null): string {
  return formatEventDateShort(iso, "Data a definir");
}
function fmtEventFee(v?: number | null, fromPrice?: number | null): string {
  const n = v == null ? 0 : Number(v);
  if (n > 0) return `R$ ${n.toFixed(2).replace(".", ",")}`;
  // fee_amount é null/0 (comum em campeonato, onde o preço vive nas
  // categorias) — usa from_price (menor preço positivo dentre evento +
  // categorias, calculado pelo backend) como "a partir de X" em vez de
  // mostrar "R$ 0,00" ou "Gratuito" incorretamente.
  const fp = fromPrice == null ? 0 : Number(fromPrice);
  if (fp > 0) return `a partir de R$ ${fp.toFixed(2).replace(".", ",")}`;
  return "Gratuito";
}

function EventCard({ event, onPress }: { event: OpenEvent; onPress: () => void }) {
  // Track E / P0-0.4 — campeonato usa ícone de troféu pra se diferenciar do
  // exame/curso no mesmo grid de "Inscrições abertas".
  const isCompetition = event.kind === "competition";
  return (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Inscrever-se em ${event.name}`}
    >
      <View style={styles.eventCardIco}>
        <Icon name={isCompetition ? "trophy" : "calendar"} size={20} color={P.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.eventCardTitle} numberOfLines={1}>{event.name}</Text>
        <View style={styles.eventCardMetaRow}>
          <Text style={styles.eventCardMeta}>{fmtEventDate(event.event_date)}</Text>
          {!!event.location && (
            <>
              <Text style={styles.eventCardDot}>•</Text>
              <Text style={styles.eventCardMeta} numberOfLines={1}>{event.location}</Text>
            </>
          )}
          <Text style={styles.eventCardDot}>•</Text>
          <Text style={styles.eventCardMeta}>{fmtEventFee(event.fee_amount, event.from_price)}</Text>
        </View>
      </View>
      <Icon name="arrow_right" size={16} color={P.red2} />
    </TouchableOpacity>
  );
}

// ─── Tela principal ──────────────────────────────────────────
export default function KarateHubScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const fedSlug = String(slug || "fpkt");

  const [fedName, setFedName] = useState("");
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("home");
  // Bloco B — eventos abertos (karate_belt_exams status='open') exibidos
  // como cards no hub; tocar leva direto pra inscrição daquele evento.
  const [openEvents, setOpenEvents] = useState<OpenEvent[]>([]);

  // Ref do ScrollView principal + offset Y da seção de eventos abertos,
  // usados pelo CTA "Inscrições" para rolar até lá (ver scrollToEvents).
  const scrollRef = useRef<ScrollView>(null);
  const eventsSectionY = useRef(0);

  // Carrega nome da federação
  useEffect(() => {
    let alive = true;
    karateCompetitionsApi
      .getPublicSeasons(fedSlug)
      .then((s) => { if (alive && s?.federation?.name) setFedName(s.federation.name); })
      .catch(() => {});
    return () => { alive = false; };
  }, [fedSlug]);

  // Bloco B — carrega eventos abertos para os cards do hub
  useEffect(() => {
    let alive = true;
    karatePortalApi
      .getOpenEvents(fedSlug)
      .then((r) => { if (alive) setOpenEvents(r.events || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [fedSlug]);

  // No mobile, sidebar começa colapsada
  useEffect(() => {
    const w = Dimensions.get("window").width;
    if (w < 700) setSideCollapsed(true);
  }, []);

  // CTA "Inscrições" (card do grid + item de sidebar): não existe rota
  // /karate/:slug/inscricao (só /inscricao/:eventId), então em vez de navegar
  // pra uma rota quebrada, rolamos até a seção "Inscrições abertas" já
  // renderizada na página, onde cada evento tem seu próprio link funcional
  // (EventCard -> /karate/:slug/inscricao/:eventId). F6.4: a seção é sempre
  // renderizada (mesmo com 0 eventos, mostrando estado vazio claro), então
  // sempre rolamos até ela — nada de navegar pra rota inexistente nem de
  // ficar em silêncio quando não há eventos abertos.
  const scrollToEvents = () => {
    scrollRef.current?.scrollTo({ y: eventsSectionY.current, animated: true });
  };

  const handleCardPress = (key: string) => {
    switch (key) {
      case "inscricoes":
        scrollToEvents();
        break;
      case "consulta":
        router.push(`/karate/${fedSlug}/consulta` as any);
        break;
      case "ranking":
        router.push(`/karate/${fedSlug}/ranking` as any);
        break;
      case "anuidade":
        // Link privado — nunca deixar o clique morto: feedback claro em vez
        // de no-op silencioso.
        toast.info("Anuidade do dojô: disponível no painel do dojô, pelo link exclusivo enviado pela federação.");
        break;
      default:
        break;
    }
  };

  const handleNav = (item: NavItem) => {
    setActiveNav(item.key);
    switch (item.action) {
      case "card_inscricoes":
        scrollToEvents();
        break;
      case "card_consulta":
        router.push(`/karate/${fedSlug}/consulta` as any);
        break;
      case "card_ranking":
        router.push(`/karate/${fedSlug}/ranking` as any);
        break;
      case "card_anuidade":
        // Link privado — nunca deixar o clique morto: feedback claro em vez
        // de no-op silencioso.
        toast.info("Anuidade do dojô: disponível no painel do dojô, pelo link exclusivo enviado pela federação.");
        break;
      default:
        break;
    }
  };

  const openFooterLink = () => {
    const url = "https://www.getaura.com.br/dojo";
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  // Determina se sidebar deve aparecer (telas >= 700px no web)
  const screenW = Dimensions.get("window").width;
  const showSidebar = Platform.OS === "web" && screenW >= 700;

  return (
    <ShojiBackground style={styles.root}>
      <View style={styles.app}>
        {/* Sidebar — só web, telas largas */}
        {showSidebar && (
          <Sidebar
            collapsed={sideCollapsed}
            onToggle={() => setSideCollapsed((v) => !v)}
            activeKey={activeNav}
            onNav={handleNav}
            fedName={fedName}
          />
        )}

        {/* Conteúdo principal */}
        <View style={styles.main}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Eyebrow */}
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowLine} />
              <Text style={styles.eyebrow}>Portal público</Text>
            </View>

            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.heroLogoWrap}>
                <FpktLogo size={72} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>
                  {fedName || "Federação Paulista de Karatê-Dô Tradicional"}
                </Text>
                <Text style={styles.heroSub}>
                  Inscrições em eventos e campeonatos, consulta de carteirinha, anuidade e ranking — tudo num só lugar.
                </Text>
              </View>
            </View>

            {/* Banners carrossel */}
            <BannerCarousel slug={fedSlug} />

            {/* Bloco B — eventos abertos (cards). F6.4: seção sempre renderizada
                (mesmo com 0 eventos) para que o CTA "Inscrições" tenha destino
                e mostre um estado vazio claro em vez de silêncio. */}
            <View
              style={styles.eventsSection}
              onLayout={(e) => { eventsSectionY.current = e.nativeEvent.layout.y; }}
            >
              <Text style={styles.eventsSectionTitle}>Inscrições abertas</Text>
              {openEvents.length > 0 ? (
                <View style={styles.eventsList}>
                  {openEvents.map((ev, i) => (
                    <CascadeIn key={ev.id} index={i}>
                      <EventCard
                        event={ev}
                        onPress={() => router.push(`/karate/${fedSlug}/inscricao/${ev.id}` as any)}
                      />
                    </CascadeIn>
                  ))}
                </View>
              ) : (
                <View style={styles.eventsEmpty}>
                  <Icon name="calendar" size={22} color={C.ink4} />
                  <Text style={styles.eventsEmptyTitle}>Nenhuma inscrição aberta no momento</Text>
                  <Text style={styles.eventsEmptySub}>
                    Quando a federação abrir inscrições, elas aparecem aqui.
                  </Text>
                </View>
              )}
            </View>

            {/* Divisor kanji */}
            <View style={styles.kanjiDiv}>
              <View style={styles.kanjiLine} />
              <Text style={styles.kanjiChar}>空</Text>
              <View style={styles.kanjiLine} />
            </View>

            {/* Grade de cards */}
            <View style={styles.grid}>
              {HUB_CARDS.map((card, i) => (
                <CascadeIn key={card.key} index={i} style={{ flexBasis: 248, flexGrow: 1 }}>
                  <HubCard
                    card={card}
                    onPress={() => handleCardPress(card.key)}
                  />
                </CascadeIn>
              ))}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.foot}>
            <TouchableOpacity
              style={styles.footLink}
              onPress={openFooterLink}
              activeOpacity={0.85}
              accessibilityRole="link"
              accessibilityLabel="Desenvolvido por Aura Karatê — abre em nova aba"
            >
              <Text style={styles.footText}>Desenvolvido por </Text>
              <View style={styles.footSeal}>
                <Text style={styles.footSealK}>空</Text>
              </View>
              <Text style={styles.footWord}>Aura</Text>
              <Text style={[styles.footWord, { color: P.red }]}>.</Text>
              <Text style={styles.footWord}> Karatê</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ShojiBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 } as ViewStyle,
  app: { flex: 1, flexDirection: "row" } as ViewStyle,

  // ── Sidebar ─────────────────────────────────────────────────
  side: {
    backgroundColor: "rgba(252,250,245,0.92)",
    borderRightWidth: 1,
    borderRightColor: P.line,
    flexDirection: "column",
    height: "100%",
    ...(Platform.OS === "web" ? { position: "sticky" as any, top: 0 } : {}),
  } as ViewStyle,
  sideTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: P.line,
    minHeight: 72,
  } as ViewStyle,
  sideMark: {
    width: 36,
    height: 36,
    borderRadius: 9,
    overflow: "hidden",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 2px 8px -3px rgba(43,38,32,.3)" }
      : { shadowColor: "#2b2620", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 5, elevation: 2 }),
  } as ViewStyle,
  sideName: {
    fontFamily: F.heading,
    fontSize: 15,
    fontWeight: "500",
    color: C.ink,
    lineHeight: 18,
  } as TextStyle,
  sideNameSub: {
    fontFamily: F.body,
    fontSize: 9.5,
    fontWeight: "500",
    letterSpacing: 0.18 * 9.5,
    textTransform: "uppercase",
    color: C.ink3,
    marginTop: 2,
  } as TextStyle,
  sideNav: {
    flex: 1,
    padding: 12,
    gap: 3,
  } as ViewStyle,
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 11,
  } as ViewStyle,
  navItemCollapsed: {
    justifyContent: "center",
    paddingHorizontal: 11,
  } as ViewStyle,
  navItemActive: {
    backgroundColor: P.redWash,
  } as ViewStyle,
  navLabel: {
    fontFamily: F.body,
    fontSize: 13.5,
    fontWeight: "500",
    color: C.ink2,
  } as TextStyle,
  navLabelActive: {
    color: P.red2,
  } as TextStyle,
  sideFoot: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: P.line,
  } as ViewStyle,
  collapseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 10,
  } as ViewStyle,
  collapseLbl: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.ink3,
  } as TextStyle,

  // ── Main content ──────────────────────────────────────────────
  main: { flex: 1, flexDirection: "column" } as ViewStyle,
  scroll: { flex: 1 } as ViewStyle,
  scrollContent: {
    padding: 40,
    paddingTop: 46,
    paddingBottom: 30,
    maxWidth: 1040,
    width: "100%",
    alignSelf: "center",
    gap: 0,
  } as ViewStyle,

  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 16,
  } as ViewStyle,
  eyebrowLine: { width: 18, height: 1.5, backgroundColor: P.red } as ViewStyle,
  eyebrow: {
    fontSize: 11,
    letterSpacing: 0.2 * 11,
    textTransform: "uppercase",
    color: P.red,
    fontFamily: F.body,
    fontWeight: "500",
  } as TextStyle,

  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginBottom: 8,
    flexWrap: "wrap",
  } as ViewStyle,
  heroLogoWrap: {
    width: 78,
    height: 78,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 1px 2px rgba(43,38,32,.05), 0 16px 40px -22px rgba(43,38,32,.4)" }
      : { shadowColor: "#2b2620", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 22, elevation: 5 }),
  } as ViewStyle,
  heroTitle: {
    fontFamily: F.heading,
    fontSize: 30,
    fontWeight: "400",
    letterSpacing: 0.2,
    color: C.ink,
    lineHeight: 34,
  } as TextStyle,
  heroSub: {
    fontFamily: F.body,
    fontSize: 14,
    color: C.ink2,
    marginTop: 10,
    maxWidth: 560,
    lineHeight: 14 * 1.6,
  } as TextStyle,

  // ── Bloco B — eventos abertos ──────────────────────────────
  eventsSection: {
    marginTop: 24,
    gap: 10,
  } as ViewStyle,
  eventsSectionTitle: {
    fontFamily: F.heading,
    fontSize: 15,
    fontWeight: "500",
    color: C.ink,
  } as TextStyle,
  eventsList: {
    gap: 8,
  } as ViewStyle,
  eventsEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: "rgba(252,250,245,0.92)",
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 14,
  } as ViewStyle,
  eventsEmptyTitle: {
    fontFamily: F.heading,
    fontSize: 14,
    fontWeight: "500",
    color: C.ink2,
    textAlign: "center",
  } as TextStyle,
  eventsEmptySub: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.ink3,
    textAlign: "center",
    maxWidth: 320,
  } as TextStyle,
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(252,250,245,0.92)",
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 14,
    padding: 14,
    ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
  } as ViewStyle,
  eventCardIco: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.redWash,
    flexShrink: 0,
  } as ViewStyle,
  eventCardTitle: {
    fontFamily: F.heading,
    fontSize: 14,
    fontWeight: "500",
    color: C.ink,
  } as TextStyle,
  eventCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
    flexWrap: "wrap",
  } as ViewStyle,
  eventCardMeta: {
    fontFamily: F.body,
    fontSize: 11.5,
    color: C.ink3,
  } as TextStyle,
  eventCardDot: {
    fontSize: 11.5,
    color: C.ink4,
  } as TextStyle,

  kanjiDiv: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 34,
    marginBottom: 26,
  } as ViewStyle,
  kanjiLine: { flex: 1, height: 1, backgroundColor: P.line } as ViewStyle,
  kanjiChar: {
    fontFamily: F.heading,
    fontSize: 20,
    color: P.red,
    opacity: 0.55,
  } as TextStyle,

  // ── Grid de cards ───────────────────────────────────────────
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  } as ViewStyle,
  card: {
    flexBasis: 248,
    flexGrow: 1,
    minHeight: 158,
    backgroundColor: "rgba(252,250,245,0.92)",
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: 16,
    padding: 22,
    paddingHorizontal: 20,
    gap: 13,
    position: "relative",
    ...(Platform.OS === "web"
      ? { cursor: "pointer" as any }
      : {}),
  } as ViewStyle,
  cardLocked: {
    opacity: 0.88,
  } as ViewStyle,
  cardPrivTag: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  } as ViewStyle,
  cardPrivText: {
    fontFamily: F.body,
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.05 * 10,
    textTransform: "uppercase",
    color: C.ink3,
  } as TextStyle,
  cardIco: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.redWash,
  } as ViewStyle,
  cardIcoLocked: {
    backgroundColor: "rgba(43,38,32,0.06)",
  } as ViewStyle,
  cardTitle: {
    fontFamily: F.heading,
    fontSize: 18,
    fontWeight: "500",
    color: C.ink,
  } as TextStyle,
  cardDesc: {
    fontFamily: F.body,
    fontSize: 12.5,
    color: C.ink2,
    lineHeight: 12.5 * 1.55,
    flex: 1,
  } as TextStyle,
  cardCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  } as ViewStyle,
  cardCtaText: {
    fontFamily: F.body,
    fontSize: 12,
    fontWeight: "500",
    color: P.red2,
  } as TextStyle,

  // ── Footer ──────────────────────────────────────────────────
  foot: {
    borderTopWidth: 1,
    borderTopColor: P.line,
    paddingVertical: 16,
    paddingHorizontal: 52,
    alignItems: "center",
  } as ViewStyle,
  footLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    opacity: 0.85,
  } as ViewStyle,
  footText: {
    fontFamily: F.body,
    fontSize: 12,
    color: C.ink3,
  } as TextStyle,
  footSeal: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: P.red2,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  footSealK: {
    fontFamily: F.heading,
    fontSize: 11,
    color: "#fbeee4",
    lineHeight: 14,
  } as TextStyle,
  footWord: {
    fontFamily: F.heading,
    fontSize: 14,
    fontWeight: "500",
    color: C.ink2,
  } as TextStyle,
});
