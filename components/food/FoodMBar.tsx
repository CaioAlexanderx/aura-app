import { View, Text, Pressable, Platform } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { FoodColors } from "@/constants/food-tokens";

// ============================================================
// FoodMBar — bottom tab bar do shell Food em mobile web/native.
// 5 itens (Configurações sai pro footer; Motoboys vai pra Delivery).
// ============================================================

const MBAR_ITEMS = [
  { route: "/food/(salao)/mesas",          label: "Mesas",    icon: "users" },
  { route: "/food/(salao)/pedidos",        label: "Pedidos",  icon: "clipboard" },
  { route: "/food/(salao)/cardapio",       label: "Cardápio", icon: "book" },
  { route: "/food/(salao)/delivery",       label: "Delivery", icon: "truck" },
  { route: "/food/(salao)/configuracoes",  label: "Config",   icon: "settings" },
];

function routeMatches(pathname: string, route: string): boolean {
  const stripped = route.replace(/\/\([^)]+\)/g, "");
  return pathname === stripped || pathname === route || pathname.endsWith(stripped);
}

export function FoodMBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={{
      flexDirection: "row",
      backgroundColor: FoodColors.surface,
      borderTopWidth: 1,
      borderTopColor: FoodColors.border,
      paddingVertical: 8,
      paddingBottom: Platform.OS === "web" ? 8 : 22,
    }}>
      {MBAR_ITEMS.map((item) => {
        const active = routeMatches(pathname, item.route);
        return (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route as any)}
            style={{ flex: 1, alignItems: "center", paddingVertical: 4, gap: 2 }}
          >
            <Icon name={item.icon as any} size={20} color={active ? FoodColors.red : FoodColors.ink3} />
            <Text style={{ fontSize: 10, color: active ? FoodColors.red : FoodColors.ink3, fontWeight: active ? "700" : "500" }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default FoodMBar;
