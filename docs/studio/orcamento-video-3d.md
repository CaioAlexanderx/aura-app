# Orçamento em vídeo 3D pelo WhatsApp — desenho técnico (fase 1)

28/09/2026 · status: **desenho para aprovação do PO**, sem código de produção.
Mockup: [`docs/mockups/studio-orcamento-video-3d.html`](../mockups/studio-orcamento-video-3d.html)

A lojista abre um orçamento, grava um vídeo curto da peça girando em 3D, com a arte e a cor do cliente, e manda para o WhatsApp do cliente junto com os valores e as condições de pagamento. O cliente assiste, aprova ou pede ajuste num link com a marca da loja.

---

## 1. O que já existe e é reaproveitado

| Peça | Onde | Uso aqui |
|---|---|---|
| Orçamento com token público, aceite e recusa | `gestao/orcamentos/[id].tsx`, `app/orcamento/[token].tsx`, backend `studioQuotes.js` e `studioQuotePublic.js` | É a base. O vídeo e as condições entram **no orçamento que já existe**, sem criar outra entidade. |
| Gravação do giro (F5, 03/07) | `compose3dMug.ts` → `recordTurntable(ms)` (captureStream + MediaRecorder, webm) e `gerarRenderAprovacao.ts` | Mesmo viewer, mesma arte (`valoresDoMotor`). A gravação ganha MP4 (ver §4). |
| Upload para o R2 e registro do render | `POST /studio/upload-mockup`, `studio_visual_renders` (kind `turntable_video`) | O registro do vídeo é o mesmo. O upload ganha rota própria por causa do tamanho (§6). |
| Página com a marca da loja em `/<slug>/…` | `app/[slug]/aprovacao/[token].tsx`, casca do backend (BE-1, `storefront.js`) | A página do orçamento passa a morar em `loja.getaura.com.br/<slug>/orcamento/<código>`, com a prévia do link mostrando a peça. |
| Regras de dinheiro | `precoDoStudio.descontoDoPix` (centavos), `parcelamento.js` (piso R$ 5, teto da loja), `prazoDaSacola` | Todas as condições saem do servidor, pelas mesmas funções da vitrine. Nenhuma conta nova no app. |

**Achado durante a exploração (bug real, fora desta tela):** o PR #822 (acentuação de 1.383 strings) trocou `"video/webm"` por `"vídeo/webm"` em três lugares de código: `compose3dMug.ts` linhas 1020 e 1031 e `gerarRenderAprovacao.ts` (fallback do `contentType`). O MIME inválido faz o `new MediaRecorder(stream, { mimeType })` lançar exceção. Hoje o `catch` cai no construtor sem opções e o vídeo sai, mas sem o bitrate de 6 Mbps. Se o Blob vier sem tipo, o upload leva 400 (`content_type inválido`). A correção é de uma linha em cada ponto. Não corrigi porque o `visualEngine` está com outro agente. Está listada na §13 para entrar com o gancho de gravação.

---

## 2. Fluxo

```
Lojista (painel)                                     Cliente (WhatsApp)
────────────────                                     ──────────────────
Orçamento (rascunho ou enviado)
  └─ "Enviar em vídeo 3D"
       1. Peça     — item, cor da peça, arte do cliente (viewer 3D ao vivo)
       2. Valores  — total do orçamento + condições (Pix, cartão, sinal,
                     prazo, validade) calculadas pelo servidor
       3. Prévia   — grava o giro (7 s) · sobe em segundo plano ·
                     mensagem pronta, editável
       4. Enviar   — celular: compartilhar vídeo + texto no WhatsApp
                     computador: abrir a conversa do cliente com texto
                     e link (o vídeo toca na página)
       ✓ Enviado   — status 'sent', linha do tempo                 ──►  vídeo + mensagem
                                                                          │
                                        loja.getaura.com.br/<slug>/orcamento/<código>
                                                                          │
                                         Aprovar · Pedir ajuste · Falar com a loja
                                                                          │
Sino + linha do tempo do orçamento  ◄──────────────────────────────────────┘
```

### Onde a lojista começa

