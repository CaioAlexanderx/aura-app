// ============================================================
// AURA. — NFS-e na lista do Estoque (10/11/2026)
//
// Mockup aprovado: docs/mockups/nfse-cadastro-servico.html, tela 2. Serviço
// sem o código de tributação nacional ganha o selo "Falta código da NFS-e"
// e um filtro rápido junta todos eles — só quando a loja emite NFS-e
// (nfse_config.is_active). Loja que não emite: nada muda na lista.
// O filtro vale igual na visão de uma loja e na consolidada.
// ============================================================
import { faltaCodigoNfse } from "@/utils/nfseServico";

export const SELO_FALTA_NFSE = "Falta código da NFS-e";
export const DICA_FALTA_NFSE = "Sem este código a NFS-e não sai sozinha na venda";

export function servicosSemCodigoNfse<T extends { unit?: string | null; nfseCtribnac?: string | null }>(
  itens: T[], emiteNfse: boolean
): T[] {
  if (!emiteNfse) return [];
  return itens.filter((p) => faltaCodigoNfse(p, true));
}

/** O aviso em cima da lista filtrada (com o recado do grupo quando há serviço compartilhado). */
export function avisoDoFiltroNfse(n: number, temDoGrupo: boolean): { forte: string; resto: string } {
  return {
    forte: n === 1 ? "1 serviço está sem o código da nota de serviço." : n + " serviços estão sem o código da nota de serviço.",
    resto: " Sem ele, a NFS-e não sai sozinha na venda. Toque em cada um e escolha o código pelo nome do que você faz — leva menos de um minuto."
      + (temDoGrupo ? " Os serviços do grupo valem para todas as lojas: preenchendo uma vez, resolve em todas." : ""),
  };
}
