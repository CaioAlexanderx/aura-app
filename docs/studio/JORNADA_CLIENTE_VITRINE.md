# Jornada do cliente na vitrine do Aura Studio — planejamento da normalização

**Data:** 24/09/2026 · **Status:** proposta para aprovação · **Escopo:** experiência do cliente final na `loja.getaura.com.br/<slug>` de uma empresa em modo Studio (piloto: Sheid Mania)

> Este documento responde a uma pergunta só: **como deve ser a experiência de quem compra um produto personalizado numa loja Studio**, e o que precisa mudar na vitrine para chegar lá. Ele nasce do upgrade "Finesse" da loja Aura Negócio (set/2026) e do quadro F1 da vitrine Studio (`Aura-backend/docs/F1_CONTEUDO_STUDIO.md`), mas **não é um port literal**. Onde a cópia seria errada, o texto diz por quê.

---

## 0. Como ler

| Seção | Para quem tem 5 minutos | Para quem vai executar |
|---|---|---|
| §1 Resumo e tese | ✔ | ✔ |
| §2 Quem é o cliente | ✔ | ✔ |
| §3 Os princípios da experiência premium | ✔ | ✔ |
| §4 O mapa da jornada, etapa por etapa | — | ✔ |
| §5 O que trazer da Negócio, o que não trazer | ✔ | ✔ |
| §6 As dívidas que impedem o "premium" hoje | — | ✔ |
| §7 Faseamento proposto | ✔ | ✔ |
| §8 Decisões abertas | ✔ | ✔ |
| §9 Métricas | ✔ | ✔ |

---

## 1. Resumo e tese

A loja Negócio ficou boa porque cada peça da jornada ganhou **uma resposta clara**: home curada, página de produto com URL própria, sacola que sobrevive, checkout em três passos, Pix com comprovante, aviso ao lojista na hora. A vitrine Studio tem **mais motor** que a Negócio (mockup 3D, três caminhos de arte, escada de desconto, orçamento em lote, acompanhamento por etapas) e **menos jornada**: as seis telas vivem só em memória, a fonte escolhida pela lojista não carrega fora da home, cores da paleta antiga (azul-marinho e magenta) ainda pintam botões, e a confirmação do pedido evapora num F5.

**A tese deste plano:** o "premium" da Studio não está em copiar a home da Negócio. Está em fazer o cliente **ver a arte dele na peça, saber o preço e o prazo sem calcular nada, e nunca perder o lugar**. A home da Negócio ajuda a chegar; o que vende é o configurador e o pós-compra.

Três consequências práticas:

1. **Fundações antes de beleza.** Rotas com URL, tipografia e cor da loja aplicadas em todas as telas, e a confirmação persistente vêm **antes** de qualquer redesign visual. Sem isso, o mockup mais bonito do mundo some quando o cliente aperta "voltar".
2. **Trazer da Negócio só o que serve a uma loja pequena de encomenda.** Filtros de tamanho/cor, "últimas unidades" e paginação de 24 não servem: o estoque do Studio é insumo, não produto acabado. Já cabeçalho, sacola em gaveta, URL do produto, checkout em etapas com CEP primeiro, tela do Pix com comprovante e retorno do cartão servem inteiros.
3. **Mockup HTML antes de cada fase visual** (regra 4 do `CLAUDE.md`). Cada fase de §7 começa por um mockup standalone aprovado.

---

## 2. Quem é o cliente

Três personas cobrem quase tudo que a Sheid Mania recebe. Elas mudam o que a tela precisa priorizar.

### 2.1 Ana — o presente que não pode dar errado
- Chegou pelo Instagram, **no celular**, no meio de outra coisa. Tem uma foto no rolo da câmera e uma data (aniversário, Dia das Mães).
- Pergunta na cabeça: *"Como vai ficar? Chega a tempo? Quanto é?"* Nessa ordem.
- Paga no Pix. Vai querer o link para mostrar para alguém antes de fechar.
- **O que a tela precisa fazer:** mockup com a foto dela em menos de um minuto, prazo em dias úteis na primeira dobra, preço unitário sempre visível, link compartilhável.

### 2.2 Marcos — as 50 canecas do evento
- RH, organizador de formatura ou de casamento. Chega **pelo WhatsApp ou no desktop**, com uma lista de nomes numa planilha.
- Pergunta na cabeça: *"Quanto fica por unidade nessa quantidade, em quanto tempo, e emite nota?"*
- Não quer personalizar 50 vezes. Quer uma cotação, aprovar uma prova e pagar com CNPJ.
- **O que a tela precisa fazer:** escada de desconto legível, quantidade digitável, orçamento em lote que aceita a lista como ela vem, CPF/CNPJ no checkout, prazo por faixa de tiragem.

### 2.3 Quem volta
- Recebeu o link de acompanhamento ou de aprovação de arte no WhatsApp. **Não tem conta e não vai criar.**
- Pergunta: *"Em que pé está? Precisa de mim?"*
- **O que a tela precisa fazer:** acompanhamento por etapas, com a marca da loja, e com a próxima ação (aprovar a arte, pagar o saldo) a um toque.

