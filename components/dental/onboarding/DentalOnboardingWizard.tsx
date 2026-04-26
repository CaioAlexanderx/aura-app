import { SpotlightTour, type TourStep } from "@/components/dental/onboarding/SpotlightTour";
import { useShouldShowDentalOnboarding } from "@/hooks/useDentalOnboarding";

// ============================================================
// DentalOnboardingWizard — wizard de boas-vindas que roda na
// primeira sessao de cada device dental.
//
// 8 steps: welcome, tour spotlight em 5 areas operacionais
// (Hoje, Pacientes, Atendimento, Faturamento, Comunicacao),
// dica de atalhos, conclusao.
//
// Web only — dependencia de DOM (SpotlightTour).
//
// Re-acionavel via useDentalOnboarding.getState().reset() (futuro:
// botao em DentalSettings junto com "Reproduzir intro").
// ============================================================

const STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Bem-vindo à Aura Odonto",
    body: "Vou te apresentar rapidamente as principais áreas do seu painel clínico. Pode pular a qualquer momento.",
    cta: "Começar tour",
  },
  {
    id: "hoje",
    targetSelector: '[data-tour="dental-nav-hoje"]',
    title: "Hoje",
    body: "Sua página inicial. Saudáção do dia, KPIs principais, próximos atendimentos e a visão ordenada por persona (dentista, recepção ou gestor).",
    position: "right",
  },
  {
    id: "pacientes",
    targetSelector: '[data-tour="dental-nav-pacientes"]',
    title: "Pacientes",
    body: "Cadastro completo, funil de leads, lista de espera e check-in do dia. Cada paciente é um cliente do CRM Aura — dado não vive em silo.",
    position: "right",
  },
  {
    id: "atendimento",
    targetSelector: '[data-tour="dental-nav-atendimento"]',
    title: "Atendimento",
    body: "Espaço clínico do dentista: odontograma e prontuário para consulta direta. Anamnese, periograma e fichas específicas vivem dentro de cada paciente.",
    position: "right",
  },
  {
    id: "faturamento",
    targetSelector: '[data-tour="dental-nav-faturamento"]',
    title: "Faturamento",
    body: "Cobranças, NFS-e, TISS, repasses e convênios. Tudo que recebe ou paga aqui aparece automaticamente no DRE da clínica.",
    position: "right",
  },
  {
    id: "comunicacao",
    targetSelector: '[data-tour="dental-nav-comunicacao"]',
    title: "Comunicação",
    body: "Recall, retorno e automações de mensagens. Configurar uma vez e a régua roda sozinha cuidando do vínculo com o paciente.",
    position: "right",
  },
  {
    id: "shortcuts",
    title: "Atalhos rápidos",
    body: "Pressione ? a qualquer momento para abrir a lista de atalhos de teclado. Use g + h para Hoje, g + p para Pacientes, e por aí vai — estilo Gmail.",
    cta: "Quase lá",
  },
  {
    id: "done",
    title: "Pronto. Boa clínica.",
    body: "Próximo passo recomendado: ir em Configurações da Clínica para cadastrar suas cadeiras e a equipe de dentistas. Após isso, seu painel está 100% funcional.",
    cta: "Concluir",
  },
];

export function DentalOnboardingWizard() {
  const { shouldShow, markCompleted } = useShouldShowDentalOnboarding();

  return (
    <SpotlightTour
      steps={STEPS}
      open={shouldShow}
      onComplete={markCompleted}
      onSkip={markCompleted}
    />
  );
}

export default DentalOnboardingWizard;
