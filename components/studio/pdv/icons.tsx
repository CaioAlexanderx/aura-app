// ============================================================
// AURA STUDIO · PDV — set de ícones (feather-style) do mockup aprovado.
// Local ao PDV pra cobrir glifos que o <Icon> global não tem
// (barcode, sparkle, palette, pix, cash…). Web: SVG inline; nativo:
// placeholder de mesmo tamanho (web é o alvo do export).
// ============================================================
import { Platform, View } from "react-native";

export const PDV_ICONS: Record<string, string> = {
  search: "M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35",
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  x: "M18 6L6 18 M6 6l12 12",
  check: "M20 6L9 17l-5-5",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6 M10 11v6 M14 11v6",
  edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  dollar: "M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  receipt: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z M16 8H8 M16 12H8 M14 16H8",
  cart: "M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6 M9 22a1 1 0 100-2 1 1 0 000 2z M20 22a1 1 0 100-2 1 1 0 000 2z",
  package: "M16.5 9.4l-9-5.19 M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12",
  file_text: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  arrow_right: "M5 12h14 M12 5l7 7-7 7",
  arrow_left: "M19 12H5 M12 19l-7-7 7-7",
  sparkle: "M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z",
  barcode: "M3 5v14 M6.5 5v14 M10 5v14 M13.5 5v9 M17 5v14 M20.5 5v14",
  palette: "M12 22a10 10 0 110-20 9 9 0 019 9 4.5 4.5 0 01-4.5 4.5H14a2 2 0 00-1.6 3.2A2 2 0 0112 22z M7.5 12a1 1 0 100-2 1 1 0 000 2z M11 7.5a1 1 0 100-2 1 1 0 000 2z M16 8.5a1 1 0 100-2 1 1 0 000 2z",
  type: "M4 7V5h16v2 M9 19h6 M12 5v14",
  image: "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z M8.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z M21 15l-5-5L5 21",
  layout: "M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2z M3 9h18 M9 21V9",
  whatsapp: "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z",
  pix: "M12 2l4 4-4 4-4-4z M2 12l4-4 4 4-4 4z M22 12l-4-4-4 4 4 4z M12 22l-4-4 4-4 4 4z",
  card: "M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z M1 10h22",
  cash: "M2 6h20v12H2z M12 15a3 3 0 100-6 3 3 0 000 6z M6 9v.01 M18 15v.01",
  clipboard: "M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2 M9 2h6a1 1 0 011 1v1a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
};

export function Ic({ name, size = 20, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const d = PDV_ICONS[name];
  if (Platform.OS === "web") {
    if (!d) return <View style={{ width: size, height: size }} />;
    const segs = d.split(" M").map((s, i) => `<path d="${i === 0 ? s : "M" + s}"/>`).join("");
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">${segs}</svg>`;
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size, display: "inline-flex", flexShrink: 0 } as any}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  // Nativo: placeholder de mesmo tamanho (web é o alvo do export)
  return <View style={{ width: size, height: size }} />;
}
