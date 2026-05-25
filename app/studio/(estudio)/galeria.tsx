import { StudioPlaceholder } from "@/components/studio/StudioPlaceholder";

export default function StudioGaleria() {
  return (
    <StudioPlaceholder
      icon="image"
      phase="Fase 2 · em construção"
      title="Galeria de templates"
      subtitle="Banco de artes prontas pra cliente escolher sem precisar mandar arquivo. Organizadas por categoria (Datas comemorativas, Profissões, Pets, Times)."
      bullets={[
        "Upload de imagem com tags e categoria",
        "Vincular template a produtos específicos ou globalmente",
        "Prévia no carrinho do cliente sem upload nenhum",
        "Filtros e busca pra galeria crescer sem virar bagunça",
      ]}
    />
  );
}
