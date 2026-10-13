// ============================================================================
// AURA. — Etiquetas: calibração da impressora (13/10/2026, Divina D'Lux)
//
// Cartão da aba Etiquetas, só nos modelos com vão entre linhas (105x21 e
// 30x25): modo contínuo, passo entre linhas, deslocamento vertical e a
// impressão de teste. Tudo fica guardado NESTE computador (labelPrinterPrefs)
// — a impressora é do PC, não da loja. No padrão, a etiqueta não muda.
// ============================================================================
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { LABEL_SIZE_PRESETS, labelRowPitchMm, labelOffsetYMm, type LabelSizeKey } from "@/components/screens/estoque/labels/buildLabelHtml";
import { defaultLabelPrinterPrefs, isDefaultLabelPrinterPrefs, type LabelPrinterPrefs } from "@/components/screens/estoque/labels/labelPrinterPrefs";

type Props = {
  labelSize: LabelSizeKey;
  prefs: LabelPrinterPrefs;
  onChange: (prefs: LabelPrinterPrefs) => void;
  /** Imprime `rows` linhas de teste (1 = uma linha; 2 = confere o passo). */
  onTest: (rows: number) => void;
};

export function mmBr(n: number): string {
  return n.toFixed(1).replace(".", ",") + " mm";
}

export function LabelPrinterCalibration({ labelSize, prefs, onChange, onTest }: Props) {
  var preset = LABEL_SIZE_PRESETS[labelSize];
  var def = defaultLabelPrinterPrefs(labelSize);
  var noPadrao = isDefaultLabelPrinterPrefs(labelSize, prefs);
  var porLinha = preset.cols + " etiqueta" + (preset.cols > 1 ? "s" : "");

  function setPitch(v: number) { onChange({ ...prefs, rowPitchMm: labelRowPitchMm(labelSize, v) }); }
  function setOffsetY(v: number) { onChange({ ...prefs, offsetYMm: labelOffsetYMm(labelSize, v) }); }

  function stepper(rotulo: string, valor: number, mudou: boolean, onStep: (delta: number) => void, id: string) {
    return (
      <View style={s.ajuste}>
        <Text style={s.ajusteRotulo}>{rotulo}</Text>
        <View style={s.stepper}>
          <Pressable onPress={function() { onStep(-0.1); }} style={s.stepBtn} testID={id + "-menos"} accessibilityRole="button" accessibilityLabel={rotulo + ": diminuir 0,1 mm"}>
            <Text style={s.stepBtnTxt}>−</Text>
          </Pressable>
          <Text style={[s.stepVal, mudou && s.stepValOn]} testID={id + "-valor"}>{mmBr(valor)}</Text>
          <Pressable onPress={function() { onStep(0.1); }} style={s.stepBtn} testID={id + "-mais"} accessibilityRole="button" accessibilityLabel={rotulo + ": aumentar 0,1 mm"}>
            <Text style={s.stepBtnTxt}>+</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.card} testID="etiquetas-calibracao">
      <Pressable
        onPress={function() { onChange({ ...prefs, continuous: !prefs.continuous }); }}
        style={s.toggle}
        testID="etiquetas-modo-continuo"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: prefs.continuous }}
      >
        <View style={[s.checkbox, prefs.continuous && s.checkboxOn]}>{prefs.continuous && <Icon name="check" size={10} color="#fff" />}</View>
        <Text style={s.toggleTxt}>Minha impressora está em modo contínuo</Text>
      </Pressable>
      <Text style={s.ajuda}>
        Use o modo contínuo quando a impressora estiver configurada como mídia contínua e o avanço entre linhas sair errado (ex.: Elgin L42 Pro). O trabalho inteiro sai numa página só, e a posição de cada linha deixa de depender do avanço da impressora.
      </Text>

      <View style={s.ajustes}>
        {stepper("Passo entre linhas", prefs.rowPitchMm, prefs.rowPitchMm !== def.rowPitchMm, function(d) { setPitch(prefs.rowPitchMm + d); }, "etiquetas-passo")}
        {stepper("Deslocamento vertical", prefs.offsetYMm, prefs.offsetYMm !== 0, function(d) { setOffsetY(prefs.offsetYMm + d); }, "etiquetas-desloc-vertical")}
        {!noPadrao && (
          <Pressable onPress={function() { onChange(def); }} style={s.restaurar} testID="etiquetas-calibracao-restaurar">
            <Text style={s.restaurarTxt}>Restaurar padrão</Text>
          </Pressable>
        )}
      </View>
      <Text style={s.ajuda}>
        Padrão do modelo: passo de {mmBr(def.rowPitchMm)} (etiqueta + vão). Deslocamento positivo desce a impressão; negativo sobe. Esses ajustes ficam guardados neste computador.
      </Text>

      <View style={s.testes}>
        <Pressable onPress={function() { onTest(1); }} style={s.testeBtn} testID="etiquetas-linha-de-teste">
          <Icon name="file_text" size={13} color={Colors.violet3} />
          <Text style={s.testeBtnTxt}>Imprimir linha de teste</Text>
        </Pressable>
        <Pressable onPress={function() { onTest(2); }} style={s.testeBtn2} testID="etiquetas-duas-linhas-de-teste">
          <Text style={s.testeBtn2Txt}>2 linhas (confere o passo)</Text>
        </Pressable>
        <Text style={s.testeDica}>Gasta {porLinha} por linha, com marcas nos cantos e régua de 0 a 20 mm.</Text>
      </View>
    </View>
  );
}

var s = StyleSheet.create({
  card: { backgroundColor: Colors.bg3, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleTxt: { fontSize: 12, color: Colors.ink2, fontWeight: "600", flex: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxOn: { backgroundColor: Colors.violet, borderColor: Colors.violet },
  ajuda: { fontSize: 11, color: Colors.ink3, lineHeight: 16 },
  ajustes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  ajuste: { flexDirection: "row", alignItems: "center", gap: 8 },
  ajusteRotulo: { fontSize: 11.5, color: Colors.ink2, fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  stepBtnTxt: { fontSize: 15, color: Colors.violet3, fontWeight: "700" },
  stepVal: { minWidth: 62, textAlign: "center", fontSize: 12.5, fontWeight: "700", color: Colors.ink },
  stepValOn: { color: Colors.violet3 },
  restaurar: { paddingHorizontal: 8, paddingVertical: 6 },
  restaurarTxt: { fontSize: 11.5, color: Colors.violet3, fontWeight: "700" },
  testes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  testeBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.violetD, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border2 },
  testeBtnTxt: { fontSize: 12, color: Colors.violet3, fontWeight: "700" },
  testeBtn2: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.border },
  testeBtn2Txt: { fontSize: 11.5, color: Colors.ink2, fontWeight: "600" },
  testeDica: { fontSize: 11, color: Colors.ink3, flex: 1, minWidth: 180 },
});

export default LabelPrinterCalibration;