---

## 3. Os princípios da experiência premium

Sete regras. Cada uma vira critério de aceite nas fases de §7.

1. **A arte do cliente é a protagonista.** Tudo o que não é o mockup recua: fundo dessaturado, cena discreta (S10 da F1), tipografia calma, nada de emoji. O cliente veio ver a caneca *dele*.
2. **Uma decisão por vez.** O configurador guia: modelo → cor → arte → quantidade. O que ainda não é a vez fica visível mas quieto. O aviso de "o que falta" é uma frase, não uma lista de erros.
3. **O preço nunca surpreende.** Preço unitário e total ao vivo, cada adicional explicado ("+R$ 8 pelo verso"), escada de desconto visível na página, desconto do Pix e frete conhecidos **antes** do checkout.
4. **Prazo em etapas, nunca em horas.** "Pronto em 5 dias úteis" na loja; "Criando a arte → Em produção → Pronto" no acompanhamento. Previsão furada destrói mais confiança que a ausência dela (lição já registrada em `app/acompanhar/[token].tsx`).
5. **A cor da loja, com contraste garantido.** Só a cor primária da lojista pinta a vitrine; o tema `montarTema`/`parLegivel` decide texto e preenchimento em **todas** as telas. Nenhum `#fff`, `#1E3A8A` ou magenta cravado no código.
6. **Toque primeiro.** Alvos de 44 px, `hover:none` com alternativa, barra de ação fixa que não briga com cookies, "Powered by" ou botão do WhatsApp. Desktop é o bônus, não a base.
7. **Nada some ao recarregar.** Produto, sacola, checkout e confirmação têm URL. O botão voltar do navegador volta uma tela, não sai da loja.

---

## 4. O mapa da jornada, etapa por etapa

Para cada etapa: o que o cliente quer, o que existe hoje (com a evidência no código), o que a Negócio já resolveu e a experiência alvo.

### 4.1 Descobrir e chegar

**O cliente quer:** abrir o link e entender em 3 segundos que é uma loja de personalizados, de quem, e que está aberta.

**Hoje:**
- Endereço `loja.getaura.com.br/<slug>` servido pela casca Expo (`Aura-backend/src/services/vitrineStudioShell.js`). Funciona.
- Chegando com `?produto=&variante=&origem=aurinha&conversa=` (contrato da Aurinha em `Aura-backend/docs/aurinha-checkout-contract.md`), a vitrine Studio **ignora os parâmetros** e cai na home. A conversão do hub social não é atribuída.
- Erro de carregamento mostra um "!" e a mensagem crua da API, sem "tentar de novo" e sem "loja não encontrada" (`components/studio/storefront/PaginaDaVitrine.tsx:94-100`).
- SEO: título e descrição não mudam por produto (não há rotas).

**A Negócio resolveu:** "Loja não encontrada / Verifique o link ou peça ao lojista pra publicar a loja", canônica e `og:` por produto, GA4/Pixel com consentimento.

**Alvo:**
- Deep link `?produto=` abre o produto direto, com variante pré-selecionada; `origem`/`conversa` guardados em `sessionStorage` e enviados no pedido. Parâmetro inválido degrada para a home sem erro.
- Estados de erro com voz da loja: "Não achamos essa loja", "A loja está fora do ar por um instante — tentar de novo".
- `<title>` e `og:` por produto quando a rota existir (§4.4).

### 4.2 Home

**O cliente quer:** ver o que a loja faz, o prazo, e achar a categoria certa sem rolar demais.

**Hoje (bom, manter):** faixa de avisos com prazo/mockup/revisões/Pix, hero com banner ou logo, "Como funciona" em 3 passos, busca, barra de categorias, grade agrupada por categoria ("N modelos para escolher"), "Os queridinhos", tira "O que a gente personaliza", bloco para empresas, faixa de confiança, rodapé institucional compartilhado com a Negócio (`HomeDaVitrine.tsx`, `blocosDaHome.ts`).

**Hoje (defeitos):**
- Só o primeiro banner aparece, sem carrossel, sem botão, sem link, sem `kicker` (`HomeDaVitrine.tsx:85-183`). A lojista configura tudo isso na aba Design e a vitrine joga fora.
- Faixa de anúncio e selos de confiança da aba Design são ignorados.
- No desktop sem banner, metade do hero fica vazia (`ProductList.tsx:142-146`).
- Tocar numa categoria no rodapé ou na tira "O que a gente personaliza" muda o filtro lá em cima e **não rola a página**: parece que nada aconteceu (`ProductList.tsx:340-373`).
- Só a busca fica presa no topo; a barra de categorias rola junto, ao contrário do que o comentário promete (`ProductList.tsx:133-137`).
- A prévia da aba Design mostra a **loja comum**, não a vitrine Studio (`components/screens/canal/TabDesign.tsx:72-75`).

