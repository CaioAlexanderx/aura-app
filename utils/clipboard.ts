// ============================================================
// clipboard — helper de cópia mínimo (sem dependência nova)
//
// O app NÃO tem expo-clipboard nas deps (adicionar quebraria o `npm ci`
// do build da Cloudflare, que exige o package-lock em sincronia). As
// telas que precisam copiar link público (federação de karatê) são
// web-only, então usamos a Web Clipboard API com fallback clássico.
//
// Uso:
//   const ok = await copyToClipboard("https://fpkt.getaura.com.br/ranking");
//   if (ok) toast("Link copiado");
// ============================================================
import { Platform } from "react-native";

/** Copia `text` para a área de transferência. Retorna true se conseguiu. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;

  // Caminho moderno (requer contexto seguro — https, que é o nosso caso).
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* cai no fallback abaixo */
  }

  // Fallback clássico: textarea fora de tela + execCommand("copy").
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