1. **No orçamento** (principal): botão "Enviar em vídeo 3D" ao lado de "Enviar ao cliente", no editor (`gestao/orcamentos/[id]`), para orçamentos em `draft` ou `sent` que tenham ao menos um item com produto. Em orçamento já enviado, a mesma ação reenvia com vídeo **sem trocar o link**, porque o `/send` já preserva o token.
2. **No produto** (proposta, depende do PO): em Catálogo › peça › "Orçar em vídeo". Cria um rascunho de orçamento com a peça (quantidade 1, preço do motor de precificação) e abre o mesmo modal no passo 1. O cliente é informado no passo 4.
3. **Fora da fase 1:** PDV (`QuoteModal`) e "Orçamento em lote" da vitrine. O PDV gera PDF sem salvar orçamento, e o vídeo precisa de um orçamento salvo para ter link.

Na lista de orçamentos, o orçamento com vídeo ganha um selo "▶ vídeo". A ação rápida da linha **não** depende de hover: fica sempre visível num botão de ícone. Com `@media (hover: hover)` ela só ganha destaque, conforme a regra 7 do CLAUDE.md.

---

## 3. O modal (DNA TrocaModal)

A casca é a do TrocaModal: cabeçalho com ícone, título e subtítulo por passo, barra de passos numerados, corpo com rolagem, rodapé com um resumo à esquerda e "← Voltar" / "Continuar →" à direita, passo final sem barra e confirmação de saída ("Descartar o vídeo?") quando já há gravação. No celular vira folha de tela cheia.

| Passo | Conteúdo | Pode avançar quando |
|---|---|---|
| **1 · Peça** | Itens do orçamento com mockup 3D (os sem 3D aparecem com o motivo e o atalho para Aparência). Viewer ao vivo, que dá para girar com o dedo. Cor da peça (as cores do produto) e arte do cliente (do `customization` do item). Vista inicial: frente ou costas. | Há um item com 3D, ou a lojista escolheu "seguir com foto" |
| **2 · Valores** | Linha do item e total **lidos do orçamento** (para mudar preço, "Editar orçamento"). Condições com chave liga/desliga: Pix com desconto, cartão em até N×, sinal, prazo e validade. O valor de cada uma vem de `GET …/condicoes`. | Sempre |
| **3 · Prévia** | Grava o giro assim que o passo abre. Estados: *gravando* (progresso), *pronto* (duração, formato, tamanho, "Gravar de novo"), *falhou* ("Tentar de novo" / "Seguir com foto") e *sem suporte* (segue com foto e link). O upload começa quando a gravação termina, em segundo plano. Ao lado fica a prévia da mensagem, com o texto editável. | Vídeo pronto **ou** a lojista escolheu seguir com foto |
| **4 · Enviar** | Para quem: nome e WhatsApp do orçamento, editáveis. Os caminhos de envio dependem do aparelho (§5). | Upload concluído e telefone válido (10 ou 11 dígitos) |
| **✓ Enviado** | Confirmação e linha do tempo (enviado, cliente abriu, resposta). "Voltar ao orçamento". | — |

O rodapé mostra o total e a condição principal ("R$ 478,80 · R$ 454,86 no Pix"), como o "Cliente paga R$ …" do TrocaModal.

---

## 4. Gravação do vídeo

**Onde:** no navegador da lojista, com o mesmo `createModelViewer` da vitrine e da aprovação, num canvas fora da tela. Não há renderização no servidor e o custo de infraestrutura é zero, como na F5.

**Parâmetros:** 720 × 900 (4:5, ocupa bem a conversa no celular), 30 fps, **7 s** para uma volta completa (começa e termina de frente, sem cortes ao repetir), sem áudio e com até ~3 Mbps. Um vídeo sai com ~2–3 MB. Fundo: o cenário de estúdio do viewer. Marca da loja: logo pequeno num canto (decisão do PO, Q4).

**Formato, em ordem de preferência** (detectado na hora, sem depender de user-agent):