**A Negócio resolveu:** hero 3:1 com até 3 banners girando (pausa no toque), CTA com destino interno `#cat=` / `#vista=`, arte mobile própria, banner-link quando não há texto, barra de anúncio automática ("Frete grátis acima de R$ X · Troca em até 7 dias · 5% off no Pix"), selos derivados do que a lojista ligou, cabeçalho com logo + busca + sacola, mega-menu de categorias.

**Alvo:**
- Cabeçalho único: logo (ou inicial), busca, sacola com contador. Fica preso no topo junto com a barra de categorias.
- Hero com os 3 banners, CTA e destinos internos, exatamente como a Negócio. Sem banner: logo + headline + o **mockup do produto mais pedido girando** ao lado (a prop `mockup` do Hero existe e ninguém passa). É a demonstração que vende a Aura para a próxima lojista.
- Barra de anúncio e selos vindos da aba Design; quando vazios, os automáticos da Negócio adaptados ("Você aprova o mockup antes de produzir · Pronto em N dias úteis · X% no Pix").
- Toda âncora de categoria rola até a grade.
- **Não trazer:** "Últimas unidades" (o estoque é insumo, decisão já registrada em `selosDoProduto.ts:11-16`), "Mais vendidos em 90 dias pelo Caixa" (o Studio já tem "queridinhos" por pedidos), filtros laterais de tamanho/cor/preço e paginação de 24 (catálogo pequeno; tamanho é opção do produto, não variante).

### 4.3 Explorar e escolher o modelo

**O cliente quer:** comparar os modelos da categoria (Branca, Chopp, Alça Coração…) por foto e preço, sem abrir um por um.

**Hoje:** grade de modelos por categoria com frase que explica o que varia (`GradeDeModelos.tsx`). Cartão com carrossel de fotos, selo "Mais pedido"/"Novo", etiquetas ("Mockup 3D", "Frente e verso", "Escolha a cor", "Nome ou frase", "Sua arte"), linha de escada "R$ X cada 50 un ou mais", preço no Pix (`ProductCard.tsx`). Bom.

**Defeitos:** `GradeDeModelos` e `RodapeDaVitrine` usam `Text` puro, não `Texto`, e caem na fonte do sistema. Sem trilha "Início / Canecas / Chopp".

**Alvo:** trilha de navegação como na Negócio (níveis redundantes omitidos), cartão sem mudança de forma, fontes corrigidas. O seletor de modelo dentro da página do produto (§4.4) já cobre a troca depois de entrar.

### 4.4 Página do produto e configurador — **o coração da experiência**

**O cliente quer:** ver a peça, colocar a arte dele, ver como ficou, saber quanto custa e quando chega. Nessa ordem, no celular, com o polegar.

**Hoje (motor pronto):** prévia 2D/photo2d/3D com troca de lado, guia de medidas, seletor de modelo, campos por lado (frente/verso/meio), texto com cor da arte, cor da louça com `+R$`, opções, três caminhos de arte com preço, arte pronta da galeria, upload até 15 MB, escada de desconto tocável, frete por CEP na página, descrição + ficha técnica + relacionados, rodapé fixo com "o que falta" + "Comprar agora" / "Adicionar ao carrinho" + "Prefere pedir pelo WhatsApp?" (`ProductConfigurator.tsx`, `fields/*`).

**Defeitos que quebram o "premium":**
- Sem URL própria: não dá para compartilhar a caneca, e o voltar do navegador sai da loja (`useStorefront.ts:272,460`).
- Fonte da loja comum (Cormorant/Anton…) em vez do par Studio; a página nunca a carrega, então o título cai em Georgia (`ProductConfigurator.tsx:238`).
- Botões de opção sempre azul-marinho, magenta em vários lugares, `T.accent` no selo de desconto (`types.ts:206-232`, `ProductConfigurator.tsx:319,343,491,544,568,626`, `FieldArtService.tsx:170-315`).
- Quantidade só com −/+; 50 unidades = 49 toques ou adivinhar que a faixa é clicável (`ProductConfigurator.tsx:645-670`).
- Mockup 3D ainda **não é item do carrossel** e a cor da louça não chega ao 3D (S3 da F1), sem sombra nem ambiente (S10). Galeria de até 6 fotos existe no backend e não na vitrine (S9).
- Emojis 📐 📁 📄 ⚠️ no lugar de ícones, contra a regra do próprio sistema (`AncoraWhatsApp.tsx:125`).
- "Powered by Aura" fixo por cima da barra de ação; cookies cobrem a barra do carrinho.
- Com a loja fechada, o botão principal e o link do WhatsApp fazem a mesma coisa (`ProductConfigurator.tsx:860-870, 929-954`); `avisoDePrazo` ("Pedidos até 20/12") existe, tem teste e nenhuma tela usa.
- `console.log` em produção (`:505,587`); `<img>` HTML sem guarda no nativo (`:774`).

