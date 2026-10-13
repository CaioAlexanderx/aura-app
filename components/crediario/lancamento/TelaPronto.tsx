// ============================================================
// AURA. — Novo lançamento: tela "Pronto" (12/10/2026)
//
// Redesenho aprovado (docs/mockups/crediario-lancamento-manual.html). Antes,
// ao criar, o modal só fechava — e o carnê que acabou de nascer não era
// oferecido para imprimir nem enviar; a lojista tinha de achar o cliente na
// carteira, abrir a ficha e o carnê. Agora o sucesso mostra o resumo do que
// foi lançado e as saídas que a loja usa na hora:
//   - Imprimir A4 / bobina: printCarne com o account_id que o backend
//     devolveu (só aquele carnê). Chamado SÍNCRONO dentro do clique — a
//     janela de impressão abre antes de qualquer await (services/printWindow);
//   - Enviar no WhatsApp: utils/whatsapp.openWhatsApp, também síncrono (o
//     navegador bloqueia pop-up aberto depois de await). Sem telefone
//     válido o botão some;
//   - Lançar outro: zera o formulário e volta ao passo 1;
//   - Fechar.
// ============================================================
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { printCarne } from "@/services/creditApi";
import { buildWhatsAppUrl, openWhatsApp } from "@/utils/whatsapp";
import { e } from "./estilos";
import { formatIsoToBr } from "@/components/inputs/DateInput";
import { fmtCur, diaMes, listaDeDatas, primeiroNome } from "./calculos";
import type { ResumoDoLancamento } from "./useLancamentoForm";

type Props = {
  companyId: string | null | undefined;
  resumo: ResumoDoLancamento;
  onLancarOutro: () => void;
  onFechar: () => void;
};

/** "Olá Maria, lançamos sua compra de R$ 420,00 em 3x de R$ 140,00 no crediário. 1ª parcela em 11/11." */
export function mensagemDoLancamento(r: ResumoDoLancamento): string {
  const primeira = r.datas[0] ? ` 1ª parcela em ${diaMes(r.datas[0])}.` : "";
  return `Olá ${primeiroNome(r.customerName)}, lançamos sua compra de ${fmtCur(r.valor)} ` +
    `em ${r.parcelas}x de ${fmtCur(r.valorParcela)} no crediário.${primeira}`;
}

function fraseDoResultado(r: ResumoDoLancamento): string {
  const saldo = r.novoSaldo != null ? ` Saldo em aberto agora: ${fmtCur(r.novoSaldo)}.` : "";
  if (r.accountMode === "new") return `O carnê ${r.carneNome} foi criado para ${r.customerName}.${saldo}`;
  if (r.accountMode === "existing" && r.carneNome) {
    return `${r.unificado ? "Unificado no" : "Lançado no"} carnê ${r.carneNome} de ${r.customerName}.${saldo}`;
  }
  return `Lançado na conta de ${r.customerName}.${saldo}`;
}

