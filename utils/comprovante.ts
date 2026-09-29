// ============================================================
// Comprovante do lançamento (contas a pagar F3 · 29/09/2026)
//
// Foto ou PDF, até 3,5 MB (o backend recusa acima disso: o corpo JSON tem
// teto de 5 MB e o base64 cresce ~1/3). Na web (PWA) usa o seletor de arquivo
// do navegador; no app nativo, a galeria (só foto — o seletor de documentos
// não devolve o conteúdo sem mais uma biblioteca).
// ============================================================
import { Linking, Platform } from "react-native";
import { companiesApi } from "@/services/api";
import { fileToBase64Web, pickFileWeb } from "@/services/studioUploadApi";

export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
export const MAX_BYTES = 3.5 * 1024 * 1024;

export type ArquivoDoComprovante = { content: string; filename: string; content_type: string; size: number };

/** Mensagem de erro para mostrar, ou null se o arquivo serve. */
export function problemaDoArquivo(tipo: string, tamanho: number): string | null {
  if (!TIPOS_ACEITOS.includes(String(tipo || "").toLowerCase())) return "Envie uma foto (JPG, PNG, WEBP, HEIC) ou um PDF.";
  if (tamanho > MAX_BYTES) return "O arquivo passa de 3,5 MB. Tire a foto de novo ou envie o PDF.";
  if (!(tamanho > 0)) return "Arquivo vazio.";
  return null;
}

/** Abre o seletor e devolve o arquivo pronto para subir (null = cancelou). Lança com a mensagem se não servir. */
export async function escolherComprovante(): Promise<ArquivoDoComprovante | null> {
  if (Platform.OS === "web") {
    const file = await pickFileWeb("image/jpeg,image/png,image/webp,image/heic,application/pdf");
    if (!file) return null;
    const erro = problemaDoArquivo(file.type, file.size);
    if (erro) throw new Error(erro);
    const lido = await fileToBase64Web(file);
    return { content: lido.base64, filename: file.name || "comprovante", content_type: lido.content_type, size: file.size };
  }
  const ImagePicker = require("expo-image-picker");
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.6 });
  if (r.canceled || !r.assets || !r.assets[0] || !r.assets[0].base64) return null;
  const a = r.assets[0];
  const tipo = a.mimeType || "image/jpeg";
  const tamanho = Math.floor((a.base64.length * 3) / 4);
  const erro = problemaDoArquivo(tipo, tamanho);
  if (erro) throw new Error(erro);
  return { content: a.base64, filename: a.fileName || "comprovante.jpg", content_type: tipo, size: tamanho };
}

export function anexarComprovante(companyId: string, txId: string, arq: ArquivoDoComprovante) {
  return companiesApi.transactionReceiptUpload(companyId, txId, { content: arq.content, filename: arq.filename, content_type: arq.content_type });
}

export function removerComprovante(companyId: string, txId: string) {
  return companiesApi.transactionReceiptDelete(companyId, txId);
}

/** Busca a URL assinada e abre (nova aba na web). */
export async function abrirComprovante(companyId: string, txId: string) {
  const r = await companiesApi.transactionReceiptUrl(companyId, txId);
  const url = r && r.url;
  if (!url) throw new Error("Não deu para abrir o comprovante.");
  if (Platform.OS === "web" && typeof window !== "undefined") window.open(url, "_blank", "noopener");
  else await Linking.openURL(url);
}

/** Texto curto do anexo: "boleto-energia.pdf" → "boleto-energia.pdf"; corta nomes longos. */
export function nomeCurto(nome: string | null | undefined, max = 28): string {
  const s = String(nome || "comprovante");
  if (s.length <= max) return s;
  const ponto = s.lastIndexOf(".");
  const ext = ponto > 0 && s.length - ponto <= 6 ? s.slice(ponto) : "";
  return s.slice(0, max - ext.length - 1) + "…" + ext;
}