1. **WebCodecs `VideoEncoder` (H.264 `avc1.42001f`) + muxer MP4** (`mediabunny`, sucessor do `mp4-muxer`, MIT, sem dependências e importável só no modal). Renderiza **quadro a quadro no ângulo exato** e não depende de tempo real. O giro sai liso mesmo em celular fraco, e o MP4 sai com `moov` no início (fast start), que é o formato que o WhatsApp e o iPhone tocam sem reclamar. Funciona em Chrome/Edge 94+, Safari 16.4+ e Firefox 130+ (este último só se o sistema tiver H.264).
2. **MediaRecorder `video/mp4;codecs=avc1`**: Chrome 126+ e Safari 14.1+. Grava em tempo real e sai MP4 fragmentado. O WhatsApp aceita, mas precisa de teste em aparelho real (ver riscos).
3. **MediaRecorder `video/webm`**: só Firefox antigo. O vídeo serve **para a página**, mas não vai como arquivo no WhatsApp (o iPhone pode não tocar). O passo 4 esconde "Compartilhar vídeo" e oferece texto e link.
4. **Nada disso**: estado *sem suporte*. Segue com a **foto** da peça (`snapshot()` em JPEG) e o link.

**Transcodificação no servidor (ffmpeg): não na fase 1.** Custaria ~80 MB a mais na imagem do Railway e 1–3 s de CPU por vídeo, para cobrir o caso 3, que é residual. Volta à mesa se a telemetria (`formato` gravado por envio, §6) mostrar mais de 3 % de webm.

**Poster:** o primeiro quadro, em JPEG 720 × 900 (~60 kB). Serve para o `<video poster>`, para a prévia do link no WhatsApp (`og:image`) e como plano B quando o vídeo expirar.

**Reuso:** o `content_hash` que o `studio_visual_renders` já calcula (template + versão + customização + cor) evita gravar de novo quando a lojista reenvia o mesmo item sem mudar nada.

---

## 5. "Direto para o WhatsApp do cliente": os três caminhos

O `wa.me` só leva texto. Mandar arquivo pela API oficial depende da Cloud API (Aura Atende), que fica para depois (§11). Na fase 1:

| Aparelho da lojista | Caminho principal | Alternativas |
|---|---|---|
| **Celular** com `navigator.canShare({ files: [mp4] })` | **"Compartilhar no WhatsApp"**: `navigator.share({ files: [video.mp4], text })` abre a folha do sistema, a lojista toca em WhatsApp e escolhe a conversa. Vídeo e legenda chegam juntos. | "Só texto e link, direto na conversa do cliente" (`wa.me/55…?text=`) · "Baixar vídeo" · "Copiar mensagem" |
| **Computador** (ou celular sem compartilhamento de arquivo) | **"Abrir conversa com Mariana"**: `wa.me/55<telefone>?text=` com a mensagem e o link. A prévia do link mostra o poster da peça (§7) e o vídeo toca na página. | "Baixar vídeo" (para arrastar no WhatsApp Web) · "Copiar mensagem" · "Compartilhar…" quando o `canShare` com arquivo também existir no desktop (Windows/Chrome) |

Detalhes que decidem se funciona:

- **Gesto do usuário.** O `navigator.share` exige um toque recente. Por isso o vídeo é gravado **antes**, no passo 3, e o botão do passo 4 só entrega o `File` que já está na memória. Gravar dentro do clique estouraria a janela de ativação (~5 s).
- **Contato não é pré-selecionável** no compartilhamento. O passo 4 mostra em destaque "Escolha a conversa da **Mariana · (11) 98765-4321**".
- **Texto que some no iPhone.** Algumas versões do WhatsApp no iOS descartam o `text` quando recebem arquivo. Por isso, antes de abrir a folha, a mensagem vai para a área de transferência, e a tela avisa: "Se a mensagem não aparecer, cole na conversa".
- **Quando conta como "enviado":** no compartilhamento, quando a promessa resolve (o `AbortError` volta ao passo 4 sem marcar nada). No `wa.me`, no clique. Em "Baixar" e "Copiar", só quando a lojista toca em "Já mandei". Em todos os casos, é aí que o app chama `POST …/send` com o `canal` usado.
- **Privacidade:** o telefone do cliente só entra no `wa.me/<número>` (que é o destino) e nunca numa URL nossa. O link público não leva nome nem telefone.

---

## 6. Backend

### Migration `359_studio_quote_video.sql`

