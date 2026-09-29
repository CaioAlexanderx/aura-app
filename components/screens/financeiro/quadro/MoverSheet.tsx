// ============================================================
// Quadro do Financeiro · confirmação do movimento (28/09/2026)
// baixa: data + forma de pagamento · nova_data: novo vencimento ·
// desfazer: só confirma. O calendário é o CalendarioDoDia (o input date
// escondido falha no iPhone).
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, ScrollView, TextInput } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { CalendarioDoDia } from "@/components/CalendarioDoDia";
import { useValoresOcultos } from "@/stores/valoresOcultos";
import { maskCurrency, unmaskNumber } from "@/utils/masks";
import { diferencaPaga, rotulosDaSituacao, textoDaDiferenca } from "@/utils/lancamentoPago";
import { fmt } from "@/components/screens/financeiro/types";
import {
  ddmm, FORMAS_DE_PAGAMENTO, rotulos,
  type CartaoQuadro, type Movimento, type TipoQuadro,
} from "@/utils/quadroFinanceiro";

export type AlvoDoMovimento = { cartao: CartaoQuadro; mov: Movimento } | null;

type Props = {
  alvo: AlvoDoMovimento;
  tipo: TipoQuadro;
  hoje: string;
  onFechar: () => void;
  onConfirmar: (dados: { data?: string; forma?: string | null; valorPago?: number | null }) => void;
};

