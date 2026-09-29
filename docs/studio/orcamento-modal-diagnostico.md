# Orçamento do Studio — diagnóstico do modal e proposta de redesenho

29/09/2026 · fase de desenho, sem código de produção.
Mockup: [`docs/mockups/studio-orcamento-modal.html`](../mockups/studio-orcamento-modal.html)

Pedido do PO: "não dá para vincular modelo de mockup; a lista de produtos só aparece ao digitar; o modal fica com botões desproporcionais; está fora do padrão dos modais do Shell Negócio".

## 1. O que existe hoje

O "modal de orçamentos" é, na verdade, quatro peças com quatro visuais diferentes:

| Peça | Onde | Forma |
|---|---|---|
| Editor do orçamento | `app/studio/(estudio)/gestao/orcamentos/[id].tsx` | Página inteira (`StudioScreen`), seções empilhadas, pilha de botões no fim |
| Adicionar item | `[id].tsx:199–411` (`AddItemModal`) | Folha de baixo (`Modal` + `justifyContent: flex-end`), também no desktop |
| Orçamento em vídeo 3D | `components/studio/orcamentoVideo/OrcamentoVideoModal.tsx` | Painel centralizado no DNA do TrocaModal (aprovado 28/09) |
| Cliente pediu ajuste | `components/studio/orcamentoVideo/PedidoDeAjusteModal.tsx` | Folha de baixo |
| Orçamento do PDV (PDF) | `components/studio/pdv/QuoteModal.tsx` | Painel 460 px, sem persistir; outro conceito com o mesmo nome |

## 2. Problemas, com arquivo e linha

### A. A lista de produtos só aparece ao digitar
- `[id].tsx:202` abre com `results = []`; `[id].tsx:307` só busca com 2+ letras (`if (v.length >= 2) doSearch(v)`), uma chamada por tecla e sem debounce (`:224–227`).
- Não há categoria, "mais usados" nem "recentes". O catálogo do PDV já traz tudo de uma vez com categoria e foto (`components/studio/pdv/useStudioCatalog.ts:42–63`), mas o orçamento não o usa.
- Depois de adicionar, a folha fecha (`:271`): para três peças são três aberturas.