```sql
ALTER TABLE studio_quotes
  ADD COLUMN IF NOT EXISTS codigo_publico   text UNIQUE,      -- 10 chars base62, opaco (link curto)
  ADD COLUMN IF NOT EXISTS video_render_id  uuid REFERENCES studio_visual_renders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS video_poster_url text,
  ADD COLUMN IF NOT EXISTS condicoes        jsonb,            -- congeladas no envio (ver §8)
  ADD COLUMN IF NOT EXISTS canal_envio      text,             -- compartilhar | wa_me | baixar | copiar | cloud_api
  ADD COLUMN IF NOT EXISTS ajuste_pedido_em timestamptz,
  ADD COLUMN IF NOT EXISTS ajuste_nota      text;

ALTER TABLE studio_visual_renders
  ADD COLUMN IF NOT EXISTS studio_quote_item_id uuid,
  ADD COLUMN IF NOT EXISTS formato text,                      -- 'mp4-webcodecs' | 'mp4-mediarecorder' | 'webm' (telemetria)
  ADD COLUMN IF NOT EXISTS duracao_ms int;
```

Não entra status novo. "Pedir ajuste" mantém `sent` e preenche `ajuste_*`, porque o `CHECK` de status e a lista do painel não precisam mudar. Aplicar no Supabase antes do merge (convenção do repo). Tudo é opcional: backend sem a 359 segue respondendo como hoje.

### Rotas

| Rota | O quê |
|---|---|
| `GET /studio/quotes/:qid/condicoes` | Calcula as condições pelo servidor, a partir do total do orçamento e da configuração da **empresa do orçamento**: `pix_discount_pct` → `descontoDoPix`, `card_max_installments` → `parcelasDoPreco`, sinal (`deposit_pct`/`deposit_amount`), prazo (`prazoDaSacola` com as faixas e `default_sla_days`), validade. Devolve valores e textos prontos. |
| `PUT /studio/quotes/:qid/video` | Corpo **binário** (`express.raw({ type: ['video/mp4','video/webm'], limit: '12mb' })` só nesta rota, porque o `express.json` global é de 5 MB e o base64 incha 33 %). Cabeçalhos `X-Duracao-Ms` e `X-Formato`. Grava no R2 em `orcamento-video/<company_id>/<quote_id>/<hash>.mp4`, registra em `studio_visual_renders` e liga em `studio_quotes.video_render_id`. Idempotente pelo `content_hash`. |
| `PUT /studio/quotes/:qid/video-poster` | JPEG binário, até 1 MB, com o mesmo prefixo. |
| `POST /studio/quotes/:qid/send` | Ganha corpo opcional `{ canal, mostrar: { pix, cartao, sinal, prazo } }`. Recalcula e **congela** `condicoes`, gera `codigo_publico` se faltar e devolve `quote_url` (curto, §7) além do que já devolve. Sem corpo, o comportamento é o de hoje. |
| `GET /orcamento/:token` | Aceita o token de 64 hex **ou** o `codigo_publico`. Acrescenta `video: { url, poster_url, content_type } \| null` e `condicoes` (as congeladas). Passa a mandar só o **primeiro nome** do cliente, como o Matcon já faz. |
| `POST /orcamento/:token/respond` | Nova `action: 'request_changes'` com `note` obrigatória (até 1.000 caracteres). Grava `ajuste_*` e notifica a loja pelo sino (`notifyCompany`, dedupe por orçamento e dia). O `accept` também passa a notificar pelo sino. |
| Casca `/:slug/orcamento/:codigo` | Entra em `PAGINAS_DA_VITRINE_STUDIO` com `indexar: false`, e `servirPaginaDaLoja` ganha as metatags do orçamento: `og:title` "Orçamento · <Loja>", `og:image` o poster e `og:description` "Toque para ver a peça em vídeo". Nada de nome, telefone ou valor nas metatags. |

No app: a rota `app/[slug]/orcamento/[codigo].tsx`. Para não colidir com o orçamento em lote em `/<slug>/orcamento`, o `orcamento.tsx` vira `orcamento/index.tsx`. `/orcamento/<token>` na raiz continua funcionando para os links que já circulam.

---

## 7. A página do orçamento (o que o cliente vê)

A base é `app/orcamento/[token].tsx`, reaproveitada como componente dentro da casca da loja (mesmo padrão da `PaginaDaAprovacao`):

