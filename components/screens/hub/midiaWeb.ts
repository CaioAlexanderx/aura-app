// ============================================================
// Hub — foto e áudio no navegador (Chrome): gravar, escolher e reduzir.
//
// O Chrome grava com MediaRecorder em WebM/Opus. A Meta não aceita WebM:
// o SERVIDOR converte para OGG/Opus (troca de container, sem recodificar),
// então aqui só se grava e manda o que o navegador entrega, com o tipo.
// Tudo por detecção de recurso (sem Platform.OS): onde não há microfone ou
// MediaRecorder, o botão de áudio simplesmente não existe.
// ============================================================

export const MAX_SEGUNDOS_AUDIO = 5 * 60;
export const BITS_POR_SEGUNDO = 32000;
const LADO_MAXIMO_FOTO = 1600;
const QUALIDADE_FOTO = 0.85;
/** O parser JSON do servidor é de 5 MB (base64 incha 4/3): foto acima disto não vai. */
export const MAX_BYTES_FOTO = 3 * 1024 * 1024;

const PREFERIDOS = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export function gravacaoDisponivel(): boolean {
  const g: any = globalThis as any;
  return typeof g.MediaRecorder !== "undefined"
    && !!g.navigator?.mediaDevices?.getUserMedia;
}

/** Primeiro tipo de gravação que o navegador sabe fazer. */
export function escolherMimeDeGravacao(MR: { isTypeSupported?: (t: string) => boolean } | undefined = (globalThis as any).MediaRecorder): string | null {
  if (!MR || typeof MR.isTypeSupported !== "function") return null;
  return PREFERIDOS.find((t) => MR.isTypeSupported!(t)) || null;
}

export type Gravacao = { blob: Blob; mime: string; segundos: number };

export class Gravador {
  private rec: any = null;
  private stream: any = null;
  private pedacos: Blob[] = [];
  private inicio = 0;

  /** Pede o microfone e começa. Joga se a pessoa negar. */
  async iniciar(): Promise<void> {
    const g: any = globalThis as any;
    // Mono: é o que a Meta aceita para áudio Opus.
    this.stream = await g.navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    // Se o MediaRecorder falhar depois do getUserMedia, o microfone tem de ser solto
    // (senão a aba fica com o ícone de gravando para sempre).
    try {
      const mime = escolherMimeDeGravacao();
      // 32 kbps: 5 min cabem em ~1,2 MB (base64 ~1,6 MB), longe do limite de 5 MB do corpo.
      const opts = { audioBitsPerSecond: BITS_POR_SEGUNDO, ...(mime ? { mimeType: mime } : {}) };
      this.rec = new g.MediaRecorder(this.stream, opts);
      this.pedacos = [];
      this.rec.ondataavailable = (e: any) => { if (e.data && e.data.size > 0) this.pedacos.push(e.data); };
      this.inicio = Date.now();
      this.rec.start();
    } catch (e) {
      this.rec = null;
      this.soltarMicrofone();
      throw e;
    }
  }

  segundos(): number {
    return this.inicio ? Math.round((Date.now() - this.inicio) / 1000) : 0;
  }

  private soltarMicrofone() {
    try { this.stream?.getTracks?.().forEach((t: any) => t.stop()); } catch { /* já parou */ }
    this.stream = null;
  }

  /** Para e devolve o áudio gravado. */
  parar(): Promise<Gravacao> {
    return new Promise((resolve, reject) => {
      if (!this.rec) { reject(new Error("Não está gravando")); return; }
      const rec = this.rec;
      const segundos = this.segundos();
      rec.onstop = () => {
        const mime = String(rec.mimeType || escolherMimeDeGravacao() || "audio/webm");
        const blob = new Blob(this.pedacos, { type: mime });
        this.rec = null;
        this.soltarMicrofone();
        resolve({ blob, mime, segundos });
      };
      rec.onerror = (e: any) => { this.soltarMicrofone(); reject(e?.error || new Error("Falha na gravação")); };
      try { rec.stop(); } catch (e) { this.soltarMicrofone(); reject(e); }
    });
  }

  cancelar() {
    try { if (this.rec) { this.rec.onstop = null; this.rec.stop(); } } catch { /* já parou */ }
    this.rec = null;
    this.pedacos = [];
    this.soltarMicrofone();
  }
}

/** Blob → base64 puro (sem o prefixo data:). */
export function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || "").replace(/^data:[^,]*;base64,/, ""));
    r.onerror = () => reject(r.error || new Error("Não consegui ler o arquivo"));
    r.readAsDataURL(blob);
  });
}

/** Abre o seletor de arquivos do navegador. null = cancelou. */
export function escolherArquivo(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
    // "cancel" existe nos navegadores novos; sem ele a promessa só resolve ao escolher.
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

export type FotoPronta = { base64: string; mime: string; previa: string };

/**
 * Foto escolhida → JPEG com no máximo 1600 px no maior lado (o celular
 * entrega 5 a 10 MB). PNG pequeno vai como está. Joga se não for imagem ou
 * se ainda ficar grande demais.
 */
export async function prepararFoto(file: File): Promise<FotoPronta> {
  if (!/^image\/(jpeg|png)$/i.test(file.type)) throw new Error("Escolha uma foto JPEG ou PNG.");
  const original = await blobParaBase64(file);
  let base64 = original;
  let mime = file.type.toLowerCase();
  const g: any = globalThis as any;
  if (typeof g.createImageBitmap === "function" && typeof document !== "undefined") {
    try {
      const bmp = await g.createImageBitmap(file);
      const fator = Math.min(1, LADO_MAXIMO_FOTO / Math.max(bmp.width, bmp.height));
      if (fator < 1 || file.size > MAX_BYTES_FOTO) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bmp.width * fator));
        canvas.height = Math.max(1, Math.round(bmp.height * fator));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
          const url = canvas.toDataURL("image/jpeg", QUALIDADE_FOTO);
          base64 = url.replace(/^data:[^,]*;base64,/, "");
          mime = "image/jpeg";
        }
      }
    } catch { /* usa o original */ }
  }
  if (Math.floor((base64.length * 3) / 4) > MAX_BYTES_FOTO) throw new Error("A foto é grande demais. Escolha uma menor.");
  return { base64, mime, previa: `data:${mime};base64,${base64}` };
}

/** "0:07" */
export function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
