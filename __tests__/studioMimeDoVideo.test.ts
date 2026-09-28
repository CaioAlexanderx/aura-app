// ============================================================
// AURA Studio — 28/09/2026: o MIME do vídeo de aprovação não leva acento
//
// O PR de acentuação (#822) trocou "video/webm" por "vídeo/webm" no
// gravador do turntable e no tipo padrão do upload. MIME é protocolo:
// `MediaRecorder.isTypeSupported("vídeo/webm")` é falso, o gravador caía
// no construtor sem bitrate, e um blob sem tipo subia como "vídeo/webm"
// e levava 400. Este teste garante a constante e varre os dois arquivos
// por qualquer "vídeo/" em string de MIME.
// ============================================================
import fs from "fs";
import path from "path";
import { MIME_DO_VIDEO } from "@/components/studio/visualEngine/compose3dMug";

const RAIZ = path.join(__dirname, "..", "components", "studio", "visualEngine");

describe("MIME do vídeo de aprovação", () => {
  it("é video/webm, sem acento", () => {
    expect(MIME_DO_VIDEO).toBe("video/webm");
    expect(MIME_DO_VIDEO).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/);
  });

  it.each(["compose3dMug.ts", "gerarRenderAprovacao.ts"])("%s não tem MIME acentuado", (arquivo) => {
    const fonte = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
    // Só strings de MIME: "vídeo/…", "áudio/…", "imagem/…" entre aspas.
    const acentuados = fonte.match(/["'`](vídeo|áudio|imagem)\/[^"'`]*["'`]/g) || [];
    expect(acentuados).toEqual([]);
  });
});
