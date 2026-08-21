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
//
// ── Onda 0 (0.6): desacoplamento de tema ──────────────────────────
// Este componente é compartilhado entre o painel Studio (que tem o
// StudioThemeProvider) e o storefront público (que NÃO tem provider).
// Antes, chamava useStudioTokens() direto: no storefront o context caía
// no default DARK e vazava cores escuras do painel pra loja pública (light).
//
// Agora a lógica de render vive em PersonalizationPreviewBase, que recebe
// a paleta via prop `t` (PreviewPalette). O wrapper PersonalizationPreview
// preserva a assinatura/comportamento pros callers internos (lê o hook e
// delega). O storefront usa o Base diretamente com a própria paleta
// (ver LivePreview.tsx) — sem nunca tocar no context interno.
// ============================================================
import { View, Text, Platform } from "react-native";
import { useStudioTokens } from "@/contexts/StudioThemeMode";
import type { CustomizationConfig, CustomizationField, CustomizationFieldSide } from "@/services/studioApi";
// sideOf é função pura (sem hook/context) — seguro no storefront, que
// renderiza este componente sem o StudioThemeProvider.
import { sideOf } from "@/components/studio/customizationConfig";
import { artFontStack } from "@/constants/fonts";

/**
 * Subconjunto de tokens que o preview realmente consome. Tipos `string`
 * (não literais) de propósito: permite tanto o StudioPalette do painel
 * quanto a paleta própria do storefront satisfazerem o contrato.
 */
export type PreviewPalette = {
  bgSoft: string;
  ink: string;
  ink3: string;
  ink4: string;
  ink5: string;
  primary: string;
};

type Props = {
  config: CustomizationConfig | null | undefined;
  values: Record<string, any>; // fieldId → valor preenchido
  size?: number;               // px do quadrado SVG
  productName?: string;
  showLabel?: boolean;
  /**
   * Lado desenhado. Default "front" — antes o preview SEMPRE mostrava a
   * frente, então quem configurava verso ou meio o fazia às cegas.
   * Cada lado tem a sua própria área de impressão e os seus campos.
   */
  side?: CustomizationFieldSide;
  /**
   * Foto do produto. Sem ela o preview desenha um quadrado colorido
   * generico — o cliente digita o nome e ve um retangulo tracejado, sem
   * ideia da peca que esta comprando. Com ela, a arte aparece SOBRE o
   * produto, que e o que a pessoa precisa julgar antes de pagar.
   */
  fotoProduto?: string | null;
};

/** Tinta legivel sobre uma cor — inline pra nao inverter a dependencia
 *  entre este componente compartilhado e o tema da vitrine. */
function inkSobre(hex: string): string {
  const s = String(hex || "").replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "#0F172A";
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const lum = 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  return lum > 0.45 ? "#0F172A" : "#FFFFFF";
}

function escapeXml(s: string): string {
  return String(s).replace(/[<>&'"]/g, (c) => {
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === "&") return "&amp;";
    if (c === "'") return "&apos;";
    return "&quot;";
  });
}

function findField(
  fields: CustomizationField[],
  type: string,
  side: CustomizationFieldSide = "front"
): CustomizationField | undefined {
  // O campo tem que ser DO LADO desenhado: um produto com `text` na
  // frente e `text_back` no verso mostraria o texto da frente nos dois
  // se a busca ignorasse o lado.
  return fields.find((f) => f.type === type && sideOf(f) === side);
}

/**
 * PersonalizationPreviewBase — renderer puro. NÃO chama hooks de tema.
 * Recebe a paleta (`t`) de quem o usa: o painel passa os tokens do tema
 * ativo; o storefront passa a paleta da própria loja.
 */
