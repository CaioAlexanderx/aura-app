# AURA — Backlog Odonto Nível 2 (W2)

**Status:** em execução, iniciado 24/04/2026 após fechamento da Onda 1 (W1-01..W1-04).
**Meta:** elevar módulo Odonto de "MVP comercializável" para **paridade com líderes de mercado** (Simples Dental ~R$129/mês, Clinicorp ~R$150/mês) — antes de iniciar módulo Beleza.
**Estimativa total:** 22-25 dias úteis (~5 semanas calendário com folgas).

---

## 0. Princípios da Onda 2

Mesmos princípios da Onda 1 da Beleza, com 2 ajustes pelo contexto:

1. **Design-first MAS enxuto** — Odonto já tem Design System consolidado (cores, tipografia, padrões de tabs/modals/cards). W2-00 entrega só wireframes das **4 telas novas** que o W2 introduz, em 1.5 dia. Não precisa de entrevistas de mercado como Beleza B1-01 (já temos Eryca como tester ativa).
2. **Reuso máximo do BE existente** — quase todo BE de W2 já está pronto. W2 é majoritariamente FE + curadoria de conteúdo.

Outros princípios mantidos:
- Migrações com mirror em `migrations/NNN_*.sql`
- Decomposição de arquivos > 12KB
- Sem mocks (BE real desde commit 1)
- Mobile-first (~380px) obrigatório
- Linguagem clínica acessível (sem jargão técnico-jurídico)
- Strings PT-BR sem acentos no código (prática estabelecida)

---

## 1. Visão geral das tasks

| Task | Frente | Estimativa | BE | FE | Bloqueia? |
|---|---|---|---|---|---|
| W2-00 | Design das 4 telas novas | 1.5d | — | spec | sim, primeira |
| W2-01 | Portal do Paciente FE | 3d | 0 (pronto) | grande | não |
| W2-04 | Templates TCLE por procedimento | 3d | pequeno | médio | não |
| W2-05 | IA Odontológica dedicada | 4d | médio | médio | não |
| W2-02 | TISS profundo + XML ANS | 6d | médio | grande | não |
| W2-03 | NFS-e Jacareí | 4d | grande | pequeno | depende provider |
| **Total** | | **21.5d** | | | |

**Ordem recomendada de execução:**
1. W2-00 (sempre primeiro — design)
2. W2-01 (portal — alavanca de retenção visível, alta vitória)
3. W2-04 (TCLE — completa narrativa do W1-04, ciclo curto)
4. W2-05 (IA — alavanca diferencial, motor existente)
5. W2-02 (TISS — complexa, valor pra subset de clínicas)
6. W2-03 (NFS-e — destravar provider antes; pode ir em paralelo)

---

## 2. Detalhe das tasks

### W2-00 — Design das 4 telas novas (PRIMEIRA TASK)
**Tipo:** design + spec, sem código.
**Estimativa:** 1.5 dia.

**Entregáveis:**
1. **Wireframe textual + spec de componentes** das 4 telas que o W2 introduz:
   - **Portal do Paciente (público, mobile-first)** — landing, lista de consultas com botão "Confirmar", seção planos, seção pagamentos, seção documentos
   - **Modal "Compartilhar Portal"** (admin) — gera token + mostra QR + URL + botão WhatsApp (reusa padrão do W1-04 SignatureRequestModal)
   - **Tela "Nova Guia TISS"** — selecionar paciente + convênio + procedimentos (busca TUSS) + cálculo total + salvar como rascunho ou enviar
   - **Tela "Chat IA Odonto"** — interface de chat especializado com seleção de paciente como contexto + ações rápidas ("Sugerir tratamento", "Resumir prontuário", "Analisar anamnese")
2. **Decisões de UX** documentadas:
   - Portal: web-only ou abre dentro do app? (web-only — paciente não baixa app)
   - TISS: mockar emissão de XML ou só preparar payload? (preparar payload + endpoint que faz download, integração com Unimed/Bradesco fica como fase 3)
   - IA: chat persistente por paciente ou efêmero? (persistente — usar `ai_activity_log` que já existe)
