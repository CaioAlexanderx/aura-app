// ============================================================
// AURA. — "Chegou mercadoria": a trava das portas da Fase 4 (F1, F2)
//
// O wizard "Chegou mercadoria" (Fase 3, A1–A7) ganhou a porta na barra do
// Estoque no A8. As portas da tela de Fornecedores abrem junto:
//   - "Dar entrada" no cartão e na ficha (F1);
//   - "Importar a lista deste fornecedor" na ficha (F2);
//   - "[q] un · última entrada [dd/mm]" nos produtos ligados da ficha.
//
// Com a trava em false, a tela de Fornecedores fica IDÊNTICA à de antes
// (__tests__/fornecedoresDarEntrada.test.tsx compara com o snapshot gravado
// antes da Fase 4), e o wizard nem é montado ali.
//
// LIGADA no A8 (17/11), no mesmo PR que põe "Chegou mercadoria" na barra
// do Estoque. O merge desse PR depende de:
//   1. Aura-backend do B4 (#1063, vínculo com custo por produto) em
//      produção: sem ele, "Ligar n produtos" volta 400;
//   2. Aura-backend#1054/#1056/#1057 em produção e a migration 457 aplicada
//      (o "Dar entrada" grava pelo stock-receipts);
//   3. OK do Caio nos textos das Fases 3 e 4 (dado em 17/11).
// Para fechar de novo as portas de Fornecedores sem mexer no Estoque, volte
// para false: a tela de Fornecedores volta a ser a de antes (o snapshot do
// teste continua valendo).
// ============================================================
export const FORNECEDORES_ABREM_O_CHEGOU = true;
