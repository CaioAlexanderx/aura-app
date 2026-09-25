// ============================================================
// components/studio/storefront/produto/kitDaPagina.tsx
//
// As peças miúdas da página do produto nova (Fase 3): botão, seção
// numerada, selo, o número que anima. Traduzem o kit do mockup
// (docs/mockups/studio-vitrine-00-kit.html: .btn, .sec-h, .badge,
// .chip) para o tema vivo da loja — nenhuma cor cravada: marca, papel e
// semânticas saem de useTemaDaVitrine.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { useTemaDaVitrine } from "../TemaDaVitrine";
import { Texto, Numero, useTipografia } from "../TipografiaVitrine";
import { wash, tintaSobre, type VitrineTema } from "../theme";
import { Icon } from "@/components/Icon";
import { useReduzirMovimento } from "../movimento";

/** Borda um degrau mais forte que `border` (o `--border2` do kit). */
export function borda2(t: VitrineTema): string {
  return wash(t.ink, 0.16);
}

/** Sombras do kit, só no web (no nativo a borda já separa). */
export function sombraWeb(nivel: 1 | 2 | 3): any {
  if (Platform.OS !== "web") return null;
  const s = {
    1: "0 1px 2px rgba(26,23,20,.06),0 1px 1px rgba(26,23,20,.04)",
    2: "0 8px 24px -10px rgba(26,23,20,.22),0 2px 6px rgba(26,23,20,.06)",
    3: "0 24px 60px -20px rgba(26,23,20,.35),0 4px 12px rgba(26,23,20,.08)",
  }[nivel];
  return { boxShadow: s };
}

/** Transição suave no web; respeita "reduzir movimento" por quem chama. */
export function transicao(props: string, ms = 220): any {
  return Platform.OS === "web" ? { transitionProperty: props, transitionDuration: ms + "ms", transitionTimingFunction: "cubic-bezier(.4,0,.2,1)" } : null;
}

type TipoDeBotao = "primario" | "secundario" | "fantasma" | "feito";

/**
 * O botão do kit: 48 px, raio 12. Nunca `disabled` na barra de compra
 * (Tela 7): com pendência, o toque leva ao que falta.
 */
export function Botao({
  tipo = "primario", rotulo, icone, onPress, rotuloAcessivel, pequeno, estilo, testID, conteudo,
}: {
  tipo?: TipoDeBotao;
  rotulo: string;
  icone?: string;
  onPress: () => void;
  rotuloAcessivel?: string;
  pequeno?: boolean;
  estilo?: StyleProp<ViewStyle>;
  testID?: string;
  conteudo?: ReactNode;
}) {
  const t = useTemaDaVitrine();
  const fundo = tipo === "primario" ? t.marcaFill : tipo === "feito" ? t.green : tipo === "secundario" ? t.bg2 : "transparent";
  const tinta = tipo === "primario" ? t.sobreMarca : tipo === "feito" ? tintaSobre(t.green) : tipo === "fantasma" ? t.marcaTexto : t.ink;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel || rotulo}
      style={({ pressed, hovered }: any) => [
        {
          minHeight: pequeno ? 44 : 48, paddingHorizontal: pequeno ? 14 : 16, borderRadius: pequeno ? 11 : 12,
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
          backgroundColor: fundo,
          borderWidth: tipo === "secundario" ? 1 : 0,
          borderColor: tipo === "secundario" ? (hovered ? t.ink3 : borda2(t)) : "transparent",
          transform: pressed ? [{ scale: 0.98 }] : undefined,
        },
        tipo === "primario" && Platform.OS === "web" ? ({ boxShadow: `0 6px 18px -8px ${wash(t.marcaFill, 0.45)}` } as any) : null,
        transicao("background-color, border-color, box-shadow"),
        estilo,
      ]}
    >
      {conteudo ?? (
        <>
          {icone ? <Icon name={icone as any} size={18} color={tinta} /> : null}
          <Texto numberOfLines={1} style={{ color: tinta, fontSize: pequeno ? 14 : 15, fontWeight: "600" }}>{rotulo}</Texto>
        </>
      )}
    </Pressable>
  );
}

/** Botão só de ícone, 44 px (o `.icon-btn` do kit). */
export function BotaoIcone({
  icone, rotulo, onPress, vidro, cor, tamanho = 44, testID,
}: {
  icone: string;
  rotulo: string;
  onPress: () => void;
  /** Sobre a foto: fundo claro translúcido (`.glass`). */
  vidro?: boolean;
  cor?: string;
  tamanho?: number;
  testID?: string;
}) {
  const t = useTemaDaVitrine();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ hovered }: any) => [
        {
          width: tamanho, height: tamanho, borderRadius: 12,
          alignItems: "center", justifyContent: "center",
          backgroundColor: vidro ? (hovered ? t.bg2 : wash(t.bg2, 0.88)) : hovered ? t.bg3 : "transparent",
        },
        vidro ? sombraWeb(1) : null,
        vidro && Platform.OS === "web" ? ({ backdropFilter: "blur(8px)" } as any) : null,
      ]}
    >
      <Icon name={icone as any} size={20} color={cor || t.ink} />
    </Pressable>
  );
}

