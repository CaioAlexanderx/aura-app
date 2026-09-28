# Formatação da arte na Aura Studio: diagnóstico e proposta

**28/09/2026 · Fase 1 (só documento e mockup, nenhum código de produção)**
Mockup: [`docs/mockups/studio-formatacao-da-arte.html`](../mockups/studio-formatacao-da-arte.html). Abre sem rede. A faixa escura no topo alterna os estados, e dá para abrir um estado direto pelo endereço, por exemplo `#estado=baixa&ajustar=1&largura=celular`.

O PO pediu para revisar a formatação da arte nos dois lados. A cliente precisa sentir que está controlando a personalização. A lojista precisa conseguir simular como a peça vai ficar. Tudo sem excesso: quem faz o arquivo final continua sendo o Corel, o Photoshop ou o Canva.

Referência de código: `origin/main` em `3c1ae5a0` (aura-app) e `origin/main` em #764 (aura-backend, lido sem checkout).

---

## 1. O que existe hoje

### 1.1 Cliente na vitrine

A vitrine tem duas páginas de produto:
- **v1:** `ProductConfigurator.tsx`.
- **v2:** `produto/PaginaDoProduto.tsx`, atrás da chave `vitrine_v2`, escolhida em `PaginaDaVitrine.tsx:345` e `VitrineNaRota.tsx:53`.

O que a cliente pode fazer:

| Pode | Onde |
|---|---|
| Escolher o caminho da arte: "tenho a arte" (incluso), "pedir ajuste" ou "criem pra mim" com briefing de 600 caracteres | `ArteDaPeca.tsx:42` (`CaminhosDaArte`), `artService.ts` |
| Enviar um arquivo (PNG, JPG, WEBP ou PDF), com progresso, cancelar, trocar e remover | `EnvioDaArte.tsx:141` |
| Receber aviso de foto pequena, medido no navegador antes do envio. O aviso não bloqueia | `EnvioDaArte.tsx:129`, `regrasDaPagina.ts:397-436` |
| Escolher uma arte pronta (template), como alternativa ao arquivo | `ArteDaPeca.tsx:410` |
| Escrever texto com limite de caracteres e escolher a cor na paleta da lojista (chave lateral `<campo>_cor`), com aviso "essa cor quase some" | `ArteDaPeca.tsx:170-235` |
| Usar abas Frente / Verso / Meio, com opt-in cobrado | `ArteDaPeca.tsx:300-380` |
| Ver a prévia como slide do carrossel: foto marcada, template 2D ou caneca/camiseta 3D que gira com o arraste | `PalcoDoProduto.tsx`, `LivePreview.tsx:212-345` |
| Ler a área de impressão em cm e o mínimo de pixels como texto | `DetalhesDaPeca.tsx:90-99` |

O que a cliente **não pode** fazer:
- **Posição, tamanho, rotação e encaixe.** Nenhum componente da vitrine ou do motor tem esse controle. Uma busca por `scale`, `rotation`, `offset` e `placement` nos campos, no motor e na página não encontra nada.
- **Escolher a fonte.** O motor usa sempre `config.fonts[0]` da lojista (`valoresDoMotor.ts:86`). A lista `FONTS_PRESET` tem cinco fontes, mas só a primeira é usada.

### 1.2 O motor e a regra única de encaixe

`compose2d.ts:776-816`, `compose3dMug.ts:134-177` e `PersonalizationPreview.tsx:242` (o SVG da ficha) aplicam a **mesma regra fixa**:
- a imagem entra em *contain*, centralizada, ocupando 62% da altura quando há texto e 90% quando não há;
- o texto vai numa linha só, centralizado embaixo, e a fonte encolhe até 10 px para caber.

São três implementações independentes da mesma regra.

O realismo que já existe é bom e está com outro agente (Fable):
- homografia sobre a foto marcada;
- sombreado tirado da própria foto;
- mistura pela luz da peça: `multiply` em peça clara e `normal` a 90% em peça escura (`compose2d.ts:253-278`, com a chave `view.art_blend`);
- estúdio 3D com tecido e dobras.

