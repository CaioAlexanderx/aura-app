import { StudioPlaceholder } from "@/components/studio/StudioPlaceholder";

export default function StudioInsumos() {
  return (
    <StudioPlaceholder
      icon="package"
      phase="Fase 3 · em construção"
      title="Insumos e matéria-prima"
      subtitle="Controle o que você consome de verdade — canecas brancas, tinta sublimática, papel A4. Cada venda dá baixa nos insumos, não no produto-final (que é configurado a cada pedido)."
      bullets={[
        "Cadastro de insumos com unidade, custo e estoque",
        "Ficha técnica vinculando produto-final ↔ insumos consumidos",
        "Baixa automática ao confirmar pedido",
        "Alertas de estoque baixo + sugestão de pedido de reposição",
      ]}
    />
  );
}
