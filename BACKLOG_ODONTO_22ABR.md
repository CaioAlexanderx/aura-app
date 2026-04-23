# BACKLOG ODONTO — 22/04/2026

> Backlog atualizado com itens de fix levantados na sessao 22/04 (UAT odonto).
> Substitui/expande o backlog odonto anterior (4 sprints/14 items mencionado
> no AURA_STATUS de 09/04). Mantém o foco em produto: o que o **dentista**
> realmente precisa pra usar a Aura no dia-a-dia.
>
> **Decisoes fechadas em 22/04 (sessao noturna):** ver bloco no fim do doc.

---

## NORTE ESTRATEGICO

O dentista quer (prioridade declarada):
1. **Agenda organizada** — saber o que acontece no dia, sem confusao
2. **Agendamentos automatizados** — cliente marca sozinho via link, lembrete por WhatsApp
3. **Anamnese facilitada** — formulario rapido, sem repetir pergunta
4. **Cadastro de cliente facilitado** — cria paciente em <30s
5. **Facilidade pra fazer e enviar orcamentos** — montar com poucos cliques, mandar PDF/link
6. **Clareza nos pagamentos** — quem deve, quem pagou, parcelas, repasse
7. **Bom design e usabilidade** — interface amigavel
8. **Ferramentas especificas** — plano odonto, odontograma, ficha paciente, anamnese, consulta rapida

Tudo abaixo eh roadmap pra atender isso.

---

## SPRINT D-FIX — Fixes criticos (2 dias) [PROXIMO A EXECUTAR]

Bugs/gaps que travam o uso atual. Fazer ANTES de qualquer redesign.

### D-FIX-01 · Cadeiras configuraveis (max 2, ativaveis individualmente) ✅ DECIDIDO
**Problema:** numero de cadeiras hoje eh fixo. Cliente que tem 1 cadeira nao deveria ver
"Cadeira 1, Cadeira 2" na agenda.

**Decisao 22/04:** limite global = **2 cadeiras maximo**, independente do plano.
Cliente liga/desliga cada uma individualmente. (Nao diferencia mais Negocio vs Expansao
nesse aspecto.)

**Solucao:**
- Migration: `dental_chairs jsonb` em `companies`, default
  `'[{"id":1,"name":"Cadeira 1","active":true},{"id":2,"name":"Cadeira 2","active":false}]'`
  (cadeira 2 vem desativada por default — cliente liga se precisar)
- UI: Configuracoes do modulo Odonto → toggle por cadeira + campo nome editavel
- Agenda: renderiza somente cadeiras com `active=true`
- Validacao backend: max 2 itens no array, nao deixa renomear pra string vazia
- Se cliente tiver agendamento marcado em cadeira que vai desativar, alerta antes

**Arquivos:** migration, `src/routes/dental.js` (rotas chairs), `app/(tabs)/vertical.tsx`,
`components/vertical/DentalConfig.tsx`

**Effort:** 0.5 dia

---

### D-FIX-02 · Cadastro de dentista nas configuracoes ✅ DECIDIDO
**Problema:** nao ha onde cadastrar info do dentista (nome, CRO, especialidade).
Esses dados sao necessarios pra orcamento, prescricao, atestado.

**Decisao 22/04:** sem limite duro de dentistas (cliente cadastra quantos quiser).
Recomendacao da UI: pareado com cadeiras (max 2 ativos sugerido), mas pode cadastrar
mais (ex: dentistas que dividem cadeira em horarios diferentes).

**Solucao:**
- Migration: tabela `dental_dentists` (company_id, name, cro, cro_uf, specialty,
  email, phone, photo_url, is_active, created_at)
- UI: Configuracoes do modulo Odonto → tab "Dentistas" com CRUD
- Cada agendamento futuramente referencia `dentist_id` (ver D-UNIFY-02)
- Cabecalho de orcamento/prescricao/atestado puxa `nome + CRO/UF + especialidade`

**Arquivos:** nova tabela, `src/routes/dental.js`, `components/vertical/DentalDentists.tsx`

**Effort:** 1 dia

---

### D-FIX-03 · Convenios — marcar "em breve" ✅ DECIDIDO
**Problema:** tab "Convenios" existe mas botoes nao fazem nada / nao salva.

**Decisao 22/04:** marcar "em breve" agora. Implementacao completa entra no backlog
(SPRINT D-EXTRA, depois do core).

