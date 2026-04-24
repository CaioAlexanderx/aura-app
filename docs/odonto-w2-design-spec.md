# Odonto W2-00 — Design Spec das 4 Telas Novas

**Status:** entregue 24/04/2026.
**Sucessor de:** `docs/odonto-w2-backlog.md` (planejamento)
**Próximo passo:** iniciar implementação W2-01 (Portal do Paciente FE).

---

## 0. Princípios de design herdados

Esta spec **herda** todos os padrões já consolidados do módulo Odonto:

- **Cores principais:**
  - Violeta primário `Colors.violet` (#6d28d9), violeta claro `Colors.violet3` (#a78bfa)
  - Ciano para ações secundárias `#06B6D4` (status badges, accent)
  - Verde sucesso `#10B981`
  - Laranja alerta `#F59E0B`
  - Vermelho erro `#EF4444`
- **Backgrounds:** `Colors.bg2` (#0f0f1e) + `Colors.bg3` (#1a1a2e) + `Colors.border`
- **Tipografia:** títulos 17-18px peso 700, body 12-13px peso 500
- **Componentes-base:** `Modal` slide-up + sheet, `Pressable` com hitSlop, `Icon` (PATHS pré-definidos)
- **Padrão de header:** título + subtitle + botão `x` (fechar) com hitSlop=10
- **Padrão de footer:** linha de botões `flex: 1` com `gap: 8`, mínimo 120px largura
- **Mobile-first:** viewport ~380px é teste obrigatório
- **Strings:** PT-BR sem acentos no código (prática Aura)

---

## 1. Tela: Portal do Paciente (público)

**Rota:** `app/dental/portal/[token].tsx` (web public, sem login)
**Audiência:** paciente final, mobile-first, baixa literacia tecnológica
**Servida por:** `GET /dental-portal/:token` (já existe no BE)

### Wireframe textual (mobile ~380px)

```
┌────────────────────────────────────┐
│ [logo Aura pequeno]      [clinic]  │
│ Olá, Maria das Flores              │
│ Clínica OdontoVida                 │
├────────────────────────────────────┤
│                                    │
│ ┌── PRÓXIMAS CONSULTAS ────────┐   │
│ │ 📅 Sex 26/abr 14:00          │   │
│ │    Limpeza + Avaliação       │   │
│ │    [✓ Confirmar consulta]    │   │
│ │ ──────────────────────────── │   │
│ │ 📅 Ter 7/mai 16:00           │   │
│ │    Canal — dente 26          │   │
│ │    (já confirmada ✓)         │   │
│ └──────────────────────────────┘   │
│                                    │
│ ┌── PLANO DE TRATAMENTO ───────┐   │
│ │ Plano #PT-00042              │   │
│ │ ▓▓▓▓▓░░░░░  3 de 7 itens     │   │
│ │ Total: R$ 4.200,00           │   │
│ │ [Ver detalhes]               │   │
│ └──────────────────────────────┘   │
│                                    │
│ ┌── PAGAMENTOS ────────────────┐   │
│ │ ⚠ Vence 30/abr — R$ 600,00   │   │
│ │   [Como pagar?]              │   │
│ │ • Vence 30/mai — R$ 600,00   │   │
│ │ • Vence 30/jun — R$ 600,00   │   │
│ └──────────────────────────────┘   │
│                                    │
│ ┌── DOCUMENTOS ────────────────┐   │
│ │ 📄 Receita — 15/abr           │   │
│ │ 📄 Atestado — 22/mar          │   │
│ └──────────────────────────────┘   │
│                                    │
│ Dúvidas? WhatsApp da clínica:     │
│ (12) 99999-9999  [abrir conversa] │
└────────────────────────────────────┘
```

### Componentes (FE)

| Componente | Responsabilidade |
|---|---|
| `app/dental/portal/[token].tsx` | rota + fetch principal |
| `PortalHeader` | logo + nome paciente + nome clínica |
| `PortalAppointmentCard` | card de consulta com botão Confirmar inline |
| `PortalTreatmentCard` | card de plano com barra progresso |
| `PortalPaymentCard` | card de parcelas com destaque pra próxima |
| `PortalDocumentList` | lista de documentos clicáveis (modal preview) |
| `PortalPayModal` | modal "Como pagar?" — mostra PIX da clínica + valor |

### Estados de erro

- Token expirou → tela full screen com `Icon name="alert"` + mensagem "Este link expirou. Solicite um novo ao seu dentista."
- Erro de rede → retry button
- Confirmação de consulta falhou → toast "Tente novamente"

### Decisão UX

**Domínio:** `app.getaura.com.br/dental/portal/:token` — mesmo subdomínio do app, sem necessidade de DNS adicional. Funciona porque o token na URL substitui auth.

---

## 2. Tela: Modal "Compartilhar Portal" (admin)

**Onde:** botão no header do `PatientHub.tsx`
**Reuso:** copia visual e comportamento do `SignatureRequestModal` (W1-04)
**Servida por:** `POST /companies/:cid/dental/portal/generate/:patientId`

### Wireframe (sheet bottom)

```
┌────────────────────────────────────┐
│ Compartilhar portal           [x]  │
│ Maria das Flores                   │
├────────────────────────────────────┤
│                                    │
│  ┌──────────────────────────┐      │
│  │   [QR CODE 240x240]      │      │
│  │                          │      │
│  └──────────────────────────┘      │
│                                    │
│  ⏱ Válido por:                     │
│  ( ) 7 dias  (•) 30 dias  ( ) 60   │
│                                    │
│  https://app.getaura.com.br/       │
│  dental/portal/a8f3c9d2e1...       │
│                                    │
│  [📋 Copiar link]  [📱 WhatsApp]    │
│                                    │
├────────────────────────────────────┤
│              [Fechar]              │
└────────────────────────────────────┘
```

### Componente

| Componente | Responsabilidade |
|---|---|
| `PortalShareModal.tsx` | tudo (fork direto de `SignatureRequestModal`) |

### Diferenças do SignatureRequestModal

| Aspecto | SignatureRequestModal | PortalShareModal |
|---|---|---|
| Validade | 10min fixo | 7/15/30 dias selecionável |
| Status polling | sim (assinatura) | não (não precisa) |
| Auto-close | sim ao assinar | não, fica aberto |
| Mensagem WhatsApp | "Confirme assinatura..." | "Aqui está seu portal..." |

### Decisão UX

Validade default 30 dias — paciente típico usa para conferir próxima consulta semanas depois. 7 dias é só pra casos especiais (ex: dia anterior ao procedimento).

---

## 3. Tela: Nova Guia TISS

**Onde:** botão "Nova guia" na tab Financeiro > Guias TISS
**Servida por:** `POST /companies/:cid/dental/insurance/tiss`

### Wireframe (modal slide-up, 3 steps)

```
─── STEP 1: Paciente + Convênio ──────
┌────────────────────────────────────┐
│ Nova guia TISS               [x]   │
│ Passo 1 de 3                       │
├────────────────────────────────────┤
│  Paciente *                        │
│  [Buscar paciente...        ▼]     │
│  → Maria das Flores                │
│                                    │
│  Convênio *                        │
│  [▼ Selecione]                     │
│  → Unimed Vale do Paraíba          │
│                                    │
│  Vincular plano de tratamento?     │
│  ( ) Não  (•) Plano #PT-00042      │
│  (procedimentos serão pré-pre-     │
│   enchidos do plano vinculado)     │
│                                    │
├────────────────────────────────────┤
│           [Próximo →]              │
└────────────────────────────────────┘

─── STEP 2: Procedimentos ────────────
┌────────────────────────────────────┐
│ Nova guia TISS               [x]   │
│ Passo 2 de 3                       │
├────────────────────────────────────┤
│  Buscar TUSS                       │
│  [Ex: 81000094 ou raspagem...]     │
│  → Resultados:                     │
│    • 81000094 — Raspagem coronária │
│    • 81000132 — Raspagem subgeng.  │
│                                    │
│  Adicionados:                      │
│  ┌──────────────────────────────┐  │
│  │ 81000094 Raspagem coronária  │  │
│  │ Dente: [▼] Qty: [1] R$ [80]  │  │
│  │                          [x] │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ 85100012 Restauração resina  │  │
│  │ Dente: 26  Qty: 1  R$ 220    │  │
│  │                          [x] │  │
│  └──────────────────────────────┘  │
│                                    │
│  Total: R$ 300,00                  │
├────────────────────────────────────┤
│  [← Voltar]  [Próximo →]           │
└────────────────────────────────────┘

─── STEP 3: Revisão ──────────────────
┌────────────────────────────────────┐
│ Nova guia TISS               [x]   │
│ Passo 3 de 3                       │
├────────────────────────────────────┤
│  Resumo                            │
│  Paciente: Maria das Flores        │
│  Convênio: Unimed VP               │
│  Procedimentos: 2                  │
│  Total: R$ 300,00                  │
│                                    │
│  CRO do profissional               │
│  [12345-SP                  ]      │
│                                    │
├────────────────────────────────────┤
│ [Salvar rascunho] [Salvar+Enviar]  │
└────────────────────────────────────┘
```

### Componentes

| Componente | Responsabilidade |
|---|---|
| `NewTissGuideModal.tsx` | wizard 3 steps |
| `TissPatientPicker` | autocomplete paciente |
| `TissInsurancePicker` | dropdown convênio |
| `TissTreatmentPlanLink` | link com plano existente (opcional) |
| `TussSearchInput` | busca de códigos TUSS via debounce |
| `TissProcedureRow` | linha editável de procedimento |
| `TissReviewSummary` | resumo final |

### Decisão UX

3 steps (não 1 tela longa) porque cada step tem decisão crítica que requer foco. Paciente errado ou convênio errado = guia inválida.

---

## 4. Tela: Chat IA Odonto

**Onde:** nova tab "IA Odonto" na seção Engajamento
**Servida por:** `POST /companies/:cid/dental/ai/conversations/:id/messages`

### Wireframe (full screen)

```
┌────────────────────────────────────┐
│ [< Voltar]   IA Odonto      [📜]   │
│ ┌────────────────────────────┐     │
│ │ Paciente:                  │     │
│ │ [▼ Sem paciente]           │     │
│ │ → Maria das Flores ✓       │     │
│ └────────────────────────────┘     │
├────────────────────────────────────┤
│                                    │
│   ┌──────────────────────────┐     │
│   │ Eryca:                   │     │
│   │ Sugira um plano de tra-  │     │
│   │ tamento pra essa pa-     │     │
│   │ ciente                   │     │
│   └──────────────────────────┘     │
│                                    │
│ ┌──────────────────────────────┐   │
│ │ IA Aura:                     │   │
│ │ Com base na anamnese (bru-   │   │
│ │ xismo, dor noturna) e odon-  │   │
│ │ tograma (lesão dente 47),    │   │
│ │ sugiro plano em 3 fases:     │   │
│ │                              │   │
│ │ **Fase 1 — Avaliação**       │   │
│ │ • RX periapical 47           │   │
│ │ • Avaliação periodontal      │   │
│ │                              │   │
│ │ **Fase 2 — Tratamento**      │   │
│ │ • Canal ou restauração 47    │   │
│ │ • Placa de bruxismo          │   │
│ │                              │   │
│ │ **Fase 3 — Manutenção**      │   │
│ │ • Profilaxia 6/6 meses       │   │
│ │                              │   │
│ │ ⚠ Validar com avaliação     │   │
│ │ clínica direta. Esta suges-  │   │
│ │ tão não substitui diagnós-   │   │
│ │ tico do profissional.        │   │
│ └──────────────────────────────┘   │
│                                    │
├────────────────────────────────────┤
│ [💡 Sugerir plano] [📋 Resumir]    │
│ [⚠ Pendências] [✏ Nota clínica]    │
├────────────────────────────────────┤
│ ┌──────────────────────────────┐   │
│ │ Pergunte algo...             │   │
│ │                              │   │
│ │                       [▶]    │   │
│ └──────────────────────────────┘   │
└────────────────────────────────────┘
```

### Componentes

| Componente | Responsabilidade |
|---|---|
| `DentalAiChat.tsx` | tela principal + estado da conversa |
| `AiPatientContextPicker` | autocomplete + toggle de paciente |
| `AiMessage` | bubble (user/assistant) com markdown |
| `AiQuickActions` | chips de ações rápidas (só visível com paciente) |
| `AiInputBar` | input multiline + envio |
| `AiConversationsList` | sidebar/modal com histórico |

### Quick actions (chips)

| Chip | Prompt enviado ao backend |
|---|---|
| 💡 Sugerir plano | `"Sugira um plano de tratamento pra esse paciente"` |
| 📋 Resumir | `"Resuma o prontuario desse paciente em 5 bullets"` |
| ⚠ Pendências | `"Quais pendencias clinicas esse paciente tem?"` |
| ✏ Nota clínica | `"Redija nota clinica para o ultimo atendimento"` |

### Decisão UX

Markdown rendering nas respostas porque planos vêm estruturados em fases. Disclaimer obrigatório injetado pelo system prompt sempre que IA responde com sugestão clínica — visualmente destacado em laranja.

### Decisão de modelo

**Claude Sonnet** (não Haiku). Custo extra justificado: IA odontológica é diferencial competitivo. Haiku seria suficiente pra resumos, insuficiente pra sugestões clínicas estruturadas.

---

## 5. Componentes/utilities a criar

| Path | O que | Tasks que usam |
|---|---|---|
| `app/dental/portal/[token].tsx` | rota pública | W2-01 |
| `components/verticals/odonto/PortalHeader.tsx` | header do portal | W2-01 |
| `components/verticals/odonto/PortalAppointmentCard.tsx` | card consulta + confirmar | W2-01 |
| `components/verticals/odonto/PortalTreatmentCard.tsx` | card plano | W2-01 |
| `components/verticals/odonto/PortalPaymentCard.tsx` | card pagamento | W2-01 |
| `components/verticals/odonto/PortalDocumentList.tsx` | docs | W2-01 |
| `components/verticals/odonto/PortalShareModal.tsx` | modal compartilhar (admin) | W2-01 |
| `hooks/usePortalShare.ts` | hook gera token + share | W2-01 |
| `components/verticals/odonto/NewTissGuideModal.tsx` | wizard guia TISS | W2-02 |
| `components/verticals/odonto/TussSearchInput.tsx` | busca TUSS | W2-02 |
| `hooks/useTissGuides.ts` | CRUD guias | W2-02 |
| `components/verticals/odonto/ConsentTemplatePicker.tsx` | seletor TCLE | W2-04 |
| `components/verticals/odonto/ConsentForm.tsx` | preenche placeholders | W2-04 |
| `hooks/useConsentTemplates.ts` | hook templates | W2-04 |
| `components/verticals/odonto/DentalAiChat.tsx` | chat IA | W2-05 |
| `components/verticals/odonto/AiQuickActions.tsx` | chips de ações | W2-05 |
| `hooks/useDentalAi.ts` | conversas + mensagens | W2-05 |

Total: **~17 componentes/hooks novos** distribuídos em 4 tasks.

---

## 6. Adições ao `sections.ts`

```ts
// Tab nova em Financeiro
{ id: 'tiss', label: 'Guias TISS', component: TissGuidesTab, badge: 'novo' },
// Tab nova em Financeiro (depois de NFS-e Jacarei)
{ id: 'nfse', label: 'Notas fiscais', component: NfseTab, badge: 'novo' },
// Tab nova em Engajamento
{ id: 'ia-odonto', label: 'IA Odonto', component: DentalAiChat, badge: 'novo' },
```

Portal do paciente **não vira tab** (é página pública, acessível por link). Mas vai ter botão "Compartilhar portal" no `PatientHub`.

TCLE também não vira tab — é ação dentro do `PatientHub` ("Coletar TCLE"), reusa fluxo de assinatura.

---

## 7. Validação antes de iniciar W2-01

Antes de começar W2-01 (Portal do Paciente FE), validar:

- [ ] Caio leu este spec e aprovou layouts
- [ ] Decisão de domínio: `app.getaura.com.br/dental/portal/:token` está OK
- [ ] Pode liberar 3 dias contínuos pra W2-01 sem interrupção crítica
- [ ] UAT do W1-04 com Eryca pode rodar em paralelo (não bloqueia)

---

**FIM DO DESIGN SPEC W2-00.** Próximo passo: implementação W2-01 Portal do Paciente FE.
