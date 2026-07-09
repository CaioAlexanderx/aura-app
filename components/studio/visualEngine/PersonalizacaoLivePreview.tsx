// ============================================================
// AURA STUDIO · PersonalizacaoLivePreview — preview vivo do Step 3
// do wizard de personalização (F1 Visual Engine).
//
// Autocontido de propósito: personalizacao.tsx só importa e monta
// (1 linha) — evita mexer no wizard de 33KB. Web-only: no nativo
// mostra aviso simples (mesma política do upload de guia).
//
// F4 (03/07/2026): o componente resolve sozinho o template visual do
// produto (useLocalSearchParams → productId; useAuthStore → company)
// via GET /studio/products/:pid/visual-template:
//   model3d → viewer 3D da caneca (Mug3DPreview)
//   photo2d com spec real → usa as vistas do banco
//   sem vínculo → camiseta vetorial provisória (comportamento F1)
//
// Botão "Exportar HD" (2D) gera PNG 2048px pelo MESMO motor — critério
// de aceite do contrato F1.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import { useAuthStore } from "@/stores/auth";
import { studioVisualApi, type VisualTemplate } from "@/services/studioVisualApi";
import { composeView, exportPng } from "./compose2d";
import { defaultTshirtSpec } from "./defaultTemplates";
import { Mug3DPreview } from "./Mug3DPreview";

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
  const { id: productId } = useLocalSearchParams<{ id: string }>();
  const { company } = useAuthStore();
  const [tpl, setTpl] = useState<VisualTemplate | null>(null);
  const [view, setView] = useState<"front" | "back">("front");
  const [sampleText, setSampleText] = useState("Helena");
  const [garmentColor, setGarmentColor] = useState(GARMENT_COLORS[0]);
  const [artColor, setArtColor] = useState(ART_COLORS[0]);
  const [exporting, setExporting] = useState(false);

  // F4: template real do produto (silencioso — sem vínculo, segue provisório)
  useEffect(() => {
    let alive = true;
    if (Platform.OS === "web" && company?.id && productId) {
      studioVisualApi
        .getProductVisualTemplate(company.id, String(productId))
        .then((r) => { if (alive) setTpl(r?.template || null); })
        .catch(() => { if (alive) setTpl(null); });
    }
    return () => { alive = false; };
  }, [company?.id, productId]);

  const fallbackSpec = useMemo(
    () => defaultTshirtSpec(widthCm > 0 ? widthCm : 21, heightCm > 0 ? heightCm : 28, position),
    [widthCm, heightCm, position]
  );
  const spec = tpl?.kind === "photo2d" && tpl.spec?.views?.length ? tpl.spec : fallbackSpec;
  const views = spec.views || [];
  const currentView = view === "back" && views[1] ? views[1] : views[0];
  const values = useMemo(
    () => ({ text: allowText ? sampleText : "", image: null }),
    [allowText, sampleText]
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !canvasRef.current || !currentView) return;
    if (tpl?.kind === "model3d") return; // 3D renderiza no Mug3DPreview
    composeView(canvasRef.current, currentView, values, {
      garmentColor, artColor, showAreas: true,
    });
  }, [currentView, values, garmentColor, artColor, tpl?.kind]);

  async function handleExport() {
    if (exporting || !currentView) return;
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

  // ── F4: produto com template 3D (caneca) ───────────────────
  if (tpl?.kind === "model3d" && tpl.spec) {
    return (
      <View style={{ marginBottom: 16, gap: 10 }}>
        <Mug3DPreview
          spec={tpl.spec}
          values={values}
          size={360}
          garmentColor={garmentColor}
          artColor={artColor}
          accentColor={t.primary}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
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
            <Text style={{ fontSize: 11, color: t.ink3, fontWeight: "700" }}>Caneca</Text>
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
        </View>
      </View>
    );
  }

  // ── 2D (template real ou camiseta provisória) ────────────────
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
        <Pressable onPress={() => setView("front")} style={chip(view === "front")}>
          <Text style={chipTxt(view === "front")}>Frente</Text>
        </Pressable>
        {views.length > 1 && (
          <Pressable onPress={() => setView("back")} style={chip(view === "back")}>
            <Text style={chipTxt(view === "back")}>Verso</Text>
          </Pressable>
        )}
        {tpl?.kind === "photo2d" && (
          <View style={{ alignSelf: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: t.primaryGhost }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: t.primary }}>template: {tpl.key}</Text>
          </View>
        )}
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
        {tpl?.kind === "photo2d"
          ? "Template visual do produto aplicado — fotos HD entram sem mudança de motor."
          : "Camiseta vetorial provisória — as fotos HD dos templates definitivos entram sem mudança de motor."}
        {allowImage ? " No storefront, a arte enviada pelo cliente aparece na área demarcada." : ""}
      </Text>
    </View>
  );
}

export default PersonalizacaoLivePreview;
