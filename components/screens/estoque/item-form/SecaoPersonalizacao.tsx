// ============================================================
// AURA. — Cadastro do item · Personalização (p-173, 17/11/2026)
//
// A entrada do Estoque do Negócio para o editor de personalização do
// produto. Sem ela nenhuma empresa do Negócio cria um produto
// personalizável: o editor só existia dentro do shell /studio.
//
// O EDITOR É O DO STUDIO, sem cópia: StudioPersonalizacaoPanel, o editor
// canônico de customization_config (docs/studio/PERSONALIZACAO_CANONICA.md).
// Ele já recebe tudo por props (produto, empresa, fotos) e só lê as cores
// por useStudioTokens(); aqui ele fica dentro de <TemaDoNegocio>, o
// adaptador de tokens do p-128, e ganha a paleta e o tema do Negócio. O
// /studio continua montando o mesmo painel do mesmo jeito.
//
// Desenho: o mockup p-131 (seção 4, "Estoque · ficha do produto") mostra só
// que a ficha ganha a chave "Personalizável" e que o editor vem do Studio.
// Não desenha onde o editor abre dentro do cadastro do Negócio. Aqui, o
// mínimo consistente com o cadastro: um cartão fino na coluna das fotos e o
// editor em tela cheia por cima do cadastro (WebPortal), porque o painel tem
// prévia fixa de 380 px e não cabe numa coluna do modal. O cadastro fica
// aberto embaixo, com o que a pessoa já tinha digitado. A chave
// "Personalizável" é o interruptor que o próprio painel já tem no topo.
//
// Quem vê: components/personalizados/regrasDaFicha.ts. Este componente só
// é montado pelo ItemFormModal quando a frente está ligada na empresa
// (trava PERSONALIZADOS_LIBERADO + studio_enabled + sem vertical_active);
// com a trava em false ele nem monta, e o cadastro é o de hoje.
// ============================================================
import { useEffect } from "react";
import { View, Text, Pressable, ScrollView, Modal, StyleSheet, Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { Icon } from "@/components/Icon";
import { WebPortal } from "@/components/WebPortal";
import { useAuthStore } from "@/stores/auth";
import { usePdvSettings } from "@/hooks/usePdvSettings";
import { useVisibleModules, useVisibleModulesProntos } from "@/hooks/useVisibleModules";
import { useDigitalChannel } from "@/hooks/useDigitalChannel";
import { fichaNoEstoqueLigada, situacaoDoItem, TEXTOS_DA_FICHA } from "@/components/personalizados/regrasDaFicha";
import { Nota, Secao, s as ui } from "./ui";

// O painel do Studio (prévia 2D/3D, motor visual, galeria) só é avaliado
// quando o editor abre. Quem nunca abre (toda loja sem a frente, ou seja,
// todo mundo enquanto a trava estiver em false) não roda nada do Studio no
// cadastro do item.
function carregarEditorDoStudio() {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const Painel = require("@/components/studio/StudioPersonalizacaoPanel").default as typeof import("@/components/studio/StudioPersonalizacaoPanel").default;
  const { TemaDoNegocio } = require("@/components/personalizados/TemaDoNegocio") as typeof import("@/components/personalizados/TemaDoNegocio");
  const { fotosDoProduto } = require("@/components/studio/visualEngine/marcacaoDaFoto") as typeof import("@/components/studio/visualEngine/marcacaoDaFoto");
  /* eslint-enable @typescript-eslint/no-var-requires */
  return { Painel, TemaDoNegocio, fotosDoProduto };
}

type Props = {
  produtoId: string | null | undefined;
  nome: string;
  preco: number;
  isProduto: boolean;
  /** products.company_id do item (multi-CNPJ: item do grupo pode ser de outra loja). */
  ownerCompanyId?: string | null;
  /** URLs da galeria principal, capa primeiro (useGaleriaDoProduto). */
  fotos: string[];
  /** O editor está aberto por cima do cadastro (o ItemFormModal guarda, por causa do Escape). */
  aberta: boolean;
  onAbrir: () => void;
  onFechar: () => void;
};

export function SecaoPersonalizacao(p: Props) {
  const { company, consolidatedView, refreshMe } = useAuthStore() as any;
  const visiveis = useVisibleModules();
  const prontos = useVisibleModulesProntos();
  const { settings } = usePdvSettings();

  // Armadilha 1 do CLAUDE.md: plano e module_overrides do JWT ficam velhos.
  // Só chega aqui quem tem a frente ligada, então a ida extra ao servidor
  // não acontece para mais ninguém.
  useEffect(() => {
    if (typeof refreshMe === "function") refreshMe().catch(() => {});
  }, [refreshMe, company?.id]);

  if (!prontos) return null;
  const ligada = fichaNoEstoqueLigada({
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

  return (
    <View testID="secao-personalizacao">
      <Secao icon="sparkles" titulo={TEXTOS_DA_FICHA.titulo}>
        {situacao === "do-grupo" ? (
          <Nota icon="info">
            <Text style={ui.notaTxt}>{TEXTOS_DA_FICHA.doGrupo}</Text>
          </Nota>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={ui.notaTxt}>{TEXTOS_DA_FICHA.explicacao}</Text>
            <Pressable
              testID="abrir-personalizacao"
              onPress={p.onAbrir}
              accessibilityRole="button"
              accessibilityLabel={TEXTOS_DA_FICHA.botao}
              style={st.abrir}
            >
              <Icon name="sparkles" size={14} color={Colors.violet3} />
              <Text style={st.abrirTxt}>{TEXTOS_DA_FICHA.botao}</Text>
            </Pressable>
          </View>
        )}
      </Secao>

      {situacao === "editar" && p.aberta && company?.id ? (
        <EditorEmTelaCheia
          companyId={String(company.id)}
          produtoId={String(p.produtoId)}
          nome={p.nome}
          preco={p.preco}
          fotos={p.fotos}
          onFechar={p.onFechar}
        />
      ) : null}
    </View>
  );
}

// O painel do Studio, em tela cheia por cima do cadastro. Web: WebPortal
// (o z-index:0 do RNW prende overlay fixo dentro do shell). Nativo: Modal.
function EditorEmTelaCheia(p: {
  companyId: string;
  produtoId: string;
  nome: string;
  preco: number;
  fotos: string[];
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const { config: canal } = useDigitalChannel() as any;
  const { Painel, TemaDoNegocio, fotosDoProduto } = carregarEditorDoStudio();

  // A lista do Estoque e o Caixa leem is_personalizable do produto.
  const aoSalvar = () => { qc.invalidateQueries({ queryKey: ["products", p.companyId] }); };

  const tela = (
    <View style={st.tela} testID="editor-personalizacao">
      <View style={st.topo}>
        <Pressable
          testID="fechar-personalizacao"
          onPress={() => { aoSalvar(); p.onFechar(); }}
          accessibilityRole="button"
          accessibilityLabel={TEXTOS_DA_FICHA.voltar}
          style={st.voltar}
        >
          <Icon name="arrow-left" size={14} color={Colors.ink2} />
          <Text style={st.voltarTxt}>{TEXTOS_DA_FICHA.voltar}</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={st.titulo} numberOfLines={1}>{TEXTOS_DA_FICHA.titulo}</Text>
          <Text style={st.sub} numberOfLines={1}>{p.nome}</Text>
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.corpo} keyboardShouldPersistTaps="handled">
        <View style={st.largura}>
          <TemaDoNegocio>
            <Painel
              productId={p.produtoId}
              companyId={p.companyId}
              productName={p.nome}
              productPrice={p.preco}
              slug={canal?.slug || null}
              onSaved={aoSalvar}
              fotos={fotosDoProduto(p.fotos[0], p.fotos.slice(1))}
            />
          </TemaDoNegocio>
        </View>
      </ScrollView>
    </View>
  );

  if (Platform.OS === "web") return <WebPortal active>{tela}</WebPortal>;
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={p.onFechar}>
      {tela}
    </Modal>
  );
}

const st = StyleSheet.create({
  abrir: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: 44, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border2, backgroundColor: Colors.bg3,
  },
  abrirTxt: { fontSize: 13, fontWeight: "700", color: Colors.violet3 },
  tela: { flex: 1, backgroundColor: Colors.bg, ...(Platform.OS === "web" ? { height: "100%" as any } : null) },
  topo: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg2,
  },
  voltar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    minHeight: 44, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border2,
  },
  voltarTxt: { fontSize: 13, fontWeight: "600", color: Colors.ink2 },
  titulo: { fontSize: 16, fontWeight: "700", color: Colors.ink },
  sub: { fontSize: 12, color: Colors.ink3, marginTop: 2 },
  corpo: { padding: 16, paddingBottom: 48 },
  largura: { width: "100%", maxWidth: 1240, alignSelf: "center" },
});