- **Topo:** a marca da loja (logo, nome, cores e tipografia da vitrine), igual à de hoje.
- **Vídeo em destaque** (`<video autoplay muted loop playsinline poster>`), com a legenda "Sua caneca, do jeito que vai ficar". Se o vídeo expirou, fica o poster com "O vídeo deste orçamento não está mais disponível".
- **Itens e total**, como hoje.
- **Condições:** o Pix em destaque, cartão, sinal com valor, prazo e "Vale até DD/MM".
- **Ações:** **Aprovar orçamento** (primária), **Pedir ajuste** (abre um campo, "O que você quer mudar?") e **Falar com a loja** (wa.me da loja). "Não quero seguir" (a recusa de hoje) fica como link discreto.
- **Estados:** aberto, aprovado ("A loja já foi avisada e vai te chamar para o sinal"), ajuste pedido ("A loja recebeu seu pedido de ajuste"), expirado.
- Por enquanto a página não cobra o sinal. Pix do sinal ou link do Aura Pay depois do aceite fica para uma fase seguinte (§12).

**Link curto:** `loja.getaura.com.br/<slug>/orcamento/<código de 10 caracteres base62>`, com ~59 bits, opaco e sem sequência. Com domínio próprio, sai no domínio da loja, pelo middleware que já existe. Se a loja não tem vitrine publicada, cai em `app.getaura.com.br/orcamento/<token>` (sem a prévia da peça).

---

## 8. Valores e condições

- **Fonte única no servidor.** O app não calcula Pix nem parcela. Mostra o que `GET …/condicoes` devolve, e a mensagem do WhatsApp é montada a partir desse mesmo objeto (`mensagemDoOrcamentoEmVideo(condicoes, cliente, link)`, função pura com teste de snapshot).
- **Pix:** `descontoDoPix(total do orçamento, pix_discount_pct)`, em centavos. Aplica-se sobre o **total já com o desconto manual** do orçamento (Q5). Só aparece se a loja tem Pix e `pix_discount_pct > 0`.
- **Cartão:** `parcelasDoPreco(total, card_max_installments)`, com piso de R$ 5 por parcela e teto de 12. O texto diz "sem juros" porque é a política declarada pela loja, que é o mesmo critério da vitrine.
- **Sinal:** `deposit_pct`/`deposit_amount` do próprio orçamento.
- **Prazo:** `prazoDaSacola(default_sla_days, linhas)`, que pega o maior `lead_days` das faixas e diz "depois que você aprovar a arte".
- **Congelamento:** no envio, `condicoes` é gravado no orçamento. Se a lojista mudar o desconto do Pix na loja amanhã, o orçamento enviado continua mostrando o que foi prometido. Reenviar recalcula.

---

## 9. Gates de plano e módulo

- **Sem módulo novo e sem tela nova:** é um modal dentro de Orçamentos, que já é do Studio e aberto a todos os planos que têm Studio (o comentário do `QuoteModal` diz "Disponível em todos os planos"). A regra 3 do CLAUDE.md (chave `mod` própria) vale para tela nova, e não se aplica aqui.
- **Custo marginal:** a gravação roda no aparelho da lojista, e sobra só o R2 (~3 MB por vídeo, fração de centavo por mês). Não há motivo de custo para gate.
- **Se o PO quiser vender separado (Q3):** chave `studio.orcamento_video` em `MODULE_PLAN_MAP` e `PERM_TO_MODULES`. No plano sem acesso, o botão **some**, sem ficar desabilitado e sem cartão de upgrade (premissa do Essencial, 16/09).
- **Permissão:** a mesma de editar orçamento no Studio.
- **Fase Cloud API:** o caminho "Enviar pela Aura" só aparece com `hub_social`/`whatsapp` ativos e o número conectado. Sem isso, some.
- **Plano stale (armadilha 1):** se entrar gate, o modal faz `refetch /auth/me` ao abrir, antes de decidir o que mostrar.

---

## 10. Multi-CNPJ

