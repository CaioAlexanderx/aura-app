import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { usePermissionRedirect } from "@/hooks/usePermissionRedirect";

// Wrap Dashboard screen content with permission check
// If user doesn't have painel permission, redirects to first available tab
export function DashboardGuard({ children }: { children: React.ReactNode }) {
  var { checked, visibleMods } = usePermissionRedirect();

  // Still loading permissions
  if (!checked) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="large" color={Colors.violet3} />
        <Text style={s.text}>Carregando...</Text>
      </View>
    );
  }

  // User doesn't have painel permission (redirect already triggered)
  if (!visibleMods.has("painel")) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="large" color={Colors.violet3} />
        <Text style={s.text}>Redirecionando...</Text>
      </View>
    );
  }

  return <>{children}</>;
}

var s = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  text: { fontSize: 13, color: Colors.ink3, fontWeight: "500" },
});

export default DashboardGuard;
