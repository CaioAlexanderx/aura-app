// ============================================================
// /karate/(dojo)/solicitacoes — redirect fino (F9, 04/08/2026)
//
// A tela de Solicitações (formulário que REDIGITAVA a ficha de um
// praticante que provavelmente já está cadastrado no dojô) foi
// absorvida pela tela "Federação" (app/karate/(dojo)/conexao.tsx):
// decisão do Caio — o sensei agora seleciona vários alunos que já
// existem no dojô (aba "Meus alunos") e envia em LOTE para a federação
// validar, sem formulário nenhum (ver
// components/karate/dojoAlunos/FederacaoEnviarAlunosSection.tsx). O
// item "Solicitações" saiu do DojoShell.
//
// A URL antiga segue viva — deep-links, favoritos e o compat
// /karate/sensei/solicitacoes caem aqui e seguem pra /conexao.
//
// Redirect GROUP-QUALIFIED (regra da casa): sempre com o nome do grupo
// no href — rotas compartilhadas entre (dojo) e (federation) resolvem
// pelo grupo errado sem isso. Mesmo padrão de praticantes.tsx e
// (federation)/filiacao/index.tsx (redirect fino pós-consolidação).
// ============================================================
import React from "react";
import { Redirect } from "expo-router";

export default function DojoSolicitacoesRedirect() {
  return <Redirect href={"/karate/(dojo)/conexao" as any} />;
}
