// ============================================================
// AURA. — Página "Black Friday" (13/10/2026)
//
// A casa das funções da temporada de fim de ano. Decisão do Caio (13/10):
// "O que vai faltar" NÃO é aba do Estoque — é a primeira seção desta
// página, que fica no menu logo abaixo de Painel e existe só de 13/10/2026
// a 02/02/2027 (constants/blackFriday.ts).
//
// Seções, nesta ordem (quais aparecem: secoes.ts; o número no cartão é a
// posição entre as que aparecem):
//   Promoção em lote        (PromocaoEmLote, De/Por, p-86 de 08/11/2026):
//      só com o backend novo (rota de promoções) e fora do perfil consulta;
//      no consolidado, o cartão "escolha a empresa" (EscolherEmpresaParaPromocao)
//   Crediário para janeiro  (CrediarioParaJaneiro, p-91 de 09/11/2026):
//      só com o crediário (módulo + Políticas do Caixa) e o backend do resumo
//   O que vai faltar        (OQueVaiFaltar)
//   Assento de temporada    (AssentoTemporadaCard, o mesmo de Configurações)
//   Vale-troca no cupom     (espelho do toggle de Políticas do Caixa)
//   Placar do dia           (PlacarDoDiaCard, app#1060)
//
// Seção que a loja não tem some; nada de cartão bloqueado ou isca.
// O plano decide seções: a página relê /auth/me ao abrir (plano velho no JWT).
// Mockup: docs/mockups/black-friday.html.
// ============================================================
import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/colors";
import { ScreenHero } from "@/components/ScreenHero";
import { useAuthStore } from "@/stores/auth";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { pluralize } from "@/utils/plural";
import { BLACK_FRIDAY_ATE } from "@/constants/blackFriday";
import { dataBR } from "@/utils/rupturaEstoque";
import { AssentoTemporadaCard } from "@/components/screens/configuracoes/AssentoTemporadaCard";
import { OQueVaiFaltar } from "./OQueVaiFaltar";
import { SecaoCard } from "./SecaoCard";
import { ValeTrocaEspelho } from "./ValeTrocaEspelho";
import { secoesDaPagina } from "./secoes";
import { PlacarDoDiaCard } from "./PlacarDoDiaCard";
import { PromocaoEmLote } from "./dePor/PromocaoEmLote";
import { useEstoqueConsulta } from "@/hooks/useEstoqueConsulta";
import { usePromocoesDePor } from "@/hooks/usePromocoesDePor";
import { useResumoVencimento } from "@/hooks/useResumoVencimento";
import { hojeBrt } from "@/components/screens/configuracoes/assentoTemporada";
import { EscolherEmpresaParaPromocao } from "./EscolherEmpresaParaPromocao";
import { CrediarioParaJaneiro } from "./crediarioJaneiro/CrediarioParaJaneiro";
import { faseCrediarioJaneiro, periodoDoJaneiro } from "./crediarioJaneiro/regrasCrediarioJaneiro";

