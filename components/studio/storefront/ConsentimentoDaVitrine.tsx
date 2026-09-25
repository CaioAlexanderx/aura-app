// ============================================================
// Aviso de cookies da vitrine Studio (05/09/2026)
//
// Nasce da config ou nao existe: so aparece quando a loja tem GA4 ou
// Pixel configurado E o visitante ainda nao decidiu. Loja sem rastreador
// nao coleta nada alem do essencial, entao nao tem o que perguntar — e
// um aviso sem motivo e a primeira coisa que o cliente veria na loja.
//
// Na cor da loja, com a tipografia da loja: e parte da vitrine, nao do
// painel. A decisao fica no mesmo lugar que o banner do painel usa
// (localStorage, chave unica), entao quem ja respondeu la nao responde
// de novo aqui.
//
// 25/09/2026 (Fase 1A, Tela 8 do mockup studio-vitrine-01-alicerce):
// o aviso era um cartao ABSOLUTO no pe da tela, por cima da barra de
// compra, da barra do carrinho e do botao do WhatsApp. Agora ele se
// divide em dois:
//   - `ConsentimentoDaVitrine` e o PROVIDER: decide se ha o que
//     perguntar e injeta os rastreadores (fica em PaginaDaVitrine, uma
//     vez so, qualquer que seja a tela);
//   - `BarraDeCookies` e a barra compacta, que cada tela poe NO FLUXO,
//     logo acima da propria barra de acao. Empilhada, nunca por cima:
//     o botao de comprar e o WhatsApp continuam visiveis e tocaveis.
// ============================================================
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { View, Pressable, Platform, useWindowDimensions } from "react-native";
import { getLgpdConsent, saveConsent, hasAnalyticsConsent } from "@/components/LGPDConsent";
import { usePaletaDaVitrine, useTemaDaVitrine } from "./TemaDaVitrine";
import { wash } from "./theme";
import { Texto } from "./TipografiaVitrine";
import { lojaRastreia, injetarRastreadores, type Rastreadores } from "./rastreadoresDaVitrine";

type EstadoDoConsentimento = {
  rastreia: boolean;
  pendente: boolean;
  decidir: (aceita: boolean) => void;
};

const Contexto = createContext<EstadoDoConsentimento>({
  rastreia: false,
  pendente: false,
  decidir: () => {},
});

export function ConsentimentoDaVitrine({
  rastreadores, children,
}: {
  rastreadores: Partial<Rastreadores> | null | undefined;
  children?: ReactNode;
}) {
  const rastreia = lojaRastreia(rastreadores);
  const [pendente, setPendente] = useState(false);

  // Ja consentiu antes (aqui ou no painel): injeta direto, sem perguntar.
  useEffect(() => {
    if (Platform.OS !== "web" || !rastreia) return;
    if (hasAnalyticsConsent()) {
      injetarRastreadores(typeof document !== "undefined" ? document : undefined, rastreadores);
      setPendente(false);
      return;
    }
    setPendente(getLgpdConsent() == null);
  }, [rastreia, rastreadores?.ga4, rastreadores?.pixel]);

  function decidir(aceita: boolean) {
    saveConsent(aceita ? "all" : "essential");
    if (aceita) {
      injetarRastreadores(typeof document !== "undefined" ? document : undefined, rastreadores);
    }
    setPendente(false);
  }

  const valor = useMemo(
    () => ({ rastreia, pendente, decidir }),
    // decidir fecha sobre `rastreadores`; a identidade dele muda junto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rastreia, pendente, rastreadores?.ga4, rastreadores?.pixel],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * A barra compacta. Cada tela a coloca no FLUXO, imediatamente acima da
 * sua barra de acao (ou no pe, se nao tiver barra) — assim ela empurra o
 * conteudo em vez de cobrir o botao de comprar ou o WhatsApp.
 */
export function BarraDeCookies() {
  const { rastreia, pendente, decidir } = useContext(Contexto);
  const T = usePaletaDaVitrine();
  const tema = useTemaDaVitrine();
  const { width } = useWindowDimensions();
  const larga = width >= 720;

  if (!rastreia || !pendente) return null;

  return (
    <View
      testID="consentimento-da-vitrine"
      style={{ paddingHorizontal: larga ? 24 : 10, paddingVertical: 8, alignItems: "center" }}
    >
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row", alignItems: "center", gap: 10,
        width: "100%", maxWidth: 720,
        backgroundColor: T.card, borderColor: T.border, borderWidth: 1, borderRadius: 12,
        paddingVertical: 9, paddingLeft: 13, paddingRight: 10,
        ...(Platform.OS === "web"
          ? ({ boxShadow: `0 8px 24px -10px ${wash(T.ink, 0.22)}, 0 2px 6px ${wash(T.ink, 0.06)}` } as any)
          : { elevation: 3 }),
      }}
    >
      <Texto style={{ flex: 1, fontSize: 12, lineHeight: 17, color: T.ink2 }}>
        {larga
          ? "Usamos cookies para medir visitas e entender o que mais interessa. Nada é vendido a terceiros."
          : "Usamos cookies para medir visitas. Nada é vendido a terceiros."}
      </Texto>
      <View style={{ flexDirection: "row", gap: 6, flexShrink: 0 }}>
        <Pressable
          onPress={() => decidir(false)}
          accessibilityRole="button"
          accessibilityLabel="Aceitar só os cookies essenciais"
          hitSlop={4}
          style={{
            minHeight: 36, justifyContent: "center",
            paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: tema.bg3,
          }}
        >
          <Texto style={{ fontSize: 12, fontWeight: "700", color: T.ink2 }}>
            {larga ? "Só os essenciais" : "Essenciais"}
          </Texto>
        </Pressable>
        <Pressable
          onPress={() => decidir(true)}
          accessibilityRole="button"
          accessibilityLabel="Aceitar cookies de medição"
          hitSlop={4}
          style={{
            minHeight: 36, justifyContent: "center",
            paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: tema.marcaFill,
          }}
        >
          <Texto style={{ fontSize: 12, fontWeight: "800", color: tema.sobreMarca }}>Aceitar</Texto>
        </Pressable>
      </View>
    </View>
    </View>
  );
}
