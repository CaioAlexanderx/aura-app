# CLAUDE.md — Aura App

Instruções para o Claude ao trabalhar neste repositório.

---

## ⚠️ REGRA CRÍTICA — MCP GitHub e base64

> **Todo arquivo lido via MCP GitHub vem com `content` em base64.**
> **NUNCA commitar o campo `content` diretamente. SEMPRE decodificar antes.**

O campo `content` da API do GitHub é sempre base64 — isso inclui `.tsx`, `.ts`, `.js`, `.json`, qualquer extensão. Se você passar o valor bruto para `create_or_update_file`, o arquivo no repo ficará com base64 puro no lugar do código, quebrando o build/CI (Unexpected token, módulo inválido, etc).

**Fluxo correto ao editar um arquivo via MCP:**
1. `get_file_contents` → recebe `{ content: "<base64>", sha: "..." }`
2. Decodificar o base64 para obter o texto real
3. Aplicar as edições no texto decodificado
4. `create_or_update_file` com o texto editado (não base64) + o `sha` original

---

## Arquitetura

- **Stack:** Expo (React Native Web) + Expo Router
- **Deploy:** Cloudflare Pages — push em `main` faz deploy automático
- **Estilo:** cor primária violeta `#7c3aed`; Food usa `#EF4444` como primary
- **Design Food:** light theme; paleta canônica — primary `#EF4444`, secondary branco, accent violeta `#7c3aed`

---

## Armadilhas recorrentes

### 1. Plano stale no JWT
O auth store carrega `plan` / `module_overrides` / `vertical` do JWT na inicialização e **nunca revalida automaticamente**. Toda tela com gate condicional de plano deve fazer `refetch /auth/me` no mount antes de verificar o plano.

### 2. Multi-CNPJ desde o desenho
Toda nova feature deve considerar tanto o contexto single-company quanto o consolidado multi-CNPJ (hooks, componentes, chamadas de API). Não adicionar multi-CNPJ como afterthought.

### 3. Módulo próprio para cada tela nova
Cada nova tela precisa de:
- Chave `mod` própria no objeto de navegação (`NAV`)
- Entrada em `MODULE_PLAN_MAP`
- Entrada em `PERM_TO_MODULES`

Nunca herdar o `mod` de outra tela.

### 4. Mockup antes do código em mudanças visuais fortes
Para qualquer mudança com componente visual relevante (nova tela, redesign de layout), produzir um mockup HTML standalone antes de escrever o código real. Isso evita retrabalho de UX.

### 5. TrocaModal como DNA canônica de wizards
Wizards e modais multi-passo devem seguir o padrão `TrocaModal` (aprovado em 07/05/2026). Não criar estruturas alternativas de wizard.

### 6. Tours e onboarding: spotlight + auto-scroll
Tours/onboarding nunca usar banner livre flutuante. Sempre: auto-scroll até o elemento alvo + spotlight + tooltip ancorado no elemento. Sem isso o usuário não sabe onde clicar.

### 7. Hover-reveal quebra em touch
Qualquer padrão de `hover-reveal` (mostrar ação ao fazer hover em item de lista) precisa de `@media (hover: none)` com comportamento alternativo para dispositivos touch.

### 8. Emails `@getaura.com.br` são contas internas
Contas com domínio `@getaura.com.br` têm `is_staff=true` automático, bypassam billing gate e verificação de e-mail. Não tratar como contas normais em testes ou seeds.

---

## Convenções

- Componentes atômicos em `components/`
- Hooks customizados em `hooks/`
- Rotas em `app/` (Expo Router file-based)
- PRs não-draft; backend mergeado antes de abrir PR do frontend que depende de nova coluna/rota
