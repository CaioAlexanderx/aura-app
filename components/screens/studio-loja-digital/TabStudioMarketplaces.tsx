import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { studioApi, MarketplaceConnection, MarketplacePlatform } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";
import { confirmAlert } from "@/utils/webAlert";

// Converte um hex (#RRGGBB) do StudioPalette pra rgba com alpha — usado só
// pro véu do overlay de "conectando", que precisa de translúcido sem lavar
// os filhos (opacity na View inteira afetaria o painel dentro dela também).
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex; // já é rgba/outro formato (ex: tokens dark com rgba nativo)
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

type PlatformMeta = {
  key: MarketplacePlatform;
  label: string;
  brand: string;
  logoColor: string;
  logoTextColor: string;
  description: string;
};

const PLATFORMS: PlatformMeta[] = [
  {
    key: "mercado_livre",
    label: "Mercado Livre",
    brand: "ML",
    logoColor: "#FFE600",
    logoTextColor: "#2D3277",
    description:
      "Maior marketplace do Brasil. Configure handling time e suas vendas Studio entram com personalização.",
  },
  {
    key: "shopee",
    label: "Shopee",
    brand: "S",
    logoColor: "#EE4D2D",
    logoTextColor: "#FFFFFF",
    description:
      "Crescente em personalizados. Coleta de personalização via chat após pedido.",
  },
];

function platformLabel(p: MarketplacePlatform): string {
  return p === "mercado_livre" ? "Mercado Livre" : "Shopee";
}

type TokenHealth = "fresh" | "expiring" | "expired" | "unknown";

function tokenHealth(conn: MarketplaceConnection | null): TokenHealth {
  if (!conn) return "unknown";
  const exp = (conn as any).expires_at || (conn as any).token_expires_at;
  if (!exp) return "unknown";
  const expMs = new Date(exp).getTime();
  if (Number.isNaN(expMs)) return "unknown";
  const now = Date.now();
  if (expMs <= now) return "expired";
  const hoursLeft = (expMs - now) / 3_600_000;
  if (hoursLeft < 24) return "expiring";
  return "fresh";
}

// QA fix (achado #20): cores de status vinham hardcoded (#10B981 etc),
// quebrando o dark mode. Usa os tokens semânticos do StudioPalette.
function healthMeta(h: TokenHealth, t: StudioPalette) {
  if (h === "fresh") return { color: t.successInk, bg: t.successSoft, label: "Token válido" };
  if (h === "expiring") return { color: t.warningInk, bg: t.warningSoft, label: "Token expira em breve" };
  if (h === "expired") return { color: t.dangerInk, bg: t.dangerSoft, label: "Token expirado" };
  return { color: t.ink3, bg: t.bgSoft, label: "Status desconhecido" };
}

