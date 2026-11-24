// ============================================================
// AURA. — Filtro "Loja" lembrado por tela e por empresa (INC-2026-11-18-01)
//
// Regras em utils/lojaDona.ts. Este hook só guarda a escolha: lê ao abrir
// (e ao trocar de empresa), grava ao escolher. Sem contexto de lojas a
// escolha efetiva é sempre "Todas as lojas".
// ============================================================
import { useEffect, useState } from "react";
import {
  lerLojaEscolhida, salvarLojaEscolhida, lojaValida, TODAS_AS_LOJAS,
  type ContextoDeLojas, type TelaDoFiltroDeLoja,
} from "@/utils/lojaDona";

export function useFiltroDeLoja(
  tela: TelaDoFiltroDeLoja,
  empresaId: string | null | undefined,
  ctx: ContextoDeLojas | null,
): [string, (loja: string) => void] {
  var [escolha, setEscolha] = useState<string>(function () { return lerLojaEscolhida(tela, empresaId); });
  useEffect(function () { setEscolha(lerLojaEscolhida(tela, empresaId)); }, [tela, empresaId]);
  function escolher(loja: string) {
    var v = loja || TODAS_AS_LOJAS;
    setEscolha(v);
    salvarLojaEscolhida(tela, empresaId, v);
  }
  return [lojaValida(ctx, escolha), escolher];
}
