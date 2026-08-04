// F1 Aura Dojô (compat): /karate/sensei/solicitacoes →
// /karate/(dojo)/conexao (F9, 04/08/2026: a tela de Solicitações foi
// absorvida pela tela "Federação" — ver app/karate/(dojo)/solicitacoes.tsx
// e app/karate/(dojo)/conexao.tsx). Aponta direto pro destino final em
// vez de encadear pelo redirect intermediário.
import React from "react";
import { Redirect } from "expo-router";

export default function SenseiSolicitacoesCompat() {
  return <Redirect href={"/karate/(dojo)/conexao" as any} />;
}
