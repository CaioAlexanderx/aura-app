// ============================================================
// /conferencia-estoque — começar uma conferência e continuar os rascunhos
// (p-108, entrega B). A porta refaz o /auth/me, confere o módulo
// `conferencia_estoque` e, no consolidado, pergunta a loja.
// ============================================================
import { PortaDaConferencia } from "@/components/screens/conferencia/PortaDaConferencia";
import { ComecarConferencia } from "@/components/screens/conferencia/ComecarConferencia";

export default function ConferenciaEstoqueScreen() {
  return (
    <PortaDaConferencia>
      <ComecarConferencia />
    </PortaDaConferencia>
  );
}
