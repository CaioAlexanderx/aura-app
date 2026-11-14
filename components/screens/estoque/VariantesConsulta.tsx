// ============================================================
// Variantes em modo consulta (estoque_consulta, 30/10/2026): quanto tem de
// cada tamanho e cor, só leitura e sem valores. Para quem pode editar, a
// grade mora no cadastro; quem só consulta não abre o cadastro.
// Abre no toque, nunca no hover (regra 7 do CLAUDE.md).
// ============================================================
import { View, Text, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { companiesApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { qtdComUnidade } from "@/utils/matconUnits";
import { rotuloDaVariante as rotuloComNomeDaCor } from "@/utils/nomeDaCor";

// 14/11/2026 (CP2b da revisão de cores): o nome da cor é o mesmo do Caixa,
// do cupom e da vitrine (utils/nomeDaCor.ts). Antes, a cor sem color_name
// sumia do rótulo e o nome cortado ("AZUL ESCUR") aparecia como estava.
export function rotuloDaVariante(v: any): string {
  return rotuloComNomeDaCor(v || {}, " · ") || "Variante";
}

export function VariantesConsulta({ productId, unit }: { productId: string; unit: string }) {
  const companyId = useAuthStore().company?.id;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["estoque-consulta-variantes", companyId, productId],
    queryFn: () => companiesApi.variants(companyId!, productId),
    enabled: !!companyId,
    staleTime: 30000,
    retry: 1,
  });
  const variantes: any[] = Array.isArray((data as any)?.variants) ? (data as any).variants : [];

  if (isLoading) return <Text style={s.aviso}>Carregando tamanhos e cores...</Text>;
  if (isError) return <Text style={s.aviso}>Não consegui carregar os tamanhos e cores agora.</Text>;
  if (variantes.length === 0) return null;
  return (
    <View style={s.lista} testID={"estoque-consulta-variantes-" + productId}>
      {variantes.map((v) => (
        <View key={v.id} style={s.linha}>
          <Text style={s.nome} numberOfLines={1}>{rotuloDaVariante(v)}</Text>
          <Text style={s.qtd}>{qtdComUnidade(parseFloat(v.stock_qty) || 0, unit)}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  lista: { gap: 6, marginTop: 8 },
  linha: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  nome: { flex: 1, minWidth: 0, fontSize: 12, color: Colors.ink2, fontWeight: "600" },
  qtd: { fontSize: 12, color: Colors.ink, fontWeight: "700" },
  aviso: { fontSize: 11, color: Colors.ink3, marginTop: 8 },
});
