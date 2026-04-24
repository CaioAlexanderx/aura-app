# Aura Odonto — Backlog V2 (2026-04-24)

> Plano consolidado pos analise UX/UI/comercial.
> Estrategia aprovada: A (MEI multi-vertical) + D (IA odonto premium).
> Precificacao agressiva: Vertical R$ 39/mes (era R$ 69).

## Pricing context

```
Aura Negocio R$ 169,90  +  Vertical Odonto R$ 39,00  =  R$ 208,90/mes
Aura Expansao R$ 269,90 +  Vertical Odonto R$ 39,00  =  R$ 308,90/mes
```

Comparativo vs concorrencia:

| Software        | Entry        | Observacao                                  |
|-----------------|--------------|---------------------------------------------|
| Codental        | R$  79,90    | sem CRM, sem NF, sem maquininha             |
| Simples Dental  | R$ 128,94    | lider LATAM, foco odonto puro               |
| Clinicorp       | R$ 149,90    | medias/grandes, 50+ relatorios              |
| **Aura N+V**    | **R$ 208,90**| odonto + PDV + estoque + financeiro + NF-e  |
| **Aura E+V**    | **R$ 308,90**| acima + IA + multi-gateway + analytics      |

Pitch: stack equivalente separado (Simples Dental + Conta Azul + Bling) custa R$ 296,94 — Aura N+V economiza R$ 88/mes e centraliza tudo.

---

## ONDA 1 — Fechar os "quase la" (alto ROI, infra pronta)

Objetivo: transformar 6 gaps parciais em "sim" no comparativo. Componentes ja
criados ou backend pronto, falta o ultimo 20%.

### W1-01 — Patient Hub (drill-down de paciente)
**Estado atual:** PacientesTab e lista simples sem ficha agregadora. 4 componentes orfaos sem ponto de entrada.
**Entrega:** componente `PatientHub.tsx` que abre ao clicar num paciente da lista, com sub-tabs:
  - Dados (cadastro, contato, plano, historico de visitas)
  - Anamnese (wire AnamneseWizard.tsx existente)
  - Odontograma (wire OdontogramaSVG por patient_id)
  - Prontuario (timeline ja existe em ProntuarioTab, refator pra receber patient_id)
  - Periograma (wire Periograma.tsx existente)
  - Imagens (wire ClinicalImages.tsx + endpoint upload R2 — ver W1-02)
  - Orcamentos do paciente (filtro do OrcamentosTab por customer_id)
  - Cobrancas do paciente (filtro do BillingDashboard por customer_id)
  - Fichas especialidade (wire FichaEspecialidade.tsx existente)
**Esforco:** 2 sessoes
**Aceite:** clicar paciente abre Hub, todas sub-tabs renderizam dados reais

### W1-02 — Upload R2 para imagens clinicas
**Estado atual:** ClinicalImages.tsx puramente apresentacional (props only).
**Entrega:**
  - BE: endpoint POST `/dental/patients/:id/images` (multipart, R2 bucket aura-storage path `dental/{company_id}/{patient_id}/{uuid}.jpg`)
  - BE: GET `/dental/patients/:id/images` lista
  - BE: DELETE `/dental/images/:id` soft-delete
  - FE: wire ClinicalImages dentro do PatientHub passando uploads handlers
  - Limites por plano: Negocio 100MB/paciente, Expansao 500MB/paciente
**Esforco:** 1 sessao
**Aceite:** dentista tira foto no celular, sobe pro paciente, ve thumb e zoom

### W1-03 — Agendamento online publico (live)
**Estado atual:** BE `dentalBooking.js` pronto (config + requests endpoints).
**Entrega:**
  - FE: nova rota publica `app/booking/[slug].tsx` (modelo do portal paciente)
  - FE config UI dentro de DentalSettings (slug + horarios + servicos)
  - Cliente acessa `getaura.com.br/agenda/{slug}` (Cloudflare Pages redirect)
  - Solicitacao cai em dental_booking_requests, secretaria aprova/rejeita
**Esforco:** 1 sessao
**Aceite:** dentista compartilha link, paciente agenda sem app

### W1-04 — Assinatura digital funcional
**Estado atual:** dental_ws_tokens existe, dentalSign.js gera token, FE nao consome.
**Entrega:**
  - FE: nova rota publica `app/sign/[token].tsx`
  - Renderiza contrato/orcamento, captura assinatura via canvas
  - POST signature_url volta pro contrato
  - Botao "Enviar para assinar" no AppointmentDetail, OrcamentosTab
