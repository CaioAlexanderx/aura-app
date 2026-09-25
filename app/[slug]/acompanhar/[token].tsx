// Rota reservada da vitrine (`/<slug>/acompanhar/<token>`): o servidor já serve a
// casca aqui (BE-1), a tela chega numa fase seguinte. Até lá, abre a
// home da loja em vez de quebrar. Ver RotaReservada em VitrineNaRota.tsx.
import { RotaReservada } from "@/components/studio/storefront/VitrineNaRota";

export default function Reservada() {
  return <RotaReservada />;
}
