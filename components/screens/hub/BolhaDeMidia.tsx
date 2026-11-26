// ============================================================
// Hub — foto e áudio dentro da bolha da thread.
// Foto: imagem; toque abre em outra aba. Áudio: o player do navegador
// (<audio controls>) — no RN Web o elemento DOM entra direto. A URL é
// assinada pelo servidor e vale 1 h; o polling da thread renova.
// ============================================================
import { createElement } from "react";
import { View, Text, StyleSheet, Image, Pressable, Linking } from "react-native";
import { Colors } from "@/constants/colors";
import type { HubMessage } from "@/services/hubApi";

const PLACEHOLDER = /^\[(audio|image|foto|sticker)\]$/;
const NOME: Record<string, string> = { audio: "Áudio", image: "Foto", foto: "Foto", sticker: "Figurinha" };

/**
 * O texto da bolha. A mídia guardada dispensa o "[audio]" do webhook; sem o
 * arquivo (bucket não configurado, mídia velha), a bolha diz o que era.
 */
export function textoDaBolha(m: Pick<HubMessage, "content" | "direction" | "media">): string | null {
  const ph = PLACEHOLDER.exec(m.content || "");
  if (!ph) return m.content;
  if (m.media?.url) return null;
  return m.direction === "inbound" ? `${NOME[ph[1]]} recebido (o arquivo não ficou guardado)` : NOME[ph[1]];
}

export function BolhaDeMidia({ media, testID }: {
  media: NonNullable<HubMessage["media"]>; testID?: string;
}) {
  if (!media.url) return null;
  if (media.kind === "audio") {
    return (
      <View testID={testID} style={s.audio}>
        {createElement("audio", {
          controls: true, preload: "metadata", src: media.url,
          style: { width: 240, maxWidth: "100%", height: 36 },
        })}
      </View>
    );
  }
  const url = media.url;
  return (
    <Pressable testID={testID} onPress={() => { void Linking.openURL(url); }} accessibilityLabel="Abrir a foto">
      <Image source={{ uri: url }} style={s.foto} resizeMode="cover" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  audio: { marginBottom: 4 },
  foto: { width: 220, height: 220, maxWidth: "100%", borderRadius: 9, marginBottom: 6, backgroundColor: Colors.bg3 },
});
