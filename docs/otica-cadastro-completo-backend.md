# Ótica: cadastro completo do cliente e foto da receita — o que falta no backend

Para: Teo · De: frente de Produto (app) · 23/11/2026
Repositório: `CaioAlexanderx/Aura-backend` (conferido em `origin/main` de 23/11/2026)
Front que depende disto: PR "Ótica: cadastro completo do cliente, editar e imprimir receita" no `aura-app`.

O app já está pronto para os três itens abaixo e **não manda nada** enquanto o servidor não avisar que aceita. Nenhuma loja recebe 400 por causa deste documento estar pendente.

## O que já existe e o app já usa (nada a fazer)

| Campo | Onde | Estado |
|---|---|---|
| `customers.cpf_cnpj` | `POST` e `PATCH /companies/:id/customers`; devolvido no `GET` e no `GET /me/customers` | Aceito. O PATCH valida o dígito (`parseCpfCnpjInput`) e grava só dígitos. |
| `customers.birth_date` | idem | Aceito (`parseBirthDate`). |
| `optical_prescriptions.*` | `PATCH /companies/:id/otica/prescriptions/:rxId` | Aceito. O app passou a usar para "Editar receita". |

O app manda `cpf_cnpj` **só com dígitos**, já validado na tela, e **só quando o campo foi mexido**.

## 1. RG, sexo e profissão no cliente

### Colunas

| Coluna | Tipo | Hoje |
|---|---|---|
| `customers.rg` | `TEXT` | Já existe (migration `148_karate_customers_ext.sql`). |
| `customers.gender` | `TEXT`, `CHECK (gender IN ('M','F','outro') OR gender IS NULL)` | Já existe (migration `050_unify_customers_patients.sql`). |
| `customers.occupation` | `TEXT` | **Não existe.** Migration nova: `ALTER TABLE customers ADD COLUMN IF NOT EXISTS occupation TEXT;` |

Nenhuma das três tem índice nem entra em busca.

### Rotas (`src/routes/customers.js`)

`POST /companies/:id/customers` e `PATCH /companies/:id/customers/:cid` passam a aceitar:

| Chave | Regra |
|---|---|
| `rg` | texto, `trim`, até 20 caracteres; vazio ou `null` apaga. Sem validação de formato (varia por estado). |
| `gender` | `'M'`, `'F'`, `'outro'`; vazio ou `null` apaga; outro valor → `400 { error, field: 'gender' }`. |
| `occupation` | texto, `trim`, até 80 caracteres; vazio ou `null` apaga. |

Mesmo comportamento do resto do PATCH: chave ausente não mexe na coluna. Mesma proteção do perfil (migration 341) e do `address_reference` (433): se a coluna `occupation` ainda não existir no banco (42703), a escrita segue sem ela e devolve `ignored_fields: ['occupation']`.

`GET /companies/:id/customers` e `GET /me/customers` (`src/routes/meAggregates.js`) passam a devolver, em cada cliente, `rg`, `gender` e `occupation` (string ou `null`).

### O aviso que liga os campos no app

O app só mostra RG, sexo e profissão quando a resposta do `GET` de clientes traz, **no topo** (ao lado de `customers`, `total`, `plan_limit`):

```json
{ "customers": [...], "customer_fields": ["rg", "gender", "occupation"] }
```

- Vale para `GET /companies/:id/customers` **e** `GET /me/customers` (o app usa o segundo na visão consolidada multi-CNPJ).
- Listar só o que o POST e o PATCH **de fato gravam**. Se a migration de `occupation` não foi aplicada, mandar `["rg", "gender"]` (o cache module-level que já existe para a 341/433 resolve).
- Sem a chave, o app não mostra os campos e não manda as chaves. Leitura no app: `utils/clienteDadosCompletos.ts`, `camposExtrasAceitos`.

## 2. CPF: três acertos pequenos

1. **`POST` não valida o CPF.** Hoje `cpf_cnpj` do POST vai cru para o banco (`['cpf_cnpj', cpf_cnpj || null]`), enquanto o PATCH valida e normaliza. Pedido: o POST usar o mesmo `parseCpfCnpjInput` (400 com `field: 'cpf_cnpj'` se inválido; gravar só dígitos). O app já valida antes, mas a importação e outros clientes da API não.
2. **CPF fora da listagem para quem não precisa.** Hoje o `GET` devolve `cpf_cnpj` de todos os clientes para qualquer usuário com acesso à lista. O app não mostra na lista (só na ficha aberta e no cadastro, e só com a ótica ligada), mas o dado trafega. Sugestão, a decidir com o Caio: manter como está (o cadastro precisa dele para editar) **ou** devolver mascarado na lista (`***.***.247-25`) e inteiro num `GET /customers/:cid`. Se mudar, avisar: o formulário usa o valor da lista para saber se o CPF foi mexido.
3. **CPF e receita fora de log.** Conferir que nenhum `console.log`/`console.error` das rotas de clientes e de `otica.js` imprime `req.body` inteiro, `cpf_cnpj` ou os campos `od_*`/`oe_*`. Em `customers.js` os `console.error` que li imprimem só `err.message`; não conferi o `falhar()` de `otica.js`. Cuidar para que mensagem de erro do Postgres com o valor (ex.: violação de CHECK) não vá para o log com o dado.

