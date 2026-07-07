// ============================================================
// Seção "Faixa atual" — SOMENTE no cadastro (modo criação).
// Captura a faixa inicial do praticante; o backend semeia a trajetória
// (karate_belt_history) com essa entrada. Na edição a faixa é gerida pela
// aba Trajetória (append-only), então esta seção não aparece lá.
// Reusa BELT_OPTIONS/DAN_OPTIONS/BELT_KYUS/buildBeltName do módulo de
// graduação para manter o de-para de faixas idêntico ao resto do app.
// ============================================================
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Icon } from "@/components/Icon";
import { KarateBelts, BeltKey, ShojiPalette as P, KarateFonts as F } from "@/constants/karateTheme";
import { BELT_OPTIONS, DAN_OPTIONS, BELT_KYUS, buildBeltName } from "../praticante-detalhe/helpers";
import { styles as shared } from "./shared-styles";

export type FaixaBody = { belt_level: string; belt_name: string; belt_schema: string };

// Constrói o corpo (belt_level/belt_name/belt_schema) a partir da seleção.
export function faixaToBody(beltKey: BeltKey | null, danDeg: number | null, kyuDeg: number | null): FaixaBody | null {
  if (!beltKey) return null;
  return {
    belt_level: beltKey,
    belt_name: buildBeltName(beltKey, danDeg ?? undefined, kyuDeg ?? undefined),
    belt_schema: "fpkt_shotokan",
  };
}

interface Props {
  beltKey: BeltKey | null;
  danDeg: number | null;
  kyuDeg: number | null;
  onChangeBelt: (k: BeltKey) => void;
  onChangeDan: (d: number | null) => void;
  onChangeKyu: (k: number | null) => void;
}

export function FaixaSection({ beltKey, danDeg, kyuDeg, onChangeBelt, onChangeDan, onChangeKyu }: Props) {
  return (
    <View style={{ marginBottom: 11 }}>
      <Text style={shared.label}>Faixa atual</Text>
      <View style={fx.grid}>
        {BELT_OPTIONS.map((opt) => {
          const active = beltKey === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              activeOpacity={0.7}
              onPress={() => onChangeBelt(opt.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={[fx.chip, { backgroundColor: KarateBelts[opt.key].color }, active && fx.chipActive]}
            >
              <Text style={[fx.chipTxt, { color: KarateBelts[opt.key].textColor }]}>{opt.label}</Text>
              {active ? <Icon name="check" size={13} color={KarateBelts[opt.key].textColor} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {beltKey === "preta" ? (
        <>
          <Text style={[shared.label, { marginTop: 9 }]}>Grau Dan</Text>
          <View style={fx.grid}>
            {DAN_OPTIONS.map((d) => {
              const active = danDeg === d;
              return (
                <TouchableOpacity
                  key={d}
                  activeOpacity={0.7}
                  onPress={() => onChangeDan(active ? null : d)}
                  style={[fx.degChip, active && fx.degChipActive]}
                >
                  <Text style={[fx.degTxt, { color: active ? "#fdf8f2" : P.ink2 }]}>{d}°</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      {beltKey && beltKey !== "preta" && (BELT_KYUS[beltKey]?.length ?? 0) > 1 ? (
        <>
          <Text style={[shared.label, { marginTop: 9 }]}>Kyu</Text>
          <View style={fx.grid}>
            {(BELT_KYUS[beltKey] ?? []).map((k) => {
              const active = kyuDeg === k;
              return (
                <TouchableOpacity
                  key={k}
                  activeOpacity={0.7}
                  onPress={() => onChangeKyu(active ? null : k)}
                  style={[fx.degChip, active && fx.degChipActive]}
                >
                  <Text style={[fx.degTxt, { color: active ? "#fdf8f2" : P.ink2 }]}>{k}º kyu</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const fx = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 4 } as ViewStyle,
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 2, borderColor: "transparent" } as ViewStyle,
  chipActive: { borderColor: P.ink } as ViewStyle,
  chipTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "700" } as TextStyle,
  degChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: P.line2, backgroundColor: P.glassHi } as ViewStyle,
  degChipActive: { backgroundColor: P.ink, borderColor: P.ink } as ViewStyle,
  degTxt: { fontFamily: F.body, fontSize: 12.5, fontWeight: "600" } as TextStyle,
});
