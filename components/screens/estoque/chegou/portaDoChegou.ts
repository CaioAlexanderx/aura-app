// ============================================================
// AURA. — "Chegou mercadoria": a trava das portas da Fase 4 (F1, F2)
//
// O wizard "Chegou mercadoria" (Fase 3, A1–A7) existe no código e ainda não
// tem porta: quem coloca o botão na barra do Estoque é o A8, que espera o OK
// do Caio nos textos. Enquanto isso, as portas da tela de Fornecedores
// também ficam fechadas:
//   - "Dar entrada" no cartão e na ficha (F1);
//   - "Importar a lista deste fornecedor" na ficha (F2);
//   - "[q] un · última entrada [dd/mm]" nos produtos ligados da ficha.
//
// Com a trava em false, a tela de Fornecedores é IDÊNTICA à de antes
// (__tests__/fornecedoresDarEntrada.test.tsx compara com o snapshot gravado
// antes da Fase 4), e o wizard nem é montado ali.
//
// QUEM LIGA: o A8, no mesmo PR que põe "Chegou mercadoria" na barra do
// Estoque, trocando o false abaixo por true. Antes de ligar, conferir:
//   1. Aura-backend do B4 (vínculo com custo por produto) em produção: sem
//      ele, "Ligar n produtos" volta 400;
//   2. Aura-backend#1054/#1056/#1057 em produção e a migration 457 aplicada
//      (o "Dar entrada" grava pelo stock-receipts);
//   3. OK do Caio nos textos da Fase 4 (textosChegou.ts, bloco "Fase 4").
// ============================================================
export const FORNECEDORES_ABREM_O_CHEGOU = false;
