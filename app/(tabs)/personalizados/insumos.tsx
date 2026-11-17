// ============================================================
// AURA. — Personalizados › Insumos (p-178)
//
// Os insumos e as fichas técnicas (composição) dentro do shell Negócio. Mod
// próprio: personalizados.insumos (regra 3 do CLAUDE.md), item "Insumos" da
// seção Personalizados do menu (mockup p-131, aprovado em 16/11/2026).
//
// A TELA É A DO STUDIO, sem cópia: components/studio/TelaDeInsumos.tsx, a
// mesma que o /studio monta em /studio/insumos, dentro de <TemaDoNegocio>.
// Muda só o destino do toque numa ficha: no /studio ele vai ao produto em
// /studio/estoque; aqui a ficha técnica (StudioFichaTecnicaPanel, o editor
// canônico) abre por cima da tela, e o "Catálogo" é o Estoque.
//
// Quem chega aqui, na ordem (o mesmo caminho da Produção, p-129):
//   1. CONSOLIDADO (multi-CNPJ, "Todas as empresas"): insumo e ficha são de
//      uma loja (mutação só por CNPJ). A tela mostra "Escolha uma loja"
//      (RequireCompanyScope) e volta para cá já com a loja escolhida.
//   2. PLANO E PERMISSÃO: sem a chave personalizados.insumos visível
//      (Essencial sem override, ou membro sem personalizados.access) a tela
//      não existe para a pessoa: volta para o Painel. Sem cadeado e sem
//      convite de upgrade.
//   3. FRENTE LIGADA: trava PERSONALIZADOS_LIBERADO, studio_enabled e
//      empresa sem vertical_active (utils/personalizados.ts). Com a trava em
//      false (hoje) TODO MUNDO volta para o Painel.
//
// O plano vem do JWT e fica velho (armadilha 1 do CLAUDE.md): a tela refaz
// /auth/me ao montar, antes de decidir.
// ============================================================
import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useColors } from "@/constants/colors";
import { RequireCompanyScope } from "@/components/RequireCompanyScope";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { TemaDoNegocio } from "@/components/personalizados/TemaDoNegocio";
import { TelaDeInsumos } from "@/components/studio/TelaDeInsumos";
import { ComposicaoEmTelaCheia } from "@/components/personalizados/ComposicaoEmTelaCheia";
import { insumosNoNegocioLigados, TEXTOS_DOS_INSUMOS_NO_NEGOCIO } from "@/components/personalizados/regrasDosInsumos";
import type { CompositionSummary } from "@/services/studioApi";

export default function PersonalizadosInsumos() {
  return (
    <RequireCompanyScope
      context="personalizados"
      actionLabel="cuidar dos insumos"
      titulo="Escolha uma loja"
      descricao="Os insumos e as fichas técnicas são de cada loja. Escolha a loja para ver e editar."
      rotuloDoBotao="Escolher loja"
    >
      <Tela />
    </RequireCompanyScope>
  );
}

type FichaAberta = { ficha: CompositionSummary; recarregar: () => void };

function Tela() {
  const C = useColors();
  const router = useRouter();
  const company = useAuthStore((st) => st.company);
  const consolidado = useAuthStore((st) => !!st.consolidatedView);
  const refreshMe = useAuthStore((st) => st.refreshMe);
  const visiveis = useVisibleModules();
  const prontos = useVisibleModulesProntos();
  const { settings, isLoading } = usePdvSettings();
  const [aberta, setAberta] = useState<FichaAberta | null>(null);

  // Armadilha 1: plano e module_overrides do JWT não se revalidam sozinhos.
  useEffect(() => {
    if (typeof refreshMe === "function") refreshMe().catch(() => {});
  }, [refreshMe]);

  if (!company?.id || !prontos || isLoading) {
    return (
      <View style={st.espera} testID="personalizados-insumos-esperando">
        <Text style={{ color: C.ink3, fontSize: 13 }}>Carregando…</Text>
      </View>
    );
  }

  const ligada = insumosNoNegocioLigados({
    settings,
    verticalActive: (company as any).vertical_active,
    visiveis,
    consolidado,
  });
  if (!ligada) {
    return <Redirect href="/" />;
  }

  const fechar = () => {
    if (aberta) aberta.recarregar();
    setAberta(null);
  };

  return (
    <View style={st.tela} testID="personalizados-insumos">
      <TemaDoNegocio>
        <TelaDeInsumos
          destinos={{
            abrirFicha: (ficha, recarregar) => setAberta({ ficha, recarregar }),
            irParaOCatalogo: () => router.push("/estoque" as any),
            textos: TEXTOS_DOS_INSUMOS_NO_NEGOCIO,
          }}
        />
      </TemaDoNegocio>
      {aberta ? (
        <ComposicaoEmTelaCheia
          companyId={String(company.id)}
          produtoId={String(aberta.ficha.product_id)}
          nome={aberta.ficha.product_name}
          preco={Number(aberta.ficha.product_price) || 0}
          onFechar={fechar}
          // "Ir pra Insumos" dentro da ficha: os insumos estão logo embaixo.
          aoIrParaInsumos={fechar}
        />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  tela: { flex: 1 },
  espera: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 320 },
});
