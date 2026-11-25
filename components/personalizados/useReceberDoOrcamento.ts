// ============================================================
// AURA. — Personalizados: receber o que falta do pedido de orçamento (p-185)
//
// Decisão do Caio (D6, 25/11/2026): o saldo é baixado na Produção. O cartão
// da Fila e o detalhe do pedido abrem a MESMA folha da baixa do Studio
// (RegistrarPagamentoSheet), com o valor fixo no que falta e as quatro formas
// do Caixa. Confirmar:
//   1. pedido aprovado antes do Aura-backend#1106 (falta > soma dos marcos
//      pendentes): cria o marco `balance` pela diferença;
//   2. baixa cada marco pendente, na ordem (sinal antes do saldo), pelo
//      POST /studio/payments/:pid/mark-paid com a forma escolhida. O backend
//      lança a entrada no Financeiro e abate a conta "Pedido a receber".
//
// IDEMPOTÊNCIA: uma Idempotency-Key por marco, a MESMA em toda nova tentativa
// dele (timeout seguido de outro toque não lança duas vezes; o backend
// responde ja_pago). Troca só no 409 IDEMPOTENCY_KEY_REUSED, como a venda
// (utils/chaveDaVenda). O marco criado no passo 1 fica guardado até a baixa
// dar certo, para a nova tentativa não criar outro.
//
// Erros: a frase pronta do backend (`error`). Pedido que mudou por fora
// (fechado, já lançado, cancelado) fecha a folha e recarrega.
// ============================================================
import { useCallback, useRef, useState } from "react";
import { toast } from "@/components/Toast";
import { studioApi, type StudioOrder } from "@/services/studioApi";
import { novaChaveDaVenda, chaveDaVendaJaUsada } from "@/utils/chaveDaVenda";
import type { SaldoParaBaixa } from "@/components/studio/useRegistrarPagamento";
import {
  CODIGOS_QUE_RECARREGAM, METHOD_DA_FORMA, faltaReceberDoOrcamento, idDoPedidoDosMarcos, marcosDaBaixa,
  type FormaDoOrcamento,
} from "@/components/personalizados/regrasDoReceber";

type PedidoDoOrcamento = Pick<
  StudioOrder,
  "id" | "digital_order_id" | "customer_name" | "orcamento_falta_receber" | "orcamento_pagamentos_pendentes"
>;

type Alvo = SaldoParaBaixa & { pedido: PedidoDoOrcamento; depois?: () => void };

// Na memória da aba: a chave pendente sobrevive à folha fechada e reaberta.
const chavesDosMarcos = new Map<string, string>();
const marcosCriados = new Map<string, { id: string; amount: number }>();

/** Só para testes. */
export function __zerarChavesDoOrcamentoParaTestes() {
  chavesDosMarcos.clear();
  marcosCriados.clear();
}

function chaveDoMarco(cid: string, pid: string): string {
  const k = `${cid}:${pid}`;
  let v = chavesDosMarcos.get(k);
  if (!v) { v = novaChaveDaVenda(); chavesDosMarcos.set(k, v); }
  return v;
}

const fmt = (v: number) => v.toFixed(2).replace(".", ",");

export type ReceberDoOrcamentoController = ReturnType<typeof useReceberDoOrcamento>;

export function useReceberDoOrcamento(companyId?: string | null, opts?: { onSucesso?: () => void }) {
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [salvando, setSalvando] = useState(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  /** Abre a baixa. `depois` roda só quando tudo entrou (o "Receber agora" do entregar). */
  const abrir = useCallback((pedido: PedidoDoOrcamento, depois?: () => void) => {
    const falta = faltaReceberDoOrcamento(pedido);
    if (!pedido?.id || falta === null) return;
    setAlvo({ orderId: pedido.id, customerName: pedido.customer_name, amount: falta, pedido, depois });
  }, []);

  const fechar = useCallback(() => {
    setSalvando((emAndamento) => {
      if (!emAndamento) setAlvo(null);
      return emAndamento;
    });
  }, []);

  const confirmar = useCallback(async (_valor: number, forma: string) => {
    if (!companyId || !alvo) return;
    const cid = companyId;
    const f = forma as FormaDoOrcamento;
    setSalvando(true);
    let recebido = 0;
    let falta: number | null = null;
    let marcoAtual: string | null = null;
    const oid = idDoPedidoDosMarcos(alvo.pedido as any);
    try {
      const { pendentes, semMarco } = marcosDaBaixa(alvo.pedido);
      const lista: Array<{ id: string; amount: number }> = [...pendentes];
      if (semMarco > 0) {
        const k = `${cid}:${oid}`;
        let criado = marcosCriados.get(k);
        if (!criado || Math.abs(criado.amount - semMarco) > 0.004) {
          const m = await studioApi.createOrderPayment(cid, oid, { kind: "balance", amount: semMarco });
          criado = { id: String(m.id), amount: semMarco };
          marcosCriados.set(k, criado);
        }
        lista.push(criado);
      }
      for (const p of lista) {
        marcoAtual = p.id;
        const r = await studioApi.markPaymentPaid(
          cid, p.id, { forma: f, method: METHOD_DA_FORMA[f] }, { idempotencyKey: chaveDoMarco(cid, p.id) },
        );
        chavesDosMarcos.delete(`${cid}:${p.id}`);
        recebido += p.amount;
        if (r && typeof r.falta_receber === "number") falta = r.falta_receber;
      }
      marcosCriados.delete(`${cid}:${oid}`);
      if (falta === null) falta = Math.max(alvo.amount - recebido, 0);
      if (falta <= 0.004) toast.success(`R$ ${fmt(recebido)} recebido. Encomenda quitada.`);
      else toast.success(`R$ ${fmt(recebido)} recebido. Faltam R$ ${fmt(falta)}.`);
      const depois = alvo.depois;
      setAlvo(null);
      // Com `depois` (receber e entregar), quem recarrega é o entregar: dois
      // recarregamentos ao mesmo tempo desfaziam o cartão já movido.
      if (depois) depois();
      else optsRef.current?.onSucesso?.();
    } catch (e: any) {
      const code = e?.data?.code || e?.code;
      // A chave deste marco já registrou outro pagamento: a próxima tentativa vai com outra.
      if (chaveDaVendaJaUsada(e) && marcoAtual) chavesDosMarcos.set(`${cid}:${marcoAtual}`, novaChaveDaVenda());
      toast.error(e?.data?.error || e?.message || "Não foi possível registrar o pagamento.");
      if (recebido > 0 || CODIGOS_QUE_RECARREGAM.has(String(code || ""))) {
        setAlvo(null);
        optsRef.current?.onSucesso?.();
      }
    } finally {
      setSalvando(false);
    }
  }, [companyId, alvo]);

  return { alvo, salvando, abrir, fechar, confirmar };
}
