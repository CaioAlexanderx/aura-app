# AURA — Backlog Módulo Beleza & Estética

**Status:** planejado, aguardando fechamento da Onda 1 Odonto (W1-04 assinatura digital).
**Data:** 24/04/2026
**Posicionamento:** Módulo Vertical R$39/mês (a partir do plano Negócio).
**Stack-base reaproveitada:** Barber tier3 (~80% das tabelas e rotas), Salon Partner (Lei 13.352), Dental Specialty Forms + Dental Sign + Dental Images (TCLE/anamnese/antes-e-depois).

---

## 0. Princípios e regras inegociáveis

Antes de listar tasks, regras que orientam todo o backlog. Estas são derivadas dos erros e acertos de Odonto/Barber/Food.

### 0.1 Design-first
**A primeira task da onda 1 (B1-01) é mapeamento de UX/UI completo, não código.** O mesmo erro de Odonto (8 tabs flat, depois reagrupadas em 6 sections retroativamente, com retrabalho) não pode se repetir. Tudo se desenha primeiro no Figma/wireframe e só depois codifica.

### 0.2 Reaproveitamento agressivo
Toda tabela `barber_*` e `barbershop_*` tem prefixo histórico errado (deveria ter sido `beauty_*`), mas **NÃO renomear**. Vamos usar exatamente como está. O nome é interno, o usuário não vê. Renomear = migrations dolorosas + risco de quebrar Barber em produção.

### 0.3 Migrações com mirror
Toda `apply_migration` via Supabase MCP **DEVE** ter arquivo espelho em `migrations/NNN_nome.sql` no mesmo commit do BE. CI quebra se houver drift (regra atual da casa).

### 0.4 Decomposição
Arquivos > 12KB são decompostos em sub-componentes/sub-rotas. Tasks marcam isso explicitamente quando aplicável.

### 0.5 Sem mocks
Toda task de FE consome BE real desde o primeiro commit. Nenhum array hardcoded de "exemplo". Se BE não está pronto, BE vem antes (ordem das tasks reflete isso).

### 0.6 Mobile-first sempre
Salão é negócio de balcão — dona usa o sistema no celular entre clientes. Toda tela passa pelo viewport ~380px antes de ser considerada pronta.

### 0.7 Linguagem comercial
Sem jargão técnico. "Cota-parte do profissional-parceiro" no código → "Repasse da Joana" na tela. "Anamnese estética" (esse termo o público conhece) mas com tooltip explicando.

---

## 1. Visão geral do módulo

**Nome interno:** `beauty` (vertical_active = 'estetica' segue a tipagem existente de `VerticalKey`).
**Nome público:** "Beleza & Estética" (engloba 4 perfis abaixo).

### 1.1 Quatro perfis de cliente — único módulo, 4 templates

| Perfil | CNAE | Quem é | Template ON | Template OFF |
|---|---|---|---|---|
| **Nail/Esmalteria** | 9602-5/01 | Manicure autônoma, esmalteria 1-4 cadeiras | Agenda por cadeira, baixa esmalte ml, pontos fidelidade, agenda online, deposit PIX | Anamnese, TCLE, antes/depois, salon partner |
| **Salão completo** | 9602-5/01 | Cabelo + manicure + sobrancelha + depilação, 3-10 profissionais | Tudo do Nail + Salon Partner, múltiplos serviços por agendamento, comissão por linha | Anamnese corporal, TCLE invasivo |
| **Estética facial/corporal** | 9602-5/02 | Esteticista biomédica, procedimentos invasivos | Tudo do Salão + anamnese completa, TCLE assinado, antes/depois, pacotes de sessões | — |
| **SPA/bem-estar** | 9602-5/02 | Massagem, terapias, day spa | Agenda com salas (não profissionais), pacotes, clube assinatura, recorrência | TCLE invasivo |

Configuração no onboarding muda apenas: defaults de templates de serviços, sub-tabs visíveis, defaults de feature flags. Schema é único.

### 1.2 Arquitetura de telas (provisória, refinada na B1-01)

```
Beleza  (vertical raiz)
├─ Painel              Visão geral: agenda hoje, próximos atendimentos, faturamento, alertas
├─ Agenda
│   ├─ Hoje
│   ├─ Semana / Mês
│   ├─ Agendamento online (público + admin de requests)
│   └─ Bloqueios
├─ Clientes
│   ├─ Lista
│   ├─ Pacotes vendidos (saldo de sessões por cliente)
│   ├─ Anamneses (perfil estética/spa apenas)
│   └─ Antes/depois (perfil estética/spa apenas)
├─ Equipe & Parceiras
│   ├─ Profissionais
│   ├─ Repasses Salão Parceiro (perfil salão/estética/spa)
│   └─ Comissões
├─ Serviços & Pacotes
│   ├─ Catálogo de serviços
│   ├─ Pacotes (10 sessões, 5 sessões etc)
│   └─ Clube de assinatura
├─ Marketing & Fidelidade
│   ├─ Pontos fidelidade
│   ├─ Convite de retorno
│   ├─ Aniversário
│   └─ Mapa de calor (horários ociosos)
└─ Configurações
    ├─ Perfil do estabelecimento
    ├─ Horários e cadeiras/salas
    └─ Templates de mensagem
```

---

## 2. Onda 1 — Essencial do dia a dia

