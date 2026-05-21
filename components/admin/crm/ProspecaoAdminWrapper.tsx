// ─── ProspecaoAdmin Wrapper ──────────────────────────────────────────────────
// Envolve o orquestrador real com CrmErrorBoundary (debug em prod).
// Quando estabilizar pode remover o wrapper e exportar ProspecaoAdmin direto.
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
