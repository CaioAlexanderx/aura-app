import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { Icon } from "@/components/Icon";
import { StudioColors } from "@/constants/studio-tokens";
import { studioApi, MarketplaceConnection, MarketplacePlatform } from "@/services/studioApi";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

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

function healthMeta(h: TokenHealth) {
  if (h === "fresh") return { color: "#10B981", bg: "rgba(16,185,129,0.12)", label: "Token válido" };
  if (h === "expiring") return { color: "#F59E0B", bg: "rgba(245,158,11,0.14)", label: "Token expira em breve" };
  if (h === "expired") return { color: "#EF4444", bg: "rgba(239,68,68,0.14)", label: "Token expirado" };
  return { color: StudioColors.textMuted, bg: "rgba(148,163,184,0.14)", label: "Status desconhecido" };
}

export function TabStudioMarketplaces() {
  const { company } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Record<MarketplacePlatform, MarketplaceConnection | null>>({
    mercado_livre: null,
    shopee: null,
  });
  const [connecting, setConnecting] = useState<MarketplacePlatform | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const r = await studioApi.listMarketplaceConnections(company.id);
      setConnections({
        mercado_livre: r?.by_platform?.mercado_livre ?? null,
        shopee: r?.by_platform?.shopee ?? null,
      });
    } catch (e: any) {
      console.warn("[marketplaces/connections]", e?.message);
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Listener postMessage do popup OAuth
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    function handler(ev: MessageEvent) {
      const data = ev?.data;
      if (!data || data.type !== "aura-marketplace-callback") return;
      setConnecting(null);
      if (data.ok) {
        toast.success(`✓ ${platformLabel(data.platform)} conectado!`);
        load();
      } else {
        toast.error(data.message || "Falha na conexão");
      }
    }
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [load]);

  async function connect(platform: MarketplacePlatform) {
    if (!company?.id) return;
    setConnecting(platform);
    try {
      const r = await studioApi.getMarketplaceAuthUrl(company.id, platform);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const popup = window.open(
          r.auth_url,
          "aura-marketplace-oauth",
          "width=600,height=700,scrollbars=yes"
        );
        if (!popup) {
          setConnecting(null);
          toast.error("Popup bloqueado. Permita pop-ups e tente novamente.");
        }
      } else {
        toast.info("Abra a URL no navegador: " + r.auth_url);
        setConnecting(null);
      }
    } catch (e: any) {
      setConnecting(null);
      const code = e?.code || e?.error_code;
      if (code === "ML_OAUTH_NOT_CONFIGURED" || code === "SHOPEE_OAUTH_NOT_CONFIGURED") {
        toast.error("OAuth ainda não configurado nas variáveis de ambiente. Contate o suporte Aura.");
      } else {
        toast.error(e?.message || "Erro ao gerar URL OAuth");
      }
    }
  }

  async function revoke(platform: MarketplacePlatform) {
    if (!company?.id) return;
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      !window.confirm(`Desconectar ${platformLabel(platform)}?`)
    )
      return;
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
        <ActivityIndicator size="large" color={StudioColors.accent} />
        <Text style={styles.loadingText}>Carregando conexões…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
          const isConnecting = connecting === p.key;
          const health = tokenHealth(conn);
          const hm = healthMeta(health);
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
                    <View style={styles.connectedBadge}>
                      <View style={styles.connectedDot} />
                      <Text style={styles.connectedBadgeText}>Conectado</Text>
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
                      <ActivityIndicator size="small" color="#FFFFFF" />
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
                        <ActivityIndicator size="small" color={StudioColors.accent} />
                      ) : (
                        <>
                          <Icon name="refresh-cw" size={14} color={StudioColors.accent} />
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
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <>
                          <Icon name="x-circle" size={14} color="#EF4444" />
                          <Text style={styles.dangerButtonText}>Desconectar</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.hintCard}>
        <View style={styles.hintIconWrap}>
          <Icon name="info" size={18} color={StudioColors.accent} />
        </View>
        <View style={styles.hintTextWrap}>
          <Text style={styles.hintTitle}>OAuth requer credenciais configuradas</Text>
          <Text style={styles.hintBody}>
            A integração OAuth precisa de credenciais (client_id/client_secret) configuradas nas variáveis de ambiente do Aura.
            Se aparecer erro "OAuth não configurado", contate o suporte para habilitar.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: StudioColors.background,
  },
  content: {
    padding: 24,
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
    color: StudioColors.textMuted,
    fontSize: 14,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: StudioColors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: StudioColors.textMuted,
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
    backgroundColor: StudioColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: StudioColors.border,
    padding: 20,
    gap: 14,
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
    color: StudioColors.textPrimary,
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.12)",
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  connectedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#10B981",
  },
  disconnectedHint: {
    fontSize: 12,
    color: StudioColors.textMuted,
  },
  description: {
    fontSize: 13,
    color: StudioColors.textMuted,
    lineHeight: 19,
  },
  connectedBlock: {
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: StudioColors.surfaceAlt || "rgba(148,163,184,0.06)",
    borderRadius: 10,
  },
  storeInfo: {
    gap: 2,
  },
  storeName: {
    fontSize: 14,
    fontWeight: "600",
    color: StudioColors.textPrimary,
  },
  storeId: {
    fontSize: 11,
    color: StudioColors.textMuted,
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
    backgroundColor: StudioColors.accent,
    shadowColor: StudioColors.accent,
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
    borderColor: StudioColors.accent,
    backgroundColor: StudioColors.primaryGhost || "rgba(236,72,153,0.08)",
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonText: {
    color: StudioColors.accent,
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
    borderColor: "rgba(239,68,68,0.4)",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  dangerButtonPressed: {
    opacity: 0.8,
  },
  dangerButtonText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
  },
  hintCard: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: StudioColors.primaryGhost || "rgba(236,72,153,0.08)",
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
    color: StudioColors.textPrimary,
  },
  hintBody: {
    fontSize: 12,
    color: StudioColors.textMuted,
    lineHeight: 18,
  },
});
