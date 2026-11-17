// ============================================================
// AURA. — "Chegou mercadoria": escolher um arquivo no navegador
//
// Um <input type="file"> criado na hora (o wizard abre por WebPortal, fora
// da árvore da tela). Fora do web devolve null: o wizard é do computador e
// do navegador do celular.
// ============================================================

export function escolherArquivo(accept: string): Promise<File | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    let pronto = false;
    const fim = (f: File | null) => {
      if (pronto) return;
      pronto = true;
      resolve(f);
      try { input.remove(); } catch {}
    };
    input.addEventListener("change", () => fim((input.files && input.files[0]) || null));
    // Navegadores novos avisam quando a pessoa cancela a janela de arquivos.
    input.addEventListener("cancel", () => fim(null));
    document.body.appendChild(input);
    input.click();
  });
}

export function lerTextoDoArquivo(arquivo: File): Promise<string> {
  if (typeof (arquivo as any).text === "function") return (arquivo as any).text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsText(arquivo);
  });
}

/** O que o seletor aceita para a nota: o XML (e o PDF, para avisar que não serve). */
export const ACEITA_NOTA = ".xml,text/xml,application/xml,.pdf,application/pdf";
