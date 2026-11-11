// ============================================================
// AURA. — useConferenciaEstoque: o rascunho de uma conferência (p-108, B)
//
// Carrega a conferência (GET /:countId), mantém as linhas contadas na tela
// e manda cada mudança pela fila (utils/conferenciaContagem.ts): o número
// muda na hora, o servidor confirma depois. Sem rede, a fila guarda no
// aparelho e reenvia sozinha; ao reabrir a tela, o que não tinha chegado
// volta para a fila.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  conferenciaEstoqueApi,
  lerErroDaConferencia,
  type Conferencia,
  type ErroDaConferencia,
} from "@/services/conferenciaEstoqueApi";
import {
  aplicarPendentes,
  anotarSemCadastro,
  arredondar,
  contarNaLinha,
  criarFilaDeContagem,
  guardarPendentes,
  guardarSemCadastro,
  lerPendentesGuardados,
  lerSemCadastro,
  linhasDoServidor,
  type AlvoDaContagem,
  type CodigoSemCadastro,
  type EstadoDaFila,
  type FilaDeContagem,
  type LinhaContada,
  type ResultadoDaFila,
} from "@/utils/conferenciaContagem";

export type AvisoDaContagem = { nome: string; mensagem: string } | null;

const ESTADO_INICIAL: EstadoDaFila = { pendentes: 0, enviando: false, semConexao: false, emPreparo: false };

