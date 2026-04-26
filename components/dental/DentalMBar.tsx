import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { DentalColors } from "@/constants/dental-tokens";

// ============================================================
// DentalMBar — Bottom navigation bar do shell Aura Odonto
// para telas estreitas (mobile web e native).
//
// 4 tabs fixas (Hoje/Agenda/Pacientes/Atendimento) escolhidas
// pelo criterio "operacao do dia-a-dia". As outras 5 areas vivem
// no overlay "Mais".
//
// FONTE UNICA: modulos genericos do Aura nao aparecem aqui. O
// atalho "Aura Negocio" no overlay leva pro shell generico
// quando o usuario precisa de algo nao-dental.
//
// Limitacao: overlay "Mais" so funciona no web (usa position
// fixed + backdrop). Em native, clicar em "Mais" toggla o state
// mas nao renderiza overlay — mesma limitacao do MBar generico
// do (tabs)/_layout. Sera resolvido quando o foco virar app nativo.
// ============================================================

interface MTabItem { route: string; label: string; icon: string; }

const FIXED_TABS: MTabItem[] = [
  { route: "/dental/(clinic)/hoje",        label: "Hoje",        icon: "clock" },
  { route: "/dental/(clinic)/agenda",      label: "Agenda",      icon: "calendar" },
  { route: "/dental/(clinic)/pacientes",   label: "Pacientes",   icon: "users" },
  { route: "/dental/(clinic)/atendimento", label: "Atendim.",    icon: "tooth" },
];

const MORE_ITEMS: MTabItem[] = [
  { route: "/dental/(clinic)/tratamentos", label: "Tratamentos", icon: "clipboard" },
  { route: "/dental/(clinic)/faturamento", label: "Faturamento", icon: "wallet" },
  { route: "/dental/(clinic)/materiais",   label: "Materiais",   icon: "package" },
  { route: "/dental/(clinic)/comunicacao", label: "Comunicacao", icon: "message" },
  { route: "/dental/(clinic)/clinica",     label: "Clinica",     icon: "settings" },
];

function routeMatches(pathname: string, route: string): boolean {
  const stripped = route.replace(/\/\([^)]+\)/g, "");
  return pathname === stripped || pathname === route || pathname.endsWith(stripped);
}

export function DentalMBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);

  const navigate = (route: string) => {
    router.push(route as any);
    setShowMore(false);
  };

  return (
    <View style={{ position: "relative", flexShrink: 0, zIndex: 50 } as any}>
      {/* Overlay "Mais" — web only */}
      {showMore && Platform.OS === "web" && (
        <div
          onClick={() => setShowMore(false)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 998, background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
          } as any}
        >
          <div
            onClick={(e: any) => e.stopPropagation()}
            style={{
              position: "absolute", bottom: 60, left: 8, right: 8,
              background: DentalColors.bg2,
              border: "1px solid " + DentalColors.border,
              borderRadius: 16, padding: 14,
              maxHeight: "60vh", overflowY: "auto",
              zIndex: 999,
            } as any}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 } as any}>
              {MORE_ITEMS.map((item) => {
                const active = routeMatches(pathname, item.route);
                return (
                  <div
                    key={item.route}
                    onClick={() => navigate(item.route)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      padding: 14, borderRadius: 12, cursor: "pointer",
                      background: active ? DentalColors.cyanDim : "transparent",
                      border: "1px solid " + (active ? DentalColors.cyanBorder : DentalColors.border),
                    } as any}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: active ? DentalColors.cyan : "rgba(255,255,255,0.04)",
                    } as any}>
                      <Icon name={item.icon as any} size={18} color={active ? "#fff" : DentalColors.ink3} />
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: "600", textAlign: "center",
                      color: active ? DentalColors.cyan : DentalColors.ink2,
                    } as any}>{item.label}</span>
                  </div>
                );
              })}
              {/* Atalho pra Aura Negocio (modulos genericos) */}
              <div
                onClick={() => navigate("/(tabs)")}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: 14, borderRadius: 12, cursor: "pointer",
                  background: "transparent",
                  border: "1px dashed " + DentalColors.border,
                } as any}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(255,255,255,0.04)",
                } as any}>
                  <Icon name="grid" size={18} color={DentalColors.ink3} />
                </div>
                <span style={{ fontSize: 11, color: DentalColors.ink3, fontWeight: "600", textAlign: "center" } as any}>
                  Aura Negocio
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bar */}
      <View style={{
        flexDirection: "row",
        backgroundColor: DentalColors.bg2,
        borderTopWidth: 1, borderTopColor: DentalColors.border,
        paddingBottom: Platform.OS === "ios" ? 20 : 6,
        paddingTop: 6,
        flexShrink: 0,
      }}>
        {FIXED_TABS.map((t) => {
          const active = routeMatches(pathname, t.route);
          return (
            <Pressable
              key={t.route}
              style={{ flex: 1, alignItems: "center", gap: 3 }}
              onPress={() => navigate(t.route)}
            >
              <View style={[
                { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
                active && { backgroundColor: DentalColors.cyanDim },
              ]}>
                <Icon name={t.icon as any} size={18} color={active ? DentalColors.cyan : DentalColors.ink3} />
              </View>
              <Text style={[
                { fontSize: 9, color: DentalColors.ink3, fontWeight: "500" },
                active && { color: DentalColors.cyan, fontWeight: "600" },
              ]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={{ flex: 1, alignItems: "center", gap: 3 }}
          onPress={() => setShowMore((s) => !s)}
        >
          <View style={[
            { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
            showMore && { backgroundColor: DentalColors.cyanDim },
          ]}>
            <Icon name="grid" size={18} color={showMore ? DentalColors.cyan : DentalColors.ink3} />
          </View>
          <Text style={[
            { fontSize: 9, color: DentalColors.ink3, fontWeight: "500" },
            showMore && { color: DentalColors.cyan, fontWeight: "600" },
          ]}>
            Mais
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default DentalMBar;