**A Negócio resolveu:** URL `/p/<id>` com `pushState` e voltar funcionando, "Compartilhar" (share nativo ou copiar link), galeria com miniaturas em coluna, zoom que segue o mouse (some em `hover:none`), setas + arrastar + teclado, bolinhas no celular, "Foto X de N", "Adicionar à sacola" que vira "Adicionado" por 1,4 s, "Tirar dúvida no WhatsApp" com texto pronto, "Da mesma categoria".

**Alvo — layout (desktop em duas colunas, celular em uma):**

| Região | Conteúdo |
|---|---|
| Esquerda / topo | **Carrossel**: fotos da galeria (até 6) + **o mockup como um dos slides**, que vira o slide ativo assim que o cliente personaliza. Zoom, setas, arrastar, bolinhas no celular. No celular fica preso no topo enquanto o cliente preenche. |
| Direita, 1 | Nome, selo do modelo, **preço unitário ao vivo** + "ou 3x de R$" + "R$ X no Pix". Trilha acima. |
| Direita, 2 | **Modelo** (mini-carrossel) → **Cor** (bolinhas, muda a louça no 3D) |
| Direita, 3 | **Arte**: os três caminhos como cartões com preço; o upload aparece só nos dois primeiros; a galeria de artes prontas como alternativa. Aviso de qualidade da imagem ("essa foto tem 600 px, pode sair pixelada") antes de fechar. |
| Direita, 4 | **Texto / opções / verso / meio**, agrupados por lado com abas Frente · Verso · Meio |
| Direita, 5 | **Quantidade** digitável + escada como régua visual ("Leve 10 e pague R$ 39,90 cada") + **prazo por faixa** ("50 unidades: 8 dias úteis") |
| Direita, 6 | Frete por CEP (já existe) + "Retire na loja · endereço · prazo" |
| Abaixo | Descrição curta, **área de impressão** (eleger uma fonte, §3.3 da F1), guia de medidas, política de revisões, relacionados |
| Barra fixa | "O que falta" numa frase · **Adicionar à sacola** (primário) · Comprar agora (secundário) · link discreto do WhatsApp |

Detalhes que fazem o "premium": transição suave ao trocar de modelo (a prévia não pisca), preço que anima ao mudar, cor da louça pintando o 3D em tempo real, sombra de contato e reflexo nas canecas metálicas, nenhum emoji, e a cor da loja em todos os botões com contraste calculado.

### 4.5 Sacola

**O cliente quer:** conferir o que montou, ajustar quantidade, editar uma peça sem perder o resto, e ver o total com Pix e frete.

**Hoje:** não existe tela de sacola. A lista aparece dentro do checkout (`Cart.tsx:114-238`); a barra escura no rodapé leva direto ao "Finalizar". Editar uma linha a partir do checkout devolve para a home (`useStorefront.ts:607`). O "Orçamento" da barra manda o carrinho ao WhatsApp com **preço de tabela**, sem adicionais nem escada, e com valores internos ("designer", "M") no lugar dos nomes que o cliente viu (`pedidoPeloWhatsApp.ts:51-59, 166-180`).

**A Negócio resolveu:** gaveta lateral "Sacola" com miniatura, nome + variante, −/+, subtotal, entrega, total, "Pagando no Pix", "Finalizar compra →", persistência de 7 dias, sacola vazia com voz.

**Alvo:**
- Sacola em **gaveta** (desktop) / folha (celular), aberta pelo ícone do cabeçalho e pela barra do rodapé. Cada item mostra **a miniatura do mockup**, não a foto de catálogo: é a arte dele que está ali.
- Editar volta para o configurador e, ao salvar, volta para a sacola.
- Mensagem do WhatsApp com os mesmos nomes e preços que a tela mostra, e a régua de desconto aplicada.
- Loja fechada: a sacola vira "pedir orçamento" e o botão "Finalizar" some (hoje só a tela do produto respeita `modoDaVitrine`, `Cart.tsx:47`).

### 4.6 Checkout

**O cliente quer:** terminar em menos de dois minutos, no celular, sem digitar o que o CEP já sabe, e ter certeza do total antes de pagar.

**Hoje:** uma página com Seus dados / Como receber / Pagamento / Observação / Resumo e o botão "Enviar pedido • R$" que diz o que falta (`Checkout.tsx`). Campos só com placeholder, sem rótulo (`ui/FInput.tsx`). CEP por último, sem preencher endereço, frete só no botão. Só a rua é obrigatória. Retirada não mostra o endereço da loja nem o prazo (os campos chegam no payload e não são usados). Sem CPF/CNPJ. Política de revisões não aparece, embora a aba Revisões prometa. Cartão redireciona depois de 800 ms e não há tela de volta (`useStorefront.ts:781`).

**A Negócio resolveu:** barra de etapas 1 Seus dados · 2 Entrega · 3 Pagamento, rótulos, "Usamos o WhatsApp só para avisar sobre o pedido — nada de spam", "Quero CPF/CNPJ na nota fiscal" com validação, dados salvos por 90 dias, CEP com ViaCEP e cotação automática, "Fora da área de entrega (X km)", resumo recolhido no celular, "Troca em até 7 dias após receber", "Seus dados são protegidos e usados só para este pedido", guarda contra pedido duplicado por 10 min, um único meio de pagamento vai direto.

