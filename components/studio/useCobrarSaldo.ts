// ============================================================
// AURA STUDIO · Cobrar o saldo da encomenda
//
// 17/08/2026. Usado pelo Kanban de Produção e pela aba "A receber" do Hub
// de Pedidos — por isso mora aqui, e não dentro de uma tela.
//
// Chama POST /studio/orders/:oid/cobrar-saldo — endpoint do PRÓPRIO Studio,
// que NÃO passa pelo gate de crediário.
//
// Por que não usar /credit/collection/trigger: aquelas rotas ficam atrás de
// assertCrediarioEnabled, e o Studio não tem crediário — não existe fiado
// nesse mercado. Exigir o toggle pra cobrar uma encomenda já vendida seria
// pedir pra lojista habilitar um produto que ela não usa; a venda fecharia e
// o dinheiro ficaria sem porta de saída.
//
// A separação é de superfície, não de dado: por baixo é a mesma parcela, e o
// backend reusa o mesmo motor de mensagem + Pix.
//
// Vocabulário: a lojista de personalizados não fala "fiado" nem "crediário" —
// fala em encomenda com saldo. O template 'encomenda' cuida do texto que o
// CLIENTE FINAL lê, sem "parcela 1/1".
// ============================================================
import { useCallback, useState } from "react";
import { Linking } from "react-native";
import { toast } from "@/components/Toast";
import { studioApi } from "@/services/studioApi";

export type SaldoAlvo = {
  orderId: string;
  installmentId?: string | null; // só pra marcar o botão em carregamento
  phone?: string | null;
  customerName?: string | null;
  dueDate?: string | null;
  status?: "pending" | "overdue" | null;
};

export function useCobrarSaldo(companyId?: string | null) {
  const [cobrandoId, setCobrandoId] = useState<string | null>(null);

  const cobrar = useCallback(
    async function (alvo: SaldoAlvo) {
      if (!companyId || !alvo?.orderId) return;
      const marca = alvo.installmentId || alvo.orderId;
      setCobrandoId(marca);
      try {
        // O tom (vence / vence hoje / venceu) sai da data no backend — um
        // template só, sem risco de cobrar "em atraso" o que ainda nem venceu.
        const r = await studioApi.cobrarSaldo(companyId, alvo.orderId);

        const fone = String(r?.phone || alvo.phone || "").replace(/\D/g, "");
        if (!fone) {
          toast.error("Este cliente não tem telefone cadastrado.");
          return;
        }
        const texto = encodeURIComponent(String(r?.message || ""));
        await Linking.openURL(`https://wa.me/${fone}${texto ? "?text=" + texto : ""}`);
      } catch (e: any) {
        if (e?.data?.code === "NO_OPEN_BALANCE") {
          toast.error("Esta encomenda não tem saldo em aberto.");
          return;
        }
        toast.error(e?.data?.error || e?.message || "Não foi possível preparar a cobrança.");
      } finally {
        setCobrandoId(null);
      }
    },
    [companyId]
  );

  return { cobrar, cobrandoId };
}
