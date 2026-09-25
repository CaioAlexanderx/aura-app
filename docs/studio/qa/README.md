# QA da Vitrine Studio · Guia comum

Este guia vale para as duas frentes do QA da normalização da vitrine Studio (Fases 0 a 5):

| Frente | Arquivo | Quem é o usuário | IDs |
|---|---|---|---|
| 1 · Lojista | [QA_LOJISTA.md](QA_LOJISTA.md) | a dona da loja e a equipe, no painel `app.getaura.com.br` | `LJ-xx` |
| 2 · Cliente do lojista | [QA_CLIENTE.md](QA_CLIENTE.md) | quem compra na vitrine `loja.getaura.com.br/<slug>` | `CL-xx` |

A referência de "como deve ser" é, nesta ordem: os mockups aprovados (`docs/mockups/studio-vitrine-00-kit.html` a `05-home.html`), as decisões do PO (`docs/studio/FASEAMENTO_VITRINE_STUDIO.md` §0) e a jornada (`docs/studio/JORNADA_CLIENTE_VITRINE.md`). Quando a tela real e o mockup divergirem, a história diz qual dos dois vale; se não disser, registre a divergência como achado.

---

## 1. As lojas do QA

| Loja | Endereço | Vitrine nova | Pode comprar? |
|---|---|---|---|
| Loja de teste | `loja.getaura.com.br/aura-qa` | ligada | **Sim.** É sandbox (`is_sandbox`): não cobra de verdade e não dispara notificação real para clientes. |
| Loja real (piloto) | `loja.getaura.com.br/sheid-mania` | desligada | **Não.** Só olhar. |

### Regra de segurança (não negociável)

> Na **sheid-mania**, nunca finalize pedido, nunca envie arte, nunca pague, nunca peça orçamento em lote, nunca clique em "Aprovar" ou "Pedir ajuste" em link real. Ela vende todo dia: qualquer um desses cliques vira pedido, notificação ou cobrança de verdade para a lojista.
>
> Tudo que grava alguma coisa acontece na **aura-qa**.

Na sheid-mania o QA serve para duas coisas: ver a vitrine nova com a identidade de uma loja de verdade (fotos, cores, textos longos) e confirmar que, com a chave desligada, nada mudou para os clientes dela.

---

## 2. A chave `vitrine_v2`

Tudo que muda a tela da vitrine está atrás de uma chave por loja. As regras de preço e de pedido no servidor valem igual com a chave ligada ou desligada.

| Quero | Como |
|---|---|
| Ver a vitrine nova numa loja desligada | Acrescente `?v2=1` ao endereço. Exemplo: `loja.getaura.com.br/sheid-mania?v2=1`. |
| Ver a vitrine antiga numa loja ligada | Acrescente `?v2=0`. Exemplo: `loja.getaura.com.br/aura-qa?v2=0`. |
| Voltar ao padrão da loja | Feche a aba e abra uma nova, sem o parâmetro. |
| Ligar ou desligar de verdade para todos os clientes de uma loja | Hoje só pelo banco: `companies.studio_settings.vitrine_v2 = true/false`. O painel não tem botão. Pedir ao time técnico. |

Detalhes que confundem:

- O `?v2=` fica guardado **na aba**, por loja. Ele continua valendo depois que a vitrine troca a URL e o parâmetro some. Outra aba, outra janela anônima ou outro aparelho começam do padrão da loja.
- Cada história diz em qual estado da chave ela vale: `v2 ligada`, `desligada` ou `ambas`. Em `ambas`, rode duas vezes.
- Endereços antigos (`/aprovacao/<token>` e `/acompanhar/<token>` fora da loja) continuam funcionando nos dois estados.

---

## 3. Aparelhos e larguras

Rode cada fluxo principal pelo menos em um celular de verdade e em um computador. O navegador do computador em modo de aparelho **não** substitui o celular: teclado virtual, folha de compartilhar, Safari e toque só aparecem no aparelho real.

