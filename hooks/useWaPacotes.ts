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
    try {
      const r = await waConfigApi.comprarPacote(companyId, bucket);
      if (r?.payment_url) {
        abrir(r.payment_url);
        await carregar();
      } else {
        // Sem link não se inventa pagamento: fica pendente e a Aura ativa.
        setManual(bucket);
      }
    } catch (e: any) {
      setErro(erroConfig(e).message);
    } finally {
      setComprando(null);
    }
  }, [companyId, comprando, abrir, carregar]);

  return { comprando, erro, manual, pendentes, comprar, abrir };
}
