// ============================================================
// AURA. — Estoque · botões "ORDENAR:"
//
// 23/09/2026: saiu de dentro de app/(tabs)/estoque.tsx para a mesma barra
// servir à lista da empresa e ao estoque consolidado (multi-CNPJ), e ganhou
// "A–Z" / "Z–A". A regra de ordenação está em utils/productSort.ts; aqui
// só ficam os botões. Sem hover: toque e clique funcionam igual.
//
// Renderiza o rótulo + os botões soltos (fragmento) — quem chama decide o
// contêiner, porque no Estoque a mesma linha também tem a troca
// tabela/cartões.
// ============================================================
import { Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { ORDENS_ESTOQUE, ROTULOS_ORDEM, type OrdemEstoque } from "@/utils/productSort";

type Props = {
  value: OrdemEstoque;
  onChange: (ordem: OrdemEstoque) => void;
  /** Quais opções aparecem, na ordem. Padrão: todas. */
  opcoes?: readonly OrdemEstoque[];
};

export function OrdenarBarra({ value, onChange, opcoes = ORDENS_ESTOQUE }: Props) {
  return (
    <>
      <Text style={s.sortLabel}>Ordenar:</Text>
      {opcoes.map((key) => {
        const ativo = value === key;
        return (
          <Pressable
            key={key}
            testID={`ordenar-${key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
            onPress={() => onChange(key)}
            style={[s.sortChip, ativo && s.sortChipActive]}
          >
            <Text style={[s.sortChipText, ativo && s.sortChipTextActive]}>{ROTULOS_ORDEM[key]}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  sortLabel: { fontSize: 10, color: Colors.ink3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, alignSelf: "center", marginRight: 2 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  sortChipActive: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  sortChipText: { fontSize: 12, color: Colors.ink3, fontWeight: "500" },
  sortChipTextActive: { color: "#fff", fontWeight: "600" },
});