export function TelaPronto({ companyId, resumo: r, onLancarOutro, onFechar }: Props) {
  const podeImprimir = !!companyId && !!r.customerId;
  const temWhats = !!buildWhatsAppUrl(r.phone);

  const imprimir = (format: "a4" | "bobina") => {
    if (!podeImprimir) return;
    // Síncrono, dentro do clique (ver ClienteCrediarioModal → ImprimirCarnePanel).
    // account_id null = conta geral ("sem carnê"); undefined = backend antigo,
    // imprime o carnê inteiro do cliente como sempre.
    printCarne(companyId!, r.customerId!, { format, accountId: r.accountId });
  };

  const linhas: Array<[string, string]> = [
    ["Valor", fmtCur(r.valor)],
    ["Parcelas", `${r.parcelas}x de ${fmtCur(r.valorParcela)}${r.periodo ? ` · ${r.periodo}` : ""}`],
  ];
  // Com ano: "10/01" sozinho some quando a 1ª parcela cai no ano que vem.
  if (r.datas.length > 0) linhas.push(["1ª parcela", formatIsoToBr(r.datas[0])]);
  if (r.datas.length > 1) linhas.push(["Vencimentos", listaDeDatas(r.datas)]);
  if (r.comprado) linhas.push(["Comprado", r.comprado]);

  return (
    <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} testID="lancamento-pronto">
      <View style={s.done}>
        <View style={s.okic}><Icon name="check" size={30} color={Colors.green} /></View>
        <Text style={s.title}>Lançado no crediário</Text>
        <Text style={s.frase}>{fraseDoResultado(r)}</Text>
      </View>

      <View style={s.ticket}>
        {linhas.map(([k, v]) => (
          <View key={k} style={s.r}>
            <Text style={s.rK}>{k}</Text>
            <Text style={s.rV} numberOfLines={2}>{v}</Text>
          </View>
        ))}
        <View style={[s.r, s.rT]}>
          <Text style={[s.rK, s.rTTxt]}>{r.unificado ? "Total unificado" : r.comJuros ? "Total com juros" : "Total"}</Text>
          <Text style={[s.rV, s.rTTxt]}>{fmtCur(r.total)}</Text>
        </View>
      </View>

      <View style={s.acts}>
        {podeImprimir && (
          <>
            <Pressable style={({ pressed }) => [e.cta, e.ctaSec, s.act, pressed && e.pressed]} onPress={() => imprimir("a4")} testID="lancamento-imprimir-a4" accessibilityRole="button">
              <Icon name="file-text" size={16} color={Colors.violet3} />
              <Text style={[e.ctaSecTxt, { color: Colors.violet3 }]}>Imprimir A4</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [e.cta, e.ctaSec, s.act, pressed && e.pressed]} onPress={() => imprimir("bobina")} testID="lancamento-imprimir-bobina" accessibilityRole="button">
              <Icon name="receipt" size={16} color={Colors.violet3} />
              <Text style={[e.ctaSecTxt, { color: Colors.violet3 }]}>Imprimir bobina</Text>
            </Pressable>
          </>
        )}
        {temWhats && (
          <Pressable
            style={({ pressed }) => [e.cta, e.ctaSec, s.act, pressed && e.pressed]}
            onPress={() => { openWhatsApp(r.phone, mensagemDoLancamento(r)); }}
            testID="lancamento-whatsapp"
            accessibilityRole="button"
          >
            <Icon name="whatsapp" size={16} color={Colors.green} />
            <Text style={e.ctaSecTxt}>Enviar no WhatsApp</Text>
          </Pressable>
        )}
        <Pressable style={({ pressed }) => [e.cta, e.ctaSec, s.act, pressed && e.pressed]} onPress={onLancarOutro} testID="lancamento-outro" accessibilityRole="button">
          <Icon name="plus" size={16} color={Colors.ink} />
          <Text style={e.ctaSecTxt}>Lançar outro</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [e.cta, s.full, pressed && e.pressed]} onPress={onFechar} testID="lancamento-pronto-fechar" accessibilityRole="button">
          <Text style={e.ctaTxt}>Fechar</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  done: { alignItems: "center", gap: 8, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 8 },
  okic: {
    width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.greenD, borderWidth: 1, borderColor: Colors.green,
  },
  title: { fontSize: 18, fontWeight: "800", color: Colors.ink, textAlign: "center" },
  frase: { fontSize: 13, color: Colors.ink2, textAlign: "center", maxWidth: 340, lineHeight: 19 },
  ticket: {
    marginHorizontal: 18, marginTop: 6, gap: 6,
    backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  r: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  rK: { fontSize: 13, color: Colors.ink3 },
  rV: { fontSize: 13, color: Colors.ink, flexShrink: 1, textAlign: "right" },
  rT: { borderTopWidth: 1, borderTopColor: Colors.border2, paddingTop: 8, marginTop: 2 },
  rTTxt: { fontWeight: "800", color: Colors.ink },
  acts: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 },
  act: { flexGrow: 1, flexBasis: "45%", minHeight: 44 },
  full: { flexBasis: "100%", minHeight: 48 },
});
