// ============================================================
// ImprimirCarnePanel — Aura · Crediário (10/10/2026)
//
// "Imprimir" do carnê deixou de imprimir direto: abre a escolha
// Folha A4 / Bobina térmica (mockup docs/mockups/
// crediario-carne-a4-e-termica.html, aba "Escolha do formato").
//
//  - A última escolha fica lembrada no aparelho (localStorage); quem nunca
//    escolheu começa na bobina, que é o que já saía antes.
//  - Sem chave Pix o carnê sai sem QR Code: o aviso aparece AQUI, antes de
//    gastar papel, com atalho para onde a chave é cadastrada. A chave é a
//    do canal digital (a que o QR usa), não a da régua de cobrança — ver
//    utils/crediarioCarne.chavePixDoQr.
//
// É um painel da ficha (mesmo padrão de Receber/Pix/Renegociar: desliza por
// cima, cabeçalho com ‹ Voltar, rodapé fixo). No mockup é um sheet de baixo;
// na ficha os sub-sheets de baixo foram aposentados em 03/08 porque
// espremiam o corpo em tela pequena.
//
// O onPrint é chamado DENTRO do gesto do clique: printCarne abre a janela
// de impressão de forma síncrona (services/printWindow) — nada de await
// antes dele aqui.
// ============================================================
import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { ModalPop } from "@/components/anim";
import { lerFormatoCarne, salvarFormatoCarne, type FormatoCarne } from "@/utils/crediarioCarne";
import { m } from "./fichaStyles";

export type ImprimirCarnePanelProps = {
  /** "Compra de 13/09" ou o nome do cliente quando imprime todos. */
  titulo: string;
  /** Parcelas a pagar no que vai ser impresso (só para o subtítulo). */
  parcelas?: number;
  /** string = tem chave; null/"" = sabidamente sem chave (mostra o aviso);
   *  undefined = ainda não sei (não acusa falta do que não conferi). */
  pixKey?: string | null;
  onPrint: (formato: FormatoCarne) => void;
  onBack: () => void;
  onClose: () => void;
  /** Atalho do aviso de Pix. Sem ele o aviso aparece só com o texto. */
  onCadastrarPix?: () => void;
};

const OPCOES: Array<{ key: FormatoCarne; titulo: string; sub: string }> = [
  { key: "a4", titulo: "Folha A4", sub: "Com logo e dados da loja. Parcelas destacáveis." },
  { key: "bobina", titulo: "Bobina térmica", sub: "58 ou 80 mm, na impressora do caixa." },
];

export function ImprimirCarnePanel({
  titulo, parcelas, pixKey, onPrint, onBack, onClose, onCadastrarPix,
}: ImprimirCarnePanelProps) {
  const [formato, setFormato] = useState<FormatoCarne>(() => lerFormatoCarne());
  const semPix = pixKey === null || pixKey === "";
  const sub = parcelas && parcelas > 0
    ? `${titulo} · ${parcelas} parcela${parcelas === 1 ? "" : "s"} a pagar`
    : titulo;

  function imprimir() {
    salvarFormatoCarne(formato);
    onPrint(formato);
  }

  return (
    <View style={m.panel} testID="imprimir-carne-painel">
      <ModalPop visible style={{ flex: 1 }}>
        <View style={m.panelHead}>
          <Pressable onPress={onBack} style={m.panelBack} accessibilityRole="button">
            <View style={{ transform: [{ rotate: "180deg" }] }}>
              <Icon name="chevron_right" size={15} color={Colors.violet3} />
            </View>
            <Text style={m.panelBackTxt}>Voltar</Text>
          </Pressable>
          <Text style={m.panelTitle}>Imprimir carnê</Text>
          <Pressable onPress={onClose} style={m.xBtn}>
            <Icon name="x" size={13} color={Colors.ink3} />
          </Pressable>
        </View>

        <ScrollView style={m.panelBody} contentContainerStyle={{ padding: 16, paddingTop: 12 }} showsVerticalScrollIndicator={true}>
          <Text style={[m.editDueDateSub, { fontSize: 12.5, marginBottom: 12 }]}>{sub}</Text>

          {OPCOES.map(o => {
            const on = formato === o.key;
            return (
              <Pressable
                key={o.key}
                testID={`imprimir-carne-${o.key}`}
                style={[s.opt, on && s.optOn]}
                onPress={() => setFormato(o.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${o.titulo}. ${o.sub}`}
              >
                {/* Miniatura do papel: folha larga ou tira estreita */}
                <View style={s.icBox}>
                  <View style={[s.ic, o.key === "bobina" && s.icNarrow, on && { borderColor: Colors.violet3 }]} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.optT}>{o.titulo}</Text>
                  <Text style={s.optS}>{o.sub}</Text>
                </View>
                <View style={[s.radio, on && s.radioOn]}>
                  {on && <View style={s.radioDot} />}
                </View>
              </Pressable>
            );
          })}

          {semPix && (
            <View style={s.warn} testID="imprimir-carne-sem-pix">
              <Text style={s.warnT}>
                <Text style={{ fontWeight: "800", color: Colors.ink }}>Sem chave Pix cadastrada</Text>
                , o carnê sai sem QR Code. A chave fica em Canal Digital → Meu Site → Pagamentos.
              </Text>
              {!!onCadastrarPix && (
                <Pressable
                  onPress={onCadastrarPix}
                  style={s.warnLink}
                  accessibilityRole="button"
                  testID="imprimir-carne-cadastrar-pix"
                >
                  <Text style={s.warnLinkT}>Cadastrar chave Pix</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>

        <View style={m.panelFoot}>
          <Pressable style={[m.cta, { minHeight: 48, justifyContent: "center" }]} onPress={imprimir} accessibilityRole="button" testID="imprimir-carne-confirmar">
            <Text style={m.ctaTxt}>Imprimir</Text>
          </Pressable>
        </View>
      </ModalPop>
    </View>
  );
}

const s = StyleSheet.create({
  opt: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    padding: 12, marginBottom: 10, minHeight: 56, backgroundColor: Colors.bg3,
  },
  optOn: { borderColor: Colors.violet3, backgroundColor: Colors.violetD },
  icBox: { width: 40, alignItems: "center" },
  ic: { width: 36, height: 46, borderWidth: 1.5, borderColor: Colors.ink3, borderRadius: 3 },
  icNarrow: { width: 20 },
  optT: { fontSize: 14, fontWeight: "700", color: Colors.ink },
  optS: { fontSize: 12, color: Colors.ink3, marginTop: 2, lineHeight: 16 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border2, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: Colors.violet3 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.violet3 },
  warn: {
    marginTop: 4, padding: 12, borderRadius: 11,
    borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, backgroundColor: Colors.bg2,
  },
  warnT: { fontSize: 12, color: Colors.ink2, lineHeight: 17 },
  // Alvo de toque ≥44px mesmo sendo um link de texto.
  warnLink: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  warnLinkT: { fontSize: 12.5, fontWeight: "700", color: Colors.violet3 },
});

export default ImprimirCarnePanel;
