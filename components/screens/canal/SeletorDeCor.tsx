// ============================================================
// Canal digital · seletor de cor com conta-gotas nativo
//
// As bolinhas cobrem 8 cores e o campo hex exige saber o código de cor
// da marca — a lojista que tem um logo rosa-queimado não tem como chegar
// nele. O conta-gotas abre o seletor NATIVO do navegador (roda de cor,
// e no Chrome até eyedropper da tela), que resolve exatamente isso.
//
// Web-only por natureza: <input type="color"> não existe no RN nativo.
// Fora da web o componente rende só o campo de texto, sem perder nada
// que já existia.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, TextInput, Pressable, Text, Platform } from "react-native";
import { usePaletaDoCanal } from "./paletaDoCanal";

type Props = {
  /** A cor salva (#rrggbb). Vazio enquanto a configuração não chegou. */
  valor: string;
  /** Só é chamado com uma cor válida, já no formato #rrggbb. */
  onMudar: (hex: string) => void;
  placeholder?: string;
  /** Estilo do TextInput — o mesmo `cs.input` que a tela já usa. */
  estiloInput?: any;
  /**
   * A configuração ainda não chegou: mostra um esqueleto no lugar do
   * campo. Antes o campo mostrava a cor padrão (#7c3aed) por um segundo
   * e trocava — parecia que a loja era violeta.
   */
  carregando?: boolean;
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** O aviso do campo quando o que foi digitado não é uma cor. */
export const ERRO_DA_COR = "Use 6 letras ou números depois do #";

/** Normaliza a entrada do seletor/campo para #rrggbb minúsculo. */
export function hexValido(v: string): string | null {
  const s = String(v || "").trim().toLowerCase();
  if (HEX_RE.test(s)) return s;
  // #abc → #aabbcc: o campo de texto aceita a forma curta há tempo, o
  // seletor nativo não emite, mas quem digita usa.
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  }
  return null;
}

/**
 * O que fazer com o texto do campo.
 *
 * QA 26/09: o campo salvava qualquer coisa a cada tecla — "#12" foi
 * gravado e a vitrine caiu no violeta da Aura. Agora:
 *   - enquanto ela digita, só uma cor COMPLETA (#rrggbb) é salva; a forma
 *     curta (#abc) espera ela sair do campo, senão "#abc" viraria
 *     "#aabbcc" no meio de "#abcdef";
 *   - ao sair do campo, #abc vira #aabbcc; o resto mostra o aviso e não
 *     salva nada;
 *   - o # é opcional para quem cola "1e3a8a".
 */
export function lerCorDigitada(texto: string, terminou: boolean): { hex: string | null; erro: string | null } {
  const bruto = String(texto || "").trim();
  if (!bruto) return { hex: null, erro: null };
  const comHash = bruto.startsWith("#") ? bruto : "#" + bruto;
  if (HEX_RE.test(comHash)) return { hex: comHash.toLowerCase(), erro: null };
  if (terminou) {
    const curta = hexValido(comHash);
    return curta ? { hex: curta, erro: null } : { hex: null, erro: ERRO_DA_COR };
  }
  // Digitando: só avisa quando o texto já não tem como virar uma cor.
  const corpo = comHash.slice(1);
  if (corpo.length > 6 || /[^0-9a-fA-F]/.test(corpo)) return { hex: null, erro: ERRO_DA_COR };
  return { hex: null, erro: null };
}

export function SeletorDeCor({ valor, onMudar, placeholder, estiloInput, carregando }: Props) {
  const pal = usePaletaDoCanal();
  const inputRef = useRef<any>(null);
  const [texto, setTexto] = useState(valor || "");
  const [erro, setErro] = useState<string | null>(null);

  // A cor salva mudou por fora (bolinha, conta-gotas, config que chegou):
  // o campo acompanha, a não ser que já mostre a mesma cor.
  useEffect(() => {
    setTexto((atual) => (hexValido(atual) === (valor || null) ? atual : valor || ""));
    setErro(null);
  }, [valor]);

  const digitar = (v: string) => {
    setTexto(v);
    const r = lerCorDigitada(v, false);
    setErro(r.erro);
    if (r.hex && r.hex !== valor) onMudar(r.hex);
  };

  const sair = () => {
    if (!texto.trim()) {
      // Campo apagado e abandonado: volta a mostrar a cor que está salva.
      setTexto(valor || "");
      setErro(null);
      return;
    }
    const r = lerCorDigitada(texto, true);
    setErro(r.erro);
    if (r.hex) {
      setTexto(r.hex);
      if (r.hex !== valor) onMudar(r.hex);
    }
  };

  const abrirNativo = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    let el = inputRef.current as HTMLInputElement | null;
    if (!el) {
      // O input de cor vive escondido e é criado sob demanda — não há
      // razão para ele existir no DOM antes do primeiro clique.
      el = document.createElement("input");
      el.type = "color";
      el.style.position = "fixed";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      document.body.appendChild(el);
      inputRef.current = el;
    }
    el.value = hexValido(valor) || "#7c3aed";
    el.oninput = () => {
      const hex = hexValido(el!.value);
      if (hex) onMudar(hex);
    };
    el.click();
  };

  if (carregando) {
    return (
      <View
        testID="cor-carregando"
        accessibilityLabel="Carregando a cor da loja"
        style={{ height: 42, borderRadius: 10, backgroundColor: pal.bg4, borderWidth: 1, borderColor: pal.border, opacity: 0.7 }}
      />
    );
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TextInput
          style={[estiloInput, { flex: 1 }, erro ? { borderColor: pal.red } : null]}
          value={texto}
          onChangeText={digitar}
          onBlur={sair}
          placeholder={placeholder}
          placeholderTextColor={pal.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Código da cor"
          testID="cor-hex"
        />
        {Platform.OS === "web" ? (
          <Pressable
            onPress={abrirNativo}
            accessibilityRole="button"
            accessibilityLabel="Abrir o seletor de cor"
            style={{
              width: 40, height: 40, borderRadius: 10,
              borderWidth: 1, borderColor: pal.border,
              alignItems: "center", justifyContent: "center",
              // A amostra É o botão: mostra a cor atual e convida ao clique.
              backgroundColor: hexValido(valor) || pal.bg4,
            }}
          >
            {/* Aro do conta-gotas, legível sobre qualquer cor. */}
            <View
              style={{
                width: 16, height: 16, borderRadius: 8,
                borderWidth: 2, borderColor: "rgba(255,255,255,0.9)",
              }}
            />
          </Pressable>
        ) : null}
      </View>
      {erro ? (
        <Text testID="cor-erro" accessibilityRole="alert" style={{ fontSize: 12, color: pal.red, lineHeight: 16 }}>
          {erro}
        </Text>
      ) : null}
    </View>
  );
}
