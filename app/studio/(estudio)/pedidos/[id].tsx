// ============================================================
// AURA STUDIO · Detalhe de pedido (rota do /studio)
//
// 17/11/2026 (p-176): a tela mora em components/studio/DetalheDoPedido.tsx,
// que o shell Negócio também monta (/personalizados/pedido/[id]). Aqui ela
// entra sem nenhuma prop: o /studio é o de sempre.
// ============================================================
import { DetalheDoPedido } from "@/components/studio/DetalheDoPedido";

export default function StudioOrderDetail() {
  return <DetalheDoPedido />;
}
