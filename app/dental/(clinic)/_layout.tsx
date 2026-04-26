import { DentalShell } from "@/components/dental/DentalShell";

// ============================================================
// Layout da experiencia Aura Odonto autenticada.
//
// Substitui (tabs)/_layout para o usuario com vertical=odonto.
// AuthGuard em app/_layout.tsx redireciona /(tabs) para ca
// quando company.vertical_active === "odonto".
//
// O DentalShell renderiza <Slot /> internamente, entao todas
// as telas em app/dental/(clinic)/<X>.tsx aparecem dentro do
// container dental.
// ============================================================

export default function DentalClinicLayout() {
  return <DentalShell />;
}
