// ============================================================
// AURA. — Estoque: "Quantas chegaram de cada?" (grade da entrada)
//
// Saiu do EntradaMercadoriaModal (03/11/2026) em 17/11/2026 para o
// "Chegou mercadoria" usar a mesma escolha de cor e tamanho (A4b e A5).
// Uma linha por variante: rótulo, quanto tem hoje e quantas chegaram.
// ============================================================
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { fmtQty } from "@/utils/matconUnits";
import { numeroPositivo } from "@/utils/entradaDeMercadoria";
import { rotuloDaVariante } from "./VariantesConsulta";
import { corETamanhoDaVariante } from "@/utils/nomeDaCor";
import { ordenarPeloTamanhoNaCor } from "@/utils/ordemDeTamanhos";

type Props = {
  variantes: any[];
  /** variant_id -> texto digitado ("3", "1,5"). */
  grade: Record<string, string>;
  onChange: (grade: Record<string, string>) => void;
  testIDPrefixo?: string;
};

export function GradeDaEntrada({ variantes, grade, onChange, testIDPrefixo }: Props) {
  return (
    <View style={s.grade}>
      {/* 23/11/2026 (p-200): tamanhos em ordem dentro de cada cor. */}
      {ordenarPeloTamanhoNaCor(variantes || [], corETamanhoDaVariante).map((v) => (
        <View key={v.id} style={s.gradeLinha}>
          <Text style={s.gradeNome} numberOfLines={1}>{rotuloDaVariante(v)}</Text>
          <Text style={s.gradeTem}>tem {fmtQty(parseFloat(v.stock_qty) || 0)}</Text>
          <TextInput
            value={grade[v.id] || ""}
            onChangeText={(t) => onChange({ ...grade, [v.id]: t.replace(/[^\d,]/g, "") })}
            placeholder="0"
            placeholderTextColor={Colors.ink3}
            keyboardType="number-pad"
            accessibilityLabel={rotuloDaVariante(v)}
            style={[s.input, s.gradeInput, numeroPositivo(grade[v.id]) ? s.gradeOn : null] as any}
            testID={testIDPrefixo ? testIDPrefixo + v.id : undefined}
          />
        </View>
      ))}
    </View>
  );
}

/** Soma da grade e o que vai no corpo (só as variantes com quantidade). */
export function lerGrade(grade: Record<string, string>): { total: number; itens: Array<{ variant_id: string; quantidade: number }> } {
  const itens = Object.keys(grade)
    .map((id) => ({ variant_id: id, quantidade: numeroPositivo(grade[id]) || 0 }))
    .filter((i) => i.quantidade > 0);
  return { total: itens.reduce((t, i) => t + i.quantidade, 0), itens };
}

const s = StyleSheet.create({
  grade: { gap: 6 },
  gradeLinha: { flexDirection: "row", alignItems: "center", gap: 10 },
  gradeNome: { flex: 1, minWidth: 0, color: Colors.ink, fontWeight: "600", fontSize: 13 },
  gradeTem: { color: Colors.ink3, fontSize: 11.5, width: 56, textAlign: "right" },
  input: { borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.ink, backgroundColor: Colors.bg2, minHeight: 42 },
  gradeInput: { width: 70, textAlign: "center", paddingHorizontal: 6 },
  gradeOn: { borderColor: Colors.violet, backgroundColor: Colors.violetD },
});

export default GradeDaEntrada;
