// ============================================================
// AURA. — OdontogramaSVG (DEPRECATED · PR43.6, 2026-04-29)
//
// Componente legado REMOVIDO. Este arquivo agora e apenas um shim:
//   - reexporta Odontograma2D (componente novo, anatomia v5)
//   - mantem os tipos legacy (ToothStatus, ToothFace, ToothData)
//     pra nao quebrar imports types-only em ConsultaShell, ToothPopover,
//     ConsultaOdontogramaPanel e lib/dentalConsultaTypes.
//
// Implementacao antiga (View/Pressable empilhados, paleta flat 5-status,
// painel de detalhe inline) foi DELETADA — codigo morto no bundle.
//
// Em iteracao futura mover os tipos legacy pra um arquivo neutro (ex.
// lib/dentalToothTypes.ts) e remover este shim, mas o trabalho fica
// pra quando refatorar ConsultaShell pro fluxo 3-axes do PR42.
// ============================================================

import Odontograma2D from "./Odontograma2D";

// ── Re-export do componente novo sob o nome legado ──
export { default as OdontogramaSVG } from "./Odontograma2D";
export default Odontograma2D;

// ── Tipos legacy (5-status shape) — usados como types-only em 4 lugares ──
export type ToothStatus =
  | "higido"
  | "carie"
  | "restaurado"
  | "planejado"
  | "ausente";

export type ToothFace = "M" | "D" | "O" | "V" | "L";

export interface ToothData {
  number: number;
  status: ToothStatus;
  faces: Record<ToothFace, ToothStatus | null>;
  notes?: string;
  procedure_name?: string;
}
