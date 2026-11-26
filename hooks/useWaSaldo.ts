// useWaSaldo — o saldo do mês (novidades, avisos, Aurinha) lido do servidor.
// Erro, rota ausente (backend antigo) ou resposta torta deixam `saldo` em
// null: a tela trava e diz que não leu. Nunca assume saldo.
import { useCallback, useEffect, useState } from "react";
import { waConfigApi } from "@/services/waConfigApi";
import { waSaldoInfo, type SaldoInfo } from "@/components/whatsapp/waSaldo";

export interface UseWaSaldo {
  saldo: SaldoInfo | null;
  carregando: boolean;
  falhou: boolean;
  recarregar: () => void;
}

export function useWaSaldo(companyId: string | null | undefined, enabled: boolean = true): UseWaSaldo {
  const [saldo, setSaldo] = useState<SaldoInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const ativo = !!companyId && enabled;

  const recarregar = useCallback(async () => {
    if (!ativo) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const info = waSaldoInfo(await waConfigApi.getSaldo(companyId as string));
      setSaldo(info);
      setFalhou(info == null);
    } catch {
      setSaldo(null);
      setFalhou(true);
    } finally {
      setCarregando(false);
    }
  }, [ativo, companyId]);

  useEffect(() => { recarregar(); }, [recarregar]);

  return { saldo, carregando, falhou, recarregar };
}
