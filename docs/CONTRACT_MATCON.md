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
| `POST .../quotes/:qid/convert` | `status=approved` + reserva de estoque; devolve `{quote, cart[]}`. **Não cria a venda**: ela nasce no Caixa (POST da venda leva `quote_id`; o backend grava `converted_sale_id`, baixa a reserva e cria a 1ª `delivery`). Decisão 22/09/2026 — evita pedido duplicado. |
| `GET /orcamento/:token` (público) | mesmo formato `PublicQuote` do Studio + `kind: "matcon"`, `shop.*`; `POST /orcamento/:token/respond` aceita/recusa |

Job diário: `open` com `valid_until < hoje` → `expired`.

### `deliveries` (entregas)
`id`, `company_id`, `sale_id`, `sequence` (1ª, 2ª entrega do mesmo pedido), `stage` ∈ `separating | ready | out | delivered`, `scheduled_for` date, `delivered_by` **texto livre** (decisão 22/09/2026), `customer_name`/`customer_phone`/`address`, `total` (da venda), `has_pending`, `public_token`, `items[] {sale_item_id, name, unit, quantity, sold_quantity, delivered_before}`, `out_at`, `delivered_at`, timestamps.

| Rota | Faz |
|---|---|
| `GET /companies/:id/matcon/deliveries?day=today|tomorrow|late|pending&stage=` | lista + `summary {separating, ready, out, delivered_today}` `{count,total}` + `pending_orders` |
| `POST .../deliveries` | `{sale_id, scheduled_for?}` — 1ª entrega de um pedido (a venda com `quote_id` cria sozinha; venda avulsa no Caixa pode criar por aqui) |
| `PATCH .../deliveries/:did` | `stage`, `delivered_by`, `scheduled_for`; `stage=out` grava `out_at`, `delivered` grava `delivered_at` |
| `POST .../deliveries/:did/split` | entrega parcial: `{items[{sale_item_id, quantity}], delivered_by?}` → marca esta como `delivered` com o que foi e cria a próxima (`sequence+1`) com o saldo; devolve `{delivered, next}` |
| `GET /acompanhar/:token` (público) | `tipo: "entrega"`, `etapas` = aprovado/separando/pronto/saiu/entregue, `itens[] {nome, entregue, total, unidade}`, `proxima_entrega` date nullable |

Regras: soma de `quantity` por `sale_item` nunca excede `sold_quantity`; a venda expõe `has_pending_delivery` (selo "saldo a entregar" no detalhe da venda).

### WhatsApp
O front abre o wa.me (`useWaVarejo`) com o link público; o backend só registra `sent_at`. Template "seu pedido saiu para entrega" reaproveita o mecanismo do "óculos prontos" da Ótica.

## M3 — Clube do Profissional + calculadora de ambiente

Client de referência: `services/matconApi.ts` (seção Profissionais). A calculadora é 100% front (só preenche a quantidade em m²).

### `pdv_settings` (novas chaves, merge parcial)
| Chave | Tipo | Default | Frase na config |
|---|---|---|---|
| `matcon_club_enabled` | boolean | `true` | "Tenho clube do profissional **[on]**" — desliga o chip do Caixa e a tela sem desligar o Matcon |
| `matcon_points_per_100` | integer | `10` | "A cada R$ **100** em compras indicadas, o profissional ganha **10** pontos." |
| `matcon_points_to_coupon` | integer | `100` | "**100** pontos viram um cupom de R$ **10** para ele usar na loja." |
| `matcon_coupon_value` | number | `10` | idem |

### `professionals`
`id`, `company_id`, `customer_id` (1:1 com o cliente — o profissional **é** um cliente marcado), `trade` ∈ `pedreiro | mestre_de_obras | eletricista | encanador | pintor | gesseiro | azulejista | arquiteto | engenheiro | marceneiro | outro`, `points_balance` integer, `points_earned_total`, `referrals_count`, `referred_sales_total` numeric, `last_referral_at`, `active` boolean, timestamps.

### Venda indicada
A lista de clientes (`GET /companies/:id/customers`) passa a devolver, com o toggle ligado, `professional: { id, trade, points_balance } | null` por cliente — a ficha usa isso para mostrar "Profissional · pedreiro · 1.240 pontos" sem segunda chamada.

`sales.referred_by_professional_id` nullable (o Caixa manda `referred_by_professional_id` no POST da venda). Ao gravar: pontos = `floor(total / 100) × matcon_points_per_100`, creditados no profissional com um lançamento em `professional_points_ledger` (`professional_id`, `sale_id` nullable, `delta`, `reason` ∈ `sale | redeem | adjust`, `created_at`). Cancelamento da venda estorna.

