// ============================================================
// Hub — foto e áudio dentro da bolha da thread.
// Foto: imagem; toque abre em outra aba. Áudio: player do mockup (botão de
// tocar/pausar + onda em barras + duração), tocando com o Audio do navegador.
// A onda é desenhada (a mídia não traz o espectro): 28 barras de alturas fixas
// por mensagem; as já tocadas acendem. A URL é assinada pelo servidor e vale
// 1 h; o polling da thread renova.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Image, Pressable, Linking } from "react-native";
import { K, Tx, Ico, web } from "./waVisual";
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

const BARRAS = [8, 14, 22, 12, 26, 18, 10, 24, 28, 16, 9, 20, 26, 14, 8, 18, 24, 12, 22, 28, 15, 10, 19, 25, 13, 8, 16, 11];

function relogio(s: number): string {
  const t = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function PlayerDeAudio({ url, testID }: { url: string; testID?: string }) {
  const el = useRef<any>(null);
  const [tocando, setTocando] = useState(false);
  const [dur, setDur] = useState(0);
  const [pos, setPos] = useState(0);
  // Alturas das barras: variam por mensagem (resumo da URL), sempre as mesmas para a mesma mensagem.
  let seed = 0;
  for (let i = 0; i < Math.min(url.length, 64); i++) seed = (seed * 31 + url.charCodeAt(i)) % 7;
  const alturas = BARRAS.map((h, i) => Math.max(5, (h + seed * 3 + i) % 29));

  const criar = () => {
    if (el.current) return el.current;
    const a = new (globalThis as any).Audio(url);
    a.preload = "metadata";
    a.addEventListener("loadedmetadata", () => setDur(a.duration || 0));
    a.addEventListener("timeupdate", () => { setPos(a.currentTime || 0); if (a.duration) setDur(a.duration); });
    a.addEventListener("ended", () => { setTocando(false); setPos(0); });
    a.addEventListener("pause", () => setTocando(false));
    a.addEventListener("play", () => setTocando(true));
    el.current = a;
    return a;
  };
  // Carrega só os metadados (para mostrar a duração); troca de URL recomeça do zero.
  useEffect(() => {
    try { el.current?.pause(); } catch {}
    el.current = null; setTocando(false); setPos(0);
    try { if (typeof (globalThis as any).Audio === "function") criar(); } catch {}
    return () => { try { el.current?.pause(); } catch {} el.current = null; };
  }, [url]);

  const alternar = () => {
    try {
      const a = criar();
      if (a.paused) void a.play(); else a.pause();
    } catch { setTocando(false); }
  };  const feito = dur > 0 ? pos / dur : 0;

  return (
    <View testID={testID} {...({ dataSet: { src: url } } as any)} style={{ flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 }}>
      <Pressable testID={testID ? `${testID}-tocar` : undefined} onPress={alternar} accessibilityRole="button" accessibilityLabel={tocando ? "Pausar áudio" : "Ouvir áudio"}
        style={[{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: K.chipClaro }, web({ cursor: "pointer" })]}>
        {tocando
          ? <View style={{ flexDirection: "row", gap: 4 }}><View style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: K.ink }} /><View style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: K.ink }} /></View>
          : <Ico nome="play" size={16} cor={K.ink} preencher />}
      </Pressable>
      <View accessibilityElementsHidden style={{ flexDirection: "row", alignItems: "center", gap: 2, height: 30, flex: 1, minWidth: 0 }}>
        {alturas.map((h, i) => (
          <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: K.ink, opacity: i / alturas.length < feito ? 1 : 0.55 }} />
        ))}
      </View>
      <Tx style={{ fontSize: 12, color: K.ink2, lineHeight: 16 }}>{relogio(tocando || pos > 0 ? pos : dur)}</Tx>
    </View>
  );
}

export function BolhaDeMidia({ media, testID }: {
  media: NonNullable<HubMessage["media"]>; testID?: string;
}) {
  if (!media.url) return null;
  if (media.kind === "audio") return <PlayerDeAudio testID={testID} url={media.url} />;  const url = media.url;
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
