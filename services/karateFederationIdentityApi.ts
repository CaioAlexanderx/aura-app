// ============================================================
// AURA KARATÊ — IDENTIDADE DA FEDERAÇÃO (nome + logo, leitura)
//
//   GET /federation/:id/identity
//
// Criamos uma segunda federação (JKA Teste) em 16/09/2026 e ela expôs o
// problema: o app dizia "FPKT" para quem não é FPKT. A regra que saiu daí
// (diretriz do Caio) é que NENHUMA identidade de federação seja escrita no
// código — tudo deriva do cadastro. Este é o ÚNICO ponto do app que busca
// essa identidade; quem a consome lê do KarateFederationContext.
//
// ⚠️ NÃO usar o JWT como fonte da logo. O auth store carrega company do
// token na inicialização e nunca revalida: a logo ficaria presa na versão
// do último login (e uma troca de logo só apareceria no próximo). O nome
// segue vindo do JWT como semente (company.name) porque é instantâneo e
// muda com muito menos frequência — o GET daqui corrige quando responde.
//
// Por que não reaproveitar GET /settings/identity: aquele é adminOnly
// (karateSettings.js) e a logo aparece na sidebar de TODO mundo — staff,
// sensei, dojô. Esta rota é a versão de leitura pública-para-logados do
// mesmo cadastro.
//
// FAIL-SOFT por contrato: qualquer erro (404 enquanto o backend não
// deployou, 403, rede) devolve null e o shell cai no monograma. Identidade
// visual nunca derruba tela nem vira toast.
//
// Normalização DEFENSIVA (mesmo racional de normalizeDojoMe): aceita o
// objeto cru ou embrulhado em { federation }, e a logo em logo_url ou
// karate_logo_url — o shape pode evoluir sem quebrar a sidebar.
// ============================================================
import { request } from "@/services/api";

export interface FederationIdentityBrand {
  id: string | null;
  name: string | null;
  slug: string | null;
  /** URL absoluta do R2, já com ?v= de cache-buster. null → monograma. */
  logo_url: string | null;
}

function str(v: any): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function normalizeFederationIdentity(raw: any): FederationIdentityBrand {
  const f =
    raw && typeof raw === "object" && raw.federation && typeof raw.federation === "object"
      ? raw.federation
      : raw ?? {};
  return {
    id: str(f.id),
    name: str(f.name),
    slug: str(f.slug),
    logo_url: str(f.logo_url) ?? str(f.karate_logo_url),
  };
}

export const karateFederationIdentityApi = {
  getIdentity: async (federationId: string): Promise<FederationIdentityBrand> =>
    normalizeFederationIdentity(
      await request<any>(`/federation/${federationId}/identity`)
    ),
};
