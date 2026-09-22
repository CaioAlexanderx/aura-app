# CONTRATO — módulo Matcon (materiais de construção)

**Data:** 22/09/2026 · **Status:** proposto pelo front, aguardando backend · chaves de config sincronizadas com `docs/mockups/matcon-modulo.html` (tela 1)
**Regra da casa:** backend mergeado antes de abrir o PR do front que depende de coluna/rota nova.
**Contexto:** `docs/matcon-faseamento-po-ux.md` (fases M0–M4) e `docs/matcon-pesquisa-mercado-gap.md`.

O modelo de opt-in é o mesmo da OS (`os_enabled`) e da Ótica (`otica_enabled`, migration 334): a loja liga em Configurações, o front esconde/mostra, o backend bloqueia só a **escrita** das rotas `matcon` quando o toggle está off.

---

## M0 — Fundação gated

### 1. `pdv_settings` (PUT faz merge parcial — contrato atual)

| Chave | Tipo | Default | Uso |
|---|---|---|---|
| `matcon_enabled` | boolean | `false` | opt-in do módulo. Backend: rotas `/matcon/*` respondem 403 na escrita quando `false`. |
| `matcon_default_waste_pct` | number | `10` | perda padrão (%) sugerida na calculadora de ambiente (M3) |
| `matcon_round_to_package` | boolean | `true` | ao vender unidade fracionada com `purchase_factor`, o front mostra "= N caixas"; **não** altera a quantidade vendida sozinho |
| `matcon_default_delivery_days` | integer | `2` | prazo padrão de entrega, usado no orçamento (M1) |
| `matcon_units` | string[] | `["m²","m³","m","sc","br","mlh","ton","pç"]` | unidades do grupo "Materiais" que a loja habilitou ("Minha loja vende em …" na config). O cadastro de produto mostra só essas; as demais de `MATCON_UNITS` ficam atrás de "+ rolo, lata, balde". |
| `matcon_quote_valid_days` | integer | `7` | validade padrão do orçamento (M1) |
| `matcon_quote_warn_days` | integer | `3` | quantos dias antes de vencer o orçamento entra em "Vencendo" e avisa o vendedor (M1) |

Nenhuma dessas chaves existe para lojas sem o módulo; o `GET` continua devolvendo só o que está salvo (front tem defaults).

### 2. `products` — colunas novas (todas opcionais, `NULL` = comportamento de hoje)

| Coluna | Tipo | Regra |
|---|---|---|
| `stock_qty` | **`numeric(12,3)`** (era integer) | **Migration mais delicada.** `variants.stock_qty` idem; `variants_stock_total` continua sendo a soma. Relatórios, curva ABC e alertas de mínimo somam `numeric` sem cast. Lojas existentes: valores inteiros continuam inteiros (12 → 12.000, o front formata "12"). |
| `min_stock` | `numeric(12,3)` | idem |
| `unit` | `varchar` (já existe) | passa a aceitar `m`, `m²`, `m³`, `sc`, `br`, `ton`, `mlh`, `pç`, `rolo`, `lata`, `balde`, além das 9 atuais. **Sem enum no banco**; validação por lista no backend. |
| `purchase_unit` | `varchar` nullable | unidade em que a loja compra (ex.: `cx`). `NULL` = compra na mesma unidade que vende. |
| `purchase_factor` | `numeric(12,4)` nullable | quantas unidades de venda cabem em 1 unidade de compra (ex.: `2.32` m² por caixa). Só faz sentido com `purchase_unit`. Backend rejeita `<= 0`. |
| `weight_kg` | `numeric(10,3)` nullable | peso por unidade de venda; usado no bloco de transporte da NF-e (M2). Opcional desde M0 para o cadastro já capturar. |

**Payload** (POST/PATCH `/companies/:id/products`, mesmo endpoint de hoje): `stock_qty` e `min_stock` aceitam decimal; `purchase_unit`, `purchase_factor`, `weight_kg` são chaves novas, `undefined` = não toca, `null` = limpa.

**Resposta** (GET `/companies/:id/products`): os campos acima vêm no objeto do produto. `stock_qty` como número (não string).

### 3. Vendas e caixa — quantidade decimal

| Rota | Mudança |
|---|---|
| POST venda (PDV) / itens | `quantity` aceita `numeric(12,3)`. Total = `round2(unit_price × quantity)`. Baixa de estoque em decimal. |
| NFC-e / NF-e (`/companies/:id/nfce/*`) | `items[].quantity` decimal com 3 casas (`qCom`), `items[].unit` propaga para `uCom`. Nuvem Fiscal já aceita. |
| Relatórios / ranking / curva ABC | somas em `numeric`; onde exibia "N un" o front usa `fmtQty`. |

### 4. Importação de XML do fornecedor (`POST /companies/:id/products/import-danfe-xml`)

Sem mudança no parse. A **conversão** (quantidade da nota em `purchase_unit` × `purchase_factor` → estoque na unidade de venda, custo unitário ÷ fator) é feita no front no passo de conferência, só com `matcon_enabled`. O backend recebe o produto já convertido no PATCH. (Decisão: manter o parser burro; a conversão precisa do produto vinculado, que o front já conhece no `LinkProductModal`.)

### 5. `services/modules.js` — chaves de módulo

