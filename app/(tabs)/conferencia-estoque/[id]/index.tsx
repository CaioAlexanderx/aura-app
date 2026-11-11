// ============================================================
// /conferencia-estoque/:id — contar (p-108, entrega B).
// ============================================================
import { useLocalSearchParams } from "expo-router";
import { PortaDaConferencia } from "@/components/screens/conferencia/PortaDaConferencia";
import { ContarConferencia } from "@/components/screens/conferencia/contar/ContarConferencia";

export default function ContarConferenciaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const countId = Array.isArray(id) ? id[0] : id;
  return (
    <PortaDaConferencia>
      {countId ? <ContarConferencia countId={String(countId)} /> : null}
    </PortaDaConferencia>
  );
}