**Esforco:** 1 sessao
**Aceite:** paciente recebe link WhatsApp, assina no celular, dentista ve PDF assinado

**Total Onda 1: ~5 sessoes**

---

## ONDA 2 — Reduzir friccao do dia-a-dia (alto NPS, baixo escopo)

Objetivo: arrumar arquitetura de informacao + a ausencia sistematica de WhatsApp.

### W2-01 — Reagrupar sidebar 16 tabs em 6 secoes
**Estado atual:** sidebar flat com 16 tabs causa overload.
**Entrega:** OdontoNavV2 + sections.ts (parte ja iniciada nesta sessao):
  - Agenda (Dia/Semana/Mes)
  - Pacientes (Lista, Funil de leads, Lista de espera, Check-in)
  - Clinica (Odontograma, Prontuario, Periograma — futuramente dentro do PatientHub)
  - Financeiro (Cobrancas, Orcamentos, Repasses, Convenios, Laboratorio)
  - Engajamento (Automacoes, Retorno, Marketing — futuro)
  - Configuracoes (Cadeiras, Dentistas, Procedimentos, Integracoes, Agendamento online)
**Esforco:** 1 sessao
**Aceite:** sidebar com 6 itens, sub-tabs internas no topo

### W2-02 — Botao WhatsApp sistemico
**Estado atual:** WhatsApp aparece em alguns lugares, ausente em outros.
**Entrega:** componente `WhatsAppButton.tsx` reutilizavel (icone verde + nome do destinatario + mensagem template). Aplicar em:
  - Cartao de paciente na agenda
  - Linha de cobranca em BillingDashboard
  - Item do funil DentalFunnel
  - Item da lista de espera
  - Card no Retorno (recall + no-show)
  - PatientHub aba Dados
**Esforco:** 1 sessao
**Aceite:** todo lugar que tem telefone tem botao WhatsApp 1-clique

### W2-03 — Drag-and-drop na agenda
**Estado atual:** remarcacao = abrir modal, editar, salvar (4 cliques).
**Entrega:** AgendaTab usa react-native-draggable-flatlist ou GestureHandler. Mover appointment de horario/cadeira sem modal. Confirmacao via toast com undo.
**Esforco:** 2 sessoes
**Aceite:** dentista arrasta consulta de 14h pra 16h sem abrir modal

### W2-04 — Dashboard com acoes nos KPIs
**Estado atual:** OdontoDashboard mostra numeros estaticos.
**Entrega:** cada KPI vira clicavel:
  - "5 parcelas vencidas" → expand list + WhatsApp em cada
  - "12 pacientes p/ recall" → expand + "Disparar todos" + WhatsApp individual
  - "Faturamento mes" → drill-down por procedimento (existe top_procedimentos)
  - "Taxa conversao funil" → abre DentalFunnel com filtro
**Esforco:** 1 sessao
**Aceite:** dashboard nao e mais leitura, e centro de acao

### W2-05 — Leads como pacientes (unificacao visual)
**Estado atual:** dental_leads ja tem customer_id (D-UNIFY) mas FE trata separado.
**Entrega:** lista de Pacientes mostra todos (pacientes + leads) com badge "Lead: estagio X" ou "Paciente ativo". Filtros: Todos / Pacientes / Leads. Abrir lead mostra PatientHub com sub-tab "Funil" destacada.
**Esforco:** 0.5 sessao
**Aceite:** dentista nao tem mais que lembrar "esse virou paciente, esta no Funil ou em Pacientes?"

**Total Onda 2: ~5.5 sessoes**

---

## ONDA 3 — Diferencial premium (justifica preco)

Objetivo: features que os concorrentes mid-tier nao tem ou tem pior, ancorando
proposta de valor da estrategia A+D.

### W3-01 — IA Odonto dedicada (CORE DIFERENCIAL)
**Estado atual:** aiContext.js tem contexto generico.
**Entrega:** prompt clinico especializado em `aiContextOdonto.js`:
  - Modo "Evolucao por voz": dentista grava audio no celular, transcreve (Whisper) + Claude estrutura em SOAP (Subjetivo/Objetivo/Avaliacao/Plano)
  - Modo "Diagnostico assistido": dentista descreve queixa + ve sugestoes de procedimentos do catalogo
  - Modo "Plano de tratamento": IA monta proposta baseada em odontograma + anamnese
  - Modo "Resposta paciente": gera respostas WhatsApp para duvidas comuns
