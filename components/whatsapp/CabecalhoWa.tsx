// ============================================================
// CabecalhoWa — o cabeçalho das telas novas do WhatsApp
//
// Artboards Main e GuiaCentral: o título (meta "WhatsApp da <loja>" + título
// grande com o ponto violeta) à esquerda; as abas e o botão "Guias" à direita,
// na mesma linha. As abas são pílulas translúcidas (a ativa NÃO é sólida: o
// único sólido da tela é a ação). No celular, uma linha só, rolável na
// horizontal, com o Guias só em ícone (aria-label="Guias").
// ============================================================
import React from "react";
import { View, Text, ScrollView } from "react-native";
import type { ScreenTabItem } from "@/components/ScreenHero";
import { IconeAjuda, Meta, Pilula, Titulo, Voltar, V, t } from "./waVidro";
/** As abas do topo: pílulas translúcidas (a ativa NÃO é sólida) e o botão Guias (só ícone no celular). */
export function AbasWa({ tabs, ativa, onSelect, estreito }: { tabs: ScreenTabItem[]; ativa: string; onSelect: (k: string) => void; estreito?: boolean }) {
  const pilulas = tabs.map((tb) => (
    <Pilula
      key={tb.key} ligada={tb.key === ativa} onPress={() => onSelect(tb.key)} testID={tb.testID}
      estado={{ selected: tb.key === ativa }}
    >
      <Text style={t(14, tb.key === ativa ? V.onTxt : V.ink, "600")}>{tb.label}</Text>
    </Pilula>
  ));
  // Os guias entram no próximo PR: aqui só o botão e o alvo do tour.
  const guias = (
    <Pilula onPress={() => {}} testID="wa-varejo-guias" tour="wa.guias" label="Guias">
      <IconeAjuda tamanho={17} />
      {!estreito && <Text style={t(14, V.ink, "600")}>Guias</Text>}
    </Pilula>
  );
  if (estreito) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, width: "100%" }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, minWidth: 0 }} contentContainerStyle={{ gap: 6, paddingRight: 6 }}>
          {pilulas}
        </ScrollView>
        {guias}
      </View>
    );
  }
  return <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 6, flexShrink: 0 }}>{pilulas}{guias}</View>;
}

interface Props {
  largo: boolean;
  lojaNome: string;
  tabs: ScreenTabItem[];
  ativa: string;
  titulo: string;
  sub?: string;
  voltar?: boolean;
  onSelect: (k: string) => void;
  onVoltar: () => void;
}

export function CabecalhoWa({ largo, lojaNome, tabs, ativa, titulo, sub, voltar, onSelect, onVoltar }: Props) {
  return (
    <View
      style={[{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 } as any, !largo && { flexDirection: "column", alignItems: "stretch" }]}
      testID="wa-varejo-cabecalho"
    >
      {!largo && <AbasWa tabs={tabs} ativa={ativa} estreito onSelect={onSelect} />}
      <View style={{ gap: 10, flexShrink: 1, minWidth: 0 }}>
        {!!voltar && <Voltar rotulo="Automáticas" onPress={onVoltar} testID="wa-varejo-voltar-automaticas" />}
        <Meta>{`WhatsApp da ${lojaNome || "loja"}`}</Meta>
        <Titulo tamanho={largo ? 52 : 36}>{titulo}</Titulo>
        {!!sub && <Text style={t(18, V.ink2, "400", { lineHeight: 26 })}>{sub}</Text>}
      </View>
      {largo && <AbasWa tabs={tabs} ativa={ativa} onSelect={onSelect} />}
    </View>
  );
}