**Meta:** dona consegue parar de usar caderno/papel no dia seguinte ao onboarding.
**Estimativa total:** 22-26 dias úteis.
**Fim da onda = MVP comercializável** para perfil Nail/Esmalteria e Salão completo.

### B1-01 — Mapeamento de design e UX/UI (PRIMEIRA TASK)
**Tipo:** design, sem código.
**Estimativa:** 3 dias.
**Entregáveis:**

1. **Pesquisa rápida** (0,5 dia) — Caio entrevista 3-5 donas de salão/esmalteria conhecidas em Jacareí. Roteiro de 10 perguntas:
   - "Mostra como você marca um horário hoje" (observação direta)
   - "Qual a parte mais chata do seu dia administrativo?"
   - "O que você usaria no celular vs no notebook?"
   - "Quanto cliente fantasma (no-show) você tem por semana?"
   - "Você usa agendamento por WhatsApp? Como funciona?"
   - "Tem manicure parceira ou tudo CLT?"
   - "Como você cobra e paga elas?"
   - "Faz pacote de sessões? Como controla quantas a cliente já fez?"
   - "Você pediria pra cliente assinar uma ficha digital?"
   - "Quanto pagaria por mês por um sistema que resolvesse isso tudo?"

2. **Wireframe das 7 telas-chave** (1,5 dia) — feito no Figma ou caneta+papel fotografado:
   - Painel (visão geral)
   - Agenda dia (a tela mais usada)
   - Cadastro de agendamento (modal — fluxo crítico)
   - Página pública de agendamento (mobile)
   - Tela de comanda/atendimento em andamento
   - Repasse Salão Parceiro (mensal)
   - Pacote de sessões (saldo da cliente)

3. **Definição do Design System derivado** (0,5 dia):
   - Paleta de cores específica para Beleza (mais rosa/violeta que Odonto que é azul-saúde)
   - Iconografia: tesoura, esmalte, espátula, mãos, etc
   - Padrão de componentes para chips de status (agendado/confirmado/atendido/no-show/cancelado)
   - Padrão de avatar de profissional com cor + foto

4. **Mapa de fluxos críticos** (0,5 dia) — 5 fluxos em diagrama:
   - Cliente nova chega → cadastro rápido → primeiro agendamento (< 30s)
   - Cliente liga pra remarcar → admin acha agendamento e move (< 15s)
   - Atendimento em andamento → comanda aberta → finalizar/cobrar (< 60s)
   - Manicure parceira fez 8 atendimentos no mês → admin gera repasse → paga PIX (< 2 min)
   - Cliente compra pacote de 10 drenagens → pré-agenda 10 sessões (< 2 min)

**Critério de aceite:** documento markdown ou PDF entregue, com wireframes anexados, validado em conversa rápida com Caio antes de qualquer código começar. Esse documento vira `docs/beauty-ux-spec.md` no repo `aura-app`.

**Por que primeiro:** Odonto teve 16 tabs flat na primeira iteração, depois reagrupadas em 6 seções retroativamente. Beleza começa com a estrutura definida.

---

### B1-02 — Migration 053 + scaffolding do módulo
**Tipo:** BE + DB.
**Estimativa:** 1 dia.
**Entregáveis:**
1. Migration `053_beauty_module_scaffold.sql`:
   - `companies.beauty_profile` enum (`nail`, `salon`, `estetica`, `spa`) — define template default
   - `companies.beauty_settings` jsonb — preferências do estabelecimento
   - Índices que faltarem nas tabelas barbershop_* (verificar e adicionar)
2. Mirror file no `migrations/053_beauty_module_scaffold.sql`
3. Adicionar `'estetica'` ao enum `VerticalKey` no `services/api.ts` (já existe! confirmar)
4. Backend: novo arquivo `src/routes/beauty.js` com mount em `private.js` no caminho `/beauty/*`
   - Por enquanto vazio, só com mount funcionando
   - Configura `requirePlan('negocio')` + `requireVertical('estetica')`
5. Endpoint `GET /companies/:id/beauty/profile` retorna perfil + settings
6. Endpoint `PUT /companies/:id/beauty/profile` permite trocar (apenas owner/admin)

**Critério de aceite:** company de teste recebe vertical `estetica`, frontend vê novo módulo aparecer na sidebar, painel carrega vazio.

---

### B1-03 — Onboarding do módulo (escolha do perfil)
**Tipo:** FE.
**Estimativa:** 1 dia.
**Entregáveis:**
1. Modal `BeautyOnboardingModal.tsx` que aparece na primeira vez que o usuário entra no módulo Beleza
2. 4 cards visuais (com ícone forte) para escolher perfil: Nail/Salão/Estética/SPA
3. Após escolha → POST `/beauty/profile` com perfil + chama seed dos serviços padrão (próxima task)
4. Botão "Pular e configurar depois" (bota perfil = `salon` por padrão)
5. Telemetria: registrar qual perfil foi escolhido (para analytics futuras)

**Critério de aceite:** Caio cria company nova → ativa Vertical Beleza → entra no módulo → vê modal → escolhe perfil → sistema persiste.

---

### B1-04 — Catálogo de serviços com templates por perfil
**Tipo:** BE + FE.
**Estimativa:** 2 dias.
**Reuso:** tabela `barbershop_services` (já tem name, duration, price, commission_pct).
**Entregáveis:**

