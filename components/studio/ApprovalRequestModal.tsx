// ============================================================
// AURA STUDIO · Pedir aprovação da arte: escolhe o modal (27/11/2026)
//
// Novo (ApprovalRequestModalNovo, fiel ao mockup da Nina) atrás da trava
// (aprovacaoDaArte/trava.ts); fora dela, o modal de sempre, intacto, em
// ApprovalRequestModalAtual (cópia fiel do arquivo do main, só renomeada).
// ============================================================
import React from "react";
import type { StudioOrder } from "@/services/studioApi";
import { ApprovalRequestModalAtual } from "@/components/studio/ApprovalRequestModalAtual";
import { ApprovalRequestModalNovo } from "@/components/studio/ApprovalRequestModalNovo";
import { useAprovacaoNova } from "@/components/studio/aprovacaoDaArte/trava";

type Props = {
  order: StudioOrder;
  onClose: () => void;
  onSent: () => void;
};

export function ApprovalRequestModal(props: Props) {
  const nova = useAprovacaoNova();
  return nova ? <ApprovalRequestModalNovo {...props} /> : <ApprovalRequestModalAtual {...props} />;
}

export default ApprovalRequestModal;
