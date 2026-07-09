# Crediário — Crítica de design & spec de redesign premium

> 08/07/2026 · Base: `app/(tabs)/crediario.tsx`, `components/crediario/*`, `components/crediario/ficha/*`
> Objetivo: experiência mais simples e limpa + camada de "WOW" (animações, hovers, microinterações).
> Público: lojista que opera pesado em PDV + Crediário — consulta E operação com peso igual.

---

## Parte 1 — Crítica do estado atual

### Impressão geral

A tela principal é sólida na estrutura (hero → KPIs → mapa de risco → carteira), mas **tudo grita ao mesmo tempo**: 5 números grandes, uma barra empilhada com legenda de 5 faixas, 4 chips e uma tabela — antes do primeiro scroll. A ficha do cliente (TabParcelas) é o ponto mais crítico: 30+ elementos interativos numa viewport. E em todo o módulo **não existe uma única animação além do fade do `<Modal>`** — nenhum `Animated`, nenhuma transição de accordion, quase nenhum hover. O app já tem os primitivos prontos (`PressableScale`, `ModalPop`, `HoverButton`) — eles simplesmente não chegaram ao Crediário.

### Usabilidade

| Problema | Severidade | Recomendação |
|---|---|---|
| TabParcelas: breakdown de encargos (4 linhas) + 4 botões **por parcela**, sempre visíveis | 🔴 Crítica | Progressive disclosure: linha compacta, expande ao toque |
| 3 caminhos concorrentes para "receber" (botão da parcela, do carnê, valor livre) sem hierarquia | 🔴 Crítica | Um CTA primário "Receber" por contexto; os demais viram secundários |
| Ficha com **5 abas** (Parcelas/Histórico/Conta/Termos/Bloqueio) em 2 linhas de tabs | 🔴 Crítica | 3 abas; Termos+Bloqueio viram seção "Ajustes" dentro de Conta |
| Histórico exige clique manual "Carregar histórico" | 🟡 Moderada | Carregar automático ao abrir a aba (lazy já existe via `enabled`) |
| Mapa de risco: 5 faixas + legenda 5 colunas competem com os chips de filtro logo abaixo (dois sistemas de filtro empilhados) | 🟡 Moderada | Unificar: risco vira o próprio filtro; chips ficam só p/ busca de estado |
| CriarLancamentoModal passo 2: 10–14 blocos, unificação (feature rara) com mesmo peso de valor/parcelas | 🟡 Moderada | Colapsar "Unificar" e "Juros/avançado" atrás de disclosure |
| Subtítulo da página + hints longos repetidos (data retroativa, unify, estimativa 2x na Devolução) | 🟢 Menor | Cortar subtítulo; um hint por conceito |
| **[ao vivo]** Coluna "Maior atraso" mostra "—" para clientes marcados "Em atraso" (`overdue=true` sem `next_due_date` → `daysLate`=0) | 🔴 Crítica | Backend enviar `next_due_date`/dias no `/balances`, ou derivar da parcela vencida; nunca exibir estado contraditório |
| **[ao vivo]** Linha de parcela na ficha: ~120px de altura p/ 2 linhas de info, 3 botões empilhados à direita com vazio enorme no meio | 🔴 Crítica | Reforça o `<ParcelaRow>` compacto + accordion (§2.3) |
| Confirmações destrutivas com 3 padrões diferentes (Sim/Não inline, banner âmbar, nota miúda sob o botão) | 🟡 Moderada | Um padrão único (banner âmbar 2-step, já o melhor dos três) |

### Hierarquia visual

O olho é puxado primeiro para o hero "Em aberto · total" — correto. Mas logo perde para 3 KPIs coloridos de mesmo tamanho + barra de risco colorida. Na TabConta, o saldo devedor (o número mais importante) é só mais uma linha de 17px numa tabela de 8 pares label/valor uniformes. Labels uppercase de 9.5–10px com letter-spacing pesado aparecem em ~10 variações — criam textura, não hierarquia.

### Consistência

