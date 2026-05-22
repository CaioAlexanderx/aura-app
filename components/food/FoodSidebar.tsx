import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { FoodColors } from "@/constants/food-tokens";

// ============================================================
// FoodSidebar — Sidebar dedicada do shell Aura Food.
// Fase 0: 6 itens fixos em 3 secoes, sem custom layout/editor.
// Reaproveita Icon e useAuthStore.
//
// 2026-05-21 (F2 do polish pre-Fase 7): cada item ganha `mod`
// distinto (food.mesas, food.pedidos, etc) consultado em
// useVisibleModules — sem isso plano Essencial veria Mesas
// mesmo sem ter direito.
// ============================================================

interface FoodNavItem { route: string; label: string; icon: string; mod: string; }
interface FoodNavSection { label: string; items: FoodNavItem[]; }

const FOOD_NAV: FoodNavSection[] = [
  { label: "Salão", items: [
    { route: "/food/(salao)/mesas",    label: "Mesas",    icon: "users",     mod: "food.mesas" },
    { route: "/food/(salao)/pedidos",  label: "Pedidos",  icon: "clipboard", mod: "food.pedidos" },
  ]},
  { label: "Cardápio & Delivery", items: [
    { route: "/food/(salao)/cardapio", label: "Cardápio", icon: "book",  mod: "food.cardapio" },
    { route: "/food/(salao)/delivery", label: "Delivery", icon: "truck", mod: "food.delivery" },
    { route: "/food/(salao)/motoboys", label: "Motoboys", icon: "bike",  mod: "food.delivery" },
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
  const sw = collapsed ? 64 : 240;

  // 2026-05-21 (F3): usa trade_name → legal_name (companies nao tem coluna `name`).
  const businessName =
    ((company as any)?.trade_name) ||
    ((company as any)?.legal_name) ||
    ((company as any)?.name) ||
    "Aura Food";

  return (
    <View style={[
      { width: sw, height: "100%", backgroundColor: "rgba(255,255,255,0.025)",
        borderRightWidth: 1, borderRightColor: FoodColors.border,
        paddingTop: 16, paddingBottom: 12, paddingHorizontal: collapsed ? 8 : 14, overflow: "hidden" as any },
      { transition: "width 0.25s ease, padding 0.25s ease" } as any,
    ]}>
      {/* Logo + collapse toggle */}
      <View style={{ flexDirection: "row", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        paddingHorizontal: collapsed ? 0 : 4, paddingBottom: 14 }}>
        <Pressable onPress={() => router.push("/food/(salao)/mesas" as any)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={[
              { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
              Platform.OS === "web"
                ? ({ background: "linear-gradient(135deg, #EF4444, #f97316)", boxShadow: "0 4px 16px rgba(239,68,68,0.3)" } as any)
                : { backgroundColor: FoodColors.red },
            ]}>
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>🍽</Text>
            </View>
            {!collapsed && (
              <Text style={{ fontSize: 16, fontWeight: "800", color: FoodColors.ink, letterSpacing: -0.4 }}>
                Aura<Text style={{ color: FoodColors.red }}> Food</Text>
              </Text>
            )}
          </View>
        </Pressable>
        {!collapsed && (
          <Pressable onPress={onToggle} style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" }}>
            <Icon name="chevron_left" size={13} color={FoodColors.ink3} />
          </Pressable>
        )}
      </View>

      {collapsed && (
        <Pressable onPress={onToggle} style={{ alignSelf: "center", width: 26, height: 26, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Icon name="chevron_right" size={13} color={FoodColors.ink3} />
        </Pressable>
      )}

      <View style={{ height: 1, backgroundColor: FoodColors.border, marginVertical: 6 }} />

      {/* Nav */}
      <ScrollView style={{ flex: 1, marginTop: 4 }} showsVerticalScrollIndicator={false}>
        {FOOD_NAV.map((section) => (
          <View key={section.label} style={{ marginBottom: collapsed ? 8 : 16 }}>
            {!collapsed && (
              <Text style={{ fontSize: 9, color: FoodColors.ink3, fontWeight: "600",
                textTransform: "uppercase", letterSpacing: 1.4, paddingHorizontal: 12, marginBottom: 6 }}>
                {section.label}
              </Text>
            )}
            {collapsed && <View style={{ height: 1, backgroundColor: FoodColors.border, marginVertical: 4, marginHorizontal: 4 }} />}
            {section.items.map((item) => {
              const active = routeMatches(pathname, item.route);
              const webExtras = Platform.OS === "web" ? ({ title: item.label, "data-mod": item.mod } as any) : {};
              return (
                <Pressable
                  key={item.route}
                  onPress={() => router.push(item.route as any)}
                  {...webExtras}
                  style={[
                    { flexDirection: "row", alignItems: "center", gap: collapsed ? 0 : 10,
                      paddingVertical: 9, paddingHorizontal: collapsed ? 0 : 12,
                      borderRadius: 10, marginBottom: 2,
                      justifyContent: collapsed ? "center" : "flex-start" },
                    active && { backgroundColor: FoodColors.redDim,
                      borderLeftWidth: 3, borderLeftColor: FoodColors.red,
                      paddingLeft: collapsed ? 0 : 9 },
                    { transition: "all 0.15s ease" } as any,
                  ]}
                >
                  <View style={[
                    { width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" },
                    active && { backgroundColor: FoodColors.red },
                  ]}>
                    <Icon name={item.icon as any} size={14} color={active ? "#fff" : FoodColors.ink3} />
                  </View>
                  {!collapsed && (
                    <Text style={[
                      { fontSize: 13, color: FoodColors.ink2, fontWeight: "500", flex: 1 },
                      active && { color: FoodColors.red, fontWeight: "600" },
                    ]}>
                      {item.label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={{ height: 1, backgroundColor: FoodColors.border, marginVertical: 6 }} />

      {/* Footer: user + company name + logout + Aura Negócio */}
      <View style={{ paddingTop: 6, gap: 4, flexShrink: 0 }}>
        {!collapsed ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, marginBottom: 6 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: FoodColors.red, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{(user?.name || "A").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: FoodColors.ink, fontWeight: "600" }} numberOfLines={1}>{user?.name || "---"}</Text>
                <Text style={{ fontSize: 10, color: FoodColors.red, marginTop: 1 }} numberOfLines={1}>{businessName}</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push("/(tabs)" as any)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: FoodColors.border }}
              {...(Platform.OS === "web" ? ({ title: "Acessar módulos genéricos do Aura Negócio" } as any) : {})}>
              <Icon name="grid" size={12} color={FoodColors.ink3} />
              <Text style={{ fontSize: 11, color: FoodColors.ink3, fontWeight: "500" }}>Aura Negócio</Text>
            </Pressable>
            <Pressable onPress={logout} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: FoodColors.border }}>
              <Icon name="logout" size={12} color={FoodColors.ink3} />
              <Text style={{ fontSize: 11, color: FoodColors.ink3, fontWeight: "500" }}>Sair</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 15, backgroundColor: FoodColors.red, alignItems: "center", justifyContent: "center", marginBottom: 4 }}
              {...(Platform.OS === "web" ? ({ title: user?.name || "Perfil" } as any) : {})}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{(user?.name || "A").charAt(0).toUpperCase()}</Text>
            </View>
            <Pressable onPress={() => router.push("/(tabs)" as any)} style={{ alignSelf: "center", width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" }}
              {...(Platform.OS === "web" ? ({ title: "Aura Negócio" } as any) : {})}>
              <Icon name="grid" size={13} color={FoodColors.ink3} />
            </Pressable>
            <Pressable onPress={logout} style={{ alignSelf: "center", width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" }}
              {...(Platform.OS === "web" ? ({ title: "Sair" } as any) : {})}>
              <Icon name="logout" size={13} color={FoodColors.ink3} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export default FoodSidebar;