1. **BE:**
   - Endpoint `POST /beauty/services/seed-template` que insere serviços default do perfil escolhido. Templates pré-definidos:
     - **Nail:** Mão (R$30, 45min), Pé (R$35, 50min), Mão+Pé (R$60, 90min), Alongamento gel (R$120, 120min), Manutenção alongamento (R$80, 90min), Esmaltação em gel (R$45, 60min), Spa dos pés (R$50, 60min)
     - **Salão:** Corte feminino (R$70, 60min), Corte masculino (R$50, 30min), Escova (R$60, 60min), Coloração raiz (R$120, 90min), Coloração total (R$180, 150min), Hidratação (R$80, 45min), Sobrancelha (R$30, 20min), Depilação buço (R$15, 10min) + todos do Nail
     - **Estética:** Limpeza de pele (R$150, 90min), Drenagem linfática (R$120, 60min), Massagem modeladora (R$130, 60min), Radiofrequência facial (R$200, 60min), Peeling químico (R$250, 60min), Microagulhamento (R$300, 90min)
     - **SPA:** Massagem relaxante 60min (R$180), Massagem relaxante 90min (R$250), Day spa básico 3h (R$450), Aromaterapia (R$200, 60min), Reflexologia podal (R$120, 45min)
   - CRUD completo `/beauty/services` (reusa estrutura de `/barbershop/services` se já existir, senão escreve)
2. **FE:**
   - Tela `app/(tabs)/vertical/beauty/services.tsx` (ou sub-tab dentro do módulo)
   - Lista de serviços com filtro por categoria
   - Modal de novo serviço com campos básicos
   - Botão "Aplicar template do perfil X" (só aparece se catálogo está vazio)

**Critério de aceite:** dona escolhe perfil "Nail" → recebe 7 serviços pré-cadastrados → consegue editar preço de cada um → consegue adicionar serviço novo "Adesivo nail art" R$10/15min.

---

### B1-05 — Profissionais e cadeiras/salas
**Tipo:** BE + FE.
**Estimativa:** 2 dias.
**Reuso:** `barbershop_professionals` (já tem name, foto, cor, commission_pct, salon_partner_id).
**Entregáveis:**

1. **BE:**
   - CRUD `/beauty/professionals` (reusa endpoints existentes de barber se compatível, senão escreve)
   - Migration 054: adicionar coluna `barbershop_professionals.role_label` text — armazena "Manicure", "Cabeleireira", "Esteticista", "Massoterapeuta" — ajuda na UI multi-perfil
   - `companies.beauty_settings.workspace_count` jsonb — quantas "cadeiras" (nail), "estações" (salão), "salas" (estética/spa) existem
2. **FE:**
   - Tela de profissionais com card por pessoa (foto + nome + cor + role + ativo)
   - Modal de cadastro: nome, foto (R2 upload), cor (palette de 12 cores fixas), role, % comissão, "É parceira (MEI)?" → se sim, abre seção de Salão Parceiro (B2-04)
   - Tela de cadeiras/salas: número editável + nomes opcionais ("Cadeira 1", "Cadeira 2", "Sala Lavanda")

**Critério de aceite:** salão cadastra Joana (Manicure, rosa, MEI parceira) e Carlos (Cabeleireiro, azul, CLT, comissão 30%). Define 4 cadeiras. Tudo aparece na agenda na próxima task.

---

### B1-06 — Agenda multi-profissional/multi-cadeira
**Tipo:** BE + FE.
**Estimativa:** 4 dias (a tela mais complexa).
**Reuso:** `barbershop_appointments`, `barbershop_appointment_services` (linha por serviço com comissão própria).
**Entregáveis:**

1. **BE:**
   - GET `/beauty/agenda?date=YYYY-MM-DD&view=day|week|month` — retorna appointments + bloqueios + horário de funcionamento
   - POST `/beauty/appointments` — cria com 1+ serviços (cada um com profissional próprio se for o caso, ex: cliente vai fazer escova com Carlos + manicure com Joana ao mesmo tempo)
   - PATCH `/beauty/appointments/:id` — move horário, troca profissional, adiciona/remove serviço, muda status
   - DELETE `/beauty/appointments/:id` — soft delete (marca cancelled)
   - Validação: não pode haver dois agendamentos sobrepostos para o mesmo profissional **ou** mesma cadeira (se cadeira for relevante pro perfil)

2. **FE:**
   - 3 visões: **Dia** (coluna por profissional ou cadeira, hora vertical), **Semana** (grade 7d × 12h), **Mês** (grid de pontinhos por dia)
   - Modal `NewBeautyAppointmentModal.tsx` com:
     - Cliente (autocomplete + botão "+ Novo")
     - Múltiplos serviços (cada um com profissional + horário sugerido sequencial ou paralelo)
     - Cálculo automático de duração total
     - Sinal/PIX antecipado (opcional, integra Asaas — task B1-08)
   - Drag-and-drop de agendamento para outro horário/profissional (só dia/semana)
   - Click em agendamento → drawer lateral com detalhes + ações (confirmar, cancelar, marcar como atendido)

**Critério de aceite:** dona consegue ver dia inteiro, mover agendamento da Joana das 14h pra 16h arrastando, criar novo agendamento de "Maria — escova com Carlos 10h + manicure com Joana 11h", tudo no celular.

