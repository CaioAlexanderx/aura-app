# Faseamento da normalização da Vitrine Studio

**Data:** 24/09/2026 · **Autor:** Tech Lead · **Para:** Project Manager e PO (Caio) · **Base:** `docs/studio/JORNADA_CLIENTE_VITRINE.md`

> O documento de jornada diz **o que** o cliente precisa viver. Este diz **em que ordem, com que dependências, em quanto tempo e com que risco** a gente entrega. Onde a leitura técnica mudou uma recomendação da jornada, a mudança está na §3 com a evidência.

---

## 1. Em uma página

| Fase | Nome | Janela | Dias úteis | Vai ao ar |
|---|---|---|---|---|
| 0 | Preparação | 25/09 – 30/09 | 4 | — |
| 1 | Alicerce | 01/10 – 16/10 | 11 | Em 3 ondas, direto |
| 2 | Fechar a venda | 19/10 – 13/11 | 19 | Atrás de flag; liga na Sheid em 09/11 se passar no go/no-go |
| 3A | Produto: ganhos rápidos | 16/11 – 19/11 | 4 | Direto |
| ❄ | **Congelamento de temporada** | 23/11 – 31/12 | — | Só correção no caminho da compra |
| 3B | Página do produto nova | constrói 23/11 – 18/12 | 15 | Liga 05/01 – 15/01 |
| 4 | Pós-compra com a marca | constrói 07/12 – 18/12 | 8 | Liga junto com a 3B |
| 5 | Home e navegação | 18/01 – 05/02/2027 | 15 | Direto; flag removida no fim |

**Fim do projeto:** 05/02/2027, antes do Carnaval (08 e 09/02).

