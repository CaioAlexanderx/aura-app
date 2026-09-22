# Matcon — handoff para a próxima sessão (22/09/2026)

Resumo executivo para retomar a execução do Matcon (materiais de construção) em outra sessão. Leia junto com `docs/matcon-faseamento-po-ux.md` (o plano), `docs/CONTRACT_MATCON.md` (contrato front↔backend) e `docs/matcon-qa-2026-09-22.md` (o que foi testado).

## Estado atual

**Front (aura-app, tudo em `main`, deploy automático na Cloudflare):**

| PR | O que |
|----|-------|
| #927 | M0 — chave `matcon_enabled`, unidades fracionadas, ficha do produto (unidade de compra, CEST, ST), carrinho decimal |
| #929 | M1 — orçamentos (esteira + página pública `/orcamento/:token`), entregas (esteira, parcial, `/acompanhar/:token`) |
| #930 | M3 — clube do profissional (marcar cliente, indicado por, pontos, cupom), calculadora de ambiente |
| #931 | M2 — fiscal do Simples (CSOSN por `icms_st_paid`, NF-e da entrega com transporte) |
| #932 | M4 — lotes/tonalidade, compras por fornecedor, pedidos de compra, DANFE com lotes |
| #934 | Fix `ScreenHero`: título não encolhe até zero no celular (botões ficavam sobre o texto) |
| #935 | QA: fix hooks do `MarcarProfissionalModal`; `isFractionalUnit` aceita `m2`/`m3`; guia rápido + relatório |
| #936 | Site: `site/matcon.html` + links no menu, rodapé e verticais (cor âmbar, premissa a validar) |

**Backend (Aura-backend, Railway, migrations rodam no deploy):**

- #736 mergeado: M0 (whitelist de `pdv_settings` com as chaves `matcon_*`, módulos `matcon.*`, colunas de produto `purchase_unit`, `purchase_factor`, `weight_kg`, `cest`, `origem`, `icms_st_paid` — migration 350 aplicada e conferida no Supabase).
- **Não existe ainda:** M1 (`/matcon/quotes`, `/matcon/deliveries`, páginas públicas com `kind: "matcon"` / `tipo: "entrega"`), M3 (`/matcon/professionals`, ledger, `/redeem`), M4 (`/products/:id/lots`, `/matcon/purchase-suggestions`, `/matcon/purchase-orders`), M2 (emissão a partir de `delivery_id`, CSOSN/transporte). Tudo especificado em `docs/CONTRACT_MATCON.md`. Até lá, as esteiras em produção mostram vazio.

## Como o QA foi feito (e como repetir)

O sandbox da sessão remota não alcança `app.getaura.com.br` nem a Railway. O QA rodou headless contra um **backend simulado** (Node puro, porta 4000) que vive no scratchpad da sessão anterior e **não está no repo**. Se quiser reaproveitar, o roteiro está descrito em `docs/matcon-qa-2026-09-22.md` (seção "Como repetir"); recriar o mock leva ~1 h a partir de `services/matconApi.ts`, `services/authApi.ts` e `hooks/useProducts.ts`/`useCustomers.ts`.

Em sessão **local** (com Chrome de verdade e acesso à produção), o caminho mais curto é:

```bash
npx expo start --web            # app local contra a produção
# ou EXPO_PUBLIC_API_URL=... para apontar a outro backend
npx jest __tests__/matcon*.test.ts __tests__/components/*Profissional*.test.tsx
```

Login de teste: a conta `@getaura.com.br` que o Caio usa (staff; bypassa billing e verificação de e-mail).

## Pendências abertas (em ordem sugerida)

1. **Backend M1** (orçamentos e entregas) — é o que destrava o piloto: sem ele o "Salvar orçamento" do Caixa e as duas esteiras não funcionam em produção. Contrato pronto; seguir o padrão dos routers da OS/Ótica (`src/routes/`), gate de escrita por `pdv_settings.matcon_enabled`, código 42703 defensivo.
2. **Backend M3** (profissionais, ledger, resgate cria cupom na tabela existente) e **M4** (lotes, sugestões de compra, pedidos).
3. **Backend M2** — `POST /nfce/emit` aceitando `delivery_id` e `transporte`, CSOSN 500/102 por `icms_st_paid` quando `regime = "simples"`.
4. **QA em produção** com o Chrome real: repetir o roteiro do relatório na conta de teste depois que M1 subir.
5. **Lentidão relatada** (páginas mais lentas após o deploy de 13:05): não foi possível medir a partir do sandbox. Bundle cresceu só 9,3 → 9,5 MB; `request()` só refaz 5xx/rede. Hipótese: cold start da Railway. Medir com DevTools na sessão local.
6. **Observações do QA** (não bloqueiam): "–" no primeiro card de Profissionais (`count: null` de propósito; sugerido mostrar vendas indicadas no mês); "." solto no console de `/configuracoes` (não é do Matcon); primeira tecla perdida no campo decimal só em digitação de robô.
7. **Dívidas do plano**: tela de config de NF-e órfã (`TabConfig`), tabela CEST a validar com o contador, tour com spotlight (regra 6 do CLAUDE.md) do Matcon ainda não feito, cor âmbar do site a confirmar.

## Regras que valem para o Matcon (não repetir erros)

- Chave desligada = **zero impacto**: nada do Matcon aparece (menu, telas, campos). Todo componente novo lê `readMatconSettings(pdv_settings)` e some sem o toggle.
- Cada tela tem `mod` próprio em `MODULE_PLAN_MAP` e `PERM_TO_MODULES` (`hooks/useVisibleModules.ts`), sob a umbrella `matcon.access`.
- Unidades: `isFractionalUnit`/`normalizeUnit` em `utils/matconUnits.ts` (aceita `m²`/`m2`, `m³`/`m3`). Fracionamento é dirigido pela unidade, nunca por flag no produto.
- Wizards no DNA `TrocaModal`; hover-reveal sempre com alternativa touch; mockup HTML antes de tela nova (`docs/mockups/matcon-*.html` já existem para M0–M4).
- Plano stale no JWT: telas com gate de plano fazem `refetch /auth/me` no mount.
- Backend: `companies` não tem coluna `name` (usar `COALESCE(trade_name, legal_name)`); `pdv_settings` é jsonb com whitelist em `src/routes/pdvSettings.js` — chave nova precisa entrar lá, senão o toggle "desliza e volta".
- Convenções de sessão: PRs não-draft, squash com `(#NNN)` no título, backend mergeado antes do front que depende dele; branch de trabalho resetada em `origin/main` após cada merge.