**Alvo:** portar o checkout da Negócio **inteiro** para o componente Studio, com três diferenças próprias:
1. O resumo mostra **prazo de produção** e o **mockup em miniatura** por item.
2. "Retirada por app" com nome e placa do entregador (já existe no Studio, a Negócio ainda não oferece na tela).
3. Política de revisões em uma linha, acima do botão.

CPF/CNPJ entra por causa do Marcos (§2.2): o corporativo precisa de nota.

### 4.7 Pagar

**O cliente quer:** pagar o Pix agora, saber que a loja viu, e não ficar em dúvida se "deu certo".

**Hoje:** tela "Pedido enviado!" com QR + copiar código e o status **fixo** "Aguardando produção da arte", mesmo antes do Pix ser pago (`SentConfirmation.tsx:93-95`). Sem comprovante, sem "Já paguei", sem polling do pagamento. `sentOrder` não é salvo: um F5 apaga tudo. No cartão, o cliente é redirecionado e a volta cai na home sem status.

**A Negócio resolveu:** tela do Pix com "Pedido #N", QR, "Copiar código" → "✓ Copiado!", "Anexar comprovante (opcional) · Anexar agiliza a confirmação do lojista", botão "Já paguei" → "Aguardando confirmação", polling a cada 4 s, sobreposição "Pagamento recebido!", retorno do cartão com até 15 tentativas e toasts de confirmado / em análise / não aprovado. Pix vencido em 48 h expira e cancela sozinho (job do backend, **hoje exclui o Studio**).

**Alvo:**
- Rota `/<slug>/pedido/<token>` que renderiza a confirmação a partir do servidor. F5, fechar e abrir de novo, abrir em outro aparelho: sempre a mesma tela.
- Tela do Pix da Negócio, com comprovante e "Já paguei", e o status que **muda** quando o pagamento entra.
- Retorno do cartão com status real.
- Ligar o job de Pix expirado para o Studio (decidir prazo: 48 h como a Negócio, ou mais longo porque a arte demora).

### 4.8 Confirmação e "e agora?"

**O cliente quer:** saber o que acontece a seguir e quando vai ser chamado.

**Hoje:** "Próximos passos" 1 a 4, "Política de revisões", "Acompanhe seu pedido" (só quando vem `track_url`), "+ Personalizar outro". Bom conteúdo, sem persistência (§4.7).

**Alvo:** a mesma tela, persistente, com a **linha do tempo** que o acompanhamento usa ("Pedido recebido → Criando a arte → Em produção → Pronto") já mostrando o primeiro passo aceso. O botão "Acompanhar" e o link para salvar no WhatsApp ("me manda esse link") no mesmo lugar. Um e-mail de confirmação ao cliente com o link (verificar se o Studio dispara o mesmo `mailer` que a Negócio; a Negócio manda Confirmado / Em preparo / Pronto / Entregue).

### 4.9 Aprovar a arte

**O cliente quer:** ver o mockup grande, aprovar com um toque ou dizer o que ajustar.

**Hoje:** `app/aprovacao/[token].tsx` faz isso, com vídeo turntable, "Aprovar produção" / "Pedir ajuste" e histórico. **Mas está fora da marca da loja**: azul-marinho fixo `#1E3A8A` (`:79,216,311,372`), sem logo nem cor da lojista. O cliente sai de uma loja rosa e cai numa página azul de outra empresa.

**Alvo:** a página de aprovação e a de acompanhamento usam o **mesmo tema da vitrine** (`montarTema` com a cor da loja, logo no topo, tipografia da loja). É a mesma loja do começo ao fim. Cena do mockup com sombra e ambiente (S10) também aqui, porque os renders de aprovação saem do mesmo motor.

### 4.10 Acompanhar, receber, voltar

**O cliente quer:** abrir o link e ver em que pé está; pagar o saldo se houver; e, no futuro, pedir de novo.

**Hoje:** `app/acompanhar/[token].tsx` é bom (etapas, sem horário, Pix do saldo a um toque). Sem marca da loja. Sem caminho para "pedir de novo".

**Alvo:** marca da loja; botão "Pedir outro igual" que abre o configurador com a personalização anterior; aviso ao cliente quando a arte volta da triagem (hoje é manual pelo WhatsApp, S5 da F1).

### 4.11 Orçamento em lote (a jornada do Marcos)

**Hoje:** dois passos bem desenhados, prévia ao vivo com `bulk-quote`, rascunho no painel. Defeitos: separar por vírgula quebra "Silva, João" (`loteDaVitrine.ts:57`); "Para quando?" é texto livre; telefone sem máscara; a tela final mostra o nome do evento no lugar de um número; o bloco fala em "50 canecas" em qualquer loja.

