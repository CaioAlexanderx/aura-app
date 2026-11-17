// ============================================================
// AURA. — Personalizados › Orçamentos 3D (p-175)
//
// Os orçamentos do Studio dentro do shell Negócio: a lista, o modal do
// orçamento com a peça em 3D, o vídeo para o WhatsApp e o "Aprovar". Mod
// próprio: personalizados.orcamentos (regra 3 do CLAUDE.md). No menu o item
// é "Orçamentos 3D" (decisão D8, mockup p-131). Não confundir com
// matcon.orcamentos, que é outra tela.
//
// Sem cópia: a tela é o ListaDeOrcamentos do /studio, com o OrcamentoModal
// por cima, envolvido pelo <TemaDoNegocio> (cores do Negócio). As props que
// a rota passa são todas opcionais; sem elas o /studio continua igual.
//
// Quem chega aqui, na ordem (o mesmo caminho da Produção, p-129):
//   1. CONSOLIDADO (multi-CNPJ, "Todas as empresas"): com a trava ligada, os
//      orçamentos de todas as lojas, só para ler (p-187,
//      OrcamentosConsolidados), com "Abrir na loja" em cada um. Com a trava
//      desligada, como antes: "Escolha uma loja" (RequireCompanyScope).
//   2. PLANO E PERMISSÃO: sem a chave personalizados.orcamentos visível
//      (Essencial sem override, ou membro sem personalizados.access) a tela
//      não existe para a pessoa: volta para o Painel. Sem cadeado e sem
//      convite de upgrade.
//   3. FRENTE LIGADA: trava PERSONALIZADOS_LIBERADO, pdv_settings.
//      studio_enabled e empresa sem vertical_active (utils/personalizados.ts).
//      Quem está no shell /studio continua lá.
//
// O plano vem do JWT e fica velho (armadilha 1 do CLAUDE.md): a tela refaz
// /auth/me ao montar, antes de decidir.
//
// Aprovar: o mesmo POST /studio/quotes/:qid/aprovar do /studio. Lançar no
// Financeiro e virar venda ficam no p-185.
//
// ?orcamento=<id> (p-187): o "Abrir na loja" do consolidado troca de
// empresa e volta para cá; a lista abre já com o modal desse orçamento.
// ============================================================
import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useColors } from "@/constants/colors";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { personalizadosAtivo, personalizadosLiberado } from "@/utils/personalizados";
import { TemaDoNegocio } from "@/components/personalizados/TemaDoNegocio";
import { ListaDeOrcamentos } from "@/components/studio/orcamentoModal/ListaDeOrcamentos";
import { PARAM_DO_ORCAMENTO, idDaRota } from "@/components/personalizados/regrasDoConsolidado";
import { OrcamentosConsolidados } from "@/components/personalizados/consolidado/OrcamentosConsolidados";

const MOD_DA_TELA = "personalizados.orcamentos";

const CABECALHO_DOS_ORCAMENTOS_3D = {
  eyebrow: "PERSONALIZADOS",
  title: "Orçamentos 3D",
  subtitle: "Crie, envie pelo WhatsApp e acompanhe. Aprovado vira pedido na Produção.",
};

// "Ver pedido" do orçamento aprovado abre o detalhe do pedido no Negócio
// (personalizados.pedido, p-176).
const ROTA_DO_PEDIDO = (orderId: string) => `/personalizados/pedido/${orderId}`;

export default function PersonalizadosOrcamentos() {
  const consolidado = useAuthStore((st) => st.consolidatedView);
  // p-187: todas as lojas, só leitura. Atrás da mesma trava da frente.
  if (consolidado && personalizadosLiberado()) {
    return (
      <TemaDoNegocio>
        <OrcamentosConsolidados />
      </TemaDoNegocio>
    );
  }
  return (
    <RequireCompanyScope
      context="personalizados"
      actionLabel="ver os orçamentos 3D"
      titulo="Escolha uma loja"
      descricao="Os Orçamentos 3D mostram uma loja por vez. A visão de todas as lojas juntas, só para ler, vem numa entrega à parte."
      rotuloDoBotao="Escolher loja"
    >
      <Tela />
    </RequireCompanyScope>
  );
}

function Tela() {
  const C = useColors();
  const company = useAuthStore((st) => st.company);
  const refreshMe = useAuthStore((st) => st.refreshMe);
  const visiveis = useVisibleModules();
  const prontos = useVisibleModulesProntos();
  const { settings, isLoading } = usePdvSettings();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const abrirId = idDaRota(params?.[PARAM_DO_ORCAMENTO]) || undefined;

  // Armadilha 1: plano e module_overrides do JWT não se revalidam sozinhos.
  useEffect(() => {
    if (typeof refreshMe === "function") refreshMe().catch(() => {});
  }, [refreshMe]);

  if (!company?.id || !prontos || isLoading) {
    return (
      <View style={st.espera} testID="personalizados-orcamentos-esperando">
        <Text style={{ color: C.ink3, fontSize: 13 }}>Carregando…</Text>
      </View>
    );
  }

  const ligada = personalizadosAtivo(settings, (company as any).vertical_active);
  if (!visiveis.has(MOD_DA_TELA) || !ligada) {
    return <Redirect href="/" />;
  }

  return (
    <View style={st.tela} testID="personalizados-orcamentos">
      <TemaDoNegocio>
        <ListaDeOrcamentos
          abrirId={abrirId}
          cabecalho={CABECALHO_DOS_ORCAMENTOS_3D}
          semFlutuante
          rotaDaLista="/personalizados/orcamentos"
          rotaDoPedido={ROTA_DO_PEDIDO}
        />
      </TemaDoNegocio>
    </View>
  );
}

const st = StyleSheet.create({
  tela: { flex: 1 },
  espera: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 320 },
});
