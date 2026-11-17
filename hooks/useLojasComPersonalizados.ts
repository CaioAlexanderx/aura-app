// ============================================================
// AURA. — Personalizados no consolidado: que lojas têm a frente (p-187)
//
// No consolidado ("Todas as empresas") o auth não tem empresa ativa, então
// a conta de utils/personalizados.ts (studio_enabled ligado E empresa sem
// vertical_active) não tem de onde ler. Este hook faz a conta loja por loja:
// a vertical vem da lista de empresas do usuário (GET /auth/companies) e o
// interruptor vem do pdv_settings de cada uma.
//
// Quem usa:
//   - o menu (app/(tabs)/_layout.tsx): no consolidado a seção
//     Personalizados aparece quando ao menos uma loja tem a frente;
//   - a Produção e os Orçamentos 3D consolidados: o seletor mostra só essas
//     lojas, e "Abrir na loja" leva a uma tela que existe lá.
//
// Com a trava PERSONALIZADOS_LIBERADO desligada, ou fora do consolidado, o
// hook não pede nada ao servidor e devolve o conjunto vazio.
//
// Sem React Query de propósito: o menu monta este hook, e o layout das abas
// não pode depender de um QueryClient a mais. O cache fica no módulo, para
// o menu e a tela pedirem o pdv_settings de cada loja uma vez só.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { pdvSettingsApi } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { personalizadosAtivo, personalizadosLiberado } from "@/utils/personalizados";

/** company_id → studio_enabled lido do pdv_settings (false se a leitura falhou). */
const lidos = new Map<string, boolean>();
const emVoo = new Map<string, Promise<boolean>>();

function lerInterruptor(companyId: string): Promise<boolean> {
  const ja = emVoo.get(companyId);
  if (ja) return ja;
  const p = pdvSettingsApi.get(companyId)
    .then((r: any) => r?.settings?.studio_enabled === true)
    .catch(() => false)
    .then((ligado) => {
      lidos.set(companyId, ligado);
      emVoo.delete(companyId);
      return ligado;
    });
  emVoo.set(companyId, p);
  return p;
}

/** Só para os testes: esquece o que já foi lido. */
export function esquecerLojasComPersonalizados() {
  lidos.clear();
  emVoo.clear();
}

export type LojasComPersonalizados = {
  /** Lojas com a frente ligada (studio_enabled e sem vertical_active). */
  ligadas: Set<string>;
  /** true quando a lista de empresas e o pdv_settings de todas chegaram. */
  prontas: boolean;
};

export function useLojasComPersonalizados(): LojasComPersonalizados {
  const consolidado = useAuthStore((st) => st.consolidatedView);
  const empresas = useAuthStore((st) => st.availableCompanies);
  const carregando = useAuthStore((st) => st.companiesLoading);
  const carregarEmpresas = useAuthStore((st) => st.loadCompanies);
  const ativo = consolidado === true && personalizadosLiberado();
  const [, setVersao] = useState(0);
  // A lista de empresas foi pedida e voltou (vazia ou com erro): sem isso a
  // tela ficaria esperando para sempre.
  const [pediu, setPediu] = useState(false);

  const lista = ativo && Array.isArray(empresas) ? empresas : [];
  const ids = lista.map((e) => e.id).join(",");

  useEffect(() => {
    if (!ativo || lista.length || carregando) return;
    if (typeof carregarEmpresas !== "function") { setPediu(true); return; }
    carregarEmpresas().catch(() => {}).then(() => setPediu(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, ids]);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    // Loja de outra vertical (karatê, food, studio...) nem precisa da leitura.
    const faltam = lista.filter((e) => !e.vertical && !lidos.has(e.id)).map((e) => e.id);
    if (!faltam.length) return;
    Promise.all(faltam.map(lerInterruptor)).then(() => { if (vivo) setVersao((v) => v + 1); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, ids]);

  const faltando = lista.some((e) => !e.vertical && !lidos.has(e.id));
  const assinatura = lista.map((e) => `${e.id}:${e.vertical || ""}:${lidos.get(e.id) === true ? 1 : 0}`).join(",");

  const ligadas = useMemo(() => {
    const s = new Set<string>();
    for (const e of lista) {
      if (personalizadosAtivo({ studio_enabled: lidos.get(e.id) === true }, e.vertical)) s.add(e.id);
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  if (!ativo) return { ligadas, prontas: true };
  if (!lista.length) return { ligadas, prontas: pediu && !carregando };
  return { ligadas, prontas: !faltando };
}

export default useLojasComPersonalizados;