**Solucao agora:**
- Esconder logica atual da tab convenios
- Mostrar placeholder com mensagem amigavel:
  > "Convenios chegando em breve! Por enquanto, registre o nome do convenio nas
  > observacoes do paciente."
- Linkar pro formulario de feedback (botao "Avise-me quando estiver pronto")

**Solucao final (D-EXTRA-01, futura):**
- Tabela `dental_insurance_plans` (company_id, name, code, contact, notes)
- Associacao paciente↔convenio
- Tabela de procedimentos com valor diferenciado por convenio
- Repasse e conciliacao

**Effort:** 0.25 dia (placeholder)

---

### D-FIX-04 · Botao de orcamento no Caixa (placeholder) ✅ DECIDIDO
**Problema:** dentista quer abrir orcamento direto do PDV, hoje nao existe.

**Solucao temporaria (alpha):** botao "Orcamento" no PDV com badge "Em breve".
Click abre modal explicando que estara disponivel apos integracao Orcamento↔PDV
(SPRINT D-ORCAMENTO).

**Solucao final:** ver D-ORCAMENTO-03.

**Effort:** 0.25 dia

---

**Total Sprint D-FIX: ~2 dias**

---

## SPRINT D-UNIFY — Unificar dados (4-5 dias)

Resolver o pior dos problemas: hoje **paciente ≠ cliente** e **agenda odonto ≠
agenda app**. Sao dois sistemas paralelos. Cliente fica perdido, dado fica
duplicado, relatorios nao batem.

### D-UNIFY-01 · Pacientes ↔ Clientes (unificacao)
**Problema:** modulo odonto tem `dental_patients`, app tem `customers`. Cliente
cadastrado num lugar nao aparece no outro. Dentista tem que cadastrar 2 vezes.

**Solucao:**
- **Decisao:** `customers` eh fonte unica. Criar tabela de extensao
  `dental_patient_data (customer_id PK, allergies jsonb, medications jsonb,
  conditions text, insurance_id, last_visit, ...)`
- Migration: backfill — todo `dental_patient` existente vira `customer` + linha
  em `dental_patient_data`
- Backend: rotas `/dental/patients` redirecionam pra `/customers` + JOIN
  com `dental_patient_data`
- Frontend: **a aba "Pacientes" sai do vertical** (ver D-UNIFY-03). Cliente
  acessa pelos botoes de integracao no vertical → vai pra Clientes (menu
  principal) ja filtrado por vertical=odonto
- Migration de dados existentes da Eryca + outros testers

**Effort:** 2 dias

---

### D-UNIFY-02 · Agenda Odonto ↔ Agenda do App
**Problema:** modulo odonto tem `dental_appointments`, app tem `appointments`.
Mesmo problema: dois sistemas, dado nao bate, dentista usa um, recepcao usa
outro.

**Solucao:**
- **Decisao:** `appointments` eh fonte unica. Criar `appointment_dental_data`
  (extensao) com campos especificos: chair_id, procedure_codes[], dentist_id,
  prontuario_link, anamnese_id, etc
- Migration: criar `appointment_dental_data` referenciando `appointments.id`
- Coluna `vertical` na `appointments` (default null, "odonto" pra esses)
- Backend: rotas unificadas em `/appointments`, vertical-aware via flag
- Frontend: **a aba "Agenda" sai do vertical** (ver D-UNIFY-03). Mas a Agenda
  do menu principal passa a ter modo "odonto" quando vertical odonto ativa:
  layout em colunas por cadeira, dropdowns de dentista, status com cores
  (ja existem hoje no vertical)

**Effort:** 2 dias

---

### D-UNIFY-03 · Remover Pacientes/Agenda do vertical + botoes de integracao ✅ DECIDIDO
**Decisao 22/04:** remover essas abas do vertical e adicionar **botoes de
acesso rapido** dentro do vertical pra facilitar a transicao.

**Solucao:**
- Remover tabs "Pacientes" e "Agenda" do `vertical.tsx`
- Na home do modulo vertical (D-UX-02 dashboard "Hoje"), adicionar botoes:
  - **Botao "Ver agenda completa"** → navega pra `/agendamento` com filtro
    odonto pre-aplicado
  - **Botao "Ver todos os pacientes"** → navega pra `/clientes` com filtro
    odonto
  - **Botao "Novo paciente"** → modal rapido de cadastro (ou navega pra
    /clientes?new=true)
- O vertical fica leve com so as ferramentas clinicas

