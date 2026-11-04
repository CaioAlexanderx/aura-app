// ============================================================
// AURA. — Cadastro do item: card "Compras deste produto" (03/11/2026)
//
// Mockup: docs/mockups/estoque-entrada-por-fornecedor.html, telas 5 e 7.
// GET /products/:pid/stock-entries (Aura-backend#950).
//
// Responde às duas perguntas da lojista: "de quem eu compro mais barato?"
// e "quanto paguei da última vez?". Só aparece com pelo menos uma entrada.
// No consolidado (multi-CNPJ) a lista ganha a coluna Loja e o botão de
// entrada some (entrada é sempre de uma loja). Sem custo visível
// (podeVerCusto), as colunas de custo e o destaque somem.
// ============================================================
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { useAuthStore } from "@/stores/auth";
import { fornecedoresDoProdutoApi } from "@/services/suppliersApi";
import { maisBarato } from "@/utils/entradaDeMercadoria";
import { fmtQty } from "@/utils/matconUnits";

const brl = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dia = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

type Props = {
  productId: string;
  unit: string;
  price: number;
  semCusto: boolean;
  onNovaEntrada?: () => void;
};

export function ComprasDoProduto({ productId, unit, price, semCusto, onNovaEntrada }: Props) {
  const { company, consolidatedView } = useAuthStore();
  const cid = company?.id;
  const { data } = useQuery({
    queryKey: ["product-purchases", cid, productId],
    queryFn: () => fornecedoresDoProdutoApi.compras(cid!, productId),
    enabled: !!cid && !!productId,
    staleTime: 30_000,
    retry: 1,
  });
  if (!data || data.indisponivel || !data.entradas?.length) return null;

  const destaque = semCusto ? null : maisBarato(data.por_fornecedor);
  const medio = data.product?.avg_cost ?? data.product?.cost_price ?? null;
  const margem = !semCusto && medio && price > 0 ? Math.round(((price - medio) / price) * 100) : null;
  const variasLojas = !!consolidatedView || new Set(data.entradas.map((e) => e.company_id)).size > 1;

  return (
    <View style={s.card} testID="compras-do-produto">
      <View style={s.head}>
        <Text style={s.title}>Compras deste produto</Text>
        {onNovaEntrada && !consolidatedView ? (
          <Pressable onPress={onNovaEntrada} style={s.btn} testID="compras-nova-entrada">
            <Text style={s.btnTxt}>↓ Nova entrada</Text>
          </Pressable>
        ) : consolidatedView ? <Text style={s.pill}>Selecione uma loja para dar entrada</Text> : null}
      </View>

      {destaque ? (
        <Text style={s.destaque} testID="compras-mais-barato">
          <Text style={{ fontWeight: "700" }}>{destaque.barato.supplier_name}</Text> vende mais barato: {brl(destaque.barato.unit_cost)},
          contra {brl(destaque.caro.unit_cost)} da {destaque.caro.supplier_name} na última compra (<Text style={{ fontWeight: "700" }}>{brl(destaque.diferenca)} a menos por peça</Text>).
        </Text>
      ) : null}

      <View style={s.tabela}>
        <View style={[s.linha, s.cab]}>
          <Text style={[s.c1, s.th]}>Fornecedor</Text>
          <Text style={[s.cn, s.th]}>Comprado</Text>
          {!semCusto ? <Text style={[s.cn, s.th]}>Último custo</Text> : null}
          {!semCusto ? <Text style={[s.cn, s.th]}>Custo médio</Text> : null}
          <Text style={[s.cn, s.th]}>Última</Text>
        </View>
        {data.por_fornecedor.map((f) => (
          <View key={f.supplier_id} style={s.linha}>
            <Text style={[s.c1, s.forte]} numberOfLines={1}>{f.supplier_name}</Text>
            <Text style={s.cn}>{fmtQty(f.quantity || 0, unit)}</Text>
            {!semCusto ? <Text style={[s.cn, destaque && destaque.barato.supplier_id === f.supplier_id && { color: Colors.green, fontWeight: "700" }]}>{brl(f.unit_cost)}</Text> : null}
            {!semCusto ? <Text style={s.cn}>{brl(f.avg_cost)}</Text> : null}
            <Text style={s.cn}>{dia(f.last_purchase_at)}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sec}>Últimas entradas</Text>
      {data.entradas.slice(0, 6).map((e) => (
        <View key={e.id} style={s.entrada}>
          <Text style={s.data}>{dia(e.created_at)}</Text>
          <Text style={s.quem} numberOfLines={1}>
            {e.supplier_name || "Sem fornecedor"}
            {e.notes ? <Text style={s.sub}> · {e.notes}</Text> : null}
            {variasLojas && e.company_name ? <Text style={s.sub}> · {e.company_name}</Text> : null}
          </Text>
          <Text style={s.qtd}>+{fmtQty(e.quantity || 0, unit)}{!semCusto && e.unit_cost ? ` × ${brl(e.unit_cost)}` : ""}</Text>
        </View>
      ))}

      {!semCusto && medio ? (
        <View style={s.rodape}>
          <View style={{ flex: 1 }}>
            <Text style={s.rk}>Custo médio (usado na margem)</Text>
            <Text style={s.rv}>{brl(medio)}</Text>
          </View>
          {margem !== null ? (
            <View style={{ flex: 1 }}>
              <Text style={s.rk}>Margem no preço de {brl(price)}</Text>
              <Text style={[s.rv, { color: margem >= 30 ? Colors.green : margem >= 10 ? Colors.amber : Colors.red }]}>{margem}%</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginTop: 14, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, flexWrap: "wrap" },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: Colors.ink },
  btn: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnTxt: { color: Colors.ink2, fontWeight: "600", fontSize: 12 },
  pill: { fontSize: 11, color: Colors.ink3, backgroundColor: Colors.bg4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  destaque: { margin: 14, marginBottom: 4, backgroundColor: Colors.greenD, color: Colors.green, borderRadius: 12, padding: 10, fontSize: 13 },
  tabela: { paddingHorizontal: 16, paddingTop: 6 },
  linha: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border, gap: 6 },
  cab: { borderTopWidth: 0 },
  th: { fontSize: 10.5, color: Colors.ink3, textTransform: "uppercase", fontWeight: "600" },
  c1: { flex: 2, minWidth: 0, fontSize: 13, color: Colors.ink },
  cn: { flex: 1, textAlign: "right", fontSize: 12.5, color: Colors.ink2 },
  forte: { fontWeight: "600" },
  sec: { fontSize: 11, color: Colors.ink3, textTransform: "uppercase", fontWeight: "600", paddingHorizontal: 16, marginTop: 12, marginBottom: 4 },
  entrada: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 6, alignItems: "center" },
  data: { width: 44, color: Colors.ink3, fontSize: 12.5 },
  quem: { flex: 1, minWidth: 0, color: Colors.ink, fontSize: 13 },
  sub: { color: Colors.ink3, fontSize: 12 },
  qtd: { color: Colors.ink2, fontSize: 12.5 },
  rodape: { flexDirection: "row", gap: 12, padding: 14, marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2 },
  rk: { fontSize: 11.5, color: Colors.ink3 },
  rv: { fontSize: 15, fontWeight: "700", color: Colors.ink, marginTop: 2 },
});