**Alvo:** aceitar colar a coluna da planilha (só quebra de linha e `;`), data com seletor, telefone com máscara, número do orçamento na tela final e no WhatsApp, texto do bloco por categoria da loja ("50 camisetas", "50 garrafas"). Depois do rascunho: link público do orçamento (`app/orcamento/[token].tsx` já existe) para o Marcos aprovar e pagar o sinal.

---

## 5. O que trazer da Negócio, o que não trazer

| Peça da Negócio | Trazer? | Por quê |
|---|---|---|
| URL própria do produto, `pushState`, Compartilhar | **Sim, primeiro** | Sem isso não há jornada, só estado |
| Cabeçalho logo + busca + sacola, preso no topo | Sim | Padrão que o cliente já conhece |
| Hero com 3 banners, CTA, destino interno, arte mobile | Sim | A lojista já configura; a vitrine joga fora |
| Barra de anúncio e selos automáticos | Sim, com textos do Studio | "Você aprova o mockup antes de produzir" vale mais que "Troca em 7 dias" |
| Trilha de categorias | Sim | Orientação em loja agrupada por categoria |
| Galeria com miniaturas, zoom, setas, bolinhas, teclado | Sim | E o mockup entra como slide |
| Sacola em gaveta, persistente | Sim | O Studio não tem tela de sacola |
| Checkout em 3 etapas, CEP com ViaCEP, CPF/CNPJ, dados salvos, guarda de duplicado | Sim, inteiro | É o melhor pedaço do upgrade |
| Tela do Pix com comprovante, "Já paguei", polling | Sim | Hoje o status do Studio é fixo |
| Retorno do cartão com status | Sim | Hoje cai na home |
| Job de Pix expirado | Sim, com prazo a decidir | Hoje exclui o Studio |
| "Loja não encontrada" e erro com voz | Sim | Hoje é "!" + erro cru |
| `prefers-reduced-motion` | Sim | Só o `StoreNav` respeita |
| Home em cache de 60 s | Não se aplica | A vitrine é SPA; o payload já é uma chamada só. Medir antes de mexer |
| "Últimas unidades", "RESTAM N" | **Não** | Estoque é insumo (`selosDoProduto.ts`) |
| Filtros laterais tamanho / cor / preço | **Não** | Catálogo pequeno; tamanho é opção, cor é a louça |
| Paginação de 24 | **Não agora** | Rolagem contínua basta até ~100 itens; revisar quando uma loja passar disso |
| "Mais vendidos em 90 dias pelo Caixa" | Não | "Queridinhos" por pedidos já cumpre |
| Fotos por cor | Depois | No Studio a cor vira a louça no 3D; para `photo2d` pode valer, mas não é F1 |
| Estilos de cartão editorial / minimal / image-heavy | Já existe | Manter |

---

## 6. As dívidas que impedem o "premium" hoje

Nenhum redesign resolve isso; elas têm que ser pagas antes. Todas estão no app, nenhuma exige backend.

| # | Dívida | Onde | Efeito para o cliente |
|---|---|---|---|
| D1 | Telas sem URL nem histórico | `useStorefront.ts` (`stage`) | Voltar sai da loja; não há link do produto; SEO zero |
| D2 | Confirmação não persiste | `SentConfirmation`, `sentOrder` | F5 apaga o pedido da tela |
| D3 | Fonte da loja comum em produto/checkout/confirmação/carrinho | `tipografiaDaLoja` nesses 4 arquivos | Títulos em Georgia; a loja "muda de cara" ao entrar no produto |
| D4 | `montarTema(cor)` sem modo = "claro", contexto usa "papel" | `ProductConfigurator`, `Checkout`, `SentConfirmation`, `Consentimento` | Contraste calculado contra o fundo errado |
| D5 | Paleta antiga cravada: navy em chips, magenta, `#fff` fixo | `types.ts:206-232`, `ProductConfigurator`, `FieldArtService`, 6 botões com `#fff` | Loja amarela com botões azuis e texto ilegível |
| D6 | `Text` puro em vez de `Texto` | `RodapeDaVitrine`, `GradeDeModelos`, `ui/NextStep`, `ui/TotalRow`, `ui/PoweredByAura` | Fonte do sistema no meio da loja |
| D7 | Sobreposições: "Powered by" fixo, cookies sobre a barra | `ui/PoweredByAura`, `ConsentimentoDaVitrine` | Botão de comprar coberto |
| D8 | Loja fechada só na tela do produto | `Cart.tsx:47`, `Checkout.tsx` | Carrinho antigo fura o bloqueio; 409 do servidor vira erro cru |
| D9 | Emojis como ícones | 9 emojis em 6 arquivos | Renderização varia por aparelho; contra a regra do sistema |
| D10 | Acessibilidade: "←" sem rótulo, opções sem papel, botões de pagamento sem `accessibilityRole`, esqueleto ignora `reduce-motion` | vários | Leitor de tela perdido; movimento para quem pediu para não ter |
| D11 | `console.log` e `<img>` HTML sem guarda | `ProductConfigurator.tsx:505,587,774` | Ruído e quebra no nativo |
| D12 | Regras do backend espelhadas à mão (verso, meio, adicionais, Pix) | `useStorefront.ts:136-147,233-244,425-434`, `Cart.tsx:17-34` | Divergência vira 400/409 na hora de pagar |
| D13 | Nenhum teste de tela do fluxo lista → produto → checkout → confirmação | `__tests__/vitrineStudio*` cobrem só regras puras | Regressão só aparece no QA da Sheid |

