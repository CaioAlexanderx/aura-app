// ============================================================
// AURA. — PDV · CaixaButton
//
// Botão de Abrir/Fechar Caixa que vive no topRow do PDV,
// à esquerda da SearchBox.
//
// Estados:
//   - FECHADO: CTA primário violeta sólido. Microcopy "vendas bloqueadas".
//   - ABERTO:  chip translúcido verde com nome do operador + tempo desde
//              a abertura (atualiza a cada 60s).
//
// Toda a interação é via onClick — abre o OpenCloseCashModal.
// ============================================================
import { useEffect, useState } from "react";
import { Pressable, View, Text, StyleSheet, Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";

type Props = {
  isAberto: boolean;
  /** Mostra placeholder se ainda não carregou status do backend */
  isLoading?: boolean;
  openedByName?: string | null;
  /** ISO timestamp da abertura — usado pra renderizar "há X" */
  openedAtIso?: string | null;
  onClick: () => void;
};

function fmtSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "agora";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return "há " + min + "min";
  const h = Math.floor(min / 60);
  const r = min % 60;
  return "há " + h + "h" + (r > 0 ? " " + r + "min" : "");
}

export function CaixaButton({ isAberto, isLoading, openedByName, openedAtIso, onClick }: Props) {
  // Re-render a cada 60s pra manter "há 3h 24min" fresco enquanto aberto
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isAberto) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [isAberto]);

  // Loading inicial — placeholder neutro pra evitar flash
  if (isLoading) {
    return (
      <View style={[s.btn, s.loadingBtn]}>
        <View style={s.ico} />
        <View style={s.body}>
          <Text style={s.labelMuted}>Carregando…</Text>
        </View>
      </View>
    );
  }

  if (isAberto) {
    const since = openedAtIso ? fmtSince(openedAtIso) : null;
    const meta = [openedByName, since].filter(Boolean).join(" · ");
    return (
      <Pressable
        onPress={onClick}
        style={[s.btn, s.aberto]}
        accessibilityLabel="Fechar caixa"
      >
        <View style={[s.ico, s.icoAberto]}>
          <Icon name="lock" size={16} color={Colors.green} />
        </View>
        <View style={s.body}>
          <Text style={[s.label, s.labelAberto]}>CAIXA ABERTO</Text>
          <Text style={s.meta} numberOfLines={1}>
            {meta || "operador desconhecido"}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onClick}
      style={[s.btn, s.fechado]}
      accessibilityLabel="Abrir caixa"
    >
      <View style={[s.ico, s.icoFechado]}>
        <Icon name="unlock" size={16} color="#fff" />
      </View>
      <View style={s.body}>
        <Text style={[s.label, s.labelFechado]}>ABRIR CAIXA</Text>
        <Text style={[s.meta, s.metaFechado]}>vendas bloqueadas</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "stretch",
    height: 44,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    ...(Platform.OS === "web"
      ? ({
          cursor: "pointer",
          transition: "transform 0.18s ease, box-shadow 0.18s ease",
        } as any)
      : {}),
  },
  loadingBtn: {
    backgroundColor: Colors.bg3,
    borderColor: Colors.border,
    opacity: 0.6,
  },

  // FECHADO — CTA primário violeta sólido
  fechado: {
    backgroundColor: Colors.violet,
    borderColor: "rgba(255,255,255,0.18)",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 4px 14px -3px rgba(124,58,237,0.30)" } as any)
      : {}),
  },
  icoFechado: { backgroundColor: "rgba(0,0,0,0.18)" },
  labelFechado: { color: "#fff" },
  metaFechado: { color: "rgba(255,255,255,0.78)" },

  // ABERTO — chip translúcido verde
  aberto: {
    backgroundColor: "rgba(52,211,153,0.10)",
    borderColor: "rgba(52,211,153,0.35)",
  },
  icoAberto: { backgroundColor: "rgba(52,211,153,0.18)" },
  labelAberto: { color: Colors.green },

  ico: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    justifyContent: "center",
    minWidth: 140,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    lineHeight: 14,
  },
  labelMuted: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.ink3,
  },
  meta: {
    fontSize: 10,
    lineHeight: 12,
    color: Colors.ink3,
    fontFamily: Platform.OS === "web" ? ("ui-monospace, monospace" as any) : "monospace",
    letterSpacing: 0.4,
    marginTop: 2,
  },
});

export default CaixaButton;
