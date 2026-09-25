// ============================================================
// components/studio/storefront/posCompra/MockupDaArte.tsx
//
// O mockup que a loja mandou para aprovar — grande, sobre o papel, que é
// a protagonista da página (JORNADA §3, princípio 1).
//
// Pode ser foto ou o vídeo turntable do motor 3D (.webm/.mp4, Visual
// Engine F5) — a mesma regra de app/aprovacao/[token].tsx. No web o
// vídeo gira sozinho, mudo e em loop; com "reduzir movimento" ligado ele
// para e mostra os controles, e a cliente dá o play se quiser. No nativo,
// um botão abre o vídeo no player do aparelho.
// ============================================================
import { Image, Linking, Platform, View } from "react-native";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { useReduzirMovimento } from "../movimento";
import { Botao } from "./MolduraDaLoja";
import { isVideoUrl } from "./posCompra";

export function MockupDaArte({
  url, descricao, tamanho = "grande",
}: {
  url: string | null | undefined;
  descricao: string;
  tamanho?: "grande" | "miniatura";
}) {
  const tema = useTemaDaVitrine();
  const reduzir = useReduzirMovimento();
  const mini = tamanho === "miniatura";
  const caixa = {
    width: "100%" as const,
    aspectRatio: 1,
    borderRadius: mini ? 12 : 14,
    overflow: "hidden" as const,
    backgroundColor: tema.bg3,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  if (!url) return <View style={caixa} accessibilityLabel={descricao} />;

  if (isVideoUrl(url)) {
    if (Platform.OS === "web") {
      return (
        <View style={caixa}>
          {/* @ts-ignore — <video> do DOM no web (turntable do motor 3D) */}
          <video
            src={url}
            aria-label={descricao}
            autoPlay={!reduzir}
            loop={!reduzir}
            muted
            playsInline
            controls={reduzir || !mini}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        </View>
      );
    }
    return (
      <View style={[caixa, { padding: 16 }]}>
        <Botao tipo="secundario" icone="play" rotulo="Assistir o vídeo da arte" onPress={() => Linking.openURL(url)} />
      </View>
    );
  }

  return (
    <View style={caixa}>
      <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} resizeMode="contain" accessibilityLabel={descricao} />
    </View>
  );
}
