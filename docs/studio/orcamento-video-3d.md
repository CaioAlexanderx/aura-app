# Orçamento em vídeo 3D pelo WhatsApp — desenho técnico

28/09/2026 · desenho aprovado pelo PO com ajustes e implementado (fase 2).
Mockup: [`docs/mockups/studio-orcamento-video-3d.html`](../mockups/studio-orcamento-video-3d.html)

A lojista abre um orçamento, grava um vídeo de 7 s da peça girando em 3D, com a arte e a cor do cliente, e manda o vídeo **embutido na mensagem do WhatsApp** do cliente, com os valores e as condições de pagamento por extenso.

**Não há link, página pública nem token neste fluxo.** A conversa segue no WhatsApp da lojista. No painel, o orçamento fica em aberto até ela **Aprovar** (vira pedido na Produção) ou **Fechar** (encerra sem venda).

---

## 1. Decisões do PO (28/09/2026)

| # | Decisão |
|---|---|
| 1 | Entrada só pelo orçamento nesta fase. |
| 2 | Sem link e sem endereço público: o vídeo vai embutido na mensagem. O compartilhamento com arquivo é usado em todo aparelho que oferece (celular e computador). Onde não oferece: baixar o MP4, copiar o texto, abrir a conversa do cliente (wa.me) e arrastar o vídeo. |
| 3 | O Studio não tem planos próprios: sem gate de plano e sem módulo vendável para a ação. |
| 4 | Logo pequeno no canto do vídeo. |
| 5 | Desconto é **sempre** o que a lojista define no orçamento. Sem definição, sem desconto. Nada é pré-preenchido pela configuração da loja (o desconto do Pix do canal digital não entra), e nada é empilhado por conta própria. |
| 6 | O vídeo fica guardado 30 dias, com "Manter por mais 30 dias". |
| 7 | Não há página do orçamento para o cliente. O orçamento fica em aberto: **Fechar** encerra sem venda; **Aprovar** vira pedido na esteira da Produção, com itens, arte, valores e condições combinadas. "Pedir ajuste" público saiu. |
| 8 | 7 s em 4:5 (1:1 se cortar a camiseta). |
| 9 | Peça sem 3D: seguir com a foto. |
| 10 | WebCodecs + `mediabunny`, carregado só no modal. |

---

## 2. Fluxo

```
Orçamento (rascunho ou enviado) › "Enviar em vídeo 3D"
  1 Peça     item com produto, cor da peça, arte (texto e imagem). Viewer 3D ao vivo.
             A arte ajustada volta para o customization do item (rascunho).
  2 Valores  condições da LOJISTA: Pix %, parcelas sem juros, sinal %, prazo,
             validade, observação. Vazio = fora da mensagem. PUT …/condicoes.
  3 Prévia   grava o giro (7 s, 720×900, MP4) · guarda 30 dias (PUT …/video)
             · mensagem pronta e editável, sem link
  4 Enviar   compartilhar com arquivo (celular e computador)
             ou baixar + copiar + abrir a conversa (wa.me) + "Já mandei"
  ✓ Enviado  POST …/marcar-enviado (status 'sent', sem token)

Depois, no editor do orçamento:
  Aprovar  → POST …/aprovar → pedido pending_art na Produção + marco de sinal
  Fechar   → POST …/fechar  → status 'closed' ("Encerrado")
  Vídeo    → Baixar · Manter por mais 30 dias
```

O modal segue o DNA do TrocaModal: subtítulo por passo, barra numerada, rodapé com resumo e Voltar/Continuar, passo final sem barra e confirmação de saída. No celular é tela cheia. É web-only (canvas, WebGL e WebCodecs), então o editor não mostra o botão no app nativo.

Arquivos: `components/studio/orcamentoVideo/` (`OrcamentoVideoModal.tsx`, `gravarGiro.ts`, `envioNoWhatsApp.ts`, `mensagemDoOrcamento.ts`, `condicoesDoOrcamento.ts`, `pecaDoOrcamento.ts`, `videoDoOrcamentoApi.ts`), mais o editor `app/studio/(estudio)/gestao/orcamentos/[id].tsx` e a lista `gestao/orcamentos.tsx`.

