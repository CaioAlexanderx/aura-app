import { View, Text, Pressable, ScrollView, Platform } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { DentalColors, SMILE_ARC_PATH } from "@/constants/dental-tokens";

// ============================================================
// DentalSidebar — Sidebar dedicada do shell Aura Odonto.
//
// Substitui o sidebar generico de (tabs)/_layout quando o usuario
// navega sob /dental/(clinic)/. Mostra apenas as 8 areas dentais
// (Operacao + Negocio) + Configuracoes.
//
// FONTE UNICA: modulos genericos do Aura (PDV/Cupons/NF-e/Folha/
// Contabilidade/Canal/Agentes) NAO aparecem aqui. Usuario que
// quiser acessar entra via deep-link em /(tabs) ou pelo botao
// "Aura Negocio" no rodape do sidebar.
// ============================================================

interface DentalNavItem { route: string; label: string; icon: string; }
interface DentalNavSection { label: string; items: DentalNavItem[]; }

const DENTAL_NAV: DentalNavSection[] = [
  { label: "Operacao", items: [
    { route: "/dental/(clinic)/hoje",        label: "Hoje",        icon: "clock" },
    { route: "/dental/(clinic)/pacientes",   label: "Pacientes",   icon: "users" },
    { route: "/dental/(clinic)/atendimento", label: "Atendimento", icon: "tooth" },
    { route: "/dental/(clinic)/agenda",      label: "Agenda",      icon: "calendar" },
    { route: "/dental/(clinic)/tratamentos", label: "Tratamentos", icon: "clipboard" },
  ]},
  { label: "Negocio", items: [
    { route: "/dental/(clinic)/faturamento", label: "Faturamento", icon: "wallet" },
    { route: "/dental/(clinic)/materiais",   label: "Materiais",   icon: "package" },
    { route: "/dental/(clinic)/comunicacao", label: "Comunicacao", icon: "message" },
  ]},
  { label: "Configuracoes", items: [
    { route: "/dental/(clinic)/clinica",     label: "Clinica",     icon: "settings" },
  ]},
];

// expo-router omite groups (parenteses) na pathname renderizada,
// entao /dental/(clinic)/hoje vira pathname="/dental/hoje". Comparar
// removendo o segmento de grupo das rotas declaradas.
function routeMatches(pathname: string, route: string): boolean {
  const stripped = route.replace(/\/\([^)]+\)/g, "");
  return pathname === stripped || pathname === route || pathname.endsWith(stripped);
}

