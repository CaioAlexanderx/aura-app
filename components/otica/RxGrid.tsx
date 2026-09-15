// ============================================================
// AURA. — Ótica: grade da receita (OD/OE)
//
// Duas linhas (olho direito, olho esquerdo) × seis colunas (esférico,
// cilíndrico, eixo, adição, DNP, altura). É a mesma grade do papel do
// médico, de propósito: o vendedor digita com a receita na mão e o olho
// vai do papel pra tela sem "traduzir" nada. Fonte mono e números
// centralizados pra coluna alinhar como no receituário.
//
// Regras embutidas (mockup docs/mockups/otica-modulo.html, 15/09/2026):
//   - graus em passos de 0,25 — a lente existe nesse passo; ao sair do
//     campo o valor é arredondado ("-1,8" vira "−1,75")
//   - eixo inteiro de 0 a 180
//   - DNP e altura em mm com uma casa
//   - sinal sempre mostrado ("+2,00"), porque omitir o "+" é o erro
//     clássico que manda a lente errada pro laboratório
//
// `onChange` ausente = modo leitura (detalhe da OS, ficha do cliente).
// ============================================================
import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import {
  type EyeRx, fmtDiopter, fmtAxis, fmtMm, parseDiopter, snapQuarter,
} from "@/services/oticaApi";

type Col = { key: keyof EyeRx; label: string; kind: "diopter" | "axis" | "mm" };

const COLS: Col[] = [
  { key: "sph", label: "Esférico", kind: "diopter" },
  { key: "cyl", label: "Cilíndrico", kind: "diopter" },
  { key: "axis", label: "Eixo", kind: "axis" },
  { key: "add", label: "Adição", kind: "diopter" },
  { key: "pd", label: "DNP", kind: "mm" },
  { key: "height", label: "Altura", kind: "mm" },
];

function fmtCell(col: Col, v: number | null): string {
  if (col.kind === "diopter") return fmtDiopter(v);
  if (col.kind === "axis") return fmtAxis(v);
  return fmtMm(v);
}

/** Normaliza o que foi digitado para o valor guardado. NaN = inválido. */
export function normalizeCell(col: { kind: Col["kind"] }, raw: string): number | null {
  const n = parseDiopter(raw);
  if (n === null) return null;
  if (Number.isNaN(n)) return NaN;
  if (col.kind === "diopter") return snapQuarter(n);
  if (col.kind === "axis") return Math.min(180, Math.max(0, Math.round(n)));
  return Math.round(n * 10) / 10;
}

/** Texto do campo em modo edição: sem símbolo de grau nem "—". */
function editText(col: Col, v: number | null): string {
  if (v == null || Number.isNaN(v)) return "";
  if (col.kind === "diopter") return fmtDiopter(v).replace("−", "-");
  if (col.kind === "axis") return String(Math.round(v));
  return fmtMm(v);
}

type Props = {
  od: EyeRx;
  oe: EyeRx;
  onChange?: (eye: "od" | "oe", patch: Partial<EyeRx>) => void;
  /** Esconde DNP/altura (receita do médico não traz; a loja mede depois). */
  hideMeasures?: boolean;
  testID?: string;
};

export function RxGrid({ od, oe, onChange, hideMeasures, testID }: Props) {
  const cols = hideMeasures ? COLS.filter((c) => c.kind !== "mm") : COLS;
  const editable = !!onChange;
  return (
    <View style={st.wrap} testID={testID}>
      <View style={st.headRow}>
        <View style={st.eyeCell} />
        {cols.map((c) => (
          <Text key={c.key} style={st.head}>{c.label}</Text>
        ))}
      </View>
      {(["od", "oe"] as const).map((eye) => {
        const rx = eye === "od" ? od : oe;
        return (
          <View key={eye} style={st.row}>
            <View style={st.eyeCell}>
              <Text style={st.eye}>{eye.toUpperCase()}</Text>
              <Text style={st.eyeSub}>{eye === "od" ? "direito" : "esquerdo"}</Text>
            </View>
            {cols.map((c) => (
              editable
                ? <Cell key={c.key} col={c} value={rx[c.key] as number | null} onCommit={(v) => onChange!(eye, { [c.key]: v } as Partial<EyeRx>)} testID={testID ? `${testID}-${eye}-${c.key}` : undefined} />
                : <Text key={c.key} style={[st.value, (rx[c.key] == null) && st.valueEmpty]}>{fmtCell(c, rx[c.key] as number | null)}</Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function Cell({ col, value, onCommit, testID }: { col: Col; value: number | null; onCommit: (v: number | null) => void; testID?: string }) {
  const [text, setText] = useState(editText(col, value));
  const [bad, setBad] = useState(false);
  return (
    <TextInput
      style={[st.input, bad && st.inputBad]}
      value={text}
      onChangeText={(t) => { setText(t); setBad(false); }}
      onBlur={() => {
        const n = normalizeCell(col, text);
        if (n !== null && Number.isNaN(n)) { setBad(true); return; }
        setText(editText(col, n));
        onCommit(n);
      }}
      placeholder={col.kind === "axis" ? "0–180" : col.kind === "mm" ? "mm" : "0,00"}
      placeholderTextColor={Colors.ink3}
      keyboardType={Platform.OS === "web" ? "default" : "numbers-and-punctuation"}
      testID={testID}
    />
  );
}

const st = StyleSheet.create({
  wrap: { gap: 6 },
  headRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  head: { flex: 1, textAlign: "center", fontSize: 9, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: Colors.ink3 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyeCell: { width: 52 },
  eye: { fontSize: 13, fontWeight: "800", color: Colors.ink },
  eyeSub: { fontSize: 9, color: Colors.ink3 },
  value: { flex: 1, textAlign: "center", fontSize: 14, color: Colors.ink, fontFamily: Fonts.mono, paddingVertical: 8 },
  valueEmpty: { color: Colors.ink3 },
  input: {
    flex: 1, textAlign: "center", fontSize: 13, color: Colors.ink, fontFamily: Fonts.mono,
    backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 8,
    paddingVertical: 9, paddingHorizontal: 4, minWidth: 0,
  },
  inputBad: { borderColor: Colors.red },
});
