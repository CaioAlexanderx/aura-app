# Ficha de personalização do produto: diagnóstico e redesenho

**28/09/2026 · Fase de desenho (documento e mockup, nenhum código de produção)**
Mockup: [`docs/mockups/studio-ficha-de-personalizacao.html`](../mockups/studio-ficha-de-personalizacao.html). Abre sem rede. A faixa escura no topo alterna estado, peça, tema e largura; dá para abrir um estado direto pelo endereço, por exemplo `#estado=configurado&peca=camiseta&tema=dark&largura=celular`.

Pedido do PO (Caio): *"Achei a ficha de personalização muito extensa: 4 abas e muitas informações que não são exatamente importantes. Repensar a ficha, simplificar e deixar fácil de usar."*

Referência de código: branch `feat/studio-camiseta-3d-foto-de-produto` em `0c17106c`. A ficha é o produto expandido em `app/studio/(estudio)/estoque.tsx` (`ProductExpanded`, linha 608) com quatro abas; a aba Personalização é `components/studio/StudioPersonalizacaoPanel.tsx` (2.479 linhas) mais `TecnicaETesteDaArte.tsx` e `MockupNaFotoSecao.tsx`.

---

## 1. O que existe hoje

A lojista é pequena, usa celular e computador, **configura um produto uma vez e ajusta de vez em quando**. A coluna "Frequência" é com que frequência ela precisa daquilo por produto.

### 1.1 As quatro abas

| Aba | O que mostra e edita | Frequência |
|---|---|---|
| **Dados** (`BasicoForm`) | Galeria de fotos (até 5, a primeira é a capa), nome, preço, estoque, descrição, visível na loja | Todo produto, uma vez |
| **Personalização** | Ver §1.2 | Todo produto personalizável |
| **Ficha técnica** (`StudioFichaTecnicaPanel`, 1.408 linhas) | Composição de insumos, quantidade por unidade, custo total, margem, multiplicador por opção | Rara; é gestão de custo, não personalização |
| **Templates** (`StudioTemplatesPanel`, 795 linhas) | Templates da galeria vinculados a este produto ("Vinculado direto" vs "Global da loja"), modal de vincular por categoria | Rara; só faz sentido se a arte vem da galeria |

### 1.2 A aba Personalização, de cima a baixo

Hoje é uma página só, sem sub-abas, com **onze blocos**, **três prévias independentes** e **cinco interruptores**.