### 1.3 Lojista

| O que existe | Onde |
|---|---|
| A aba **Configurador** da Loja Digital é uma lista de peças personalizáveis: visibilidade, área em cm e link para o estoque. Não simula nada | `TabStudioConfigurador.tsx:204-290` |
| O editor real é o drawer do estoque. Tem área em cm por lado, campos, cobrança do verso e prévia do motor com texto de exemplo fixo "João". **Não aceita uma arte de teste** | `StudioPersonalizacaoPanel.tsx:393-408, 867` |
| **Mockup na foto:** a lojista arrasta quatro cantos sobre a foto e vê a luz. Tem arraste, teclado e alvos de 44 px, que servem de referência de acessibilidade para o editor novo | `MockupNaFotoSecao.tsx`, `marcacaoDaFoto.ts` |
| **Render de aprovação:** PNG de 2048 px ou vídeo de 3,6 s gerado no navegador, enviado ao R2 e registrado em `studio_visual_renders` | `gerarRenderAprovacao.ts` |
| **Ficha de produção (A5):** prévia SVG, tabela de chaves e "Baixar arte" com o arquivo original | `app/studio/(estudio)/pedidos/ficha/[id].tsx:163-210` |

### 1.4 O que o pedido guarda e o que o backend espera

- **Onde fica:** `digital_order_items.customization` (JSONB), no formato plano `{ [field.id]: valor }` mais as chaves laterais `<texto>_cor`, `art_service_brief`, `has_back_selected` e `has_middle_selected`. O objeto é gravado como chega (`studioStorefront.js:1150`).
- **O que a validação confere:** só obrigatoriedade, grupo de origem da arte e lado ativo (`studioStorefront.js:671-709`). Não há lista de chaves permitidas nem checagem de tipo.
- **Posição, escala e fonte não existem** em nenhuma parte do backend. Se chegarem, são gravadas sem ser lidas, e o "pedir outro igual" as descarta (`repetirPedido.js:60-105` mantém só os campos, `_cor` e o briefing).
- **Upload:** `POST /storefront/:slug/studio/upload` recebe base64 em JSON. O código aceita 15 MB, mas o `express.json({limit:'5mb'})` global (`app.js:132`) barra antes: o teto real é **cerca de 3,7 MB de arquivo**. O backend não lê as dimensões, não calcula DPI e não gera miniatura.
- **Área física:** existe só em `customization_config.print_area{width_cm,height_cm,position}` por lado (`studio.js:45-101`). Técnica de impressão, DPI e margem de segurança não existem em lugar nenhum.
- **Arquivo de impressão:** o servidor não gera nada. A produção baixa o original do R2.

---

## 2. O que está errado

### Enganoso: a prévia promete algo que a produção não entrega

| # | O quê | Evidência |
|---|---|---|
| E1 | **O render de aprovação perde a cor e a fonte que a cliente viu** quando o produto tem template do banco, 2D ou 3D. O `customization` vai cru, com `{}` nas opções: a cliente escolheu rosa em Pacifico e recebe para aprovar um texto grafite em Georgia. O caminho da foto marcada (linha 77) já faz a tradução certa | `gerarRenderAprovacao.ts:122, 171` |
| E2 | **O segundo texto e a segunda imagem do lado não aparecem na prévia.** O campo "Data" é digitado, vai para o pedido e a peça na tela não o mostra | `valoresDoMotor.ts:62-64` (`primeiroDoLado`) |
| E3 | **O upload anuncia "até 15 MB"** (10 MB no padrão do campo) e quebra acima de cerca de 3,7 MB com "Resposta inesperada do servidor". Uma foto comum de iPhone passa desse teto | `EnvioDaArte.tsx:125`, `app.js:132` (backend) |
| E4 | **O aviso de resolução não olha o tamanho impresso.** Ele compara o lado maior da imagem com 1200 px, qualquer que seja a área. Hoje funciona por acaso, porque a arte sempre ocupa a área inteira. Com controle de tamanho, passa a mentir | `regrasDaPagina.ts:397-436` |
| E5 | **Fundo branco some na prévia de peça clara** (`multiply`) e é **impresso na produção por DTF** como um retângulo branco. Na sublimação o `multiply` está certo. A prévia não sabe a técnica | `compose2d.ts:266-278` |
| E6 | **A render de aprovação mostra só a frente.** O verso personalizado não tem prova | `gerarRenderAprovacao.ts:166-169` |
| E7 | **A ficha usa um terceiro desenho** (SVG), com diagramação própria, diferente do que a cliente aprovou | `ficha/[id].tsx:166` |
| E8 | **No painel, o segundo campo do verso não aparece na prévia**, por causa da regex com o `\d` perdido (ver §4) | `customizationConfig.ts:143` |

