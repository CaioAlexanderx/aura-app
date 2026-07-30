import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/constants/colors";

// Puro, sem chamada de rede -- recebe dados por prop (briefing 5.4).
export type BreadcrumbNode = { name: string };

type Props = {
  // Preferido: cadeia de nos reais (nomes de exibicao corretos).
  nodes?: BreadcrumbNode[];
  // Fallback: `path` (slug) do contrato -- usado so quando `nodes` nao
  // esta disponivel. O path e sempre lowercase/sem acento por ser slug,
  // entao o resultado aqui e uma aproximacao (title-case do slug), nunca
  // o nome exato de exibicao.
  path?: string;
  size?: number;
};

function titleCaseSlug(seg: string): string {
  if (!seg) return seg;
  const withSpaces = seg.replace(/-/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

export function CategoryBreadcrumb({ nodes, path, size = 12.5 }: Props) {
  const C = useColors();
  const segments = nodes && nodes.length
    ? nodes.map((n) => n.name)
    : (path || "").split("/").filter(Boolean).map(titleCaseSlug);

  if (segments.length === 0) return null;

  return (
    <View style={s.row}>
      {segments.map((seg, i) => (
        <View key={i} style={s.item}>
          <Text
            style={[
              s.text,
              {
                fontSize: size,
                color: i === segments.length - 1 ? C.ink : C.ink3,
                fontWeight: i === segments.length - 1 ? "700" : "500",
              },
            ]}
            numberOfLines={1}
          >
            {seg}
          </Text>
          {i < segments.length - 1 && (
            <Text style={[s.sep, { fontSize: size, color: C.ink3 }]}> › </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  item: { flexDirection: "row", alignItems: "center" },
  text: {},
  sep: {},
});

export default CategoryBreadcrumb;