**Beneficio:** atende item 10 do user (muitas abas) + reduz duplicacao mental.

**Effort:** 0.5 dia (decisao + ajuste navegacao)

---

## SPRINT D-ORCAMENTO — Orcamentos integrados (3 dias)

Hoje orcamento eh um silo. Precisa puxar do estoque/servicos e gerar venda no
caixa quando aprovado.

### D-ORCAMENTO-01 · Orcamento ↔ Estoque/Servicos
**Problema:** orcamento hoje pede pra digitar item+valor manualmente.

**Solucao:**
- Adicionar item de orcamento via busca em `products` (filtro `type='service'`
  + `type='product'`)
- Suporte a procedimentos odonto comuns como categoria de servico
  (limpeza, restauracao, canal, extracao, clareamento, protese, etc) —
  pre-cadastrados ao ativar vertical odonto
- Cada linha do orcamento puxa preco do produto/servico (editavel)
- Total + desconto + parcelamento (mesma UI do PDV)

**Effort:** 1 dia

---

### D-ORCAMENTO-02 · Catalogo padrao de procedimentos odonto
**Solucao:** seed de servicos comuns na ativacao da vertical odonto:
- Avaliacao, Limpeza/Profilaxia, Restauracao Resina (1/2/3 faces), Canal
  (mono/bi/multi), Extracao Simples, Extracao Siso, Clareamento Caseiro/Consultorio,
  Protese (varios tipos), Implante, Aparelho (manutencao), etc
- Categoria: "Procedimentos Odonto"
- Preco zerado (cliente preenche o dele)
- Cliente pode editar/desativar/adicionar

**Migration:** seed em `products` quando `vertical_active='odonto'` ativada pela
primeira vez (idempotente)

**Effort:** 0.5 dia

---

### D-ORCAMENTO-03 · Botao "Gerar Orcamento" no PDV + Aprovar Orcamento → Venda
**Problema:** dentista quer fluxo:
1. No PDV: "Novo orcamento" (em vez de "Nova venda")
2. Adiciona items, ajusta, clica "Salvar como Orcamento"
3. Sistema gera PDF + link compartilhavel
4. Cliente aprova (ou dentista aprova manualmente)
5. Aprovado → vira venda real no caixa, parcelas geradas, pagamento iniciado

**Solucao:**
- PDV: toggle "Venda" / "Orcamento" no topo
- Botao "Salvar como orcamento" (status = pending)
- Tela "Orcamentos" lista todos (filtros: pendente/aprovado/rejeitado/expirado)
- Acao "Aprovar e converter em venda" → cria sale + payment plan
- PDF do orcamento com cabecalho da clinica + dentista + paciente + items + total

**Effort:** 1.5 dias

---

## SPRINT D-ATENDIMENTO — Tela de atendimento unificada (4-5 dias)

Item 7 do user. Quando dentista clica num agendamento, abre **tela de
atendimento** com tudo que ele precisa em um lugar so. Hoje isso esta espalhado
em multiplas abas/modais.

### Analise do que faz sentido nessa tela (recomendacao)

Header fixo:
- Foto + nome paciente + idade + plano
- **Alertas em destaque:** alergias (vermelho), medicacoes em uso, condicoes
  especiais (gestante, diabetico, hipertensos)
- Status do atendimento: Aguardando · Em atendimento · Finalizado
- Botoes: Iniciar atendimento · Pausar · Finalizar

Tabs no body (em ordem de uso real):
1. **Anamnese** — formulario do paciente (preenchido na recepcao ou no celular
   pelo proprio paciente via link). Se faltando, alerta vermelho.
2. **Odontograma** — interativo, dente por dente, status visual (carie,
   restauracao, ausente, protese, implante, canal, etc). Click no dente abre
   detalhes/historico daquele dente.
3. **Procedimentos hoje** — lista do que esta sendo feito agora. Add via
   busca em `products` (procedimentos odonto). Vincula com o orcamento se ja
   existir um aprovado pra esse paciente.
4. **Anexos** — fotos clinicas, raio-x, exames. Upload + preview. R2 storage.
5. **Prescricao** — gerar PDF rapido com receituario (medicamento, dose,
   duracao). Cabecalho com dentista+CRO+clinica.
6. **Atestado** — gerar PDF rapido (afastamento, comparecimento).
7. **Orcamento** — abrir orcamento existente ou criar novo (vai pro D-ORCAMENTO)
8. **Historico** — todos os atendimentos passados, em timeline.