E do lado do **painel da lojista**, três lacunas que a vitrine já lê e ninguém consegue configurar: fechar a loja para pedidos (`pedidos.aceita`, recado, `pedidos_ate`), ligar "Retirada por app" (`courier_pickup_enabled`, sem rota de escrita nem tela), e os IDs de GA4/Pixel na Loja Digital do Studio. A aba Aparência lê `T.card`/`T.border`, que não existem na `StudioPalette`, e por isso fica sem fundo nem borda.

---

## 7. Faseamento proposto

Cada fase entrega algo que a Sheid consegue ver. Tamanho em camisetas (P/M/G), não em dias. Fases visuais (F1 a F4) começam por **mockup HTML standalone em `docs/mockups/studio-*.html`** e só viram código depois de aprovado.

### F0 — Fundações (sem mudança visual perceptível, G)
- Rotas com URL: `/<slug>` (home), `/<slug>/c/<categoria>`, `/<slug>/p/<id>`, `/<slug>/sacola`, `/<slug>/finalizar`, `/<slug>/pedido/<token>`, `/<slug>/orcamento`. `stage` passa a derivar da rota. Voltar do navegador funciona.
- Confirmação persistente lida do servidor por token.
- Tipografia: um único `useTipografia` do Studio em todas as telas; `Texto` em tudo.
- Tema: `montarTema(cor, "papel")` em tudo; paleta antiga de `types.ts` apagada; zero `#fff`, `#1E3A8A`, magenta.
- Ícones no lugar de emojis; `PoweredByAura` sai do fixo e vive no rodapé; cookies não cobrem a barra.
- `modoDaVitrine` respeitado na sacola e no checkout; `avisoDePrazo` na home e no produto.
- Estados de erro com voz e "tentar de novo".
- Deep link da Aurinha (`?produto=`, `origem`, `conversa`).
- Teste de tela do fluxo principal (Testing Library) para as regressões pararem de chegar pelo QA.

**Critério de aceite:** a Sheid abre uma caneca, copia o link, manda no WhatsApp, a outra pessoa abre a caneca. F5 na confirmação mantém o pedido. Loja amarela fica legível.

### F1 — Home e navegação (M) · *mockup antes*
- Cabeçalho preso com logo, busca, sacola.
- Hero com 3 banners, CTA, destino interno, arte mobile; sem banner, logo + headline + mockup girando.
- Barra de anúncio e selos da aba Design; automáticos do Studio quando vazios.
- Trilha de categorias; âncoras que rolam.
- Prévia da aba Design apontando para a vitrine Studio.

### F2 — Página do produto (G) · *mockup antes* · **é aqui que o "premium" mora**
- Layout da tabela em §4.4.
- Mockup como slide do carrossel (S3). A galeria (S9), a cor da louça no 3D e a sombra com ambiente (S10) já estão prontas: ver a errata em `FASEAMENTO_VITRINE_STUDIO.md` §3.1.
- Quantidade digitável; escada como régua; prazo por faixa.
- Três caminhos de arte como cartões; aviso de qualidade da imagem.
- Compartilhar; "Adicionado à sacola" com feedback; relacionados.
- Área de impressão com uma fonte só (decisão §3.3 da F1).

### F3 — Sacola e checkout (M) · *mockup antes*
- Sacola em gaveta com miniatura do mockup; editar volta para a sacola.
- Checkout da Negócio inteiro (3 etapas, rótulos, CEP primeiro com ViaCEP, CPF/CNPJ, dados salvos, guarda de duplicado), mais prazo de produção, retirada por app e política de revisões.
- Mensagem do WhatsApp com nomes e preços iguais aos da tela.

### F4 — Pagamento e pós-compra (M) · *mockup antes*
- Tela do Pix com comprovante, "Já paguei", polling, status que muda.
- Retorno do cartão com status.
- Job de Pix expirado ligado para o Studio.
- Aprovação e acompanhamento com a marca da loja; "Pedir outro igual".
- E-mail de confirmação ao cliente com o link de acompanhar (verificar o `mailer`).

### F5 — Painel da lojista e medição (P)
- Tela para fechar a loja para pedidos (com recado e data), ligar retirada por app, IDs de GA4/Pixel; rota de escrita de `courier_pickup_enabled` no backend.
- Eventos `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase` no GA4/Pixel, sempre atrás do consentimento.
- Aba Aparência com fundo e borda corretos.

### F6 — Lote e recorrência (P)
- Colar coluna da planilha, data com seletor, máscara, número do orçamento, texto por categoria.
- Link público do orçamento para aprovação e sinal.

