import { useState, useEffect, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { useAuthStore } from "@/stores/auth";

// Route priority for redirect when current route is not accessible
var ROUTE_MAP: { route: string; mod: string }[] = [
  { route: "/", mod: "painel" },
  { route: "/pdv", mod: "pdv" },
  { route: "/financeiro", mod: "financeiro" },
  { route: "/estoque", mod: "estoque" },
  { route: "/clientes", mod: "clientes" },
  { route: "/nfe", mod: "nfe" },
  { route: "/contabilidade", mod: "contabilidade" },
  { route: "/folha", mod: "folha" },
  { route: "/canal", mod: "canal" },
  { route: "/agendamento", mod: "agendamento" },
  { route: "/agentes", mod: "agentes" },
  { route: "/suporte", mod: "suporte" },
  { route: "/configuracoes", mod: "configuracoes" },
];

/**
 * Hook that returns the first available route based on user permissions.
 * Redirects automatically if the current page is not accessible.
 */
export function usePermissionRedirect() {
  var visibleMods = useVisibleModules();
  var router = useRouter();
  var pathname = usePathname();
  var { token } = useAuthStore();
  var [checked, setChecked] = useState(false);

  useEffect(function() {
    if (!token || visibleMods.size === 0) return;

    // Only redirect from the root/dashboard
    var isRoot = pathname === "/" || pathname === "" || pathname.endsWith("/index") || pathname === "/(tabs)";
    if (!isRoot) { setChecked(true); return; }

    // If painel is visible, stay on dashboard
    if (visibleMods.has("painel")) { setChecked(true); return; }

    // Find first available route
    var firstAvailable = ROUTE_MAP.find(function(r) { return visibleMods.has(r.mod); });
    if (firstAvailable && firstAvailable.route !== "/") {
      setTimeout(function() {
        try { router.replace(firstAvailable!.route as any); } catch {}
      }, 100);
    }
    setChecked(true);
  }, [token, visibleMods, pathname]);

  return { checked: checked, visibleMods: visibleMods };
}
