// ============================================================
// AURA. — Página "Black Friday" (13/10/2026)
//
// A casa das funções da temporada de fim de ano. Decisão do Caio (13/10):
// "O que vai faltar" NÃO é aba do Estoque — é a primeira seção desta
// página, que fica no menu logo abaixo de Painel e existe só de 13/10/2026
// a 02/02/2027 (constants/blackFriday.ts).
//
// Seções, nesta ordem (quais aparecem: secoes.ts):
//   1. O que vai faltar      (OQueVaiFaltar)
//   2. Assento de temporada  (AssentoTemporadaCard, o mesmo de Configurações)
//   3. Vale-troca no cupom   (espelho do toggle de Políticas do Caixa)
//   4. Placar do dia         (cartão de outra frente — slot abaixo)
//
// Seção que a loja não tem some; nada de cartão bloqueado ou isca.
// Mockup: docs/mockups/black-friday.html.
// ============================================================
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
// "Placar do dia": o cartão está sendo criado por outra frente
// (components/screens/blackfriday/PlacarDoDiaCard.tsx). Quando o arquivo
// existir, descomente o import e o bloco "placar" mais abaixo, e acrescente a
// chave `placar` em secoes.ts. Enquanto isso a seção não aparece.
// import { PlacarDoDiaCard } from "./PlacarDoDiaCard";

export function PaginaBlackFriday() {
  const visible = useVisibleModules();
  const { company, consolidatedView, availableCompanies, isStaff } = useAuthStore() as any;

  const secoes = secoesDaPagina({ visible, consolidatedView: !!consolidatedView });
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

      {/* "placar": slot reservado — ver o comentário do import acima.
      {tem("placar") && (
        <SecaoCard testID="bf-secao-placar" numero={numero("placar")} titulo="Placar do dia" porQueAgora="...">
          <PlacarDoDiaCard />
        </SecaoCard>
      )}
      */}
    </View>
  );
}

const s = StyleSheet.create({
  vazio: { padding: 28, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: Colors.border2, alignItems: "center" },
  vazioTxt: { fontSize: 13.5, color: Colors.ink3, textAlign: "center" },
});
