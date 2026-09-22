# CONTRATO — módulo Matcon (materiais de construção)

**Data:** 22/09/2026 · **Status:** proposto pelo front, aguardando backend
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

## M1 — Orçamento → Pedido → Entrega (esboço para dimensionar; fecha depois do mockup)

### `quotes` (orçamentos)
`id`, `company_id`, `number` (sequencial por empresa), `customer_id` nullable, `seller_id` nullable, `status` ∈ `open | approved | lost | expired`, `valid_until` date, `public_token`, `items[] {product_id, name, unit, quantity numeric(12,3), unit_price, discount}`, `subtotal`, `discount`, `total`, `notes`, `approved_at`, `converted_sale_id` nullable, timestamps.
Rotas: `GET/POST /companies/:id/matcon/quotes`, `PATCH .../:qid` (status, itens), `POST .../:qid/convert` (cria a venda/pedido e reserva estoque), `GET /orcamento/:token` (público — reaproveita a página pública do Studio; resposta no mesmo formato `PublicQuote` + `shop.*`), `POST /orcamento/:token/accept|decline`.
Job diário: `open` com `valid_until < hoje` → `expired`.

### `deliveries` (entregas)
`id`, `company_id`, `sale_id`, `stage` ∈ `separating | ready | out | delivered`, `scheduled_for` date, `delivered_by` **texto livre** (decisão 22/09/2026: sem cadastro de motorista), `items[] {sale_item_id, quantity numeric(12,3)}`, `public_token`, timestamps.
Regras: soma de `quantity` por `sale_item` nunca excede o vendido; **entrega parcial** = criar a próxima `delivery` com o saldo automaticamente (`POST .../:did/split`). A venda expõe `pending_delivery_qty` por item e `has_pending_delivery` para o selo "saldo a entregar".
Rotas: `GET/POST /companies/:id/matcon/deliveries`, `PATCH .../:did` (stage, delivered_by, scheduled_for), `POST .../:did/split`.
Tracker público: `GET /acompanhar/:token` devolve `tipo: "entrega"` com `etapas` = as quatro estações (o front já renderiza `tipo === "oculos"`; `"entrega"` só troca textos).

### WhatsApp
Reaproveita os templates existentes: envio do link do orçamento e "seu pedido saiu para entrega" (mesmo mecanismo do "óculos prontos" da Ótica).

---

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
