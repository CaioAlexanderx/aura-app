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
import { useRef } from "react";
import { View, TextInput, Pressable, Text, Platform } from "react-native";
import { Colors } from "@/constants/colors";

type Props = {
  valor: string;
  onMudar: (hex: string) => void;
  placeholder?: string;
  /** Estilo do TextInput — o mesmo `cs.input` que a tela já usa. */
  estiloInput?: any;
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

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

export function SeletorDeCor({ valor, onMudar, placeholder, estiloInput }: Props) {
  const inputRef = useRef<any>(null);

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

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <TextInput
        style={[estiloInput, { flex: 1 }]}
        value={valor}
        onChangeText={onMudar}
        placeholder={placeholder}
        autoCapitalize="none"
      />
      {Platform.OS === "web" ? (
        <Pressable
          onPress={abrirNativo}
          accessibilityRole="button"
          accessibilityLabel="Abrir o seletor de cor"
          style={{
            width: 40, height: 40, borderRadius: 10,
            borderWidth: 1, borderColor: Colors.border,
            alignItems: "center", justifyContent: "center",
            // A amostra É o botão: mostra a cor atual e convida ao clique.
            backgroundColor: hexValido(valor) || Colors.bg4,
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
  );
}
