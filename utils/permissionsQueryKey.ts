// 14/09/2026 -- Multi-CNPJ: GET /auth/my-permissions responde pela empresa do
// JWT (ou pela intersecao, em "Todas as empresas"). A chave da query precisa
// carregar esse contexto: com ['my-permissions'] fixa, depois do switchCompany
// o cache seguia ate 5 min (staleTime) com as permissoes da empresa anterior.
//
// Mora em utils/ (e nao no hook) porque o hook importa stores/auth, que nao
// carrega no jest.
export function permissionsQueryKey(
  companyId: string | null | undefined,
  consolidatedView: boolean,
): readonly [string, string] {
  return ['my-permissions', consolidatedView ? 'all' : (companyId || 'none')] as const;
}