/** Rótulo em caixa alta, na voz dos números (`.label` do kit). */
export function Rotulo({ children, cor }: { children: ReactNode; cor?: string }) {
  const t = useTemaDaVitrine();
  return (
    <Numero style={{ fontSize: 11, lineHeight: 13, fontWeight: "500", letterSpacing: 1.3, textTransform: "uppercase", color: cor || t.ink3 }}>
      {children}
    </Numero>
  );
}

/** Selo de canto (`.badge`): "Mais pedido", "Sua caneca", "9 modelos". */
export function Selo({ texto, tom = "marca" }: { texto: string; tom?: "marca" | "suave" }) {
  const t = useTemaDaVitrine();
  const marca = tom === "marca";
  return (
    <View
      style={[
        { height: 24, paddingHorizontal: 9, borderRadius: 999, justifyContent: "center", alignSelf: "flex-start",
          backgroundColor: marca ? t.marcaFill : t.bg2 },
        marca ? null : sombraWeb(1),
      ]}
    >
      <Numero style={{ fontSize: 11, fontWeight: "500", letterSpacing: 0.7, textTransform: "uppercase", color: marca ? t.sobreMarca : t.ink }}>
        {texto}
      </Numero>
    </View>
  );
}

/**
 * Cabeçalho de seção numerada (`.sec-h`): o número no círculo, o título
 * na serifada da loja e, à direita, o que a seção já sabe ("9 modelos",
 * "Falta a arte").
 */
export function CabecalhoDaSecao({ numero, titulo, extra }: { numero: number; titulo: string; extra?: ReactNode }) {
  const t = useTemaDaVitrine();
  const tipo = useTipografia();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, minHeight: 28 }}>
      <View
        style={{
          width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
          backgroundColor: t.bg2, borderWidth: 1, borderColor: borda2(t),
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Numero style={{ fontSize: 12, fontWeight: "500", color: t.ink2 }}>{numero}</Numero>
      </View>
      <Texto
        accessibilityRole="header"
        style={{ flex: 1, minWidth: 0, fontFamily: tipo.display, fontSize: 19, lineHeight: 23, color: t.ink }}
      >
        {titulo}
      </Texto>
      {extra}
    </View>
  );
}

/** Etiqueta âmbar do que falta na seção (`.tag-falta`). */
export function EtiquetaFalta({ texto }: { texto: string }) {
  const t = useTemaDaVitrine();
  return (
    <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 999, justifyContent: "center", backgroundColor: wash(t.amber, 0.12) }}>
      <Texto style={{ fontSize: 12, fontWeight: "600", color: t.amber }}>{texto}</Texto>
    </View>
  );
}

/** Etiqueta verde do que está pronto (`.tag-ok`). */
export function EtiquetaPronta({ texto }: { texto: string }) {
  const t = useTemaDaVitrine();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name="check" size={15} color={t.green} />
      <Texto style={{ fontSize: 12, fontWeight: "600", color: t.green }}>{texto}</Texto>
    </View>
  );
}

/** A pílula de preço do cartão ("Incluso", "+R$ 10,00"). */
export function PilulaDePreco({ texto, gratis }: { texto: string; gratis?: boolean }) {
  const t = useTemaDaVitrine();
  const E = gratis ? Texto : Numero;
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: t.bg3, alignSelf: "flex-start" }}>
      <E style={{ fontSize: 12.5, fontWeight: "500", color: gratis ? t.ink2 : t.ink }}>{texto}</E>
    </View>
  );
}

/**
 * O número que conta até o novo valor (Tela 2: "o preço conta até o
 * novo valor"). 340 ms com saída suave; com "reduzir movimento", pula.
 */
export function useNumeroAnimado(alvo: number): number {
  const reduzir = useReduzirMovimento();
  const [valor, setValor] = useState(alvo);
  const atual = useRef(alvo);
  useEffect(() => {
    const de = atual.current;
    if (reduzir || Platform.OS !== "web" || typeof requestAnimationFrame !== "function" || Math.abs(de - alvo) < 0.005) {
      atual.current = alvo;
      setValor(alvo);
      return;
    }
    let raf = 0;
    const t0 = Date.now();
    const passo = () => {
      const k = Math.min(1, (Date.now() - t0) / 340);
      const e = 1 - Math.pow(1 - k, 3);
      const v = de + (alvo - de) * e;
      atual.current = v;
      setValor(v);
      if (k < 1) raf = requestAnimationFrame(passo);
      else { atual.current = alvo; setValor(alvo); }
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, reduzir]);
  return valor;
}

/**
 * Um "pulso" que liga por `ms` quando `gatilho` muda (o contador da
 * sacola, o prazo que acende, o campo que falta). Devolve true enquanto
 * dura. Com "reduzir movimento", não pulsa.
 */
export function usePulso(gatilho: unknown, ms = 1100): boolean {
  const reduzir = useReduzirMovimento();
  const [ligado, setLigado] = useState(false);
  const primeiro = useRef(true);
  useEffect(() => {
    if (primeiro.current) { primeiro.current = false; return; }
    if (reduzir) return;
    setLigado(true);
    const id = setTimeout(() => setLigado(false), ms);
    return () => clearTimeout(id);
  }, [gatilho, ms, reduzir]);
  return ligado;
}
