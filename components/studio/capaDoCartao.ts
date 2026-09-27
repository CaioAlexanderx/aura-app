// ============================================================
// components/studio/capaDoCartao.ts
// O que vai na capa do cartão da fila de Produção (27/09/2026).
//
// POR QUE ESTE ARQUIVO EXISTE (achado 4c do QA)
//
// `card_image_url` sai pronto do backend numa cascata: mockup da
// aprovação → render do Visual Engine → foto do produto no catálogo.
// Em produção quase não há render nem mockup, então a capa acabava
// sendo a foto do catálogo — e a foto do catálogo traz a arte de
// EXEMPLO do produto ("CACHORRO"), não o que a cliente digitou
// ("Marina & João"). O cartão mostrava a peça errada pra quem produz.
//
// A regra: mockup e render são a arte de verdade, mostram a imagem.
// Quando a capa seria só a foto do produto e o pedido tem personalização
// desenhável, a capa vira a prévia da personalização (o mesmo
// PersonalizationPreview do detalhe do pedido). Sem nada disso, a foto
// continua; sem foto, o monograma.
//
// Backend antigo (sem `card_image_source`) cai em foto/monograma,
// exatamente como antes.
// ============================================================
import type {
  StudioOrder,
  CustomizationConfig,
  CustomizationFieldSide,
} from "@/services/studioApi";
import { sideOf, ladoComConteudo } from "@/components/studio/customizationConfig";

export type CapaDoCartao =
  | { tipo: "arte"; url: string }
  | {
      tipo: "previa";
      config: CustomizationConfig;
      values: Record<string, any>;
      side: CustomizationFieldSide;
    }
  | { tipo: "foto"; url: string }
  | { tipo: "monograma" };

type Entrada = Pick<StudioOrder, "card_image_url" | "card_image_source" | "card_customization">;

/** Mesma regra de conteúdo de `ladoComConteudo`, mas lado a lado. */
function temConteudoNoLado(
  config: CustomizationConfig,
  values: Record<string, any>,
  side: CustomizationFieldSide,
): boolean {
  return (config.fields || []).some((f) => {
    if (!f || sideOf(f) !== side) return false;
    const val = values[f.id];
    if (f.type === "text") return String(val || "").trim().length > 0;
    if (f.type === "image" || f.type === "template") return !!val;
    return false;
  });
}

const LADOS: CustomizationFieldSide[] = ["front", "back", "middle"];

export function capaDoCartao(o: Entrada): CapaDoCartao {
  const url = o.card_image_url || null;
  const fonte = o.card_image_source;

  if (url && (fonte === "mockup" || fonte === "render")) {
    return { tipo: "arte", url };
  }

  const cust = o.card_customization;
  const config = cust?.config || null;
  const values = cust?.values || {};
  if (config && Array.isArray(config.fields) && config.fields.length > 0) {
    // ladoComConteudo devolve "front" também quando não há nada (e não
    // olha o meio); por isso a checagem própria, lado a lado.
    let side = ladoComConteudo(config, values);
    if (!temConteudoNoLado(config, values, side)) {
      side = LADOS.find((l) => temConteudoNoLado(config, values, l)) || side;
    }
    if (temConteudoNoLado(config, values, side)) {
      return { tipo: "previa", config, values, side };
    }
  }

  if (url) return { tipo: "foto", url };
  return { tipo: "monograma" };
}
