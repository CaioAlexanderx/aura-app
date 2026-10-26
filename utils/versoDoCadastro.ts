// ============================================================
// AURA. — Verso do cadastro segura o AuthGuard (tq-69, 26/10/2026)
//
// O cadastro grava o token no store, e o AuthGuard (app/_layout.tsx) manda
// na hora quem não confirmou o e-mail para /verify-email. A etapa 3 nova
// vira o cartão e mostra o verso ("Pronto, Maria", crachá, código do
// WhatsApp, QR no computador e "Confirmar meu e-mail"): sem isto o verso
// sumiria no mesmo instante.
//
// Só em memória: recarregar a página solta o guarda e o AuthGuard segue
// como sempre. Quem ativa é o cadastro (antes de chamar o register); quem
// solta é o botão "Confirmar meu e-mail" ou o erro do register.
// ============================================================
let segurando = false;

export function segurarNoVerso(): void { segurando = true; }
export function soltarVerso(): void { segurando = false; }
export function versoDoCadastroAberto(): boolean { return segurando; }