> **Revisto em 24/09/2026:** a ordem e as datas finais estão em `FASEAMENTO_VITRINE_STUDIO.md`, que substitui esta seção.

**Ordem recomendada (original):** F0 → F2 → F3 → F4 → F1 → F5 → F6. A F1 (home) vem depois do produto e do checkout de propósito: a home de hoje já é razoável, e o dinheiro está no configurador e em fechar o pedido sem perder o cliente no meio.

---

## 8. Decisões abertas (com recomendação)

| # | Pergunta | Recomendação | Por quê |
|---|---|---|---|
| Q1 | Rotas com URL na vitrine, mesmo custando a F0 inteira? | **Sim** | Sem isso não há compartilhar, voltar, SEO nem confirmação persistente. É a base de tudo |
| Q2 | Sacola em gaveta (Negócio) ou tela própria? | **Gaveta** no desktop, folha no celular | Não tira o cliente do produto; a Negócio já provou o padrão |
| Q3 | Quantidade: campo digitável + escada, ou só −/+? | **Digitável** | O Marcos não vai tocar 49 vezes |
| Q4 | CPF/CNPJ no checkout Studio? | **Sim** | Corporativo pede nota; a Negócio já tem a máscara e a validação |
| Q5 | "Powered by Aura" fixo no rodapé da tela? | **Tirar do fixo**, manter no rodapé institucional | Cobre o botão de comprar; o rodapé já assina "Loja desenvolvida com Aura" |
| Q6 | Cor de destaque (`accent_color`) na vitrine Studio? | **Não usar** | Só a cor primária + papel + verde do Pix + cores de estado. Duas cores da lojista viram briga com a arte do cliente |
| Q7 | Prazo do Pix expirado no Studio | **72 h** | A arte demora; 48 h da Negócio cancelaria pedido de quem só esperou a lojista responder |
| Q8 | Ordem F0 → F2 → F3 → F4 → F1 | **Manter** | Produto e checkout antes da home; a home atual não é o gargalo |

---

## 9. Métricas de sucesso

Medir na Sheid antes de começar (linha de base) e a cada fase. Todas saem dos eventos de §7 F5 e do banco de pedidos.

| Métrica | O que diz |
|---|---|
| Tempo até o primeiro mockup (abrir produto → primeira prévia renderizada com arte) | O configurador está guiando ou travando |
| Conclusão do configurador (abriu produto → adicionou à sacola) | Onde o cliente desiste de personalizar |
| Sacola → pedido enviado | O checkout está leve |
| Abandono por etapa do checkout (dados / entrega / pagamento) | Qual etapa pesa |
| Pix pago em até 30 min / até 24 h | A tela do Pix e o "Já paguei" funcionam |
| Pedidos pelo checkout vs. pelo WhatsApp | O WhatsApp é rede de segurança, não caminho principal |
| Arte "aceita como está" na triagem | A qualidade do upload e o aviso de DPI estão ajudando |
| Pedidos com `origem=aurinha` | A conversão do hub social aparece |
| Links de produto compartilhados (evento `share`) | O cliente virou divulgador |

---

## Anexo A — Achados na loja Negócio, fora do escopo deste plano

Encontrados na leitura do backend, confirmados no código, e registrados como tarefas separadas:

1. `sanitizeBanners` em `src/routes/digitalChannel.js` não copia `cta_url`: o destino do banner é perdido ao salvar, embora o builder e o template já o suportem.
2. O `PUT /digital-channel` recusa `font_family = 'editorial'`, que existe na tipografia e na migration 299.
3. Texto de parcelas duplicado: `PARCELAS_TXT` já devolve "ou 3x de R$ X sem juros" e `product_detail.js:270` / `checkout.js:454` embrulham de novo ("em até ou 3x … sem juros sem juros").
4. `pedidos_pausados`, `pedidos_ate` e `courier_pickup_enabled` são lidos e não têm rota de escrita.
5. O checkout da loja comum não oferece "Retirada por app", embora o servidor aceite `delivery_type='courier'`.
6. A contagem regressiva do Pix (`startTimer`) existe e a tela não tem o elemento `#timer`.
7. Loja "Fechada" mostra selo mas o servidor aceita pedido fora do horário.

## Anexo B — Fontes

- `Aura-backend/docs/F1_CONTEUDO_STUDIO.md` (18/08/2026): itens S0–S10, decisões DEC-09/10/11.
- `docs/studio/PERSONALIZACAO_CANONICA.md` (19/08/2026): forma canônica do `customization_config`.
- `Aura-backend/docs/aurinha-checkout-contract.md` (30/08/2026): deep link e atribuição.
- `Aura-backend/src/services/vitrineStudioShell.js` (04/09/2026): uma loja por empresa em `loja.getaura.com.br/<slug>`.
- Upgrade Finesse da Negócio: PRs #642–#661 (redesign em 6 fases), #674 (GA4/Pixel/SEO), #676 (URL do produto), #686 (home curada), #688/#689 (Web Push, Pix expirado).