| Elemento | Problema | Fix |
|---|---|---|
| Feedback de toque | `opacity` varia 0.5/0.7/0.85; CobrancaPreviewModal não tem nenhum | Componente `Button` único com `PressableScale` |
| Backdrop de modais | 0.55 vs 0.72 entre modais irmãos | Token único `backdrop` |
| Tokens | mistura `border`/`border2` e `bg3`/`bg4` sem critério entre modais | Definir: card = `bg3`+`border`; input = `bg2`+`border`; ativo = `border2` |
| Badges de status | "Atraso/OK" vs "Em atraso/No prazo" (JSX de parcela duplicado 3×) | Extrair `<ParcelaRow>` único |

### Acessibilidade & touch

Botões de ação da timeline e das parcelas: fonte 11px, padding vertical 4–8 → alvo bem abaixo de 44px. Texto de 9.5–10.5px em vários metas. Nota de irreversibilidade da devolução em 10.5px é informação crítica ilegível. Nenhum padrão hover-reveal hoje (bom — armadilha 7 não foi violada), manter assim.

### O que funciona bem (preservar)

- Arquitetura de dados da tela principal (hero → risco → carteira) e o mapa de risco clicável como filtro — conceito ótimo, só precisa de integração visual.
- Gate 2-step âmbar do "Receber valor livre" com preview de distribuição — melhor padrão de confirmação do app.
- Wizard DevolucaoModal: um passo = uma tarefa, com tela de sucesso rica.
- Busca com debounce, A–Z, avatar com iniciais, cores semânticas de aging.

### Prioridades

1. **Motion system + Button unificado** — maior ganho de "premium" por esforço; destrava tudo.
2. **TabParcelas com progressive disclosure** — resolve o pior ponto de densidade, onde o lojista opera o dia todo.
3. **Ficha 5→3 abas + tela principal respirando** — simplificação estrutural.

### Validação ao vivo (app.getaura.com.br/crediario, 08/07)

Inspeção no Chrome confirmou a análise de código e acrescentou: (a) o subtítulo quebra em 2 linhas e empurra o conteúdo; (b) com carteira saudável o mapa de risco fica ~90% verde — título "Mapa de risco" soa alarmista para o caso comum, reforçando a fusão com os filtros; (c) telefone em toda linha da carteira adiciona ruído sem ação associada (mover para a ficha); (d) a inconsistência "Em atraso" × "Maior atraso —" aparece em produção nos clientes visíveis; (e) na ficha, as 5 abas em 2 linhas + boxes Score/Disponível/Em aberto de peso idêntico confirmam a falta de herói; (f) modal abre com fade seco, sem pop — nenhuma microinteração perceptível em toda a jornada.

---

## Parte 2 — Spec do redesign

### Princípios

1. **Um herói por tela.** Cada superfície tem UM número dominante; o resto é suporte.
2. **Mostrar o essencial, revelar o resto.** Detalhe (encargos, unify, juros) só sob demanda.
3. **Movimento com propósito.** Animação comunica causa→efeito (expandiu, filtrou, confirmou) — nunca decoração gratuita.
4. **Operação em 2 toques.** Receber uma parcela: abrir ficha → Receber. Nada no meio.

### 2.1 Motion system (novo, transversal)

Promover `components/karate/anim/` → `components/anim/` (reexportar no caminho antigo) e criar tokens:

```ts
// constants/motion.ts
export const Motion = {
  fast: 120,      // hover, press
  base: 200,      // chips, badges, cor/borda
  slow: 280,      // accordion, sheets, entrada de card
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",  // web transition
  spring: { damping: 18, stiffness: 220 }, // se migrar p/ reanimated
};
```

| Interação | Spec |
|---|---|
| Qualquer botão/linha clicável | `PressableScale` (scale 0.98 press, realce hover) — já existe |
| Entrada de modais/sheets | `ModalPop` (scale 0.96→1 + fade, 250ms) em TODOS os modais do crediário |
| Accordion (carnê, parcela, unify) | Altura animada + chevron rotate 90°, 280ms. Web: `maxHeight`+`opacity` com transition; nativo: `LayoutAnimation.configureNext` |
| Hover em linha da carteira (web) | `translateY(-1px)` + `backgroundColor: violetD` + sombra suave, 120ms. **Sem hover-reveal** — ações sempre visíveis (armadilha 7) |
| Hover em cards KPI/risco | borda `border2` + `translateY(-2px)` + sombra (padrão `HoverButton`) |
| Chip filtro ativa/desativa | transição de cor/borda 200ms + scale 1.04 pulse curto |
| Faixa do mapa de risco | hover: `scaleY(1.25)`; selecionada: outras faixas 0.35 opacity com transição 200ms (hoje é instantâneo) |
| Números do hero/KPI ao carregar | count-up 400ms (web) ou fade-in escalonado 60ms entre cards |
| Toast de sucesso pós-recebimento | check com stroke animado + card do cliente pisca verde 1× (600ms) antes de reordenar |
| Skeleton | shimmer horizontal (gradiente animado), substituindo blocos estáticos opacity 0.4/0.5 |

