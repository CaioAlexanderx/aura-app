// ============================================================
// AURA. — Rota /checkin (cartão t1-12, parte 2; 14/10/2026)
//
// Check-in de entrada: 3 perguntas em chip, depois da escolha de frente e
// antes do Painel. Tela cheia de propósito (sem sidebar): é a abertura do
// primeiro minuto, não uma tela do menu — por isso a chave de módulo
// `onboarding.checkin` existe em MODULE_PLAN_MAP/PERM_TO_MODULES mas não há
// item no NAV (mesmo desenho de `crediario.config` e
// `onboarding.primeiros_passos`). Vale para o Essencial.
//
// Quem leva até aqui é useCheckinGate (Painel). Abrir a URL direto sem o
// check-in habilitado manda para o Painel.
// ============================================================
import { CheckinEntrada } from "@/components/onboarding/CheckinEntrada";

export default function CheckinScreen() {
  return <CheckinEntrada />;
}