---

## 3. Gravação

- **Onde:** no navegador da lojista, com o mesmo `createModelViewer` da vitrine, cenário `"estudio"` no papel da vitrine. O canvas fica no documento, fora da vista, porque o viewer mede o canvas pela tela e fora do DOM cairia na proporção da vitrine.
- **Quadro:** um canvas 2D de 720 × 900 recebe a peça e, por cima, o selo da loja (logo ou iniciais) no canto inferior direito. Um logo sem CORS sujaria o canvas e travaria o encoder, então nesse caso sai o selo com iniciais.
- **Giro:** velocidade constante, 210 quadros (30 fps × 7 s), começa de frente e fecha a volta sem repetir o quadro. O vídeo repete sem pulo. O ângulo exato de cada quadro vem de `renderizarQuadro(rotacaoY)`, o gancho aditivo no viewer (commit separado).
- **Formato, na ordem:**
  1. **WebCodecs (H.264) + `mediabunny`** → MP4 com `fastStart` (o `moov` vem antes do `mdat`). É quadro a quadro, sem depender de tempo real. Medido no navegador do painel: 1,1 MB, 7,0 s, 720×900, gravado em ~9 s.
  2. **MediaRecorder** sobre o quadro composto, preferindo `video/mp4;codecs=avc1…` e caindo para WebM.
  3. WebM: o modal avisa que alguns iPhones não tocam no WhatsApp.
  4. Nenhum: segue com a **foto** (JPEG do quadro de frente).
- **Sem 3D:** foto pelo modelo 2D vinculado ou pelo Mockup na foto (`exportPng`, o mesmo da aprovação). Sem nenhum dos dois, vai só a mensagem.
- **Bundle:** `import("mediabunny")` dinâmico. No `expo export -p web` ele sai num pedaço separado (~810 kB), baixado só quando a lojista grava. O `entry` não o carrega.

---

## 4. Envio

| Navegador | Caminho |
|---|---|
| Tem `navigator.canShare({ files })` (celular; Chrome/Edge no Windows; Safari/Chrome no macOS, onde o WhatsApp Desktop aparece) | "Compartilhar no WhatsApp": `navigator.share({ files: [mp4], text })`. A lojista escolhe a conversa. A mensagem também vai para a área de transferência, porque alguns iPhones descartam o texto junto de arquivo. |
| Não tem | "Baixar, copiar e abrir a conversa": baixa o MP4, copia o texto e abre `wa.me/55<número>?text=…`. A lojista arrasta o vídeo e toca em "Já mandei". |

- O `navigator.share` exige toque recente, por isso o vídeo é gravado antes, no passo 3.
- Conta como enviado quando o compartilhamento resolve (`AbortError` volta ao passo 4 sem marcar nada) ou no "Já mandei".
- O telefone do cliente só vai no destino do `wa.me`. Nenhuma URL nossa leva dado do cliente.
- Nunca manda nada sozinho: quem envia no WhatsApp é a lojista.

---

## 5. Backend (Aura-backend)

### Migration `361_studio_orcamento_em_video.sql`

