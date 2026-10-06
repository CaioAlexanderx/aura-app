import { DentalColors } from "@/constants/dental-tokens";
import {
  SpotlightTour as BaseSpotlightTour,
  type TourStep,
  type SpotlightPalette,
} from "@/components/onboarding/SpotlightTour";

// ============================================================
// SpotlightTour do Odonto — 05/10/2026: a primitiva foi generalizada e
// mora em components/onboarding/SpotlightTour.tsx (a mesma que os primeiros
// passos por frente usam). Aqui fica só a paleta dental, com o mesmo
// contrato de antes (steps/open/onComplete/onSkip) e o mesmo comportamento:
// sem espera pelo alvo, sem portal, toque no overlay pula o tour.
// ============================================================

export type { TourStep };

const DENTAL_PALETTE: SpotlightPalette = {
  surface: DentalColors.bg2,
  border: DentalColors.border,
  ink: DentalColors.ink,
  ink2: DentalColors.ink2,
  ink3: DentalColors.ink3,
  accent: DentalColors.cyan,
  accentInk: "#fff",
};

interface SpotlightTourProps {
  steps: TourStep[];
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function SpotlightTour(props: SpotlightTourProps) {
  return <BaseSpotlightTour {...props} palette={DENTAL_PALETTE} />;
}

export default SpotlightTour;
