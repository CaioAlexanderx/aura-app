import { Pressable, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { Colors } from "@/constants/colors";
import { useValoresOcultos } from "@/stores/valoresOcultos";

// Botão "olho" que oculta/mostra os valores financeiros (Painel, Crediário,
// Estoque). O estado é compartilhado entre as telas — ver stores/valoresOcultos.
//
// variant="icone": ícone solto (herói do Painel).
// variant="botao": mesmo formato dos botões de ação do ScreenHero.
// alvo44: no celular, o botão ganha 44 × 44 (barra do Estoque, A8).
export function OlhoValores({ variant = "icone", color = Colors.ink3, size = 18, alvo44 = false }: {
  variant?: "icone" | "botao"; color?: string; size?: number; alvo44?: boolean;
}) {
  const { ocultos, alternar } = useValoresOcultos();
  const rotulo = ocultos ? "Mostrar valores" : "Ocultar valores";
  const icone = ocultos ? "eye_off" : "eye";

  if (variant === "botao") {
    return (
      <Button
        title=""
        icon={icone}
        variant="secondary"
        accessibilityLabel={rotulo}
        onPress={alternar}
        style={(alvo44 ? { paddingHorizontal: 13, gap: 0, minWidth: 44, minHeight: 44 } : { paddingHorizontal: 13, gap: 0 }) as any}
      />
    );
  }

  return (
    <Pressable
      testID="olho-valores"
      onPress={alternar}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={8}
      style={s.btn}
    >
      <Icon name={icone} size={size} color={color} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