**Nota:** essa task é grande. Se passar de 4 dias, dividir em B1-06a (BE + visão dia) e B1-06b (semana/mês + drag-and-drop).

---

### B1-07 — Cadastro de cliente rápido + histórico
**Tipo:** BE + FE.
**Estimativa:** 1 dia.
**Reuso:** tabela `customers` (já existe, multi-tenant).
**Entregáveis:**

1. **BE:**
   - GET `/beauty/customers/:id/history` — retorna agendamentos passados + serviços feitos + total gasto + última visita + saldo de pontos fidelidade + saldo de pacotes
2. **FE:**
   - Tela "Clientes" com lista (foto opcional, nome, telefone, última visita, valor gasto)
   - Filtros: "Inativas há 30+ dias", "Aniversário este mês", "Top 10"
   - Click → tela de detalhe do cliente com tabs: Histórico, Pacotes, Anamneses (se perfil tiver), Antes/depois (se perfil tiver)
   - Cadastro rápido inline na agenda: campo nome + telefone, salva e já usa

**Critério de aceite:** dona consegue ver que "Maria das Flores" veio 3x esse mês, gastou R$390, última visita 12/03, telefone (11) 9...

---

### B1-08 — Agendamento online público + sinal PIX antecipado
**Tipo:** BE + FE.
**Estimativa:** 3 dias.
**Reuso:** página `app/dental/book/[slug].tsx` (W1-03) — copiar e adaptar para `app/beauty/book/[slug].tsx`. Backend `dentalBookingAdmin.js` + `dentalBooking.js` — copiar e adaptar.
**Entregáveis:**

1. **BE:**
   - Migration 055: tabelas `beauty_booking_config` e `beauty_booking_requests` (cópia exata das dental, prefixo trocado)
   - Mount público `/beauty/book/:slug`
   - Mount admin sob `/beauty/booking/*`
   - **Diferencial novo:** campo `deposit_required_cents` int — se > 0, paciente vê tela de PIX antes de confirmar agendamento. Integra Asaas para gerar QR PIX ad-hoc. Sem pagar = solicitação fica `awaiting_payment`. Pagou = vira `pendente`. Webhook Asaas atualiza status. **Esta é a feature bandeira do nicho** (Simples Agenda usa esse argumento de venda).
2. **FE público:**
   - Página `app/beauty/book/[slug].tsx` adaptada visualmente do tema beleza
   - Step extra após escolher horário: "Confirme com PIX de R$ X" → mostra QR + copia-e-cola → polling status do pagamento → confirma quando pago
3. **FE admin:**
   - Sub-tab "Agendamento online" na seção Agenda (idêntica à de Odonto)
   - Adiciona toggle "Pedir sinal de R$ X" no modal de configuração

**Critério de aceite:** dona ativa agenda pública → compartilha link → cliente acessa → escolhe Joana, Manicure, sex 14h → paga R$10 PIX → solicitação aprovada automaticamente → admin confirma com 1 clique.

---

### B1-09 — Comanda + checkout + caixa diário
**Tipo:** BE + FE.
**Estimativa:** 3 dias.
**Reuso:** `barber_cash_register`, `barber_cash_movements`, integração com `sales` e `transactions` (PDV existente da Aura).
**Entregáveis:**

1. **BE:**
   - POST `/beauty/appointments/:id/start` — marca atendimento como "em andamento"
   - POST `/beauty/appointments/:id/checkout` — cria sale + transaction no PDV global, baixa estoque de produtos usados (B1-10), calcula comissão por linha, registra split do salon partner se aplicável (B2-04)
   - GET `/beauty/cash/today` — caixa do dia: aberto desde, total entrada/saída por método, comissões a pagar
   - POST `/beauty/cash/open` e `/beauty/cash/close`
2. **FE:**
   - Tela de "Atendimentos do dia" com chips de status — destaque visual para "em andamento" (badge animado)
   - Modal de checkout: lista serviços + produtos usados + desconto + método de pagamento (cartão/PIX/dinheiro/cortesia) + gorjeta opcional → confirma
   - Sub-tab "Caixa" com fechamento diário simples (não complexo como o PDV global, é resumo)

**Critério de aceite:** Joana atende Maria, dona abre comanda no celular, marca "iniciou", finaliza com R$60 PIX + R$10 gorjeta, sistema cria a venda no financeiro principal automaticamente.

---

### B1-10 — Baixa de estoque por produto/serviço (g/ml)
**Tipo:** BE + FE.
**Estimativa:** 1 dia.
**Reuso:** `barber_stock_usage` (já tem product_id, professional_id, appointment_id, quantity_used, unit).
**Entregáveis:**

1. **BE:**
   - Endpoint `POST /beauty/services/:id/recipe` — vincula produtos a um serviço com quantidade default. Ex: "Esmaltação em gel" usa 0.5g top coat + 1.2g cor. Ao finalizar atendimento, baixa automática.
   - GET `/beauty/services/:id/recipe`
2. **FE:**
   - Sub-tela "Receita" no detalhe do serviço — adiciona produto + quantidade
   - No modal de checkout do atendimento, mostra produtos baixados automaticamente, com opção de ajustar qty manual

**Critério de aceite:** dona cadastra que "Esmaltação gel" usa 1g de "Esmalte Vult Vermelho" → cada atendimento baixa 1g do estoque automaticamente.