### O que falta

- A cliente não controla nada da diagramação: onde fica, de que tamanho, encaixada ou cortada, de pé ou deitada.
- A área de impressão não aparece sobre a peça para a cliente: `showAreas: false` (`LivePreview.tsx:308`). A área existe só como frase, lá embaixo, em "Detalhes".
- A lojista não consegue testar uma arte de verdade no produto, só "João".
- Não existe prova do pedido: arte sobre a peça, medidas em cm, DPI efetivo e PNG na resolução de impressão.
- A técnica de impressão (sublimação, DTF, silk) não existe no dado.

### O que confunde

- Duas páginas de produto (v1 e v2). O editor novo deve nascer **só na v2**; a v1 continua como está.
- Três motores desenham a mesma regra de encaixe (canvas 2D, textura 3D e SVG da ficha). Qualquer ajuste de posição precisa sair de **uma função pura só**, que os três leiam.
- As dimensões medidas da arte ficam num `Map` em memória (`EnvioDaArte.tsx:45`) e se perdem ao recarregar. A produção nunca sabe quantos pixels a arte tinha.

### O que é excesso (e fica de fora)

Rotação livre, curvar texto, sombra projetada, filtros e efeitos, camadas múltiplas, recorte por IA, editor vetorial, upload de fonte e PDF de impressão com marcas de corte. Tudo isso é trabalho do Corel, Photoshop ou Canva e aumenta a distância entre o que a cliente vê e o que a oficina consegue reproduzir.

---

## 3. Proposta priorizada

**Princípio: tudo o que a cliente ajusta chega à produção em centímetros.** Se não chega, o ajuste é enganoso. Por isso o formato de dado (§4) vem antes de qualquer tela.

### P0: sem isto, a experiência engana (corrigir já, independe do editor)

1. **A render de aprovação usa `valoresDoMotor` também com template do banco** (2D e vídeo 3D), com a mesma cor e a mesma fonte da vitrine. Quando houver verso preenchido, gera **frente e verso** (E1, E6). Arquivo: `gerarRenderAprovacao.ts`. Isso toca `visualEngine/*`, então precisa ser coordenado com o Fable.
2. **Todos os textos e imagens do lado entram na prévia** (E2, E8). O segundo texto vira segunda linha. Se a vista não comporta, a prévia diz "O texto 'Data' vai na peça, mas não cabe nesta prévia", em vez de sumir calada.
3. **O teto de upload fica verdadeiro** (E3). O backend precisa de um parser JSON por rota de ~25 MB no `/studio/upload` e no `/studio/upload-mockup`, montado antes do global. Enquanto isso não sai, o front **anuncia o teto real** e reduz no navegador fotos JPG acima dele (lado maior até 4000 px). PDF não é reduzido. O backend é mergeado antes, como diz a convenção.
4. **A área de impressão fica visível na prévia quando a cliente está com a arte**: tracejado discreto e rótulo "área 20 × 9 cm", com a opção de esconder ("ver só a peça").

### P1: diferencial claro (o editor e a prova)

