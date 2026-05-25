import { StudioPlaceholder } from "@/components/studio/StudioPlaceholder";

export default function StudioGestaoContabilidade() {
  return (
    <StudioPlaceholder
      icon="check"
      phase="Atalho · módulo contábil do Aura"
      title="Contabilidade"
      subtitle="SPED, balancete e portal do contador. Tudo unificado com o resto do Aura — Studio entra no agregado contábil padrão."
      bullets={[
        "Exportação SPED Fiscal e SPED Contribuições",
        "Balancete mensal pro contador baixar",
        "Portal do contador com acesso read-only",
        "Reaproveita módulo contábil do Aura — sem duplicação",
      ]}
    />
  );
}
