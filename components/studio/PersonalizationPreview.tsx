// ============================================================
// AURA STUDIO · PersonalizationPreview
//
// SVG live preview da personalizacao. Componente compartilhado:
//   - PDV Studio nativo (sub-onda E1)
//   - Storefront publico (sub-onda D2)
//
// Renderiza SVG escalado proporcional ao print_area do produto,
// com layers:
//   1. Produto base (rect com cor de fundo)
//   2. Area de impressao (rect dashed navy semi-transparente)
//   3. Image/template (se houver)
//   4. Texto centralizado (se houver)
//   5. Label opcional do produto
//
// Padrao seguindo Icon.tsx / AuraStudioMark.tsx — span + innerHTML
// no web (Expo SDK 52 + react-native-web), fallback nativo simples.
// ============================================================
import { View, Text, Platform } from "react-native";
import { StudioColors } from "@/constants/studio-tokens";
import type { CustomizationConfig, CustomizationField } from "@/services/studioApi";

type Props = {
  config: CustomizationConfig | null | undefined;
  values: Record<string, any>; // fieldId → valor preenchido
  size?: number;               // px do quadrado SVG
  productName?: string;
  showLabel?: boolean;
};

function escapeXml(s: string): string {
  return String(s).replace(/[<>&'"]/g, (c) => {
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === "&") return "&amp;";
    if (c === "'") return "&apos;";
    return "&quot;";
  });
}

function findField(fields: CustomizationField[], type: string): CustomizationField | undefined {
  return fields.find((f) => f.type === type);
}

export function PersonalizationPreview({
  config,
  values,
  size = 280,
  productName,
  showLabel = true,
}: Props) {
  // Estado vazio: sem config, mostra placeholder neutro
  if (!config) {
    return (
      <View
        style={{
          width: size, height: size,
          borderRadius: 12,
          backgroundColor: StudioColors.bgSoft,
          alignItems: "center", justifyContent: "center",
          borderWidth: 1, borderColor: StudioColors.ink5,
          borderStyle: "dashed",
        }}
      >
        <Text style={{ color: StudioColors.ink4, fontSize: 12 }}>Sem personalização configurada</Text>
      </View>
    );
  }

  const printArea = config.print_area || { width_cm: 10, height_cm: 10, position: "center" as const };
  const fields = config.fields || [];

  // Resolução das áreas no viewBox 0-100
  const maxDim = Math.max(printArea.width_cm, printArea.height_cm, 1);
  const areaW = (printArea.width_cm / maxDim) * 55; // 55% do viewBox
  const areaH = (printArea.height_cm / maxDim) * 55;

  let areaX = 50 - areaW / 2;
  const areaY = 50 - areaH / 2;
  if (printArea.position === "left")  areaX = 18;
  if (printArea.position === "right") areaX = 82 - areaW;

  // Fields conhecidos
  const colorField    = findField(fields, "color");
  const textField     = findField(fields, "text");
  const imageField    = findField(fields, "image");
  const templateField = findField(fields, "template");

  const bgColor    = (colorField && values[colorField.id]) || "#FFFFFF";
  const textValue  = (textField  && String(values[textField.id]  || "")) || "";
  const imageUrl   = (imageField && values[imageField.id]) || null;
  const templateUrl= (templateField && values[templateField.id]) || null;

  // Texto: font-size proporcional ao comprimento (cap em 7)
  const textLen = Math.max(textValue.length, 4);
  const fontSize = Math.min((areaW / textLen) * 1.6, 7);

  // Layer image preferida sobre template (ambos podem coexistir mas image vence)
  const overlayUrl = imageUrl || templateUrl;

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bgColor}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${bgColor}" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <!-- Produto base -->
  <rect x="12" y="12" width="76" height="76" rx="10"
        fill="url(#bg-shade)"
        stroke="${StudioColors.ink5}" stroke-width="0.6"/>
  <!-- Sombra interna sutil pra dar volume -->
  <rect x="12" y="12" width="76" height="76" rx="10"
        fill="none"
        stroke="rgba(0,0,0,0.05)" stroke-width="0.4"/>
  <!-- Area de impressao (visualizacao) -->
  <rect x="${areaX}" y="${areaY}" width="${areaW}" height="${areaH}"
        fill="rgba(30,58,138,0.04)"
        stroke="${StudioColors.primary}" stroke-width="0.4"
        stroke-dasharray="1.5,0.8"/>
  ${overlayUrl ? `<image href="${escapeXml(overlayUrl)}" x="${areaX}" y="${areaY}" width="${areaW}" height="${areaH}" preserveAspectRatio="xMidYMid meet"/>` : ""}
  ${textValue ? `<text x="${areaX + areaW / 2}" y="${areaY + areaH / 2 + fontSize * 0.35}" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="${fontSize.toFixed(2)}" font-weight="800" fill="${StudioColors.ink}">${escapeXml(textValue)}</text>` : ""}
  ${showLabel && productName ? `<text x="50" y="96" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="3.2" font-weight="600" fill="${StudioColors.ink3}">${escapeXml(productName)}</text>` : ""}
  ${!overlayUrl && !textValue ? `<text x="${areaX + areaW / 2}" y="${areaY + areaH / 2}" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="3" fill="${StudioColors.ink4}" font-style="italic">${escapeXml(`${printArea.width_cm}×${printArea.height_cm}cm`)}</text>` : ""}
</svg>`.trim();

  if (Platform.OS === "web") {
    return (
      <span
        style={{
          width: size, height: size,
          display: "inline-flex",
          flexShrink: 0,
          borderRadius: 12,
          overflow: "hidden",
        } as any}
        aria-label={`Preview da personalização${productName ? " — " + productName : ""}`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  // Native fallback — view simples sem SVG (Expo native nao precisa por enquanto)
  return (
    <View
      style={{
        width: size, height: size,
        borderRadius: 12,
        backgroundColor: bgColor,
        alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: StudioColors.ink5,
      }}
    >
      {textValue ? (
        <Text style={{
          color: StudioColors.ink,
          fontWeight: "800",
          fontSize: Math.min(size * 0.08, 28),
          textAlign: "center",
          paddingHorizontal: 16,
        }}>
          {textValue}
        </Text>
      ) : (
        <Text style={{ color: StudioColors.ink4, fontSize: 12, fontStyle: "italic" }}>
          {`${printArea.width_cm}×${printArea.height_cm}cm`}
        </Text>
      )}
      {showLabel && productName ? (
        <Text style={{ color: StudioColors.ink3, fontSize: 11, fontWeight: "600", marginTop: 8 }}>
          {productName}
        </Text>
      ) : null}
    </View>
  );
}

export default PersonalizationPreview;
