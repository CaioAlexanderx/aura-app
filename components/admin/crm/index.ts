// ─── CRM Module Barrel ───────────────────────────────────────────────────────
// Envolve ProspecaoAdmin com um ErrorBoundary local que mostra stack detalhado
// (temporario pra debug em prod). Quando estabilizar, basta voltar a exportar
// ProspecaoAdmin direto.
// ============================================================================

import React from "react";
import { ProspecaoAdmin as ProspecaoAdminRaw } from "./ProspecaoAdmin";
import { CrmErrorBoundary } from "./CrmErrorBoundary";

export function ProspecaoAdmin() {
  return (
    <CrmErrorBoundary>
      <ProspecaoAdminRaw />
    </CrmErrorBoundary>
  );
}
