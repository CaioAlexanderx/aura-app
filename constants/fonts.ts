import { Platform } from "react-native";

// Typography system for Aura.
// Web: Google Fonts (Instrument Serif + DM Sans)
// Native: system font fallbacks

const isWeb = Platform.OS === "web";

export const Fonts = {
  // Headings - Instrument Serif (elegant, editorial)
  heading: isWeb
    ? "'Instrument Serif', Georgia, serif"
    : "System",

  // Body - DM Sans (clean, modern)
  body: isWeb
    ? "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    : "System",

  // Mono - DM Mono (data, numbers)
  mono: isWeb
    ? "'DM Mono', 'SF Mono', Menlo, monospace"
    : "monospace",
} as const;

// Google Fonts CSS link (injected in web layout)
export const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800&family=Instrument+Serif:ital@0;1&display=swap";

// Shorthand for common text styles
export const Typography = {
  h1: { fontFamily: Fonts.heading, fontSize: 28, fontWeight: "400" as const },
  h2: { fontFamily: Fonts.heading, fontSize: 22, fontWeight: "400" as const },
  h3: { fontFamily: Fonts.heading, fontSize: 18, fontWeight: "400" as const },
  body: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "400" as const },
  bodyBold: { fontFamily: Fonts.body, fontSize: 14, fontWeight: "700" as const },
  label: { fontFamily: Fonts.body, fontSize: 11, fontWeight: "600" as const, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  caption: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "500" as const },
  mono: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: "500" as const },
} as const;
