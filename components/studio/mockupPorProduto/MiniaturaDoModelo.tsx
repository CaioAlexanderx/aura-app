// ============================================================
// components/studio/mockupPorProduto/MiniaturaDoModelo.tsx
//
// A miniatura de um modelo no seletor (46×36). O VisualTemplateThumb só
// sabe desenhar caneca e camiseta; para o resto:
//   - 2D com foto de estúdio: a própria foto do modelo (views[0].photo_url);
//   - 3D em GLB que não é camiseta, ou spec ainda chegando: um quadro
//     neutro com o ícone do tipo — nada de imagem inventada.
// ============================================================
import { View, Image, Platform } from "react-native";
import type { VisualTemplate, VisualTemplateSpec } from "@/services/studioVisualApi";
import { VisualTemplateThumb } from "@/components/studio/visualEngine/VisualTemplateThumb";
import { Icon } from "@/components/Icon";

export type FormaDaMiniaturaDoModelo = "foto" | "caneca" | "camiseta" | "generica";

const VESTE = /camis|shirt|baby|blusa|polo|regata|moletom|body/i;

/** Regra pura (testada): o que a miniatura desenha. */
export function formaDaMiniaturaDoModelo(
  t: Pick<VisualTemplate, "kind" | "key" | "name">,
  spec: VisualTemplateSpec | null | undefined,
): FormaDaMiniaturaDoModelo {
  if (!spec) return "generica";
  if (t.kind === "photo2d") {
    const v = spec.views?.[0];
    if (v?.photo_url) return "foto";
    if (v?.garment?.shape === "tshirt") return "camiseta";
    return "generica";
  }
  if (spec.model?.kind === "glb") {
    const pista = [t.key, t.name, spec.model.url || ""].join(" ");
    return VESTE.test(pista) ? "camiseta" : "generica";
  }
  return "caneca";
}

type Props = {
  template: VisualTemplate | null;
  spec?: VisualTemplateSpec | null;
  /** Foto que aparece no lugar do modelo (Mockup na foto). */
  foto?: string | null;
  largura?: number;
  altura?: number;
  T: any;
};

export function MiniaturaDoModelo({ template, spec, foto, largura = 46, altura = 36, T }: Props) {
  const caixa = {
    width: largura, height: altura, borderRadius: 8, overflow: "hidden" as const,
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: "#ECEAE4",
  };
  if (!template) {
    if (foto) {
      return (
        <View style={caixa} aria-hidden>
          <Image source={{ uri: foto }} style={{ width: largura, height: altura }} resizeMode="cover" />
        </View>
      );
    }
    return (
      <View style={[caixa, { backgroundColor: T.bgSoft, borderWidth: 1, borderColor: T.ink5 }]} aria-hidden>
        <Icon name="x_circle" size={18} color={T.ink4} />
      </View>
    );
  }
  const forma = formaDaMiniaturaDoModelo(template, spec);
  if (forma === "foto") {
    return (
      <View style={caixa} aria-hidden>
        <Image source={{ uri: String(spec?.views?.[0]?.photo_url) }} style={{ width: largura, height: altura }} resizeMode="cover" />
      </View>
    );
  }
  if ((forma === "caneca" || forma === "camiseta") && Platform.OS === "web") {
    return (
      <View style={caixa} aria-hidden>
        <VisualTemplateThumb
          kind={forma === "caneca" ? "model3d" : "photo2d"}
          size={Math.round(Math.max(largura, altura / 0.76))}
        />
      </View>
    );
  }
  return (
    <View style={[caixa, { backgroundColor: T.bgSoft, borderWidth: 1, borderColor: T.ink5 }]} aria-hidden>
      <Icon name={template.kind === "model3d" ? "box" : "image"} size={18} color={T.ink3} />
    </View>
  );
}

export default MiniaturaDoModelo;
