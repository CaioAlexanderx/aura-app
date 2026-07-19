// ============================================================
// /karate/(dojo)/praticantes — redirect fino (F2)
//
// A tela de praticantes FEDERADOS virou a aba "Na federação" dentro de
// alunos.tsx (junto do registro PRÓPRIO "Meus alunos"). A URL antiga
// segue viva — deep-links e favoritos caem aqui e seguem pra /alunos.
//
// Redirect GROUP-QUALIFIED (regra da casa): sempre com o nome do grupo
// no href — rotas compartilhadas entre (dojo) e (federation) resolvem
// pelo grupo errado sem isso. (Usuário de federação nem chega aqui: o
// _layout do grupo já devolve pro shell dele antes de renderizar.)
// ============================================================
import React from "react";
import { Redirect } from "expo-router";

export default function DojoPraticantesRedirect() {
  return <Redirect href={"/karate/(dojo)/alunos" as any} />;
}
