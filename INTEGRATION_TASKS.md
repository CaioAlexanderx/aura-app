# Aura — Tasks de Integracao e API
## Roadmap para App 100% Funcional
**Atualizado:** 09/04/2026 (sessao 2) | **Status:** Sprint 1 + Sprint 2 COMPLETOS

---

## COMPLETO — Sprint 1 (09/04 sessao 2)

### ~~INT-COMPANY-01: Company Profile GET + PUT~~ COMPLETO
- Backend: src/routes/company.js (GET + PUT /companies/:id/profile)
- Valida CNPJ, tax_regime enum
- Frontend: configuracoes.tsx hydrate do backend + save via API

### ~~INT-COMPANY-02: Frontend wiring perfil~~ COMPLETO
- api.ts: getProfile() + updateProfile() adicionados ao companiesApi
- configuracoes.tsx: hydrate on mount + handleSave() chama PUT /profile

### ~~INT-STOCK-01: stock_qty_decrement atomico~~ COMPLETO
- Backend: PATCH /products/:pid com GREATEST(0, stock_qty - $1)
- Separado do update regular (early return)

### ~~FE-EDIT-PRODUCT-01: Botao editar produto~~ COMPLETO
- ProductRow.tsx: onEdit prop + "Editar produto" button
- estoque.tsx: editProduct state, abre AddProductForm pre-preenchido

### ~~FE-CTA-01: CTAs WhatsApp/email~~ COMPLETO
- configuracoes.tsx: secao "Precisa de ajuda?" com WhatsApp + email

### ~~FE-CNPJ-01: CNPJ lookup no cadastro e configuracoes~~ COMPLETO
- register.tsx: CNPJ obrigatorio, auto-fill empresa/telefone/endereco
- register.tsx: 2 campos telefone (empresa do CNPJ + contato pessoal)
- register.tsx: sem opcao "Nao tenho CNPJ", sem modo demo
- configuracoes.tsx: CNPJ lookup ao digitar 14 digitos, auto-fill campos vazios

---

## COMPLETO — Sprint 2 (09/04 sessao 2)

### ~~INT-ASAAS-01: Checkout hibrido Pix + Cartao~~ COMPLETO
- Backend billing.js REESCRITO com:
  - ensureAsaasCustomer() (cria customer Asaas silenciosamente)
  - getPlanValue() (calcula preco por plano + ciclo + metodo)
  - POST /billing/subscribe: aceita PIX ou CREDIT_CARD + cycle monthly/annual
  - Pix: retorna QR code + copia-e-cola inline
  - Card: aceita creditCardToken (tokenizacao client-side)
  - GET /billing/plans: endpoint publico para site
  - Planos anuais: cartao 15% off mensal, Pix a vista 20% off total
- Migration 036: billing_cycle + webhook_logs table
- Frontend checkout.tsx: tela completa com:
  - Seletor de plano (3 cards) + toggle mensal/anual
  - Abas Cartao/Pix, cartao como default
  - Form cartao: numero, validade, CVV, nome, CPF + tokenizacao
  - Pix: QR inline + copia-e-cola + polling 3s
  - Tela sucesso com redirect ao dashboard
  - Aceita ?plan= como parametro URL (para CTAs do site)
- api.ts: billingApi.subscribe atualizado com cycle/holderName/holderCpf
- register.tsx: redirect condicional (trial → onboarding, sem trial → checkout)

**Precificacao implementada:**
| Plano | Mensal | Anual Cartao/mes | Anual Pix (1x) |
|-------|--------|------------------|-----------------|
| Essencial | R$ 89 | R$ 75,65 | R$ 854,40 |
| Negocio | R$ 199 | R$ 169,15 | R$ 1.912,40 |
| Expansao | R$ 299 | R$ 254,15 | R$ 2.870,40 |

---

## PENDENTE — Sprint 3: Integracao Funcionarios + Folha

### INT-EMPLOYEES-01: CRUD Funcionarios
- Repo: aura-backend | Esforco: 4h
- Criar tabela employees + rotas GET/POST/PATCH/DELETE
- Frontend: hooks/useEmployees.ts + remover dummy data da Folha