Aditiva, idempotente e sem nada de sessão (o runner roda cada migration numa transação do pooler, backend#769). Testada no PGlite, duas vezes seguidas.

- `studio_quotes.condicoes jsonb`: `{ pix_desconto_pct, parcelas, prazo_dias_uteis, observacao }`, tudo opcional.
- `video_key`, `video_content_type`, `video_bytes`, `video_formato` (telemetria), `video_gerado_em`, `video_expira_em` + índice parcial.
- `canal_envio` (`compartilhar | whatsapp | baixar | copiar`).
- Status `closed`. O CHECK da 138 é inline, então é achado pela definição (`status` e `'converted'`) e recriado.

### Rotas (em `/companies/:id/studio`, mesmo gate de `studioQuotes`)

| Rota | O quê |
|---|---|
| `PUT /quotes/:qid/condicoes` | Condições da lojista + sinal (%) e validade. Só orçamento em aberto. Devolve os valores calculados. |
| `PUT /quotes/:qid/video?formato=` | Corpo **binário** (`video/mp4` ou `video/webm`, até 12 MB) com `express.raw` só nesta rota; o JSON global de 5 MB não entra. Grava no R2 em `orcamento-video/<company>/<quote>/…`, expira em 30 dias e apaga o vídeo anterior. |
| `GET /quotes/:qid/video` | O arquivo, só para o painel autenticado (`private, no-store`). 410 se expirou. Nenhuma URL do vídeo sai para fora. |
| `POST /quotes/:qid/video/manter` | +30 dias a partir do maior entre hoje e a data atual, com teto de 365 dias. |
| `POST /quotes/:qid/marcar-enviado` | `draft | sent` → `sent`, `sent_at`, `expires_at` pela validade e `canal_envio`. **Sem token.** |
| `POST /quotes/:qid/fechar` | → `closed` (idempotente). |
| `POST /quotes/:qid/aprovar` | `draft | sent | accepted` → pedido `pending_art` com itens e `customization`, marco de sinal e as condições nas notas (`notasDoPedidoAprovado`). O orçamento vira `converted`. Idempotente. O `convert` antigo continua exigindo `accepted`. |

- **Expiração:** `src/jobs/orcamentoVideoExpiryJob.js` roda diariamente às 03h10 BRT e uma vez após o boot. Apaga do R2 e limpa as colunas. Kill switch: `STUDIO_QUOTE_VIDEO_EXPIRY_ENABLED=false`. Não é uma regra de ciclo de vida do R2, que conta a idade desde o upload e não sabe da prorrogação.
- **Página pública antiga:** `/orcamento/:token` (orçamentos enviados pelo fluxo de link) mostra `closed` como expirado.

---

## 6. Dinheiro

- Pix: regra canônica em centavos (`precoDoStudio.descontoDoPix`, espelhada em `condicoesDoOrcamento.ts`), `Math.round(totalCentavos × (100 − pct) / 100)`, sobre o total do orçamento. Por exemplo, R$ 532,80 a 5% dá R$ 506,16.
- Cartão: total ÷ parcelas, "sem juros" porque é a lojista quem declara.
- Sinal: `deposit_pct` / `deposit_amount` do orçamento.
- A mensagem lista itens, desconto do orçamento (se houver), total e só as condições preenchidas. Sem emoji e sem link.

---

## 7. Multi-CNPJ

O orçamento pertence a um CNPJ. Toda rota filtra por `id` **e** `company_id`, e o teste cobre o 404 para outra empresa. O editor só abre com uma empresa escolhida (no consolidado não há `companyId`). O modal usa a marca (nome e logo) dessa empresa. O pedido aprovado nasce no mesmo CNPJ.

---

## 8. Cloud API depois

O passo 4 é uma lista de caminhos. A Cloud API entra como "Enviar pela Aura" (template com cabeçalho de vídeo = o MP4 guardado, corpo com parâmetros, **sem botão de link**), pelo número da loja conectado no Aura Atende. Os status `sent/delivered/read` do webhook entrariam na linha do tempo. O `canal_envio` ganharia `cloud_api`.

---

## 9. Riscos e limites

- **MP4 fragmentado do MediaRecorder (caminho 2):** tocar no WhatsApp precisa de teste em aparelho real. O caminho 1 é o principal.
- **Enquadramento 4:5 da camiseta:** validar. Se cortar, 1:1.
- **Texto que some no iPhone** ao compartilhar arquivo: mitigado com a área de transferência.
- **Pix com desconto manual:** quando o orçamento já tem desconto manual e a lojista também preenche Pix, o Pix incide sobre o total já com o desconto (os dois são dela). Confirmar com o PO se deve bloquear a combinação.
- **Teste de ponta a ponta com WhatsApp real:** só com número de teste da equipe, nunca com cliente.