### Resgate
`POST .../professionals/:pid/redeem` → debita `matcon_points_to_coupon` pontos e cria um cupom na tabela de cupons existente (valor `matcon_coupon_value`, uso único, vinculado ao `customer_id` do profissional); devolve `{ coupon_code, points_balance }`. 400 se saldo insuficiente.

| Rota | Faz |
|---|---|
| `GET /companies/:id/matcon/professionals?filter=active|inactive_60d|new&q=` | lista + `summary { referred_total_month, active_count, pending_redeems }` |
| `POST .../professionals` | `{customer_id, trade}` — marca o cliente como profissional |
| `PATCH .../professionals/:pid` | `trade`, `active` |
| `GET .../professionals/:pid` | ficha + `ledger[]` (últimos 20) + `last_referrals[] {sale_id, customer_name, total, created_at}` |
| `POST .../professionals/:pid/redeem` | resgate → cupom |
| `GET .../professionals/search?q=` | busca por nome/telefone para o chip "Indicado por" do Caixa |

WhatsApp: o front abre o wa.me com o extrato ("você tem N pontos — já dá um cupom de R$ X"); o backend não envia nada no M3.

## M2 — Fiscal do Simples

O varejista do Simples Nacional **não calcula ST na venda**: o imposto já veio recolhido do distribuidor. O que ele precisa é marcar o item certo e informar o CEST. Motor de ST (MVA, base, FCP) para Lucro Presumido/Real fica fora.

### `products`
| Coluna | Tipo | Regra |
|---|---|---|
| `cest` | `char(7)` nullable | obrigatório na NFC-e/NF-e de item com ST; validado por formato (7 dígitos). O front sugere pelo NCM (`utils/ncm.ts`). |
| `origem` | `smallint` nullable | 0–8 (tabela SEFAZ); `NULL` = 0 na emissão |
| `icms_st_paid` | boolean nullable | "o imposto já veio recolhido na nota do fornecedor?" → na emissão, CSOSN **500** quando `true`, **102** quando `false`/`NULL` (empresa do Simples). Empresa fora do Simples ignora (usa a config fiscal atual). |
| `weight_kg` | já existe (M0) | peso por unidade de venda, para o bloco de transporte |

Payload igual ao de hoje (`POST/PATCH /products`): `cest`, `origem`, `icms_st_paid` — `undefined` não toca, `null` limpa. `GET /products` devolve os três. Endpoint auxiliar: `GET /companies/:id/products/fiscal-gaps` → `{ sem_cest: N, sem_ncm: N, ids[] }` para o aviso "12 produtos com NCM de cimento/tinta sem CEST" (o front pode calcular a partir da lista; o endpoint evita puxar 20 mil itens).

### Emissão (`POST /companies/:id/nfce/emit`)
- `items[]` ganha `cest`, `origem`, `icms_st_paid` (o backend também pode buscar do produto por `product_id`; o item enviado prevalece).
- `delivery_id` (nullable): a nota nasce de uma entrega — o backend copia destinatário/endereço da venda e preenche `<transp>`.
- `transporte` (`NfeTransporte`, ver `services/nfceApi.ts`): `modalidade` 0 (frete próprio) / 1 (por conta do cliente) / 9 (retira); `volumes`, `peso_bruto_kg`, `peso_liquido_kg` (default: soma de `weight_kg × quantity` dos itens), `transportadora_nome` ("própria" = dados da própria empresa), `cnpj`, `placa`, `uf_placa`. Nuvem Fiscal já aceita tudo isso; é mapeamento.
- A emissão a partir de uma entrega grava `deliveries.nfe_emission_id`; a esteira mostra "NF-e #N" no card e o rastreio público ganha o link do DANFE (`dados.danfe_url`).

### Config fiscal da empresa
`nfce_config.regime` ∈ `simples | presumido | real` (se ainda não existir): decide CSOSN vs CST. Front mostra a pergunta "imposto já veio recolhido" só quando `regime = simples` (default quando ausente).

## M4 — Profundidade (lote/tonalidade, devolução de sobra, compras)

Mockup: `docs/mockups/matcon-m4-profundidade.html`. Fora, de propósito: multi-depósito, kits/composições, cotação com vários fornecedores, alçada de desconto, classe A/B/C, inventário com coletor.

### Lote / tonalidade
Gate: `pdv_settings.matcon_lots_enabled` (boolean, default `false`) — "Controlo lote e tonalidade nos produtos vendidos em m² e m³". Só produtos com `unit` ∈ `m²`, `m³`.