3. **Mapa de fluxos críticos** — 4 fluxos em texto:
   - Dentista gera link portal → paciente abre → confirma consulta → status atualiza no admin
   - Dentista cria guia TISS → seleciona paciente do plano → busca TUSS → adiciona procedimentos → exporta PDF
   - Dentista abre IA com paciente selecionado → pergunta "Sugira plano" → IA usa anamnese + odontograma → responde plano estruturado
   - Dentista escolhe TCLE de "Extração de terceiro molar" → preenche dente + observações → gera link de assinatura (reusa W1-04)

**Critério de aceite:** documento `docs/odonto-w2-design-spec.md` commitado e aprovado em conversa antes de qualquer código de W2 começar.

---

### W2-01 — Portal do Paciente FE
**Tipo:** FE puro (BE 100% pronto).
**Estimativa:** 3 dias.
**Reuso:** padrão visual do W1-04 SignatureRequestModal (token + QR + WhatsApp).

**Entregáveis:**

**FE público (página pra paciente):**
1. `app/dental/portal/[token].tsx` — página standalone
2. Layout em cards verticais:
   - Header com nome do paciente + nome da clínica
   - Card "Próximas consultas" — lista cronológica com botão "Confirmar consulta" inline
   - Card "Planos de tratamento" — barra de progresso (X/Y procedimentos concluídos)
   - Card "Pagamentos pendentes" — parcelas com vencimento + valor + botão "Como pagar?" (modal com PIX da clínica)
   - Card "Documentos" — receituários e atestados clicáveis (modal preview)
3. Estados: token válido → renderiza, token expirado → mensagem amigável "Solicite novo link ao seu dentista"
4. Mobile-first puro (paciente abre no celular dele)

**FE admin (gerar e compartilhar link):**
5. `PortalShareModal.tsx` — copia padrão visual do `SignatureRequestModal`:
   - Botão "Gerar link de portal" no `PatientHub.tsx` (header do drawer)
   - Modal mostra QR + URL + botão WhatsApp prefilled "Olá [nome], aqui está seu portal: [url]"
   - Validade configurável (7/15/30 dias, default 30)
6. Integrar nas duas telas: `PatientHub.tsx` (botão no header) + lista de pacientes (ação contextual)

**Critério de aceite:** Eryca abre paciente Maria, clica "Compartilhar portal", manda WhatsApp pra ela, Maria abre no celular, vê próxima consulta, clica "Confirmar", status no admin atualiza pra `confirmado` em < 2s.

---

### W2-02 — TISS profundo + XML ANS
**Tipo:** BE médio + FE grande.
**Estimativa:** 6 dias (a maior task do W2).
**Migration:** 053 (índices + ajustes).

**Entregáveis:**

**Wiring (1d):**
1. Adicionar tab "Guias TISS" na seção Financeiro (sections.ts)
2. Wire `TissGuideManager.tsx` (já existe) com hook `useTissGuides` consumindo `/companies/:cid/dental/insurance/tiss`

**Tela "Nova Guia TISS" (2d):**
3. `NewTissGuideModal.tsx` — wizard 3 steps:
   - Step 1: selecionar paciente + convênio (autocomplete + busca)
   - Step 2: adicionar procedimentos (busca TUSS via `/insurance/tuss?search=`) com qty, dente, valor unitário, total
   - Step 3: revisar + salvar como rascunho ou enviar
4. Vincular com plano de tratamento existente (opcional — preenche procedimentos automaticamente)
5. Cálculo automático de total e desconto do convênio

**Geração de XML ANS (2d):**
6. `src/services/tissXml.js` — gerador conforme padrão TISS 4.01 da ANS (XSD oficial)
7. Endpoint `GET /dental/insurance/tiss/:guideId/xml` — retorna XML válido pra upload manual no portal do convênio
8. Endpoint `GET /dental/insurance/tiss/:guideId/pdf` — gera PDF do GTO pra impressão

