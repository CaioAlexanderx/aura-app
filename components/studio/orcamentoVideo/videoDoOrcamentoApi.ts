// ============================================================
// components/studio/orcamentoVideo/videoDoOrcamentoApi.ts
//
// Sobe e baixa o vídeo do orçamento (28/09/2026, migration 360). Binário
// e não base64: o `request` do app serializa JSON, e o JSON do backend tem
// teto de 5 MB (o base64 incha um terço). O vídeo só volta ao painel por
// rota autenticada — nenhuma URL dele sai para fora.
// ============================================================
import { BASE_URL } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import type { VideoDoOrcamento } from "@/services/studioApi";
import type { FormatoDoVideo } from "./gravarGiro";

function caminho(cid: string, qid: string): string {
  return `${BASE_URL}/companies/${cid}/studio/quotes/${qid}/video`;
}

function cabecalhos(extra: Record<string, string> = {}): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function erroDe(res: Response, padrao: string): Promise<Error> {
  const corpo = await res.json().catch(() => null);
  const e: any = new Error((corpo && corpo.error) || `${padrao} (${res.status})`);
  e.status = res.status;
  return e;
}

export async function subirVideoDoOrcamento(
  cid: string,
  qid: string,
  video: Blob,
  contentType: "video/mp4" | "video/webm",
  formato: FormatoDoVideo,
): Promise<VideoDoOrcamento> {
  // O formato vai na query (telemetria, sem dado do cliente): cabeçalho
  // próprio exigiria liberar o nome no CORS do backend.
  const res = await fetch(caminho(cid, qid) + "?formato=" + encodeURIComponent(formato), {
    method: "PUT",
    headers: cabecalhos({ "Content-Type": contentType }),
    body: video,
  });
  if (!res.ok) throw await erroDe(res, "Não foi possível guardar o vídeo");
  const data = await res.json();
  return data.video as VideoDoOrcamento;
}

/** O vídeo guardado, como arquivo pronto para compartilhar. Null se expirou ou não existe. */
export async function baixarVideoDoOrcamento(cid: string, qid: string): Promise<Blob | null> {
  const res = await fetch(caminho(cid, qid), { method: "GET", headers: cabecalhos() });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw await erroDe(res, "Não foi possível buscar o vídeo");
  return await res.blob();
}
