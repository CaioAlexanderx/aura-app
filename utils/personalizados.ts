// ============================================================
// AURA. — Personalizados: a frente Studio dentro do shell Negócio (p-128)
//
// Decisão do Caio (16/11/2026): Personalizados vira frente do Negócio e
// deixam de nascer empresas no /studio. Nesta primeira fase a seção só
// existe para a empresa que:
//
//   1. tem pdv_settings.studio_enabled === true (o mesmo interruptor que o
//      backend lê em ehLojaStudio), E
//   2. NÃO tem vertical_active. Quem tem vertical_active = 'studio' continua
//      no shell /studio (app/_layout.tsx manda para lá) e não vê nada disto;
//      outra vertical (food, odonto, karatê) tem shell próprio.
//
// Função pura, sem hook: o menu (app/(tabs)/_layout.tsx), a linha de
// permissão (components/MembersSection.tsx) e as telas de
// app/(tabs)/personalizados leem a MESMA conta.
//
// Multi-CNPJ: no consolidado ("Todas as empresas") não existe uma loja só
// para ler o interruptor. A conta vale loja por loja
// (hooks/useLojasComPersonalizados.ts): a Produção e os Orçamentos 3D
// mostram, só para ler, as lojas com a frente ligada (p-187). Mutação só
// por CNPJ: cada item tem "Abrir na loja".
// ============================================================

type ComStudioEnabled = { studio_enabled?: unknown } | null | undefined;

// 16/11/2026 (Caio): nada de Personalizados aparece na tela de ninguém até a
// migração completa do Studio para o shell Negócio. Antes de ligar, o Caio
// fala com as clientes. Enquanto isto for false, a seção do menu, a linha de
// permissão em Membros e a tela /personalizados/producao não existem para
// nenhuma empresa, com ou sem studio_enabled. Ligar é trocar para true num
// PR próprio, com o OK do Caio. Até lá, só a empresa de teste
// (personalizados_teste, abaixo) vê a frente.
export const PERSONALIZADOS_LIBERADO = false;

// ── Conta de teste (p-188, 18/11/2026) ──────────────────────────────────
// Antes da virada (p-190) a frente liga numa empresa de teste, e só nela:
// company.personalizados_teste === true, que o /auth/me manda só quando a
// equipe grava companies.studio_settings.personalizados_teste = true
// (Aura-backend, routes/auth.js; o lojista não grava nem apaga a chave).
// Para qualquer outra empresa o campo nem vem, e a trava é a constante.
//
// A trava vale para a empresa ATUAL da sessão. No consolidado ("Todas as
// empresas") não há empresa atual: ali só a constante conta, e a flag de
// uma loja nunca libera as outras (hooks/useLojasComPersonalizados.ts).
type ComTesteDaFrente = { personalizados_teste?: unknown } | null | undefined;
type SessaoDaTrava = { company?: ComTesteDaFrente; consolidatedView?: unknown } | null | undefined;

/** A empresa é a de teste da frente? (só o booleano true do /auth/me conta) */
export function empresaDeTesteDaFrente(company: ComTesteDaFrente): boolean {
  return !!company && typeof company === "object" && company.personalizados_teste === true;
}

/** A sessão está numa empresa de teste da frente? Consolidado: nunca. */
export function testeDaFrenteNaSessao(sessao: SessaoDaTrava): boolean {
  if (!sessao || typeof sessao !== "object" || sessao.consolidatedView === true) return false;
  return empresaDeTesteDaFrente(sessao.company);
}

// Lida na hora, sem import no topo: o store de auth não depende deste
// arquivo e este não passa a depender dele no carregamento (sem ciclo).
// Store ausente ou mockado sem getState: só a constante.
function sessaoAtual(): SessaoDaTrava {
  try {
    const { useAuthStore } = require("@/stores/auth") as typeof import("@/stores/auth");
    if (!useAuthStore || typeof (useAuthStore as any).getState !== "function") return null;
    return useAuthStore.getState() as SessaoDaTrava;
  } catch {
    return null;
  }
}

/**
 * A trava de agora: a geral (PERSONALIZADOS_LIBERADO) OU a empresa atual
 * ser a de teste. É o padrão de todas as funções abaixo. Quem chama em
 * render precisa estar inscrito na empresa do store (useAuthStore com
 * `company`) para reagir quando o /auth/me chega; o menu, Membros e o
 * banner usam hooks/usePersonalizadosLiberado.ts.
 */
export function travaGeral(): boolean {
  if (PERSONALIZADOS_LIBERADO) return true;
  return testeDaFrenteNaSessao(sessaoAtual());
}

/** A trava geral, lida por função (os testes ligam por mock, como personalizadosAtivo). */
export function personalizadosLiberado(liberado: boolean = travaGeral()): boolean {
  return liberado === true;
}

export function personalizadosAtivo(
  settings: ComStudioEnabled,
  verticalActive: string | null | undefined,
  liberado: boolean = travaGeral(),
): boolean {
  if (liberado !== true) return false;
  if (!settings || settings.studio_enabled !== true) return false;
  return verticalActive == null || verticalActive === "";
}

// ── Casa no Negócio (p-189, 17/11/2026) ─────────────────────────────────
// A virada do /studio para o shell Negócio é por empresa, pela equipe:
// company.casa_negocio === true (vem do /auth/me; Aura-backend,
// services/casaNegocio.js). Ao ligar, o backend já tira o vertical_active;
// o app respeita a casa também com um vertical_active = 'studio' ainda
// guardado (sessão aberta antes da troca, último /me do aparelho).
// Com a trava desligada (PERSONALIZADOS_LIBERADO em false e empresa que não
// é a de teste, travaGeral) nada disto conta: o app
// decide como sempre, só por vertical_active.
type ComCasa = { casa_negocio?: unknown; vertical_active?: unknown } | null | undefined;

export function casaNoNegocio(company: ComCasa, liberado: boolean = travaGeral()): boolean {
  if (liberado !== true) return false;
  return !!company && company.casa_negocio === true;
}

/** A empresa abre no shell /studio? (vertical Studio e casa no Negócio desligada). */
export function vaiParaOStudio(company: ComCasa, liberado: boolean = travaGeral()): boolean {
  if (!company || company.vertical_active !== "studio") return false;
  return !casaNoNegocio(company, liberado);
}

/** As chaves de módulo da frente: primeiro os itens do menu, depois as subtelas. */
export const MODS_PERSONALIZADOS = [
  "personalizados.orcamentos",
  "personalizados.producao",
  "personalizados.insumos",
  "personalizados.galeria",
  "personalizados.pedido",
  "personalizados.ficha",
  "personalizados.loja",
  "personalizados.config",
] as const;
