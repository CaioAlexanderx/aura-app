// ============================================================
// components/studio/storefront/SacolaFechada.tsx
//
// A sacola quando a loja fechou para pedidos (Fase 1C, Tela 6 do mockup
// studio-vitrine-01-alicerce, dívida D8).
//
// A sacola guardada no navegador sobrevive ao fechamento da loja. Antes,
// "Finalizar →" levava ao checkout inteiro e o servidor recusava no fim
// (409). Agora a sacola diz na hora, com o recado da lojista, e oferece
// o único caminho que existe: pedir orçamento das mesmas peças.
//
// "Finalizar" não aparece: o servidor recusaria o pedido do mesmo jeito.
// ============================================================
import { View, Pressable, ScrollView, Linking } from "react-native";
import type { StorefrontState } from "./useStorefront";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { wash, tintaSobre } from "./theme";
import { Texto, Numero, useTipografia } from "./TipografiaVitrine";
import { Icon } from "@/components/Icon";
import { dinheiro } from "./moeda";
import { FaixaDaTemporada } from "./FaixaDaTemporada";
import { destinoDoOrcamento } from "./lojaFechada";

/** Verde do WhatsApp do kit (studio-vitrine-00-kit, `.btn-wa`): 5,4:1 com branco. */
const VERDE_WHATSAPP = "#1F7A4D";

/**
 * "Pedir orçamento desta sacola": WhatsApp com a lista pronta ou, sem
 * número cadastrado, a tela de orçamento em lote.
 */
export function BotaoOrcamentoDaSacola({ sf, onAntes }: { sf: StorefrontState; onAntes?: () => void }) {
  const tema = useTemaDaVitrine();
  const destino = destinoDoOrcamento({
    numero: (sf.store?.site as any)?.whatsapp,
    linhas: sf.cart,
    nomeDaLoja: sf.store?.site?.name,
  });
  const peloWhatsApp = destino.tipo === "whatsapp";
  const fundo = peloWhatsApp ? VERDE_WHATSAPP : tema.marcaFill;
  // A tinta sai da conta de contraste, como no resto da vitrine — nada de
  // branco cravado (princípio 5 da JORNADA).
  const tinta = peloWhatsApp ? tintaSobre(VERDE_WHATSAPP) : tema.sobreMarca;

  return (
    <Pressable
      onPress={() => {
        onAntes?.();
        if (destino.tipo === "whatsapp") Linking.openURL(destino.link);
        else sf.goTo("lote");
      }}
      accessibilityRole={peloWhatsApp ? "link" : "button"}
      accessibilityLabel={peloWhatsApp
        ? "Pedir orçamento desta sacola pelo WhatsApp da loja"
        : "Pedir orçamento desta sacola"}
      style={{
        minHeight: 48, borderRadius: 10, backgroundColor: fundo,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        paddingHorizontal: 16, width: "100%",
      }}
    >
      <Icon name={peloWhatsApp ? "whatsapp" : "file_text"} size={18} color={tinta} />
      <Texto style={{ color: tinta, fontSize: 14.5, fontWeight: "800" }}>
        Pedir orçamento desta sacola
      </Texto>
    </Pressable>
  );
}

/** O recado da loja + o orçamento: o miolo que a folha e o checkout dividem. */
export function OrcamentoNoLugarDoPedido({ sf, onAntes }: { sf: StorefrontState; onAntes?: () => void }) {
  const T = usePaletaDaVitrine();
  return (
    <View style={{ gap: 12 }} testID="sacola-fechada">
      <FaixaDaTemporada store={sf.store} lugar="junto" />
      <Texto style={{ fontSize: 12.5, lineHeight: 18, color: T.ink2 }}>
        Sua sacola continua guardada. Mande a lista para a loja e ela responde com orçamento e prazo.
      </Texto>
      <BotaoOrcamentoDaSacola sf={sf} onAntes={onAntes} />
    </View>
  );
}

/**
 * A folha que sobe da barra da sacola com a loja fechada. No celular é
 * folha; no desktop a mesma caixa fica centrada e estreita, até a sacola
 * em gaveta da Fase 2.
 *
 * Camada absoluta sobre a área da loja, e não `Modal`: o Modal do
 * react-native-web vai para um portal no <body>, fora do tema e da
 * tipografia da vitrine (os providers ficam em PaginaDaVitrine), e a
 * barra de cookies no fluxo continua fora do alcance da folha.
 */
export function FolhaDaSacolaFechada({
  sf, visivel, onFechar,
}: {
  sf: StorefrontState;
  visivel: boolean;
  onFechar: () => void;
}) {
  const T = usePaletaDaVitrine();
  const tipo = useTipografia();
  if (!visivel) return null;

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <Pressable
        onPress={onFechar}
        accessibilityRole="button"
        accessibilityLabel="Fechar sacola"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: wash(T.ink, 0.4) }}
      />
      <View
        accessibilityViewIsModal
        accessibilityLabel="Sua sacola"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          maxHeight: "78%", backgroundColor: T.card,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingHorizontal: 18, paddingTop: 14, paddingBottom: 24,
          width: "100%", maxWidth: 560, marginHorizontal: "auto",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <Texto accessibilityRole="header" style={{ fontFamily: tipo.display, fontSize: 19, color: T.ink }}>
            Sua sacola
          </Texto>
          <Pressable
            onPress={onFechar}
            accessibilityRole="button"
            accessibilityLabel="Fechar sacola"
            hitSlop={6}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 }}
          >
            <Icon name="x" size={20} color={T.ink2} />
          </Pressable>
        </View>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 14 }}>
          {sf.cart.map((l) => (
            <View
              key={l.lineId}
              style={{
                flexDirection: "row", alignItems: "center", gap: 12,
                paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Texto style={{ fontSize: 13.5, fontWeight: "700", color: T.ink }}>{l.product.name}</Texto>
                <Numero style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>
                  {l.qty} un
                </Numero>
              </View>
              <Numero style={{ fontSize: 13, fontWeight: "700", color: T.ink }}>{dinheiro(sf._lineTotal(l))}</Numero>
            </View>
          ))}
        </ScrollView>
        <OrcamentoNoLugarDoPedido sf={sf} onAntes={onFechar} />
      </View>
    </View>
  );
}
