// ============================================================
// AURA. — Prazo para troca do vale-troca (12/11/2026)
//
// Aparece junto do interruptor "Vale-troca no cupom" quando ele está ligado
// (Políticas do Caixa e o espelho da página Black Friday). Atalhos de 7, 15,
// 30, 60 e 90 dias e um campo livre de 1 a 365; embaixo, o efeito em
// palavras: "No cupom: troca em até 30 dias após a compra".
//
// O campo é só a escolha — quem grava é a tela que o usa (cada uma tem o seu
// caminho de save). Grava pdv_settings.vale_troca_prazo_dias (Aura-backend,
// 1 a 365; ausente = 30). O campo livre aplica ao sair do campo ou no Enter:
// um PUT por número digitado, não um por tecla.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import {
  VALE_TROCA_ATALHOS_DIAS, VALE_TROCA_PRAZO_MAX_DIAS, VALE_TROCA_PRAZO_MIN_DIAS,
  prazoDigitado, textoDoEfeitoDoPrazo,
} from "@/utils/valeTroca";

type Props = {
  /** Prazo atual da loja (lerPrazoDoValeEmDias). */
  dias: number;
  onEscolher: (dias: number) => void;
  disabled?: boolean;
  /** Injetável para teste. */
  hoje?: Date;
};

const ehAtalho = (d: number) => (VALE_TROCA_ATALHOS_DIAS as readonly number[]).indexOf(d) >= 0;

export function ValeTrocaPrazoCampo({ dias, onEscolher, disabled, hoje }: Props) {
  // O campo livre mostra o prazo quando ele não é um dos atalhos.
  const [texto, setTexto] = useState(ehAtalho(dias) ? "" : String(dias));
  const [erro, setErro] = useState(false);
  useEffect(() => {
    setTexto(ehAtalho(dias) ? "" : String(dias));
    setErro(false);
  }, [dias]);

  function aplicarTexto() {
    if (texto.trim() === "") { setErro(false); return; }
    const n = prazoDigitado(texto);
    if (n === null) { setErro(true); return; }
    setErro(false);
    if (n !== dias) onEscolher(n);
  }

  return (
    <View testID="vale-troca-prazo" style={s.box}>
      <Text style={s.label}>Prazo para troca</Text>
      <View style={s.linha}>
        {VALE_TROCA_ATALHOS_DIAS.map((d) => {
          const on = d === dias;
          return (
            <Pressable
              key={d}
              testID={"vale-troca-prazo-atalho-" + d}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: !!disabled }}
              disabled={disabled}
              onPress={() => { if (!on) onEscolher(d); }}
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{d + " dias"}</Text>
            </Pressable>
          );
        })}
        <View style={[s.livre, !ehAtalho(dias) && s.chipOn, erro && s.livreErro]}>
          <TextInput
            testID="vale-troca-prazo-livre"
            value={texto}
            onChangeText={(t) => { setTexto(t.replace(/\D/g, "").slice(0, 3)); setErro(false); }}
            onBlur={aplicarTexto}
            onSubmitEditing={aplicarTexto}
            placeholder="outro"
            placeholderTextColor={Colors.ink3}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={3}
            editable={!disabled}
            accessibilityLabel={"Prazo em dias, de " + VALE_TROCA_PRAZO_MIN_DIAS + " a " + VALE_TROCA_PRAZO_MAX_DIAS}
            style={s.livreInput}
          />
          <Text style={s.livreSufixo}>dias</Text>
        </View>
      </View>
      {erro ? (
        <Text testID="vale-troca-prazo-erro" style={s.erro}>
          {"Use um número de " + VALE_TROCA_PRAZO_MIN_DIAS + " a " + VALE_TROCA_PRAZO_MAX_DIAS + " dias."}
        </Text>
      ) : (
        <Text testID="vale-troca-prazo-efeito" style={s.efeito}>{textoDoEfeitoDoPrazo(dias, hoje)}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box:        { marginTop: 4, marginBottom: 6 },
  label:      { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  linha:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip:       { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  chipOn:     { borderColor: Colors.violet, backgroundColor: Colors.violetD },
  chipTxt:    { fontSize: 12, color: Colors.ink, fontWeight: "600" },
  chipTxtOn:  { color: Colors.violet3 },
  livre:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3 },
  livreErro:  { borderColor: Colors.red },
  livreInput: { width: 44, paddingVertical: 6, fontSize: 12, color: Colors.ink, textAlign: "right" },
  livreSufixo:{ fontSize: 12, color: Colors.ink3 },
  efeito:     { fontSize: 11, color: Colors.ink3, marginTop: 8 },
  erro:       { fontSize: 11, color: Colors.red, marginTop: 8 },
});

export default ValeTrocaPrazoCampo;
