// ============================================================
// /karate/filiacao — redirect fino (convergência 27/07/2026)
//
// A tela de Filiações virou a aba "Filiações" dentro de Conexões (ver
// app/karate/(federation)/conexoes/index.tsx e .../tabs/FiliacoesTab.tsx
// — o conteúdo INTEIRO mora só lá agora, nada duplicado aqui). Esta rota
// segue viva como redirect fino: bookmarks/links antigos para
// /karate/filiacao continuam funcionando, só que abrem a aba nova.
//
// Mesmo padrão de app/karate/(federation)/conexoes/solicitacoes/index.tsx
// e app/karate/(dojo)/praticantes.tsx (redirect fino pós-consolidação).
// ============================================================
import { Redirect } from "expo-router";

export default function FiliacaoIndexRedirect() {
  return <Redirect href="/karate/conexoes?tab=filiacoes" />;
}
