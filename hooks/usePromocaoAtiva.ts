// ============================================================
// AURA. — Promoção ativa do checkout (13/10/2026)
//
// GET /companies/:id/billing/promocao-ativa, com cache simples em módulo: o
// checkout e a faixa do Caixa (AvisoAssine) perguntam a mesma coisa, e a
// faixa aparece em toda abertura do Caixa. Cinco minutos bastam — o prazo
// da promoção é em dias. Falha de API não aparece: sem promoção, nada muda.
// ============================================================
import { useEffect, useState } from "react";
import { billingApi } from "@/services/billingApi";
import type { PromocaoAtivaResponse } from "@/services/billingApi";
import { promocaoVale } from "@/utils/promocaoPrimeiroMes";

const TTL_MS = 5 * 60 * 1000;
const TTL_FALHA_MS = 30 * 1000;   // não bater na API a cada render quando ela está fora

type Entrada = { em: number; ttl: number; dados: PromocaoAtivaResponse | null };
const cache = new Map<string, Entrada>();
const emVoo = new Map<string, Promise<PromocaoAtivaResponse | null>>();

function lerCache(companyId: string): Entrada | null {
  const e = cache.get(companyId);
  if (!e) return null;
  return Date.now() - e.em < e.ttl ? e : null;
}

/** Busca (ou devolve do cache) a promoção da empresa. Nunca lança. */
export function buscarPromocaoAtiva(companyId: string, forcar = false): Promise<PromocaoAtivaResponse | null> {
  const guardada = forcar ? null : lerCache(companyId);
  if (guardada) return Promise.resolve(guardada.dados);
  const pendente = emVoo.get(companyId);
  if (pendente) return pendente;
  const p = billingApi.promocaoAtiva(companyId)
    .then(function (dados) {
      cache.set(companyId, { em: Date.now(), ttl: TTL_MS, dados: dados || null });
      return dados || null;
    })
    .catch(function () {
      cache.set(companyId, { em: Date.now(), ttl: TTL_FALHA_MS, dados: null });
      return null;
    })
    .then(function (dados) {
      emVoo.delete(companyId);
      return dados;
    });
  emVoo.set(companyId, p);
  return p;
}

/** Esquece o que foi guardado (depois de assinar a promoção deixa de valer). */
export function limparPromocaoAtiva(companyId?: string | null) {
  if (companyId) { cache.delete(companyId); emVoo.delete(companyId); }
  else { cache.clear(); emVoo.clear(); }
}

/**
 * A promoção que vale para a empresa, ou null (sem empresa, API com erro,
 * `elegivel:false`, prazo vencido). Quem chama passa o id (null em demo).
 */
export function usePromocaoAtiva(companyId?: string | null): PromocaoAtivaResponse | null {
  const habilitado = !!companyId;
  const [dados, setDados] = useState<PromocaoAtivaResponse | null>(function () {
    return habilitado ? (lerCache(companyId!)?.dados || null) : null;
  });

  useEffect(function () {
    if (!habilitado) { setDados(null); return; }
    let cancelado = false;
    buscarPromocaoAtiva(companyId!).then(function (p) { if (!cancelado) setDados(p); });
    return function () { cancelado = true; };
  }, [companyId, habilitado]);

  return habilitado && promocaoVale(dados) ? dados : null;
}

/** Só para teste. */
export function _resetPromocaoAtiva() { cache.clear(); emVoo.clear(); }
