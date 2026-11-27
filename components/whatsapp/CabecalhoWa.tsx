// ============================================================
// CabecalhoWa — o cabeçalho das telas novas do WhatsApp
//
// Artboards Main e GuiaCentral: o título (meta "WhatsApp da <loja>" + título
// grande com o ponto violeta) à esquerda; as abas e o botão "Guias" à direita,
// na mesma linha. As abas são pílulas translúcidas (a ativa NÃO é sólida: o
// único sólido da tela é a ação). No celular, uma linha só, rolável na
// horizontal, com o Guias só em ícone (aria-label="Guias").
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import type { ScreenTabItem } from "@/components/ScreenHero";
import { IconeAjuda, Meta, Pilula, Titulo, Voltar, V, t } from "./waVidro";
import { useSetas } from "./waTeclado";
import { mascaraDasBordas, xParaCentralizar } from "./waAbas";
import { WEB } from "./waVisual";
/**
 * Lista de abas (padrão ARIA tablist): uma só parada de Tab (a aba ativa), ← → (e ↑ ↓) movem e ativam,
 * Home e End vão às pontas, Enter e Espaço ativam. Serve às abas do topo e às subabas de Configurações.
 */
export function ListaAbas({ abas, ativa, onSelect, rotulo, testIDLista, antes, depois, aoLayoutAtiva }: {
  abas: { key: string; label: string; testID?: string }[];
  ativa: string;
  onSelect: (k: string) => void;
  rotulo: string;
  testIDLista?: string;
  /** Itens depois das abas, na mesma linha (o botão Guias). */
  depois?: React.ReactNode;
  antes?: React.ReactNode;
  /** x da aba ativa dentro da lista (para rolar a linha do celular até ela). */
  aoLayoutAtiva?: (x: number, largura: number) => void;
}) {
  const i = abas.findIndex((x) => x.key === ativa);
  const { propsDoItem } = useSetas({
    qtd: abas.length, ativo: i, ativarAoMover: true, ativarComEnterEEspaco: true, vertical: false,
    aoMover: (k) => onSelect(abas[k].key),
  });
  return (
    <>
      {antes}
      <View accessibilityRole="tablist" aria-label={rotulo} testID={testIDLista} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        {abas.map((tb, k) => {
          const pil = (
            <Pilula
              key={tb.key} role="tab" ligada={tb.key === ativa} onPress={() => onSelect(tb.key)} testID={tb.testID}
              nativeID={`wa-tab-${tb.key}`} estado={{ selected: tb.key === ativa }} nav={propsDoItem(k)}
            >
              <Text style={t(14, tb.key === ativa ? V.onTxt : V.ink, "600")}>{tb.label}</Text>
            </Pilula>
          );
          return tb.key === ativa && aoLayoutAtiva
            ? <View key={tb.key} onLayout={(e) => aoLayoutAtiva(e.nativeEvent.layout.x, e.nativeEvent.layout.width)}>{pil}</View>
            : pil;
        })}
      </View>
      {depois}
    </>
  );
}

/** As abas do topo: pílulas translúcidas (a ativa NÃO é sólida) e o botão Guias (só ícone no celular). */
export function AbasWa({ tabs, ativa, onSelect, estreito }: { tabs: ScreenTabItem[]; ativa: string; onSelect: (k: string) => void; estreito?: boolean }) {
  const rolagem = useRef<any>(null);
  // No celular a fila rola: ao abrir, a aba ativa vai para o centro; só o lado com mais conteúdo ganha o esmaecido.
  const [rolado, setRolado] = useState(0);
  const [visivel, setVisivel] = useState(0);
  const [total, setTotal] = useState(0);
  const [ativaLay, setAtivaLay] = useState<{ x: number; w: number } | null>(null);
  useEffect(() => {
    if (!estreito || !ativaLay || !(visivel > 0) || !(total > 0)) return;
    try { rolagem.current?.scrollTo?.({ x: xParaCentralizar(ativaLay.x, ativaLay.w, visivel, total), animated: false }); } catch { /* sem rolagem */ }
  }, [estreito, ativaLay, visivel, total, ativa]);
  const mascara = estreito && WEB ? mascaraDasBordas(rolado, visivel, total) : null;  const abas = tabs.map((tb) => ({ key: tb.key, label: tb.label, testID: tb.testID }));
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
        <View style={[{ flex: 1, minWidth: 0 }, mascara ? ({ maskImage: mascara, WebkitMaskImage: mascara } as any) : null]} testID="wa-varejo-abas-fila">
          <ScrollView
            ref={rolagem} horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, minWidth: 0 }} contentContainerStyle={{ gap: 6, paddingRight: 12 }}
            scrollEventThrottle={32}
            onScroll={(e) => setRolado(e.nativeEvent.contentOffset.x)}
            onLayout={(e) => setVisivel(e.nativeEvent.layout.width)}
            onContentSizeChange={(w) => setTotal(w)}
          >
            <ListaAbas abas={abas} ativa={ativa} onSelect={onSelect} rotulo="Seções do WhatsApp" aoLayoutAtiva={(x, w) => setAtivaLay({ x, w })} />
          </ScrollView>
        </View>
        {guias}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 6, flexShrink: 0 }}>
      <ListaAbas abas={abas} ativa={ativa} onSelect={onSelect} rotulo="Seções do WhatsApp" />
      {guias}
    </View>
  );
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
  /** Peça a mais ao lado das abas (ex.: o medidor das Conversas, como no artboard Main). Só no desktop. */
  extra?: React.ReactNode;
}

export function CabecalhoWa({ largo, lojaNome, tabs, ativa, titulo, sub, voltar, onSelect, onVoltar, extra }: Props) {
  // As abas ficam sempre na linha do topo, à direita, em TODAS as telas; o título vem embaixo e
  // quebra à vontade. Trocar de aba não mexe nas abas de lugar.
  return (
    <View style={{ gap: 18 }} testID="wa-varejo-cabecalho">
      {largo ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 10 }} testID="wa-varejo-abas-topo">
          <AbasWa tabs={tabs} ativa={ativa} onSelect={onSelect} />
          {extra}
        </View>
      ) : (
        <AbasWa tabs={tabs} ativa={ativa} estreito onSelect={onSelect} />
      )}
      <View style={{ gap: 10, minWidth: 0 }}>
        {!!voltar && <Voltar rotulo="Automáticas" onPress={onVoltar} testID="wa-varejo-voltar-automaticas" />}
        <Meta>{`WhatsApp da ${lojaNome || "loja"}`}</Meta>
        <Titulo tamanho={largo ? 52 : 36}>{titulo}</Titulo>
        {!!sub && <Text style={t(18, V.ink2, "400", { lineHeight: 26 })}>{sub}</Text>}
      </View>
    </View>
  );
}