// ============================================================
// Quadro do Financeiro · "Pagar vários" (F2 · 28/09/2026)
// Uma data e uma forma para todos; o valor pago de cada um já vem com o valor
// do lançamento e só muda quem pagou com juros ou desconto.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, ScrollView, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { CalendarioDoDia } from "@/components/CalendarioDoDia";
import { useValoresOcultos } from "@/stores/valoresOcultos";
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import { fmt } from "@/components/screens/financeiro/types";
import { diferencaPaga, rotulosDaSituacao, textoDaDiferenca } from "@/utils/lancamentoPago";
import { ddmm, FORMAS_DE_PAGAMENTO, type CartaoQuadro, type TipoQuadro } from "@/utils/quadroFinanceiro";

type Props = {
  cartoes: CartaoQuadro[] | null;
  tipo: TipoQuadro;
  hoje: string;
  onFechar: () => void;
  onConfirmar: (dados: { itens: { cartao: CartaoQuadro; valorPago: number }[]; data: string; forma: string | null }) => void;
};

const paraMascara = (n: number) => maskCurrency(String(Math.round(n * 100)));
const deMascara = (s: string) => { const d = unmaskNumber(s); return d ? parseInt(d, 10) / 100 : 0; };

export function LoteSheet(props: Props) {
  if (!props.cartoes || !props.cartoes.length) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={props.onFechar}>
      <Pressable style={s.fundo} onPress={props.onFechar} accessibilityLabel="Fechar">
        <Pressable style={s.caixa} onPress={() => {}} accessibilityRole="none">
          <LoteSheetConteudo {...props} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Conteúdo sem o Modal (o Modal nativo não monta no react-test-renderer). */
export function LoteSheetConteudo({ cartoes, tipo, hoje, onFechar, onConfirmar }: Props) {
  const { m } = useValoresOcultos();
  const rs = rotulosDaSituacao(tipo);
  const [data, setData] = useState(hoje);
  const [forma, setForma] = useState<string | null>(tipo === "expense" ? "boleto" : "pix");
  const [valores, setValores] = useState<Record<string, string>>({});

  useEffect(() => {
    const v: Record<string, string> = {};
    (cartoes || []).forEach((c) => { v[c.id] = paraMascara(c.amount); });
    setValores(v);
    setData(hoje);
  }, [cartoes, hoje]);

  const lista = cartoes || [];
  const itens = lista.map((c) => ({ cartao: c, valorPago: deMascara(valores[c.id] ?? paraMascara(c.amount)) }));
  const total = itens.reduce((a, i) => a + i.valorPago, 0);
  const aMais = itens.reduce((a, i) => { const d = diferencaPaga(i.valorPago, i.cartao.amount); return d && d.sentido === "mais" ? a + d.valor : a; }, 0);
  const invalido = itens.some((i) => !(i.valorPago > 0));

  return (
    <ScrollView contentContainerStyle={{ gap: 12 }}>
      <Text style={s.titulo}>{tipo === "expense" ? "Pagar " : "Receber "}{lista.length} {lista.length === 1 ? "lançamento" : "lançamentos"}</Text>

      <View style={{ gap: 6 }}>
        <Text style={s.rotulo}>{rs.data} · {ddmm(data)}</Text>
        <CalendarioDoDia value={data} maxDate={hoje} marcas={{}} onEscolher={setData} testID="lote-calendario" />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={s.rotulo}>Forma de pagamento</Text>
        <View style={s.formas}>
          {FORMAS_DE_PAGAMENTO.map((f) => (
            <Pressable key={f.valor} onPress={() => setForma(f.valor)} style={[s.forma, forma === f.valor && s.formaAtiva]}
              accessibilityRole="button" accessibilityState={{ selected: forma === f.valor }}>
              <Text style={[s.formaTxt, forma === f.valor && s.formaTxtAtiva]}>{f.rotulo}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={s.rotulo}>{rs.valor} de cada um</Text>
        {itens.map(({ cartao, valorPago }) => {
          const dif = valorPago > 0 ? diferencaPaga(valorPago, cartao.amount) : null;
          return (
            <View key={cartao.id} style={s.item}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.itemDesc} numberOfLines={1}>{cartao.description}</Text>
                <Text style={s.itemMeta}>
                  {cartao.date ? "Venc. " + ddmm(cartao.date) + " · " : ""}{m(fmt(cartao.amount))}
                  {dif ? " · " + textoDaDiferenca(dif, tipo, (n) => m(fmt(n))) : ""}
                </Text>
              </View>
              <TextInput
                value={valores[cartao.id] ?? ""}
                onChangeText={(v) => setValores((x) => ({ ...x, [cartao.id]: maskCurrency(v) }))}
                keyboardType="number-pad" style={s.input} testID={"lote-valor-" + cartao.id}
              />
            </View>
          );
        })}
      </View>

      <Text style={s.total}>
        Total {m(fmt(total))}{aMais > 0 ? " · " + m(fmt(aMais)) + (tipo === "expense" ? " de juros ou multa" : " a mais") : ""}
      </Text>

      <View style={s.botoes}>
        <Pressable onPress={onFechar} style={s.btn} accessibilityRole="button"><Text style={s.btnTxt}>Cancelar</Text></Pressable>
        <Pressable
          onPress={() => { if (!invalido) onConfirmar({ itens, data, forma }); }}
          style={[s.btn, s.btnGo, invalido && { opacity: 0.5 }]} accessibilityRole="button" testID="lote-confirmar"
        >
          <Text style={[s.btnTxt, s.btnGoTxt]}>{tipo === "expense" ? "Pagar" : "Receber"} {lista.length}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: "rgba(10,8,30,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  caixa: { width: "100%", maxWidth: 480, maxHeight: "92%", backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border2, padding: 20 },
  titulo: { fontFamily: Fonts.heading, fontSize: 26, color: Colors.ink },
  rotulo: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.ink3 },
  formas: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  forma: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 },
  formaAtiva: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  formaTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2 },
  formaTxtAtiva: { color: Colors.violet3 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemDesc: { fontSize: 13, fontWeight: "600", color: Colors.ink },
  itemMeta: { fontSize: 11.5, color: Colors.ink3 },
  input: { width: 116, fontFamily: Fonts.mono, fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, textAlign: "right" },
  total: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  botoes: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  btn: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  btnTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  btnGo: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnGoTxt: { color: "#fff" },
});