**Conciliação (1d):**
9. Tela de conciliação: marcar guias autorizadas com valor real recebido vs valor enviado
10. Cálculo de glosas automático (diferença) + relatório por convênio

**Critério de aceite:** Eryca cria nova guia TISS pra extração de molar de paciente Unimed, exporta XML, abre arquivo no portal Unimed (manual), portal aceita o upload. Status muda pra `enviada`. Quando aprovação volta, marca como `autorizada` com valor real.

---

### W2-03 — NFS-e Jacareí
**Tipo:** BE grande + FE pequeno.
**Estimativa:** 4 dias.

**Pré-requisito (validar antes de iniciar):**
- Confirmar se Nuvem Fiscal cobre emissão NFS-e Jacareí
- Se SIM → integração via Nuvem Fiscal (1-2 dias, BE leve)
- Se NÃO → integrar diretamente com sistema do município (3-4 dias, BE pesado)

**Entregáveis (assumindo Nuvem Fiscal):**
1. Migration 054: `companies.nfse_certificate_url`, `companies.nfse_municipal_inscription`
2. `src/routes/dentalNfse.js`:
   - POST `/dental/billing/nfse/issue/:appointmentId` — emite NFS-e a partir de uma consulta concluída
   - GET `/dental/billing/nfse/:nfseId` — consulta status
   - POST `/dental/billing/nfse/:nfseId/cancel` — cancela
3. Service `src/services/nfseProvider.js` — wrapper Nuvem Fiscal API
4. Tab "NFS-e" no Financeiro do Odonto:
   - Lista de NFS-e emitidas, filtro por mês
   - Botão "Emitir NFS-e" em cada appointment concluído
   - Download de PDF + envio por email
5. Configuração no `DentalSettings.tsx`: upload de certificado A1 + dados municipais

**Critério de aceite:** Eryca conclui atendimento de R$300, clica "Emitir NFS-e", sistema gera + envia por email pra paciente em < 5s. NFS-e aparece no dashboard de notas emitidas. ISS calculado conforme alíquota Jacareí (2-5% conforme atividade).

---

### W2-04 — Templates TCLE por procedimento
**Tipo:** BE pequeno + FE médio + curadoria.
**Estimativa:** 3 dias.
**Reuso massivo:** motor de assinatura W1-04 (`dental_ws_tokens`, `dentalSign.js`, `SignatureRequestModal`).
**Migration:** 055.

**Entregáveis:**

**Curadoria (1d) — biblioteca de TCLE:**
1. 10 templates jurídicos-leigos com placeholders dinâmicos:
   - **Cirurgia oral** (extração simples, terceiros molares, frenectomia)
   - **Endodontia** (canal, retratamento)
   - **Implantodontia** (implante unitário, múltiplo, carga imediata)
   - **Ortodontia** (aparelho fixo adulto, jovem, alinhador invisível)
   - **Estética** (clareamento, faceta, lente de contato)
   - **Periodontia** (raspagem, cirurgia gengival, enxerto)
   - **Prótese** (coroa, ponte, dentadura)
   - **Genérico clínico** (consentimento de avaliação inicial)
   - **Genérico cirúrgico** (qualquer procedimento invasivo não listado)
   - **LGPD/Imagem** (uso de fotos antes/depois, dados de saúde)

**BE (0.5d):**
2. Migration 055: `dental_consent_templates` (id, company_id NULL pra templates Aura/templates customizados, code, title, body_md, placeholders text[], is_system bool, is_active)
3. Seed inicial dos 10 templates (company_id NULL)
4. CRUD `/dental/consent/templates` (GET lista + customizados, POST cria custom, PUT edita custom)

**FE (1.5d):**
5. `ConsentTemplatePicker.tsx` — modal de seleção:
   - Lista templates com preview
   - Toggle "Aura" vs "Personalizados"