Aceitar em `module_overrides` (PUT do ClientsAdmin): `matcon.orcamentos`, `matcon.entregas`, `matcon.profissionais`, `matcon.config`, e a umbrella de permissão de membro `matcon.access`. Plano mínimo no front: Negócio para as três telas, Essencial para config.

> Dívida conhecida: `os`, `cupons` e `clientes.reativacao` ainda não são conhecidos por `modules.js` (PUT volta 400). Matcon **não** deve nascer com essa dívida.

---

## M1 — Orçamento → Pedido → Entrega

Client de referência: `services/matconApi.ts` (tipos e rotas abaixo já estão lá; o backend implementa o espelho).

### `quotes` (orçamentos)
`id`, `company_id`, `number` (sequencial por empresa), `status` ∈ `open | approved | lost | expired`, `customer_id`/`customer_name`/`customer_phone` nullable, `seller_id`/`seller_name` nullable, `valid_until` date (default hoje + `matcon_quote_valid_days`), `public_token`, `items[] {product_id, name, unit, quantity numeric(12,3), unit_price, discount}`, `subtotal`, `discount`, `total`, `notes`, `reference` (texto livre: "obra Rua das Acácias" — não é cadastro de obra), `approved_at`, `converted_sale_id`, `sent_at`, timestamps.

| Rota | Faz |
|---|---|
| `GET /companies/:id/matcon/quotes?status=&q=&limit=` | lista + `summary {open, expiring, approved, lost}` com `{count, total}` cada; `expiring` = `open` com `valid_until ≤ hoje + matcon_quote_warn_days` |
| `POST .../quotes` | cria (`QuoteCreateBody`) |
| `PATCH .../quotes/:qid` | status/itens/validade |
| `POST .../quotes/:qid/sent` | grava `sent_at` (o wa.me é aberto pelo front) |
| `POST .../quotes/:qid/convert` | cria a venda/pedido, reserva estoque, `status=approved`, devolve `{sale_id, cart[]}` |
| `GET /orcamento/:token` (público) | mesmo formato `PublicQuote` do Studio + `kind: "matcon"`, `shop.*`; `POST /orcamento/:token/respond` aceita/recusa |

Job diário: `open` com `valid_until < hoje` → `expired`.

### `deliveries` (entregas)
`id`, `company_id`, `sale_id`, `sequence` (1ª, 2ª entrega do mesmo pedido), `stage` ∈ `separating | ready | out | delivered`, `scheduled_for` date, `delivered_by` **texto livre** (decisão 22/09/2026), `customer_name`/`customer_phone`/`address`, `total` (da venda), `has_pending`, `public_token`, `items[] {sale_item_id, name, unit, quantity, sold_quantity, delivered_before}`, `out_at`, `delivered_at`, timestamps.

| Rota | Faz |
|---|---|
| `GET /companies/:id/matcon/deliveries?day=today|tomorrow|late|pending&stage=` | lista + `summary {separating, ready, out, delivered_today}` `{count,total}` + `pending_orders` |
| `POST .../deliveries` | `{sale_id, scheduled_for?}` — 1ª entrega de um pedido (o `convert` do orçamento cria sozinho) |
| `PATCH .../deliveries/:did` | `stage`, `delivered_by`, `scheduled_for`; `stage=out` grava `out_at`, `delivered` grava `delivered_at` |
| `POST .../deliveries/:did/split` | entrega parcial: `{items[{sale_item_id, quantity}], delivered_by?}` → marca esta como `delivered` com o que foi e cria a próxima (`sequence+1`) com o saldo; devolve `{delivered, next}` |
| `GET /acompanhar/:token` (público) | `tipo: "entrega"`, `etapas` = aprovado/separando/pronto/saiu/entregue, `itens[] {nome, entregue, total, unidade}`, `proxima_entrega` date nullable |

Regras: soma de `quantity` por `sale_item` nunca excede `sold_quantity`; a venda expõe `has_pending_delivery` (selo "saldo a entregar" no detalhe da venda).

### WhatsApp
O front abre o wa.me (`useWaVarejo`) com o link público; o backend só registra `sent_at`. Template "seu pedido saiu para entrega" reaproveita o mecanismo do "óculos prontos" da Ótica.

## M2 / M3 — só cabeçalhos (fecham após o piloto do M0+M1)

- **M2 fiscal (Simples):** `products.cest`, `products.origem` (0–8), `products.icms_st_paid` boolean (→ CSOSN 500 vs 102 na emissão); NF-e com bloco `transp` (peso a partir de `weight_kg`, volumes, transportadora "própria" default) gerado a partir de uma `delivery`.
- **M3 clube:** `professionals` (`customer_id`, `trade`, `points`), `sales.referred_by_professional_id`, regras de pontos em `pdv_settings.matcon_points_*`, resgate gera cupom na tabela de cupons existente.

---

## Checklist de aceite do backend (M0)

- [ ] `pdv_settings.matcon_enabled` persiste via PUT parcial e volta no GET / `auth/me`
- [ ] `stock_qty` decimal: criar produto com `12.5`, vender `2.25`, GET devolve `10.25`; ABC/alertas/ranking sem cast quebrado
- [ ] loja antiga sem o módulo: nenhuma diferença de resposta (inteiros continuam inteiros)
- [ ] `purchase_factor <= 0` → 400
- [ ] `modules.js` aceita as 5 chaves `matcon.*`
- [ ] escrita em rota `matcon/*` com toggle off → 403
