import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { FoodTokensV2 } from "@/constants/food-tokens";
import { GradientBrandMark, NavItemV2 } from "@/components/food/foundation";
import { useHubStats } from "@/hooks/useFoodHub";

// ============================================================
// FoodSidebar — Sidebar dedicada do shell Aura Food.
//
// Fase 11 (2026-05-22): refresh visual com Foundation Fase 9.
// - <GradientBrandMark/> em vez do SVG inline 🍽 (logo canônica)
// - Nav items via <NavItemV2/> — active bar lateral + hover violetSoft
// - Footer avatar com linear-gradient(135deg, primary, violet)
// - Light glass surface (FoodTokensV2.surface + line)
//
// Fase 10 (2026-05-22): item "Pedidos" tem badge dinâmico de
// pedidos abertos via useHubStats (polling 30s).
//
// Backward compat: rotas/perms inalteradas — só refresh visual.
// Memory feedback_permissions_todas_telas: chave `mod` por item.
// ============================================================

interface FoodNavItem { route: string; label: string; icon: string; mod: string; badgeKey?: "openOrders"; }
interface FoodNavSection { label: string; items: FoodNavItem[]; }

const FOOD_NAV: FoodNavSection[] = [
  { label: "Salão", items: [
    { route: "/food/(salao)/mesas",    label: "Mesas",    icon: "users",     mod: "food.mesas" },
    { route: "/food/(salao)/pedidos",  label: "Pedidos",  icon: "clipboard", mod: "food.pedidos", badgeKey: "openOrders" },
  ]},
  { label: "Cardápio & Delivery", items: [
    { route: "/food/(salao)/cardapio", label: "Cardápio", icon: "book",  mod: "food.cardapio" },
    { route: "/food/(salao)/despacho", label: "Despacho", icon: "truck", mod: "food.delivery" },
    { route: "/food/(salao)/motoboys", label: "Motoboys", icon: "bike",  mod: "food.motoboys" },
    { route: "/food/(salao)/ifood",    label: "iFood",    icon: "download", mod: "food.delivery" },
  ]},
  { label: "Configurações", items: [
    { route: "/food/(salao)/configuracoes", label: "Configurações", icon: "settings", mod: "food.config" },
  ]},
];

function routeMatches(pathname: string, route: string): boolean {
  const stripped = route.replace(/\/\([^)]+\)/g, "");
  return pathname === stripped || pathname === route || pathname.endsWith(stripped);
}

