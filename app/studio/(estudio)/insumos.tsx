// ============================================================
// AURA STUDIO · Insumos / Matéria-prima + Fichas Técnicas
//
// A tela mora em components/studio/TelaDeInsumos.tsx desde o p-178
// (17/11/2026), para o shell Negócio montar a mesma tela em
// /personalizados/insumos. Aqui, sem props: os destinos e textos padrão
// são os do /studio de sempre (a ficha abre /studio/estoque).
// ============================================================
import { TelaDeInsumos } from "@/components/studio/TelaDeInsumos";

export default function StudioInsumos() {
  return <TelaDeInsumos />;
}
