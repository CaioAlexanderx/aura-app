// ============================================================
// AURA. — usePersonalizadosLiberado: a trava da frente, reativa (p-188)
//
// A mesma conta de travaGeral() (utils/personalizados.ts): a constante
// PERSONALIZADOS_LIBERADO OU a empresa atual ser a de teste
// (company.personalizados_teste === true, do /auth/me). A diferença é a
// inscrição no store: quando o /auth/me chega (abertura, refreshMe no mount
// do shell, useRevalidarMe) e traz a flag, quem usa o hook re-renderiza.
// O seletor devolve um booleano: nada re-renderiza à toa.
//
// No consolidado ("Todas as empresas") a flag não conta: só a constante.
// ============================================================
import { useAuthStore } from "@/stores/auth";
import { PERSONALIZADOS_LIBERADO, testeDaFrenteNaSessao } from "@/utils/personalizados";

export function usePersonalizadosLiberado(): boolean {
  const teste = useAuthStore((st) => testeDaFrenteNaSessao(st as any));
  return PERSONALIZADOS_LIBERADO || teste === true;
}

export default usePersonalizadosLiberado;
