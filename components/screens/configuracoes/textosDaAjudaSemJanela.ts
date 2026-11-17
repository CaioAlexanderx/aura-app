// ============================================================
// AURA. — Textos da ajuda "Imprimir sem a janela de confirmação"
// (p-161, 17/11/2026)
//
// O Chrome (e o Edge) aberto com --kiosk-printing aperta sozinho o botão
// Imprimir da janela de impressão, na impressora usada por último nele.
// Por isso o passo 1 é imprimir uma vez escolhendo a impressora de cupom.
// O efeito vale para TUDO que for impresso naquela janela (etiqueta, A4):
// o aviso de "tudo sai direto" é obrigatório.
//
// As imagens são capturas reais (Windows 11 em português, Chrome), em
// assets/ajuda/impressao/, com o campo de cada passo marcado em violeta.
// ============================================================

export const ENDERECO_DO_APP = "https://app.getaura.com.br";

export const COMANDO_CHROME_WINDOWS =
  `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing ${ENDERECO_DO_APP}`;
export const COMANDO_EDGE_WINDOWS =
  `"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --kiosk-printing ${ENDERECO_DO_APP}`;
export const COMANDO_CHROME_MAC =
  `open -a "Google Chrome" --args --kiosk-printing ${ENDERECO_DO_APP}`;

export const TEXTOS_DA_AJUDA = {
  link: "Imprimir sem a janela de confirmação: veja como",
  titulo: "Imprimir sem a janela de confirmação",
  sub: "Hoje, a cada venda o navegador abre a janela de impressão e você confirma com Enter. Com um atalho no computador do caixa, o cupom sai direto na impressora. Leva uns 2 minutos e só precisa ser feito uma vez.",
  passo1Titulo: "Escolha a impressora de cupom",
  passo1: "Imprima um cupom do jeito de sempre e, em Destino, escolha a impressora de cupom. O Chrome guarda essa escolha e passa a usá-la direto.",
  passo2Titulo: "Crie o atalho da Aura",
  passo2: "Na área de trabalho, clique com o botão direito num espaço vazio e escolha Novo e depois Atalho. Cole o endereço abaixo e clique em Avançar.",
  passo3Titulo: "Dê um nome e abra por ele",
  passo3: "Escreva Aura Caixa e clique em Concluir. Feche todas as janelas do Chrome e abra a Aura sempre por esse atalho. Pronto: o cupom sai direto na impressora.",
  outraPastaTitulo: "O Windows disse que não encontrou o item?",
  outraPasta: "O Chrome está em outra pasta neste computador. Clique com o botão direito no atalho do Chrome que você já usa, escolha Propriedades e, no campo Destino, acrescente no final um espaço e o texto abaixo.",
  complementoKiosk: `--kiosk-printing ${ENDERECO_DO_APP}`,
  edge: "Usa o Microsoft Edge? Funciona igual, com este endereço no passo 2:",
  macTitulo: "No Mac",
  mac: "Feche o Chrome por completo (Cmd + Q), abra o Terminal e cole a linha abaixo. A Aura abre com a impressão direta enquanto essa janela do Chrome estiver aberta.",
  avisoTitulo: "Bom saber",
  aviso: "Aberta por esse atalho, tudo o que você imprimir sai direto na impressora de cupom, sem perguntar. Para imprimir etiquetas ou papel A4, abra o Chrome pelo ícone de sempre. E se o Chrome já estiver aberto quando você usar o atalho, a janela de confirmação continua aparecendo: feche o Chrome antes.",
  voltar: "Para voltar a ter a janela de confirmação, é só abrir o Chrome pelo ícone de sempre.",
  copiar: "Copiar",
  copiado: "Copiado. Agora é só colar.",
  naoCopiou: "Não deu para copiar. Selecione o texto e copie com Ctrl + C.",
  fechar: "Entendi",
} as const;

/** Mac pelo navegador (o atalho do Windows não serve lá). */
export function ehMac(nav?: { platform?: string; userAgent?: string } | null): boolean {
  const n = nav ?? (typeof navigator !== "undefined" ? navigator : null);
  if (!n) return false;
  const p = String(n.platform || "") + " " + String(n.userAgent || "");
  return /Mac/i.test(p) && !/iPhone|iPad/i.test(p);
}
