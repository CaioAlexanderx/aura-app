// ============================================================
// AURA. — Personalizados › Detalhe do pedido (p-176)
//
// O pedido de peça personalizada dentro do shell Negócio. Mod próprio:
// personalizados.pedido (regra 3 do CLAUDE.md; a chave já estava nos mapas
// desde o p-128 e no catálogo do backend desde o backend#1038). É subtela da
// Produção: não tem item no menu. Chegam aqui o cartão da Fila, o "Ver
// pedido" dos Orçamentos 3D e o aviso do sino (backend#1051 aponta para
// /personalizados/pedido/<id> quando a loja está no Negócio).
//
// Sem cópia: a tela é o DetalheDoPedido do /studio (aprovação da arte, sinal
// e saldo, pagamento da loja online), envolvido pelo <TemaDoNegocio>. As
// props que a rota passa são todas opcionais; sem elas o /studio é o de
// sempre. A trilha volta para a Produção, a ficha de produção do Studio fica
// de fora (é do shell /studio) e, em "Aguardando personalização", entra o
// botão "Recolher a arte e o texto" com a folha. 25/11/2026: e o "Voltar
// para …" ao lado do avançar (voltarEtapa), que o /studio não tem. p-185:
// e o "Falta receber R$ X" do pedido de orçamento (faltaReceber).
//
// Quem chega aqui, na ordem (o mesmo caminho da Produção, p-129):
//   1. CONSOLIDADO (multi-CNPJ, "Todas as empresas"): uma loja por vez. A
//      tela mostra "Escolha uma loja" (RequireCompanyScope).
//   2. PLANO E PERMISSÃO: sem a chave personalizados.pedido visível
//      (Essencial sem override, ou membro sem personalizados.access) a tela
//      não existe para a pessoa: volta para o Painel. Sem cadeado e sem
//      convite de upgrade.
//   3. FRENTE LIGADA: trava PERSONALIZADOS_LIBERADO, pdv_settings.
//      studio_enabled e empresa sem vertical_active (utils/personalizados.ts).
//
// O plano vem do JWT e fica velho (armadilha 1 do CLAUDE.md): a tela refaz
// /auth/me ao montar, antes de decidir.
// ============================================================
import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useColors } from "@/constants/colors";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { personalizadosAtivo } from "@/utils/personalizados";
import { TemaDoNegocio } from "@/components/personalizados/TemaDoNegocio";
import { BotaoRecolher } from "@/components/personalizados/FolhaDeRecolher";
import { DetalheDoPedido } from "@/components/studio/DetalheDoPedido";

const MOD_DA_TELA = "personalizados.pedido";

const TRILHA_DO_NEGOCIO = (numero: string) => [
  { label: "Personalizados" },
  { label: "Produção", href: "/personalizados/producao" },
  { label: numero },
];

export default function PersonalizadosPedido() {
  return (
    <RequireCompanyScope
      context="personalizados"
      actionLabel="ver o pedido"
      titulo="Escolha uma loja"
      descricao="O pedido é de uma loja só. Escolha a loja para abrir."
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

  // Armadilha 1: plano e module_overrides do JWT não se revalidam sozinhos.
  useEffect(() => {
    if (typeof refreshMe === "function") refreshMe().catch(() => {});
  }, [refreshMe]);

  if (!company?.id || !prontos || isLoading) {
    return (
      <View style={st.espera} testID="personalizados-pedido-esperando">
        <Text style={{ color: C.ink3, fontSize: 13 }}>Carregando…</Text>
      </View>
    );
  }

  const ligada = personalizadosAtivo(settings, (company as any).vertical_active);
  if (!visiveis.has(MOD_DA_TELA) || !ligada) {
    return <Redirect href="/" />;
  }

  const companyId = company.id;
  return (
    <View style={st.tela} testID="personalizados-pedido">
      <TemaDoNegocio>
        <DetalheDoPedido
          trilha={TRILHA_DO_NEGOCIO}
          eyebrow="PERSONALIZADOS"
          rotaDaFicha={null}
          voltarEtapa
          faltaReceber
          semArcos
          acoesDaEtapa={({ order, status, recarregar }) =>
            status === "awaiting_customization" ? (
              <BotaoRecolher companyId={companyId} pedidoId={order.id} onSalvo={() => recarregar()} />
            ) : null
          }
        />
      </TemaDoNegocio>
    </View>
  );
}

const st = StyleSheet.create({
  tela: { flex: 1 },
  espera: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 320 },
});
