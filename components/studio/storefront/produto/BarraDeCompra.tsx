// ============================================================
// components/studio/storefront/produto/BarraDeCompra.tsx
//
// Tela 7 do mockup: o total e o que falta sempre à vista, e as duas
// ações ao alcance do polegar.
//
//   - "Adicionar à sacola" é o PRIMÁRIO (decisão do PO, 25/09) e fica à
//     direita, onde o polegar alcança; "Comprar agora" é o secundário.
//   - O botão NUNCA fica desabilitado: com pendência, o toque leva ao
//     que falta e acende o campo. A frase também é um botão.
//   - Ao adicionar: "Adicionado" por 1,4 s (e o contador da sacola, no
//     cabeçalho, pulsa).
//   - Editando uma linha da sacola: um botão só, "Atualizar item".
//   - Loja fechada (Fase 1C): o primário vira "Pedir orçamento", com o
//     recado da loja em cima — e o secundário sai.
//
// No desktop é o bloco da coluna direita. Ele NÃO flutua por cima do
// conteúdo (o mockup cobria a seção da arte numa tela de 820 px): a
// página o põe numa faixa própria, fora da rolagem — ver PaginaDoProduto.
// ============================================================
import { Platform, Pressable, View } from "react-native";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero } from "../TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { dinheiro } from "../moeda";
import { FaixaDaTemporada } from "../FaixaDaTemporada";
import { Botao, Rotulo, sombraWeb, transicao, useNumeroAnimado, usePulso } from "./kitDaPagina";

export type AcaoDaBarra = {
  total: number;
  unitario: number;
  qtd: number;
  /** Serviço de arte cobrado uma vez na linha (Fase 2); 0 sem ele. */
  arte: number;
  /** "R$ X no Pix" do total; null sem desconto no Pix. */
  totalNoPix: number | null;
  /** A frase do que falta; null = tudo pronto. */
  falta: string | null;
  /** Muda a cada toque com pendência: a frase balança. */
  cutucada: number;
  adicionado: boolean;
  editando: boolean;
  aceita: boolean;
  store: any;
  onFalta: () => void;
  onAdicionar: () => void;
  onComprar: () => void;
  onAtualizar: () => void;
  onOrcamento: () => void;
};

function Falta({ a, pequena }: { a: AcaoDaBarra; pequena?: boolean }) {
  const t = useTemaDaVitrine();
  const balanca = usePulso(a.cutucada, 500);
  if (!a.aceita) return null;
  if (!a.falta) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: pequena ? 24 : 44 }} testID="barra-tudo-pronto">
        <Icon name="check" size={16} color={a.editando ? t.ink3 : t.green} />
        <Texto numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: t.green, flexShrink: 1 }}>Tudo pronto para a sacola</Texto>
      </View>
    );
  }
  return (
    <Pressable
      onPress={a.onFalta}
      accessibilityRole="button"
      accessibilityLabel={a.falta + ". Tocar leva ao campo."}
      testID="barra-falta"
      style={[{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: pequena ? 24 : 44, flexShrink: 1, transform: [{ translateX: balanca ? 3 : 0 }] }, transicao("transform", 120)]}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.amber }} />
      <Texto numberOfLines={2} style={{ fontSize: 13.5, fontWeight: "600", color: t.amber, flexShrink: 1 }}>{a.falta}</Texto>
    </Pressable>
  );
}

function Acoes({ a, desktop }: { a: AcaoDaBarra; desktop: boolean }) {
  if (a.editando) {
    return <Botao rotulo={`Atualizar item · ${dinheiro(a.total)}`} rotuloAcessivel={`Atualizar item por ${dinheiro(a.total)}`} onPress={a.onAtualizar} />;
  }
  if (!a.aceita) {
    return <Botao rotulo="Pedir orçamento" rotuloAcessivel="Pedir orçamento desta peça" onPress={a.onOrcamento} />;
  }
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Botao
        tipo="secundario" rotulo="Comprar agora" rotuloAcessivel={`Comprar agora por ${dinheiro(a.total)}`}
        onPress={a.onComprar} estilo={{ flex: 1, minWidth: 0, paddingHorizontal: 12 }} testID="botao-comprar-agora"
      />
      <Botao
        tipo={a.adicionado ? "feito" : "primario"}
        rotulo={a.adicionado ? "Adicionado" : "Adicionar à sacola"}
        rotuloAcessivel={a.adicionado ? "Adicionado à sacola" : "Adicionar à sacola"}
        icone={a.adicionado ? "check" : desktop ? "shopping_bag" : undefined}
        onPress={a.onAdicionar}
        estilo={{ flex: desktop ? 1.35 : 1.5, minWidth: 0, paddingHorizontal: 12 }}
        testID="botao-adicionar"
      />
    </View>
  );
}

