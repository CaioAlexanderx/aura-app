# Materiais de Construção — faseamento revisado (PO + UX/UI)

**Data:** 22/09/2026
**Revisa:** `docs/matcon-pesquisa-mercado-gap.md` (seção 7)
**Premissa:** entrar **nos moldes da Ótica** (PR #878) — semi-vertical sobre o shell de varejo, opt-in por toggle, **zero impacto em quem não é matcon**.

---

## 0. O que mudou em relação à proposta anterior (e por quê)

A proposta anterior tinha uma "F0 — Fundação transversal" que mexia em estoque, PDV e unidades **para todo mundo**. Isso contradiz a premissa de zero impacto e é exatamente o que a Ótica **não** fez: ela não tocou no Caixa, no Estoque nem no Crediário de ninguém — encaixou botões e telas que só aparecem com o toggle ligado.

Então a revisão parte de uma pergunta de PO: **"o que precisa ser global?"** Resposta honesta: quase nada. Fracionamento, unidades, conversão — tudo pode nascer **atrás do toggle e dirigido pela unidade do produto**. A única mudança global é uma troca de `parseInt` por `parseFloat` no mapeamento de produto, que é invisível para quem só tem quantidades inteiras (12 continua 12).

Segunda mudança de PO: o fiscal encolheu. Eu tinha classificado "ICMS-ST completo" como bloqueador. Revendo com o perfil do cliente (69,5% das lojas têm até 4 funcionários → esmagadoramente **Simples Nacional**): o varejista do Simples **não calcula ST na venda** — o imposto já foi recolhido pela indústria/distribuidor. O que ele precisa é marcar o item como "ST já recolhida" (CSOSN 500) e informar o CEST. Isso é um par de campos no cadastro, não um motor tributário. O motor (MVA, base de ST, FCP) é dor de Lucro Presumido/Real, que é a minoria e fica fora do v1.

Terceira: Clube do Profissional subiu de "F3/F4" para o bloco de diferenciação logo após o ciclo de venda, porque é a feature que mais reaproveita o que já existe (cupons + clientes + WhatsApp) e a que mais separa a Aura de Bling/Tiny.

---

## 1. O contrato de zero impacto (mecânica, copiada da Ótica)

Tudo abaixo já existe e foi validado pelo PR #878. Matcon repete, trocando o nome.

| Peça | Como a Ótica fez | Matcon |
|---|---|---|
| **Opt-in** | `pdv_settings.otica_enabled` (migration 334 no backend), tipo em `services/authApi.ts:113` | `pdv_settings.matcon_enabled` — **migration no backend primeiro** (convenção do CLAUDE.md) |
| **Menu** | Seção "Ótica" no `NAV` com `oticaToggle: true`; `_layout.tsx:240` filtra quando o toggle está off | Seção **"Matcon"** com `matconToggle: true`; mesma linha de filtro |
| **Chaves de módulo** | `otica.laboratorio` / `otica.receitas` (Negócio), `otica.config` (Essencial) em `MODULE_PLAN_MAP` | `matcon.orcamentos` / `matcon.entregas` / `matcon.profissionais` (Negócio), `matcon.config` (Essencial) |
| **Permissão de membro** | umbrella `otica.access` em `PERM_TO_MODULES`; `MembersSection.tsx:214` só mostra o grupo com `onlyWhen: "otica"` e toggle on | umbrella `matcon.access`; `onlyWhen: "matcon"` |
| **Configuração** | Linha com Switch + links no `PdvSettingsCard.tsx:226-262`; tela própria `/otica/config` | Linha "Materiais de construção" + links "Abrir orçamentos" / "Unidades, entrega e parceiros" → `/matcon/config` |
| **Ficha do cliente** | Botão "Receitas (ótica)" em `CustomerRow.tsx:222`, condicionado ao toggle | Botão "Profissional" / "Orçamentos", condicionados ao toggle |
| **Reuso de tela pública** | `/acompanhar/[token]` ganhou `tipo === "oculos"` (textos mudam, layout não) | ganha `tipo === "entrega"` ("Seu pedido saiu para entrega") |
| **Reuso de OS** | `kind: "reparo" \| "otica"`; a lista `/os` filtra só reparo | `kind: "corte"` (vidro/madeira/tubo) — **opcional, M4** |
| **Testes** | `__tests__/moduloOtica.test.ts` (chaves nos dois mapas, umbrella não vaza, override por tela) | `moduloMatcon.test.ts` espelhado **+ testes de "não vaza"** (ver §3) |
| **Mockup** | `docs/mockups/otica-modulo.html` antes do código (regra 4) | `docs/mockups/matcon-modulo.html` — **próximo passo** |

**Regras de encaixe nas telas compartilhadas** (PDV, Estoque, Clientes, Vendas, NF-e):

1. Matcon só **acrescenta**, nunca troca componente nem muda default. Padrão: `matconEnabled && <Coisa />`, igual ao botão de receitas.
2. Nenhuma prop nova obrigatória em componente existente. Tudo opcional com default = comportamento de hoje.
3. Se o toggle está off, os arrays/constantes exportados são **os mesmos objetos** de hoje (`UNITS` inalterado; unidades matcon vêm de `MATCON_UNITS` separado e são concatenadas só no render, com toggle on).
4. Chaves `matcon.*` nunca herdam `mod` de outra tela (regra 3 do CLAUDE.md).

---

## 2. A decisão de design que destrava tudo: fracionamento dirigido pela unidade

Hoje: quantidade e estoque são inteiros para todo mundo (`useProducts.ts:29`, `CartPanel.tsx:670/805/810`).

Proposta: uma função pura `isFractionalUnit(unit)` → `true` para `m`, `m²`, `m³`, `kg`, `g`, `L`, `ml`, `ton`; `false` para `un`, `cx`, `sc`, `br`, `mlh`, `pç`, `rolo`, `lata`, `balde`, `pct`, `kit`, `par`.

No PDV, o item do carrinho decide o controle **pela unidade do produto e pelo toggle**:

```
matconEnabled && isFractionalUnit(item.unit)  →  campo decimal (12,5 m²), mono tabular, sem stepper
qualquer outro caso                            →  exatamente o stepper de hoje (− 1 +, maxLength 3)
```

Por que assim e não "decimal para todo mundo em loja matcon"? Porque **ninguém vende 2,5 sacos de cimento**. O saco, a barra, o milheiro continuam inteiros — e o vendedor não perde o stepper rápido do balcão nos itens que são a maioria do tique. Só o piso, a areia e o cabo elétrico ganham o campo decimal. É a UX certa *e* é o isolamento certo: loja sem matcon nunca cai no primeiro ramo.

O teto de 999 (`maxLength={3}`) vira `maxLength={6}` **só com o toggle on** (1.200 tijolos, 5.000 blocos). Fora do matcon, nada muda.

> Nota de PO para depois: `kg`/`L` já existem em `UNITS` e hoje são inteiros — o açougue do Food e o metro de tecido do Studio sofrem do mesmo problema. Quando os pilotos matcon provarem o campo decimal, liberar `isFractionalUnit` sem o toggle é uma mudança de uma linha. **Não agora.**

---

## Status (atualizado 22/09/2026)

| Fase | Estado | PR |
|---|---|---|
| M0 · Fundação gated | ✅ mergeado | [#927](https://github.com/CaioAlexanderx/aura-app/pull/927) |
| M1 · Orçamento → Pedido → Entrega | ✅ mergeado | [#929](https://github.com/CaioAlexanderx/aura-app/pull/929) |
| M3 · Clube do Profissional + calculadora | ✅ mergeado | [#930](https://github.com/CaioAlexanderx/aura-app/pull/930) |
| M2 · Fiscal do Simples | ✅ mergeado | [#931](https://github.com/CaioAlexanderx/aura-app/pull/931) |
| M4 · Profundidade (lote/tonalidade, devolução de sobra, compras) | ✅ mergeado | [#932](https://github.com/CaioAlexanderx/aura-app/pull/932) |

Roteiro de QA e o que depende do backend: `docs/matcon-handoff-qa.md`.

Backend: nenhuma das migrations de `docs/CONTRACT_MATCON.md` foi aplicada ainda. Com o toggle desligado (default) nada muda para nenhum cliente; ligado, o módulo só opera de verdade depois do backend.

## 3. Faseamento revisado — cada fase é um PR, no tamanho do PR da Ótica

### M0 · Fundação gated — "vender piso por m² e tijolo por milheiro sem errar o estoque"

**Backend antes (bloqueia o PR do front):** migration `pdv_settings.matcon_enabled`; `products.stock_qty` → `numeric(12,3)`; colunas `purchase_unit`, `purchase_factor` (compra por `cx` de `2,32 m²`); `round_to_package` por produto; `pdv_settings.matcon_*` (perda padrão %, arredondar para embalagem fechada); `services/modules.js` conhecendo `matcon.*`.

**Front:**
- Toggle + seção no `PdvSettingsCard`; `/matcon/config` (Essencial): unidades habilitadas, perda padrão, arredondar para embalagem, prazo de entrega padrão.
- `SecaoEstoque`: com toggle on, aparece um segundo grupo de chips "Materiais" (`m`, `m²`, `m³`, `sc`, `br`, `ton`, `mlh`, `pç`, `rolo`, `lata`, `balde`) **abaixo** dos 9 atuais, e uma linha "Compra por: [cx] de [2,32] [m²]". Estoque em decimal quando a unidade é fracionada.
- `CartPanel`: campo decimal para unidade fracionada (§2); hint abaixo do campo quando "arredondar para embalagem" está ligado: `12,5 m² → 6 cx (13,92 m²)`.
- Importação de XML (`DanfeImportModal`): quantidade da nota entra pela unidade de compra e converte pelo fator → estoque na unidade de venda; custo unitário recalculado. Só com toggle on; sem toggle, fluxo de hoje.
- Data layer: `parseInt` → `parseFloat` em `mapApiProduct` (neutro para inteiros); `fmtInt` → `fmtQty` que só mostra decimais quando existem.
- NAV: a seção "Matcon" **só entra no menu com as telas do M1**. Em M0 o único acesso é a linha do PdvSettingsCard (toggle + link para `/matcon/config`). Sem item de menu apontando para rota inexistente.

**Fora, de propósito:** orçamento, entrega, fiscal, clube.

**DoD / testes:** `moduloMatcon.test.ts` (espelho do da Ótica) + `matconNaoVaza.test.ts`: com toggle off, `UNITS` é o array de hoje, `CartPanel` renderiza stepper com `maxLength=3` para qualquer unidade, `SecaoEstoque` não renderiza "Compra por", `CustomerRow` não renderiza botões matcon. Snapshot do `PdvSettingsCard` com toggle off inalterado.

**Tamanho:** ~1,5k linhas front. Menor que a Ótica.

---

### M1 · Orçamento → Pedido → Entrega — "o cliente voltou com o orçamento de 3 dias atrás; metade vai hoje no caminhão"

**Backend antes:** tabelas `quotes` (número, validade, status aberto/aprovado/perdido/expirado, token público) e `orders` com etapas (separando → pronto → saiu → entregue), itens com `qty_delivered`, entregas parciais; `/acompanhar/:token` devolvendo `tipo: "entrega"`.

**Front:**
- `/matcon/orcamentos` (chave `matcon.orcamentos`, Negócio): **esteira**, não lista — igual ao Laboratório da Ótica. Estações: *Abertos* → *Vencendo (≤ 3 dias)* → *Aprovados* → *Perdidos*. O dono de manhã quer saber "quantos orçamentos estão vencendo e quanto dinheiro tem parado ali".
- Orçamento nasce do carrinho do PDV: o botão de imprimir orçamento que hoje existe (`buildQuoteHtml.ts`) passa, com toggle on, a **salvar** antes de imprimir e a oferecer "enviar por WhatsApp" (reuso do shell de `/orcamento/[token]` do Studio, com a marca da loja). Sem toggle: imprime como hoje.
- "Converter em pedido" reserva estoque e leva ao PDV com o carrinho montado (reuso de `NfcePrefill`-like).
- `/matcon/entregas` (chave `matcon.entregas`, Negócio): esteira por estação, agrupada por dia. Cada entrega lista itens com `entregue / total` (`6 de 10 sc`). Entrega parcial cria a próxima entrega automaticamente com o saldo.
- `SaleDetailModal` (Vendas): selo **"saldo a entregar"** com toggle on. Acréscimo condicional, uma linha.
- `/acompanhar/[token]`: `tipo === "entrega"` → "Seu pedido saiu para entrega" / "Entregue".

**Fora, de propósito:** romaneio de carga, roteirização, MDF-e, motorista com app. Um depósito com 1 caminhão não precisa; home center não é o alvo.

**Decisão em aberto (Caio):** reaproveitar `useFoodDeliverers` (motoboys do Food) como "motoristas" da entrega? Economiza uma tela; custa acoplar matcon ao Food. Minha recomendação: **não** no M1 — campo livre "quem entregou" e ponto.

**Tamanho:** ~3k linhas. É o PR do tamanho da Ótica.

---

### M2 · Fiscal do Simples — "emitir a nota certa do cimento sem o contador ligar"

**Backend antes:** `products.cest`, `products.origem`, `products.csosn` (default vem da config fiscal da empresa); NF-e com bloco de transporte (peso bruto/líquido, volumes, transportadora, placa) preenchido a partir do pedido de entrega; Nuvem Fiscal já aceita tudo isso — é mapeamento.

**Front:**
- `SecaoCodigos` (cadastro do produto): com toggle on, ganha CEST (com sugestão a partir do NCM, como já existe `suggestNcm`), origem e um seletor simples **"ICMS já recolhido na compra (ST)"** que grava CSOSN 500 vs. 102. Linguagem de gente, não de contador.
- Emissão de NF-e a partir de uma entrega: peso e volumes calculados dos itens (peso por unidade no cadastro, opcional), transportadora = "própria" por default.
- Aviso na lista de produtos: "12 produtos com NCM de cimento/tinta sem CEST" — só com toggle on.

**Fora, de propósito:** cálculo de ST (MVA, base, FCP) para Lucro Presumido/Real. Fica para quando um cliente desse perfil pedir.

**Tamanho:** ~1k linhas front. O trabalho está no backend.

---

### M3 · Clube do Profissional + Calculadora de ambiente — "o pedreiro que traz cliente ganha e volta"

**Backend antes:** `professionals` (vínculo com `customers`, ofício, pontos), `sales.referred_by_professional_id`, regras de pontuação em `pdv_settings.matcon_*`, resgate gerando cupom (reuso da tabela de cupons).

**Front:**
- `/matcon/profissionais` (chave `matcon.profissionais`, Negócio): lista com pontos, últimas indicações, botão "avisar pelo WhatsApp" (reuso `useWaVarejo`). Cadastro reaproveita `QuickCustomerModal` com um campo "ofício".
- PDV: no bloco de identificar cliente (mockup `fase1-pdv-identificar-cliente`), chip **"Indicado por"** com busca de profissional. Só com toggle on.
- `CustomerRow`: botão "Profissional" (marca o cliente como profissional) — mesma posição do "Receitas (ótica)".
- **Calculadora de ambiente**: ícone `calculator` no item do carrinho quando `unit === "m²"` (e só com toggle on). Abre `ResponsiveSheet` (bottom sheet no touch, popover no desktop): largura × comprimento por ambiente, + ambientes, perda % (default da config) → m² → caixas. "Usar" preenche a quantidade. Nada de tela nova.

**Tamanho:** ~2k linhas.

---

### M4 · Profundidade — só depois de 5 pilotos pedindo

Lote/tonalidade/bitola (campo de lote na entrada + alerta "lote misturado" na venda); compras (sugestão a partir do giro + pedido de compra + cotação); devolução parcial / sobra de obra; multi-depósito; OS `kind: "corte"`; kits. **Nenhum desses entra no roadmap comprometido** — entram no backlog com a etiqueta do piloto que pediu.

---

## 4. Decisões de UX/UI transversais

| Decisão | Escolha | Por quê |
|---|---|---|
| Nome da seção no menu | **"Matcon"** (decisão 22/09/2026) | Jargão do setor, curto, com cara de startup. O toggle em Configurações continua "Materiais de construção", que é como o dono descreve a loja. |
| Nome do toggle em Configurações | "Materiais de construção" | É como o dono descreve a loja. |
| Rotas / chaves | `/matcon/*`, `matcon.*` | Curto, sem acento, igual `otica`. |
| Nome do programa de indicação (M3) | **"Profissionais Parceiros"** na tela (decisão do Caio, 22/09/2026); em frase corrida, "profissionais parceiros"; na ficha, "Marcar como parceiro" | Descartados: "Profissionais", "Clube do pedreiro", "Clube do profissional", "Indicações". Rota, chave de módulo e API mantêm o nome técnico (`/matcon/profissionais`, `matcon.profissionais`, `/matcon/professionals`). |
| Paleta | **Nenhuma própria** — shell de varejo, violeta `#7c3aed` | Ótica também não tem. Só Food tem paleta própria porque tem shell próprio. Matcon **é** varejo. |
| Ícones | já existem: `truck` (entregas), `calculator` (calculadora), `clipboard` (orçamentos), `building`/`tool` (config/profissionais) | Zero ícone novo no M0–M2. Talvez `hard_hat` no M3 — 1 ícone, como a Ótica adicionou 2. |
| Esteira vs. lista | Orçamentos e Entregas são **esteiras** com contagem por estação | Mesmo raciocínio do Laboratório: o dono quer "quantos e quais atrasaram" numa olhada. |
| Quantidade fracionada | Campo decimal mono tabular, vírgula como separador, sem stepper | Igual à grade OD/OE da Ótica: número que se digita, não que se clica. |
| Mobile | Itens de "Matcon" entram no menu "Mais", como a Ótica; calculadora em bottom sheet; esteiras viram colunas roláveis horizontalmente | Não mexer em `MORE_PRIORIDADE`. |
| Touch | Nenhum hover-reveal novo (regra 7). Ações da esteira sempre visíveis no card. | |
| Tema | Mockup e telas com `data-tema="claro"` como a Ótica | O padrão da casa. |
| Estados vazios | `VerticalEmptyState` já existe; texto de cada esteira vazia ensina o primeiro passo ("Faça um orçamento no Caixa e ele aparece aqui") | Tela vazia no dia 1 é onde o cliente desiste. |

---

## 4b. Onde o diferencial brilha — "bonito e fácil" como critério de aceite

O concorrente de matcon é feio, cinza e cheio de formulário (CISS, GestãoFlex, o legado de desktop). O genérico bonito (Bling/Tiny) não entende m². A Aura só ganha se cada fase tiver **um momento em que o dono da loja mostra a tela para o vizinho**. Esses momentos viram critério de aceite do PR — sem eles, a fase não fecha.

| Fase | O momento "olha isso" | Por que nenhum concorrente faz |
|---|---|---|
| **M0** | Digitar `12,5` no piso e ver embaixo, na hora, **"= 6 caixas · 13,92 m² · sobra 1,42 m²"**. Ligar o toggle e um **tour com spotlight** (regra 6) leva o dono direto ao produto para escolher a unidade — sem manual. | ERP de matcon exige cadastrar "fator de conversão" numa aba fiscal. Aqui é uma frase. |
| **M1** | O cliente recebe no WhatsApp um **orçamento com a marca da loja**, abre no celular, aprova com um toque — e o vendedor vê o card pular de "Aberto" para "Aprovado" na esteira. Depois: **"seu pedido saiu para entrega"** com link, como o rastreio de e-commerce. | O padrão do setor é orçamento em papel que o cliente perde. Rastreio de entrega de material de construção **não existe** no varejo pequeno. |
| **M2** | Em vez de "CSOSN 500 / CST 60", uma pergunta: **"O imposto desse produto já veio recolhido na nota do fornecedor?"** — com o sistema sugerindo a resposta pelo NCM. | O concorrente joga a tabela do contador na cara do lojista. |
| **M3** | O vendedor toca em **"calcular ambiente"** no piso, digita 3,5 × 4,2, o sistema devolve as caixas — e o pedreiro que indicou recebe **no WhatsApp** "você ganhou 120 pontos com a compra da dona Marlene". | Clube do profissional é coisa de Leroy Merlin. A lojinha de bairro nunca teve. |

Regras que sustentam isso (e que o mockup precisa provar):

1. **Uma frase, não um formulário.** Conversão de unidade, fiscal, perda — cada configuração é uma frase em português com um número editável no meio (`Compro por [caixa] de [2,32] m²`). Se precisar de tooltip para explicar, está errado.
2. **A esteira mostra o dinheiro.** Cabeçalho de Orçamentos e Entregas com o valor parado em cada estação (`R$ 18.400 em 7 orçamentos vencendo`). É o número que faz o dono abrir a tela de manhã.
3. **O cliente final também vê algo bonito.** Orçamento público e rastreio de entrega com a marca da loja (já existe o shell no Studio). O lojista percebe que a Aura faz a loja *dele* parecer grande.
4. **Zero jargão de ERP nas telas.** "Saldo a entregar", não "pendência de expedição". "Já veio com imposto recolhido", não "ST". "Compro por caixa", não "unidade de compra / fator".
5. **Primeiro dia sem tela vazia.** Ao ligar o toggle: tour com spotlight até o cadastro de produto; esteiras vazias ensinam o primeiro passo em uma linha.

## 5. O que mudou vs. a proposta anterior — resumo

| Antes | Agora | Motivo |
|---|---|---|
| F0 "fundação transversal" para todos | M0 gated pelo toggle + dirigido pela unidade | Zero impacto; ninguém vende 2,5 sacos |
| F1 "ICMS-ST completo" como bloqueador | M2 "fiscal do Simples": CEST + CSOSN + transporte | Varejista do Simples não calcula ST; 69,5% do mercado |
| Orçamento e entrega juntos com "ciclo de venda" | M1 com **duas chaves** (`matcon.orcamentos`, `matcon.entregas`) | Regra 3: cada tela, sua chave; permite vender só orçamento como add-on |
| Clube do Profissional na F3, depois de fiscal | M3, logo após M1 — pode inclusive **trocar de lugar com M2** se os pilotos forem Simples com contador tranquilo | Maior reuso, maior diferenciação |
| 4 fases sem tamanho | 4 PRs com tamanho de referência (a Ótica: 22 arquivos, 3,6k linhas) | Planejável |
| Motoboys do Food reaproveitados | **Não** no M1 | Evita acoplar matcon ao Food |

---

## 6. Riscos e perguntas que são do Caio

1. **Backend é o caminho crítico.** M0 depende de 4 migrations e do `services/modules.js` conhecer `matcon.*` (hoje `os`, `cupons` e `clientes.reativacao` ainda não são conhecidos e ficam fora do catálogo do ClientsAdmin — matcon não pode nascer com essa dívida). Precisa de PR de backend **antes** de cada PR de front.
2. **`stock_qty` para numeric** é a migration mais delicada: toca variantes (`variants_stock_total`), relatórios e curva ABC. Precisa de teste de regressão no backend nas somas.
3. **Piloto antes do M2.** Sugiro 3–5 lojas rodando M0+M1 por 30 dias antes de fechar o escopo do M2/M3. As lojas decidem se o próximo é fiscal ou clube.
4. ~~Nome da seção~~ — **decidido: "Matcon"** (22/09/2026).
5. ~~Motoristas~~ — **decidido: campo livre "quem entregou"** (22/09/2026).
6. **Onde a loja ganha a subvertical.** Hoje a subvertical (Matcon, Ótica) é um toggle em Configurações, e é ele que decide a cara do cadastro de produto. Com Matcon e Ótica ligados na mesma loja, o perfil Matcon prevalece no cadastro (decisão de 22/09/2026). O Caio quer, no futuro, escolher a subvertical no signup ou atribuí-la pela gestão Aura, porque a atribuição em Configurações "em algum momento pode nos dar problema". Sem data.

---

## 7. Próximo passo

Regra 4 do CLAUDE.md: **mockup HTML standalone antes do código** — `docs/mockups/matcon-modulo.html`, no formato do da Ótica (comentário de abertura com as decisões que cada tela valida, tema escuro + `data-tema="claro"`), cobrindo:

1. `Configurações › Materiais de construção` (toggle + links) e `/matcon/config`
2. Cadastro de produto com "Materiais" e "Compra por"
3. Carrinho com item em m² (campo decimal + hint de caixas) ao lado de um item em `sc` (stepper de hoje)
4. Esteira de Orçamentos
5. Esteira de Entregas com entrega parcial

Com o mockup aprovado, M0 vira PR.
