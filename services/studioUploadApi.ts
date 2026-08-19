/**
 * Helper Studio Upload — chama POST /companies/:cid/studio/upload-mockup
 * Item #10 da análise UX/UI: upload integrado em vez de URL externa.
 *
 * 19/08/2026 — pickImageBase64(): ver comentário completo mais abaixo.
 * Resumo: fluxo cross-platform pra escolher uma foto (web + native), já
 * que antes só o caminho web (pickFileWeb/fileToBase64Web) existia e
 * todo caller mostrava um toast "só disponível na versão web" no app —
 * inutilizando o upload justamente no cenário mais comum (lojista com a
 * foto no celular).
 */
import { Platform } from 'react-native';
import { request } from './api';

export type StudioUploadKind = 'mockup' | 'template' | 'approval' | 'product' | 'customization';

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

/**
 * Resultado padronizado de uma escolha de imagem, igual nos dois branches
 * (web e native) — os callers não precisam saber em que plataforma estão,
 * só chamam `uploadStudioMockup(cid, { content_base64: r.base64, content_type: r.content_type, ... })`.
 */
export type PickedImage = {
  base64: string;
  content_type: string;
  size_mb?: number;
  /** uri local pra preview imediato (antes do upload terminar). No web
   * fica undefined — quem chamar já tem a própria URL final após o upload. */
  uri?: string;
};

/**
 * Escolhe UMA imagem da galeria/dispositivo, já em base64, funcionando
 * tanto no web quanto no app nativo (Android/iOS).
 *
 * - web: reusa pickFileWeb + fileToBase64Web (comportamento 100% igual ao
 *   que já existia — nenhuma mudança pra quem já usava só o caminho web).
 * - native: usa expo-image-picker (launchImageLibraryAsync com base64:true
 *   e qualidade comprimida ~0.8, igual ao padrão já usado em
 *   components/verticals/odonto/AddClinicalImageModal.tsx). Import
 *   dinâmico dentro do branch native — evita puxar o módulo no bundle web
 *   de configurações que não o incluem; o branch web nem chega a executar
 *   esse import.
 *
 * Cancelamento do usuário (fechou o seletor sem escolher) retorna `null`
 * silenciosamente — igual ao pickFileWeb. Permissão negada lança Error
 * com mensagem em pt-BR explicando como liberar; quem chama deve capturar
 * e mostrar via toast.error(...).
 *
 * @param webAccept accept do <input type=file> no web (ignorado no native,
 *   onde o seletor de imagens da galeria só lida com imagens mesmo).
 */
export async function pickImageBase64(webAccept = 'image/*'): Promise<PickedImage | null> {
  if (Platform.OS === 'web') {
    const file = await pickFileWeb(webAccept);
    if (!file) return null;
    const { base64, content_type, size_mb } = await fileToBase64Web(file);
    return { base64, content_type, size_mb };
  }

  const ImagePicker = await import('expo-image-picker');

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error(
      perm.canAskAgain === false
        ? 'Permissão de galeria negada. Vá em Ajustes do celular > Aura > Fotos e libere o acesso pra enviar imagens.'
        : 'Precisamos de acesso às suas fotos pra enviar a imagem. Tente de novo e permita o acesso quando o celular perguntar.'
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    base64: true,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  if (!asset.base64) {
    throw new Error('Não foi possível ler essa imagem. Tente outra foto.');
  }
  if (asset.fileSize && asset.fileSize > 15 * 1024 * 1024) {
    throw new Error('Imagem acima de 15 MB — tente outra foto ou comprima antes de enviar.');
  }

  return {
    base64: asset.base64,
    content_type: asset.mimeType || 'image/jpeg',
    size_mb: asset.fileSize ? +(asset.fileSize / (1024 * 1024)).toFixed(2) : undefined,
    uri: asset.uri,
  };
}
