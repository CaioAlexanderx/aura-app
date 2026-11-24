// ============================================================
// AURA. — Venda concluída na ótica: o cliente da venda tem cadastro
// completo para a NF-e? (hotfix 24/11/2026)
//
// Pergunta à prévia da NF-e de venda (GET .../nfe55/venda/:saleId/previa,
// só leitura: monta o destinatário do cadastro do cliente e devolve os
// faltantes, sem reservar número). A regra do "completo" é pura, em
// utils/nfe55.destinatarioCompletoNaPrevia.
//
//   - só chama com `ativo` (loja com Ótica E cliente na venda); as outras
//     lojas não fazem chamada nenhuma;
//   - uma chamada por venda: a resposta fica num cache do módulo, por
//     loja + venda, e sobrevive a re-render e remontagem da tela final;
//   - erro de rede, 4xx, bloqueio (UF não liberada, regime normal...) =
//     "incompleto", sem mensagem: a tela segue com a NFC-e de sempre;
//   - `prazoMs` (com a emissão automática ligada): a NFC-e automática espera
//     a prévia no máximo esse tempo. Passou do prazo, a decisão fica
//     "incompleto" para esta venda (a NFC-e automática sai e não volta atrás).
// ============================================================
import { useEffect, useState } from "react";
import { nfe55Api } from "@/services/nfe55Api";
import { destinatarioCompletoNaPrevia } from "@/utils/nfe55";

export type EstadoClienteNaOtica = "fora" | "carregando" | "completo" | "incompleto";

const consultas = new Map<string, Promise<boolean>>();
const decisoes = new Map<string, boolean>();

/** Só para testes. */
export function _limparClienteCompletoNaOtica() {
  consultas.clear();
  decisoes.clear();
}

function consultar(chave: string, companyId: string, saleId: string): Promise<boolean> {
  let p = consultas.get(chave);
  if (!p) {
    p = nfe55Api.previa(companyId, saleId).then(
      (previa) => destinatarioCompletoNaPrevia(previa),
      () => false,
    );
    consultas.set(chave, p);
  }
  return p;
}

export function useClienteCompletoNaOtica(
  ativo: boolean,
  companyId: string | null | undefined,
  saleId: string | null | undefined,
  prazoMs?: number | null,
): EstadoClienteNaOtica {
  const chave = ativo && companyId && saleId ? companyId + ":" + saleId : null;
  const [estado, setEstado] = useState<EstadoClienteNaOtica>(() => {
    if (!chave) return "fora";
    const d = decisoes.get(chave);
    return d === undefined ? "carregando" : d ? "completo" : "incompleto";
  });

  useEffect(() => {
    if (!chave || !companyId || !saleId) { setEstado("fora"); return; }
    const decidir = (ok: boolean) => {
      if (!decisoes.has(chave)) decisoes.set(chave, ok);
      setEstado(decisoes.get(chave) ? "completo" : "incompleto");
    };
    const ja = decisoes.get(chave);
    if (ja !== undefined) { setEstado(ja ? "completo" : "incompleto"); return; }
    let vivo = true;
    const timer = prazoMs && prazoMs > 0
      ? setTimeout(() => { if (vivo) decidir(false); }, prazoMs)
      : null;
    consultar(chave, companyId, saleId).then((ok) => { if (vivo) decidir(ok); });
    return () => { vivo = false; if (timer) clearTimeout(timer); };
  }, [chave, companyId, saleId, prazoMs]);

  return estado;
}
