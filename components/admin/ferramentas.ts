// ============================================================================
// AURA. — Gestão Aura › Ferramentas (13/10/2026)
//
// Três telas da gestão existem mas ninguém as alimenta, porque o processo por
// trás delas não roda hoje: SLA (o suporte acontece no WhatsApp), Consultorias
// (só entram por API) e o Pipeline de onboarding (a etapa "CNPJ configurado"
// usa "tem CNPJ e tem regime", e todo cliente tem regime). Elas ficam
// escondidas num grupo recolhido do hub — nada foi apagado, e as rotas de API
// seguem as mesmas. Quando o processo existir, basta tirar a entrada daqui.
//
// O estado aberto/recolhido do grupo fica no navegador (localStorage), sem
// backend. Puro, sem React — o hub e a tela de Operações importam daqui.
// ============================================================================

export type FerramentaKey = "sla" | "consultorias" | "pipeline";

export type Ferramenta = {
  key: FerramentaKey;
  icon: string;
  title: string;
  description: string;
  /** Por que a tela está escondida — uma linha, dita com franqueza. */
  why: string;
  color: string;
};

export var FERRAMENTAS: Ferramenta[] = [
  {
    key: "sla",
    icon: "headset",
    title: "SLA de suporte",
    description: "Tickets abertos, tempo de primeira resposta e de resolução.",
    why: "O suporte acontece no WhatsApp; quase nenhum ticket entra no sistema, então o SLA não mede nada.",
    color: "#06b6d4",
  },
  {
    key: "consultorias",
    icon: "briefcase",
    title: "Consultorias",
    description: "Horas, receita e lista de consultorias registradas.",
    why: "Consultorias só entram por API; ninguém registra por tela, então a lista fica vazia.",
    color: "#f472b6",
  },
  {
    key: "pipeline",
    icon: "filter",
    title: "Pipeline de onboarding",
    description: "Clientes por etapa de configuração, do cadastro ao uso.",
    why: "A etapa \"CNPJ configurado\" conta quem tem CNPJ e regime, e todo cliente tem regime — a coluna fica em 0.",
    color: "#f59e0b",
  },
];

export function ferramentaByKey(key: string | null | undefined): Ferramenta | null {
  for (var i = 0; i < FERRAMENTAS.length; i++) {
    if (FERRAMENTAS[i].key === key) return FERRAMENTAS[i];
  }
  return null;
}

/** Rota da tela de Operações já abrindo a ferramenta pedida. */
export function ferramentaRoute(key: FerramentaKey): string {
  return "/gestao-aura-operacoes?ferramenta=" + key;
}

// ── Estado aberto/recolhido, lembrado no dispositivo ──────────────────────

export var FERRAMENTAS_STORAGE_KEY = "aura_gestao_ferramentas_aberto";

function storage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch (e) { /* storage bloqueado */ }
  return null;
}

/** Sem nada salvo (ou sem localStorage) o grupo começa recolhido. */
export function loadFerramentasAberto(): boolean {
  var st = storage();
  if (!st) return false;
  try {
    return st.getItem(FERRAMENTAS_STORAGE_KEY) === "1";
  } catch (e) {
    return false;
  }
}

export function saveFerramentasAberto(aberto: boolean): void {
  var st = storage();
  if (!st) return;
  try {
    if (aberto) st.setItem(FERRAMENTAS_STORAGE_KEY, "1");
    else st.removeItem(FERRAMENTAS_STORAGE_KEY);
  } catch (e) { /* cota cheia ou storage bloqueado: segue sem lembrar */ }
}
