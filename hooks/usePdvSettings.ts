import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pdvSettingsApi, type PdvSettings } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { valeTrocaPrecisaMigrar, marcarValeTrocaMigrado } from "@/utils/valeTroca";

// ============================================================
// AURA. — Hook das configuracoes do PDV
//
// Cache infinito por sessao (so muda quando cliente edita).
// Retorna defaults seguros se ainda nao carregou.
// Hook expõe `invalidate()` pra forcar re-fetch apos save manual.
//
// 09/05/2026: caixa_enabled e crediario_enabled passam a default=true.
// Antes default era false (gateava recursos), mas decisao do produto e
// que essas funcionalidades vem ativadas pra todas as empresas — quem
// nao usa simplesmente desliga em Configuracoes > PDV > Politicas do
// Caixa. Backend tambem atualizado (migration 106 + ALTER COLUMN DEFAULT).
//
// 19/10/2026 (decisao do Caio): caixa_enabled volta a default=false, junto
// de require_seller/require_customer. Controle de caixa (abrir antes de
// vender), vendedor e cliente obrigatorios eram o "bloqueador gigantesco da
// primeira venda" da conta nova. O backend nasce igual (migration 399). Vale
// so para quem NUNCA salvou: o default so aparece enquanto o GET nao
// respondeu (ou falhou) e o app salva o objeto inteiro que leu — com true
// aqui, um save nessa janela gravaria o caixa ligado sem ninguem escolher.
// Quem salvou caixa_enabled=true no servidor continua com true (o valor do
// servidor sempre vence este default). crediario_enabled segue true.
//
// 12/05/2026: cash_tender_modal_enabled — default true. Controla se o
// modal de troco em venda dinheiro abre (single ou parcela dinheiro
// em split-mode). Operador batuto/fila grande pode desligar.
// ============================================================

const DEFAULT_SETTINGS: PdvSettings = {
  require_customer:          false,
  require_seller:            false,
  caixa_enabled:             false,
  crediario_enabled:         true,
  cash_tender_modal_enabled: true,
};

// Lojas cuja migração do vale-troca já foi disparada nesta sessão: o hook roda
// em várias telas ao mesmo tempo e o PUT sai uma vez só.
const migracaoDoValeIniciada = new Set<string>();

/** Só para testes: esquece quais lojas já tentaram migrar nesta sessão. */
export function _resetMigracaoDoVale() { migracaoDoValeIniciada.clear(); }

export function usePdvSettings() {
  const { token, company } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["pdv-settings", company?.id],
    queryFn: function() {
      if (!company?.id) throw new Error("no company");
      return pdvSettingsApi.get(company.id);
    },
    enabled: !!token && !!company?.id,
    staleTime: Infinity,
    retry: 1,
  });

  // 13/10/2026: o "vale-troca desligado" que a loja guardou só no navegador
  // (app#1056) sobe para pdv_settings.vale_troca_enabled uma vez; depois o
  // navegador é ignorado (utils/valeTroca.ts). Falhou (ex.: sem permissão de
  // dono): enquanto não migra, o "0" do navegador continua valendo.
  const loaded = data?.settings as PdvSettings | undefined;
  const companyId = company?.id;
  useEffect(function() {
    if (!loaded || !companyId || migracaoDoValeIniciada.has(companyId)) return;
    if (!valeTrocaPrecisaMigrar(companyId, loaded)) return;
    migracaoDoValeIniciada.add(companyId);
    // O objeto inteiro, como o PdvSettingsCard grava: não depende de o PUT fazer merge.
    pdvSettingsApi.save(companyId, Object.assign({}, loaded, { vale_troca_enabled: false }))
      .then(function() {
        marcarValeTrocaMigrado(companyId);
        qc.invalidateQueries({ queryKey: ["pdv-settings", companyId] });
      })
      .catch(function() { /* tenta de novo na próxima sessão */ });
  }, [loaded, companyId, qc]);

  return {
    settings: loaded || DEFAULT_SETTINGS,
    isLoading: isLoading,
    error: error as Error | null,
    invalidate: function() { qc.invalidateQueries({ queryKey: ["pdv-settings", company?.id] }); },
  };
}

// ============================================================
// validateSaleAgainstSettings — verifica se a venda atende as
// politicas configuradas (require_customer/require_seller).
//
// Usado pelo PDV antes de chamar finalizeSale(). Retorna lista
// de campos faltando em portugues pra mostrar mensagem amigavel.
//
// Considera vendedora preenchida se sellerId OU sellerName livre
// estiver setado (alguns clientes preenchem manual sem cadastrar
// funcionario formal).
// ============================================================

export type SaleContext = {
  customerId?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
};

export type SaleValidation = {
  ok: boolean;
  missing: string[]; // ex: ["cliente", "vendedora"]
};

export function validateSaleAgainstSettings(
  settings: PdvSettings | null | undefined,
  ctx: SaleContext
): SaleValidation {
  const missing: string[] = [];
  const s = settings || DEFAULT_SETTINGS;

  if (s.require_customer && !ctx.customerId) {
    missing.push("cliente");
  }
  if (s.require_seller && !ctx.sellerId && !(ctx.sellerName || "").trim()) {
    missing.push("vendedora");
  }

  return { ok: missing.length === 0, missing: missing };
}