Sem mudança: CPF e receita **não** entram em mensagem de WhatsApp nem em `/acompanhar/:token`. O app não mexeu em nenhum dos dois.

## 3. Foto do papel da receita

O campo `optical_prescriptions.photo_url` já existe e o PATCH aceita texto nele, mas não há rota de envio. A foto é **dado de saúde** (LGPD, art. 5º, II): não pode ir para o bucket público onde ficam as fotos de produto.

### Rotas novas (`src/routes/otica.js`)

`POST /companies/:id/otica/prescriptions/:rxId/photo`

- Corpo (igual ao da foto de produto, `src/routes/productImage.js`): `{ "content": "<base64 sem o prefixo data:>", "content_type": "image/jpeg" | "image/png" | "image/webp" }`.
- Limite: 5 MB depois de decodificar. Fora disso: `400 { error, code: 'FOTO_INVALIDA' }`.
- Gate de escrita igual ao das outras rotas de receita (`assertOticaEnabled`, 403 `OTICA_DISABLED`).
- Guarda em área **privada** (ver `src/utils/r2Storage.js` e as rotas que já assinam URL: `karateDocuments.js`, `transactionReceipt.js`). Chave sugerida: `otica/<company_id>/prescriptions/<rxId>/<uuid>.<ext>`. Em `photo_url` grava a **chave**, não uma URL pública.
- Trocar a foto apaga o arquivo anterior.
- Resposta: `{ "prescription": { ...receita } }`, com `photo_url` já assinada (abaixo).

`DELETE /companies/:id/otica/prescriptions/:rxId/photo`

- Apaga o arquivo e zera `photo_url`. Resposta: `{ "prescription": { ...receita } }`.

### Leitura

Em `GET /otica/prescriptions`, `GET /otica/prescriptions/:rxId` e nas respostas de POST/PATCH, `photo_url` sai como **URL assinada de vida curta** (15 minutos bastam) ou `null`. O app abre essa URL em nova aba no "Ver foto"; não guarda nem repassa.

Fora do alcance, de propósito: a foto **não** entra no snapshot `service_orders.optical`, no `/print/os/:id`, no tracker público nem em template de WhatsApp. Excluir a receita (`DELETE /prescriptions/:rxId`) apaga o arquivo junto.

### O aviso que liga o anexo no app

`GET /companies/:id/otica/settings` passa a devolver, ao lado de `settings`:

```json
{ "settings": { ... }, "capabilities": { "prescription_photo": true } }
```

Sem `capabilities.prescription_photo === true`, o app não desenha o bloco da foto (`components/otica/FotoDaReceita.tsx`).

## 4. Achados no caminho (não fazem parte do pedido; decidir se viram card)

1. **Receita de cliente de outra loja do mesmo dono dá 404.** `validarClienteEMedidor` (`otica.js`) confere `customers WHERE id = $1 AND company_id = $2`, mas o cliente é do dono (owner-scope, `getOwnerScopedCompanyIds`) e a lista do app mostra os clientes de todas as lojas. Numa conta multi-CNPJ, escolher na loja A um cliente cadastrado na loja B devolve "Cliente nao encontrado nesta empresa". Mesmo padrão a conferir em `validarRefsOtica` (`serviceOrders.js`).
2. **OS de óculos sem sinal nunca vira venda.** Sem sinal, `deposit_sale_id` fica nulo e `status = 'entregue'` só fecha a OS: nada entra no caixa e a armação do estoque não baixa. O app passou a avisar isso na abertura e na tela da OS, e a levar ao Caixa, mas não há vínculo: a venda feita no Caixa não sabe da OS. O PATCH da OS já aceita `deposit_sale_id`; faltaria o Caixa devolver a venda para a OS (como a OS de reparo faz) — decisão de produto.
3. **Aniversário sem ano tem dois anos de enfeite.** O formulário do app grava `2000` (`parseBirthday`, `hooks/useCustomers.ts`); as importações de planilha gravaram `1904`. O app trata `1904` como "sem ano" (avisa na ótica e não imprime o ano) e, **com a ótica ligada**, passou a gravar o "sem ano" como `1904` também pelo formulário; fora da ótica segue `2000`, como sempre foi. `2000` não dá para distinguir de quem nasceu em 2000. Sugestão: um booleano `birth_year_unknown` (ou padronizar `1904` em todo o app, sabendo que os `2000` já gravados sem ano não são identificáveis).

## Como conferir que ficou certo

1. `GET /companies/:id/customers` devolve `customer_fields` e os três campos por cliente.
2. No app, com a ótica ligada: Clientes › Adicionar cliente mostra RG, Sexo e Profissão dentro de "Dados completos"; salvar e reabrir mantém os valores.
3. `PATCH` com `{ "gender": "X" }` → 400 com `field: 'gender'`.
4. `GET /otica/settings` devolve `capabilities.prescription_photo: true`; em Ótica › Receitas, a receita aberta mostra "Anexar foto"; depois de anexar, "Ver foto" abre a URL assinada e ela expira.
5. `/acompanhar/:token` de uma OS cuja receita tem foto e cujo cliente tem CPF não devolve nenhum dos dois.