export function useConferenciaEstoque(companyId: string | null | undefined, countId: string | null | undefined) {
  const pronto = !!companyId && !!countId;
  const consulta = useQuery({
    queryKey: ["conferencia-estoque", companyId, countId],
    queryFn: () => conferenciaEstoqueApi.obter(companyId!, countId!),
    enabled: pronto,
    retry: false,
    // A tela monta as linhas UMA vez com o que vier e depois segue pelas
    // respostas da fila. Sem cache ao sair (gcTime 0): quem pausa e volta
    // pega o rascunho de novo do servidor, nunca uma cópia velha.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const [linhas, setLinhas] = useState<LinhaContada[]>([]);
  const linhasRef = useRef<LinhaContada[]>([]);
  const [estadoFila, setEstadoFila] = useState<EstadoDaFila>(ESTADO_INICIAL);
  const [semCadastro, setSemCadastro] = useState<CodigoSemCadastro[]>([]);
  const [aviso, setAviso] = useState<AvisoDaContagem>(null);
  const [ultima, setUltima] = useState<string | null>(null);
  const filaRef = useRef<FilaDeContagem | null>(null);
  const iniciou = useRef(false);
  const flashTimer = useRef<any>(null);

  const mudarLinhas = useCallback((fn: (l: LinhaContada[]) => LinhaContada[]) => {
    const novas = fn(linhasRef.current);
    linhasRef.current = novas;
    setLinhas(novas);
    return novas;
  }, []);

  const guardar = useCallback(() => {
    if (!countId || !filaRef.current) return;
    guardarPendentes(countId, filaRef.current.pendentes(), linhasRef.current);
  }, [countId]);

  const aoResolver = useCallback((r: ResultadoDaFila) => {
    if (r.tipo === "salvo") {
      mudarLinhas((ls) => ls.map((l) => {
        if (l.chave !== r.chave) return l;
        return {
          ...l,
          item_id: (r.item && r.item.id) || l.item_id,
          variante: l.variante || (r.item && r.item.variante) || null,
          codigo: l.codigo || (r.item && r.item.codigo) || null,
          estado: r.aindaPendente ? "pendente" : "salvo",
          mensagem: null,
        };
      }));
    } else if (r.tipo === "recusado") {
      const linha = linhasRef.current.find((l) => l.chave === r.chave);
      mudarLinhas((ls) => ls.filter((l) => l.chave !== r.chave));
      setAviso({ nome: linha ? linha.nome + (linha.variante ? " · " + linha.variante : "") : "Este item", mensagem: r.mensagem });
    } else if (r.tipo === "erro") {
      mudarLinhas((ls) => ls.map((l) => (l.chave === r.chave ? { ...l, estado: "erro", mensagem: r.mensagem } : l)));
    }
    guardar();
  }, [mudarLinhas, guardar]);

  // Monta a fila quando a conferência chega (uma vez por conferência).
  useEffect(() => {
    if (!consulta.data || iniciou.current || !companyId || !countId) return;
    iniciou.current = true;
    const doServidor = linhasDoServidor(consulta.data.itens);
    const itemIds: Record<string, string> = {};
    doServidor.forEach((l) => { if (l.item_id) itemIds[l.chave] = l.item_id; });
    const guardado = lerPendentesGuardados(countId);
    const rascunho = consulta.data.conferencia && consulta.data.conferencia.status === "rascunho";
    const pendentes = rascunho ? guardado.pendentes : [];
    linhasRef.current = aplicarPendentes(doServidor, pendentes, guardado.nomes);
    setLinhas(linhasRef.current);
    setSemCadastro(lerSemCadastro(countId));

    const fila = criarFilaDeContagem({
      itemIds,
      definir: (op) => conferenciaEstoqueApi.registrarItem(companyId, countId, {
        product_id: op.product_id, variant_id: op.variant_id, quantidade: op.quantidade, modo: "definir",
      }),
      remover: (itemId) => conferenciaEstoqueApi.removerItem(companyId, countId, itemId),
      aoResolver,
      aoMudarEstado: (e) => { setEstadoFila(e); },
    });
    filaRef.current = fila;
    pendentes.forEach((op) => fila.colocar(op));
  }, [consulta.data, companyId, countId, aoResolver]);

  useEffect(() => () => {
    if (filaRef.current) filaRef.current.parar();
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  // Sem rede ao fechar a aba: o que está na fila fica guardado.
  useEffect(() => { guardar(); }, [estadoFila.pendentes, guardar]);

  const marcarUltima = useCallback((chave: string) => {
    setUltima(chave);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setUltima(null), 1600);
  }, []);

  const enviar = useCallback((linha: LinhaContada) => {
    filaRef.current?.colocar({
      tipo: "definir", chave: linha.chave, product_id: linha.product_id, variant_id: linha.variant_id, quantidade: linha.contado,
    });
  }, []);

  /** Bipe (somar 1) ou quantidade digitada (definir). */
  const contar = useCallback((alvo: AlvoDaContagem, modo: "somar" | "definir", quantidade: number) => {
    if (!filaRef.current) return null;
    let mexida: LinhaContada | null = null;
    mudarLinhas((ls) => {
      const r = contarNaLinha(ls, alvo, modo, quantidade);
      mexida = r.linha;
      return r.linhas;
    });
    if (mexida) {
      enviar(mexida);
      marcarUltima((mexida as LinhaContada).chave);
      setAviso(null);
    }
    return mexida;
  }, [mudarLinhas, enviar, marcarUltima]);

  /** + / − na linha. */
  const ajustar = useCallback((chave: string, delta: number) => {
    let mexida: LinhaContada | null = null;
    mudarLinhas((ls) => ls.map((l) => {
      if (l.chave !== chave) return l;
      mexida = { ...l, contado: arredondar(Math.max(0, l.contado + delta)), estado: "pendente", mensagem: null };
      return mexida;
    }));
    if (mexida) enviar(mexida);
  }, [mudarLinhas, enviar]);

  /** Número digitado na linha. */
  const definir = useCallback((chave: string, valor: number) => {
    let mexida: LinhaContada | null = null;
    mudarLinhas((ls) => ls.map((l) => {
      if (l.chave !== chave) return l;
      mexida = { ...l, contado: arredondar(Math.max(0, valor)), estado: "pendente", mensagem: null };
      return mexida;
    }));
    if (mexida) enviar(mexida);
  }, [mudarLinhas, enviar]);

  const remover = useCallback((chave: string) => {
    const linha = linhasRef.current.find((l) => l.chave === chave);
    if (!linha) return;
    mudarLinhas((ls) => ls.filter((l) => l.chave !== chave));
    filaRef.current?.colocar({ tipo: "remover", chave: chave, product_id: linha.product_id, variant_id: linha.variant_id });
  }, [mudarLinhas]);

  const anotarCodigo = useCallback((codigo: string) => {
    setSemCadastro((lista) => {
      const nova = anotarSemCadastro(lista, codigo);
      if (countId) guardarSemCadastro(countId, nova);
      return nova;
    });
  }, [countId]);

  const tirarCodigo = useCallback((codigo: string) => {
    setSemCadastro((lista) => {
      const nova = lista.filter((c) => c.codigo !== codigo);
      if (countId) guardarSemCadastro(countId, nova);
      return nova;
    });
  }, [countId]);

  const reenviar = useCallback(() => { filaRef.current?.reenviarAgora(); }, []);

  const erro: ErroDaConferencia | null = useMemo(
    () => (consulta.error ? lerErroDaConferencia(consulta.error) : null),
    [consulta.error],
  );

  const conferencia: Conferencia | null = consulta.data?.conferencia || null;

  return {
    carregando: pronto && consulta.isLoading,
    erro,
    recarregar: consulta.refetch,
    conferencia,
    escopoTotal: consulta.data?.escopo_total ?? null,
    linhas,
    estadoFila,
    semCadastro,
    aviso,
    fecharAviso: () => setAviso(null),
    ultima,
    contar,
    ajustar,
    definir,
    remover,
    anotarCodigo,
    tirarCodigo,
    reenviar,
  };
}
