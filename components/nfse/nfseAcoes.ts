// ============================================================
// AURA. — Ações de tela da NFS-e automática (sem estado)
//
// abrirPdfDaNfse: a 2ª via (DANFSe) sai de GET /origem/:tipo/:id/segunda-via
// ?formato=pdf&nfse_id=, que pede o Bearer — por isso fetch + blob. A janela
// abre SÍNCRONA no clique (como o printWindow da NFC-e): window.open depois
// de um await perde o gesto do usuário e o Chrome bloqueia o pop-up.
// ============================================================
import { Platform, Linking } from "react-native";
import { BASE_URL } from "@/services/api";
import { nfseAutomaticaApi, type OrigemNfse } from "@/services/nfseAutomaticaApi";
import { toast } from "@/components/Toast";

function escapar(t: string): string {
  return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
}

export function abrirPdfDaNfse(p: {
  companyId: string; tipo: OrigemNfse; id: string; nfseId: string; token: string | null;
}) {
  if (!p.token || !p.companyId) { toast.error("Sessão expirada"); return; }
  if (Platform.OS !== "web" || typeof window === "undefined") {
    toast.info("Impressão disponível apenas na versão web");
    return;
  }
  const w = window.open("", "_blank");
  if (!w) { toast.error("Pop-up bloqueado. Permita pop-ups para imprimir."); return; }
  try {
    w.document.write('<p style="font-family:system-ui,sans-serif;padding:24px;color:#444">Abrindo a nota de serviço…</p>');
  } catch (_) { /* janela de outra origem: segue */ }
  fetch(BASE_URL + nfseAutomaticaApi.pdfPath(p.companyId, p.tipo, p.id, p.nfseId), {
    headers: { Authorization: "Bearer " + p.token },
  }).then(async (res) => {
    if (!res.ok) {
      let msg = "Não deu para abrir a nota de serviço agora. Tente de novo em instantes.";
      try { const j = await res.json(); if (j && j.error) msg = String(j.error); } catch (_) { /* sem corpo */ }
      try { w.document.body.innerHTML = '<p style="font-family:system-ui,sans-serif;padding:24px;color:#b91c1c">' + escapar(msg) + "</p>"; } catch (_) { /* noop */ }
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    w.location.href = url;
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) { /* noop */ } }, 10 * 60_000);
  }).catch(() => {
    try { w.document.body.innerHTML = '<p style="font-family:system-ui,sans-serif;padding:24px;color:#b91c1c">Sem conexão para abrir a nota de serviço.</p>'; } catch (_) { /* noop */ }
  });
}

export function abrirLink(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") window.open(url, "_blank");
  else Linking.openURL(url);
}

/** wa.me com o telefone do cliente (o mesmo formato do NfceActions). */
export function linkWhatsApp(phone: string | null | undefined, mensagem: string): string | null {
  if (!phone) return null;
  let d = String(phone).replace(/\D/g, "");
  if (d.length < 10) return null;
  if (!d.startsWith("55")) d = "55" + d;
  return "https://wa.me/" + d + "?text=" + encodeURIComponent(mensagem);
}