---

### B1-11 — Painel da vertical (homepage do módulo)
**Tipo:** FE (BE reusa endpoints existentes).
**Estimativa:** 1 dia.
**Entregáveis:**
1. Tela `BeautyDashboard.tsx` com cards:
   - **Hoje:** X agendamentos, Y atendidos, Z faltaram
   - **Próximos 3:** lista compacta com hora + cliente + serviço
   - **Faturamento da semana:** valor + sparkline 7 dias
   - **Top profissional do mês:** foto + nome + faturamento gerado
   - **Alertas:** "Maria não vem há 60 dias", "Estoque de top coat baixo", "3 solicitações de agenda online pendentes"
2. CTA grande "+ Novo agendamento" no topo (mobile-friendly)

**Critério de aceite:** ao abrir módulo Beleza, primeira tela é o painel mostrando dia + alertas relevantes.

---

### B1-12 — Wiring final + testes UAT Onda 1
**Tipo:** integração + testes.
**Estimativa:** 2 dias.
**Entregáveis:**
1. Lista de 15 cenários UAT escritos (ex: "Cadastrar nova cliente do zero, marcar agendamento, atender, finalizar com PIX, ver no caixa")
2. Caio executa todos no app deployed (não em dev local) e marca pass/fail
3. Bugs achados → backlog imediato
4. Migration unica `056_beauty_w1_indexes.sql` com índices que se revelaram necessários
5. Documentação `docs/beauty-w1-uat.md` com resultado

**Critério de aceite:** 14/15 cenários passam (tolera 1 bug menor). Eryca ou outra dona conhecida testa no celular dela.

---

## 3. Onda 2 — Diferenciais competitivos

**Meta:** ter 4 features que os concorrentes top não têm bem-feitas.
**Estimativa total:** 18-22 dias.
**Pré-requisito:** Onda 1 fechada e validada com pelo menos 1 cliente real.

### B2-01 — Pacotes de sessões
**Tipo:** BE + FE.
**Estimativa:** 4 dias.
**Migration:** 057.
**Entregáveis:**
1. Tabelas novas:
   - `beauty_packages` (id, company_id, name, service_id, total_sessions, price_cents, validity_days, is_active)
   - `beauty_customer_packages` (id, company_id, customer_id, package_id, sessions_remaining, purchased_at, expires_at, sale_id, status enum {active, completed, expired, cancelled})
   - `beauty_package_consumption` (id, customer_package_id, appointment_id, consumed_at) — log de uso, permite estorno
2. BE:
   - CRUD `/beauty/packages` (catálogo)
   - POST `/beauty/customers/:id/packages/buy` — vende pacote, cria customer_package, gera sale + transaction no PDV
   - Ao finalizar appointment, se serviço tem pacote ativo da cliente → pergunta "usar 1 sessão do pacote (saldo: 6 → 5)?" — se sim, não cobra valor, apenas decrementa
   - GET `/beauty/customers/:id/packages` — lista pacotes ativos da cliente
3. FE:
   - Sub-tab "Pacotes" no detalhe da cliente com cards de saldo
   - Sub-tab "Pacotes" no menu Serviços para CRUD do catálogo
   - Botão "Vender pacote" no detalhe da cliente
   - Tela de "Vendas de pacotes" com filtros por validade/status
   - **Pré-agendamento opcional:** ao vender 10 sessões, sugere já marcar próximas 10 datas (1x semana ou 1x mês)

**Critério de aceite:** dona vende "10 drenagens R$800" para Maria, sistema marca primeira sessão hoje + sugere próximas 9 toda terça 14h. A cada atendimento decrementa saldo. No fim, sistema marca pacote como "completed".

---

### B2-02 — Anamnese estética digital + TCLE com assinatura
**Tipo:** BE + FE.
**Estimativa:** 5 dias.
**Reuso massivo:** `dental_specialty_forms` (templates), `dental_ws_tokens` (tokens de assinatura), `dentalSign.js`, componente de captura SVG (a fazer ainda em W1-04 odonto).
**Migration:** 058.
**Entregáveis:**
1. Tabelas novas (cópia adaptada de `dental_*` mas em `beauty_*` para isolar):
   - `beauty_anamnesis_templates` — templates por procedimento (Drenagem, Limpeza de pele, Microagulhamento etc)
   - `beauty_anamnesis_forms` — preenchimento por cliente
   - `beauty_consent_terms` — TCLE assinados
2. **Templates pré-prontos** (3 dias só de copywriting jurídico-leigo):
   - Anamnese facial geral
   - Anamnese corporal geral
   - Anamnese específica: drenagem, radiofrequência, peeling químico, microagulhamento, lipocavitação, depilação a laser
   - TCLE genérico
   - TCLE específico por procedimento invasivo (5 templates)
3. BE:
   - CRUD templates
   - POST `/beauty/anamnesis/forms` — preenche ficha
   - POST `/beauty/consent/sign-token` — gera token de assinatura (reusa lógica dental)
   - GET `/beauty/consent/sign/:token` — endpoint público de assinatura (reusa fluxo dental sign)
4. FE:
   - Wizard "Nova anamnese" em sub-tab da cliente — preenche em ~2 min
   - Modal "Pedir assinatura do TCLE" — gera link, mostra QR pra cliente assinar no próprio celular ou tablet do salão
   - Histórico de fichas e TCLEs assinados na ficha da cliente
   - PDF gerado da anamnese + TCLE (reusa quotePdf.ts pattern)

