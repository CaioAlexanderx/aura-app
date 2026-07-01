// ============================================================
// Microsite — helpers tipados para o app (web + nativo).
//
// Use para DERIVAR o slug do host atual (web) e para MONTAR links limpos do
// microsite ({slug}.getaura.com.br/...) — ex.: o link fixo do dojô que a
// federação copia/envia. O mapeamento host↔caminho fica em micrositeCore.js
// (puro) e a reescrita de boot em micrositeBootstrap.ts.
// ============================================================
import { Platform } from "react-native";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const core = require("./micrositeCore");

export const ROOT_DOMAIN: string = core.ROOT_DOMAIN;

/** Slug da federação derivado do subdomínio atual (só web). null caso contrário. */
export function getMicrositeSlug(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return core.slugFromHost(window.location.hostname);
}

/** True se estamos servindo sob um subdomínio de federação. */
export function isMicrositeHost(): boolean {
  return getMicrositeSlug() !== null;
}

/** Monta a URL pública limpa do microsite (ex.: link do dojô para WhatsApp). */
export function buildMicrositeUrl(slug: string, path = "/"): string {
  return core.buildMicrositeUrl(slug, path);
}

export function micrositeTargetPath(slug: string, pathname: string): string {
  return core.micrositeTargetPath(slug, pathname);
}
