// ============================================================
// AURA STUDIO · PersonalizacaoLivePreview — preview vivo do Step 3
// do wizard de personalização (F1 Visual Engine).
//
// Autocontido de propósito: personalizacao.tsx só importa e monta
// (1 linha) — evita mexer no wizard de 33KB. Web-only: no nativo
// mostra aviso simples (mesma política do upload de guia).
//
// Usa o motor compose2d (mesmo payload → mesmo desenho do render HD).
// Botão "Exportar HD" gera PNG 2048px pelo MESMO motor — critério de
// aceite do contrato F1.
//
// 03/07/2026 — F1
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { composeView, exportPng } from "./compose2d";
import { defaultTshirtSpec } from "./defaultTemplates";

type Props = {
  widthCm: number;
  heightCm: number;
  position: "center" | "left" | "right";
  allowText: boolean;
  allowImage: boolean;
};

const GARMENT_COLORS = ["#F5F2EA", "#2C2C2A", "#185FA5", "#D4537E"];
const ART_COLORS = ["#2C2C2A", "#F5F2EA", "#D85A30", "#7C3AED"];

export function PersonalizacaoLivePreview({ widthCm, heightCm, position, allowText, allowImage }: Props) {
  const t = useStudioTokens();
  const canvasRef = useRef<any>(null);
  const [view, setView] = useState<"front" | "back">("front");
  const [sampleText, setSampleText] = useState("Helena");
  const [garmentColor, setGarmentColor] = useState(GARMENT_COLORS[0]);
  const [artColor, setArtColor] = useState(ART_COLORS[0]);
  const [exporting, setExporting] = useState(false);

  const spec = useMemo(
    () => defaultTshirtSpec(widthCm > 0 ? widthCm : 21, heightCm > 0 ? heightCm : 28, position),
    [widthCm, heightCm, position]
  );
  const currentView = view === "front" ? spec.views[0] : spec.views[1];
  const values = useMemo(
    () => ({ text: allowText ? sampleText : "", image: null }),
    [allowText, sampleText]
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !canvasRef.current) return;
    composeView(canvasRef.current, currentView, values, {
      garmentColor, artColor, showAreas: true,
    });
  }, [currentView, values, garmentColor, artColor]);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const dataUrl = await exportPng(currentView, values, { garmentColor, artColor }, 2048);
      if (dataUrl && typeof document !== "undefined") {
        const a = document.createElement("a");
        a.download = "render-hd-" + view + ".png";
        a.href = dataUrl;
        a.click();
      }
    } finally {
      setExporting(false);
    }
  }

  if (Platform.OS !== "web") {
    return (
      <View style={{ padding: 14, borderRadius: 12, backgroundColor: t.paperCardElev, borderWidth: 1, borderColor: t.ink5, marginBottom: 14 }}>
        <Text style={{ fontSize: 12, color: t.ink3, textAlign: "center" }}>
          Preview visual disponível na versão web do Studio.
        </Text>
      </View>
    );
  }

  const chip = (selected: boolean) => ({
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: selected ? t.primary : t.paperCardElev,
    borderWidth: 1.5, borderColor: selected ? t.primary : t.ink5,
  });
  const chipTxt = (selected: boolean) => ({
    fontSize: 13, fontWeight: "600" as const, color: selected ? "#fff" : t.ink2,
  });

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <Pressable onPress={() => setView("front")} style={chip(view === "front")}>
          <Text style={chipTxt(view === "front")}>Frente</Text>
        </Pressable>
        <Pressable onPress={() => setView("back")} style={chip(view === "back")}>
          <Text style={chipTxt(view === "back")}>Verso</Text>
        </Pressable>
      </View>

      <View style={{ borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: t.ink5 }}>
        {/* @ts-ignore — canvas DOM no web (mesmo padrão do input de arquivo) */}
        <canvas ref={canvasRef} style={{ width: "100%", display: "block" } as any} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        {allowText && (
          <TextInput
            value={sampleText}
            onChangeText={setSampleText}
            placeholder="Texto de exemplo"
            placeholderTextColor={t.ink4}
            style={{
              backgroundColor: t.paperCardElev, borderWidth: 1.5, borderColor: t.ink5,
              borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
              fontSize: 14, color: t.ink, minWidth: 140,
            }}
          />
        )}
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700" }}>Produto</Text>
          {GARMENT_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setGarmentColor(c)}
              style={{
                width: 22, height: 22, borderRadius: 11, backgroundColor: c,
                borderWidth: garmentColor === c ? 2 : 1,
                borderColor: garmentColor === c ? t.primary : t.ink5,
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700" }}>Arte</Text>
          {ART_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setArtColor(c)}
              style={{
                width: 22, height: 22, borderRadius: 11, backgroundColor: c,
                borderWidth: artColor === c ? 2 : 1,
                borderColor: artColor === c ? t.primary : t.ink5,
              }}
            />
          ))}
        </View>
        <Pressable
          onPress={handleExport}
          style={{
            marginLeft: "auto", paddingHorizontal: 14, paddingVertical: 8,
            borderRadius: 10, backgroundColor: t.primary, opacity: exporting ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>
            {exporting ? "Gerando…" : "Exportar HD (2048px)"}
          </Text>
        </Pressable>
      </View>

      <Text style={{ fontSize: 11, color: t.ink4, marginTop: 8, lineHeight: 16 }}>
        Camiseta vetorial provisória — as fotos HD dos templates definitivos entram sem mudança de motor.
        {allowImage ? " No storefront, a arte enviada pelo cliente aparece na área demarcada." : ""}
      </Text>
    </View>
  );
}

export default PersonalizacaoLivePreview;
