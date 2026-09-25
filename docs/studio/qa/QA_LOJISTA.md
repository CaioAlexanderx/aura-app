# QA da Vitrine Studio · Frente 1 · Lojista

**Escopo:** a dona da loja Studio e a atendente operando o painel (Loja Digital, Pedidos, Produção, Configurações) e os pedidos que a vitrine gera, do "publicar a loja" ao "entregue", incluindo o reflexo imediato de cada ajuste na vitrine.

**Base:** código em `main` (aura-app até #969, Aura-backend até #753), mockups `docs/mockups/studio-vitrine-00` a `05`, `JORNADA_CLIENTE_VITRINE.md`, `FASEAMENTO_VITRINE_STUDIO.md` e as pendências de `QA_NOTAS.md`. Data: 25/09/2026.

---

## Sumário dos épicos

| # | Épico | Histórias | IDs |
|---|---|---|---|
| 1 | Chegar e publicar | 4 | LJ-01 a LJ-04 |
| 2 | Identidade e aparência (Meu Site, Design, Aparência) | 12 | LJ-05 a LJ-16 |
| 3 | Catálogo personalizável | 5 | LJ-17 a LJ-21 |
| 4 | Pedidos pela loja (aba nova) | 4 | LJ-22 a LJ-25 |
| 5 | Entrega e retirada | 3 | LJ-26 a LJ-28 |
| 6 | Receber e operar o pedido | 7 | LJ-29 a LJ-35 |
| 7 | Arte e aprovação | 4 | LJ-36 a LJ-39 |
| 8 | Produção, pronto e entrega | 3 | LJ-40 a LJ-42 |
| 9 | Orçamento em lote | 1 | LJ-43 |
| 10 | Medição e relatórios | 2 | LJ-44 a LJ-45 |
| 11 | Loja de teste e chave | 2 | LJ-46 a LJ-47 |
| 12 | Qualidade transversal do painel | 3 | LJ-48 a LJ-50 |
| | **Total** | **50** | |

Fechamento: **Matriz de regressão do lojista**, **Achados antecipados (código x mockup x regra)** e **Perguntas em aberto**.

---

## Personas desta frente

- **Lojista:** a dona da loja (perfil da Sheid Mania). Não é técnica. Configura a loja pelo computador à noite e responde pedido pelo celular durante o dia. Quer saber: "a loja está aberta? chegou pedido? o que eu faço agora?".
- **Atendente:** prepara os pedidos no balcão, pelo computador da loja. Abre a fila, lê a personalização, manda a arte para aprovar, avança a produção e entrega. Não mexe em configuração.

## Regras de segurança do QA (valem para todas as histórias)

1. **Pedidos, Pix, arte e pagamento só na `aura-qa`.** Na `sheid-mania` o QA só OLHA (vitrine com `?v2=1` ou sem) e **nunca** salva nada no painel dela.
2. O painel é aberto em `app.getaura.com.br` com a **conta da loja de teste** (aura-qa). Studio → Vendas → Loja Digital.
3. Em todo pedido de teste, o WhatsApp e o e-mail da "cliente" são do **próprio testador**. O link de aprovação é enviado pelo WhatsApp que a lojista abre (wa.me): a trava da loja de teste não impede esse envio.
4. O que a loja de teste bloqueia e o que ela não bloqueia está em LJ-46. Leia antes de abrir achado de "não recebi aviso".
5. Ao terminar cada história que muda configuração da aura-qa (cor, fonte, loja fechada, data limite, retirada por app, IDs de medição), **volte ao estado base** listado abaixo.

## Dados de teste

**Loja de teste `aura-qa`** (`loja.getaura.com.br/aura-qa`, `is_sandbox`, chave `vitrine_v2` LIGADA). Estado base em 25/09:
- Nome "Aura QA — espelho da Sheid"; cor principal `#1a1612`; tipografia "Elegante" (`classic`); cartão "image-heavy".
- Pagamento: só Pix por chave (sem Mercado Pago, portanto **sem cartão**); desconto no Pix **10%**; pagar na entrega desligado.
- Entrega: retirada ligada **sem endereço de retirada cadastrado**; entrega a domicílio desligada; retirada por app desligada.
- Revisões: inclusas **0**, extra **R$ 0,00**. Prazo padrão 3 dias úteis. WhatsApp (12) 99614-5447.
- Pedidos pela loja: aberta, sem data limite, sem recado, sem GA4/Pixel.

**Produtos da aura-qa usados nas histórias** (preços reais do catálogo):
- CANECA ALÇA CORAÇÃO, R$ 49,90, prévia 3D (categoria Canecas).
- Caneca Imperial com Alça e Borda Cromado Dourada 400ml - Sua Arte Aqui, R$ 65,90, prévia 3D (nome longo).
- CAMISA ALGODÃO Básico 2 (PENTEADO), R$ 70,00, com verso configurado.
- Garrafa termica 500ml, R$ 100,00, com campo de opção.
- Adesivo Premium - Pequeno, R$ 8,00 (preço baixo, para parcela mínima).

**Contas de referência** (para conferir valores, todas pela regra do servidor):
- 2 × CANECA ALÇA CORAÇÃO: 2 × R$ 49,90 = **R$ 99,80**; Pix 10% = R$ 9,98; total no Pix **R$ 89,82**.
- O mesmo com "Criar a arte do zero" a R$ 25,00 (cobrada **uma vez por item da sacola**, não por unidade): R$ 99,80 + R$ 25,00 = **R$ 124,80**; Pix 10% = R$ 12,48; total no Pix **R$ 112,32**.
- 1 × CAMISA ALGODÃO Básico 2 com verso a R$ 8,00: R$ 70,00 + R$ 8,00 = **R$ 78,00**.
- Faixas da CANECA ALÇA CORAÇÃO para LJ-21: 10 ou mais com multiplicador 0,90 e prazo 5 dias úteis; 50 ou mais com multiplicador 0,80 e prazo 8 dias úteis. 10 un = 10 × R$ 44,91 = **R$ 449,10**; 50 un = 50 × R$ 39,92 = **R$ 1.996,00**; Pix 10% sobre R$ 1.996,00 = R$ 199,60, total **R$ 1.796,40**.
- Recado de 280 caracteres: use o texto do Anexo A no fim deste arquivo.

**Loja real `sheid-mania`** (só leitura): chave DESLIGADA; `?v2=1` mostra a vitrine nova apenas naquela aba e `?v2=0` volta. Mesma cor `#1a1612`, "Elegante", só Pix por chave, desconto no Pix 0%, "Tempo para ficar pronto" cadastrado como "5/20".

**Dispositivos:** iPhone (Safari), Android (Chrome), Chrome/Safari/Edge no desktop, uma tablet. Larguras 360, 390, 768, 1280, 1440 e notebook 1366×768.

**IDs de medição de teste:** GA4 `G-8Q3FQ2N1KM` (formato válido de exemplo; use o ID real da propriedade de teste da Aura se houver) e um Pixel de teste de 15 ou 16 dígitos.

---

## Épico 1 · Chegar e publicar

### LJ-01 · Abrir a Loja Digital e entender o estado da loja em 3 segundos
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 7 (moldura do painel)

> Como lojista, quero abrir a Loja Digital e ver de cara se a minha loja está no ar e onde ela mora, para não precisar adivinhar se o cliente está vendo a loja.

**Pré-condições**
- Logada na conta da aura-qa, no desktop (1440) e depois no celular (390).
- Loja publicada.

**Passo a passo**
1. No menu do Studio, abra Vendas → Loja Digital.
2. Leia o cabeçalho: sobretítulo, título e subtítulo.
3. Observe o bloco colorido logo abaixo e o selo à direita.
4. Toque em "Ver site".
5. Volte ao painel e recarregue a página (F5).

**Critérios de aceite — funciona**
- [ ] O cabeçalho mostra "VENDAS · LOJA DIGITAL" e o título "Sua loja Studio na internet".
- [ ] O bloco em degradê mostra "Loja Digital pronta pra personalizados" e o selo "PUBLICADA" em verde.
- [ ] "Ver site" aparece só com a loja publicada e abre `https://loja.getaura.com.br/aura-qa` em **nova aba**; o painel continua aberto na aba original.
- [ ] A vitrine aberta é a vitrine Studio nova (cabeçalho com busca e sacola), porque a chave está ligada na aura-qa.
- [ ] Após F5, a tela volta na mesma aba da Loja Digital e o selo continua "PUBLICADA".

**Critérios de aceite — premium (UI/UX)**
- [ ] Título e selo legíveis sobre o degradê navy→magenta (texto branco com contraste AA em toda a faixa do degradê, inclusive na ponta magenta `#EC4899`).
- [ ] "Ver site" tem alvo de toque de pelo menos 44 px de altura no celular (hoje o botão tem ~30 px: medir).
- [ ] O subtítulo fala a língua da lojista: sem a palavra "storefront" e sem "pra" em texto de apresentação (hoje: "Configure tudo do storefront..."). Registrar como achado de microcopy se continuar.
- [ ] No celular (390), selo e texto do bloco não se sobrepõem nem cortam palavra.

**Casos de borda**
- [ ] Loja despublicada: selo "RASCUNHO" em branco translúcido e **sem** botão "Ver site" (ver LJ-04).
- [ ] Rede lenta (DevTools "Slow 3G"): aparece esqueleto de carregamento, nunca tela em branco nem selo "RASCUNHO" piscando antes de virar "PUBLICADA".
- [ ] Nome de loja longo (ver LJ-05) não altera o cabeçalho do painel.

**Pontos de atenção conhecidos**
- Botão chama "Ver site" no cabeçalho e "Ver loja" dentro da aba Meu Site: dois nomes para a mesma ação (ver LJ-05).

---

### LJ-02 · Navegar pelas dez abas e voltar direto a uma aba pelo endereço
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 7

> Como lojista, quero trocar de aba sem me perder e poder guardar o link de uma aba, para voltar direto a "Pedidos pela loja" quando a temporada apertar.

**Pré-condições**
- Desktop 1440, Loja Digital aberta.

**Passo a passo**
1. Confira a ordem das abas da esquerda para a direita.
2. Clique em cada aba e observe o endereço na barra do navegador.
3. Na aba "Pedidos pela loja", copie o endereço, feche a aba do navegador e cole o endereço numa aba nova.
4. Clique em "Design", depois em "Entrega"; use o botão voltar do navegador duas vezes.
5. Edite o endereço para `?tab=xyz` e carregue.

**Critérios de aceite — funciona**
- [ ] Ordem das abas: "Meu Site", "Design", "Aparência" | "Configurador", "Galeria", "Revisões", "Marketplaces" | "Entrega", "Pedidos pela loja", "Pedidos" (com divisória fina após "Aparência" e após "Marketplaces").
- [ ] Cada aba grava `?tab=` no endereço: `site`, `design`, `aparencia`, `configurator`, `gallery`, `revisions`, `marketplaces`, `delivery`, `pedidos_loja`, `orders`.
- [ ] O link com `?tab=pedidos_loja` abre direto em "Pedidos pela loja".
- [ ] Voltar do navegador volta para a aba anterior (Entrega → Design → aba de antes), sem sair da Loja Digital.
- [ ] `?tab=xyz` abre em "Meu Site" sem erro.

**Critérios de aceite — premium (UI/UX)**
- [ ] Aba ativa em navy `#1E3A8A` com texto branco e sombra navy discreta; inativas em cartão claro com texto `ink2`.
- [ ] A troca de aba não faz a página "pular" para o topo de forma brusca nem piscar o cabeçalho.
- [ ] Hover no desktop muda o cursor para mão; foco por teclado (Tab) é visível em cada aba.

**Casos de borda**
- [ ] Trocar de aba com alteração não salva em "Pedidos pela loja": hoje a edição é descartada sem aviso (a aba é desmontada). Registrar se a lojista perde o que digitou; esperado premium: aviso "Você tem alterações não salvas" ou manter o rascunho.
- [ ] Voltar do navegador depois de F5 continua coerente.

---

### LJ-03 · Usar a Loja Digital no celular sem perder abas de vista
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 7 (versão celular)

> Como lojista no celular, quero achar a aba que preciso rolando a fileira de abas, para ajustar a loja no intervalo do atendimento.

**Pré-condições**
- iPhone (Safari) e Android (Chrome), 360 e 390 de largura; tablet em retrato (768).

**Passo a passo**
1. Abra a Loja Digital no celular.
2. Arraste a fileira de abas para a esquerda até "Pedidos".
3. Toque em "Pedidos pela loja", role a página até o fim e volte ao topo.
4. Gire o celular para paisagem e de volta.

**Critérios de aceite — funciona**
- [ ] A fileira de abas rola na horizontal; as bordas esmaecem (degradê) indicando que há mais abas, e o esmaecido não bloqueia o toque na aba de baixo.
- [ ] Todas as dez abas são alcançáveis e tocáveis.
- [ ] Nenhuma rolagem horizontal na página inteira (só na fileira de abas).

**Critérios de aceite — premium (UI/UX)**
- [ ] Alvo de toque das abas com pelo menos 44 px de altura (hoje ~36 px: medir e registrar).
- [ ] O cabeçalho e o bloco em degradê não ocupam mais que metade da primeira tela do celular a 390.
- [ ] No modo escuro do Studio, o esmaecido das bordas acompanha o fundo escuro (sem faixas claras sobre as abas).

**Casos de borda**
- [ ] Tablet 768: como a regra de "tela larga" é calculada ao carregar a página (acima de 768 px), girar a tablet ou redimensionar a janela do desktop de 1280 para 390 **não** reorganiza a tela até recarregar. Registrar o comportamento em cada caso.
- [ ] Largura exatamente 768 e 769: comparar se o esmaecido aparece ou some.

**Pontos de atenção conhecidos**
- O mockup (Tela 7, celular) mostra abas encurtadas ("Site", "Design", "Pedidos pela loja", "Entrega"); o código mostra os nomes completos. Registrar "texto conforme mockup" se o PO preferir os curtos.

---

### LJ-04 · Publicar e despublicar a loja e ver a vitrine responder
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 4 (loja não encontrada)

> Como lojista, quero tirar a loja do ar e colocá-la de volta, para não receber pedido enquanto reorganizo o catálogo.

**Pré-condições**
- aura-qa publicada; uma aba anônima do celular com `loja.getaura.com.br/aura-qa` aberta.

**Passo a passo**
1. Em "Meu Site", desligue "Site publicado" e toque em "Salvar configurações".
2. Observe o selo do bloco em degradê e o botão "Ver site".
3. Na aba anônima, recarregue a vitrine.
4. Volte, ligue "Site publicado" e toque em "Salvar configurações".
5. Recarregue a vitrine.

**Critérios de aceite — funciona**
- [ ] Ao desligar, a dica do interruptor muda de "Visível para clientes" para "Site oculto" antes mesmo de salvar.
- [ ] Depois de salvar: aviso "Configurações salvas", selo "RASCUNHO", "Ver site" some.
- [ ] A vitrine despublicada mostra o estado de erro da loja com a voz da loja (mockup 01, Tela 4: "Não achamos essa loja" com caminho de saída), nunca um JSON ou "!" cru.
- [ ] Religar e salvar volta "PUBLICADA", "Ver site" e a vitrine normal.

**Critérios de aceite — premium (UI/UX)**
- [ ] O interruptor tem rótulo claro e o botão diz o que acontece; o texto "Salvando..." aparece enquanto grava e o botão fica desabilitado (não dá para salvar duas vezes).
- [ ] A troca de selo acontece sem recarregar a página do painel.

**Casos de borda**
- [ ] Desligar o interruptor e **não** salvar: o selo continua "PUBLICADA" (é o salvo que vale). Conferir que isso não confunde: esperado que a tela diga que há alteração não salva.
- [ ] A aba "Design" mostra o aviso âmbar "Sua loja ainda não está publicada. Vá em Meu Site e ative a publicação..." enquanto estiver despublicada.
- [ ] Pedido em andamento na vitrine (sacola cheia, checkout aberto) quando a loja é despublicada: o envio do pedido falha com mensagem clara, sem pedido criado.

**Pontos de atenção conhecidos**
- Os três botões da aba Meu Site ("Salvar configurações", "Salvar pagamentos", "Salvar política") gravam **o formulário inteiro** de uma vez. Confirmar que salvar "política" não reverte, por exemplo, uma mudança de publicação feita no topo e não salva.

---

## Épico 2 · Identidade e aparência

### LJ-05 · Preencher nome, slogan, WhatsApp e redes e ver no rodapé da loja
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 05-home, Tela 6 (rodapé)

> Como lojista, quero que o nome, o slogan e as minhas redes apareçam certos na loja, para o cliente confiar que é a minha loja.

**Pré-condições**
- aura-qa, desktop. Anote os valores originais para restaurar.

**Passo a passo**
1. Em "Meu Site" → "Informações do negócio", preencha "Slogan (opcional)" com "Presentes que ninguém mais tem".
2. Em "Instagram" cole `https://instagram.com/sheidmania`; em "TikTok" digite `@sheidmania`; deixe "Facebook" vazio.
3. Em "WhatsApp" digite `12996145447` e veja a máscara.
4. Toque em "Salvar configurações".
5. Abra a vitrine (desktop e celular) e role até o rodapé.

**Critérios de aceite — funciona**
- [ ] A máscara transforma o WhatsApp em "(12) 99614-5447" enquanto digita.
- [ ] Após salvar, a vitrine mostra o slogan onde a home usa o título da loja sem banner (mockup 05, Tela 2) e o rodapé mostra ícones só de Instagram e TikTok (Facebook vazio não gera ícone).
- [ ] O link do Instagram abre o perfil correto tanto a partir do @ quanto do link colado.
- [ ] O botão de WhatsApp da vitrine abre conversa com 5512996145447.
- [ ] F5 no painel mantém os valores.

**Critérios de aceite — premium (UI/UX)**
- [ ] Rótulo sempre acima do campo; exemplo nos campos coerente com uma loja de personalizados (hoje "Ex: Barbearia do Caio" no nome: registrar achado de microcopy).
- [ ] A dica "Cada rede preenchida vira um ícone no rodapé da sua loja. Pode colar o @ ou o link do perfil." aparece logo abaixo das redes.
- [ ] Textos de ajuda com acentuação correta (hoje há "cabecalho", "rodape", "Ja deixamos", "so o preço a vista", "A pagina do produto", "Prometa so": listar cada um como achado P2).

**Casos de borda**
- [ ] Nome com 60 caracteres ("Ateliê de Presentes Personalizados da Família Oliveira Ltda"): cabeçalho da vitrine quebra ou abrevia sem sobrepor busca e sacola, no celular a 360.
- [ ] Slogan vazio: a home sem banner não mostra frase vazia nem espaço em branco.
- [ ] Instagram com espaço no fim ("@sheidmania "): ícone funciona.

**Pontos de atenção conhecidos**
- Existem dois "WhatsApp da loja": o de "Meu Site" (vitrine) e o de Configurações do Studio → "Produção e aprovação" (links de aprovação). Conferir se a lojista entende qual é qual (ver pergunta em aberto 7).

---

### LJ-06 · Trocar o logo e ver o cabeçalho da vitrine
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P2  ·  **Chave:** ambas  ·  **Mockup:** 05-home, Telas 1 e 2 (cabeçalho)

> Como lojista, quero subir meu logo e vê-lo limpo sobre a loja, para a loja ter a minha cara.

**Pré-condições**
- Desktop; três arquivos: PNG transparente 512×512, JPG com fundo branco, imagem de 6 MB.

**Passo a passo**
1. Em "Meu Site" → "Logo", toque em "Enviar logo" (ou "Trocar logo") e escolha o PNG transparente.
2. Recarregue a vitrine no celular e no desktop.
3. Repita com o JPG de fundo branco e depois com o arquivo de 6 MB.
4. No celular, abra a mesma seção.

**Critérios de aceite — funciona**
- [ ] O botão mostra "Enviando..." e depois aparece o aviso "Imagem salva"; a miniatura do painel troca.
- [ ] A vitrine mostra o logo novo no cabeçalho, na aprovação de arte e no acompanhamento (Fase 4).
- [ ] Arquivo acima de 5 MB mostra "Imagem muito grande (max 5MB)" e nada é enviado.

**Critérios de aceite — premium (UI/UX)**
- [ ] A dica de tamanho (PNG transparente) aparece junto do botão, antes da escolha do arquivo.
- [ ] Sem logo, painel e vitrine mostram a inicial do nome sobre a cor da loja, nunca um quadrado vazio.
- [ ] Mensagem de erro com acento e unidade corretos ("máx. 5 MB").

**Casos de borda**
- [ ] JPG com fundo branco sobre cor escura `#1a1612`: aparece como quadrado branco (esperado; conferir que a dica avisa isso).
- [ ] No celular (app nativo ou navegador), o botão de envio só existe no navegador: registrar se a lojista no celular consegue trocar o logo.

---

### LJ-07 · Configurar desconto no Pix e parcelamento e ver o preço certo na loja
**Persona:** Lojista  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 03-produto, Tela 1 e 7; 02-fechar-a-venda, Tela 4

> Como lojista, quero dar 10% de desconto no Pix e dizer em quantas vezes parcelo, para o cliente ver o preço certo antes de fechar.

**Pré-condições**
- aura-qa com Pix 10% (estado base). Sem Mercado Pago conectado.

**Passo a passo**
1. Em "Meu Site" → "Pagamentos", leia o campo "Desconto para quem pagar no Pix (%)" e a frase abaixo dele.
2. Abra a vitrine na CANECA ALÇA CORAÇÃO.
3. No painel, mude para `5`, toque em "Salvar pagamentos", recarregue o produto.
4. Digite `35` e observe o aviso; salve.
5. Digite `0` e salve; recarregue o produto.
6. Com "Aceitar cartão de crédito" ligado, escolha "até 3x".
7. Volte ao estado base (10%, "Não mostrar").

**Critérios de aceite — funciona**
- [ ] Com 10%: o produto mostra R$ 49,90 e "R$ 44,91 no Pix" (49,90 − 4,99).
- [ ] Com 5%: "R$ 47,41 no Pix". Com 0: o preço no Pix não aparece em lugar nenhum da vitrine (produto, sacola, faixa automática).
- [ ] Com 35: aparece o aviso "O máximo é 30%. Vamos salvar 30 ..." e o valor salvo é 30.
- [ ] Sem Mercado Pago, o parcelamento mostra o aviso "Conecte o Mercado Pago abaixo para o parcelamento aparecer na loja..." e a vitrine **não** mostra "ou 3x de".
- [ ] A frase de ajuda muda com o valor: "Cada produto vai mostrar "ou R$ X no Pix" com 10% a menos." / "Com 0, o preço no Pix não aparece...".

**Critérios de aceite — premium (UI/UX)**
- [ ] O campo aceita vírgula ("7,5") e o teclado do celular é numérico.
- [ ] Na vitrine, o preço no Pix aparece em Bricolage Grotesque com dígitos tabulares e em cor que não compete com o preço cheio.
- [ ] Os chips de parcelas ("Não mostrar", "até 2x" ... "até 12x") têm estado selecionado claro e alvo de 44 px no celular (hoje ~30 px: medir).

**Casos de borda**
- [ ] "7,5" salva 7,5 e a vitrine arredonda o preço no Pix ao centavo (R$ 46,16 para R$ 49,90).
- [ ] Adesivo Premium - Pequeno (R$ 8,00) com "até 3x" e MP conectado: parcela mínima de R$ 5 faz mostrar menos vezes ou nenhuma (só verificável em loja com MP; ver pergunta em aberto 3).
- [ ] Apagar o campo inteiro e salvar: grava 0, sem travar o campo.

---

### LJ-08 · Escrever a política de trocas e devoluções
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P2  ·  **Chave:** ambas  ·  **Mockup:** 05-home, Tela 6

> Como lojista, quero ajustar o texto de trocas para personalizados, para não prometer troca de uma caneca com nome.

**Pré-condições**
- aura-qa sem política própria (campo mostra o texto sugerido).

**Passo a passo**
1. Em "Meu Site" → "Trocas e devoluções", leia o texto já preenchido.
2. Acrescente "Peças personalizadas não têm troca por arrependimento, só por defeito." e toque em "Salvar política".
3. Veja o rodapé da vitrine.
4. Toque em "Voltar ao texto sugerido" e salve.

**Critérios de aceite — funciona**
- [ ] O campo já nasce com o texto padrão da Aura (o mesmo que o rodapé usa).
- [ ] Depois de salvar, o rodapé da vitrine mostra o texto novo; após "Voltar ao texto sugerido" e salvar, volta o padrão.
- [ ] "Voltar ao texto sugerido" só aparece quando o texto difere do sugerido.

**Critérios de aceite — premium (UI/UX)**
- [ ] O aviso "Prometa só o que você consegue cumprir..." aparece junto do campo (conferir acento em "só").
- [ ] Campo com altura para o texto inteiro sem rolar dentro dele no desktop.

**Casos de borda**
- [ ] Apagar o texto todo e salvar: volta ao padrão (é a regra), sem rodapé vazio.

---

### LJ-09 · Escolher a cor dos botões e confiar no que a loja vai mostrar
**Persona:** Lojista  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 00-kit (regra de contraste); 01-alicerce, Tela 1

> Como lojista, quero trocar a cor da loja e ver na hora o efeito, para escolher uma cor que fique bonita e legível.

**Pré-condições**
- Desktop 1440, aba "Design" aberta ao lado de uma aba com a vitrine aura-qa.

**Passo a passo**
1. Em "Design" → "Identidade visual", observe a mini loja e o campo "Cor dos botões e preços".
2. Toque na bolinha verde `#059669`. Espere o aviso "Salvando…" sumir.
3. Recarregue a vitrine: home, produto, sacola.
4. Abra "Aparência" e leia "Sua cor na loja".
5. Digite `#F5D90A` (amarelo) no seletor de cor; repita 3 e 4.
6. Volte para `#1a1612`.

**Critérios de aceite — funciona**
- [ ] A mini loja muda na hora; o salvamento é automático (0,8 s depois do último toque) e mostra "Salvando…".
- [ ] A vitrine recarregada usa a cor nova em botões, preços, faixa de anúncio e selos.
- [ ] "Aparência" mostra três amostras ("ESCOLHIDA", "ESCRITA", "BOTÃO") e um recado com bolinha verde, âmbar ou vermelha explicando o que a vitrine fez com a cor.
- [ ] Com o amarelo, o texto dos botões da vitrine é escuro (nunca branco sobre amarelo) e o recado da Aparência avisa que a cor foi ajustada para leitura.
- [ ] O link "Trocar a cor na aba Design →" leva à aba Design.

**Critérios de aceite — premium (UI/UX)**
- [ ] Contraste AA (4,5:1) do texto sobre o botão da vitrine com as três cores testadas.
- [ ] A frase "Tudo na loja deriva desta cor: botões, bordas, sombras e o fundo dos banners." aparece abaixo do seletor.
- [ ] As bolinhas de cor têm nome acessível (leitor de tela diz a cor), e a selecionada tem marcação visível além da cor.

**Casos de borda**
- [ ] Cor branca `#FFFFFF`: a vitrine continua legível (botão com texto escuro, borda visível).
- [ ] Valor inválido no seletor ("#12"): não salva e diz o que corrigir.
- [ ] Trocar a cor três vezes em menos de 1 s: só a última é salva, sem erro.

**Pontos de atenção conhecidos**
- A mini loja da aba Design recebe a "cor de destaque", que a decisão 7 do PO tirou da vitrine. Confirmar que a mini loja não pinta nada com a cor de destaque.

---

### LJ-10 · Escolher a tipografia e o estilo dos cards e ver a mesma coisa na vitrine
**Persona:** Lojista  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 00-kit (par de fontes e números); 05-home, Telas 1 e 3

> Como lojista, quero escolher entre as tipografias vendo como a minha loja fica, para não escolher no escuro.

**Pré-condições**
- Desktop, aba "Design" → "Tipografia".

**Passo a passo**
1. Toque em cada opção de "Como sua loja escreve": "Elegante", "Moderna", "Marcante", "Acolhedora". Depois de cada uma, espere salvar e recarregue a vitrine (home e produto CANECA ALÇA CORAÇÃO).
2. Em cada escolha, abra "Aparência" → "Sua tipografia aqui" e compare com a vitrine.
3. Em "Estilo dos cards de produto", escolha cada estilo e confira a grade da home.
4. Volte para "Elegante" e "image-heavy".

**Critérios de aceite — funciona**
- [ ] A vitrine usa o par Studio de cada chave: Elegante = Fraunces + DM Sans; Moderna = DM Sans; Marcante = Instrument Serif + DM Sans; Acolhedora = Pacifico + DM Sans.
- [ ] Em todas as escolhas, **preços, quantidades, contagens, CEP e código Pix saem em Bricolage Grotesque** com dígitos tabulares (conferir no inspetor: `font-family` começa com 'Bricolage Grotesque').
- [ ] "Marcante" salva sem erro. **Hoje o servidor recusa com "font_family deve ser classic|modern|humanist"** (registrar P1 se reproduzir: a lojista vê um aviso técnico e a escolha não fica).
- [ ] Cada estilo de card muda a grade da home e da categoria.

**Critérios de aceite — premium (UI/UX)**
- [ ] A prévia de tipografia da aba Design mostra **as fontes que a vitrine Studio vai usar**. Hoje ela mostra as da loja comum (Elegante = Cormorant, Moderna = Space Grotesk, Marcante = Anton, Acolhedora = Lora): mesmo nome, letra diferente. Registrar P1 com print lado a lado (Design x vitrine).
- [ ] "Aparência" mostra a frase "Você escolheu "Elegante". Na loja de personalizados ela vira este par..." com o espécime na fonte certa.
- [ ] A fonte não muda ao entrar no produto, na sacola, no checkout, na confirmação, na aprovação e no acompanhamento.

**Casos de borda**
- [ ] Rede lenta: enquanto a fonte carrega, o texto aparece em fonte de sistema e troca sem mudar o tamanho da linha de forma visível.
- [ ] "Acolhedora" (Pacifico) com nome de produto longo: o título quebra em até 2 linhas sem cortar letra.

**Pontos de atenção conhecidos**
- A amostra de preço "R$ 49,90" e os rótulos da aba "Aparência" usam DM Mono, que a decisão 9 do PO tirou do produto. Esperado: Bricolage Grotesque.

---

### LJ-11 · Escrever a faixa de anúncio ou deixar a automática
**Persona:** Lojista  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 1 (faixa)

> Como lojista, quero um aviso curto no topo da loja, para o cliente saber na hora do meu prazo e do desconto no Pix.

**Pré-condições**
- aura-qa, faixa vazia (estado base), desconto no Pix 10%, prazo 3 dias úteis.

**Passo a passo**
1. Abra a vitrine no celular (390) e no desktop e leia a faixa do topo.
2. No painel, em "Design" → "Anúncio (faixa superior)", escreva "Encomendas de Natal até 15/12 · Retire na loja · 10% no Pix".
3. Recarregue a vitrine.
4. Apague o texto e recarregue.

**Critérios de aceite — funciona**
- [ ] Vazia, a faixa automática mostra "VOCÊ APROVA O MOCKUP ANTES DE PRODUZIR", "PRONTO EM 3 DIAS ÚTEIS" e "10% NO PIX", cada item com ícone de visto.
- [ ] Escrita, a faixa mostra os três itens separados pelo "·", cada um inteiro (sem quebrar no meio) no celular.
- [ ] Sem desconto no Pix (0%), a automática não anuncia desconto.

**Critérios de aceite — premium (UI/UX)**
- [ ] Faixa na cor da loja com texto legível (AA), em caixa alta com Bricolage Grotesque.
- [ ] O rótulo do campo no painel diz a verdade. Hoje diz "Texto exibido no topo (desktop)", mas a vitrine nova mostra a faixa também no celular: registrar P2.

**Casos de borda**
- [ ] Texto sem "·" com 120 caracteres: quebra em duas linhas no celular sem cobrir o cabeçalho.
- [ ] Com a loja fechada ou com data limite perto (LJ-22, LJ-23), confirmar a ordem entre a faixa de anúncio e a faixa de temporada (uma não esconde a outra).

---

### LJ-12 · Montar banners com botão e destino dentro da loja
**Persona:** Lojista  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 1

> Como lojista, quero banners que levam o cliente direto para as canecas ou para o orçamento em lote, para o topo da loja vender em vez de só enfeitar.

**Pré-condições**
- Desktop; uma imagem larga 1920×640 (até 500 KB) e uma quadrada 1080×1080.
- Categoria "Canecas" existe na aura-qa.

**Passo a passo**
1. Em "Design" → "Banners do topo", ligue "Banner 1": "Kicker (linha curta acima do título)" = "Natal 2026"; "Título principal" = "A caneca com o nome de quem você ama"; "Corpo (descrição)" = "Pronta em 3 dias úteis"; "Botão (CTA)" = "Ver canecas"; "Link do botão" = `#cat=/canecas`. Suba a imagem larga.
2. Banner 2: "Botão (CTA)" = "Pedir para a empresa"; "Link do botão" = `#vista=lote`, sem imagem.
3. Banner 3: só imagem e "Link do botão" = `#vista=mais_vendidos`, sem texto.
4. Recarregue a vitrine no desktop e no celular e toque em cada banner e botão.
5. Teste os avisos: só texto no botão; só link; link `loja.com/x`; link `abc`.
6. Suba a imagem quadrada em "Imagem para celular (opcional)" do Banner 1.

**Critérios de aceite — funciona**
- [ ] Os três banners giram a cada 6 s, com setas e bolinhas; a rotação pausa quando o dedo toca o banner.
- [ ] "Ver canecas" rola até a grade das canecas (ou abre a categoria), sem sair da loja; "Pedir para a empresa" abre o orçamento em lote; o Banner 3 inteiro é clicável e leva aos mais pedidos.
- [ ] Avisos no painel: só texto → "Sem o link, o botão não aparece na loja. Cole o endereço para onde ele deve levar."; só link → "Falta o texto do botão — sem ele não há o que clicar."; `abc` → "O link precisa começar com https://...".
- [ ] `loja.com/x` vira `https://loja.com/x` ao sair do campo; link `https://` abre em nova aba.
- [ ] No celular, o Banner 1 usa a imagem quadrada.
- [ ] F5 no painel mantém os três banners com os destinos (o destino não é descartado ao salvar; QA_NOTAS Anexo A).

**Critérios de aceite — premium (UI/UX)**
- [ ] Texto do banner legível sobre a imagem (AA); banner sem imagem (fundo escuro da loja) também AA (QA_NOTAS F5: não verificado).
- [ ] Kicker, título e botão alinhados à esquerda no desktop; nada cortado no celular a 360.
- [ ] "Reduzir movimento" ligado no sistema: banners não giram sozinhos.

**Casos de borda**
- [ ] `#cat=/categoria-que-nao-existe`: a vitrine não desenha botão morto.
- [ ] Desligar os três banners ("Ativo" desligado): a home cai na peça do destaque (LJ-13).
- [ ] O controle "Tempo entre slides" **não** aparece na loja Studio (a vitrine gira a cada 6 s fixos).

**Pontos de atenção conhecidos**
- QA_NOTAS F5: `#vista=lote` é aceito também na loja comum, que não sabe abrir esse destino (fora desta frente, mas registrar se aparecer).

---

### LJ-13 · Escolher a peça do destaque para quando não há banner
**Persona:** Lojista  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 2

> Como lojista sem banner pronto, quero escolher qual caneca gira no topo da loja, para a primeira coisa que o cliente vê ser a minha peça mais bonita.

**Pré-condições**
- Todos os banners desligados.

**Passo a passo**
1. Em "Design", encontre "Peça do destaque (quando não há banner)" logo abaixo dos banners.
2. Leia a frase e a opção "Automático".
3. Recarregue a vitrine (desktop e celular).
4. Escolha "Caneca Imperial com Alça e Borda Cromado Dourada 400ml - Sua Arte Aqui"; recarregue.
5. Volte para "Automático".

**Critérios de aceite — funciona**
- [ ] A frase diz "No automático, é a primeira com prévia 3D (hoje: <nome da peça>)" com o nome real.
- [ ] As peças com "Prévia 3D" aparecem primeiro na lista.
- [ ] A vitrine sem banner mostra o título da loja e o mockup da peça girando com as artes trocando sozinhas; a peça escolhida substitui a automática após recarregar.
- [ ] A escolha fica marcada após F5 no painel.

**Critérios de aceite — premium (UI/UX)**
- [ ] Cartão da peça selecionada com borda de 2 px e fundo suave; nome em até 2 linhas sem cortar no meio da palavra.
- [ ] Leitor de tela anuncia cada cartão como opção de rádio ("Automático: a primeira com prévia 3D").
- [ ] No desktop, o hero sem banner não deixa metade vazia (JORNADA §4.2).

**Casos de borda**
- [ ] Peça escolhida é depois ocultada da loja (LJ-17): a vitrine cai na automática, sem hero vazio; o painel mostra o que está valendo.
- [ ] Sem nenhuma peça 3D na loja: a automática é a primeira com foto.
- [ ] Rede lenta ou 3D indisponível: o hero cai para a foto 2D sem ficar em branco.

**Pontos de atenção conhecidos**
- QA_NOTAS F5: "a primeira com prévia 3D" segue a ordem de cadastro; não é "a mais pedida". Registrar se a lojista esperar a mais vendida.

---

### LJ-14 · Escrever os selos de confiança ou usar os automáticos
**Persona:** Lojista  ·  **Fase:** 5  ·  **Prioridade:** P2  ·  **Chave:** v2 ligada  ·  **Mockup:** 05-home, Tela 3

> Como lojista, quero quatro selos curtos antes do rodapé que digam o que eu garanto, para passar confiança sem inventar promessa.

**Pré-condições**
- aura-qa sem selos escritos.

**Passo a passo**
1. Leia a vitrine antes do rodapé.
2. Em "Design" → "Selos de confiança", veja o estado vazio "Nenhum card configurado" e toque num modelo pronto.
3. Crie quatro selos: "Você aprova antes" / "Mockup no WhatsApp"; "Retire na loja" / "Jacareí, sem frete"; "Pix com desconto" / "10% à vista"; o quarto com o ícone "Folha".
4. Recarregue a vitrine.
5. Desligue os quatro ("Ativo") e recarregue.

**Critérios de aceite — funciona**
- [ ] Sem selos escritos, a vitrine mostra os automáticos do Studio a partir do que a loja ligou: "Você aprova antes" (com "nada sai sem o seu ok" quando inclusas = 0), "Compra segura" (Pix), "Retire na loja", "Atendimento humano" (WhatsApp) e, se sobrar lugar, "Pronto em 3 dias úteis". No máximo 4.
- [ ] Com selos escritos, só os dela aparecem, na ordem dela.
- [ ] O botão "Adicionar card (N/4)" some no quarto selo.

**Critérios de aceite — premium (UI/UX)**
- [ ] O ícone escolhido no painel é o ícone mostrado na vitrine. Hoje "Folha" vira um ícone de brilho na vitrine: registrar P2.
- [ ] Texto do selo sem cortar em 360; ícones na cor da loja.

**Casos de borda**
- [ ] Selo só com título e sem descrição: aparece sem linha vazia.
- [ ] O conjunto de fábrica do painel (selos gravados sozinhos) não aparece como se fosse da lojista na loja Studio.

---

### LJ-15 · Ver a vitrine Studio de verdade na prévia da aba Design
**Persona:** Lojista  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** — (fora do mockup 05, previsto no faseamento)

> Como lojista, quero que a prévia ao lado do formulário mostre a minha loja de personalizados, para não precisar abrir outra aba a cada ajuste.

**Pré-condições**
- Desktop 1440; depois celular 390.

**Passo a passo**
1. Em "Design", olhe a coluna da direita.
2. Alterne "Desktop" e "Mobile".
3. Mude o título do Banner 1 e espere salvar; depois toque em "Atualizar".
4. No celular, role até o fim da aba Design.

**Critérios de aceite — funciona**
- [ ] A prévia carrega `loja.getaura.com.br/aura-qa` (a vitrine Studio), não a página da loja comum.
- [ ] Depois de cada salvamento automático a prévia recarrega sozinha; "Atualizar" também recarrega.
- [ ] "Mobile" mostra a moldura estreita com cantos arredondados.
- [ ] No celular, a prévia aparece no fim da aba com 540 px de altura.

**Critérios de aceite — premium (UI/UX)**
- [ ] A prévia fica visível enquanto a lojista rola o formulário no desktop (lado a lado).
- [ ] Recarregar a prévia não rola o formulário de volta ao topo.

**Casos de borda**
- [ ] Loja sem slug ou despublicada: aparece "Publique sua loja na aba Meu Site para ver o preview aqui".
- [ ] **Chave desligada** (pedir à equipe técnica para desligar na aura-qa por 15 minutos, ver LJ-47): a prévia mostra a vitrine de hoje, que usa só o primeiro banner e não tem a peça do destaque, mas os textos da aba continuam prometendo "Até 3 banners se alternam ... a cada 6 segundos" e a peça do destaque. Registrar P1 para a Sheid (chave desligada).

**Pontos de atenção conhecidos**
- QA_NOTAS F5: a aba Design não foi vista no navegador durante o desenvolvimento (só teste automatizado). Esta história é a primeira verificação real.
- Textos da prévia usam "Preview" e "Mobile" (inglês) no painel: registrar microcopy.

---

### LJ-16 · Conferir na aba Aparência como a loja resolve cor, fonte e mockup 3D
**Persona:** Lojista  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** —

> Como lojista, quero uma aba que me mostre como as minhas escolhas chegam na loja de personalizados e ligar o mockup 3D certo em cada produto, para o cliente ver a arte na peça certa.

**Pré-condições**
- Desktop e celular; aura-qa com CANECA ALÇA CORAÇÃO já vinculada a um modelo 3D.

**Passo a passo**
1. Abra "Aparência". Leia o texto de abertura.
2. Em "Mockup 3D por produto", troque o vínculo da "Garrafa termica 500ml" de "Sem mockup" para um modelo "2D" e depois de volta.
3. Abra a Garrafa na vitrine após cada troca.
4. Toque em "Revisões inclusas e preço da revisão extra: aba Revisões →" e em "Prazo de produção: Configurações do Studio →".
5. Ative o modo escuro do Studio (Configurações → Aparência) e volte à aba.

**Critérios de aceite — funciona**
- [ ] Cada produto personalizável aparece com os chips "Sem mockup" e os modelos publicados, cada um com a nota "3D" ou "2D".
- [ ] Tocar num chip mostra um indicador de carregamento só naquela linha; a vitrine passa a mostrar a prévia do modelo escolhido.
- [ ] "aba Revisões →" abre a aba Revisões; "Configurações do Studio →" abre Configurações, onde está "Prazo padrão (dias úteis)".
- [ ] Se o vínculo falhar (simular com rede desligada), o chip volta ao que era.

**Critérios de aceite — premium (UI/UX)**
- [ ] Cartões com fundo e borda do painel Studio (`paperCard` com borda `ink5`) nos modos claro e escuro, sem fundo branco estourado no escuro.
- [ ] Chip ativo na identidade do Studio (navy). Hoje o ativo usa violeta `rgba(124,58,237,…)`, a cor do varejo: registrar P2.
- [ ] Falha de vínculo explica o que houve ("Não salvou, tente de novo"). Hoje volta calado: registrar P1.
- [ ] Chips com alvo de 44 px no celular (hoje ~30 px).

**Casos de borda**
- [ ] Nenhum modelo publicado: "Nenhum modelo publicado ainda. A Aura mantém esta lista."
- [ ] 40 produtos: a lista rola sem travar e os nomes longos cortam em uma linha com reticências.

---
## Épico 3 · Catálogo personalizável

### LJ-17 · Escolher quais peças aparecem na loja e abrir a edição de cada uma
**Persona:** Lojista  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 03-produto, Tela 9 (grade de modelos)

> Como lojista, quero esconder da loja uma peça sem estoque de insumo e abrir a edição de outra, para a vitrine mostrar só o que eu consigo produzir.

**Pré-condições**
- aura-qa com pelo menos 14 produtos personalizáveis.

**Passo a passo**
1. Abra a aba "Configurador" e leia o cabeçalho "Produtos personalizáveis na sua Loja Digital".
2. Desligue "Mostrar na Loja Virtual" do "Corta Vento Impermeável".
3. Recarregue a vitrine e procure a peça pela busca e pela categoria.
4. Toque em "Editar produto" da CANECA ALÇA CORAÇÃO.
5. Volte e toque em "Gerenciar catálogo".
6. Religue a peça.

**Critérios de aceite — funciona**
- [ ] Peça desligada ganha o selo "Oculto na loja" no painel e some da home, da categoria, da busca e da grade de modelos da vitrine.
- [ ] O link direto da peça oculta (`/aura-qa/p/<id>`) mostra estado de "peça indisponível" com caminho de volta, não erro cru.
- [ ] "Editar produto" abre o Estoque já na edição daquela peça, com as abas "Dados", "Personalização", "Ficha técnica", "Templates".
- [ ] "Gerenciar catálogo" abre o Estoque.

**Critérios de aceite — premium (UI/UX)**
- [ ] O rótulo usa o mesmo nome da tela: "Loja Digital". Hoje "Mostrar na Loja Virtual": registrar P2.
- [ ] Interruptor com alvo de 44 px e estado lido pelo leitor de tela.

**Casos de borda**
- [ ] Nenhum produto personalizável: estado vazio "Nenhum produto personalizável" com o botão "Marcar produtos como personalizáveis".
- [ ] Peça oculta que estava na sacola de uma cliente: o checkout recusa com mensagem clara (verificação da frente Cliente; aqui só confirmar que a lojista não recebe pedido dela).

---

### LJ-18 · Configurar campos, verso e meio com preço e ver a conta na vitrine
**Persona:** Lojista  ·  **Fase:** 3  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Telas 3, 4 e 5

> Como lojista, quero cobrar R$ 8,00 a mais quando o cliente pede o verso da camisa, para não perder dinheiro no trabalho extra.

**Pré-condições**
- CAMISA ALGODÃO Básico 2 (PENTEADO), R$ 70,00, com verso habilitado.

**Passo a passo**
1. Estoque → CAMISA ALGODÃO Básico 2 → aba "Personalização".
2. Em "ÁREA DE IMPRESSÃO", confirme "Tem verso?" ligado; ligue "Cobrar pelo verso?" e preencha "Valor extra (R$)" = 8,00. Salve ("Salvar configuração").
3. Em "CAMPOS" → "O que o cliente preenche", confira um campo de texto "Nome a estampar" com "Max caracteres" = 20 e "Obrigatório" ligado, e o seletor "Lado:" em "Frente".
4. Abra a peça na vitrine, marque o verso, digite o nome e veja o preço.
5. Adicione à sacola e veja o total.

**Critérios de aceite — funciona**
- [ ] A vitrine mostra o adicional explicado ("+R$ 8,00 pelo verso" ou equivalente do mockup) e o total de **R$ 78,00** para 1 unidade.
- [ ] 3 unidades com verso = 3 × R$ 78,00 = **R$ 234,00** (o verso é por unidade, diferente da arte).
- [ ] O campo de texto recusa o 21º caractere e o obrigatório bloqueia "Adicionar à sacola" com a frase do "o que falta".
- [ ] Depois de salvar, "Ver como cliente" abre a peça na vitrine.

**Critérios de aceite — premium (UI/UX)**
- [ ] O valor salvo aparece no campo com vírgula ("8,00"), não "8" ou "8.5".
- [ ] "Somado ao preço quando o cliente marcar verso." aparece ao lado do valor.
- [ ] Na vitrine, números em Bricolage Grotesque e a troca Frente/Verso sem a prévia piscar.

**Casos de borda**
- [ ] "Cobrar pelo verso?" ligado com valor vazio: comportamento definido (sem cobrança, ou aviso "Configure o valor"); registrar.
- [ ] Meio: "Tem impressão no meio?" + "Cobrar pelo meio?" R$ 5,00 numa caneca: a vitrine mostra a opção de meio e soma R$ 5,00 por unidade.
- [ ] Tentar marcar lado "Verso" num campo sem verso habilitado: aviso "Habilite verso no topo".

---

### LJ-19 · Cobrar o serviço de arte uma vez por item e ler o briefing do cliente
**Persona:** Lojista  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 03-produto, Tela 3; 02-fechar-a-venda (pergunta 1, decidida: uma vez por item)

> Como lojista, quero cobrar R$ 25,00 para criar a arte, uma vez só mesmo que o cliente peça duas canecas iguais, para o preço ser justo e igual ao que eu combinei.

**Pré-condições**
- CANECA ALÇA CORAÇÃO com "SERVIÇO PREMIUM" ligado: "Ajustar a arte do cliente (R$)" = 10,00; "Criar a arte do zero (R$)" = 25,00.

**Passo a passo**
1. Leia o texto de ajuda do cartão "Vocês criam ou ajustam a arte?".
2. Na vitrine aura-qa (chave ligada), escolha "Criem a arte pra mim", escreva o briefing "Nome Helena em dourado, fundo floral", quantidade 2, adicione à sacola.
3. Adicione uma segunda linha da mesma caneca com "Envio minha arte e vocês ajustam", 1 unidade.
4. Veja a sacola e finalize com Pix (aura-qa).
5. Abra o pedido no painel (LJ-31).

**Critérios de aceite — funciona**
- [ ] A vitrine mostra os três caminhos com preço: "Vou enviar minha arte pronta" (sem custo), "Envio minha arte e vocês ajustam" (+R$ 10,00), "Criem a arte pra mim" (+R$ 25,00).
- [ ] Linha 1: 2 × R$ 49,90 + R$ 25,00 = **R$ 124,80** (não R$ 149,80). Linha 2: R$ 49,90 + R$ 10,00 = **R$ 59,90**. Subtotal **R$ 184,70**; Pix 10% R$ 18,47; total no Pix **R$ 166,23**.
- [ ] O valor que o servidor cobra é o mesmo que a sacola mostrou (sem erro 400/409 no pagamento).
- [ ] O briefing chega no pedido como "Briefing da arte" legível (LJ-31).

**Critérios de aceite — premium (UI/UX)**
- [ ] O painel diz claramente que o valor é "uma vez por item do pedido, não por unidade". Hoje o texto não diz: registrar P1 (a lojista pode achar que 50 canecas pagam 50 artes).
- [ ] O painel não mostra termo técnico ao lojista. Hoje a ajuda cita o campo "art_service_brief": registrar P2.
- [ ] Preço 0 no ajuste mantém o caminho visível como "sem custo" (regra "a gente ajusta por nossa conta").

**Casos de borda**
- [ ] **Chave desligada** (sheid-mania com `?v2=0`, só olhar a sacola, sem finalizar; ou aura-qa com a chave desligada pela equipe técnica): a sacola de hoje mostra o mesmo R$ 124,80? QA_NOTAS F2: o app precisa espelhar a regra do servidor ao mesmo tempo. Divergência aqui é P0 (o servidor cobra diferente da tela).
- [ ] 50 unidades com criação: R$ 25,00 uma vez, somado depois do desconto por quantidade (LJ-21).
- [ ] Cartão (só loja com Mercado Pago): a arte vira um item separado "Servico de arte — <produto>" de quantidade 1 na cobrança (acento ausente no nome do item: registrar P2).

**Pontos de atenção conhecidos**
- QA_NOTAS F2: regra "uma vez por linha" entrou com Aura-backend#751; conferir app e servidor juntos.

---

### LJ-20 · Oferecer artes prontas, guia de medidas, área de impressão e fotos
**Persona:** Lojista  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Telas 1, 3 e 8

> Como lojista, quero cadastrar fotos, artes prontas, a tabela de medidas e onde a arte cabe, para o cliente decidir sem me chamar no WhatsApp.

**Pré-condições**
- CAM. Algodão Fem. Baby look (R$ 60,00) e CANECA ALÇA CORAÇÃO na aura-qa; 5 fotos 1200×1200; um PDF de medidas; 2 artes na aba "Galeria".

**Passo a passo**
1. Aba "Galeria" (Loja Digital): leia "Galeria de Templates", toque em "Gerenciar galeria" e crie 2 artes ("Natal floral", "Dia dos Pais").
2. Estoque → Baby look → "Dados": suba 5 fotos e reordene para a foto de costas ser a segunda.
3. "Personalização" → "GUIA DE MEDIDAS": "Escolher arquivo" com o PDF.
4. "Personalização" → "ÁREA DE IMPRESSÃO": frente 20 × 25 cm.
5. Garanta um campo "Template" ("Cliente escolhe arte da galeria").
6. Abra a peça na vitrine no celular e no desktop.

**Critérios de aceite — funciona**
- [ ] A vitrine mostra as 5 fotos na ordem do painel (a primeira é a capa na grade).
- [ ] "Ver guia de medidas" abre o PDF; "Abrir" e "Remover" no painel funcionam.
- [ ] A área de impressão aparece nos detalhes da página com uma só fonte de verdade (a do cadastro, decisão 10 do PO): "20 × 25 cm".
- [ ] As artes da galeria aparecem como "arte pronta" escolhível; escolher uma satisfaz a origem da arte do lado.

**Critérios de aceite — premium (UI/UX)**
- [ ] Nome da galeria coerente entre painel ("Galeria de Templates") e vitrine ("artes prontas"): registrar se a lojista não reconhecer que é a mesma coisa.
- [ ] Fotos sem distorção (recorte, não esticado) na grade e no carrossel.
- [ ] Ícone de "Ver a peça de perto" não parece um círculo vazio (QA_NOTAS F1).

**Casos de borda**
- [ ] Produto sem foto: grade mostra a prévia/monograma, sem retângulo cinza vazio.
- [ ] PDF de 12 MB no guia: mensagem de limite clara.
- [ ] Galeria vazia: "Galeria vazia" com "Criar primeiro template".

---

### LJ-21 · Cadastrar desconto por quantidade com prazo por faixa
**Persona:** Lojista  ·  **Fase:** 3  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 03-produto, Tela 5 [3A]

> Como lojista, quero dar desconto a partir de 10 e de 50 canecas, com prazo maior para 50, para fechar pedido de empresa sem calcular na mão.

**Pré-condições**
- Configurações do Studio → "Motor de Precificação" → "Regras por Produto".

**Passo a passo**
1. Crie a regra da CANECA ALÇA CORAÇÃO com duas faixas em "Faixas de Tiragem": "De (qtd)" 10, "Até (qtd)" 49, "Multiplicador" 0,90, "Prazo desta tiragem (dias úteis)" 5; "De" 50, "Até" vazio, 0,80, prazo 8. Salve.
2. Na vitrine, abra a caneca: veja a régua de desconto.
3. Digite 10 na quantidade; depois 50.
4. Tente cadastrar uma faixa sobreposta (1 a 50 e 40 a 100).

**Critérios de aceite — funciona**
- [ ] 10 un: R$ 44,91 cada, total **R$ 449,10**, prazo 5 dias úteis. 50 un: R$ 39,92 cada, total **R$ 1.996,00**, prazo 8 dias úteis; no Pix 10% **R$ 1.796,40**.
- [ ] 9 un: sem desconto (R$ 49,90 cada, R$ 449,10) e prazo padrão de 3 dias úteis.
- [ ] Faixas sobrepostas bloqueiam o salvar com "Faixas sobrepostas: 1–50 e 40–100 se cruzam...".
- [ ] Multiplicador acima de 1 nunca encarece o preço na vitrine.

**Critérios de aceite — premium (UI/UX)**
- [ ] O rótulo diz sobre o que o multiplicador incide. Hoje "Multiplicador sobre o custo base", mas a vitrine aplica sobre o **preço de tabela**: registrar P1 (a lojista pode digitar 1,3 pensando em margem e ver o preço cheio).
- [ ] A lojista acha as faixas a partir da Loja Digital (hoje ficam em Configurações → Motor de Precificação, sem atalho no Configurador): registrar P2.
- [ ] Régua da vitrine ("Leve 50 e pague R$ 39,92 cada") em Bricolage Grotesque, sem gritar.

**Casos de borda**
- [ ] "Preço fechado por unidade (R$)" = 42,00 na faixa de 10: vitrine usa R$ 42,00.
- [ ] Faixa sem prazo: vale o prazo padrão da loja.
- [ ] Sacola com 6 CANECA ALÇA CORAÇÃO + 6 CANECA BRANCA: cada linha conta sozinha (a escada não soma peças diferentes; decisão do PO "regra atual do servidor").

---

## Épico 4 · Pedidos pela loja (aba nova)

### LJ-22 · Fechar e reabrir a loja para pedidos com um recado
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Telas 6 e 7

> Como lojista com a agenda cheia, quero fechar a loja para pedidos sem tirar a vitrine do ar, para continuar recebendo orçamentos sem aceitar o que eu não consigo produzir.

**Pré-condições**
- Desktop 1440 com a vitrine aura-qa aberta em outra aba; celular com a sacola da vitrine contendo 1 CANECA ALÇA CORAÇÃO e o checkout aberto na etapa de pagamento.

**Passo a passo**
1. Loja Digital → "Pedidos pela loja". Leia o cartão "TEMPORADA".
2. Toque no interruptor "Aceitando pedidos pela loja".
3. Observe o campo "Recado para o cliente" (vazio) e o contador; leia o texto de exemplo.
4. Cole o recado de 280 caracteres (Anexo A); depois acrescente um caractere.
5. Apague até ficar "Agenda cheia até 20/12. Peça um orçamento pelo WhatsApp." e toque em "Salvar alterações".
6. Recarregue a vitrine: home, produto, sacola. No celular, toque em "Fazer pedido" no checkout já aberto.
7. Reabra a loja e salve.

**Critérios de aceite — funciona**
- [ ] Ao desligar: título vira "Loja fechada para pedidos", subtítulo "A vitrine troca o botão de comprar por "Pedir orçamento" e mostra o recado abaixo.", selo "FECHADA" em vermelho suave.
- [ ] O recado vazio mostra como exemplo exatamente o texto que a cliente vai ler: "No momento a loja está fechada para pedidos novos. Você pode pedir um orçamento e a loja responde com prazo."
- [ ] Contador "280/280" no limite; com 281 fica vermelho, a mensagem "O recado pode ter até 280 caracteres." aparece e "Salvar alterações" fica desabilitado.
- [ ] A prévia ao vivo (direita no desktop, abaixo do cartão no celular) mostra a faixa com o recado e o botão "Pedir orçamento" com ícone do WhatsApp, na cor e fonte da loja, **antes** de salvar.
- [ ] Depois de salvar: "Salvo. A vitrine já mostra o que está aqui." e a vitrine recarregada mostra o recado em todas as telas e "Pedir orçamento" no lugar de comprar; a sacola e o checkout não deixam finalizar.
- [ ] O checkout que já estava aberto no celular recebe do servidor a recusa com o recado (409) e mostra a mensagem, sem criar pedido. Conferir no painel: nenhum pedido novo.
- [ ] Reabrir e salvar devolve "Adicionar à sacola" na vitrine.

**Critérios de aceite — premium (UI/UX)**
- [ ] Interruptor de 46 × 27 com alvo de 44 px; verde quando aberta, vermelho quando fechada; leitor de tela anuncia "Aceitando pedidos pela loja, ligado/desligado".
- [ ] O contador conta o texto sem espaços das pontas, igual ao servidor.
- [ ] Um só aviso de sucesso. Hoje aparecem dois (o aviso flutuante "Configurações salvas" e a frase ao lado do botão): registrar P2.
- [ ] Prévia com contraste AA com a cor `#1a1612` e com o amarelo `#F5D90A`.

**Casos de borda**
- [ ] Recado com quebra de linha: aparece na vitrine sem virar dois avisos.
- [ ] Salvar com o recado vazio: a vitrine usa o texto padrão (o mesmo do exemplo).
- [ ] Loja fechada com sacola cheia de uma cliente: a sacola explica e oferece "Pedir orçamento" com a lista (mockup 01, Tela 6).

**Pontos de atenção conhecidos**
- Texto conforme mockup (Tela 7): subtítulo aberto "A vitrine mostra o botão "Comprar agora" normalmente." no mockup x "A vitrine mostra o botão de comprar normalmente." no código; recado padrão "No momento a loja não está aceitando pedidos novos. Peça um orçamento..." no mockup x "No momento a loja está fechada para pedidos novos. Você pode pedir um orçamento..." no código. O PO decide qual fica.
- A prévia do código mostra nome da loja e um bloco cinza; a do mockup mostra também o slogan "Presentes que ninguém mais tem." (P2).
- QA_NOTAS F1C: `RECADO_PADRAO` e a regra da prévia são cópias à mão do servidor: qualquer diferença entre prévia e vitrine é achado P1.

---

### LJ-23 · Marcar "Aceitar pedidos até" e ver a loja fechar sozinha
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Telas 5 e 7

> Como lojista, quero dizer "aceito pedidos até 20/12", para a loja avisar o cliente nos últimos dias e fechar sozinha depois do Natal.

**Pré-condições**
- Loja aberta. Anote a data de hoje (exemplo: 25/09/2026).

**Passo a passo**
1. Em "Aceitar pedidos até", escolha 20/12/2026 no seletor de data. Leia a legenda da prévia.
2. Troque para hoje + 10 dias (05/10/2026). Leia a prévia; salve; recarregue a vitrine (home e produto).
3. Troque para amanhã (26/09) e depois para hoje (25/09); salve e veja a vitrine em cada uma.
4. Troque para ontem (24/09) e observe o selo e o interruptor.
5. Toque em "Limpar" e salve.

**Critérios de aceite — funciona**
- [ ] 20/12 (mais de 21 dias): legenda "O aviso aparece na vitrine a partir de 29/11. Depois de 20/12, a loja fecha para pedidos sozinha."; a vitrine ainda não mostra aviso.
- [ ] 05/10 (dentro de 21 dias): legenda "A vitrine já mostra este aviso..." e a vitrine mostra "Pedidos até 05/10 — depois disso, só orçamento." na home e no produto.
- [ ] Amanhã: "Amanhã é o último dia para pedir nesta temporada." Hoje: "Último dia para pedir com entrega nesta temporada." (tom mais forte que o âmbar comum).
- [ ] Ontem: prévia com "Os pedidos desta temporada já fecharam. Você pode pedir um orçamento para a próxima leva." e "Pedir orçamento"; legenda "A data limite já passou: a loja está fechada para pedidos. Tire a data ou escolha outra para reabrir."; o servidor recusa pedido novo.
- [ ] Com data marcada, o campo "Recado para o cliente" aparece com o exemplo da temporada.
- [ ] "Limpar" só aparece com data preenchida; depois de salvar, a vitrine não mostra aviso nenhum.

**Critérios de aceite — premium (UI/UX)**
- [ ] O seletor de data é o nativo (iPhone e Android) e, no painel escuro, o ícone do calendário continua visível.
- [ ] Com a data de ontem, o interruptor e o selo contam a mesma história. Hoje o interruptor continua "Aceitando pedidos pela loja" (verde) enquanto o selo diz "FECHADA": registrar P1 (a lojista não entende por que está fechada).
- [ ] Datas na vitrine em formato curto brasileiro (20/12), em Bricolage Grotesque.

**Casos de borda**
- [ ] Virada do dia: o servidor usa o horário de Brasília; a prévia usa o fuso do aparelho. Testar às 22h30 de Brasília num aparelho em fuso UTC: prévia e vitrine devem concordar (hoje podem divergir por um dia: registrar se acontecer).
- [ ] Loja fechada à mão E data futura: vale o fechado; ao reabrir, a data volta a valer.
- [ ] Digitar 30/02 no celular (campo de texto, quando não há seletor): recusa com "Data limite inválida. Use o formato AAAA-MM-DD."

**Pontos de atenção conhecidos**
- Mockup (Tela 7): "recado e data só aparecem fechada" e a dica "Some da vitrine sozinho quando passar a data."; código: data sempre visível, recado quando fechada ou com data, dica "Depois desta data a loja fecha para pedidos sozinha.". Registrar "texto conforme mockup" para o PO decidir.
- Pergunta do mockup 01: horário de corte do último dia (23h59 fixo?). Ver perguntas em aberto.

---

### LJ-24 · Ligar a medição (GA4 e Pixel) com validação ao digitar
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 7 (Medição)

> Como lojista, quero colar os códigos do Google e da Meta e saber na hora se colei certo, para não descobrir um mês depois que nada foi medido.

**Pré-condições**
- Aba "Pedidos pela loja", cartão "MEDIÇÃO".

**Passo a passo**
1. Em "Google Analytics", digite `g-8q3f` e depois complete `g-8q3fq2n1km`.
2. Em "Pixel da Meta", digite `12345`, depois `1234567890123456789`, depois `12a45`, depois um Pixel de 15 dígitos com espaços no meio.
3. Toque em "Salvar alterações".
4. Recarregue o painel.
5. Desligue a internet (modo avião no celular ou "Offline" no DevTools), altere o Pixel e tente salvar.

**Critérios de aceite — funciona**
- [ ] O GA4 vira maiúsculas ao digitar; incompleto mostra "Formato: G- seguido de 6 a 14 letras ou números" em vermelho; completo "Formato válido" em verde.
- [ ] Pixel: "Faltam dígitos — o Pixel da Meta tem 15 ou 16 números"; "Dígitos demais — ..."; "Só números — ..."; espaços são removidos ao digitar.
- [ ] Com erro, o salvar fica desabilitado e a frase ao lado diz "Confira o ID do Google Analytics." ou "Confira o ID do Pixel da Meta.".
- [ ] Depois de salvar e recarregar, os valores voltam normalizados (GA4 em maiúsculas).
- [ ] Sem internet: aparece o erro no bloco vermelho acima do botão em português, dizendo o que fazer ("Não foi possível salvar. Tente de novo."), e nada é salvo pela metade.

**Critérios de aceite — premium (UI/UX)**
- [ ] Vazio, cada campo explica onde achar o código: "Opcional. Começa com G- (em Administrador > Fluxos de dados)." e "Opcional. O número do Pixel no Gerenciador de Eventos.".
- [ ] Teclado numérico no Pixel (celular); sem correção automática no GA4.
- [ ] A mensagem de erro do servidor não aparece em inglês técnico ("Failed to fetch"): registrar se aparecer.

**Casos de borda**
- [ ] Apagar os dois campos e salvar: medição desligada, a vitrine não injeta os scripts nem mostra aviso de cookies (LJ-44).
- [ ] Trocar para outra aba com um ID digitado e não salvo: a edição se perde sem aviso (ver LJ-02).

---

### LJ-25 · Visão consolidada de várias empresas pede para escolher a loja
**Persona:** Lojista (dona de duas empresas)  ·  **Fase:** 1  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** —

> Como lojista com duas empresas no mesmo login, quero que o painel me diga de qual loja estou mexendo, para não fechar a loja errada.

**Pré-condições**
- Conta com duas empresas (a aura-qa e uma segunda de teste da Aura) e a visão consolidada disponível. Se a conta de teste não tiver duas empresas, pedir à equipe técnica.

**Passo a passo**
1. No seletor de empresas do topo, escolha a visão consolidada.
2. Abra Loja Digital → "Pedidos pela loja". Depois "Meu Site" e "Design".
3. Escolha a empresa B. Volte para "Pedidos pela loja" com uma alteração não salva feita antes na empresa A.
4. Na aba "Meu Site" da empresa A, troque para a empresa B (que você já tinha aberto antes nesta sessão) sem sair da aba.

**Critérios de aceite — funciona**
- [ ] Na visão consolidada, "Pedidos pela loja" mostra "Escolha uma empresa" e "Cada empresa tem a própria loja online. Troque para a empresa da loja no seletor do topo para fechar pedidos, marcar a data limite ou mudar a medição."
- [ ] Trocar de empresa recomeça o formulário de "Pedidos pela loja" do zero, com os dados da empresa nova (nada da A vaza para a B).
- [ ] "Meu Site" e "Design" também mostram os dados da empresa nova ao trocar. **Risco a confirmar:** "Meu Site" só relê os dados quando a loja muda de "não existe" para "existe"; se a empresa B já estava carregada na sessão, o formulário pode continuar com os dados da A e "Salvar configurações" gravaria os dados da A na B. P0 se reproduzir.

**Critérios de aceite — premium (UI/UX)**
- [ ] O nome da empresa ativa aparece perto do título da Loja Digital (hoje só no seletor do topo): registrar sugestão se a lojista se confundir.
- [ ] Estado "Escolha uma empresa" centralizado, com ícone e texto em até 3 linhas no celular.

**Casos de borda**
- [ ] Visão consolidada nas abas "Meu Site", "Design", "Entrega": hoje não há o mesmo cuidado. Registrar o que cada uma mostra (dados de qual empresa? erro?).
- [ ] Empresa B sem loja criada: formulário vazio, sem erro.

---

## Épico 5 · Entrega e retirada

### LJ-26 · Configurar o endereço e o prazo de retirada
**Persona:** Lojista  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 02-fechar-a-venda, Tela 3; 03-produto, Tela 6

> Como lojista, quero dizer onde e quando o cliente busca a encomenda, para ninguém chegar antes de estar pronto.

**Pré-condições**
- aura-qa sem endereço de retirada (estado base).

**Passo a passo**
1. Loja Digital → "Entrega". Com "Retirada no local" ligado, leia os campos.
2. Veja o bloco "Como aparece no checkout do cliente" com o endereço vazio.
3. Preencha "Endereço de retirada" = "Av Dom Pedro I, 553 - Jardim Colonial, Jacareí/SP" e "Tempo para ficar pronto" = "Pronta em 3 dias úteis após a aprovação da arte".
4. Espere "Salvando…" e abra o checkout e a página do produto na vitrine.
5. Desligue "Retirada no local" e observe a vitrine; religue.

**Critérios de aceite — funciona**
- [ ] O salvamento é automático e mostra "Salvando…".
- [ ] O checkout da vitrine mostra "Retirar na loja", o endereço e o prazo, com "Grátis".
- [ ] Desligada, aparece "Cliente não verá opção de retirar na loja." e o checkout não oferece retirada; o servidor recusa pedido com retirada ("Retirada nao disponivel nesta loja").
- [ ] A prévia "Como aparece no checkout do cliente" acompanha o que foi digitado.

**Critérios de aceite — premium (UI/UX)**
- [ ] O exemplo do prazo segue "prazo em dias úteis, nunca em horas" (JORNADA §3.4). Hoje o exemplo é "Ex: Em até 1 hora após confirmação" e a ajuda "Em 30 min": registrar P1 para o Studio.
- [ ] Sem emoji no painel. Hoje os títulos têm emoji de loja, moto, relógio, régua e dinheiro: registrar P2.
- [ ] Endereço vazio aparece no checkout como algo acionável (a vitrine não mostra "Endereço aparece aqui" para a cliente).

**Casos de borda**
- [ ] Texto livre estranho (a Sheid tem "5/20" cadastrado): como a vitrine mostra? Registrar com print da sheid-mania com `?v2=1` (só olhar).
- [ ] Retirada e entrega desligadas ao mesmo tempo: o checkout explica que não há como receber, e o painel avisa antes de salvar (registrar comportamento).

---

### LJ-27 · Cobrar entrega por taxa única ou por distância, com frete grátis acima de um valor
**Persona:** Lojista  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 02-fechar-a-venda, Tela 3; 03-produto, Tela 6

> Como lojista, quero cobrar R$ 10,00 de entrega na cidade e dar frete grátis acima de R$ 150,00, para o cliente saber o custo antes de pagar.

**Pré-condições**
- Ligar "Entrega a domicílio" na aura-qa (voltar a desligar no fim).

**Passo a passo**
1. Em "Modo de cobrança", escolha "Taxa única" e "Taxa de entrega" = 10,00.
2. "Frete grátis acima de" = 150,00. "Tempo estimado de entrega" = "1 dia útil depois de pronto".
3. Na vitrine, monte a sacola de 2 CANECA ALÇA CORAÇÃO (R$ 99,80), escolha entrega e veja o frete; aumente para 4 canecas (R$ 199,60).
4. Troque para "Por distância", "CEP de origem" = 12327-000, faixas: até 5 km R$ 10,00; até 10 km R$ 18,00; até 20 km R$ 28,00.
5. Na vitrine, informe CEPs a 3 km e a 15 km.

**Critérios de aceite — funciona**
- [ ] Taxa única: 2 canecas pagam R$ 10,00 de frete; total no Pix R$ 89,82 + R$ 10,00 = **R$ 99,82** (o desconto do Pix não incide no frete). 4 canecas: frete grátis.
- [ ] CEP geolocalizado mostra o selo "CEP geolocalizado"; CEP sem geolocalização mostra o aviso âmbar de que a cobrança cai em taxa única.
- [ ] Por distância: 3 km cobra R$ 10,00; 15 km cobra R$ 28,00. Acima de 20 km: registrar o que a vitrine faz (esperado: diz com clareza que não entrega naquele endereço e oferece a retirada).
- [ ] A 4ª faixa não pode ser criada ("Máximo de 3 faixas").

**Critérios de aceite — premium (UI/UX)**
- [ ] Valores com vírgula e prefixo "R$" separado; teclado decimal no celular.
- [ ] Os cartões "Taxa única" e "Por distância" empilham no celular estreito sem cortar a descrição.
- [ ] A frase de exemplo das faixas usa "R$ 10,00" com espaço (hoje monta "R$10,00": registrar P2).

**Casos de borda**
- [ ] Frete e troca de modo de entrega: com a chave desligada, trocar de "Entrega" para "Retirar" zera o frete? (QA_NOTAS F2: conferir chave desligada.)
- [ ] Faixa com km 0 ou vazio: não quebra a cotação.

---

### LJ-28 · Oferecer retirada por app e conferir quem vem buscar
**Persona:** Lojista e Atendente  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 3 (retirada por app, "informo depois")

> Como atendente, quero saber quem é o motorista do Uber que veio buscar a caneca, para não entregar a personalização de uma cliente para a pessoa errada.

**Pré-condições**
- Endereço de retirada preenchido (LJ-26).

**Passo a passo**
1. Em "Pedidos pela loja", ligue "Retirada por app de entrega" e salve.
2. Na vitrine, faça o pedido A escolhendo retirada por app com nome "Carlos Souza" e placa "ABC1D23"; pague com Pix de teste.
3. Faça o pedido B escolhendo "informo depois" (sem nome e placa).
4. Veja o sino do painel, o KDS ("Produção") e o detalhe de cada pedido.
5. Leve o pedido A até "Pronto" e abra o acompanhamento da cliente.

**Critérios de aceite — funciona**
- [ ] Com a chave desligada no painel, o checkout não oferece retirada por app; o servidor recusa ("Retirada por app nao disponivel nesta loja").
- [ ] O detalhe do pedido A mostra o modo "Retirada por app", o nome "Carlos Souza" e a placa "ABC1D23" em destaque. **Hoje o detalhe do pedido Studio não mostra modo de entrega, nome nem placa**: registrar P0.
- [ ] O pedido B mostra claramente "Portador: a informar pela cliente" e como a lojista recebe esse dado depois. **Hoje não existe esse campo nem caminho**: registrar P0 e levar à pergunta em aberto 5.
- [ ] Placa inválida no checkout ("ABC12") é recusada com "Placa invalida. Use o formato ABC1234 ou ABC1D23".

**Critérios de aceite — premium (UI/UX)**
- [ ] O acompanhamento de um pedido por app não diz "Qualquer pessoa pode buscar mostrando o número do pedido #N." (contradiz a proteção). QA_NOTAS F4: revisar texto; registrar P1 se continuar.
- [ ] O aviso "Retirada por portador" do sino diz nome e placa, na voz do Studio.

**Casos de borda**
- [ ] Retirada por app ligada com "Retirada no local" desligada: o que o checkout oferece? (registrar).
- [ ] Nome com 121 caracteres: recusa "Nome do entregador muito longo".

**Pontos de atenção conhecidos**
- O aviso "Retirada por portador" (evento de sino) é disparado pela loja comum; o pedido do Studio só dispara "Pedido novo". Conferir se o sino avisa o portador no Studio.

---

## Épico 6 · Receber e operar o pedido

### LJ-29 · Ficar sabendo na hora que chegou pedido
**Persona:** Lojista e Atendente  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** —

> Como lojista, quero ser avisada no computador e no celular quando entra pedido, para responder a cliente enquanto ela ainda está animada.

**Pré-condições**
- Painel aberto no Chrome do desktop; outro navegador com o painel fechado; iPhone com o painel adicionado à Tela de Início.

**Passo a passo**
1. Abra o sino → engrenagem (preferências). Em "Neste navegador", toque em "Ativar aviso" e aceite a permissão do navegador. Toque em "Enviar teste".
2. Feche a aba do painel. Na vitrine aura-qa, faça um pedido Pix de 2 CANECA ALÇA CORAÇÃO.
3. Observe o aviso do sistema; toque nele.
4. Abra o sino e leia o aviso "Pedido novo".
5. No iPhone, repita com o painel da Tela de Início.

**Critérios de aceite — funciona**
- [ ] "Enviar teste" mostra "Aviso de teste enviado. Deve aparecer em alguns segundos." e o aviso chega.
- [ ] Pedido novo gera aviso do navegador em até 1 minuto, com a aba fechada, texto "Pedido novo #N" e "R$ 89,82 — <nome>. Toque para ver o pedido."
- [ ] Tocar no aviso abre `/studio/pedidos/<id>` (o detalhe do Studio), não a tela da loja comum.
- [ ] O sino mostra o mesmo aviso, marcado como não lido, e agrupa avisos do mesmo pedido.
- [ ] Os estados do interruptor são claros: "Ativo...", "Receba o aviso de pedido no computador...", "Bloqueado neste navegador...", "Este navegador não recebe o aviso. No iPhone, adicione o painel à Tela de Início e abra por lá."

**Critérios de aceite — premium (UI/UX)**
- [ ] Textos do aviso na voz do Studio. Hoje "Pagamento confirmado ... Pode separar a mercadoria." (vocabulário de varejo): registrar P2.
- [ ] Preferências com linha inteira tocável (56 px); "Comprovante para conferir" aparece com o selo "FIXO".

**Casos de borda**
- [ ] Permissão negada no navegador: estado "Bloqueado" com instrução para liberar.
- [ ] Loja de teste: e-mail ao dono e push do app **não** saem (bloqueio da aura-qa); sino e aviso do navegador saem. Ver LJ-46.
- [ ] "Loja sem forma de pagamento" leva a "/canal" e fala em "Canal Digital", que a conta Studio não abre: registrar P1 (simular desligando Pix e tentando fechar pedido na aura-qa, e religar).

**Pontos de atenção conhecidos**
- O e-mail "pedido aguardando Pix" ao dono só sai para Pix por chave da lojista (modo manual). Na aura-qa o Pix é de teste, então esse e-mail não pode ser verificado lá. Ver pergunta em aberto 2.

---

### LJ-30 · Achar o pedido certo na fila e no quadro de produção
**Persona:** Atendente  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** —

> Como atendente, quero achar o pedido da Helena pelo nome ou pelo número que ela me mandou, para responder sem rolar a lista inteira.

**Pré-condições**
- Pelo menos 6 pedidos de teste na aura-qa, em etapas diferentes, um deles de "Helena Teste".

**Passo a passo**
1. Abra Pedidos (hub): veja os números do topo, os alertas e as abas "Tudo", "Pedidos", "Eventos", "A receber".
2. Procure o pedido da Helena pelo nome e pelo número que aparece na confirmação da cliente (#N).
3. Abra Produção (quadro com colunas) e ache o mesmo pedido.
4. Na aba "Pedidos" da Loja Digital, veja o resumo e o atalho para o hub.

**Critérios de aceite — funciona**
- [ ] Existe busca por nome, telefone e número do pedido. **Hoje o hub não tem busca**: registrar P1.
- [ ] A etapa de cada pedido aparece em português ("Aguardando arte", "Em produção"...). **Hoje a lista do hub mostra o código cru em inglês (ex.: "pending_art")**: registrar P1.
- [ ] O número do pedido no painel é o mesmo que a cliente tem na confirmação. **Hoje o quadro de Produção mostra "#" + 8 letras do identificador interno (ex.: "#3F9A2C1B")**, diferente do número da cliente: registrar P1.
- [ ] O quadro de Produção mostra a miniatura da arte (ou o monograma quando não há imagem) em cada cartão.
- [ ] O pedido Pix ainda não pago é distinguível de um pago (hoje nenhum dos dois lugares mostra a situação do pagamento: ver LJ-33).

**Critérios de aceite — premium (UI/UX)**
- [ ] Valores com vírgula ("R$ 89,82"). Hoje o quadro mostra "R$ 89.82": registrar P1.
- [ ] "1 item" / "2 itens" sem "item(ns)".
- [ ] No celular, colunas do quadro roláveis e cartões com alvo de 44 px nos botões "Solicitar aprovação" e de avanço.

**Casos de borda**
- [ ] Nenhum pedido: "Nenhum pedido no período" com "Configurar Loja Digital".
- [ ] Erro de rede: "Não deu pra carregar o Hub" com "Tentar de novo".
- [ ] Imagem da arte quebrada: cai no monograma sem ícone quebrado.

---

### LJ-31 · Ler a personalização de cada item sem adivinhar
**Persona:** Atendente  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** —

> Como atendente, quero ver em português o texto, a cor da arte, o serviço contratado, o briefing, o verso e o arquivo de cada item, para produzir certo de primeira.

**Pré-condições**
- Pedido da LJ-19 (duas linhas, criação com briefing e ajuste) e um pedido de CAMISA ALGODÃO Básico 2 com verso, texto "HELENA" em dourado e foto enviada (PNG 3 MB).

**Passo a passo**
1. Abra o detalhe do pedido pelo hub ou pelo aviso.
2. Leia "ITENS DO PEDIDO" e o bloco "Personalização" de cada item.
3. Toque em "Ver dados brutos" e depois "Ocultar dados brutos".
4. Toque no arquivo enviado.

**Critérios de aceite — funciona**
- [ ] Cada item mostra nome, quantidade, preço unitário e o total da linha; a linha com criação de arte mostra "Criação da arte R$ 25,00" separada, e a soma das linhas bate com o total do cabeçalho. **Hoje só aparece "2 × R$ 49.90" sem a arte**: registrar P1.
- [ ] Campos com o rótulo que a lojista escreveu ("Nome a estampar: HELENA").
- [ ] Cor da arte aparece como "Cor da arte — Nome a estampar" com a bolinha da cor.
- [ ] Serviço de arte aparece como "Criem a arte pra mim" / "Envio minha arte e vocês ajustam". **Registrar se aparecer o código ("designer", "adjust").**
- [ ] Briefing aparece como "Briefing da arte: Nome Helena em dourado, fundo floral", inteiro.
- [ ] Verso: "Personalizar o verso: Sim" e os campos do verso com rótulo legível. **Registrar se aparecerem chaves cruas terminadas em "_back".**
- [ ] O arquivo enviado aparece como miniatura ou link "Abrir arquivo" que abre a imagem original. **Registrar se aparecer só o endereço em texto cortado em 2 linhas.**
- [ ] A prévia da personalização (160 px) aparece acima da lista.

**Critérios de aceite — premium (UI/UX)**
- [ ] Hierarquia: nome do produto em destaque, personalização em bloco recuado, dados brutos escondidos por padrão.
- [ ] Nada de JSON à vista sem pedir.

**Casos de borda**
- [ ] Texto com emoji ou acento ("Mãe" seguido de um emoji de coração) chega igual.
- [ ] Arte pronta da galeria: aparece o nome da arte, não o identificador.
- [ ] Produto apagado depois do pedido: o item continua legível pelo nome gravado.

---

### LJ-32 · Ver pagamento, entrega e CPF/CNPJ na nota no detalhe do pedido
**Persona:** Lojista  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Telas 2 a 4

> Como lojista, quero ver como o cliente pagou, como vai receber e se pediu nota com CPF/CNPJ, para não esquecer a nota da empresa nem entregar do jeito errado.

**Pré-condições**
- Pedido de teste com "Quero CPF/CNPJ na nota" marcado e CNPJ válido de teste; retirada na loja; Pix.

**Passo a passo**
1. Abra o detalhe do pedido.
2. Procure forma de pagamento, situação do pagamento, modo de entrega, endereço e CPF/CNPJ.
3. Tente o checkout com CNPJ inválido (dígito errado).

**Critérios de aceite — funciona**
- [ ] O detalhe mostra: "Pix · aguardando pagamento" (ou "pago"), "Retirada na loja", e "CPF/CNPJ na nota: 12.345.678/0001-95" (formatado). **Hoje o detalhe do Studio mostra só cliente, telefone, itens, histórico de aprovação e sinal**: registrar P0 (a nota com CNPJ do comprador corporativo se perde).
- [ ] CNPJ inválido é recusado no checkout ("CPF/CNPJ invalido") antes de criar pedido.
- [ ] Pedido com nota pedida e emissão falhando gera aviso "NFC-e não saiu no pedido #N".

**Critérios de aceite — premium (UI/UX)**
- [ ] Bloco "Pagamento e entrega" com rótulo em cima e valor embaixo, mesma linguagem da cliente.
- [ ] Telefone da cliente abre o WhatsApp (já existe) e tem alvo de 44 px.

**Casos de borda**
- [ ] QA_NOTAS F2: `request_nfce` com CPF tem o mesmo comportamento da loja comum (só registra o pedido de nota): conferir que a lojista sabe que precisa emitir.
- [ ] Origem Aurinha no mesmo bloco (ver LJ-45).

---

### LJ-33 · Confirmar o Pix por chave e conferir o comprovante
**Persona:** Lojista  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 02-fechar-a-venda, Tela 5 ("Anexar comprovante", "Já paguei", "Pagamento recebido")

> Como lojista que recebe Pix na minha chave, quero ver o comprovante que a cliente mandou e confirmar o pagamento, para a cliente ver "Pagamento recebido" e a produção começar.

**Pré-condições**
- aura-qa; pedido Pix de teste com "Anexar comprovante" (imagem) e "Já paguei" feitos pela cliente (frente Cliente).
- A Sheid e a aura-qa só têm Pix por chave: toda venda real depende desta história.

**Passo a passo**
1. Veja o aviso "Comprovante para conferir" no sino e no navegador; toque em "Conferir".
2. No detalhe do pedido, procure o comprovante e o botão de confirmar pagamento.
3. Confirme o pagamento.
4. Na tela da cliente (confirmação por token), observe a mudança de estado sem tocar na tela.
5. Faça outro pedido e recuse o comprovante (se houver a ação).

**Critérios de aceite — funciona**
- [ ] O aviso leva a uma tela onde o comprovante aparece em miniatura e abre em tamanho real.
- [ ] Existe o botão para confirmar o recebimento (texto de referência da loja comum: "Confirmar pagamento recebido") com confirmação antes de gravar.
- [ ] Depois de confirmar: o pedido vira pago, a tela da cliente troca para "Pagamento recebido" em até 4 s (consulta automática), o e-mail de confirmação sai (menos na aura-qa) e o aviso "Pagamento confirmado" aparece no sino.
- [ ] **Hoje o painel Studio não tem essa tela**: o aviso "Conferir" abre `/studio/pedidos/<id>`, que não mostra comprovante nem botão de confirmar; a ação existe só na tela "Canal Digital" da loja comum, que redireciona a conta Studio para o Studio. Se reproduzir, registrar **P0** (o pedido fica "aguardando pagamento" para sempre para a cliente).

**Critérios de aceite — premium (UI/UX)**
- [ ] O comprovante e a ação ficam no topo do pedido enquanto o pagamento está pendente, com cor de atenção (âmbar), não perdidos no fim da tela.
- [ ] O botão diz o que acontece ("Confirmar Pix de R$ 89,82") e há como desfazer ou cancelar antes de gravar.

**Casos de borda**
- [ ] Cliente anexa comprovante sem tocar em "Já paguei": o pedido continua fora do cancelamento automático (LJ-34) e aparece para conferir.
- [ ] Comprovante em PDF: abre.
- [ ] O botão "Registrar Pix recebido" que já existe no detalhe é do **sinal** de encomenda (marcos de pagamento), não do Pix da vitrine. Conferir que a lojista não confunde os dois.

---

### LJ-34 · Ver o Pix vencido cancelar sozinho em 72 horas, e só quando deve
**Persona:** Lojista  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 02-fechar-a-venda, Tela 5 (prazo de 72 h)

> Como lojista, quero que pedido de Pix não pago em 3 dias seja cancelado sozinho, para a fila de produção não ficar com pedido abandonado, mas sem cancelar o que eu já combinei com a cliente.

**Pré-condições**
- Quatro pedidos Pix de teste na aura-qa criados há mais de 72 h (criar numa segunda e conferir na quinta, ou pedir à equipe técnica para "envelhecer" os pedidos da aura-qa):
  - A: sem nada feito;
  - B: com comprovante anexado;
  - C: com "Já paguei" (aguardando aprovação);
  - D: sem pagamento, mas a lojista avançou a produção para "Aprovado".

**Passo a passo**
1. Espere até 10 minutos depois das 72 h (a varredura roda a cada 10 min).
2. Confira cada pedido no hub, na produção e na tela da cliente.
3. Leia o aviso do sino.

**Critérios de aceite — funciona**
- [ ] A é cancelado, sai da fila de produção e a tela da cliente mostra o Pix como expirado/cancelado com caminho de falar com a loja.
- [ ] B, C e D **não** são cancelados.
- [ ] O sino avisa "Pix expirado #N" uma única vez por pedido, com o texto do cancelamento: "O Pix de R$ 89,82 de <nome> não foi pago em 72 h e o pedido foi cancelado automaticamente. Se ainda quiser a venda, chame o cliente."
- [ ] Pedido com menos de 72 h continua pendente.

**Critérios de aceite — premium (UI/UX)**
- [ ] O pedido cancelado mostra o motivo no painel ("Cancelado automaticamente: Pix sem pagamento em 72 h"), não só "Cancelado".
- [ ] Nenhum aviso duplicado no sino nem no navegador.

**Casos de borda**
- [ ] Na aura-qa o Pix de teste tem validade gravada de 72 h. Por isso o aviso que chega costuma ser o de "venceu... Chame o cliente enquanto a venda é recuperável" (enviado antes do cancelamento no mesmo ciclo), e o texto "cancelado automaticamente" fica suprimido pela regra de um aviso por pedido. Registrar P1: a lojista lê "recuperável" para um pedido já cancelado.
- [ ] Pix por chave real (Sheid) não tem validade gravada: ali deve chegar o texto de cancelamento. Verificar só por leitura de pedido real antigo, nunca criando pedido na sheid-mania.
- [ ] QA_NOTAS F2: Pix do Asaas guardado com validade de 30 min enquanto a tela mostra 72 h (lojas com Asaas legado).

---

### LJ-35 · Não receber pedido duplicado e entender o pedido de cartão
**Persona:** Lojista  ·  **Fase:** 2  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Telas 6 e 8

> Como lojista, quero receber um pedido só quando a cliente toca duas vezes ou volta pelo histórico, para não cobrar duas vezes o mesmo presente.

**Pré-condições**
- aura-qa; celular com rede lenta ("Slow 3G").

**Passo a passo**
1. Na vitrine, no último passo, toque duas vezes rápido em pagar com Pix.
2. Volte pelo histórico até o checkout e tente enviar de novo; escolha o que a tela da Fase 2 oferecer (continuar o pedido anterior ou "Fazer um novo").
3. Abra duas abas com a mesma sacola e finalize nas duas.
4. Conte os pedidos no painel.

**Critérios de aceite — funciona**
- [ ] Toque duplo e volta pelo histórico geram **um** pedido no painel.
- [ ] "Fazer um novo" gera um segundo pedido de propósito, e o primeiro segue a regra de 72 h (ver pergunta 5 do mockup 02).
- [ ] Duas abas: registrar quantos pedidos entram (esperado: a segunda aba avisa do pedido já feito).

**Critérios de aceite — premium (UI/UX)**
- [ ] No painel, dois pedidos iguais da mesma cliente em minutos ficam visíveis como possível duplicado (sugestão; hoje não há marca).

**Casos de borda**
- [ ] **Cartão:** aura-qa e Sheid não têm Mercado Pago, então não há pedido de cartão para testar. Bloqueado: pedir à equipe técnica uma loja de teste com MP em modo teste, ou marcar "não testável" (ver pergunta em aberto 3). Quando houver: o pedido de cartão aprovado chega pago; o recusado não entra na produção; QA_NOTAS F2: a preferência do cartão vai sem o frete.

---
## Épico 7 · Arte e aprovação

### LJ-36 · Gerar e enviar o link de aprovação da arte
**Persona:** Atendente  ·  **Fase:** 4  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 04-pos-compra, Tela 1

> Como atendente, quero mandar o mockup para a cliente aprovar pelo WhatsApp com um link da própria loja, para ela aprovar sem estranhar uma página de outra empresa.

**Pré-condições**
- Pedido de teste na coluna "Aguardando arte" da Produção; telefone da cliente = celular do testador.
- Uma imagem de mockup (PNG) e, se houver, o render do motor visual.

**Passo a passo**
1. Em Produção, no cartão do pedido, toque em "Solicitar aprovação".
2. Passo "Mockup": em "Qual mockup vai enviar?", use "Gerar do pedido (motor visual)" ou "Subir do dispositivo"; confira "Prévia do que o cliente vai ver". Toque em "Continuar".
3. Passo "Confirmar e enviar": confira "Telefone do cliente (com DDD)", deixe "Mensagem (opcional)" em branco e toque em "Gerar link e abrir WhatsApp".
4. No WhatsApp aberto, leia a mensagem e envie para você mesmo. Volte ao painel e toque em "Já enviei — concluir".
5. Abra o link recebido no celular.

**Critérios de aceite — funciona**
- [ ] Com a chave ligada (aura-qa), o link é `loja.getaura.com.br/aura-qa/aprovacao/<token>` e abre a página com logo, cor e fonte da loja.
- [ ] Com a chave desligada, o link é o endereço do app (`/aprovacao/<token>`) e continua funcionando (testar com a chave desligada na aura-qa pela equipe técnica, LJ-47).
- [ ] O cartão ganha o selo "Aprovação enviada" e o hub mostra o alerta "Aprovação pendente há Nh" enquanto a cliente não responde.
- [ ] O aviso de sucesso só aparece depois de "Já enviei — concluir"; antes aparece "Mensagem pronta no WhatsApp que abriu. Confirme por lá e depois clique em "Já enviei"."
- [ ] "Ver link e mensagem" mostra o link e o texto; "Abrir WhatsApp de novo" reabre.
- [ ] Fechar o modal no meio e reabrir recupera o rascunho (mockup, telefone, mensagem).

**Critérios de aceite — premium (UI/UX)**
- [ ] A mensagem padrão tem a voz da loja, sem emoji e sem prometer prazo em horas. Hoje: "Oi <nome>! Sua arte do pedido ficou pronta (emoji de paleta) ... _<loja> · respondemos em até 1h_": registrar P1 (emoji e "1h" contrariam a JORNADA §3).
- [ ] O aviso final não tem emoji. Hoje "Aprovação solicitada! Aguarde resposta do cliente." precedido de emoji de brilho: registrar P2.
- [ ] O título do modal usa o número do pedido que a cliente conhece (hoje "#" + 8 letras do identificador).

**Casos de borda**
- [ ] Telefone inválido: "Link wa.me não pôde ser gerado — telefone inválido".
- [ ] Link colado sem "https://": o botão "Continuar" não habilita.
- [ ] Vídeo turntable como mockup: a cliente vê o vídeo girando.
- [ ] Link com mais de 7 dias: a cliente vê "Link expirado — peça pro lojista enviar um novo" com o WhatsApp da loja (mockup 04, Tela 7).

**Pontos de atenção conhecidos**
- QA_NOTAS F4: um link por mockup (sem "item 1 de 2"); pedido com duas peças exige dois envios.
- A loja de teste NÃO bloqueia este envio: é a lojista quem abre o WhatsApp. Sempre use o próprio número.

---

### LJ-37 · Receber "Aprovar" e "Pedir ajuste" com referência
**Persona:** Atendente  ·  **Fase:** 4  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 04-pos-compra, Telas 2 e 3

> Como atendente, quero saber na hora quando a cliente aprovou ou pediu ajuste, e ver a referência que ela mandou, para produzir ou refazer sem perguntar de novo.

**Pré-condições**
- Dois pedidos com link enviado (LJ-36): X e Y.

**Passo a passo**
1. No celular (cliente), no pedido X, toque em "Aprovar".
2. No pedido Y, toque em "Pedir ajuste", escreva "Trocar a fonte por uma mais redonda", anexe uma imagem de referência e envie.
3. No painel, observe o sino, o quadro de Produção e o detalhe de cada pedido ("HISTÓRICO DE APROVAÇÃO").
4. No pedido Y, mande um link novo com a arte corrigida.

**Critérios de aceite — funciona**
- [ ] X vai sozinho para a coluna "Aprovado"; o histórico mostra "Aprovado" com data e hora.
- [ ] Y continua em "Aguardando arte"; o histórico mostra o pedido de ajuste com o texto da cliente e a referência.
- [ ] A referência abre com um toque (imagem ou link). **Hoje chega como texto "Referência: https://..." dentro da nota, sem link**: registrar P1.
- [ ] A lojista recebe aviso no sino e no navegador para "Aprovou" e "Pediu ajuste". **Hoje nenhuma das duas respostas gera aviso**, embora a página da cliente diga "A loja já foi notificada": registrar P0 (a cliente espera e ninguém sabe).
- [ ] Responder duas vezes o mesmo link é recusado ("Esta aprovação já foi respondida").

**Critérios de aceite — premium (UI/UX)**
- [ ] Histórico em ordem clara (mais recente em cima), com rótulos em português e sem cortar a nota.
- [ ] O cartão do quadro indica "Ajuste pedido" de forma diferente de "Aprovação enviada".

**Casos de borda**
- [ ] Nota de 1.000 caracteres com referência: a referência nunca é cortada.
- [ ] Referência com endereço `http://` (sem s): é ignorada; conferir que a cliente é avisada.
- [ ] A mensagem de sucesso da cliente tem emoji (emoji de festa antes de "Aprovado! ...") vinda do servidor: registrar P2 (frente Cliente também verifica).

---

### LJ-38 · Controlar revisões inclusas, usadas e extra
**Persona:** Lojista  ·  **Fase:** 4  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 04-pos-compra, Tela 2 (aviso de cobrança)

> Como lojista, quero incluir 2 revisões no preço e cobrar R$ 10,00 a partir da terceira, para a cliente saber antes de pedir mais um ajuste.

**Pré-condições**
- Aba "Revisões". Estado base da aura-qa: inclusas 0, extra R$ 0,00.

**Passo a passo**
1. Leia a aba com o estado base (0 revisões). Leia a dica sobre o 0.
2. Num pedido com link de aprovação, na tela da cliente, toque em "Pedir ajuste" e leia o aviso.
3. Configure "Quantas revisões grátis incluídas no preço?" = 2 e "Preço por revisão extra" = 10,00; salve.
4. No mesmo pedido, peça ajuste 1, mande link novo, peça ajuste 2, mande link novo, e abra o "Pedir ajuste" pela terceira vez.
5. Volte ao estado base.

**Critérios de aceite — funciona**
- [ ] Com 0, o painel diz "Digite 0 pra liberar revisões ilimitadas (sem cobrança extra)." e a página da cliente **não** fala em cobrança. **Hoje a página da cliente trata 0 como "nenhuma inclusa" e mostra "Esta seria a 1ª revisão. A loja confirma com você antes de cobrar." e "As revisões inclusas deste pedido já foram usadas..."**: registrar P0 (aura-qa e Sheid estão com 0).
- [ ] Com 2 e R$ 10,00: 1º ajuste "Ajuste incluso — você ainda vai ter 1 revisão grátis depois deste."; 2º "Ajuste incluso — é a última revisão grátis deste pedido."; 3º "Esta seria a 3ª revisão: R$ 10,00. A loja confirma com você antes de cobrar."
- [ ] O painel mostra, no pedido, quantas revisões foram usadas e se a próxima é cobrada (hoje não mostra: registrar P1).
- [ ] "Como o cliente vai ver no checkout" na aba Revisões bate com o texto da vitrine.

**Critérios de aceite — premium (UI/UX)**
- [ ] Aviso de sucesso sem símbolo decorativo (hoje "Política de revisões salva" vem precedido de um sinal de visto).
- [ ] Valor da revisão em Bricolage Grotesque na vitrine.

**Casos de borda**
- [ ] Falha ao carregar a política: "Não consegui carregar a política atual" com "Tentar de novo", e o salvar bloqueado.
- [ ] Preço negativo: "Preço de revisão extra não pode ser negativo".

---

### LJ-39 · Fazer a triagem da arte que a cliente enviou
**Persona:** Atendente  ·  **Fase:** 3  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 03-produto, Tela 3 (aviso de baixa resolução, triagem como processo)

> Como atendente, quero ver as artes enviadas pelas clientes que precisam de olhar (baixa resolução, formato estranho) e decidir se ajusto por conta ou cobro, para não descobrir o problema na hora de imprimir.

**Pré-condições**
- Pedido de teste com "Vou enviar minha arte pronta" e um JPG de 300 × 300 px (a vitrine avisa baixa resolução sem bloquear).

**Passo a passo**
1. Procure no painel uma fila de "artes para conferir" (Produção, Pedidos, detalhe do pedido).
2. Abra o item e decida: aceitar, ajustar ou devolver.

**Critérios de aceite — funciona**
- [ ] Existe uma tela ou filtro com os itens com arte pendente de conferência (estados do servidor: pendente, aceita, ajustando, devolvida).
- [ ] **Hoje o servidor tem a fila (triagem S5), mas o painel não tem tela para ela**: registrar P1 como "a confirmar com o PO" (DEC-11 diz que a triagem é parte do processo, não um portão).
- [ ] O pedido segue o fluxo normal enquanto a arte está em triagem (sem estado novo, sem prazo suspenso).

**Critérios de aceite — premium (UI/UX)**
- [ ] Quando existir: a arte aparece grande, com as medidas em pixels e o aviso de resolução, e as ações dizem o que acontece com a cliente.

**Casos de borda**
- [ ] PDF enviado pela cliente: aparece com ícone de documento e abre.

---

## Épico 8 · Produção, pronto e entrega

### LJ-40 · Avançar as etapas e saber o que a cliente passa a ver
**Persona:** Atendente  ·  **Fase:** 4  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** 04-pos-compra, Tela 4

> Como atendente, quero avançar o pedido pelas etapas e ter certeza de que a cliente vê o andamento certo, para ela não me perguntar "e aí?".

**Pré-condições**
- Pedido pago de teste em "Aguardando arte"; link de acompanhamento da cliente aberto no celular.

**Passo a passo**
1. Em Produção, use os botões dos cartões: "Marcar como aprovado", "Iniciar produção", "Marcar como pronto", "Marcar como entregue". Depois de cada um, recarregue o acompanhamento da cliente.
2. No desktop, arraste um cartão de "Aprovado" para "Em produção".
3. No detalhe do pedido, use o botão "Avançar pra "<próxima etapa>"".
4. Com "Exigir sinal pago para iniciar produção" ligado em Configurações, num pedido que tenha sinal cadastrado e não pago, tente "Iniciar produção" (registrar também o que acontece num pedido da vitrine sem sinal cadastrado).

**Critérios de aceite — funciona**
- [ ] Mapa do que a cliente vê: "Aguardando arte" = "Criando a arte"; "Aprovado" e "Em produção" = "Em produção"; "Pronto" = "Pronto" (ou "Pronto para retirar"); "Entregue" = "Entregue", com a etapa atual destacada.
- [ ] Arrastar e soltar tem o mesmo efeito dos botões e o cartão não volta sozinho.
- [ ] Sem sinal: aparece "Sinal não recebido" com "Iniciar mesmo assim"; confirmar avança.
- [ ] Erro do servidor ao avançar aparece como "Não foi possível avançar o pedido" com o motivo.

**Critérios de aceite — premium (UI/UX)**
- [ ] A etapa atual do acompanhamento não parece "não alcançada" (QA_NOTAS F4: "Pronto para retirar" desenhado com círculo vazio).
- [ ] Nada de horário previsto na tela da cliente; prazo em dias úteis.
- [ ] Botões do cartão com rótulo completo no celular e a seta sem cortar.

**Casos de borda**
- [ ] A cliente não recebe e-mail a cada etapa do Studio (os e-mails de etapa são da loja comum): registrar e levar à pergunta em aberto 6.
- [ ] Pedido Pix ainda não pago avançado para "Aprovado": sai do cancelamento automático (LJ-34, caso D). Conferir que a lojista entende essa consequência.

---

### LJ-41 · Marcar pronto e entregar com conferência na retirada
**Persona:** Atendente  ·  **Fase:** 4  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 04-pos-compra, Tela 4

> Como atendente, quero entregar a encomenda para a pessoa certa, para não passar o presente de uma cliente para outra.

**Pré-condições**
- Dois pedidos prontos: um com retirada na loja, outro com retirada por app com nome e placa (LJ-28).

**Passo a passo**
1. Marque os dois como "Pronto". Abra o acompanhamento de cada um no celular da cliente.
2. No balcão, simule a chegada de um motorista: procure no painel o nome e a placa.
3. Marque como "Entregue".

**Critérios de aceite — funciona**
- [ ] O acompanhamento da retirada na loja mostra "Pronto para retirar." e o endereço de retirada.
- [ ] O acompanhamento da retirada por app mostra quem vai buscar e que a loja confere nome e placa.
- [ ] O painel mostra nome e placa no pedido na hora da entrega (hoje não mostra: ver LJ-28).
- [ ] Depois de "Entregue", a cliente vê "Entregue com carinho." e o bloco "Gostou? Peça outra igual".

**Critérios de aceite — premium (UI/UX)**
- [ ] O texto de retirada não diz "Qualquer pessoa pode buscar mostrando o número do pedido #N." quando a loja confere portador, e não incentiva a entrega sem conferência. QA_NOTAS F4: revisar; registrar P1 se continuar.

**Casos de borda**
- [ ] Pedido com entrega a domicílio pronto: "Sua encomenda está pronta." e "A loja fala com você para combinar a entrega.".

---

### LJ-42 · Receber o "Pedir outro igual" como pedido novo
**Persona:** Lojista  ·  **Fase:** 4  ·  **Prioridade:** P1  ·  **Chave:** v2 ligada  ·  **Mockup:** 04-pos-compra, Tela 5

> Como lojista, quero que o pedido repetido chegue com a mesma personalização do anterior, para produzir igual sem pedir tudo de novo à cliente.

**Pré-condições**
- Pedido entregue (LJ-41) de 2 CANECA ALÇA CORAÇÃO com texto e cor.

**Passo a passo**
1. No acompanhamento da cliente, toque em "Pedir outro igual"; finalize com Pix de teste.
2. No painel, abra o pedido novo e compare com o original.

**Critérios de aceite — funciona**
- [ ] O pedido novo chega como pedido comum (aviso "Pedido novo", fila, produção desde "Aguardando arte").
- [ ] Personalização idêntica (texto, cor, lado, arte); preço recalculado com os preços de hoje.
- [ ] Se a peça saiu da loja, a cliente vê o aviso âmbar de indisponível e nenhum pedido é criado.
- [ ] O painel indica que é repetição do pedido #N (hoje não indica: registrar P2; a métrica da Fase 4 "pedidos repetidos" depende disso, ver pergunta em aberto 9).

**Critérios de aceite — premium (UI/UX)**
- [ ] A arte enviada no pedido original aparece no novo sem pedir reenvio.

**Casos de borda**
- [ ] QA_NOTAS F4: a troca "sem casca" para "com casca" ao ir do acompanhamento ao produto no Safari: registrar se o layout pular.

---

## Épico 9 · Orçamento em lote

### LJ-43 · Receber o orçamento em lote e transformar em pedidos
**Persona:** Lojista  ·  **Fase:** 2  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** 02-fechar-a-venda, Tela 9

> Como lojista, quero achar o orçamento que o RH me mandou pelo código curto e transformar a lista de nomes em pedidos, para produzir 30 canecas sem digitar nome por nome.

**Pré-condições**
- Na vitrine aura-qa, orçamento em lote da CANECA ALÇA CORAÇÃO com 30 nomes colados de uma planilha, incluindo "Silva, João" e uma linha em branco; data do evento pelo seletor; WhatsApp "(12) 99614-5447"; nome do evento "Formatura 3º B". Anote o código mostrado (ex.: "L-3F9A2C").

**Passo a passo**
1. Toque em "Mandar o #L-XXXXXX no WhatsApp da <loja>" e veja a mensagem.
2. No painel, procure o orçamento: sino, Pedidos → aba "Eventos", busca.
3. Abra o evento e confira nomes, quantidade, data, telefone e valor.
4. Toque em "Converter 30 em pedidos".
5. Abra um dos pedidos criados.

**Critérios de aceite — funciona**
- [ ] A lista chega com 30 nomes; "Silva, João" é **um** nome (vírgula não separa); a linha em branco não conta.
- [ ] O código "L-XXXXXX" que a cliente mandou aparece no painel igual (mesmas 6 letras, em maiúsculas) e é pesquisável. **Hoje o painel mostra "Evento #" + 8 letras minúsculas do identificador**: registrar P1.
- [ ] O detalhe do evento mostra nome do evento, data, telefone, total estimado e que é um **rascunho** esperando a lojista. **Hoje mostra "Detalhe do evento" com a contagem e os nomes, sem esses dados**: registrar P1.
- [ ] A lojista é avisada de orçamento novo. **Hoje o rascunho não gera aviso no sino**: registrar P1.
- [ ] "Converter 30 em pedidos" cria 30 pedidos na produção e mostra "30 pedido(s) criado(s) no KDS"; cada item passa a mostrar a etapa e "Abrir pedido".
- [ ] Valor por unidade com a faixa de 10 ou mais (LJ-21): R$ 44,91; 30 × R$ 44,91 = R$ 1.347,30.

**Critérios de aceite — premium (UI/UX)**
- [ ] Aviso de sucesso sem "(s)" e sem a sigla "KDS" para a lojista ("30 pedidos criados na Produção").
- [ ] Cada nome em linha própria com número "#001" a "#030", legível no celular.

**Casos de borda**
- [ ] Telefone com 9 dígitos: recusado na vitrine ("WhatsApp com DDD obrigatorio").
- [ ] 201 nomes: só 200 entram; conferir que a cliente foi avisada.
- [ ] Converter duas vezes (toque duplo): não cria 60 pedidos.

**Pontos de atenção conhecidos**
- Mockup 02 previa "sequência própria" ("L-0042"); o código usa as 6 primeiras letras do identificador. Não é sequência nem contagem: o PO confirma se basta.
- A tela final da cliente promete "A Sheid confere os nomes e o prazo, em até 1 dia útil" e "Você recebe no WhatsApp o link do orçamento... Aprova e paga o sinal pelo link" (mockup): conferir se existe esse caminho no painel; hoje a conversão cria pedidos, sem link de orçamento para a cliente.

---

## Épico 10 · Medição e relatórios

### LJ-44 · Ver os eventos de venda chegando no GA4 e no Pixel, só com consentimento
**Persona:** Lojista (com apoio do QA)  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 8

> Como lojista, quero ver no Google e na Meta quantas pessoas viram, colocaram na sacola e compraram, para saber se a loja nova vende mais.

**Pré-condições**
- IDs de teste salvos em "Pedidos pela loja" (LJ-24). GA4 em "DebugView" (ou Tag Assistant) e a extensão "Meta Pixel Helper" no Chrome.

**Passo a passo**
1. Numa janela anônima, abra a vitrine: aparece o aviso de cookies. Toque em "Só os essenciais"; navegue até um produto, adicione à sacola, abra o checkout.
2. Nova janela anônima: toque em "Aceitar"; abra a CANECA ALÇA CORAÇÃO, toque em "Compartilhar", adicione 2 à sacola, finalize com Pix de teste.
3. Confira os eventos no DebugView e no Pixel Helper.

**Critérios de aceite — funciona**
- [ ] Com "Só os essenciais", nenhum script do Google ou da Meta é carregado e nenhum evento sai.
- [ ] Com "Aceitar": GA4 recebe `view_item`, `share`, `add_to_cart`, `begin_checkout` e `purchase`; o Pixel recebe `ViewContent`, `AddToCart`, `InitiateCheckout` e `Purchase` (o Pixel não tem `share`).
- [ ] Valores em BRL e em reais: `add_to_cart` com 2 × 49,90 = 99,80; `purchase` com o número do pedido e o valor pago (89,82 no Pix).
- [ ] Sem IDs salvos, o aviso de cookies não aparece.

**Critérios de aceite — premium (UI/UX)**
- [ ] O aviso de cookies não cobre a barra de compra nem o botão do WhatsApp (mockup 01, Tela 8).

**Casos de borda**
- [ ] QA_NOTAS F1C: evento que acontece antes de tocar em "Aceitar" se perde (o primeiro `view_item` do produto aberto direto pelo link). Registrar.
- [ ] QA_NOTAS F2: `add_payment_info` não é medido.
- [ ] Valor do `add_to_cart` com serviço de arte: a arte (uma vez por item) entra no valor? Registrar a diferença entre o valor medido e a sacola.

---

### LJ-45 · Saber quais pedidos vieram da Aurinha
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P2  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 3

> Como lojista, quero saber quais vendas vieram das conversas da Aurinha, para decidir se vale manter o atendimento automático.

**Pré-condições**
- Link de teste: `loja.getaura.com.br/aura-qa?produto=<id da CANECA ALÇA CORAÇÃO>&origem=aurinha&conversa=<uuid de teste>`.

**Passo a passo**
1. Abra o link no celular; confirme que o produto abre direto com a faixa discreta.
2. Finalize com Pix de teste.
3. Procure no painel a origem do pedido.
4. Peça à equipe técnica para conferir no banco as colunas `origem` e `hub_conversation_id` do pedido.

**Critérios de aceite — funciona**
- [ ] O pedido fica gravado com `origem = aurinha` e o identificador da conversa (conferência técnica).
- [ ] Um `conversa=` que não é identificador válido é ignorado sem quebrar o pedido.
- [ ] O painel mostra "Veio da Aurinha" no pedido. **Hoje o painel não mostra a origem em lugar nenhum**: registrar P2 e levar à pergunta em aberto 8.

**Critérios de aceite — premium (UI/UX)**
- [ ] A faixa da vitrine não usa exclamação e não some sozinha.

**Casos de borda**
- [ ] `origem` com 40 caracteres: gravado cortado em 32.
- [ ] Parâmetro de produto inválido: a vitrine cai na home sem erro.

---

## Épico 11 · Loja de teste e chave

### LJ-46 · Operar a loja de teste sabendo o que sai e o que não sai para o mundo
**Persona:** Lojista (QA)  ·  **Fase:** 0  ·  **Prioridade:** P0  ·  **Chave:** v2 ligada  ·  **Mockup:** —

> Como pessoa de QA operando a aura-qa, quero saber o que a loja de teste bloqueia, para não abrir achado falso de "não recebi aviso" nem mandar mensagem para cliente de verdade.

**Pré-condições**
- aura-qa (`is_sandbox`).

**Passo a passo**
1. Faça um pedido Pix de teste e observe a tela do Pix.
2. Observe sino, aviso do navegador, e-mail do dono, e-mail da cliente e push do app.
3. Mande um link de aprovação (LJ-36).

**Critérios de aceite — funciona**
- [ ] O Pix de teste mostra o código "LOJA DE TESTE — NAO E UM CODIGO PIX VALIDO — pedido #N — R$ X" e não cria cobrança em gateway.
- [ ] **Bloqueado** na loja de teste: e-mail e push ao dono no pagamento confirmado, e-mail à cliente (confirmação e mudança de etapa), e-mail do Pix por chave.
- [ ] **Não bloqueado** (funciona de verdade): sino e aviso do navegador da lojista, preço, estoque, fila de produção, financeiro, e o WhatsApp que a lojista abre à mão (link de aprovação, cobrança de saldo).
- [ ] Nenhum pedido de teste aparece no painel da Sheid.

**Critérios de aceite — premium (UI/UX)**
- [ ] O painel da aura-qa indica que é loja de teste (faixa ou selo), para ninguém confundir com loja real. Hoje não há indicação visível: registrar P2.

**Casos de borda**
- [ ] Pix por chave em modo manual (o da Sheid) não pode ser simulado na aura-qa, porque o Pix de teste não é "manual": o e-mail "pedido aguardando Pix" e o fluxo de confirmação do Pix por chave ficam sem teste de ponta a ponta. Ver pergunta em aberto 2.

---

### LJ-47 · Ligar e desligar a vitrine nova por loja, e a regressão com a chave desligada
**Persona:** Lojista e equipe Aura  ·  **Fase:** 0  ·  **Prioridade:** P0  ·  **Chave:** ambas  ·  **Mockup:** —

> Como PO, quero ligar a vitrine nova na Sheid só quando o QA passar, e garantir que com a chave desligada nada que funciona hoje quebrou, para a piloto não virar ambiente de teste.

**Pré-condições**
- A chave fica em `companies.studio_settings.vitrine_v2` e **não tem interruptor no painel** (a tela de Configurações não aceita essa chave). Só a equipe técnica liga e desliga, pelo banco.
- Rodada de regressão: pedir à equipe técnica para **desligar a chave na aura-qa** durante a rodada e religar no fim. Não usar a sheid-mania para pedidos.

**Passo a passo**
1. Com a chave ligada na aura-qa, anote a aparência da home, do produto, da sacola, do checkout e da confirmação.
2. Equipe técnica desliga a chave na aura-qa. Espere até 10 minutos (a casca da loja fica em cache).
3. Recarregue a vitrine: deve voltar a vitrine de hoje. Teste `?v2=1` (volta a nova só naquela aba) e `?v2=0`.
4. Refaça, com a chave desligada: LJ-19 (conta da arte na sacola), LJ-22 (loja fechada), LJ-23 (data limite), LJ-36 (link de aprovação), LJ-27 (frete ao trocar retirada e entrega).
5. Na sheid-mania, só olhando: abra a home sem e com `?v2=1`.
6. Equipe técnica religa a chave na aura-qa.

**Critérios de aceite — funciona**
- [ ] Chave desligada: home, produto, sacola e checkout de hoje funcionam como antes das fases (sem erro, sem valores diferentes do servidor).
- [ ] `?v2=1` vale só na aba onde foi aberto; outra aba abre a vitrine de hoje.
- [ ] Loja fechada e data limite valem também com a chave desligada (Fase 1C foi direto, sem chave).
- [ ] O link de aprovação com a chave desligada aponta para o endereço do app e funciona.
- [ ] O e-mail de confirmação da cliente (loja real) leva ao acompanhamento com a chave desligada e à página do pedido na loja com a chave ligada.

**Critérios de aceite — premium (UI/UX)**
- [ ] Os textos da aba Design não prometem o que a vitrine de hoje não faz (ver LJ-15): registrar P1 para a Sheid.

**Casos de borda**
- [ ] QA_NOTAS F4: endereços antigos com a chave ligada ainda mostram o banner de cookies do painel.
- [ ] QA_NOTAS F2: `/cardapio/studio/<slug>` continua com a confirmação antiga.

**Pontos de atenção conhecidos**
- A lojista não tem como ligar a vitrine nova sozinha. Ver pergunta em aberto 1.

---

## Épico 12 · Qualidade transversal do painel

### LJ-48 · Painel com a identidade do Studio em todas as telas, claro e escuro
**Persona:** Lojista  ·  **Fase:** 5  ·  **Prioridade:** P2  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 7

> Como lojista, quero que todas as telas do painel pareçam do mesmo produto, para confiar que estou no lugar certo.

**Pré-condições**
- Tema claro e depois escuro (Configurações do Studio → "Aparência").

**Passo a passo**
1. Passe por todas as abas da Loja Digital, Pedidos, Produção, detalhe do pedido, detalhe do evento e Configurações.
2. Anote cores de botões principais, abas ativas, selos e fundos.

**Critérios de aceite — funciona**
- [ ] Botões principais e aba ativa em navy `#1E3A8A`; destaque em magenta `#EC4899` só em rótulos pequenos e ícones (texto magenta usa `#BE185D` para AA); fundo `#E8E9F0`; cartões `#F5F6FA`/`#FFFFFF` (constants/studio-tokens.ts).
- [ ] Sem violeta do varejo `#7c3aed` como cor de ação no Studio. Pontos já vistos para conferir: chip ativo da Aparência, cor padrão de loja sem cor definida, bolinhas de cor da aba Design (a primeira é violeta).
- [ ] No escuro, nenhuma tela fica com cartão branco estourado ou texto escuro sobre fundo escuro (atenção às abas reaproveitadas da loja comum: Meu Site, Design, Entrega).

**Critérios de aceite — premium (UI/UX)**
- [ ] Sem emoji em texto de interface (achados: títulos da aba Entrega, emoji de brilho em "Aprovação solicitada!", sinal de visto em "Política de revisões salva", emoji de paleta na mensagem de aprovação, emoji de caixa no push "Pedido #N confirmado!").
- [ ] Os três modos de salvar são explicados: automático (Design, Entrega, "Salvando…"), botão por seção (Meu Site), botão único com prévia (Pedidos pela loja). Conferir que a lojista sabe quando algo já está salvo em cada aba.

**Casos de borda**
- [ ] Trocar o tema com uma aba aberta não perde o que foi digitado.

---

### LJ-49 · Estados de carregando, vazio e erro com voz e saída
**Persona:** Lojista  ·  **Fase:** 1  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** 01-alicerce, Tela 4 (mesma regra, aplicada ao painel)

> Como lojista, quero que o painel nunca me deixe numa tela branca ou num erro técnico, para saber o que fazer quando a internet falha.

**Pré-condições**
- DevTools com "Slow 3G" e "Offline".

**Passo a passo**
1. Com "Slow 3G", abra cada aba da Loja Digital, Pedidos, Produção e um detalhe de pedido.
2. Com "Offline", repita e toque nas ações de salvar.
3. Abra `/studio/pedidos/<id-que-nao-existe>`.

**Critérios de aceite — funciona**
- [ ] Carregando: esqueleto no formato da tela (listas, cartões), nunca tela em branco.
- [ ] Erro de carregamento com "Tentar de novo" que funciona ("Não deu pra carregar o Hub", "Não deu pra carregar o pedido").
- [ ] Pedido inexistente: "Pedido não encontrado" com "Voltar".
- [ ] Salvar sem rede: mensagem em português dizendo o que fazer; o formulário não perde o que foi digitado.

**Critérios de aceite — premium (UI/UX)**
- [ ] Mensagens sem código técnico ("[500]", "Failed to fetch", "42703").
- [ ] Vazio com próxima ação ("Configurar Loja Digital", "Criar primeiro template", "Marcar produtos como personalizáveis").

**Casos de borda**
- [ ] A aba "Aparência" sem rede: produtos somem sem aviso (hoje a lista cai vazia): registrar.
- [ ] A prévia da aba Design sem rede: mostra erro do navegador dentro da moldura; registrar.

---

### LJ-50 · Operar o painel no celular com o polegar e com leitor de tela
**Persona:** Lojista e Atendente  ·  **Fase:** 5  ·  **Prioridade:** P1  ·  **Chave:** ambas  ·  **Mockup:** —

> Como lojista no celular, e como pessoa que usa leitor de tela, quero tocar e ouvir cada controle com clareza, para operar a loja sem errar o toque.

**Pré-condições**
- iPhone com VoiceOver; Android com TalkBack; desktop só com teclado.

**Passo a passo**
1. Percorra a Loja Digital com o leitor de tela: abas, interruptores, campos, botões de salvar.
2. Percorra só com Tab no desktop.
3. Meça alvos de toque (DevTools) nos controles pequenos.

**Critérios de aceite — funciona**
- [ ] Abas anunciadas como abas, com "selecionada" na ativa. Hoje são botões sem papel de aba: registrar P2.
- [ ] Interruptores anunciados com nome e estado ("Retirada por app de entrega, ligado").
- [ ] Campos anunciam o rótulo; mensagens de erro e de "Salvo" são lidas quando aparecem ("Pedidos pela loja" já faz; conferir as outras abas).
- [ ] Foco visível em todos os controles no desktop; ordem de foco segue a leitura.

**Critérios de aceite — premium (UI/UX)**
- [ ] Alvos de toque de pelo menos 44 × 44 px. Medir e listar os menores: abas da Loja Digital (~36 px), "Ver site" (~30 px), chips de parcelas, chips da Aparência, bolinhas de cor, botões de data rápida do marco de pagamento.
- [ ] Texto mínimo de 12 px no celular (hoje há 9,5 px a 11 px em rótulos da Aparência e da Pedidos pela loja).
- [ ] "Reduzir movimento" respeitado nos contadores animados do hub.

**Casos de borda**
- [ ] Zoom do navegador a 200% no desktop: nada sobreposto, sem rolagem horizontal.
- [ ] Teclado do celular aberto num campo do fim da página: o campo fica visível e o botão de salvar alcançável.

---
## Matriz de regressão do lojista

"Ligada" = aura-qa como está. "Desligada" = aura-qa com a chave desligada pela equipe técnica durante a rodada (LJ-47). A sheid-mania entra só para OLHAR a vitrine, nunca para pedido ou para salvar no painel.

| Fluxo | Ligada · celular | Ligada · desktop | Desligada · celular | Desligada · desktop | Sheid (só olhar) |
|---|---|---|---|---|---|
| Loja Digital, abas e `?tab=` (LJ-01 a 03) | Sim | Sim | Sim | Sim | Não se aplica |
| Publicar e despublicar (LJ-04) | Sim | Sim | Sim | Sim | Não |
| Cor, tipografia, cards (LJ-09, 10) | Sim | Sim | Sim (vitrine de hoje) | Sim | Olhar sem e com `?v2=1` |
| Faixa, banners, peça do destaque, selos (LJ-11 a 14) | Sim | Sim | Conferir textos x vitrine de hoje | Sim | Olhar com `?v2=1` |
| Prévia da aba Design (LJ-15) | Sim | Sim | Sim | Sim | Não |
| Preço com verso e arte uma vez por item (LJ-18, 19) | Sim | Sim | Sim (P0 se divergir) | Sim | Olhar a sacola, sem finalizar |
| Faixas por quantidade (LJ-21) | Sim | Sim | Sim | Sim | Olhar |
| Loja fechada e data limite (LJ-22, 23) | Sim | Sim | Sim | Sim | Não mexer |
| Medição GA4/Pixel (LJ-24, 44) | Sim | Sim | Sim | Sim | Não |
| Entrega, frete e retirada por app (LJ-26 a 28) | Sim | Sim | Sim (frete ao trocar modo) | Sim | Não |
| Aviso de pedido novo (LJ-29) | Sim | Sim | Sim | Sim | Não |
| Fila, detalhe e personalização (LJ-30 a 32) | Sim | Sim | Sim | Sim | Não |
| Pix por chave e comprovante (LJ-33) | Sim | Sim | Sim | Sim | Não |
| Pix vencido 72 h (LJ-34) | Sim (1 vez) | Não se aplica | Sim (1 vez) | Não se aplica | Não |
| Link de aprovação e respostas (LJ-36 a 38) | Sim | Sim | Sim (link no endereço do app) | Sim | Não |
| Produção, pronto e entrega (LJ-40, 41) | Sim | Sim | Sim | Sim | Não |
| Pedir outro igual (LJ-42) | Sim | Sim | Não se aplica (só com a chave) | Não se aplica | Não |
| Orçamento em lote (LJ-43) | Sim | Sim | Sim (tela antiga do lote) | Sim | Não |
| Multi-CNPJ (LJ-25) | Não se aplica | Sim | Não se aplica | Sim | Não |

---

## Achados antecipados (lidos no código, a confirmar no QA)

Divergências entre código, mockup e regras aprovadas, encontradas ao escrever as histórias. Cada uma já é critério de aceite na história indicada.

| # | Achado | Onde | Prioridade sugerida | História |
|---|---|---|---|---|
| A1 | O painel Studio não tem onde ver o comprovante nem confirmar o Pix de um pedido da vitrine. A ação existe só na tela Canal Digital da loja comum, que redireciona conta Studio. O aviso "Comprovante para conferir" abre o detalhe Studio, que não mostra nada disso. As duas lojas só têm Pix por chave. | `app/studio/(estudio)/pedidos/[id].tsx`, `app/_layout.tsx:265`, `components/screens/canal/TabPedidos.tsx` | P0 | LJ-33 |
| A2 | Detalhe do pedido Studio sem forma e situação do pagamento, modo de entrega, portador (nome, placa ou "informo depois"), CPF/CNPJ na nota, linha do serviço de arte e origem. Valores com ponto ("R$ 49.90"). | `pedidos/[id].tsx`, `studioKdsApproval.js` GET `/orders/:oid` (view `studio_orders`) | P0 | LJ-28, 31, 32 |
| A3 | Revisões: o painel diz "0 = ilimitadas, sem cobrança", mas a página de aprovação trata 0 como "nenhuma inclusa" ("Esta seria a 1ª revisão...", "As revisões inclusas deste pedido já foram usadas"). aura-qa e Sheid estão com 0. | `TabStudioRevisoes.tsx:205` x `studioApprovalPublic.js` `placarDeRevisoes` + `posCompra.ts` | P0 | LJ-38 |
| A4 | "Aprovar" e "Pedir ajuste" da cliente não geram aviso para a lojista (nenhum evento de sino), embora a página diga "A loja já foi notificada". A referência chega como texto dentro da nota, sem link. | `studioApprovalPublic.js` POST `/respond` | P0 | LJ-37 |
| A5 | Prévia de tipografia da aba Design usa as fontes da loja comum (Cormorant, Space Grotesk, Anton, Lora); a vitrine Studio usa Fraunces, DM Sans, Instrument Serif e Pacifico com os mesmos nomes. A mini loja da Design também. | `PreviewTipografia.tsx`, `MiniLoja.tsx` (`TIPOGRAFIAS`, `tipografiaDaLoja`) | P1 | LJ-10 |
| A6 | "Marcante" (`editorial`) é recusada pelo servidor: "font_family deve ser classic|modern|humanist" (também no Anexo A da jornada). | `Aura-backend/src/routes/digitalChannel.js:566` | P1 | LJ-10 |
| A7 | Aba Aparência usa DM Mono (`Fonts.mono`) no preço de exemplo e nos rótulos, contra a decisão 9 do PO (Bricolage Grotesque). Chip ativo em violeta do varejo. | `TabStudioAparencia.tsx` | P2 | LJ-10, 16 |
| A8 | "Pedidos pela loja": com a data limite vencida, o interruptor segue "Aceitando pedidos pela loja" (verde) e o selo diz "FECHADA". Prévia usa o fuso do aparelho; o servidor, Brasília. Dois avisos de sucesso (flutuante e inline). Edição se perde ao trocar de aba. | `TabStudioPedidosPelaLoja.tsx`, `pedidosPelaLoja.ts:iso()`, `useDigitalChannel.ts` | P1 | LJ-22, 23 |
| A9 | Texto do painel "Pedidos pela loja" difere do mockup (Tela 7): subtítulo ("botão de comprar" x ""Comprar agora""), recado padrão, dica da data, ordem data/recado, data visível com a loja aberta, prévia sem slogan, prévia presente no celular. | `TabStudioPedidosPelaLoja.tsx`, `pedidosPelaLoja.ts` x mockup 01 Tela 7 | P2 (decisão do PO) | LJ-22, 23 |
| A10 | Fila de pedidos: sem busca; o hub mostra a etapa crua em inglês ("pending_art"); Produção mostra "#" + 8 letras do identificador em vez do número do pedido da cliente; valores com ponto. | `pedidos.tsx:388`, `producao.tsx` | P1 | LJ-30 |
| A11 | Personalização no detalhe: serviço de arte, campos do verso (chaves "_back") e arquivo enviado podem aparecer crus (código, chave, endereço em texto). | `customizationConfig.ts` `rotuloDaChave`/`valorDaChave` | P1 | LJ-31 |
| A12 | Orçamento em lote: o painel não mostra o código "L-XXXXXX" (mostra "Evento #" + 8 letras minúsculas); o rascunho não gera aviso; o detalhe não mostra nome do evento, data, telefone nem "rascunho". Mockup previa sequência "L-0042". | `pedidos/eventos/[eid].tsx`, `studioStorefront.js` bulk-order, `studioLote.js` | P1 | LJ-43 |
| A13 | Pix vencido na aura-qa: o aviso que chega é "Chame o cliente enquanto a venda é recuperável" para um pedido já cancelado (a regra de um aviso por pedido suprime o texto de cancelamento). | `lojaPixExpiradoJob.js` (dedupe `loja:pix_expirado:<id>`) | P1 | LJ-34 |
| A14 | Com a chave desligada (Sheid), a aba Design descreve a home nova (3 banners a cada 6 s, peça do destaque) e a prévia mostra a vitrine de hoje, que usa só o primeiro banner. | `TabDesign.tsx` (textos `ehStudio`) x `regrasDaHome.ts` (atrás da chave) | P1 | LJ-15, 47 |
| A15 | Triagem da arte enviada pela cliente (S5) tem rota no servidor e nenhuma tela no painel. | `studioArtReview.js` | P1 | LJ-39 |
| A16 | Mensagem padrão do link de aprovação com emoji e "respondemos em até 1h"; avisos com emoji ou símbolo ("Aprovação solicitada!", "Política de revisões salva", push "Pedido #N confirmado!", "Aprovado!" da cliente); títulos da aba Entrega com emoji. | `studioKdsApproval.js:905`, `ApprovalRequestModal.tsx`, `TabStudioRevisoes.tsx`, `digitalOrderNotifications.js`, `TabEntrega.tsx` | P1/P2 | LJ-36, 37, 38, 48 |
| A17 | Serviço de arte: o painel não diz que o valor é "uma vez por item" e cita o id técnico "art_service_brief". Multiplicador de faixa rotulado "sobre o custo base", mas a vitrine aplica sobre o preço de tabela; faixas longe da Loja Digital. | `StudioPersonalizacaoPanel.tsx:1155-1205`, `configuracoes/precificacao.tsx` | P1 | LJ-19, 21 |
| A18 | Retirada: exemplos em horas ("Em até 1 hora após confirmação", "Em 30 min") na loja Studio, contra "prazo em dias úteis". Sheid tem "5/20" cadastrado. | `TabEntrega.tsx` | P1 | LJ-26 |
| A19 | Faixa de anúncio rotulada "(desktop)" mas aparece no celular; selo "Folha" vira ícone de brilho na vitrine. | `TabDesign.tsx`, `regrasDaHome.ts` `ICONE_DO_PAINEL` | P2 | LJ-11, 14 |
| A20 | Aviso "Loja sem forma de pagamento" leva a "/canal" e fala em "Canal Digital" (inacessível para Studio); "Pode separar a mercadoria" no pagamento confirmado. | `lojaEvents.js` | P1/P2 | LJ-29 |
| A21 | Multi-CNPJ: "Meu Site" só relê o formulário quando a loja passa de inexistente para existente; trocar para uma empresa já carregada pode manter os dados da anterior (risco de salvar dados de uma empresa na outra). | `TabMeuSite.tsx` `useEffect([config.exists])` | P0 a confirmar | LJ-25 |
| A22 | Microcopy do painel: "storefront", "pra", textos sem acento em Meu Site, "Barbearia do Caio", "Loja Virtual" x "Loja Digital", "Ver site" x "Ver loja", "Preview"/"Mobile", "item(ns)", "pedido(s) criado(s) no KDS". | várias | P2 | LJ-01, 05, 17, 43 |
| A23 | Alvos de toque abaixo de 44 px (abas ~36 px, "Ver site" ~30 px, chips) e abas sem papel de aba para leitor de tela; largura "larga" calculada só ao carregar. | `loja-digital.tsx`, `canal/shared.tsx` | P1/P2 | LJ-03, 50 |
| A24 | A aura-qa não simula Pix por chave em modo manual nem cartão: o fluxo real da Sheid (Pix por chave, e-mail "aguardando Pix", confirmação manual) e o cartão ficam sem teste de ponta a ponta. | `lojaDeTeste.js` `pixDeTeste` (sem `mode`) | P1 (ambiente) | LJ-33, 35, 46 |

---

## Perguntas em aberto (o código não responde)

1. **Chave por loja:** a lojista vai ter um interruptor da vitrine nova, ou só a Aura liga pelo banco? Quem liga na Sheid, com que critério de aceite (esta matriz?) e com que aviso à lojista?
2. **Pix por chave na loja de teste:** como testar de ponta a ponta o Pix em modo manual (o da Sheid), o e-mail "pedido aguardando Pix" e a confirmação manual, se a aura-qa gera Pix de teste sem esse modo e bloqueia e-mails?
3. **Cartão:** existe loja de teste com Mercado Pago em modo teste? Sem ela, pedido de cartão, parcelamento e volta do cartão ficam fora do QA.
4. **Confirmar Pix no Studio (A1):** onde a lojista Studio confere o comprovante e confirma o Pix? Tela nova no detalhe do pedido Studio, ou reaproveitar a fila da loja comum? Esta resposta decide se a Sheid pode vender pela vitrine nova.
5. **Retirada por app com "informo depois":** por onde a cliente informa nome e placa depois (acompanhamento?) e onde a lojista vê o "a informar"? Sem isso, a proteção do portador não existe para esses pedidos.
6. **Aviso à cliente por etapa:** a cliente do Studio deve receber e-mail ou WhatsApp quando a arte fica pronta, quando entra em produção e quando fica pronta para retirar? Hoje só o link de acompanhamento mostra.
7. **Dois WhatsApp da loja** (Meu Site e Configurações → "Produção e aprovação"): continuam separados? Qual vale para o link de aprovação e qual para o botão da vitrine?
8. **Origem Aurinha (A2, LJ-45):** onde a lojista vê que um pedido veio da Aurinha: no pedido, num relatório ou só no Hub Social?
9. **"Pedir outro igual":** o pedido repetido deve ser marcado como repetição do pedido de origem? A métrica da Fase 4 ("pedidos repetidos") depende disso.
10. **Revisões com 0 (A3):** 0 quer dizer "ilimitadas" (painel) ou "nenhuma inclusa" (aprovação)? A resposta muda o selo da home, o checkout e a folha de "Pedir ajuste".
11. **Último dia da temporada:** o corte é 23h59 de Brasília para todas as lojas, ou a lojista escolhe o horário? (pergunta aberta do mockup 01)
12. **Loja fechada com sacola cheia:** basta "Pedir orçamento" com a lista pelo WhatsApp, ou a sacola deve ficar guardada para quando a loja reabrir? (pergunta aberta do mockup 01)
13. **Orçamento em lote (A12):** o código "L-" + 6 letras basta ou precisa de sequência? O rascunho deve avisar no sino? O "link do orçamento com a prova da arte e o sinal" prometido na tela final da cliente existe, ou a conversão direta em pedidos é o fluxo?
14. **Triagem de arte (A15):** a tela de triagem entra nesta fase ou fica para depois? Enquanto não houver, a atendente confere a arte onde?
15. **Tipografia (A5, A6):** a prévia da aba Design deve mostrar o par Studio quando a loja é Studio? "Marcante" deve ser liberada no servidor?
16. **Visão consolidada nas outras abas (LJ-25):** "Meu Site", "Design" e "Entrega" devem pedir para escolher a empresa como "Pedidos pela loja"?

---

## Anexo A · Recado de 280 caracteres (para LJ-22)

Copie exatamente (280 caracteres, contando espaços):

```
Nossa agenda de Natal está cheia e não conseguimos aceitar pedidos novos pela loja agora. Você ainda pode pedir um orçamento para janeiro: conte o que quer personalizar e a quantidade, e respondemos pelo WhatsApp com prazo e preço. Obrigada pelo carinho de sempre, até mais! Sheid
```

Para testar o limite, acrescente um ponto final: o contador vai a 281, fica vermelho e "Salvar alterações" desabilita.