5. **Editor "Ajustar a arte" na página da peça (v2):**
   - o palco vira a **folha da área planificada**, com régua em cm, área tracejada e margem de segurança de 3 mm, e uma **miniatura da peça ao vivo** no canto;
   - gestos: arrastar para mover, alça no canto e pinça para o tamanho, dois toques para centralizar;
   - alternativas sem gesto: botões de 44 px (setas, −/+, girar 90°, centralizar) e setas do teclado, com Shift para passo grande;
   - **encaixe em um toque:** Ajustar (inteira, sem cortar), Preencher (cobre a área e corta o excesso) e Centralizar;
   - **rotação só em passos de 90°**;
   - no celular, é uma folha em tela cheia com "Pronto", para o arraste não brigar com o carrossel nem com o giro do 3D.
6. **Nitidez medida pelo tamanho impresso** (E4): DPI efetivo = pixels da arte ÷ (cm ocupados ÷ 2,54), recalculado a cada ajuste.
   - Faixas: **≥ 150 boa**, **100–149 aceitável**, **< 100 pode sair borrada**.
   - Na faixa ruim, o botão "Reduzir até ficar nítida" leva ao maior tamanho com 150 dpi.
   - É aviso, não trava (DEC-11 continua valendo).
7. **Aviso de arte cortada e de margem:**
   - parte da arte fora da área: "Essa parte não será impressa", com botão [Encaixar na área];
   - conteúdo dentro da margem de 3 mm: "Perto da borda, pode ser cortado".
   - O modo Preencher corta de propósito e não dispara o aviso.
   - O corte e a margem são medidos pela **caixa do conteúdo** (pixels que não são brancos nem transparentes), não pela caixa do arquivo. Senão um JPG com margem branca geraria aviso falso na sublimação, onde o branco nem é impresso. O mockup simplifica e usa a caixa do arquivo.
8. **Texto com escolhas curtas:**
   - fonte entre as que a lojista liberou em `config.fonts` (hoje só a primeira é usada), com no máximo quatro e prévia "Aa" em cada botão;
   - cor da paleta, como hoje;
   - tamanho P/M/G;
   - até duas linhas;
   - arrastar na folha como a imagem;
   - **contorno fino opcional**, só quando a cor do texto some na peça (o aviso de contraste que já existe vira o gatilho).
9. **Técnica de impressão no produto** (`customization_config.tecnica`: `sublimacao` | `dtf` | `outra`), escolhida pela lojista:
   - sublimação: a arte entra em `multiply` e o branco vira a cor da peça;
   - DTF/silk: arte opaca, e **fundo branco sólido gera aviso** ("vai sair um retângulo branco").
   - Na prática só muda o `art_blend` que o motor já aceita, então o custo é baixo.
10. **Prova do pedido para a lojista** (detalhe do pedido e ficha):
    - a arte do pedido sobre a peça e planificada, lado a lado, por lado;
    - medidas em cm (tamanho e distância das bordas), DPI efetivo, técnica, fonte e cor;
    - **"Baixar PNG de impressão"**: só a área, 300 dpi, fundo transparente e nome `SM-0042 - Frente.png`. É gerado no navegador (o R2 já responde CORS);
    - "Gerar mockup para aprovação", que alimenta o `ApprovalRequestModal` que já existe.
11. **"Testar com uma arte" no drawer de Personalização do produto:** o mesmo editor da cliente, com um arquivo local que não é salvo, no lugar do "João".

### P2: depois

12. **Remover fundo branco:** preenchimento a partir das bordas com tolerância, só em DTF e só quando os cantos da arte são brancos. É barato e confiável em logo chapado, mas não em foto; por isso o botão só aparece no caso detectado e sempre dá para desfazer.
13. A lojista ajusta a arte do pedido e isso vira uma **revisão**. A escolha original da cliente nunca é sobrescrita.
14. Curvar texto na caneca, se a lojista pedir. O 3D já curva a arte naturalmente na volta.
15. Guardar as dimensões medidas da arte no pedido também para PDF (hoje o PDF não é medido).

### De fora de propósito

Rotação livre, efeitos, camadas, IA, fonte enviada pela cliente e PDF com sangria e marcas de corte. Ver o último item da §2. A resposta a "quero mais controle" é "peça o ajuste", que já é um serviço cobrado.

