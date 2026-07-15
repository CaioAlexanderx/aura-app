// ============================================================
// /karate/conexoes/solicitacoes  →  redireciona para a fila.
//
// ⚠️ BUGFIX (15/07/2026) — COLISÃO DE ROTA (3ª vez neste produto).
// A fila de solicitações mora em /karate/conexoes?tab=solicitacoes, e o
// detalhe em /karate/conexoes/solicitacoes/[requestId]. Mas /karate/conexoes/
// solicitacoes (sem id) NÃO tinha rota própria e caía no CURINGA
// conexoes/[id].tsx com id="solicitacoes" — que chamava a API de conexão com
// isso como UUID e estourava 500 (`invalid input syntax for type uuid:
// "solicitacoes"`). É uma URL óbvia de digitar/adivinhar, e quebrava a tela.
//
// Mesma família do /dojos/roster-progress engolido por /dojos/:dojoId: rota
// estática precisa existir ANTES do curinga poder pegá-la.
// ============================================================
import { Redirect } from "expo-router";

export default function SolicitacoesIndexRedirect() {
  return <Redirect href="/karate/conexoes?tab=solicitacoes" />;
}
