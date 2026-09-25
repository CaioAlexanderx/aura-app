// ============================================================
// components/studio/storefront/produto/DetalhesDaPeca.tsx
//
// Tela 8 do mockup: abaixo da dobra, para quem desceu procurando mais —
// o que é a peça, onde a arte cabe, as medidas, as revisões, o prazo por
// quantidade, a dúvida no WhatsApp (link no fluxo, não botão flutuante)
// e os outros modelos da mesma categoria.
//
// A área de impressão tem UMA fonte (decisão do PO, P1): o cadastro do
// produto, ou o modelo visual quando o cadastro não diz — nada inventado
// (regrasDaPagina.areaDeImpressao).
// ============================================================
import type { ReactNode } from "react";
import { Image, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import type { StudioStoreProduct } from "../types";
import { useTemaDaVitrine, usePaletaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero, useTipografia } from "../TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { dinheiro } from "../moeda";
import { FichaTecnica } from "../FichaTecnica";
import { fotosDoProduto } from "../CarrosselFoto";
import { CapaProduto } from "../CapaProduto";
import { textoDaArea, type AreaDeImpressao } from "./regrasDaPagina";
import { transicao } from "./kitDaPagina";

function Linha({ icone, titulo, texto, onPress, rotulo }: { icone: string; titulo: string; texto?: string | null; onPress?: () => void; rotulo?: string }) {
  const t = useTemaDaVitrine();
  const corpo = (
    <>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.bg3, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icone as any} size={19} color={t.ink2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Texto style={{ fontSize: 14.5, fontWeight: "600", color: t.ink }}>{titulo}</Texto>
        {texto ? <Texto style={{ fontSize: 12.5, lineHeight: 18, color: t.ink3, marginTop: 2 }}>{texto}</Texto> : null}
      </View>
      {onPress ? <Icon name="chevron_right" size={20} color={t.ink3} /> : <View style={{ width: 20 }} />}
    </>
  );
  const estilo = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingVertical: 14, minHeight: 64, borderBottomWidth: 1, borderBottomColor: t.border };
  if (!onPress) return <View style={estilo}>{corpo}</View>;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={rotulo || titulo} style={estilo}>{corpo}</Pressable>;
}

/** O desenho da área: a faixa tracejada com as duas cotas. */
function DesenhoDaArea({ area }: { area: AreaDeImpressao }) {
  const t = useTemaDaVitrine();
  const razao = area.alturaCm / area.larguraCm;
  const w = razao > 0.9 ? Math.round(64 / Math.max(razao, 1)) + 20 : 96;
  const h = Math.max(24, Math.min(64, Math.round(w * razao)));
  const f = (n: number) => String(n).replace(".", ",");
  return (
    <View style={{ width: 118, alignItems: "flex-start" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: w, height: h, borderRadius: 3, borderWidth: 1.2, borderStyle: "dashed", borderColor: t.ink3, backgroundColor: t.marcaWashForte, alignItems: "center", justifyContent: "center" }}>
          <Texto style={{ fontSize: 9, color: t.ink3 }}>sua arte</Texto>
        </View>
        <Numero style={{ fontSize: 10, color: t.ink3 }}>{f(area.alturaCm)} cm</Numero>
      </View>
      <View style={{ width: w, alignItems: "center", marginTop: 4, borderTopWidth: 1, borderTopColor: t.ink3, paddingTop: 2 }}>
        <Numero style={{ fontSize: 10, color: t.ink3 }}>{f(area.larguraCm)} cm</Numero>
      </View>
    </View>
  );
}

