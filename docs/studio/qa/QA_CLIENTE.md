# QA da Vitrine Studio · Frente 2 · Cliente do lojista

**Escopo:** a experiência de quem compra na vitrine Studio (`loja.getaura.com.br/<slug>`), do link recebido no WhatsApp até o "Pedir outro igual", com a chave `vitrine_v2` ligada e a regressão com ela desligada. Painel da lojista fica na frente 1 (LJ); aqui ele só aparece como pré-condição.

**Base:** `docs/studio/JORNADA_CLIENTE_VITRINE.md` (personas §2, princípios §3), `docs/studio/FASEAMENTO_VITRINE_STUDIO.md` (§0), mockups `docs/mockups/studio-vitrine-00-kit.html` a `05-home.html`, pendências do `QA_NOTAS.md`, código em `main` (aura-app e Aura-backend, PRs Aura-backend#747, #748, #750 a #753 e aura-app#960, #961, #963 a #967, #969).

## Sumário

| # | Épico | Histórias | IDs |
|---|---|---|---|
| 1 | Chegar | 6 | CL-01 a CL-06 |
| 2 | Home e navegação | 9 | CL-07 a CL-15 |
| 3 | Escolher a peça | 17 | CL-16 a CL-32 |
| 4 | Sacola em gaveta | 5 | CL-33 a CL-37 |
| 5 | Checkout em 3 etapas | 7 | CL-38 a CL-44 |
| 6 | Pagar e confirmar | 5 | CL-45 a CL-49 |
| 7 | Depois da compra | 7 | CL-50 a CL-56 |
| 8 | Temporada e loja fechada | 4 | CL-57 a CL-60 |
| 9 | Orçamento em lote | 3 | CL-61 a CL-63 |
| 10 | Pedir pelo WhatsApp | 2 | CL-64 a CL-65 |
| 11 | Qualidade transversal premium | 9 | CL-66 a CL-74 |
| | **Total** | **74** | |

No fim: matriz de dispositivos, achados antecipados (código x mockup) e perguntas em aberto.

## Como ler e executar

- **Personas.** **Ana** (presente para a mãe, chega pelo Instagram, iPhone com Safari, tem uma foto no rolo da câmera, paga no Pix). **Marcos** (50 canecas para a formatura, notebook com Chrome, lista de nomes numa planilha, quer preço por unidade, prazo por tiragem e nota com CNPJ). **Quem volta** (recebeu o link no WhatsApp para aprovar a arte, pagar o saldo ou acompanhar, Android com Chrome, sem conta).
- **Chave.** A `aura-qa` está com a vitrine nova ligada. `?v2=0` no fim do endereço desliga só naquela aba; `?v2=1` liga (use na `sheid-mania` só para OLHAR).
- **Regra de segurança.** Na `sheid-mania` nunca finalize pedido, nunca envie arte (upload) e nunca pague. Montar a peça e abrir a sacola lá é permitido; pedido, só na `aura-qa`.
- **Loja de teste é muda.** A `aura-qa` é `is_sandbox`: não manda WhatsApp, e-mail nem push, e não cria cobrança em gateway. O código Pix dela é um texto de teste ("LOJA DE TESTE — NAO E UM CODIGO PIX VALIDO — pedido #N — R$ X"). Não tente pagar esse código no banco. O "pagamento recebido" é a lojista confirmar no painel.
- **Larguras de referência:** 360, 390, 768, 1280, 1440 e notebook baixo 1366×768. A partir de **900 px** de largura a vitrine usa o layout de desktop (home, produto, sacola lateral, checkout com coluna, Pix com QR ao lado). Tablet em retrato (768) usa o layout de celular; em paisagem (1024) o de desktop.
- **Onde conferir o "premium".** O mockup de cada história é a especificação visual. Quando o texto real for diferente do mockup, o critério traz os dois; o PO decide qual vale.
- **Atalho de configuração.** O painel é `app.getaura.com.br → Studio → Vendas → Loja Digital`, abas `?tab=site` (Meu Site), `design`, `aparencia`, `configurator`, `gallery`, `revisions`, `delivery` (Entrega), `pedidos_loja` (Pedidos pela loja), `orders` (Pedidos). A casca da loja fica até **10 minutos em cache** no servidor: depois de mudar algo que afeta a prévia do link (nome, foto, preço), espere 10 min antes de concluir que falhou.

## Dados de teste

### Lojas

| Loja | Endereço | Estado em 25/09 |
|---|---|---|
| Aura QA (loja de teste) | `loja.getaura.com.br/aura-qa` | Nome "Aura QA — espelho da Sheid"; cor `#1a1612`; par tipográfico "classic" (títulos em Fraunces, texto em DM Sans, números em Bricolage Grotesque); cartão "foto grande"; WhatsApp (12) 99614-5447; endereço "Av Dom Pedro I, 553 - Jardim Colonial"; 31 peças em 3 categorias (Canecas, Cartão de visita, Foto Colorida); Pix com **10% de desconto**; sem cartão; sem "pagar na retirada"; só **retirada na loja**; prazo da loja **3 dias úteis**; revisões inclusas **0**; sem banner; sem GA4/Pixel; sem artes prontas (galeria vazia); chave `vitrine_v2` **ligada** |
| Sheid Mania (piloto real) | `loja.getaura.com.br/sheid-mania` | Mesma cor e fontes; 10 peças; Pix **sem desconto**; 3 artes prontas (2 na Caneca de Vidro, 1 na CANECA BRANCA); texto de prazo de retirada cadastrado como "5/20"; chave **desligada**. Só olhar, com `?v2=1` |

### Configurações da aura-qa usadas nas histórias

A frente Lojista (ou o TL) liga e desliga no painel. Ao terminar cada história, volte para a **Config A**.

| Config | O que muda | Onde |
|---|---|---|
| A (padrão) | Como está hoje (tabela acima) | nada |
| B (entrega) | Ligar "Receber em casa" com frete por CEP e "Retirada por app" | aba Entrega |
| C (revisões) | 2 revisões inclusas; revisão extra R$ 10,00 | aba Revisões |
| D (banners) | 3 banners: (1) texto + botão "Ver canecas" com destino `#cat=/canecas`; (2) texto + botão com destino `#vista=lote`; (3) só imagem com texto desenhado nela, destino `#cat=/canecas`, sem título. Faixa de anúncio escrita "Frete grátis na retirada · Arte aprovada antes · 10% no Pix" | aba Design |
| E (medição) | Um ID de GA4 de teste (formato `G-XXXXXXX`) | aba Pedidos pela loja |
| F (temporada) | "Pedidos até" = hoje + 5 dias; depois hoje; depois amanhã | aba Pedidos pela loja |
| G (fechada) | Loja fechada, recado "Voltamos a aceitar pedidos em 6 de outubro. Enquanto isso, peça um orçamento pelo WhatsApp." | aba Pedidos pela loja |
| H (galeria e prazos) | CANECA BRANCA com 4 fotos na galeria, guia de medidas anexado e prazo por faixa (até 9 un: 3 d.u.; 10 a 49: 5 d.u.; 50+: 8 d.u.) | cadastro do produto (confirmar com LJ onde se grava o prazo por faixa) |
| I (cartão) | Mercado Pago em modo de teste, parcelamento em até 3x | configuração de pagamento (a confirmar, ver perguntas) |
| J (pagar na retirada) | Ligar "Pagar na retirada" | configuração de pagamento |
| Cores | Cor principal trocada para Rosa `#D6336C`, Amarelo `#F2C94C`, Petróleo `#0F6E7A`; volta para `#1a1612` | aba Design / Aparência |

### Peças e contas de referência (aura-qa)

| Peça | Preço | O que tem |
|---|---|---|
| CANECA BRANCA | R$ 39,90 | Faixas: 10 a 49 un R$ 35,91 (−10%); 50+ un R$ 31,92 (−20%). "Quem cria a arte": "Vou enviar minha arte pronta" (incluso), "Envio minha arte e vocês ajustam" (+R$ 10,00), "Criem a arte pra mim" (+R$ 15,00). Texto com 8 cores de arte. Verso incluso. Área de impressão 9 × 9 cm (pede 1063 × 1063 px) |
| Caneca Alça de coração Preta | R$ 59,90 | Ajuste +R$ 15,00, criação +R$ 15,00; "Nome a estampar" com cor da arte |
| CANECA ALÇA COLORIDA | R$ 44,99 | 11 cores de louça (a cor pinta a alça) |
| CAMISA ALGODÃO Básico 2 (PENTEADO) | R$ 70,00 | Verso cobrado +R$ 10,00 |
| Garrafa termica 500ml | R$ 100,00 | Frente, verso e meio (meio incluso); ajuste +R$ 15,00 |
| Caneca Imperial com Alça e Borda Cromado Dourada 400ml - Sua Arte Aqui | R$ 65,90 | Nome longo (teste de corte de texto) |

Contas que as histórias conferem (Pix 10% da aura-qa):
- 1 CANECA BRANCA com ajuste: 39,90 + 10,00 = **R$ 49,90**; no Pix **R$ 44,91**.
- 2 CANECAS BRANCAS com ajuste: 39,90 × 2 + 10,00 = **R$ 89,80** (nunca R$ 99,80); no Pix **R$ 80,82**.
- 50 CANECAS BRANCAS com "Criem a arte pra mim": 31,92 × 50 + 15,00 = **R$ 1.611,00**; no Pix **R$ 1.449,90**; economia da faixa "Você economiza R$ 399,00 com o desconto de 20%."
- 1 CAMISA ALGODÃO Básico 2 com verso: 70,00 + 10,00 = **R$ 80,00**.

### Arquivos (deixar numa pasta do celular e do computador)

`foto_640.jpg` (640 × 480 px), `foto_1100.jpg` (1100 × 1100 px), `foto_3000.jpg` (3000 × 3000 px, uns 4 MB), `arte.pdf` (1 página), `arte.png` com fundo transparente, `grande_16mb.jpg` (mais de 15 MB), `foto.heic` (formato do iPhone), `comprovante.jpg` (menos de 5 MB), `comprovante_6mb.jpg`, `referencia.png` (para o pedido de ajuste), `planilha_50_nomes.xlsx` (uma coluna "Nome" com 50 linhas; incluir "Silva, João", "Ana Paula" e duas linhas em branco; uma segunda coluna "Setor").

### Outros dados

- CEPs: `12242-000` (São José dos Campos, perto da loja), `01310-100` (São Paulo, longe), `1224` (incompleto), `99999-999` (não existe).
- Documentos: CPF válido `529.982.247-25`, CPF inválido `123.456.789-00`, CNPJ válido `11.222.333/0001-81`.
- Placas: `ABC-1234` (antiga), `ABC1D23` (Mercosul), `AB-12` (inválida).
- WhatsApp da cliente: um número real da pessoa de QA. E-mail: um endereço real dela que **não** seja `@getaura.com.br` (esse domínio é conta interna e muda regras).
- Link da Aurinha: `loja.getaura.com.br/aura-qa?produto=1297684d-6ccc-4039-b465-348738855bbe&origem=aurinha&conversa=11111111-2222-4333-8444-555555555555` (a peça é a CANECA BRANCA).
- Depurador de links: `developers.facebook.com/tools/debug/` (lê as mesmas metatags que o WhatsApp e o Instagram).

---

## Épico 1 · Chegar

### CL-01 · Abrir o link da loja e entender em 3 segundos de quem é e o que faz
**Persona:** Ana  ·  **Fase:** 1 e 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Telas 1, 2 e 7

> Como Ana, quero abrir o link da loja que vi no Instagram e entender na hora que é uma loja de personalizados e de quem, para decidir se vale continuar.

**Pré-condições**
- Config A. iPhone (Safari) e Android (Chrome), 390 px; aba anônima (sem histórico da loja).

**Passo a passo**
1. Colar `loja.getaura.com.br/aura-qa` no navegador e abrir.
2. Observar a tela enquanto carrega e depois de carregar, sem rolar.
3. Conferir o título da aba do navegador.
4. Repetir no desktop 1440 e no notebook 1366×768.

**Critérios de aceite — funciona**
- [ ] Enquanto carrega aparece o esqueleto (blocos no tom do papel, sem a cor da loja); nunca tela branca.
- [ ] Carregada, a primeira dobra mostra: faixa do topo "Você aprova o mockup antes de produzir · Pronto em 3 dias úteis · 10% no Pix", cabeçalho com o nome da loja, busca e sacola, e o destaque com "Personalizados · Jardim Colonial".
- [ ] O título da aba é o nome da loja ("Aura QA — espelho da Sheid").
- [ ] Ao colar o link da loja no depurador de links, a prévia traz o nome da loja como título e o logo ou a capa como imagem (sem "Aura." genérico).
- [ ] F5 reabre a mesma tela, na mesma posição de rolagem do topo.

**Critérios de aceite — premium (UI/UX)**
- [ ] Nome da loja e título do destaque na fonte da loja (Fraunces); números da faixa em Bricolage Grotesque.
- [ ] Nada pula quando o conteúdo substitui o esqueleto (o esqueleto desenha faixa, cabeçalho, barra de categorias e destaque nos mesmos lugares).
- [ ] Alvos do cabeçalho (menu, busca, sacola) com pelo menos 44 × 44 px.
- [ ] Nenhum "Powered by Aura" flutuando; a assinatura "Loja desenvolvida com Aura." aparece só na última linha do rodapé.

**Casos de borda**
- [ ] Rede 3G (DevTools "Slow 3G"): o esqueleto aparece em menos de 1 s e a loja em menos de 6 s.
- [ ] Loja com nome longo: o nome no cabeçalho do celular não empurra a sacola para fora da tela.
- [ ] Com "reduzir movimento" ligado no aparelho, o esqueleto fica parado (sem pulso).

**Pontos de atenção conhecidos**
- O esqueleto novo (desenho da home nova) só aparece quando a aba já tem `?v2=1` guardado; na aura-qa aberta sem o parâmetro ele é o esqueleto antigo em grade (`PaginaDaVitrine.tsx`, `esqueletoNovo`). Conferir se a página "pula" na troca e registrar.

### CL-02 · Compartilhar a peça e ver a prévia certa no WhatsApp e no Instagram
**Persona:** Ana (manda para a irmã) e Quem volta (recebe)  ·  **Fase:** 1  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 2

> Como Ana, quero mandar o link da caneca para minha irmã opinar, para que ela veja a foto, o nome e o preço antes mesmo de abrir.

**Pré-condições**
- Config A. Dois aparelhos: iPhone da Ana e Android de quem recebe (com WhatsApp). Desktop Chrome para o depurador.

**Passo a passo**
1. No iPhone, abrir a CANECA BRANCA (`/aura-qa/p/1297684d-6ccc-4039-b465-348738855bbe`).
2. Tocar no ícone de compartilhar ao lado do nome da peça.
3. Na folha do sistema, escolher WhatsApp e mandar para o Android.
4. No Android, olhar o cartão de prévia antes de tocar; depois tocar no link.
5. No Android, tocar em "voltar" do navegador.
6. No desktop 1280, abrir a mesma peça e clicar no ícone de compartilhar.
7. Colar o endereço da peça no depurador de links e clicar em "Depurar" (e em "Extrair novamente" se já tiver sido lido).
8. Colar o mesmo link numa DM do Instagram.

**Critérios de aceite — funciona**
- [ ] No celular abre a folha nativa do sistema (não um menu da loja); fechar a folha sem escolher nada não mostra aviso nenhum.
- [ ] No desktop o clique copia o link direto e aparece o aviso escuro "Link da peça copiado" por cerca de 2,6 s; colar num bloco de notas dá `loja.getaura.com.br/aura-qa/p/<id>`.
- [ ] Cartão do WhatsApp: foto da caneca, título "CANECA BRANCA · Aura QA — espelho da Sheid", descrição começando por "R$ 39,90 · ", domínio `loja.getaura.com.br`.
- [ ] Depurador: `og:title`, `og:image` (a foto da peça, não o logo da Aura), `og:url` do produto e `og:type` = product, sem aviso de imagem inacessível.
- [ ] Instagram mostra a mesma foto e o mesmo título.
- [ ] Quem recebe abre direto na página da caneca; o "voltar" leva para a home da loja (não sai da loja nem volta para o WhatsApp de primeira).
- [ ] O título da aba de quem recebe é "CANECA BRANCA · Aura QA — espelho da Sheid".

**Critérios de aceite — premium (UI/UX)**
- [ ] O ícone de compartilhar tem 44 × 44 px de toque e não quebra a linha do nome.
- [ ] O aviso "Link da peça copiado" aparece acima da barra de compra, sem cobri-la, e é anunciado pelo leitor de tela.

**Casos de borda**
- [ ] Com a chave desligada (`?v2=0`), o link de produto também abre a peça e tem a mesma prévia (a prévia nasce no servidor).
- [ ] Loja com "mostrar preços" desligado: a prévia não traz o preço.
- [ ] Peça sem foto: a prévia usa o logo ou a capa da loja, nunca imagem quebrada.
- [ ] Peça que saiu da loja depois do envio: o link abre a home com um aviso discreto, sem erro.
- [ ] Nome com aspas ou `<` no cadastro: a prévia mostra o texto, sem quebrar.

**Pontos de atenção conhecidos**
- QA_NOTAS F1B: a arrumação do histórico (link de fora vira home embaixo + peça em cima) usa duas navegações seguidas; conferir especialmente no Safari do iPhone que o "voltar" cai na home da loja e que não há piscada da home antes da peça.
- A casca fica 10 min em cache: mudança de foto ou preço demora até 10 min para aparecer na prévia.

### CL-03 · Abrir o link da Aurinha e cair na peça separada para mim
**Persona:** Ana  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 01-alicerce, Tela 3

> Como Ana, quero que o link que a Aurinha me mandou na DM abra direto a caneca que conversamos, para não ter de procurar de novo.

**Pré-condições**
- Config A. Celular 390 px. Link da Aurinha dos dados de teste.

**Passo a passo**
1. Abrir o link da Aurinha numa aba nova.
2. Ler a faixa acima da peça e tocar no "x" dela.
3. Voltar pelo navegador.
4. Abrir de novo o link, montar a caneca e finalizar um pedido Pix.
5. Abrir o mesmo link trocando o `produto` por `abc` (inválido) e depois por um UUID que não existe na loja.

**Critérios de aceite — funciona**
- [ ] Abre a página da CANECA BRANCA (não a home) com a faixa "Separamos esta peça para você".
- [ ] A faixa não some sozinha; o "x" (rótulo "Fechar aviso") a fecha.
- [ ] O endereço fica `/aura-qa/p/1297684d-...` sem os parâmetros; o "voltar" leva à home da loja, e o "voltar" seguinte sai da loja.
- [ ] F5 na peça não traz a faixa de volta nem quebra a página.
- [ ] O pedido feito nessa aba sai atribuído a `origem = aurinha` com a conversa (conferir com o TL no painel ou no banco).
- [ ] `produto=abc` e UUID inexistente abrem a home, sem mensagem de erro.

**Critérios de aceite — premium (UI/UX)**
- [ ] Faixa numa linha, ícone de coração, na cor da loja (fundo lavado), sem exclamação, altura mínima 44 px, largura máxima alinhada ao conteúdo.
- [ ] A faixa não empurra a barra de compra para fora da tela no celular 360 px.

**Casos de borda**
- [ ] `origem=instagram` (sem ser Aurinha): abre a peça sem a faixa.
- [ ] Link com `origem` de 40 caracteres ou com espaço: abre a peça, sem faixa, e o pedido sai sem origem.
- [ ] Outra aba, no dia seguinte, sem o link: pedido sai sem atribuição.

### CL-04 · Link errado: a loja diz "Não achamos essa loja"
**Persona:** Quem volta  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 4

> Como quem recebeu um link copiado pela metade, quero entender que o endereço está errado, para pedir o link certo em vez de achar que a loja fechou.

**Pré-condições**
- Celular e desktop. Nenhuma configuração.

**Passo a passo**
1. Abrir `loja.getaura.com.br/aura-qaa` (com a letra a mais).
2. Tocar no botão da tela.
3. Abrir `loja.getaura.com.br/aura-qa/p/00000000-0000-4000-8000-000000000000`.

**Critérios de aceite — funciona**
- [ ] Título "Não achamos essa loja", texto "Confira o link com quem te mandou, ou é possível que a loja ainda não esteja publicada." e botão "Ir para a Aura", que abre `getaura.com.br`.
- [ ] Nenhuma mensagem crua da API ("Loja nao encontrada", "Failed to fetch") aparece.
- [ ] Peça inexistente numa loja que existe abre a home da loja com aviso discreto, não a tela de "não achamos".

**Critérios de aceite — premium (UI/UX)**
- [ ] Composição centrada, ícone de loja num círculo cinza (não vermelho: não é culpa da cliente), título na fonte display, botão com 48 px de altura.
- [ ] Tipografia do Studio mesmo sem a loja carregada (Fraunces/DM Sans), fundo papel quente.

**Casos de borda**
- [ ] Loja despublicada pela lojista: mesma tela.
- [ ] Endereço com maiúsculas (`/AURA-QA`): confirmar se abre a loja ou cai em "não achamos" e registrar.

**Pontos de atenção conhecidos**
- O botão "Ir para a Aura" leva a cliente final ao site da Aura. Confirmar com o PO se é o destino certo para quem só queria a loja (ver perguntas).

### CL-05 · Rede ruim: "A loja não carregou" com "Tentar de novo" que funciona
**Persona:** Ana  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 4; 05-home, Tela 7

> Como Ana, quero saber quando o problema é a minha internet e poder tentar de novo, para não desistir da loja.

**Pré-condições**
- Desktop Chrome com DevTools; celular com modo avião à mão.

**Passo a passo**
1. DevTools, aba Rede, marcar "Offline" e abrir `/aura-qa`.
2. Ver a tela de erro; desmarcar "Offline"; tocar em "Tentar de novo".
3. Repetir com "Slow 3G" e observar o esqueleto até a loja chegar.
4. No celular, ligar "reduzir movimento" e repetir o passo 3.

**Critérios de aceite — funciona**
- [ ] Sem rede: título "A loja não carregou", texto "Pode ter sido a conexão. Os produtos e preços continuam os mesmos." e botão "Tentar de novo".
- [ ] "Tentar de novo" mostra o carregamento e, com a rede de volta, a loja aparece sem recarregar a página inteira.
- [ ] A sacola guardada antes continua lá depois do "Tentar de novo".
- [ ] Nunca aparece tela em branco entre o esqueleto e o erro.

**Critérios de aceite — premium (UI/UX)**
- [ ] Botão "Tentar de novo" na cor padrão do Studio (violeta da Aura, porque a cor da loja ainda não chegou) com texto legível.
- [ ] Esqueleto com um pulso lento só; com "reduzir movimento", parado.
- [ ] Leitor de tela anuncia "Carregando a loja" uma vez.

**Casos de borda**
- [ ] Servidor respondendo 500 ou 429: tela "A loja não carregou" (não "não achamos").
- [ ] Rede que cai no meio da navegação (já dentro da loja): trocar de tela não mostra erro, porque a loja já está carregada.

### CL-06 · Aviso de cookies que não cobre nada
**Persona:** Ana  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 01-alicerce, Tela 8

> Como Ana, quero decidir sobre cookies sem que o aviso esconda o botão de comprar ou o WhatsApp, para continuar comprando.

**Pré-condições**
- Config E (GA4 de teste). Aba anônima. Celular 360 e 390 px; desktop 1280.

**Passo a passo**
1. Abrir a home; rolar até o fim.
2. Abrir a CANECA BRANCA e olhar a barra de compra.
3. Tocar em "Essenciais" (celular) ou "Só os essenciais" (desktop).
4. Em outra aba anônima, repetir e tocar em "Aceitar".
5. Recarregar as duas abas.

**Critérios de aceite — funciona**
- [ ] Sem GA4/Pixel configurado (Config A), o aviso não aparece em tela nenhuma.
- [ ] Com GA4, o aviso diz "Usamos cookies para medir visitas. Nada é vendido a terceiros." (ou a versão longa com "entender o que mais interessa").
- [ ] No produto, o aviso fica empilhado ACIMA da barra de compra; "Adicionar à sacola" continua inteiro e tocável.
- [ ] Na home, o botão "Tirar dúvida" continua visível e tocável com o aviso aberto.
- [ ] A escolha é lembrada: F5 não mostra o aviso de novo.
- [ ] "Aceitar" liga a medição (GA4 DebugView recebe `page_view`/`view_item`); "Essenciais" não liga nada.

**Critérios de aceite — premium (UI/UX)**
- [ ] Barra compacta (uma a duas linhas no celular), texto 12 px legível, botões com 44 px de altura, "Aceitar" na cor da loja.
- [ ] Rótulo curto no celular ("Essenciais") e longo no desktop ("Só os essenciais"), sem texto cortado.

**Casos de borda**
- [ ] Checkout e página do pedido: o aviso não cobre o botão da etapa nem "Copiar código Pix".
- [ ] Safari em janela privada (storage bloqueado): o aviso aparece, some ao escolher e a página não quebra.

**Pontos de atenção conhecidos**
- QA_NOTAS F1C: evento que acontece antes do "Aceitar" se perde (não entra em fila). O `view_item` da primeira peça aberta antes de aceitar não chega ao GA4; registrar como comportamento conhecido.

---

## Épico 2 · Home e navegação

### CL-07 · Faixa de anúncio e cabeçalho preso com a barra de categorias
**Persona:** Ana  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 1

> Como Ana, quero ver as promessas da loja no topo e ter busca, sacola e categorias sempre à mão enquanto rolo, para não precisar voltar ao começo.

**Pré-condições**
- Config A; depois Config D (faixa escrita). Celular 390 e desktop 1440.

**Passo a passo**
1. Abrir a home e ler a faixa do topo.
2. Rolar até a metade da página e observar o cabeçalho.
3. Tocar numa categoria da barra.
4. Aplicar a Config D e recarregar.

**Critérios de aceite — funciona**
- [ ] Config A: faixa automática com três itens ("Você aprova o mockup antes de produzir", "Pronto em 3 dias úteis", "10% no Pix"), cada um com um visto.
- [ ] Config D: a faixa mostra os três itens escritos pela lojista, partidos no "·".
- [ ] Na Sheid (`?v2=1`, sem desconto no Pix), o item "no Pix" não aparece.
- [ ] Ao rolar, cabeçalho (nome, busca, sacola com contador) e barra de categorias ficam presos juntos no topo; a sombra só aparece depois de rolar.
- [ ] Tocar numa categoria abre `/aura-qa/c/<categoria>` já no topo da página da categoria.

**Critérios de aceite — premium (UI/UX)**
- [ ] Faixa parada (sem letreiro), texto em caixa alta com Bricolage, contraste AA sobre a cor da loja.
- [ ] No celular os itens quebram inteiros em até duas linhas; nenhum item cortado no meio.
- [ ] Contador da sacola na cor da loja, legível, sem sair do círculo com 2 dígitos ("12").

**Casos de borda**
- [ ] Faixa escrita muito longa (200 caracteres): quebra em linhas sem cobrir o cabeçalho.
- [ ] Loja sem prazo configurado: o item "Pronto em" some (não aparece "Pronto em 0").

### CL-08 · Buscar e ver resultado a cada letra, com "Nada encontrado" que ajuda
**Persona:** Ana (celular) e Marcos (desktop)  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 4

> Como Ana, quero achar a caneca digitando parte do nome, para não percorrer a loja inteira.

**Pré-condições**
- Config A. Celular 390; desktop 1280.

**Passo a passo**
1. Celular: tocar na lupa; ver o campo vazio.
2. Digitar "cane", depois "caneca co".
3. Tocar num resultado.
4. Voltar, limpar e digitar "chaveiro".
5. Tocar em "Pedir pelo WhatsApp".
6. Desktop: clicar no campo "Buscar na Aura QA — espelho da Sheid" do cabeçalho e repetir os passos 2 a 4.

**Critérios de aceite — funciona**
- [ ] Campo vazio mostra "Mais procurados na loja" com palavras tiradas das peças da loja.
- [ ] Os resultados mudam a cada letra, sem botão de buscar; acentos e maiúsculas não importam ("CANECA" = "caneca").
- [ ] Acima das peças aparece a categoria que casa ("Canecas · N de M modelos"), que abre a página da categoria.
- [ ] Peça achada só pela descrição mostra "Na descrição: ..." e vem depois das achadas pelo nome.
- [ ] "chaveiro": título "Nada encontrado para “chaveiro”", texto "A Aura QA — espelho da Sheid faz sob encomenda. Se não está na loja, pergunte: muitas vezes dá para fazer.", botões "Ver a loja toda" e "Pedir pelo WhatsApp".
- [ ] "Pedir pelo WhatsApp" abre o WhatsApp com "Olá, Aura QA — espelho da Sheid! Procurei "chaveiro" na loja e não achei. Vocês fazem?".
- [ ] "Limpar a busca" (x) esvazia o campo; "Fechar a busca" (seta) volta à home na mesma posição.

**Critérios de aceite — premium (UI/UX)**
- [ ] O termo digitado aparece destacado no nome da peça.
- [ ] No celular a busca abre em camada cheia com o teclado já aberto; no desktop a lista cai embaixo do campo, sem cobrir o campo.
- [ ] Miniatura, nome e preço (Bricolage) alinhados; linhas com 44 px ou mais.

**Casos de borda**
- [ ] Digitar muito rápido: a lista não pisca nem fica atrás do que foi digitado.
- [ ] Loja sem WhatsApp cadastrado: só "Ver a loja toda".
- [ ] Esc (desktop) fecha a lista.

### CL-09 · Navegar pelo menu em gaveta no celular
**Persona:** Ana  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 4

> Como Ana, quero um menu com as categorias da loja, para ir direto às canecas.

**Pré-condições**
- Config A. Celular 360 e 390 px; tablet 768.

**Passo a passo**
1. Tocar no ícone de menu do cabeçalho.
2. Tocar em "Canecas"; depois abrir de novo e tocar em "Orçamento em lote".
3. Abrir de novo e tocar em "Falar no WhatsApp".
4. Abrir e fechar tocando fora da gaveta.

**Critérios de aceite — funciona**
- [ ] A gaveta mostra "Buscar na loja", "Início", as categorias com a contagem de peças, "Orçamento em lote", "Falar no WhatsApp" e o endereço da loja no pé.
- [ ] Categoria com subcategorias abre em sanfona e oferece "Ver todas as <categoria>" (só se a loja tiver árvore; a aura-qa não tem).
- [ ] Tocar numa categoria fecha a gaveta e abre `/aura-qa/c/<categoria>` no topo.
- [ ] "Orçamento em lote" abre `/aura-qa/orcamento`.
- [ ] "Falar no WhatsApp" abre com "Olá! Vim pela loja Aura QA — espelho da Sheid e queria tirar uma dúvida."
- [ ] Tocar fora ou no "x" ("Fechar o menu") fecha a gaveta; o "Tirar dúvida" flutuante some enquanto a gaveta está aberta.

**Critérios de aceite — premium (UI/UX)**
- [ ] Abre deslizando em 220 ms; com "reduzir movimento", aparece sem deslizar.
- [ ] Linhas com 44 px ou mais, contagem em Bricolage alinhada à direita.
- [ ] Fundo escurecido por trás; a rolagem da página não acontece por baixo da gaveta.

**Casos de borda**
- [ ] Loja com 10 categorias: a gaveta rola por dentro e o endereço fica no fim.
- [ ] Categoria sem peça publicada não aparece no menu.

### CL-10 · Ver até 3 banners girando, com pausa, setas, arrastar e destino
**Persona:** Ana e Marcos  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 1

> Como Ana, quero ver os destaques da loja e ir direto para onde o banner aponta, para não procurar.

**Pré-condições**
- Config D. Desktop 1440 e 1280; celular 390.

**Passo a passo**
1. Abrir a home e esperar 20 s sem mexer.
2. Passar o mouse sobre o banner (desktop); tirar.
3. Clicar no botão de pausa; depois em continuar.
4. Usar as setas (desktop) e arrastar para o lado (celular).
5. Clicar em "Ver canecas" do banner 1; voltar; clicar no botão do banner 2; voltar; tocar em qualquer lugar do banner 3.
6. Ligar "reduzir movimento" e recarregar.

**Critérios de aceite — funciona**
- [ ] Cada banner fica 6 s; a bolinha ativa enche como barra de progresso; depois do 3 volta ao 1.
- [ ] Mouse por cima, toque ou foco de teclado seguram o giro; o botão de pausa ("Pausar os banners" / "Continuar os banners") segura de vez.
- [ ] Setas ("Banner anterior" / "Próximo banner") só no desktop; no celular, arrastar 40 px troca o banner e a rolagem vertical continua funcionando.
- [ ] Banner 1 abre a página de Canecas; banner 2 abre o orçamento em lote; banner 3 (arte pronta, sem texto nosso) é inteiro um link para Canecas.
- [ ] Com "reduzir movimento", nenhum banner troca sozinho.
- [ ] Banner com destino para categoria que não existe mais: sem botão (nunca botão morto).

**Critérios de aceite — premium (UI/UX)**
- [ ] Desktop na proporção 3:1 (1440 → cerca de 480 px de altura); celular com a arte do celular quando existe, sem cortar o texto da arte.
- [ ] Texto sobre foto com véu que garante leitura; banner 3 sem véu escuro.
- [ ] Bolinhas e setas com área de toque de 44 px.

**Casos de borda**
- [ ] Um banner só: sem bolinhas, sem setas, sem giro.
- [ ] Banner sem imagem (só texto sobre fundo escuro): conferir contraste AA do título e do botão.
- [ ] Banner com endereço externo (`https://...`): abre o site externo.

**Pontos de atenção conhecidos**
- QA_NOTAS F5: contraste de texto sobre banner sem imagem (fundo ink) não verificado.
- QA_NOTAS Anexo A: o destino do banner (`cta_url`) era descartado ao salvar na loja Negócio; conferir que o destino salvo na aba Design chega à vitrine Studio.

### CL-11 · Home sem banner: a peça do destaque girando com as artes trocando
**Persona:** Ana  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 2

> Como Ana, quero ver uma caneca de verdade com nomes aparecendo nela logo que entro, para entender em segundos o que a loja faz.

**Pré-condições**
- Config A (sem banner, o caso real da Sheid). Celular real (iPhone e Android) e desktop real, porque o 3D não carrega no ambiente dos agentes.

**Passo a passo**
1. Abrir a home e olhar o destaque por 15 s.
2. Tocar num dos nomes de exemplo abaixo da peça.
3. Tocar em pausa; depois continuar.
4. Tocar em "Personalizar uma caneca"; voltar; tocar em "Ver a loja toda".

**Critérios de aceite — funciona**
- [ ] O destaque mostra "Personalizados · Jardim Colonial", o nome da loja como título, a frase "<categorias> com a sua foto, o seu nome ou a sua frase. Você vê como fica antes de pagar." e as notas "Pronto em 3 dias úteis", "Você aprova antes", "10% no Pix".
- [ ] A peça é a escolhida na aba Design ou, sem escolha, a primeira com prévia 3D; o selo diz "Prévia 3D" (ou "Prévia da arte" sem 3D).
- [ ] As artes trocam sozinhas a cada 3,5 s: "Helena", "Vovó Lourdes", "Time Aura" (primeira palavra do nome da loja).
- [ ] Tocar num nome escolhe e para a troca automática.
- [ ] "Personalizar uma caneca" abre a página da peça; "Ver a loja toda" rola até a grade.
- [ ] Com "reduzir movimento", nada gira nem troca sozinho.

**Critérios de aceite — premium (UI/UX)**
- [ ] Desktop: título grande (64 px) à esquerda e a peça à direita, sem metade vazia.
- [ ] Celular: a peça vem abaixo do título, menor, e ainda cabe na primeira tela com os botões.
- [ ] Enquanto o 3D não carrega, aparece a foto da peça com a arte ao lado; nunca um erro vermelho do visualizador.

**Casos de borda**
- [ ] 3D bloqueado (DevTools, bloquear o domínio da CDN do three.js): o destaque fica em 2D sem erro.
- [ ] Peça do destaque sem campo de texto e sem arte pronta: aparece a peça sozinha, sem seletor.

**Pontos de atenção conhecidos**
- QA_NOTAS F5: "a primeira com prévia 3D" segue a ordem de cadastro (o payload não tem ordem de destaque).
- Mockup F5: o "Tirar dúvida" cobria a última arte do destaque no celular; o código esconde o botão até o destaque sair da tela. Conferir (ver CL-14).

### CL-12 · Percorrer os blocos da home: como funciona, grade por categoria, queridinhos, artes, empresas e selos
**Persona:** Ana e Marcos  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 3

> Como Marcos, quero entender como funciona, achar a categoria e ver que a loja atende empresas, para decidir se peço orçamento.

**Pré-condições**
- Config A na aura-qa; para "Artes da loja", a Sheid com `?v2=1` (a aura-qa não tem arte pronta). Desktop 1440 e celular 390.

**Passo a passo**
1. Rolar a home inteira devagar.
2. Tocar no cartão de uma categoria da grade.
3. Na Sheid (`?v2=1`), tocar numa arte de "Artes da loja" (sem finalizar nada).
4. Em "Para empresas e eventos", tocar em "Pedir orçamento em lote"; voltar; tocar em "Prefiro falar no WhatsApp".

**Critérios de aceite — funciona**
- [ ] "Como funciona" com o título "Três passos até o presente pronto" e os passos "Personalize na tela", "Aprove pelo WhatsApp", "Produção e entrega" (este com a pílula "Pronto em até 3 dias úteis").
- [ ] Grade "A loja" / "Escolha a peça. A arte é sua.": categoria com 2 ou mais peças vira um cartão com "N modelos para escolher" e o menor preço; o cartão abre a página da categoria.
- [ ] "Os queridinhos da <loja>" só aparece com 2 ou mais peças pedidas (na aura-qa sem pedidos, não aparece).
- [ ] "Artes da loja" (Sheid) mostra as artes prontas; tocar abre a peça já com a arte aplicada no mockup.
- [ ] "Para empresas e eventos": título "50 canecas com o nome de cada convidado? Preço na hora.", degraus "10+ un R$ 35,91 −10% cada" e "50+ un R$ 31,92 −20% cada", legenda "CANECA BRANCA, preço por unidade."; "Pedir orçamento em lote" abre o lote; "Prefiro falar no WhatsApp" abre com "Olá! Queria um orçamento para uma empresa ou evento.".
- [ ] Selos (no máximo 4): "Você aprova antes", "Compra segura" (Pix, pagamento protegido), "Retire na loja" (Jardim Colonial), "Atendimento humano".
- [ ] Não existe a tira "O que a gente personaliza", nem "últimas unidades", nem filtros laterais, nem paginação.

**Critérios de aceite — premium (UI/UX)**
- [ ] Títulos de seção na fonte da loja; rótulos em caixa alta e preços em Bricolage.
- [ ] Cartão "foto grande": nome e preço sobre a foto com véu que garante leitura; preço no Pix em verde.
- [ ] Respiro de 72 px entre seções no desktop e 40 px no celular; nenhuma seção colada na outra.
- [ ] Queridinhos no celular: fileira que desliza mostrando um pedaço da próxima peça.

**Casos de borda**
- [ ] Loja sem nenhuma peça: "A vitrine está sendo arrumada" com "As peças personalizáveis desta loja ainda não foram publicadas. Volte em breve.".
- [ ] Loja com 1 arte pronta só: o bloco "Artes da loja" não aparece.
- [ ] Config C: o selo passa a "Mockup antes de produzir, 2 revisões inclusas".

### CL-13 · Abrir a página da categoria com trilha, contagem e grade
**Persona:** Ana  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 5; 03-produto, Tela 9

> Como Ana, quero uma página só das canecas, com endereço próprio, para comparar e voltar para ela quando quiser.

**Pré-condições**
- Config A. Celular 390 e desktop 1280.

**Passo a passo**
1. Pela barra de categorias, abrir Canecas.
2. Conferir o endereço, a trilha e o topo.
3. Abrir uma peça e voltar pelo navegador.
4. Abrir `/aura-qa/c/canecas` numa aba nova.
5. Abrir `/aura-qa/c/nao-existe`.

**Critérios de aceite — funciona**
- [ ] Endereço `/aura-qa/c/canecas`; trilha "Início / Canecas" com "Início" levando à home.
- [ ] Topo com o título "Canecas", o selo "N modelos", a frase sobre o 3D ("Todos com prévia em 3D da sua arte." quando for o caso), a faixa "De R$ X a R$ Y" e a frase do que varia.
- [ ] Sem controles de ordenar (menos de 20 modelos).
- [ ] O voltar da peça traz de volta a categoria na mesma posição de rolagem.
- [ ] Aba nova com o endereço direto abre a categoria; o voltar leva à home da loja.
- [ ] Categoria inexistente volta para a home em silêncio.
- [ ] No fim da grade, "Não achou o modelo que queria? A Aura QA — espelho da Sheid faz sob encomenda." com "Perguntar no WhatsApp".

**Critérios de aceite — premium (UI/UX)**
- [ ] Título da categoria recebe o foco ao abrir (leitor de tela lê "Canecas").
- [ ] A grade é a primeira coisa abaixo do cabeçalho; nenhum filtro muda fora da vista.
- [ ] Título da aba "Canecas · Aura QA — espelho da Sheid".

**Casos de borda**
- [ ] Loja com subcategorias: opções "Todas" e as filhas; trilha "Início / Canecas / <filha>".
- [ ] Categoria com uma peça só: não vira página de grade (a home mostra a peça direto).

### CL-14 · Rodapé completo e "Tirar dúvida" que nunca cobre o conteúdo
**Persona:** Ana  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Telas 3 e 6

> Como Ana, quero achar o endereço, as formas de pagamento e o WhatsApp da loja, e ter o "Tirar dúvida" à mão sem que ele esconda nada.

**Pré-condições**
- Config A. Celular 360 e 390; desktop 1280 e 1440.

**Passo a passo**
1. Na home, observar o canto de baixo antes e depois de rolar além do destaque.
2. Rolar devagar sobre a grade e observar a borda direita dos cartões.
3. Chegar ao rodapé; tocar numa categoria da coluna "Navegue".
4. Tocar em "Tirar dúvida".

**Critérios de aceite — funciona**
- [ ] O "Tirar dúvida" só aparece depois que o destaque saiu da faixa de baixo da tela; volta ao subir.
- [ ] No desktop largo (margem livre maior que 190 px) é a pílula "Tirar dúvida"; mais estreito, o círculo de 56 px, fora do conteúdo.
- [ ] Rodapé com: quem é a loja (nome, endereço real, Instagram, WhatsApp), como atende (formas de pagamento, política de troca), "Navegue" (só categorias com peça, no máximo 6) e a última linha com "Loja desenvolvida com Aura." uma vez só.
- [ ] Categoria do rodapé abre a página da categoria, no topo.
- [ ] "Tirar dúvida" abre o WhatsApp da loja.

**Critérios de aceite — premium (UI/UX)**
- [ ] Três colunas a partir de 760 px; uma coluna abaixo disso, com links de 44 px em duas colunas no celular.
- [ ] O fim da página tem folga: o botão flutuante não cobre a assinatura.
- [ ] "Tirar dúvida" na cor da loja com texto legível (conferir nas 4 cores de CL-67).

**Casos de borda**
- [ ] Aviso de cookies aberto (Config E): o botão continua visível e tocável.
- [ ] Loja sem WhatsApp: o botão não aparece.

**Pontos de atenção conhecidos**
- QA_NOTAS F5: no celular, o "Tirar dúvida" ainda passa por cima da borda direita dos cartões durante a rolagem. Registrar com print em 360 e 390 px.
- Mockup 05, pergunta g: a política de troca padrão fala de "tamanho ou cor", o que não combina com peça personalizada.

### CL-15 · Regressão: a home e a compra de hoje com a chave desligada
**Persona:** Ana  ·  **Fase:** 1 a 5  ·  **Prioridade:** P0  ·  **Chave:** desligada  ·  **Mockup:** nenhum (tela de hoje)

> Como Ana numa loja que ainda não ligou a vitrine nova, quero que tudo funcione como antes, para comprar sem estranhar.

**Pré-condições**
- aura-qa com `?v2=0` na aba (a chave desliga só ali). Celular 390 e desktop 1280.

**Passo a passo**
1. Abrir `/aura-qa?v2=0` e percorrer a home.
2. Abrir a CANECA BRANCA, escolher "Envio minha arte e vocês ajustam", enviar `foto_3000.jpg`, quantidade 2, "Adicionar ao carrinho".
3. Abrir a barra da sacola e "Finalizar"; preencher; trocar o modo de entrega (se houver mais de um) e voltar; "Enviar pedido • R$ ...".
4. Na confirmação, apertar F5.
5. Abrir `/aura-qa/sacola?v2=0`.

**Critérios de aceite — funciona**
- [ ] Home de hoje (ProductList): "Como funciona", grade por categoria, "O que a gente personaliza"; sem faixa nova, sem hero novo.
- [ ] Produto de hoje (configurador antigo), sem a página nova; sacola na barra escura do rodapé, não em gaveta.
- [ ] Preço da linha com a regra nova do servidor: 2 canecas com ajuste = R$ 89,80 (o ajuste uma vez só), igual ao que o servidor cobra.
- [ ] Checkout numa página só, botão "Enviar pedido • R$ 89,80" (ou o valor com Pix).
- [ ] O pedido é criado; a confirmação antiga aparece.
- [ ] `/aura-qa/sacola?v2=0` abre a home (sem gaveta).
- [ ] `?v2=1` na mesma aba volta para a vitrine nova.

**Critérios de aceite — premium (UI/UX)**
- [ ] Mesmo com a chave desligada, a fonte da loja vale em todas as telas (Fase 1A foi direto ao ar) e a cor da loja pinta os botões com contraste certo.
- [ ] Sem emojis como ícones.

**Casos de borda**
- [ ] F5 na confirmação antiga: registrar o que acontece (o esperado com a chave desligada é perder a tela; a vitrine nova resolve isso).
- [ ] Sacola montada com a chave ligada e aberta com `?v2=0`: os itens continuam.

**Pontos de atenção conhecidos**
- QA_NOTAS F2 (app): o frete deixou de ser zerado ao trocar o modo de entrega só com a chave ligada; conferir com a chave desligada que o frete não fica errado ao trocar de "Receber em casa" para "Retirar na loja".
- QA_NOTAS F1: "Ver a peça de perto" com ícone que parece um círculo vazio no configurador de hoje.
- QA_NOTAS F2 (app): `/cardapio/studio/<slug>` segue com a confirmação antiga.

---

## Épico 3 · Escolher a peça

### CL-16 · Comparar os modelos da categoria sem abrir um por um
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 9

> Como Ana, quero comparar as canecas por foto e preço lado a lado, para escolher o modelo sem abrir cada uma.

**Pré-condições**
- Config A. `/aura-qa/c/canecas`. Celular 360 e 390; desktop 1280.

**Passo a passo**
1. Percorrer a grade de Canecas.
2. Ler um cartão com adicional pago (CANECA BRANCA) e um sem (CANECA ALÇA COLORIDA).
3. Tocar num cartão.

**Critérios de aceite — funciona**
- [ ] Cada cartão tem foto grande, no máximo um selo de canto ("Mais pedido" só na campeã, "Novo" nas recentes), até três etiquetas em texto, preço e preço no Pix ("R$ 35,91 no Pix" para R$ 39,90).
- [ ] "a partir de" aparece só onde o preço pode mudar na página (faixa de quantidade ou adicional pago, como a CANECA BRANCA); peça de preço único mostra o preço seco.
- [ ] O toque abre `/aura-qa/p/<id>` do modelo escolhido.

**Critérios de aceite — premium (UI/UX)**
- [ ] Nome do modelo na fonte da loja, sem o nome da categoria repetido quando dá para encurtar.
- [ ] Todos os cartões com a mesma altura de foto; nenhum cartão muda de forma ao passar o mouse (só sobe 2 a 3 px com sombra).
- [ ] Duas colunas em 360 px sem texto cortado no meio da palavra; nome longo ("Caneca Imperial com Alça e Borda Cromado Dourada 400ml - Sua Arte Aqui") termina com reticências em 2 linhas.

**Casos de borda**
- [ ] Peça sem foto: capa com o nome na fonte da loja, sem ícone quebrado.
- [ ] Com "reduzir movimento": sem deslocamento no hover.

### CL-17 · Primeira dobra do produto: como é, quanto é, quando fica pronto
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 1

> Como Ana, quero ver a caneca, o preço e o prazo sem rolar, para responder na hora se vale e se chega a tempo.

**Pré-condições**
- Config A. CANECA BRANCA. iPhone 390 (Safari), Android 360, desktop 1440 e notebook 1366×768.

**Passo a passo**
1. Abrir a CANECA BRANCA e não rolar.
2. Anotar o que está visível acima da barra de compra (celular) ou acima do bloco de compra (desktop).

**Critérios de aceite — funciona**
- [ ] Trilha "Início / Canecas / Branca" (ou o nome curto do modelo) com "Canecas" levando à grade.
- [ ] Nome "CANECA BRANCA" com o ícone de compartilhar ao lado; preço "R$ 39,90"; linha "R$ 35,91 no Pix" em verde.
- [ ] Sem cartão na loja, nenhuma linha "ou 3x" aparece.
- [ ] Bloco calmo com "Pronto em 3 dias úteis" e "Você aprova o mockup antes de produzir", ainda na primeira dobra no celular 390.
- [ ] Barra de compra do celular visível com o total "R$ 39,90", "R$ 35,91 no Pix", "Comprar agora" e "Adicionar à sacola".
- [ ] Não existe mais o cabeçalho antigo ("Personalize", selo azul "Estúdio · Arte personalizada").

**Critérios de aceite — premium (UI/UX)**
- [ ] Nome em Fraunces (27 px no celular, 32 px no desktop); preço em Bricolage 28 a 30 px, peso 700, dígitos tabulares.
- [ ] Foto em 6:5 no celular (não quadrada), o que deixa o prazo acima da barra.
- [ ] Desktop: palco inteiro visível entre o cabeçalho e a faixa de compra, também em 1366×768.
- [ ] Contraste AA de todos os textos do topo sobre o papel (ink3 `#756C61`).

**Casos de borda**
- [ ] Sheid com `?v2=1` (sem desconto no Pix): a linha "no Pix" some.
- [ ] Config I (cartão, até 3x): aparece "ou 3x de R$ 13,30 sem juros" (texto de parcelamento, sem duplicar "sem juros").
- [ ] Config F a 5 dias do fim: a faixa "Pedidos até ..." aparece abaixo do prazo.
- [ ] Nome longo (Caneca Imperial ...): quebra em até 3 linhas sem empurrar o preço para fora da dobra no 390.

### CL-18 · Carrossel com o mockup como slide, zoom, setas e arrastar
**Persona:** Ana (celular) e Marcos (desktop)  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Telas 1 e 4

> Como Ana, quero passar as fotos, ampliar e ver a minha arte na caneca no mesmo lugar, para não procurar onde ficou a prévia.

**Pré-condições**
- Config H (4 fotos na CANECA BRANCA). Celular 390, desktop 1440 com mouse, tablet 768.

**Passo a passo**
1. Sem personalizar: passar as fotos (arrastar no celular; setas e teclas seta no desktop).
2. Desktop: passar o mouse sobre a foto; clicar na lupa.
3. Celular: tocar na lupa.
4. Escrever "Te amo, mãe" no texto; observar o palco.
5. Tocar numa miniatura/bolinha de foto e depois voltar ao slide do mockup.
6. Rolar a página no celular até passar o palco.

**Critérios de aceite — funciona**
- [ ] Celular: bolinhas embaixo, "Foto 1 de 4" dentro da foto, lupa no canto; arrastar troca a foto.
- [ ] Desktop: miniaturas em coluna à esquerda, setas "Foto anterior"/"Próxima foto", teclas seta trocam a foto, zoom que segue o mouse.
- [ ] Em tela de toque (`hover: none`, tablet e celular), o zoom que segue o mouse não existe; fica a lupa, que abre a foto ampliada.
- [ ] Ao escrever o texto, o mockup entra como PRIMEIRO slide, fica ativo e ganha a etiqueta "Sua caneca" (o selo "Mais pedido" sai desse slide).
- [ ] Legenda do mockup: "Prévia. A loja manda o mockup final para você aprovar."
- [ ] Ao rolar além do palco no celular, aparece a faixa compacta de 72 px com nome, preço e "Ver maior"; tocar volta ao topo.

**Critérios de aceite — premium (UI/UX)**
- [ ] Troca de foto sem piscar (a nova entra por cima em 240 ms); com "reduzir movimento", troca direta.
- [ ] O mockup não recarrega ao ir e voltar entre fotos e mockup.
- [ ] Setas e lupa em "vidro" legíveis sobre foto clara e escura.

**Casos de borda**
- [ ] Peça sem foto na galeria: o palco já abre no mockup.
- [ ] Peça com 1 foto: sem bolinhas nem setas.
- [ ] Zoom do mockup ("Ver a prévia em tela cheia"): fecha com "Fechar", Esc (desktop) e o voltar do Android.

**Pontos de atenção conhecidos**
- Divergência com o mockup (Tela 2): a faixa compacta do celular deveria mostrar "a caneca ao vivo"; o código mostra a primeira FOTO do catálogo (`Doca`, `fotos[0]`), não o mockup com a arte. Registrar.

### CL-19 · Trocar de modelo e de cor sem perder o que já preenchi
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 2

> Como Ana, quero experimentar outro modelo e outra cor sem digitar tudo de novo, para comparar como fica.

**Pré-condições**
- Config A. CANECA ALÇA COLORIDA (11 cores). Celular real e desktop real (para ver a cor no 3D).

**Passo a passo**
1. Escrever "Mãe" no texto e escolher a cor rosa da alça.
2. No "Modelo", tocar em outro modelo (CANECA BRANCA); depois voltar para a ALÇA COLORIDA.
3. Observar endereço, trilha, preço e o texto.
4. Desktop: usar as setas "Ver mais modelos" / "Ver modelos anteriores" da fila.

**Critérios de aceite — funciona**
- [ ] Seção "Modelo" com "N modelos" e a fila de capas com nome curto e preço, na ordem da grade.
- [ ] Trocar de modelo muda o endereço (`/p/<novo id>`), a trilha e o preço; o texto "Mãe" continua.
- [ ] A cor continua se o modelo novo tem a mesma; senão, vai para a primeira cor dele.
- [ ] Escolher a cor conta como personalizar: o mockup vira o slide ativo e a peça muda de cor (alça rosa).
- [ ] A seção de cor se chama "Cor da caneca" (ou o rótulo que a lojista deu, como "Cor da caneca e da colher").
- [ ] Cor com adicional mostra "+R$ X" embaixo da bolinha e o topo passa a dizer "Inclui cor <nome> (+R$ X)".
- [ ] Modelo com uma cor só: "Vem numa cor só." com uma bolinha, sem seletor.

**Critérios de aceite — premium (UI/UX)**
- [ ] A troca de modelo não pisca a prévia; o preço "conta" até o novo valor.
- [ ] Bolinhas de 36 px com área de 50 px, anel na cor da loja na escolhida, borda visível em cor branca sobre o papel.
- [ ] O voltar do navegador depois de trocar de modelo volta para o modelo anterior (confirmar e registrar).

**Casos de borda**
- [ ] Trocar de modelo durante um envio de arte: o envio não se perde nem trava o botão.
- [ ] Modelo sem campo de texto: o texto digitado não aparece em lugar nenhum e não vai para a sacola.

### CL-20 · Escolher como resolver a arte já sabendo o preço de cada caminho
**Persona:** Ana e Marcos  ·  **Fase:** 3  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 3

> Como Ana, quero escolher entre mandar minha arte, pedir ajuste ou pedir para a loja criar, vendo quanto custa cada um, para o preço não me surpreender.

**Pré-condições**
- Config A. CANECA BRANCA. Celular 390 e desktop 1280.

**Passo a passo**
1. Ir à seção "Como você quer resolver a arte?".
2. Tocar em cada um dos três cartões, observando preço do topo e total da barra.
3. Em "Criem a arte pra mim", escrever um briefing de 650 caracteres.
4. Enviar `foto_3000.jpg` no caminho "Vou enviar minha arte pronta" e depois tocar em "Criem a arte pra mim".

**Critérios de aceite — funciona**
- [ ] Três cartões: "Vou enviar minha arte pronta" com "Incluso" (vem marcado), "Envio minha arte e vocês ajustam" com "+R$ 10,00", "Criem a arte pra mim" com "+R$ 15,00".
- [ ] Frases de apoio: "Seu arquivo já está pronto para impressão (PNG, JPG ou PDF)", "A gente ajusta o tamanho e as cores para ficar perfeito no produto", "Nossa equipe cria a arte do zero, a partir da sua ideia". No celular só o cartão marcado mostra a frase; no desktop, as três.
- [ ] Com ajuste: o topo diz "Ajuste da arte: +R$ 10,00, uma vez no item." e a barra mostra R$ 49,90.
- [ ] Briefing só nos dois caminhos pagos, com contador "N/600" e corte em 600 caracteres.
- [ ] "Criem a arte pra mim" esconde o envio, LIMPA o arquivo já enviado e mostra "A loja cria a arte a partir da sua ideia e manda o mockup para você aprovar antes de produzir."
- [ ] Etiqueta da seção: "Falta a arte" (vazia), "Pronta" (com arquivo), "A loja cria" (criação), "Enviando" (durante o envio).

**Critérios de aceite — premium (UI/UX)**
- [ ] Cartão escolhido com borda de 2 px na cor da loja e fundo lavado; ícone em quadrado na cor da loja; nenhum magenta nem tracejado antigo.
- [ ] Pílula "Incluso" em verde e "+R$ 10,00" neutra, ambas em Bricolage.
- [ ] Cartões com 68 px de altura mínima; grupo anunciado como "Como resolver a arte" pelo leitor de tela (botões de opção).

**Casos de borda**
- [ ] Peça sem serviço de arte (CANECA ALÇA COLORIDA): a seção se chama "Sua arte" e não tem cartões.
- [ ] Trocar de "Criem" de volta para "Vou enviar": o envio reaparece vazio (o arquivo apagado não volta sozinho).

### CL-21 · Enviar a arte com progresso, cancelar e entender os erros
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 3

> Como Ana, quero mandar a foto do meu rolo da câmera e ver que ela subiu, para ter certeza de que a loja recebeu.

**Pré-condições**
- Config A, na aura-qa (nunca na Sheid). CANECA BRANCA. iPhone real (rolo da câmera com foto HEIC), Android real, desktop com rede "Fast 3G".

**Passo a passo**
1. Tocar em "Enviar a arte da frente" e escolher `foto_3000.jpg`.
2. Durante o envio, tocar no "x" ("Cancelar o envio"); enviar de novo até o fim.
3. Tocar em "Trocar" e escolher `arte.pdf`; depois "Remover".
4. Tentar `grande_16mb.jpg`; depois `foto.heic` no iPhone (escolhendo da galeria).
5. Tocar em "Adicionar à sacola" durante um envio.

**Critérios de aceite — funciona**
- [ ] Caixa de envio com "Enviar a arte da frente", os formatos aceitos e "até 15 MB".
- [ ] Durante o envio: nome do arquivo, barra de progresso e "Enviando… N%"; a barra de compra diz "Enviando a arte da frente".
- [ ] Cancelar volta ao estado vazio sem erro.
- [ ] Enviado: miniatura, nome, medidas ("3000 × 3000 px · 4,1 MB"), "Enviada" em verde, botões "Trocar" e "Remover".
- [ ] Arquivo acima de 15 MB: "Arquivo grande demais (máx 15 MB)", sem tentar subir.
- [ ] Formato não aceito: "Formato inválido. Aceitos: <lista>".
- [ ] Tocar em "Adicionar à sacola" durante o envio não adiciona: rola até a arte.
- [ ] A foto escolhida no iPhone (HEIC) é aceita ou recusada com a frase de formato; registrar qual.

**Critérios de aceite — premium (UI/UX)**
- [ ] A miniatura aparece na hora (do próprio arquivo), sem esperar o servidor.
- [ ] Nenhum emoji (pasta, clipe, alerta); ícones do kit.
- [ ] Botão "Cancelar o envio" com 44 px.

**Casos de borda**
- [ ] Rede cai no meio do envio: "Erro no upload. Tente novamente." e o botão volta a funcionar.
- [ ] PDF: sem miniatura de imagem, com ícone de documento e sem aviso de resolução (PDF não é medido).
- [ ] F5 depois de enviar: a arte continua na peça? Registrar (a arte fica no estado da página; na sacola ela persiste).

### CL-22 · Receber o aviso de foto pequena antes de fechar, com duas saídas
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 3

> Como Ana, quero saber se a minha foto vai sair borrada, para mandar outra ou pedir que a loja ajuste.

**Pré-condições**
- Config A, na aura-qa. CANECA BRANCA (área 9 × 9 cm, pede 1063 px) e uma peça com área maior (Garrafa termica 500ml, 5 × 12 cm, pede 1417 px).

**Passo a passo**
1. CANECA BRANCA, caminho "Vou enviar minha arte pronta": enviar `foto_640.jpg`.
2. Tocar em "Pedir ajuste · +R$ 10,00".
3. Remover e enviar `foto_1100.jpg`.
4. Na Garrafa, enviar `foto_1100.jpg`.
5. Enviar `arte.pdf`.

**Critérios de aceite — funciona**
- [ ] Com 640 px: aviso "Essa foto tem 640 px. Na caneca ela pode sair borrada. Mande uma maior ou peça para a loja ajustar." com "Mandar outra" e "Pedir ajuste · +R$ 10,00".
- [ ] "Pedir ajuste" troca o caminho para "Envio minha arte e vocês ajustam", soma R$ 10,00 no item e mostra "Você já pediu o ajuste: a loja melhora o que der e mostra no mockup antes de produzir."
- [ ] O aviso não bloqueia: dá para adicionar à sacola com a foto pequena.
- [ ] CANECA BRANCA com 1100 px: sem aviso (o limite da peça é o menor entre 1200 px e o que a área pede, 1063 px).
- [ ] Garrafa com 1100 px: com aviso (limite 1200 px).
- [ ] PDF: nunca avisa.

**Critérios de aceite — premium (UI/UX)**
- [ ] Aviso em âmbar lavado, ícone de alerta (não emoji), anunciado ao leitor de tela.
- [ ] Texto com o nome da peça no gênero certo ("Na caneca", "No copo").

**Casos de borda**
- [ ] Foto de 1150 × 400 px: mede o lado maior (1150).
- [ ] Voltar à peça pelo "Editar" da sacola: registrar se o aviso reaparece (a medida fica só na memória da página).

**Pontos de atenção conhecidos**
- Mockup e comentário do código dizem "o navegador lê largura e altura antes de subir"; na prática o aviso aparece depois que o envio termina. Registrar o tempo até o aviso em 3G.

### CL-23 · Escolher uma arte pronta da loja
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 3

> Como Ana, que não tem arte, quero escolher uma das artes da loja e ver na caneca, para comprar sem precisar criar nada.

**Pré-condições**
- Sheid com `?v2=1` (a aura-qa não tem arte pronta). **Só olhar: não finalizar, não enviar arquivo.** Caneca de Vidro personalizada com Adesivo Premium (2 artes) e CANECA BRANCA (1 arte).

**Passo a passo**
1. Abrir a Caneca de Vidro; no caminho "Vou enviar minha arte pronta", achar "ou escolha uma arte pronta".
2. Tocar em cada arte.
3. Tocar em "Adicionar à sacola" e abrir a sacola (sem finalizar).

**Critérios de aceite — funciona**
- [ ] "Escolha uma arte pronta" aparece só no caminho "pronta" e só sem arquivo enviado.
- [ ] Escolher uma arte coloca a arte no mockup e conta como arte resolvida (a barra diz "Tudo pronto para a sacola", se não faltar mais nada).
- [ ] O caminho "Envio minha arte e vocês ajustam" limpa a arte pronta escolhida.
- [ ] Na sacola, a miniatura mostra a arte escolhida e o resumo cita o nome da arte.

**Critérios de aceite — premium (UI/UX)**
- [ ] Artes em fileira que desliza no celular, com o nome da arte embaixo; escolhida com anel na cor da loja.
- [ ] Grupo anunciado como "Artes prontas", cada arte com o nome.

**Casos de borda**
- [ ] Peça com campo de arte pronta e sem arte cadastrada: a opção não aparece (sem bloco vazio).

### CL-24 · Personalizar Frente, Verso e Meio, sabendo quanto o verso custa
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 4

> Como Ana, quero pôr uma frase no verso e saber na hora quanto isso soma, para não ter surpresa no total.

**Pré-condições**
- Config A. CAMISA ALGODÃO Básico 2 (PENTEADO) (verso +R$ 10,00), CANECA BRANCA (verso incluso), Garrafa termica 500ml (meio incluso). Celular 390 e desktop 1280.

**Passo a passo**
1. Na CAMISA, abrir a aba "Verso" em "A arte em cada lado".
2. Ligar "Personalizar também o verso" e escrever um texto no verso.
3. Mudar a quantidade para 2.
4. Tocar nas abas sobre o mockup (Frente/Verso) e no botão girar.
5. Na CANECA BRANCA e na Garrafa, abrir "Verso" e "Meio".

**Critérios de aceite — funciona**
- [ ] Abas "Frente · Verso · Meio" só com os lados que a peça tem; a aba do formulário e a do mockup são a mesma escolha.
- [ ] CAMISA: cartão "Personalizar também o verso" com "Opcional · adiciona arte no lado de trás da peça"; ligado, o preço do topo passa a R$ 80,00 e diz "Inclui verso (+R$ 10,00)".
- [ ] Com 2 unidades e verso, o total é R$ 160,00 (70 + 10 por unidade).
- [ ] CANECA BRANCA: "Verso incluso, sem custo adicional."; Garrafa: "Meio incluso, sem custo adicional.".
- [ ] Verso ligado sem arte nem texto: a barra diz "Falta a arte do verso" (ou "Falta o texto do verso") e o toque leva à aba Verso.
- [ ] Na sacola, o resumo diz "Frente e verso" e "inclui R$ 10,00 do verso".

**Critérios de aceite — premium (UI/UX)**
- [ ] O mockup gira para o lado escolhido; o botão girar diz "Girar: ver verso".
- [ ] Abas com 44 px, a ativa com fundo branco e sombra leve.

**Casos de borda**
- [ ] Desligar o verso depois de escrever: o texto do verso não vai para a sacola nem para a mensagem do WhatsApp.

**Pontos de atenção conhecidos**
- O cartão ligado diz "+R$ 10,00 no total", mas o verso é cobrado POR UNIDADE (com 2 camisas soma R$ 20,00). Texto a revisar para não prometer menos do que cobra.

### CL-25 · Escrever o texto com contador e escolher a cor da arte
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 4

> Como Ana, quero escrever "Te amo, mãe" e escolher uma cor que apareça bem na caneca, para ficar bonito.

**Pré-condições**
- Config A. CANECA BRANCA (texto com 8 cores de arte) e Caneca Alça de coração Preta. Celular 360 e desktop.

**Passo a passo**
1. Tocar no campo de texto da frente; escrever além do limite.
2. Escolher cada uma das cores da arte; incluir o branco.
3. Na Caneca Alça de coração Preta, escolher a cor preta `#0F172A` para o nome.

**Critérios de aceite — funciona**
- [ ] Placeholder "Ex.: Te amo, mãe" (verso: "Ex.: Com amor, Helena"; meio: "Ex.: Bom dia"); rótulo do campo com "(opcional)" quando não é obrigatório.
- [ ] Contador "N/30" (ou o limite do cadastro) dentro do campo; não aceita além do limite.
- [ ] A cor da arte muda o texto no mockup na hora.
- [ ] Branco numa caneca branca (contraste menor que 1,8:1): aparece "Essa cor quase some nesta peça. Experimente outra."
- [ ] O texto aparece no mockup ao digitar, sem atraso perceptível.

**Critérios de aceite — premium (UI/UX)**
- [ ] Campo com 48 px de altura e borda que acende em âmbar quando a barra manda para ele.
- [ ] Bolinhas de cor com anel na cor da loja na escolhida; grupo anunciado como "Cor da arte".
- [ ] No iPhone, tocar no campo não dá zoom na página (fonte de 15 px ou mais; conferir).

**Casos de borda**
- [ ] Emoji no texto: registrar se aparece no mockup e na sacola.
- [ ] Texto só com espaços: conta como vazio ("Falta o texto da frente" se for obrigatório).

### CL-26 · Digitar a quantidade e ver a régua de desconto e o prazo por faixa
**Persona:** Marcos  ·  **Fase:** 3  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 5

> Como Marcos, quero digitar 50 e ver o preço por unidade, quanto economizo e em quantos dias fica pronto, para levar a proposta sem 49 toques.

**Pré-condições**
- Config A (faixas 10+ e 50+ na CANECA BRANCA); para o prazo por faixa, Config H. Desktop 1280 e celular 390.

**Passo a passo**
1. Na seção "Quantidade", tocar no número e digitar 5; depois 7; depois 10; depois 25; depois 50.
2. Apagar tudo e sair do campo.
3. Digitar 1500.
4. Tocar na parada "50 un" da régua com a quantidade em 12; depois na parada "10 un" com a quantidade em 50.
5. Tocar em "Comprando para evento ou empresa?".

**Critérios de aceite — funciona**
- [ ] Campo aceita só números, de 1 a 999; vazio volta a 1 ao sair; 1500 vira 150 (três dígitos).
- [ ] Régua com três paradas: "1 un R$ 39,90", "10 un −10% R$ 35,91", "50 un −20% R$ 31,92"; marcador anda proporcional.
- [ ] Frase única: com 1, "Leve 10 e pague R$ 35,91 cada"; com 5 e 7, "Faltam 5 para pagar R$ 35,91 cada" / "Faltam 3 ..."; com 10, "Leve 50 e pague R$ 31,92 cada"; com 25, "Faltam 25 para pagar R$ 31,92 cada"; com 50, "Você chegou ao menor preço: R$ 31,92 cada".
- [ ] Economia: com 10, "Você economiza R$ 39,90 com o desconto de 10%."; com 50, "Você economiza R$ 399,00 com o desconto de 20%."
- [ ] Preço "por unidade" ao lado do campo e o preço do topo acompanham (R$ 31,92 cada com 50).
- [ ] Parada da régua só SOBE a quantidade (12 → 50); tocar em "10 un" com 50 não desce.
- [ ] Sempre há a linha de prazo embaixo da régua ("1 unidade: pronto em 3 dias úteis" na Config A). Config H: "50 unidades: pronto em 8 dias úteis" embaixo da régua e "Pronto em 8 dias úteis para 50 unidades" no topo, que acende de leve ao mudar.
- [ ] "Comprando para evento ou empresa?" abre o orçamento em lote.

**Critérios de aceite — premium (UI/UX)**
- [ ] Números em Bricolage tabular: o preço não "dança" de largura ao mudar.
- [ ] −/+ com 44 px; o campo com anel na cor da loja em foco; teclado numérico no celular.
- [ ] Marcador e barra animam em 320 ms; com "reduzir movimento", sem animação.

**Casos de borda**
- [ ] Peça sem faixa (CANECA ALÇA COLORIDA): a régua some; o campo e o prazo continuam.
- [ ] Faixa com adicional (ajuste +R$ 10,00): as paradas mostram o preço de tabela na faixa, e o ajuste entra UMA vez no total (ver CL-31).
- [ ] Colar "50 unidades" no campo: fica 50.

### CL-27 · Saber o frete e a retirada antes do checkout
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 6

> Como Ana, quero saber quanto custa receber ou se posso buscar de graça, antes de ir pagar.

**Pré-condições**
- Config A (só retirada) e depois Config B (entrega e retirada por app). Celular 390 e desktop.

**Passo a passo**
1. Config A: ler a seção "Entrega ou retirada".
2. Config B: em "Calcular frete", digitar `1224` e tocar em "Calcular"; depois `12242-000` e Enter; depois `01310-100`.
3. Tocar em "Não sei meu CEP".
4. Adicionar à sacola e seguir para o checkout.

**Critérios de aceite — funciona**
- [ ] Sempre visível: "Retire na loja · Jardim Colonial", com o endereço e "Grátis" em verde.
- [ ] CEP incompleto: "Faltam números no CEP. Confira os 8 dígitos."; vazio: "Digite o seu CEP para calcular."
- [ ] CEP válido: linha "Receber em casa" com o valor (ou "Grátis") e o prazo vindo do servidor, contado depois de a peça ficar pronta.
- [ ] Config B com retirada por app: linha "Retirada por aplicativo", "Você chama um Uber ou 99 para buscar na loja", "Você paga o app".
- [ ] "Não sei meu CEP" abre a busca de CEP dos Correios em outra aba.
- [ ] O CEP calculado já vem preenchido na etapa 2 do checkout.
- [ ] "Prefere pedir pelo WhatsApp?" aparece logo abaixo (só com a loja aberta).

**Critérios de aceite — premium (UI/UX)**
- [ ] CEP com máscara "00000-000" e teclado numérico; o botão "Calcular" sem branco cravado sobre cor clara.
- [ ] O erro diz o que fazer, em uma linha, sem vermelho gritante.

**Casos de borda**
- [ ] CEP fora da área: o erro do servidor aparece em linguagem de gente e a retirada continua como saída.
- [ ] Sheid (`?v2=1`): a retirada mostra o texto de prazo cadastrado; hoje ele é "5/20" (dado estranho da loja, registrar para a frente LJ).

### CL-28 · Barra de compra fixa que diz o que falta e nunca fica desabilitada
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 7

> Como Ana, quero ver o total e o que falta sempre à vista e que o botão me leve ao que falta, para não ficar tocando num botão morto.

**Pré-condições**
- Config A. CANECA BRANCA com texto obrigatório (ou peça com campo obrigatório). Celular 360 e 390; desktop 1440 e 1366×768.

**Passo a passo**
1. Abrir a peça e rolar até o fim sem preencher nada.
2. Tocar em "Adicionar à sacola"; depois na frase do que falta.
3. Preencher o que falta.
4. Tocar em "Comprar agora".
5. No desktop 1366×768, rolar até a seção da arte e ver se o bloco de compra cobre algo.

**Critérios de aceite — funciona**
- [ ] Com pendência, a barra mostra um ponto âmbar e a frase ("Falta a arte da frente", "Falta o texto da frente", "Falta escolher <opção>"); o total segue ao vivo.
- [ ] "Adicionar à sacola" nunca está apagado: o toque rola até o campo e o acende por 2,4 s; a frase balança.
- [ ] Tudo preenchido: "Tudo pronto para a sacola" com um visto verde.
- [ ] "Adicionar à sacola" é o botão principal (preenchido, à direita); "Comprar agora" é o secundário.
- [ ] "Comprar agora" com tudo pronto adiciona e abre o checkout (`/aura-qa/finalizar`).
- [ ] Desktop: bloco de compra numa faixa própria no pé da coluna direita, com "Total", "N un × R$ X", o Pix do total, a frase do que falta e os dois botões; nada fica escondido por baixo dele.
- [ ] Editando um item da sacola: um botão só, "Atualizar item · R$ X".

**Critérios de aceite — premium (UI/UX)**
- [ ] Nada por cima da barra: sem "Powered by", sem cookies, sem WhatsApp flutuante.
- [ ] Total em Bricolage 19 px animando ao mudar; botões com 48 px de altura.
- [ ] Barra respeita a área segura do iPhone (a barra de gestos não corta os botões).
- [ ] 1366×768: o bloco fica compacto (a frase vai para o lado do total) e o palco continua inteiro visível.

**Casos de borda**
- [ ] 360 px: "Adicionar à sacola" não quebra em duas linhas nem corta.
- [ ] Teclado aberto no Android: a barra não sobe cobrindo o campo digitado.

**Pontos de atenção conhecidos**
- QA_NOTAS F5: a página do produto tem cabeçalho próprio, sem busca nem gaveta de menu; a lupa do cabeçalho leva para a home. Registrar se a Ana estranha.

### CL-29 · Ver "Adicionado" por 1,4 s, o contador pulsar e o aviso "Ver sacola"
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 7; 02-fechar-a-venda, Tela 1

> Como Ana, quero ter certeza de que a caneca foi para a sacola, sem sair da página, para decidir se compro outra.

**Pré-condições**
- Config A. CANECA BRANCA pronta para adicionar. Celular e desktop.

**Passo a passo**
1. Tocar em "Adicionar à sacola" e cronometrar.
2. Observar o contador da sacola no cabeçalho e o aviso que aparece.
3. Tocar em "Ver sacola" no aviso.
4. Repetir, sem tocar no aviso, e esperar.

**Critérios de aceite — funciona**
- [ ] O botão vira "Adicionado" com visto por cerca de 1,4 s e volta a "Adicionar à sacola".
- [ ] O contador do cabeçalho soma as unidades e pulsa uma vez.
- [ ] Aparece o aviso "Adicionado à sacola" com "Ver sacola", que fica cerca de 4,5 s.
- [ ] "Ver sacola" abre a gaveta (desktop) ou a folha (celular).
- [ ] A peça continua na tela com o que foi preenchido (dá para mudar a cor e adicionar outra).

**Critérios de aceite — premium (UI/UX)**
- [ ] Aviso sem cobrir a barra de compra; texto legível sobre o fundo escuro.
- [ ] Leitor de tela anuncia "Adicionado à sacola".
- [ ] Com "reduzir movimento", o contador não pulsa.

**Casos de borda**
- [ ] Adicionar duas vezes seguidas a mesma configuração: vira uma linha com 2 ou duas linhas? Registrar e comparar com o esperado pelo PO.

### CL-30 · Detalhes abaixo da dobra: descrição, área de impressão, guia, revisões e "Da mesma categoria"
**Persona:** Marcos  ·  **Fase:** 3  ·  **Prioridade:** P2  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 8

> Como Marcos, quero saber onde a arte cabe, as medidas e a política de revisões, para mandar o arquivo certo e não pagar ajuste à toa.

**Pré-condições**
- Config H (guia de medidas) e Config C (revisões). CANECA BRANCA. Celular e desktop.

**Passo a passo**
1. Rolar até "Sobre esta caneca".
2. Tocar em "Guia de medidas"; fechar.
3. Tocar em "Tirar dúvida no WhatsApp".
4. Em "Da mesma categoria", tocar num modelo.

**Critérios de aceite — funciona**
- [ ] Título "Sobre esta caneca" (gênero certo: "Sobre este copo").
- [ ] "Área de impressão: 9 × 9 cm" com o desenho da área e "Para sair nítida, mande a arte com pelo menos 1063 × 1063 px."
- [ ] "Guia de medidas · Altura, medidas e capacidade" abre modal (folha de baixo no celular) que fecha com "x", Esc e voltar do Android.
- [ ] "Revisões da arte": "Você aprova o mockup antes de produzir. 2 revisões inclusas; revisão extra R$ 10,00." (Config C).
- [ ] "Prazo por quantidade" com as faixas (Config H).
- [ ] "Tirar dúvida no WhatsApp" com "(12) 99614-5447 · a mensagem já vai com esta peça".
- [ ] "Da mesma categoria": até 4 modelos com foto grande; o toque troca o modelo e volta ao topo da página.

**Critérios de aceite — premium (UI/UX)**
- [ ] Linhas com ícone do kit, sem emoji de régua; linhas tocáveis com 44 px.
- [ ] A área em cm e px em Bricolage com vírgula decimal ("20 × 9,5 cm").

**Casos de borda**
- [ ] Peça sem área cadastrada e sem modelo visual: a página não fala de área.
- [ ] Peça sem guia: a linha não aparece.

### CL-31 · Pagar o serviço de arte uma vez por item, em todas as telas
**Persona:** Ana  ·  **Fase:** 2 e 3  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 02-fechar-a-venda, Tela 1 (pergunta 1 do PO)

> Como Ana, quero pagar o ajuste da arte uma vez quando levo duas canecas iguais, porque a loja ajusta uma arte só.

**Pré-condições**
- Config A, aura-qa. CANECA BRANCA com "Envio minha arte e vocês ajustam" e `foto_3000.jpg`, quantidade 2.

**Passo a passo**
1. Conferir topo, barra de compra e régua na página.
2. Adicionar à sacola; conferir a linha e o subtotal.
3. Seguir o checkout até a etapa 3 com Pix; conferir o botão.
4. Criar o pedido; conferir a página do pedido e o pedido no painel.
5. Repetir com a chave desligada (`?v2=0`).
6. Na sacola, mudar para 12 unidades.

**Critérios de aceite — funciona**
- [ ] Página: topo "R$ 39,90 cada" e "Ajuste da arte: +R$ 10,00, uma vez no item."; barra "R$ 89,80" com "2 un × R$ 39,90 + arte R$ 10,00".
- [ ] Sacola: "R$ 39,90 cada · + R$ 10,00 do serviço de arte, uma vez"; linha R$ 89,80; "No Pix (10% off)" R$ 80,82.
- [ ] Checkout: botão "Pagar R$ 80,82 no Pix"; "Desconto no Pix (10%)" "− R$ 8,98".
- [ ] Página do pedido e painel: total R$ 80,82 (o servidor cobra o mesmo que a tela mostrou; nenhum 400/409).
- [ ] Com a chave desligada: o mesmo R$ 89,80 antes do Pix.
- [ ] 12 unidades: 35,91 × 12 + 10,00 = R$ 440,92 (faixa sobre a tabela, ajuste uma vez).

**Critérios de aceite — premium (UI/UX)**
- [ ] A frase "uma vez" aparece onde o valor aparece, sem a cliente precisar fazer conta.

**Casos de borda**
- [ ] "Criem a arte pra mim" (+R$ 15,00) com 50 unidades: R$ 1.611,00; no Pix R$ 1.449,90.
- [ ] Duas linhas diferentes com ajuste (branca e alça coração): o ajuste entra uma vez em CADA linha.

**Pontos de atenção conhecidos**
- QA_NOTAS F2 (backend): a regra de uma vez por linha entrou com Aura-backend#751; o app tem de mostrar exatamente o que o servidor cobra.
- QA_NOTAS F2 (backend): a preferência de cartão do Mercado Pago vai sem o frete (as duas lojas). Com a Config I e entrega, conferir o valor cobrado no Mercado Pago.

### CL-32 · Conferir o mockup 3D em aparelho real
**Persona:** Ana  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Telas 2 e 4

> Como Ana, quero girar a caneca com a minha foto e ver a cor da louça mudar, para acreditar que vai ficar como imagino.

**Pré-condições**
- Config A. iPhone real (Safari), Android real médio (Chrome), desktop Chrome e Safari. O 3D não carrega no ambiente dos agentes: esta história só vale em aparelho de verdade. CANECA ALÇA COLORIDA e CANECA BRANCA.

**Passo a passo**
1. Abrir a peça e medir o tempo até o 3D aparecer (rede 4G e Wi-Fi).
2. Escrever "Mãe", enviar `foto_3000.jpg`, trocar a cor da alça 3 vezes.
3. Arrastar a peça com o dedo; usar o botão girar; trocar Frente/Verso.
4. Deixar a página aberta 5 min e voltar.

**Critérios de aceite — funciona**
- [ ] O 3D aparece, com sombra de contato e ambiente, e a arte/texto aplicados na posição certa.
- [ ] A cor escolhida pinta a parte colorida da peça (alça) em tempo real.
- [ ] Arrastar gira a peça sem rolar a página junto; o botão girar leva ao próximo lado.
- [ ] Sem 3D (CDN bloqueada, aparelho fraco): a prévia cai para 2D sem erro vermelho.

**Critérios de aceite — premium (UI/UX)**
- [ ] Primeira prévia com arte em menos de 1 minuto desde abrir a peça (métrica da jornada); anotar o tempo.
- [ ] Sem travadas perceptíveis ao girar num Android médio; o aparelho não esquenta em 5 min.

**Casos de borda**
- [ ] Caneca metálica (Caneca Cromada Prata): reflexo coerente, arte legível.
- [ ] Modo economia de bateria do iPhone: o 3D ainda carrega ou cai para 2D sem erro.

---

## Épico 4 · Sacola em gaveta

### CL-33 · Abrir a sacola e reconhecer a minha arte em cada item
**Persona:** Ana  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 1

> Como Ana, quero conferir o que montei sem sair da página, vendo a caneca com a minha arte, para ter certeza antes de pagar.

**Pré-condições**
- Config A. Sacola com 2 itens: (1) CANECA BRANCA, texto "Te amo, mãe", ajuste, 2 un; (2) CANECA ALÇA COLORIDA com alça rosa e `foto_3000.jpg`, 1 un. Celular 390 e desktop 1440.

**Passo a passo**
1. Tocar no ícone da sacola do cabeçalho.
2. Ler cada item; fechar pelo "x", por fora da gaveta e (desktop) com Esc.
3. Abrir de novo pela barra/aviso "Ver sacola".

**Critérios de aceite — funciona**
- [ ] Desktop: gaveta lateral à direita por cima da página; celular: folha que sobe de baixo.
- [ ] Título "Sua sacola" com "3 peças".
- [ ] Cada item: miniatura do MOCKUP com a arte dela (não a foto de catálogo), nome, resumo legível (ex.: "Arte: Te amo, mãe · Envio minha arte e vocês ajustam"), linha de preço ("R$ 39,90 cada · + R$ 10,00 do serviço de arte, uma vez"), total da linha, "Editar" e lixeira.
- [ ] Rodapé: "Subtotal", "No Pix (10% off)" em verde, "Frete · calculado no próximo passo", "Pronto em 3 dias úteis após a aprovação da arte.", botão "Finalizar compra" com seta e o link "Prefere fechar pelo WhatsApp? Mandar a sacola".
- [ ] Fechar volta para onde estava, na mesma rolagem.

**Critérios de aceite — premium (UI/UX)**
- [ ] Gaveta desliza em 220 ms (sem deslizar com "reduzir movimento"); fundo escurecido; a página por baixo não rola.
- [ ] Números em Bricolage alinhados à direita; nome na fonte do texto, título na fonte da loja.
- [ ] Nenhum valor interno ("designer", "adjust", "M") no resumo.

**Casos de borda**
- [ ] 10 itens: a lista rola por dentro e o rodapé com "Finalizar compra" fica preso embaixo.
- [ ] Item com nome longo: quebra em 2 linhas sem empurrar o preço para fora.
- [ ] Peça sem prévia visual: a miniatura mostra a foto ou a capa, sem espaço vazio.

### CL-34 · Mudar a quantidade na sacola e ver os totais que o servidor confirma
**Persona:** Marcos  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 1

> Como Marcos, quero mudar de 2 para 50 direto na sacola e ver o preço cair, para não voltar à página da peça.

**Pré-condições**
- Config A. Sacola com 1 CANECA BRANCA com ajuste, 2 un. Desktop com DevTools (aba Rede) e celular.

**Passo a passo**
1. Na sacola, tocar no número e digitar 50; tocar fora.
2. Usar − e + algumas vezes.
3. Digitar 0 e sair do campo; digitar 5000.
4. Na aba Rede, observar a chamada de cotação ao mudar a quantidade.

**Critérios de aceite — funciona**
- [ ] 50 un: linha "R$ 31,92 cada · faixa de 50 un (−20%) · + R$ 10,00 do serviço de arte, uma vez", total R$ 1.606,00; No Pix R$ 1.445,40.
- [ ] A cada mudança a vitrine pede a cotação ao servidor (`POST .../studio/cotacao`) e os valores exibidos são os dele; enquanto a resposta não chega, a conta local aparece sem pular para outro valor.
- [ ] "−" fica apagado em 1 (não vai a 0).
- [ ] 0 ou vazio volta ao valor anterior.
- [ ] O contador do cabeçalho acompanha a soma das unidades.

**Critérios de aceite — premium (UI/UX)**
- [ ] Campo com teclado numérico; −/+ com 44 px e rótulos "Menos uma de <peça>" / "Mais uma de <peça>".
- [ ] Os totais não "dançam" de largura (dígitos tabulares).

**Casos de borda**
- [ ] 5000 unidades: registrar o que a sacola aceita. A página do produto limita a 999; a sacola limita a 9999 (divergência, ver achados).
- [ ] Rede offline ao mudar: a conta local fica, e ao finalizar o servidor recalcula sem erro.

### CL-35 · Editar um item e voltar para a sacola
**Persona:** Ana  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 1

> Como Ana, quero corrigir o nome da caneca que já está na sacola, sem perder os outros itens.

**Pré-condições**
- Config A. Sacola com 2 itens (CL-33). Celular e desktop.

**Passo a passo**
1. Na sacola, tocar em "Editar" do item 1.
2. Trocar o texto para "Te amo, vó" e a quantidade para 3.
3. Tocar em "Atualizar item · R$ X".

**Critérios de aceite — funciona**
- [ ] "Editar" abre a página da peça com tudo que estava preenchido (texto, cor, arte, caminho da arte, quantidade).
- [ ] A página em edição mostra um botão só, "Atualizar item · R$ 129,70" (39,90 × 3 + 10,00), e não mostra o seletor de modelos.
- [ ] Ao atualizar, a gaveta abre de novo com o item alterado, na mesma posição da lista, e o outro item intacto.
- [ ] O voltar do navegador durante a edição não duplica o item.

**Critérios de aceite — premium (UI/UX)**
- [ ] A miniatura da sacola já mostra o texto novo.
- [ ] Não aparece o aviso "Adicionado à sacola" ao atualizar (não é item novo).

**Casos de borda**
- [ ] Editar e sair sem atualizar (tocar no nome da loja): o item continua como estava.

### CL-36 · Remover um item e desfazer em até 5 segundos
**Persona:** Ana  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 1

> Como Ana, quero tirar um item e poder voltar atrás se toquei sem querer.

**Pré-condições**
- Config A. Sacola com 2 itens. Celular.

**Passo a passo**
1. Tocar na lixeira do item 2.
2. Tocar em "Desfazer" antes de 5 s.
3. Remover de novo e esperar 6 s.
4. Remover o último item.

**Critérios de aceite — funciona**
- [ ] Aparece a faixa escura "<nome da peça> saiu da sacola" com "Desfazer".
- [ ] "Desfazer" devolve o item na mesma posição, com a mesma personalização e quantidade.
- [ ] Depois de 5 s a faixa some e o item não volta.
- [ ] Removido o último, a gaveta mostra a sacola vazia (CL-37).
- [ ] Totais e contador atualizam na hora.

**Critérios de aceite — premium (UI/UX)**
- [ ] Lixeira com 44 px e rótulo "Remover <peça> da sacola"; "Desfazer" com rótulo "Desfazer: devolver <peça> para a sacola".
- [ ] A faixa não cobre o botão "Finalizar compra".

**Casos de borda**
- [ ] Remover dois itens seguidos: registrar se o "Desfazer" devolve só o último.
- [ ] F5 durante os 5 s: o item removido não volta.

### CL-37 · Sacola vazia, endereço `/sacola` e sacola que sobrevive ao F5
**Persona:** Ana e Quem volta  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 02-fechar-a-venda, Tela 1

> Como Ana, quero que a sacola continue lá quando recarrego ou volto mais tarde, e que a sacola vazia me diga para onde ir.

**Pré-condições**
- Config A. Celular e desktop.

**Passo a passo**
1. Com a sacola vazia, abrir a sacola.
2. Adicionar 1 item; apertar F5; fechar a aba e abrir a loja de novo.
3. Abrir `loja.getaura.com.br/aura-qa/sacola` numa aba nova.
4. Repetir o passo 3 com `?v2=0`.

**Critérios de aceite — funciona**
- [ ] Vazia: "Sua sacola está vazia", "Escolha uma peça e deixe com a sua cara. A gente mostra como fica antes de produzir.", botão "Ver as canecas" (a primeira categoria) e link "Ver as <segunda categoria>".
- [ ] F5 e reabrir a aba mantêm o item, com a arte.
- [ ] `/aura-qa/sacola` abre a home com a gaveta já aberta; o endereço vira `/aura-qa`; o voltar não cai de novo em `/sacola`.
- [ ] Com `?v2=0`, `/sacola` abre a home sem gaveta.

**Critérios de aceite — premium (UI/UX)**
- [ ] Título da sacola vazia na fonte da loja; ícone da sacola num círculo neutro, sem emoji.

**Casos de borda**
- [ ] Item de peça que saiu da loja depois de ir para a sacola: registrar o que a sacola mostra e se o checkout recusa com frase clara.
- [ ] Safari privado (storage bloqueado): a sacola funciona na visita, sem quebrar.

---

## Épico 5 · Checkout em 3 etapas

### CL-38 · Etapa 1 · Seus dados, com rótulos, máscara e CPF/CNPJ validado
**Persona:** Marcos (com CNPJ) e Ana (sem)  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 2

> Como Marcos, quero informar meus dados e o CNPJ da empresa sem erro, para receber a nota certa.

**Pré-condições**
- Config A. Sacola com 1 item. Aba anônima (sem dados lembrados). Celular 390 e desktop 1280.

**Passo a passo**
1. "Finalizar compra"; tocar no botão da etapa sem preencher.
2. Preencher "Nome completo"; digitar o WhatsApp só com números `12999990001`.
3. Digitar e-mail `ana@` e sair; corrigir.
4. Marcar "Quero CPF/CNPJ na nota"; digitar `123.456.789-00`; depois `529.982.247-25`; depois `11222333000181`.
5. Tocar em "Continuar para a entrega".

**Critérios de aceite — funciona**
- [ ] Barra de etapas "Seus dados · Entrega · Pagamento" com a 1 ativa; cabeçalho com "Continuar comprando", nome da loja e "Compra segura".
- [ ] Rótulo sempre acima do campo: "Nome completo" (placeholder "Como está no seu documento"), "WhatsApp" ("(12) 99999-9999"), "E-mail" com "opcional".
- [ ] O botão diz o que falta, na ordem: "Falta seu nome", "Falta seu WhatsApp", "Confira o WhatsApp com DDD", "Confira o e-mail", "Falta o CPF ou CNPJ", "Confira o CPF ou CNPJ"; tocar nele leva o foco ao campo.
- [ ] WhatsApp ganha máscara "(12) 99999-0001" ao digitar.
- [ ] Notas: "Usamos o WhatsApp só para avisar sobre o pedido e mandar a arte para você aprovar." e "Mandamos o link para acompanhar o pedido."
- [ ] E-mail inválido: "Confira o e-mail. Exemplo: nome@email.com".
- [ ] Documento: CPF inválido "Esse número não fecha. Confira os dígitos."; CPF válido "CPF válido"; CNPJ vira "11.222.333/0001-81" e "CNPJ válido".
- [ ] Tudo certo: "Continuar para a entrega" leva à etapa 2 e sobe a tela para o topo.

**Critérios de aceite — premium (UI/UX)**
- [ ] Teclado certo em cada campo (numérico no WhatsApp e no documento, e-mail no e-mail); autocompletar do navegador funciona em nome, telefone e e-mail.
- [ ] Campos com 48 px; foco com anel visível; erro em uma linha com o que fazer.
- [ ] "Seus dados são protegidos e usados só para este pedido." perto do botão.

**Casos de borda**
- [ ] Nome com acento e apóstrofo ("Conceição D'Ávila"): aceito.
- [ ] Telefone fixo com 10 dígitos: aceito ou recusado com frase clara (registrar).
- [ ] CPF com a caixa marcada e depois desmarcada: o documento não vai no pedido.

**Pontos de atenção conhecidos**
- QA_NOTAS F2: com CPF e `request_nfce: true`, o comportamento é o da loja comum (só registra o pedido de nota). A frase "A nota sai no seu nome depois que a loja confirmar o pedido." promete mais do que o sistema faz; confirmar com o PO.

### CL-39 · Voltar e ser reconhecida: "Que bom te ver de novo" e "Não sou eu"
**Persona:** Ana (segunda compra)  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 2

> Como Ana, na segunda compra, quero que meus dados já estejam lá, e que outra pessoa no mesmo aparelho possa tirá-los.

**Pré-condições**
- Config A. No mesmo navegador, um pedido já feito (CL-45) com nome "Ana Souza", WhatsApp e retirada. Celular.

**Passo a passo**
1. Montar outra peça e ir para "Finalizar compra".
2. Ler o cartão do topo da etapa 1.
3. Tocar em "Não sou eu".

**Critérios de aceite — funciona**
- [ ] Cartão com a inicial "A", "Que bom te ver de novo, Ana" e "Seus dados da última compra já estão aqui."; campos preenchidos (nome, WhatsApp, e-mail, documento e endereço).
- [ ] "Não sou eu" apaga os dados guardados e deixa os campos vazios; recarregar não traz de volta.
- [ ] Os dados ficam guardados por 90 dias neste navegador (e só nele).

**Critérios de aceite — premium (UI/UX)**
- [ ] Saudação neutra (sem "Bem-vinda"), na fonte da loja.
- [ ] "Não sou eu" com 44 px e sublinhado.

**Casos de borda**
- [ ] Outro aparelho: nada é lembrado.
- [ ] Dados lembrados com CPF: a caixa "Quero CPF/CNPJ na nota" já vem marcada.

### CL-40 · Etapa 2 · CEP primeiro, endereço sozinho e "fora da área"
**Persona:** Ana  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 3

> Como Ana, quero digitar só o CEP e o número da casa, para terminar rápido no celular.

**Pré-condições**
- Config B. Sacola com 1 item. Celular 390 e desktop.

**Passo a passo**
1. Na etapa 2, escolher "Receber em casa".
2. Digitar `12242-000`; esperar.
3. Tocar em "Alterar" no endereço achado; conferir os campos.
4. Digitar `99999-999`; depois `01310-100`.
5. Preencher o número e tocar em "Continuar para o pagamento".

**Critérios de aceite — funciona**
- [ ] Título "Como você quer receber?"; o CEP vem primeiro com a nota "Vai retirar na loja? Pode pular.".
- [ ] Com CEP válido: "Buscando o endereço…" e depois rua, bairro, cidade e UF preenchidos (ViaCEP) com o resumo e "Alterar"; o frete aparece no cartão "Receber em casa" (valor ou "Grátis") com o prazo.
- [ ] Faltando só o número, o botão diz "Falta o número da casa" e leva o foco ao campo "Número".
- [ ] CEP inexistente: "Não achamos esse CEP. Confira os números ou digite o endereço." e os campos ficam abertos para digitar.
- [ ] CEP fora da área: "<motivo> (N km da loja). Dá para retirar na loja ou mandar buscar por app.", "Receber em casa" com "Não entregamos nesse CEP." e o botão "Esse CEP está fora da área".
- [ ] O frete entra no resumo e no total antes da etapa 3.

**Critérios de aceite — premium (UI/UX)**
- [ ] Opções como cartões com ícone, título, preço à direita e detalhe; a escolhida com borda na cor da loja.
- [ ] Nenhum salto de layout quando o endereço chega.

**Casos de borda**
- [ ] ViaCEP fora do ar (bloquear `viacep.com.br` no DevTools): "Não deu para buscar o endereço agora. Digite abaixo." e dá para seguir digitando.
- [ ] CEP já calculado na página do produto vem preenchido.
- [ ] Trocar de "Receber em casa" para "Retirar na loja": o frete sai do total.

### CL-41 · Etapa 2 · Retirar na loja ou mandar buscar por app (placa ou "informo depois")
**Persona:** Ana e Marcos  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 3

> Como Marcos, quero mandar um Uber Flash buscar as canecas e informar o motorista depois, porque ainda não sei quem vai.

**Pré-condições**
- Config A (só retirada) e Config B (com retirada por app). Celular e desktop.

**Passo a passo**
1. Config A: abrir a etapa 2.
2. Config B: escolher "Retirada por app"; preencher o nome e a placa `AB-12`; depois `ABC1D23`.
3. Marcar "Ainda não sei quem vai buscar — informo depois".
4. Seguir até criar o pedido (Pix).

**Critérios de aceite — funciona**
- [ ] Config A: só "Retirar na loja", "Grátis", com o endereço da loja e "Pronto para retirar em 3 dias úteis após a aprovação da arte."
- [ ] "Retirada por app": "pago no app" e "Você chama um Uber Flash ou 99 Entrega até a loja quando estiver pronto."; campos "Nome de quem vai buscar" e "Placa do veículo" com a nota "Carro ou moto. Exemplo: ABC-1234 ou ABC-1D23.".
- [ ] Placa inválida: botão "Confira a placa do veículo"; placa Mercosul aceita e mascarada.
- [ ] "informo depois": os campos somem e aparece "Sem problema. Quando chamar o app, mande o nome e a placa para a <loja> pelo WhatsApp — a loja só entrega para quem você indicar."
- [ ] O pedido é aceito pelo servidor com "informo depois"; a etapa 3 resume "Retirada por app · informo depois quem busca".
- [ ] Na etapa 3, "Pagar na retirada" não aparece para retirada por app (Config J).

**Critérios de aceite — premium (UI/UX)**
- [ ] Placa em caixa alta enquanto digita; teclado de texto (não numérico) para a placa.

**Casos de borda**
- [ ] Sheid com `?v2=1`: a retirada mostra o texto de prazo cadastrado ("5/20"); registrar para a frente LJ (dado estranho, não é bug da tela).

**Pontos de atenção conhecidos**
- QA_NOTAS F4: no acompanhamento, "Qualquer pessoa pode buscar mostrando o número do pedido" contradiz a proteção da retirada por app (só entrega para quem a cliente indicar). Ver CL-52.

### CL-42 · Etapa 3 · Escolher como pagar e ver o botão dizer o total
**Persona:** Ana  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 4

> Como Ana, quero ver quanto fica em cada forma de pagar e o botão dizer exatamente o que vou pagar, para não ter surpresa.

**Pré-condições**
- Config A (Pix 10%); depois Config C, I e J juntas. Sacola: 1 CANECA BRANCA com ajuste (R$ 49,90). Celular e desktop.

**Passo a passo**
1. Chegar à etapa 3 sem escolher nada.
2. Tocar em "Pix"; ler o botão; tocar em "Cartão de crédito" (Config I); tocar em "Pagar na retirada" (Config J).
3. Tocar em "Alterar" do bloco "Entrega".
4. Tocar em "Adicionar um recado para a <loja>" e escrever.

**Critérios de aceite — funciona**
- [ ] Título "Como você quer pagar?" com os blocos "Seus dados" e "Entrega" resumidos e "Alterar" em cada um.
- [ ] Nada vem escolhido: o botão diz "Escolha como pagar".
- [ ] Pix: preço R$ 44,91 e "Aprovação na hora. Você economiza R$ 4,99. O código vale por 72 horas."; botão "Pagar R$ 44,91 no Pix"; resumo "Desconto no Pix (10%)" e "Total no Pix".
- [ ] Cartão: preço R$ 49,90 e "Até 3x de R$ 16,63 sem juros. Você paga no Mercado Pago e volta pra cá."; botão "Pagar R$ 49,90 no cartão".
- [ ] Pagar na retirada: "Dinheiro ou maquininha, na hora de retirar."; botão "Fazer pedido · R$ 49,90" (em casa vira "Pagar na entrega").
- [ ] Acima do botão, a linha das revisões: Config A "Você aprova o mockup antes de produzir."; Config C "Você aprova o mockup antes de produzir. 2 revisões inclusas.".
- [ ] "Alterar" volta à etapa certa com os dados preenchidos.
- [ ] O recado vai no pedido e aparece para a lojista.
- [ ] Ao tocar em pagar: "Criando o pedido…" e o botão não aceita segundo toque.

**Critérios de aceite — premium (UI/UX)**
- [ ] Cada forma como cartão com ícone (Pix, cartão, dinheiro) sem emoji, preço à direita em Bricolage; desconto do Pix em verde.
- [ ] Um único meio de pagamento na loja (Config A só Pix): registrar se já vem escolhido ou se pede o toque.

**Casos de borda**
- [ ] Erro do servidor ao criar (ex.: frete desatualizado, 409 sem motivo de loja fechada): aparece a nota vermelha com a frase do servidor acima do botão e nada é perdido.
- [ ] Pix sem desconto (Sheid `?v2=1`, só olhar): sem "Você economiza" e o total é o mesmo nas duas linhas.

### CL-43 · Resumo recolhível no celular, coluna no desktop, e andar entre as etapas
**Persona:** Ana (celular) e Marcos (desktop)  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Telas 2 a 4

> Como Ana, quero ver o total o tempo todo e abrir os itens só se quiser, para não rolar uma lista enorme no celular.

**Pré-condições**
- Config A. Sacola com 3 itens. Celular 390, desktop 1280 e 1366×768.

**Passo a passo**
1. Celular: na etapa 1, tocar em "Ver itens"; depois "Esconder itens"; tocar em "Editar a sacola".
2. Desktop: observar a coluna do resumo nas três etapas; clicar em "Editar".
3. Na etapa 3, tocar na etapa "Seus dados" da barra de etapas.
4. Na etapa 2, usar o "voltar" do navegador.

**Critérios de aceite — funciona**
- [ ] Celular: resumo recolhido com "Ver itens" e o total sempre à vista; aberto mostra miniaturas, "Subtotal · N peças", a linha da entrega, o desconto do Pix e o total.
- [ ] Desktop: coluna à direita com os itens (miniatura do mockup), prazo "Pronto em 3 dias úteis após a aprovação da arte." e os totais, presa ao rolar.
- [ ] "Editar"/"Editar a sacola" abre a gaveta por cima do checkout; ao fechar, volta à mesma etapa.
- [ ] Etapas concluídas são tocáveis ("Voltar para Seus dados"); etapas futuras não.
- [ ] Botão "Voltar" (etapas 2 e 3) volta uma etapa; "Continuar comprando" (etapa 1) volta à loja com a sacola intacta.
- [ ] Voltar do navegador na etapa 2: registrar para onde vai. As etapas não têm endereço próprio; o esperado pela jornada (princípio 7) é voltar uma tela sem perder dados.

**Critérios de aceite — premium (UI/UX)**
- [ ] Barra de etapas com número, rótulo e estado (feita com visto, atual destacada); anunciada como "Etapa 2 de 3: Entrega".
- [ ] 1366×768: o botão da etapa fica visível sem rolar depois de preencher os campos principais.

**Casos de borda**
- [ ] F5 na etapa 3: registrar em que etapa reabre e se os dados digitados continuam.

### CL-44 · Proteção contra pedido duplicado
**Persona:** Ana  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 8

> Como Ana, quero ser avisada de que já tenho um pedido esperando o Pix, para não pagar dois presentes iguais.

**Pré-condições**
- Config A. Um pedido Pix criado há poucos minutos e não pago, no mesmo navegador. Celular.

**Passo a passo**
1. Montar outra peça e tocar em "Finalizar compra".
2. Ler o aviso; tocar em "Continuar esse pedido".
3. Voltar à loja, finalizar de novo e tocar em "Fazer um novo".
4. Em outra aba do mesmo navegador, tentar finalizar.
5. Na etapa 3, tocar duas vezes rápido em "Pagar R$ X no Pix".

**Critérios de aceite — funciona**
- [ ] Aviso "Você tem um pedido esperando pagamento (#N)", "Você começou esse pedido há N minutos e o Pix ainda não entrou. Quer continuar de onde parou?", miniaturas, total, "O código vale até <dia> às <hora>" e "Se não for pago, o #N cancela sozinho em 72 horas.".
- [ ] "Continuar esse pedido" abre `/aura-qa/pedido/<token>` com o mesmo Pix.
- [ ] "Fazer um novo" segue para o checkout e mostra "O pedido #N continua esperando o pagamento. Se não for pago, cancela sozinho em 72 horas."
- [ ] Toque duplo cria UM pedido só (conferir no painel).
- [ ] Pedido já pago ou com mais de 72 h: o aviso não aparece.

**Critérios de aceite — premium (UI/UX)**
- [ ] Tom calmo, sem vermelho; "Continuar esse pedido" é o principal.

**Casos de borda**
- [ ] Outro aparelho: sem aviso (a memória é do navegador).

**Pontos de atenção conhecidos**
- Mockup 02, pergunta 5: "Fazer um novo" deixa o pedido anterior aberto até vencer em 72 h (não cancela na hora). Confirmar com o PO e com a lojista se isso gera cobrança dupla na fila.

---

## Épico 6 · Pagar e confirmar

### CL-45 · Tela do Pix: copiar, QR recolhido no celular e principal no desktop, validade de 72 h
**Persona:** Ana (celular) e Marcos (desktop)  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 5

> Como Ana, quero copiar o código Pix com um toque e colar no app do banco, para pagar em segundos.

**Pré-condições**
- Config A. Pedido Pix recém-criado (1 CANECA BRANCA com ajuste, R$ 44,91). iPhone, Android e desktop 1280.

**Passo a passo**
1. Criar o pedido e ler a tela.
2. Tocar em "Copiar código Pix"; colar num bloco de notas.
3. Celular: tocar em "Mostrar o QR Code (para pagar com outro celular)"; depois "Esconder o QR Code".
4. Desktop: observar a coluna do QR.

**Critérios de aceite — funciona**
- [ ] Endereço `/aura-qa/pedido/<token>`; título da aba "Pedido #N · Aura QA — espelho da Sheid".
- [ ] "Pedido #N", "Falta só o Pix", o valor R$ 44,91 grande e "Você economiza R$ 4,99 pagando no Pix".
- [ ] Bloco "Pix copia e cola" com o código e "Copiar código Pix", que vira "Copiado" com visto e mostra o aviso "Código Pix copiado".
- [ ] Passos: "Toque em Copiar código Pix.", "No app do banco, escolha Pix Copia e Cola e cole.", "Volte aqui: esta tela muda sozinha quando o pagamento entrar."
- [ ] Celular: QR recolhido; o link o mostra e esconde.
- [ ] Desktop (900 px ou mais): QR à esquerda como principal ("Aponte a câmera do banco"), com o código e "Copiar código Pix" embaixo.
- [ ] Validade: "O código vale por 72 horas, até <dia> às <hora>. Depois disso o pedido cancela sozinho."
- [ ] "Esta tela confere o pagamento sozinha" com a bolinha verde.

**Critérios de aceite — premium (UI/UX)**
- [ ] Botão "Copiar código Pix" no verde do Pix com texto legível e 48 px; o código em Bricolage, selecionável.
- [ ] Nenhum "Powered by" fixo; a assinatura "Loja desenvolvida com Aura." só no pé.

**Casos de borda**
- [ ] Área de transferência bloqueada: o código continua selecionável à mão.
- [ ] Pedido Pix de mais de 72 h sem pagamento: "Este pedido foi cancelado" e "O Pix não foi pago em 72 horas e o pedido cancelou sozinho. Se ainda quiser a peça, é só montar de novo." com "Voltar para a loja".
- [ ] Na aura-qa o código é de teste ("LOJA DE TESTE — NAO E UM CODIGO PIX VALIDO ..."); o QR é gerado a partir dele. Não pagar.

**Pontos de atenção conhecidos**
- QA_NOTAS F2 (backend): o Pix do Asaas é guardado com validade de 30 min, mas a tela diz 72 h. Não dá para ver na aura-qa (Pix de teste com 72 h); registrar como risco para a Sheid.
- QA_NOTAS F2 (backend): pedidos de Pix do Mercado Pago antigos, sem código guardado, abrem a confirmação sem Pix (`pix: null`).

### CL-46 · "Já paguei", comprovante e o status que muda sozinho
**Persona:** Ana  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 5

> Como Ana, quero avisar que paguei e mandar o comprovante, e ver a tela mudar quando a loja confirmar, para não ficar em dúvida se deu certo.

**Pré-condições**
- Config A. Pedido Pix pendente aberto no celular (mesma aba em que foi criado). Acesso ao painel da aura-qa num computador para confirmar o pagamento.

**Passo a passo**
1. Tocar em "Anexar comprovante" e escolher `comprovante_6mb.jpg`; depois `comprovante.jpg`.
2. Tocar em "Já paguei".
3. Tocar em "Ainda não pagou? Ver o código de novo".
4. No painel, confirmar o pagamento do pedido; olhar o celular sem tocar nele.
5. Tocar em "Ver meu pedido".

**Critérios de aceite — funciona**
- [ ] "Anexar comprovante" com "Anexar agiliza a confirmação da loja."; arquivo acima de 5 MB: "Arquivo grande demais (máximo 5 MB)"; aceito: "Enviando o comprovante…" e depois "Comprovante enviado" com "<arquivo> · a <loja> já pode conferir".
- [ ] "Já paguei" vira "Avisando a loja…" e depois a tela "Aguardando a loja confirmar" com "Avisamos a <loja> que você pagou R$ 44,91. Assim que o Pix aparecer para ela, esta tela muda sozinha e você recebe a confirmação no WhatsApp."
- [ ] "Ainda não pagou? Ver o código de novo" volta ao código.
- [ ] Até cerca de 4 s depois da confirmação no painel, sem tocar, aparece "Pagamento recebido" com "A <loja> já está com o seu pedido e manda o mockup no seu WhatsApp para você aprovar." e "Ver meu pedido".
- [ ] "Ver meu pedido" mostra a confirmação (CL-48).

**Critérios de aceite — premium (UI/UX)**
- [ ] A troca para "Pagamento recebido" é calma (sem confete, sem emoji); com "reduzir movimento", sem animação.
- [ ] O leitor de tela anuncia a mudança de estado.

**Casos de borda**
- [ ] Outro aparelho com o mesmo link: "Já paguei" e "Anexar comprovante" NÃO aparecem (a identificação do pedido fica na aba que criou); a tela ainda muda sozinha.
- [ ] Sem rede ao tocar "Já paguei": "Sem conexão. Tente de novo."
- [ ] Tela aberta por mais de 10 min: a consulta automática para (150 consultas); registrar se a tela diz isso ou se basta um F5.

### CL-47 · Cartão: ir ao Mercado Pago e voltar com o status real
**Persona:** Marcos  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 6

> Como Marcos, quero pagar no cartão da empresa e, ao voltar, saber se foi aprovado, em análise ou recusado, e o que fazer.

**Pré-condições**
- **A confirmar:** a aura-qa hoje não tem cartão (`has_card: false`). Precisa da Config I (Mercado Pago de teste) ou de outra loja de teste com cartão. Cartões de teste do Mercado Pago (aprovado, pendente, recusado). Desktop e celular.

**Passo a passo**
1. Criar pedido com "Pagar R$ X no cartão".
2. Pagar com o cartão de teste aprovado e voltar pelo botão do Mercado Pago.
3. Repetir com o cartão de teste pendente e com o recusado.
4. No recusado, tocar em "Tentar outro cartão"; voltar; tocar em "Pagar com Pix · R$ X".
5. Abrir o link do pedido recusado em outro aparelho.

**Critérios de aceite — funciona**
- [ ] Depois de criar, a página do pedido diz "Falta pagar no cartão" e "Você paga R$ X no Mercado Pago e volta pra cá. O pedido fica guardado enquanto isso." e segue sozinha para o Mercado Pago em cerca de 1,2 s.
- [ ] Aprovado: volta a `/aura-qa/pedido/<token>`; "Confirmando o pagamento" e, com a confirmação, "Pagamento aprovado" com "R$ X no cartão." e "Ver meu pedido".
- [ ] Em análise: "Pagamento em análise", "Conferindo de novo em alguns segundos"; a tela muda sozinha quando o status entra.
- [ ] Recusado: "O pagamento não foi aprovado", "Nada foi cobrado. Costuma ser limite do cartão ou um número digitado diferente. Seu pedido continua guardado por 72 horas.", "Tentar outro cartão" e "Pagar com Pix · R$ X" com "No Pix você ainda economiza R$ Y".
- [ ] O endereço fica limpo depois da volta (F5 não repete o recado).

**Critérios de aceite — premium (UI/UX)**
- [ ] Recusado sem vermelho agressivo; o texto diz o que fazer.

**Casos de borda**
- [ ] Voltar do Mercado Pago em outro navegador (o app do banco abre outro): sem página do pedido, aparece o recado curto da Negócio ("Pagamento em análise. Em breve você recebe a confirmação." etc.).
- [ ] Com entrega (Config B): conferir se o valor cobrado no Mercado Pago inclui o frete.

**Pontos de atenção conhecidos**
- QA_NOTAS F2 (app): "Pagar com Pix" no cartão recusado abre o WhatsApp da loja com "Olá! O cartão do pedido #N não foi aprovado. Posso pagar com Pix?"; o mockup diz que ele troca a forma de pagamento do MESMO pedido. Não existe rota para isso; decisão do PO.
- QA_NOTAS F2 (app): "Tentar outro cartão" depende do link do Mercado Pago guardado no navegador; em outro aparelho o botão some.
- QA_NOTAS F2 (backend): a preferência do cartão vai sem o frete.
- QA_NOTAS F2 (app): `add_payment_info` não é medido.

### CL-48 · Confirmação em `/pedido/<token>` que sobrevive ao F5 e abre em outro aparelho
**Persona:** Ana e Quem volta  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 7

> Como Ana, quero reabrir a confirmação depois de fechar o navegador, ou mandar para a minha irmã, e ver o mesmo pedido.

**Pré-condições**
- Config A. Pedido pago (CL-46). iPhone e Android.

**Passo a passo**
1. Na confirmação, ler a tela toda.
2. Apertar F5; fechar o navegador; reabrir o endereço.
3. Tocar em "Guardar este link no WhatsApp" e mandar para o Android; abrir lá.
4. Tocar em "Acompanhar pedido" e em "Personalizar outra peça".
5. Usar o "voltar" do navegador a partir da confirmação.
6. Abrir `/aura-qa/pedido/tokeninvalido`.

**Critérios de aceite — funciona**
- [ ] Topo "Pedido recebido, Ana." e "Pedido #N · feito em <data completa>".
- [ ] "Onde está o seu pedido": linha do tempo "Pedido recebido" (acesa, "Hoje, pago no Pix") → "Criando a arte" ("<loja> prepara o mockup e manda para você aprovar") → "Em produção" ("Começa assim que você aprovar") → "Pronto" ("Para retirar na loja, 3 dias úteis após a aprovação").
- [ ] "O que acontece agora": "A <loja> prepara o mockup e manda no seu WhatsApp para você aprovar."; política "Nada vai para a produção sem o seu ok." (com a Config C, "2 revisões inclusas; a partir da 3ª, R$ 10,00 cada").
- [ ] "Seus itens" com miniatura, subtotal, entrega, desconto do Pix e "Pago no Pix".
- [ ] F5, fechar e reabrir, e outro aparelho mostram a MESMA tela.
- [ ] "Guardar este link no WhatsApp" abre o WhatsApp com "Meu pedido na <loja>: <endereço do pedido>".
- [ ] "Acompanhar pedido" abre o acompanhamento; "Personalizar outra peça" volta para a loja.
- [ ] O "voltar" a partir da confirmação vai para a tela anterior ao checkout (o `/finalizar` foi trocado pelo pedido), nunca para um checkout vazio.
- [ ] Token inválido: "Não achamos esse pedido" com "Confira o link que você recebeu, ou fale com a loja pelo WhatsApp." e "Ir para a loja".

**Critérios de aceite — premium (UI/UX)**
- [ ] Título na fonte da loja, números em Bricolage, etapa atual destacada na cor da loja.
- [ ] O cartão de prévia do link no WhatsApp mostra a loja (não o pedido) e a página não é indexável (`noindex`).

**Casos de borda**
- [ ] Rede lenta ao abrir: "Abrindo seu pedido…" e, se falhar, "O pedido não carregou" com "Tentar de novo".
- [ ] Pedido "pagar na retirada" (Config J): confirma direto, com "Pagar na retirada" em âmbar no resumo.

### CL-49 · Receber o e-mail de confirmação com o link do pedido
**Persona:** Ana  ·  **Fase:** 2 e 4  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 04-pos-compra, Tela 6

> Como Ana, quero um e-mail com o número do pedido e o link, para achar tudo depois sem procurar no WhatsApp.

**Pré-condições**
- **Bloqueado na aura-qa:** a loja de teste não envia e-mail (`is_sandbox`). Precisa de uma liberação pontual do TL (loja de teste com e-mail ligado para um endereço da equipe) ou de um pedido real acompanhado com a Sheid. Pedido com e-mail preenchido.

**Passo a passo**
1. Criar pedido Pix com o e-mail da pessoa de QA.
2. Confirmar o pagamento no painel.
3. Abrir o e-mail no celular (Gmail e Apple Mail) e no desktop.
4. Tocar no botão do e-mail.

**Critérios de aceite — funciona**
- [ ] O e-mail chega depois da confirmação do pagamento (não na criação do Pix).
- [ ] Traz o número do pedido, os itens, o total e o link.
- [ ] Com a chave ligada, o link leva a `loja.getaura.com.br/<loja>/pedido/<token>`; com a chave desligada, ao acompanhamento de sempre.
- [ ] Sem e-mail no checkout, nada é enviado e nada quebra.

**Critérios de aceite — premium (UI/UX)**
- [ ] Assunto no formato do mockup ("Recebemos seu pedido #00123 · <loja>") ou registrar o assunto real.
- [ ] Botão tocável no celular; sem emoji; "Loja desenvolvida com Aura." só no rodapé do e-mail.

**Casos de borda**
- [ ] E-mail cai em spam no Gmail: registrar.

**Pontos de atenção conhecidos**
- QA_NOTAS F4: o e-mail de confirmação ainda não tem a marca da loja (template não refeito). Registrar a diferença para a Tela 6 do mockup.

---

## Épico 7 · Depois da compra

### CL-50 · Aprovar a arte pelo link do WhatsApp e ver "Arte aprovada"
**Persona:** Quem volta  ·  **Fase:** 4  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 04-pos-compra, Telas 1 e 3

> Como quem recebeu o link da arte, quero ver o mockup grande, na mesma loja em que comprei, e aprovar com um toque, para a produção começar.

**Pré-condições**
- Config A e depois Config C. Pedido pago na aura-qa; a lojista enviou a arte para aprovação no painel e copiou o link (a loja de teste não manda WhatsApp). Android com Chrome, sem login em nada.

**Passo a passo**
1. Abrir `loja.getaura.com.br/aura-qa/aprovacao/<token>`.
2. Ler a tela inteira; ampliar o mockup.
3. Tocar em "Aprovar e produzir".
4. Tocar em "Acompanhar o pedido".
5. Voltar e recarregar o link de aprovação.

**Critérios de aceite — funciona**
- [ ] A página tem a marca da loja no topo (logo ou nome, cor `#1a1612`, fonte da loja); nada de azul-marinho `#1E3A8A`; sem cabeçalho de loja, sacola nem busca.
- [ ] Título da aba "Aprovação de arte · Aura QA — espelho da Sheid".
- [ ] Rótulo "Aprovação de arte", o mockup grande (ou "Assistir o vídeo da arte" quando for vídeo), os itens ("1× CANECA BRANCA") e, na Config C, "Você ainda tem 2 revisões inclusas neste pedido.".
- [ ] "Este link vale até <data>." quando o link tem validade.
- [ ] "Aprovar e produzir" leva a "Arte aprovada" com "<peça> já pode ir pra produção. Avisamos <loja>.", "O que acontece agora" ("A arte vai para a produção.", "Prazo de 3 dias úteis — sem hora marcada, por etapas.", "Te avisamos quando estiver pronto.") e "Acompanhar o pedido".
- [ ] No painel o pedido passa para aprovado e segue para a produção.
- [ ] Recarregar depois de aprovar mostra o estado aprovado, não os botões de novo.

**Critérios de aceite — premium (UI/UX)**
- [ ] Título sem emoji (acabou o "Aprovado!" com festa); tom calmo; botões com 48 px na cor da loja com texto legível.
- [ ] O mockup ocupa a largura útil no celular sem cortar a peça.

**Casos de borda**
- [ ] Dois toques rápidos em "Aprovar e produzir": uma aprovação só; se já respondida, "Esta arte já foi respondida. Recarregue a página para ver como ficou.".
- [ ] Sem rede ao aprovar: "Não conseguimos enviar agora. Confira a conexão e tente de novo.".
- [ ] Loja despublicada depois da compra: a página abre mesmo assim, com a marca.

**Pontos de atenção conhecidos**
- QA_NOTAS F4: um mockup por link, sem "item 1 de 2" como no mockup. Com 2 peças no pedido, registrar como a cliente sabe qual está aprovando.

### CL-51 · Pedir ajuste, com revisão inclusa ou paga e anexo de referência
**Persona:** Quem volta  ·  **Fase:** 4  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 04-pos-compra, Tela 2

> Como quem recebeu a arte, quero dizer o que mudar e mandar uma imagem de referência, sabendo se o ajuste é grátis ou pago.

**Pré-condições**
- Config C (2 inclusas, extra R$ 10,00). Pedido com arte para aprovar. Celular (folha) e desktop (modal). A lojista reenvia a arte entre as rodadas.

**Passo a passo**
1. Tocar em "Pedir ajuste"; tocar em "Enviar pra loja" sem escrever.
2. Escrever "deixar o nome maior"; anexar `referencia.png`; enviar.
3. Repetir o ciclo até a 3ª revisão e ler o aviso.
4. Anexar um PDF e uma imagem de 16 MB.

**Critérios de aceite — funciona**
- [ ] Folha/modal com "O que a gente ajusta em <peça>?" (ou "na sua arte?" com mais de uma peça) e o placeholder "Ex.: deixar o nome maior · trocar a cor da letra pra dourado · usar uma fonte mais simples".
- [ ] "Enviar pra loja" só funciona com texto.
- [ ] 1ª revisão: "Ajuste incluso — você ainda vai ter 1 revisão grátis depois deste."; 2ª: "Ajuste incluso — é a última revisão grátis deste pedido."; 3ª: "Esta seria a 3ª revisão: R$ 10,00. A loja confirma com você antes de cobrar." em âmbar.
- [ ] "Anexar uma referência (opcional)": imagem vira um chip com o nome e "Remover anexo"; PDF: "Envie uma imagem (JPG, PNG ou WEBP)."; 16 MB: "Imagem maior que 15 MB. Tente uma menor.".
- [ ] Depois de enviar: "<loja> recebeu seu pedido de ajuste", "O que você pediu" com o texto, "Acompanhar o pedido" e "Falar com <loja> no WhatsApp".
- [ ] A lojista vê o pedido de ajuste e a referência no painel.
- [ ] "Histórico" mostra "A loja enviou" e "Você pediu ajuste" na ordem certa.

**Critérios de aceite — premium (UI/UX)**
- [ ] Celular: folha de baixo com o teclado sem cobrir o botão; desktop: modal centrado que fecha com Esc e "Fechar".
- [ ] "Cancelar" não perde o texto se reabrir na mesma visita (registrar).

**Casos de borda**
- [ ] Loja sem política de revisões (Config A): nenhum aviso de cobrança.

### CL-52 · Acompanhar o pedido por etapas, do "criando a arte" ao "entregue"
**Persona:** Quem volta  ·  **Fase:** 4  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 04-pos-compra, Tela 4

> Como quem volta, quero abrir o link e ver em que pé está e se precisa de mim, sem criar conta.

**Pré-condições**
- Config A. Pedido pago com retirada; a lojista avança o status no painel entre os passos. Android e iPhone.

**Passo a passo**
1. Abrir o link de acompanhar (botão "Acompanhar pedido" da confirmação, `/aura-qa/acompanhar/<token>`).
2. Lojista envia a arte para aprovação; recarregar.
3. Lojista marca "pronto"; recarregar.
4. Lojista marca "entregue"; recarregar.
5. Lojista cancela outro pedido; abrir o acompanhamento dele.

**Critérios de aceite — funciona**
- [ ] Título da aba "Seu pedido · <loja>"; marca da loja no topo; rodapé "Pedido #N · Loja desenvolvida com Aura.".
- [ ] Linha do tempo por etapas, sem horário; a atual com "é onde estamos agora".
- [ ] Arte enviada: bloco "A arte de <peça> está pronta." / "Dá uma olhada e diz se pode seguir pra produção." com "Aprovar a arte", que abre `/aura-qa/aprovacao/<token>`.
- [ ] Pronto: última etapa vira "Pronto para retirar"; bloco "Pronto para retirar." e o endereço de retirada.
- [ ] Entregue: todas as etapas feitas, "Retirado" (retirada) ou "Entregue"; bloco "Entregue com carinho." / "Esperamos que você ame." e "Pedir outro igual" (CL-54).
- [ ] Itens com miniatura e o total; "Falar com <loja> no WhatsApp" com "Olá! Queria falar sobre o meu pedido #N.".
- [ ] Cancelado: "Esta encomenda em <loja> foi cancelada. Fale com a loja se tiver dúvida." com WhatsApp e "Ir para a loja".

**Critérios de aceite — premium (UI/UX)**
- [ ] A etapa atual é inequívoca: destaque maior que as futuras e diferente das feitas.
- [ ] Etapas com rótulo acessível ("..., concluída" / "..., etapa atual").

**Casos de borda**
- [ ] Entrega com data combinada: "Entrega combinada para <data por extenso>".
- [ ] Encomenda do Matcon ou OS de ótica (outro `tipo`): segue na página de sempre, não na com marca.

**Pontos de atenção conhecidos**
- QA_NOTAS F4: a etapa atual ("Pronto para retirar") é desenhada como círculo VAZIO (fundo claro com borda), e parece não alcançada. Pedir destaque preenchido; registrar com print.
- QA_NOTAS F4: "Qualquer pessoa pode buscar mostrando o número do pedido #N." contradiz a retirada por app (só entrega para quem a cliente indicar). Revisar o texto.

### CL-53 · Pagar o saldo pelo Pix no acompanhamento
**Persona:** Quem volta  ·  **Fase:** 4  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 04-pos-compra, Tela 4 (estado saldo)

> Como quem pagou o sinal, quero pagar o saldo com um toque pelo mesmo link, para não pedir o Pix de novo.

**Pré-condições**
- **A confirmar:** como a lojista gera saldo num pedido do Studio (mockup 04, pergunta 2). Pedido com saldo e Pix do saldo. Android e iPhone.

**Passo a passo**
1. Abrir o acompanhamento.
2. Tocar em "Copiar código Pix"; colar num bloco de notas.
3. Repetir num navegador que bloqueia a área de transferência.

**Critérios de aceite — funciona**
- [ ] O bloco do saldo aparece como a próxima ação, com o valor.
- [ ] "Copiar código Pix" copia; a frase vira "Copiado! Cole no app do seu banco, na opção Pix copia e cola.".
- [ ] Sem área de transferência: "Selecione e copie o código:" com o código selecionável.
- [ ] Saldo sem Pix: "Combine o pagamento com a loja pelo WhatsApp.".

**Critérios de aceite — premium (UI/UX)**
- [ ] Botão no verde do Pix com texto legível; valor em Bricolage.

**Casos de borda**
- [ ] Saldo pago: o bloco some e a etapa segue.

### CL-54 · "Pedir outro igual" abre a peça já personalizada
**Persona:** Quem volta (Ana, que quer outra para a irmã)  ·  **Fase:** 4  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 04-pos-compra, Tela 5

> Como Ana, quero pedir outra caneca igual à que recebi sem refazer tudo, para comprar em um minuto.

**Pré-condições**
- Config A. Pedido feito PELA VITRINE e marcado como entregue, com texto, cor e `foto_3000.jpg`, 2 unidades. iPhone (Safari) e Android.

**Passo a passo**
1. No acompanhamento, tocar em "Pedir outro igual".
2. Conferir a página da peça.
3. Usar o "voltar" do navegador.
4. Repetir com um pedido cuja peça foi despublicada pela lojista.

**Critérios de aceite — funciona**
- [ ] Bloco "Gostou? Peça outra igual" com a miniatura e o botão; só aparece em pedido feito pela vitrine.
- [ ] Abre `/aura-qa/p/<id>?repetir=<token>` com a faixa "Personalização do pedido #N carregada — confira e ajuste." e o mockup já com a arte, o texto, a cor e a quantidade do pedido.
- [ ] O que o configurador de hoje não aceita mais (cor retirada, opção que saiu) volta vazio; o preço é o de hoje.
- [ ] O "voltar" leva de volta ao acompanhamento.
- [ ] Peça fora da loja: faixa âmbar "A peça do pedido #N não está mais na loja. Escolha outra ou fale com a loja."
- [ ] A faixa some ao trocar de peça ou pelo "Fechar aviso".

**Critérios de aceite — premium (UI/UX)**
- [ ] Faixa informativa (não alerta), altura mínima 44 px.
- [ ] A transição do acompanhamento (sem casca de loja) para a peça (com cabeçalho) não pisca nem mostra a home no meio.

**Casos de borda**
- [ ] Pedido com 2 peças diferentes: registrar qual abre (o código abre o primeiro item disponível).
- [ ] Erro ao buscar a personalização: "Não conseguimos carregar a personalização do pedido #N. Monte a peça de novo."

**Pontos de atenção conhecidos**
- QA_NOTAS F4: a troca "sem casca" para "com casca" no layout ao ir do acompanhamento para o produto; conferir no Safari do iPhone.

### CL-55 · Link inválido ou vencido fala com a voz da loja e dá um caminho
**Persona:** Quem volta  ·  **Fase:** 4  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 04-pos-compra, Tela 7

> Como quem abriu um link velho, quero entender o que houve e ter como falar com a loja, em vez de uma página de erro.

**Pré-condições**
- Config A. Um link de aprovação vencido (a lojista gera com validade curta ou o TL expira), um token inventado. Celular com 3G.

**Passo a passo**
1. Abrir `/aura-qa/acompanhar/tokeninventado`.
2. Abrir `/aura-qa/aprovacao/<token vencido>`.
3. Abrir `/loja-que-nao-existe/acompanhar/tokeninventado`.
4. Com a rede cortada, abrir um acompanhamento válido.

**Critérios de aceite — funciona**
- [ ] Token inexistente: marca da loja, "Não encontramos esse pedido", "Esse link pode ter expirado ou faltar algum caractere. <loja> resolve rapidinho pelo WhatsApp.", "Falar com <loja> no WhatsApp" e "Ir para a loja".
- [ ] Aprovação vencida: "Este link de aprovação expirou" e "Sem problema: <loja> manda um link novo pelo WhatsApp.".
- [ ] Loja inexistente: a mesma tela sem a marca (nome "Aura"), sem quebrar.
- [ ] Sem rede: "Não conseguimos abrir seu pedido agora", "Pode ser a conexão. Tente de novo em instantes." e "Tentar de novo".
- [ ] Nenhum "Não encontramos esta encomenda" cru com emoji de lupa.

**Critérios de aceite — premium (UI/UX)**
- [ ] Sempre há um botão de saída; nunca beco sem saída.

**Casos de borda**
- [ ] Rede 3G: medir o tempo até a tela de erro.

**Pontos de atenção conhecidos**
- QA_NOTAS F4: a página de erro de link inexistente baixa o catálogo inteiro só para pegar a marca; em 3G pode demorar. Registrar o tempo.

### CL-56 · Endereços antigos `/aprovacao` e `/acompanhar` continuam funcionando, com e sem a chave
**Persona:** Quem volta (links já enviados antes da mudança)  ·  **Fase:** 4  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 04-pos-compra, Telas 1 e 4

> Como quem recebeu o link há semanas, quero que ele ainda abra o meu pedido, para não precisar pedir outro.

**Pré-condições**
- Pedido da aura-qa (chave ligada) com links de aprovação e de acompanhamento. Um pedido antigo de loja com a chave desligada (a Sheid: só abrir, não responder a aprovação). O endereço antigo é o do app (`app.getaura.com.br/aprovacao/<token>` e `/acompanhar/<token>`; confirmar o domínio com o TL).

**Passo a passo**
1. Abrir o endereço antigo de aprovação e de acompanhamento do pedido da aura-qa.
2. Abrir o endereço antigo de um pedido da Sheid.
3. Conferir quais links a lojista copia hoje no painel da aura-qa.

**Critérios de aceite — funciona**
- [ ] aura-qa (chave ligada): o endereço antigo abre a MESMA página com a marca da loja.
- [ ] Sheid (chave desligada): o endereço antigo abre a página de sempre (a atual), funcionando.
- [ ] Com a chave ligada, os links novos que o painel gera apontam para `loja.getaura.com.br/aura-qa/aprovacao/<token>` e `/acompanhar/<token>`.
- [ ] Aprovar pelo endereço antigo tem o mesmo efeito que pelo novo.

**Critérios de aceite — premium (UI/UX)**
- [ ] Nenhum elemento do painel (barra de cookies do painel, menu) aparece na página da cliente.

**Casos de borda**
- [ ] Loja despublicada: o link gerado continua no endereço do app (o da loja daria 404).

**Pontos de atenção conhecidos**
- QA_NOTAS F4: endereços antigos com a chave ligada ainda mostram o banner de cookies do PAINEL. Registrar com print.
- O `?v2=1` não vale nos endereços antigos: eles seguem a chave da loja.

---

## Épico 8 · Temporada e loja fechada

### CL-57 · Ver "Pedidos até ..." e o aviso de último dia
**Persona:** Ana  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 01-alicerce, Tela 5

> Como Ana, quero saber até quando posso pedir para chegar a tempo, e ser avisada no último dia.

**Pré-condições**
- Config F em três momentos: data = hoje + 5; = amanhã; = hoje. Depois, data = ontem. Celular e desktop.

**Passo a passo**
1. Com hoje + 5: abrir a home, a CANECA BRANCA e a sacola.
2. Com amanhã e com hoje: repetir.
3. Com ontem: abrir a home.
4. Com hoje + 30: abrir a home.

**Critérios de aceite — funciona**
- [ ] Hoje + 5: faixa âmbar no topo da home e caixa junto do prazo na peça: "Pedidos até DD/MM — depois disso, só orçamento.".
- [ ] Amanhã: "Amanhã é o último dia para pedir nesta temporada." em vermelho.
- [ ] Hoje: "Último dia para pedir com entrega nesta temporada." em vermelho.
- [ ] Ontem: a loja fica fechada com o recado "Os pedidos desta temporada já fecharam. Você pode pedir um orçamento para a próxima leva." (ou o recado da lojista) e segue CL-58.
- [ ] Hoje + 30: nenhuma faixa (só aparece a 21 dias ou menos).

**Critérios de aceite — premium (UI/UX)**
- [ ] Cores semânticas do papel (âmbar e vermelho) com contraste AA, não a cor da loja.
- [ ] A faixa não empurra o cabeçalho preso nem cobre a barra de compra.

**Casos de borda**
- [ ] Data em outro ano: "Pedidos até DD/MM/AAAA".
- [ ] Celular com fuso diferente (ex.: Lisboa) às 22h do último dia: registrar se a vitrine e o servidor concordam (o servidor usa o horário de Brasília).

### CL-58 · Loja fechada: o recado aparece na home e na peça, e o botão vira "Pedir orçamento"
**Persona:** Ana  ·  **Fase:** 1  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 01-alicerce, Tela 6

> Como Ana, quero saber logo na entrada que a loja não está aceitando pedidos, para não montar uma caneca que não vou poder comprar.

**Pré-condições**
- Config G. Celular e desktop.

**Passo a passo**
1. Abrir a home.
2. Abrir a CANECA BRANCA, montar e tocar em "Pedir orçamento".
3. Repetir numa loja sem WhatsApp cadastrado (pedir ao TL) ou registrar como caso de borda.

**Critérios de aceite — funciona**
- [ ] Home: faixa âmbar no topo com o recado da lojista.
- [ ] Peça: o recado fica junto do botão; o principal vira "Pedir orçamento" e "Comprar agora" sai; a frase do que falta e o link "Prefere pedir pelo WhatsApp?" não aparecem (não duplica o caminho).
- [ ] "Pedir orçamento" abre o WhatsApp com a peça, a quantidade e a personalização; sem WhatsApp, abre o orçamento em lote.
- [ ] Sem recado escrito, o texto padrão: "No momento a loja está fechada para pedidos novos. Você pode pedir um orçamento e a loja responde com prazo.".

**Critérios de aceite — premium (UI/UX)**
- [ ] O recado não parece erro (âmbar, ícone de calendário), com a voz da lojista.

**Casos de borda**
- [ ] Reabrir a loja no painel e dar F5: tudo volta ao normal na hora.

### CL-59 · Loja fechada na sacola e no checkout: sem "Finalizar", com orçamento
**Persona:** Ana (sacola montada antes do fechamento)  ·  **Fase:** 1  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 01-alicerce, Tela 6

> Como Ana, que montou a sacola ontem, quero entender hoje que a loja fechou e ter um jeito de pedir as mesmas peças.

**Pré-condições**
- Sacola com 2 itens montada com a Config A; depois Config G. Celular.

**Passo a passo**
1. Abrir a loja e a sacola.
2. Tocar no botão de orçamento.
3. Abrir `/aura-qa/finalizar` direto.

**Critérios de aceite — funciona**
- [ ] Sacola: nota âmbar com o recado; "Finalizar compra" some; o frete não aparece; o botão vira o orçamento da sacola (verde do WhatsApp) com a lista das peças.
- [ ] A mensagem do WhatsApp traz cada peça, a quantidade, os preços da sacola e "Total estimado: R$ X (sem frete)".
- [ ] `/finalizar` mostra o recado, os itens e o orçamento no lugar do pedido; nenhum formulário de pagamento.

**Critérios de aceite — premium (UI/UX)**
- [ ] O botão verde do WhatsApp com texto legível (5,4:1).

**Casos de borda**
- [ ] Sacola vazia com a loja fechada: a sacola vazia normal, sem recado duplicado.

**Pontos de atenção conhecidos**
- Com a loja fechada, o checkout volta a ser o componente ANTIGO (uma página) e não o de 3 etapas; conferir que a cara continua a da loja (fonte e cor) e registrar a diferença visual.
- Mockup 01, pergunta: a sacola fechada não guarda rascunho para quando reabrir.

### CL-60 · A loja fecha no meio da compra: o 409 vira recado, não erro
**Persona:** Ana  ·  **Fase:** 1 e 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 01-alicerce, Tela 6

> Como Ana, se a loja fechar enquanto pago, quero uma explicação clara e um caminho, não uma mensagem técnica.

**Pré-condições**
- Config A. Duas pessoas: QA no celular na etapa 3 e a frente LJ no painel. Celular.

**Passo a passo**
1. Chegar à etapa 3 com Pix escolhido.
2. No painel, fechar a loja com o recado da Config G.
3. No celular, sem recarregar, tocar em "Pagar R$ X no Pix".

**Critérios de aceite — funciona**
- [ ] Nenhum pedido é criado.
- [ ] A tela passa a se comportar como loja fechada (recado da lojista e orçamento), sem texto técnico ("409", "Conflict") nem vermelho de erro.
- [ ] Voltar à loja: home e peça já mostram o recado sem precisar de F5.

**Critérios de aceite — premium (UI/UX)**
- [ ] A troca é imediata e sem piscar a página.

**Casos de borda**
- [ ] 409 por frete desatualizado (outro motivo): continua como erro comum do formulário, com a frase do servidor.

---

## Épico 9 · Orçamento em lote

### CL-61 · Colar a coluna da planilha e ver a contagem, o preço por unidade e a escada
**Persona:** Marcos  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 02-fechar-a-venda, Tela 9

> Como Marcos, quero colar os 50 nomes da planilha como eles vêm, para receber o preço sem digitar nome por nome.

**Pré-condições**
- Config A. Desktop com Excel ou Google Planilhas (`planilha_50_nomes.xlsx`) e celular.

**Passo a passo**
1. Abrir `/aura-qa/orcamento` (ou "Pedir orçamento em lote" da home).
2. Em "De qual evento estamos falando?", escrever "Formatura Medicina 2026".
3. Em "Qual peça?", escolher a CANECA BRANCA.
4. Copiar a coluna "Nome" da planilha (50 linhas) e colar em "Quem vai receber? Um nome por linha."
5. Colar de novo copiando as DUAS colunas (Nome e Setor).
6. Apagar até ficar com 12 nomes; depois colar 205 nomes.
7. Escrever "Ana; Pedro; Silva, João" numa linha.

**Critérios de aceite — funciona**
- [ ] Contagem ao vivo ao lado do título: "50 pessoas" (linhas vazias não contam).
- [ ] "Silva, João" conta como UM nome; ";" separa; duas colunas coladas contam só a primeira.
- [ ] "Prévia do lote" com "50 × R$ 39,90" (preço de tabela) R$ 1.995,00, "Desconto por volume (20%)" "− R$ 399,00", "Total do lote" R$ 1.596,00 e o prazo ("Prazo estimado: 3 dias úteis." ou a faixa da Config H). A prévia do lote não inclui serviço de arte.
- [ ] Com 12 nomes: "12 × R$ 39,90", "Desconto por volume (10%)" e a frase "Faltam 38 nomes para R$ 31,92 cada (20% off)." (próxima faixa).
- [ ] 205 nomes: "A lista tem 5 nomes além do limite de 200 por pedido. Fale com a loja para dividir em dois lotes."
- [ ] Sem peça escolhida: "Escolha a peça para ver o preço.".

**Critérios de aceite — premium (UI/UX)**
- [ ] Campo de nomes com 150 px ou mais, rolagem própria, fonte de 15 px.
- [ ] Números da prévia em Bricolage tabular, alinhados à direita.

**Casos de borda**
- [ ] Nomes com acento e emoji: contam e vão como estão.
- [ ] Colar pelo celular (lista do WhatsApp com quebras de linha): conta certo.

### CL-62 · Contato com máscara e data com mínimo em dias úteis
**Persona:** Marcos  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 02-fechar-a-venda, Tela 9

> Como Marcos, quero escolher a data da formatura num calendário que não me deixa pedir o impossível, para não prometer o que a loja não entrega.

**Pré-condições**
- Passo 1 do lote preenchido (CL-61). Desktop Chrome, Safari e celular (iPhone e Android). Fazer numa sexta-feira e numa segunda, se possível.

**Passo a passo**
1. Tocar em "Continuar"; ver o passo 2.
2. Em "Como a loja fala com você", preencher o nome e digitar o WhatsApp só com números.
3. Em "Para quando?", abrir o seletor de data e tentar escolher amanhã.
4. Escolher a data mínima oferecida; depois uma data 20 dias à frente.
5. Tocar em "Pedir orçamento" com o WhatsApp incompleto.

**Critérios de aceite — funciona**
- [ ] O botão diz o que falta em cada passo ("Diga de qual evento se trata.", "Escolha a peça que vai ser personalizada.", "Cole a lista de nomes, um por linha.", "Diga seu nome.", "Informe um WhatsApp com DDD.").
- [ ] WhatsApp ganha máscara "(12) 99999-0001".
- [ ] O seletor não aceita data antes de hoje + prazo da faixa, em dias úteis (sábado e domingo não contam); a frase diz "A partir de DD/MM/AAAA, pelo prazo desta quantidade." e, com data escolhida, "Entrega até DD/MM/AAAA.".
- [ ] "Para quando?" e "Alguma observação?" marcados como opcional.
- [ ] "Voltar" retorna ao passo 1 com tudo preenchido.

**Critérios de aceite — premium (UI/UX)**
- [ ] Seletor nativo do sistema no celular e no desktop.
- [ ] Os campos têm rótulo visível (não só placeholder); registrar onde o "Seu nome" aparece só como placeholder.

**Casos de borda**
- [ ] Feriado nacional (12/10): não é descontado de propósito; a loja corrige na resposta.
- [ ] Navegador sem seletor de data: campo com máscara DD/MM/AAAA.

### CL-63 · Ver o número do orçamento (L-XXXXXX) e mandar no WhatsApp
**Persona:** Marcos  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 02-fechar-a-venda, Tela 9

> Como Marcos, quero um número do orçamento para citar na conversa com a loja, para a lojista achar meu pedido sem perguntar.

**Pré-condições**
- Lote completo (CL-61 e CL-62). Desktop e celular.

**Passo a passo**
1. Tocar em "Pedir orçamento".
2. Ler a tela final.
3. Tocar no botão do WhatsApp.
4. Tocar em "Voltar para a loja".

**Critérios de aceite — funciona**
- [ ] "Enviando..." e depois "Orçamento em lote registrado" com "Orçamento #L-XXXXXX" (código que vem do servidor, 6 caracteres depois do "L-").
- [ ] Título "<loja> recebeu sua lista, Marcos." e o resumo "50 CANECA BRANCA para "Formatura Medicina 2026", com estimativa de R$ 1.596,00 (R$ 31,92 cada) e pronto em N dias úteis depois da aprovação."
- [ ] "Isso é um orçamento, ainda não é um pedido fechado. A <loja> confere a lista e confirma o preço e o prazo."
- [ ] "O que acontece agora": "A <loja> confere os 50 nomes e o prazo.", "Você recebe no WhatsApp o orçamento #L-XXXXXX com a prova da arte.", "Aprova e paga o sinal pelo link. Precisa de nota com CNPJ? É lá que você informa.".
- [ ] Botão "Mandar o #L-XXXXXX no WhatsApp da <loja>" abre com "Olá! Mandei pela loja <loja> o orçamento #L-XXXXXX.", "Evento: Formatura Medicina 2026", "50 peças · CANECA BRANCA" e "Estimativa: R$ 1.596,00".
- [ ] O rascunho aparece no painel da lojista com o mesmo código.
- [ ] Sem código do servidor, a tela não inventa número ("Avisar a <loja> no WhatsApp").

**Critérios de aceite — premium (UI/UX)**
- [ ] Código em Bricolage com espaçamento de letras, fácil de ditar.

**Casos de borda**
- [ ] Falha ao enviar: "Não foi possível registrar agora." e os dados continuam na tela.

**Pontos de atenção conhecidos**
- O mockup usa "#L-0042" (sequência); o código usa o formato do servidor ("L-3F9A2C"). Confirmar com o PO qual vale.
- O CNPJ do Marcos só entra no link público do orçamento (depois); não há campo de CNPJ no lote.

---

## Épico 10 · Pedir pelo WhatsApp

### CL-64 · Pedir uma peça pelo WhatsApp com a mensagem pronta e os preços certos
**Persona:** Ana  ·  **Fase:** 2 e 3  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Telas 6 e 8

> Como Ana, que prefere falar com gente, quero que a mensagem já vá com a caneca, a personalização e o preço que eu vi, para a lojista não perguntar tudo de novo.

**Pré-condições**
- Config A. CANECA BRANCA: "Criem a arte pra mim" com briefing "Flores e o nome Maria", texto "Maria" na cor `#BE185D`, 2 un. Celular com WhatsApp.

**Passo a passo**
1. Tocar em "Prefere pedir pelo WhatsApp?" (abaixo do frete).
2. Ler a mensagem antes de enviar.
3. Voltar e tocar em "Tirar dúvida no WhatsApp" (detalhes).

**Critérios de aceite — funciona**
- [ ] Mensagem: "Olá! Vim pela loja Aura QA — espelho da Sheid e quero pedir:", "*CANECA BRANCA*", "2 × R$ 39,90 + R$ 15,00 do serviço de arte = R$ 94,80".
- [ ] Linhas com os NOMES que a cliente viu: "Quem cria a arte: Criem a arte pra mim", "Briefing da arte: Flores e o nome Maria", "Texto: Maria", "Cor da arte: #BE185D"; nenhum valor interno ("designer", "adjust").
- [ ] Campos vazios não viram linha.
- [ ] Arte enviada vai como o endereço do arquivo.
- [ ] Com 12 un: "12 × R$ 35,91 + R$ 15,00 do serviço de arte = R$ 445,92" (faixa aplicada, arte uma vez).

**Critérios de aceite — premium (UI/UX)**
- [ ] O link fica no fluxo, discreto, sem competir com "Adicionar à sacola".

**Casos de borda**
- [ ] Mensagem muito longa (briefing de 600 caracteres + vários campos): termina com "…" antes de 1200 caracteres, sem cortar no meio de um endereço.
- [ ] Loja sem WhatsApp: o link não aparece.

**Pontos de atenção conhecidos**
- A mensagem não diz se o verso foi escolhido (só o preço já inclui). Com a CAMISA com verso, conferir e registrar se a lojista entende que é frente e verso.

### CL-65 · Mandar a sacola inteira pelo WhatsApp
**Persona:** Marcos  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 1

> Como Marcos, quero mandar a sacola montada para a loja negociar comigo, com os mesmos preços que a sacola mostra.

**Pré-condições**
- Config A. Sacola com 12 CANECAS BRANCAS com ajuste e 1 CANECA ALÇA COLORIDA. Desktop (WhatsApp Web) e celular.

**Passo a passo**
1. Abrir a sacola e tocar em "Prefere fechar pelo WhatsApp? Mandar a sacola".
2. Ler a mensagem.

**Critérios de aceite — funciona**
- [ ] "Olá! Vim pela loja Aura QA — espelho da Sheid e quero um orçamento destas peças:".
- [ ] Por item: "*CANECA BRANCA* × 12", "12 × R$ 35,91 + R$ 10,00 do serviço de arte = R$ 440,92 (faixa de 10 un: -10%)" e a personalização com os nomes vistos.
- [ ] "Total estimado: R$ 485,91 (sem frete)" (440,92 + 44,99), igual ao subtotal da sacola.

**Critérios de aceite — premium (UI/UX)**
- [ ] O link é secundário, abaixo de "Finalizar compra", com 44 px de toque.

**Casos de borda**
- [ ] Sacola com 10 itens: a mensagem termina com "…" se passar de 1200 caracteres; registrar se o total ficou de fora.

**Pontos de atenção conhecidos**
- Texto do link: o mockup diz "Mandar a sacola para a Sheid"; o código diz "Prefere fechar pelo WhatsApp? Mandar a sacola". Texto conforme mockup a decidir.

---

## Épico 11 · Qualidade transversal premium

### CL-66 · A fonte da loja em todas as telas, e Bricolage nos números
**Persona:** Ana  ·  **Fase:** 1 a 5  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 00-kit (tipografia); 01-alicerce, Tela 1

> Como Ana, quero que a loja tenha a mesma cara do começo ao fim, para confiar que ainda estou na mesma loja.

**Pré-condições**
- aura-qa com o par "classic" (Fraunces, DM Sans, Bricolage Grotesque); depois trocar o par na aba Design para "modern" e "humanist" (e tentar "editorial"). Desktop com DevTools e iPhone.

**Passo a passo**
1. Percorrer: home, categoria, peça, sacola, checkout (3 etapas), Pix, confirmação, aprovação, acompanhamento, orçamento em lote, tela de erro.
2. Em cada uma, inspecionar o título principal, um texto corrido e um preço (DevTools, "Fonte renderizada" / Computed).
3. Trocar o par e repetir em 3 telas (home, peça, confirmação).

**Critérios de aceite — funciona**
- [ ] Títulos na fonte display do par (Fraunces no "classic"), texto em DM Sans, números, preços, quantidades, CEP, código Pix e rótulos em caixa alta em Bricolage Grotesque com dígitos tabulares.
- [ ] Nenhum texto em fonte do sistema (-apple-system, Arial, Georgia) e nenhum em DM Mono.
- [ ] A fonte não muda ao entrar na peça, no checkout ou no pós-compra (aprovação e acompanhamento usam o par da loja).
- [ ] A fonte das ARTES (a letra estampada na peça) é a escolhida na personalização, não a da loja.
- [ ] Só o par escolhido é baixado (aba Rede: um link de fontes do Google com as famílias do par e a Bricolage).

**Critérios de aceite — premium (UI/UX)**
- [ ] Sem "piscada" de fonte perceptível na primeira carga em 4G (o texto não troca de forma de um jeito que pule o layout).
- [ ] Hierarquia coerente: título de página maior que título de seção, que é maior que rótulo.

**Casos de borda**
- [ ] Par "editorial": registrar se a aba Design aceita salvar (QA_NOTAS Anexo A: o servidor recusava `editorial` na loja comum).
- [ ] Rede que bloqueia fonts.googleapis.com: a loja continua legível com a fonte de reserva, sem texto invisível.

### CL-67 · A cor da loja com contraste AA em todas as telas, em quatro cores
**Persona:** Ana  ·  **Fase:** 1 a 5  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 00-kit (cor da loja, brandPair); 01-alicerce, Tela 1

> Como Ana numa loja amarela, quero ler todos os botões e textos, para não desistir por achar que a loja está quebrada.

**Pré-condições**
- aura-qa com a cor principal trocada, uma de cada vez: Sheid `#1a1612`, Rosa `#D6336C`, Amarelo `#F2C94C`, Petróleo `#0F6E7A`. Desktop com um verificador de contraste (DevTools ou WebAIM) e celular ao sol (brilho médio).

**Passo a passo**
1. Para cada cor, percorrer: faixa de anúncio, cabeçalho (contador da sacola), destaque, botões da home, "Tirar dúvida", peça (cartão de arte escolhido, régua, "Adicionar à sacola"), aviso "Adicionado", gaveta, checkout (etapa ativa, opção escolhida, botão), Pix, confirmação (linha do tempo), aprovação e acompanhamento, lote.
2. Medir o contraste do texto sobre a cor da loja e da cor da loja usada como texto sobre o papel.

**Critérios de aceite — funciona**
- [ ] Texto sobre a cor da loja com 4,5:1 ou mais (texto normal) em todas as telas, nas quatro cores; no Amarelo o texto do botão é escuro, nunca branco.
- [ ] Cor da loja usada como texto/ícone sobre o papel (`marcaTexto`) com 4,5:1 ou mais; no Amarelo ela escurece para ficar legível.
- [ ] Só a cor PRINCIPAL pinta a vitrine: nenhuma cor de destaque da lojista, nenhum azul-marinho `#1E3A8A`, nenhum magenta `#EC4899`, nenhum branco cravado sobre a cor.
- [ ] Verde do Pix, âmbar, vermelho e azul de estado não mudam com a cor da loja.
- [ ] Texto de apoio (ink3) com 4,5:1 sobre o papel `#FBF8F3` (cor `#756C61`).

**Critérios de aceite — premium (UI/UX)**
- [ ] Com a cor quase preta da Sheid, os estados escolhidos (cartão, bolinha, etapa) continuam distinguíveis do não escolhido.
- [ ] Nenhum elemento "some" no Amarelo (bordas, anéis de foco, barra da régua).

**Casos de borda**
- [ ] Cor branca `#FFFFFF` como principal: registrar como a vitrine se protege (botões visíveis? bordas?).
- [ ] Modo escuro do sistema ligado: a vitrine continua no tema papel e legível (registrar).

### CL-68 · Ícones sem emoji e microcopy consistente
**Persona:** Ana e Marcos  ·  **Fase:** 1 a 5  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 00-kit (sprite de ícones)

> Como Ana, quero uma loja que fala comigo do mesmo jeito em todas as telas, com ícones bonitos em qualquer celular.

**Pré-condições**
- Config A. iPhone antigo (iOS 15 ou 16), Android com fonte do sistema diferente, desktop Windows (Edge).

**Passo a passo**
1. Percorrer todas as telas do fluxo principal e anotar cada ícone e cada botão.
2. Comparar os textos de botões e avisos com esta lista de regras.

**Critérios de aceite — funciona**
- [ ] Nenhum emoji em lugar nenhum (régua, pasta, clipe, alerta, festa, lupa): só ícones do kit, iguais em todos os aparelhos.
- [ ] Com a chave ligada, sempre "sacola" (nunca "carrinho").
- [ ] Botões dizem o que acontece ("Adicionar à sacola", "Pagar R$ 44,91 no Pix", "Aprovar e produzir", "Enviar pra loja").
- [ ] Erros dizem o que fazer ("Confira o CPF ou CNPJ", "Faltam números no CEP. Confira os 8 dígitos.").
- [ ] Prazo sempre em dias úteis, nunca em horas (exceto a validade do Pix: 72 horas).

**Critérios de aceite — premium (UI/UX)**
- [ ] Tratamento por "você" em tudo.
- [ ] Registrar para o PO as inconsistências: "pra" e "para" misturados ("Enviar pra loja", "pode seguir pra produção", "volta pra cá" x "para você aprovar") e travessões em textos de interface ("Pedidos até DD/MM — depois disso, só orçamento.", "Ajuste incluso — ...", "Personalização do pedido #N carregada — confira e ajuste.", "Prazo de N dias úteis — sem hora marcada, por etapas.", "Ainda não sei quem vai buscar — informo depois").

**Casos de borda**
- [ ] Com a chave desligada: registrar os emojis e rótulos antigos que sobraram (é a tela de hoje).

### CL-69 · Movimento suave, e nada se mexendo com "reduzir movimento"
**Persona:** Ana  ·  **Fase:** 1 a 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 00-kit (movimento 150/220 ms)

> Como quem sente enjoo com animação, quero que a loja respeite a minha preferência, para comprar sem desconforto.

**Pré-condições**
- iPhone (Ajustes, Acessibilidade, Movimento, "Reduzir movimento"), Android ("Remover animações") e macOS/Windows com a preferência. Config D.

**Passo a passo**
1. Com a preferência DESLIGADA, observar: esqueleto, banners, artes do destaque, gaveta do menu, sacola, carrossel, preço que conta, régua, contador que pulsa, "Adicionado", faixa compacta do celular, frase que balança.
2. LIGAR a preferência e repetir.

**Critérios de aceite — funciona**
- [ ] Desligada: transições curtas (150 a 320 ms), curva suave, sem quique.
- [ ] Ligada: esqueleto parado; banners e artes não trocam sozinhos; gaveta e folha aparecem sem deslizar; carrossel troca direto; régua e marcador pulam sem animar; rolagens automáticas (ir ao que falta, voltar ao topo) sem animação.

**Critérios de aceite — premium (UI/UX)**
- [ ] Nenhuma animação em laço infinito na tela (exceto a troca de artes/banners com a preferência desligada, sempre com pausa visível).

**Casos de borda**
- [ ] Mudar a preferência com a loja aberta: vale sem recarregar (registrar).

### CL-70 · Comprar com leitor de tela (VoiceOver e TalkBack)
**Persona:** Ana (usuária de VoiceOver)  ·  **Fase:** 1 a 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** todos

> Como pessoa cega, quero comprar uma caneca personalizada ouvindo a tela, para não depender de ninguém.

**Pré-condições**
- Config A. iPhone com VoiceOver (Safari) e Android com TalkBack (Chrome). Fone de ouvido.

**Passo a passo**
1. Da home, achar a CANECA BRANCA pela busca.
2. Na peça: escolher o caminho da arte, escrever o texto, escolher a cor da arte, mudar a quantidade para 10, adicionar à sacola.
3. Abrir a sacola, finalizar, completar as 3 etapas e criar o pedido Pix.
4. Copiar o código Pix.

**Critérios de aceite — funciona**
- [ ] Todo botão de ícone tem nome ("Abrir a sacola, 1 peça", "Compartilhar", "Buscar na loja", "Fechar sacola", "Diminuir quantidade", "Foto anterior").
- [ ] Grupos de escolha são anunciados como opções com estado ("Como resolver a arte", "Cor da arte", "Modelo", "Como você quer pagar?").
- [ ] Mudanças importantes são anunciadas sem mover o foco: preço unitário e total, "Adicionado à sacola", "Link da peça copiado", "Código Pix copiado", mudança do status do Pix.
- [ ] Títulos de tela são anunciados como cabeçalho; a barra de etapas diz "Etapa 2 de 3: Entrega".
- [ ] Ao abrir a gaveta/folha, o foco entra nela e não passeia pela página de trás; ao fechar, volta ao botão que abriu (registrar).
- [ ] A frase do que falta é um botão ("Falta a arte da frente. Tocar leva ao campo.").

**Critérios de aceite — premium (UI/UX)**
- [ ] Ordem de leitura igual à ordem visual; nada decorativo lido (leque de fotos, imagens de fundo).
- [ ] O fluxo inteiro é possível só com gestos do leitor, sem ajuda visual.

**Casos de borda**
- [ ] Mockup 3D: tem uma descrição ("Sua caneca, frente") e não prende o foco.
- [ ] Texto ampliado a 200% no sistema: nada cortado nem sobreposto na barra de compra e no checkout.

### CL-71 · Comprar só com o teclado no desktop
**Persona:** Marcos  ·  **Fase:** 1 a 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** todos

> Como Marcos, que prefere o teclado, quero navegar e comprar sem o mouse, para ser rápido.

**Pré-condições**
- Config A e D. Chrome, Safari (com "Pressionar Tab para destacar cada item" ligado) e Edge, 1440.

**Passo a passo**
1. Com Tab e Shift+Tab, percorrer a home (banners, busca, categorias, cartões).
2. Na busca, digitar e escolher um resultado com o teclado.
3. Na peça: setas do carrossel, escolher cor e caminho com Espaço/Enter, digitar a quantidade, adicionar.
4. Sacola, checkout e Pix só com teclado; Esc em cada camada.

**Critérios de aceite — funciona**
- [ ] Foco sempre visível (anel na cor da loja ou contorno nítido), inclusive sobre fotos.
- [ ] Foco no banner pausa o giro.
- [ ] Setas trocam as fotos do carrossel quando ele está em foco.
- [ ] Esc fecha: busca, menu, sacola, guia de medidas, zoom.
- [ ] Enter no CEP calcula o frete na peça.
- [ ] Nenhum elemento clicável fica fora do alcance do Tab; nenhum foco "preso" atrás de uma camada.

**Critérios de aceite — premium (UI/UX)**
- [ ] Ordem de Tab lógica (esquerda para direita, cima para baixo; coluna do produto antes do bloco de compra).

**Casos de borda**
- [ ] Barra de etapas: etapas concluídas focáveis; futuras não.

### CL-72 · Desempenho percebido e rede 3G
**Persona:** Ana (4G fraco no ônibus)  ·  **Fase:** 1 a 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 7

> Como Ana no 4G fraco, quero que a loja apareça rápido e que trocar de tela não recarregue tudo, para não desistir esperando.

**Pré-condições**
- Config A. Desktop Chrome com DevTools (Rede "Slow 3G" e "Fast 3G", cache desligado) e Android médio real em 4G.

**Passo a passo**
1. Abrir a home em "Slow 3G" e cronometrar: esqueleto, primeira dobra com texto, fotos.
2. Ir: home → categoria → peça → sacola → checkout; observar a aba Rede.
3. Abrir a peça por link direto em "Fast 3G" e cronometrar a primeira prévia com a arte.
4. Rodar o Lighthouse (celular) na home e na peça.

**Critérios de aceite — funciona**
- [ ] Esqueleto em menos de 1 s; primeira dobra com texto em menos de 6 s em "Slow 3G".
- [ ] Trocar de tela dentro da loja NÃO baixa a loja de novo (nenhuma nova chamada de `/studio/products` na aba Rede); só o que a tela nova precisa (fotos, modelo 3D, cotação).
- [ ] Fotos entram sem empurrar o texto (espaço reservado); CLS abaixo de 0,1 no Lighthouse.
- [ ] Botões respondem ao toque na hora, mesmo com rede lenta (o estado muda antes da resposta do servidor quando dá).

**Critérios de aceite — premium (UI/UX)**
- [ ] Nenhuma tela em branco em nenhum momento; toda espera tem esqueleto, "Enviando…", "Buscando o endereço…", "Abrindo seu pedido…".
- [ ] Anotar LCP e INP do Lighthouse de celular na home e na peça (linha de base para o PO).

**Casos de borda**
- [ ] Offline no meio do checkout: a mensagem de erro aparece e nada digitado se perde.

### CL-73 · Voltar e avançar do navegador em todas as telas
**Persona:** Ana e Quem volta  ·  **Fase:** 1 a 5  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 01-alicerce, Tela 2 (princípio 7 da jornada)

> Como Ana, quero que o "voltar" volte uma tela e nunca me tire da loja nem apague o que montei.

**Pré-condições**
- Config A. iPhone (Safari, gesto de arrastar da borda e botão), Android (botão voltar do sistema) e desktop (botões e Alt+seta).

**Passo a passo**
1. Home → categoria Canecas → CANECA BRANCA → trocar de modelo → abrir outro pela "Da mesma categoria". Voltar até a home e avançar até o fim.
2. Na peça, preencher texto; ir à sacola; "Finalizar compra"; etapa 2; voltar pelo navegador.
3. Criar um pedido; na página do pedido, voltar.
4. Abrir a sacola (gaveta) e apertar o voltar do Android.
5. Abrir o zoom de uma foto e apertar voltar.
6. Abrir o link de uma peça vindo do WhatsApp (aba nova) e voltar duas vezes.

**Critérios de aceite — funciona**
- [ ] Cada tela com endereço (home, `/c/`, `/p/`, `/finalizar`, `/pedido/`, `/orcamento`) entra no histórico; voltar e avançar percorrem exatamente o caminho feito.
- [ ] Voltar para a peça mantém o que foi preenchido (texto, cor, arte).
- [ ] Voltar para uma lista mantém a rolagem.
- [ ] Da página do pedido, o voltar não cai num checkout vazio.
- [ ] Link de fora: o primeiro voltar leva à home da loja; o segundo sai.
- [ ] Nenhum voltar mostra tela branca ou "piscada" de outra tela.

**Critérios de aceite — premium (UI/UX)**
- [ ] O gesto de voltar do iPhone não conflita com arrastar o carrossel ou o banner.

**Casos de borda**
- [ ] Voltar com a gaveta da sacola ou o menu aberto: registrar se fecha a camada ou sai da tela (a camada não tem endereço; o esperado pelo usuário de celular é fechar).
- [ ] Voltar na etapa 2 ou 3 do checkout: registrar (as etapas não têm endereço; ver CL-43).

**Pontos de atenção conhecidos**
- QA_NOTAS F1B: a arrumação do histórico para links de fora usa duas navegações seguidas; conferir no Safari do iPhone.

### CL-74 · Loja em domínio próprio (limitação conhecida)
**Persona:** Ana  ·  **Fase:** 1  ·  **Prioridade:** P2  ·  **Chave:** v2 ligada  ·  **Mockup:** nenhum

> Como Ana numa loja com domínio próprio, quero que os links de peça funcionem, para comprar pelo endereço que a loja divulga.

**Pré-condições**
- **A confirmar:** uma loja de teste Studio com domínio próprio ativo (hoje nenhuma das duas lojas tem). Desktop e celular.

**Passo a passo**
1. Abrir o domínio próprio (home).
2. Abrir uma peça e compartilhar; abrir o link compartilhado.
3. Recarregar a peça; pagar no cartão (Config I) e voltar.

**Critérios de aceite — funciona**
- [ ] Registrar o que acontece em cada passo. Limitação conhecida: a casca chega com caminhos sem o slug (`/p/<id>`) e as rotas do app não os reconhecem; o link da peça e o F5 podem cair na home ou em "não achamos".
- [ ] A volta do cartão usa o domínio próprio: registrar se chega à página do pedido.

**Critérios de aceite — premium (UI/UX)**
- [ ] Nenhuma tela de erro técnico; no pior caso, a home da loja.

**Casos de borda**
- [ ] Links de aprovação e acompanhamento da loja com domínio próprio: abrem pelo endereço antigo do app (CL-56).

**Pontos de atenção conhecidos**
- QA_NOTAS F1B: domínio próprio é limitação pré-existente; esta história só documenta o comportamento para o PO decidir.

---

## Matriz de dispositivos

Legenda: **C** = completo (todos os passos e critérios); **A** = amostra (caminho feliz e premium visual); **n/a** = não se aplica. Desktop = Chrome 1440 e 1280 como base, Safari e Edge em amostra, notebook 1366×768 onde indicado. Tablet = iPad ou Android 768 em retrato (layout de celular) e 1024 em paisagem (layout de desktop).

| Fluxo principal | Histórias | iPhone Safari | Android Chrome | Desktop | Tablet |
|---|---|---|---|---|---|
| Chegar pelo link (loja, peça, Aurinha) e prévia do link | CL-01 a CL-03 | C | C | C (depurador) | A |
| Erros de chegada e cookies | CL-04 a CL-06 | A | C | C | A |
| Home, busca, menu, banners, destaque, rodapé | CL-07 a CL-14 | C | C | C (1440 e 1280) | A |
| Regressão com a chave desligada | CL-15 | A | C | C | n/a |
| Grade de modelos e primeira dobra do produto | CL-16, CL-17 | C | C | C (1366×768) | A |
| Carrossel, zoom, modelo e cor, 3D | CL-18, CL-19, CL-32 | C (3D real) | C (3D real) | C (mouse, 3D) | C (toque sem hover) |
| Arte: caminhos, envio, foto pequena, arte pronta, lados, texto | CL-20 a CL-25 | C (rolo da câmera, HEIC) | C | C | A |
| Quantidade, régua, frete, barra, "Adicionado", detalhes, preço da arte | CL-26 a CL-31 | C | C | C (1366×768) | A |
| Sacola em gaveta ou folha | CL-33 a CL-37 | C | C | C (lateral) | A |
| Checkout em 3 etapas e duplicado | CL-38 a CL-44 | C (autocompletar) | C (teclado) | C | A |
| Pix, "Já paguei", cartão, confirmação, e-mail | CL-45 a CL-49 | C | C (outro aparelho) | C (QR principal) | A |
| Aprovar, ajustar, acompanhar, saldo, pedir outro, erros, links antigos | CL-50 a CL-56 | C | C | A | A |
| Temporada e loja fechada | CL-57 a CL-60 | A | C | C | n/a |
| Orçamento em lote | CL-61 a CL-63 | A | A | C (planilha) | A |
| Pedir pelo WhatsApp | CL-64, CL-65 | C | C | A (WhatsApp Web) | n/a |
| Tipografia e cor AA | CL-66, CL-67 | A | A | C (DevTools) | A |
| Movimento, leitor de tela | CL-69, CL-70 | C (VoiceOver) | C (TalkBack) | A | A |
| Teclado | CL-71 | n/a | n/a | C (Chrome, Safari, Edge) | n/a |
| Desempenho e 3G | CL-72 | A | C (4G real) | C (Lighthouse) | n/a |
| Voltar e avançar | CL-73 | C (gesto da borda) | C (botão do sistema) | C | A |
| Domínio próprio | CL-74 | A | A | A | n/a |

## Achados antecipados (código x mockup e dados)

Encontrados na leitura do código em `main`; cada um já está como critério ou ponto de atenção na história citada.

1. **Quantidade:** a página do produto limita a 999; a sacola aceita até 9999 (`setCartLineQty`). CL-34.
2. **Faixa compacta do celular:** o mockup pede a peça "ao vivo"; o código mostra a primeira foto do catálogo (`Doca`, `fotos[0]`), sem a arte. CL-18.
3. **Aviso de foto pequena:** o mockup diz "antes de subir"; o aviso só aparece depois do envio terminar, e some ao reabrir pelo "Editar" (medida só na memória). CL-22.
4. **Verso:** o cartão ligado diz "+R$ 10,00 no total", mas o verso é cobrado por unidade. CL-24.
5. **Esqueleto:** o desenho da home nova só aparece com `?v2=1` guardado na aba; a aura-qa (ligada pelo servidor) mostra o esqueleto antigo em grade, o que pode fazer a página pular. CL-01.
6. **Etapas do checkout sem endereço:** o voltar do navegador na etapa 2 ou 3 sai do checkout, contra o princípio 7 da jornada. CL-43, CL-73.
7. **Loja fechada no checkout:** cai no componente antigo (uma página), não no de 3 etapas. CL-59.
8. **"Pagar com Pix" do cartão recusado** abre o WhatsApp; o mockup troca a forma de pagamento do mesmo pedido (QA_NOTAS). CL-47.
9. **Mensagem do WhatsApp** não diz que o verso foi escolhido (só o preço inclui). CL-64.
10. **"Não achamos essa loja"** leva a cliente final para `getaura.com.br` ("Ir para a Aura"). CL-04.
11. **Microcopy da sacola:** mockup "Mandar a sacola para a Sheid"; código "Prefere fechar pelo WhatsApp? Mandar a sacola". CL-65.
12. **Número do orçamento:** mockup "#L-0042" (sequência); código mostra o código do servidor ("L-3F9A2C"). CL-63.
13. **Campos do lote** ainda com placeholder no lugar do rótulo ("Seu nome", WhatsApp), diferente do checkout. CL-62.
14. **Microcopy:** "pra" e "para" misturados e travessões em textos de interface. CL-68.
15. **Promessa da nota fiscal:** "A nota sai no seu nome depois que a loja confirmar o pedido." enquanto o sistema só registra o pedido de nota (QA_NOTAS F2). CL-38.
16. **Dados da Sheid:** prazo de retirada cadastrado como "5/20" aparece na tela de entrega. CL-27, CL-41.
17. **Loja de teste incompleta para o QA:** sem cartão, sem GA4/Pixel, sem galeria de fotos, sem arte pronta, sem entrega, revisões 0 e faixas sem prazo. Sem as Configs B a J, 20 histórias não podem ser executadas por inteiro.
18. **E-mail de confirmação** não é testável na loja de teste (sandbox bloqueia e-mail) e ainda sai sem a marca da loja (QA_NOTAS F4). CL-49.
19. Já registrados no QA_NOTAS e cobertos: etapa atual como círculo vazio (CL-52), texto "Qualquer pessoa pode buscar" (CL-52), aprovação sem "item 1 de 2" (CL-50), produto sem busca nem menu (CL-28), "Tirar dúvida" sobre os cartões (CL-14), cookies do painel nos endereços antigos (CL-56), Pix de 30 min no Asaas (CL-45), cartão sem frete (CL-31, CL-47), evento antes do consentimento perdido (CL-06).

## Perguntas em aberto

1. **Cartão na loja de teste:** como executar CL-47? Configurar Mercado Pago de teste na aura-qa ou usar outra loja sandbox com cartão?
2. **E-mail na loja de teste:** liberar o envio só para e-mails da equipe, para executar CL-49 sem pedido real?
3. **Saldo no Studio:** como a lojista gera um saldo (sinal + saldo) num pedido da vitrine? Sem isso, CL-53 fica bloqueada.
4. **Prazo por faixa de tiragem:** onde a lojista grava o prazo de cada faixa (Config H)? Hoje as faixas da aura-qa não têm prazo.
5. **Etapas e camadas no histórico:** o voltar do navegador deve voltar uma etapa do checkout e fechar a gaveta/folha, como o usuário de celular espera?
6. **"Ir para a Aura"** é o destino certo na tela de loja não encontrada, para uma cliente final?
7. **"Pagar com Pix" no cartão recusado:** vale uma rota no backend para trocar a forma de pagamento do mesmo pedido, como no mockup?
8. **Verso "no total":** trocar para "+R$ 10,00 por unidade" (ou mostrar o valor já multiplicado)?
9. **Limite de quantidade:** 999 também na sacola, ou 9999 nos dois lugares?
10. **Código do orçamento em lote:** sequência "L-0042" (mockup) ou o código do servidor?
11. **Mesma peça adicionada duas vezes:** soma na mesma linha ou vira duas linhas? (CL-29)
12. **Foto HEIC do iPhone:** aceitar e converter, ou recusar com orientação?
13. **Microcopy:** padronizar "para" e tirar os travessões dos textos de interface?
14. **Nota fiscal:** a frase do checkout pode prometer a nota, se o sistema só registra o pedido?
15. **"Fazer um novo"** no aviso de pedido duplicado deixa o anterior aberto por 72 horas: a lojista vê dois pedidos na fila?
16. **Faixa da Aurinha:** fica fixa ou entra em teste A/B (mockup 01)?
17. **Último dia da temporada:** o corte é 23h59 de Brasília para todas as lojas, ou cada lojista escolhe o horário (mockup 01)?
18. **Política de troca padrão** fala de "tamanho ou cor": precisa de texto próprio para peça personalizada (mockup 05, pergunta g)?
19. **Domínio próprio:** entra no escopo antes de ligar a chave numa loja que tenha domínio?