Footer:
- "Agendar retorno" — abre modal pra marcar proxima consulta direto
- "Finalizar atendimento" — marca como finalizado, dispara pagamento
  (gera venda no caixa com items dos procedimentos hoje)

### D-ATENDIMENTO-01 · Schema de atendimento
- Migration: tabela `dental_consultations` (id, appointment_id, patient_id,
  dentist_id, status, started_at, finished_at, notes, anamnese_snapshot jsonb)
- Tabela `dental_consultation_items` (procedimentos realizados na consulta,
  liga com `products`)
- Tabela `dental_consultation_attachments` (fotos, raio-x, R2 keys)
- Tabela `dental_prescriptions` e `dental_certificates` (gerados na consulta,
  PDFs no R2)
- Tabela `dental_tooth_history` (status de cada dente ao longo do tempo, pra
  alimentar o odontograma)

**Effort:** 1 dia

---

### D-ATENDIMENTO-02 · Tela ConsultaScreen
**Componente:** `app/consulta/[id].tsx` (tela full screen, fora das tabs)

**Layout:** Header sticky com paciente + alertas + botoes acao.
Body com tabs verticais (desktop) ou horizontais swipe (mobile).

**Effort:** 2 dias

---

### D-ATENDIMENTO-03 · Odontograma interativo
**Componente:** `components/odonto/Odontograma.tsx`

**Visual:** SVG dos dentes superior+inferior (32 dentes adulto / 20 deciduo),
cada dente clicavel, faces selecionaveis (oclusal, mesial, distal, vestibular,
lingual). Estados: hígido, cárie, restauração, canal, ausente, protese,
implante, fratura.

**Interacao:** click no dente abre side-panel com:
- Status atual de cada face
- Historico de procedimentos nele
- Adicionar novo status

**Persistencia:** `dental_tooth_history` (snapshot por consulta)

**Effort:** 2 dias

---

### D-ATENDIMENTO-04 · Anamnese facilitada
**Componente:** formulario de anamnese rapida (max 15 perguntas chave) com:
- Preenchimento na recepcao OU envio por link pro celular do paciente
- Auto-save
- Reuso da resposta da ultima visita (re-confirmar so o que mudou)

**Schema:** `dental_anamnese_responses` (patient_id, completed_at, responses jsonb,
needs_review boolean)

**Effort:** 1 dia

---

## SPRINT D-UX — Redesign UX/UI (4 dias)

Items 9, 10, 11 do user. Atender o "bom design e usabilidade".

### D-UX-01 · Reduzir abas / consolidar
**Estado atual:** muitas abas no modulo vertical odonto. Confunde.

**Proposta nova IA (depois de D-UNIFY remover Pacientes/Agenda do vertical):**