export function DentalSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const sw = collapsed ? 64 : 240;

  return (
    <View style={[
      { width: sw, height: "100%", backgroundColor: "rgba(255,255,255,0.025)",
        borderRightWidth: 1, borderRightColor: DentalColors.border,
        paddingTop: 16, paddingBottom: 12, paddingHorizontal: collapsed ? 8 : 14, overflow: "hidden" as any },
      { transition: "width 0.25s ease, padding 0.25s ease" } as any,
    ]}>
      {/* BRAND */}
      <View style={{ flexDirection: "row", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        paddingHorizontal: collapsed ? 0 : 4, paddingBottom: 14 }}>
        <Pressable onPress={() => router.push("/dental/(clinic)/hoje" as any)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={[
              { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
              Platform.OS === "web"
                ? ({ background: "linear-gradient(135deg, #06B6D4, #7c3aed)", boxShadow: "0 4px 16px rgba(6,182,212,0.3)" } as any)
                : { backgroundColor: DentalColors.cyan },
            ]}>
              {Platform.OS === "web" ? (
                <span dangerouslySetInnerHTML={{ __html:
                  `<svg width="22" height="22" viewBox="0 0 32 32" fill="none"><path d="${SMILE_ARC_PATH}" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>` }} />
              ) : (
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>D</Text>
              )}
            </View>
            {!collapsed && (
              <Text style={{ fontSize: 16, fontWeight: "800", color: DentalColors.ink, letterSpacing: -0.4 }}>
                Aura<Text style={{ color: DentalColors.cyan }}> Odonto</Text>
              </Text>
            )}
          </View>
        </Pressable>
        {!collapsed && (
          <Pressable onPress={onToggle} style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" }}>
            <Icon name="chevron_left" size={13} color={DentalColors.ink3} />
          </Pressable>
        )}
      </View>

      {collapsed && (
        <Pressable onPress={onToggle} style={{ alignSelf: "center", width: 26, height: 26, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Icon name="chevron_right" size={13} color={DentalColors.ink3} />
        </Pressable>
      )}

      <View style={{ height: 1, backgroundColor: DentalColors.border, marginVertical: 6 }} />

      {/* NAV */}
      <ScrollView style={{ flex: 1, marginTop: 4 }} showsVerticalScrollIndicator={false}>
        {DENTAL_NAV.map((section) => (
          <View key={section.label} style={{ marginBottom: collapsed ? 8 : 16 }}>
            {!collapsed && (
              <Text style={{ fontSize: 9, color: DentalColors.ink3, fontWeight: "600",
                textTransform: "uppercase", letterSpacing: 1.4, paddingHorizontal: 12, marginBottom: 6 }}>
                {section.label}
              </Text>
            )}
            {collapsed && <View style={{ height: 1, backgroundColor: DentalColors.border, marginVertical: 4, marginHorizontal: 4 }} />}
            {section.items.map((item) => {
              const active = routeMatches(pathname, item.route);
              return (
                <Pressable
                  key={item.route}
                  onPress={() => router.push(item.route as any)}
                  {...(Platform.OS === "web" ? { title: item.label } : {})}
                  style={[
                    { flexDirection: "row", alignItems: "center", gap: collapsed ? 0 : 10,
                      paddingVertical: 9, paddingHorizontal: collapsed ? 0 : 12,
                      borderRadius: 10, marginBottom: 2,
                      justifyContent: collapsed ? "center" : "flex-start" },
                    active && { backgroundColor: DentalColors.cyanDim,
                      borderLeftWidth: 3, borderLeftColor: DentalColors.cyan,
                      paddingLeft: collapsed ? 0 : 9 },
                    { transition: "all 0.15s ease" } as any,
                  ]}
                >
                  <View style={[
                    { width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" },
                    active && { backgroundColor: DentalColors.cyan },
                  ]}>
                    <Icon name={item.icon as any} size={14} color={active ? "#fff" : DentalColors.ink3} />
                  </View>
                  {!collapsed && (
                    <Text style={[
                      { fontSize: 13, color: DentalColors.ink2, fontWeight: "500", flex: 1 },
                      active && { color: DentalColors.cyan, fontWeight: "600" },
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

      <View style={{ height: 1, backgroundColor: DentalColors.border, marginVertical: 6 }} />

      {/* USER FOOTER + escape pra Aura Negocio */}
      <View style={{ paddingTop: 6, gap: 4, flexShrink: 0 }}>
        {!collapsed ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, marginBottom: 6 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: DentalColors.cyan, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{(user?.name || "A").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: DentalColors.ink, fontWeight: "600" }} numberOfLines={1}>{user?.name || "---"}</Text>
                <Text style={{ fontSize: 10, color: DentalColors.cyan2, marginTop: 1 }}>Aura Odonto</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push("/(tabs)" as any)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: DentalColors.border }}
              {...(Platform.OS === "web" ? { title: "Acessar modulos genericos do Aura Negocio" } : {})}>
              <Icon name="grid" size={12} color={DentalColors.ink3} />
              <Text style={{ fontSize: 11, color: DentalColors.ink3, fontWeight: "500" }}>Aura Negocio</Text>
            </Pressable>
            <Pressable onPress={logout} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: DentalColors.border }}>
              <Icon name="logout" size={12} color={DentalColors.ink3} />
              <Text style={{ fontSize: 11, color: DentalColors.ink3, fontWeight: "500" }}>Sair</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ alignSelf: "center", width: 30, height: 30, borderRadius: 15, backgroundColor: DentalColors.cyan, alignItems: "center", justifyContent: "center", marginBottom: 4 }}
              {...(Platform.OS === "web" ? { title: user?.name || "Perfil" } : {})}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{(user?.name || "A").charAt(0).toUpperCase()}</Text>
            </View>
            <Pressable onPress={() => router.push("/(tabs)" as any)} style={{ alignSelf: "center", width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" }}
              {...(Platform.OS === "web" ? { title: "Aura Negocio" } : {})}>
              <Icon name="grid" size={13} color={DentalColors.ink3} />
            </Pressable>
            <Pressable onPress={logout} style={{ alignSelf: "center", width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center" }}
              {...(Platform.OS === "web" ? { title: "Sair" } : {})}>
              <Icon name="logout" size={13} color={DentalColors.ink3} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export default DentalSidebar;