### B. Não dá para vincular o modelo de mockup ao item
- `StudioQuoteItem` não tem chave de modelo (`services/studioApi.ts:589–599`). O item guarda só `product_id`, `description`, `quantity`, `unit_price`, `customization`.
- O vídeo 3D descobre o modelo pelo produto (`pecaDoOrcamento.ts:44–50`, `carregarFontes` → `getProductVisualTemplate`). Sem modelo no produto, o modal manda a lojista sair do fluxo: "vincule um modelo 3D em Loja digital › Aparência" (`OrcamentoVideoModal.tsx:424–425`).
- A ficha nova (app#1012) já tem o seletor pronto (`components/studio/mockupPorProduto/SeletorDeModelo.tsx`, `MiniaturaDoModelo.tsx`, `useSpecsDosModelos.ts`), com popover no desktop, folha no celular, teclado e modo toque. Nada disso chega ao orçamento.

### C. Botões desproporcionais
- Fim do editor (`[id].tsx:1089–1159`): até três botões cheios e coloridos empilhados — "Salvar rascunho" (navy, `paddingVertical 16`), "Enviar ao cliente" (azul info, 16), "Enviar em vídeo 3D" (magenta, 14) — e, quando enviado, mais três ("Aprovar" verde, "Fechar", "Cliente pediu ajuste" âmbar). Não há um primário: há cinco (`:1306–1335`).
- "Adicionar item" é um chip de ~28 px de altura (`:1265–1271`, `paddingVertical 6`); o X da folha não tem área de toque (`:297`, ícone de 20 px); a lixeira do item tem 27 px (`:1287`). Alvo mínimo de 44 px no celular não é cumprido.
- Dentro da folha, escolher produto é um toque na linha e item avulso é um botão cheio primário (`:364–366`): dois modelos de interação para a mesma ação.

### D. Fora do padrão dos modais do Shell Negócio
- Referência: `components/screens/pdv/TrocaModal.tsx:625–709` e `components/screens/estoque/ItemFormModal.tsx:1268–1343` — painel centralizado (max 960–1040 px), cabeçalho com ícone + título + subtítulo + X de 32 px, corpo com rolagem, rodapé com resumo à esquerda e botões à direita (`btnSec`/`btnPri`, 11 px vertical, raio 10, 13,5 px), confirmação de saída.
- O editor é uma página; a folha de item vai até o fim da tela no desktop de 1440 px sem `maxWidth` (`[id].tsx:377–378`); o pós-envio troca a tela inteira por um cartão "Link gerado!" (`:715–747`) enquanto o vídeo termina em "Enviado" dentro do modal (`OrcamentoVideoModal.tsx:712–721`). Dois envios, dois finais.

### E. Conflitos entre o editor e o modal de vídeo
- Validade e sinal vivem duas vezes: editor (`[id].tsx:1021`, `:1031`) e passo 2 do vídeo (`OrcamentoVideoModal.tsx:566–568`). O PDF do PDV tem uma terceira validade em chips (`QuoteModal.tsx:88`).
- As condições de pagamento (Pix, parcelas, prazo) só existem no passo 2 do vídeo (`OrcamentoVideoModal.tsx:140–159`): quem manda pelo link não as define.
- Quantidade e preço de um item não podem ser editados depois de adicionados (`[id].tsx:989–1011` só remove); para mudar a quantidade a lojista tira e põe de novo, e volta com 1.

### F. Multi-CNPJ
- No consolidado a lista mostra "Nenhum orçamento" (`orcamentos.tsx:85`, `!companyId` → lista vazia) em vez de pedir a loja. O editor "nem carrega" (`[id].tsx:444–446`).

## 3. Proposta

**Um modal só, no molde do cadastro de item (app#859, `ItemFormModal`): painel aberto e centralizado sobre a lista, duas colunas no desktop, tela cheia no celular.** A lista de orçamentos continua a página; "Novo orçamento" e o clique numa linha abrem o modal (a rota `/orcamentos/[id]` segue existindo e abre a lista com o modal aberto).

```
┌ Orçamento · Mariana Costa                   [Rascunho] [Ateliê Lume · Centro]  ✕ ┐
│ 3 itens · edite quantidade, preço e o modelo de cada peça                          │
├───────────────────────────────────────┬──────────────────────────────────────────┤
│ PEÇAS (3)              [+ Adicionar]  │ CLIENTE  nome · WhatsApp                  │
│ ▸ Caneca · 12 × 39,90 · 3D  478,80    │ CONDIÇÕES validade (chips) · sinal ·      │
│ ▾ Camiseta · 1 × 59,90 · 2D           │           Pix · parcelas · prazo · obs.   │
│   qtd [− 1 +]  preço [59,90]          │ RESUMO   subtotal · desconto · total      │
│   Modelo do mockup [🖼 Camiseta 2D ▾] │ ACOMPANHAMENTO (depois do envio)          │
│   Arte do cliente [Helena]  Tirar     │   enviado · abriu · vídeo guardado        │
├───────────────────────────────────────┴──────────────────────────────────────────┤
│ 3 itens · R$ 532,80          [Cancelar] [Salvar rascunho] [Enviar pelo WhatsApp →] │
└──────────────────────────────────────────────────────────────────────────────────┘
```

1. **Escolher produto sem digitar.** "Adicionar" troca a coluna de peças pelo catálogo (no celular, o corpo inteiro): busca, chips de categoria, "Mais usados", "Recentes" e "Todos", com miniatura, preço e selo do modelo (3D/2D/Sem mockup). Tocar na linha adiciona e a lojista continua escolhendo; "Concluir" volta às peças. "Item avulso" é um chip no topo do catálogo que abre um formulário em linha. Fonte: o mesmo `GET /studio/products` do PDV, carregado uma vez.
2. **Modelo de mockup por item.** A linha expandida tem "Modelo do mockup" com o seletor da ficha (`SeletorDeModelo` + `MiniaturaDoModelo` + `useSpecsDosModelos`) e uma prévia pequena. Padrão: **herdado do produto**; a troca vale só neste orçamento. Precisa de `studio_quote_items.visual_template_key` (nulo = herda) e de `carregarFontes` aceitar a chave do item antes da do produto. O vídeo 3D passa a ler o modelo do item.
3. **Hierarquia dos botões.** Rodapé como no TrocaModal: um primário, o resto secundário ou terciário, 44 px no celular. Por estado: rascunho → *Enviar pelo WhatsApp*; enviado → *Aprovar* (secundário "Cliente pediu ajuste", terciário "Fechar sem venda"); ajuste pedido → *Reenviar*; aprovado → *Ver pedido*.
4. **Um fluxo só.** As condições (validade, sinal, Pix, parcelas, prazo, observação) passam a viver no orçamento; o wizard de vídeo perde o passo "Valores" e fica com Peça → Prévia → Enviar → Enviado, sem repetir campo. O envio por link vira um canal dentro do passo Enviar, não um botão paralelo. O "Cliente pediu ajuste" continua a folha aprovada de 28/09, aberta pelo rodapé.
5. **Estados no mesmo modal.** Vazio, com peças, escolhendo produto, vídeo gerado, enviado, ajuste pedido e aprovado — todos no mockup, nos temas claro e escuro, em 1440 e 390 px.
6. **Multi-CNPJ.** No consolidado, "Novo orçamento" pede a loja antes de abrir e o cabeçalho mostra o chip da loja; a lista consolidada mostra a loja em cada linha. Tudo dentro do modal usa a empresa do orçamento.
7. **Toque.** Nada de hover-reveal: expandir, tirar e trocar modelo são controles visíveis. O seletor de modelo já tem o modo toque da ficha.

## 4. Decisões para o PO

| # | Decisão | Recomendação |
|---|---|---|
| 1 | O editor vira modal sobre a lista (molde app#859) ou continua página com só a folha de item refeita? | **Modal**: é o que unifica com o Shell Negócio e resolve a pilha de botões; a rota continua. |
| 2 | Condições saem do wizard de vídeo e vão para o orçamento? | **Sim**: acaba com validade e sinal em dois lugares; o vídeo fica com 3 passos. |
| 3 | O envio por link continua como botão paralelo? | **Vira canal** dentro de Enviar. Um primário só. |
| 4 | "Mais usados" e "Recentes": endpoint no backend ou histórico local do navegador? | **Backend** (`GET /studio/quotes/produtos-frequentes?days=90`): vale em qualquer aparelho e por CNPJ. |
| 5 | Modelo do item: coluna nova `visual_template_key` em `studio_quote_items` (nulo = herda)? | **Sim**, migration aditiva; o pedido aprovado nasce com o modelo do item. |

## 5. Fora do escopo desta fase
- O `QuoteModal` do PDV (PDF sem persistir) não muda; fica registrado que o nome colide.
- A página pública `/orcamento/:token` não muda.
