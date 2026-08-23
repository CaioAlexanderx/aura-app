// ============================================================
// AURA STUDIO · vitrine — ver a foto de perto
//
// Em peça personalizada o detalhe É o produto: a textura do tecido, o
// acabamento da costura, como a estampa fica de perto. A vitrine mostrava
// a foto no tamanho do cartão e acabava ali.
//
// Aqui a foto abre em tela cheia, com as setas do carrossel. Sem
// biblioteca de lightbox: um Modal e um Image resolvem, e a peça inteira
// continua aparecendo (`contain`) — ampliar não é motivo para cortar.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, Modal, Platform, useWindowDimensions } from "react-native";
import { T } from "./types";
import { proximoIndice } from "./CarrosselFoto";

type Props = {
  fotos: string[];
  nome: string;
  /** Índice aberto; null fecha. */
  indice: number | null;
  onFechar: () => void;
};

export function ZoomFoto({ fotos, nome, indice, onFechar }: Props) {
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(indice ?? 0);

  useEffect(() => { if (indice != null) setI(indice); }, [indice]);

  // Esc fecha e as setas navegam: quem está no desktop espera isso de
  // qualquer visualizador de imagem.
  useEffect(() => {
    if (Platform.OS !== "web" || indice == null || typeof document === "undefined") return;
    const aoTeclar = (e: any) => {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowRight") setI((n) => proximoIndice(n, fotos.length, 1));
      if (e.key === "ArrowLeft") setI((n) => proximoIndice(n, fotos.length, -1));
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [indice, fotos.length, onFechar]);

  if (indice == null || fotos.length === 0) return null;

  const atual = Math.min(i, fotos.length - 1);
  const lado = Math.min(width, height) * 0.92;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFechar}>
      {/* O fundo inteiro fecha: é o gesto que todo mundo já tenta. */}
      <Pressable
        onPress={onFechar}
        accessibilityRole="button"
        accessibilityLabel="Fechar a foto ampliada"
        style={{
          flex: 1, backgroundColor: "rgba(10,8,20,0.92)",
          alignItems: "center", justifyContent: "center", padding: 20,
        }}
      >
        {/* O Pressable interno impede que clicar NA FOTO feche o modal. */}
        <Pressable onPress={() => {}} style={{ width: lado, maxWidth: "100%" }}>
          <Image
            source={{ uri: fotos[atual] }}
            style={{ width: "100%", height: lado, maxHeight: height * 0.8 }}
            resizeMode="contain"
            accessibilityLabel={`${nome} — foto ${atual + 1} de ${fotos.length}`}
          />
        </Pressable>

        {fotos.length > 1 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 18 }}>
            <Seta rotulo="Foto anterior" glifo="‹" onPress={() => setI(proximoIndice(atual, fotos.length, -1))} />
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontVariant: ["tabular-nums"] }}>
              {atual + 1} / {fotos.length}
            </Text>
            <Seta rotulo="Próxima foto" glifo="›" onPress={() => setI(proximoIndice(atual, fotos.length, 1))} />
          </View>
        ) : null}
      </Pressable>
    </Modal>
  );
}

function Seta({ glifo, rotulo, onPress }: { glifo: string; rotulo: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={{
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: "rgba(255,255,255,0.14)",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 20, lineHeight: 24 }}>{glifo}</Text>
    </Pressable>
  );
}

/**
 * Controle de ampliar, ABAIXO do preview.
 *
 * Era um selo absoluto no canto inferior direito da foto. Não funciona:
 * o LivePreview desenha a peça MENOR que a caixa que ele ocupa (medido
 * no QA: foto de 220px numa caixa de 360px), então o canto da caixa cai
 * longe da foto e o selo aparece solto no meio do nada.
 *
 * Ancorar numa posição que este componente não consegue prever é frágil.
 * Como controle abaixo do preview ele é honesto sobre onde está, lê como
 * botão e alcança o teclado na ordem natural.
 */
export function DicaDeZoom({ onPress, corDaLoja }: { onPress: () => void; corDaLoja?: string | null }) {
  const cor = corDaLoja || T.ink2;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ver a foto de perto"
      style={({ hovered }: any) => [
        {
          alignSelf: "center",
          marginTop: 10,
          flexDirection: "row", alignItems: "center", gap: 6,
          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
          borderWidth: 1,
          borderColor: hovered ? cor : T.border,
          backgroundColor: T.card,
        },
        Platform.OS === "web"
          ? ({ transition: "border-color 200ms cubic-bezier(.4,0,.2,1)", cursor: "pointer" } as any)
          : null,
      ]}
    >
      {/* Lupa desenhada: o design system não usa emoji, e o 🔍 sai
          diferente em cada sistema. */}
      <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.6, borderColor: cor }} />
      <Text style={{ fontSize: 12.5, fontWeight: "700", color: cor }}>Ver a peça de perto</Text>
    </Pressable>
  );
}