/** A barra fixa do celular. */
export function BarraDeCompraCelular({ a }: { a: AcaoDaBarra }) {
  const t = useTemaDaVitrine();
  const total = useNumeroAnimado(a.total);
  return (
    <View
      testID="barra-de-compra"
      style={[{
        backgroundColor: t.bg2, borderTopWidth: 1, borderTopColor: t.border,
        paddingTop: 4, paddingHorizontal: 16, paddingBottom: 12, gap: 4,
      }, Platform.OS === "web" ? ({ boxShadow: "0 -12px 30px -20px rgba(26,23,20,.4)" } as any) : null]}
    >
      {!a.aceita ? <View style={{ paddingTop: 8, paddingBottom: 4 }}><FaixaDaTemporada store={a.store} lugar="junto" /></View> : null}
      {a.aceita ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}><Falta a={a} /></View>
          <View style={{ alignItems: "flex-end" }}>
            <Numero accessibilityLiveRegion="polite" style={{ fontSize: 19, fontWeight: "600", color: t.ink, lineHeight: 22 }}>{dinheiro(total)}</Numero>
            <Texto style={{ fontSize: 11.5, color: t.ink3 }}>
              {a.qtd > 1 ? <Numero style={{ fontSize: 11.5 }}>{`${a.qtd} un × ${dinheiro(a.unitario)}${a.arte > 0 ? ` + arte ${dinheiro(a.arte)}` : ""}`}</Numero>
                : a.totalNoPix != null ? <><Numero style={{ fontSize: 11.5 }}>{dinheiro(a.totalNoPix)}</Numero> no Pix</> : null}
            </Texto>
          </View>
        </View>
      ) : null}
      <View style={{ paddingTop: a.aceita ? 0 : 4 }}>
        <Acoes a={a} desktop={false} />
      </View>
    </View>
  );
}

/**
 * O bloco de compra do desktop, no pé da coluna direita. `compacto` em
 * tela baixa (notebook de 768–880 px): o que falta vai para o lado do
 * total, e o bloco perde uma linha inteira.
 */
export function BlocoDeCompraDesktop({ a, compacto }: { a: AcaoDaBarra; compacto: boolean }) {
  const t = useTemaDaVitrine();
  const total = useNumeroAnimado(a.total);
  const meta = (
    <View style={{ alignItems: compacto ? "flex-start" : "flex-end" }}>
      <Numero style={{ fontSize: 12.5, color: t.ink3, lineHeight: 18 }}>{`${a.qtd} un × ${dinheiro(a.unitario)}${a.arte > 0 ? ` + arte ${dinheiro(a.arte)}` : ""}`}</Numero>
      {a.totalNoPix != null ? (
        <Texto style={{ fontSize: 12.5, fontWeight: "600", color: t.green }}><Numero style={{ fontSize: 12.5, fontWeight: "600", color: t.green }}>{dinheiro(a.totalNoPix)}</Numero> no Pix</Texto>
      ) : null}
    </View>
  );
  return (
    <View
      testID="bloco-de-compra"
      style={[{
        gap: compacto ? 10 : 12, paddingVertical: compacto ? 12 : 16, paddingHorizontal: 18, borderRadius: 20,
        backgroundColor: t.bg2, borderWidth: 1, borderColor: t.border,
      }, sombraWeb(3)]}
    >
      {!a.aceita ? <FaixaDaTemporada store={a.store} lugar="junto" /> : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Rotulo>Total</Rotulo>
          <Numero accessibilityLiveRegion="polite" style={{ fontSize: compacto ? 24 : 26, lineHeight: compacto ? 26 : 28, fontWeight: "700", letterSpacing: -0.6, color: t.ink }}>{dinheiro(total)}</Numero>
          {compacto ? meta : null}
        </View>
        {compacto ? (a.aceita && !a.editando ? <View style={{ flexShrink: 1, alignItems: "flex-end" }}><Falta a={a} pequena /></View> : null) : meta}
      </View>
      {!compacto && a.aceita && !a.editando ? <Falta a={a} pequena /> : null}
      <Acoes a={a} desktop />
    </View>
  );
}
