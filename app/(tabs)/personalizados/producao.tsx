// ============================================================
// AURA. — Personalizados › Produção (p-129)
//
// A Fila de produção dos personalizados dentro do shell Negócio. Mod
// próprio: personalizados.producao (regra 3 do CLAUDE.md). Desenho: mockup
// p-131, aprovado em 16/11/2026 (no menu o item é "Produção"; o título da
// tela é "Fila de produção").
//
// Quem chega aqui, na ordem:
//   1. CONSOLIDADO (multi-CNPJ, "Todas as empresas"): com a trava ligada, a
//      Fila de todas as lojas, só para ler (p-187, ProducaoConsolidada), com
//      "Abrir na loja" em cada pedido. Com a trava desligada, como antes:
//      "Escolha uma loja" (RequireCompanyScope).
//   2. PLANO E PERMISSÃO: sem a chave personalizados.producao visível
//      (Essencial sem override, ou membro sem personalizados.access) a tela
//      não existe para a pessoa: volta para o Painel. Sem cadeado e sem
//      convite de upgrade.
//   3. FRENTE LIGADA: pdv_settings.studio_enabled e empresa sem
//      vertical_active (utils/personalizados.ts). Quem está no shell /studio
//      continua lá.
//
// O plano vem do JWT e fica velho (armadilha 1 do CLAUDE.md): a tela refaz
// /auth/me ao montar, antes de decidir.
//
// O cartão abre o detalhe do pedido em /personalizados/pedido/[id] (p-176).
//
// As cores: <TemaDoNegocio> entrega a paleta do Negócio aos componentes do
// Studio que o quadro reusa.
//
// ?pedido=<id> (p-187): o "Abrir na loja" do consolidado troca de empresa e
// volta para cá com o pedido; o quadro deixa o cartão em destaque.
// ============================================================
import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useColors } from "@/constants/colors";
import { ScreenHero } from "@/components/ScreenHero";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { personalizadosAtivo, personalizadosLiberado } from "@/utils/personalizados";
import { TemaDoNegocio } from "@/components/personalizados/TemaDoNegocio";
import { QuadroDeProducao } from "@/components/personalizados/QuadroDeProducao";
import { dataDeAtivacao } from "@/components/personalizados/regrasDaProducao";
import { PARAM_DO_PEDIDO, idDaRota } from "@/components/personalizados/regrasDoConsolidado";
import { ProducaoConsolidada } from "@/components/personalizados/consolidado/ProducaoConsolidada";

const MOD_DA_TELA = "personalizados.producao";

export default function PersonalizadosProducao() {
  const consolidado = useAuthStore((st) => st.consolidatedView);
  // p-187: todas as lojas, só leitura. Atrás da mesma trava da frente.
  if (consolidado && personalizadosLiberado()) {
    return (
      <TemaDoNegocio>
        <ProducaoConsolidada />
      </TemaDoNegocio>
    );
  }
  return (
    <RequireCompanyScope
      context="personalizados"
      actionLabel="ver a produção dos personalizados"
      titulo="Escolha uma loja"
      descricao="A Produção mostra uma loja por vez. A visão de todas as lojas juntas, só para ler, vem numa entrega à parte."
      rotuloDoBotao="Escolher loja"
    >
      <Tela />
    </RequireCompanyScope>
  );
}

function Tela() {
  const C = useColors();
  const router = useRouter();
  const company = useAuthStore((st) => st.company);
  const refreshMe = useAuthStore((st) => st.refreshMe);
  const visiveis = useVisibleModules();
  const prontos = useVisibleModulesProntos();
  const { settings, isLoading } = usePdvSettings();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const destacarId = idDaRota(params?.[PARAM_DO_PEDIDO]);

  // Armadilha 1: plano e module_overrides do JWT não se revalidam sozinhos.
  useEffect(() => {
    if (typeof refreshMe === "function") refreshMe().catch(() => {});
  }, [refreshMe]);

  if (!company?.id || !prontos || isLoading) {
    return (
      <View style={st.espera} testID="personalizados-producao-esperando">
        <Text style={{ color: C.ink3, fontSize: 13 }}>Carregando…</Text>
      </View>
    );
  }

  const ligada = personalizadosAtivo(settings, (company as any).vertical_active);
  if (!visiveis.has(MOD_DA_TELA) || !ligada) {
    return <Redirect href="/" />;
  }

  return (
    <View style={st.tela} testID="personalizados-producao">
      <ScreenHero eyebrow="Personalizados" title="Fila de produção" />
      <TemaDoNegocio>
        <QuadroDeProducao
          companyId={company.id}
          ativadoEm={dataDeAtivacao(settings)}
          destacarId={destacarId}
          onAbrirPedido={(id) => router.push(`/personalizados/pedido/${id}` as any)}
        />
      </TemaDoNegocio>
    </View>
  );
}

const st = StyleSheet.create({
  tela: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  espera: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 320 },
});
