// ============================================================
// AURA. — Cadastro do item · Ficha técnica (p-178, 17/11/2026)
//
// A entrada do Estoque do Negócio para a ficha técnica (composição) do
// produto: os insumos que cada unidade consome. No /studio a ficha mora numa
// aba do editor do produto; no Negócio o produto é editado aqui, então a
// ficha de um produto que ainda não tem nenhuma nasce por este cartão. A
// lista das fichas que já existem fica em /personalizados/insumos.
//
// O EDITOR É O DO STUDIO, sem cópia: StudioFichaTecnicaPanel, aberto em tela
// cheia por cima do cadastro (ComposicaoEmTelaCheia), como a Personalização
// do p-173. O cadastro fica aberto embaixo, com o que a pessoa digitou.
//
// Quem vê: components/personalizados/regrasDosInsumos.ts (frente ligada,
// módulo personalizados.insumos, fora do consolidado). O ItemFormModal só
// monta este componente com a frente ligada na empresa; com a trava
// PERSONALIZADOS_LIBERADO em false ele nem monta, e o cadastro é o de hoje.
// ============================================================
import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { insumosNoNegocioLigados, TEXTOS_DA_COMPOSICAO } from "@/components/personalizados/regrasDosInsumos";
import { situacaoDoItem } from "@/components/personalizados/regrasDaFicha";
import { Nota, Secao, s as ui } from "./ui";

// O painel do Studio só é avaliado quando a ficha abre. Quem nunca abre
// (toda loja sem a frente) não roda nada do Studio no cadastro do item.
function carregarComposicao() {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { ComposicaoEmTelaCheia } = require("@/components/personalizados/ComposicaoEmTelaCheia") as typeof import("@/components/personalizados/ComposicaoEmTelaCheia");
  /* eslint-enable @typescript-eslint/no-var-requires */
  return ComposicaoEmTelaCheia;
}

type Props = {
  produtoId: string | null | undefined;
  nome: string;
  preco: number;
  isProduto: boolean;
  /** products.company_id do item (multi-CNPJ: item do grupo pode ser de outra loja). */
  ownerCompanyId?: string | null;
  /** A ficha está aberta por cima do cadastro (o ItemFormModal guarda, por causa do Escape). */
  aberta: boolean;
  onAbrir: () => void;
  onFechar: () => void;
};

export function SecaoComposicao(p: Props) {
  const { company, consolidatedView, refreshMe } = useAuthStore() as any;
  const visiveis = useVisibleModules();
  const prontos = useVisibleModulesProntos();
  const { settings } = usePdvSettings();
  const router = useRouter();
  const qc = useQueryClient();

  // Armadilha 1 do CLAUDE.md: plano e module_overrides do JWT ficam velhos.
  // Só chega aqui quem tem a frente ligada.
  useEffect(() => {
    if (typeof refreshMe === "function") refreshMe().catch(() => {});
  }, [refreshMe, company?.id]);

  if (!prontos) return null;
  const ligada = insumosNoNegocioLigados({
    settings,
    verticalActive: company?.vertical_active,
    visiveis,
    consolidado: !!consolidatedView,
  });
  if (!ligada) return null;

  const situacao = situacaoDoItem({
    produtoId: p.produtoId,
    isProduto: p.isProduto,
    companyId: company?.id,
    ownerCompanyId: p.ownerCompanyId,
  });
  if (situacao === "fora") return null;

  // O custo da ficha entra na margem que o Estoque mostra.
  const aoSalvar = () => { if (company?.id) qc.invalidateQueries({ queryKey: ["products", company.id] }); };
  const Composicao = situacao === "editar" && p.aberta && company?.id ? carregarComposicao() : null;

  return (
    <View testID="secao-composicao">
      <Secao icon="clipboard-list" titulo={TEXTOS_DA_COMPOSICAO.titulo}>
        {situacao === "do-grupo" ? (
          <Nota icon="info">
            <Text style={ui.notaTxt}>{TEXTOS_DA_COMPOSICAO.doGrupo}</Text>
          </Nota>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={ui.notaTxt}>{TEXTOS_DA_COMPOSICAO.explicacao}</Text>
            <Pressable
              testID="abrir-composicao"
              onPress={p.onAbrir}
              accessibilityRole="button"
              accessibilityLabel={TEXTOS_DA_COMPOSICAO.botao}
              style={st.abrir}
            >
              <Icon name="clipboard-list" size={14} color={Colors.violet3} />
              <Text style={st.abrirTxt}>{TEXTOS_DA_COMPOSICAO.botao}</Text>
            </Pressable>
          </View>
        )}
      </Secao>

      {Composicao ? (
        <Composicao
          companyId={String(company.id)}
          produtoId={String(p.produtoId)}
          nome={p.nome}
          preco={p.preco}
          onSalvo={aoSalvar}
          onFechar={p.onFechar}
          aoIrParaInsumos={() => { p.onFechar(); router.push("/personalizados/insumos" as any); }}
        />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  abrir: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: 44, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
  },
  abrirTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
});
