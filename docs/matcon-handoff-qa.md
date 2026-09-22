# Matcon — handoff para o QA a dois

**Data:** 22/09/2026 · **Sessão:** M0 + M1 + M3 entregues em três PRs
**Antes de testar:** ligar o toggle em *Configurações › Caixa › Materiais de construção* numa loja de teste. Com ele desligado, **nada** do Matcon aparece — esse é o primeiro teste.

## O que foi entregue

| Fase | PR | O que tem |
|---|---|---|
| M0 · Fundação | [#927](https://github.com/CaioAlexanderx/aura-app/pull/927) ✅ | toggle, chaves de módulo, unidades "Materiais" no cadastro, "Compro por caixa de 2,32 m²", estoque decimal, campo decimal no carrinho (m², m³, m, kg, L), "= 6 caixas · sobra", `/matcon/config`, import de XML convertendo |
| M1 · Orçamento → Entrega | [#929](https://github.com/CaioAlexanderx/aura-app/pull/929) ✅ | "Salvar orçamento" no Caixa + WhatsApp, esteira de Orçamentos, esteira de Entregas com entrega parcial, seção "Matcon" no menu, orçamento público, rastreio "seu pedido saiu para entrega", selo "saldo a entregar" |
| M3 · Clube + calculadora | [#930](https://github.com/CaioAlexanderx/aura-app/pull/930) ✅ | calculadora de ambiente no item em m², chip "Indicado por" no Caixa, "Marcar como profissional" na ficha, `/matcon/profissionais`, regras do clube na config |
| M2 · Fiscal do Simples | [#931](https://github.com/CaioAlexanderx/aura-app/pull/931) ✅ | CEST sugerido pelo NCM, a pergunta "o imposto já veio recolhido?", "Fabricado no Brasil?", aviso "N produtos sem o código fiscal" com Aceitar sugestão, NF-e nascendo da entrega (caminhão próprio, volumes/peso, placa), regime da empresa, DANFE no rastreio |
| M4 · Profundidade | [#932](https://github.com/CaioAlexanderx/aura-app/pull/932) | lote/tonalidade (XML → saldo por lote → carrinho com aviso de dois lotes → alocação na venda), devolução de sobra no wizard de troca (decimal, só caixa fechada volta, "não vai levar nada"), compras (sugestão por giro agrupada por fornecedor, pedido pelo WhatsApp, recebido pelo XML) |

Docs: `matcon-pesquisa-mercado-gap.md` (mercado), `matcon-faseamento-po-ux.md` (fases, §4b), `CONTRACT_MATCON.md` (backend, seções M0–M4), mockups `matcon-modulo.html`, `matcon-m3-clube-calculadora.html`, `matcon-m2-fiscal.html` e `matcon-m4-profundidade.html`.

## O que funciona SEM backend (dá para testar já)

- Toggle off/on e o que aparece/some (menu, cadastro, carrinho, ficha do cliente, config)
- Cadastro de produto: chips "Materiais", frase "Compro por", estoque decimal — *o salvar grava `purchase_unit`/`purchase_factor`; sem a migration o backend pode ignorar ou rejeitar*
- Carrinho: campo decimal em m², stepper em `sc`, frase de caixas, calculadora de ambiente (100% front), teto 999 → 999.999
- `/matcon/config`: as frases — *salvar depende do PUT aceitar as chaves `matcon_*` (merge parcial; provavelmente aceita)*
- Páginas públicas com dados de exemplo: não há sem backend

## O que DEPENDE do backend (`docs/CONTRACT_MATCON.md`)

| Depende de | Sem isso |
|---|---|
| `pdv_settings.matcon_*` aceitos no PUT | toggle e config não persistem |
| `stock_qty numeric(12,3)`, `purchase_unit`, `purchase_factor` | estoque fracionado não grava |
| `quantity` decimal na venda e na NFC-e | venda de 12,5 m² falha ou arredonda |
| rotas `/matcon/quotes` e `/matcon/deliveries` | esteiras mostram erro/vazio; "Salvar orçamento" falha com toast |
| `quote_id` e `referred_by_professional_id` no POST da venda | venda fecha, mas não vincula orçamento nem pontua |
| rotas `/matcon/professionals`, `customers.professional` | chip "Indicado por" não acha ninguém; ficha não mostra o profissional |
| `products.cest/origem/icms_st_paid`, `items[].cest…` na emissão, `delivery_id` + `<transp>` | cadastro fiscal não grava; NF-e da entrega sai sem transporte/CSOSN certo |
| `product_lots`, `lot_allocations` na venda, `lots_summary` | lotes não gravam; carrinho não mostra lote |
| `returns.items[].lot_id`/`settlement`, `restock_qty` | devolução grava, mas sem lote e sem a regra da caixa fechada no servidor |
| `purchase-suggestions`, `purchase_orders`, `products.last_supplier_*` | esteira de compras vazia/erro |
| `services/modules.js` conhecendo `matcon.*` | override de módulo no ClientsAdmin volta 400 |

## Roteiro do QA a dois (ordem sugerida)

1. **Zero impacto:** loja sem o toggle — Caixa, Estoque, Clientes, Vendas, Configurações idênticos ao de antes (comparar com a `main` anterior ao #927 se quiser rigor).
2. **Ligar o toggle** e conferir: linha em Configurações, link para `/matcon/config`, seção "Matcon" no menu com Orçamentos/Entregas/Profissionais, permissão "Matcon" em Equipe › membros.
3. **Cadastro:** criar "Porcelanato 60×60" em m², compro por caixa de 2,32; estoque 148,48 → "(= 64 caixas)". Criar "Cimento" em `sc`.
4. **Carrinho:** piso 12,5 m² → "= 6 caixas · 13,92 m² · sobra 1,42 m²"; calcular ambiente 3,5 × 4,2 com 8% → "15,88 m² → 7 caixas"; cimento com stepper; imprimir orçamento (quantidade com unidade).
5. **Celular (390px):** tudo acima + as esteiras (colunas roláveis, botões sem corte).
6. **Com backend:** salvar orçamento → WhatsApp → aprovar pelo link → converter → Caixa com `?quote=` → finalizar (`quote_id`) → entrega em Separando → parcial → 2ª entrega → rastreio público. Marcar profissional → indicar no Caixa → pontos → resgate → cupom.
7. **Fiscal (M2):** cadastrar cimento com NCM 2523.29.10 → "Gerar" sugere CEST 05.001.00 e "sugerimos Sim" → aviso fiscal no Estoque some → NF-e da entrega em Pronto: "Entrego com meu caminhão", volumes/peso, emitir → selo autorizada + DANFE no rastreio.
8. **Lotes (M4):** ligar "Controlo lote e tonalidade" → importar XML de piso com lote 27B → estoque "em 1 lote" → segundo XML lote 28A → carrinho com 100 m²: aviso "Precisa de 2 lotes" → venda leva `lot_allocations`.
9. **Devolução (M4):** Trocar/Devolver uma venda de piso → 4,64 m² → "2 caixas fechadas voltam ao estoque"; 1,16 m² → "caixa aberta não volta, R$ 0" → "Não vai levar nada" → crédito na loja → sucesso com lote e vale.
10. **Compras (M4):** produtos abaixo do mínimo → `/matcon/compras` agrupa por fornecedor → Montar pedido → WhatsApp → Marcar como enviado → importar XML do fornecedor fecha o pedido.

## Fora, de propósito (dependem de piloto)

- **Multi-depósito** e **kits/composições** — mudam a arquitetura do estoque (saldo por local, composição); sem loja pedindo, não
- Cotação com vários fornecedores, alçada de desconto, classe A/B/C, inventário com coletor, motor de ST para Lucro Presumido/Real, DIFAL, MDF-e/CT-e
- **Tour com spotlight** ao ligar o toggle (regra 6): `components/dental/onboarding/SpotlightTour.tsx` é reaproveitável extraindo a paleta — PR próprio
- "Refazer com preço de hoje" reprecifica de verdade só com `POST /quotes/:id/duplicate` no backend (hoje duplica com os preços antigos e avisa)
- Card do profissional na tela de ranking mostra o resumo do mês; "últimas indicações" por card só com a lista devolvendo isso (evita N+1)

## Dívidas do Matcon (registradas, não bloqueiam)

- **Config da NF-e não tem tela**: `components/screens/nfe/TabConfig.tsx` está órfão (aba removida antes do M2); a frase do regime foi para um card na aba "Emitir NF-e". Vale uma tela própria de config fiscal (certificado, série, regime)
- **Tabela NCM → CEST** (`utils/cest.ts`) é sugestão parcial — conferir com o contador antes do piloto; a tela só sugere, aceitar é do lojista
- "Refazer com preço de hoje" reprecifica de verdade só com `POST /quotes/:id/duplicate`
- Card do profissional no ranking mostra o resumo do mês (sem "últimas indicações" por card — evita N+1)
- Tour com spotlight ao ligar o toggle (regra 6): `SpotlightTour` do Dental é reaproveitável extraindo a paleta

## Dívidas conhecidas (pré-existentes, não são do Matcon)

- `__tests__/vitrineStudioSelos.test.ts` é flaky por relógio (`Date.now()` no próprio teste): falhou 1 vez numa rodada completa e passou 3 vezes em seguida sem mudança

- `__tests__/components/CategoryTreePicker.test.tsx` e `__tests__/studio/dataBR.test.ts` falham na `main` ("failed to run": componente nativo no jsdom)
- `tsc` tem ~436 erros pré-existentes (`app/_layout.tsx`, `Colors.ink4` em `PdvSettingsCard`, `FlatCategory` em `usePdvState`); nenhum novo foi introduzido
- `os`, `cupons` e `clientes.reativacao` seguem desconhecidos por `services/modules.js`
