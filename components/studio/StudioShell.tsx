// ============================================================
// AURA STUDIO · StudioShell — re-export shim (Fase 2)
//
// 31/05/2026: o monólito original (37KB) foi decomposto em
// `components/studio/StudioShell/` (12 arquivos). Este arquivo
// existe APENAS por causa do path GitHub MCP (que não permite
// deletar arquivos) — ele preserva o caminho de import canônico
// `@/components/studio/StudioShell` para todos os consumidores
// antigos. Em qualquer cleanup futuro este arquivo pode ser
// removido com `git rm` + ajustar TS resolution.
//
// Toda lógica vive em `./StudioShell/index.tsx`.
// ============================================================
export { StudioShell, default } from "./StudioShell/index";
