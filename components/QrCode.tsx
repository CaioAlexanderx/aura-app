import { useMemo } from "react";
import { Image, View, Text, Platform } from "react-native";
import { Colors } from "@/constants/colors";

// Gera QR localmente via qrcode-svg (lib pure-JS, ~10kb gzipped, sem deps
// nativas). Saída SVG é embutida como data URI base64 → renderizada em
// React Native Image (web + mobile).
//
// Uso:
//   <QrCode value="texto longo aqui" size={200} />
//
// Substitui a dep externa api.qrserver.com (single point of failure se
// CDN cair / bloqueio CORS / produção sensível a 3rd-party).
//
// Fallback: se a lib falhar (caso raro de import error), renderiza
// placeholder com a string clicável.

let _QRCode: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _QRCode = require("qrcode-svg");
} catch {
  _QRCode = null;
}

type Props = {
  value: string;
  size?: number;
  /** error correction level. M = padrão (15% de redundância) é suficiente pra NFC-e */
  ecl?: "L" | "M" | "Q" | "H";
  /** cor dos módulos (default preto) */
  color?: string;
  /** cor do fundo (default branco) */
  background?: string;
};

// Codifica string UTF-8 em base64 sem usar Buffer (que não existe no web).
// btoa não aceita unicode direto, então convertemos via encodeURIComponent.
function utf8ToBase64(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  if (typeof btoa !== "undefined") {
    // btoa não suporta unicode — usa o truque clássico
    return btoa(unescape(encodeURIComponent(str)));
  }
  return "";
}

export function QrCode({ value, size = 200, ecl = "M", color = "#000000", background = "#ffffff" }: Props) {
  const dataUri = useMemo(() => {
    if (!value || !_QRCode) return null;
    try {
      const qr = new _QRCode({
        content: value,
        padding: 0,
        width: size,
        height: size,
        color,
        background,
        ecl,
      });
      const svg: string = qr.svg();
      const b64 = utf8ToBase64(svg);
      return `data:image/svg+xml;base64,${b64}`;
    } catch {
      return null;
    }
  }, [value, size, ecl, color, background]);

  if (!value) {
    return (
      <View style={{ width: size, height: size, backgroundColor: Colors.bg4, alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
        <Text style={{ fontSize: 10, color: Colors.ink3 }}>QR indisponível</Text>
      </View>
    );
  }

  if (!dataUri) {
    // Fallback: lib não carregou. Mostra container com label clicável.
    return (
      <View
        style={{
          width: size, height: size, backgroundColor: Colors.bg4,
          alignItems: "center", justifyContent: "center", borderRadius: 8,
          padding: 8, borderWidth: 1, borderColor: Colors.border,
        }}
      >
        <Text style={{ fontSize: 9, color: Colors.ink3, textAlign: "center" }}>
          QR não pôde ser gerado.{"\n"}Use o link de consulta SEFAZ.
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: dataUri }}
      style={{ width: size, height: size, borderRadius: 8, backgroundColor: background }}
      accessibilityLabel="QR code"
    />
  );
}

export default QrCode;