| Onde | Mínimo |
|---|---|
| iPhone | Safari, iOS atual. Se der, um iPhone pequeno (SE, 375 px). |
| Android | Chrome, um aparelho intermediário. Se der, um de 360 px. |
| Computador | Chrome e Safari (Mac) ou Edge (Windows). |
| Tablet | Um, em pé e deitado. |

Larguras de referência para conferir quebra de layout: **360, 390, 768, 1280 e 1440 px**, mais um notebook baixo de **1366 × 768** (é onde blocos presos na tela costumam cobrir conteúdo).

Condições que valem uma rodada à parte nos fluxos P0:

- Rede lenta: Chrome DevTools → Network → "Slow 3G" (ou 4G fraco no celular).
- Reduzir movimento ligado no aparelho (iOS: Acessibilidade → Movimento; Android: Acessibilidade → Remover animações).
- Leitor de tela: VoiceOver no iPhone, TalkBack no Android.
- Fonte do sistema aumentada (iOS: Tamanho do Texto no máximo sem acessibilidade extra).
- Modo escuro do aparelho ligado: a vitrine é tema claro (papel) e **não** deve inverter nem ficar ilegível.

---

## 4. Dados de teste

Os números abaixo são os de referência das histórias. Se a loja de teste tiver outro preço cadastrado, anote o valor real e refaça a conta; o que importa é a regra.

| Dado | Valor |
|---|---|
| Regra da arte | Serviço de arte pago ("vocês ajustam" ou "criem a arte") entra **uma vez por item da sacola**, não por unidade. CANECA BRANCA R$ 39,90 × 2 com ajuste de R$ 10,00 = **R$ 89,80** (e não R$ 99,80); no Pix de 10% da aura-qa, **R$ 80,82**. |
| Pix | aura-qa: **10%** de desconto; sheid-mania: sem desconto; o Pix pendente vence e o pedido cancela sozinho em **72 horas**. |
| CPF válido para teste | `529.982.247-25` |
| CNPJ válido para teste | `11.222.333/0001-81` |
| CPF inválido | `123.456.789-00` |
| CEP dentro da área | o CEP do endereço da loja de teste |
| CEP fora da área | `69900-000` (Rio Branco, AC) |
| CEP inexistente | `00000-000` |
| Nome longo | `Maria Aparecida dos Santos Figueiredo de Albuquerque` |
| Lista de nomes (lote) | `Ana, Bruno, Carla` numa linha cada; e `Silva, João` como **um** nome |
| Foto pequena | qualquer imagem com menos de 1200 px no lado maior |
| Foto boa | JPG de celular (3000 px ou mais) |
| Arquivo errado | um `.pdf` ou `.heic`, conforme o que a tela aceita |

Cores de loja para os testes de contraste (Design → cor dos botões, **só na aura-qa**):

| Nome | Cor | Por quê |
|---|---|---|
| Sheid | `#1a1612` | quase preta, é a real da piloto |
| Rosa | `#D6336C` | média, texto branco no limite |
| Amarela | `#F2C94C` | clara, texto branco some: a vitrine tem que trocar para texto escuro |
| Petróleo | `#0F6E7A` | escura fria |

Depois dos testes, volte a aura-qa para a cor original.

---

## 5. Severidade

A mesma escala das histórias, agora para os achados:

| Nível | Quando | Exemplo |
|---|---|---|
| **P0** | Quebra venda, dinheiro, dado ou confiança. Bloqueia ligar a chave na sheid-mania. | Total da sacola diferente do total do pedido; botão de pagar que não faz nada; link de aprovação que abre pedido de outra loja; CPF gravado errado. |
| **P1** | Funciona, mas a experiência fica claramente abaixo do premium. Corrigir antes de ligar para todas as lojas. | Botão flutuante cobrindo uma opção; texto cortado em 360 px; etapa atual parecendo não alcançada; erro sem dizer o que fazer. |
| **P2** | Acabamento. Pode ir para a fila. | Espaçamento 4 px fora; animação um pouco brusca; ícone desalinhado 1 px. |

