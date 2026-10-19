// ============================================================
// AURA. — Rota /trazer-produtos (19/10/2026, card tq-34)
//
// "Como você quer trazer seus produtos?": Um por um · Quero ajuda ·
// Planilha. O Continuar do check-in leva aqui quem tem de 51 a 300
// produtos, anota no caderno ou ainda não anota. Tela cheia de propósito
// (sem sidebar), como o /checkin: a chave `onboarding.trazer_produtos`
// existe em MODULE_PLAN_MAP/PERM_TO_MODULES mas não há item no NAV. Vale
// para o Essencial.
// ============================================================
import { TrazerProdutos } from "@/components/onboarding/TrazerProdutos";

export default function TrazerProdutosScreen() {
  return <TrazerProdutos />;
}
