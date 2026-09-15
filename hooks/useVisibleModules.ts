import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { permissionsQueryKey } from "@/utils/permissionsQueryKey";

var MODULE_PLAN_MAP: Record<string, string> = {
  painel: 'essencial', financeiro: 'essencial', nfe: 'essencial',
  contabilidade: 'essencial', suporte: 'essencial', pdv: 'essencial',
  estoque: 'essencial', configuracoes: 'essencial',
  // 11/05/2026 -- Clientes basico movido pro Essencial (gate de plano
  // removido em private.js do backend). Limite 1000 registros; CRM
  // avancado (ranking, retencao, aniversariantes, crediario) continua
  // gateado por Negocio+ no proprio modulo Clientes via tabs.
  clientes: 'essencial',
  // 12/05/2026 -- PLAN-02: Equipe basica (CRUD de funcionarios/vendedores)
  // movida pro Essencial. Limite 3 ativos. Folha de pagamento de fato
  // (salario, holerite, comissao, ranking) continua Negocio+ via UpgradeCard
  // dentro do proprio modulo.
  folha: 'essencial',
  // 15/05/2026 -- vendas e crediario ganham modulos proprios, separados do pdv.
  // Antes herdavam visibilidade de pdv (quem via Caixa via Vendas automaticamente).
  // Agora cada um tem sua chave de permissao independente.
  vendas: 'essencial',
  // 14/09/2026 -- Ordem de Servico ganha modulo proprio. Antes o item /os do
  // NAV usava mod "pdv" emprestado. Mesmo plano minimo do pdv (essencial) pra
  // ninguem ganhar nem perder acesso; o opt-in continua sendo o toggle
  // pdv_settings.os_enabled (filtrado no _layout, nao aqui). O backend
  // (services/modules.js) ainda NAO conhece a chave: PUT de override com "os"
  // volta 400, entao ela fica fora do catalogo do ClientsAdmin por ora.
  os: 'essencial',
  crediario: 'negocio',
  agendamento: 'negocio',
  canal: 'negocio', whatsapp: 'negocio',
  agentes: 'expansao',
  // 30/08/2026 -- Hub Social (Aurinha): secao "Atendimento" dentro da aba
  // Agentes, com chave PROPRIA (regra da casa) para poder ser vendida como
  // add-on via module_overrides independente do resto da aba. O gate
  // comercial fino e hub_agent_settings.enabled no backend.
  hub_social: 'expansao',
  // 2026-05-21 (F2 do polish pre-Fase 7): vertical Food entra com gates
  // distintos por sub-modulo. Mesas/Pedidos/Cardapio/KDS sao basicos do
  // restaurante (Negocio). Delivery (rotas, motoboys, frete) e NFC-e
  // avancada (impressora termica, contingencia) ficam no Expansao.
  // Configuracoes (toggles, integracoes) acompanha o Essencial pra que
  // qualquer plano com food consiga ligar/desligar features no PdvSettings.
  'food.mesas':    'negocio',
  'food.pedidos':  'negocio',
  'food.cardapio': 'negocio',
  'food.kds':      'negocio',
  'food.delivery': 'expansao',
  'food.nfce':     'expansao',
  'food.config':   'essencial',
  // 2026-07-18 (F1 Aura Dojo): shell completo do dojo (grupo (dojo) em
  // /karate — Painel/Praticantes/Solicitacoes/Eventos/Anuidade/
  // Certificados/Configuracoes). Registro de FUNDACAO: o shell AINDA NAO
  // consome estas chaves (TODO F2: filtrar DOJO_NAV em
  // components/karate/DojoShell.tsx por useVisibleModules); o gate real
  // de plano/cobranca do dojo (R$140/mes) fica pra F3c. Todas 'essencial'
  // por ora — regra da casa: toda tela nova entra no mapa.
  'karate_dojo.praticantes':  'essencial',
  'karate_dojo.financeiro':   'essencial',
  'karate_dojo.eventos':      'essencial',
  'karate_dojo.certificados': 'essencial',
  'karate_dojo.config':       'essencial',
  // 15/09/2026 -- semi-vertical Otica sobre o shell Negocio. Sem shell
  // proprio: os itens entram no NAV do varejo e o opt-in e o toggle
  // pdv_settings.otica_enabled (filtrado no _layout, como a OS). Laboratorio
  // e Receitas sao Negocio (a otica vive de crediario e WhatsApp, que ja
  // sao Negocio); Config e Essencial pra qualquer plano conseguir cadastrar
  // laboratorio e ligar/desligar. Cada tela com chave PROPRIA (regra 3).
  'otica.laboratorio': 'negocio',
  'otica.receitas':    'negocio',
  'otica.config':      'essencial',
};
var PLAN_LEVEL: Record<string, number> = { essencial: 0, negocio: 1, expansao: 2 };

