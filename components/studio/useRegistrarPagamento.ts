// ============================================================
// AURA STUDIO · Registrar o pagamento do saldo da encomenda
//
// 27/08/2026 (relato Sheid Mania). Irmão do useCobrarSaldo — mora aqui pelo
// mesmo motivo: o Kanban de Produção e a aba "A receber" do Hub de Pedidos
// usam os dois, então nenhum dos dois pertence a uma tela.
//
// Um manda a cobrança, o outro registra que o dinheiro entrou. Até este
// conserto só existia o primeiro: a lojista recebia o saldo no Pix e não
// tinha onde dar baixa, porque a única porta era a de crediário — e o Studio
// não liga crediário (não existe fiado no mercado de personalizados). O
// pedido ficava eternamente "em aberto" e o A Receber vencia no Financeiro.
//
// Chama POST /studio/orders/:oid/registrar-pagamento — endpoint do PRÓPRIO
// Studio, fora do gate. Por baixo é a mesma parcela: entra no caixa do dia,
// liquida o A Receber e some da aba "A receber".
//
// POR QUE UM SHEET, E NÃO UM CLIQUE SÓ
// Dinheiro entrando é lançamento contábil, não um toggle. O clique abre o
// sheet pra confirmar VALOR (o padrão é o saldo inteiro, mas parcial
// acontece) e FORMA — que decide em qual linha do caixa isso cai. Um botão
// que lança direto seria irreversível e mudo sobre a forma.
//
// DIFERENÇA DELIBERADA PRO useCobrarSaldo: aquele NÃO recarrega a tela de
// propósito (mandar mensagem não muda o pedido). Este recarrega — o saldo
// mudou de estado, e o card tem que parar de dizer que deve.
// ============================================================
import { useCallback, useState } from "react";
import { toast } from "@/components/Toast";
import { studioApi } from "@/services/studioApi";
import { ehBaixaIntegral, round2 } from "@/components/studio/baixaDeSaldo";

// As mesmas quatro do sinal no PDV (BALANCE_PAYMENT_METHODS no backend):
// dinheiro de verdade entrando no caixa. 'crediario' fica de fora de
// propósito — saldo pago no crediário seria só mais saldo devedor.
export const FORMAS_PAGAMENTO = [
  { key: "dinheiro", label: "Dinheiro", icon: "dollar-sign" },
  { key: "pix", label: "Pix", icon: "zap" },
  { key: "cartao", label: "Crédito", icon: "credit-card" },
  { key: "debito", label: "Débito", icon: "credit-card" },
] as const;

export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]["key"];

export type SaldoParaBaixa = {
  orderId: string;
  installmentId?: string | null; // só pra marcar o botão em carregamento
  customerName?: string | null;
  amount: number;                // saldo em aberto, em reais
  dueDate?: string | null;
  status?: "pending" | "overdue" | null;
};

export type RegistrarPagamentoController = ReturnType<typeof useRegistrarPagamento>;

export function useRegistrarPagamento(
  companyId?: string | null,
  opts?: { onSucesso?: () => void }
) {
  const [alvo, setAlvo] = useState<SaldoParaBaixa | null>(null);
  const [salvando, setSalvando] = useState(false);

  const abrir = useCallback((a: SaldoParaBaixa) => {
    if (!a?.orderId) return;
    setAlvo(a);
  }, []);

  // Não fecha no meio da chamada: o sheet sumindo enquanto o lançamento roda
  // deixaria a lojista sem saber se entrou.
  const fechar = useCallback(() => {
    setSalvando((emAndamento) => {
      if (!emAndamento) setAlvo(null);
      return emAndamento;
    });
  }, []);

  const confirmar = useCallback(
    async function (valor: number, forma: FormaPagamento) {
      if (!companyId || !alvo) return;
      setSalvando(true);
      try {
        // Valor igual ao saldo → manda SEM `amount`, e o servidor baixa o
        // saldo que ele mesmo calculou. Evita que um centavo de arredondamento
        // na tela deixe a encomenda aberta devendo R$ 0,01.
        const integral = ehBaixaIntegral(valor, alvo.amount);
        const r = await studioApi.registrarPagamentoSaldo(companyId, alvo.orderId, {
          method: forma,
          ...(integral ? {} : { amount: round2(valor) }),
        });

        const pago = fmt(Number(r?.paid) || valor);
        if (r?.settled) {
          toast.success(`R$ ${pago} recebido. Encomenda quitada.`);
        } else {
          toast.success(`R$ ${pago} recebido. Faltam R$ ${fmt(Number(r?.remaining) || 0)}.`);
        }
        setAlvo(null);
        opts?.onSucesso?.();
      } catch (e: any) {
        const code = e?.data?.code;
        if (code === "NO_OPEN_BALANCE") {
          // Duas abas na mesma encomenda: alguém já deu baixa. Recarrega pra
          // tela parar de mostrar um saldo que não existe mais.
          toast.error("Esta encomenda já não tem saldo em aberto.");
          setAlvo(null);
          opts?.onSucesso?.();
          return;
        }
        if (code === "BALANCE_UNAVAILABLE") {
          toast.error("Baixa de saldo indisponível no momento. Tente de novo em instantes.");
          return;
        }
        // AMOUNT_ACIMA_DO_SALDO / AMOUNT_INVALIDO / METHOD_INVALIDO já vêm com
        // texto pronto do servidor, e o sheet fica aberto pra corrigir.
        toast.error(e?.data?.error || e?.message || "Não foi possível registrar o pagamento.");
      } finally {
        setSalvando(false);
      }
    },
    [companyId, alvo, opts]
  );

  return {
    alvo,
    salvando,
    abrir,
    fechar,
    confirmar,
    // Marca o botão do card que abriu o sheet (mesmo contrato do cobrandoId).
    registrandoId: alvo ? alvo.installmentId || alvo.orderId : null,
  };
}

function fmt(v: number) {
  return v.toFixed(2).replace(".", ",");
}