---

## 4. Formato no pedido (proposta, a validar com o backend)

A proposta segue o padrão das chaves laterais que já existe (`<campo>_cor`):

```jsonc
"image": "https://…/arte.jpg",
"image_ajuste": {
  "v": 1,
  "encaixe": "ajustar" | "preencher" | "livre",
  "cx": 0.5, "cy": 0.46,        // centro, fração da área (0..1)
  "larg": 0.62,                 // largura ocupada, fração da largura da área
  "rot": 0 | 90 | 180 | 270,
  "cm": { "x": 3.8, "y": 0.4, "w": 12.4, "h": 8.2 },   // retrato para a ficha, calculado no fechamento
  "arquivo": { "w": 2400, "h": 1800 },                 // pixels medidos no navegador
  "dpi": 230
},
"text": "Helena", "text_cor": "#BE185D",
"text_fonte": "Pacifico", "text_tam": "M",
"text_ajuste": { "v": 1, "cx": 0.5, "cy": 0.86, "rot": 0 }
```

- **Frações para redesenhar, cm para produzir.** O retrato em `cm` sobrevive a uma edição da área depois do pedido.
- **Sem `_ajuste`, vale a regra de hoje** (ajustar e centralizar). Pedidos antigos, v1 e o PDV continuam iguais.
- **O que precisa mudar no backend:**
  - aceitar e limitar os números das chaves `_ajuste`, `_fonte` e `_tam`;
  - `repetirPedido.js` passar a manter essas chaves;
  - o `content_hash` da render já inclui o objeto inteiro, então nada muda ali.
- **O que precisa mudar no app:**
  - `valuesForSide` (`customizationConfig.ts:143`) não reconhece `image_back_ajuste`. Há também um bug achado aqui: a regex é montada numa string com `"(_\d+)?"`, e o `\d` vira `d`. Com isso `text_back_2` não é traduzido na prévia do painel, que é o único chamador (`EnginePreview.tsx:111`). A correção é trocar por `"(_\\d+)?"` e aceitar sufixo de chave lateral;
  - `rotuloDaChave` precisa de rótulos para as chaves novas.
- **Multi-CNPJ:** a prova e o PNG usam o `company_id` do **pedido**, não o da empresa ativa. No consolidado, a lista de pedidos mistura empresas e a config do produto precisa ser buscada na empresa certa.

## 5. Coordenação por arquivos (implementação)

| Frente | Arquivos | Conflito |
|---|---|---|
| Função pura de diagramação (`layoutDaArte`) | novo `visualEngine/layoutDaArte.ts` | nenhum (arquivo novo) |
| Os três motores passam a ler o layout | `compose2d.ts`, `compose3dMug.ts`, `PersonalizationPreview.tsx` | **Fable** (realismo 3D e cenário). Combinar a ordem: a função entra antes, e cada motor muda num PR pequeno |
| Editor da cliente | `produto/ArteDaPeca.tsx`, `EnvioDaArte.tsx`, `PalcoDoProduto.tsx`, novo `produto/EditorDaArte.tsx` | nenhum conhecido |
| Técnica e teste no produto | `StudioPersonalizacaoPanel.tsx`, `customizationConfig.ts` | nenhum conhecido. **`TabStudioAparencia.tsx` não é tocado** (outro agente) |
| Prova do pedido | `app/studio/(estudio)/pedidos/[id].tsx`, `ficha/[id].tsx`, `ApprovalRequestModal.tsx` | o agente do orçamento com vídeo pode tocar no modal de aprovação; confirmar |
| Backend | `app.js` (parser por rota), `repetirPedido.js`, `studioStorefront.js` (limites) | mergear antes do front |

Não há wizard novo: o editor é uma tela única com "Pronto", então a regra do TrocaModal não se aplica. O hover-reveal da alça fica sempre visível em `@media (hover: none)`. Os tours, se houver, seguem spotlight com rolagem automática.
