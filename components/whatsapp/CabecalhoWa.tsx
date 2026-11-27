// ============================================================
// CabecalhoWa — o cabeçalho das telas novas do WhatsApp
//
// Artboards Main e GuiaCentral: o título (meta "WhatsApp da <loja>" + título
// grande com o ponto violeta) à esquerda; as abas e o botão "Guias" à direita,
// na mesma linha. As abas são pílulas translúcidas (a ativa NÃO é sólida: o
// único sólido da tela é a ação). No celular, uma linha só, rolável na
// horizontal, com o Guias só em ícone (aria-label="Guias").
// ============================================================
import React, { useRef } from "react";
import { View, Text, ScrollView } from "react-native";
import type { ScreenTabItem } from "@/components/ScreenHero";
import { IconeAjuda, Meta, Pilula, Titulo, Voltar, V, t } from "./waVidro";
import { useWaGuias } from "@/stores/waGuias";
/** As abas do topo: pílulas translúcidas (a ativa NÃO é sólida) e o botão Guias (só ícone no celular). */
export function AbasWa({ tabs, ativa, onSelect, estreito, onGuias }: { tabs: ScreenTabItem[]; ativa: string; onSelect: (k: string) => void; estreito?: boolean; onGuias?: () => void }) {
  const rolagem = useRef<any>(null);
  const menuAberto = useWaGuias((s) => s.aberto === "menu");
  // No celular a linha rola: ao abrir, leva a aba ativa inteira para dentro da tela.
  const levaAteAAtiva = (x: number, largura: number) => {
    try { rolagem.current?.scrollTo?.({ x: Math.max(0, x - 12), animated: false }); } catch { /* sem rolagem */ }
    void largura;
  };
  const pilulas = tabs.map((tb) => {
    const p = (
      <Pilula
        key={tb.key} ligada={tb.key === ativa} onPress={() => onSelect(tb.key)} testID={tb.testID}
        estado={{ selected: tb.key === ativa }}
      >
        <Text style={t(14, tb.key === ativa ? V.onTxt : V.ink, "600")}>{tb.label}</Text>
      </Pilula>
    );
    return estreito && tb.key === ativa
      ? <View key={tb.key} onLayout={(e) => levaAteAAtiva(e.nativeEvent.layout.x, e.nativeEvent.layout.width)}>{p}</View>
      : p;
  });
  // O botão Guias abre o menu dos guias (components/whatsapp/guias): a tela nova só, atrás da trava.
  const guias = (
    <Pilula onPress={onGuias || (() => {})} testID="wa-varejo-guias" tour="wa.guias" label="Guias" estado={{ expanded: menuAberto }}>
      <IconeAjuda tamanho={17} />
      {!estreito && <Text style={t(14, V.ink, "600")}>Guias</Text>}
    </Pilula>
  );
  if (estreito) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, width: "100%" }}>
        <ScrollView ref={rolagem} horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, minWidth: 0 }} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
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
  /** Abre o menu de guias (botão "Guias"). */
  onGuias?: () => void;
  /** Peça a mais ao lado das abas (ex.: o medidor das Conversas, como no artboard Main). Só no desktop. */
  extra?: React.ReactNode;
}

export function CabecalhoWa({ largo, lojaNome, tabs, ativa, titulo, sub, voltar, onSelect, onVoltar, onGuias, extra }: Props) {
  return (
    <View
      style={[{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 } as any, !largo && { flexDirection: "column", alignItems: "stretch" }]}
      testID="wa-varejo-cabecalho"
    >
      {!largo && <AbasWa tabs={tabs} ativa={ativa} estreito onSelect={onSelect} onGuias={onGuias} />}
      <View style={{ gap: 10, flexShrink: 1, minWidth: 0 }}>
        {!!voltar && <Voltar rotulo="Automáticas" onPress={onVoltar} testID="wa-varejo-voltar-automaticas" />}
        <Meta>{`WhatsApp da ${lojaNome || "loja"}`}</Meta>
        <Titulo tamanho={largo ? 52 : 36}>{titulo}</Titulo>
        {!!sub && <Text style={t(18, V.ink2, "400", { lineHeight: 26 })}>{sub}</Text>}
      </View>
      {largo && (extra
        ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
            <AbasWa tabs={tabs} ativa={ativa} onSelect={onSelect} onGuias={onGuias} />
            {extra}
          </View>
        )
        : <AbasWa tabs={tabs} ativa={ativa} onSelect={onSelect} onGuias={onGuias} />)}
    </View>
  );
}