Novos tokens visuais em `constants/colors.ts`: `shadowSoft` (0 6px 24px rgba(0,0,0,0.35)), `shadowGlow` (0 4px 20px violet 25%), `backdrop: rgba(3,5,14,0.72)` único.

### 2.2 Tela principal (`crediario.tsx`)

**Header** — remover subtítulo ("Ficha completa de cada cliente…"). Eyebrow + título + 2 botões. Ganho imediato de respiro.

**Hero + KPIs → uma única faixa.** O hero mantém o número gigante (42px, único herói da tela). Os 3 KPIs viram **stats compactos dentro do próprio hero card** (linha horizontal: `Vencido R$ X · Recebido no mês R$ Y · Z em atraso`), com valor 15px/700 e dot colorido — não cards concorrentes. Clicar em "Vencido" aplica o filtro "Em atraso". Some uma fileira inteira de cards.

**Mapa de risco = o filtro.** Card único "Carteira por atraso": barra empilhada (mantida, com hover `scaleY`) + legenda enxuta em pills horizontais (`● Em dia R$ X`, sem contagem de clientes — vai pro tooltip/hover). Os chips "Com saldo / Em atraso / Em dia" **saem** — são redundantes com as faixas (Em dia = faixa verde; Em atraso = qualquer faixa não-verde; incluir pill sintética "Em atraso · todos"). Sobram na toolbar: busca + A–Z. Dois sistemas de filtro viram um.

**Carteira** — linha atual é boa; adicionar: hover state (spec acima), `PressableScale`, coluna "Maior atraso" vira pill colorida (`🔴 45d`) em vez de texto com bullet, telefone sai da linha (vive na ficha — reduz ruído), e o botão de cobrança ganha tooltip "Cobrar no WhatsApp" (web). Alvo do botão sobe para 40×40. Empty state ganha ícone + CTA ("Nenhum cliente em atraso 🎉" já é ótimo; adicionar botão "Novo lançamento" no empty de "sem saldo").

### 2.3 Ficha do cliente (`ClienteCrediarioModal`)

**5 abas → 3: Parcelas · Histórico · Conta.**
- "Termos" e "Bloqueio" viram seções colapsadas ("Ajustes deste cliente") no fim da aba Conta. São ações raras de configuração — não merecem tab.
- Some a segunda linha de tabs; header fixo encurta ~40px.

**Header da ficha** — manter avatar + nome + pill de status + Cobrar. A linha SCORE/DISPONÍVEL/EM ABERTO fica, mas **EM ABERTO vira o herói** (20px/800 vermelho ou verde); score e disponível 13px de suporte. Entrada via `ModalPop`.

**TabParcelas — o coração do redesign:**
- **`<ParcelaRow>` único** (elimina a triplicação de JSX): linha compacta `nº/total · vence dd/mm · R$ valor · badge status`, chevron à direita. **Expande ao toque** (accordion animado) revelando breakdown de encargos + ações (Alterar data · Pix · Receber). Densidade cai ~70%.
- Parcela vencida: borda esquerda vermelha 3px + valor em vermelho — escaneável sem ler.
- **Carnês**: card colapsado mostra só nome + saldo + pill de status + próx. vencimento. Ações do carnê (Renegociar/Imprimir/Cobrar) num menu "⋯" — "Receber" é o único botão exposto.
- **"Receber valor livre" vira sheet own** aberto por um FAB/CTA fixo no rodapé da ficha ("Receber pagamento"), em vez de card permanente no fim do scroll. O gate 2-step âmbar e o preview de distribuição são mantidos tal como estão (padrão canônico de confirmação).

