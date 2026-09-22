// ============================================================
// AURA. — GlobalOverlays: o que fica por cima de TODAS as telas
//
// Montado UMA vez em app/_layout.tsx (RootLayout), ao lado de LGPDConsent
// e UpdateBanner — e não mais no _layout das abas. Motivo (22/09/2026):
// Food, Odonto, Studio e Karatê têm shell próprio e não passam pelas abas;
// o que estiver aqui precisa alcançar todos eles. ChatFAB removido —
// estava atrapalhando a experiência mobile e web.
//
// 22/09/2026 (PWA Fase 2):
//   · ImpressaoNoIphoneSheet — a folha que services/printWindow.ts e as
//     etiquetas acionam no iPhone com a Aura instalada, onde a janela de
//     impressão é morta. Precisa estar no raiz: o Studio imprime via
//     openPrintWindow e não renderiza o layout das abas.
//   · registro do service worker para TODO usuário web. Até aqui ele só
//     era registrado pelo sino (NotificationBell), que Food e Odonto não
//     montam — e sem service worker não há página "sem conexão". O
//     registro é idempotente (services/webPush.ts) e não pede permissão
//     nenhuma: inscrever no Web Push continua sendo só por ativarAviso().
//
// Aviso de "nova versão": NÃO entra aqui. Já existe components/UpdateBanner
// (montado no raiz) fazendo exatamente isso, desligado de propósito em
// 11/07/2026 porque o bundle é um só para toda a Aura e cada deploy do
// Karatê avisava o lojista de varejo o dia inteiro. Religar exige o
// backend dizer se o deploy é relevante para quem está logado (ver o
// cabeçalho daquele arquivo). Uma segunda cópia aqui só duplicaria o ruído.
// ============================================================
import { useEffect } from "react";
import { Platform } from "react-native";
import { ImpressaoNoIphoneSheet } from "@/components/ImpressaoNoIphone";
import { registrarServiceWorker } from "@/services/webPush";

export function GlobalOverlays() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    registrarServiceWorker().catch(() => { /* sem SW, sem pagina offline; o resto segue */ });
  }, []);

  return <ImpressaoNoIphoneSheet />;
}
