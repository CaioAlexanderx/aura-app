// useWaPacotes — comprar pacote de mensagens (contrato do agente A, #1134).
//
// Regras: o preço e a quantidade vêm do servidor; a compra só gera um link
// de pagamento (Pix ou link da Asaas). NADA é cobrado sozinho e o pacote só
// soma no saldo depois do pagamento confirmado. Aqui a tela só pede o link,
// abre e depois relê o saldo.
import { useCallback, useEffect, useState } from "react";
import { Linking } from "react-native";
import { waConfigApi, erroConfig, type WaBucket, type WaPacoteRaw } from "@/services/waConfigApi";

export interface UseWaPacotes {
  comprando: WaBucket | null;
  erro: string | null;
  /** O navegador não deixou abrir o pagamento sozinho: ela abre pelo botão. */
  abaBloqueada: boolean;
  /** Pedido feito sem link (sem cliente Asaas ou Asaas fora): a Aura ativa na mão. */
  manual: WaBucket | null;
  /** Pacotes que ainda esperam o pagamento (com link). */
  pendentes: WaPacoteRaw[];
  comprar: (bucket: WaBucket) => Promise<void>;
  abrir: (url: string) => void;
}

export function useWaPacotes(companyId: string | null | undefined, enabled: boolean): UseWaPacotes {
  const [comprando, setComprando] = useState<WaBucket | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [manual, setManual] = useState<WaBucket | null>(null);
  const [abaBloqueada, setAbaBloqueada] = useState(false);
  const [pendentes, setPendentes] = useState<WaPacoteRaw[]>([]);

  const carregar = useCallback(async () => {
    if (!companyId || !enabled) { setPendentes([]); return; }
    try {
      const r = await waConfigApi.listarPacotes(companyId);
      const l = Array.isArray(r?.data) ? r.data : [];
      setPendentes(l.filter((p) => p && p.status === "pending" && typeof p.payment_url === "string" && !!p.payment_url));
    } catch {
      setPendentes([]);
    }
  }, [companyId, enabled]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrir = useCallback((url: string) => {
    try { Linking.openURL(url); } catch { /* sem navegador: o link segue na tela */ }
  }, []);

  const comprar = useCallback(async (bucket: WaBucket) => {
    if (!companyId || comprando) return;
    setComprando(bucket);
    setErro(null);
    setManual(null);
    setAbaBloqueada(false);
    // Safari bloqueia janela aberta depois de uma espera: abre a aba VAZIA já
    // no toque e só depois manda ela para o link do pagamento.
    let aba: any = null;
    try {
      if (typeof window !== "undefined" && typeof window.open === "function") aba = window.open("", "_blank");
    } catch { aba = null; }
    try {
      const r = await waConfigApi.comprarPacote(companyId, bucket);
      if (r?.payment_url) {
        if (aba && !aba.closed) {
          aba.location.href = r.payment_url;
        } else {
          // Sem aba (bloqueada ou app nativo): tenta abrir; se não der, o botão resolve.
          if (typeof window !== "undefined") setAbaBloqueada(true);
          abrir(r.payment_url);
        }
        await carregar();
      } else {
        // Sem link não se inventa pagamento: fica pendente e a Aura ativa.
        try { aba?.close(); } catch { /* ignora */ }
        setManual(bucket);
      }
    } catch (e: any) {
      try { aba?.close(); } catch { /* ignora */ }
      setErro(erroConfig(e).message);
    } finally {
      setComprando(null);
    }
  }, [companyId, comprando, abrir, carregar]);

  return { comprando, erro, manual, abaBloqueada, pendentes, comprar, abrir };
}
