// ============================================================
// Baixar a arte que o cliente enviou (05/09/2026)
//
// A arte mora no R2, num endereco publico. Clicar no link abria a imagem
// na aba e a lojista tinha que "salvar como" — e o nome vinha como o hash
// do upload, impossivel de achar depois na pasta da producao.
//
// O R2 responde CORS para GET (configurado em 04/09/2026), entao o
// proprio navegador busca o arquivo e salva com o nome que a lojista
// reconhece: numero do pedido + campo. Sem passar pelo backend — nao ha
// credencial a esconder num arquivo que o proprio cliente subiu por uma
// rota publica.
// ============================================================
import { Linking, Platform } from "react-native";

/** Extensao a partir da URL (sem query). Cai em "png" quando nao da para saber. */
export function extensaoDaUrl(url: string): string {
  const semQuery = String(url || "").split("?")[0].split("#")[0];
  const m = /\.([a-z0-9]{2,5})$/i.exec(semQuery);
  return m ? m[1].toLowerCase() : "png";
}

/** Nome seguro de arquivo: "SM-0042 - Foto do cliente.jpg". */
export function nomeDoArquivo(pedido: string, rotulo: string, url: string): string {
  const limpo = (t: string) => String(t || "").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
  const base = [limpo(pedido), limpo(rotulo)].filter(Boolean).join(" - ") || "arte";
  return `${base}.${extensaoDaUrl(url)}`;
}

/**
 * Baixa pelo navegador. Se o fetch falhar (CORS de um host que nao e o
 * nosso, rede), abre a URL numa aba — o caminho antigo, que sempre
 * funcionou. Nunca falha em silencio.
 */
export async function baixarArquivo(url: string, nome: string): Promise<"baixado" | "aberto"> {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    await Linking.openURL(url);
    return "aberto";
  }
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) throw new Error(String(r.status));
    const blob = await r.blob();
    const objeto = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objeto;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objeto), 4000);
    return "baixado";
  } catch {
    window.open(url, "_blank", "noopener");
    return "aberto";
  }
}