function somarDias(iso: string, n: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function MoverSheet(props: Props) {
  if (!props.alvo) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={props.onFechar}>
      <Pressable style={s.fundo} onPress={props.onFechar} accessibilityLabel="Fechar">
        <Pressable style={s.caixa} onPress={() => {}} accessibilityRole="none">
          <MoverSheetConteudo {...props} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Conteúdo sem o Modal — separado para o teste de render (o Modal nativo não monta no react-test-renderer). */
export function MoverSheetConteudo({ alvo, tipo, hoje, onFechar, onConfirmar }: Props) {
  const { m } = useValoresOcultos();
  const r = rotulos(tipo);
  const [data, setData] = useState(hoje);
  const [forma, setForma] = useState<string | null>("pix");
  // Valor pago (boleto com juros): vem com o valor do lançamento; só troca quem pagou diferente.
  const [valorPagoStr, setValorPagoStr] = useState("");

  useEffect(() => {
    if (!alvo) return;
    setData(alvo.mov === "nova_data" ? somarDias(hoje, 7) : hoje);
    setForma(alvo.cartao.payment_method || "pix");
    setValorPagoStr(maskCurrency(String(Math.round(alvo.cartao.amount * 100))));
  }, [alvo, hoje]);

  if (!alvo) return null;
  const { cartao, mov } = alvo;
  const jaVenceu = !!cartao.date && cartao.date < hoje;

  const titulo = mov === "baixa" ? r.feito + "?" : mov === "nova_data" ? "Nova data de vencimento" : "Desfazer " + r.baixa + "?";
  const texto = mov === "baixa"
    ? cartao.description + " · " + m(fmt(cartao.amount))
    : mov === "nova_data"
      ? cartao.description + " venceu em " + ddmm(cartao.date) + ". Quando ficou combinado?"
      : cartao.description + " volta a ficar em aberto." + (jaVenceu ? " Como já venceu em " + ddmm(cartao.date) + ", vai para Atrasado." : "");
  const botao = mov === "baixa" ? "Confirmar" : mov === "nova_data" ? "Salvar data" : "Desfazer";
  const dataInvalida = mov === "nova_data" && data < hoje;
  const nums = unmaskNumber(valorPagoStr);
  const valorPago = nums ? parseInt(nums, 10) / 100 : 0;
  const valorInvalido = mov === "baixa" && !(valorPago > 0);
  const dif = mov === "baixa" && valorPago > 0 ? diferencaPaga(valorPago, cartao.amount) : null;
  const rs = rotulosDaSituacao(tipo);
  const bloqueado = dataInvalida || valorInvalido;

  return (
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            <Text style={s.titulo}>{titulo}</Text>
            <Text style={s.texto}>{texto}</Text>

            {mov !== "desfazer" && (
              <View style={{ gap: 6 }}>
                <Text style={s.rotulo}>{mov === "baixa" ? "Data do " + r.baixa : "Novo vencimento"} · {ddmm(data)}</Text>
                <CalendarioDoDia
                  value={data}
                  maxDate={mov === "baixa" ? hoje : undefined}
                  marcas={{}}
                  onEscolher={setData}
                  testID="quadro-calendario"
                />
                {dataInvalida && <Text style={s.aviso}>Escolha hoje ou uma data futura.</Text>}
              </View>
            )}

            {mov === "baixa" && (
              <View style={{ gap: 6 }}>
                <Text style={s.rotulo}>{rs.valor}</Text>
                <TextInput value={valorPagoStr} onChangeText={(v) => setValorPagoStr(maskCurrency(v))} keyboardType="number-pad"
                  style={s.input} placeholder="R$ 0,00" placeholderTextColor={Colors.ink3} testID="quadro-valor-pago" />
                <Text style={s.dica}>{dif ? textoDaDiferenca(dif, tipo, (n) => m(fmt(n))) : "Pagou com juros ou desconto? Digite o valor que pagou."}</Text>
              </View>
            )}

            {mov === "baixa" && (
              <View style={{ gap: 6 }}>
                <Text style={s.rotulo}>Forma de pagamento</Text>
                <View style={s.formas}>
                  {FORMAS_DE_PAGAMENTO.map((f) => (
                    <Pressable key={f.valor} onPress={() => setForma(f.valor)}
                      style={[s.forma, forma === f.valor && s.formaAtiva]}
                      accessibilityRole="button" accessibilityState={{ selected: forma === f.valor }}>
                      <Text style={[s.formaTxt, forma === f.valor && s.formaTxtAtiva]}>{f.rotulo}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={s.botoes}>
              <Pressable onPress={onFechar} style={s.btn} accessibilityRole="button"><Text style={s.btnTxt}>Cancelar</Text></Pressable>
              <Pressable
                onPress={() => { if (!bloqueado) onConfirmar({ data: mov === "desfazer" ? undefined : data, forma: mov === "baixa" ? forma : undefined, valorPago: mov === "baixa" ? valorPago : undefined }); }}
                style={[s.btn, s.btnGo, bloqueado && { opacity: 0.5 }]}
                accessibilityRole="button" testID="quadro-confirmar"
              >
                <Text style={[s.btnTxt, s.btnGoTxt]}>{botao}</Text>
              </Pressable>
            </View>
          </ScrollView>
  );
}

const s = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: "rgba(10,8,30,0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  caixa: { width: "100%", maxWidth: 420, maxHeight: "92%", backgroundColor: Colors.bg3, borderRadius: 16, borderWidth: 1, borderColor: Colors.border2, padding: 20 },
  titulo: { fontFamily: Fonts.heading, fontSize: 26, color: Colors.ink },
  texto: { fontSize: 13.5, color: Colors.ink2, lineHeight: 19 },
  rotulo: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: Colors.ink3 },
  aviso: { fontSize: 12, color: Colors.red, fontWeight: "600" },
  dica: { fontSize: 12, color: Colors.ink3 },
  input: { fontFamily: Fonts.mono, fontSize: 16, color: Colors.ink, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10 },
  formas: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  forma: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 },
  formaAtiva: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  formaTxt: { fontSize: 12.5, fontWeight: "600", color: Colors.ink2 },
  formaTxtAtiva: { color: Colors.violet3 },
  botoes: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  btn: { borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg4, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  btnTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  btnGo: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  btnGoTxt: { color: "#fff" },
});
