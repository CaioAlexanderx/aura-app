# Aura — Tasks de Integracao e API
## Roadmap para App 100% Funcional
**Atualizado:** 09/04/2026 | **Status:** Backlog UAT 21/21 completo + CSV Import/Export pronto

---

## BLOCO 1 — Backend: Persistencia de Dados (Pre-requisito)

### INT-COMPANY-01: Endpoint PUT /companies/:id (update perfil)
- Repo: aura-backend | Esforco: 2h
- Criar: PUT /companies/:id aceita name, cnpj, phone, address, logo_url, tax_regime
- Frontend: configuracoes.tsx chama API no handleSave()

### INT-COMPANY-02: Salvar tax_regime no registro/onboarding
- Repo: aura-backend | Esforco: 1h
- Backend: POST /auth/register deve persistir tax_regime na tabela companies

### INT-STOCK-01: stock_qty_decrement no PATCH /products/:pid
- Repo: aura-backend | Esforco: 1h
- SQL: UPDATE products SET stock_qty = GREATEST(0, stock_qty - $1)

### INT-EMPLOYEES-01: CRUD Funcionarios
- Repo: aura-backend | Esforco: 4h
- Criar tabela employees + rotas GET/POST/PATCH/DELETE
- Frontend: hooks/useEmployees.ts + remover dummy data da Folha

---

## BLOCO 2 — Billing: Checkout Hibrido Pix + Cartao (PRIORIDADE)

### INT-ASAAS-01: Checkout inline Pix + Cartao recorrente
- Esforco: 8h | Bloqueia: Monetizacao
- Modelo: Cliente nunca sai do app, nunca ve o Asaas

**Fluxo Cartao (default — recorrencia automatica):**
1. Frontend carrega SDK tokenizacao Asaas (script JS)
2. Cliente preenche cartao no app → dados tokenizados no browser
3. Frontend envia creditCardToken para POST /billing/subscribe
4. Backend cria customer Asaas silencioso (POST /v3/customers com dados do cadastro)
5. Backend cria assinatura (POST /v3/subscriptions billingType:CREDIT_CARD cycle:MONTHLY)
6. Asaas cobra automaticamente todo mes + retry se cartao recusar
7. Webhook PAYMENT_RECEIVED → UPDATE companies SET plan, billing_status

**Fluxo Pix (alternativa):**
1. Backend cria assinatura Asaas (POST /v3/subscriptions billingType:PIX cycle:MONTHLY)
2. Backend busca QR (GET /v3/payments/{id}/pixQrCode) → retorna base64 + copia-e-cola
3. Frontend exibe QR inline + timer 30min + polling a cada 3s
4. Asaas gera cobranca Pix automatica mensal + lembrete email/SMS
5. Webhook confirma → plano ativa

**UX (3 passos):** Escolher plano → Pagar (cartao ou pix no app) → Acesso liberado

**Seguranca:**
- Dados cartao NUNCA tocam servidor Aura (tokenizacao client-side)
- Webhook sempre HMAC-SHA256
- asaas_customer_id salvo em companies (criado uma vez, reutilizado)

**Implementacao backend (billing.js):**
- Trocar POST /v3/payments (avulso) por POST /v3/subscriptions (recorrente)
- Aceitar creditCardToken ou billingType:PIX no body
- Novo endpoint: POST /billing/pix-qrcode/:paymentId → retorna QR

**Implementacao frontend (planos.tsx):**
- Aba Cartao/Pix (cartao pre-selecionado)
- Form cartao: numero, validade, CVV, nome → tokeniza via SDK Asaas
- Aba Pix: QR code inline + copia-e-cola + timer
- Polling billingApi.status() a cada 3s ate confirmar

---

## BLOCO 3 — Integracoes Externas

### INT-NFE-01: NF-e via provedor (Focus NFe / PlugNotas)
- Esforco: 12h | Bloqueia: Emissao de nota fiscal
- Fase 1: NFS-e (80% clientes servico)
- Fase 2: NFC-e (95% clientes varejo)
- Requisitos por cliente: CNPJ + certificado A1 + inscricao municipal
- Arquitetura: Aura backend chama API com CNPJ do cliente como emitente
- XMLs no Cloudflare R2 (5 anos retencao fiscal)
- Cancelamento: app envia → provedor transmite evento → SEFAZ/prefeitura

### INT-WA-01: WhatsApp Business API
- Esforco: 8h | Bloqueia: Automacoes WhatsApp
- Modelo: Numero unico da Aura, mensagem identifica negocio do cliente
- Setup: Meta Business Manager → app + phone ID + token
- Backend proxy: POST /companies/:id/whatsapp/send → Meta Graph API v21
- Templates: boas-vindas, aniversario, cobranca, pos-venda, lembrete, fora de horario
- Aprovacao Meta: 24-72h por template
- Cron job: verifica triggers (aniversarios, vencimentos, pos-venda)
- Webhook: delivery status (sent → delivered → read)
- Automacoes custom = servico consultoria Aura (nao self-service)

---

## BLOCO 4 — Frontend Wiring

### FE-EDIT-PRODUCT-01: Botao editar no ProductRow (1h)
### FE-CTA-01: Wiring CTAs WhatsApp/email (30min)
### FE-FOLHA-01: Remover dummy data da Folha (2h, depende INT-EMPLOYEES-01)
### ~~FE-IMPORT-01: Import/Export CSV~~ COMPLETO (09/04)

---

## BLOCO 5 — Deploy Checklist

- [ ] Variaveis Railway (ASAAS_API_KEY, NFE_PROVIDER_KEY, WHATSAPP_TOKEN, R2)
- [ ] api.getaura.com.br → Railway CNAME
- [ ] Alinhar precos site vs app (R$59/89, R$200/199, R$320/299)
- [ ] Sentry source maps + alert rules
- [ ] Asaas sandbox → producao (apos CNPJ ativo)
- [ ] Certificado A1 de teste para NF-e sandbox

---

## Ordem de Execucao

**Sprint 1 (proxima sessao):** INT-COMPANY-01/02, INT-STOCK-01, FE-CTA-01, FE-EDIT-PRODUCT-01
**Sprint 2:** INT-ASAAS-01 (checkout hibrido Pix+Cartao), INT-EMPLOYEES-01, FE-FOLHA-01
**Sprint 3:** INT-NFE-01, INT-WA-01, Deploy
**Sprint 4 (pos-lancamento):** NFC-e fase 2, Open Banking, Verticais

---

## Sessao 09/04 — Resumo do que foi feito

Backlog UAT completo:
- 5 Criticos (sidebar scroll, PDV duplo clique, cliente 403, config persist, theme wipe)
- 7 Altos (currency mask, edit product, categories, stock decrement, client masks, contador)
- 9 Medios (pendente status, planos anual, completude sync, pro-labore toggle, WA persist, donut contrast, regime detect, CNPJ lookup, optimistic delete)

Features novas:
- CSV Import/Export em Financeiro, Estoque, Clientes (com separator detection PT-BR)
- Fluxos desenhados: Pagamento, WhatsApp, NF-e
- Checkout redesenhado: hibrido Pix inline + Cartao recorrente (Asaas invisivel)
