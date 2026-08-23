// ============================================================
// AURA STUDIO · vitrine — carrossel da foto do produto
//
// `products.gallery_urls` existe desde a migration 290 (até 5 fotos), a
// lojista já consegue subir várias pelo catálogo, e a vitrine mostrava só
// a capa. O dado estava lá esperando UI.
//
// Degrada por completo: sem foto nenhuma cai na capa gerada da fase 02;
// com uma foto vira só a foto, sem bolinha nem seta — controle de
// carrossel numa foto só é ruído.
// ============================================================
import { useState } from "react";
import { View, Pressable, Image, Platform } from "react-native";
import { T } from "./types";
import { wash, AURA } from "./theme";
import { CapaProduto } from "./CapaProduto";

import { Texto } from "./TipografiaVitrine";
/** Próximo índice com volta ao início — o cliente nunca trava na ponta. */
export function proximoIndice(atual: number, total: number, passo: 1 | -1): number {
  if (total <= 1) return 0;
  return (atual + passo + total) % total;
}

/** Fotos utilizáveis, sem duplicata e sem entrada vazia. */
export function fotosDoProduto(
  galeria: unknown,
  capa: string | null | undefined,
): string[] {
  const lista = Array.isArray(galeria) ? galeria : [];
  const todas = [...lista, capa].filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  return [...new Set(todas.map((u) => u.trim()))];
}

/**
 * Fotos de um GRUPO de modelos — uma capa por modelo.
 *
 * O carrossel do cartao "Camisetas · 3 modelos" mostra os tres modelos,
 * que e exatamente a informacao que faz o cliente abrir: ele ve que ha
 * variedade antes de clicar.
 */
export function fotosDoGrupo(produtos: Array<{ image_url?: string | null }>): string[] {
  const capas = (produtos || [])
    .map((p) => p.image_url)
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0);
  return [...new Set(capas.map((u) => u.trim()))].slice(0, 5);
}

type Props = {
  fotos: string[];
  nome: string;
  /** Lado do quadrado. */
  tamanho: number;
  corDaLoja?: string | null;
  fonteDisplay?: string;
  /** Altura, quando o cartao nao e quadrado. */
  altura?: number;
  /** Sangra a foto no quadro — so o estilo "Imagem". */
  preencher?: boolean;
};

export function CarrosselFoto({ fotos, nome, tamanho, corDaLoja, fonteDisplay, altura, preencher }: Props) {
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const cor = corDaLoja || AURA.violet;
  const alt = altura || tamanho;
  const total = fotos.length;

  // Sem foto: a capa composta da fase 02 assume.
  if (total === 0) {
    return <CapaProduto nome={nome} tamanho={tamanho} altura={alt} preencher={preencher} corDaLoja={cor} fonteDisplay={fonteDisplay} />;
  }

  // Uma foto: sem controle nenhum.
  if (total === 1) {
    return <CapaProduto uri={fotos[0]} nome={nome} tamanho={tamanho} altura={alt} preencher={preencher} corDaLoja={cor} fonteDisplay={fonteDisplay} />;
  }

  const atual = Math.min(i, total - 1);
  const raio = preencher ? 0 : Math.round(Math.min(tamanho, alt) * 0.06);
  const seta = (dir: 1 | -1) => () => setI(proximoIndice(atual, total, dir));

  return (
    <View
      style={{
        width: tamanho, height: alt, borderRadius: raio,
        backgroundColor: T.bg,
        borderWidth: preencher ? 0 : 1, borderColor: wash(cor, 0.1),
        overflow: "hidden",
      }}
      {...(Platform.OS === "web"
        ? { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) }
        : {})}
    >
      <Image
        source={{ uri: fotos[atual] }}
        style={{ width: "100%", height: "100%", padding: preencher ? 0 : Math.round(tamanho * 0.05) }}
        // `contain` pelo mesmo motivo da capa: melhor sobrar moldura do
        // que cortar a peça que o cliente quer ver.
        resizeMode={preencher ? "cover" : "contain"}
        accessibilityLabel={`${nome} — foto ${atual + 1} de ${total}`}
      />

      {/* Metades clicáveis: funciona no toque sem depender de gesto, e no
          desktop as setas aparecem no hover. */}
      <Pressable
        onPress={seta(-1)}
        accessibilityRole="button"
        accessibilityLabel="Foto anterior"
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "34%", alignItems: "flex-start", justifyContent: "center", paddingLeft: 6 }}
      >
        {hover ? <Chevron dir="esquerda" cor={cor} /> : null}
      </Pressable>
      <Pressable
        onPress={seta(1)}
        accessibilityRole="button"
        accessibilityLabel="Próxima foto"
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "34%", alignItems: "flex-end", justifyContent: "center", paddingRight: 6 }}
      >
        {hover ? <Chevron dir="direita" cor={cor} /> : null}
      </Pressable>

      <View
        style={{
          position: "absolute", left: 0, right: 0, bottom: 7,
          flexDirection: "row", justifyContent: "center", gap: 5,
        }}
        pointerEvents="none"
      >
        {fotos.map((_, n) => (
          <View
            key={n}
            style={{
              width: n === atual ? 14 : 5, height: 5, borderRadius: 3,
              backgroundColor: n === atual ? cor : wash(cor, 0.3),
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Chevron({ dir, cor }: { dir: "esquerda" | "direita"; cor: string }) {
  return (
    <View
      style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: "rgba(255,255,255,0.92)",
        borderWidth: 1, borderColor: wash(cor, 0.18),
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Texto style={{ fontSize: 12, color: T.ink2, lineHeight: 14 }}>
        {dir === "esquerda" ? "‹" : "›"}
      </Texto>
    </View>
  );
}
