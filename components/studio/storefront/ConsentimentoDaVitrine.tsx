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
// ============================================================
import { useEffect, useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { getLgpdConsent, saveConsent, hasAnalyticsConsent } from "@/components/LGPDConsent";
import { usePaletaDaVitrine } from "./TemaDaVitrine";
import { montarTema } from "./theme";
import { Texto } from "./TipografiaVitrine";
import { lojaRastreia, injetarRastreadores, type Rastreadores } from "./rastreadoresDaVitrine";

export function ConsentimentoDaVitrine({
  rastreadores, corDaLoja,
}: {
  rastreadores: Partial<Rastreadores> | null | undefined;
  corDaLoja?: string | null;
}) {
  const T = usePaletaDaVitrine();
  const tema = montarTema(corDaLoja || undefined);
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

  if (!rastreia || !pendente) return null;

  return (
    <View
      testID="consentimento-da-vitrine"
      style={{
        position: "absolute", left: 0, right: 0, bottom: 0, padding: 12,
        alignItems: "center", zIndex: 50,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          width: "100%", maxWidth: 560,
          backgroundColor: T.card, borderColor: T.border, borderWidth: 1, borderRadius: 14,
          padding: 14, gap: 10,
          ...(Platform.OS === "web" ? ({ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" } as any) : {}),
        }}
      >
        <Texto style={{ fontSize: 12.5, lineHeight: 18, color: T.ink2 }}>
          Esta loja usa cookies de medição de audiência para saber quantas pessoas visitam e o que mais interessa.
          Nada é vendido a terceiros. Você pode ficar só com os essenciais.
        </Texto>
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Pressable
            onPress={() => decidir(false)}
            accessibilityRole="button"
            style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: T.border }}
          >
            <Texto style={{ fontSize: 12, fontWeight: "700", color: T.ink3 }}>Só os essenciais</Texto>
          </Pressable>
          <Pressable
            onPress={() => decidir(true)}
            accessibilityRole="button"
            style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, backgroundColor: tema.marcaFill }}
          >
            <Texto style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>Aceitar</Texto>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