// Mapeamento: chave de permissao do toggle -> modulos do sidebar
// REGRA: toda nova tela/modulo deve ter entrada aqui E em MODULE_PLAN_MAP.
var PERM_TO_MODULES: Record<string, string[]> = {
  painel:        ['painel'],
  // 14/09/2026 -- "os" entra na permissao pdv: e exatamente quem via a OS
  // quando ela usava mod "pdv". Permissao granular propria fica pra quando o
  // produto pedir (e exige chave nova em MembersSection + backend).
  pdv:           ['pdv', 'os'],
  // 15/05/2026 -- chave "vendas" controla /vendas + /crediario (nao herda mais do pdv).
  vendas:        ['vendas', 'crediario'],
  estoque:       ['estoque'],
  clientes:      ['clientes', 'canal'],
  financeiro:    ['financeiro', 'nfe'],
  relatorios:    ['contabilidade', 'suporte'],
  folha:         ['folha', 'agendamento'],
  configuracoes: ['configuracoes'],
  // 15/05/2026 -- agentes adicionado; sem isso nao-owners nunca veiam mesmo com plano Expansao.
  // 30/08/2026 -- hub_social entra na mesma permissao: quem atende (agentes)
  // ve o hub. Granularidade propria fica pra quando o produto pedir.
  agentes:       ['agentes', 'hub_social'],
  // 2026-05-21 (F2 do polish pre-Fase 7): nao existem permissions food
  // granulares no banco ainda — toda permission food cai numa chave umbrella
  // "food.access" que destrava os sub-modulos juntos. Quando o produto
  // pedir granularidade (ex: garcom so ve Mesas), basta adicionar chaves
  // novas aqui. Owners sempre veem (filtro de permission so se aplica a
  // membros).
  'food.access': ['food.mesas','food.pedidos','food.cardapio','food.kds','food.delivery','food.nfce','food.config'],
  // 2026-07-18 (F1 Aura Dojo): mesmo padrao do food.access — sem
  // permissions granulares de dojo no banco ainda, a umbrella
  // "karate_dojo.access" destrava as areas juntas. Quando precisar de
  // granularidade (ex.: instrutor so ve Praticantes), adicionar chaves
  // especificas aqui. O shell do dojo consome a partir da F2.
  'karate_dojo.access': ['karate_dojo.praticantes','karate_dojo.financeiro','karate_dojo.eventos','karate_dojo.certificados','karate_dojo.config'],
  // 15/09/2026 (Otica): mesma umbrella do food.access. Quando o produto pedir
  // granularidade (ex.: montador so ve o Laboratorio), separar as chaves.
  'otica.access': ['otica.laboratorio','otica.receitas','otica.config'],
};

// Fallback TRANSITORIO de override: quando o modulo nao tem override proprio,
// um `false` explicito no modulo de origem ainda o esconde.
//
// 14/09/2026 -- "os" saiu de dentro do "pdv". Uma empresa com
// module_overrides.pdv === false (Caixa escondido pelo admin) tambem perdia a
// OS do menu; sem este fallback ela passaria a ve-la. So o `false` e herdado:
// `true` no pdv nao muda nada porque pdv e os tem o mesmo plano minimo.
// Remover quando o backend aceitar "os" em services/modules.js e as empresas
// com pdv:false tiverem os:false gravado.
var OVERRIDE_HIDE_FALLBACK: Record<string, string> = {
  os: 'pdv',
};

export function computeVisibleModules(
  plan: string | undefined | null,
  overrides: Record<string, boolean> | undefined | null,
  permData: any
): Set<string> {
  var ovs: Record<string, boolean> = overrides || {};
  var level = PLAN_LEVEL[plan || 'essencial'] ?? 0;
  var visible = new Set<string>();

  // Step 1: plan-based visibility
  for (var mod of Object.keys(MODULE_PLAN_MAP)) {
    var minPlan = MODULE_PLAN_MAP[mod];
    var minLevel = PLAN_LEVEL[minPlan] ?? 0;
    var ov = ovs[mod];
    if (ov === undefined && OVERRIDE_HIDE_FALLBACK[mod] && ovs[OVERRIDE_HIDE_FALLBACK[mod]] === false) continue;
    if (ov === false) continue;
    if (ov === true || level >= minLevel) visible.add(mod);
  }

  // Step 2: member permission filtering (non-owner only)
  if (permData && !permData.is_owner && permData.permissions) {
    var allowed = new Set<string>();

    // FIX: painel is NO LONGER hardcoded -- controlled by permissions.painel
    // If painel permission is not explicitly set, default to true for backward compat
    var painelPerm = permData.permissions.painel;
    if (painelPerm === undefined || painelPerm === true) {
      allowed.add('painel');
    }

    for (var permKey of Object.keys(PERM_TO_MODULES)) {
      if (permKey === 'painel') continue; // already handled above
      if (permData.permissions[permKey]) {
        var modules = PERM_TO_MODULES[permKey];
        modules.forEach(function(m) { allowed.add(m); });
      }
    }

    // Intersection: modulo precisa passar no plano E na permissao
    for (var m of visible) {
      if (!allowed.has(m)) visible.delete(m);
    }
  }

  return visible;
}

export function useVisibleModules(): Set<string> {
  var { company, token, consolidatedView } = useAuthStore();

  var { data: permData } = useQuery({
    // Chave por empresa/modo: trocar de empresa busca de novo em vez de
    // reaproveitar o cache da anterior (ver utils/permissionsQueryKey.ts).
    queryKey: permissionsQueryKey(company?.id, consolidatedView),
    queryFn: function() { return request<any>('/auth/my-permissions'); },
    enabled: !!token,
    staleTime: 5 * 60000,
    retry: 1,
  });

  return useMemo(function() {
    return computeVisibleModules(company?.plan, (company as any)?.module_overrides, permData);
  }, [company?.plan, (company as any)?.module_overrides, permData]);
}

export { MODULE_PLAN_MAP, PLAN_LEVEL, PERM_TO_MODULES };
