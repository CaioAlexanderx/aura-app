// ============================================================
// AURA. — "Como você quer trazer seus produtos?" (19/10/2026, card tq-34)
//
// Quadro 2 do "caminho proposto" no mockup aprovado pelo Caio, "O primeiro
// minuto de quem acabou de criar a conta"
// (claude.ai/artifact/WjWnEitYY49kPCapdY4hcV). É para onde o Continuar do
// check-in leva quem tem de 51 a 300 produtos, anota no caderno ou ainda
// não anota (caminho "medio" de utils/checkinDestino.ts).
//
// Tela cheia sem item no NAV, como o /checkin: a chave de módulo existe em
// MODULE_PLAN_MAP e em PERM_TO_MODULES (CLAUDE.md, armadilha 3) e vale para
// o Essencial.
// ============================================================

/** Chave de módulo própria da tela (CLAUDE.md, armadilha 3). */
export const MOD_TRAZER_PRODUTOS = "onboarding.trazer_produtos";

/** Rota da tela (app/trazer-produtos.tsx). */
export const ROTA_TRAZER_PRODUTOS = "/trazer-produtos";

export const TEXTOS_TRAZER_PRODUTOS = {
  titulo: "Como você quer trazer seus produtos?",
  umPorUm: {
    titulo: "Um por um",
    sub: "Nome e preço bastam. Leva 20 segundos cada.",
  },
  ajuda: {
    titulo: "Quero ajuda",
    sub: "Mande a foto do caderno ou a planilha pelo WhatsApp.",
    sugerido: "Sugerido para 51 a 300 produtos",
  },
  planilha: {
    titulo: "Planilha",
    sub: "Baixe o modelo e envie preenchido.",
  },
  apoio: "Começa pelo primeiro produto enquanto o resto chega.",
} as const;
