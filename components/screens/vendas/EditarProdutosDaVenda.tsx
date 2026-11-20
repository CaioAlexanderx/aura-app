import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { SaleDetailsSection } from "@/components/screens/financeiro/SaleDetailsSection";

// ============================================================
// AURA. — "Editar produtos" a partir do detalhe da venda (hotfix 20/11/2026)
//
// O redesenho de 09/11 (PR #1199) tirou do detalhe o "Editar lancamento",
// que abria o TransactionModal do Financeiro — e com ele sumiu o único
// caminho para remover ou adicionar produto numa venda já feita. O
// TransactionModal inteiro NÃO volta: ele editava também a forma de
// pagamento do lançamento e deixava o caixa com a forma antiga.
//
// Aqui abre só a lista de produtos (SaleDetailsSection com somenteProdutos):
// remover = devolução (no crediário abate parcela), adicionar = baixa o
// estoque e soma na venda. Forma, vendedor(a) e cliente continuam no
// "Editar venda".
//
// Ao fechar, invalida a venda em todas as telas que mostram o total (o hook
// do Financeiro só invalida as chaves da empresa ativa; a lista de Vendas no
// consolidado usa a chave "me").
// ============================================================

const CHAVES_DA_VENDA = [
  "sales-list", "sale-detail", "sale-edit-context", "transactions", "transaction-sale-details",
  "dashboard", "me-dashboard", "dre", "products", "customers", "credit", "crediario", "caixa", "commission",
];

export function EditarProdutosDaVenda({ visible, txId, onClose, onSair }: {
  visible: boolean;
  txId: string;
  /** Fecha só esta folha (volta ao detalhe da venda). */
  onClose: () => void;
  /** Fecha esta folha e o detalhe: venda cancelada por inteiro ou ida para a Troca do Caixa. */
  onSair: () => void;
}) {
  const qc = useQueryClient();

  function atualizarVenda() {
    CHAVES_DA_VENDA.forEach(function(k) { qc.invalidateQueries({ queryKey: [k] }); });
  }
  function fechar() { atualizarVenda(); onClose(); }
  function sair() { atualizarVenda(); onSair(); }

  return (
    <ResponsiveSheet visible={visible} onClose={fechar} maxWidth={580}>
      <View style={s.header} testID="venda-editar-produtos-sheet">
        <Text style={s.title} numberOfLines={1}>Itens da venda</Text>
        <Pressable onPress={fechar} style={s.closeBtn} accessibilityRole="button" accessibilityLabel="Fechar" testID="venda-editar-produtos-fechar">
          <Icon name="x" size={16} color={Colors.ink3} />
        </Pressable>
      </View>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={s.body}>
        <SaleDetailsSection txId={txId} onClose={sair} somenteProdutos />
      </ScrollView>
    </ResponsiveSheet>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { flex: 1, minWidth: 0, fontSize: 17, color: Colors.ink, fontWeight: "700" },
  closeBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  body: { padding: 16 },
});

export default EditarProdutosDaVenda;
