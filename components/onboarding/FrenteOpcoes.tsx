import { View, Text, Pressable, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { SEGMENT_LABEL, SEGMENTOS } from "@/constants/primeirosPassos";
import type { Segmento } from "@/services/primeirosPassosApi";

// ============================================================
// Quadros de escolha da frente + extra "Ordem de Serviço" (07/10/2026)
//
// Extraído de components/admin/FrenteSection.tsx (Gestão Aura › Clientes ›
// Frente) sem mudar o visual, para o cliente trocar a própria frente em
// Configurações › Políticas do Caixa (PdvSettingsCard). Um desenho só nos
// dois lugares.
//
// Sem estado nem chamada de API: quem usa guarda a seleção e salva.
//   · opcoes     — frentes mostradas (padrão: as 6). Quem usa filtra o que
//                  o plano não tem (premissa do Essencial: some, não fica
//                  desabilitado).
//   · atual      — frente gravada da empresa; ganha a marca "atual".
//   · o extra não aparece quando a seleção é Assistência técnica (a frente
//     já liga a Ordem de Serviço).
//   · testIDs: <prefix>-opcao-<frente> e <prefix>-extra-os.
//   · paleta     — só para shells com tema próprio (Aura Studio). Sem ela,
//                  o desenho é exatamente o do Gestão Aura.
// ============================================================

export type FrenteOpcoesPaleta = {
  rotulo: string;
  borda: string;
  texto: string;
  selBorda: string;
  selFundo: string;
  selTexto: string;
  meta: string;
};

type Props = {
  selecionada: Segmento | null;
  atual?: Segmento | null;
  onSelecionar: (s: Segmento) => void;
  extraOs: boolean;
  onAlternarExtraOs: () => void;
  opcoes?: Segmento[];
  rotuloOpcoes?: string;
  rotuloExtra?: string;
  desabilitado?: boolean;
  testIDPrefix?: string;
  paleta?: FrenteOpcoesPaleta;
};

export function FrenteOpcoes({
  selecionada, atual = null, onSelecionar, extraOs, onAlternarExtraOs,
  opcoes = SEGMENTOS, rotuloOpcoes = "Trocar para", rotuloExtra = "Extra",
  desabilitado = false, testIDPrefix = "frente", paleta,
}: Props) {
  const p = paleta;
  const chip = (on: boolean) => [
    s.chip, p && { borderColor: p.borda },
    on && s.chipOn, on && p && { borderColor: p.selBorda, backgroundColor: p.selFundo },
  ];
  const chipText = (on: boolean) => [
    s.chipText, p && { color: p.texto },
    on && s.chipTextOn, on && p && { color: p.selTexto },
  ];
  const label = [s.label, p && { color: p.rotulo }];
  return (
    <>
      <Text style={label}>{rotuloOpcoes}</Text>
      <View style={s.grid}>
        {opcoes.map((k) => {
          const on = selecionada === k;
          return (
            <Pressable
              key={k}
              onPress={() => onSelecionar(k)}
              disabled={desabilitado}
              style={chip(on)}
              testID={testIDPrefix + "-opcao-" + k}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={chipText(on)}>{SEGMENT_LABEL[k]}</Text>
              {atual === k && <Text style={[s.chipMeta, p && { color: p.meta }]}>atual</Text>}
            </Pressable>
          );
        })}
      </View>

      {selecionada !== "assistencia" && (
        <>
          <Text style={label}>{rotuloExtra}</Text>
          <View style={s.grid}>
            <Pressable
              onPress={onAlternarExtraOs}
              disabled={desabilitado}
              style={chip(extraOs)}
              testID={testIDPrefix + "-extra-os"}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: extraOs }}
            >
              <Text style={chipText(extraOs)}>{extraOs ? "✓ " : "+ "}Ordem de Serviço</Text>
            </Pressable>
          </View>
        </>
      )}
    </>
  );
}

// Mesmos valores que FrenteSection usava (label/grid/chip*).
const s = StyleSheet.create({
  label: { fontSize: 11, color: Colors.ink3, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  chipOn: { borderColor: Colors.violet, backgroundColor: Colors.violet + "1F" },
  chipText: { fontSize: 12, color: Colors.ink2, fontWeight: "600" },
  chipTextOn: { color: Colors.violet3 },
  chipMeta: { fontSize: 10, color: Colors.ink3 },
});

export default FrenteOpcoes;
