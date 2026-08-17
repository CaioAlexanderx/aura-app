// ============================================================
// AURA STUDIO · Cobrar o saldo da encomenda
//
// 17/08/2026. Usado pelo Kanban de Produção e pela aba "A receber" do Hub
// de Pedidos — por isso mora aqui, e não dentro de uma tela.
//
// Reusa o motor de cobrança que já existe no crediário
// (POST /credit/collection/trigger/:iid): ele monta a mensagem, calcula
// dias de atraso e gera o Pix copia-e-cola com encargos do dia. Aqui só
// escolhemos o tom certo e abrimos o WhatsApp.
//
// Vocabulário: a lojista de personalizados não fala "fiado" nem
// "crediário" — fala em encomenda com saldo. Toda mensagem visível segue
// esse vocabulário, mesmo que o dado por baixo seja uma parcela.
// ============================================================
import { useCallback, useState } from "react";
import { Linking } from "react-native";
import { toast } from "@/components/Toast";
import { creditApi } from "@/services/creditApi";

export type SaldoAlvo = {
  installmentId: string;
  phone?: string | null;
  customerName?: string | null;
  dueDate?: string | null;
  status?: "pending" | "overdue" | null;
};

// O backend tem 6 templates. Três servem aqui, e escolher errado é
// constrangedor: cobrar "X dias em atraso" um saldo que vence semana que
// vem queima a lojista com o cliente dela.
export function templateParaSaldo(dueDate?: string | null, status?: string | null): string {
  if (status === "overdue") return "atraso_1";
  if (!dueDate) return "lembrete";
  const hoje = new Date();
  const hojeISO = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  if (dueDate < hojeISO) return "atraso_1";
  if (dueDate === hojeISO) return "vencimento";
  return "lembrete";
}

export function useCobrarSaldo(companyId?: string | null) {
  const [cobrandoId, setCobrandoId] = useState<string | null>(null);

  const cobrar = useCallback(
    async function (alvo: SaldoAlvo) {
      if (!companyId || !alvo?.installmentId) return;
      setCobrandoId(alvo.installmentId);
      try {
        const r = await creditApi.triggerCollection(companyId, alvo.installmentId, {
          template: templateParaSaldo(alvo.dueDate, alvo.status),
          channel: "whatsapp",
        });

        const fone = String(r?.phone || alvo.phone || "").replace(/\D/g, "");
        const texto = encodeURIComponent(String(r?.message || ""));
        if (!fone) {
          // Sem telefone não há como abrir a conversa. A mensagem já foi
          // gerada, então entregamos ela em vez de só falhar.
          toast.error("Este cliente não tem telefone cadastrado.");
          return;
        }
        await Linking.openURL(`https://wa.me/${fone}${texto ? "?text=" + texto : ""}`);
      } catch (e: any) {
        // As rotas de /credit ficam atrás de assertCrediarioEnabled. Sem o
        // toggle, a venda com sinal fecha normalmente mas a cobrança volta
        // 403 — meia funcionalidade. O erro genérico não diz o que fazer.
        if (e?.status === 403 || e?.data?.code === "CREDIARIO_DISABLED") {
          toast.error(
            "Para cobrar o saldo, ative Crediário em Configurações › PDV › Políticas do Caixa."
          );
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