export function PersonalizationPreviewBase({
  config,
  values,
  size = 280,
  productName,
  showLabel = true,
  side = "front",
  fotoProduto,
  t,
}: Props & { t: PreviewPalette }) {
  // Estado vazio: sem config, mostra placeholder neutro
  if (!config) {
    return (
      <View
        style={{
          width: size, height: size,
          borderRadius: 12,
          backgroundColor: t.bgSoft,
          alignItems: "center", justifyContent: "center",
          borderWidth: 1, borderColor: t.ink5,
          borderStyle: "dashed",
        }}
      >
        <Text style={{ color: t.ink4, fontSize: 12 }}>Sem personalização configurada</Text>
      </View>
    );
  }

  // Área do lado desenhado. Verso e meio caem na área da frente quando o
  // produto não tem a sua própria — é o que já acontecia quando o lado
  // nem existia, e evita preview vazio por config pela metade.
  const cfgAny: any = config;
  const areaDoLado =
    side === "back"   ? cfgAny.back_print_area :
    side === "middle" ? cfgAny.middle_print_area :
    config.print_area;
  const printArea = areaDoLado || config.print_area || { width_cm: 10, height_cm: 10, position: "center" as const };
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
  // A COR é do produto inteiro (a peça é de uma cor só), então segue
  // vindo da frente; o resto é por lado.
  const colorField    = findField(fields, "color", "front") || findField(fields, "color", side);
  const textField     = findField(fields, "text", side);
  const imageField    = findField(fields, "image", side);
  const templateField = findField(fields, "template", side);

  const bgColor    = (colorField && values[colorField.id]) || "#FFFFFF";
  const textValue  = (textField  && String(values[textField.id]  || "")) || "";
  const imageUrl   = (imageField && values[imageField.id]) || null;
  const templateUrl= (templateField && values[templateField.id]) || null;

  // Texto: font-size proporcional ao comprimento (cap em 7)
  const textLen = Math.max(textValue.length, 4);
  const fontSize = Math.min((areaW / textLen) * 1.6, 7);

  // Layer image preferida sobre template (ambos podem coexistir mas image vence)
  const overlayUrl = imageUrl || templateUrl;

  // A fonte que o lojista configurou no campo — ate agora ela so servia
  // de placeholder no input e a arte saia sempre no sans do sistema.
  const fonteArte = artFontStack((textField as any)?.config?.fonts?.[0]);
  // A cor da arte: primeiro a que o CLIENTE escolheu (chave lateral
  // `<campo>_cor`), depois a primeira da paleta do lojista. Ate a fase 03
  // a paleta era ignorada por completo e o texto saia sempre na tinta da
  // UI; depois passou a usar sempre a primeira cor, que numa peca escura
  // podia ficar ilegivel. Agora quem decide e quem vai vestir.
  const corEscolhida = textField ? values[`${textField.id}_cor`] : null;
  const corArte =
    (typeof corEscolhida === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(corEscolhida.trim())
      ? corEscolhida.trim()
      : null) ||
    (textField as any)?.config?.colors?.[0] ||
    t.ink;
  // Sobre foto o contraste e IMPREVISIVEL, e a cor da arte vem da paleta
  // do lojista sem ninguem olhar a peca: uma polo azul-marinho recebe o
  // primeiro tom da lista, que costuma ser quase preto. Resultado: escuro
  // sobre escuro.
  //
  // Nao da pra escolher a cor certa sem saber a cor da peca (aqui ela vem
  // da FOTO, nao de um campo). Entao o contorno vira parte do desenho —
  // grosso o bastante para ler como letra contornada, que e estilo comum
  // em estamparia, em vez de acidente.
  const haloArte = inkSobre(corArte) === "#FFFFFF" ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)";
  // Fino de proposito. O contorno grosso (0.26) foi muleta enquanto a cor
  // da arte era imposta — a primeira da paleta, que numa peca escura dava
  // escuro sobre escuro. Agora o cliente ESCOLHE a cor, e o traco volta a
  // ser o que deve ser: uma borda que separa a letra do fundo.
  //
  // Grosso demais e pior que ausente: numa area de 6x4cm a fonte fica
  // pequena, os tracos se encontram e a palavra vira uma mancha.
  const haloLargura = 0.1;

  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bgColor}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${bgColor}" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <!-- Produto base: a foto quando existe, o quadrado colorido como
       ultimo recurso. A cor fica ATRAS da foto, entao PNG recortado
       continua mostrando a cor escolhida pelo cliente. -->
  <rect x="12" y="12" width="76" height="76" rx="10"
        fill="url(#bg-shade)"
        stroke="${t.ink5}" stroke-width="0.6"/>
  ${fotoProduto ? `<image href="${escapeXml(fotoProduto)}" x="13" y="13" width="74" height="74" preserveAspectRatio="xMidYMid meet" clip-path="inset(0 round 9)"/>` : ""}
  <!-- Sombra interna sutil pra dar volume -->
  <rect x="12" y="12" width="76" height="76" rx="10"
        fill="none"
        stroke="rgba(0,0,0,0.05)" stroke-width="0.4"/>
  <!-- Area de impressao (visualizacao) -->
  <rect x="${areaX}" y="${areaY}" width="${areaW}" height="${areaH}"
        fill="${fotoProduto ? "none" : "rgba(30,58,138,0.04)"}"
        stroke="${t.primary}" stroke-width="${fotoProduto ? "0.25" : "0.4"}"
        stroke-opacity="${fotoProduto ? "0.35" : "1"}"
        stroke-dasharray="1.5,0.8"/>
  ${overlayUrl ? `<image href="${escapeXml(overlayUrl)}" x="${areaX}" y="${areaY}" width="${areaW}" height="${areaH}" preserveAspectRatio="xMidYMid meet"/>` : ""}
  ${textValue ? `<text x="${areaX + areaW / 2}" y="${areaY + areaH / 2 + fontSize * 0.35}" text-anchor="middle" font-family="${escapeXml(fonteArte)}" font-size="${fontSize.toFixed(2)}" fill="none" stroke="${haloArte}" stroke-width="${(fontSize * haloLargura).toFixed(2)}" stroke-linejoin="round">${escapeXml(textValue)}</text>
  <text x="${areaX + areaW / 2}" y="${areaY + areaH / 2 + fontSize * 0.35}" text-anchor="middle" font-family="${escapeXml(fonteArte)}" font-size="${fontSize.toFixed(2)}" fill="${corArte}">${escapeXml(textValue)}</text>` : ""}
  ${showLabel && productName ? `<text x="50" y="96" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="3.2" font-weight="600" fill="${t.ink3}">${escapeXml(productName)}</text>` : ""}
  ${!overlayUrl && !textValue && !fotoProduto ? `<text x="${areaX + areaW / 2}" y="${areaY + areaH / 2}" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="3" fill="${t.ink4}" font-style="italic">${escapeXml(`${printArea.width_cm}×${printArea.height_cm}cm`)}</text>` : ""}
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
        borderWidth: 1, borderColor: t.ink5,
      }}
    >
      {textValue ? (
        <Text style={{
          color: t.ink,
          fontWeight: "800",
          fontSize: Math.min(size * 0.08, 28),
          textAlign: "center",
          paddingHorizontal: 16,
        }}>
          {textValue}
        </Text>
      ) : (
        <Text style={{ color: t.ink4, fontSize: 12, fontStyle: "italic" }}>
          {`${printArea.width_cm}×${printArea.height_cm}cm`}
        </Text>
      )}
      {showLabel && productName ? (
        <Text style={{ color: t.ink3, fontSize: 11, fontWeight: "600", marginTop: 8 }}>
          {productName}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * PersonalizationPreview — wrapper temático pros callers internos (painel).
 * Lê os tokens do tema ativo via hook e delega ao Base. Assinatura e
 * comportamento idênticos ao componente original — nada muda no painel.
 */
export function PersonalizationPreview(props: Props) {
  const t = useStudioTokens();
  return <PersonalizationPreviewBase {...props} t={t} />;
}

export default PersonalizationPreview;
