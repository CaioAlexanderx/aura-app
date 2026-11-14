// ============================================================
// AURA. — Ações de tela da NF-e 55 (sem estado). CP4, 14/11/2026.
//
// DANFE e XML pedem o Bearer (GET /nfe55/:id/danfe.pdf e /xml), então é
// fetch + blob. A janela do DANFE abre SÍNCRONA no clique (mesmo padrão do
// abrirPdfDaNfse): window.open depois de um await perde o gesto e o Chrome
// bloqueia o pop-up. O XML baixa como arquivo <chave>-nfe.xml.
// No app nativo, só a versão web imprime/baixa (como a NFS-e).
// ============================================================
import { Platform } from "react-native";
import { BASE_URL } from "@/services/api";
import { nfe55Api } from "@/services/nfe55Api";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/components/Toast";

function escapar(t: string): string {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
}

function soNaWeb(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    toast.info("Disponível na versão web da Aura.");
    return false;
  }
  return true;
}

async function mensagemDoErro(res: Response, padrao: string): Promise<string> {
  try { const j = await res.json(); if (j && j.error) return String(j.error); } catch (_) { /* sem corpo */ }
  return padrao;
}

export function abrirDanfe(companyId: string, emissaoId: string) {
  const token = useAuthStore.getState().token;
  if (!token || !companyId) { toast.error("Sessão expirada"); return; }
  if (!soNaWeb()) return;
  const w = window.open("", "_blank");
  if (!w) { toast.error("Pop-up bloqueado. Permita pop-ups para abrir o DANFE."); return; }
  try {
    w.document.write('<p style="font-family:system-ui,sans-serif;padding:24px;color:#444">Abrindo o DANFE…</p>');
  } catch (_) { /* segue */ }
  fetch(BASE_URL + nfe55Api.danfePath(companyId, emissaoId), { headers: { Authorization: "Bearer " + token } })
    .then(async (res) => {
      if (!res.ok) {
        const msg = await mensagemDoErro(res, "Não deu para abrir o DANFE agora. Tente de novo em instantes.");
        try { w.document.body.innerHTML = '<p style="font-family:system-ui,sans-serif;padding:24px;color:#b91c1c">' + escapar(msg) + "</p>"; } catch (_) { /* noop */ }
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      w.location.href = url;
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) { /* noop */ } }, 10 * 60_000);
    })
    .catch(() => {
      try { w.document.body.innerHTML = '<p style="font-family:system-ui,sans-serif;padding:24px;color:#b91c1c">Sem conexão para abrir o DANFE.</p>'; } catch (_) { /* noop */ }
    });
}

export async function baixarXml(companyId: string, emissaoId: string, chave?: string | null) {
  const token = useAuthStore.getState().token;
  if (!token || !companyId) { toast.error("Sessão expirada"); return; }
  if (!soNaWeb()) return;
  try {
    const res = await fetch(BASE_URL + nfe55Api.xmlPath(companyId, emissaoId), { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) { toast.error(await mensagemDoErro(res, "Não deu para baixar o XML agora.")); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = (chave ? chave : "nfe-" + emissaoId) + "-nfe.xml";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) { /* noop */ } }, 60_000);
  } catch (_) {
    toast.error("Sem conexão para baixar o XML.");
  }
}

export async function copiarTexto(texto: string, aviso = "Copiado") {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(texto);
      toast.success(aviso);
      return;
    }
  } catch (_) { /* cai no aviso */ }
  toast.info(texto);
}
