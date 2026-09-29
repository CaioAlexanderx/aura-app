// ============================================================
// Quadro do Financeiro · cartão de um lançamento (28/09/2026)
// Arrasta no web (useDraggableCardRef da fila do Studio); no celular a ação
// fica no botão do próprio cartão.
// ============================================================
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { useDraggableCardRef } from "@/components/studio/kanban/useStudioKanbanDnD";
import { useValoresOcultos } from "@/stores/valoresOcultos";
import { fmt } from "@/components/screens/financeiro/types";
import { diferencaPaga } from "@/utils/lancamentoPago";
import {
  ddmm, mesDeOrigem, rotuloDaForma, rotulos, seloDoPrazo,
  type CartaoQuadro, type ColunaQuadro, type Movimento, type TipoQuadro,
} from "@/utils/quadroFinanceiro";

type Props = {
  cartao: CartaoQuadro;
  coluna: ColunaQuadro;
  tipo: TipoQuadro;
  hoje: string;
  mes: string;
  arrastavel: boolean;
  arrastando: boolean;
  onInicio: (id: string) => void;
  onFim: () => void;
  onAcao: (cartao: CartaoQuadro, de: ColunaQuadro, mov: Movimento) => void;
  /** Abre o "Editar lançamento" (valor com juros/mora, descrição, data...). */
  onEditar?: (cartao: CartaoQuadro) => void;
};

export function QuadroCartao({ cartao, coluna, tipo, hoje, mes, arrastavel, arrastando, onInicio, onFim, onAcao, onEditar }: Props) {
  const ref = useDraggableCardRef(arrastavel && cartao.movable, cartao.id, onInicio, onFim);
  const { m } = useValoresOcultos();
  const r = rotulos(tipo);
  const selo = seloDoPrazo(cartao, coluna, hoje);
  const origem = coluna === "atrasado" ? mesDeOrigem(cartao, mes) : null;
  const forma = rotuloDaForma(cartao.payment_method);
  // Dia do pagamento em São Paulo (baixa feita às 22h é 03h UTC do dia seguinte).
  const pagoEm = cartao.paid_at ? ddmm(new Date(cartao.paid_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })) : null;
  // Pago com juros ou desconto: o cartão mostra o valor original e a diferença.
  const dif = coluna === "feito" ? diferencaPaga(cartao.amount, cartao.original_amount) : null;

  return (
    <View ref={ref} style={[s.card, arrastando && s.cardArrastando]} testID={"quadro-cartao-" + cartao.id}>
      <View style={s.linha1}>
        <Text style={s.desc} numberOfLines={2}>{cartao.description}</Text>
        <Text style={s.valor}>{m(fmt(cartao.amount))}</Text>
      </View>
      <View style={s.meta}>
        <Text style={s.chip}>{cartao.category || "Outros"}</Text>
        {selo && (
          <Text style={[s.chip, selo.tom === "atraso" ? s.chipAtraso : selo.tom === "breve" ? s.chipBreve : null]}>{selo.texto}</Text>
        )}
        {origem && <Text style={[s.chip, s.chipOrigem]}>{origem}</Text>}
        {coluna === "feito" && (
          <Text style={[s.chip, s.chipOk]}>
            {r.feito}{pagoEm ? " " + pagoEm : ""}{forma ? " · " + forma : ""}
          </Text>
        )}
        {dif && (
          <Text style={[s.chip, s.chipBreve]} testID={"quadro-diferenca-" + cartao.id}>
            Original {m(fmt(cartao.original_amount as number))} · {dif.sentido === "mais" ? "+" : "−"}{m(fmt(dif.valor))}
          </Text>
        )}
        {cartao.recurrence_type && <Text style={s.chip}>Recorrente</Text>}
      </View>
      {cartao.movable ? (
        <View style={s.acoes}>
          {coluna === "feito" ? (
            <Pressable onPress={() => onAcao(cartao, coluna, "desfazer")} style={s.btn} accessibilityRole="button" testID={"quadro-desfazer-" + cartao.id}>
              <Text style={s.btnTxt}>Desfazer</Text>
            </Pressable>
          ) : (
            <>
              <Pressable onPress={() => onAcao(cartao, coluna, "baixa")} style={[s.btn, s.btnOk]} accessibilityRole="button" testID={"quadro-baixa-" + cartao.id}>
                <Text style={[s.btnTxt, s.btnOkTxt]}>{r.acao}</Text>
              </Pressable>
              {coluna === "atrasado" && (
                <Pressable onPress={() => onAcao(cartao, coluna, "nova_data")} style={s.btn} accessibilityRole="button" testID={"quadro-nova-data-" + cartao.id}>
                  <Text style={s.btnTxt}>Nova data</Text>
                </Pressable>
              )}
            </>
          )}
          {onEditar && (
            <Pressable onPress={() => onEditar(cartao)} style={s.btn} accessibilityRole="button" testID={"quadro-editar-" + cartao.id}>
              <Text style={s.btnTxt}>Editar</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Text style={s.travado}>Muda pela venda ou pelo fluxo de origem</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, gap: 7 },
  cardArrastando: { opacity: 0.45 },
  linha1: { flexDirection: "row", gap: 8, alignItems: "flex-start", justifyContent: "space-between" },
  desc: { flex: 1, fontSize: 13, fontWeight: "600", color: Colors.ink, lineHeight: 17 },
  valor: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: "500", color: Colors.ink, fontVariant: ["tabular-nums"] },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { fontSize: 10.5, fontWeight: "600", color: Colors.ink2, backgroundColor: Colors.bg4, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2, overflow: "hidden" },
  chipAtraso: { color: Colors.red, backgroundColor: Colors.redD },
  chipBreve: { color: Colors.amber, backgroundColor: Colors.amberD },
  chipOk: { color: Colors.green, backgroundColor: Colors.greenD },
  chipOrigem: { color: Colors.violet3, backgroundColor: Colors.violetD },
  acoes: { flexDirection: "row", gap: 6, marginTop: 2 },
  btn: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  btnTxt: { fontSize: 11.5, fontWeight: "600", color: Colors.ink2 },
  btnOk: { borderColor: Colors.green },
  btnOkTxt: { color: Colors.green },
  travado: { fontSize: 11, color: Colors.ink3, fontStyle: "italic" },
});