**Critério de aceite:** esteticista cadastra Maria, preenche anamnese de drenagem em 2min, gera TCLE personalizado com dados do procedimento, Maria assina no tablet, PDF fica salvo na ficha. **Vale legalmente perante Vigilância Sanitária.**

---

### B2-03 — Antes/depois com fotos
**Tipo:** BE + FE.
**Estimativa:** 3 dias.
**Reuso:** `dental_images` (W1-02), endpoint upload R2.
**Migration:** 059.
**Entregáveis:**
1. Tabela `beauty_progress_photos` (id, customer_id, appointment_id, type enum {antes, depois, durante}, body_region, photo_url, taken_at, notes)
2. BE:
   - POST `/beauty/customers/:id/photos` — upload + metadados
   - GET `/beauty/customers/:id/photos?region=face|body&order=asc` — lista paginada
   - POST `/beauty/customers/:id/photos/compare` — gera URL temporária com 2 fotos lado a lado (gera composite no servidor com Sharp ou retorna 2 URLs e FE compõe)
3. FE:
   - Sub-tab "Antes/depois" na cliente
   - Galeria por região do corpo (rosto, abdômen, glúteos, pernas, etc)
   - Modal "Comparar" — escolhe 2 fotos → mostra side-by-side
   - Compartilhar via WhatsApp (intent nativo do mobile) — **chave para marketing orgânico da esteticista**

**Critério de aceite:** esteticista bate foto antes da drenagem com câmera do app, atende, bate foto depois, sistema vincula automaticamente ao appointment, ao final do tratamento de 10 sessões consegue comparar sessão 1 com sessão 10 lado a lado.

---

### B2-04 — Lei do Salão Parceiro completa (split + repasse + NF unificada)
**Tipo:** BE + FE.
**Estimativa:** 5 dias. **Maior diferencial competitivo do módulo.**
**Reuso:** `salon_partners` (já existe completa), `salon_partner_splits` (já existe), `salonPartner.js` (BE), `barber_partner_invoices`.
**Entregáveis:**
1. **BE:**
   - Auditar `salonPartner.js` existente — completar gaps
   - Endpoint `POST /beauty/partners/:id/calculate-monthly-split` — recalcula tudo do mês corrente (idempotente)
   - Endpoint `GET /beauty/partners/:id/extract?month=YYYY-MM` — extrato detalhado da parceira (cada serviço, valor cliente pagou, % parceira, valor a receber)
   - Endpoint `POST /beauty/partners/:id/pay-via-pix?month=YYYY-MM` — gera link Asaas de pagamento ou registra pagamento manual
   - **Nota fiscal unificada:** integrar com Nuvem Fiscal — emissão de NFS-e do salão para o cliente final discriminando "cota-parte do salão R$X" e "cota-parte profissional-parceiro Joana CNPJ Y R$Z" conforme exige a Lei 13.352 §5
2. **FE:**
   - Onboarding da parceira: cadastro com CNPJ + nome + % padrão (ex: 60% parceira, 40% salão) + chave PIX + upload do contrato homologado em PDF (R2)
   - Tela "Repasses" com listagem mês a mês: parceira, total faturado, % parceira, a pagar, status (pendente/pago)
   - Botão grande "Gerar pagamentos do mês" → mostra preview de todos os repasses → confirma → cria batch de pagamentos PIX
   - Sub-tab "Extrato da parceira" com PDF baixável (parceira pode usar pra contabilidade dela)
   - **Educação contextual:** tooltip explicando "A cota-parte da parceira não conta na sua receita bruta para Simples Nacional. Isso reduz seu imposto."

**Critério de aceite:** salão tem Joana e Carlos como parceiras MEI. Mês inteiro de atendimentos é registrado. No dia 1 do mês seguinte, dona aperta "Gerar repasses do mês passado", vê: Joana a receber R$1.840 (60% de R$3.067 que ela faturou), Carlos R$960. Aperta "Pagar via PIX" — 2 PIX disparados via Asaas. Cada parceira recebe extrato em PDF por email automaticamente.

---

### B2-05 — Clube de assinatura
**Tipo:** BE + FE.
**Estimativa:** 3 dias.
**Migration:** 060.
**Entregáveis:**
1. Tabelas:
   - `beauty_subscriptions` (id, company_id, name, price_cents, period enum {monthly, quarterly, yearly}, services_included jsonb [{service_id, qty_per_period}], extras_discount_pct)
   - `beauty_customer_subscriptions` (id, customer_id, subscription_id, started_at, next_billing_at, status enum {active, paused, cancelled}, asaas_subscription_id)
2. BE:
   - CRUD `/beauty/subscriptions`
   - POST `/beauty/customers/:id/subscribe` — cria assinatura recorrente no Asaas via API (já integrado no projeto)
   - Webhook Asaas atualiza status, gera transaction
3. FE:
   - CRUD de planos de assinatura
   - Botão "Assinar plano" no detalhe do cliente
   - Vista "Assinaturas ativas" com churn analytics

**Critério de aceite:** dona cria plano "Cliente VIP R$199/mês — 4 escovas + 1 hidratação + 10% off em outros serviços". Maria assina. Toda hora que Maria agenda escova, sistema desconta do saldo do mês. Asaas cobra automático mensal.