### Como registrar um achado

```
[P1] CL-23 · iPhone 13 Safari · aura-qa · v2 ligada
O que fiz: abri a Caneca Alça Coração, escolhi "Criem a arte pra mim", rolei até o fim.
O que aconteceu: o botão "Tirar dúvida" cobre o preço da última opção.
O que eu esperava: nada coberto (critério premium 3 da CL-23).
Anexo: print ou vídeo curto.
```

Sempre: ID da história, aparelho e navegador, loja, estado da chave, passos, esperado × acontecido, print ou vídeo. Um achado por registro.

---

## 6. Checklist visual premium (vale para toda tela)

As histórias trazem critérios premium específicos. Estes aqui valem em **todas** as telas, das duas frentes, e não vêm repetidos em cada história. Passe por eles a cada tela nova que abrir.

### Tipografia
- [ ] Títulos na fonte escolhida pela loja (par tipográfico do Design), em todas as telas: home, produto, sacola, checkout, Pix, confirmação, aprovação, acompanhamento, erro.
- [ ] Todo número (preço, quantidade, contagem, CEP, código Pix, número do pedido, prazo em dias) em **Bricolage Grotesque**, com dígitos tabulares: numa coluna de preços, as vírgulas ficam alinhadas.
- [ ] Nenhum resquício de fonte mono (DM Mono) na vitrine.
- [ ] Texto corrido com no máximo uns 70 caracteres por linha no desktop; nenhuma linha solta de uma palavra só em título.
- [ ] Nada cortado com reticências onde a pessoa precisa ler (nome do produto, endereço, recado da loja).

### Cor e contraste
- [ ] Só a cor principal da loja pinta a vitrine. Uma segunda cor da loja (`accent_color`) nunca aparece.
- [ ] Texto sobre a cor da loja com contraste AA (4,5:1 para texto normal, 3:1 para texto grande). Com a amarela `#F2C94C`, o texto do botão fica escuro sozinho.
- [ ] Superfície papel quente em todas as telas da vitrine; texto secundário em `#756C61` ou mais escuro.
- [ ] Estados de erro em vermelho com ícone e texto, nunca só a cor.

### Toque, foco e movimento
- [ ] Todo alvo de toque com pelo menos **44 × 44 px**, com espaço entre alvos vizinhos.
- [ ] Hover (desktop), foco visível pelo teclado (anel nítido) e estado pressionado em todo botão e link.
- [ ] Nada de ação que só aparece no hover; no celular a mesma ação tem que estar visível.
- [ ] Movimento curto (até uns 300 ms) e suave; com "reduzir movimento" ligado, carrosséis param e transições viram corte seco.
- [ ] Nenhum salto de layout quando imagens ou preços carregam (reserve o espaço).

### Microcopy
- [ ] Voz da loja, "você", frases curtas.
- [ ] Botão diz o que acontece ("Pagar R$ 89,80 com Pix", não "Continuar" quando dá para ser específico).
- [ ] Erro diz o que houve e o que fazer ("Esse CEP não existe. Confira os números.").
- [ ] Nenhum emoji em lugar nenhum da vitrine; ícones sempre do mesmo conjunto.
- [ ] Nada de termo técnico para o cliente (token, payload, status, sandbox, 404).
- [ ] Português correto, acentos, crase; valores como "R$ 39,90" (espaço depois do R$).

### Estados
- [ ] Carregando: esqueleto com a forma da tela, não tela branca nem roda solta.
- [ ] Vazio: diz por que está vazio e oferece o próximo passo (sacola vazia leva de volta à loja).
- [ ] Erro: recado humano e "Tentar de novo"; a loja não some.
- [ ] Sucesso: confirmação clara e curta (ex.: "Adicionado" por cerca de 1,4 s).

