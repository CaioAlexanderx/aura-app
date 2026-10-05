// ============================================================
// components/studio/orcamentoModal/ui.tsx
//
// As peças visuais do modal do orçamento (29/09/2026): botão por tipo,
// seção, campo, chip e selo. Mesmas medidas do mockup aprovado
// (docs/mockups/studio-orcamento-modal.html) e do DNA do TrocaModal /
// ItemFormModal: 40 px no desktop, 44 px no celular, raio 10, 13,5 px.
// Nada de hover: tudo é visível e tocável.
// ============================================================
import React from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator, Image, type TextInputProps } from "react-native";
import { Icon } from "@/components/Icon";
import type { StudioPalette } from "@/constants/studio-tokens";
import type { TipoDaAcao } from "./regras";

export const COR_DO_WHATSAPP = "#1DA851";

export type Tema = { t: StudioPalette; escuro: boolean; estreito: boolean };

export function Botao({
  tema, tipo, rotulo, onPress, icone, desabilitado, ocupado, pequeno, testID, flex, accessibilityLabel,
}: {
  tema: Tema; tipo: TipoDaAcao; rotulo: string; onPress?: () => void; icone?: string;
  desabilitado?: boolean; ocupado?: boolean; pequeno?: boolean; testID?: string; flex?: boolean;
  accessibilityLabel?: string;
}) {
  const { t, escuro, estreito } = tema;
  const altura = estreito ? 44 : pequeno ? 36 : 40;
  let bg: string = "transparent", borda: string = "transparent", cor: string = t.ink2;
  if (tipo === "pri") { bg = t.primary; cor = "#FFFFFF"; }
  else if (tipo === "wa") { bg = COR_DO_WHATSAPP; cor = "#FFFFFF"; }
  else if (tipo === "ok") { bg = t.success; cor = escuro ? "#052E1F" : "#FFFFFF"; }
  else if (tipo === "sec") { bg = t.paperCardElev; borda = t.ink5; cor = t.ink; }
  else if (tipo === "perigo") { cor = t.dangerInk; }
  const off = !!desabilitado || !!ocupado;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || rotulo}
      accessibilityState={{ disabled: off, busy: !!ocupado }}
      testID={testID}
      style={{
        minHeight: altura, paddingHorizontal: pequeno ? 12 : 16, borderRadius: 10,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
        backgroundColor: bg, borderWidth: 1.5, borderColor: borda,
        opacity: desabilitado ? 0.45 : 1,
        ...(flex ? { flexGrow: 1, flexBasis: 0 } : {}),
      }}
    >
      {ocupado ? <ActivityIndicator size="small" color={cor} /> : icone ? <Icon name={icone as any} size={15} color={cor} /> : null}
      <Text style={{ color: cor, fontWeight: "700", fontSize: pequeno ? 13 : 13.5, textAlign: "center", ...(estreito ? { flexShrink: 1 } : {}) }} numberOfLines={flex && estreito ? 1 : undefined}>{rotulo}</Text>
    </Pressable>
  );
}

export function Secao({ tema, titulo, direita, children, testID }: {
  tema: Tema; titulo: React.ReactNode; direita?: React.ReactNode; children?: React.ReactNode; testID?: string;
}) {
  const { t, estreito } = tema;
  return (
    <View
      testID={testID}
      style={{ backgroundColor: t.paperCard, borderWidth: 1, borderColor: t.ink5, borderRadius: 14, padding: estreito ? 12 : 14, gap: 10, minWidth: 0 }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, minHeight: 20 }}>
        <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: t.ink3, flexShrink: 1 }}>{titulo}</Text>
        {direita}
      </View>
      {children}
    </View>
  );
}

export function Rotulo({ t, children }: { t: StudioPalette; children: React.ReactNode }) {
  return <Text style={{ fontSize: 12, fontWeight: "700", color: t.ink2 }}>{children}</Text>;
}

export function Dica({ t, children, cor }: { t: StudioPalette; children: React.ReactNode; cor?: string }) {
  return <Text style={{ fontSize: 11.5, color: cor || t.ink3, lineHeight: 16 }}>{children}</Text>;
}

export function Campo({ tema, rotulo, dica, dicaCor, ...input }: TextInputProps & {
  tema: Tema; rotulo: string; dica?: React.ReactNode; dicaCor?: string;
}) {
  const { t, estreito } = tema;
  const soLeitura = input.editable === false;
  return (
    <View style={{ gap: 4, minWidth: 0, flexGrow: 1, flexShrink: 1 }}>
      <Rotulo t={t}>{rotulo}</Rotulo>
      <TextInput
        placeholderTextColor={t.ink4}
        accessibilityLabel={rotulo}
        {...input}
        style={[{
          minHeight: estreito ? 44 : 40, borderRadius: 10, borderWidth: 1.5, borderColor: t.ink5,
          backgroundColor: t.bgSoft, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: t.ink,
          opacity: soLeitura ? 0.75 : 1,
        }, input.multiline ? { minHeight: 64, textAlignVertical: "top" } : null, input.style as any]}
      />
      {dica ? <Dica t={t} cor={dicaCor}>{dica}</Dica> : null}
    </View>
  );
}

export function Chip({ tema, rotulo, ligado, onPress, desabilitado, testID }: {
  tema: Tema; rotulo: string; ligado: boolean; onPress?: () => void; desabilitado?: boolean; testID?: string;
}) {
  const { t, escuro, estreito } = tema;
  return (
    <Pressable
      onPress={desabilitado ? undefined : onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      aria-pressed={ligado}
      accessibilityState={{ selected: ligado, disabled: !!desabilitado }}
      testID={testID}
      style={{
        minHeight: estreito ? 44 : 36, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center",
        borderWidth: 1, borderColor: ligado ? t.primary : t.ink5, backgroundColor: ligado ? t.primarySoft : t.bgSoft,
        opacity: desabilitado && !ligado ? 0.55 : 1,
      }}
    >
      <Text style={{ fontSize: 12.5, fontWeight: "700", color: ligado ? (escuro ? t.primary2 : t.primary) : t.ink2 }}>{rotulo}</Text>
    </Pressable>
  );
}

export function Selo({ t, tipo, rotulo }: { t: StudioPalette; tipo: "3d" | "2d" | "sem" | "herdado"; rotulo: string }) {
  const cores = {
    "3d": { bg: t.primarySoft, fg: t.infoInk, borda: "transparent" },
    "2d": { bg: t.accentSoft, fg: t.accentInk, borda: "transparent" },
    sem: { bg: t.warningSoft, fg: t.warningInk, borda: "transparent" },
    herdado: { bg: t.bgSoft, fg: t.ink3, borda: t.ink5 },
  }[tipo];
  return (
    <View style={{ backgroundColor: cores.bg, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: cores.borda }}>
      <Text style={{ fontSize: 10.5, fontWeight: "800", color: cores.fg }} numberOfLines={1}>{rotulo}</Text>
    </View>
  );
}

/** Miniatura do produto: a foto ou um quadro neutro com o ícone. */
export function FotoDoProduto({ t, uri, tamanho = 44 }: { t: StudioPalette; uri?: string | null; tamanho?: number }) {
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: 10, backgroundColor: "#ECEAE4", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      {uri
        ? <Image source={{ uri }} style={{ width: tamanho, height: tamanho }} resizeMode="cover" />
        : <Icon name="package" size={Math.round(tamanho * 0.45)} color="#8A8378" />}
    </View>
  );
}