| # | Bloco (rótulo atual) | O que edita | Frequência | Problema |
|---|---|---|---|---|
| 1 | PREVIEW AO VIVO | Chips Frente/Verso/Meio, `EnginePreview` com o texto fixo "João", link "Ver como cliente" | Sempre (é o que ela olha) | No celular fica no topo e some ao rolar; no desktop é coluna fixa, mas divide a coluna com o bloco 2 |
| 2 | MOCKUP DO PRODUTO | Grade "Sem mockup" + todos os modelos publicados (~13 chips com miniatura, selo 3D/2D). Grava na hora | Uma vez | Ocupa a coluna da prévia; o PO já pediu seletor único para a mesma grade na aba Aparência (mockup de 28/09) |
| 3 | ÁREA DE IMPRESSÃO | Frente: L × A em cm + posição (esquerda/centro/direita). Interruptor "Tem verso?" → área do verso + interruptor "Cobrar pelo verso?" + valor. Interruptor "Tem impressão no meio?" → área do meio + "Cobrar pelo meio?" + valor. Avisos de lado sem campo | L × A: uma vez. Verso: às vezes. Meio: raro (caneca) | Quatro interruptores para dizer "frente e verso, verso custa R$ 5". Posição quase nunca muda |
| 4 | CAMPOS · "O que o cliente preenche" | Lista de `FieldRow`: tipo (Texto, Cor, Opção, Template, Imagem), rótulo, obrigatório, lado, subir/descer/excluir. Texto: máx. caracteres. Cor: paleta com preço por cor + presets + picker. Opção: lista com preço + adicionar | Sempre | Cinco tipos com nome técnico ("Template", "Imagem"); a lojista pensa em "arte da cliente". Setas de ordenar em 28 px |
| 5 | ORIGEM DA ARTE | Uma caixa "O cliente precisa escolher uma arte" por lado (grupo imagem + template) | Sempre que há arte | Fica longe do campo a que se refere, com um parágrafo explicando por quê |
| 6 | TÉCNICA DE IMPRESSÃO (app#1003) | Sublimação / DTF / Outra; muda só a prévia | Rara; o padrão por peça acerta | Card inteiro para uma escolha que quase sempre fica no automático |
| 7 | TESTAR COM UMA ARTE (app#1003) | Escolher arquivo → **segunda prévia** (`LivePreview`) com o editor da vitrine (arraste, encaixe, avisos) | Às vezes, ao configurar | Duplica a prévia do bloco 1 logo abaixo dela |
| 8 | MOCKUP NA FOTO | Escolher foto, arrastar 4 cantos, arte de exemplo, salvar posição → **terceira prévia** (`composeView`) | Uma vez, só sem modelo 3D/2D | Aparece mesmo com modelo vinculado, que tem precedência |
| 9 | SERVIÇO PREMIUM | Interruptor "Vocês criam ou ajustam a arte?" + preço de ajuste + preço de criação + parágrafo sobre o briefing | Uma vez; e o valor é o mesmo em toda a loja | É regra da loja, digitada produto a produto. Em produção: 0 produtos com serviço configurado (PERSONALIZACAO_CANONICA, 19/08) |
| 10 | GUIA DE MEDIDAS | Upload de imagem/PDF, abrir, remover | Rara (roupa) | Card inteiro para um upload opcional |
| 11 | Ações e rodapé | "Sugestões IA" (modal de templates por score), "Preview WhatsApp" (modal), barra "Frente: 2 campos · Verso: 1" + Salvar, link "Desativar personalização" | Salvar: sempre. O resto: raro | Salvar não é fixo; no celular fica abaixo de 11 blocos |

Somando o que a lojista percorre num produto simples (camiseta, frente, arte + nome): **três prévias, cinco interruptores, dezesseis cartões e cerca de 4.000 px de rolagem no celular** para preencher quatro coisas: como a peça aparece, onde imprime, o que a cliente escolhe, quanto custa a mais.

### 1.3 O que já está certo e fica

- A forma do dado (`customizationConfig.ts`): ids canônicos, origem da arte como grupo, verso desligado rebaixa campos. O redesenho **não muda o que se grava**.
- O `EnginePreview` como prévia canônica; a caneca 3D com cenário e a camiseta 3D com realismo (app#986, #1008).
- O editor de marcação na foto (`MockupNaFotoSecao`): arraste, teclado, alvos de 44 px.
- A seleção de modelo grava na hora (padrão do interruptor da loja).
- Avisos de "lado sem campo" (QA de 26/09).

---

## 2. O que sai, o que se esconde, o que funde, o que fica na frente

### Fica na frente (o que toda lojista preenche)

| Fica | Como |
|---|---|
| Prévia ao vivo | Uma só, sempre visível: coluna fixa no desktop, faixa fixa no topo no celular (encolhe ao rolar). Recebe o "Testar com a sua arte" e o "Ver na loja" |
| Como a peça aparece | Um seletor de modelo com miniatura (o mesmo do mockup de Aparência de 28/09), no lugar da grade de 13 chips |
| Onde imprime | Chips **Frente · Verso · Volta inteira** com L × A por lado ativo e "a mais R$" por lado extra (vazio = sem cobrança). Substitui os quatro interruptores |
| O que a cliente escolhe | Cartões em linguagem dela: **Arte da cliente**, **Texto**, **Cor da peça**, **Opção**. Obrigatório e lado dentro do cartão |
| Salvar | Barra fixa no rodapé com o resumo e a marca de "alterações não salvas" |

### Funde

| Hoje | Vira |
|---|---|
| Campos **Imagem** + **Template** + caixa **Origem da arte** | Um cartão **Arte da cliente** por lado: "Enviar arquivo" e/ou "Escolher da galeria", e uma caixa "Obrigatório". É exatamente o grupo que a forma canônica já grava; a UI só passa a parecer com o dado |
| Aba **Templates** | Dentro do cartão Arte, opção "Escolher da galeria": "Todos os 12 da loja" ou "Só alguns" (abre o vinculador atual como modal) |
| **Testar com uma arte** (segunda prévia) | Botão "Testar com a sua arte" na própria prévia; o arquivo substitui a arte de exemplo, com o mesmo editor da vitrine |
| **Mockup na foto** (terceira prévia) | Só aparece quando o seletor está em "Usar a foto do produto", como botão "Marcar a área na foto" que abre o editor atual em modal |
| "Tem verso?" + "Cobrar pelo verso?" + valor | Chip Verso + um campo "a mais R$" (vazio = grátis) |
| "Desativar personalização" no rodapé + tela vazia com CTA | Um interruptor no topo da aba: "Este produto aceita personalização". Desligado, a aba mostra só ele |
| "Sugestões IA" | Botão "Sugerir da galeria" dentro do cartão Arte, só quando a galeria está ligada |

### Vai para "Avançado" (fechado por padrão, com resumo do que está escolhido)

- **Técnica de impressão**: "Automática (DTF para camiseta)" por padrão.
- **Posição da área** (esquerda/centro/direita) por lado.
- **Limite de caracteres** do texto: padrão 30, editável aqui.
- **Guia de medidas** (upload).
- **Serviço de arte** deste produto, quando for diferente do padrão da loja (ver decisão 1).

### Sai da ficha

- **Preview WhatsApp** como modal próprio: vira um ícone "Enviar no WhatsApp" ao lado de "Ver na loja", na prévia. Continua existindo, sem card.
- **Aba Ficha técnica**: não sai do app, mas sai da ficha de personalização. Proposta: terceira aba, renomeada **Custo**, sem redesenho agora (decisão 3).
- Os parágrafos explicativos dentro dos cards. A explicação vai para um "?" ao lado do rótulo ou some.

---

## 3. A nova arquitetura

### 3.1 Abas: de quatro para três

```
[ Produto ]  [ Personalização ]  [ Custo ]
```

- **Produto**: foto, nome, preço, estoque, descrição, visível na loja (a aba Dados de hoje, renomeada).
- **Personalização**: a ficha redesenhada abaixo.
- **Custo**: a Ficha técnica de hoje. Só o nome muda.

Templates deixa de ser aba.

### 3.2 A aba Personalização

Uma página, cinco blocos e um "Avançado", com a prévia sempre à vista.

```
┌─ Prévia ─────────────────┐  ┌─ Formulário ───────────────────────────────┐
│ Frente · Verso           │  │ (•) Este produto aceita personalização      │
│                          │  │                                             │
│      [ peça 3D/2D ]      │  │ 1  Como a peça aparece na loja              │
│                          │  │    [ ▾ Camiseta 3D · frente e verso  ]      │
│ Testar com a sua arte    │  │                                             │
│ Ver na loja · WhatsApp   │  │ 2  Onde imprime                             │
└──────────────────────────┘  │    [Frente ✓] [Verso ✓] [Volta inteira]     │
                              │    Frente  28 × 38 cm                       │
                              │    Verso   28 × 38 cm   a mais R$ 8,00      │
                              │                                             │
                              │ 3  O que a cliente escolhe   [+ Adicionar]  │
                              │    ▣ Arte da cliente · frente · obrigatório │
                              │    ▣ Nome na peça · texto · opcional        │
                              │    ▣ Arte da cliente · verso                │
                              │                                             │
                              │ 4  Serviço de arte   Ajuste R$ 15 · Criação R$ 40 (padrão da loja) │
                              │                                             │
                              │ ▸ Avançado  Técnica automática · Centro · 30 letras │
                              ├─────────────────────────────────────────────┤
                              │ Frente: 2 · Verso: 1     [ Salvar ]         │
                              └─────────────────────────────────────────────┘
```

No celular a prévia é uma faixa fixa no topo (peça a 150 px com os chips de lado), que encolhe para 72 px ao rolar; os blocos vêm abaixo e a barra de Salvar é fixa no rodapé.

### 3.3 Padrões sensatos (produto novo)

Ao ligar a personalização, a ficha já nasce preenchida com o caso mais comum, e a lojista só corrige o que for diferente:

| | Padrão |
|---|---|
| Modelo | O primeiro modelo compatível com a categoria (camiseta → Camiseta 3D; caneca → Caneca 3D); senão "Usar a foto do produto" |
| Onde imprime | Só Frente, com o L × A do modelo (camiseta 28 × 38, caneca 20 × 8) |
| O que a cliente escolhe | **Arte da cliente** (enviar arquivo, obrigatório) e **Nome na peça** (texto, opcional, 30 letras) |
| Serviço de arte | O padrão da loja |
| Avançado | Técnica automática, área centralizada, sem guia de medidas |

Isso é o `sanitizeConfig` de hoje (que já cria "Nome a estampar") estendido para incluir a arte, que hoje é o campo que toda loja acaba adicionando.

### 3.4 O que muda e o que não muda no código (para a fase seguinte)

- **Não muda**: `customizationConfig.ts`, o que se grava, `EnginePreview`, o editor de marcação, `studioVisualApi.setProductVisualTemplate`, as validações de lado.
- **Muda**: `StudioPersonalizacaoPanel.tsx` (a UI), `ProductExpanded` em `estoque.tsx` (três abas), `TecnicaETesteDaArte.tsx` (a técnica vai para Avançado; o teste com arte vai para a prévia), `MockupNaFotoSecao.tsx` (vira modal condicionado ao seletor).
- **Modais**: os que a ficha abre são de um passo só (tipo de campo, marcar na foto, escolher templates). Se algum virar multi-passo, segue o `TrocaModal`.
- **Toque**: nenhuma ação escondida atrás de hover. Mover e excluir campo são ícones sempre visíveis, com 44 px.

### 3.5 Contagem

| | Hoje | Proposta |
|---|---|---|
| Abas | 4 | 3 |
| Blocos na aba Personalização | 11 | 5 + Avançado |
| Prévias | 3 | 1 |
| Interruptores | 5 | 1 |
| Tipos de campo no menu | 5 (Texto, Cor, Opção, Template, Imagem) | 4 (Arte, Texto, Cor da peça, Opção) |
| Rolagem no celular, camiseta frente e verso | ~4.000 px | ~1.700 px |

---

## 4. Decisões que precisam do PO

1. **Serviço de arte é regra da loja ou do produto?** Recomendação: padrão da loja em *Loja digital › Configurações* e, na ficha, só "usa o padrão da loja" com override em Avançado. Precisa de coluna nova no backend (`studio_settings.art_service_defaults`) antes do app.
2. **Templates deixa de ser aba?** Recomendação: sim; vira "Escolher da galeria" dentro do cartão Arte. O vinculador atual sobrevive como modal.
3. **Ficha técnica fica como terceira aba "Custo" ou vai para outro lugar?** Recomendação: fica como aba, renomeada, sem redesenho nesta rodada.
4. **Sugestões IA de templates**: manter (dentro do cartão Arte) ou aposentar? Recomendação: manter como botão discreto; se ninguém usa em 30 dias, aposentar.
5. **Salvar explícito ou automático?** Recomendação: explícito com barra fixa e marca de "não salvo" (como hoje), porque a validação de lado sem campo precisa de um momento para avisar.