### Navegação
- [ ] Voltar do navegador sempre leva à tela anterior que a pessoa viu, nunca para fora da loja nem para uma tela em branco.
- [ ] F5 em qualquer tela mantém a pessoa onde estava (sacola e pedido preservados).
- [ ] Link copiado de qualquer tela abre a mesma tela em outro aparelho.

### Painel do lojista (frente 1)
- [ ] Identidade do painel Studio: navy `#1E3A8A` e magenta `#EC4899`. A cor da loja só aparece nas **prévias** da vitrine.
- [ ] Salvar sempre dá retorno ("Salvo" ou erro com o que fazer) e não perde o que foi digitado se der erro.
- [ ] Toda mudança que afeta a vitrine diz onde ela aparece, e a prévia bate com a vitrine real.

---

## 7. Ordem sugerida

1. Guia comum (este arquivo) e a matriz de aparelhos.
2. Todas as histórias **P0** das duas frentes, na aura-qa, em um celular e um computador.
3. Regressão com a chave desligada (sheid-mania só olhando; aura-qa com `?v2=0` podendo comprar).
4. P1 e P2, frente por frente.
5. Rodada de acessibilidade e rede lenta nos fluxos P0.

Critério para ligar a chave na sheid-mania: **zero P0 aberto** e P1 de checkout, Pix e confirmação resolvidos.

---

## 8. Limitações conhecidas antes do QA

Não são achados novos; confira se continuam valendo e registre se piorarem.

- Domínio próprio (`www.minhaloja.com.br`): as rotas da vitrine nova esperam o slug no caminho. Limitação anterior ao projeto.
- A prévia 3D depende de uma biblioteca externa: confira sempre em aparelho real.
- Eventos de medição (GA4/Pixel) que acontecem antes do "Aceitar" dos cookies não são guardados para depois.
- O e-mail de confirmação ao cliente ainda não traz a marca da loja.
- A página de aprovação mostra um mockup por link (sem "item 1 de 2").
- A lista completa de pendências conhecidas por fase está nos "Pontos de atenção" de cada história.

---

## 9. Achados antecipados (antes da primeira rodada)

Ao escrever as histórias, os agentes cruzaram código, mockup e dados reais e já acharam problemas. A lista completa está no fim de cada frente. Estes pedem decisão do PO **antes** de ligar a chave na sheid-mania:

| # | Achado | Frente | Peso |
|---|---|---|---|
| 1 | O painel Studio não tem como confirmar o Pix de um pedido da vitrine nem ver o comprovante. O botão "Confirmar pagamento" só existe no Canal Digital, e a conta Studio não abre essa tela; o registro de pagamento do Studio só marca o sinal. Somado ao cancelamento automático em 72 h, um pedido pago por chave Pix, com comprovante mandado pelo WhatsApp e produção ainda parada, pode ser cancelado sozinho. Volume hoje: 1 pedido da vitrine Studio em 60 dias. | Lojista (LJ, achado A1) | P0 |
| 2 | Revisões inclusas = 0 significam "ilimitadas" no painel, mas a página de aprovação avisa "Esta seria a 1ª revisão" (paga). aura-qa e sheid-mania estão com 0. | Lojista A3 · Cliente | P0 |
| 3 | A lojista não recebe aviso quando a cliente aprova ou pede ajuste, embora a página diga que a loja foi notificada. | Lojista A4 | P0 |
| 4 | O detalhe do pedido Studio não mostra forma e situação do pagamento, modo de entrega, quem busca, CPF/CNPJ, a linha da arte, e mostra valores com ponto ("R$ 49.90"). | Lojista A2 | P0 |
| 5 | O voltar do navegador nas etapas 2 e 3 do checkout sai do checkout (as etapas não entram no histórico). | Cliente | P1 |
| 6 | Prévia de tipografia do painel mostra as fontes da loja comum, não as do Studio; o estilo "Marcante" é recusado pelo servidor. | Lojista A5, A6 | P1 |
| 7 | Emoji e prazo em horas em mensagens e avisos (aprovação, push, aba Entrega), contra as decisões do PO. | Lojista A16 | P1 |
