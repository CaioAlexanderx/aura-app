// Botao "Suporte" ao lado do sino, no topo do shell Negocio (decisao do Caio,
// 26/11/2026): a secao "Contabil" (Contabilidade + Seu Analista) saiu da
// sidebar e o Suporte virou este atalho. Mesmo destino do antigo "Seu
// Analista" (/suporte) e mesma chave de modulo ("suporte"): sem o modulo, o
// botao nao aparece. Desktop e celular usam o mesmo componente.
import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { useColors } from "@/constants/colors";
import { useVisibleModules } from "@/hooks/useVisibleModules";

export function SuporteButton({ compact = false }: { compact?: boolean }) {
  const C = useColors();
  const ro = useRouter();
  const visibleMods = useVisibleModules();
  if (!visibleMods.has("suporte")) return null;
  return (
    <Pressable
      testID="suporte-button"
      accessibilityRole="button"
      accessibilityLabel="Suporte"
      onPress={() => ro.push("/suporte" as any)}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: compact ? 10 : 12, borderRadius: 18, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border, marginRight: 8 } as any}
    >
      <Icon name={"headset" as any} size={16} color={C.ink3} />
      {compact ? null : <Text style={{ fontSize: 12, fontWeight: "600", color: C.ink3 }}>Suporte</Text>}
    </Pressable>
  );
}