`product_lots`: `id`, `company_id`, `product_id`, `lot_code` (texto livre: "27B"), `shade` (tonalidade, texto livre, nullable), `caliber` (bitola, texto livre, nullable), `qty` numeric(12,3) (saldo do lote na unidade de venda), `received_at`, `source_invoice` (número do XML), timestamps.

| Rota | Faz |
|---|---|
| `GET /companies/:id/products/:pid/lots` | lotes com saldo > 0, do mais antigo para o mais novo |
| `POST .../products/:pid/lots` | `{lot_code, shade?, caliber?, qty, source_invoice?}` — criado pela conferência do XML (`DanfeImportModal`) |
| `PATCH .../lots/:lid` | ajuste de saldo/tonalidade |
| venda (`POST /pdv/sale`) | `items[].lot_allocations[] {lot_id, quantity}` opcional; o backend baixa por lote e, sem alocação, baixa do mais antigo (FIFO). Soma das alocações = `quantity`. |
| entrega | `deliveries.items[].lot_code` derivado das alocações (o romaneio mostra o lote) |
| devolução | item devolvido com `lot_id` volta ao saldo daquele lote |

`GET /products` devolve `lots_summary: { count, lots: [{id, lot_code, qty}] }` quando o gate está ligado (a lista mostra "148,48 m² em 2 lotes").

### Devolução de sobra de obra (delta no wizard de troca)
- `returns.items[].quantity` aceita numeric(12,3); item de unidade fracionada com `purchase_factor`: só múltiplos de caixa fechada voltam ao estoque — `restock_qty = floor(quantity / purchase_factor) × purchase_factor`; o resto é `not_restocked_qty` (R$ 0, registrado para auditoria). Sem fator: volta tudo.
- `returns.items[].lot_id` opcional (volta ao lote de origem).
- Fluxo "não vai levar nada": a troca fecha sem itens novos com `settlement` ∈ `store_credit | refund` (o crédito na loja é o vale que já existe no crediário). Nada novo de tabela além das colunas acima.

### Compras
Chave de módulo `matcon.compras` (Negócio). Fornecedor = `supplier_name`/`supplier_cnpj` do último XML importado daquele produto (`products.last_supplier_name`, `last_supplier_cnpj`, `last_purchase_unit_cost`, `last_purchase_at` — gravados pelo import).

`GET /companies/:id/matcon/purchase-suggestions` → `{ suggestions: [{ product_id, name, unit, stock, min_stock, weekly_sales (últimos 30 dias ÷ 4,3), suggested_qty, est_cost, supplier_name, supplier_cnpj, days_to_stockout }], summary: { total_est_cost, items_below_min, suppliers } }`. Regra da sugestão: `suggested_qty = max(min_stock × 1,5, weekly_sales × 3) − stock`, arredondada para cima na unidade de compra quando houver `purchase_factor`.

`purchase_orders`: `id`, `company_id`, `number` ("C-0042"), `status` ∈ `draft | sent | received | cancelled`, `supplier_name`, `supplier_cnpj`, `supplier_phone`, `items[] {product_id, name, unit, quantity, unit_cost_est, received_qty}`, `total_est`, `sent_at`, `received_at`, `received_invoice` (número do XML), timestamps.

| Rota | Faz |
|---|---|
| `GET .../purchase-orders?status=` | lista + `summary {draft, sent, received_7d}` `{count, total}` |
| `POST .../purchase-orders` | cria de uma seleção de sugestões (status `draft`) |
| `PATCH .../purchase-orders/:oid` | itens/quantidades, `status: sent` grava `sent_at` (o WhatsApp é aberto pelo front com o texto do pedido) |
| import de XML | quando o XML tem `supplier_cnpj` igual ao de um pedido `sent`, o backend casa itens por `product_id`, grava `received_qty`, e fecha (`received`) quando tudo chegou; parcial fica `sent` com `received_qty` |

## Checklist de aceite do backend (M0)

- [ ] `pdv_settings.matcon_enabled` persiste via PUT parcial e volta no GET / `auth/me`
- [ ] `stock_qty` decimal: criar produto com `12.5`, vender `2.25`, GET devolve `10.25`; ABC/alertas/ranking sem cast quebrado
- [ ] loja antiga sem o módulo: nenhuma diferença de resposta (inteiros continuam inteiros)
- [ ] `purchase_factor <= 0` → 400
- [ ] `modules.js` aceita as 5 chaves `matcon.*`
- [ ] escrita em rota `matcon/*` com toggle off → 403