export function FoodSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, company, logout } = useAuthStore();
  const sw = collapsed ? 72 : 256;

  // Fase 10 — badge de pedidos em aberto (Hub). Polling 30s, falha silenciosa.
  const { data: hubStats } = useHubStats();
  const openOrders = hubStats?.open_orders ?? 0;

  const businessName =
    ((company as any)?.trade_name) ||
    ((company as any)?.legal_name) ||
    ((company as any)?.name) ||
    "Aura Food";

  const isWeb = Platform.OS === "web";

  return (
    <View style={[
      {
        width: sw, height: "100%",
        backgroundColor: isWeb ? FoodTokensV2.surface : FoodTokensV2.surfaceFlat,
        borderRightWidth: 1, borderRightColor: FoodTokensV2.line,
        paddingTop: 18, paddingBottom: 14,
        paddingHorizontal: collapsed ? 10 : 14,
        overflow: "hidden" as any,
        zIndex: 1,
      },
      isWeb ? ({
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        transition: "width 0.25s ease, padding 0.25s ease",
      } as any) : {},
    ]}>
      {/* Logo + collapse toggle */}
      <View style={{ flexDirection: "row", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        paddingHorizontal: collapsed ? 0 : 6, paddingBottom: 16 }}>
        <Pressable onPress={() => router.push("/food/(salao)/mesas" as any)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <GradientBrandMark size={36} />
            {!collapsed && (
              <View style={{ flexDirection: "column" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: FoodTokensV2.ink, letterSpacing: -0.4, lineHeight: 18 }}>
                  Aura<Text style={{ color: FoodTokensV2.primary }}> Food</Text>
                </Text>
                <Text style={{ fontSize: 9, color: FoodTokensV2.ink4, fontWeight: "600",
                  letterSpacing: 1.2, textTransform: "uppercase", marginTop: 1 }}>
                  Restaurante
                </Text>
              </View>
            )}
          </View>
        </Pressable>
        {!collapsed && (
          <Pressable onPress={onToggle} style={{ width: 26, height: 26, borderRadius: 8,
            backgroundColor: FoodTokensV2.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <Icon name="chevron_left" size={13} color={FoodTokensV2.primary} />
          </Pressable>
        )}
      </View>

      {collapsed && (
        <Pressable onPress={onToggle} style={{ alignSelf: "center", width: 26, height: 26,
          borderRadius: 8, backgroundColor: FoodTokensV2.primarySoft,
          alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Icon name="chevron_right" size={13} color={FoodTokensV2.primary} />
        </Pressable>
      )}

      <View style={{ height: 1, backgroundColor: FoodTokensV2.line, marginVertical: 4 }} />

      {/* Nav */}
      <ScrollView style={{ flex: 1, marginTop: 6 }} showsVerticalScrollIndicator={false}>
        {FOOD_NAV.map((section) => (
          <View key={section.label} style={{ marginBottom: collapsed ? 8 : 16 }}>
            {!collapsed && (
              <Text style={{ fontSize: 9, color: FoodTokensV2.ink4, fontWeight: "700",
                textTransform: "uppercase", letterSpacing: 1.4, paddingHorizontal: 12, marginBottom: 6 }}>
                {section.label}
              </Text>
            )}
            {collapsed && <View style={{ height: 1, backgroundColor: FoodTokensV2.line, marginVertical: 4, marginHorizontal: 4 }} />}
            {section.items.map((item) => {
              const active = routeMatches(pathname, item.route);
              const webExtras = isWeb ? ({ title: item.label, "data-mod": item.mod } as any) : {};
              const showBadge = item.badgeKey === "openOrders" && openOrders > 0;
              const badgeValue = showBadge ? (openOrders > 99 ? "99+" : String(openOrders)) : undefined;
              const iconNode = <Icon name={item.icon as any} size={16} color={active ? FoodTokensV2.primary : FoodTokensV2.ink3} />;

              if (collapsed) {
                return (
                  <Pressable key={item.route} onPress={() => router.push(item.route as any)} {...webExtras}
                    style={[{ alignSelf: "center", width: 36, height: 36, borderRadius: 10,
                      alignItems: "center", justifyContent: "center", marginBottom: 2, position: "relative" },
                      active && { backgroundColor: FoodTokensV2.primarySoft }]}>
                    {iconNode}
                    {showBadge && (
                      <View style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16,
                        borderRadius: 8, backgroundColor: FoodTokensV2.primary, paddingHorizontal: 4,
                        alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>{badgeValue}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              }
              return (
                <View key={item.route} {...webExtras}>
                  <NavItemV2
                    icon={iconNode}
                    label={item.label}
                    active={active}
                    badge={badgeValue}
                    onPress={() => router.push(item.route as any)}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={{ height: 1, backgroundColor: FoodTokensV2.line, marginVertical: 6 }} />

      {/* Footer: avatar gradient + name + business + atalhos */}
      <View style={{ paddingTop: 6, gap: 4, flexShrink: 0 }}>
        {!collapsed ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10,
              paddingHorizontal: 4, marginBottom: 8 }}>
              <View style={[
                { width: 34, height: 34, borderRadius: 17,
                  alignItems: "center", justifyContent: "center" },
                isWeb
                  ? ({ background: "linear-gradient(135deg, #EF4444, #7c3aed)",
                       boxShadow: "0 4px 12px rgba(239,68,68,0.25)" } as any)
                  : { backgroundColor: FoodTokensV2.primary },
              ]}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>
                  {(user?.name || "A").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: FoodTokensV2.ink, fontWeight: "700" }} numberOfLines={1}>
                  {user?.name || "---"}
                </Text>
                <Text style={{ fontSize: 10, color: FoodTokensV2.primary, marginTop: 1, fontWeight: "600" }} numberOfLines={1}>
                  {businessName}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => router.push("/(tabs)" as any)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6,
                paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8,
                borderWidth: 1, borderColor: FoodTokensV2.line2 }}
              {...(isWeb ? ({ title: "Acessar módulos genéricos do Aura Negócio" } as any) : {})}>
              <Icon name="grid" size={12} color={FoodTokensV2.ink3} />
              <Text style={{ fontSize: 11, color: FoodTokensV2.ink3, fontWeight: "600" }}>Aura Negócio</Text>
            </Pressable>
            <Pressable onPress={logout}
              style={{ flexDirection: "row", alignItems: "center", gap: 6,
                paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8,
                borderWidth: 1, borderColor: FoodTokensV2.line2 }}>
              <Icon name="logout" size={12} color={FoodTokensV2.ink3} />
              <Text style={{ fontSize: 11, color: FoodTokensV2.ink3, fontWeight: "600" }}>Sair</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={[
              { alignSelf: "center", width: 34, height: 34, borderRadius: 17,
                alignItems: "center", justifyContent: "center", marginBottom: 4 },
              isWeb
                ? ({ background: "linear-gradient(135deg, #EF4444, #7c3aed)" } as any)
                : { backgroundColor: FoodTokensV2.primary },
            ]}
              {...(isWeb ? ({ title: user?.name || "Perfil" } as any) : {})}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>
                {(user?.name || "A").charAt(0).toUpperCase()}
              </Text>
            </View>
            <Pressable onPress={() => router.push("/(tabs)" as any)}
              style={{ alignSelf: "center", width: 28, height: 28, borderRadius: 8,
                backgroundColor: FoodTokensV2.surface,
                alignItems: "center", justifyContent: "center" }}
              {...(isWeb ? ({ title: "Aura Negócio" } as any) : {})}>
              <Icon name="grid" size={13} color={FoodTokensV2.ink3} />
            </Pressable>
            <Pressable onPress={logout}
              style={{ alignSelf: "center", width: 28, height: 28, borderRadius: 8,
                backgroundColor: FoodTokensV2.surface,
                alignItems: "center", justifyContent: "center" }}
              {...(isWeb ? ({ title: "Sair" } as any) : {})}>
              <Icon name="logout" size={13} color={FoodTokensV2.ink3} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export default FoodSidebar;
