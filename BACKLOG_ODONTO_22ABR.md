# BACKLOG ODONTO — 22/04/2026

> Backlog atualizado com itens de fix levantados na sessao 22/04 (UAT odonto).
> Substitui/expande o backlog odonto anterior (4 sprints/14 items mencionado
> no AURA_STATUS de 09/04). Mantém o foco em produto: o que o **dentista**
> realmente precisa pra usar a Aura no dia-a-dia.

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

## SPRINT D-FIX — Fixes criticos (3-4 dias)

Bugs/gaps que travam o uso atual. Fazer ANTES de qualquer redesign.

### D-FIX-01 · Cadeiras configuraveis por plano
**Problema:** numero de cadeiras hoje eh fixo. Cliente que tem 1 cadeira nao deveria ver
"Cadeira 1, Cadeira 2" na agenda.

**Solucao:**
- Migration: adicionar `dental_chairs_count int` em `companies` (default = limite do plano)
- Limite por plano: Negocio = 2 cadeiras, Expansao = 4 cadeiras
- UI: Configuracoes do modulo → seletor (1 a N, capado pelo plano)
- Agenda: renderiza somente as cadeiras ativas
- Validacao backend: nao deixa exceder limite do plano

**Arquivos:** `companies` table, `src/routes/dental.js`, `app/(tabs)/vertical.tsx`,
`components/vertical/DentalConfig.tsx`

**Effort:** 0.5 dia

---

### D-FIX-02 · Cadastro de dentista nas configuracoes
**Problema:** nao ha onde cadastrar info do dentista (nome, CRO, especialidade).
Esses dados sao necessarios pra orcamento, prescricao, atestado.

**Solucao:**
- Migration: tabela `dental_dentists` (company_id, name, cro, cro_uf, specialty,
  email, phone, photo_url, is_active, created_at)
- Multi-dentista: clinica pode ter mais de um (Negocio: 1, Expansao: ate 4)
- UI: Configuracoes do modulo Odonto → tab "Dentistas" com CRUD
- Cada agendamento futuramente referencia `dentist_id`
- Cabecalho de orcamento/prescricao/atestado puxa nome+CRO

**Arquivos:** nova tabela, `src/routes/dental.js`, `components/vertical/DentalDentists.tsx`

**Effort:** 1 dia

---

### D-FIX-03 · Convenios — pagina inoperante
**Problema:** tab "Convenios" existe mas botoes nao fazem nada / nao salva.

**Decisao a tomar (pergunta):** remover, redesenhar ou implementar de verdade?
- **Implementar:** tabela `dental_insurance_plans` (company_id, name, code, contact,
  notes), associacao com paciente, valor diferenciado por procedimento
- **Marcar "em breve":** esconde a tab, mostra placeholder
- **Remover:** apaga, agrupa info dentro do cadastro do paciente

**Recomendacao:** marcar "em breve" agora, planejar implementacao depois do
SPRINT D-UNIFY (depende de paciente unificado).

**Effort:** 0.25 dia (esconder) ou 2 dias (implementar)

---

### D-FIX-04 · Botao de orcamento no Caixa (placeholder)
**Problema:** dentista quer abrir orcamento direto do PDV, hoje nao existe.

**Solucao temporaria (alpha):** botao "Orcamento" no PDV com badge "Em breve".
Click abre modal explicando que estara disponivel apos integracao Orcamento↔PDV
(SPRINT D-ORCAMENTO).

**Solucao final:** ver D-ORCAMENTO-03.

**Effort:** 0.25 dia

---

## SPRINT D-UNIFY — Unificar dados (4-5 dias)

Resolver o pior dos problemas: hoje **paciente ≠ cliente** e **agenda odonto ≠
agenda app**. Sao dois sistemas paralelos. Cliente fica perdido, dado fica
duplicado, relatorios nao batem.

### D-UNIFY-01 · Pacientes ↔ Clientes (unificacao)
**Problema:** modulo odonto tem `dental_patients`, app tem `customers`. Cliente
cadastrado num lugar nao aparece no outro. Dentista tem que cadastrar 2 vezes.

**Solucao:**
- **Decisao:** `customers` eh fonte unica. `dental_patients` vira VIEW + tabela
  de extensao (`dental_patient_data` com campos especificos: alergias, plano,
  observacao_medica, etc) referenciando `customers.id`
- Migration: criar `dental_patient_data (customer_id PK, allergies jsonb,
  medications jsonb, conditions text, insurance_id, last_visit, ...)`
- Migration: backfill — todo `dental_patient` existente vira `customer` + linha
  em `dental_patient_data`
- Backend: rotas `/dental/patients` redirecionam pra `/customers` + JOIN
  com `dental_patient_data`
- Frontend: tela "Pacientes" no modulo vertical = mesma `clientes.tsx` mas com
  tab/filtro vertical=odonto + colunas extras (alergias, ultimo atendimento)
- Migration de dados existentes da Eryca + outros testers

**Effort:** 2 dias

---

### D-UNIFY-02 · Agenda Odonto ↔ Agenda do App
**Problema:** modulo odonto tem `dental_appointments`, app tem `appointments`.
Mesmo problema: dois sistemas, dado nao bate, dentista usa um, recepcao usa
outro.

