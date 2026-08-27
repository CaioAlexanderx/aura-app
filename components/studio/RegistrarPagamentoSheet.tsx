// ============================================================
// AURA STUDIO · Sheet de baixa do saldo da encomenda
//
// 27/08/2026 (relato Sheid Mania). Um só sheet pro Kanban de Produção e pra
// aba "A receber" do Hub de Pedidos — as duas telas onde a lojista olha uma
// encomenda e lembra que o cliente já pagou.
//
// O QUE ELE PERGUNTA, E POR QUÊ
//   VALOR — vem preenchido com o saldo inteiro, que é o caso de 9 em 10
//   cliques. Editável porque pagamento parcial acontece ("paguei metade
//   agora"), e sem o campo a lojista teria que escolher entre lançar errado
//   ou não lançar.
//   FORMA — decide em qual linha do caixa isso cai. Um botão que lançasse
//   direto seria irreversível E mudo sobre a forma; ninguém confere o extrato
//   depois.
//
// Não há confirmação em dois passos além deste sheet: o sheet JÁ é a
// confirmação, e empilhar um Alert em cima faria a lojista aprender a clicar
// "sim" sem ler.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { Icon } from "@/components/Icon";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { StudioPalette } from "@/constants/studio-tokens";
import { StudioBottomSheet } from "@/components/studio/StudioBottomSheet";
import {
  FORMAS_PAGAMENTO,
  type FormaPagamento,
  type RegistrarPagamentoController,
} from "@/components/studio/useRegistrarPagamento";
import { parseValorBR, erroDoValor, ehParcial, restanteApos } from "@/components/studio/baixaDeSaldo";

export function RegistrarPagamentoSheet({ controller }: { controller: RegistrarPagamentoController }) {
  const { alvo, salvando, fechar, confirmar } = controller;
  const t = useStudioTokens();
  const s = useMemo(() => buildStyles(t), [t]);

  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [valorTxt, setValorTxt] = useState("");

  // Reabrir o sheet noutra encomenda tem que trazer o valor DAQUELA. Sem isto
  // o campo guardaria o valor da anterior — e a lojista lançaria o número
  // errado sem perceber, porque o campo "já vem preenchido" mesmo.
  useEffect(() => {
    if (alvo) {
      setValorTxt(alvo.amount.toFixed(2).replace(".", ","));
      setForma("dinheiro");
    }
  }, [alvo]);

  const saldo = alvo?.amount ?? 0;
  const valor = parseValorBR(valorTxt);
  const erro = erroDoValor(valor, saldo);
  const acimaDoSaldo = erro === "acima";
  const invalido = erro !== null;
  const parcial = ehParcial(valor, saldo);

  return (
    <StudioBottomSheet
      visible={!!alvo}
      onClose={fechar}
      eyebrow="Saldo da encomenda"
      title={alvo?.customerName ? `Recebido de ${alvo.customerName}` : "Registrar pagamento"}
    >
      <View style={s.body}>
        <View style={s.saldoBox}>
          <Text style={s.saldoLabel}>Saldo em aberto</Text>
          <Text style={[s.saldoValor, alvo?.status === "overdue" && { color: t.dangerInk }]}>
            R$ {saldo.toFixed(2).replace(".", ",")}
          </Text>
        </View>

        <Text style={s.campoLabel}>Quanto entrou</Text>
        <View style={[s.inputWrap, acimaDoSaldo && { borderColor: t.danger }]}>
          <Text style={s.inputPrefix}>R$</Text>
          <TextInput
            style={s.input}
            value={valorTxt}
            onChangeText={setValorTxt}
            keyboardType="decimal-pad"
            inputMode="decimal"
            selectTextOnFocus
            editable={!salvando}
            placeholder="0,00"
            placeholderTextColor={t.ink4}
          />
        </View>
        {acimaDoSaldo ? (
          <Text style={s.aviso}>Maior que o saldo em aberto. O máximo é R$ {saldo.toFixed(2).replace(".", ",")}.</Text>
        ) : parcial ? (
          <Text style={s.avisoNeutro}>
            Pagamento parcial — a encomenda segue em "A receber" com R$ {restanteApos(valor as number, saldo).toFixed(2).replace(".", ",")}.
          </Text>
        ) : null}

        <Text style={[s.campoLabel, { marginTop: 18 }]}>Como o cliente pagou</Text>
        <View style={s.formas}>
          {FORMAS_PAGAMENTO.map((f) => {
            const ativa = forma === f.key;
            return (
              <Pressable
                key={f.key}
                style={[s.forma, ativa && s.formaAtiva]}
                disabled={salvando}
                onPress={() => setForma(f.key)}
              >
                <Icon name={f.icon} size={14} color={ativa ? t.primary : t.ink3} />
                <Text style={[s.formaTxt, ativa && s.formaTxtAtiva]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[s.btnConfirmar, (invalido || salvando) && s.btnDisabled]}
          disabled={invalido || salvando}
          onPress={() => confirmar(valor as number, forma)}
        >
          {salvando ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="check" size={15} color="#fff" />
              <Text style={s.btnConfirmarTxt}>Registrar recebimento</Text>
            </>
          )}
        </Pressable>

        <Text style={s.rodape}>Entra no caixa de hoje e baixa o "A receber" desta encomenda.</Text>
      </View>
    </StudioBottomSheet>
  );
}

const buildStyles = (t: StudioPalette) => StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 4 },
  saldoBox: {
    backgroundColor: t.bgSoft,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  saldoLabel: { fontSize: 12, color: t.ink3, fontWeight: "600", marginBottom: 4 },
  saldoValor: { fontSize: 26, color: t.ink, fontWeight: "800", letterSpacing: -0.5 },
  campoLabel: { fontSize: 12.5, color: t.ink2, fontWeight: "700", marginBottom: 8 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: t.ink5,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: t.paperCardElev,
  },
  inputPrefix: { fontSize: 15, color: t.ink3, fontWeight: "700", marginRight: 8 },
  input: { flex: 1, fontSize: 19, color: t.ink, fontWeight: "700", paddingVertical: 12 },
  aviso: { fontSize: 11.5, color: t.dangerInk, marginTop: 6, fontWeight: "600" },
  avisoNeutro: { fontSize: 11.5, color: t.ink3, marginTop: 6 },
  formas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  forma: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: t.ink5,
    backgroundColor: t.paperCard,
  },
  formaAtiva: { borderColor: t.primary, backgroundColor: t.primaryGhost },
  formaTxt: { fontSize: 13, color: t.ink3, fontWeight: "600" },
  formaTxtAtiva: { color: t.primary, fontWeight: "700" },
  btnConfirmar: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: t.success,
    borderRadius: 14,
    paddingVertical: 15,
  },
  btnDisabled: { opacity: 0.45 },
  btnConfirmarTxt: { fontSize: 15, color: "#fff", fontWeight: "800" },
  rodape: { fontSize: 11.5, color: t.ink3, textAlign: "center", marginTop: 12 },
});
