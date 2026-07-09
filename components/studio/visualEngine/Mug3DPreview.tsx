// ============================================================
// AURA STUDIO · Mug3DPreview — F4 (viewer 3D da caneca)
//
// Wrapper React do compose3dMug. TOKEN-FREE de propósito: é usado
// tanto no painel (wizard) quanto no storefront público (sem
// StudioThemeProvider) — cores neutras via props.
//
// Web-only. Toggle painel/wrap quando a spec tem as duas áreas.
// Arraste pra girar; auto-rotate até o 1º toque.
//
// 03/07/2026 — F4 do escopo Visualização 2D/3D (contrato no chat)
// ============================================================
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import type { VisualTemplateSpec } from "@/services/studioVisualApi";
import { createMugViewer, type Mug3DHandle } from "./compose3dMug";

type Props = {
  spec: VisualTemplateSpec;
  values: Record<string, any>;
  size?: number;             // largura em px (altura ~0.78x)
  garmentColor?: string;
  artColor?: string;
  accentColor?: string;      // cor dos chips (padrão navy storefront)
};

export function Mug3DPreview({
  spec, values, size = 320,
  garmentColor = "#F5F2EA", artColor = "#D85A30", accentColor = "#1E3A8A",
}: Props) {
  const canvasRef = useRef<any>(null);
  const handleRef = useRef<Mug3DHandle | null>(null);
  const [areaId, setAreaId] = useState<string>(spec.areas?.[0]?.id || "panel");
  const [err, setErr] = useState<string | null>(null);
  const areas = spec.areas || [];

  useEffect(() => {
    if (Platform.OS !== "web" || !canvasRef.current) return;
    let cancelled = false;
    createMugViewer(canvasRef.current, spec, values, { garmentColor, artColor, areaId })
      .then((h) => {
        if (cancelled) { h.dispose(); return; }
        handleRef.current = h;
      })
      .catch((e) => setErr(e?.message || "Erro ao iniciar o 3D"));
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
    // spec fixo por mount — values/cores atualizam via effect abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  useEffect(() => {
    handleRef.current?.update(values, { garmentColor, artColor, areaId });
  }, [values, garmentColor, artColor, areaId]);

  if (Platform.OS !== "web") {
    return (
      <View style={{ padding: 14, borderRadius: 12, backgroundColor: "#f3f4f6", alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: "#64748B", textAlign: "center" }}>
          Visualização 3D disponível na versão web.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      {areas.length > 1 && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {areas.map((a) => {
            const sel = a.id === areaId;
            return (
              <Pressable
                key={a.id}
                onPress={() => setAreaId(a.id)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                  backgroundColor: sel ? accentColor : "transparent",
                  borderWidth: 1.5, borderColor: sel ? accentColor : "#CBD5E1",
                }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: "700", color: sel ? "#fff" : "#475569" }}>
                  {a.id === "panel" ? "Painel " + a.width_cm + "×" + a.height_cm + "cm" : "Wrap 360°"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ width: size, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" }}>
        {/* @ts-ignore — canvas DOM no web */}
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: Math.round(size * 0.78), display: "block", cursor: "grab", touchAction: "none" } as any}
        />
      </View>

      {err ? (
        <Text style={{ fontSize: 11, color: "#B91C1C" }}>{err}</Text>
      ) : (
        <Text style={{ fontSize: 10.5, color: "#94A3B8" }}>Arraste para girar · caneca provisória (GLB real entra sem mudar o viewer)</Text>
      )}
    </View>
  );
}

export default Mug3DPreview;
