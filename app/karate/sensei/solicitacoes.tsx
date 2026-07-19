// F1 Aura Dojô (compat): /karate/sensei/solicitacoes →
// /karate/(dojo)/solicitacoes (conteúdo movido, mesmo componente).
import React from "react";
import { Redirect } from "expo-router";

export default function SenseiSolicitacoesCompat() {
  return <Redirect href={"/karate/(dojo)/solicitacoes" as any} />;
}