---

## 4. Onda 3 — Fidelização e crescimento

**Meta:** salão lota a agenda sem depender só de boca a boca.
**Estimativa total:** 14-18 dias.

### B3-01 — Lembretes WhatsApp/SMS automáticos
**Tipo:** BE + FE.
**Estimativa:** 3 dias.
**Reuso:** integração WhatsApp existente (`whatsappRoutes.js`, código pushado mas removido do escopo Alpha — agora reativa).
**Entregáveis:**
1. Migration 061: `beauty_reminder_templates` (id, company_id, type enum {confirmation_24h, confirmation_2h, no_show_followup, returning_invitation, birthday}, channel enum {whatsapp, sms, email}, message_template text, is_active)
2. Cron job (BE) — roda a cada hora, busca appointments do próximo dia/2h e dispara mensagens
3. FE: editor de templates por tipo (com placeholders {nome}, {data}, {hora}, {servico}, {profissional})
4. Toggle on/off por tipo de lembrete

**Critério de aceite:** Maria agenda escova para amanhã 14h. Hoje às 14h recebe WhatsApp: "Oi Maria, confirma sua escova amanhã 14h com Carlos no Salão Tal? Responda SIM."

---

### B3-02 — Convite de retorno automático para inativas
**Tipo:** BE + FE.
**Estimativa:** 2 dias.
**Reuso:** `customerReactivation.js` BE já existente.
**Entregáveis:**
1. BE: cron diário identifica clientes que: (a) compraram pacote e ainda têm sessões + não agendam há 30d, (b) não vêm ao salão há 60d, (c) não vêm há 90d
2. Dispara mensagem com cupom de R$10/15% off automático
3. FE: dashboard "Reativação" com lista das clientes contactadas no mês + taxa de retorno

**Critério de aceite:** Maria não vem há 60 dias → sistema dispara WhatsApp com cupom. Maria volta na próxima semana.

---

### B3-03 — Mapa de calor de horários ociosos
**Tipo:** BE + FE.
**Estimativa:** 2 dias.
**Entregáveis:**
1. BE: endpoint `GET /beauty/analytics/occupancy?weeks=4` — retorna matriz dia × hora com % de ocupação
2. FE:
   - Visualização heatmap (verde claro = ocioso, vermelho = lotado)
   - Card de sugestão: "Terças 14h-17h estão 60% vazias. Que tal criar promo?"
   - Botão "Criar promoção para horário ocioso" → leva pra cadastro de cupom segmentado

**Critério de aceite:** dona vê visualmente que sextas 9h-11h estão sempre vazias, cria cupom "20% off sextas até 11h" em 2 cliques.

---

### B3-04 — Aniversário + pontos fidelidade
**Tipo:** BE + FE.
**Estimativa:** 2 dias.
**Reuso:** `barber_loyalty_config`, `barber_loyalty_points` (já completos).
**Entregáveis:**
1. FE: configuração de regras (1 ponto a cada R$ X gasto, bônus aniversário 50 pts, bônus indicação 100 pts, expira em 12 meses)
2. Cron diário: para clientes aniversariando hoje, dispara mensagem + adiciona pontos
3. Tela de saldo de pontos do cliente
4. No checkout, opção "Resgatar X pontos = R$ Y de desconto"

**Critério de aceite:** dia do aniversário da Maria, ela recebe WhatsApp "Feliz aniversário! Ganhou 50 pontos = R$25 de desconto na próxima visita". Volta dia 15 e usa.

---

### B3-05 — Indicação com cupom rastreável
**Tipo:** BE + FE.
**Estimativa:** 2 dias.
**Entregáveis:**
1. Cliente existente recebe link único de indicação. Quando indica e amiga agenda, ambas ganham R$20 off.
2. Painel de indicações: top indicadoras do mês

**Critério de aceite:** Maria compartilha link no Instagram → 3 amigas agendam → Maria ganha 3×R$20 = R$60 de crédito automaticamente.

---

### B3-06 — Avaliação pós-atendimento + reviews
**Tipo:** BE + FE.
**Estimativa:** 2 dias.
**Reuso:** `reviews.js` BE.
**Entregáveis:**
1. 1h após atendimento finalizado, dispara WhatsApp "Como foi com a Joana hoje? ⭐⭐⭐⭐⭐"
2. Notas 4-5 → CTA "Avalia no Google?"
3. Notas 1-3 → vai pro privado para a dona resolver
4. Vista de reviews recentes na home

**Critério de aceite:** depois de cada atendimento, dona acumula reviews positivas no Google (maior alavanca de aquisição orgânica do nicho).

---

### B3-07 — Integração Google Reserve / Reservar com Google
**Tipo:** BE + integrações.
**Estimativa:** 3 dias.
**Reuso:** `barber_google_booking` (tabela já existe).
**Entregáveis:**
1. Configuração de credenciais Google Maps Business + Reserve
2. Sync bidirecional de horários disponíveis
3. Quando alguém procura "manicure perto de mim" no Google, vê o salão da Aura com botão "Agendar" direto
4. Booking criado no Google → vira appointment na Aura

**Critério de aceite:** salão aparece no Google Maps com botão "Agendar" funcional. Cliente novo descobre, agenda, vira agendamento na Aura sem o salão fazer nada.

---