6. `ConsentForm.tsx` — preenche placeholders dinâmicos antes de gerar:
   - Nome do paciente (auto)
   - Procedimento específico (extração de qual dente, etc)
   - Riscos específicos (editáveis)
   - Valor estimado (auto do plano se vinculado)
7. Botão "Coletar TCLE" no `PatientHub.tsx` → escolhe template → preenche → gera token de assinatura (reusa motor W1-04, mesmo modal `SignatureRequestModal`)
8. Histórico de TCLEs assinados na ficha do paciente (já existe estrutura, expor na timeline)

**Critério de aceite:** Eryca tem paciente que vai fazer canal no dente 36. Abre PatientHub → "Coletar TCLE" → escolhe "Endodontia (canal)" → preenche dente=36 + valor=R$1200 → gera link → paciente assina no celular → PDF do TCLE preenchido fica salvo no histórico.

---

### W2-05 — IA Odontológica dedicada
**Tipo:** BE médio + FE médio.
**Estimativa:** 4 dias.
**Reuso:** `aiChat.js` (proxy Claude Sonnet) + `ai_activity_log`.
**Migration:** 056.

**Entregáveis:**

**BE (1.5d):**
1. Migration 056: `dental_ai_conversations` (id, company_id, customer_id NULL, started_by, started_at, last_message_at, message_count) + `dental_ai_messages` (id, conversation_id, role enum {user, assistant}, content, tokens_used, created_at)
2. `src/routes/dentalAi.js`:
   - POST `/dental/ai/conversations` — cria conversa (opcionalmente com paciente)
   - GET `/dental/ai/conversations` — lista (filtro por paciente)
   - GET `/dental/ai/conversations/:id/messages` — histórico
   - POST `/dental/ai/conversations/:id/messages` — envia mensagem, recebe resposta IA
3. System prompt especializado (versionado em código):
   ```
   Voce e assistente clinico dental do Aura, ferramenta de apoio
   ao dentista licenciado [nome do dentista], CRO [num]. NAO faz
   diagnostico definitivo nem prescreve medicamentos.
   Sempre cita "Validar com avaliacao clinica direta".
   Foca em: sugestoes de plano de tratamento, resumo de prontuarios,
   identificacao de padroes em anamnese, redacao de notas clinicas.
   [...]
   ```
4. Quando paciente está vinculado, injetar contexto: anamnese + último odontograma + planos ativos + alergias

**FE (2.5d):**
5. `DentalAiChat.tsx` — interface de chat:
   - Layout WhatsApp-style (bubbles, scroll)
   - Header com toggle "Sem paciente" / "Com paciente: [nome]" (autocomplete)
   - Mensagens markdown-rendered (sugestões de plano vêm formatadas)
   - Input multiline com botão enviar
6. **Ações rápidas** como chips acima do input quando paciente selecionado:
   - "Sugerir plano de tratamento"
   - "Resumir prontuário"
   - "Identificar pendências"
   - "Redigir nota clínica do último atendimento"
7. Lista de conversas anteriores (sidebar ou modal)
8. Adicionar tab "IA Odonto" na seção Engajamento

**Critério de aceite:** Eryca abre paciente novo Maria com anamnese de bruxismo + dor noturna + dente 47 com lesão. Abre IA Odonto com Maria selecionada, clica "Sugerir plano de tratamento". IA responde plano estruturado em 3 fases: avaliação periodontal, tratamento da lesão (canal ou restauração), placa de bruxismo. Cita "Validar com avaliacao clinica direta. Esta sugestao nao substitui diagnostico do profissional."

---

## 3. Tasks deferidas pra Onda 3 (não fazem parte do W2)

Declaradas nos comentários `sections.ts` mas adiadas:

- **W3-01** Procedimentos catalog (config) — CRUD de tabela de preços + importação Tabela DOS
- **W3-02** Marketing/indicações (engajamento) — campanhas WhatsApp + cupom de indicação
- **W3-03** Horários e bloqueios avançados (config) — multi-shift, feriados, exceções

