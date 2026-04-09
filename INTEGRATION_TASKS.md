# Aura — Tasks de Integração e API
## Roadmap para App 100% Funcional
**Data:** 09/04/2026 | **Status:** Pós-UAT, todos os 21 itens Crit+Alto+Medio resolvidos

---

## BLOCO 1 — Backend: Persistência de Dados (Pré-requisito)

### INT-COMPANY-01: Endpoint PUT /companies/:id (update perfil)
- Repo: aura-backend | Esforço: 2h
- Atualmente: Config salva apenas em localStorage
- Criar: PUT /companies/:id aceita name, cnpj, phone, address, logo_url, tax_regime
- Frontend: configuracoes.tsx chama API no handleSave()

### INT-COMPANY-02: Salvar tax_regime no registro/onboarding
- Repo: aura-backend | Esforço: 1h
- Backend: POST /auth/register deve persistir tax_regime na tabela companies
- Frontend: Enviar tax_regime detectado durante register

### INT-STOCK-01: stock_qty_decrement no PATCH /products/:pid
- Repo: aura-backend | Esforço: 1h
- Backend: Aceitar campo stock_qty_decrement no PATCH products
- SQL: UPDATE products SET stock_qty = GREATEST(0, stock_qty - $1)

### INT-EMPLOYEES-01: CRUD Funcionários
- Repo: aura-backend | Esforço: 4h
- Criar tabela employees + rotas GET/POST/PATCH/DELETE
- Frontend: hooks/useEmployees.ts + remover dummy data da Folha

---

## BLOCO 2 — Integrações Externas (Pós-CNPJ)

### INT-ASAAS-01: Billing end-to-end via Asaas
- Esforço: 8h | Bloqueia: Monetização
- Fluxo: subscribe → subconta Asaas → cobrança → webhook → ativa plano
- Testar sandbox → migrar produção quando CNPJ ativo

### INT-NFE-01: NF-e via provedor (Focus NFe / PlugNotas)
- Esforço: 12h | Bloqueia: Emissão de nota fiscal
- Fase 1: NFS-e (80% clientes serviço)
- Fase 2: NFC-e (95% clientes varejo)
- Requisitos por cliente: CNPJ + certificado A1 + inscrição municipal
- Armazenar XMLs no Cloudflare R2 (5 anos retenção fiscal)

### INT-WA-01: WhatsApp Business API
- Esforço: 8h | Bloqueia: Automações WhatsApp
- Meta Business Manager: app + phone number ID + token
- Backend proxy: POST /companies/:id/whatsapp/send → Meta Graph API v21
- Templates: boas-vindas, aniversário, cobrança, pós-venda

---

## BLOCO 3 — Frontend Wiring

### FE-EDIT-PRODUCT-01: Botão editar no ProductRow (1h)
### FE-CTA-01: Wiring CTAs WhatsApp/email (30min)
### FE-FOLHA-01: Remover dummy data da Folha (2h, depende INT-EMPLOYEES-01)
### FE-IMPORT-01: Import/Export CSV Estoque e CRM (4h)

---

## BLOCO 4 — Deploy Checklist

- [ ] Variáveis Railway (ASAAS, NFE, WA, R2)
- [ ] api.getaura.com.br → Railway CNAME
- [ ] Alinhar preços site vs app antes do lançamento
- [ ] Sentry source maps + alert rules

---

## Ordem de Execução

Sprint 1 (1-2d): INT-COMPANY-01/02, INT-STOCK-01, FE-CTA-01, FE-EDIT-PRODUCT-01
Sprint 2 (2-3d): INT-ASAAS-01, INT-EMPLOYEES-01, FE-FOLHA-01
Sprint 3 (3-5d): INT-NFE-01, INT-WA-01, Deploy
Sprint 4 (pós-lançamento): NFC-e, CSV Import, Open Banking