### FE-FOLHA-01: Remover dummy data da Folha
- Esforco: 2h | Depende: INT-EMPLOYEES-01
- Conectar folha.tsx ao backend real via useEmployees

---

## PENDENTE — Sprint 4: NF-e

### INT-NFE-01: NF-e via provedor fiscal
- Esforco: 12h | Bloqueia: Emissao de nota fiscal
- Fase 1: NFS-e (80% clientes servico)
- Fase 2: NFC-e (95% clientes varejo)
- Requisitos por cliente: CNPJ + certificado A1 + inscricao municipal
- Arquitetura: Aura backend chama API com CNPJ do cliente como emitente
- XMLs no Cloudflare R2 (5 anos retencao fiscal)
- Cancelamento: app → provedor → SEFAZ/prefeitura
- PENDENTE: Caio escolhendo provedor (Focus NFe, PlugNotas, Nota Gateway, Notaas)

---

## PENDENTE — Sprint 5: WhatsApp Business API

### INT-WA-01: WhatsApp Business API
- Esforco: 8h | Bloqueia: Automacoes WhatsApp
- Modelo: Numero unico da Aura, mensagem identifica negocio do cliente
- Setup: Meta Business Manager → app + phone ID + token
- Backend proxy: POST /companies/:id/whatsapp/send → Meta Graph API v21
- Templates: boas-vindas, aniversario, cobranca, pos-venda, lembrete, fora de horario
- Aprovacao Meta: 24-72h por template
- Cron job: verifica triggers (aniversarios, vencimentos, pos-venda)
- Automacoes custom = servico consultoria Aura (nao self-service)

---

## PENDENTE — Sprint 6: Deploy + Go-Live

### Deploy Checklist
- [ ] Aplicar migration 036 no Supabase (billing_cycle + webhook_logs)
- [ ] Variaveis Railway conferir (ASAAS_API_KEY, NFE_PROVIDER_KEY, WHATSAPP_TOKEN)
- [ ] Testar checkout Asaas no sandbox (Pix + Cartao)
- [ ] Asaas sandbox → producao
- [ ] api.getaura.com.br → Railway CNAME
- [ ] Alinhar precos site vs app (site: R$59/200/320 vs app: R$89/199/299)
- [ ] CTAs do site apontar para app.getaura.com.br/checkout?plan=negocio
- [ ] Sentry source maps + alert rules
- [ ] Certificado A1 de teste para NF-e sandbox
- [ ] Error boundary global + responsividade final
- [ ] LGPD consent banner
- [ ] 16 testes criticos UAT end-to-end
- [ ] Convidar 3-5 MEIs beta

---

## PENDENTE — Pos-Lancamento

- NFC-e fase 2 (varejo)
- Open Banking (Inter PJ)
- Verticais ativar por cliente (odonto, barber, food)
- Multi-gateway add-on (MP, InfinitePay, Stripe)
- FE-BUG-06: icones dashboard por tipo lancamento
- FE-BUG-07: sparklines/graficos com dados reais

---

## Historico de Sessoes

### Sessao 09/04 (madrugada) — UAT + CSV + Fluxos
- 21/21 UAT items resolvidos (5 crit + 7 alto + 9 medio)
- CSV Import/Export em 3 telas (separator detection PT-BR)
- Fluxos desenhados: Pagamento, WhatsApp, NF-e
- Checkout redesenhado: hibrido Pix + Cartao

### Sessao 09/04 (tarde) — Sprint 1 + Sprint 2
- Sprint 1: company profile, stock decrement, edit product, CTAs, CNPJ lookup
- Sprint 2: billing.js reescrito, checkout.tsx, redirect condicional
- Decisao: plano anual = assinatura mensal com desconto (nao parcelamento)
- Decisao: CNPJ obrigatorio no cadastro, 2 campos telefone
- Decisao: cadastro sem trial → checkout, com trial → onboarding