Modulo vertical odonto = **3 abas** apenas:
1. **Hoje** — agenda do dia + paciente atual + acessos rapidos (iniciar consulta,
   gerar orcamento, novo paciente, **botoes "Ver agenda completa" e "Ver todos
   os pacientes"** que levam pro menu principal)
2. **Clinico** — odontograma + prontuario + anexos + anamnese de pacientes
   (busca paciente → ve historico clinico completo)
3. **Configuracoes** — cadeiras, dentistas, procedimentos padrao, convenios
   (em breve)

Tudo o que era "Orcamentos", "Pacientes", "Agenda" some daqui — vai pra menu
principal (Caixa, Clientes, Agenda).

**Effort:** 1 dia (refatoracao da navegacao)

---

### D-UX-02 · Dashboard "Hoje" como home da vertical
- Lista compacta dos agendamentos de hoje, agrupados por cadeira+horario
- Card destaque do "proximo paciente" com botao gigante "Iniciar atendimento"
- Mini-stats: pacientes hoje, faturamento previsto, orcamentos pendentes
- Acessos rapidos:
  - "Novo paciente" (modal rapido)
  - "Novo orcamento"
  - "Buscar paciente"
  - **"Ver agenda completa" → /agendamento?vertical=odonto**
  - **"Ver todos os pacientes" → /clientes?vertical=odonto**

**Effort:** 1 dia

---

### D-UX-03 · Design tokens odonto-aware
- Manter accent color cyan da odonto (ja existe em `useVerticalTheme`)
- Tipografia clara, hierarquia visual, evitar texto pequeno demais
- Estados (sucesso, alerta, erro) com cores semanticas
- Icones consistentes (tooth, calendar, file)

**Effort:** 1 dia (design system)

---

### D-UX-04 · Jornada do dentista — fluxo end-to-end revisado
Antes de codar, **mapear no Figma/whiteboard** o fluxo:
1. Dentista chega de manha → ve Hoje → primeiro paciente
2. Recepcao cadastra paciente novo (modal rapido em Clientes)
3. Anamnese enviada por link OU preenchida na recepcao em tablet
4. Dentista clica no agendamento → tela de Atendimento
5. Faz consulta, registra no odontograma, anexa fotos
6. Gera orcamento se precisar de continuidade
7. Finaliza → vira venda → pagamento → recibo
8. Agenda retorno

**Decisao 22/04:** UAT sera feito com **outro tester** (nao Eryca). Caio define
qual.

**Effort:** 1 dia (sem codigo, so design)

---

## SPRINT D-EXTRA — Backlog longo prazo (futuro)

Items adiados pra depois do core funcionar. Mantidos do backlog odonto anterior
(09/04) + novos.

### D-EXTRA-01 · Convenios completo (D-FIX-03 evolui pra ca)
- Cadastro de convenios (tabela)
- Associacao paciente↔convenio
- Procedimentos com valor diferenciado por convenio
- Conciliacao financeira

### D-EXTRA-02 · Funil CRM odonto
Atrair → agendar avaliacao → orcamento → fechamento → retorno

### D-EXTRA-03 · Regua de cobranca
Lembretes automaticos de parcela vencida (WhatsApp/email)

### D-EXTRA-04 · Repasse dentista
Split de % por dentista, relatorios de comissao

### D-EXTRA-05 · NFS-e por procedimento
Emissao automatica ao finalizar atendimento

### D-EXTRA-06 · Portal do paciente
Login do paciente, ve agendamentos, pagamentos, anexos, anamnese

### D-EXTRA-07 · WhatsApp automatico
Lembrete consulta (24h antes), orcamento enviado, parcela vencida, pos-consulta

### D-EXTRA-08 · IA odonto
Sugestao de tratamento baseada em odontograma + historico, insights de gestao

### D-EXTRA-09 · Dashboard odonto
Faturamento por dentista, taxa conversao orcamento, ticket medio, pacientes
ativos, no-show rate, etc

---

## ROADMAP RESUMIDO

| Sprint | Effort | Prioridade | Bloqueia |
|--------|--------|-----------|----------|
| **D-FIX** (4 items) | 2 dias | **CRITICA** — proximo a executar | nada (paralelo) |
| **D-UNIFY** (3 items) | 4-5 dias | **ALTA** — base estrutural | D-ORCAMENTO, D-ATENDIMENTO |
| **D-ORCAMENTO** (3 items) | 3 dias | ALTA | D-ATENDIMENTO (parcial) |
| **D-ATENDIMENTO** (4 items) | 4-5 dias | ALTA | nada (depois de UNIFY) |
| **D-UX** (4 items) | 4 dias | MEDIA — pode ser feito incremental | nada |
| D-EXTRA (9 items) | a estimar | BAIXA — pos-core | nada |

**Total estimado (D-FIX → D-UX):** ~17-19 dias de trabalho focado.

**Sequencia sugerida:**
1. Semana 1: D-FIX (paralelo com inicio D-UNIFY)
2. Semana 2: D-UNIFY (terminar) + D-ORCAMENTO
3. Semana 3: D-ATENDIMENTO
4. Semana 4: D-UX (incremental ao longo de tudo)

---

## DECISOES FECHADAS — 22/04/2026 (sessao noturna)

✅ **D-FIX-03 (Convenios):** marcar "em breve" agora. Implementacao completa
em D-EXTRA-01 (sprint futura).

✅ **D-UNIFY-03 (Pacientes/Agenda no vertical):** remover essas abas do vertical.
Adicionar botoes de integracao no dashboard "Hoje" do vertical apontando pro
menu principal (Agenda, Clientes) ja com filtro odonto.

✅ **D-FIX-01 (Cadeiras):** **limite global de 2 cadeiras** independente do plano.
Cliente liga/desliga cada uma individualmente nas Configuracoes do modulo.

✅ **UAT (D-UX-04):** sera feito com **outro tester** (nao Eryca). Caio define
qual.

---

**Documento vivo. Atualizar conforme avanco e UAT.**
