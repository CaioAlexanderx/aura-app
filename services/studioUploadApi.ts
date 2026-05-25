/**
 * Helper Studio Upload — chama POST /companies/:cid/studio/upload-mockup
 * Item #10 da análise UX/UI: upload integrado em vez de URL externa.
 */
import { request } from './api';

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
export async function uploadStudioMockup(
  cid: string,
  params: {
    content_base64: string;
    content_type: string;
    kind?: StudioUploadKind;
  }
): Promise<StudioUploadResult> {
  return request<StudioUploadResult>(`/companies/${cid}/studio/upload-mockup`, {
    method: 'POST',
    body: params,
    retry: 0,
    timeout: 30000,
  } as any);
}

/**
 * Helper para web: lê um File (input type=file) e devolve base64 pronto pra subir.
 */
export async function fileToBase64Web(
  file: File
): Promise<{ base64: string; content_type: string; size_mb: number }> {
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

/**
 * Abre file picker no web e devolve resultado pronto pra enviar.
 * Retorna null se usuário cancelar.
 */
export function pickFileWeb(accept = 'image/*,application/pdf'): Promise<File | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let resolved = false;
    input.onchange = () => {
      resolved = true;
      const file = input.files && input.files[0] ? input.files[0] : null;
      resolve(file);
      input.remove();
    };
    // se o focus voltar e nada foi escolhido em 30s, considera cancelado
    setTimeout(() => {
      if (!resolved) {
        resolve(null);
        try { input.remove(); } catch {}
      }
    }, 60000);
    document.body.appendChild(input);
    input.click();
  });
}