### B3-08 — Wiring final + UAT Onda 3 + go-live público
**Tipo:** integração + marketing.
**Estimativa:** 2 dias.
**Entregáveis:**
1. Suite UAT 25 cenários
2. Landing page no `getaura.com.br` com seção dedicada Beleza
3. Lançamento beta para 5 salões parceiros em Jacareí (Caio leva pessoalmente, instala, treina)
4. Coleta NPS após 14 dias

---

## 5. Resumo numérico do backlog

| Onda | Tasks | Dias úteis | Migrações | Diferencial |
|---|---:|---:|---:|---|
| Onda 1 (Essencial) | 12 | 22-26 | 053-056 | MVP comercializável |
| Onda 2 (Diferenciais) | 5 | 18-22 | 057-060 | Ataque ao Trinks/Belasis |
| Onda 3 (Crescimento) | 8 | 14-18 | 061+ | Fidelização e marketing |
| **Total** | **25** | **54-66** | **9+** | **Liderança no nicho** |

**~12 semanas de trabalho focado** para módulo top de mercado. Ritmo Caio + Claude historicamente faz 1 sprint por dia → realista em 8-10 semanas calendário com folgas e ajustes.

---

## 6. Decisões pendentes (definir antes de B1-01)

1. **Nome final público do módulo.** Sugestões: "Beleza", "Beleza & Estética", "Salão", "Belezza". Definir.
2. **Cor primária do tema.** Odonto é ciano-saúde. Estética puxa rosa/violeta? Dourado? Definir junto da pesquisa de UX.
3. **Política de pricing por add-on.** Vertical R$39 já decidido. Mas: cada profissional adicional acima de N grátis, R$X? O que fazer com salão de 20 cadeiras (e-commerce na prática)?
4. **Integração com vertical Odonto.** Algumas clínicas de estética têm dentista. Permitimos ativar 2 verticais simultâneos? Custo dobrado ou desconto?
5. **Beta-testers em Jacareí.** Quem são as 5 donas que Caio conhece e pode pilotar? Confirmar contatos antes da B1-01 (entrevistas).

---

## 7. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Subestimar complexidade da B1-06 (agenda) | Média | Alto | Quebrar em B1-06a/b, fazer protótipo navegável antes de codar |
| Lei do Salão Parceiro tem nuance fiscal que erramos | Baixa | Alto | Validar com contador especializado antes da B2-04 |
| Nuvem Fiscal não suporta NF-e com split parceiro de forma nativa | Média | Médio | Cair em modo de NF unificada manual editável; documentar limitação |
| Asaas tem limite de subscriptions ou taxa alta para subscription pequena | Baixa | Médio | Verificar contrato Asaas antes da B2-05 |
| Donas de salão são muito conservadoras tecnologicamente, não adotam | Média | Alto | B1-01 (entrevistas) é exatamente para mitigar isso. Onboarding super-guiado, treinamento presencial inicial |
| Trinks reage com guerra de preço | Baixa | Médio | Aura entrega estoque integrado + financeiro real + NF-e que Trinks não tem. Não é só preço. |

---

## 8. Reuso resumido

**Tabelas reaproveitadas como estão:** customers, sales, transactions, salon_partners, salon_partner_splits, barbershop_appointments, barbershop_appointment_services, barbershop_services, barbershop_professionals, barber_stock_usage, barber_loyalty_config, barber_loyalty_points, barber_schedule_blocks, barber_google_booking, barber_cash_register, barber_cash_movements, barber_partner_invoices, barbershop_queue, barbershop_cut_history (=18 tabelas).

**Tabelas novas:** beauty_packages, beauty_customer_packages, beauty_package_consumption, beauty_anamnesis_templates, beauty_anamnesis_forms, beauty_consent_terms, beauty_progress_photos, beauty_subscriptions, beauty_customer_subscriptions, beauty_booking_config, beauty_booking_requests, beauty_reminder_templates (=12 tabelas).

**Backend reaproveitado:** barbershop.js, barberExtras.js, barberBooking.js, barberCash.js, barberLoyalty.js, barberPartnerInvoice.js, barberTier3.js, barberBlocks.js, salonPartner.js, dentalSign.js, dentalImages.js, dentalSpecialtyForms.js, dentalBookingAdmin.js (=13 arquivos a copiar/adaptar/wire).

**Backend novo:** beauty.js (orquestrador), beautyServices.js (talvez), beautyPackages.js, beautyAnamnesis.js, beautyProgress.js, beautySubscriptions.js, beautyAnalytics.js (=6-7 arquivos novos).

**Reuso real estimado: 75-80% da fundação.**

---

## 9. Checklist antes de iniciar B1-01

- [ ] W1-04 Odonto fechado e deployed
- [ ] Eryca ou outra dentista validou Onda 1 Odonto end-to-end
- [ ] Lista de 3-5 donas de salão/esmalteria em Jacareí confirmadas para entrevistas
- [ ] Caio definiu nome público do módulo
- [ ] Caio definiu paleta de cores (mesmo que provisória)
- [ ] Decidido se ativa 1 ou 2 verticais simultâneos por company
- [ ] Caio reservou 3 dias contínuos pra fazer B1-01 sem interrupção (design não pode ser feito picotado)

---

**FIM DO BACKLOG.** Este documento é vivo — atualizar conforme decisões e aprendizados.