**TabHistorico** — carregar automático ao abrir; legenda de cores (pills minúsculas no topo: `● pagamento ● compra ● ajuste`); confirmação de "Devolver" migra do Sim/Não inline para o banner âmbar 2-step; alvos de ação ≥ 40px.

**TabConta** — de tabela uniforme para 3 grupos: **Situação** (saldo herói + status), **Limite** (barra de progresso usado/disponível — hoje é só número), **Condições** (texto compacto) + "Ajustes" colapsado (Termos/Bloqueio).

### 2.4 Modais

- **Todos**: `ModalPop` na entrada, backdrop token único, `Button` compartilhado com `PressableScale`.
- **CriarLancamentoModal**: manter wizard 2 passos (é o DNA canônico — armadilha 5). Passo 2 reorganizado em 3 grupos: *Essencial* (valor · parcelas · 1º vencimento) sempre visível; *Carnê* (default "Conta geral", troca via disclosure); *Avançado* (juros · periodicidade custom · unificar · descrição) colapsado. Resumo + CTA fixos no rodapé do sheet (não rolam). Transição entre passos: slide horizontal 250ms.
- **DevolucaoModal**: stepper ganha rótulos ("Itens · Revisar · Pronto") e preenchimento animado; nota de irreversibilidade sobe para 12.5px dentro do banner âmbar; tela "done" ganha ações "Imprimir recibo" e "Ver ficha". Cortar um dos dois avisos de estimativa.
- **CobrancaPreviewModal**: adicionar pressed/hover nos 3 botões (hoje zero feedback); backdrop e tokens alinhados aos demais.

### 2.5 Padrão único de confirmação sensível

Banner âmbar 2-step (o do valor livre) vira componente `<ConfirmGate>`: CTA → banner âmbar com resumo ("Confirmar recebimento de R$ 120,00 em dinheiro?") → Sim/Cancelar. Usos: receber, devolver, renegociar, bloquear. Aparece com slide-down animado 200ms.

### 2.6 Touch & responsivo

- Alvo mínimo 44×40px em toda ação; hitSlop onde o visual precisar ficar menor.
- Hover specs são **aditivos** e só-web (`Platform.OS === "web"` / `onHoverIn`); em touch nada muda de comportamento — nenhuma ação depende de hover (armadilha 7).
- `isNarrow`: hero 30px, stats do hero quebram em 2 linhas, legenda de risco vira scroll horizontal.

---

## Plano de implementação

| Fase | Escopo | Risco |
|---|---|---|
| **F0 — Mockup** | Mockup HTML standalone (tela + ficha + 1 modal) ANTES de código (armadilha 4). Validar com 1–2 lojistas do perfil "opera crediário o dia todo" | — |
| **F1 — Fundação** | `constants/motion.ts`, promover `components/anim/`, `<Button>`, `<ConfirmGate>`, `<ParcelaRow>`, tokens de sombra/backdrop | Baixo — aditivo |
| **F2 — Tela principal** | Header enxuto, hero unificado, risco-como-filtro, hovers/anima na carteira | Médio |
| **F3 — Ficha** | 3 abas, TabParcelas accordion, sheet de recebimento, TabConta agrupada | Alto — coração da operação |
| **F4 — Modais** | Reorganização do CriarLancamento, polish Devolução/Cobrança | Médio |

### Guard-rails (CLAUDE.md)

- **Sem mudança de rota/módulo**: tela existente — `NAV`, `MODULE_PLAN_MAP` e `PERM_TO_MODULES` intocados.
- **`refreshMe()` no mount mantido** (plano stale no JWT).
- **Multi-CNPJ**: redesign é single-company como hoje; se o hero consolidado multi-CNPJ entrar no escopo, definir na F0 (não como afterthought).
- **Wizards**: nenhuma estrutura nova de wizard — tudo segue o DNA TrocaModal/CriarLancamento.
- **Nada de hover-reveal**; hover apenas realça o que já está visível.
- Follow-up backend pendente (pílulas Risco/Bloqueado no `/balances`) continua fora do escopo visual.