export function PaginaBlackFriday() {
  const visible = useVisibleModules();
  const { company, consolidatedView, availableCompanies, isStaff, refreshMe } = useAuthStore() as any;
  const consolidado = !!consolidatedView;
  const hoje = hojeBrt();

  // Plano velho no JWT (armadilha 1 do CLAUDE.md): relê /auth/me ao abrir.
  useEffect(() => {
    if (typeof refreshMe === "function") Promise.resolve(refreshMe()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // De/Por: perfil Estoque só consulta não vê; backend sem a rota (404) = some.
  // No consolidado não chama as promoções (a seção pede a empresa).
  const { consulta, carregando: consultaCarregando } = useEstoqueConsulta();
  const promocoes = usePromocoesDePor(company?.id, !consolidado && visible.has("estoque") && !consulta && !consultaCarregando);

  // Crediário para janeiro: só nov–jan, com o módulo; 403/404 do resumo = some.
  const faseCrediario = faseCrediarioJaneiro(hoje);
  const resumoJaneiro = useResumoVencimento({
    companyId: company?.id,
    consolidado,
    ligado: visible.has("crediario") && faseCrediario !== "fora",
    periodo: periodoDoJaneiro(hoje),
  });

  const secoes = secoesDaPagina({
    visible,
    consolidatedView: consolidado,
    hoje,
    dePorDisponivel: promocoes.disponivel,
    estoqueSoConsulta: consulta || consultaCarregando,
    crediarioDisponivel: resumoJaneiro.disponivel,
  });
  const tem = (chave: string) => secoes.some((x) => x.chave === chave);
  const numero = (chave: string) => secoes.findIndex((x) => x.chave === chave) + 1;
  const textos = (chave: string) => secoes.find((x) => x.chave === chave)!;

  const badge = consolidatedView
    ? "Consolidado · " + pluralize((availableCompanies || []).length || 1, "empresa")
    : undefined;
  const isOwner = ((company && company.member_role) || "owner") === "owner" || !!isStaff;

  return (
    <View testID="pagina-black-friday">
      <ScreenHero
        eyebrow="Temporada"
        title="Black Friday"
        badge={badge}
        subtitle={"Tudo da temporada num lugar só, até " + dataBR(BLACK_FRIDAY_ATE) + "."}
      />

      {secoes.length === 0 && (
        <View style={s.vazio} testID="black-friday-sem-secoes">
          <Text style={s.vazioTxt}>Nada da temporada para a sua conta por enquanto.</Text>
        </View>
      )}

      {tem("de_por") && (
        <SecaoCard testID="bf-secao-de-por" numero={numero("de_por")} titulo={textos("de_por").titulo} porQueAgora={textos("de_por").porQueAgora}>
          {textos("de_por").variante === "escolher_empresa"
            ? <EscolherEmpresaParaPromocao />
            : <PromocaoEmLote companyId={company?.id} consolidado={consolidado} dados={promocoes} />}
        </SecaoCard>
      )}

      {tem("crediario_janeiro") && (
        <SecaoCard
          testID="bf-secao-crediario-janeiro"
          numero={numero("crediario_janeiro")}
          titulo={textos("crediario_janeiro").titulo}
          porQueAgora={textos("crediario_janeiro").porQueAgora}
        >
          <CrediarioParaJaneiro
            companyId={company?.id}
            consolidado={consolidado}
            fase={faseCrediario}
            hojeIso={hoje}
            resumo={resumoJaneiro}
          />
        </SecaoCard>
      )}

      {tem("ruptura") && (
        <SecaoCard testID="bf-secao-ruptura" numero={numero("ruptura")} titulo={textos("ruptura").titulo} porQueAgora={textos("ruptura").porQueAgora}>
          <OQueVaiFaltar />
        </SecaoCard>
      )}

      {tem("assento") && company?.id && (
        <SecaoCard testID="bf-secao-assento" numero={numero("assento")} titulo={textos("assento").titulo} porQueAgora={textos("assento").porQueAgora}>
          <AssentoTemporadaCard companyId={company.id} plano={company.plan} isOwner={isOwner} semMoldura />
        </SecaoCard>
      )}

      {tem("vale_troca") && (
        <SecaoCard testID="bf-secao-vale-troca" numero={numero("vale_troca")} titulo={textos("vale_troca").titulo} porQueAgora={textos("vale_troca").porQueAgora}>
          <ValeTrocaEspelho companyId={company?.id} />
        </SecaoCard>
      )}

      {tem("placar") && company?.id && (
        <SecaoCard testID="bf-secao-placar" numero={numero("placar")} titulo={textos("placar").titulo} porQueAgora={textos("placar").porQueAgora}>
          <PlacarDoDiaCard companyId={company.id} isOwner={isOwner} />
        </SecaoCard>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  vazio: { padding: 28, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, alignItems: "center" },
  vazioTxt: { fontSize: 13.5, color: Colors.ink3, textAlign: "center" },
});