- O orçamento pertence a **um** CNPJ (`studio_quotes.company_id`). Tudo do fluxo sai **desse** CNPJ: marca, slug e domínio do link, `pix_discount_pct`, `card_max_installments`, prazo, logo no vídeo e WhatsApp da loja na página. Nada é agregado entre empresas do grupo.
- Todas as chamadas usam `quote.company_id`, nunca a empresa da sessão. No **consolidado**, a lista mostra o chip do CNPJ, e o modal mostra "Emitido por **Ateliê Lume · Centro** (12.345.678/0001-90)" no cabeçalho.
- Produto compartilhado no grupo (migration 355): o template 3D é lido da **empresa dona do produto**. Preço e condições continuam do CNPJ do orçamento.
- CNPJ sem vitrine publicada: o link cai em `app.getaura.com.br/orcamento/<token>` (§7).
- Cloud API (§11): o envio sai pelo número de WhatsApp **do CNPJ do orçamento**. Sem número conectado nesse CNPJ, o caminho não aparece, mesmo que outra empresa do grupo tenha um.

---

## 11. Como pluga na Cloud API depois

Na fase 1 nada no desenho muda para isso. O que já fica pronto:

- `canal_envio` aceita `cloud_api`, e o passo 4 é uma lista de caminhos. A Cloud API entra como **primeiro item**, "Enviar pela Aura (WhatsApp da loja)", sem mexer nos outros.
- `POST /studio/quotes/:qid/whatsapp` (futuro) usa o número do Aura Atende daquele CNPJ e envia um **template aprovado** `orcamento_video` (mensagem iniciada pela empresa, fora da janela de 24 h): cabeçalho `VIDEO` com `link` = URL do MP4 no R2 (a Cloud API aceita MP4 H.264 sem áudio, até 16 MB), corpo com parâmetros (primeiro nome, peça, total, Pix, parcelas, validade) e botão de URL dinâmica `https://loja.getaura.com.br/{{1}}` com sufixo `<slug>/orcamento/<código>`.
- Os status do webhook (`sent`, `delivered`, `read`) entram na linha do tempo do orçamento ("Entregue 14:33 · Lido 14:40"), o que o `wa.me` nunca vai dar.
- Custo: conversa de template por mensagem. A Meta pode classificar como **marketing** (preço de oferta), que é mais caro que utility. Validar a categoria na submissão do template.

---

## 12. Riscos

| Risco | Mitigação |
|---|---|
| MP4 fragmentado do MediaRecorder (caminho 2) não tocar em algum WhatsApp | O caminho 1 (WebCodecs) é o principal e sai com fast start. Teste de aceite em Android e iPhone reais antes do merge. |
| iPhone descarta o texto quando compartilha arquivo | A mensagem vai para a área de transferência antes, com o aviso "cole na conversa". |
| Lojista escolhe a conversa errada na folha de compartilhamento | Nome e telefone do cliente em destaque no passo 4. A página não expõe telefone e mostra só o primeiro nome. |
| Celular fraco engasga ao gravar | O caminho 1 renderiza quadro a quadro, sem tempo real. O caminho 2 grava a 24 fps se a medição de fps do primeiro segundo ficar abaixo de 20. |
| Vídeo maior que o limite | 720 × 900 a ~3 Mbps dá 2–3 MB, contra um limite de 12 MB na rota binária. |
| Vídeo com a foto/arte do cliente num link público | URL do R2 com hash não adivinhável, página por código opaco, `noindex`, expiração (§13). É o mesmo nível da aprovação de arte de hoje. |
| Framing do viewer em 4:5 (a câmera foi calibrada para a proporção da vitrine) | Validar com caneca e camiseta. Se cortar a asa, voltar para 1:1 (720 × 720). |
| Outro agente mexendo no viewer (realismo e cenário) | Só consumir a API pública. O gancho novo (§13) é aditivo e tem default seguro. |
| Prévia do link sem imagem em loja sem vitrine | Fallback no link do app, aceito como limitação. |

---

## 13. Armazenamento, expiração e gancho no viewer

- **R2:** prefixo próprio `orcamento-video/` (fora de `studio/<id>/…`) para permitir **uma regra de ciclo de vida** no bucket: apagar depois de **120 dias** (Q6). A regra de prefixo do R2 não aceita curinga no meio, por isso o `company_id` vem depois do prefixo. Não precisa de job.
- **Banco:** a linha em `studio_visual_renders` fica. A página trata 404 do vídeo mostrando o poster, e o poster tem o mesmo prazo.
- **Gancho proposto no viewer** (fase 2, em combinação com quem estiver no `visualEngine`):
  ```ts
  // Mug3DHandle — aditivo, default = comportamento de hoje
  renderizarQuadro?: (rotacaoY: number) => void;     // posiciona e renderiza de forma síncrona (para WebCodecs)
  recordTurntable: (durationMs?: number, opcoes?: {
    mimeTypes?: string[];        // ordem de preferência; default ['video/webm;codecs=vp9','video/webm']
    videoBitsPerSecond?: number; // default 6_000_000
    aoProgredir?: (t: number) => void;
  }) => Promise<Blob | null>;
  ```
  Mais a correção dos três `"vídeo/webm"` (§1). O `gerarRenderAprovacao` não muda de comportamento.