export function TabStudioMarketplaces() {
  const t = useStudioTokens();
  const styles = useMemo(() => buildStyles(t), [t]);
  const router = useRouter();
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Record<MarketplacePlatform, MarketplaceConnection | null>>({
    mercado_livre: null,
    shopee: null,
  });
  const [connectingPlatform, setConnectingPlatform] = useState<MarketplacePlatform | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  // QA fix (achado #6): erro do GET era engolido em console.warn — a tela
  // mostrava "Não conectado" como se fosse verdade, e o lojista refazia o
  // OAuth à toa achando que tinha desconectado. Agora guarda o erro e
  // mostra um estado de retry em vez de fingir que carregou.
  const [loadError, setLoadError] = useState<string | null>(null);
  // QA fix (achado #18): sem company.id o loading ficava true pra sempre.
  const [blocked, setBlocked] = useState(false);

  // refs pra controle do popup OAuth
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!company?.id) { setLoading(false); setBlocked(true); return; }
    setBlocked(false);
    setLoading(true);
    setLoadError(null);
    try {
      const r = await studioApi.listMarketplaceConnections(company.id);
      setConnections({
        mercado_livre: r?.by_platform?.mercado_livre ?? null,
        shopee: r?.by_platform?.shopee ?? null,
      });
    } catch (e: any) {
      setLoadError(e?.message || "Erro ao carregar conexões");
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // limpa watchers do popup
  const clearPopupWatchers = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      clearPopupWatchers();
    };
  }, [clearPopupWatchers]);

  // Listener postMessage do popup OAuth
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    function handler(ev: MessageEvent) {
      const data = ev?.data;
      if (!data || data.type !== "aura-marketplace-callback") return;
      clearPopupWatchers();
      setConnectingPlatform(null);
      if (data.ok) {
        toast.success(`✓ ${platformLabel(data.platform)} conectado!`);
        load();
      } else {
        toast.error(data.message || "Falha na conexão");
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [load, clearPopupWatchers]);

  function cancelConnecting() {
    clearPopupWatchers();
    try {
      popupRef.current?.close();
    } catch {}
    popupRef.current = null;
    setConnectingPlatform(null);
  }

  async function connect(platform: MarketplacePlatform) {
    if (!company?.id) return;
    // Se já tem outra conexão em andamento, encerra a anterior
    clearPopupWatchers();
    setConnectingPlatform(platform);
    try {
      const r = await studioApi.getMarketplaceAuthUrl(company.id, platform);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const popup = window.open(
          r.auth_url,
          "aura-marketplace-oauth",
          "width=600,height=700,scrollbars=yes"
        );
        if (!popup) {
          setConnectingPlatform(null);
          toast.error("Popup bloqueado. Permita pop-ups e tente novamente.");
          return;
        }
        popupRef.current = popup;

        // Poll se o popup foi fechado pelo usuário
        pollRef.current = setInterval(() => {
          try {
            if (popup.closed) {
              clearPopupWatchers();
              setConnectingPlatform((cur) => (cur === platform ? null : cur));
              // refetch — pode ter conectado e fechado antes do postMessage
              load();
            }
          } catch {
            // cross-origin durante fluxo OAuth é esperado; ignora
          }
        }, 500);

        // Timeout defensivo 5min
        timeoutRef.current = setTimeout(() => {
          clearPopupWatchers();
          try {
            popup.close();
          } catch {}
          setConnectingPlatform((cur) => (cur === platform ? null : cur));
          toast.error("Tempo esgotado aguardando autorização. Tente novamente.");
        }, 5 * 60 * 1000);
      } else {
        // QA fix (achado #8): antes mostrava um toast com a URL longa
        // sem link clicável — inutilizável no app nativo. Abre direto.
        setConnectingPlatform(null);
        Linking.openURL(r.auth_url).catch(() => {
          toast.error("Não consegui abrir o navegador. Tente novamente.");
        });
      }
    } catch (e: any) {
      clearPopupWatchers();
      setConnectingPlatform(null);
      const code = e?.code || e?.error_code;
      if (code === "ML_OAUTH_NOT_CONFIGURED" || code === "SHOPEE_OAUTH_NOT_CONFIGURED") {
        toast.error("OAuth ainda não configurado nas variáveis de ambiente. Contate o suporte Aura.");
      } else {
        toast.error(e?.message || "Erro ao gerar URL OAuth");
      }
    }
  }

  // QA fix (achado #7): a confirmação usava window.confirm direto, que só
  // existe no web — no native a revogação acontecia no primeiro toque sem
  // nenhuma confirmação. confirmAlert funciona nos dois.
  function revoke(platform: MarketplacePlatform) {
    if (!company?.id) return;
    confirmAlert(
      `Desconectar ${platformLabel(platform)}?`,
      "Os anúncios publicados continuam no ar, mas você vai precisar reconectar pra sincronizar pedidos e estoque de novo.",
      "Desconectar",
      () => doRevoke(platform),
      { destructive: true }
    );
  }

  async function doRevoke(platform: MarketplacePlatform) {
    if (!company?.id) return;
    setBusyAction(`revoke:${platform}`);
    try {
      await studioApi.revokeMarketplaceConnection(company.id, platform);
      toast.success("Conexão revogada");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao revogar");
    } finally {
      setBusyAction(null);
    }
  }

  async function refresh(platform: MarketplacePlatform) {
    if (!company?.id) return;
    setBusyAction(`refresh:${platform}`);
    try {
      await studioApi.refreshMarketplaceConnection(company.id, platform);
      toast.success("Token renovado");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao renovar");
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={t.accent} />
        <Text style={styles.loadingText}>Carregando conexões…</Text>
      </View>
    );
  }

  if (blocked) {
    return (
      <View style={styles.loadingWrap}>
        <Icon name="alert-circle" size={28} color={t.ink4} />
        <Text style={styles.loadingText}>Não foi possível identificar sua empresa. Recarregue a página.</Text>
      </View>
    );
  }

  // QA fix (achado #6): antes de esconder o erro atrás de "Não conectado",
  // mostra o problema de verdade e deixa o lojista tentar de novo.
  if (loadError) {
    return (
      <View style={styles.loadingWrap}>
        <Icon name="alert-circle" size={28} color={t.dangerInk} />
        <Text style={styles.loadingText}>{loadError}</Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Icon name="refresh-cw" size={14} color="#fff" />
          <Text style={styles.retryBtnText}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  // Item #9: a tab não monta mais o próprio ScrollView — StudioScreen
  // (usado por loja-digital.tsx) já é quem rola a tela toda.
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Marketplaces conectados</Text>
        <Text style={styles.subtitle}>
          Conecte sua conta ML/Shopee e seus produtos Studio aparecem lá com configurador de personalização.
        </Text>
      </View>

      <View style={styles.cardsGrid}>
        {PLATFORMS.map((p) => {
          const conn = connections[p.key];
          const isConnected = !!conn;
          const isConnecting = connectingPlatform === p.key;
          const health = tokenHealth(conn);
          const hm = healthMeta(health, t);
          const storeName = (conn as any)?.store_name || (conn as any)?.shop_name || (conn as any)?.account_name;
          const storeId = (conn as any)?.store_id || (conn as any)?.shop_id || (conn as any)?.external_id;

          return (
            <View key={p.key} style={styles.platformCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.logoBox, { backgroundColor: p.logoColor }]}>
                  <Text style={[styles.logoText, { color: p.logoTextColor }]}>{p.brand}</Text>
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.platformName}>{p.label}</Text>
                  {isConnected ? (
                    <View style={[styles.connectedBadge, { backgroundColor: t.successSoft }]}>
                      <View style={[styles.connectedDot, { backgroundColor: t.successInk }]} />
                      <Text style={[styles.connectedBadgeText, { color: t.successInk }]}>Conectado</Text>
                    </View>
                  ) : (
                    <Text style={styles.disconnectedHint}>Não conectado</Text>
                  )}
                </View>
              </View>

              <Text style={styles.description}>{p.description}</Text>

              {isConnected && (
                <View style={styles.connectedBlock}>
                  {(storeName || storeId) && (
                    <View style={styles.storeInfo}>
                      {storeName && <Text style={styles.storeName}>{storeName}</Text>}
                      {storeId && <Text style={styles.storeId}>ID: {storeId}</Text>}
                    </View>
                  )}
                  <View style={[styles.healthPill, { backgroundColor: hm.bg }]}>
                    <View style={[styles.healthDot, { backgroundColor: hm.color }]} />
                    <Text style={[styles.healthText, { color: hm.color }]}>{hm.label}</Text>
                  </View>
                  {/* QA fix (achado #13): não havia link entre a conexão OAuth
                      e a tela de configuração de prazo/preview do anúncio. */}
                  <Pressable
                    onPress={() => router.push("/studio/configuracoes/marketplace" as any)}
                    style={styles.configLink}
                  >
                    <Text style={styles.configLinkText}>Configurar anúncios</Text>
                    <Icon name="arrow-right" size={12} color={t.primary} />
                  </Pressable>
                </View>
              )}

              <View style={styles.actions}>
                {!isConnected ? (
                  <Pressable
                    onPress={() => connect(p.key)}
                    disabled={isConnecting}
                    style={({ pressed }) => [
                      styles.connectButton,
                      pressed && styles.connectButtonPressed,
                      isConnecting && styles.connectButtonDisabled,
                    ]}
                  >
                    {isConnecting ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.connectButtonText}>Aguardando autorização…</Text>
                      </>
                    ) : (
                      <>
                        <Icon name="link" size={18} color="#FFFFFF" />
                        <Text style={styles.connectButtonText}>Conectar {p.label}</Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <View style={styles.connectedActions}>
                    <Pressable
                      onPress={() => refresh(p.key)}
                      disabled={busyAction === `refresh:${p.key}`}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.secondaryButtonPressed,
                      ]}
                    >
                      {busyAction === `refresh:${p.key}` ? (
                        <ActivityIndicator size="small" color={t.accent} />
                      ) : (
                        <>
                          <Icon name="refresh-cw" size={14} color={t.accent} />
                          <Text style={styles.secondaryButtonText}>Renovar token</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => revoke(p.key)}
                      disabled={busyAction === `revoke:${p.key}`}
                      style={({ pressed }) => [
                        styles.dangerButton,
                        pressed && styles.dangerButtonPressed,
                      ]}
                    >
                      {busyAction === `revoke:${p.key}` ? (
                        <ActivityIndicator size="small" color={t.dangerInk} />
                      ) : (
                        <>
                          <Icon name="x-circle" size={14} color={t.dangerInk} />
                          <Text style={styles.dangerButtonText}>Desconectar</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>

              {isConnecting && (
                <View pointerEvents="box-none" style={styles.connectingOverlay}>
                  <View style={styles.connectingPanel}>
                    <ActivityIndicator size="small" color={t.accent} />
                    <Text style={styles.connectingTitle}>
                      Conclua a autorização no popup que abriu
                    </Text>
                    <Text style={styles.connectingSub}>
                      Se fechou sem querer, clique novamente.
                    </Text>
                    <Pressable
                      onPress={cancelConnecting}
                      style={({ pressed }) => [
                        styles.cancelButton,
                        pressed && styles.cancelButtonPressed,
                      ]}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.hintCard}>
        <View style={styles.hintIconWrap}>
          <Icon name="info" size={18} color={t.accent} />
        </View>
        <View style={styles.hintTextWrap}>
          <Text style={styles.hintTitle}>OAuth requer credenciais configuradas</Text>
          <Text style={styles.hintBody}>
            A integração OAuth precisa de credenciais (client_id/client_secret) configuradas nas variáveis de ambiente do Aura.
            Se aparecer erro "OAuth não configurado", contate o suporte para habilitar.
          </Text>
        </View>
      </View>
    </View>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 48,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 12,
  },
  loadingText: {
    color: t.ink3,
    fontSize: 14,
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: t.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginTop: 4,
  },
  retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  configLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  configLinkText: { fontSize: 12, color: t.primary, fontWeight: "700" },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: t.ink,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: t.ink3,
    lineHeight: 20,
    maxWidth: 640,
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  platformCard: {
    flexGrow: 1,
    flexBasis: 360,
    minHeight: 220,
    backgroundColor: t.paperCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.ink5,
    padding: 20,
    gap: 14,
    position: "relative",
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  cardHeaderText: {
    flex: 1,
    gap: 4,
  },
  platformName: {
    fontSize: 18,
    fontWeight: "700",
    color: t.ink,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    // backgroundColor vem inline (t.successSoft) — QA fix achado #20
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    // backgroundColor vem inline (t.successInk) — QA fix achado #20
  },
  connectedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    // color vem inline (t.successInk) — QA fix achado #20
  },
  disconnectedHint: {
    fontSize: 12,
    color: t.ink3,
  },
  description: {
    fontSize: 13,
    color: t.ink3,
    lineHeight: 19,
  },
  connectedBlock: {
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: t.bgSoft || "rgba(148,163,184,0.06)",
    borderRadius: 10,
  },
  storeInfo: {
    gap: 2,
  },
  storeName: {
    fontSize: 14,
    fontWeight: "600",
    color: t.ink,
  },
  storeId: {
    fontSize: 11,
    color: t.ink3,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  healthPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  healthText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actions: {
    marginTop: "auto",
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: t.accent,
    shadowColor: t.accent,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  connectButtonPressed: {
    opacity: 0.88,
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  connectedActions: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.accent,
    backgroundColor: t.primaryGhost || "rgba(236,72,153,0.08)",
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonText: {
    color: t.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  dangerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.dangerInk,
    backgroundColor: t.dangerSoft,
  },
  dangerButtonPressed: {
    opacity: 0.8,
  },
  dangerButtonText: {
    color: t.dangerInk,
    fontSize: 12,
    fontWeight: "600",
  },
  // QA fix (achado #20): véu branco fixo (rgba(255,255,255,0.6)) cobria o
  // card mesmo no dark mode. paperCardElev é o token do card "elevado" —
  // convertido pra rgba translúcido fica coerente nos dois temas (opacity
  // na View inteira washa os filhos também, por isso usa alpha no hex).
  connectingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: hexToRgba(t.paperCardElev, 0.88),
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
  },
  connectingPanel: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: t.paperCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.ink5,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    maxWidth: 280,
  },
  connectingTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: t.ink,
    textAlign: "center",
    marginTop: 4,
  },
  connectingSub: {
    fontSize: 11,
    color: t.ink3,
    textAlign: "center",
    lineHeight: 16,
  },
  cancelButton: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.ink5,
    backgroundColor: "rgba(148,163,184,0.08)",
  },
  cancelButtonPressed: {
    opacity: 0.7,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: t.ink,
  },
  hintCard: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: t.primaryGhost || "rgba(236,72,153,0.08)",
    borderWidth: 1,
    borderColor: "rgba(236,72,153,0.18)",
  },
  hintIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,72,153,0.14)",
  },
  hintTextWrap: {
    flex: 1,
    gap: 4,
  },
  hintTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: t.ink,
  },
  hintBody: {
    fontSize: 12,
    color: t.ink3,
    lineHeight: 18,
  },
});
