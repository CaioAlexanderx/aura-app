// ============================================================
// AURA. — GlobalOverlays: o que fica por cima de todas as telas
//
// Montado uma vez em app/(tabs)/_layout.tsx, nos dois caminhos de render
// (web estreito e web largo). ChatFAB removido — estava atrapalhando a
// experiência mobile e web.
//
// 22/09/2026 (PWA Fase 2):
//   · NovaVersaoBanner — barra fixa "Nova versão da Aura · Atualizar",
//     quando o servidor tem um deploy mais novo que a página em execução;
//   · ImpressaoNoIphoneSheet — a folha que services/printWindow.ts e as
//     etiquetas acionam no iPhone com a Aura instalada, onde a janela de
//     impressão é morta.
// Os dois se escondem sozinhos fora do web.
// ============================================================
import { NovaVersaoBanner } from "@/components/NovaVersaoBanner";
import { ImpressaoNoIphoneSheet } from "@/components/ImpressaoNoIphone";

export function GlobalOverlays() {
  return (
    <>
      <NovaVersaoBanner />
      <ImpressaoNoIphoneSheet />
    </>
  );
}