---

## 14. Fora do escopo da fase 1

- Envio pela Cloud API (§11), confirmação de entrega e leitura.
- Cobrar o sinal na página (Pix/Aura Pay depois do aceite).
- Transcodificação no servidor (ffmpeg).
- Vídeo com mais de um item (a fase 1 grava **um** item por vídeo; orçamento com várias peças usa a principal, escolhida no passo 1).
- Cartela final com preço dentro do vídeo (os valores mudam e ficam na mensagem, não no arquivo).
- PDV e "Orçamento em lote" da vitrine.
- Viewer 3D interativo na página pública (é vídeo: o que o cliente viu é o que foi gravado).

---

## 15. Decisões do PO

| # | Pergunta | Recomendação |
|---|---|---|
| Q1 | Entrada pelo produto (Catálogo › peça › "Orçar em vídeo") entra na fase 1, ou só pelo orçamento? | Só pelo orçamento na fase 1. O produto entra depois, com o mesmo modal. |
| Q2 | O link sai no endereço da loja (`loja.getaura.com.br/<slug>/orcamento/<código>`, com prévia da peça) ou no do app? | Endereço da loja. |
| Q3 | É para todos os planos com Studio ou vira módulo vendável (`studio.orcamento_video`)? | Todos os planos com Studio. O custo é quase zero, e o vídeo é o que vende a personalização. |
| Q4 | Logo da loja dentro do vídeo? | Sim, pequeno, num canto. O vídeo circula encaminhado e leva a marca junto. |
| Q5 | O desconto do Pix soma com o desconto manual do orçamento? | Sim: o Pix incide sobre o total já com o desconto do orçamento, como na vitrine (Pix sobre o subtotal). |
| Q6 | Por quanto tempo o vídeo fica disponível? | 120 dias (regra de ciclo de vida no R2). |
| Q7 | Entra "Pedir ajuste" na página pública (novo), além de aprovar e recusar? | Sim. A recusa vira link discreto, "Não quero seguir". |
| Q8 | Duração e formato: 7 s em 4:5? | Sim, validando o enquadramento da camiseta. Se cortar, 1:1. |
| Q9 | Item sem mockup 3D: oferecer "seguir com foto" (imagem + link) ou esconder a ação? | Oferecer a foto. A lojista não perde o fluxo, e a tela aponta onde vincular o 3D. |
| Q10 | Adotar WebCodecs + `mediabunny` (dependência nova, carregada só no modal) como caminho principal? | Sim. É o que garante MP4 que toca no iPhone e giro liso em celular fraco. |

---

## 16. Fase 2 (depois da aprovação)

1. **backend**: migration 359 + `…/condicoes`, `PUT …/video`, `…/video-poster`, `/send` estendido, `/orcamento/:token` estendido, `request_changes` + sino, casca `/:slug/orcamento/:codigo` com metatags. Testes em `__tests__/studio.orcamentoVideo.test.js`.
2. **app · visualEngine** (em combinação com quem estiver no motor): gancho `renderizarQuadro` / opções do `recordTurntable` + correção do `"vídeo/webm"`.
3. **app · modal**: `components/studio/orcamentoVideo/` (modal, passos, `gravarGiro.ts` com a cadeia de formatos, `enviarNoWhatsApp.ts` com a detecção de compartilhamento, `mensagemDoOrcamentoEmVideo.ts` puro e testado). Entrada no editor e selo na lista.
4. **app · página pública**: vídeo, condições, pedir ajuste e a rota `/<slug>/orcamento/[codigo]`.
5. Teste de aceite em aparelho real: Android (Chrome) e iPhone (Safari), compartilhando para um número de teste da própria equipe. **Nunca para cliente real.**

Backend mergeado antes do PR do app, conforme a convenção do repo.