export function DetalhesDaPeca({
  produto, titulo, area, notaDeRevisao, prazos, temGuia, onGuia, whatsapp, desktop,
}: {
  produto: StudioStoreProduct;
  /** "Sobre esta caneca". */
  titulo: string;
  area: AreaDeImpressao | null;
  notaDeRevisao: string | null;
  prazos: string | null;
  temGuia: boolean;
  onGuia: () => void;
  whatsapp: { numero: string; link: string } | null;
  desktop: boolean;
}) {
  const t = useTemaDaVitrine();
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  const descricao = String(produto.description || "").trim();

  const sobre = (
    <View style={{ gap: 10, flex: desktop ? 1.05 : undefined }}>
      <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 20, color: t.ink }}>{titulo}</Texto>
      {descricao ? <Texto style={{ fontSize: 15, lineHeight: 23, color: t.ink2, maxWidth: 560 }}>{descricao}</Texto> : null}
      {area ? (
        <View style={{ marginTop: 8, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg2, flexDirection: "row", alignItems: "center", gap: 16 }}>
          <DesenhoDaArea area={area} />
          <View style={{ flex: 1, gap: 6 }}>
            <Texto style={{ fontSize: 14.5, lineHeight: 20, fontWeight: "600", color: t.ink }}>
              Área de impressão: <Numero style={{ fontSize: 14.5, fontWeight: "600" }}>{textoDaArea(area)}</Numero>
            </Texto>
            <Texto style={{ fontSize: 12.5, lineHeight: 18, color: t.ink3 }}>
              Para sair nítida, mande a arte com pelo menos <Numero style={{ fontSize: 12.5 }}>{area.pxLargura} × {area.pxAltura} px</Numero>.
            </Texto>
          </View>
        </View>
      ) : null}
      <FichaTecnica produto={produto} T={T} marcaTexto={t.marcaTexto} />
    </View>
  );

  const lista = (
    <View style={{ borderTopWidth: 1, borderTopColor: t.border, flex: desktop ? 1 : undefined, marginTop: desktop ? 0 : 18 }}>
      {temGuia ? <Linha icone="ruler" titulo="Guia de medidas" texto="Altura, medidas e capacidade" onPress={onGuia} rotulo="Abrir o guia de medidas" /> : null}
      {notaDeRevisao ? <Linha icone="shield" titulo="Revisões da arte" texto={notaDeRevisao} /> : null}
      {prazos ? <Linha icone="clock" titulo="Prazo por quantidade" texto={prazos} /> : null}
      {whatsapp ? (
        <Linha
          icone="whatsapp" titulo="Tirar dúvida no WhatsApp"
          texto={`${whatsapp.numero} · a mensagem já vai com esta peça`}
          onPress={() => Linking.openURL(whatsapp.link)}
          rotulo="Tirar dúvida no WhatsApp da loja"
        />
      ) : null}
    </View>
  );

  return (
    <View
      testID="detalhes-da-peca"
      style={desktop
        ? { flexDirection: "row", gap: 64, alignItems: "flex-start", paddingTop: 44, borderTopWidth: 1, borderTopColor: t.border }
        : { paddingTop: 30, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: t.border }}
    >
      {sobre}
      {lista}
    </View>
  );
}

/**
 * "Da mesma categoria": até quatro modelos com foto grande (Tela 8). O
 * toque troca o modelo (mantendo o que a cliente preencheu) e volta ao
 * topo.
 */
export function DaMesmaCategoria({
  produtos, desktop, largura, corDaLoja, onEscolher,
}: {
  produtos: StudioStoreProduct[];
  desktop: boolean;
  largura: number;
  corDaLoja?: string | null;
  onEscolher: (p: StudioStoreProduct) => void;
}) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  if (!produtos.length) return null;
  const gap = desktop ? 22 : 12;
  const w = desktop ? Math.floor((largura - gap * 3) / 4) : 152;
  const h = Math.round(w * 1.25);
  return (
    <View testID="da-mesma-categoria" style={{ paddingTop: desktop ? 56 : 30, paddingBottom: 6 }}>
      <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 22, color: t.ink, paddingHorizontal: desktop ? 0 : 16 }}>Da mesma categoria</Texto>
      <Fila desktop={desktop} gap={gap}>
        {produtos.map((p) => {
          const foto = fotosDoProduto(p.gallery_urls, p.image_url)[0] || null;
          return (
            <Pressable
              key={p.id}
              onPress={() => onEscolher(p)}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, ${dinheiro(Number(p.price))}`}
              style={[{ width: w, gap: 3 }, Platform.OS === "web" ? ({ scrollSnapAlign: "start", flexShrink: 0 } as any) : null]}
            >
              {({ hovered }: any) => (
                <>
                  <View style={[{ width: w, height: h, borderRadius: 14, overflow: "hidden", backgroundColor: t.bg3, marginBottom: 6 },
                    hovered ? ({ transform: [{ translateY: -3 }], boxShadow: "0 8px 24px -10px rgba(26,23,20,.22)" } as any) : null, transicao("transform, box-shadow")]}>
                    {foto ? (
                      <Image source={{ uri: foto }} resizeMode="cover" style={{ width: "100%", height: "100%" }} accessibilityIgnoresInvertColors />
                    ) : (
                      <CapaProduto nome={p.name} tamanho={w} altura={h} preencher corDaLoja={corDaLoja || t.marca} fonteDisplay={tipo.display} />
                    )}
                  </View>
                  <Texto numberOfLines={2} style={{ fontFamily: tipo.display, fontSize: 15, lineHeight: 19, color: t.ink }}>{p.name}</Texto>
                  <Numero style={{ fontSize: 13, fontWeight: "600", color: t.ink }}>{dinheiro(Number(p.price))}</Numero>
                </>
              )}
            </Pressable>
          );
        })}
      </Fila>
    </View>
  );
}

/** No desktop, uma linha de quatro; no celular, a fila que desliza. */
function Fila({ desktop, gap, children }: { desktop: boolean; gap: number; children: ReactNode }) {
  if (desktop) return <View style={{ flexDirection: "row", gap, paddingTop: 18 }}>{children}</View>;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 4 }}
      style={Platform.OS === "web" ? ({ scrollSnapType: "x mandatory" } as any) : undefined}
    >
      {children}
    </ScrollView>
  );
}