**As três coisas que o PM precisa guardar:**
1. **O dinheiro vem antes da vitrine.** Checkout, Pix e confirmação (Fase 2) entram antes da página do produto nova. Hoje um F5 apaga a confirmação e o status do Pix é fixo. Isso custa venda todo dia; o layout do configurador, não.
2. **Novembro e dezembro são da Sheid, não nossos.** Black Friday em 27/11 e Natal são o pico de quem vende caneca personalizada. O caminho da compra congela de 23/11 a 31/12. O trabalho grande de produto é construído nesse período atrás de uma chave por loja e liga em janeiro.
3. **O gargalo não é código, é QA e decisão.** O redesign da loja Negócio saiu em seis PRs num dia (02/09) e precisou de mais treze de correção vindas do QA (#651–#661, #678–#683). Este plano orça QA do mesmo tamanho que desenvolvimento.

---

## 2. Premissas de capacidade

- **Time:** Tech Lead implementando com sessões do Claude Code nos dois repositórios; Caio como PO, aprovador de mockup e QA de negócio; Sheid Mania como piloto (conteúdo e teste de aceite).
- **Unidade:** dia útil de ponta a ponta (desenvolvimento, revisão, QA no celular e deploy). As faixas da §4 já têm ~20% de folga.
- **Concorrência com Matcon:** de 17 a 23/09 todos os commits foram de Matcon, PWA, Caixa e Estoque; a vitrine Studio não recebe commit desde 05/09. **Se o Matcon continuar dividindo a semana, as datas escorregam na mesma proporção.** Decisão do PM (Q11).
- **Regras do repositório que viram prazo:** backend mergeado e migration aplicada antes do PR do app que depende dela; mockup HTML aprovado antes de código em mudança visual forte (CLAUDE.md, armadilha 4).
- **Feriados no caminho:** 12/10 (N. Sra. Aparecida), 02/11 (Finados), 20/11 (Consciência Negra).

---

## 3. O que mudou em relação ao documento de jornada

A leitura do código mexeu em cinco pontos. Cada um tem a evidência.

### 3.1 Errata: três itens já estão prontos
O documento de jornada listava como pendentes na página do produto:
- **Galeria de fotos (S9):** já é lida na vitrine (`ProductConfigurator.tsx:240`, `ProductList.tsx:315`, `GradeDeModelos.tsx:100`).
- **Cor da louça no 3D:** já chega ao motor (`LivePreview.tsx:290` passa `garmentColor`).
- **Sombra e ambiente no mockup (S10):** já existem (`compose3dMug.ts:233` usa `PMREMGenerator`; `:310` e `:350` projetam sombra).

O que continua pendente é o **mockup como slide do carrossel**: hoje ele é um bloco separado (`ProductConfigurator.tsx:390`). A Fase 3B fica menor.

### 3.2 As rotas precisam de backend primeiro
O middleware de domínio reescreve `loja.getaura.com.br/<slug>/<resto>` para `/storefront/<slug>/<resto>` (`Aura-backend/src/middleware/customDomain.js:146-160`). Só `/page` e `/p/:id` servem a casca da vitrine Studio (`storefront.js:370-372`). Um `/<slug>/sacola` ou `/<slug>/pedido/<token>` daria **404 do servidor antes de o app carregar**.

Tem mais: o robô que monta a prévia do link no WhatsApp e no Instagram **não roda JavaScript**. A casca só injeta o slug (`vitrineStudioShell.js`, função `recadoParaOApp`). Sem o servidor escrever `og:title` e `og:image` do produto na casca, o "Compartilhar" manda um link sem foto. Por isso o item **BE-1** vem antes de tudo na Fase 1B.

### 3.3 A confirmação persistente também precisa de backend
`GET /:slug/studio/order/:oid` devolve status e política de revisão, **mas não o código do Pix** (`studioStorefront.js:1389-1420`). Recarregar a confirmação não teria como mostrar o QR de novo. O item **BE-2** cria a leitura por `public_token`, que já existe no pedido (migration 322).

Boa notícia do mesmo lado: "Anexar comprovante" e "Já paguei" da loja comum **não filtram por vertical** (`storefront.js:908` e `:954`). O Studio reaproveita as duas rotas sem backend novo.

### 3.4 A ordem mudou
Jornada propunha: Fundações → Produto → Checkout → Pós-compra → Home. Proposta agora: **Fundações → Checkout e Pix → Produto (ganhos rápidos) → congelamento → Produto novo + Pós-compra → Home.** Motivos:
- O checkout é onde a venda se perde hoje, e o redesign dele é um porte da Negócio: risco baixo, desenho já validado.
- A página do produto nova é o item mais caro e o mais visível. Colocá-la no ar em novembro é arriscar a Black Friday da única loja piloto.
- A home de hoje é razoável e janeiro tem tráfego baixo: melhor época para mexer na porta de entrada.

### 3.5 Duas coisas subiram para a Fase 1
- **"Fechar pedidos" e "Pedidos até 20/12" no painel.** A vitrine já sabe mostrar isso (`modoDaLoja`, `avisoDePrazo` com teste e sem uso), mas não existe rota de escrita nem tela. Sem isso, a Sheid não consegue encerrar a temporada de Natal pela loja.
- **Eventos de GA4 e Pixel.** Para medir se a Fase 2 melhorou a conversão, a linha de base tem que existir antes dela.

---

## 4. As fases

Legenda de lado: **BE** = Aura-backend · **APP** = aura-app · **DES** = mockup · **DADO** = conteúdo com a lojista.

### Fase 0 — Preparação · 25/09 a 30/09 · 4 d.u.
**Objetivo:** ninguém começa a codar esperando resposta.

| Entrega | Lado | Dono |
|---|---|---|
| Decisões Q1–Q12 da §7 registradas | — | PM + PO |
| Quadro com épicos por fase e issues por item | — | PM |
| Loja de teste Studio publicada (`is_sandbox`) com produtos reais copiados da Sheid | BE/DADO | TL |
| Chave por loja `vitrine_v2` em `pdv_settings` desenhada | BE/APP | TL |
| Pedido de conteúdo à Sheid (S7: fotos, cores reais, faixas de desconto, preço de arte, área de impressão), prazo 30/10 | DADO | PM |
| Mockup da Fase 2 (sacola, checkout, Pix, confirmação) começa | DES | TL |

**Pronto quando:** decisões escritas, quadro aberto, loja de teste no ar.

---

### Fase 1 — Alicerce · 01/10 a 16/10 · 9 a 12 d.u.
**Objetivo:** a loja fica com a mesma cara em todas as telas, ganha endereço de verdade, sabe fechar a temporada e passa a ser medida.

**Onda 1A — Casa arrumada** (APP, 01/10 a 06/10)
- Fonte do Studio em todas as telas (hoje produto, checkout, confirmação e carrinho pedem a fonte da loja comum e caem em Georgia).
- Tema `papel` em todas as telas; fim da paleta antiga (azul-marinho nos botões de opção, magenta, `#fff` fixo sobre a cor da loja).
- `Texto` no lugar de `Text` puro em rodapé, grade de modelos e componentes de UI.
- Ícones no lugar dos nove emojis; "Powered by" sai do fixo; aviso de cookies não cobre a barra.
- Estado de erro com voz e "tentar de novo"; esqueleto respeita "reduzir movimento"; `console.log` removidos.
- **Visível para a Sheid:** a loja com cor clara fica legível e a fonte não muda ao entrar no produto.

**Onda 1B — Endereços** (BE → APP, 05/10 a 14/10)
- **BE-1:** loja Studio serve a casca para qualquer caminho da loja, exceto os de API (`order`, `shipping-quote`, `studio/*`…); a casca ganha `<title>`, `og:title`, `og:image` e `og:url` do produto quando o caminho é `/p/<id>`.
- **APP:** rotas `app/[slug]/…` (home, categoria, produto, sacola, finalizar, pedido, orçamento); a tela atual passa a vir da rota; o voltar do navegador funciona; botão Compartilhar; deep link da Aurinha (`?produto=`, `origem`, `conversa`).

**Onda 1C — Temporada e medição** (BE → APP, 07/10 a 16/10)
- **BE-3:** rotas de escrita para `pedidos_pausados`, `pedidos_ate` e `courier_pickup_enabled`.
- **APP painel:** tela "Pedidos pela loja" com fechar/abrir, recado e data limite; chave de retirada por app.
- **APP vitrine:** aviso "Pedidos até 20/12" na home e no produto; loja fechada respeitada também na sacola e no checkout.
- Eventos `view_item`, `add_to_cart`, `begin_checkout`, `purchase` e `share` no GA4 e no Pixel, atrás do consentimento.
- Primeiros testes de tela do fluxo lista → produto → checkout (Testing Library já está no projeto).

**Dependências:** BE-1 e BE-3 mergeados antes dos PRs do app que os usam.

**Demo de 16/10 (critério de aceite):**
1. A Sheid copia o link de uma caneca, cola no WhatsApp, e aparece a prévia com foto e nome.
2. Quem recebe abre direto na caneca; o voltar do navegador volta para a loja.
3. A loja de teste com cor amarela está legível em todas as telas.
4. A lojista configura "Pedidos até 20/12" e a vitrine mostra o aviso.
5. O GA4 da loja de teste recebe os cinco eventos.

**Gate de design:** mockup da Fase 2 aprovado até **09/10**.

---

### Fase 2 — Fechar a venda · 19/10 a 13/11 · 14 a 19 d.u.
**Objetivo:** o cliente termina o pedido no celular sem se perder, paga o Pix e vê o status mudar sozinho.

| Item | Lado | Observação |
|---|---|---|
| **BE-2** Pedido por token: status, itens com miniatura, código do Pix enquanto pendente | BE | Base da confirmação persistente |
| **BE-4** Job de Pix vencido passa a incluir o Studio, com o prazo da decisão Q7 | BE | Hoje o job exclui o Studio |
| **BE-5** Cotação do carrinho no servidor | BE | Acaba com as regras de preço copiadas no app, que viram erro 400/409 no pagamento |
| Verificar e-mail de confirmação ao cliente no Studio | BE | A Negócio manda; confirmar se o Studio dispara |
| Sacola em gaveta com a miniatura do mockup; editar volta para a sacola | APP | |
| Checkout em 3 etapas portado da Negócio: rótulos, CEP primeiro com ViaCEP, CPF/CNPJ, dados salvos, guarda de pedido duplicado | APP | |
| Retirada com endereço e prazo; retirada por app; política de revisões acima do botão | APP | Campos já chegam no payload |
| Tela do Pix: comprovante, "Já paguei", consulta a cada 4 s, status que muda | APP | Reaproveita rotas da loja comum |
| Retorno do cartão com status real | APP | |
| Confirmação em `/<slug>/pedido/<token>` | APP | Depende de BE-2 |
| Mensagem do WhatsApp com os nomes e preços que a tela mostra | APP | Hoje manda "designer", "M" e preço de tabela |
| Lote rápido: colar coluna da planilha, máscara de telefone, data com seletor, número do orçamento | APP | O corporativo compra em novembro |

**Liberação:** atrás da chave `vitrine_v2`. Liga na loja de teste em 03/11, na Sheid em 09/11.

**Go/no-go de 13/11:** se houver erro de pagamento aberto ou taxa de 409 acima da de hoje, a chave da Sheid desliga e o checkout atual atravessa a temporada. Nada se perde: a chave volta a ligar em janeiro.

**Demo de 06/11:**
1. Pedido completo no celular em menos de 2 minutos, do produto ao Pix.
2. F5 na confirmação mantém o pedido e o QR.
3. Pix pago na loja de teste muda o status sem ninguém tocar na tela.
4. Pedido no cartão volta para a loja com o status certo.

**Gate de design:** mockup da Fase 3B aprovado até **13/11**.

---

### Fase 3A — Produto: ganhos rápidos · 16/11 a 19/11 · 3 a 4 d.u.
**Objetivo:** o que ajuda o comprador corporativo de fim de ano, sem mudar o layout.
- Quantidade digitável.
- Escada de desconto como régua ("Leve 50 e pague R$ X cada") e prazo por faixa de tiragem.
- "Adicionado à sacola" com retorno visual.
- Área de impressão com uma fonte só (decisão pendente da F1, §3.3).

Mudanças aditivas, vão direto ao ar.

---

### ❄ Congelamento de temporada · 23/11 a 31/12
- **Em produção:** só correção de defeito no caminho da compra, com revisão do TL e teste no celular.
- **Pode ir ao ar:** telas do painel da lojista que não tocam a compra.
- **O time constrói atrás da chave:** Fases 3B e 4.
- **Plantão:** TL responde defeito do caminho da compra no mesmo dia útil.

---

### Fase 3B — Página do produto nova · constrói 23/11 a 18/12 · liga 05/01 a 15/01 · 12 a 15 d.u.
**Objetivo:** o configurador vira a vitrine da arte do cliente.
- Duas colunas no desktop, uma no celular, conforme a tabela da jornada §4.4.
- **Mockup como slide do carrossel**, ativo assim que o cliente personaliza; carrossel com zoom, setas, arrastar e bolinhas.
- Os três caminhos de arte como cartões com preço; aviso de imagem de baixa resolução antes de fechar.
- Abas Frente · Verso · Meio; barra fixa com "o que falta", "Adicionar à sacola" e "Comprar agora".

**Depende de:** mockup aprovado (13/11) e conteúdo da Sheid (30/10). Sem as fotos e as cores reais, a página nova parece vazia.

**Liberação:** loja de teste em 05/01, Sheid em 12/01 após demo.

---

### Fase 4 — Pós-compra com a marca · constrói 07/12 a 18/12 · liga com a 3B · 6 a 8 d.u.
**Objetivo:** do link no WhatsApp ao "Pronto", o cliente continua na mesma loja.
- **BE-6:** logo, cor e fonte da loja nos dados públicos de aprovação e de acompanhamento.
- **APP:** `/aprovacao` e `/acompanhar` com o tema da loja (hoje azul-marinho fixo, `app/aprovacao/[token].tsx:79`); "Pedir outro igual" abre o configurador preenchido.
- **Decisão Q9:** mover essas páginas para o endereço da loja (`/<slug>/acompanhar/<token>`). Com o BE-1 pronto, custa pouco.

---

### Fase 5 — Home e navegação · 18/01 a 05/02/2027 · 12 a 15 d.u.
**Objetivo:** a porta de entrada da loja com a mesma qualidade do resto.
- Cabeçalho preso com logo, busca e sacola, junto com a barra de categorias.
- Hero com os três banners, botão e destino interno; sem banner, o mockup do produto mais pedido girando.
- Faixa de anúncio e selos da aba Design; âncoras de categoria que rolam até a grade; trilha de categorias.
- Prévia da aba Design mostrando a vitrine Studio; aba Aparência com fundo e borda corretos.
- **Fim:** chave `vitrine_v2` removida do código; retrospectiva.

**Gate de design:** mockup aprovado até **11/12** (feito durante o congelamento).

---

## 5. Caminho crítico e dependências

```
BE-1 casca em todo caminho ──► rotas no app ──► BE-2 pedido por token ──► checkout + Pix + confirmação ──► go/no-go 13/11
                                                                                                          │
Mockup F2 (09/10) ─────────────────────────────────────────────────────────► Fase 2                        ▼
Mockup F3B (13/11) ──► Fase 3B ◄── Conteúdo Sheid (30/10)                                  liga em janeiro
BE-3 escrita de "pedidos até" ──► painel da temporada ──► Sheid encerra o Natal pela loja
```

Os três atrasos que empurram o projeto inteiro: **BE-1**, a **aprovação do mockup da Fase 2** e o **conteúdo da Sheid**.

---

## 6. Riscos

| # | Risco | Prob. | Impacto | Mitigação | Dono |
|---|---|---|---|---|---|
| R1 | A casca em todo caminho engole rotas de API da loja (pedido, frete) | Média | Alto | Só para loja Studio; lista explícita de caminhos reservados; ampliar `lojaServeVitrineStudio.test.js` | TL |
| R2 | Link compartilhado sem prévia | Alta sem BE-1 | Médio | Meta tags no servidor; testar no depurador de links do Facebook e no WhatsApp real | TL |
| R3 | Checkout novo falha perto da Black Friday | Média | Alto | Chave por loja + go/no-go em 13/11 | PM |
| R4 | Conteúdo da Sheid atrasa | Alta | Médio | Pedido na Fase 0, prazo 30/10, acompanhamento semanal; 3B liga sem o conteúdo só se a demo passar | PM |
| R5 | Matcon consome a capacidade | Alta | Alto | Reservar dias da semana para a vitrine; replanejar datas se não houver reserva | PM |
| R6 | Regras de preço copiadas no app divergem do servidor | Média | Alto | BE-5 (cotação no servidor) | TL |
| R7 | three.js por CDN no caminho do mockup | Baixa | Médio | Fora do escopo; o mockup cai para 2D se o 3D falhar | TL |
| R8 | Regressão sem teste de interface | Alta | Médio | Testes de tela na 1C viram parte do "pronto" | TL |
| R9 | A casca fica 10 min em cache: deploy e rollback demoram até 10 min para chegar | Certa | Baixo | Saber disso na hora do incidente; `limparCache` disponível | TL |

---

## 7. Decisões para o PM e o PO

Q1 a Q8 vêm da jornada §8, com a recomendação de lá. As novas:

| # | Pergunta | Recomendação | Prazo |
|---|---|---|---|
| Q1–Q8 | As da jornada (rotas, sacola em gaveta, quantidade digitável, CPF/CNPJ, "Powered by", cor de destaque, prazo do Pix, ordem) | Como na jornada; a Q8 (ordem) foi revista na §3.4 | 30/09 |
| Q9 | Aprovação e acompanhamento no endereço da loja? | Sim, na Fase 4 | 11/12 |
| Q10 | Critérios do go/no-go de 13/11 | Os da Fase 2 | 30/09 |
| Q11 | Quantos dias por semana a vitrine tem garantidos frente ao Matcon? | No mínimo 4 de 5 até 13/11 | 30/09 |
| Q12 | Chave por loja `vitrine_v2` | Sim; é o que permite construir em dezembro | 30/09 |

---

## 8. Como vamos trabalhar

**Pronto quer dizer:**
- Backend mergeado e migration aplicada antes do PR do app que depende dele.
- Testes das regras e, a partir da 1C, teste de tela do trecho mexido.
- Testado no celular (Safari no iPhone e Chrome no Android) na loja de teste.
- Mockup aprovado, quando a mudança é visual.
- Evento de medição do trecho funcionando.

**Ritos:**
- 30 minutos por semana entre TL e PM: cada fase com verde, amarelo ou vermelho e o próximo gate.
- Demo com a Sheid no fim de cada fase.
- Aviso às lojistas Studio antes de ligar a chave numa loja real.

**Quem faz o quê:**

| | TL | PM | PO (Caio) | Sheid |
|---|---|---|---|---|
| Arquitetura, PRs, testes | Faz | — | Informado | — |
| Mockups | Faz | — | **Aprova** | Opina |
| Datas, riscos, quadro | Consultado | **Faz** | Informado | — |
| Conteúdo S7 | — | Cobra | — | **Faz** |
| Go/no-go e ligar chave | Recomenda | **Decide** | Consultado | Informada |

---

## 9. Métricas por fase

Linha de base a partir de 16/10, quando os eventos entram. Definições na jornada §9.

| Fase | Métrica que tem que mexer |
|---|---|
| 1 | Links de produto compartilhados; pedidos com `origem=aurinha` |
| 2 | Sacola → pedido; abandono por etapa do checkout; Pix pago em até 30 min |
| 3A | Ticket médio por pedido; pedidos com 10 ou mais unidades |
| 3B | Produto aberto → adicionado à sacola; tempo até o primeiro mockup |
| 4 | Pedidos repetidos pelo "Pedir outro igual" |
| 5 | Home → produto aberto |