**Solucao:**
- **Decisao:** `appointments` eh fonte unica. `dental_appointments` vira
  `appointment_dental_data` (extensao) com campos especificos: chair_id,
  procedure_codes[], dentist_id, prontuario_link, anamnese_id, etc
- Migration: criar `appointment_dental_data` referenciando `appointments.id`
- Coluna `vertical` na `appointments` (default null, "odonto" pra esses)
- Backend: rotas unificadas em `/appointments`, vertical-aware via flag
- Frontend: tela "Agenda" do modulo vertical = mesma `agendamento.tsx` mas
  com layout otimizado pra odonto (cadeiras como colunas, cores por status)
- Calendario semanal/diario com cadeiras lado a lado (atual eh OK, so unifica
  fonte de dado)

**Effort:** 2 dias

---

### D-UNIFY-03 · Reflexo no Sidebar e nas verticais futuras
**Consequencia:** se Pacientes vira filtro de Clientes e Agenda odonto vira
Agenda do app filtrada, talvez **nao precisamos mais de "Pacientes" e "Agenda"
separadas dentro do modulo vertical**. O modulo vertical foca em ferramentas
clinicas (odontograma, anamnese, prontuario, orcamento), enquanto agenda+pacientes
ficam no app principal.

**Decisao a tomar (pergunta):**
- **Opcao A:** Manter abas separadas dentro do vertical (atalhos pra mesma data)
- **Opcao B:** Remover "Pacientes" e "Agenda" do vertical, deixar so no menu
  principal — vertical fica leve com so as ferramentas clinicas
- **Recomendacao:** Opcao B (menos confusao, menos abas — atende item 10 do user)

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
   gerar orcamento, novo paciente)
2. **Clinico** — odontograma + prontuario + anexos + anamnese de pacientes
   (busca paciente → ve historico clinico completo)
3. **Configuracoes** — cadeiras, dentistas, procedimentos padrao, convenios

Tudo o que era "Orcamentos", "Pacientes", "Agenda" some daqui — vai pra menu
principal (Caixa, Clientes, Agenda).

**Effort:** 1 dia (refatoracao da navegacao)

---

### D-UX-02 · Dashboard "Hoje" como home da vertical
- Lista compacta dos agendamentos de hoje, agrupados por cadeira+horario
- Card destaque do "proximo paciente" com botao gigante "Iniciar atendimento"
- Mini-stats: pacientes hoje, faturamento previsto, orcamentos pendentes
- Acessos rapidos: Novo paciente · Novo orcamento · Buscar paciente

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

Validar com **Eryca** (tester atual) antes de implementar.

**Effort:** 1 dia (sem codigo, so design)

---

## ROADMAP RESUMIDO

| Sprint | Effort | Prioridade | Bloqueia |
|--------|--------|-----------|----------|
| D-FIX (4 items) | 2 dias | **CRITICA** — fixes de bug | nada (paralelo) |
| D-UNIFY (3 items) | 4-5 dias | **ALTA** — base estrutural | D-ORCAMENTO, D-ATENDIMENTO |
| D-ORCAMENTO (3 items) | 3 dias | ALTA | D-ATENDIMENTO (parcial) |
| D-ATENDIMENTO (4 items) | 4-5 dias | ALTA | nada (depois de UNIFY) |
| D-UX (4 items) | 4 dias | MEDIA — pode ser feito incremental | nada |

**Total estimado:** ~17-19 dias de trabalho focado.

**Sequencia sugerida:**
1. Semana 1: D-FIX (paralelo com inicio D-UNIFY)
2. Semana 2: D-UNIFY (terminar) + D-ORCAMENTO
3. Semana 3: D-ATENDIMENTO
4. Semana 4: D-UX (incremental ao longo de tudo)

---

## DECISOES PENDENTES

Antes de comecar D-FIX, preciso confirmar contigo:

1. **D-FIX-03 (Convenios):** marcar "em breve" agora ou implementar ja?
2. **D-UNIFY-03 (Pacientes/Agenda do vertical):** remover essas abas do
   vertical e deixar so no menu principal (Opcao B recomendada)?
3. **Multi-dentista (D-FIX-02):** Negocio = 1 dentista ou Negocio = 2 dentistas
   alinhado com 2 cadeiras?
4. **Validacao com Eryca:** marcar sessao de UAT odonto antes de comecar
   D-ATENDIMENTO?

---

## ITEMS REMANESCENTES DO BACKLOG ANTERIOR (mantidos)

Do "Odonto backlog 4 sprints/14 items" mencionado no AURA_STATUS de 09/04 que
**ainda fazem sentido** depois deste novo plano:

- Funil CRM odonto (atrair, agendar avaliacao, orcamento, fechamento)
- Regua de cobranca (lembretes de parcela vencida)
- Repasse dentista (split de % com cada profissional)
- NFS-e por procedimento
- Portal do paciente (login, ve agendamentos, pagamentos, anexos)
- WhatsApp automatico (lembrete consulta, orcamento enviado, parcela vencida)
- IA odonto (sugestao de tratamento, insights)
- Dashboard odonto (faturamento por dentista, taxa conversao orcamento, etc)

Esses entram em sprints futuros depois que o core (D-FIX → D-UX) estiver firme.

---

**Documento vivo. Atualizar conforme avanco e UAT.**