Esses entram **depois de Beleza** ou conforme demanda dos clientes pilotos.

---

## 4. O que NÃO entra no W2 (Nível 3)

Reafirmando o que ficou explicitamente fora pra evitar escopo creep:

- Imagens 3D (CBCT viewer)
- Integração com scanner intraoral (iTero, Trios)
- IA de diagnóstico em raio-x (visão computacional)
- Integração ortodôntica com lab digital (Invisalign API)
- Telemedicina/teleodonto integrada

Esses são Nível 3 — provavelmente **fora do escopo Aura**, ou pra muito longe no roadmap.

---

## 5. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Nuvem Fiscal não cobre Jacareí pra NFS-e | Média | Alto | Validar antes de iniciar W2-03; se não cobre, escolher 1 município que cobre como prova-de-conceito (SP, Rio) |
| XML TISS gerado não bate com padrão da Unimed/Bradesco | Média | Médio | Usar XSD oficial ANS 4.01; testar com validador online; ajustar conforme rejeição |
| IA odontológica gera sugestões clinicamente erradas | Baixa | Alto | Sempre incluir disclaimer "validar com avaliação clinica"; nunca prescrever medicamento; logar tudo em ai_activity_log pra revisão |
| Portal do paciente confunde paciente que não é tech-savvy | Média | Médio | Mobile-first puro, sem login, sem download de app, máximo 4 cards visuais |
| Custo Claude Sonnet sobe muito com IA odonto | Baixa | Baixo | Rate limit por plano (já existe), conversas com cap de 50 mensagens, contexto truncado em 8k tokens |

---

## 6. Decisões pendentes (definir antes de cada task)

**W2-00:** já tem decisões pré-tomadas no entregável. Validar em conversa.

**W2-01:**
- Portal usa mesmo domínio `app.getaura.com.br/dental/portal/...` ou subdomínio `portal.getaura.com.br`?
  → Recomendação: mesmo domínio (mais simples, sem DNS adicional)

**W2-02:**
- Geração de XML pra um convênio prioritário primeiro? → Sim, validar com Unimed (maior cobertura BR)

**W2-03:**
- Confirmar Nuvem Fiscal vs alternativas (eNotas, Plug Notas) antes de B2-03 começar.

**W2-04:**
- Templates 100% Aura ou copyright share com escritório jurídico? → 100% Aura, valida com advogado depois.
- Atualização periódica de templates? → Sim, anualmente (LGPD evolui).

**W2-05:**
- Modelo Claude Sonnet ou Haiku? → **Sonnet** (qualidade > custo nesse caso, é diferencial)
- Conversas têm limite gratuito por plano? → Sim, herda rate limit do `aiChat.js` existente

---

## 7. Checklist antes de iniciar W2-00

- [x] W1-04 fechado (commits 30357a5, 9a2a19d, 143b91c, 3a67ad1, 1a34f64)
- [ ] Deploy pendente: `npm install expo-image-picker && ./scripts/deploy-fe.sh`
- [ ] UAT W1-04 com Eryca (pode ser em paralelo ao W2-00)
- [ ] Validação Nuvem Fiscal x Jacareí (pode esperar até W2-03)
- [ ] Caio leu este backlog e aprovou ordem das tasks

---

## 8. Atualização do backlog Beleza

O `docs/beauty-backlog.md` permanece válido, mas seu pré-requisito muda:
- **Antes:** "iniciar B1-01 após fechamento de W1-04"
- **Agora:** "iniciar B1-01 após fechamento de W2 (Nível 2 Odonto)"

Isso adiciona ~22 dias úteis ao calendário antes de Beleza começar. Vale a pena pra entregar Odonto verdadeiramente competitivo.

---

**FIM DO BACKLOG W2.** Vivo, atualizar conforme decisões.
