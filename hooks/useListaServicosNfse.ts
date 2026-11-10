// ============================================================
// AURA. — Lista de Serviços Nacional da NFS-e, sob demanda
//
// A lista oficial (constants/nfseListaServicos.ts, ~80 KB de texto) só é
// carregada quando alguém abre a seção "Nota de serviço (NFS-e)" de um
// serviço. Uma vez carregada, fica em memória para o resto da sessão.
// Falhar ao carregar não trava nada: o campo de 6 números continua
// funcionando, só sem a busca por palavra.
// ============================================================
import { useEffect, useState } from "react";
import type { ListaNfse } from "@/utils/nfseServico";

let carregada: ListaNfse | null = null;
let promessa: Promise<ListaNfse> | null = null;

export function carregarListaServicosNfse(): Promise<ListaNfse> {
  if (carregada) return Promise.resolve(carregada);
  if (!promessa) {
    promessa = import("@/constants/nfseListaServicos")
      .then((m) => {
        carregada = { linhas: m.LISTA_SERVICOS_NACIONAL, itens: m.ITENS_DA_LISTA };
        return carregada;
      })
      .catch((e) => {
        promessa = null; // a próxima abertura tenta de novo
        throw e;
      });
  }
  return promessa;
}

export function useListaServicosNfse(ativo: boolean): { lista: ListaNfse | null; erro: boolean } {
  const [lista, setLista] = useState<ListaNfse | null>(carregada);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (!ativo || lista) return;
    let vivo = true;
    carregarListaServicosNfse()
      .then((l) => { if (vivo) { setLista(l); setErro(false); } })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [ativo, lista]);
  return { lista, erro };
}
