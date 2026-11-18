// ============================================================
// AURA. — Aba Pedidos: as ações do pedido (A5b, p-63f, 17/11/2026)
//
// Mockup aprovado em 17/11 (partes 3 e 7). As ações ficam sempre na linha,
// sem depender de passar o mouse (regra 7 do CLAUDE.md):
//   · Avisar (WhatsApp, wa.me): o texto pronto do mockup. No pedido
//     atrasado o botão vira "Lembrar a cliente", com o mesmo texto.
//     Sem telefone que dê para usar, o botão não aparece.
//   · Separar (Aguardando → Separando) e Pronto (Separando → Pronto), pelo
//     PATCH do B3 (Aura-backend#1073), que só anda para a frente, sem
//     e-mail nem baixa.
//   · Nova data (todo pedido aberto): abre o diálogo NovaDataDoPedido, por
//     cima da lista ou da gaveta (JanelaEmpilhada), e grava pelo
//     PATCH /pedidos/:oid/data (Aura-backend#1077).
//   · Na linha, "Mais ações" abre a gaveta do pedido.
//
// Ficam de fora até os cards deles: "Concluir e cobrar" (A6a) e "Cancelar
// pedido" (A7). Nenhum aparece, nem desligado.
// ============================================================
import React, { useState } from "react";
import { View, Linking, StyleSheet } from "react-native";
import { Button } from "@/components/Button";
import { toast } from "@/components/Toast";
import { useMudarSituacaoDoPedido } from "@/hooks/usePedidos";
import { TEXTOS_DOS_PEDIDOS as T, estaAtrasado, linkDoAviso, proximaAcao, situacaoAberta } from "./regrasDosPedidos";
import { NovaDataDoPedido } from "./NovaDataDoPedido";

export type PedidoParaAcao = {
  id: string;
  company_id: string;
  order_number: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  promised_date: string | null;
  /** Quantas peças (a mensagem diz "Sua peça" ou "Suas peças"). */
  pecas: number;
};

type Props = {
  pedido: PedidoParaAcao;
  hoje: string;
  /** "Mais ações" (só na linha): abre a gaveta. */
  onMais?: () => void;
  /** Ocupar a largura (rodapé da gaveta, cartão do celular). */
  cheio?: boolean;
};

export function abrirWhatsapp(link: string) {
  Linking.openURL(link).catch(() => {});
}

export function AcoesDoPedido({ pedido: p, hoje, onMais, cheio }: Props) {
  const { mudarSituacao, mudando, emQual } = useMudarSituacaoDoPedido();
  // Só pedido aberto avisa: concluído e cancelado não têm ação nenhuma.
  const link = situacaoAberta(p.status) ? linkDoAviso(p.customer_phone, p.customer_name, p.pecas) : null;
  const atrasado = estaAtrasado(p.status, p.promised_date, hoje);
  const proxima = proximaAcao(p.status);
  const esteMudando = mudando && !!emQual && emQual.orderId === p.id;
  const [novaData, setNovaData] = useState(false);
  const aberto = situacaoAberta(p.status);

  async function mudar() {
    if (!proxima || mudando) return;
    try {
      await mudarSituacao({ companyId: p.company_id, orderId: p.id, status: proxima.status });
    } catch (err: any) {
      // A frase vem do servidor (409 "Este pedido está pronto e não pode ir
      // para separando.", 500 "Nada foi alterado..."). Sem ela, a do backend.
      toast.error(err?.message || "Não conseguimos mudar a situação do pedido agora. Nada foi alterado. Tente de novo em instantes.");
    }
  }

  return (
    <View style={[s.linha, cheio && s.cheio]}>
      {!!link && (
        <Button
          title={atrasado ? T.lembrar : T.avisar}
          icon="whatsapp"
          size="sm"
          variant="ghost"
          full={cheio}
          onPress={() => abrirWhatsapp(link)}
          accessibilityLabel={(atrasado ? T.lembrar : T.avisar) + " " + (p.customer_name || "") + " no WhatsApp"}
          testID={"pedido-avisar-" + p.id}
        />
      )}
      {!!proxima && (
        <Button
          title={proxima.label}
          size="sm"
          variant="secondary"
          full={cheio}
          loading={esteMudando}
          disabled={mudando && !esteMudando}
          onPress={mudar}
          testID={"pedido-" + proxima.status + "-" + p.id}
        />
      )}
      {aberto && (
        <Button
          title={T.novaData}
          icon="calendar"
          size="sm"
          variant="ghost"
          full={cheio}
          onPress={() => setNovaData(true)}
          accessibilityLabel={T.novaData + " do pedido " + p.order_number}
          testID={"pedido-nova-data-" + p.id}
        />
      )}
      {!!onMais && (
        <Button
          title="…"
          size="sm"
          variant="ghost"
          onPress={onMais}
          accessibilityLabel={"Mais ações do pedido " + p.order_number}
          testID={"pedido-mais-" + p.id}
        />
      )}
      {novaData && aberto && (
        <NovaDataDoPedido pedido={p} hoje={hoje} onClose={() => setNovaData(false)} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", alignItems: "center" },
  cheio: { justifyContent: "flex-start", width: "100%" },
});
