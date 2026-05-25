/**
 * Helper Studio Upload — chama POST /studio/upload-mockup
 * Item #10 da análise UX/UI: upload integrado em vez de URL externa.
 */
import { request } from './apiClient';

export type StudioUploadKind = 'mockup' | 'template' | 'approval';

export type StudioUploadResult = {
  ok: boolean;
  url: string;
  key: string;
  size_mb: number;
  content_type: string;
};

/**
 * Faz upload de um arquivo (PNG/JPEG/WebP/PDF) já como base64.
 * Frontend deve fornecer já decodificado/sem prefixo `data:...;base64,` (a rota
 * também aceita com prefixo).
 *
 * Limite: 15 MB.
 */
export async function uploadStudioMockup(params: {
  content_base64: string;
  content_type: string;
  kind?: StudioUploadKind;
}): Promise<StudioUploadResult> {
  return request<StudioUploadResult>('/studio/upload-mockup', {
    method: 'POST',
    body: params,
  });
}

/**
 * Helper para web: lê um File (input type=file) e devolve base64 pronto pra subir.
 */
export async function fileToBase64Web(file: File): Promise<{ base64: string; content_type: string; size_mb: number }> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Arquivo acima de 15 MB — tente comprimir antes de enviar.');
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({
        base64,
        content_type: file.type || 'application/octet-stream',
        size_mb: +(file.size / (1024 * 1024)).toFixed(2),
      });
    };
    reader.readAsDataURL(file);
  });
}