**Esforco:** 3 sessoes (prompt engineering + Whisper integration + UI chat dedicada + testes)
**Aceite:** "acabei extracao 36, anestesia mepivacaina, sutura 4-0" vira evolucao SOAP estruturada no prontuario
**Plano:** Expansao only (nao Negocio)

### W3-02 — Marketing odonto (campanhas + indicacoes)
**Estado atual:** nao existe.
**Entrega:**
  - Tabela `dental_campaigns` (id, company_id, name, segment, message_template, scheduled_at, sent_count)
  - Tabela `dental_referrals` (id, company_id, referrer_customer_id, referred_customer_id, status, reward)
  - FE: aba "Marketing" dentro de Engajamento com 2 sub-tabs:
    - Campanhas (filtra pacientes por: ultima visita, procedimento, valor, plano. Envia WhatsApp em massa via fila)
    - Indicacoes (cria link unico de indicacao, dashboard de quem indicou quem, recompensas configuraveis)
**Esforco:** 2 sessoes
**Aceite:** dentista cria campanha "limpeza profilatica em outubro" pra todos que nao vem ha 6 meses

### W3-03 — Relatorios exportaveis
**Estado atual:** dashboard mostra dados mas nao exporta.
**Entrega:**
  - BE: endpoints `/dental/reports/financeiro`, `/dental/reports/produtividade`, `/dental/reports/convenios`, `/dental/reports/repasses`
  - FE: tela "Relatorios" em Configuracoes ou Financeiro com:
    - Filtro periodo
    - Selecao de relatorio
    - Botoes "Exportar PDF" e "Exportar Excel"
  - PDFKit + ExcelJS no BE
**Esforco:** 2 sessoes
**Aceite:** dentista gera PDF "Faturamento Marco 2026 por convenio" em 1 clique

### W3-04 — Marketing dashboard (origem do paciente)
**Estado atual:** dental_leads.source existe mas nao ha analytics.
**Entrega:**
  - Cartao no OdontoDashboard: "Origem dos novos pacientes este mes" (Indicacao 40%, Instagram 25%, Walk-in 20%, Site 15%)
  - Drilldown: clicar fonte ve lista
  - Compativel com utm_source futuro do agendamento online publico (W1-03)
**Esforco:** 0.5 sessao
**Aceite:** dentista entende de onde vem cliente

### W3-05 — Faceograma HOF basico
**Estado atual:** nao existe (Simples Dental tem em Pro).
**Entrega:**
  - Componente `FaceogramaTab.tsx` dentro do PatientHub
  - Upload foto rosto + sobreposicao linhas Harmonia Orofacial (sorrisao, simetria, terco facial)
  - Salvo em dental_images com tipo='faceograma'
**Esforco:** 2 sessoes (visao computacional opcional, MVP e canvas overlay manual)
**Aceite:** dentista marca pontos referenciais, gera relatorio facial pro paciente

**Total Onda 3: ~9.5 sessoes**

---

## DEFERRED (aguarda externo)

- **WhatsApp Cloud API real** — codigo pronto, aguarda Meta app verification
- **NFS-e odonto** — aguarda Nuvem Fiscal + certificado A1
- **App nativo paciente (iOS/Android)** — fora do escopo Expo atual; portal web cobre 80%

---

## NAO FAZER (decisao explicita)

- Copiloto WhatsApp Web — Simples Dental tem com 100k usuarios, nao vamos ganhar
- Multi-unidade enterprise — fora do publico MEI/ME
- 50+ relatorios pre-fabricados (Clinicorp) — exportadores customizaveis cobrem mais valor
- Integracao com 100 maquininhas (Asaas ja resolve)

---

## Roadmap visual

```
Sem 1-2:  W1-01 PatientHub + W1-02 Imagens R2     [DRILL-DOWN]
Sem 3:    W1-03 Agendamento online + W1-04 Assinatura
Sem 4:    W2-01 Sidebar 6 secoes + W2-02 WhatsApp sistemico
Sem 5:    W2-03 Drag-drop agenda + W2-04 Dashboard acionavel
Sem 5.5:  W2-05 Leads-como-pacientes
Sem 6-8:  W3-01 IA Odonto SOAP + voz       [GRANDE DIFERENCIAL]
Sem 9-10: W3-02 Marketing campanhas + indicacoes
Sem 11:   W3-03 Relatorios exportaveis
Sem 11.5: W3-04 Origem do paciente
Sem 12-13: W3-05 Faceograma HOF
```

~13 semanas de trabalho focado pra produto odonto completo, defensavel
contra Simples Dental e Clinicorp na proposta integrada.
