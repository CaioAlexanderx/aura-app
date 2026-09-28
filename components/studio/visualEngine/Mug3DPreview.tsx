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
import { createModelViewer, type Cenario, type Mug3DHandle } from "./compose3dMug";
import { areaParaLado, rotuloDaArea } from "./areasDaPeca";

// 27/09/2026: o rótulo mudou de arquivo (areasDaPeca.ts) para ganhar
// Frente/Costas da camiseta; quem importava daqui continua importando.
export { rotuloDaArea };

type Props = {
  spec: VisualTemplateSpec;
  values: Record<string, any>;
  size?: number;             // largura em px (altura ~0.78x)
  garmentColor?: string;
  artColor?: string;
  /** Família da fonte de arte (pilha CSS). Sem ela o motor usa a serifada padrão. */
  font?: string;
  accentColor?: string;      // cor dos chips (padrão navy storefront)
  /**
   * Lado escolhido fora daqui (editor do Studio). "middle" = wrap 360,
   * que é o nome que a lojista vê; front/back caem no painel. Sem isso o
   * seletor Frente/Verso/Meio do painel não mexia no 3D e a lojista via
   * dois seletores dessincronizados na mesma tela.
   */
  side?: "front" | "back" | "middle";
  /**
   * 28/09/2026 — o fundo da página onde o viewer está (hex). O estúdio
   * deriva a paleta do ciclorama dele: papel quente ou tema escuro. Sem
   * a prop, o papel da vitrine.
   */
  backdrop?: string;
  /** O cenário em volta da peça: estúdio (padrão), gradiente 2D antigo ou nenhum (transparente). */
  cenario?: Cenario;
  /**
   * Esconde os chips de área (QA 28/09, itens 8 e 9). Na vitrine o lado é
   * da página (Frente · Verso no palco, com a medida do CADASTRO da peça):
   * os chips daqui repetiam o seletor com a medida do modelo ("28×35 cm"
   * numa peça cadastrada com 7×7) e ficavam sob o selo "Sua peça".
   */
  semSeletorDeArea?: boolean;
};

// A legenda "caneca provisória (GLB real entra sem mudar o viewer)" era
// recado de desenvolvedor e ficou no ar para a cliente da Sheid — saiu.
export function Mug3DPreview({
  spec, values, size = 320,
  garmentColor = "#F5F2EA", artColor = "#D85A30", font, accentColor = "#1E3A8A", side,
  backdrop, cenario,
  semSeletorDeArea = false,
}: Props) {
  const canvasRef = useRef<any>(null);
  const handleRef = useRef<Mug3DHandle | null>(null);
  const [areaId, setAreaId] = useState<string>(spec.areas?.[0]?.id || "panel");

  // Cada spec ganha um <canvas> NOVO. Trocar de modelo no configurador
  // (Alça de coração → Caneca branca) trocava a spec com o mesmo canvas
  // embaixo: o viewer antigo era descartado e o novo abria um segundo
  // WebGLRenderer no mesmo elemento — e a partir daí a caneca girava,
  // mas nunca mais mostrava a arte da cliente. Visto em 04/09/2026 na
  // loja da Sheid; o primeiro modelo aberto funcionava, o segundo não.
  const specAnterior = useRef(spec);
  const geracao = useRef(0);
  if (specAnterior.current !== spec) {
    specAnterior.current = spec;
    geracao.current += 1;
  }

  // O lado vindo de fora manda no viewer: "middle" é o wrap 360 da caneca;
  // frente/verso são o painel na caneca e front/back na camiseta. Só
  // aplica se a spec realmente tiver a área, senão mantém a atual.
  useEffect(() => {
    const alvo = areaParaLado(spec.areas, side);
    if (alvo) setAreaId(alvo);
  }, [side, spec]);
  const [err, setErr] = useState<string | null>(null);
  const areas = spec.areas || [];

  // O que a cliente escolheu por último. QA 28/09 (vitrine, rodada 3): a
  // cor escolhida enquanto o three.js ainda carregava se perdia — o
  // efeito de atualização rodava sem viewer, e o viewer nascia com a cor
  // da montagem. Ao ficar pronto, ele recebe o estado mais recente.
  const ultimo = useRef({ values, garmentColor, artColor, font, areaId });
  ultimo.current = { values, garmentColor, artColor, font, areaId };

  useEffect(() => {
    if (Platform.OS !== "web" || !canvasRef.current) return;
    let cancelled = false;
    const inicial = ultimo.current;
    // Fundo e cenário só valem na criação (o viewer monta a cena uma vez);
    // trocar de tema com o viewer aberto não acontece na vitrine.
    createModelViewer(canvasRef.current, spec, values, { garmentColor, artColor, font, areaId, backdrop, cenario })
      .then((h) => {
        if (cancelled) { h.dispose(); return; }
        handleRef.current = h;
        const u = ultimo.current;
        if (u.values !== inicial.values || u.garmentColor !== inicial.garmentColor || u.artColor !== inicial.artColor || u.font !== inicial.font || u.areaId !== inicial.areaId) {
          h.update(u.values, { garmentColor: u.garmentColor, artColor: u.artColor, font: u.font, areaId: u.areaId });
        }
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
    handleRef.current?.update(values, { garmentColor, artColor, font, areaId });
  }, [values, garmentColor, artColor, font, areaId]);

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
      {areas.length > 1 && !semSeletorDeArea && (
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
                  {rotuloDaArea(a)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ width: size, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" }}>
        {/* @ts-ignore — canvas DOM no web */}
        <canvas
          key={geracao.current}
          ref={canvasRef}
          style={{ width: "100%", height: Math.round(size * 0.78), display: "block", cursor: "grab", touchAction: "none" } as any}
        />
      </View>

      {err ? (
        <Text style={{ fontSize: 11, color: "#B91C1C" }}>{err}</Text>
      ) : (
        <Text style={{ fontSize: 10.5, color: "#94A3B8" }}>Arraste para girar a peça</Text>
      )}
    </View>
  );
}

export default Mug3DPreview;
